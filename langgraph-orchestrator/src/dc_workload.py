"""
dc_workload.py — Simulated 3-hour data-centre workload generator.

Produces a deterministic, reproducible sequence of 180 per-minute sensor
readings (one per minute) that drive the DC + AI monitoring pipeline through
a realistic set of escalation and recovery phases.

Usage::

    from dc_workload import DCWorkloadGenerator

    gen = DCWorkloadGenerator()
    steps = gen.generate()          # list of 180 step dicts
    summary = gen.phase_summary()   # list of phase-level summary dicts

Each step dict has the shape::

    {
        'minute':           int,
        'wall_time':        str,          # "T+HH:MM"
        'phase':            str,
        'phase_description': str,
        'sensors': {
            'dc-thermal':    [temp, load, 0.5, 0.5],
            'dc-memory':     [mem, 0.5, 0.5, swap],
            'dc-network':    [bw, pkt_loss, 0.5, 0.5],
            'dc-cpu':        [c0, c1, c2, c3],
            'dc-power':      [pwr, pdu, ups, freq_dev],
            'dc-storage':    [iops, disk_lat, raid, cache_hit],
            'dc-security':   [auth, anomaly, port_scan, priv],
            'ai-power':      [pue, power_draw, renewable_def, carbon],
            'ai-cooling':    [coolant, chiller_ineff, flow_restr, imbalance],
            'ai-capacity':   [gpu_util, queue_press, mem_press, thermal_inv],
            'ai-security':   [auth_anom, net_anom, priv_esc, threat_conf],
            'ai-wellness':   [infer_err, latency_slo, acc_drift, mem_leak],
            'ai-resilience': [disk_smart, mem_ecc, pkt_loss, hw_fault],
        },
        'events': list[str],
    }

All sensor values are normalised to ``[0.0, 1.0]``.  The GTE comparator used
by Reality Engine CES machines treats ``value >= 0.5`` as HIGH and
``value < 0.5`` as LOW.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamp *value* to [*lo*, *hi*]."""
    return max(lo, min(hi, value))


def _add_noise(value: float, rng: random.Random, stddev: float = 0.02) -> float:
    """Return *value* with Gaussian noise applied, clamped to [0, 1]."""
    return _clamp(value + rng.gauss(0.0, stddev))


