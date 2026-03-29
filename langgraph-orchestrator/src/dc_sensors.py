"""
dc_sensors.py — Sensor source configurations for the DC + AI monitoring pipeline.

Defines all perception-engine sensor sources that map into the perceptual space
of the Reality Engine.  Use `ensure_sources()` at startup to register any missing
sources, then `push_sensor_values()` to stream live readings.

Perceptual space layout (sensor regions):
    [12:16]   dc-thermal   — cpu_temp_norm, cpu_load_norm, cpu_throttle_norm, cpu_efficiency_norm
    [16:20]   dc-memory    — mem_usage_norm, page_fault_norm, cache_miss_norm, swap_usage_norm
    [20:24]   dc-network   — bw_util_norm, pkt_loss_norm, latency_norm, queue_norm
    [24:28]   dc-cpu       — core0_util, core1_util, core2_util, core3_util
    [28:32]   dc-power     — total_pwr_norm, pdu_efficiency, ups_load, grid_freq_dev
    [32:36]   dc-storage   — iops_norm, disk_latency_norm, raid_health, cache_hit_rate
    [36:40]   dc-security  — auth_failures_norm, anomaly_score_norm, port_scan_norm, privilege_events_norm
    [120:124] ai-power     — pue_norm, power_draw_norm, renewable_deficit_norm, carbon_intensity_norm
    [124:128] ai-cooling   — coolant_temp_norm, chiller_inefficiency_norm, flow_restriction_norm, thermal_imbalance_norm
    [128:132] ai-capacity  — gpu_util_norm, queue_pressure_norm, mem_pressure_norm, thermal_headroom_inv
    [132:136] ai-security  — auth_anomaly_norm, network_anomaly_norm, privilege_esc_norm, threat_confidence_norm
    [136:140] ai-wellness  — inference_error_rate_norm, latency_slo_violation_norm, accuracy_drift_norm, memory_leak_rate_norm
    [140:144] ai-resilience — disk_smart_fail_norm, memory_ecc_norm, packet_loss_norm, hw_fault_accum_norm
"""

from __future__ import annotations

import warnings
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Source definitions
# ---------------------------------------------------------------------------

