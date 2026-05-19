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
  // Lifecycle metadata — schemaVersion lets authoring teams pin a body
  // version to the sequence definition; deprecatedAt + replacedBy let the
  // engine emit warnings and stamp mergeBatch entries when stale CESs fire.
  public schemaVersion?: string;
  public deprecatedAt?: string;
  public replacedBy?:   string;

  constructor(name: string, id?: string) {
    this.id = id || uuidv4();
    this.name = name;
    this.vectors = new Map();
    this.initialVectorIds = new Set();
    this.outputVectorIds = new Set();
    this.metadata = {};
  }

  /** True iff this sequence carries a deprecatedAt date. */
  public isDeprecated(): boolean {
    return Boolean(this.deprecatedAt);
  }

  /**
   * Days elapsed since the sequence was deprecated, useful for ranking
   * "longest-stale CESs" in dashboards.  Returns 0 if the sequence is not
   * deprecated or the date doesn't parse.
   */
  public daysSinceDeprecation(now: Date = new Date()): number {
    if (!this.deprecatedAt) return 0;
    const t = Date.parse(this.deprecatedAt);
    if (Number.isNaN(t)) return 0;
    return Math.floor((now.getTime() - t) / 86_400_000);
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
   * Get all active vectors in this sequence, sorted by id ASC.
   *
   * Sorting matters for cross-runtime parity: when multiple active vectors
   * match in the same cycle, the order in which their outputs appear in
   * `assertedOutputs[]` determines each output's `outputIndex` (and hence
   * its position in mergeBatch).  The C++ runtime stores vectors in a
   * `std::map<std::string, RealityVector>` whose iteration is alphabetical
   * by vector id — so we mirror that here.  Without this, AI's JSON
   * insertion order would differ from C++ alphabetical order and the same
   * (sequence, input) tuple would produce different mergeBatches across
   * runtimes (caught by tests/cesgen_contracts_parity.cpp).
   */
  public getActiveVectors(): RealityVector[] {
    return Array.from(this.vectors.values())
      .filter(v => v.isActive())
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
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
    // Carry the activator's provenance chain alongside each pending id so
    // the successor inherits the evidence trail.  If two activators target
    // the same successor in one cycle, the first one wins — chains diverge
    // on the activation event, and downstream determinism matters more
    // than capturing every possible parent (we still see them all in the
    // matchedVectors list for that cycle).
    const pendingActivations = new Map<string, string[]>();

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
        // never lost due to same-cycle deactivation of those successors.  The
        // activator's provenanceChain is forwarded so the successor's eventual
        // output carries the full chain from the original activator through
        // every intermediate.
        for (const id of transitionResult.nextVectorIds) {
          if (!pendingActivations.has(id)) {
            pendingActivations.set(id, transitionResult.provenanceChain);
          }
        }

        // Collect asserted outputs for this cycle.
        assertedOutputs.push(...transitionResult.outputVectors);
      }
    }

    // Apply all queued successor activations now that the processing loop is
    // complete and all deactivations have settled.
    for (const [id, chain] of pendingActivations) {
      const nextVector = this.vectors.get(id);
      if (nextVector && !nextVector.isActive()) {
        nextVector.setActive(chain);
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
    const out: Record<string, unknown> = {
      id: this.id,
      name: this.name,
      vectors: Array.from(this.vectors.values()).map(v => v.toJSON()),
      initialVectorIds: Array.from(this.initialVectorIds),
      outputVectorIds: Array.from(this.outputVectorIds),
      metadata: this.metadata,
    };
    if (this.schemaVersion) out['schemaVersion'] = this.schemaVersion;
    if (this.deprecatedAt) out['deprecatedAt'] = this.deprecatedAt;
    if (this.replacedBy)   out['replacedBy']   = this.replacedBy;
    return out;
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
