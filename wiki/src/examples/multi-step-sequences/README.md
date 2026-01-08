# Multi-Step Sequences Example

Demonstrates multi-step critical event sequences with state transitions and output assertions.

## Overview

This example showcases:
- **3-dimensional event space**: Binary vectors [0,0,0] through [1,1,1]
- **2-dimensional output space**: {00, 01, 10, 11}
- **Multi-step sequences**: 3-event chains with initial → intermediate → terminal states
- **State transitions**: Sequential activation through event chains
- **Output assertions**: Terminal events produce outputs

## Event Space

**3D Binary Vectors:**
```
000, 001, 010, 011, 100, 101, 110, 111
```

**Output Space:**
```
00 = [0, 0]
01 = [0, 1]
10 = [1, 0]
11 = [1, 1]
```

## Sequence Definitions

### Sequence 1: `000 → 001 → 011 → [01]`

**Event Chain:**
1. **000** (Initial) - Starting state
2. **001** (Intermediate) - First transition
3. **011** (Terminal) - Outputs `[0,1]`

**Activation:**
- Input `[0,0,0]` activates event 000
- Input `[0,0,1]` transitions 000→001
- Input `[0,1,1]` transitions 001→011, asserts output `[0,1]`

### Sequence 2: `100 → 101 → 111 → [10]`

**Event Chain:**
1. **100** (Initial) - Starting state
2. **101** (Intermediate) - First transition
3. **111** (Terminal) - Outputs `[1,0]`

**Activation:**
- Input `[1,0,0]` activates event 100
- Input `[1,0,1]` transitions 100→101
- Input `[1,1,1]` transitions 101→111, asserts output `[1,0]`

## State Diagram

```
Sequence 1:
┌─────┐      ┌─────┐      ┌─────┐
│ 000 │─────>│ 001 │─────>│ 011 │──> [01]
└─────┘      └─────┘      └─────┘
  ⭐           ○             🎯
Initial    Intermediate   Terminal

Sequence 2:
┌─────┐      ┌─────┐      ┌─────┐
│ 100 │─────>│ 101 │─────>│ 111 │──> [10]
└─────┘      └─────┘      └─────┘
  ⭐           ○             🎯
Initial    Intermediate   Terminal
```

## Key Properties

**Sequence Structure:**
- **Depth**: 3 events per sequence
- **Initial events**: 1 per sequence (000, 100)
- **Intermediate events**: 1 per sequence (001, 101)
- **Terminal events**: 1 per sequence (011, 111)
- **Output events**: 1 per sequence (Sequence 1 outputs [0,1], Sequence 2 outputs [1,0])

**Event Characteristics:**
- ⭐ **Initial events**: Always active, trigger sequence start
- ○ **Intermediate events**: Activated by previous event, activate next event
- 🎯 **Terminal events**: Activated by previous event, produce output

## Input Sequence

The example uses the following 11-vector input sequence:

```
{000, 001, 101, 100, 101, 111, 000, 001, 011, 100, 101}
```

**Expected Behavior:**
- Vectors 1-2: Begin Sequence 1 activation
- Vector 3: Activate Sequence 2 intermediate state (101)
- Vectors 4-5: Transition Sequence 2 (100→101)
- Vector 6: Complete Sequence 2 (101→111) → **Output [1,0]**
- Vectors 7-8: Re-activate Sequence 1 (000→001)
- Vector 9: Complete Sequence 1 (001→011) → **Output [0,1]**
- Vectors 10-11: Re-activate Sequence 2 (100→101)

## Test Cases

### Vector-by-Vector Execution

