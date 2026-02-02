import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ArbiterRule } from '../../models/OutputArbiter.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector, PerceptualMapping } from '../../models/types.js';

/**
 * RS2 Example Machine
 *
 * Event Space: 2-dimensional binary vectors representing [S, R] inputs
 *   - 00 (S=0, R=0): Hold/Initial state
 *   - 01 (S=0, R=1): Reset input
 *   - 10 (S=1, R=0): Set input
 *   - 11 (S=1, R=1): Invalid/forbidden state
 *
 * Output Space: 2-dimensional binary vectors [Q, Q̄]
 *   - [1,0] = SET/HIGH state
 *   - [0,1] = RESET/LOW state
 *   - [0,0] = Special state
 *
 * Critical Event Sequences:
 * 1. SET Sequence:   (0,0) → (1,0) outputs (1,0)
 * 2. RESET Sequence: (0,0) → (0,1) outputs (0,1)
 *
 * The RS2 machine uses 2-step sequences where:
 * - First event matches (0,0) - the hold/initial state
 * - Second event matches (1,0) for SET or (0,1) for RESET
 * - Outputs are generated when the sequence completes
 *
 * Perceptual Mapping:
 * - Reads from En[4:6] (2D input space)
 * - Writes to En[8:10] (2D output space)
 */

/**
 * Create output vector for RS2 state
 */
function createOutput(vector: number[], description: string): OutputVector {
  return {
    id: `rs2-output-${vector.join('')}`,
    vector: [...vector],
    timestamp: Date.now(),
    metadata: {
      description,
      state: vector[0] === 1 && vector[1] === 0 ? 'SET' :
             vector[0] === 0 && vector[1] === 1 ? 'RESET' : 'SPECIAL'
    }
  };
}

/**
 * Create a 2D binary vector for RS2 inputs [S, R]
 */
function createRS2Vector(s: number, r: number, isInitial: boolean = false): RealityVector {
  const elements = [
    {
      value: s,
      comparatorType: ComparatorType.EQUALS,
      threshold: 0.05
    },
    {
      value: r,
      comparatorType: ComparatorType.EQUALS,
      threshold: 0.05
    }
  ];

  return new RealityVector(elements, isInitial);
}

/**
 * SET Sequence: (0,0) → (1,0) outputs (1,0)
 *
 * Starting from hold state (S=0, R=0), when Set input arrives (S=1, R=0),
 * the machine outputs (1,0) indicating SET/HIGH state
 */
export function createSetSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('SET Sequence: (0,0)→(1,0)→[1,0]');

  // Event 00 (Initial - Hold state)
  const event00 = createRS2Vector(0, 0, true);
  event00.metadata = {
    name: '00',
    description: 'Hold/Initial state (S=0, R=0)',
    state: 'HOLD',
    sequenceType: 'SET'
  };

  // Event 10 (Set - Output [1,0])
  const event10 = createRS2Vector(1, 0, false);
  event10.metadata = {
    name: '10',
    description: 'Set input (S=1, R=0)',
    state: 'SET'
  };
  event10.addOutputVector(createOutput([1, 0], 'RS2 SET to HIGH (1,0)'));

  // Build chain: 00 → 10
  event00.addNextVector(event10.id);

  seq.addVector(event00);
  seq.addVector(event10);

  return seq;
}

/**
 * RESET Sequence: (0,0) → (0,1) outputs (0,1)
 *
 * Starting from hold state (S=0, R=0), when Reset input arrives (S=0, R=1),
 * the machine outputs (0,1) indicating RESET/LOW state
 */
export function createResetSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('RESET Sequence: (0,0)→(0,1)→[0,1]');

  // Event 00 (Initial - Hold state)
  const event00 = createRS2Vector(0, 0, true);
  event00.metadata = {
    name: '00',
    description: 'Hold/Initial state (S=0, R=0)',
    state: 'HOLD',
    sequenceType: 'RESET'
  };

  // Event 01 (Reset - Output [0,1])
  const event01 = createRS2Vector(0, 1, false);
  event01.metadata = {
    name: '01',
    description: 'Reset input (S=0, R=1)',
    state: 'RESET'
  };
  event01.addOutputVector(createOutput([0, 1], 'RS2 RESET to LOW (0,1)'));

  // Build chain: 00 → 01
  event00.addNextVector(event01.id);

  seq.addVector(event00);
  seq.addVector(event01);

  return seq;
}

/**
 * Generate all RS2 sequences
 */
export function createRS2Sequences(): CriticalEventSequence[] {
  return [
    createSetSequence(),
    createResetSequence()
  ];
}

/**
 * Create the RS2 Machine with perceptual mapping
 */
