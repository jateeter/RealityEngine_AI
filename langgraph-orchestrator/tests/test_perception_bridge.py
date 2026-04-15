"""
Unit tests for the perception bridge — no live services required.

Tests cover:
  - observe node: HIGH-bit → label mapping and severity classification
  - resolve node: rule lookup + sequence selection + source config shape
  - emit node: skipped when resolution is None; called when resolution present
  - full graph: end-to-end state transitions
  - _extract_events: PE WebSocket message parsing
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock, patch

from src.perception_bridge import (
    BridgeState,
    RealityEvent,
    _extract_events,
    build_bridge_graph,
    invoke_bridge_once,
    observe,
    resolve,
    emit,
)
from src.resolution_map import (
    MACHINE_OUTPUT_LABELS,
    RESOLUTION_RULES,
    get_observations,
    get_severity,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

FACILITIES_ID = "facilities-uuid-001"
DAILY_CARE_ID = "daily-care-uuid-002"
WELLNESS_ID   = "wellness-uuid-003"

MOCK_SCHEMA: dict = {
    "FacilitiesMaintenance": {
        "id":           FACILITIES_ID,
        "name":         "FacilitiesMaintenance",
        "input_region": {"offset": 44, "length": 8},
        "output_region": {"offset": 250, "length": 6},
        "input_sequences": [],
    },
    "DailyPatientCare": {
        "id":           DAILY_CARE_ID,
        "name":         "DailyPatientCare",
        "input_region": {"offset": 186, "length": 8},
        "output_region": {"offset": 194, "length": 8},
        "input_sequences": [
            {
                "name":    "TC-05: Bathroom Non-Use Alert",
                "vectors": [[0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                             [0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                             [0.9, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1]],
            },
            {
                "name":    "TC-03: Fall — Responsive",
                "vectors": [[0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                             [0.9, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1]],
            },
            {
                "name":    "TC-04: Fall — Unresponsive",
                "vectors": [[0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                             [0.9, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1]],
            },
        ],
    },
    "PatientWellness": {
        "id":           WELLNESS_ID,
        "name":         "PatientWellness",
        "input_region": {"offset": 202, "length": 8},
        "output_region": {"offset": 210, "length": 8},
        "input_sequences": [
            {
                "name":    "TC-03: Alert Wellness",
                "vectors": [[0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                             [0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]],
            },
        ],
    },
}


def _make_event(
    machine_name: str,
    output_vector: list[float],
    machine_id: str = "test-machine-id",
) -> RealityEvent:
    return RealityEvent(
        machine_id    = machine_id,
        machine_name  = machine_name,
        output_vector = output_vector,
        output_region = {"offset": 250, "length": 6},
        global_step   = 10,
        timestamp     = 1234567890000,
    )


def _base_state(event: RealityEvent) -> BridgeState:
    return BridgeState(
        pe_url         = "https://localhost:3004",
        re_url         = "https://localhost:3000",
        machine_schema = MOCK_SCHEMA,
        event          = event,
        observations   = [],
        severity       = "normal",
        resolution     = None,
        emitted_source_id = None,
    )


# ── resolution_map helpers ────────────────────────────────────────────────────

class TestResolutionMap:
    def test_get_observations_hygiene_alert(self):
        # Bit 2 HIGH → HYGIENE_ALERT
        vec  = [0.1, 0.1, 0.9, 0.1, 0.1, 0.1]
        obs  = get_observations("FacilitiesMaintenance", vec)
        assert obs == ["HYGIENE_ALERT"]

    def test_get_observations_multiple(self):
        # Bits 2 and 3 both HIGH
        vec = [0.1, 0.1, 0.9, 0.9, 0.1, 0.1]
        obs = get_observations("FacilitiesMaintenance", vec)
        assert "HYGIENE_ALERT" in obs
        assert "SAFETY_ALERT"  in obs
        assert len(obs) == 2

    def test_get_observations_completion_signal(self):
        # Bit 0 HIGH → DAILY_COMPLETE (no alert)
        vec = [0.9, 0.1, 0.1, 0.1, 0.1, 0.1]
        obs = get_observations("FacilitiesMaintenance", vec)
        assert obs == ["DAILY_COMPLETE"]

    def test_get_observations_unknown_machine(self):
        obs = get_observations("NonExistentMachine", [0.9, 0.1])
        assert obs == []

    def test_get_severity_critical(self):
        assert get_severity(["INACCESSIBILITY_ALERT"]) == "critical"
        assert get_severity(["UNRESPONSIVE_FALL"])     == "critical"

    def test_get_severity_alert(self):
        assert get_severity(["HYGIENE_ALERT"])   == "alert"
        assert get_severity(["SAFETY_ALERT"])    == "alert"
        assert get_severity(["WELLNESS_CONCERN"]) == "alert"

    def test_get_severity_normal(self):
        assert get_severity(["DAILY_COMPLETE"])  == "normal"
        assert get_severity(["WEEKLY_COMPLETE"]) == "normal"
        assert get_severity([])                  == "normal"

    def test_all_machines_have_labels(self):
        expected = {
            "FacilitiesMaintenance", "DailyPatientCare",
            "PatientWellness", "WellnessAnalytics",
            "CareTransitionWorkflow", "NewPatientInflow",
        }
        assert set(MACHINE_OUTPUT_LABELS.keys()) == expected

    def test_resolution_rules_reference_valid_machines(self):
        """Every target_machine in RESOLUTION_RULES has a label table."""
        for src_machine, rules in RESOLUTION_RULES.items():
            for label, rule in rules.items():
                target = rule["target_machine"]
                assert target in MACHINE_OUTPUT_LABELS, (
                    f"{src_machine}.{label} → target '{target}' has no output labels"
                )


# ── observe node ──────────────────────────────────────────────────────────────

class TestObserveNode:
    def test_hygiene_alert(self):
        event = _make_event("FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1])
        result = observe(_base_state(event))
        assert result["observations"] == ["HYGIENE_ALERT"]
        assert result["severity"]     == "alert"

    def test_inaccessibility_critical(self):
        event  = _make_event("FacilitiesMaintenance", [0.1, 0.1, 0.1, 0.1, 0.1, 0.9])
        result = observe(_base_state(event))
        assert result["observations"] == ["INACCESSIBILITY_ALERT"]
        assert result["severity"]     == "critical"

    def test_daily_complete_normal(self):
        event  = _make_event("FacilitiesMaintenance", [0.9, 0.1, 0.1, 0.1, 0.1, 0.1])
        result = observe(_base_state(event))
        assert result["observations"] == ["DAILY_COMPLETE"]
        assert result["severity"]     == "normal"

    def test_all_low_produces_no_observations(self):
        event  = _make_event("FacilitiesMaintenance", [0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
        result = observe(_base_state(event))
        assert result["observations"] == []
        assert result["severity"]     == "normal"

    def test_unknown_machine_produces_no_observations(self):
        event  = _make_event("UnknownMachine", [0.9, 0.9, 0.9])
        result = observe(_base_state(event))
        assert result["observations"] == []


# ── resolve node ──────────────────────────────────────────────────────────────

class TestResolveNode:
    def _state_with_obs(
        self, machine_name, output_vector, observations, severity="alert"
    ) -> BridgeState:
        state = _base_state(_make_event(machine_name, output_vector))
        state["observations"] = observations
        state["severity"]     = severity
        return state

    def test_hygiene_alert_resolves_to_bathroom_sequence(self):
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
            ["HYGIENE_ALERT"],
        )
        result = resolve(state)
        res    = result["resolution"]
        assert res is not None
        assert res["action"]               == "inject_bathroom_alert"
        assert res["target_machine_name"]  == "DailyPatientCare"
        assert "Bathroom Non-Use"          in res["target_sequence_name"]

    def test_safety_alert_resolves_to_fall_responsive(self):
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.1, 0.9, 0.1, 0.1],
            ["SAFETY_ALERT"],
        )
        result = resolve(state)
        res    = result["resolution"]
        assert res is not None
        assert res["action"]              == "inject_fall_protocol"
        assert "Fall — Responsive"        in res["target_sequence_name"]

    def test_inaccessibility_resolves_to_fall_unresponsive(self):
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.1, 0.1, 0.1, 0.9],
            ["INACCESSIBILITY_ALERT"], severity="critical",
        )
        result = resolve(state)
        res    = result["resolution"]
        assert res is not None
        assert res["action"]          == "inject_welfare_check"
        assert "Unresponsive"         in res["target_sequence_name"]

    def test_source_config_shape(self):
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
            ["HYGIENE_ALERT"],
        )
        result = resolve(state)
        cfg    = result["resolution"]["source_config"]
        assert cfg["type"]         == "test"
        assert cfg["active"]       is True
        assert cfg["loop"]         is False
        assert isinstance(cfg["inputs"], list)
        assert len(cfg["inputs"])  > 0
        assert cfg["region"]       == {"offset": 186, "length": 8}
        assert cfg["machineId"]    == DAILY_CARE_ID
        assert cfg["machineName"]  == "DailyPatientCare"

    def test_no_rule_returns_none_resolution(self):
        # DAILY_COMPLETE has no rule
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.9, 0.1, 0.1, 0.1, 0.1, 0.1],
            ["DAILY_COMPLETE"], severity="normal",
        )
        result = resolve(state)
        assert result["resolution"] is None

    def test_missing_target_machine_returns_none(self):
        # Temporarily remove DailyPatientCare from schema
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
            ["HYGIENE_ALERT"],
        )
        state["machine_schema"] = {}   # empty schema
        result = resolve(state)
        assert result["resolution"] is None

    def test_rationale_contains_machine_and_action(self):
        state  = self._state_with_obs(
            "FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
            ["HYGIENE_ALERT"],
        )
        result = resolve(state)
        rat    = result["resolution"]["rationale"]
        assert "FacilitiesMaintenance" in rat
        assert "HYGIENE_ALERT"         in rat
        assert "inject_bathroom_alert" in rat


# ── emit node ─────────────────────────────────────────────────────────────────

class TestEmitNode:
    def test_emit_skipped_when_no_resolution(self):
        state  = _base_state(_make_event("FacilitiesMaintenance", [0.9]))
        state["resolution"] = None
        result = emit(state)
        assert result["emitted_source_id"] is None

    def test_emit_posts_to_pe_and_returns_source_id(self):
        state = _base_state(_make_event("FacilitiesMaintenance", [0.1, 0.1, 0.9]))
        state["resolution"] = {
            "action":               "inject_bathroom_alert",
            "rationale":            "test",
            "severity":             "alert",
            "target_machine_name":  "DailyPatientCare",
            "target_sequence_name": "Bathroom Non-Use Alert",
            "source_config": {
                "type":         "test",
                "name":         "LangGraph test source",
                "region":       {"offset": 186, "length": 8},
                "active":       True,
                "machineId":    DAILY_CARE_ID,
                "machineName":  "DailyPatientCare",
                "sequenceName": "Bathroom Non-Use Alert",
                "inputs":       [[0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]],
                "loop":         False,
            },
        }

        mock_response = MagicMock()
        mock_response.json.return_value = {"source": {"id": "emitted-source-uuid-abc"}}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_response
            result = emit(state)

        assert result["emitted_source_id"] == "emitted-source-uuid-abc"
        instance.post.assert_called_once()
        call_args = instance.post.call_args
        assert call_args[0][0].endswith("/api/sources")
        assert call_args[1]["json"]["type"] == "test"


# ── Full graph ────────────────────────────────────────────────────────────────

class TestBridgeGraph:
    def test_normal_completion_skips_emit(self):
        """DAILY_COMPLETE → no resolution → emit skipped."""
        event = _make_event("FacilitiesMaintenance", [0.9, 0.1, 0.1, 0.1, 0.1, 0.1])
        state = _base_state(event)

        graph  = build_bridge_graph()
        result = graph.invoke(state)

        assert result["observations"]     == ["DAILY_COMPLETE"]
        assert result["severity"]         == "normal"
        assert result["resolution"]       is None
        assert result["emitted_source_id"] is None

    def test_alert_observation_resolves_and_emits(self):
        """HYGIENE_ALERT → resolution found → emit called."""
        event  = _make_event("FacilitiesMaintenance", [0.1, 0.1, 0.9, 0.1, 0.1, 0.1])
        state  = _base_state(event)

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"source": {"id": "new-source-id-xyz"}}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_resp
            graph  = build_bridge_graph()
            result = graph.invoke(state)

        assert "HYGIENE_ALERT" in result["observations"]
        assert result["severity"]                        == "alert"
        assert result["resolution"] is not None
        assert result["resolution"]["action"]            == "inject_bathroom_alert"
        assert result["emitted_source_id"]               == "new-source-id-xyz"

    def test_critical_observation_resolves_and_emits(self):
        """INACCESSIBILITY_ALERT → critical severity → welfare check emitted."""
        event  = _make_event("FacilitiesMaintenance", [0.1, 0.1, 0.1, 0.1, 0.1, 0.9])
        state  = _base_state(event)

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"source": {"id": "welfare-source-id"}}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_resp
            graph  = build_bridge_graph()
            result = graph.invoke(state)

        assert result["severity"]             == "critical"
        assert result["resolution"]["action"] == "inject_welfare_check"
        assert result["emitted_source_id"]    == "welfare-source-id"

    def test_unknown_machine_produces_no_resolution(self):
        event  = _make_event("UnknownMachine", [0.9, 0.9, 0.9])
        state  = _base_state(event)
        graph  = build_bridge_graph()
        result = graph.invoke(state)
        assert result["resolution"]       is None
        assert result["emitted_source_id"] is None


# ── _extract_events ───────────────────────────────────────────────────────────

class TestExtractEvents:
    def _push_result(self, machine_results: dict) -> dict:
        return {
            "type":       "push-result",
            "success":    True,
            "globalStep": 42,
            "timestamp":  1234567890000,
            "step": {
                "stepNumber":     42,
                "machineResults": machine_results,
            },
        }

    def test_extracts_event_when_should_output(self):
        msg = self._push_result({
            "machine-001": {
                "machineName":  "FacilitiesMaintenance",
                "outputVector": [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
                "outputRegion": {"offset": 250, "length": 6},
                "transitionResult": {
                    "arbiterMetadata": {"shouldOutput": True}
                },
            }
        })
        events = _extract_events(msg)
        assert len(events) == 1
        assert events[0]["machine_name"]  == "FacilitiesMaintenance"
        assert events[0]["output_vector"] == [0.1, 0.1, 0.9, 0.1, 0.1, 0.1]
        assert events[0]["global_step"]   == 42

    def test_ignores_should_output_false(self):
        msg = self._push_result({
            "machine-001": {
                "machineName":  "FacilitiesMaintenance",
                "outputVector": [0.9, 0.1, 0.1, 0.1, 0.1, 0.1],
                "outputRegion": {},
                "transitionResult": {
                    "arbiterMetadata": {"shouldOutput": False}
                },
            }
        })
        events = _extract_events(msg)
        assert events == []

    def test_ignores_all_low_output_vector(self):
        msg = self._push_result({
            "machine-001": {
                "machineName":  "FacilitiesMaintenance",
                "outputVector": [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                "outputRegion": {},
                "transitionResult": {
                    "arbiterMetadata": {"shouldOutput": True}
                },
            }
        })
        events = _extract_events(msg)
        assert events == []

    def test_ignores_non_push_result_messages(self):
        events = _extract_events({"type": "state-update", "state": {}})
        assert events == []

    def test_ignores_failed_push_result(self):
        events = _extract_events({"type": "push-result", "success": False})
        assert events == []

    def test_multiple_machines_in_one_step(self):
        msg = self._push_result({
            "m1": {
                "machineName":  "FacilitiesMaintenance",
                "outputVector": [0.1, 0.1, 0.9, 0.1, 0.1, 0.1],
                "outputRegion": {},
                "transitionResult": {"arbiterMetadata": {"shouldOutput": True}},
            },
            "m2": {
                "machineName":  "DailyPatientCare",
                "outputVector": [0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1],
                "outputRegion": {},
                "transitionResult": {"arbiterMetadata": {"shouldOutput": True}},
            },
        })
        events = _extract_events(msg)
        assert len(events) == 2
        names = {e["machine_name"] for e in events}
        assert "FacilitiesMaintenance" in names
        assert "DailyPatientCare"      in names
