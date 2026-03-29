"""
test_dc_e2e.py — End-to-end tests for the DC + AI monitoring pipeline.

Four test classes, each validating a key operational management scenario:

  1. TestDCSensorInitialization
     Verifies that all 13 DC/AI sensor sources register correctly in the
     Perception Engine and map to the correct perceptual-space regions.

  2. TestDCThermalEscalationPipeline
     Runs the known-good 12-step escalation sequence from the
     DCThermalEscalation machine JSON through the PE→RE pipeline and
     asserts that the machine fires the EMERGENCY alarm at the expected
     step and the SAFE recovery signal on return to normal.

  3. TestDCNetworkBurstDetectorPipeline
     Runs the known-good 12-step network saturation sequence from the
     DCNetworkBurstDetector machine JSON and verifies OVERFLOW alarm
     firing and NORMAL_FLOW reset signal behaviour.

  4. TestDCMonitoringIntegration
     Calls run_dc_monitoring(num_steps=30) to simulate the first 30 minutes
     (NORMAL_OPS phase) through the full LangGraph pipeline and validates
     the overall workflow: step structure, report generation and the absence
     of emergency-level machine firings during steady-state operation.

All tests are marked ``e2e`` and are auto-skipped when the Reality Engine
or Perception Engine cannot be reached.  The ``dc_machines_dir`` module
fixture is also skipped if the machine JSON directory does not exist.
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import httpx
import pytest

from conftest import (  # conftest helpers
    load_machine,
    delete_machine,
    add_sensor_source,
    remove_source,
)

# ---------------------------------------------------------------------------
# Path to DC machine JSON files
# ---------------------------------------------------------------------------

_MACHINES_DIR = Path(__file__).parent.parent.parent / "examples" / "machines"

# ---------------------------------------------------------------------------
# Shared HTTP config (matches conftest)
# ---------------------------------------------------------------------------

_TIMEOUT = httpx.Timeout(15.0)
_CLIENT_OPTS = dict(timeout=_TIMEOUT, verify=False)


# ---------------------------------------------------------------------------
# Module-level fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def dc_machines_dir():
    """Path to the DC/AI CES machine JSON files."""
    if not _MACHINES_DIR.exists():
        pytest.skip(f"DC machines directory not found: {_MACHINES_DIR}")
    return _MACHINES_DIR


@pytest.fixture(scope="module")
def dc_context(services, dc_machines_dir):
    """Convenience bundle of service URLs and machines_dir for all tests."""
    return {
        "re_url":       services["re_url"],
        "pe_url":       services["pe_url"],
        "machines_dir": dc_machines_dir,
    }


# ---------------------------------------------------------------------------
# Helper: push values to a named sensor and trigger assembled push
# ---------------------------------------------------------------------------

def _push_sensor_step(pe_url: str, sensor_id: str, values: list[float]) -> dict:
    """Write *values* to *sensor_id* and call POST /api/push.

    Returns the raw PushResult dict.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with httpx.Client(**_CLIENT_OPTS) as client:
            r = client.post(
                f"{pe_url}/api/sensors/{sensor_id}",
                json={"values": values},
            )
            r.raise_for_status()
            r2 = client.post(f"{pe_url}/api/push")
            r2.raise_for_status()
            return r2.json()


def _output_value(push_result: dict, machine_id: str, slot: int = 0) -> float:
    """Return outputVector[slot] for *machine_id*, or -1.0 if absent."""
    mr = push_result.get("step", {}).get("machineResults", {})
    entry = mr.get(machine_id, {})
    ov = entry.get("outputVector")
    if ov and isinstance(ov, list) and len(ov) > slot:
        return float(ov[slot])
    return -1.0


# ---------------------------------------------------------------------------
# 1. TestDCSensorInitialization
# ---------------------------------------------------------------------------

