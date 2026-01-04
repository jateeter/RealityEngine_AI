import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector } from '../../models/types.js';

/**
 * Kleene Star (*) Operator Test Machine
 *
 * Event Space: 3-dimensional binary vectors (000, 001, 010, 011, 100, 101, 110, 111)
 * Output Space: {01, 10} - 2-dimensional binary vectors
 *
 * This example demonstrates the Kleene star (*) operator in critical event sequences:
 * - Pattern: E* means "zero or more occurrences of E"
 * - Implementation: Self-loops allow repetition, with exit paths for continuation
 *
 * Sequence 1: 001+000*+010 -> 01
 * - Matches: 001, followed by zero or more 000, followed by 010, outputs [0,1]
 * - Examples:
 *   - 001, 010 → [0,1] (zero occurrences of 000)
 *   - 001, 000, 010 → [0,1] (one occurrence)
 *   - 001, 000, 000, 010 → [0,1] (two occurrences)
 *
 * Sequence 2: 010+(000+001)*+001 -> 10
 * - Matches: 010, followed by zero or more (000 OR 001), followed by 001, outputs [1,0]
 * - Examples:
 *   - 010, 001 → [1,0] (zero occurrences)
 *   - 010, 000, 001 → [1,0] (one 000)
 *   - 010, 001, 001 → [1,0] (one 001)
 *   - 010, 000, 001, 000, 001 → [1,0] (mixed)
 */

/**
 * Create output vector from binary string
 */
