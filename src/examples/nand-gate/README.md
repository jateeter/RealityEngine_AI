# NAND Gate Implementation - Reality Engine

This example demonstrates that the Reality Engine can replicate the black-box behavior of a **NAND logic gate** using critical event sequences.

## Why NAND?

NAND is a **universal logic gate** - meaning ALL digital computation can be built using only NAND gates. By proving the Reality Engine can implement NAND, we prove it can implement any computational system.

## NAND Truth Table

```
┌───┬───┬────────────┐
│ A │ B │ NAND(A, B) │
├───┼───┼────────────┤
│ 0 │ 0 │     1      │
│ 0 │ 1 │     1      │
│ 1 │ 0 │     1      │
│ 1 │ 1 │     0      │ ← Only FALSE case
└───┴───┴────────────┘
```

**NAND** = "NOT AND" = !(A AND B)

## Implementation

### Vector Format

- **Dimension 0**: Input A (0.0 = false, 1.0 = true)
- **Dimension 1**: Input B (0.0 = false, 1.0 = true)
- **Dimension 2**: Padding (0.5)

### Critical Event Sequences

Four sequences implement the complete NAND truth table:

1. **NAND(0, 0) = 1**: Matches `[0.0, 0.0, *]` → Outputs `[1.0]`
2. **NAND(0, 1) = 1**: Matches `[0.0, 1.0, *]` → Outputs `[1.0]`
3. **NAND(1, 0) = 1**: Matches `[1.0, 0.0, *]` → Outputs `[1.0]`
4. **NAND(1, 1) = 0**: Matches `[1.0, 1.0, *]` → Outputs `[0.0]`

Each sequence is a single initial vector that:
- Matches its specific input pattern using EQUALS comparators (threshold ±0.05)
- Produces the corresponding NAND output

## Running the Demo

```bash
# Compile TypeScript
npm run build

# Run the demonstration
node dist/examples/nand-gate/run-nand-demo.js
```

## Expected Output

The demo will:
1. Initialize the Reality Engine
2. Load 4 NAND sequences
3. Test all 4 truth table cases
4. Run comprehensive tests with repetitions
5. Display results and verify correctness

## Significance

This demonstration proves:
- ✅ Reality Engine can implement discrete logic
- ✅ Critical event sequences can encode computational rules
- ✅ Universal computation is possible (via NAND universality)
- ✅ Black-box behavior can be perfectly replicated

## Files

- `nand-gate-sequences.ts` - NAND sequence definitions
- `run-nand-demo.ts` - Demonstration runner
- `README.md` - This file
