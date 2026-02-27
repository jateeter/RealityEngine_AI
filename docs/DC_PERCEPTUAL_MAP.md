# Data Center Monitoring — Global Perceptual Space Map

## Overview

The Reality Engine global perceptual space is a 256-byte shared memory region. All machines read their inputs from and write their outputs to specific regions of this space. This document maps the semantic meaning of each byte region for the Data Center Monitoring ecosystem.

The three-phase step protocol ensures input atomicity:
1. **Snapshot** — all machine inputs are captured from the current perceptual space
2. **Process** — all machines compute their outputs in parallel
3. **Merge** — all machine outputs are written to the perceptual space

This means a machine's output becomes visible to downstream machines on the **next step**, creating a natural pipeline delay through the interconnection graph.

---

## Byte Layout

```
Offset  Length  Region                    Description
──────  ──────  ──────────────────────────────────────────────────────────────
  0       3     Legacy: MultiStep Input   3D binary input for MultiStep machine
  3       2     Legacy: Shared I/O        MultiStep output / RSFlipFlop+RS2 input
  6       2     Legacy: RSFlipFlop Out    RSFlipFlop output / KleeneStar input
  8       2     Legacy: RS2 Output        RS2 flip-flop output
 10       2     Legacy: KleeneStar Out    KleeneStar machine output
 12       4     CPU Sensors               [cpu_temp, cpu_load, cpu_throttle, cpu_efficiency]
 16       4     Memory Sensors            [mem_usage, mem_fault_rate, mem_cache_miss, swap_usage]
 20       4     Network Sensors           [bandwidth_util, packet_loss, latency, queue_depth]
 24       4     Power Sensors             [power_draw, power_efficiency, psu_health, cooling_power]
 28       4     Storage Sensors           [disk_io, disk_usage, disk_error_rate, disk_temp]
 32       4     Thermal Sensors           [inlet_temp, exhaust_temp, rack_delta, ambient_temp]
 36       4     Security Sensors          [anomaly_score, auth_failure_rate, scan_rate, integrity]
 40      20     Reserved Sensor Space     Future sensor channels
 60       2     Thermal Control Signal    DCThermalEscalation → DCCoolingControlFF
 62       2     Reserved Control          Future thermal/power control
 64       2     Network Control Signal    DCNetworkBurstDetector → DCNetworkThrottleFF
 66       2     Memory Control Signal     DCMemoryPressure → DCMemoryAlertFF
 68       4     Reserved Control          Future control signals
 72       2     Critical Alert Signal     DCCriticalSynthesizer → DCCriticalAlertFF
 74       6     Reserved Control          Future synthesizer outputs
 80      20     Reserved Control Space    Future control channels
100       2     CoolingControlFF State    [Q, Q̄] — Cooling alarm active when Q=1
102       2     NetworkThrottleFF State   [Q, Q̄] — Network throttle active when Q=1
104       2     MemoryAlertFF State       [Q, Q̄] — Memory alert active when Q=1
106       2     Reserved FF State         Future flip-flop
108       2     CriticalAlertFF State     [Q, Q̄] — Critical alert active when Q=1
110      10     Reserved FF States        Future flip-flop states
120     136     Reserved                  Future expansion
```

---

## Sensor Normalization

All sensor values are normalized to the range **[0.0, 1.0]**:

| Sensor         | 0.0            | 0.5          | 1.0           |
|----------------|----------------|--------------|---------------|
| cpu_temp       | 20°C (cold)    | 60°C (warm)  | 100°C (max)   |
| cpu_load       | 0% (idle)      | 50%          | 100% (max)    |
| cpu_throttle   | 0% (no throttle)| 50%         | 100% (halted) |
| cpu_efficiency | 1.0 (efficient)| 0.5          | 0.0 (bad)     |
| mem_usage      | 0% (empty)     | 50%          | 100% (full)   |
| mem_fault_rate | 0 faults/s     | moderate     | storm         |
| mem_cache_miss | 0% misses      | 50%          | 100%          |
| swap_usage     | 0% (no swap)   | 50%          | 100% (full)   |
| bandwidth_util | 0% (idle)      | 50%          | 100% (maxed)  |
| packet_loss    | 0% (none)      | 5%           | 10%+ (severe) |
| latency        | 0ms            | 50ms         | 100ms+        |
| queue_depth    | 0 (empty)      | moderate     | full          |