```bash
# Vector 1: 000
Input: [0, 0, 0]
Result: Sequence 1 event 000 activated

# Vector 2: 001
Input: [0, 0, 1]
Result: Sequence 1 transition (000→001)

# Vector 3: 101
Input: [1, 0, 1]
Result: Sequence 2 intermediate event 101 activated

# Vector 4: 100
Input: [1, 0, 0]
Result: Sequence 2 event 100 activated

# Vector 5: 101
Input: [1, 0, 1]
Result: Sequence 2 transition (100→101)

# Vector 6: 111
Input: [1, 1, 1]
Result: Sequence 2 complete (101→111) → Output [1, 0]

# Vector 7: 000
Input: [0, 0, 0]
Result: Sequence 1 event 000 re-activated

# Vector 8: 001
Input: [0, 0, 1]
Result: Sequence 1 transition (000→001)

# Vector 9: 011
Input: [0, 1, 1]
Result: Sequence 1 complete (001→011) → Output [0, 1]

# Vector 10: 100
Input: [1, 0, 0]
Result: Sequence 2 event 100 re-activated

# Vector 11: 101
Input: [1, 0, 1]
Result: Sequence 2 transition (100→101)
```

## Running the Demo

```bash
# Inside Docker container
docker-compose exec reality-engine node dist/examples/multi-step-sequences/run-demo.js

# Or rebuild and run
npm run build
docker-compose build reality-engine
docker-compose up -d
docker-compose exec reality-engine node dist/examples/multi-step-sequences/run-demo.js
```

## Expected Output

```
========================================
Multi-Step Sequences Demonstration
========================================

Loading sequences...

✓ Loaded: Sequence 1: 000→001→011→[01]
  Total events: 3
  Initial events: 1
  Output events: 1

✓ Loaded: Sequence 2: 100→101→111→[10]
  Total events: 3
  Initial events: 1
  Output events: 1

========================================
Sequence Details
========================================

Sequence 1: 000→001→011→[01]
  ⭐ INITIAL [000] → 1 next, 0 outputs
  ○ INTERMEDIATE [001] → 1 next, 0 outputs
  🎯 OUTPUT [011] → 0 next, 1 outputs
    → Output: [01] - Sequence 1 complete: output [0,1]

Sequence 2: 100→101→111→[10]
  ⭐ INITIAL [100] → 1 next, 0 outputs
  ○ INTERMEDIATE [101] → 1 next, 0 outputs
  🎯 OUTPUT [111] → 0 next, 1 outputs
    → Output: [10] - Sequence 2 complete: output [1,0]

========================================
Running Test Vectors
========================================

[... test execution ...]

========================================
Final Statistics
========================================

Total Sequences: 2
Total Events: 6
Active Events: 2

Test Results:
  Passed: 2
  Failed: 0
  Success Rate: 100.0%
```

## Visualizer Integration

Access the visualizer at http://localhost:5173 to see:
- **Graph view**: All events displayed as connected nodes
- **State transitions**: Animated transitions between events
- **Active events**: Green highlighting for currently active events
- **Output events**: Orange borders for events with outputs
- **Event chains**: Visual flow from initial → intermediate → terminal

## Key Concepts Demonstrated

1. **Multi-step sequences**: Events connected in chains
2. **State transitions**: Sequential activation through chains
3. **Initial events**: Always active, entry points to sequences
4. **Intermediate events**: Conditional activation based on previous events
5. **Terminal events**: End of sequence, produce outputs
6. **Output assertions**: Reality manipulation at sequence completion

## Files

- `sequence-definitions.ts` - Sequence and event definitions
- `run-demo.ts` - Demonstration runner and test suite
- `README.md` - This documentation

## Architecture Notes

**Comparator Type**: EQUALS with ±0.05 threshold
- Allows exact matching of binary patterns
- Tolerant to minor floating-point precision issues

**Vector Dimensions**:
- Event vectors: 3D (supports 8 unique states)
- Output vectors: 2D (supports 4 unique outputs)

**Sequence Isolation**:
- Each sequence operates independently
- No shared state between sequences
- Different outputs: Sequence 1 outputs [0,1], Sequence 2 outputs [1,0]
