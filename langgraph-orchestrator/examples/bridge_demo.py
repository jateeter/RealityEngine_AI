"""
bridge_demo.py — Demonstrates the bidirectional LangGraph ↔ Perception Engine bridge.

Two modes:

  live    — Connects to the running PE WebSocket and reacts to real machine outputs.
            Requires the full Docker stack to be running (./start.sh).

  dry-run — Simulates a machine output event without any live services.
            Shows the full graph trace: observations, severity, resolution,
            and the TestSourceConfig that would be injected into the PE.

Usage::

    # Dry-run (no services needed)
    python examples/bridge_demo.py

    # Live (requires ./start.sh)
    python examples/bridge_demo.py --live
"""

from __future__ import annotations

import asyncio
import json
import sys
import os

# Allow running from the package root without installing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.perception_bridge import (
    RealityEvent,
    fetch_machine_schema,
    invoke_bridge_once,
    run_bridge,
)
from src.resolution_map import MACHINE_OUTPUT_LABELS, RESOLUTION_RULES


# ── Dry-run demo ──────────────────────────────────────────────────────────────

DEMO_EVENTS: list[tuple[str, list[float], str]] = [
    # (machine_name, output_vector, description)
    (
        "FacilitiesMaintenance",
        [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],   # bit 2 HIGH → HYGIENE_ALERT
        "Facilities staff observed hygiene deficit",
    ),
    (
        "FacilitiesMaintenance",
        [0.1, 0.1, 0.1, 0.1, 0.1, 0.9],   # bit 5 HIGH → INACCESSIBILITY_ALERT
        "Unit inaccessible after three knock attempts",
    ),
    (
        "DailyPatientCare",
        [0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1],  # bit 3 → UNRESPONSIVE_FALL
        "Patient fell and is unresponsive",
    ),
    (
        "PatientWellness",
        [0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1],  # bit 3 → CRITICAL
        "Wellness assessment: CRITICAL level",
    ),
    (
        "FacilitiesMaintenance",
        [0.9, 0.1, 0.1, 0.1, 0.1, 0.1],   # bit 0 → DAILY_COMPLETE (no action)
        "Routine daily maintenance completed — no concerns",
    ),
]


def _mock_schema_from_map() -> dict:
    """
    Build a minimal schema from MACHINE_OUTPUT_LABELS and RESOLUTION_RULES for dry-run.

    Each machine that appears as a resolution target gets one inputSequence entry
    per rule that targets it, so substring matching finds the right sequence regardless
    of the order rules are iterated.
    """
    # Start with base entries for every machine we have labels for
    schema: dict = {
        name: {
            "id":              f"{name.lower()}-demo-id",
            "name":            name,
            "input_region":    {"offset": 0, "length": 8},
            "output_region":   {"offset": 8, "length": len(labels)},
            "input_sequences": [],
        }
        for name, labels in MACHINE_OUTPUT_LABELS.items()
    }

    # Accumulate one inputSequence entry per rule pointing at each target machine
    for machine_name, rules in RESOLUTION_RULES.items():
        for obs_label, rule in rules.items():
            target = rule["target_machine"]
            if target in schema:
                seq_name = f"{rule['target_sequence']} (demo)"
                # Avoid duplicate names
                existing = {s["name"] for s in schema[target]["input_sequences"]}
                if seq_name not in existing:
                    schema[target]["input_sequences"].append({
                        "name":    seq_name,
                        "vectors": [[0.9 if i == j else 0.1 for i in range(8)]
                                    for j in range(3)],
                    })

    return schema


# ── Dry-run runner ────────────────────────────────────────────────────────────

def run_dry_demo() -> None:
    from unittest.mock import patch, MagicMock

    schema = _mock_schema_from_map()

    print("=" * 70)
    print("  Reality Engine ↔ LangGraph Bridge — Dry-run Mode")
    print("  (no live services required)")
    print("=" * 70)
    print()

    for idx, (machine_name, output_vector, description) in enumerate(DEMO_EVENTS, 1):
        print(f"Event {idx}: {description}")
        print(f"  Machine     : {machine_name}")
        print(f"  OutputVector: {output_vector}")

        event = RealityEvent(
            machine_id    = f"demo-{machine_name.lower()}-id",
            machine_name  = machine_name,
            output_vector = output_vector,
            output_region = {"offset": 250, "length": len(output_vector)},
            global_step   = idx * 10,
            timestamp     = 1_700_000_000_000 + idx,
        )

        # Use invoke_bridge_once with a mocked emit
        # (no real PE available in dry-run — skip the HTTP POST)
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"source": {"id": f"dry-run-source-{idx:03d}"}}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_resp
            result = invoke_bridge_once(event, schema)

        print(f"  Observations: {result['observations']}")
        print(f"  Severity    : {result['severity']}")

        res = result.get("resolution")
        if res:
            print(f"  Action      : {res['action']}")
            print(f"  Target      : {res['target_machine_name']}")
            print(f"  Sequence    : {res['target_sequence_name']}")
            print(f"  Rationale   : {res['rationale']}")
            cfg = res["source_config"]
            print(f"  Source cfg  : type={cfg['type']}, loop={cfg['loop']}, "
                  f"steps={len(cfg['inputs'])}, region={cfg['region']}")
            sid = result.get("emitted_source_id")
            print(f"  Emitted src : {sid}")
        else:
            print("  → No resolution (completion signal or unrecognised observation)")

        print()

    print("=" * 70)
    print("  Dry-run complete.")
    print("  Run with --live to connect to a real PE instance.")
    print("=" * 70)


# ── Live demo ─────────────────────────────────────────────────────────────────

async def run_live_demo(
    pe_url: str = "https://localhost:3004",
    re_url: str = "https://localhost:3000",
) -> None:
    print("=" * 70)
    print("  Reality Engine ↔ LangGraph Bridge — Live Mode")
    print(f"  PE: {pe_url}")
    print(f"  RE: {re_url}")
    print("  Press Ctrl+C to stop.")
    print("=" * 70)
    print()

    await run_bridge(pe_url=pe_url, re_url=re_url, verbose=True)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    live = "--live" in sys.argv
    pe   = next((a for a in sys.argv if a.startswith("--pe=")), None)
    re   = next((a for a in sys.argv if a.startswith("--re=")), None)

    if live:
        asyncio.run(run_live_demo(
            pe_url = pe.split("=", 1)[1] if pe else "https://localhost:3004",
            re_url = re.split("=", 1)[1] if re else "https://localhost:3000",
        ))
    else:
        run_dry_demo()