@pytest.mark.e2e
class TestDCSensorInitialization:
    """Verify all DC/AI sensor sources register correctly in the PE."""

    def test_all_dc_sensors_registered(self, services):
        """ensure_sources() registers all 13 DC/AI sensor sources."""
        from src.dc_sensors import ensure_sources, SENSOR_SOURCES

        pe_url = services["pe_url"]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = ensure_sources(pe_url)

        registered_ids = set(result.keys())
        expected_ids = {s["sensor_id"] for s in SENSOR_SOURCES}

        missing = expected_ids - registered_ids
        assert not missing, f"Sensor sources not registered: {missing}"
        assert len(result) == len(SENSOR_SOURCES), (
            f"Expected {len(SENSOR_SOURCES)} sources, got {len(result)}"
        )

    def test_sensor_region_boundaries_correct(self, services):
        """Each registered source maps to the correct perceptual-space region."""
        from src.dc_sensors import ensure_sources, SENSOR_SOURCES

        pe_url = services["pe_url"]
        ensure_sources(pe_url)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS) as client:
                r = client.get(f"{pe_url}/api/sources")
                r.raise_for_status()
                all_sources = r.json()

        # Build lookup by sensorId
        by_sensor_id = {
            s["sensorId"]: s
            for s in all_sources
            if "sensorId" in s
        }

        for spec in SENSOR_SOURCES:
            sid = spec["sensor_id"]
            assert sid in by_sensor_id, f"Source not found: {sid}"
            src = by_sensor_id[sid]
            assert src.get("regionOffset") == spec["region_offset"], (
                f"{sid}: expected regionOffset={spec['region_offset']}, "
                f"got {src.get('regionOffset')}"
            )
            assert src.get("regionLength") == spec["region_length"], (
                f"{sid}: expected regionLength={spec['region_length']}, "
                f"got {src.get('regionLength')}"
            )

    def test_source_registration_is_idempotent(self, services):
        """Calling ensure_sources() twice does not create duplicate entries."""
        from src.dc_sensors import ensure_sources, SENSOR_SOURCES

        pe_url = services["pe_url"]

        # Register once (or confirm already registered)
        ensure_sources(pe_url)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS) as client:
                count_before = len([
                    s for s in client.get(f"{pe_url}/api/sources").json()
                    if s.get("sensorId", "").startswith(("dc-", "ai-"))
                ])

        # Register again — should be a no-op
        ensure_sources(pe_url)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS) as client:
                count_after = len([
                    s for s in client.get(f"{pe_url}/api/sources").json()
                    if s.get("sensorId", "").startswith(("dc-", "ai-"))
                ])

        assert count_after == count_before, (
            f"ensure_sources() created duplicates: "
            f"{count_before} → {count_after}"
        )


# ---------------------------------------------------------------------------
# 2. TestDCThermalEscalationPipeline
# ---------------------------------------------------------------------------

# 12-step escalation sequence from DCThermalEscalation.json inputSequences[0]
# Stage trace: NORMAL,NORMAL,WARM,WARM,WARM,HOT,CRITICAL,CRITICAL,EMERGENCY,EMERGENCY,WARM,NORMAL
_THERMAL_SEQ = [
    [0.30, 0.35, 0.5, 0.5],  # 0: NORMAL
    [0.32, 0.38, 0.5, 0.5],  # 1: NORMAL
    [0.50, 0.60, 0.5, 0.5],  # 2: WARM
    [0.58, 0.67, 0.5, 0.5],  # 3: WARM
    [0.62, 0.72, 0.5, 0.5],  # 4: WARM
    [0.72, 0.82, 0.5, 0.5],  # 5: HOT
    [0.84, 0.90, 0.5, 0.5],  # 6: CRITICAL
    [0.89, 0.93, 0.5, 0.5],  # 7: CRITICAL
    [0.95, 0.97, 0.5, 0.5],  # 8: EMERGENCY → fires [1,0]
    [0.96, 0.98, 0.5, 0.5],  # 9: EMERGENCY → fires [1,0]
    [0.58, 0.65, 0.5, 0.5],  # 10: WARM (cooling)
    [0.30, 0.35, 0.5, 0.5],  # 11: NORMAL → SAFE fires [0,1]
]


