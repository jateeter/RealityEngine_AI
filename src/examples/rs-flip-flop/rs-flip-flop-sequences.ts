import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ArbiterRule } from '../../models/OutputArbiter.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector, PerceptualMapping } from '../../models/types.js';

/**
 * RS Flip Flop Example
 *
 * Event Space: 2-dimensional binary vectors representing [S, R] inputs
 *   - 00 (S=0, R=0): Hold state
 *   - 01 (S=0, R=1): Reset to 0
 *   - 10 (S=1, R=0): Set to 1
 *   - 11 (S=1, R=1): Invalid/forbidden state
 *
 * Output Space: {0, 1} - single bit representing flip flop state
 *
 * Critical Event Sequences:
 * 1. SET Sequence:   00 → 10 (outputs 1)
 * 2. RESET Sequence: 00 → 01 (outputs 0)
 *
 * The flip flop starts in a stable state (00) and transitions to
 * either Set (10) or Reset (01) to change its output state.
 */

/**
 * Create output vector for flip flop state
 * Output is 2D: [Q, Q̄] where Q is the state and Q̄ is the complement
 */
function createOutput(state: number, description: string): OutputVector {
  return {
    id: `rs-output-${state}`,
    vector: state === 1 ? [1, 0] : [0, 1],  // [Q, Q̄]
    timestamp: Date.now(),
    metadata: {
      description,
      state: state === 1 ? 'SET' : 'RESET',
      logicValue: state === 1 ? 'HIGH' : 'LOW',
      qOutput: state === 1 ? 1 : 0,
      qBarOutput: state === 1 ? 0 : 1
    }
  };
}

/**
 * Create a 2D binary vector for RS inputs [S, R]
 */
function createRSVector(s: number, r: number, isInitial: boolean = false): RealityVector {
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
 * SET Sequence: 00 → 10 (outputs 1)
 *
 * Starting from stable state (S=0, R=0), when Set input goes high (S=1, R=0),
 * the flip flop outputs 1 (HIGH/SET state)
 */
export function createSetSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('SET Sequence: 00→10→[1]');

  // Event 00 (Initial - Hold state)
  const event00 = createRSVector(0, 0, true);
  event00.metadata = {
    name: '00',
    description: 'Stable state (S=0, R=0)',
    state: 'HOLD'
  };

  // Event 10 (Set - Output HIGH)
  const event10 = createRSVector(1, 0, false);
  event10.metadata = {
    name: '10',
    description: 'Set state (S=1, R=0)',
    state: 'SET'
  };
  event10.addOutputVector(createOutput(1, 'Flip flop SET to HIGH (1)'));

  // Build chain: 00 → 10
  event00.addNextVector(event10.id);

  seq.addVector(event00);
  seq.addVector(event10);

  return seq;
}

/**
 * RESET Sequence: 00 → 01 (outputs 0)
 *
 * Starting from stable state (S=0, R=0), when Reset input goes high (S=0, R=1),
 * the flip flop outputs 0 (LOW/RESET state)
 */
export function createResetSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('RESET Sequence: 00→01→[0]');

  // Event 00 (Initial - Hold state)
  const event00 = createRSVector(0, 0, true);
  event00.metadata = {
    name: '00',
    description: 'Stable state (S=0, R=0)',
    state: 'HOLD'
  };

  // Event 01 (Reset - Output LOW)
  const event01 = createRSVector(0, 1, false);
  event01.metadata = {
    name: '01',
    description: 'Reset state (S=0, R=1)',
    state: 'RESET'
  };
  event01.addOutputVector(createOutput(0, 'Flip flop RESET to LOW (0)'));

  // Build chain: 00 → 01
  event00.addNextVector(event01.id);

  seq.addVector(event00);
  seq.addVector(event01);

  return seq;
}

/**
 * Generate all RS Flip Flop sequences
 */
export function createRSFlipFlopSequences(): CriticalEventSequence[] {
  return [
    createSetSequence(),
    createResetSequence()
  ];
}

/**
 * Create a Machine containing RS Flip Flop sequences
 */
