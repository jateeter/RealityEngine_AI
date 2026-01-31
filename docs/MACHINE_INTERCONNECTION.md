# Machine Interconnection via Perceptual Space

## Overview

The Reality Engine implements a **perceptual space architecture** that allows machines to be interconnected through a shared n-dimensional reality representation. This architecture enables complex data flows where the output of one machine becomes the input to another, creating sophisticated multi-machine systems.

## Architecture

### Perceptual Space (En)

The **perceptual space** is an n-dimensional vector (default: 256 dimensions) that represents our overall perception of reality. All machines share this common space but view different portions of it.

```typescript
const perceptualSpace = new PerceptualSpace(256);  // Creates 256-dimensional space
```

### Machine Input Mapping (Em)

Each machine views a **continuous portion** of the perceptual space as its input. This is defined by:
- **offset**: Starting index in the perceptual space
- **length**: Number of dimensions to read

```typescript
const inputMapping = {
  offset: 0,   // Start at index 0
  length: 3    // Read 3 dimensions (En[0:3])
};
```

The machine extracts its input vector (Em) from the perceptual space (En) using this mapping.

### Machine Output Mapping (Ox)

When a machine produces output, it writes to another portion of the perceptual space:
- **offset**: Starting index for output
- **length**: Number of dimensions to write

```typescript
const outputMapping = {
  offset: 3,   // Start writing at index 3
  length: 2    // Write 2 dimensions (En[3:5])
};
```

The machine's output vector (Ox) is merged back into the perceptual space (En), updating our perception of reality.

## Perceptual Mapping

A complete **perceptual mapping** defines both input and output regions:

```typescript
import type { PerceptualMapping } from './models/types.js';

const mapping: PerceptualMapping = {
  input: {
    offset: 0,
    length: 3
  },
  output: {
    offset: 3,
    length: 2
  }
};
```

## Connecting Machines

Machines can be connected by having one machine's output region overlap with another machine's input region.

### Example: Multi-Step Machine → RS Flip-Flop

```
┌─────────────────────────────────────────────────────────┐
│ Perceptual Space (En) - 256 dimensions                  │
│                                                          │
│ [0  1  2][3  4][5][6  7][8  9 ... 255]                  │
│  ↑─────↑  ↑──↑     ↑──↑                                  │
│  Multi-  Multi-    RS                                    │
│  Step    Step      Flip-                                 │
│  Input   Output    Flop                                  │
│  (Em1)   (Ox1)     Output                                │
│           ↓        (Ox2)                                  │
│           ↓                                               │
│           ↓──────→ RS Flip-Flop Input (Em2)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Multi-Step Machine Configuration:**
```typescript
const multiStepMapping: PerceptualMapping = {
  input: { offset: 0, length: 3 },   // Reads En[0:3]
  output: { offset: 3, length: 2 }   // Writes to En[3:5]
};
```

**RS Flip-Flop Configuration:**
```typescript
const rsFlipFlopMapping: PerceptualMapping = {
  input: { offset: 3, length: 2 },   // Reads En[3:5] (Multi-Step output!)
  output: { offset: 6, length: 2 }   // Writes to En[6:8]
};
```

## Usage

### 1. Create Machines with Perceptual Mappings

```typescript
import { Machine } from './models/Machine.js';
import { PerceptualSpace } from './models/PerceptualSpace.js';
import { ArbiterRule } from './models/types.js';

// Create machine with perceptual mapping
const machine = new Machine(
  'My Machine',
  'Description',
  { category: 'example' },
  ArbiterRule.PASSTHROUGH,
  {
    input: { offset: 0, length: 3 },
    output: { offset: 3, length: 2 }
  }
);
```

### 2. Create Shared Perceptual Space

```typescript
const perceptualSpace = new PerceptualSpace(256);
```

### 3. Set Initial Input

```typescript
// Set the input region for the first machine
perceptualSpace.updateRegion(0, [1, 0, 0]);
```

### 4. Process Through Machines

```typescript
// Process through first machine
const result1 = machine1.processInputFromPerceptualSpace(perceptualSpace);