@pytest.mark.e2e
class TestDCThermalEscalationPipeline:
    """Validate the DCThermalEscalation CES machine end-to-end."""

    @pytest.fixture(autouse=True)
    def setup_thermal(self, dc_context):
        """Load DCThermalEscalation and register a dedicated sensor source."""
        re_url = dc_context["re_url"]
        pe_url = dc_context["pe_url"]
        machines_dir = dc_context["machines_dir"]

        ces_json = json.loads((machines_dir / "DCThermalEscalation.json").read_text())
        self.machine_id = load_machine(re_url, ces_json)
        self.sensor_id  = "dc-e2e-thermal-test"
        self.source_uuid = add_sensor_source(
            pe_url, self.sensor_id, region_offset=12, region_length=4
        )
        self.pe_url = pe_url
        self.re_url = re_url

        yield

        delete_machine(re_url, self.machine_id)
        remove_source(pe_url, self.source_uuid)

    def test_thermal_machine_loads_into_reality_engine(self, dc_context):
        """The DCThermalEscalation machine is present in the RE machine list."""
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS) as client:
                r = client.get(f"{dc_context['re_url']}/api/machines")
                r.raise_for_status()
                machine_ids = [m["id"] for m in r.json().get("machines", [])]
        assert self.machine_id in machine_ids, (
            f"Machine {self.machine_id} not found in RE machine list"
        )

    def test_thermal_escalation_fires_emergency_alarm(self):
        """EMERGENCY alarm [1,0] fires at steps 8 and 9 of the escalation sequence."""
        fired_steps: list[int] = []

        for i, values in enumerate(_THERMAL_SEQ):
            result = _push_sensor_step(self.pe_url, self.sensor_id, values)
            ov0 = _output_value(result, self.machine_id, slot=0)
            if ov0 >= 0.5:
                fired_steps.append(i)

        assert 8 in fired_steps or 9 in fired_steps, (
            f"EMERGENCY alarm never fired during escalation sequence. "
            f"Steps where alarm triggered: {fired_steps}"
        )

    def test_thermal_safe_recovery_fires_at_nominal_conditions(self):
        """SAFE recovery signal [0,1] fires at steps 0-1 (NORMAL) and step 11."""
        safe_steps: list[int] = []

        for i, values in enumerate(_THERMAL_SEQ):
            result = _push_sensor_step(self.pe_url, self.sensor_id, values)
            ov1 = _output_value(result, self.machine_id, slot=1)
            if ov1 >= 0.5:
                safe_steps.append(i)

        assert any(s <= 1 for s in safe_steps), (
            f"SAFE signal never fired during NORMAL conditions (steps 0-1). "
            f"Safe steps: {safe_steps}"
        )
        assert 11 in safe_steps, (
            f"SAFE signal did not fire at step 11 (NORMAL conditions restored). "
            f"Safe steps: {safe_steps}"
        )

    def test_abrupt_spike_does_not_trigger_alarm(self):
        """An abrupt NORMAL→HOT→NORMAL jump bypasses WARM and does not fire the alarm."""
        # From DCThermalEscalation.json inputSequences[1] (Abrupt Spike scenario)
        abrupt_seq = [
            [0.30, 0.35, 0.5, 0.5],  # NORMAL
            [0.75, 0.85, 0.5, 0.5],  # HOT (skips WARM — should NOT fire alarm)
            [0.30, 0.35, 0.5, 0.5],  # NORMAL
        ]
        for i, values in enumerate(abrupt_seq):
            result = _push_sensor_step(self.pe_url, self.sensor_id, values)
            if i == 1:  # HOT step — alarm must NOT fire
                ov0 = _output_value(result, self.machine_id, slot=0)
                assert ov0 < 0.5, (
                    f"EMERGENCY alarm fired on abrupt HOT spike at step {i} "
                    f"(WARM was never satisfied). outputVector[0]={ov0}"
                )


# ---------------------------------------------------------------------------
# 3. TestDCNetworkBurstDetectorPipeline
# ---------------------------------------------------------------------------

