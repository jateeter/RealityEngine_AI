import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector } from '../../models/types.js';

/**
 * Multi-Step Sequence Example
 *
 * Event Space: 3-dimensional binary vectors (000, 001, 010, 011, 100, 101, 110, 111)
 * Output Space: {00, 01, 10, 11} - 2-dimensional binary vectors
 *
 * This example demonstrates:
 * - Multi-step critical event sequences (depth = 3)
 * - State transitions through event chains
 * - Output assertion at terminal events
 */

/**
 * Create output vector from binary string
 */
function createOutput(binaryString: string, description: string): OutputVector {
  const vector = binaryString.split('').map(bit => parseFloat(bit));
  return {
    id: `output-${binaryString}`,
    vector,
    timestamp: Date.now(),
    metadata: { description, pattern: binaryString }
  };
}

/**
 * Create a 3D binary vector from binary string (e.g., "101" -> [1.0, 0.0, 1.0])
 */
function createBinaryVector(binaryString: string, isInitial: boolean = false): RealityVector {
  const elements = binaryString.split('').map(bit => ({
    value: parseFloat(bit),
    comparatorType: ComparatorType.EQUALS,
    threshold: 0.05
  }));

  return new RealityVector(elements, isInitial);
}

/**
 * Sequence 1: 000 → 001 → 011 (outputs 01)
 *
 * Flow:
 * - Initial state: 000 (vector [0,0,0])
 * - Transition to: 001 (vector [0,0,1])
 * - Transition to: 011 (vector [0,1,1]) → outputs [0,1]
 */
export function createSequence1(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Sequence 1: 000→001→011→[01]');

  // Event 000 (Initial)
  const event000 = createBinaryVector('000', true);
  event000.metadata = { name: '000', description: 'Initial state' };

  // Event 001
  const event001 = createBinaryVector('001', false);
  event001.metadata = { name: '001', description: 'First transition' };

  // Event 011 (Terminal with output)
  const event011 = createBinaryVector('011', false);
  event011.metadata = { name: '011', description: 'Terminal state' };
  event011.addOutputVector(createOutput('01', 'Sequence 1 complete: output [0,1]'));

  // Build chain: 000 → 001 → 011
  event000.addNextVector(event001.id);
  event001.addNextVector(event011.id);

  seq.addVector(event000);
  seq.addVector(event001);
  seq.addVector(event011);

  return seq;
}

/**
 * Sequence 2: 100 → 101 → 111 (outputs 10)
 *
 * Flow:
 * - Initial state: 100 (vector [1,0,0])
 * - Transition to: 101 (vector [1,0,1])
 * - Transition to: 111 (vector [1,1,1]) → outputs [1,0]
 */
export function createSequence2(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Sequence 2: 100→101→111→[10]');

  // Event 100 (Initial)
  const event100 = createBinaryVector('100', true);
  event100.metadata = { name: '100', description: 'Initial state' };

  // Event 101
  const event101 = createBinaryVector('101', false);
  event101.metadata = { name: '101', description: 'First transition' };

  // Event 111 (Terminal with output)
  const event111 = createBinaryVector('111', false);
  event111.metadata = { name: '111', description: 'Terminal state' };
  event111.addOutputVector(createOutput('10', 'Sequence 2 complete: output [1,0]'));

  // Build chain: 100 → 101 → 111
  event100.addNextVector(event101.id);
  event101.addNextVector(event111.id);

  seq.addVector(event100);
  seq.addVector(event101);
  seq.addVector(event111);

  return seq;
}

/**
 * Generate all sequences
 */
export function createMultiStepSequences(): CriticalEventSequence[] {
  return [
    createSequence1(),
    createSequence2()
  ];
}

/**
 * Create a Machine containing both multi-step sequences
 */
export function createMultiStepMachine(): Machine {
  const testVectors = generateTestVectors();

  const machine = new Machine(
    'Multi-Step State Machine',
    'Demonstrates 3-step critical event sequences with state transitions and binary outputs',
    {
      eventSpace: '3D binary vectors: 000-111',
      outputSpace: '2D binary vectors: {00, 01, 10, 11}',
      sequenceCount: 2,
      inputVectorCount: 11,
      description: 'Two independent sequences with distinct outputs',
      sequences: [
        { name: 'Sequence 1', path: '000→001→011', output: '[0,1]' },
        { name: 'Sequence 2', path: '100→101→111', output: '[1,0]' }
      ],
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.description,
        expectedOutput: tv.expectedOutput
      })),
      // Input sequences that trigger critical event outputs
      inputSequences: [
        {
          name: 'Sequence 1 Complete Path',
          pattern: '000→001→011',
          description: '3-step sequence producing [0,1] output',
          vectors: [
            [0, 0, 0],  // Initial state
            [0, 0, 1],  // Transition 1
            [0, 1, 1]   // Final state → outputs [0,1]
          ]
        },
        {
          name: 'Sequence 2 Complete Path',
          pattern: '100→101→111',
          description: '3-step sequence producing [1,0] output',
          vectors: [
            [1, 0, 0],  // Initial state
            [1, 0, 1],  // Transition 1
            [1, 1, 1]   // Final state → outputs [1,0]
          ]
        },
        {
          name: 'Both Sequences Interleaved',
          pattern: '000→001→011...100→101→111',
          description: 'Execute both sequences with outputs',
          vectors: [
            [0, 0, 0],  // Seq 1 start
            [0, 0, 1],  // Seq 1 step
            [0, 1, 1],  // Seq 1 complete → [0,1]
            [1, 0, 0],  // Seq 2 start
            [1, 0, 1],  // Seq 2 step
            [1, 1, 1]   // Seq 2 complete → [1,0]
          ]
        }
      ]
    }
  );

  // Add both sequences to the machine
  const sequences = createMultiStepSequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}

/**
 * Generate test input vectors for both sequences
 *
 * Input sequence: {000, 001, 101, 100, 101, 111, 000, 001, 011, 100, 101}
 *
 * Expected behavior:
 * - Sequence 1 path: 000 → 001 → 011 (outputs [0,1])
 * - Sequence 2 path: 100 → 101 → 111 (outputs [1,0])
 */
export function generateTestVectors(): Array<{ vector: number[]; description: string; expectedOutput?: string }> {
  return [
    { vector: [0, 0, 0], description: 'Vector 1: 000 - Activate Sequence 1' },
    { vector: [0, 0, 1], description: 'Vector 2: 001 - Sequence 1 transition (000→001)' },
    { vector: [1, 0, 1], description: 'Vector 3: 101 - Activate Sequence 2 intermediate state' },
    { vector: [1, 0, 0], description: 'Vector 4: 100 - Activate Sequence 2' },
    { vector: [1, 0, 1], description: 'Vector 5: 101 - Sequence 2 transition (100→101)' },
    { vector: [1, 1, 1], description: 'Vector 6: 111 - Sequence 2 complete (101→111)', expectedOutput: '10' },
    { vector: [0, 0, 0], description: 'Vector 7: 000 - Re-activate Sequence 1' },
    { vector: [0, 0, 1], description: 'Vector 8: 001 - Sequence 1 transition (000→001)' },
    { vector: [0, 1, 1], description: 'Vector 9: 011 - Sequence 1 complete (001→011)', expectedOutput: '01' },
    { vector: [1, 0, 0], description: 'Vector 10: 100 - Re-activate Sequence 2' },
    { vector: [1, 0, 1], description: 'Vector 11: 101 - Sequence 2 transition (100→101)' }
  ];
}
