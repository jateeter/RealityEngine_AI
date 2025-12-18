import { v4 as uuidv4 } from 'uuid';
import { RealityVector } from './RealityVector.js';
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
   * Process a transition for all active vectors in this sequence
   * Returns all output vectors that should be asserted
   */
  public transition(inputVector: number[]): {
    matchedVectors: string[];
    activatedVectors: string[];
    assertedOutputs: OutputVector[];
    results: Map<string, MatchResult>;
  } {
    const matchedVectors: string[] = [];
    const vectorsToActivate = new Set<string>();
    const assertedOutputs: OutputVector[] = [];
    const results = new Map<string, MatchResult>();

    // Process all active vectors
    const activeVectors = this.getActiveVectors();

    for (const vector of activeVectors) {
      const transitionResult = vector.transition(inputVector);
      results.set(vector.id, transitionResult.matchResult);

      if (transitionResult.matched) {
        matchedVectors.push(vector.id);

        // Add next vectors to activation list
        transitionResult.nextVectorIds.forEach(id => {
          if (this.vectors.has(id)) {
            vectorsToActivate.add(id);
          }
        });

        // Collect output vectors
        assertedOutputs.push(...transitionResult.outputVectors);
      }
    }

    // Activate next vectors
    const activatedVectors = Array.from(vectorsToActivate);
    for (const vectorId of activatedVectors) {
      const vector = this.vectors.get(vectorId);
      if (vector) {
        vector.setActive();
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