---

## Control Signal Encoding

Control signals between detectors and flip-flops use 2-byte RS encoding:

| Bytes  | Meaning                         |
|--------|---------------------------------|
| [1, 0] | ALARM / SET — condition active  |
| [0, 1] | SAFE / RESET — condition clear  |
| [0, 0] | HOLD — no change                |

---

## Flip-Flop State Encoding

Flip-flop outputs use 2-byte Q/Q̄ encoding:

| Bytes     | Q State | Meaning                    |
|-----------|---------|----------------------------|
| [1, 0]    | Q=1     | ACTIVE — alarm/action on   |
| [0, 1]    | Q=0     | INACTIVE — alarm/action off |

---

## Machine Interconnection Graph

```
SENSOR INPUTS [12:40]
     │
     ├──[12:16]──► DCThermalEscalation ──────►[60:62]──► DCCoolingControlFF ──►[100:102]──┐
     │                                                                                       │
     ├──[16:20]──► DCMemoryPressure ──────────►[66:68]──► DCMemoryAlertFF ─────►[104:106]──┤
     │                                                                                       │
     └──[20:24]──► DCNetworkBurstDetector ────►[64:66]──► DCNetworkThrottleFF ──►[102:104]──┤
                                                                                             │
                                               [100:104] (Cooling+Network FFs)              │
                                                    │                                        │
                                                    ▼                                        │
                                          DCCriticalSynthesizer                             │
                                                    │                                        │
                                               [72:74]                                      │
                                                    │                                        │
                                                    ▼                                        │
                                          DCCriticalAlertFF ─────────────────►[108:110]────┘
                                                                              (Critical State)
```

### Interconnection Delay Model

Due to the snapshot-process-merge protocol, each graph edge introduces a **1-step delay**:

| Event                          | Step Delay | Description                          |
|--------------------------------|-----------|--------------------------------------|
| Sensor → Detector              | 0 steps   | Detector reads current sensor values |
| Detector → Flip-Flop input     | 1 step    | Control signal written this step     |
| Flip-Flop → FF output state    | 1 step    | FF reads control signal next step    |
| FF state → CriticalSynthesizer | 1 step    | Synthesizer reads FF states          |
| Synthesizer → Alert FF         | 1 step    | Alert signal written this step       |

**Total latency from sensor anomaly to CriticalAlertFF output: 3–4 steps**

---

## isInitial Vector Semantics: A*A = A+

In a Critical Event Sequence, `isInitial` vectors have a special property: they never deactivate (the self-loop, `A*`). However, they only activate their `nextVectorIds` **when they match** — not unconditionally. This means:

> Any `isInitial` vector with `nextVectorIds` is **A+ (= A\*A)**, not **A\***.
>
> — At least one match of A is required before successors are activated.
> — `A*` would imply zero occurrences suffice, which is impossible: there is no mechanism to arm successors without a match.

This applies uniformly to all isInitial states with successors:
- `NORMAL*` → wrong; `NORMAL+` → correct
- `SAFE*` → wrong; `SAFE+` → correct
- `(001)*` (trigger in KleeneStar) → wrong; `(001)+` → correct

**Notation used in this document:** `(X)+` = one-or-more X, `(X)*` = zero-or-more X, `(A|B)` = alternation, adjacency = concatenation.

---

## Detector Machine Patterns (Regular Expressions)

### DCThermalEscalation
```
NORMAL+ → WARM+ → HOT → CRITICAL+ → EMERGENCY → [alarm=1,0]
SAFE+                                           → [alarm=0,1]
```
> **A\*A = A+ rule:** NORMAL and SAFE are isInitial. At least one matching NORMAL reading is required to arm WARM. At least one matching SAFE reading is required to produce the reset output. `NORMAL*` would incorrectly imply WARM could be armed without any sensor match.