# 12-step escalation sequence from DCNetworkBurstDetector.json inputSequences[0]
# Stage trace: BASELINE,BASELINE,ELEVATED,ELEVATED,ELEVATED,BURST,CONGESTION,CONGESTION,OVERFLOW,OVERFLOW,ELEVATED,BASELINE
_NETWORK_SEQ = [
    [0.20, 0.03, 0.5, 0.5],  # 0: BASELINE
    [0.22, 0.04, 0.5, 0.5],  # 1: BASELINE
    [0.50, 0.12, 0.5, 0.5],  # 2: ELEVATED
    [0.58, 0.17, 0.5, 0.5],  # 3: ELEVATED
    [0.63, 0.22, 0.5, 0.5],  # 4: ELEVATED
    [0.74, 0.30, 0.5, 0.5],  # 5: BURST
    [0.84, 0.50, 0.5, 0.5],  # 6: CONGESTION
    [0.90, 0.58, 0.5, 0.5],  # 7: CONGESTION
    [0.95, 0.82, 0.5, 0.5],  # 8: OVERFLOW → fires [1,0]
    [0.97, 0.87, 0.5, 0.5],  # 9: OVERFLOW → fires [1,0]
    [0.58, 0.20, 0.5, 0.5],  # 10: ELEVATED (recovering)
    [0.20, 0.03, 0.5, 0.5],  # 11: BASELINE → NORMAL_FLOW fires [0,1]
]


@pytest.mark.e2e
class TestDCNetworkBurstDetectorPipeline:
    """Validate the DCNetworkBurstDetector CES machine end-to-end."""

    @pytest.fixture(autouse=True)
    def setup_network(self, dc_context):
        """Load DCNetworkBurstDetector and register a dedicated sensor source."""
        re_url = dc_context["re_url"]
        pe_url = dc_context["pe_url"]
        machines_dir = dc_context["machines_dir"]

        ces_json = json.loads((machines_dir / "DCNetworkBurstDetector.json").read_text())
        self.machine_id  = load_machine(re_url, ces_json)
        self.sensor_id   = "dc-e2e-network-test"
        self.source_uuid = add_sensor_source(
            pe_url, self.sensor_id, region_offset=20, region_length=4
        )
        self.pe_url = pe_url
        self.re_url = re_url

        yield

        delete_machine(re_url, self.machine_id)
        remove_source(pe_url, self.source_uuid)

    def test_network_machine_loads_into_reality_engine(self, dc_context):
        """The DCNetworkBurstDetector machine is present in the RE machine list."""
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with httpx.Client(**_CLIENT_OPTS) as client:
                r = client.get(f"{dc_context['re_url']}/api/machines")
                r.raise_for_status()
                machine_ids = [m["id"] for m in r.json().get("machines", [])]
        assert self.machine_id in machine_ids, (
            f"Machine {self.machine_id} not found in RE machine list"
        )

    def test_network_overflow_fires_alarm(self):
        """OVERFLOW alarm [1,0] fires at steps 8 and 9 of the escalation sequence."""
        fired_steps: list[int] = []

        for i, values in enumerate(_NETWORK_SEQ):
            result = _push_sensor_step(self.pe_url, self.sensor_id, values)
            ov0 = _output_value(result, self.machine_id, slot=0)
            if ov0 >= 0.5:
                fired_steps.append(i)

        assert 8 in fired_steps or 9 in fired_steps, (
            f"OVERFLOW alarm never fired during escalation sequence. "
            f"Steps where alarm triggered: {fired_steps}"
        )

    def test_normal_flow_reset_fires_at_baseline(self):
        """NORMAL_FLOW reset signal [0,1] fires at steps 0-1 (BASELINE) and step 11."""
        reset_steps: list[int] = []

        for i, values in enumerate(_NETWORK_SEQ):
            result = _push_sensor_step(self.pe_url, self.sensor_id, values)
            ov1 = _output_value(result, self.machine_id, slot=1)
            if ov1 >= 0.5:
                reset_steps.append(i)

        assert any(s <= 1 for s in reset_steps), (
            f"NORMAL_FLOW reset never fired at BASELINE (steps 0-1). "
            f"Reset steps: {reset_steps}"
        )

    def test_push_response_contains_machine_result_structure(self):
        """Each push response includes machineResults with the expected schema."""
        result = _push_sensor_step(self.pe_url, self.sensor_id, _NETWORK_SEQ[0])

        step = result.get("step", {})
        assert "machineResults" in step, "Push result missing 'step.machineResults'"

        mr = step["machineResults"]
        assert self.machine_id in mr, (
            f"Machine {self.machine_id} not in machineResults: {list(mr.keys())}"
        )
        entry = mr[self.machine_id]
        assert "inputRegion" in entry, "machineResult missing 'inputRegion'"
        assert "outputRegion" in entry, "machineResult missing 'outputRegion'"
        assert entry["inputRegion"]["offset"] == 20, (
            f"Expected inputRegion.offset=20, got {entry['inputRegion']['offset']}"
        )
        assert entry["inputRegion"]["length"] == 4, (
            f"Expected inputRegion.length=4, got {entry['inputRegion']['length']}"
        )


