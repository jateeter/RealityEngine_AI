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
   *
   * CORRECTED WORKFLOW (v2):
   * - Propagates activation through all matching vectors in a single input cycle
   * - Ensures final events become active when their predecessors match
   * - Continues matching until no more vectors can be activated by current input
   * - Re-processes active vectors that were activated in previous inputs
   *
   * CRITICAL FIX: Vectors that are already active from previous inputs
   * are now properly added to the processing queue, ensuring they can
   * match against the current input and activate their successors.
   */
  public transition(inputVector: number[]): {
    matchedVectors: string[];
    activatedVectors: string[];
    assertedOutputs: OutputVector[];
    results: Map<string, MatchResult>;
  } {
    const matchedVectors: string[] = [];
    const activatedVectors: string[] = [];
    const assertedOutputs: OutputVector[] = [];
    const results = new Map<string, MatchResult>();

    // Clear wasJustMatched and lastOutputVector flags on all vectors
    for (const vector of this.vectors.values()) {
      vector.clearWasJustMatched();
      vector.clearLastOutputVector();
    }

    // Track which vectors we've already processed to prevent infinite loops
    const processedVectorIds = new Set<string>();

    // Get initially active vectors
    let vectorsToProcess = this.getActiveVectors();

    // Propagation loop: continue until no new vectors can be activated
    while (vectorsToProcess.length > 0) {
      const newVectorsToActivate = new Set<string>();

      for (const vector of vectorsToProcess) {
        // Skip if already processed this vector in this input cycle
        if (processedVectorIds.has(vector.id)) {
          continue;
        }

        processedVectorIds.add(vector.id);

        const transitionResult = vector.transition(inputVector);
        results.set(vector.id, transitionResult.matchResult);

        if (transitionResult.matched) {
          matchedVectors.push(vector.id);

          // If this vector has outputs and was matched, mark it as just matched
          // and store the output vector for visualization
          if (vector.getOutputVectors().length > 0) {
            vector.setWasJustMatched();

            // Store the first output vector for visualization
            if (transitionResult.outputVectors.length > 0) {
              vector.setLastOutputVector(transitionResult.outputVectors[0] || null);
            }
          }

          // Add next vectors to activation list
          // CRITICAL FIX: Only activate next vectors if they can match the current input
          // This prevents premature activation and immediate deactivation
          transitionResult.nextVectorIds.forEach(id => {
            if (this.vectors.has(id)) {
              const nextVector = this.vectors.get(id);
              if (nextVector) {
                // Check if this next vector can match the current input
                const canMatch = nextVector.match(inputVector).matched;

                // Only activate if the vector can match the current input
                // This implements "lookahead" activation
                if (canMatch) {
                  // Activate the vector if it's not already active
                  if (!nextVector.isActive()) {
                    nextVector.setActive();
                    activatedVectors.push(id);
                  }

                  // Add to processing queue to match and generate output immediately
                  if (!processedVectorIds.has(id)) {
                    newVectorsToActivate.add(id);
                  }
                }
              }
            }
          });

          // Collect output vectors
          assertedOutputs.push(...transitionResult.outputVectors);
        }
      }

      // Prepare next batch: newly activated vectors that haven't been processed
      vectorsToProcess = Array.from(newVectorsToActivate)
        .map(id => this.vectors.get(id))
        .filter((v): v is RealityVector => v !== undefined && !processedVectorIds.has(v.id));
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
