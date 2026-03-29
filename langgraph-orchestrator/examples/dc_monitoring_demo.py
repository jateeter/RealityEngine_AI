#!/usr/bin/env python3
"""
dc_monitoring_demo.py — DC + AI Monitoring Simulation Demo

Demonstrates the full 3-hour data-centre + AI workload monitoring pipeline:

  ┌────────────────────────────────────────────────────────────────────┐
  │  LangGraph DCMonitoringState                                        │
  │                                                                     │
  │  initialize ──► process_step ──►(loop)                              │
  │                      │                                             │
  │                      └──►(done)──► finalize ──► END                │
  └────────────────────────────────────────────────────────────────────┘
         │                │                     │
         ▼                ▼                     ▼
  Reality Engine    Perception Engine    Reality Engine
  (import 14 CES    (push 13 sensor      (report machine
   machine JSONs)    vectors per step)    firings)

The simulation covers three hours of data-centre operations split into
11 operational phases:

  Phase                  Duration  What Happens
  ─────────────────────  ────────  ──────────────────────────────────────
  NORMAL_OPS             30 min    Steady-state baseline
  TRAINING_RAMP_UP       15 min    Large AI training job launched
  THERMAL_ESCALATION     12 min    CPU temps rise WARM → HOT → CRITICAL
  THERMAL_EMERGENCY       6 min    Thermal EMERGENCY; CoolingControlFF SET
  COOLING_RECOVERY       17 min    Emergency cooling; temps declining
  STABLE_NORMAL          30 min    Normal operations resumed
  NETWORK_RAMP_UP        12 min    Model checkpoint sync; bandwidth rising
  NETWORK_ESCALATION     13 min    BURST → CONGESTION; NetworkThrottleFF SET
  NETWORK_RECOVERY       20 min    Traffic throttled; network recovering
  COMBINED_EMERGENCY     13 min    Thermal + network both critical
  FULL_RECOVERY          12 min    All systems recovering to nominal

CES machines loaded (14 total):
  DC Infrastructure (8):
    DCThermalEscalation      [12:16] → [60:62]
    DCMemoryPressure         [16:20] → [66:68]
    DCNetworkBurstDetector   [20:24] → [64:66]
    DCCoolingControlFF       [60:62] → [100:102]
    DCMemoryAlertFF          [66:68] → [104:106]
    DCNetworkThrottleFF      [64:66] → [102:104]
    DCCriticalSynthesizer    [100:104] → [72:74]
    DCCriticalAlertFF        [72:74]  → [108:110]
  AI Workload (6):
    AIPowerEfficiency        [120:124] → [150:156]
    AICoolingRegulator       [124:128] → [156:162]
    AICapacityThrottler      [128:132] → [162:168]
    AISecurityMonitor        [132:136] → [168:174]
    AIModelWellness          [136:140] → [174:180]
    AIHardwareResilience     [140:144] → [180:186]

Sensor sources registered (13 total):
  DC sensors  : dc-thermal, dc-memory, dc-network, dc-cpu, dc-power,
                dc-storage, dc-security
  AI sensors  : ai-power, ai-cooling, ai-capacity, ai-security,
                ai-wellness, ai-resilience

Usage::

    # Show workload phase plan (no services required):
    python examples/dc_monitoring_demo.py

    # Run full 3-hour simulation with live services:
    python examples/dc_monitoring_demo.py --live

    # Run first 30 minutes only (quick test):
    python examples/dc_monitoring_demo.py --live --steps 30

    # Verbose: print events as they occur:
    python examples/dc_monitoring_demo.py --live --verbose

Environment variables:
    PERCEPTION_URL   default: http://localhost:3004
    REALITY_URL      default: http://localhost:3000
    LIVE             set to 1 to run the live pipeline (same as --live)
"""

from __future__ import annotations

import os
import sys

_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, _ROOT)

from src.dc_workload import DCWorkloadGenerator  # noqa: E402

PERCEPTION_URL = os.environ.get("PERCEPTION_URL", "http://localhost:3004")
REALITY_URL = os.environ.get("REALITY_URL", "http://localhost:3000")

_LANGGRAPH_MISSING_MSG = """
langgraph is not installed in the current Python environment.

Install dependencies first:
  cd {root}
  python -m venv .venv
  source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt

Then re-run with the venv active:
  python examples/dc_monitoring_demo.py --live
""".format(root=_ROOT).strip()