SENSOR_SOURCES: list[dict[str, Any]] = [
    # -----------------------------------------------------------------------
    # DC infrastructure sensors
    # -----------------------------------------------------------------------
    {
        "sensor_id": "dc-thermal",
        "name": "DC Thermal Monitor",
        "region_offset": 12,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "CPU thermal sensor pack — temperature, load, throttle state and "
            "efficiency index.  Feeds DCThermalEscalation CES machine."
        ),
        "fields": [
            "cpu_temp_norm",
            "cpu_load_norm",
            "cpu_throttle_norm",   # static 0.5 — not actively used by detector
            "cpu_efficiency_norm", # static 0.5 — not actively used by detector
        ],
    },
    {
        "sensor_id": "dc-memory",
        "name": "DC Memory Pressure Monitor",
        "region_offset": 16,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "Memory subsystem sensor pack — utilisation, page-fault rate, "
            "cache-miss rate and swap activity.  Feeds DCMemoryPressure CES machine."
        ),
        "fields": [
            "mem_usage_norm",
            "page_fault_norm",  # static 0.5
            "cache_miss_norm",  # static 0.5
            "swap_usage_norm",
        ],
    },
    {
        "sensor_id": "dc-network",
        "name": "DC Network Burst Detector",
        "region_offset": 20,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "Network sensor pack — bandwidth utilisation, packet-loss rate, "
            "latency and queue depth.  Feeds DCNetworkBurstDetector CES machine."
        ),
        "fields": [
            "bw_util_norm",
            "pkt_loss_norm",
            "latency_norm",  # static 0.5
            "queue_norm",    # static 0.5
        ],
    },
    {
        "sensor_id": "dc-cpu",
        "name": "DC CPU Core Utilisation",
        "region_offset": 24,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": "Per-core CPU utilisation for cores 0–3.",
        "fields": [
            "core0_util",
            "core1_util",
            "core2_util",
            "core3_util",
        ],
    },
    {
        "sensor_id": "dc-power",
        "name": "DC Power Distribution Monitor",
        "region_offset": 28,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "Power infrastructure metrics — total power draw, PDU efficiency, "
            "UPS load and grid-frequency deviation."
        ),
        "fields": [
            "total_pwr_norm",
            "pdu_efficiency",
            "ups_load",
            "grid_freq_dev",
        ],
    },
    {
        "sensor_id": "dc-storage",
        "name": "DC Storage Health Monitor",
        "region_offset": 32,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": "Storage subsystem health — IOPS, disk latency, RAID health and cache hit rate.",
        "fields": [
            "iops_norm",
            "disk_latency_norm",
            "raid_health",
            "cache_hit_rate",
        ],
    },
    {
        "sensor_id": "dc-security",
        "name": "DC Security Event Monitor",
        "region_offset": 36,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "Security telemetry — authentication failures, anomaly score, "
            "port-scan detections and privilege-escalation events."
        ),
        "fields": [
            "auth_failures_norm",
            "anomaly_score_norm",
            "port_scan_norm",
            "privilege_events_norm",
        ],
    },
    # -----------------------------------------------------------------------
    # AI workload sensors
    # -----------------------------------------------------------------------
    {
        "sensor_id": "ai-power",
        "name": "AI Power Efficiency Monitor",
        "region_offset": 120,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "AI infrastructure power efficiency — PUE, total AI power draw, "
            "renewable energy deficit and carbon intensity.  "
            "Feeds AIPowerEfficiency machine [120:124]→[150:156]."
        ),
        "fields": [
            "pue_norm",
            "power_draw_norm",
            "renewable_deficit_norm",
            "carbon_intensity_norm",
        ],
    },
    {
        "sensor_id": "ai-cooling",
        "name": "AI Cooling Regulator",
        "region_offset": 124,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "Cooling system metrics for AI workloads — coolant temperature, "
            "chiller inefficiency, flow restriction and thermal imbalance.  "
            "Feeds AICoolingRegulator machine [124:128]→[156:162]."
        ),
        "fields": [
            "coolant_temp_norm",
            "chiller_inefficiency_norm",
            "flow_restriction_norm",
            "thermal_imbalance_norm",
        ],
    },
    {
        "sensor_id": "ai-capacity",
        "name": "AI Capacity Throttler",
        "region_offset": 128,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "AI compute capacity indicators — GPU utilisation, job queue "
            "pressure, memory pressure and inverse thermal headroom.  "
            "Feeds AICapacityThrottler machine [128:132]→[162:168]."
        ),
        "fields": [
            "gpu_util_norm",
            "queue_pressure_norm",
            "mem_pressure_norm",
            "thermal_headroom_inv",  # = 1 - cpu_temp_norm (high temp → low headroom)
        ],
    },
    {
        "sensor_id": "ai-security",
        "name": "AI Security Monitor",
        "region_offset": 132,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "AI-layer security telemetry — authentication anomalies, network "
            "anomalies, privilege escalation attempts and overall threat "
            "confidence score.  Feeds AISecurityMonitor machine [132:136]→[168:174]."
        ),
        "fields": [
            "auth_anomaly_norm",
            "network_anomaly_norm",
            "privilege_esc_norm",
            "threat_confidence_norm",
        ],
    },
    {
        "sensor_id": "ai-wellness",
        "name": "AI Model Wellness Monitor",
        "region_offset": 136,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "AI model health indicators — inference error rate, latency SLO "
            "violation rate, accuracy drift and memory leak rate.  "
            "Feeds AIModelWellness machine [136:140]→[174:180]."
        ),
        "fields": [
            "inference_error_rate_norm",
            "latency_slo_violation_norm",
            "accuracy_drift_norm",
            "memory_leak_rate_norm",
        ],
    },
    {
        "sensor_id": "ai-resilience",
        "name": "AI Hardware Resilience Monitor",
        "region_offset": 140,
        "region_length": 4,
        "ttl_ms": 120_000,
        "description": (
            "AI hardware resilience metrics — disk SMART failure score, memory "
            "ECC error rate, packet-loss rate and cumulative hardware fault "
            "accumulation.  Feeds AIHardwareResilience machine [140:144]→[180:186]."
        ),
        "fields": [
            "disk_smart_fail_norm",
            "memory_ecc_norm",
            "packet_loss_norm",
            "hw_fault_accum_norm",
        ],
    },
]

