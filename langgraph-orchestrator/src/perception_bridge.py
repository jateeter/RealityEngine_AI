"""
perception_bridge.py — Bidirectional LangGraph ↔ Perception Engine bridge.

┌─────────────────────────────────────────────────────────────────────────────┐
│  Bidirectional data flow                                                     │
│                                                                              │
│  Reality Engine  ──► (machine outputs) ──► PE WebSocket ──► Bridge          │
│                                                                  │           │
│                                              ┌───────────────────┘           │
│                                              ▼                               │
│                                     LangGraph graph                          │
│                                    ┌──────────────────┐                     │
│                                    │  observe         │ map HIGH output      │
│                                    │                  │ bits → labels        │
│                                    │  resolve         │ look up rule →       │
│                                    │                  │ find target seq      │
│                                    │  emit (cond.)    │ POST TestSource      │
│                                    │                  │ to PE                │
│                                    └──────────────────┘                     │
│                                              │                               │
│  Perception Engine ◄── (new TestSource) ─────┘                              │
│       │                                                                      │
│       └──► Reality Engine ──► target machine runs injected sequence         │
└─────────────────────────────────────────────────────────────────────────────┘

Key design choices:

  Observe: maps each HIGH bit (> 0.5) in the machine's output vector to a
  semantic label using MACHINE_OUTPUT_LABELS from resolution_map.py.
  Labels are derived from the machine JSON outputVectors.metadata.description.

  Resolve: looks up RESOLUTION_RULES for the emitting machine. For each
  matching observation, finds the target machine in the schema (fetched from
  GET /api/machines at startup) and selects the right inputSequence by
  substring match on sequence name. Builds a TestSourceConfig ready to POST.

  Emit (conditional): only runs if resolve found a rule. POSTs the
  TestSourceConfig to POST /api/sources on the PE. The PE then assembles the
  sequence vectors into the perceptual space on subsequent auto-push steps,
  stepping the target machine through the intended CES sequence.

  Cooldown: a per-machine emission cooldown (default 3s) prevents tight
  feedback loops when machines produce repeated output signals.

  WebSocket: subscribes to wss://<pe-host>/ws and filters for push-result
  messages where transitionResult.arbiterMetadata.shouldOutput is true.

Usage::

    import asyncio
    from src.perception_bridge import run_bridge

    asyncio.run(run_bridge(
        pe_url="https://localhost:3004",
        re_url="https://localhost:3000",
    ))
"""

from __future__ import annotations

import asyncio
import json
import ssl
import time
import uuid
from typing import Optional

import httpx
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from .resolution_map import RESOLUTION_RULES, get_observations, get_severity

# ── State ─────────────────────────────────────────────────────────────────────

class RealityEvent(TypedDict):
    machine_id:    str
    machine_name:  str
    output_vector: list[float]
    output_region: dict           # {offset, length}
    global_step:   int
    timestamp:     int


class Resolution(TypedDict):
    action:               str
    rationale:            str
    severity:             str
    target_machine_name:  str
    target_sequence_name: str
    source_config:        dict    # ready-to-POST TestSourceConfig


class BridgeState(TypedDict):
    # Injected by the runner before each graph invocation
    pe_url:         str
    re_url:         str
    machine_schema: dict          # {machine_name → schema_entry}

    # Per-event (set from the WS push-result)
    event: RealityEvent

    # After observe
    observations: list[str]
    severity:     str

    # After resolve
    resolution: Optional[Resolution]

    # After emit
    emitted_source_id: Optional[str]


# ── Machine schema ─────────────────────────────────────────────────────────────

def fetch_machine_schema(re_url: str) -> dict[str, dict]:
    """
    GET /api/machines → build a name-keyed lookup table of each machine's
    input region and inputSequences (the resolution vocabulary).

    Returns:
        {
          "DailyPatientCare": {
            "id":             "<uuid>",
            "name":           "DailyPatientCare",
            "input_region":   {"offset": 186, "length": 8},
            "output_region":  {"offset": 194, "length": 8},
            "input_sequences": [
              {"name": "TC-01: ...", "vectors": [[0.9, 0.1, ...], ...]},
              ...
            ],
          },
          ...
        }
    """
    with httpx.Client(verify=False, timeout=15) as client:
        resp = client.get(f"{re_url.rstrip('/')}/api/machines")
        resp.raise_for_status()
        machines = resp.json().get("machines", [])

    schema: dict[str, dict] = {}
    for m in machines:
        name     = m.get("name", "")
        pm       = m.get("perceptualMapping") or {}
        metadata = m.get("metadata") or {}
        schema[name] = {
            "id":              m.get("id", ""),
            "name":            name,
            "input_region":    pm.get("input",  {}),
            "output_region":   pm.get("output", {}),
            "input_sequences": metadata.get("inputSequences", []),
        }
    return schema