| Stage    | cpu_temp range | cpu_load range |
|----------|----------------|----------------|
| NORMAL   | 0.15 – 0.45    | 0.17 – 0.53    |
| WARM     | 0.43 – 0.67    | 0.52 – 0.78    |
| HOT      | 0.67 – 0.83    | 0.75 – 0.91    |
| CRITICAL | 0.81 – 0.95    | 0.87 – 0.97    |
| EMERGENCY| 0.93 – 1.00    | 0.95 – 1.00    |

### DCNetworkBurstDetector
```
BASELINE+ → ELEVATED+ → BURST → CONGESTION+ → OVERFLOW → [alarm=1,0]
NORMAL_FLOW+                                             → [alarm=0,1]
```
> **A\*A = A+ rule:** BASELINE and NORMAL_FLOW are isInitial. At least one BASELINE reading is required to arm ELEVATED.

| Stage      | bandwidth range | packet_loss range |
|------------|-----------------|-------------------|
| BASELINE   | 0.05 – 0.35     | 0.00 – 0.10       |
| ELEVATED   | 0.43 – 0.67     | 0.05 – 0.25       |
| BURST      | 0.67 – 0.83     | 0.18 – 0.42       |
| CONGESTION | 0.82 – 0.94     | 0.45 – 0.65       |
| OVERFLOW   | 0.93 – 1.00     | 0.75 – 0.95       |

### DCMemoryPressure
```
NORMAL+ → PRESSURE+ → THRASHING → CASCADING+ → FAILURE → [alarm=1,0]
HEALTHY+                                                 → [alarm=0,1]
```
> **A\*A = A+ rule:** NORMAL and HEALTHY are isInitial. At least one NORMAL reading is required to arm PRESSURE.

| Stage     | mem_usage range | swap_usage range |
|-----------|-----------------|------------------|
| NORMAL    | 0.15 – 0.55     | 0.00 – 0.10      |
| PRESSURE  | 0.53 – 0.77     | 0.10 – 0.40      |
| THRASHING | 0.72 – 0.88     | 0.43 – 0.67      |
| CASCADING | 0.84 – 0.96     | 0.70 – 0.90      |
| FAILURE   | 0.93 – 1.00     | 0.93 – 1.00      |

---

## CriticalSynthesizer Patterns

The DCCriticalSynthesizer reads 4 bytes [100:104] representing the combined state of CoolingControlFF and NetworkThrottleFF:

| Input Pattern | Meaning                            | Output  |
|---------------|------------------------------------|---------|
| [1, 0, 1, 0]  | Thermal AND Network alarms active  | [1, 0] SET   |
| [0, 1, 0, 1]  | Both alarms cleared                | [0, 1] RESET |

---

## Example Scenario: Cascading Thermal-Network Failure

```
Step  Sensor Reading          Detector Output    FF State         CritAlert
────  ──────────────────────  ─────────────────  ───────────────  ─────────
  1   temp=0.30 bw=0.20       Thermal: [0,1]     Cooling: [0,1]   —
  2   temp=0.50 bw=0.20       Thermal: —         Cooling: [0,1]   —
  3   temp=0.60 bw=0.20       Thermal: —         Cooling: [0,1]   —
  4   temp=0.75 bw=0.20       Thermal: —         Cooling: [0,1]   —
  5   temp=0.85 bw=0.20       Thermal: —         Cooling: [0,1]   —
  6   temp=0.96 bw=0.50       Thermal: [1,0]     Cooling: —       —
  7   temp=0.96 bw=0.70       —                  Cooling: [1,0]   —
  8   temp=0.96 bw=0.88       —                  Cooling: [1,0]   —
  9   temp=0.96 bw=0.97       Network: [1,0]     Network: —       —
 10   temp=0.96 bw=0.97       —                  Network: [1,0]   Synth→[1,0]
 11   (recovery begins)       —                  [1,0],[1,0]      Alert: [1,0]
```

Note: The 1-step pipeline delay means:
- Thermal EMERGENCY fires at step 6 → CoolingControlFF reads [1,0] at step 7
- Network OVERFLOW fires at step 9 → NetworkThrottleFF reads [1,0] at step 10
- CriticalSynthesizer sees [1,0,1,0] at step 10 → fires [1,0] → CriticalAlertFF sets at step 11