def _lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation between *a* and *b* by fraction *t* ∈ [0, 1]."""
    return a + (b - a) * _clamp(t)


def _wall_time(minute: int) -> str:
    """Format *minute* offset as ``"T+HH:MM"``."""
    return f"T+{minute // 60:02d}:{minute % 60:02d}"


# ---------------------------------------------------------------------------
# Phase table entry
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _Phase:
    start: int
    end: int
    label: str
    description: str


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class DCWorkloadGenerator:
    """Generate a deterministic 3-hour simulated DC workload.

    The simulation is seeded with ``random.Random(seed=42)`` so every call to
    :meth:`generate` returns the same sequence.

    Attributes:
        NUM_STEPS: Total number of simulation steps (minutes).
        PHASES:    Ordered list of ``(start_min, end_min, label, description)``
                   tuples that define the operational narrative.
    """

    NUM_STEPS: int = 180  # 1 step per minute → 3 hours

    # (start_min, end_min, label, description)
    PHASES: list[tuple[int, int, str, str]] = [
        (0,   30,  "NORMAL_OPS",          "Steady-state baseline operations"),
        (30,  45,  "TRAINING_RAMP_UP",    "Large AI training job launched; CPU/thermal rising"),
        (45,  57,  "THERMAL_ESCALATION",  "CPU temps rising through WARM→HOT→CRITICAL"),
        (57,  63,  "THERMAL_EMERGENCY",   "Thermal EMERGENCY — DCCoolingControlFF SET"),
        (63,  80,  "COOLING_RECOVERY",    "Cooling activated, temps declining"),
        (80,  110, "STABLE_NORMAL",       "Normal operations resumed"),
        (110, 122, "NETWORK_RAMP_UP",     "Model checkpoint sync; bandwidth elevating"),
        (122, 135, "NETWORK_ESCALATION",  "Network BURST→CONGESTION; DCNetworkThrottleFF SET"),
        (135, 155, "NETWORK_RECOVERY",    "Traffic throttled, network recovering"),
        (155, 168, "COMBINED_EMERGENCY",  "Thermal+network both critical — DCCriticalSynthesizer fires"),
        (168, 180, "FULL_RECOVERY",       "All systems recovering to nominal"),
    ]

    def __init__(self) -> None:
        self._phases: list[_Phase] = [
            _Phase(start=s, end=e, label=l, description=d)
            for s, e, l, d in self.PHASES
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_phase_info(self, minute: int) -> tuple[str, str]:
        """Return the ``(label, description)`` for *minute*.

        Args:
            minute: Simulation minute in ``[0, NUM_STEPS)``.

        Returns:
            A ``(label, description)`` tuple.  Falls back to the last phase
            if *minute* is beyond the defined range.
        """
        for phase in self._phases:
            if phase.start <= minute < phase.end:
                return phase.label, phase.description
        last = self._phases[-1]
        return last.label, last.description

    def phase_summary(self) -> list[dict[str, Any]]:
        """Return a high-level summary of every phase.

        Returns:
            A list of dicts, one per phase, containing ``start``, ``end``,
            ``duration_minutes``, ``label`` and ``description``.
        """
        return [
            {
                "start":            p.start,
                "end":              p.end,
                "duration_minutes": p.end - p.start,
                "label":            p.label,
                "description":      p.description,
            }
            for p in self._phases
        ]

    def generate(self) -> list[dict[str, Any]]:
        """Generate the full 180-step workload.

        Returns:
            A list of 180 step dicts, each describing the sensor readings and
            notable events for that minute.
        """
        rng = random.Random(42)
        steps: list[dict[str, Any]] = []

        for minute in range(self.NUM_STEPS):
            label, description = self.get_phase_info(minute)
            sensors, events = self._compute_sensors(minute, label, rng)

            steps.append(
                {
                    "minute":            minute,
                    "wall_time":         _wall_time(minute),
                    "phase":             label,
                    "phase_description": description,
                    "sensors":           sensors,
                    "events":            events,
                }
            )

        return steps

    # ------------------------------------------------------------------
    # Internal computation
    # ------------------------------------------------------------------

    def _compute_sensors(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
    ) -> tuple[dict[str, list[float]], list[str]]:
        """Compute all sensor vectors and notable events for *minute*."""

        events: list[str] = []

        # ------------------------------------------------------------------
        # 1. DC Thermal  [12:16]
        # ------------------------------------------------------------------
        temp, load = self._thermal_values(minute, phase, rng, events)
        dc_thermal = [
            _add_noise(temp, rng),
            _add_noise(load, rng),
            0.5,  # cpu_throttle_norm — static placeholder
            0.5,  # cpu_efficiency_norm — static placeholder
        ]

        # ------------------------------------------------------------------
        # 2. DC Memory  [16:20]
        # ------------------------------------------------------------------
        mem, swap = self._memory_values(minute, phase, rng, events)
        dc_memory = [
            _add_noise(mem, rng),
            0.5,  # page_fault_norm — static placeholder
            0.5,  # cache_miss_norm — static placeholder
            _add_noise(swap, rng),
        ]

        # ------------------------------------------------------------------
        # 3. DC Network  [20:24]
        # ------------------------------------------------------------------
        bw, pkt = self._network_values(minute, phase, rng, events)
        dc_network = [
            _add_noise(bw, rng),
            _add_noise(pkt, rng),
            0.5,  # latency_norm — static placeholder
            0.5,  # queue_norm — static placeholder
        ]

        # ------------------------------------------------------------------
        # 4. DC CPU cores  [24:28]
        # ------------------------------------------------------------------
        cpu_base = self._cpu_base(minute, phase)
        dc_cpu = [
            _add_noise(cpu_base + rng.uniform(-0.05, 0.05), rng, stddev=0.015)
            for _ in range(4)
        ]
        dc_cpu = [_clamp(v) for v in dc_cpu]

        # ------------------------------------------------------------------
        # 5. DC Power  [28:32]
        # ------------------------------------------------------------------
        dc_power = self._power_values(minute, phase, temp, rng)

        # ------------------------------------------------------------------
        # 6. DC Storage  [32:36]
        # ------------------------------------------------------------------
        dc_storage = self._storage_values(minute, phase, rng)

        # ------------------------------------------------------------------
        # 7. DC Security  [36:40]
        # ------------------------------------------------------------------
        dc_security = self._security_values(minute, phase, rng, events)
        anomaly_score = dc_security[1]  # used for AI security correlation

        # ------------------------------------------------------------------
        # 8. AI sensor suite  [120:144]
        # ------------------------------------------------------------------
        ai_power     = self._ai_power(minute, phase, temp, rng)
        ai_cooling   = self._ai_cooling(minute, phase, temp, rng)
        ai_capacity  = self._ai_capacity(minute, phase, temp, bw, rng, events)
        ai_security  = self._ai_security(anomaly_score, rng)
        ai_wellness  = self._ai_wellness(minute, phase, bw, rng, events)
        ai_resilience = self._ai_resilience(minute, rng)

        sensors: dict[str, list[float]] = {
            "dc-thermal":    dc_thermal,
            "dc-memory":     dc_memory,
            "dc-network":    dc_network,
            "dc-cpu":        dc_cpu,
            "dc-power":      dc_power,
            "dc-storage":    dc_storage,
            "dc-security":   dc_security,
            "ai-power":      ai_power,
            "ai-cooling":    ai_cooling,
            "ai-capacity":   ai_capacity,
            "ai-security":   ai_security,
            "ai-wellness":   ai_wellness,
            "ai-resilience": ai_resilience,
        }

        # Round all values to 4 d.p. for clean output
        sensors = {k: [round(v, 4) for v in vs] for k, vs in sensors.items()}
        return sensors, events

    # ------------------------------------------------------------------
    # Per-sensor value generators
    # ------------------------------------------------------------------

    def _thermal_values(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
        events: list[str],
    ) -> tuple[float, float]:
        """Return ``(cpu_temp_norm, cpu_load_norm)`` for the current phase."""

        # During COMBINED_EMERGENCY both thermal and network must be in
        # emergency state simultaneously (temperatures revisit critical/emergency).
        if phase == "COMBINED_EMERGENCY":
            # Escalate quickly back to emergency territory over the 13-minute window
            t = (minute - 155) / 12.0
            temp = _lerp(0.72, 0.96, t)
            load = _lerp(0.78, 0.97, t)
            if minute == 155:
                events.append("THERMAL_COMBINED_EMERGENCY_START")
            return temp, load

        if phase == "FULL_RECOVERY":
            t = (minute - 168) / 11.0
            temp = _lerp(0.75, 0.32, t)
            load = _lerp(0.80, 0.36, t)
            return temp, load

        if phase == "NORMAL_OPS":
            return 0.3, 0.35

        if phase == "TRAINING_RAMP_UP":
            # Linear ramp from NORMAL to WARM over 15 minutes
            t = (minute - 30) / 14.0
            temp = _lerp(0.3, 0.55, t)
            load = _lerp(0.35, 0.65, t)
            if minute == 30:
                events.append("TRAINING_JOB_LAUNCHED")
            return temp, load

        if phase == "THERMAL_ESCALATION":
            # 12 minutes: WARM(0-3) → HOT(4-7) → CRITICAL(8-11)
            offset = minute - 45
            if offset < 4:
                # WARM
                t = offset / 3.0
                temp = _lerp(0.55, 0.72, t)
                load = _lerp(0.65, 0.82, t)
                if offset == 0:
                    events.append("THERMAL_WARM_ENTRY")
            elif offset < 8:
                # HOT
                t = (offset - 4) / 3.0
                temp = _lerp(0.72, 0.88, t)
                load = _lerp(0.82, 0.92, t)
                if offset == 4:
                    events.append("THERMAL_HOT_ENTRY")
            else:
                # CRITICAL
                t = (offset - 8) / 3.0
                temp = _lerp(0.88, 0.94, t)
                load = _lerp(0.92, 0.95, t)
                if offset == 8:
                    events.append("THERMAL_CRITICAL_ENTRY")
            return temp, load

        if phase == "THERMAL_EMERGENCY":
            temp = _lerp(0.94, 0.97, (minute - 57) / 5.0)
            load = _lerp(0.95, 0.97, (minute - 57) / 5.0)
            if minute == 57:
                events.append("THERMAL_EMERGENCY_ENTRY")
                events.append("DC_COOLING_FF_SET")
            return temp, load

        if phase == "COOLING_RECOVERY":
            # Temp drops from emergency back to warm/normal over 17 minutes
            t = (minute - 63) / 16.0
            temp = _lerp(0.97, 0.38, t)
            load = _lerp(0.97, 0.40, t)
            if minute == 63:
                events.append("COOLING_ACTIVATED")
            return temp, load

        if phase in ("STABLE_NORMAL", "NETWORK_RAMP_UP"):
            return 0.3, 0.35

        if phase in ("NETWORK_ESCALATION", "NETWORK_RECOVERY"):
            # Thermal is calm during pure network events
            return 0.32, 0.36

        # Fallback
        return 0.3, 0.35

    def _memory_values(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
        events: list[str],
    ) -> tuple[float, float]:
        """Return ``(mem_usage_norm, swap_usage_norm)``."""

        # Memory pressure escalates somewhat with thermal/training load
        if phase == "NORMAL_OPS":
            return 0.35, 0.04

        if phase == "TRAINING_RAMP_UP":
            t = (minute - 30) / 14.0
            return _lerp(0.35, 0.65, t), _lerp(0.04, 0.25, t)

        if phase == "THERMAL_ESCALATION":
            # During thermal escalation memory pressure also rises
            offset = minute - 45
            if offset < 4:
                return 0.65, 0.25
            elif offset < 8:
                t = (offset - 4) / 3.0
                return _lerp(0.65, 0.80, t), _lerp(0.25, 0.55, t)
            else:
                t = (offset - 8) / 3.0
                mem = _lerp(0.80, 0.90, t)
                swap = _lerp(0.55, 0.80, t)
                if offset == 8:
                    events.append("MEMORY_THRASHING_ENTRY")
                return mem, swap

        if phase == "THERMAL_EMERGENCY":
            mem = _lerp(0.90, 0.97, (minute - 57) / 5.0)
            swap = _lerp(0.80, 0.97, (minute - 57) / 5.0)
            if minute == 57:
                events.append("MEMORY_FAILURE_ENTRY")
            return mem, swap

        if phase == "COOLING_RECOVERY":
            t = (minute - 63) / 16.0
            return _lerp(0.97, 0.40, t), _lerp(0.97, 0.08, t)

        if phase in ("STABLE_NORMAL", "NETWORK_RAMP_UP"):
            return 0.38, 0.05

        if phase == "NETWORK_ESCALATION":
            # Memory stays elevated due to buffering during network congestion
            return 0.60, 0.22

        if phase == "NETWORK_RECOVERY":
            t = (minute - 135) / 19.0
            return _lerp(0.60, 0.38, t), _lerp(0.22, 0.05, t)

        if phase == "COMBINED_EMERGENCY":
            # Both thermal and memory are under stress
            t = (minute - 155) / 12.0
            return _lerp(0.65, 0.92, t), _lerp(0.22, 0.80, t)

        if phase == "FULL_RECOVERY":
            t = (minute - 168) / 11.0
            return _lerp(0.90, 0.38, t), _lerp(0.78, 0.05, t)

        return 0.35, 0.04

    def _network_values(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
        events: list[str],
    ) -> tuple[float, float]:
        """Return ``(bw_util_norm, pkt_loss_norm)``."""

        if phase in ("NORMAL_OPS", "TRAINING_RAMP_UP", "THERMAL_ESCALATION",
                     "THERMAL_EMERGENCY", "COOLING_RECOVERY", "STABLE_NORMAL"):
            return 0.2, 0.04

        if phase == "NETWORK_RAMP_UP":
            t = (minute - 110) / 11.0
            bw = _lerp(0.2, 0.75, t)
            pkt = _lerp(0.04, 0.25, t)
            if minute == 110:
                events.append("MODEL_CHECKPOINT_SYNC_START")
            if bw >= 0.5 and minute == 114:
                events.append("NETWORK_ELEVATED_ENTRY")
            return bw, pkt

        if phase == "NETWORK_ESCALATION":
            offset = minute - 122
            if offset < 4:
                # BURST
                t = offset / 3.0
                bw = _lerp(0.75, 0.88, t)
                pkt = _lerp(0.25, 0.60, t)
                if offset == 0:
                    events.append("NETWORK_BURST_ENTRY")
                    events.append("DC_NETWORK_THROTTLE_FF_SET")
            else:
                # CONGESTION → OVERFLOW
                t = (offset - 4) / (12.0)
                bw = _lerp(0.88, 0.97, t)
                pkt = _lerp(0.60, 0.85, t)
                if offset == 4:
                    events.append("NETWORK_CONGESTION_ENTRY")
            return bw, pkt

        if phase == "NETWORK_RECOVERY":
            t = (minute - 135) / 19.0
            return _lerp(0.97, 0.22, t), _lerp(0.85, 0.04, t)

        if phase == "COMBINED_EMERGENCY":
            # Network spikes back to overflow while thermal also peaks
            t = (minute - 155) / 12.0
            bw = _lerp(0.80, 0.97, t)
            pkt = _lerp(0.50, 0.85, t)
            if minute == 155:
                events.append("NETWORK_COMBINED_EMERGENCY_START")
                events.append("DC_CRITICAL_SYNTHESIZER_FIRED")
            return bw, pkt

        if phase == "FULL_RECOVERY":
            t = (minute - 168) / 11.0
            return _lerp(0.97, 0.22, t), _lerp(0.85, 0.04, t)

        return 0.2, 0.04

    def _cpu_base(self, minute: int, phase: str) -> float:
        """Return the base CPU utilisation fraction for all four cores."""
        _map: dict[str, float] = {
            "NORMAL_OPS":         0.30,
            "TRAINING_RAMP_UP":   0.60,
            "THERMAL_ESCALATION": 0.82,
            "THERMAL_EMERGENCY":  0.90,
            "COOLING_RECOVERY":   0.55,
            "STABLE_NORMAL":      0.32,
            "NETWORK_RAMP_UP":    0.45,
            "NETWORK_ESCALATION": 0.60,
            "NETWORK_RECOVERY":   0.40,
            "COMBINED_EMERGENCY": 0.88,
            "FULL_RECOVERY":      0.42,
        }
        return _map.get(phase, 0.35)

    def _power_values(
        self,
        minute: int,
        phase: str,
        temp: float,
        rng: random.Random,
    ) -> list[float]:
        """Return ``[total_pwr_norm, pdu_efficiency, ups_load, grid_freq_dev]``."""
        # Total power roughly tracks CPU + cooling overhead
        pwr_base = _clamp(temp * 0.8 + 0.15)
        pdu_eff = _clamp(0.95 - temp * 0.1)
        ups_load = _clamp(pwr_base * 0.85)
        # Grid frequency deviation is tiny under normal load, grows with surge
        freq_dev = _clamp(0.05 + temp * 0.15)
        return [
            _add_noise(pwr_base, rng, stddev=0.015),
            _add_noise(pdu_eff,  rng, stddev=0.010),
            _add_noise(ups_load, rng, stddev=0.015),
            _add_noise(freq_dev, rng, stddev=0.010),
        ]

    def _storage_values(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
    ) -> list[float]:
        """Return ``[iops_norm, disk_latency_norm, raid_health, cache_hit_rate]``."""
        _iops_map: dict[str, float] = {
            "NORMAL_OPS":         0.25,
            "TRAINING_RAMP_UP":   0.55,
            "THERMAL_ESCALATION": 0.70,
            "THERMAL_EMERGENCY":  0.78,
            "COOLING_RECOVERY":   0.50,
            "STABLE_NORMAL":      0.28,
            "NETWORK_RAMP_UP":    0.60,  # checkpoint writing
            "NETWORK_ESCALATION": 0.75,
            "NETWORK_RECOVERY":   0.45,
            "COMBINED_EMERGENCY": 0.80,
            "FULL_RECOVERY":      0.35,
        }
        iops = _iops_map.get(phase, 0.30)
        disk_lat = _clamp(0.1 + iops * 0.5)
        raid_health = _clamp(1.0 - iops * 0.08)
        cache_hit = _clamp(0.85 - iops * 0.30)
        return [
            _add_noise(iops,        rng, stddev=0.015),
            _add_noise(disk_lat,    rng, stddev=0.015),
            _add_noise(raid_health, rng, stddev=0.008),
            _add_noise(cache_hit,   rng, stddev=0.015),
        ]

    def _security_values(
        self,
        minute: int,
        phase: str,
        rng: random.Random,
        events: list[str],
    ) -> list[float]:
        """Return ``[auth_failures_norm, anomaly_score_norm, port_scan_norm, privilege_events_norm]``."""
        # Security is mostly calm; small random anomaly spike during network escalation
        auth   = 0.05
        anomaly = 0.08
        port   = 0.03
        priv   = 0.04

        if phase in ("NETWORK_ESCALATION", "COMBINED_EMERGENCY"):
            anomaly = 0.55
            port    = 0.45
            auth    = 0.30
            if minute in (122, 155):
                events.append("SECURITY_ANOMALY_DETECTED")

        return [
            _add_noise(auth,    rng, stddev=0.015),
            _add_noise(anomaly, rng, stddev=0.020),
            _add_noise(port,    rng, stddev=0.012),
            _add_noise(priv,    rng, stddev=0.012),
        ]

    # ------------------------------------------------------------------
    # AI sensor generators
    # ------------------------------------------------------------------

    def _ai_power(
        self,
        minute: int,
        phase: str,
        temp: float,
        rng: random.Random,
    ) -> list[float]:
        """Return AI power metrics correlated with thermal temp.

        Higher temperature → worse PUE, higher power draw, higher carbon
        intensity.
        """
        # PUE: 1.0 = perfect, degrades with temp.  Normalised: 0=best, 1=worst.
        pue = _clamp(temp * 0.70 + 0.10)
        # Power draw tracks load
        power_draw = _clamp(temp * 0.85 + 0.08)
        # Renewable deficit: rises when total power draw is high
        renewable_def = _clamp(power_draw * 0.60)
        # Carbon intensity: correlated with non-renewable fraction
        carbon = _clamp(renewable_def * 0.80 + 0.05)
        return [
            _add_noise(pue,           rng, stddev=0.015),
            _add_noise(power_draw,    rng, stddev=0.015),
            _add_noise(renewable_def, rng, stddev=0.015),
            _add_noise(carbon,        rng, stddev=0.010),
        ]

    def _ai_cooling(
        self,
        minute: int,
        phase: str,
        temp: float,
        rng: random.Random,
    ) -> list[float]:
        """Return AI cooling metrics correlated with DC thermal temp."""
        # Coolant temperature directly tracks CPU temperature
        coolant = _clamp(temp * 0.95 + 0.02)
        # Chiller inefficiency increases when coolant is hot
        chiller_ineff = _clamp(coolant * 0.70 + 0.05)
        # Flow restriction: increases during emergency (pumps struggling)
        flow_restr = _clamp(temp * 0.45 + 0.05)
        # Thermal imbalance: hot spots appear at high load
        imbalance = _clamp(temp * 0.60 + 0.06)
        return [
            _add_noise(coolant,       rng, stddev=0.015),
            _add_noise(chiller_ineff, rng, stddev=0.015),
            _add_noise(flow_restr,    rng, stddev=0.012),
            _add_noise(imbalance,     rng, stddev=0.012),
        ]

    def _ai_capacity(
        self,
        minute: int,
        phase: str,
        temp: float,
        bw: float,
        rng: random.Random,
        events: list[str],
    ) -> list[float]:
        """Return AI capacity metrics.

        - ``gpu_util_norm`` tracks CPU/thermal load.
        - ``queue_pressure_norm`` tracks CPU + network load.
        - ``mem_pressure_norm`` tracks thermal temp.
        - ``thermal_headroom_inv`` = 1 − cpu_temp_norm (inverse headroom).
        """
        gpu_util      = _clamp(temp * 0.90 + 0.08)
        queue_press   = _clamp((temp + bw) / 2.0 * 0.85 + 0.05)
        mem_press     = _clamp(temp * 0.75 + 0.10)
        thermal_inv   = _clamp(1.0 - temp)  # high temp → low headroom → high inv

        if gpu_util >= 0.5 and phase in ("THERMAL_ESCALATION", "COMBINED_EMERGENCY"):
            if minute in (45, 155):
                events.append("AI_CAPACITY_THROTTLE")

        return [
            _add_noise(gpu_util,    rng, stddev=0.015),
            _add_noise(queue_press, rng, stddev=0.015),
            _add_noise(mem_press,   rng, stddev=0.015),
            _add_noise(thermal_inv, rng, stddev=0.015),
        ]

    def _ai_security(
        self,
        anomaly_score: float,
        rng: random.Random,
    ) -> list[float]:
        """Return AI security metrics mirroring DC security anomaly score."""
        auth_anom    = _clamp(anomaly_score * 0.90 + 0.02)
        net_anom     = _clamp(anomaly_score * 0.95 + 0.01)
        priv_esc     = _clamp(anomaly_score * 0.75 + 0.02)
        threat_conf  = _clamp(anomaly_score * 0.85 + 0.03)
        return [
            _add_noise(auth_anom,   rng, stddev=0.012),
            _add_noise(net_anom,    rng, stddev=0.012),
            _add_noise(priv_esc,    rng, stddev=0.010),
            _add_noise(threat_conf, rng, stddev=0.012),
        ]

    def _ai_wellness(
        self,
        minute: int,
        phase: str,
        bw: float,
        rng: random.Random,
        events: list[str],
    ) -> list[float]:
        """Return AI model wellness metrics.

        - ``latency_slo_violation_norm`` correlates with network bw utilisation.
        - Other metrics degrade gently during high-load phases.
        """
        # Inference errors spike when the system is overloaded
        load_factor = bw
        infer_err   = _clamp(load_factor * 0.55 + 0.04)
        # Latency SLO violations track network bandwidth
        latency_slo = _clamp(bw * 0.80 + 0.05)
        # Accuracy drift accumulates slowly over the session
        acc_drift   = _clamp(minute / 360.0 + load_factor * 0.10)
        # Memory leak grows slowly
        mem_leak    = _clamp(minute / 540.0 + 0.02)

        if latency_slo >= 0.5 and phase == "NETWORK_ESCALATION" and minute == 122:
            events.append("AI_WELLNESS_LATENCY_SLO_BREACH")

        return [
            _add_noise(infer_err,   rng, stddev=0.015),
            _add_noise(latency_slo, rng, stddev=0.015),
            _add_noise(acc_drift,   rng, stddev=0.010),
            _add_noise(mem_leak,    rng, stddev=0.008),
        ]

    def _ai_resilience(
        self,
        minute: int,
        rng: random.Random,
    ) -> list[float]:
        """Return AI hardware resilience metrics.

        ``hw_fault_accum_norm`` increases gradually across the 3-hour window,
        representing the natural accumulation of transient hardware faults
        under sustained high load.
        """
        # Disk SMART failure probability: very low, slight upward drift
        disk_smart = _clamp(0.02 + minute / 3600.0)
        # Memory ECC errors: low but slowly increasing
        mem_ecc    = _clamp(0.03 + minute / 2700.0)
        # Packet loss on storage fabric: low baseline
        pkt_loss   = _clamp(0.04 + minute / 4500.0)
        # Cumulative hardware fault accumulation: gradual linear growth
        hw_fault   = _clamp(minute / 180.0 * 0.45 + 0.02)

        return [
            _add_noise(disk_smart, rng, stddev=0.008),
            _add_noise(mem_ecc,    rng, stddev=0.008),
            _add_noise(pkt_loss,   rng, stddev=0.010),
            _add_noise(hw_fault,   rng, stddev=0.012),
        ]


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

def generate_workload() -> list[dict[str, Any]]:
    """Convenience wrapper — create a generator and return the full workload."""
    return DCWorkloadGenerator().generate()


if __name__ == "__main__":
    import json

    workload = generate_workload()
    gen = DCWorkloadGenerator()

    print("=== Phase summary ===")
    for p in gen.phase_summary():
        print(
            f"  [{p['start']:3d}-{p['end']:3d}]  {p['label']:<25s}  "
            f"({p['duration_minutes']} min)  {p['description']}"
        )

    print(f"\nTotal steps generated: {len(workload)}")

    # Print first and last step as a sanity check
    for label, step in [("First step", workload[0]), ("Last step", workload[-1])]:
        print(f"\n=== {label} (minute {step['minute']}) ===")
        print(json.dumps(step, indent=2))
