# RS Flip-Flop Example - Introduction

## Overview

The **RS Flip-Flop** example has been (re-)introduced to the Reality Engine! This comprehensive example demonstrates how to implement a fundamental digital logic component using Critical Event Sequences.

## What's Included

### 📜 Scripts

1. **`/scripts/examples/rs-flipflop.sh`** ✅
   - Creates the RS flip-flop sequence via API
   - Sets up a complete machine
   - Includes comprehensive metadata
   - Executable: `chmod +x` applied

2. **`/scripts/examples/test-rs-flipflop.sh`** ✅
   - Comprehensive test suite
   - Tests all 5 states (RESET, SET, HOLD×2, INVALID)
   - Demonstrates state transitions
   - Verifies bistable memory behavior
   - Executable: `chmod +x` applied

### 📚 Documentation

1. **`/docs/examples/RS_FLIPFLOP.md`** ✅
   - Complete technical documentation
   - Implementation details
   - State transition diagrams
   - Usage instructions
   - Theory and applications
   - Visual examples

2. **`/scripts/examples/RS_FLIPFLOP_QUICKREF.md`** ✅
   - Quick reference card
   - Truth table
   - API usage examples
   - Common commands
   - Troubleshooting

3. **`/scripts/examples/README.md`** ✅
   - Updated examples index
   - Includes RS flip-flop entry
   - Quick links and complexity ratings
   - Getting started guide

### 📊 Reference Data

1. **`/data/rs-flipflop.json`** ✅
   - Complete flip-flop specification
   - Truth table in JSON format
   - Test vectors
   - Implementation details
   - Visualization metadata

## Quick Start

```bash
# 1. Navigate to project root
cd /Users/johnt/workspace/GitHub/RealityEngine_AI

# 2. Start Reality Engine (if not running)
./scripts/start.sh

# 3. Create the RS flip-flop
./scripts/examples/rs-flipflop.sh

# 4. Test it
./scripts/examples/test-rs-flipflop.sh

# 5. View in visualizer
open http://localhost:5173
```

## What is an RS Flip-Flop?

An **RS (Reset-Set) flip-flop** is:
- A 1-bit **bistable memory** element
- The simplest form of **sequential logic**
- Has two stable states: **SET (Q=1)** and **RESET (Q=0)**
- Can **hold** its state indefinitely
- Forms the basis for more complex flip-flops (D, JK, T)

### Truth Table

| S (Set) | R (Reset) | Q | Q' | State |
|---------|-----------|---|-------|---------|
| 0 | 0 | * | *' | **HOLD** (memory) |
| 0 | 1 | 0 | 1 | **RESET** |
| 1 | 0 | 1 | 0 | **SET** |
| 1 | 1 | 1 | 1 | **INVALID** |

## Implementation Highlights

### 5 Critical Event Vectors

1. **RESET State** (Initial)
   - Input: [0, 1]
   - Output: [0, 1]
   - Color: Red 🔴

2. **SET State** (Initial)
   - Input: [1, 0]
   - Output: [1, 0]
   - Color: Green 🟢

3. **HOLD from RESET**
   - Input: [0, 0]
   - Output: [0, 1]
   - Color: Blue 🔵

4. **HOLD from SET**
   - Input: [0, 0]
   - Output: [1, 0]
   - Color: Blue 🔵

5. **INVALID State**
   - Input: [1, 1]
   - Output: [1, 1]
   - Color: Orange 🟠
   - Warning: Avoid in practice

### Metadata

Each state includes:
- State name
- Description
- Color coding
- Q and Q_bar values
- Warnings for invalid states

## Example Test Sequence

```bash
# The test script will run this sequence:

Step 1: RESET    [0,1] → Q=0, Q'=1  ✓
Step 2: HOLD     [0,0] → Q=0, Q'=1  ✓ (maintains RESET)
Step 3: SET      [1,0] → Q=1, Q'=0  ✓
Step 4: HOLD     [0,0] → Q=1, Q'=0  ✓ (maintains SET)
Step 5: RESET    [0,1] → Q=0, Q'=1  ✓
Step 6: SET      [1,0] → Q=1, Q'=0  ✓
Step 7: INVALID  [1,1] → Q=1, Q'=1  ⚠ (undefined)
Step 8: RESET    [0,1] → Q=0, Q'=1  ✓ (recovery)
```

## Visualization

In the D3.js force-directed graph visualizer, you'll see:

- **5 event nodes** arranged in clusters
- **Color-coded states**:
  - Blue circles: Initial events (RESET, SET)
  - Green circles: Active events
  - Orange borders: Events with outputs
