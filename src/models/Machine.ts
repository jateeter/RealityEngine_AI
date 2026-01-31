import { CriticalEventSequence } from './CriticalEventSequence.js';
import { OutputArbiter, ArbiterRule } from './OutputArbiter.js';
import type { MachineTransitionResult, OutputVector } from './types.js';

/**
 * Machine - A collection of critical event sequences that work together
 *
 * A Machine represents a logical grouping of sequences that should be
 * visualized and processed together as a unified system.
 *
 * The machine implements a 3-phase workflow:
 * 1. Resolve new input reality vector
 * 2. Apply input to all active events (sequences)
 * 3. Resolve output reality vector via arbiter
 */
export class Machine {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  private sequences: Map<string, CriticalEventSequence>;
  private arbiter: OutputArbiter;
  public readonly metadata: Record<string, any>;

  constructor(
    name: string,
    description: string = '',
    metadata: Record<string, any> = {},
    arbiterRule: ArbiterRule = ArbiterRule.PASSTHROUGH
  ) {
    this.id = `machine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.description = description;
    this.sequences = new Map();
    this.arbiter = new OutputArbiter(arbiterRule);
    this.metadata = metadata;
  }

  /**
   * Add a critical event sequence to this machine
   */
  addSequence(sequence: CriticalEventSequence): void {
    this.sequences.set(sequence.id, sequence);
  }

  /**
   * Remove a sequence from this machine
   */
  removeSequence(sequenceId: string): boolean {
    return this.sequences.delete(sequenceId);
  }

  /**
   * Get a sequence by ID
   */
  getSequence(sequenceId: string): CriticalEventSequence | undefined {
    return this.sequences.get(sequenceId);
  }

  /**
   * Get all sequences in this machine
   */
  getAllSequences(): CriticalEventSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Get total number of sequences
   */
  getSequenceCount(): number {
    return this.sequences.size;
  }

  /**
   * Get total number of vectors across all sequences
   */
  getTotalVectorCount(): number {
    return this.getAllSequences().reduce(
      (total, seq) => total + seq.getAllVectors().length,
      0
    );
  }

  /**
   * Get all sequence IDs
   */
  getSequenceIds(): string[] {
    return Array.from(this.sequences.keys());
  }

  /**
   * Check if machine contains a sequence
   */
  hasSequence(sequenceId: string): boolean {
    return this.sequences.has(sequenceId);
  }

  /**
   * Process an input reality vector through the machine
   *
   * Implements the 3-phase Reality Engine workflow:
   * Phase 1: Resolve new input reality vector (receive input)
   * Phase 2: Apply input to all active events in all sequences
   * Phase 3: Resolve output reality vector via arbiter
   *
   * @param inputVector - The input reality vector to process
   * @returns MachineTransitionResult with sequence results and machine output
   */
  public processInput(inputVector: number[]): MachineTransitionResult {
    // Phase 1: Resolve new input reality vector
    const result: MachineTransitionResult = {
      inputVector,
      timestamp: Date.now(),
      sequenceResults: new Map(),
      machineOutput: null,
      arbiterMetadata: {
        rule: this.arbiter.getRule(),
        totalInputs: this.sequences.size,
        sequencesWithOutput: 0,
        shouldOutput: false
      }
    };

    // Phase 2: Apply input to all active events (sequences)
    const sequenceOutputs = new Map<string, OutputVector[]>();

    for (const [sequenceId, sequence] of this.sequences) {
      const transitionResult = sequence.transition(inputVector);

      result.sequenceResults.set(sequenceId, {
        matchedVectors: transitionResult.matchedVectors,
        activatedVectors: transitionResult.activatedVectors,
        assertedOutputs: transitionResult.assertedOutputs
      });

      // Collect outputs for arbiter
      sequenceOutputs.set(sequenceId, transitionResult.assertedOutputs);
    }

    // Phase 3: Resolve output reality vector via arbiter
    const arbiterResult = this.arbiter.arbitrate(
      sequenceOutputs,
      this.sequences.size
    );

    result.machineOutput = arbiterResult.machineOutput;
    result.arbiterMetadata = {
      rule: arbiterResult.metadata.rule,
      totalInputs: arbiterResult.metadata.totalInputs,
      sequencesWithOutput: arbiterResult.metadata.sequencesWithOutput,
      shouldOutput: arbiterResult.shouldOutput
    };

    return result;
  }

  /**
   * Reset all sequences to initial state
   */
  public reset(): void {
    for (const sequence of this.sequences.values()) {
      sequence.reset();
    }
  }

  /**
   * Get the output arbiter
   */
  public getArbiter(): OutputArbiter {
    return this.arbiter;
  }

  /**
   * Set the arbiter rule
   */
  public setArbiterRule(rule: ArbiterRule): void {
    this.arbiter.setRule(rule);
  }

  /**
   * Serialize machine to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      sequenceCount: this.getSequenceCount(),
      totalVectors: this.getTotalVectorCount(),
      sequenceIds: this.getSequenceIds(),
      sequences: this.getAllSequences().map(seq => ({
        id: seq.id,
        name: seq.name
      })),
      metadata: this.metadata
    };
  }
}
