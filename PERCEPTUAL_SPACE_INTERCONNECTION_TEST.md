# Perceptual Space Interconnection End-to-End Test

**Date:** 2026-02-12
**Status:** ✅ COMPLETE
**Test File:** `e2e/tests/perceptual-space-interconnection.spec.ts`

## Overview

This test verifies the complete workflow of machine interconnection through shared perceptual space. It demonstrates how multiple machines can communicate by writing to and reading from specific byte regions in the 256-byte universal perceptual space.

---

## Test Scenario

### Machines Involved

1. **Multi-Step State Machine**
   - Input: Bytes [0:3] (3 bytes)
   - Output: Bytes [3:5] (2 bytes)
   - Sequences:
     - Seq1: 000→001→011 → outputs [0,1]
     - Seq2: 100→101→111 → outputs [1,0]

2. **RS2 (Two-Step RS Flip-Flop)**
   - Input: Bytes [3:5] (2 bytes) - **Reads Multi-Step output**
   - Output: Bytes [8:10] (2 bytes)
   - Sequences:
     - SET: (0,0)→(1,0) → outputs [1,0]
     - RESET: (0,0)→(0,1) → outputs [0,1]

3. **RS Flip Flop**
   - Input: Bytes [3:5] (2 bytes) - **Reads Multi-Step output**
   - Output: Bytes [6:8] (2 bytes)
   - Sequences:
     - SET: (1,0) → outputs [1,0]
     - RESET: (0,1) → outputs [0,1]

### Perceptual Space Layout

```
Byte Range  | Machine          | Type   | Description
------------|------------------|--------|----------------------------------
[0:3]       | Multi-Step       | INPUT  | 3-byte input vectors (000-111)
[3:5]       | Multi-Step       | OUTPUT | 2-byte output vectors
            | RS2              | INPUT  | RS2 reads from Multi-Step output
            | RSFlipFlop       | INPUT  | RSFlipFlop reads from Multi-Step
[6:8]       | RSFlipFlop       | OUTPUT | RSFlipFlop outputs
[8:10]      | RS2              | OUTPUT | RS2 outputs
[10:256]    | (unused)         | -      | Reserved for future machines
```

---

## Input Sequence

The test uses a specific input sequence designed to trigger the Multi-Step Sequence 2 and demonstrate the complete interconnection:

| Step | Input Vector | Description                          | Multi-Step State |
|------|--------------|--------------------------------------|------------------|
| 1    | (0,0,0)      | Initial zero vector, no match       | No output ([0,0]) |
| 2    | (1,0,0)      | Matches Seq2 initial state (100)    | No output ([0,0]) |
| 3    | (1,0,1)      | Matches Seq2 second state (101)     | No output ([0,0]) |
| 4    | (1,1,1)      | Matches Seq2 final state (111)      | **Outputs [1,0]** |

---

## Expected Behavior

### Step 1: Initial State
```
Input: (0,0,0)
┌─────────────┐
│ Multi-Step  │
│ [0:3] = 000 │──┐
└─────────────┘  │
                 │ No match
                 ▼
           Output: [0,0]
           at bytes [3:5]
```

### Step 2-3: Sequence Progression
```
Input: (1,0,0) then (1,0,1)
┌─────────────┐
│ Multi-Step  │
│ [0:3] = 101 │──┐
└─────────────┘  │
                 │ Sequence active
                 │ but not complete
                 ▼
           Output: [0,0]
           at bytes [3:5]
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌─────────┐             ┌──────────┐
│   RS2   │             │RSFlipFlop│
│ [3:5]   │             │  [3:5]   │
│ = (0,0) │             │  = (0,0) │
└─────────┘             └──────────┘
     │                       │
     │ First event           │ No match
     │ of SET sequence       │
     ▼                       ▼
 No output yet          No output
```

### Step 4: Final Event Match and Interconnection
```
Input: (1,1,1)
┌─────────────┐
│ Multi-Step  │
│ [0:3] = 111 │──┐
└─────────────┘  │
                 │ Seq2 COMPLETE!
                 ▼
           Output: [1,0]
           at bytes [3:5]
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌─────────┐             ┌──────────┐
│   RS2   │             │RSFlipFlop│
│ [3:5]   │             │  [3:5]   │
│ = (1,0) │             │  = (1,0) │
└─────────┘             └──────────┘
     │                       │
     │ Second event          │ SET event
     │ of SET sequence       │ matches!
     │ COMPLETE!             │
     ▼                       ▼
Output: [1,0]          Output: [1,0]
at bytes [8:10]        at bytes [6:8]
```

---

## Test Steps

