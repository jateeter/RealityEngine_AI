# Machine Interconnection Map

**Version**: 2.0.0  
**Updated**: 2026-04-23  
**Perceptual Space Dimension**: 256 bytes (En)

---

## Design Principles

### Write Collisions
Multiple machines may write to the same output region.  This is **intentional and desired** — the perception engine (arbiter) resolves competing output vectors, producing a unified perceptual state. Write collision zones are marked **[WC]** throughout this document.

### Cross-Domain Surface Flow
Feed-forward connections that cross domain boundaries are **explicitly encouraged**. Information produced by one domain (e.g., data center hardware health) surfaces naturally into another domain's input (e.g., patient care operations) through shared perceptual space regions. Cross-domain edges are marked **[XD]** throughout this document.

### Alignment Gaps (Don't-Care Wildcards)
Some machine output regions are adjacent to, but not overlapping with, a logically related machine's input. Where the gap represents an intentional staging region (not a missing connection), these are classified as **wildcard / don't-care** and left as raw-injection zones for the application layer.

---

## Perceptual Space Layout

```
Byte Range   Machine(s)                    Role
-----------  ----------------------------  ------
[0:3]        MultiStep                     INPUT  (raw — external injection)
[0:8]        NewPatientInflow              INPUT  (raw — external injection)
[3:5]        MultiStep                     OUTPUT → RS2, RSFlipFlop, NewPatientInflow [WC]
[3:5]        RS2, RSFlipFlop               INPUT  ← MultiStep output
[6:8]        RSFlipFlop                    OUTPUT → KleeneStar, NewPatientInflow [WC]
[6:9]        KleeneStar                    INPUT  ← RSFlipFlop [6:8], RS2 [8:10]
[8:10]       RS2                           OUTPUT → KleeneStar [WC with NewPatientInflow]
[8:16]       NewPatientInflow              OUTPUT → DCThermalEscalation [12:16], KleeneStar [8:9] [XD][WC]
[10:12]      KleeneStar                    OUTPUT (terminal — feeds nothing)
[12:16]      DCThermalEscalation           INPUT  ← NewPatientInflow [8:16] at [12:16] [XD][WC]
[16:20]      DCMemoryPressure              INPUT  (raw — external sensor injection)
[17:25]      DataCenterMonitoring          INPUT  (raw — external sensor injection; overlaps DC sensor zone)
[20:24]      DCNetworkBurstDetector        INPUT  (raw — external sensor injection)
[25:37]      DataCenterMonitoring          OUTPUT (terminal — architectural gap, see §Islands)
[44:52]      FacilitiesMaintenance         INPUT  (raw — external facilities observation injection)
[64:66]      DCNetworkBurstDetector        OUTPUT → DCNetworkThrottleFF
[64:66]      DCNetworkThrottleFF           INPUT  ← DCNetworkBurstDetector output
[66:68]      DCMemoryPressure              OUTPUT → DCMemoryAlertFF
[66:68]      DCMemoryAlertFF               INPUT  ← DCMemoryPressure output
[72:74]      DCCriticalSynthesizer         OUTPUT → DCCriticalAlertFF
[72:74]      DCCriticalAlertFF             INPUT  ← DCCriticalSynthesizer output
[100:102]    DCCoolingControlFF            OUTPUT → DCCriticalSynthesizer
[100:104]    DCCriticalSynthesizer         INPUT  ← DCCoolingControlFF [100:102] + DCNetworkThrottleFF [102:104] [WC]
[102:104]    DCNetworkThrottleFF           OUTPUT → DCCriticalSynthesizer
[120:124]    AIPowerEfficiency             INPUT  (raw — AI sensor injection)
[124:128]    AICoolingRegulator            INPUT  (raw — AI sensor injection)
[128:132]    AICapacityThrottler           INPUT  (raw — AI sensor injection)
[132:136]    AISecurityMonitor             INPUT  (raw — AI sensor injection)
[136:140]    AIModelWellness               INPUT  (raw — AI sensor injection)
[140:144]    AIHardwareResilience          INPUT  (raw — AI sensor injection)
[144:146]    DCThermalEscalation           OUTPUT → DCCoolingControlFF
[144:146]    DCCoolingControlFF            INPUT  ← DCThermalEscalation output
[146:148]    DCMemoryAlertFF               OUTPUT (terminal — DC alert sink, see §Islands)
[148:150]    DCCriticalAlertFF             OUTPUT (terminal — DC alert sink, see §Islands)
[150:156]    AIPowerEfficiency             OUTPUT (terminal — AI analysis sink, see §Islands)
[156:162]    AICoolingRegulator            OUTPUT (terminal — AI analysis sink, see §Islands)
[162:168]    AICapacityThrottler           OUTPUT (terminal — AI analysis sink, see §Islands)
[168:174]    AISecurityMonitor             OUTPUT (terminal — AI analysis sink, see §Islands)
[174:180]    AIModelWellness               OUTPUT (terminal — AI analysis sink, see §Islands)
[186:192]    AIHardwareResilience          OUTPUT → DailyPatientCare [186:194] at [186:192] [XD]
[186:194]    DailyPatientCare              INPUT  ← AIHardwareResilience [186:192], FacilitiesMaintenance [188:194] [XD][WC]
[188:194]    FacilitiesMaintenance         OUTPUT → DailyPatientCare [186:194] at [188:194] [XD][WC with AIHardwareResilience at 188:192]
[202:210]    DailyPatientCare              OUTPUT → PatientWellness [202:210] [WC with external wellness sensors]
[202:210]    PatientWellness               INPUT  ← DailyPatientCare output [202:210] [WC]
[210:218]    PatientWellness               OUTPUT → AIWellnessCoach, WellnessAnalytics [WC shared read]
[210:218]    AIWellnessCoach               INPUT  ← PatientWellness output
[210:218]    WellnessAnalytics             INPUT  ← PatientWellness output [shared with AIWellnessCoach]
[218:226]    CareTransitionWorkflow        INPUT  ← AIWellnessCoach [220:228], WellnessAnalytics [218:226] [WC]
[218:226]    WellnessAnalytics             OUTPUT → CareTransitionWorkflow [218:226] [WC with AIWellnessCoach]
[220:228]    AIWellnessCoach               OUTPUT → CareTransitionWorkflow [218:226] at [220:226] [WC with WellnessAnalytics]
[226:234]    CareTransitionWorkflow        OUTPUT (terminal — care transition sink, see §Islands)
[234:242]    (free)                        — formerly WellnessAnalytics input, now unused
[242:250]    (free)                        — formerly WellnessAnalytics output, now unused
[250:256]    (free)                        — formerly FacilitiesMaintenance output, now unused
```

