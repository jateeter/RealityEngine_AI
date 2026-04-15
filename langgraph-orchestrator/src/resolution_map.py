"""
resolution_map.py — Semantic label dictionaries and resolution rules for all
elder-care and facility machines loaded into the Reality Engine.

Two tables drive the bidirectional bridge:

  MACHINE_OUTPUT_LABELS
    {machine_name → {bit_index → label}}
    Maps each HIGH output bit from a PE push-result to its human-readable
    signal name, derived directly from the outputVectors.metadata.description
    field in each machine's JSON definition.

  RESOLUTION_RULES
    {machine_name → {label → rule}}
    Defines what LangGraph should do when it observes each label.
    rule keys:
      action          — canonical action name (used in logs and rationale)
      target_machine  — name of the machine to inject a sequence into
      target_sequence — substring match against the target's inputSequences
      severity        — "alert" | "critical" (labels not listed here are "normal")
"""

# ── Output label tables ───────────────────────────────────────────────────────
# Keyed by the machine's `name` field as returned by GET /api/machines.
# Index = position in the output vector slice (relative to output region offset).

MACHINE_OUTPUT_LABELS: dict[str, dict[int, str]] = {

    "FacilitiesMaintenance": {
        0: "DAILY_COMPLETE",
        1: "WEEKLY_COMPLETE",
        2: "HYGIENE_ALERT",
        3: "SAFETY_ALERT",
        4: "WELLNESS_CONCERN",
        5: "INACCESSIBILITY_ALERT",
    },

    "DailyPatientCare": {
        0: "MORNING_COMPLETE",
        1: "EVENING_COMPLETE",
        2: "FALL_CONFIRMED",
        3: "UNRESPONSIVE_FALL",
        4: "BATHROOM_ALERT",
        5: "MEDICATION_MISSED",
        6: "WANDERING_ALERT",
    },

    "PatientWellness": {
        0: "OPTIMAL",
        1: "GOOD",
        2: "ALERT",
        3: "CRITICAL",
    },

    "WellnessAnalytics": {
        0: "INFLOW_EVALUATION",
        1: "INFLOW_URGENT",
        2: "TRANSITION_REVIEW",
        3: "TRANSITION_ESCALATION",
        4: "TRANSITION_URGENT",
        5: "WELLNESS_IMPROVING",
    },

    "CareTransitionWorkflow": {
        0: "HOSPITAL_TRANSFER_COMPLETE",
        1: "REHAB_TRANSFER_COMPLETE",
        2: "ALF_TRANSFER_COMPLETE",
        3: "TRANSFER_BLOCKED",
        4: "EMERGENCY_ESCALATION",
    },

    "NewPatientInflow": {
        0: "ACCEPTED",
        1: "PROVISIONAL_REJECT",
    },
}

# ── Resolution rules ──────────────────────────────────────────────────────────
# Only actionable labels are listed; completion/normal signals are silent.
# target_machine and target_sequence are matched by name against the schema
# fetched from GET /api/machines at bridge startup.

RESOLUTION_RULES: dict[str, dict[str, dict]] = {

    "FacilitiesMaintenance": {
        "HYGIENE_ALERT": {
            "action":          "inject_bathroom_alert",
            "target_machine":  "DailyPatientCare",
            "target_sequence": "Bathroom Non-Use",
            "severity":        "alert",
        },
        "SAFETY_ALERT": {
            "action":          "inject_fall_protocol",
            "target_machine":  "DailyPatientCare",
            "target_sequence": "Fall — Responsive",
            "severity":        "alert",
        },
        "WELLNESS_CONCERN": {
            "action":          "inject_wellness_flag",
            "target_machine":  "PatientWellness",
            "target_sequence": "Alert Wellness",
            "severity":        "alert",
        },
        "INACCESSIBILITY_ALERT": {
            "action":          "inject_welfare_check",
            "target_machine":  "DailyPatientCare",
            "target_sequence": "Fall — Unresponsive",
            "severity":        "critical",
        },
    },

    "DailyPatientCare": {
        "UNRESPONSIVE_FALL": {
            "action":          "emergency_hospital_transfer",
            "target_machine":  "CareTransitionWorkflow",
            "target_sequence": "Scenario 1",
            "severity":        "critical",
        },
        "FALL_CONFIRMED": {
            "action":          "assess_post_fall_wellness",
            "target_machine":  "PatientWellness",
            "target_sequence": "Alert Wellness",
            "severity":        "alert",
        },
        "BATHROOM_ALERT": {
            "action":          "flag_hygiene_concern",
            "target_machine":  "WellnessAnalytics",
            "target_sequence": "Sustained ALERT",
            "severity":        "alert",
        },
        "WANDERING_ALERT": {
            "action":          "assess_cognitive_wellness",
            "target_machine":  "PatientWellness",
            "target_sequence": "Critical Wellness",
            "severity":        "alert",
        },
    },

    "PatientWellness": {
        "CRITICAL": {
            "action":          "route_critical_to_analytics",
            "target_machine":  "WellnessAnalytics",
            "target_sequence": "CRITICAL Level",
            "severity":        "critical",
        },
        "ALERT": {
            "action":          "route_alert_to_analytics",
            "target_machine":  "WellnessAnalytics",
            "target_sequence": "Sustained ALERT",
            "severity":        "alert",
        },
    },

    "WellnessAnalytics": {
        "TRANSITION_ESCALATION": {
            "action":          "emergency_hospital_transfer",
            "target_machine":  "CareTransitionWorkflow",
            "target_sequence": "Scenario 1",
            "severity":        "critical",
        },
        "TRANSITION_URGENT": {
            "action":          "priority_care_level_review",
            "target_machine":  "CareTransitionWorkflow",
            "target_sequence": "Scenario 2",
            "severity":        "critical",
        },
        "TRANSITION_REVIEW": {
            "action":          "initiate_care_transition",
            "target_machine":  "CareTransitionWorkflow",
            "target_sequence": "Scenario 3",
            "severity":        "alert",
        },
        "INFLOW_URGENT": {
            "action":          "urgent_patient_evaluation",
            "target_machine":  "NewPatientInflow",
            "target_sequence": "Full Acceptance",
            "severity":        "critical",
        },
        "INFLOW_EVALUATION": {
            "action":          "standard_patient_evaluation",
            "target_machine":  "NewPatientInflow",
            "target_sequence": "Full Acceptance",
            "severity":        "alert",
        },
    },
}


def get_output_label(machine_name: str, bit_index: int) -> str | None:
    """Return the semantic label for a single output bit, or None if not defined."""
    return MACHINE_OUTPUT_LABELS.get(machine_name, {}).get(bit_index)


def get_observations(machine_name: str, output_vector: list[float]) -> list[str]:
    """Return all HIGH-bit labels (value > 0.5) for the given output vector."""
    labels = MACHINE_OUTPUT_LABELS.get(machine_name, {})
    return [labels[i] for i, v in enumerate(output_vector) if v > 0.5 and i in labels]


def get_severity(observations: list[str]) -> str:
    """Classify overall severity from a list of observation labels."""
    critical_keywords = ("CRITICAL", "UNRESPONSIVE", "EMERGENCY", "INACCESSIBILITY", "URGENT")
    alert_keywords    = ("ALERT", "CONCERN", "MISSED", "WANDERING", "BLOCKED", "EVALUATION")
    for obs in observations:
        if any(kw in obs for kw in critical_keywords):
            return "critical"
    for obs in observations:
        if any(kw in obs for kw in alert_keywords):
            return "alert"
    return "normal"