# ---------------------------------------------------------------------------
# Friendly-name → sensor_id mapping
# ---------------------------------------------------------------------------

SENSOR_IDS: dict[str, str] = {s["name"].split()[1].lower(): s["sensor_id"] for s in SENSOR_SOURCES}

# Override with explicit short keys for unambiguous lookup
SENSOR_IDS = {
    "thermal":    "dc-thermal",
    "memory":     "dc-memory",
    "network":    "dc-network",
    "cpu":        "dc-cpu",
    "power":      "dc-power",
    "storage":    "dc-storage",
    "security":   "dc-security",
    "ai_power":   "ai-power",
    "ai_cooling": "ai-cooling",
    "ai_capacity":"ai-capacity",
    "ai_security":"ai-security",
    "ai_wellness":"ai-wellness",
    "ai_resilience": "ai-resilience",
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _client() -> httpx.Client:
    """Return a pre-configured synchronous httpx client (TLS verification off)."""
    return httpx.Client(verify=False, timeout=10.0)


def ensure_sources(pe_url: str) -> dict[str, str]:
    """Register any missing sensor sources with the Perception Engine.

    Compares the desired ``SENSOR_SOURCES`` list against the sources already
    registered at *pe_url*.  Any source whose ``sensor_id`` is not yet present
    is POSTed to ``/api/sources``.

    Args:
        pe_url: Base URL of the Perception Engine, e.g. ``"http://localhost:3004"``.

    Returns:
        A mapping of ``{sensor_id: source_uuid}`` for every sensor in
        ``SENSOR_SOURCES``, whether newly created or already existing.

    Raises:
        httpx.HTTPStatusError: If a registration request fails with a 4xx/5xx
            status code.
    """
    with warnings.catch_warnings():
        # Silence the InsecureRequestWarning that httpx emits for verify=False
        warnings.simplefilter("ignore")
        with _client() as client:
            response = client.get(f"{pe_url}/api/sources")
            response.raise_for_status()
            existing: list[dict[str, Any]] = response.json()

    # Build lookup: sensor_id → uuid for already-registered sources
    existing_by_sensor_id: dict[str, str] = {
        src["sensorId"]: src["id"]
        for src in existing
        if "sensorId" in src and "id" in src
    }

    result: dict[str, str] = {}

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with _client() as client:
            for sensor in SENSOR_SOURCES:
                sid = sensor["sensor_id"]

                if sid in existing_by_sensor_id:
                    result[sid] = existing_by_sensor_id[sid]
                    continue

                payload = {
                    "sensorId":     sid,
                    "name":         sensor["name"],
                    "regionOffset": sensor["region_offset"],
                    "regionLength": sensor["region_length"],
                    "ttlMs":        sensor["ttl_ms"],
                    "description":  sensor["description"],
                    "type":         "sensor",
                }
                resp = client.post(f"{pe_url}/api/sources", json=payload)
                resp.raise_for_status()
                created: dict[str, Any] = resp.json()
                result[sid] = created["id"]

    return result


def push_sensor_values(
    pe_url: str,
    sensor_id: str,
    values: list[float],
) -> None:
    """Push a sensor reading to the Perception Engine.

    The Perception Engine will assemble the values into the appropriate region
    of the perceptual space vector and forward it to the Reality Engine.

    Args:
        pe_url:    Base URL of the Perception Engine, e.g. ``"http://localhost:3004"``.
        sensor_id: The ``sensor_id`` string (e.g. ``"dc-thermal"``).
        values:    A list of floats whose length must match the source's
                   ``region_length``.  All values should be normalised to
                   ``[0.0, 1.0]``.

    Raises:
        httpx.HTTPStatusError: If the push request is rejected.
        ValueError: If *values* is empty.
    """
    if not values:
        raise ValueError("values must be a non-empty list of floats")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with _client() as client:
            resp = client.post(
                f"{pe_url}/api/sensors/{sensor_id}",
                json={"values": values},
            )
            resp.raise_for_status()