---

## Complete Connection Table

| # | From Machine | Out Region | To Machine | In Region | Overlap | Type |
|---|---|---|---|---|---|---|
| 1 | MultiStep | [3:5] | RS2 | [3:5] | [3:5] | in-domain |
| 2 | MultiStep | [3:5] | RSFlipFlop | [3:5] | [3:5] | in-domain |
| 3 | MultiStep | [3:5] | NewPatientInflow | [0:8] | [3:5] | in-domain [WC] |
| 4 | RSFlipFlop | [6:8] | KleeneStar | [6:9] | [6:8] | in-domain |
| 5 | RSFlipFlop | [6:8] | NewPatientInflow | [0:8] | [6:8] | in-domain [WC] |
| 6 | RS2 | [8:10] | KleeneStar | [6:9] | [8:9] | in-domain [WC] |
| 7 | NewPatientInflow | [8:16] | KleeneStar | [6:9] | [8:9] | cross-domain [XD][WC] |
| 8 | NewPatientInflow | [8:16] | DCThermalEscalation | [12:16] | [12:16] | **cross-domain** [XD][WC] |
| 9 | DCNetworkBurstDetector | [64:66] | DCNetworkThrottleFF | [64:66] | [64:66] | in-domain |
| 10 | DCMemoryPressure | [66:68] | DCMemoryAlertFF | [66:68] | [66:68] | in-domain |
| 11 | DCCriticalSynthesizer | [72:74] | DCCriticalAlertFF | [72:74] | [72:74] | in-domain |
| 12 | DCCoolingControlFF | [100:102] | DCCriticalSynthesizer | [100:104] | [100:102] | in-domain [WC] |
| 13 | DCNetworkThrottleFF | [102:104] | DCCriticalSynthesizer | [100:104] | [102:104] | in-domain [WC] |
| 14 | DCThermalEscalation | [144:146] | DCCoolingControlFF | [144:146] | [144:146] | in-domain |
| 15 | **AIHardwareResilience** | **[186:192]** | **DailyPatientCare** | **[186:194]** | **[186:192]** | **cross-domain** [XD] |
| 16 | **FacilitiesMaintenance** | **[188:194]** | **DailyPatientCare** | **[186:194]** | **[188:194]** | **cross-domain** [XD][WC] |
| 17 | **DailyPatientCare** | **[202:210]** | **PatientWellness** | **[202:210]** | **[202:210]** | in-domain [WC] |
| 18 | PatientWellness | [210:218] | AIWellnessCoach | [210:218] | [210:218] | in-domain |
| 19 | **PatientWellness** | **[210:218]** | **WellnessAnalytics** | **[210:218]** | **[210:218]** | in-domain [WC shared] |
| 20 | AIWellnessCoach | [220:228] | CareTransitionWorkflow | [218:226] | [220:226] | in-domain [WC] |
| 21 | **WellnessAnalytics** | **[218:226]** | **CareTransitionWorkflow** | **[218:226]** | **[218:226]** | in-domain [WC] |