# ── LangGraph nodes ───────────────────────────────────────────────────────────

def observe(state: BridgeState) -> dict:
    """
    Map HIGH output bits → semantic observation labels + severity.
    Uses MACHINE_OUTPUT_LABELS from resolution_map.py.
    """
    event        = state["event"]
    observations = get_observations(event["machine_name"], event["output_vector"])
    severity     = get_severity(observations)
    return {"observations": observations, "severity": severity}


def resolve(state: BridgeState) -> dict:
    """
    Look up the first matching RESOLUTION_RULE for the observed labels.
    Find the target machine and a matching inputSequence by name.
    Build a TestSourceConfig ready to POST to the PE.
    Returns resolution=None if no rule applies or no matching sequence found.
    """
    machine_name   = state["event"]["machine_name"]
    observations   = state["observations"]
    machine_schema = state["machine_schema"]
    rules          = RESOLUTION_RULES.get(machine_name, {})

    for obs in observations:
        rule = rules.get(obs)
        if not rule:
            continue

        target_name = rule["target_machine"]
        target      = machine_schema.get(target_name)
        if not target or not target.get("input_region"):
            continue

        # Find matching inputSequence by substring on name
        seq_keyword = rule["target_sequence"].lower()
        matched_seq = next(
            (s for s in target["input_sequences"]
             if seq_keyword in s.get("name", "").lower()),
            None,
        )
        if not matched_seq:
            continue

        source_config = {
            "type":         "test",
            "name":         f"LangGraph → {target_name}: {matched_seq['name']}",
            "region":       target["input_region"],
            "active":       True,
            "machineId":    target["id"],
            "machineName":  target_name,
            "sequenceName": matched_seq["name"],
            "inputs":       matched_seq["vectors"],
            "loop":         False,       # play the sequence once
        }

        resolution = Resolution(
            action=rule["action"],
            rationale=(
                f"{machine_name} emitted [{obs}] "
                f"→ {rule['action']} on {target_name} "
                f"via '{matched_seq['name']}'"
            ),
            severity=rule["severity"],
            target_machine_name=target_name,
            target_sequence_name=matched_seq["name"],
            source_config=source_config,
        )
        return {"resolution": resolution}

    return {"resolution": None}


def emit(state: BridgeState) -> dict:
    """
    POST the resolution's TestSourceConfig to PE /api/sources.
    The PE will step the target machine through the injected sequence on the
    next auto-push cycles, injecting the resolution into the perceptual space.
    """
    resolution = state["resolution"]
    if not resolution:
        return {"emitted_source_id": None}

    pe_url = state["pe_url"].rstrip("/")
    with httpx.Client(verify=False, timeout=10) as client:
        resp = client.post(f"{pe_url}/api/sources", json=resolution["source_config"])
        resp.raise_for_status()
        source_id = resp.json().get("source", {}).get("id", "")

    return {"emitted_source_id": source_id}


# ── Conditional edge ──────────────────────────────────────────────────────────

def _should_emit(state: BridgeState) -> str:
    """Emit only when resolve found a rule (resolution is not None)."""
    return "emit" if state.get("resolution") is not None else END


# ── Graph ─────────────────────────────────────────────────────────────────────

def build_bridge_graph():
    """
    Topology:
        observe ──► resolve ──►(conditional)──► emit ──► END
                                          └──────────────► END
    """
    g = StateGraph(BridgeState)
    g.add_node("observe",  observe)
    g.add_node("resolve",  resolve)
    g.add_node("emit",     emit)

    g.set_entry_point("observe")
    g.add_edge("observe", "resolve")
    g.add_conditional_edges("resolve", _should_emit, {"emit": "emit", END: END})
    g.add_edge("emit", END)

    return g.compile()


# ── WebSocket listener ────────────────────────────────────────────────────────

def _ws_url(pe_url: str) -> str:
    """Convert an https/http PE URL to its wss/ws WebSocket equivalent."""
    return (
        pe_url
        .rstrip("/")
        .replace("https://", "wss://")
        .replace("http://", "ws://")
        + "/ws"
    )