function createOutput(binaryString: string, description: string, pattern: string): OutputVector {
  const vector = binaryString.split('').map(bit => parseFloat(bit));
  return {
    id: `kleene-output-${binaryString}-${Date.now()}`,
    vector,
    timestamp: Date.now(),
    metadata: { description, pattern, operator: 'kleene-star' }
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
 * Sequence 1: 001+000*+010 -> 01
 *
 * Pattern: 001, then zero or more 000, then 010, outputs [0,1]
 *
 * Implementation:
 * - Event seq1-init (001): Initial event, activates loop and final (zero-or-more)
 * - Event seq1-loop (000): Self-loop for repetition, also activates final (exit)
 * - Event seq1-final (010): Terminal event, generates output [0,1]
 */
export function createKleeneSequence1(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Sequence 1: 001+000*+010→[01]');

  // Event 001 (Initial)
  const event001 = createBinaryVector('001', true);
  event001.metadata = {
    name: '001',
    description: 'Initial state: start of pattern',
    role: 'initial'
  };

  // Event 000 (Loop - Kleene star repetition)
  const event000 = createBinaryVector('000', false);
  event000.metadata = {
    name: '000',
    description: 'Kleene star loop: can repeat 0 or more times',
    role: 'kleene-loop'
  };

  // Event 010 (Terminal with output)
  const event010 = createBinaryVector('010', false);
  event010.metadata = {
    name: '010',
    description: 'Terminal state: pattern complete',
    role: 'terminal'
  };
  event010.addOutputVector(
    createOutput('01', 'Sequence 1 complete: 001+000*+010 matched', '001+000*+010')
  );

  // Build Kleene star structure:
  // 001 → {000, 010} (can go to loop OR skip directly to final - "zero or more")
  event001.addNextVector(event000.id);
  event001.addNextVector(event010.id);

  // 000 → {000, 010} (self-loop for repetition OR exit to final)
  event000.addNextVector(event000.id); // Self-loop for *
  event000.addNextVector(event010.id); // Exit from loop

  // 010 has no next vectors (terminal)

  seq.addVector(event001);
  seq.addVector(event000);
  seq.addVector(event010);

  return seq;
}

/**
 * Sequence 2: 010+(000+001)*+001 -> 10
 *
 * Pattern: 010, then zero or more (000 OR 001), then 001, outputs [1,0]
 *
 * Implementation:
 * - Event seq2-init (010): Initial event
 * - Event seq2-loop-a (000): First alternative in loop
 * - Event seq2-loop-b (001): Second alternative in loop
 * - Event seq2-final (001): Terminal event (distinct from loop-b by context)
 *
 * Note: seq2-loop-b and seq2-final both match [0,0,1]. When both are active,
 * the engine will match both: loop-b continues the loop, final generates output.
 * This demonstrates non-deterministic pattern matching.
 */
export function createKleeneSequence2(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Sequence 2: 010+(000+001)*+001→[10]');

  // Event 010 (Initial)
  const event010 = createBinaryVector('010', true);
  event010.metadata = {
    name: '010',
    description: 'Initial state: start of pattern',
    role: 'initial'
  };

  // Event 000 (Loop alternative A)
  const event000 = createBinaryVector('000', false);
  event000.metadata = {
    name: '000',
    description: 'Kleene star loop alternative A',
    role: 'kleene-loop-a'
  };

  // Event 001 (Loop alternative B)
  const event001_loop = createBinaryVector('001', false);
  event001_loop.metadata = {
    name: '001-loop',
    description: 'Kleene star loop alternative B',
    role: 'kleene-loop-b'
  };

  // Event 001 (Terminal - same pattern as loop-b but different event)
  const event001_final = createBinaryVector('001', false);
  event001_final.metadata = {
    name: '001-final',
    description: 'Terminal state: pattern complete',
    role: 'terminal'
  };
  event001_final.addOutputVector(
    createOutput('10', 'Sequence 2 complete: 010+(000+001)*+001 matched', '010+(000+001)*+001')
  );

  // Build Kleene star with alternation structure:
  // 010 → {000, 001-loop, 001-final} (can go to either loop alternative OR skip to final)
  event010.addNextVector(event000.id);
  event010.addNextVector(event001_loop.id);
  event010.addNextVector(event001_final.id);

  // 000 → {000, 001-loop, 001-final} (loop back to either alternative OR exit)
  event000.addNextVector(event000.id);
  event000.addNextVector(event001_loop.id);
  event000.addNextVector(event001_final.id);

  // 001-loop → {000, 001-loop, 001-final} (loop back to either alternative OR exit)
  event001_loop.addNextVector(event000.id);
  event001_loop.addNextVector(event001_loop.id);
  event001_loop.addNextVector(event001_final.id);

  // 001-final has no next vectors (terminal)

  seq.addVector(event010);
  seq.addVector(event000);
  seq.addVector(event001_loop);
  seq.addVector(event001_final);

  return seq;
}

/**
 * Generate all Kleene star sequences
 */
export function createKleeneStarSequences(): CriticalEventSequence[] {
  return [
    createKleeneSequence1(),
    createKleeneSequence2()
  ];
}

/**
 * Create the "* Operator Test" Machine
 */
export function createKleeneStarMachine(): Machine {
  const machine = new Machine(
    '* Operator Test',
    'Demonstrates Kleene star (*) operator in critical event sequences - zero or more repetitions with alternation',
    {
      eventSpace: '3D binary vectors: 000-111',
      outputSpace: '2D binary vectors: {01, 10}',
      sequenceCount: 2,
      operator: 'Kleene star (*)',
      description: 'Two sequences demonstrating repetition patterns',
      sequences: [
        {
          name: 'Sequence 1',
          pattern: '001+000*+010',
          description: '001, then zero or more 000, then 010',
          output: '[0,1]'
        },
        {
          name: 'Sequence 2',
          pattern: '010+(000+001)*+001',
          description: '010, then zero or more (000 or 001), then 001',
          output: '[1,0]'
        }
      ]
    }
  );

  // Add both sequences to the machine
  const sequences = createKleeneStarSequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}

/**
 * Generate test input vectors demonstrating Kleene star behavior
 *
 * Custom input sequence: 000, 001, 000, 000, 010, 000, 100, 110, 111, 011, 001, 000, 001, 000, 001
 *
 * Expected behavior:
 * - Vector 2 (001): Activates Sequence 1 initial state
 * - Vectors 3-4 (000, 000): Loop in Sequence 1 Kleene star
 * - Vector 5 (010): Completes Sequence 1, outputs [0,1]
 * - Vector 11 (001): Could activate Sequence 1 or complete pending Sequence 2 paths
 * - Vectors 12-15 (000, 001, 000, 001): Demonstrate alternation patterns
 */
export function generateKleeneStarTestVectors(): Array<{
  vector: number[];
  description: string;
  expectedOutput?: string;
  testCase: string;
}> {
  return [
    { vector: [0, 0, 0], description: 'Vector 1: 000 - No match (not initial)', testCase: 'custom-sequence' },
    { vector: [0, 0, 1], description: 'Vector 2: 001 - Activate Sequence 1', testCase: 'custom-sequence' },
    { vector: [0, 0, 0], description: 'Vector 3: 000 - Sequence 1 loop (1st)', testCase: 'custom-sequence' },
    { vector: [0, 0, 0], description: 'Vector 4: 000 - Sequence 1 loop (2nd)', testCase: 'custom-sequence' },
    { vector: [0, 1, 0], description: 'Vector 5: 010 - Complete Sequence 1', expectedOutput: '01', testCase: 'custom-sequence' },
    { vector: [0, 0, 0], description: 'Vector 6: 000 - No active matches', testCase: 'custom-sequence' },
    { vector: [1, 0, 0], description: 'Vector 7: 100 - No match (not initial)', testCase: 'custom-sequence' },
    { vector: [1, 1, 0], description: 'Vector 8: 110 - No match (not initial)', testCase: 'custom-sequence' },
    { vector: [1, 1, 1], description: 'Vector 9: 111 - No match (not initial)', testCase: 'custom-sequence' },
    { vector: [0, 1, 1], description: 'Vector 10: 011 - No match (not initial)', testCase: 'custom-sequence' },
    { vector: [0, 0, 1], description: 'Vector 11: 001 - Activate Sequence 1', testCase: 'custom-sequence' },
    { vector: [0, 0, 0], description: 'Vector 12: 000 - Sequence 1 loop', testCase: 'custom-sequence' },
    { vector: [0, 0, 1], description: 'Vector 13: 001 - Restart Sequence 1', testCase: 'custom-sequence' },
    { vector: [0, 0, 0], description: 'Vector 14: 000 - Sequence 1 loop', testCase: 'custom-sequence' },
    { vector: [0, 0, 1], description: 'Vector 15: 001 - Restart Sequence 1', testCase: 'custom-sequence' }
  ];
}

/**
 * Generate comprehensive test suite including edge cases
 */
export function generateComprehensiveKleeneStarTests(): Array<{
  vector: number[];
  description: string;
  expectedOutput?: string;
  testCase: string;
}> {
  const tests = generateKleeneStarTestVectors();

  // Add edge case: very long repetition (5 loops)
  tests.push(
    { vector: [0, 0, 1], description: '001 - Start Sequence 1', testCase: 'seq1-long-reps' },
    { vector: [0, 0, 0], description: '000 - Loop 1/5', testCase: 'seq1-long-reps' },
    { vector: [0, 0, 0], description: '000 - Loop 2/5', testCase: 'seq1-long-reps' },
    { vector: [0, 0, 0], description: '000 - Loop 3/5', testCase: 'seq1-long-reps' },
    { vector: [0, 0, 0], description: '000 - Loop 4/5', testCase: 'seq1-long-reps' },
    { vector: [0, 0, 0], description: '000 - Loop 5/5', testCase: 'seq1-long-reps' },
    { vector: [0, 1, 0], description: '010 - Complete Sequence 1 (five 000)', expectedOutput: '01', testCase: 'seq1-long-reps' }
  );

  return tests;
}