**Bold** = new connection added in this revision. `[WC]` = write collision (desired). `[XD]` = cross-domain.

---

## Write Collision Zones

| Byte Range | Writers | Resolved By |
|---|---|---|
| [3:5] | MultiStep | RS2 + RSFlipFlop + NewPatientInflow all read; no collision among writers |
| [6:8] | RSFlipFlop → NewPatientInflow input [0:8] | NewPatientInflow arbiter |
| [8:10] | RS2 + NewPatientInflow | KleeneStar input arbiter |
| [10:12] | KleeneStar + NewPatientInflow | (terminal, no reader) |
| [12:16] | NewPatientInflow (partial) | DCThermalEscalation input arbiter |
| [100:104] | DCCoolingControlFF [100:102] + DCNetworkThrottleFF [102:104] | DCCriticalSynthesizer input arbiter |
| **[186:192]** | **AIHardwareResilience [186:192]** | DailyPatientCare input arbiter |
| **[188:194]** | **FacilitiesMaintenance [188:194]** | DailyPatientCare input arbiter |
| **[188:192]** | **AIHardwareResilience ∩ FacilitiesMaintenance** | DailyPatientCare input arbiter resolves both |
| **[202:210]** | **DailyPatientCare + external wellness sensors** | PatientWellness input arbiter |
| **[210:218]** | PatientWellness (single writer, two readers) | No collision — shared read is fine |
| **[218:226]** | **WellnessAnalytics [218:226] + AIWellnessCoach [220:228] at [220:226]** | CareTransitionWorkflow input arbiter |
| [226:228] | AIWellnessCoach [220:228] ∩ CareTransitionWorkflow [226:234] | (output-output, no shared reader) |

---

## Cluster-Level Architecture

### Logic / Prototype Zone  [0:12]
Primitive state machines demonstrating core Reality Engine features.
```
MultiStep [0:3]──out[3:5]──┬──► RS2 [3:5]──out[8:10]──► KleeneStar [6:9]
                            ├──► RSFlipFlop [3:5]──out[6:8]──► KleeneStar (WC)
                            └──► NewPatientInflow [0:8] (WC at [3:5], [6:8])
```