- **State transitions** as directed edges
- **Hover tooltips** showing:
  - Input values (S, R)
  - Output values (Q, Q')
  - State metadata
  - Vector elements with comparators

## Educational Value

The RS flip-flop teaches:

1. **Bistable Memory**
   - Two stable states
   - Holds information
   - Foundation of digital memory

2. **Sequential Logic**
   - Output depends on history
   - State machines
   - Event-driven behavior

3. **Critical Event Sequences**
   - Multiple stable states as events
   - State transitions as sequences
   - Conditional outputs

4. **Real-World Applications**
   - Memory cells (RAM building block)
   - Debouncing circuits
   - Control systems
   - Synchronization

## Files Created

```
/Users/johnt/workspace/GitHub/RealityEngine_AI/
├── scripts/examples/
│   ├── rs-flipflop.sh              ✅ Main script
│   ├── test-rs-flipflop.sh         ✅ Test suite
│   ├── RS_FLIPFLOP_QUICKREF.md     ✅ Quick reference
│   └── README.md                   ✅ Updated index
├── docs/examples/
│   └── RS_FLIPFLOP.md              ✅ Full documentation
├── data/
│   └── rs-flipflop.json            ✅ Reference data
└── RS_FLIPFLOP_INTRODUCTION.md     ✅ This file
```

## Usage Examples

### Manual API Testing

```bash
PORT=3000
API_URL="http://localhost:$PORT/api"
SEQUENCE_ID="<your-sequence-id>"

# RESET
curl -X POST $API_URL/sequences/$SEQUENCE_ID/transition \
  -H 'Content-Type: application/json' \
  -d '{"vector": [0, 1]}'

# SET
curl -X POST $API_URL/sequences/$SEQUENCE_ID/transition \
  -H 'Content-Type: application/json' \
  -d '{"vector": [1, 0]}'

# HOLD
curl -X POST $API_URL/sequences/$SEQUENCE_ID/transition \
  -H 'Content-Type: application/json' \
  -d '{"vector": [0, 0]}'
```

### Programmatic Usage

```javascript
// Node.js example
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const SEQUENCE_ID = '<your-sequence-id>';

async function testFlipFlop() {
  // RESET
  await axios.post(`${API_URL}/sequences/${SEQUENCE_ID}/transition`, {
    vector: [0, 1]
  });

  // SET
  await axios.post(`${API_URL}/sequences/${SEQUENCE_ID}/transition`, {
    vector: [1, 0]
  });

  // HOLD
  await axios.post(`${API_URL}/sequences/${SEQUENCE_ID}/transition`, {
    vector: [0, 0]
  });
}
```

## Next Steps

### Try These Variations

1. **D Flip-Flop**
   - Add a clock signal
   - Single D input
   - Edge-triggered behavior

2. **JK Flip-Flop**
   - Fix the invalid state
   - J=1, K=1 → TOGGLE
   - No undefined states

3. **T Flip-Flop**
   - Single toggle input
   - T=1 → Toggle state
   - T=0 → Hold

4. **Shift Register**
   - Chain multiple flip-flops
   - Serial data transfer
   - Parallel output

5. **Counter**
   - Connect flip-flops in sequence
   - Ripple carry
   - Binary counting

## Resources

### Documentation
- Full docs: `/docs/examples/RS_FLIPFLOP.md`
- Quick ref: `/scripts/examples/RS_FLIPFLOP_QUICKREF.md`
- Examples index: `/scripts/examples/README.md`

### Scripts
- Create: `./scripts/examples/rs-flipflop.sh`
- Test: `./scripts/examples/test-rs-flipflop.sh`

### Data
- Specification: `/data/rs-flipflop.json`

### External
- [RS Flip-Flop - Wikipedia](https://en.wikipedia.org/wiki/Flip-flop_(electronics)#RS_flip-flop)
- [Digital Logic Design](https://www.electronics-tutorials.ws/sequential/seq_1.html)

## Support

### Troubleshooting

**Services not running?**
```bash
./scripts/start.sh
./scripts/status.sh
```

**Script errors?**
```bash
chmod +x ./scripts/examples/*.sh
./scripts/logs.sh
```

**Visualizer not loading?**
```
http://localhost:5173
# Check: ./scripts/status.sh
```

### Getting Help

1. Check the documentation in `/docs/examples/RS_FLIPFLOP.md`
2. Review the quick reference in `RS_FLIPFLOP_QUICKREF.md`
3. Run the test suite: `./test-rs-flipflop.sh`
4. View logs: `./scripts/logs.sh`

## Conclusion

The RS flip-flop example is now fully integrated into the Reality Engine! It demonstrates:

✅ **Bistable memory** - Two stable states
✅ **Sequential logic** - State-dependent behavior
✅ **Event sequences** - State transitions
✅ **Visual feedback** - D3.js force-directed graph
✅ **Complete testing** - Comprehensive test suite
✅ **Full documentation** - Guides and references

Use this as a foundation for building more complex sequential circuits and memory elements!

---

**Try it now:**
```bash
./scripts/examples/rs-flipflop.sh
./scripts/examples/test-rs-flipflop.sh
open http://localhost:5173
```

Enjoy exploring digital logic with the RS flip-flop! 🎛️✨
