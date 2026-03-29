import { v4 as uuidv4 } from 'uuid';
import { RealityVector } from './RealityVector.js';
import { ComparatorType } from './types.js';
import type { OutputVector, MatchResult } from './types.js';

/**
 * CriticalEventSequence: A sequence of RealityVectors that impacts reality
 *
 * Key characteristics:
 * - Contains at least one RealityVector that asserts an OutputVector
 * - Contains one or more InitialRealityVectors that are always Active
 * - Processes transitions through its vector network
 */
export class CriticalEventSequence {
  public readonly id: string;
  public name: string;
  private vectors: Map<string, RealityVector>;
  private initialVectorIds: Set<string>;
  private outputVectorIds: Set<string>;
  public metadata: Record<string, any>;

  constructor(name: string, id?: string) {
    this.id = id || uuidv4();
    this.name = name;
    this.vectors = new Map();
    this.initialVectorIds = new Set();
    this.outputVectorIds = new Set();
    this.metadata = {};
  }

  /**
   * Add a vector to this sequence
   */
  public addVector(vector: RealityVector): void {
    this.vectors.set(vector.id, vector);

    if (vector.isInitialVector()) {
      this.initialVectorIds.add(vector.id);
    }

    if (vector.getOutputVectors().length > 0) {
      this.outputVectorIds.add(vector.id);
    }
  }

  /**
   * Get a vector by ID
   */
  public getVector(id: string): RealityVector | undefined {
    return this.vectors.get(id);
  }

  /**
   * Get all vectors in this sequence
   */
  public getAllVectors(): RealityVector[] {
    return Array.from(this.vectors.values());
  }

  /**
   * Get all initial vectors
   */
  public getInitialVectors(): RealityVector[] {
    return Array.from(this.initialVectorIds)
      .map(id => this.vectors.get(id))
      .filter((v): v is RealityVector => v !== undefined);
  }

  /**
   * Get all active vectors in this sequence
   */
  public getActiveVectors(): RealityVector[] {
    return Array.from(this.vectors.values()).filter(v => v.isActive());
  }

  /**
   * Validate that this is a proper CriticalEventSequence
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.initialVectorIds.size === 0) {
      errors.push('CriticalEventSequence must have at least one initial vector');
    }

    if (this.outputVectorIds.size === 0) {
      errors.push('CriticalEventSequence must have at least one vector with output');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Process a transition for all active vectors in this sequence.
   *
   * Each input cycle the match algorithm runs once over every currently active
   * vector (fully parallelisable — order is irrelevant).  A match:
   *   1. Records the vector ID in matchedVectors.
   *   2. Marks output vectors as just-matched for visualisation.
   *   3. Activates each successor listed in nextVectorIds (if not already active)
   *      — those successors are NOT matched against the current input; they wait
   *      for the NEXT input cycle.
   *   4. Collects any asserted OutputVectors.
   *   5. Deactivates the matched vector (unless it is an initial vector).
   *
   * Activation of successors is deliberately deferred to the next cycle, making
   * the transition atomic with respect to the input — no same-cycle cascade.
   */
  public transition(inputVector: number[], matchAlgorithmOverride?: ComparatorType): {
    matchedVectors: string[];
    activatedVectors: string[];
    assertedOutputs: OutputVector[];
    results: Map<string, MatchResult>;
  } {
    const matchedVectors: string[] = [];
    const activatedVectors: string[] = [];
    const assertedOutputs: OutputVector[] = [];
    const results = new Map<string, MatchResult>();

    // Clear per-cycle visualisation flags on all vectors.
    for (const vector of this.vectors.values()) {
      vector.clearWasJustMatched();
      vector.clearLastOutputVector();
    }

    // Collect pending successor activations separately so they are applied
    // AFTER all active vectors have been processed.  This prevents a race
    // where a successor that happens to be currently active (e.g. a Kleene-star
    // loop node) is seen as "already active" by one matched vector and then
    // deactivated by its own no-match later in the same loop iteration —
    // causing the activation to be silently dropped.
    const pendingActivations = new Set<string>();

    // Match every currently active vector against the input.
    for (const vector of this.getActiveVectors()) {
      const transitionResult = vector.transition(inputVector, matchAlgorithmOverride);
      results.set(vector.id, transitionResult.matchResult);

      if (transitionResult.matched) {
        matchedVectors.push(vector.id);

        // Mark output vectors for visualisation.
        if (vector.getOutputVectors().length > 0) {
          vector.setWasJustMatched();
          if (transitionResult.outputVectors.length > 0) {
            vector.setLastOutputVector(transitionResult.outputVectors[0] || null);
          }
        }

        // Queue successors — applied after the full loop so the activation is
        // never lost due to same-cycle deactivation of those successors.
        for (const id of transitionResult.nextVectorIds) {
          pendingActivations.add(id);
        }

        // Collect asserted outputs for this cycle.
        assertedOutputs.push(...transitionResult.outputVectors);
      }
    }

    // Apply all queued successor activations now that the processing loop is
    // complete and all deactivations have settled.
    for (const id of pendingActivations) {
      const nextVector = this.vectors.get(id);
      if (nextVector && !nextVector.isActive()) {
        nextVector.setActive();
        activatedVectors.push(id);
      }
    }

    return {
      matchedVectors,
      activatedVectors,
      assertedOutputs,
      results
    };
  }

  /**
   * Reset sequence to initial state (only initial vectors active)
   */
  public reset(): void {
    for (const vector of this.vectors.values()) {
      if (vector.isInitialVector()) {
        vector.setActive();
      } else {
        vector.clearActive();
      }
    }
  }

  /**
   * Get statistics about this sequence
   */
  public getStats(): {
    totalVectors: number;
    activeVectors: number;
    initialVectors: number;
    outputVectors: number;
  } {
    return {
      totalVectors: this.vectors.size,
      activeVectors: this.getActiveVectors().length,
      initialVectors: this.initialVectorIds.size,
      outputVectors: this.outputVectorIds.size
    };
  }

  /**
   * Create an independent deep copy of this sequence.
   * Every RealityVector is cloned so that transitions applied to the clone
   * do not affect the original sequence's active-vector progression.
   */
  public clone(): CriticalEventSequence {
    const cloned = new CriticalEventSequence(this.name, this.id);
    for (const vector of this.vectors.values()) {
      cloned.addVector(vector.clone());
    }
    cloned.metadata = { ...this.metadata };
    return cloned;
  }

  /**
   * Serialize to JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      vectors: Array.from(this.vectors.values()).map(v => v.toJSON()),
      initialVectorIds: Array.from(this.initialVectorIds),
      outputVectorIds: Array.from(this.outputVectorIds),
      metadata: this.metadata
    };
  }

  /**
   * Deserialize from JSON
   */
  public static fromJSON(json: any): CriticalEventSequence {
    const sequence = new CriticalEventSequence(json.name, json.id);

    // Restore vectors
    if (json.vectors) {
      for (const vectorJson of json.vectors) {
        const vector = RealityVector.fromJSON(vectorJson);
        sequence.addVector(vector);
      }
    }

    sequence.metadata = json.metadata || {};
    return sequence;
  }
}