### Data Center Sensor Zone  [12:64]
Raw multi-dimensional sensor data; all inputs are injected directly by the application.
```
DCThermalEscalation    in[12:16]  (also receives NewPatientInflow XD at [12:16])
DCMemoryPressure       in[16:20]  (raw injection)
DataCenterMonitoring   in[17:25]  (raw injection; spans thermal+memory sensor zones)
DCNetworkBurstDetector in[20:24]  (raw injection)
FacilitiesMaintenance  in[44:52]  (raw injection — facilities observations)
```

### Data Center Alarm / FF Zone  [64:112]
Detector → flip-flop → synthesizer alarm escalation pipeline.
```
                    [64:66]       [66:68]
DCNetworkBurstDetector ──► DCNetworkThrottleFF ──► DCCriticalSynthesizer ──► DCCriticalAlertFF
                                [102:104]↗           [100:104]                   [148:150]
                                                     ↑[100:102]
DCMemoryPressure ──► DCMemoryAlertFF             DCCoolingControlFF
  [66:68]              [146:148]                    ↑[144:146]
                                               DCThermalEscalation
                                                  [144:146]
```
DCCriticalSynthesizer reads BOTH CoolingControlFF [100:102] AND NetworkThrottleFF [102:104] as a 4D write-collision vector — it fires only when both thermal and network alarms are simultaneously latched.

### AI Workload Analytics Zone  [120:186]
Six AI-tier analytics machines processing deep AI-infrastructure metrics. All inputs are raw injections from the application layer (no upstream machine feeds [120:144]). Outputs at [150:186] are currently terminal sinks — see §Islands.

```
AIPowerEfficiency      in[120:124]  out[150:156]  ← terminal
AICoolingRegulator     in[124:128]  out[156:162]  ← terminal
AICapacityThrottler    in[128:132]  out[162:168]  ← terminal
AISecurityMonitor      in[132:136]  out[168:174]  ← terminal
AIModelWellness        in[136:140]  out[174:180]  ← terminal
AIHardwareResilience   in[140:144]  out[186:192] ──► DailyPatientCare [XD]
```

### Healthcare Operations Zone  [186:256]
Patient intake, daily care, wellness monitoring, coaching, and care-transition workflow machines.

```
                            ┌── AIHardwareResilience out[186:192] ─────┐
                            │   FacilitiesMaintenance out[188:194] ──┐ │  (write collisions [XD])
                            ▼                                        ▼ ▼
DailyPatientCare in[186:194]  (receives XD context from DC AI + Facilities)
        │
        │ out[202:210]  (write collision with external wellness sensors)
        ▼
PatientWellness in[202:210] ──out[210:218]──┬──► AIWellnessCoach in[210:218]──out[220:228]──┐
                                            │                                               │  (WC)
                                            └──► WellnessAnalytics in[210:218]──out[218:226]┘
                                                                                            │
                                                                                            ▼
                                                                              CareTransitionWorkflow in[218:226]
                                                                                            │
                                                                                    out[226:234] ← terminal

NewPatientInflow in[0:8]──out[8:16]──► DCThermalEscalation [XD cross to DC zone]
```

---

## Islands — Raw Injection Inputs (No Upstream Machine)

These regions are populated directly by the application / sensor layer:

| Machine | Input Region | Expected Content |
|---|---|---|
| MultiStep | [0:3] | 3D binary test vectors |
| NewPatientInflow | [0:8] | 8D binary patient evaluation events |
| DCThermalEscalation | [12:16] | CPU temp, load, throttle, efficiency (also receives NewPatientInflow [XD]) |
| DCMemoryPressure | [16:20] | Memory usage, page fault rate, cache miss, swap |
| DataCenterMonitoring | [17:25] | 8D multi-sensor DC vector |
| DCNetworkBurstDetector | [20:24] | Bandwidth util, packet loss, latency, queue depth |
| FacilitiesMaintenance | [44:52] | 8D binary facilities observation events |
| AIPowerEfficiency | [120:124] | PUE, power draw, renewable mix, grid carbon |
| AICoolingRegulator | [124:128] | Liquid/air cooling efficiency, flow rate, delta-T |
| AICapacityThrottler | [128:132] | GPU utilization, job queue depth, memory pressure, thermal headroom |
| AISecurityMonitor | [132:136] | Auth anomalies, exfiltration indicators, privilege escalation, threats |
| AIModelWellness | [136:140] | Inference error rate, SLO compliance, accuracy drift, memory leaks |
| AIHardwareResilience | [140:144] | Disk fault score, memory ECC error rate, packet loss, fault accumulation |
| PatientWellness | [202:210] | 8D wellness sensor space (also receives DailyPatientCare output [WC]) |

