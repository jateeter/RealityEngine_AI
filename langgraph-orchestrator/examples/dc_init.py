#!/usr/bin/env python3
"""
dc_init.py — System initialisation for the DC + AI monitoring pipeline.

Idempotently registers all sensor sources with the Perception Engine and
loads all DC/AI CES machine JSON files into the Reality Engine.  Safe to
call multiple times: sources are re-used if already registered (matched by
sensorId); machines are re-loaded on each call (returning fresh IDs).

Designed to be called at system startup (e.g. from a start.sh script) so
that the entire DC monitoring stack is ready before any workload runs.

Usage::

    # With services running locally:
    python examples/dc_init.py

    # Custom URLs:
    PERCEPTION_URL=http://localhost:3004 \\
    REALITY_URL=http://localhost:3000 \\
        python examples/dc_init.py

    # Programmatic:
    from examples.dc_init import initialize_dc_system
    result = initialize_dc_system()

Environment variables:
    PERCEPTION_URL   default: http://localhost:3004
    REALITY_URL      default: http://localhost:3000
"""

from __future__ import annotations

import json
import os
import sys
import warnings
from pathlib import Path

import httpx

# ── Path setup ────────────────────────────────────────────────────────────────

_HERE = Path(__file__).parent.parent          # langgraph-orchestrator/
_REPO = _HERE.parent                          # RealityEngine_AI/
_MACHINES_DIR = _REPO / "examples" / "machines"

sys.path.insert(0, str(_HERE))

from src.dc_sensors import ensure_sources, SENSOR_SOURCES  # noqa: E402

# ── Service URLs ──────────────────────────────────────────────────────────────

PE_URL = os.environ.get("PERCEPTION_URL", "http://localhost:3004")
RE_URL = os.environ.get("REALITY_URL", "http://localhost:3000")

_TIMEOUT = httpx.Timeout(15.0)
_CLIENT_OPTS = dict(timeout=_TIMEOUT, verify=False)


# ── Machine loading ───────────────────────────────────────────────────────────

def _load_machines(re_url: str, machines_dir: Path) -> dict[str, str]:
    """Load all DC*.json and AI*.json CES machines into the Reality Engine.

    Returns ``{stem: machine_id}`` for every machine successfully imported.
    """
    json_files = sorted(machines_dir.glob("DC*.json")) + sorted(machines_dir.glob("AI*.json"))
    if not json_files:
        raise FileNotFoundError(
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
                    print(f"  ✗ {stem}: {data}", file=sys.stderr)
                    continue
                mid = data["machine"]["id"]
                machines[stem] = mid
                print(f"  ✓ {stem}  (id={mid[:8]}…)")

    return machines


# ── Health check ──────────────────────────────────────────────────────────────

def _check_services(re_url: str, pe_url: str) -> list[str]:
    """Return a list of error messages for unreachable services."""
    errors: list[str] = []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for label, url in [("Reality Engine", re_url), ("Perception Engine", pe_url)]:
            try:
                r = httpx.get(f"{url}/api/health", **_CLIENT_OPTS)
                r.raise_for_status()
            except Exception as exc:
                errors.append(f"{label} ({url}): {exc}")
    return errors


# ── Public API ────────────────────────────────────────────────────────────────

def initialize_dc_system(
    perception_url: str = PE_URL,
    reality_url: str = RE_URL,
    machines_dir: Path | None = None,
) -> dict:
    """Initialise the DC + AI monitoring stack.

    1. Health-checks both services (raises ``RuntimeError`` on failure).
    2. Registers all 13 sensor sources with the Perception Engine
       (idempotent — skips any source whose ``sensorId`` already exists).
    3. Loads all DC*.json and AI*.json CES machines into the Reality Engine.

    Args:
        perception_url: Perception Engine base URL.
        reality_url:    Reality Engine base URL.
        machines_dir:   Directory containing CES machine JSON files.
                        Defaults to ``<repo_root>/examples/machines/``.

    Returns:
        A dict with keys:
            ``machines``     — ``{stem: machine_id}`` for every loaded machine.
            ``source_uuids`` — ``{sensor_id: uuid}`` for every registered source.

    Raises:
        RuntimeError: If one or both services are not reachable.
    """
    mdir = machines_dir or _MACHINES_DIR

    errors = _check_services(reality_url, perception_url)
    if errors:
        raise RuntimeError(
            "Services not reachable — start the stack first:\n  "
            + "\n  ".join(errors)
        )

    print("\n── Registering sensor sources ──────────────────────────────────")
    source_uuids = ensure_sources(perception_url)
    for sid, uuid in source_uuids.items():
        print(f"  ✓ {sid:<20s}  (uuid={uuid[:8]}…)")

    print("\n── Loading CES machines ─────────────────────────────────────────")
    machines = _load_machines(reality_url, mdir)

    print(f"\nInitialisation complete:")
    print(f"  {len(source_uuids)} sensor sources registered")
    print(f"  {len(machines)} CES machines loaded")

    return {"machines": machines, "source_uuids": source_uuids}


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("DC + AI MONITORING — SYSTEM INITIALISATION")
    print("=" * 60)
    print(f"  Perception Engine : {PE_URL}")
    print(f"  Reality Engine    : {RE_URL}")
    print(f"  Machines dir      : {_MACHINES_DIR}")

    try:
        result = initialize_dc_system()
    except RuntimeError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"\nUnexpected error: {exc}", file=sys.stderr)
        sys.exit(1)

    print("\nSystem ready. Run the monitoring demo with:")
    print("  python examples/dc_monitoring_demo.py --live")
