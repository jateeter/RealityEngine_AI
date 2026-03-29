import { CriticalEventSequence } from './CriticalEventSequence.js';
import { OutputArbiter, ArbiterRule } from './OutputArbiter.js';
import { PerceptualSpace } from './PerceptualSpace.js';
import { ComparatorType } from './types.js';
import type { MachineTransitionResult, OutputVector, PerceptualMapping } from './types.js';

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
  /** The match algorithm used by all vectors in this machine (unless overridden per-element). */
  public matchAlgorithm: ComparatorType = ComparatorType.GTE;
  private sequences: Map<string, CriticalEventSequence>;
  private arbiter: OutputArbiter;
  public readonly metadata: Record<string, any>;
  public perceptualMapping?: PerceptualMapping;

  constructor(
    name: string,
    description: string = '',
    metadata: Record<string, any> = {},
    arbiterRule: ArbiterRule = ArbiterRule.PASSTHROUGH,
    perceptualMapping?: PerceptualMapping,
    id?: string
  ) {
    this.id = id ?? `machine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.description = description;
    this.sequences = new Map();
    this.arbiter = new OutputArbiter(arbiterRule);
    this.metadata = metadata;
    if (perceptualMapping) {
      this.perceptualMapping = perceptualMapping;
    }
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
  public processInput(inputVector: number[], matchAlgorithmOverride?: ComparatorType): MachineTransitionResult {
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
      const transitionResult = sequence.transition(inputVector, matchAlgorithmOverride);

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
   * Process input from perceptual space
   *
   * Uses the machine's perceptual mapping to:
   * 1. Extract input from the shared perceptual space (En -> Em)
   * 2. Process through the machine
   * 3. Merge output back into perceptual space (Ox -> En)
   *
   * @param perceptualSpace - The shared perceptual space
   * @returns MachineTransitionResult
   */
  public processInputFromPerceptualSpace(perceptualSpace: PerceptualSpace): MachineTransitionResult {
    if (!this.perceptualMapping) {
      throw new Error(`Machine ${this.name} does not have a perceptual mapping configured`);
    }

    // Phase 1: Extract machine input (Em) from perceptual space (En)
    const machineInput = perceptualSpace.extractMachineInput(this.perceptualMapping);

    // Phase 2 & 3: Process through machine's standard workflow
    const result = this.processInput(machineInput);

    // Phase 4: Merge machine output (Ox) back into perceptual space (En)
    if (result.machineOutput && result.machineOutput.vector) {
      perceptualSpace.mergeMachineOutput(result.machineOutput.vector, this.perceptualMapping);
    }

    return result;
  }

  /**
   * Set the perceptual mapping for this machine
   */
  public setPerceptualMapping(mapping: PerceptualMapping): void {
    // Validate the mapping if perceptual space dimension is known
    // For now, we'll just set it
    this.perceptualMapping = mapping;
  }

  /**
   * Get the perceptual mapping for this machine
   */
  public getPerceptualMapping(): PerceptualMapping | undefined {
    return this.perceptualMapping;
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
   * Create an independent deep copy of this machine.
   *
   * The clone preserves the original id so that external systems (visualizer,
   * route handlers) can continue to correlate the clone with the source.
   * Every CriticalEventSequence — and within it every RealityVector — is
   * independently cloned, so mutable state (active vectors, wasJustMatched,
   * lastOutputVector) is fully isolated between original and clone.
   *
   * Use this when the same logical machine must participate in two independent
   * processing contexts (e.g. live RealityEngine and PerceptualSpaceSimulator)
   * without state contamination between them.
   */
  public clone(): Machine {
    const mapping = this.perceptualMapping
      ? {
          input:  { ...this.perceptualMapping.input },
          output: { ...this.perceptualMapping.output }
        }
      : undefined;

    const cloned = new Machine(
      this.name,
      this.description,
      { ...this.metadata },
      this.arbiter.getRule(),
      mapping,
      this.id
    );
    cloned.matchAlgorithm = this.matchAlgorithm;

    for (const sequence of this.sequences.values()) {
      cloned.addSequence(sequence.clone());
    }

    return cloned;
  }

  /**
   * Serialize machine to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      matchAlgorithm: this.matchAlgorithm,
      sequenceCount: this.getSequenceCount(),
      totalVectors: this.getTotalVectorCount(),
      sequenceIds: this.getSequenceIds(),
      sequences: this.getAllSequences().map(seq => ({
        id: seq.id,
        name: seq.name
      })),
      metadata: this.metadata,
      perceptualMapping: this.perceptualMapping
    };
  }
}