---

## Islands — Terminal Outputs (No Downstream Machine)

These outputs are produced but not consumed by any other machine. They represent application-layer sinks: final decisions, alerts, or analytics consumed by external systems, dashboards, or human operators.

| Machine | Output Region | Content |
|---|---|---|
| KleeneStar | [10:12] | Pattern match result (demo primitive) |
| DataCenterMonitoring | [25:37] | 12D DC action vector — **architectural gap** (see below) |
| DCMemoryAlertFF | [146:148] | Memory alert latch state |
| DCCriticalAlertFF | [148:150] | Critical multi-system alert latch state |
| AIPowerEfficiency | [150:156] | Power efficiency status / actions |
| AICoolingRegulator | [156:162] | Cooling regulation status / actions |
| AICapacityThrottler | [162:168] | Capacity throttling decisions |
| AISecurityMonitor | [168:174] | Security anomaly alerts |
| AIModelWellness | [174:180] | Model serving health classification |
| CareTransitionWorkflow | [226:234] | Transition outcome decisions |

---

## Architectural Gap — DataCenterMonitoring → AI Zone

**DataCenterMonitoring** writes a 12D action vector to [25:37]. The AI analytics cluster reads raw metrics from [120:144]. These regions do not overlap — there is an 83-byte gap between them.

**Why this gap exists**: DataCenterMonitoring processes an 8D multi-sensor input and classifies DC operational state into 12 action categories. The AI analytics machines (AIPowerEfficiency, AICoolingRegulator, etc.) are designed to receive fine-grained, machine-specific raw sensor signals directly rather than DataCenterMonitoring's coarser action classification.

**Recommended future work**: Route the most relevant DataCenterMonitoring action outputs (e.g., COOLING_ACTION, CAPACITY_ACTION) into specific AI machine input bytes via targeted write collisions, or add a "DC Action Router" bridge machine.

---

## Loop / Cycle — WellnessAnalytics → NewPatientInflow

**WellnessAnalytics** is designed to route wellness decisions back to `NewPatientInflow` (for community-dwelling patients requiring new assisted-living evaluation). However:

- WellnessAnalytics output: [218:226] (writes to CareTransitionWorkflow input)  
- NewPatientInflow input: [0:8]  

These regions do not overlap. The loop-back from wellness analytics to new-patient intake is a **cycle** in the information flow that must be implemented at the application layer (external injection into [0:8]) rather than through perceptual space overlap.

---

## Cross-Domain Connections Summary

| Connection | From Domain | To Domain | Mechanism |
|---|---|---|---|
| NewPatientInflow → DCThermalEscalation | Healthcare Intake | Data Center | Write collision at [12:16] — patient admission load affects DC thermal |
| AIHardwareResilience → DailyPatientCare | DC AI Analytics | Healthcare Ops | Write collision at [186:192] — hardware health surfaces into care operations |
| FacilitiesMaintenance → DailyPatientCare | Facilities Management | Healthcare Ops | Write collision at [188:194] — facility observations enrich daily care context |

---

## Full Machine Reference

