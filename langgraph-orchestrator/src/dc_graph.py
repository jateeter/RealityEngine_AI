"""
dc_graph.py — LangGraph StateGraph for the 3-hour DC + AI monitoring simulation.

Orchestrates the full DC + AI monitoring pipeline:
  1. Load all DC/AI CES machine JSON files into the Reality Engine
  2. Register all DC/AI sensor sources with the Perception Engine (idempotent)
  3. Stream N minutes of simulated sensor data from DCWorkloadGenerator
  4. After each push, record which CES machines fired and any workload events
  5. Finalize: produce an operational report; optionally clean up loaded machines

Graph topology:
  initialize ──► process_step ──►(loop)
                      │
                      └──►(done)──► finalize ──► END

Usage::

    from src.dc_graph import run_dc_monitoring

    result = run_dc_monitoring(
        perception_url='http://localhost:3004',
        reality_url='http://localhost:3000',
        verbose=True,
    )
    print(result['report'])

Defaults:
  - machines_dir : ``<repo_root>/examples/machines/``  (loads DC*.json + AI*.json)
  - num_steps    : 180  (3 hours, one step per minute)
  - cleanup      : True  (loaded machines are removed from RE after the run)
"""

from __future__ import annotations

import json
import operator
import warnings
from pathlib import Path
from typing import Annotated, Optional

import httpx
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from .dc_sensors import ensure_sources, push_sensor_values
from .dc_workload import DCWorkloadGenerator

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Default: <repo_root>/examples/machines/
_DEFAULT_MACHINES_DIR = Path(__file__).parent.parent.parent / "examples" / "machines"

_TIMEOUT = httpx.Timeout(20.0)
_CLIENT_OPTS = dict(timeout=_TIMEOUT, verify=False)


# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class DCMonitoringState(TypedDict, total=False):
    # ── Inputs ──────────────────────────────────────────────────────────────
    perception_url: str          # Perception Engine base URL
    reality_url: str             # Reality Engine base URL
    machines_dir: str            # path to directory with CES machine JSON files
    num_steps: int               # number of workload steps (default: 180)
    verbose: bool                # print events as they occur
    cleanup: bool                # delete loaded machines in finalize (default: True)

    # ── Populated during initialize ─────────────────────────────────────────
    machines: dict               # {machine_stem → machine_id}
    source_uuids: dict           # {sensor_id → PE source UUID}
    workload: list               # list of step dicts from DCWorkloadGenerator
    step_index: int              # current step being processed

    # ── Accumulator (appended each step via LangGraph reducer) ──────────────
    step_results: Annotated[list, operator.add]

    # ── Populated during finalize ───────────────────────────────────────────
    report: str
    summary: str

    # ── Error ───────────────────────────────────────────────────────────────
    error: Optional[str]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_dc_machines(machines_dir: str, re_url: str) -> dict[str, str]:
    """Load all DC*.json and AI*.json CES machines from *machines_dir* into RE.

    Returns ``{filename_stem: machine_id}`` for every machine loaded.

    Raises:
        FileNotFoundError: If *machines_dir* does not exist.
        ValueError: If no matching JSON files are found.
        RuntimeError: If the Reality Engine rejects a machine import.
    """
    path = Path(machines_dir)
    if not path.exists():
        raise FileNotFoundError(f"machines_dir not found: {machines_dir}")

    json_files = sorted(path.glob("DC*.json")) + sorted(path.glob("AI*.json"))
    if not json_files:
        raise ValueError(
            f"No DC*.json or AI*.json files found in {machines_dir}"
        )

    machines: dict[str, str] = {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with httpx.Client(**_CLIENT_OPTS, base_url=re_url.rstrip("/")) as client:
            for json_file in json_files:
                machine_json = json.loads(json_file.read_text())
                stem = json_file.stem
                resp = client.post(
                    "/api/machines/json/import",
                    json={"json": json.dumps(machine_json)},
                )
                resp.raise_for_status()
                data = resp.json()
                if not data.get("success"):
                    raise RuntimeError(f"Machine import failed for {stem}: {data}")
                machines[stem] = data["machine"]["id"]

    return machines


def _push_step(pe_url: str, step: dict) -> dict:
    """Push all sensor values for *step* and trigger an assembled-vector push.

    Returns the raw PushResult dict from the Perception Engine.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with httpx.Client(**_CLIENT_OPTS) as client:
            # Write each sensor's values to the PE sensor endpoint
            for sensor_id, values in step["sensors"].items():
                r = client.post(
                    f"{pe_url}/api/sensors/{sensor_id}",
                    json={"values": values},
                )
                r.raise_for_status()

            # Trigger assembled-vector push → Reality Engine processImmediate
            r2 = client.post(f"{pe_url}/api/push")
            r2.raise_for_status()
            return r2.json()


def _extract_fired_machines(
    push_result: dict,
    id_to_name: dict[str, str],
) -> list[str]:
    """Return a list of machine names whose outputVector[0] >= 0.5."""
    machine_results: dict = push_result.get("step", {}).get("machineResults", {})
    fired: list[str] = []
    for mid, mdata in machine_results.items():
        if mid not in id_to_name:
            continue
        ov = mdata.get("outputVector")
        if ov is not None and isinstance(ov, list) and len(ov) > 0 and ov[0] >= 0.5:
            fired.append(id_to_name[mid])
    return fired


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def initialize(state: DCMonitoringState) -> dict:
    """Load DC/AI machines, register sensor sources, generate workload."""
    re_url = state.get("reality_url", "http://localhost:3000")
    pe_url = state.get("perception_url", "http://localhost:3004")
    machines_dir = state.get("machines_dir") or str(_DEFAULT_MACHINES_DIR)
    num_steps = state.get("num_steps", DCWorkloadGenerator.NUM_STEPS)

    try:
        machines = _load_dc_machines(machines_dir, re_url)
        source_uuids = ensure_sources(pe_url)
        workload = DCWorkloadGenerator().generate()[:num_steps]
    except Exception as exc:
        return {
            "error": f"Initialization failed: {exc}",
            "machines": {},
            "source_uuids": {},
            "workload": [],
            "step_index": 0,
        }

    if state.get("verbose"):
        print(
            f"[DC-MONITOR] Loaded {len(machines)} machines, "
            f"{len(source_uuids)} sensor sources. "
            f"Running {len(workload)} steps."
        )

    return {
        "machines": machines,
        "source_uuids": source_uuids,
        "workload": workload,
        "step_index": 0,
        "step_results": [],
    }


def process_step(state: DCMonitoringState) -> dict:
    """Push sensor values for the current simulation step and record firings."""
    if state.get("error"):
        return {}

    idx = state.get("step_index", 0)
    step = state["workload"][idx]
    pe_url = state.get("perception_url", "http://localhost:3004")
    id_to_name = {v: k for k, v in state.get("machines", {}).items()}

    try:
        push_result = _push_step(pe_url, step)
        fired = _extract_fired_machines(push_result, id_to_name)
    except Exception as exc:
        fired = []
        push_result = {}
        step_error = str(exc)
    else:
        step_error = None

    step_result: dict = {
        "minute": step["minute"],
        "wall_time": step["wall_time"],
        "phase": step["phase"],
        "events": step["events"],
        "fired_machines": fired,
    }
    if step_error:
        step_result["error"] = step_error

    if state.get("verbose") and (fired or step["events"]):
        print(
            f"  [{step['wall_time']} {step['phase']:>22s}]  "
            f"fired={fired}  events={step['events']}"
        )

    return {
        "step_index": idx + 1,
        "step_results": [step_result],
    }


def should_continue(state: DCMonitoringState) -> str:
    """Route: loop to process_step while steps remain; otherwise finalize."""
    if state.get("error"):
        return "finalize"
    idx = state.get("step_index", 0)
    if idx < len(state.get("workload", [])):
        return "process_step"
    return "finalize"


def finalize(state: DCMonitoringState) -> dict:
    """Build operational report and optionally clean up loaded machines."""
    if state.get("error"):
        return {
            "report": f"ERROR: {state['error']}",
            "summary": f"DC monitoring failed: {state['error']}",
        }

    step_results: list[dict] = state.get("step_results", [])
    machines: dict = state.get("machines", {})

    # ── Aggregate firings ────────────────────────────────────────────────────
    fire_count: dict[str, int] = {}
    fire_minutes: dict[str, list[int]] = {}
    phase_log: dict[str, list[str]] = {}

    for step in step_results:
        phase = step["phase"]
        minute = step["minute"]
        for name in step.get("fired_machines", []):
            fire_count[name] = fire_count.get(name, 0) + 1
            fire_minutes.setdefault(name, []).append(minute)
            phase_log.setdefault(phase, []).append(f"T+{step['wall_time']} {name}")
        for evt in step.get("events", []):
            phase_log.setdefault(phase, []).append(f"T+{step['wall_time']} EVENT:{evt}")

    # ── Build report ─────────────────────────────────────────────────────────
    lines = [
        "=" * 72,
        "DC + AI MONITORING — OPERATIONAL REPORT",
        f"Steps simulated : {len(step_results)}",
        f"Machines loaded : {len(machines)}",
        "=" * 72,
    ]

    if fire_count:
        lines.append("\nMachine activation summary:")
        for name in sorted(fire_count):
            count = fire_count[name]
            mins = fire_minutes[name]
            lines.append(
                f"  {name:<35s}  {count:3d}×  "
                f"(first=T+{mins[0]:03d}, last=T+{mins[-1]:03d})"
            )
    else:
        lines.append("\nNo CES machines fired during simulation.")

    _PHASE_ORDER = [
        "NORMAL_OPS", "TRAINING_RAMP_UP", "THERMAL_ESCALATION",
        "THERMAL_EMERGENCY", "COOLING_RECOVERY", "STABLE_NORMAL",
        "NETWORK_RAMP_UP", "NETWORK_ESCALATION", "NETWORK_RECOVERY",
        "COMBINED_EMERGENCY", "FULL_RECOVERY",
    ]
    lines.append("\nPhase event log:")
    for phase in _PHASE_ORDER:
        if phase not in phase_log:
            continue
        lines.append(f"  {phase}:")
        entries = phase_log[phase]
        for e in entries[:10]:
            lines.append(f"    {e}")
        if len(entries) > 10:
            lines.append(f"    … and {len(entries) - 10} more")

    report = "\n".join(lines)

    summary_lines = [
        "DC Monitoring Simulation Complete",
        f"  {len(step_results)} steps simulated",
        f"  {len(fire_count)} distinct machines activated",
        f"  {sum(fire_count.values())} total activations",
    ]

    # ── Optional cleanup ──────────────────────────────────────────────────────
    if state.get("cleanup", True) and machines:
        re_url = state.get("reality_url", "http://localhost:3000")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS, base_url=re_url.rstrip("/")) as client:
                for machine_id in machines.values():
                    try:
                        client.delete(f"/api/machines/{machine_id}").raise_for_status()
                    except Exception:
                        pass  # best-effort

    return {
        "report": report,
        "summary": "\n".join(summary_lines),
    }


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph():
    """Build and compile the DC monitoring StateGraph.

    Topology::

        initialize ──► process_step ──►(conditional)──► process_step  (loop)
                                                   └──► finalize ──► END
    """
    graph = StateGraph(DCMonitoringState)

    graph.add_node("initialize", initialize)
    graph.add_node("process_step", process_step)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("initialize")

    graph.add_conditional_edges(
        "initialize",
        should_continue,
        {"process_step": "process_step", "finalize": "finalize"},
    )
    graph.add_conditional_edges(
        "process_step",
        should_continue,
        {"process_step": "process_step", "finalize": "finalize"},
    )
    graph.add_edge("finalize", END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

def run_dc_monitoring(
    perception_url: str = "http://localhost:3004",
    reality_url: str = "http://localhost:3000",
    machines_dir: Optional[str] = None,
    num_steps: int = DCWorkloadGenerator.NUM_STEPS,
    verbose: bool = False,
    cleanup: bool = True,
) -> dict:
    """Run the DC + AI monitoring simulation and return the final state dict.

    Args:
        perception_url: Base URL of the Perception Engine.
        reality_url:    Base URL of the Reality Engine.
        machines_dir:   Directory containing DC*.json / AI*.json machine files.
                        Defaults to ``<repo_root>/examples/machines/``.
        num_steps:      Number of simulation steps (default: 180 = 3 hours).
        verbose:        Print per-step events to stdout.
        cleanup:        Remove loaded CES machines from RE after the run.

    Returns:
        The final LangGraph state dict.  Key fields:

        ``step_results``
            List of per-minute result dicts (``minute``, ``phase``,
            ``fired_machines``, ``events``).

        ``report``
            Multi-line operational report string.

        ``summary``
            One-paragraph human-readable summary.

        ``error``
            Set if initialization or a step failed; ``None`` otherwise.
    """
    app = build_graph()
    return app.invoke({
        "perception_url": perception_url,
        "reality_url": reality_url,
        "machines_dir": machines_dir or str(_DEFAULT_MACHINES_DIR),
        "num_steps": num_steps,
        "verbose": verbose,
        "cleanup": cleanup,
    })