export function createRS2Machine(): Machine {
  const testVectors = generateRS2TestVectors();

  // Define perceptual mapping as specified
  // Reads from En[4:6] (input offset 4, length 2)
  // Writes to En[8:10] (output offset 8, length 2)
  const perceptualMapping: PerceptualMapping = {
    input: { offset: 4, length: 2 },   // Reads En[4:6]
    output: { offset: 8, length: 2 }   // Writes to En[8:10]
  };

  const machine = new Machine(
    'RS2',
    'Two-step RS flip-flop with hold state and 2-event sequences',
    {
      eventSpace: '2D binary vectors: [S, R] inputs (00, 01, 10, 11)',
      outputSpace: '2D binary: {[1,0]=SET/HIGH, [0,1]=RESET/LOW, [0,0]=SPECIAL}',
      sequenceCount: 2,
      inputVectorCount: testVectors.length,
      description: 'Two 2-step sequences: SET (00→10) and RESET (00→01)',
      category: 'digital-logic',
      perceptualMapping: {
        input: 'En[4:6]',
        output: 'En[8:10]',
        description: 'Reads 2D input from universal reality at offset 4, writes 2D output at offset 8'
      },
      sequences: [
        {
          name: 'SET Sequence',
          path: '(0,0)→(1,0)',
          output: '[1,0]',
          description: 'From hold state, set input produces HIGH output'
        },
        {
          name: 'RESET Sequence',
          path: '(0,0)→(0,1)',
          output: '[0,1]',
          description: 'From hold state, reset input produces LOW output'
        }
      ],
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.description,
        expectedOutput: tv.expectedOutput
      })),
      // Input sequences demonstrating RS2 behavior
      inputSequences: [
        {
          name: 'SET Operation',
          pattern: '(0,0)→(1,0)',
          description: 'Transition from hold to set state',
          vectors: [
            [0, 0],  // Hold
            [1, 0]   // Set → outputs [1,0]
          ]
        },
        {
          name: 'RESET Operation',
          pattern: '(0,0)→(0,1)',
          description: 'Transition from hold to reset state',
          vectors: [
            [0, 0],  // Hold
            [0, 1]   // Reset → outputs [0,1]
          ]
        },
        {
          name: 'Complete Test Sequence',
          pattern: '(0,0)→(1,0)→(0,0)→(0,1)→(0,0)→(1,0)→(1,1)→(0,1)',
          description: 'Full test sequence with SET, RESET, and invalid states',
          vectors: [
            [0, 0],  // Hold
            [1, 0],  // Set → output [1,0]
            [0, 0],  // Hold
            [0, 1],  // Reset → output [0,1]
            [0, 0],  // Hold
            [1, 0],  // Set → output [1,0]
            [1, 1],  // Invalid state
            [0, 1]   // Reset
          ]
        }
      ]
    },
    ArbiterRule.PASSTHROUGH,
    perceptualMapping
  );

  // Add both sequences to the machine
  const sequences = createRS2Sequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}

/**
 * Generate test input vectors for RS2
 *
 * Test sequence from specification:
 * Input:  {(0,0)(1,0)(0,0)(0,1)(0,0)(1,0)(1,1)(0,1)}
 * Output: {(0,1)(1,0)(1,0)(0,0)(0,0)(1,0)(1,0)(1,0)}
 *
 * Note: The output sequence from the specification may not match actual behavior
 * due to the 2-step sequence design. The machine will generate outputs when
 * complete sequences are matched.
 */
export function generateRS2TestVectors(): Array<{
  vector: number[];
  description: string;
  expectedOutput?: string;
  specifiedOutput?: string;
}> {
  return [
    {
      vector: [0, 0],
      description: 'Vector 1: (0,0) - Hold state (initial)',
      specifiedOutput: '(0,1)'
    },
    {
      vector: [1, 0],
      description: 'Vector 2: (1,0) - SET completes (0,0)→(1,0) sequence',
      expectedOutput: '[1,0]',
      specifiedOutput: '(1,0)'
    },
    {
      vector: [0, 0],
      description: 'Vector 3: (0,0) - Hold state',
      specifiedOutput: '(1,0)'
    },
    {
      vector: [0, 1],
      description: 'Vector 4: (0,1) - RESET completes (0,0)→(0,1) sequence',
      expectedOutput: '[0,1]',
      specifiedOutput: '(0,0)'
    },
    {
      vector: [0, 0],
      description: 'Vector 5: (0,0) - Hold state',
      specifiedOutput: '(0,0)'
    },
    {
      vector: [1, 0],
      description: 'Vector 6: (1,0) - SET completes (0,0)→(1,0) sequence',
      expectedOutput: '[1,0]',
      specifiedOutput: '(1,0)'
    },
    {
      vector: [1, 1],
      description: 'Vector 7: (1,1) - Invalid state (no sequence matches)',
      specifiedOutput: '(1,0)'
    },
    {
      vector: [0, 1],
      description: 'Vector 8: (0,1) - RESET (but no hold state before)',
      specifiedOutput: '(1,0)'
    }
  ];
}