def _ssl_context() -> ssl.SSLContext:
    """Permissive SSL context for dev self-signed certs."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode    = ssl.CERT_NONE
    return ctx


def _extract_events(msg: dict) -> list[RealityEvent]:
    """
    Parse a push-result WebSocket message and return one RealityEvent per
    machine that has shouldOutput=True this step.
    """
    if msg.get("type") != "push-result" or not msg.get("success"):
        return []

    step = msg.get("step")
    if not step:
        return []

    global_step     = msg.get("globalStep", 0)
    timestamp       = msg.get("timestamp",  0)
    machine_results = step.get("machineResults", {})
    events: list[RealityEvent] = []

    for machine_id, result in machine_results.items():
        arbiter = (result.get("transitionResult") or {}).get("arbiterMetadata", {})
        if not arbiter.get("shouldOutput"):
            continue

        output_vector = result.get("outputVector") or []
        if not any(v > 0.5 for v in output_vector):
            continue

        events.append(RealityEvent(
            machine_id    = machine_id,
            machine_name  = result.get("machineName", ""),
            output_vector = output_vector,
            output_region = result.get("outputRegion", {}),
            global_step   = global_step,
            timestamp     = timestamp,
        ))

    return events


async def run_bridge(
    pe_url:           str   = "https://localhost:3004",
    re_url:           str   = "https://localhost:3000",
    cooldown_seconds: float = 3.0,
    verbose:          bool  = True,
) -> None:
    """
    Connect to the PE WebSocket and run the bridge graph for every machine
    output event received.

    Args:
        pe_url:           Perception Engine base URL (https or http).
        re_url:           Reality Engine base URL (https or http).
        cooldown_seconds: Minimum seconds between emissions for the same machine.
        verbose:          Print resolution events to stdout.
    """
    try:
        import websockets  # type: ignore[import]
    except ImportError:
        raise RuntimeError(
            "websockets package is required for the bridge runner.\n"
            "Install it: pip install 'websockets>=12.0'"
        )

    if verbose:
        print(f"[Bridge] Fetching machine schema from {re_url} …")

    machine_schema = await asyncio.to_thread(fetch_machine_schema, re_url)

    if verbose:
        names = sorted(machine_schema.keys())
        print(f"[Bridge] Schema loaded: {len(names)} machines → {names}")
        print(f"[Bridge] Connecting to {_ws_url(pe_url)} …")

    graph          = build_bridge_graph()
    last_emitted:  dict[str, float] = {}   # machine_id → epoch seconds
    ssl_ctx        = _ssl_context()

    async with websockets.connect(_ws_url(pe_url), ssl=ssl_ctx) as ws:
        if verbose:
            print("[Bridge] Connected. Listening for machine output events …\n")

        async for raw_msg in ws:
            try:
                msg    = json.loads(raw_msg)
                events = _extract_events(msg)
            except Exception:
                continue

            for event in events:
                # Per-machine cooldown
                now = time.monotonic()
                if now - last_emitted.get(event["machine_id"], 0.0) < cooldown_seconds:
                    continue

                # Run LangGraph (sync graph invoked in a thread pool)
                initial_state: BridgeState = {
                    "pe_url":         pe_url,
                    "re_url":         re_url,
                    "machine_schema": machine_schema,
                    "event":          event,
                    "observations":   [],
                    "severity":       "normal",
                    "resolution":     None,
                    "emitted_source_id": None,
                }

                final_state = await asyncio.to_thread(graph.invoke, initial_state)

                if verbose:
                    obs = final_state.get("observations", [])
                    sev = final_state.get("severity", "normal")
                    res = final_state.get("resolution")
                    sid = final_state.get("emitted_source_id")

                    print(
                        f"[Bridge] step={event['global_step']:>6}  "
                        f"{event['machine_name']:<25} "
                        f"obs={obs}  sev={sev}"
                    )
                    if res:
                        print(
                            f"         → {res['action']:<35} "
                            f"target={res['target_machine_name']} "
                            f"seq='{res['target_sequence_name']}'"
                        )
                    if sid:
                        print(f"         ✓ source injected: {sid[:8]}…")
                    print()

                if final_state.get("emitted_source_id"):
                    last_emitted[event["machine_id"]] = now


# ── Convenience one-shot invocation ──────────────────────────────────────────

def invoke_bridge_once(
    event:          RealityEvent,
    machine_schema: dict,
    pe_url:         str = "https://localhost:3004",
    re_url:         str = "https://localhost:3000",
) -> BridgeState:
    """
    Run the bridge graph once for a single RealityEvent and return the final state.

    Useful for testing and for integrating into non-async pipelines.
    The graph itself is synchronous; no WebSocket connection is made.

    Example::

        schema = fetch_machine_schema("https://localhost:3000")
        event  = RealityEvent(
            machine_id    = "some-uuid",
            machine_name  = "FacilitiesMaintenance",
            output_vector = [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],   # HYGIENE_ALERT
            output_region = {"offset": 250, "length": 6},
            global_step   = 42,
            timestamp     = 1234567890000,
        )
        state = invoke_bridge_once(event, schema)
        print(state["resolution"]["rationale"])
        print(state["emitted_source_id"])
    """
    graph = build_bridge_graph()
    initial: BridgeState = {
        "pe_url":            pe_url,
        "re_url":            re_url,
        "machine_schema":    machine_schema,
        "event":             event,
        "observations":      [],
        "severity":          "normal",
        "resolution":        None,
        "emitted_source_id": None,
    }
    return graph.invoke(initial)