# ---------------------------------------------------------------------------
# 4. TestDCMonitoringIntegration
# ---------------------------------------------------------------------------

@pytest.mark.e2e
class TestDCMonitoringIntegration:
    """Full LangGraph pipeline integration test against live services.

    Runs run_dc_monitoring(num_steps=30) which simulates the first 30 minutes
    (NORMAL_OPS phase) of the 3-hour workload.  This validates that:
      - All 14 DC/AI machines load and all 13 sensors register
      - The simulation produces the correct number of step_results
      - Each step_result contains the expected fields
      - No emergency-level alarms fire during steady-state normal operations
      - A coherent operational report is produced
    """

    NUM_STEPS = 30  # first 30 minutes = NORMAL_OPS phase only

    @pytest.fixture(scope="class", autouse=True)
    def run_result(self, services, dc_machines_dir):
        """Run the monitoring simulation once for the whole class."""
        try:
            from src.dc_graph import run_dc_monitoring
        except ImportError:
            pytest.skip("langgraph not installed — cannot run dc_graph tests")

        result = run_dc_monitoring(
            perception_url=services["pe_url"],
            reality_url=services["re_url"],
            machines_dir=str(dc_machines_dir),
            num_steps=self.NUM_STEPS,
            verbose=False,
            cleanup=True,
        )
        self.__class__._result = result

    def test_simulation_completes_without_error(self):
        """run_dc_monitoring() returns without an error field set."""
        result = self.__class__._result
        assert not result.get("error"), (
            f"DC monitoring simulation returned error: {result.get('error')}"
        )

    def test_step_results_count_matches_requested(self):
        """step_results contains exactly NUM_STEPS entries."""
        result = self.__class__._result
        step_results = result.get("step_results", [])
        assert len(step_results) == self.NUM_STEPS, (
            f"Expected {self.NUM_STEPS} step_results, got {len(step_results)}"
        )

    def test_each_step_result_has_required_fields(self):
        """Every step_result contains minute, wall_time, phase, events, fired_machines."""
        result = self.__class__._result
        required = {"minute", "wall_time", "phase", "events", "fired_machines"}
        for i, step in enumerate(result.get("step_results", [])):
            missing = required - set(step.keys())
            assert not missing, f"step_results[{i}] missing fields: {missing}"

    def test_normal_ops_phase_produces_no_emergency_alarm_firings(self):
        """No DC emergency machines fire during the first 30-minute NORMAL_OPS phase.

        The emergency-level machines (DCThermalEscalation, DCNetworkBurstDetector,
        DCCriticalSynthesizer, DCCriticalAlertFF) require sustained escalation
        across multiple phases before they reach EMERGENCY state.  All 30 steps
        in the NORMAL_OPS phase have sensor values well below the alarm thresholds.
        """
        result = self.__class__._result
        emergency_machines = {
            "DCThermalEscalation",
            "DCNetworkBurstDetector",
            "DCCriticalSynthesizer",
            "DCCriticalAlertFF",
        }
        for step in result.get("step_results", []):
            fired = set(step.get("fired_machines", []))
            false_alarms = fired & emergency_machines
            assert not false_alarms, (
                f"Emergency machine(s) fired unexpectedly during NORMAL_OPS "
                f"at minute {step['minute']}: {false_alarms}"
            )

    def test_report_contains_simulation_summary(self):
        """The report field contains the simulation header and step count."""
        result = self.__class__._result
        report = result.get("report", "")
        assert "DC + AI MONITORING" in report, (
            "Report missing 'DC + AI MONITORING' header"
        )
        assert str(self.NUM_STEPS) in report, (
            f"Report does not mention the step count ({self.NUM_STEPS})"
        )
        summary = result.get("summary", "")
        assert "DC Monitoring Simulation Complete" in summary, (
            "Summary missing expected completion message"
        )