// The output from machine1 is now in En[3:5]
// Process through second machine (which reads En[3:5])
const result2 = machine2.processInputFromPerceptualSpace(perceptualSpace);

// The final output is now in En[6:8]
```

### 5. Inspect Perceptual Space

```typescript
// View different regions
console.log('Machine 1 input:',  perceptualSpace.getRegion(0, 3));  // [1, 0, 0]
console.log('Machine 1 output:', perceptualSpace.getRegion(3, 2));  // [1, 0]
console.log('Machine 2 output:', perceptualSpace.getRegion(6, 2));  // [1, 0]
```

## API Reference

### PerceptualSpace Class

```typescript
class PerceptualSpace {
  constructor(dimension: number = 256)

  // Get the complete perceptual vector
  getPerceptualVector(): number[]

  // Set the entire perceptual vector
  setPerceptualVector(vector: number[]): void

  // Extract machine input using a mapping
  extractMachineInput(mapping: PerceptualMapping): number[]

  // Merge machine output back into perceptual space
  mergeMachineOutput(outputVector: number[], mapping: PerceptualMapping): void

  // Update a specific region
  updateRegion(offset: number, values: number[]): void

  // Get a specific region
  getRegion(offset: number, length: number): number[]

  // Reset to zeros
  reset(): void

  // Get dimension
  getDimension(): number

  // Validate a mapping
  static validateMapping(mapping: PerceptualMapping, dimension: number):
    { valid: boolean; errors: string[] }

  // Serialization
  toJSON(): any
  static fromJSON(json: any): PerceptualSpace
}
```

### Machine Class (Perceptual Space Methods)

```typescript
class Machine {
  // Perceptual mapping property
  perceptualMapping?: PerceptualMapping

  // Process input from perceptual space
  processInputFromPerceptualSpace(perceptualSpace: PerceptualSpace):
    MachineTransitionResult

  // Set perceptual mapping
  setPerceptualMapping(mapping: PerceptualMapping): void

  // Get perceptual mapping
  getPerceptualMapping(): PerceptualMapping | undefined
}
```

## Complete Example

See `examples/machine-interconnection-example.ts` for a complete working example that demonstrates:

1. Creating a Multi-Step State Machine
2. Creating an RS Flip-Flop
3. Connecting them via perceptual space
4. Processing inputs through the connected system
5. Inspecting the final state

To run the example:

```bash
npm run build
node dist/examples/machine-interconnection-example.js
```

## Benefits

1. **Modularity**: Machines can be designed independently and connected later
2. **Flexibility**: Mappings can be changed without modifying machine logic
3. **Scalability**: Multiple machines can share the same perceptual space
4. **Composability**: Complex systems can be built from simple machines
5. **Inspection**: The entire system state is visible in the perceptual space

## Design Considerations

### Mapping Overlap

- **Output → Input**: Machine A's output region should overlap with Machine B's input region for data flow
- **Avoid conflicts**: Ensure machines don't write to overlapping output regions unless intentional

### Dimension Planning

With a 256-dimensional perceptual space, plan your mappings carefully:

```
Example allocation:
En[0:10]    - Sensor inputs
En[10:50]   - Processing layer 1
En[50:100]  - Processing layer 2
En[100:150] - Processing layer 3
En[150:200] - Final outputs
En[200:256] - Reserved/unused
```

### Validation

Always validate mappings before use:

```typescript
const validation = PerceptualSpace.validateMapping(mapping, 256);
if (!validation.valid) {
  console.error('Invalid mapping:', validation.errors);
}
```

## Future Enhancements

Potential future features:

1. **Dynamic routing**: Automatic mapping assignment based on machine requirements
2. **Overlap detection**: Warnings for unintended mapping conflicts
3. **Visualization**: Graphical view of perceptual space allocation
4. **Persistence**: Save/load perceptual space state
5. **Multi-space**: Support for multiple independent perceptual spaces

## References

- Architecture description: `machineInterconnections.txt`
- Type definitions: `src/models/types.ts`
- Implementation: `src/models/PerceptualSpace.ts`
- Machine integration: `src/models/Machine.ts`
- Example code: `examples/machine-interconnection-example.ts`