### Step 1: Navigate to Machine Interconnection View
- Load the Machine Interconnection view or Multi-Step machine
- Verify the UI is ready

### Step 2: Load and Verify Multi-Step Machine
- Load Multi-Step State Machine
- Verify it's configured with correct perceptual mappings

### Step 3: Create Input Perceptual Sequence
- Create 4 input vectors:
  - (0,0,0) - Initial
  - (1,0,0) - Seq2 first
  - (1,0,1) - Seq2 second
  - (1,1,1) - Seq2 final
- Load into simulation via API

### Step 4: Execute Initial Vectors
- Step through first 3 vectors
- Verify perceptual space [3:5] = [0,0]
- Confirm no output from Multi-Step

### Step 5: Execute Final Vector
- Step to the 4th vector (1,1,1)
- Verify Multi-Step outputs [1,0] at bytes [3:5]
- Confirm Sequence 2 completion

### Step 6: Verify Input Perception
- Check RS2 perceives [1,0] at bytes [3:5]
- Check RSFlipFlop perceives [1,0] at bytes [3:5]
- Confirm both machines receive same input

### Step 7: Verify RS2 Output
- Load RS2 machine
- Run same input sequence
- Verify RS2 completes (0,0)→(1,0) sequence
- Confirm RS2 outputs [1,0] at bytes [8:10]

### Step 8: Verify RSFlipFlop Output
- Load RS Flip Flop machine
- Run same input sequence
- Verify RSFlipFlop matches (1,0) event
- Confirm RSFlipFlop outputs [1,0] at bytes [6:8]

### Step 9: Verify Event Propagation
- Check all active events were recorded
- Verify all final events generated outputs
- Confirm event history is complete

### Step 10: Verify Complete Perceptual Space
- Get final perceptual space state
- Verify all regions contain expected values:
  - [0:3] = [1,1,1] (last input)
  - [3:5] = [1,0] (Multi-Step output)
  - [6:8] = [1,0] (RSFlipFlop output)
  - [8:10] = [1,0] (RS2 output)

---

## Assertions

### ✅ Multi-Step Machine
- Produces [0,0] output before final match (steps 1-3)
- Produces [1,0] output on final match (step 4)
- Output is written to bytes [3:5]

### ✅ RS2 Machine
- Perceives [0,0] from Multi-Step (steps 1-3)
- First event of SET sequence activates
- Perceives [1,0] from Multi-Step (step 4)
- Second event of SET sequence activates
- Outputs [1,0] at bytes [8:10]

### ✅ RS Flip Flop Machine
- Perceives [0,0] from Multi-Step (steps 1-3)
- No match on (0,0)
- Perceives [1,0] from Multi-Step (step 4)
- SET event matches immediately
- Outputs [1,0] at bytes [6:8]

### ✅ Perceptual Space
- All inputs are binary (0 or 1)
- All outputs are binary (0 or 1)
- Perceptual space remains consistent
- Machine switches don't corrupt state

### ✅ Event Propagation
- All active events recorded in history
- All final events generate outputs
- Output perception works correctly

---

## Running the Test

### Prerequisites
```bash
# Ensure services are running
./scripts/start.sh

# Services should be available at:
# - Visualizer: http://localhost:5173
# - Backend API: http://localhost:3001
# - Reality Engine: http://localhost:3000
```

### Run the Test
```bash
# Run the specific test
npx playwright test perceptual-space-interconnection

# Run with UI mode
npx playwright test perceptual-space-interconnection --ui

# Run with headed browser
npx playwright test perceptual-space-interconnection --headed

# Run with debug mode
npx playwright test perceptual-space-interconnection --debug
```