| Machine | Category | Domain | Input | Output |
|---|---|---|---|---|
| MultiStep | state-machine | — | [0:3] | [3:5] |
| NewPatientInflow | elder-care | Healthcare Intake | [0:8] | [8:16] |
| RSFlipFlop | digital-logic | — | [3:5] | [6:8] |
| RS2 | digital-logic | — | [3:5] | [8:10] |
| KleeneStar | pattern-matching | — | [6:9] | [10:12] |
| DCThermalEscalation | monitoring | Data Center — Thermal / Escalation | [12:16] | [144:146] |
| DCMemoryPressure | monitoring | Data Center — Memory / Pressure | [16:20] | [66:68] |
| DataCenterMonitoring | monitoring | Data Center — Multi-Sensor Monitoring | [17:25] | [25:37] |
| DCNetworkBurstDetector | monitoring | Data Center — Network / Burst Detection | [20:24] | [64:66] |
| FacilitiesMaintenance | elder-care | Facilities Management — Eldercare | [44:52] | [188:194] |
| DCNetworkThrottleFF | digital-logic | Data Center — Network / Throttle Control | [64:66] | [102:104] |
| DCMemoryAlertFF | digital-logic | Data Center — Memory / Alert Latch | [66:68] | [146:148] |
| DCCriticalSynthesizer | monitoring | Data Center — Critical Alert / Synthesizer | [100:104] | [72:74] |
| DCCoolingControlFF | digital-logic | Data Center — Thermal / Cooling Control | [144:146] | [100:102] |
| DCCriticalAlertFF | digital-logic | Data Center — Critical Alert / Latch | [72:74] | [148:150] |
| AIPowerEfficiency | data-center | Data Center — Power / PUE | [120:124] | [150:156] |
| AICoolingRegulator | data-center | Data Center — Thermal / Cooling | [124:128] | [156:162] |
| AICapacityThrottler | data-center | Data Center — AI Workload Capacity | [128:132] | [162:168] |
| AISecurityMonitor | data-center | Data Center — Infrastructure Security | [132:136] | [168:174] |
| AIModelWellness | data-center | Data Center — AI Model Serving Health | [136:140] | [174:180] |
| AIHardwareResilience | data-center | Data Center — Hardware Health | [140:144] | [186:192] |
| DailyPatientCare | elder-care | Healthcare Operations — Assisted Living Daily Care | [186:194] | [202:210] |
| PatientWellness | elder-care | Healthcare Operations — Resident Wellness Assessment | [202:210] | [210:218] |
| AIWellnessCoach | elder-care | Healthcare Operations — AI-Driven Wellness Coaching | [210:218] | [220:228] |
| WellnessAnalytics | elder-care | Healthcare Analytics — Wellness Monitoring and Care Routing | [210:218] | [218:226] |
| CareTransitionWorkflow | elder-care | Healthcare Operations — Care Level Transition Management | [218:226] | [226:234] |

---

## Change History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-01-31 | Initial perceptual space architecture; MultiStep / RSFlipFlop / RS2 demo chain |
| 1.1 | 2026-02-12 | DC cluster pipeline (DCThermalEscalation → DCCoolingControlFF → DCCriticalSynthesizer chain) |
| 1.2 | 2026-02-27 | AI analytics cluster (AIPower, AICooling, AICapacity, AISecurity, AIModelWellness, AIHardwareResilience) |
| 1.3 | 2026-04-20 | Healthcare cluster (NewPatientInflow, DailyPatientCare, PatientWellness, AIWellnessCoach, CareTransitionWorkflow, WellnessAnalytics, FacilitiesMaintenance) |
| **2.0** | **2026-04-23** | **Feed-forward improvements**: AIHardwareResilience output moved [180:186]→[186:192] to close DC AI→Healthcare near-miss gap; DailyPatientCare output moved [194:202]→[202:210] to create care-activity→wellness write collision; FacilitiesMaintenance output moved [250:256]→[188:194] to create facilities→daily-care cross-domain feed-forward; WellnessAnalytics input moved [234:242]→[210:218] to read PatientWellness output directly; WellnessAnalytics output moved [242:250]→[218:226] to write into CareTransitionWorkflow input (write collision with AIWellnessCoach) |