export function createRSFlipFlopMachine(): Machine {
  const testVectors = generateRSTestVectors();

  // Define perceptual mapping for machine interconnection
  // Reads from En[3:5] (Multi-Step machine's output) and writes to En[6:8]
  const perceptualMapping: PerceptualMapping = {
    input: { offset: 3, length: 2 },   // Reads En[3:5] (connects to Multi-Step output)
    output: { offset: 6, length: 2 }   // Writes to En[6:8]
  };

  const machine = new Machine(
    'RS Flip Flop',
    'Bistable multivibrator with Set and Reset critical event sequences',
    {
      eventSpace: '2D binary vectors: [S, R] inputs (00, 01, 10, 11)',
      outputSpace: '2D binary: {[0,1]=RESET/LOW, [1,0]=SET/HIGH}',
      sequenceCount: 2,
      inputVectorCount: testVectors.length,
      description: 'Two sequences: SET (00→10) and RESET (00→01)',
      category: 'digital-logic',
      sequences: [
        { name: 'SET Sequence', path: '00→10', output: '[1]', description: 'Sets flip flop to HIGH' },
        { name: 'RESET Sequence', path: '00→01', output: '[0]', description: 'Resets flip flop to LOW' }
      ],
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.description,
        expectedOutput: tv.expectedOutput
      })),
      // Input sequences demonstrating flip flop behavior
      inputSequences: [
        {
          name: 'SET Operation',
          pattern: '00→10',
          description: 'Transition from hold to set state',
          vectors: [
            [0, 0],  // Hold
            [1, 0]   // Set → outputs [1]
          ]
        },
        {
          name: 'RESET Operation',
          pattern: '00→01',
          description: 'Transition from hold to reset state',
          vectors: [
            [0, 0],  // Hold
            [0, 1]   // Reset → outputs [0]
          ]
        },
        {
          name: 'SET then RESET',
          pattern: '00→10→00→01',
          description: 'Set flip flop, return to hold, then reset',
          vectors: [
            [0, 0],  // Hold
            [1, 0],  // Set → [1]
            [0, 0],  // Hold
            [0, 1]   // Reset → [0]
          ]
        },
        {
          name: 'Complete Test Sequence',
          pattern: '00→10→00→01→00→01→10→01→00',
          description: 'Full test sequence with multiple SET/RESET operations',
          vectors: [
            [0, 0],  // Hold (initial)
            [1, 0],  // Set → [1]
            [0, 0],  // Hold
            [0, 1],  // Reset → [0]
            [0, 0],  // Hold
            [0, 1],  // Reset (already 0)
            [1, 0],  // Set → [1]
            [0, 1],  // Reset → [0]
            [0, 0]   // Hold (final)
          ]
        },
        {
          name: 'COMPREHENSIVE VALIDATION SEQUENCE',
          pattern: '13-step validation of all events and outputs',
          description: 'Validates: (1) All event activations (2) All output generation (3) Repeated operations (4) State transitions (5) Visualization correctness. Tests 3x SET, 3x RESET with HOLD states between.',
          vectors: generateRSValidationVectors().map(v => v.vector),
          metadata: {
            validationType: 'comprehensive',
            totalSteps: 13,
            expectedOutputs: 6,
            expectedOutputSequence: '[1,0], [1,0], [0,1], [0,1], [1,0], [0,1]',
            validatesEventActivation: true,
            validatesOutputGeneration: true,
            validatesVisualization: true,
            validatesRepeatedOperations: true,
            validatesStateTransitions: true
          }
        }
      ]
    },
    ArbiterRule.PASSTHROUGH,
    perceptualMapping
  );

  // Add both sequences to the machine
  const sequences = createRSFlipFlopSequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}

/**
 * Generate test input vectors for RS Flip Flop
 *
 * Test sequence: (00, 10, 00, 01, 00, 01, 10, 01, 00)
 *
 * Expected behavior:
 * 1. 00 - Hold state (initial)
 * 2. 10 - SET → outputs [1]
 * 3. 00 - Hold state
 * 4. 01 - RESET → outputs [0]
 * 5. 00 - Hold state
 * 6. 01 - RESET (already 0, outputs [0] again)
 * 7. 10 - SET → outputs [1]
 * 8. 01 - RESET → outputs [0]
 * 9. 00 - Hold state (final)
 */
