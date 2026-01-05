import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector } from '../../models/types.js';

/**
 * NAND Gate Implementation using Reality Engine
 *
 * Truth Table:
 * A | B | NAND(A,B)
 * --+---+----------
 * 0 | 0 | 1
 * 0 | 1 | 1
 * 1 | 0 | 1
 * 1 | 1 | 0
 *
 * Vector Format: [A, B, padding]
 * - Dimension 0: Input A (0.0 = false, 1.0 = true)
 * - Dimension 1: Input B (0.0 = false, 1.0 = true)
 * - Dimension 2: Padding (0.5)
 *
 * Output Format: [result]
 * - 1.0 = true
 * - 0.0 = false
 */

// Helper to create output vectors
function createOutput(value: number, description: string): OutputVector {
  return {
    id: `nand-output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vector: [value],
    timestamp: Date.now(),
    metadata: {
      description,
      logicValue: value === 1.0 ? 'TRUE' : 'FALSE',
      gate: 'NAND'
    }
  };
}

/**
 * Sequence 1: NAND(0, 0) = 1
 * When A=0 and B=0, output should be 1 (TRUE)
 */
export function createNAND_00_Sequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('NAND: A=0, B=0 → Output=1');

  // Match vector [0.0, 0.0, *]
  const inputState = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // A = 0
      { value: 0.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // B = 0
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.5 } // padding (any)
    ],
    true  // This is an initial vector
  );

  // Output: 1 (TRUE)
  inputState.addOutputVector(createOutput(1.0, 'NAND(0, 0) = 1'));

  seq.addVector(inputState);
  return seq;
}

/**
 * Sequence 2: NAND(0, 1) = 1
 * When A=0 and B=1, output should be 1 (TRUE)
 */
export function createNAND_01_Sequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('NAND: A=0, B=1 → Output=1');

  // Match vector [0.0, 1.0, *]
  const inputState = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // A = 0
      { value: 1.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // B = 1
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.5 } // padding (any)
    ],
    true
  );

  // Output: 1 (TRUE)
  inputState.addOutputVector(createOutput(1.0, 'NAND(0, 1) = 1'));

  seq.addVector(inputState);
  return seq;
}

/**
 * Sequence 3: NAND(1, 0) = 1
 * When A=1 and B=0, output should be 1 (TRUE)
 */
export function createNAND_10_Sequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('NAND: A=1, B=0 → Output=1');

  // Match vector [1.0, 0.0, *]
  const inputState = new RealityVector(
    [
      { value: 1.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // A = 1
      { value: 0.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // B = 0
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.5 } // padding (any)
    ],
    true
  );

  // Output: 1 (TRUE)
  inputState.addOutputVector(createOutput(1.0, 'NAND(1, 0) = 1'));

  seq.addVector(inputState);
  return seq;
}

/**
 * Sequence 4: NAND(1, 1) = 0
 * When A=1 and B=1, output should be 0 (FALSE)
 */
export function createNAND_11_Sequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('NAND: A=1, B=1 → Output=0');

  // Match vector [1.0, 1.0, *]
  const inputState = new RealityVector(
    [
      { value: 1.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // A = 1
      { value: 1.0, comparatorType: ComparatorType.EQUALS, threshold: 0.05 },  // B = 1
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.5 } // padding (any)
    ],
    true
  );

  // Output: 0 (FALSE) - This is the only case where NAND outputs FALSE
  inputState.addOutputVector(createOutput(0.0, 'NAND(1, 1) = 0'));

  seq.addVector(inputState);
  return seq;
}

/**
 * Create all NAND gate sequences
 */
export function createNANDGateSequences(): CriticalEventSequence[] {
  return [
    createNAND_00_Sequence(),
    createNAND_01_Sequence(),
    createNAND_10_Sequence(),
    createNAND_11_Sequence()
  ];
}

/**
 * Generate test input vectors for all NAND truth table cases
 */
export function generateNANDTestVectors(): Array<{ vector: number[]; label: string; expectedOutput: number }> {
  return [
    {
      vector: [0.0, 0.0, 0.5],
      label: 'NAND(0, 0)',
      expectedOutput: 1.0
    },
    {
      vector: [0.0, 1.0, 0.5],
      label: 'NAND(0, 1)',
      expectedOutput: 1.0
    },
    {
      vector: [1.0, 0.0, 0.5],
      label: 'NAND(1, 0)',
      expectedOutput: 1.0
    },
    {
      vector: [1.0, 1.0, 0.5],
      label: 'NAND(1, 1)',
      expectedOutput: 0.0
    }
  ];
}

/**
 * Generate comprehensive test suite including edge cases
 */
export function generateComprehensiveNANDTests(): Array<{ vector: number[]; label: string; expectedOutput: number }> {
  const tests = generateNANDTestVectors();

  // Add repeated tests to verify consistency
  tests.push(
    { vector: [0.0, 0.0, 0.5], label: 'NAND(0, 0) - Test 2', expectedOutput: 1.0 },
    { vector: [1.0, 1.0, 0.5], label: 'NAND(1, 1) - Test 2', expectedOutput: 0.0 },
    { vector: [0.0, 1.0, 0.5], label: 'NAND(0, 1) - Test 2', expectedOutput: 1.0 },
    { vector: [1.0, 0.0, 0.5], label: 'NAND(1, 0) - Test 2', expectedOutput: 1.0 }
  );

  return tests;
}

/**
 * Create a NAND Gate Machine with all truth table sequences
 */
export function createNANDGateMachine(): Machine {
  const sequences = createNANDGateSequences();
  const testVectors = generateNANDTestVectors();

  const machine = new Machine(
    'NAND Gate',
    'Complete NAND gate logic implementation with all truth table cases',
    {
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.label,
        expectedOutput: tv.expectedOutput
      }))
    }
  );

  for (const sequence of sequences) {
    machine.addSequence(sequence);
  }

  return machine;
}
