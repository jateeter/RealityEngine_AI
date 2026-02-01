# Interconnected Machines Setup

**Date**: 2026-01-31
**Feature**: Machine Interconnection via Perceptual Space
**Status**: Configured and Ready

---

## Overview

The following machines have been configured with **perceptual space mappings** to enable interconnection through the shared 256-dimensional reality representation (En).

---

## Configured Machines

### 1. Multi-Step State Machine

**Perceptual Mapping**:
- **Input**: `En[0:3]` (offset=0, length=3)
- **Output**: `En[3:5]` (offset=3, length=2)

**Description**:
- 3-dimensional binary input vectors (000-111)
- 2-dimensional binary outputs {[0,1], [1,0]}
- Two sequences with 3-step state transitions
- Category: `state-machine`

**File**: `src/examples/multi-step-sequences/sequence-definitions.ts`

**Connection**:
- Reads from: `En[0:3]` (system input region)
- Writes to: `En[3:5]` → **Feeds into RS Flip-Flop**

---

### 2. RS Flip-Flop

**Perceptual Mapping**:
- **Input**: `En[3:5]` (offset=3, length=2)
- **Output**: `En[6:8]` (offset=6, length=2)

**Description**:
- 2-dimensional binary input vectors [S, R]
- 2-dimensional binary outputs [Q, Q̄]
- SET and RESET sequences
- Category: `digital-logic`

**File**: `src/examples/rs-flip-flop/rs-flip-flop-sequences.ts`

**Connection**:
- Reads from: `En[3:5]` ← **Receives Multi-Step output**
- Writes to: `En[6:8]` (final output region)

---

### 3. Kleene Star Operator

**Perceptual Mapping**:
- **Input**: `En[8:11]` (offset=8, length=3)
- **Output**: `En[11:13]` (offset=11, length=2)

**Description**:
- 3-dimensional binary input vectors (000-111)
- 2-dimensional binary outputs {[0,1], [1,0]}
- Demonstrates zero-or-more repetition patterns
- Category: `pattern-matching`

**File**: `src/examples/kleene-star-operator/kleene-star-sequences.ts`

**Connection**:
- Reads from: `En[8:11]` (independent input region)
- Writes to: `En[11:13]` (independent output region)

---

## Perceptual Space Layout

```
Dimension Range  │ Purpose                      │ Owner
─────────────────┼──────────────────────────────┼────────────────────
En[0:3]          │ System Input                 │ Multi-Step (input)
En[3:5]          │ Multi-Step → RS Flip-Flop    │ Multi-Step (output)
                 │                              │ RS Flip-Flop (input)
En[6:8]          │ Final Output (RS Flip-Flop)  │ RS Flip-Flop (output)
En[8:11]         │ Independent Input            │ Kleene Star (input)
En[11:13]        │ Independent Output           │ Kleene Star (output)
En[13:256]       │ Available                    │ (unused)
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                Perceptual Space (En) - 256D             │
│                                                          │
│  [0  1  2][3  4][5][6  7][8  9 10][11 12][13...255]    │
│   ↓─────↓  ↓──↓     ↓──↓   ↓─────↓  ↓──↓              │
│   Multi-  Multi-    RS      Kleene   Kleene             │
│   Step    Step      Flip-   Star     Star               │
│   Input   Output    Flop    Input    Output             │
│           │         Output                               │
│           └────→ RS Flip-Flop Input                     │
│                                                          │
└──────────────────────────────────────────────────────────┘

Connected Chain:
User Input → En[0:3] → Multi-Step → En[3:5] → RS Flip-Flop → En[6:8]

Independent:
User Input → En[8:11] → Kleene Star → En[11:13]
```

---

## Machine Connections

### Connected Machines (Data Flow)

**Multi-Step ⟶ RS Flip-Flop**:
- Multi-Step writes to `En[3:5]`
- RS Flip-Flop reads from `En[3:5]`
- **Overlap**: Perfect match (100% overlap)
- **Connection Type**: Output → Input

### Independent Machines

**Kleene Star**:
- No overlap with other machines
- Operates independently
- Can be used in parallel processing

---

## Visualization

### Graph View

When viewing any of these machines in the **🔗 Interconnections** view:

**Multi-Step Machine View**:
- Multi-Step highlighted in **blue** (current)
- RS Flip-Flop shown in **gray** (connected)
- Edge from Multi-Step → RS Flip-Flop with label `[3:5] → [3:5]`
- Kleene Star shown **dimmed** (not connected)

**RS Flip-Flop View**:
- RS Flip-Flop highlighted in **blue** (current)
- Multi-Step shown in **gray** (connected)
- Edge from Multi-Step → RS Flip-Flop
- Kleene Star shown **dimmed** (not connected)

**Kleene Star View**:
- Kleene Star highlighted in **blue** (current)
- Multi-Step and RS Flip-Flop shown **dimmed** (not connected)
- No edges (independent machine)

---

## System-Wide Visualization

Access via **Machine Selection** → **⚡ Interconnection View**:

**Shows**:
- All 3 machines as nodes
- Multi-Step → RS Flip-Flop connection
- Perceptual space regions color-coded
- Real-time simulation capability