### Expected Output
```
Running 2 tests using 1 worker

✓ [chromium] › perceptual-space-interconnection.spec.ts:44:3 › should complete full perceptual space workflow
  Step 1: Loading Machine Interconnection View...
  ✓ Multi-Step machine loaded
  Step 2: Loading Multi-Step machine...
  ✓ Multi-Step machine loaded and configured
  Step 3: Creating input perceptual sequence...
  ✓ Input sequence loaded: 4 vectors
  Step 4: Executing initial vectors...
    Step 1: Input = [0,0,0]
    Step 2: Input = [1,0,0]
    Step 3: Input = [1,0,1]
    Perceptual space [3:5] = [0,0]
  ✓ Initial state verified: Multi-Step output = [0,0]
  Step 5: Executing final vector (1,1,1)...
    Step 4: Input = [1,1,1]
    Perceptual space [3:5] = [1,0]
  ✓ Multi-Step output verified: [1,0]
  Step 6: Verifying RS2 and RSFlipFlop perceive [1,0] as input...
    RS2 input [3:5] = [1,0]
    RSFlipFlop input [3:5] = [1,0]
  ✓ Both machines perceive correct input [1,0]
  Step 7: Loading RS2 machine...
    RS2 output [8:10] = [1,0]
  ✓ RS2 output verified: [1,0]
  Step 8: Loading RS Flip Flop machine...
    RSFlipFlop output [6:8] = [1,0]
  ✓ RS Flip Flop output verified: [1,0]
  Step 9: Verifying event propagation through perceptual space...
    Total simulation steps: 4
    Step 2: 1 event(s) activated
    Step 3: 1 event(s) activated
    Step 4: 1 event(s) activated
    Step 4: 1 output(s) generated
    Total active events: 3
    Total final events (outputs): 1
  ✓ Event propagation verified through perceptual space
  Step 10: Verifying complete perceptual space state...
    Final Perceptual Space State:
      Multi-Step input [0:3]:  [1,1,1]
      Multi-Step output [3:5]: [1,0]
      RS2/RSFlipFlop input [3:5]: [1,0]
      RSFlipFlop output [6:8]: [1,0]
      RS2 output [8:10]: [1,0]
  ✓ Complete perceptual space state verified
  ✅ Perceptual space interconnection test completed successfully!

✓ [chromium] › perceptual-space-interconnection.spec.ts:381:3 › should verify perceptual space consistency
  ✓ Perceptual space remains consistent across machine switches

2 passed (2.5m)
```

---

## Key Concepts Demonstrated

### 1. Perceptual Space as Communication Medium
- Machines communicate by writing to shared byte regions
- One machine's output becomes another machine's input
- No direct API calls between machines needed

### 2. Sequential Event Processing
- Multi-Step requires 3 inputs to complete sequence
- RS2 requires 2 inputs to complete sequence
- RSFlipFlop responds immediately to single input

### 3. Shared Input Regions
- Both RS2 and RSFlipFlop read from [3:5]
- They process the same input independently
- Each produces its own output in its own region

### 4. Binary Event Matching
- All inputs are binary (0 or 1)
- Matching uses equals comparator with 0.50 threshold
- Clean, deterministic behavior

### 5. Output Perception
- Final events trigger output generation
- Outputs are immediately perceived by downstream machines
- Active events are tracked throughout processing

---

## Troubleshooting

### Test Timeout
If the test times out:
```typescript
test.setTimeout(180000); // Increase to 3 minutes
```

### Perceptual Space Mismatch
Check that machines are loaded with correct perceptual mappings:
```bash
curl http://localhost:3001/api/machines/json/MultiStep
curl http://localhost:3001/api/machines/json/RS2
curl http://localhost:3001/api/machines/json/RSFlipFlop
```

### Simulation State Issues
Reset simulation between test runs:
```bash
curl -X POST http://localhost:3001/api/simulation/reset
```

### Memory Leaks During Test
Monitor backend memory:
```bash
docker stats reality-engine-visualizer-backend
```

---

## Future Enhancements

### 1. Add More Complex Sequences
Test with longer multi-step sequences and more machines

### 2. Test Concurrent Output Generation
Verify behavior when multiple machines output simultaneously

### 3. Add Perceptual Space Visualization
Capture screenshots of perceptual space state at each step

### 4. Test Error Conditions
Verify behavior with invalid inputs or corrupted perceptual space

### 5. Performance Testing
Measure latency of perceptual space propagation

---

## References

- **Machine Configurations:**
  - `examples/machines/MultiStep.json`
  - `examples/machines/RS2.json`
  - `examples/machines/RSFlipFlop.json`

- **Related Documentation:**
  - `PERCEPTUAL_SEQUENCE_LOGGING.md`
  - `LOGGING_QUICK_START.md`
  - `README.md` - Perceptual Space section

- **API Endpoints:**
  - `POST /api/simulation/load` - Load perceptual sequence
  - `POST /api/simulation/step` - Step simulation
  - `GET /api/simulation/state` - Get perceptual space state

---

## Summary

This test demonstrates the complete workflow of machine interconnection through perceptual space:

1. ✅ Multi-Step processes input sequence
2. ✅ Multi-Step outputs [1,0] on sequence completion
3. ✅ RS2 and RSFlipFlop both perceive Multi-Step output
4. ✅ RS2 completes 2-step sequence and outputs [1,0]
5. ✅ RSFlipFlop immediately responds and outputs [1,0]
6. ✅ All events propagate correctly through perceptual space
7. ✅ All inputs and outputs are binary
8. ✅ Perceptual space state is consistent

**Status:** ✅ **All assertions passing**

The test proves that the perceptual space interconnection mechanism works correctly for machine-to-machine communication without requiring direct API integration.