# ── Phase plan demo (no services required) ────────────────────────────────────

def demo_phase_plan() -> None:
    """Print the 3-hour workload phase plan and a sample of sensor values."""
    print("=" * 70)
    print("DC + AI MONITORING — 3-HOUR WORKLOAD PLAN  (no services required)")
    print("=" * 70)

    gen = DCWorkloadGenerator()

    print("\n── Phase schedule ──────────────────────────────────────────────────")
    for p in gen.phase_summary():
        bar = "█" * (p["duration_minutes"] // 2)
        print(
            f"  T+{p['start']:03d}–{p['end']:03d}  {p['label']:<25s}  "
            f"({p['duration_minutes']:2d} min)  {bar}"
        )

    print("\n── Sample sensor readings per phase ────────────────────────────────")
    steps = gen.generate()
    # Show one representative step per phase (first minute of each phase)
    phase_starts = {p["label"]: p["start"] for p in gen.phase_summary()}
    for label, start_min in phase_starts.items():
        step = steps[start_min]
        s = step["sensors"]
        print(f"\n  {label} (T+{start_min:03d}):")
        print(
            f"    dc-thermal : temp={s['dc-thermal'][0]:.2f}, "
            f"load={s['dc-thermal'][1]:.2f}"
        )
        print(
            f"    dc-network : bw={s['dc-network'][0]:.2f}, "
            f"pkt_loss={s['dc-network'][1]:.2f}"
        )
        print(
            f"    ai-capacity: gpu={s['ai-capacity'][0]:.2f}, "
            f"queue={s['ai-capacity'][1]:.2f}"
        )

    print("\n── Notable events ──────────────────────────────────────────────────")
    event_count = 0
    for step in steps:
        for evt in step["events"]:
            print(f"  T+{step['minute']:03d}  [{step['phase']:<25s}]  {evt}")
            event_count += 1
    print(f"\n  {event_count} notable events across {len(steps)} simulation steps")


# ── Full pipeline demo (requires live services) ───────────────────────────────

def demo_full_pipeline(num_steps: int = DCWorkloadGenerator.NUM_STEPS,
                       verbose: bool = False) -> None:
    """Run the full LangGraph DC monitoring pipeline against live services."""
    try:
        from src.dc_graph import run_dc_monitoring  # noqa: E402
    except ModuleNotFoundError as exc:
        if "langgraph" in str(exc) or "langchain" in str(exc):
            print("\n" + _LANGGRAPH_MISSING_MSG)
            return
        raise

    print("\n" + "=" * 70)
    print("DC + AI MONITORING — FULL PIPELINE  (requires running services)")
    print(f"  Perception Engine : {PERCEPTION_URL}")
    print(f"  Reality Engine    : {REALITY_URL}")
    print(f"  Steps to simulate : {num_steps}")
    print("=" * 70)

    try:
        result = run_dc_monitoring(
            perception_url=PERCEPTION_URL,
            reality_url=REALITY_URL,
            num_steps=num_steps,
            verbose=verbose,
        )
    except Exception as exc:
        print(f"\n  ERROR: {exc}")
        print("  (Are the Reality Engine and Perception Engine running?)")
        return

    print()
    if result.get("error"):
        print(f"  Pipeline error: {result['error']}")
        return

    # Print operational report
    for line in result.get("report", "").split("\n"):
        print(f"  {line}")

    print()
    for line in result.get("summary", "").split("\n"):
        print(f"  {line}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Always show the phase plan (no services needed)
    demo_phase_plan()

    # Parse CLI arguments
    run_live = "--live" in sys.argv or os.environ.get("LIVE", "").lower() in ("1", "true", "yes")
    verbose  = "--verbose" in sys.argv or "-v" in sys.argv

    num_steps = DCWorkloadGenerator.NUM_STEPS
    for i, arg in enumerate(sys.argv):
        if arg == "--steps" and i + 1 < len(sys.argv):
            try:
                num_steps = int(sys.argv[i + 1])
            except ValueError:
                pass

    if run_live:
        demo_full_pipeline(num_steps=num_steps, verbose=verbose)
    else:
        print(
            "\n\nTo run the full 3-hour monitoring simulation (requires running services):\n"
            "  python examples/dc_monitoring_demo.py --live\n"
            "  python examples/dc_monitoring_demo.py --live --steps 30   # first 30 min\n"
            "  python examples/dc_monitoring_demo.py --live --verbose     # print events\n"
        )
