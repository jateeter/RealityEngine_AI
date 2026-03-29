# DC + AI Monitoring Guide

This guide explains the data-centre and AI workload monitoring pipeline built on top of the Reality Engine (CES machines) and Perception Engine (sensor sources).  It covers the architecture, perceptual-space layout, CES machine descriptions, the simulated workload, and how to run the demo and tests.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Perceptual Space Layout](#2-perceptual-space-layout)
3. [Sensor Sources](#3-sensor-sources)
4. [CES Machine Descriptions](#4-ces-machine-descriptions)
5. [Escalation Mechanics](#5-escalation-mechanics)
6. [3-Hour Workload Simulation](#6-3-hour-workload-simulation)
7. [Running the Demo](#7-running-the-demo)
8. [System Initialization](#8-system-initialization)
9. [End-to-End Tests](#9-end-to-end-tests)
10. [Extending the System](#10-extending-the-system)

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│  External Sensors / DCWorkloadGenerator                        │
│  (13 sensor streams, each 4 floats normalized to [0.0, 1.0])   │
└────────────────────┬───────────────────────────────────────────┘
                     │  POST /api/sensors/{sensor_id}
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Perception Engine  (port 3004)                                 │
│  • Assembles 256-cell perceptual vector from all sources       │
│  • POST /api/push → forwards assembled vector to Reality Engine│
└────────────────────┬───────────────────────────────────────────┘
                     │  POST /api/perceive  { vector: [...] }
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  Reality Engine  (port 3000)                                    │
│  • Runs 14 CES machines in parallel against the perceptual vec │
│  • Machines output to control signal regions of the same vec   │
│  • Downstream machines read those control signals as inputs    │
└────────────────────────────────────────────────────────────────┘
```

The LangGraph `DCMonitoringState` graph (`src/dc_graph.py`) orchestrates this
pipeline for 180 simulation steps (one per minute = 3 hours):

```
initialize ──► process_step ──►(loop)
                    │
                    └──►(done)──► finalize ──► END
```

- **initialize**: loads 14 CES machines into the Reality Engine; registers 13
  sensor sources with the Perception Engine (idempotent).
- **process_step**: pushes all 13 sensor vectors for the current minute; calls
  `/api/push`; records which machines fired an output.
- **finalize**: builds an operational report; optionally removes loaded machines.

---

## 2. Perceptual Space Layout

The 256-cell perceptual vector is divided into regions.  Sensors write to input
regions; machines write their outputs to control signal regions, which feed into
downstream machines.

```
Cells       Region                    Role
──────────  ────────────────────────  ────────────────────────────────────────
[0:12]      Legacy / other            MultiStep, RSFlipFlop, KleeneStar inputs
[12:16]     dc-thermal sensor         cpu_temp, cpu_load, throttle, efficiency
[16:20]     dc-memory sensor          mem_usage, page_fault, cache_miss, swap
[20:24]     dc-network sensor         bw_util, pkt_loss, latency, queue_depth
[24:28]     dc-cpu sensor             core0, core1, core2, core3 utilisation
[28:32]     dc-power sensor           total_pwr, pdu_eff, ups_load, freq_dev
[32:36]     dc-storage sensor         iops, disk_latency, raid_health, cache_hit
[36:40]     dc-security sensor        auth_fail, anomaly, port_scan, priv_events
[60:62]     DCThermalEscalation out   [1,0]=THERMAL_ALARM  [0,1]=THERMAL_SAFE
[64:66]     DCNetworkBurstDetector    [1,0]=NETWORK_ALARM  [0,1]=NETWORK_NORMAL
[66:68]     DCMemoryPressure out      [1,0]=MEMORY_ALARM   [0,1]=MEMORY_SAFE
[72:74]     DCCriticalSynthesizer     [1,0]=COMBINED_ALERT [0,1]=COMBINED_CLEAR
[100:102]   DCCoolingControlFF out    RS FF state — COOL CONTROL active/inactive
[102:104]   DCNetworkThrottleFF out   RS FF state — THROTTLE active/inactive
[104:106]   DCMemoryAlertFF out       RS FF state — MEMORY ALERT active/inactive
[108:110]   DCCriticalAlertFF out     RS FF state — CRITICAL ALERT active/inactive
[120:124]   ai-power sensor           pue, power_draw, renewable_def, carbon
[124:128]   ai-cooling sensor         coolant_temp, chiller_ineff, flow_restr, imbalance
[128:132]   ai-capacity sensor        gpu_util, queue_press, mem_press, thermal_inv
[132:136]   ai-security sensor        auth_anom, net_anom, priv_esc, threat_conf
[136:140]   ai-wellness sensor        infer_err, latency_slo, acc_drift, mem_leak
[140:144]   ai-resilience sensor      disk_smart, mem_ecc, pkt_loss, hw_fault
[150:156]   AIPowerEfficiency out     6-cell output vector
[156:162]   AICoolingRegulator out    6-cell output vector
[162:168]   AICapacityThrottler out   6-cell output vector
[168:174]   AISecurityMonitor out     6-cell output vector
[174:180]   AIModelWellness out       6-cell output vector
[180:186]   AIHardwareResilience out  6-cell output vector
[200:238]   regex input region        Character one-hot encoding (38 cells)
[238:246]   regex output region       Per-pattern match flags
```

---

## 3. Sensor Sources

All sensor sources are defined in `src/dc_sensors.py` and documented in
`examples/dc_sources.json`.  Call `ensure_sources(pe_url)` to register them
idempotently at startup.

| sensor_id      | Region    | Key Dimensions                         |
|----------------|-----------|----------------------------------------|
| dc-thermal     | [12:16]   | cpu_temp_norm, cpu_load_norm           |
| dc-memory      | [16:20]   | mem_usage_norm, swap_usage_norm        |
| dc-network     | [20:24]   | bw_util_norm, pkt_loss_norm            |
| dc-cpu         | [24:28]   | core0..core3 utilisation               |
| dc-power       | [28:32]   | total_pwr_norm, pdu_efficiency         |
| dc-storage     | [32:36]   | iops_norm, disk_latency_norm           |
| dc-security    | [36:40]   | auth_failures_norm, anomaly_score_norm |
| ai-power       | [120:124] | pue_norm, power_draw_norm              |
| ai-cooling     | [124:128] | coolant_temp_norm, chiller_ineff_norm  |
| ai-capacity    | [128:132] | gpu_util_norm, queue_pressure_norm     |
| ai-security    | [132:136] | auth_anomaly_norm, net_anomaly_norm    |
| ai-wellness    | [136:140] | inference_error_rate_norm, latency_slo |
| ai-resilience  | [140:144] | disk_smart_fail_norm, hw_fault_accum   |

All values are normalised to **[0.0, 1.0]**.  Dimensions not used by any CES
machine (called "wildcards") are set to **0.5** so they satisfy the GTE HIGH
check in all vectors.

---

## 4. CES Machine Descriptions

### DC Infrastructure Machines (8)

#### DCThermalEscalation  `[12:16] → [60:62]`
Monitors CPU temperature and load.  Implements a 5-stage escalation:

```
NORMAL+ → WARM+ → HOT → CRITICAL+ → EMERGENCY → output[1,0]
SAFE+                             → output[0,1]   (concurrent reset)
```

Stage thresholds (cpu_temp_norm):

| Stage     | Range         | What it means               |
|-----------|---------------|-----------------------------|
| NORMAL    | [0.15, 0.45]  | 20–56 °C — healthy          |
| WARM      | [0.43, 0.67]  | 54–73 °C — elevated         |
| HOT       | [0.67, 0.83]  | 73–83 °C — high             |
| CRITICAL  | [0.81, 0.95]  | 81–95 °C — critical         |
| EMERGENCY | [0.93, 1.00]  | >93 °C — thermal shutdown   |

Output: `[1,0]` fires THERMAL_ALARM → sets **DCCoolingControlFF**.
        `[0,1]` fires THERMAL_SAFE → resets **DCCoolingControlFF**.

#### DCNetworkBurstDetector  `[20:24] → [64:66]`
Monitors bandwidth utilisation and packet loss.  5-stage escalation:

```
BASELINE+ → ELEVATED+ → BURST → CONGESTION+ → OVERFLOW → output[1,0]
NORMAL_FLOW+                                 → output[0,1]
```

Stage thresholds (bw_util_norm):

| Stage       | Range         |
|-------------|---------------|
| BASELINE    | [0.05, 0.35]  |
| ELEVATED    | [0.43, 0.67]  |
| BURST       | [0.67, 0.83]  |
| CONGESTION  | [0.82, 0.94]  |
| OVERFLOW    | [0.93, 1.00]  |

Output: `[1,0]` fires NETWORK_ALARM → sets **DCNetworkThrottleFF**.
        `[0,1]` fires NETWORK_NORMAL → resets **DCNetworkThrottleFF**.

#### DCMemoryPressure  `[16:20] → [66:68]`
Monitors memory utilisation and swap usage.  Same 5-stage escalation pattern
as DCThermalEscalation.  Outputs to [66:68] → feeds **DCMemoryAlertFF**.

#### DCCoolingControlFF  `[60:62] → [100:102]`
RS-style flip-flop.  SET when DCThermalEscalation fires alarm; RESET when
THERMAL_SAFE fires.  Output at [100:102] indicates whether emergency cooling
is active.

#### DCNetworkThrottleFF  `[64:66] → [102:104]`
RS flip-flop for network throttling.  SET by DCNetworkBurstDetector OVERFLOW;
RESET by NETWORK_NORMAL.

#### DCMemoryAlertFF  `[66:68] → [104:106]`
RS flip-flop for memory alerting.  SET by DCMemoryPressure alarm; RESET by
memory SAFE signal.

#### DCCriticalSynthesizer  `[100:104] → [72:74]`
4D correlator that reads the FF state outputs at [100:104] (thermal FF + network
FF).  Fires `[1,0]` COMBINED_ALERT when **both** thermal AND network flip-flops
are simultaneously SET — indicating a compounded emergency.

#### DCCriticalAlertFF  `[72:74] → [108:110]`
Top-level RS flip-flop.  SET by DCCriticalSynthesizer COMBINED_ALERT.
When active, [108:110] signals that the DC is in a combined critical state
requiring immediate human intervention.

### AI Workload Machines (6)

Each AI machine has a 4D input region and 6D output region, with two sequences:
a 4-step general escalation and a 2-step targeted alert.

| Machine             | Input     | Output    | Monitors                           |
|---------------------|-----------|-----------|------------------------------------|
| AIPowerEfficiency   | [120:124] | [150:156] | PUE, power draw, renewable deficit |
| AICoolingRegulator  | [124:128] | [156:162] | Coolant temp, chiller, flow        |
| AICapacityThrottler | [128:132] | [162:168] | GPU utilisation, queue, headroom   |
| AISecurityMonitor   | [132:136] | [168:174] | Auth anomaly, network anomaly      |
| AIModelWellness     | [136:140] | [174:180] | Inference errors, latency SLO      |
| AIHardwareResilience| [140:144] | [180:186] | Disk SMART, ECC errors, hw faults  |

AI machine outputs are written back into the perceptual space at [150:186], where
they can feed into higher-level synthesis machines or be observed by operators.

---

## 5. Escalation Mechanics

### CES Vector Matching (GTE)

All DC/AI machines use `matchAlgorithm: "gte"`.  For an element with
`value` and `threshold`:

- If `element.value >= element.threshold (0.5)` → **HIGH** element:
  the input must be ≥ 0.5 to satisfy this element.
- If `element.value < element.threshold (0.5)` → **LOW** element:
  the input must be < 0.5 to satisfy this element.

**Wildcard dimensions** use `value=0.5, threshold=0.5` — they are HIGH
elements that always match when the sensor sends 0.5.

### A*A = A+ Rule

All `isInitial=true` vectors implement the **A+** (one or more) semantics:

- The `isInitial` property provides the persistent self-loop (A*).
- But at least **one actual match** is required before `nextVectorIds` are
  activated.
- This means a zero-input stream never advances the escalation — sensors
  must produce at least one matching reading before the pipeline arms.

### Escalation Progression

For DCThermalEscalation with 1 LOW step followed by HIGH steps:

```
Step 0 (LOW)  : NORMAL fires → WARM added to pending
Step 1 (HIGH) : WARM fires → {WARM, HOT} pending
Step 2 (HIGH) : WARM + HOT fire → {WARM, HOT, CRITICAL} pending
Step 3 (HIGH) : WARM + HOT + CRITICAL fire → {WARM, HOT, CRITICAL, EMERGENCY} pending
Step 4 (HIGH) : all fire → EMERGENCY produces output [1,0]
```

The same pattern applies to DCNetworkBurstDetector (BASELINE/ELEVATED/BURST/
CONGESTION/OVERFLOW) and DCMemoryPressure.

### Why Abrupt Spikes Don't Trigger Alarms

An abrupt jump from NORMAL to HOT temperature skips the WARM+ requirement.
Because WARM is a **non-initial** vector that can only become active after
NORMAL fires and adds it to the pending set, HOT can only fire after WARM
has already fired.  A direct NORMAL→HOT jump therefore cannot trigger the
alarm — it will be silently ignored.  This is the designed behaviour: the
system requires observable, gradual escalation to distinguish real events
from transient sensor spikes.

---

## 6. 3-Hour Workload Simulation

`src/dc_workload.py` contains `DCWorkloadGenerator` which produces 180
reproducible (seed=42) simulation steps across 11 operational phases.

### Phase Schedule

```
Phase                  Duration  T+Start  T+End  What Happens
─────────────────────  ────────  ───────  ─────  ─────────────────────────────
NORMAL_OPS               30 min     0     030    Steady-state baseline
TRAINING_RAMP_UP         15 min    30     045    Large AI training job launched
THERMAL_ESCALATION       12 min    45     057    CPU temps: NORMAL→WARM→HOT→CRITICAL
THERMAL_EMERGENCY         6 min    57     063    CPU temp EMERGENCY; CoolingFF SET
COOLING_RECOVERY         17 min    63     080    Emergency cooling; temps declining
STABLE_NORMAL            30 min    80     110    Normal operations resumed
NETWORK_RAMP_UP          12 min   110     122    Model checkpoint sync; BW rising
NETWORK_ESCALATION       13 min   122     135    BURST→CONGESTION; NetworkThrottleFF SET
NETWORK_RECOVERY         20 min   135     155    Traffic throttled; BW recovering
COMBINED_EMERGENCY       13 min   155     168    Thermal+Network both critical
FULL_RECOVERY            12 min   168     180    All systems recovering to nominal
```

### Notable Events Timeline

| Time  | Event                         | Description                              |
|-------|-------------------------------|------------------------------------------|
| T+030 | TRAINING_JOB_LAUNCHED         | AI training job started; load rising     |
| T+045 | THERMAL_WARM_ENTRY            | CPU temp enters WARM band                |
| T+049 | THERMAL_HOT_ENTRY             | CPU temp enters HOT band                 |
| T+053 | THERMAL_CRITICAL_ENTRY        | CPU temp enters CRITICAL band            |
| T+053 | MEMORY_THRASHING_ENTRY        | Memory thrashing begins                  |
| T+057 | THERMAL_EMERGENCY_ENTRY       | CPU temp enters EMERGENCY band           |
| T+057 | DC_COOLING_FF_SET             | DCCoolingControlFF SET by alarm          |
| T+063 | COOLING_ACTIVATED             | Emergency cooling engaged                |
| T+110 | MODEL_CHECKPOINT_SYNC_START   | Checkpoint sync begins; BW rising        |
| T+114 | NETWORK_ELEVATED_ENTRY        | BW enters ELEVATED band                  |
| T+122 | NETWORK_BURST_ENTRY           | BW enters BURST band                     |
| T+122 | DC_NETWORK_THROTTLE_FF_SET    | DCNetworkThrottleFF SET by alarm         |
| T+155 | THERMAL_COMBINED_EMERGENCY_START | Thermal re-escalates during net crisis |
| T+155 | NETWORK_COMBINED_EMERGENCY_START | Network stays critical                 |
| T+155 | DC_CRITICAL_SYNTHESIZER_FIRED | Both FFs set → combined alert            |

### Sensor Correlations

- `ai-cooling.coolant_temp_norm` ≈ `dc-thermal.cpu_temp_norm × 0.95`
- `ai-capacity.thermal_headroom_inv` = `1 - dc-thermal.cpu_temp_norm`
- `ai-wellness.latency_slo_violation_norm` tracks `dc-network.bw_util_norm`
- `ai-resilience.hw_fault_accum_norm` grows linearly across the 3-hour session
- `ai-security.*` mirrors `dc-security.anomaly_score_norm`

---

## 7. Running the Demo

### Prerequisites

```bash
cd langgraph-orchestrator
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ensure the Reality Engine (port 3000) and Perception Engine (port 3004) are
running.

### Phase Plan Demo (no services required)

```bash
python examples/dc_monitoring_demo.py
```

Prints the 11-phase schedule, sample sensor readings per phase, and the
notable event timeline.

### Full 3-Hour Simulation

```bash
python examples/dc_monitoring_demo.py --live
```

Runs all 180 steps and prints an operational report on completion.

### Quick Test (first 30 minutes)

```bash
python examples/dc_monitoring_demo.py --live --steps 30
```

### Verbose Mode

```bash
python examples/dc_monitoring_demo.py --live --verbose
```

Prints each step's fired machines and workload events in real-time.

### Custom Service URLs

```bash
PERCEPTION_URL=https://localhost:3004 \
REALITY_URL=https://localhost:3000 \
    python examples/dc_monitoring_demo.py --live
```

---

## 8. System Initialization

`examples/dc_init.py` pre-loads all machines and sensor sources at startup.
It is designed to be called from a `start.sh` script or any initialization hook.

```bash
python examples/dc_init.py
```

Output:

```
============================================================
DC + AI MONITORING — SYSTEM INITIALISATION
============================================================
  Perception Engine : http://localhost:3004
  Reality Engine    : http://localhost:3000
  Machines dir      : /path/to/examples/machines

── Registering sensor sources ──────────────────────────────────
  ✓ dc-thermal             (uuid=a1b2c3d4…)
  ✓ dc-memory              (uuid=e5f6a7b8…)
  … (13 sources total)

── Loading CES machines ─────────────────────────────────────────
  ✓ DCThermalEscalation    (id=f0e1d2c3…)
  ✓ DCNetworkBurstDetector (id=11223344…)
  … (14 machines total)

Initialisation complete:
  13 sensor sources registered
  14 CES machines loaded

System ready. Run the monitoring demo with:
  python examples/dc_monitoring_demo.py --live
```

From Python:

```python
from examples.dc_init import initialize_dc_system

result = initialize_dc_system(
    perception_url='http://localhost:3004',
    reality_url='http://localhost:3000',
)
print(result['machines'])      # {stem: machine_id}
print(result['source_uuids'])  # {sensor_id: uuid}
```

### Integrating with start.sh

Add the following line to your startup script:

```bash
cd langgraph-orchestrator && python examples/dc_init.py
```

The script is fully idempotent: sensor sources are re-used if already registered;
machines are re-loaded (producing fresh IDs) so a restart always gives a clean
state.

---

## 9. End-to-End Tests

Run with services running:

```bash
cd langgraph-orchestrator
pytest tests/test_dc_e2e.py -v
```

Auto-skip when services are unavailable (no configuration needed):

```bash
pytest tests/ -v     # runs all e2e tests; skips DC tests if services are down
```

### Test Suite Overview

#### TestDCSensorInitialization
Validates Perception Engine sensor source management.

| Test Method                            | What It Verifies                           |
|----------------------------------------|--------------------------------------------|
| `test_all_dc_sensors_registered`       | All 13 DC/AI sources appear in /api/sources|
| `test_sensor_region_boundaries_correct`| Each source maps to the correct region     |
| `test_source_registration_is_idempotent` | Calling ensure_sources() twice is safe   |

#### TestDCThermalEscalationPipeline
Validates the DCThermalEscalation CES machine.

| Test Method                                 | What It Verifies                           |
|---------------------------------------------|--------------------------------------------|
| `test_thermal_machine_loads_into_reality_engine` | Machine appears in RE /api/machines   |
| `test_thermal_escalation_fires_emergency_alarm` | [1,0] fires at step 8-9 of escalation |
| `test_thermal_safe_recovery_fires_at_nominal_conditions` | [0,1] fires at NORMAL steps |
| `test_abrupt_spike_does_not_trigger_alarm`  | NORMAL→HOT jump is safely ignored          |

#### TestDCNetworkBurstDetectorPipeline
Validates the DCNetworkBurstDetector CES machine.

| Test Method                                    | What It Verifies                         |
|------------------------------------------------|------------------------------------------|
| `test_network_machine_loads_into_reality_engine` | Machine in RE /api/machines            |
| `test_network_overflow_fires_alarm`            | [1,0] fires at OVERFLOW step 8-9         |
| `test_normal_flow_reset_fires_at_baseline`     | [0,1] fires at BASELINE steps            |
| `test_push_response_contains_machine_result_structure` | PE push response schema          |

#### TestDCMonitoringIntegration
Full LangGraph pipeline validation (30 steps, NORMAL_OPS phase).

| Test Method                                        | What It Verifies                     |
|----------------------------------------------------|--------------------------------------|
| `test_simulation_completes_without_error`          | No error field in result             |
| `test_step_results_count_matches_requested`        | Exactly 30 step_results              |
| `test_each_step_result_has_required_fields`        | All required keys present            |
| `test_normal_ops_phase_produces_no_emergency_alarm_firings` | No false alarms at baseline |
| `test_report_contains_simulation_summary`          | Report and summary are coherent      |

---

## 10. Extending the System

### Adding a New Sensor

1. Add an entry to `SENSOR_SOURCES` in `src/dc_sensors.py`.
2. Choose an unused perceptual region (check the layout in §2 above).
3. Document the normalization scheme.
4. Run `ensure_sources()` — new sensors are registered on the next startup.

### Adding a New CES Machine

1. Create `examples/machines/MyNewMachine.json` following the CES schema:
   ```json
   {
     "version": "1.0.0",
     "machine": {
       "name": "My New Machine",
       "arbiterRule": "PASSTHROUGH",
       "matchAlgorithm": "gte",
       "perceptualMapping": {
         "input":  { "offset": 40, "length": 4 },
         "output": { "offset": 70, "length": 2 }
       },
       "sequences": [ ... ]
     }
   }
   ```
2. Re-run `python examples/dc_init.py` — the file is automatically picked up
   because it matches `DC*.json` or `AI*.json`.
3. Add a sensor source for the input region if one does not exist.

### Running a Custom Workload

```python
from src.dc_graph import run_dc_monitoring

result = run_dc_monitoring(
    perception_url='http://localhost:3004',
    reality_url='http://localhost:3000',
    num_steps=60,          # first 60 minutes only
    verbose=True,          # print events in real-time
    cleanup=False,         # keep machines loaded after the run
)
print(result['report'])
```

### Integrating Real Sensors

Replace `DCWorkloadGenerator` with live sensor feeds:

1. Keep the `ensure_sources()` call in `dc_init.py`.
2. In your data pipeline, call `push_sensor_values(pe_url, sensor_id, values)`
   for each sensor at whatever cadence your system supports.
3. Call `POST http://localhost:3004/api/push` to trigger a Reality Engine step.
4. Parse the response's `step.machineResults` for alarm signals.

The Perception Engine's TTL mechanism (`ttl_ms=120_000`) ensures stale sensor
data expires after 2 minutes, preventing false detections from frozen readings.