export function generateRSTestVectors(): Array<{ vector: number[]; description: string; expectedOutput?: string }> {
  return [
    { vector: [0, 0], description: 'Vector 1: 00 - Hold state (initial)' },
    { vector: [1, 0], description: 'Vector 2: 10 - SET (00→10)', expectedOutput: '1' },
    { vector: [0, 0], description: 'Vector 3: 00 - Hold state' },
    { vector: [0, 1], description: 'Vector 4: 01 - RESET (00→01)', expectedOutput: '0' },
    { vector: [0, 0], description: 'Vector 5: 00 - Hold state' },
    { vector: [0, 1], description: 'Vector 6: 01 - RESET again', expectedOutput: '0' },
    { vector: [1, 0], description: 'Vector 7: 10 - SET', expectedOutput: '1' },
    { vector: [0, 1], description: 'Vector 8: 01 - RESET', expectedOutput: '0' },
    { vector: [0, 0], description: 'Vector 9: 00 - Hold state (final)' }
  ];
}

/**
 * Generate comprehensive validation test vectors
 * This validates ALL event activations and outputs
 */
export function generateRSValidationVectors(): Array<{
  vector: number[];
  description: string;
  expectedOutput?: string;
  expectedActiveEvents: number;
}> {
  return [
    // Step 1: Initial HOLD
    {
      vector: [0, 0],
      description: 'Step 1: [0,0] HOLD - Initial state, both event 00s active',
      expectedActiveEvents: 2 // Both sequence event 00s
    },
    // Step 2: First SET
    {
      vector: [1, 0],
      description: 'Step 2: [1,0] SET - Activates event 10, generates output [1,0]',
      expectedOutput: '[1,0]',
      expectedActiveEvents: 3 // Both event 00s + event 10
    },
    // Step 3: HOLD
    {
      vector: [0, 0],
      description: 'Step 3: [0,0] HOLD - Event 10 stays active',
      expectedActiveEvents: 3
    },
    // Step 4: Second SET
    {
      vector: [1, 0],
      description: 'Step 4: [1,0] SET - Event 10 matched again, output [1,0] again',
      expectedOutput: '[1,0]',
      expectedActiveEvents: 3
    },
    // Step 5: HOLD
    {
      vector: [0, 0],
      description: 'Step 5: [0,0] HOLD - Stable state',
      expectedActiveEvents: 3
    },
    // Step 6: First RESET
    {
      vector: [0, 1],
      description: 'Step 6: [0,1] RESET - Activates event 01, generates output [0,1]',
      expectedOutput: '[0,1]',
      expectedActiveEvents: 4 // Both event 00s + event 10 + event 01
    },
    // Step 7: HOLD
    {
      vector: [0, 0],
      description: 'Step 7: [0,0] HOLD - Event 01 stays active',
      expectedActiveEvents: 4
    },
    // Step 8: Second RESET
    {
      vector: [0, 1],
      description: 'Step 8: [0,1] RESET - Event 01 matched again, output [0,1] again',
      expectedOutput: '[0,1]',
      expectedActiveEvents: 4
    },
    // Step 9: HOLD
    {
      vector: [0, 0],
      description: 'Step 9: [0,0] HOLD - Stable state',
      expectedActiveEvents: 4
    },
    // Step 10: SET after RESET
    {
      vector: [1, 0],
      description: 'Step 10: [1,0] SET - After RESET, validates state transitions',
      expectedOutput: '[1,0]',
      expectedActiveEvents: 4
    },
    // Step 11: HOLD
    {
      vector: [0, 0],
      description: 'Step 11: [0,0] HOLD - All events stable',
      expectedActiveEvents: 4
    },
    // Step 12: RESET after SET
    {
      vector: [0, 1],
      description: 'Step 12: [0,1] RESET - After SET, validates alternating',
      expectedOutput: '[0,1]',
      expectedActiveEvents: 4
    },
    // Step 13: Final HOLD
    {
      vector: [0, 0],
      description: 'Step 13: [0,0] HOLD - Final state, validation complete',
      expectedActiveEvents: 4
    }
  ];
}