**Features**:
- Configure input sequences for `En[0:3]` or `En[8:11]`
- Watch data flow through connected machines
- See outputs written to `En[6:8]` and `En[11:13]`
- Step-by-step or auto-play modes

---

## Example Simulations

### Simulation 1: Multi-Step → RS Flip-Flop Chain

**Configuration**:
```json
{
  "inputSequence": [
    [0, 0, 0],  // Multi-Step Sequence 1: Initial
    [0, 0, 1],  // Multi-Step Sequence 1: Transition
    [0, 1, 1]   // Multi-Step Sequence 1: Final → outputs [0,1]
  ],
  "inputRegion": { "offset": 0, "length": 3 }
}
```

**Expected Flow**:
1. **Step 0**: Input `[0,0,0]` → En[0:3]
   - Multi-Step activates Sequence 1 initial state

2. **Step 1**: Input `[0,0,1]` → En[0:3]
   - Multi-Step transitions to next state

3. **Step 2**: Input `[0,1,1]` → En[0:3]
   - Multi-Step completes sequence → outputs `[0,1]` to En[3:5]
   - RS Flip-Flop reads `[0,1]` from En[3:5]
   - RS Flip-Flop activates RESET sequence → outputs `[0,1]` to En[6:8]

**Final State**:
- `En[0:3]` = `[0, 1, 1]`
- `En[3:5]` = `[0, 1]` (Multi-Step output)
- `En[6:8]` = `[0, 1]` (RS Flip-Flop output)

---

### Simulation 2: Multi-Step → RS Flip-Flop (SET)

**Configuration**:
```json
{
  "inputSequence": [
    [1, 0, 0],  // Multi-Step Sequence 2: Initial
    [1, 0, 1],  // Multi-Step Sequence 2: Transition
    [1, 1, 1]   // Multi-Step Sequence 2: Final → outputs [1,0]
  ],
  "inputRegion": { "offset": 0, "length": 3 }
}
```

**Expected Flow**:
1. Multi-Step executes Sequence 2
2. Multi-Step outputs `[1,0]` to En[3:5]
3. RS Flip-Flop reads `[1,0]` from En[3:5]
4. RS Flip-Flop activates SET sequence → outputs `[1,0]` to En[6:8]

---

### Simulation 3: Independent Kleene Star

**Configuration**:
```json
{
  "inputSequence": [
    [0, 0, 1],  // Kleene Sequence 1: Start
    [0, 1, 0]   // Kleene Sequence 1: End → outputs [0,1]
  ],
  "inputRegion": { "offset": 8, "length": 3 }
}
```

**Expected Flow**:
1. Input applied to En[8:11]
2. Kleene Star processes independently
3. Kleene Star outputs `[0,1]` to En[11:13]
4. Multi-Step and RS Flip-Flop **not affected** (different regions)

---

## Testing the Configuration

### Via Interconnection View

1. Navigate to **⚡ Interconnection View**
2. Configure simulation:
   ```json
   {
     "inputSequence": [[0,0,0], [0,0,1], [0,1,1]],
     "inputRegion": { "offset": 0, "length": 3 },
     "stepDelayMs": 1500
   }
   ```
3. Click **Configure** then **▶ Start**
4. Observe:
   - Machine graph highlights active machines
   - Perceptual space shows active regions
   - Data flows from Multi-Step to RS Flip-Flop

### Via Machine Administration View

1. Select **Multi-Step State Machine**
2. Click **🔗 Interconnections** tab (default)
3. See graph showing connection to RS Flip-Flop
4. Switch to RS Flip-Flop machine
5. See connection from Multi-Step

---

## Verification Checklist

- [x] Multi-Step machine has perceptual mapping (input[0:3], output[3:5])
- [x] RS Flip-Flop has perceptual mapping (input[3:5], output[6:8])
- [x] Kleene Star has perceptual mapping (input[8:11], output[11:13])
- [x] Multi-Step output region overlaps RS Flip-Flop input region
- [x] Category metadata added for visual organization
- [x] Output dimensions match mapping lengths
- [ ] All machines compile successfully
- [ ] All machines visible in visualization
- [ ] Connections displayed correctly in graph
- [ ] Data flows through connected machines

---

## Known Issues

**Build Errors** (To Fix):
- Data Center Monitoring example has missing exports
- Robotics Assembly example has type errors

These machines are not critical for the Multi-Step ↔ RS Flip-Flop connection demonstration.

---

## Next Steps

1. **Fix Build Errors**: Resolve data-center and robotics-assembly compilation issues
2. **Test Visualization**: Verify all machines appear in graph view
3. **Run Simulation**: Execute the Multi-Step → RS Flip-Flop chain example
4. **Add More Machines**: Configure additional machines with perceptual mappings

---

**Status**: ✅ Core interconnection configured and ready for testing
**Documentation**: ✅ Complete
**Build Status**: ⚠️ Partial (3/5 machines compile)

---

**Configuration Date**: 2026-01-31
**Configured By**: Claude Sonnet 4.5
