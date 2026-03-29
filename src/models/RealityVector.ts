import { v4 as uuidv4 } from 'uuid';
import { VectorState, ComparatorType } from './types.js';
import type { VectorElement, MatchResult, OutputVector } from './types.js';

/**
 * RealityVector: Core unit of the Reality Engine
 *
 * A 1xn dimensional vector that can:
 * - Be Active or Inactive
 * - Perform match operations against input vectors
 * - Transition to next vectors on match
 * - Assert output vectors to affect reality
 */
export class RealityVector {
  public readonly id: string;
  /** The default match algorithm for this vector, inherited from the machine. */
  public matchAlgorithm: ComparatorType = ComparatorType.GTE;
  private elements: VectorElement[];
  private state: VectorState;
  private nextVectorIds: string[];
  private outputVectors: OutputVector[];
  private isInitial: boolean;
  private wasJustMatched: boolean;
  private lastOutputVector: OutputVector | null;
  public metadata: Record<string, any>;

  constructor(
    elements: VectorElement[],
    isInitial: boolean = false,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.elements = elements;
    this.state = isInitial ? VectorState.ACTIVE : VectorState.INACTIVE;
    this.nextVectorIds = [];
    this.outputVectors = [];
    this.isInitial = isInitial;
    this.wasJustMatched = false;
    this.lastOutputVector = null;
    this.metadata = {};
  }

  /**
   * Get the raw vector values
   */
  public getVector(): number[] {
    return this.elements.map(e => e.value);
  }

  /**
   * Get vector elements with comparator configurations
   */
  public getElements(): VectorElement[] {
    return [...this.elements];
  }

  /**
   * Check if this vector is currently active
   */
  public isActive(): boolean {
    return this.state === VectorState.ACTIVE;
  }

  /**
   * Set this vector to active state
   */
  public setActive(): void {
    this.state = VectorState.ACTIVE;
  }

  /**
   * Clear active state (set to inactive)
   * Initial vectors cannot be deactivated
   */
  public clearActive(): void {
    if (!this.isInitial) {
      this.state = VectorState.INACTIVE;
    }
  }

  /**
   * Mark this vector as just matched
   * Used to indicate a final event was active and matched by input
   */
  public setWasJustMatched(): void {
    this.wasJustMatched = true;
  }

  /**
   * Clear the just matched flag
   */
  public clearWasJustMatched(): void {
    this.wasJustMatched = false;
  }

  /**
   * Check if this vector was just matched
   */
  public getWasJustMatched(): boolean {
    return this.wasJustMatched;
  }

  /**
   * Set the last output vector produced by this vector
   * Used to display the output in visualization until next input
   */
  public setLastOutputVector(output: OutputVector | null): void {
    this.lastOutputVector = output;
  }

  /**
   * Get the last output vector produced by this vector
   */
  public getLastOutputVector(): OutputVector | null {
    return this.lastOutputVector;
  }

  /**
   * Clear the last output vector
   */
  public clearLastOutputVector(): void {
    this.lastOutputVector = null;
  }

  /**
   * Add a next vector ID to the collection
   */
  public addNextVector(vectorId: string): void {
    if (!this.nextVectorIds.includes(vectorId)) {
      this.nextVectorIds.push(vectorId);
    }
  }

  /**
   * Get all next vector IDs
   */
  public getNextVectorIds(): string[] {
    return [...this.nextVectorIds];
  }

  /**
   * Add an output vector
   */
  public addOutputVector(outputVector: OutputVector): void {
    this.outputVectors.push(outputVector);
  }

  /**
   * Get all output vectors
   */
  public getOutputVectors(): OutputVector[] {
    return [...this.outputVectors];
  }

  /**
   * Perform match operation against an input vector.
   * matchAlgorithmOverride, when present, overrides both the element-level
   * comparatorType and the vector-level matchAlgorithm for every element.
   */
  public match(inputVector: number[], matchAlgorithmOverride?: ComparatorType): MatchResult {
    if (inputVector.length !== this.elements.length) {
      return {
        matched: false,
        metadata: { error: 'Vector dimension mismatch' }
      };
    }

    let totalScore = 0;
    const elementResults: MatchResult[] = [];

    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      const inputValue = inputVector[i];

      if (!element || inputValue === undefined) {
        continue; // Skip undefined elements or values
      }

      const result = this.compareElement(element, inputValue, matchAlgorithmOverride);

      elementResults.push(result);

      if (!result.matched) {
        return {
          matched: false,
          score: totalScore / this.elements.length,
          metadata: { failedAtIndex: i, elementResults }
        };
      }

      totalScore += result.score || 1;
    }

    return {
      matched: true,
      score: totalScore / this.elements.length,
      metadata: { elementResults }
    };
  }

  /**
   * Compare a single element using its configured comparator.
   * matchAlgorithmOverride, when supplied, takes highest precedence — above
   * both the element-level comparatorType and the machine-level matchAlgorithm.
   * This allows the Perception Engine to configure the algorithm per-push.
   */
  private compareElement(element: VectorElement, inputValue: number, matchAlgorithmOverride?: ComparatorType): MatchResult {
    const effectiveType = matchAlgorithmOverride ?? element.comparatorType ?? this.matchAlgorithm;
    switch (effectiveType) {
      case ComparatorType.EQUALS:
        return {
          matched: element.value === inputValue,
          score: element.value === inputValue ? 1 : 0
        };

      case ComparatorType.THRESHOLD:
        const threshold = element.threshold || 0.1;
        const diff = Math.abs(element.value - inputValue);
        const matched = diff <= threshold;
        return {
          matched,
          score: matched ? 1 - (diff / threshold) : 0
        };

      case ComparatorType.PATTERN:
        // For pattern matching, we use threshold-based similarity
        const similarity = 1 - Math.abs(element.value - inputValue);
        const patternThreshold = element.threshold || 0.5;
        return {
          matched: similarity >= patternThreshold,
          score: similarity
        };

      case ComparatorType.CUSTOM:
        if (element.customComparator) {
          return element.customComparator(inputValue, element.value, element.threshold);
        }
        // Fallback to equals if no custom comparator
        return {
          matched: element.value === inputValue,
          score: element.value === inputValue ? 1 : 0
        };

      case ComparatorType.GTE: {
        // Threshold-state comparator: each element's "expected state" is
        // determined by whether its value is above or below the threshold.
        //   value >= threshold  →  expects HIGH  →  matches when input >= threshold
        //   value <  threshold  →  expects LOW   →  matches when input <  threshold
        //
        // This preserves binary semantics (0=LOW, 1=HIGH when threshold=0.5) and
        // extends naturally to continuous sensors (low values → detect LOW readings,
        // high values → detect HIGH readings).
        const gteThresh = element.threshold ?? 0.5;
        const inputHigh = inputValue >= gteThresh;
        const valueHigh = element.value >= gteThresh;
        if (inputHigh !== valueHigh) return { matched: false, score: 0 };
        // Score: how strongly the input is on the correct side of the threshold
        const score = inputHigh
          ? (gteThresh < 1 ? (inputValue - gteThresh) / (1 - gteThresh) : 1)
          : (gteThresh > 0 ? (gteThresh - inputValue) / gteThresh : 1);
        return { matched: true, score: Math.max(0, Math.min(1, score)) };
      }

      default:
        return { matched: false, score: 0 };
    }
  }

  /**
   * Perform transition operation:
   * 1. Check if input matches
   * 2. If not initial vector and doesn't match, deactivate
   * 3. If matches, return next vectors to activate and output vectors to assert
   * 4. Deactivate transitional vectors after successful match
   */
  public transition(inputVector: number[], matchAlgorithmOverride?: ComparatorType): {
    matched: boolean;
    nextVectorIds: string[];
    outputVectors: OutputVector[];
    matchResult: MatchResult;
  } {
    const matchResult = this.match(inputVector, matchAlgorithmOverride);

    if (!matchResult.matched) {
      // Deactivate if not an initial vector
      if (!this.isInitial) {
        this.clearActive();
      }
      return {
        matched: false,
        nextVectorIds: [],
        outputVectors: [],
        matchResult
      };
    }

    // Match successful - return next vectors and outputs
    const result = {
      matched: true,
      nextVectorIds: this.nextVectorIds,
      outputVectors: this.outputVectors,
      matchResult
    };

    // Deactivate transitional vectors after successful match
    // Transitional vectors are: not initial AND not final (no outputs)
    // Initial vectors stay active, final vectors stay active to display outputs
    const isFinalVector = this.outputVectors.length > 0;
    const isTransitionalVector = !this.isInitial && !isFinalVector;

    if (isTransitionalVector && this.nextVectorIds.length > 0) {
      // This vector has done its job - it matched and will activate next vectors
      // Deactivate it so it doesn't interfere with subsequent state progression
      this.clearActive();
    }

    return result;
  }

  /**
   * Check if this is an initial vector
   */
  public isInitialVector(): boolean {
    return this.isInitial;
  }

  /**
   * Create an independent deep copy of this vector.
   * The clone shares the same id and structural configuration (elements,
   * nextVectorIds, outputVectors) but has its own mutable state fields
   * (state, wasJustMatched, lastOutputVector) so that transitions applied
   * to the clone do not affect the original.
   */
  public clone(): RealityVector {
    const cloned = new RealityVector([...this.elements], this.isInitial, this.id);
    cloned.matchAlgorithm = this.matchAlgorithm;
    cloned.state = this.state;
    cloned.nextVectorIds = [...this.nextVectorIds];
    cloned.outputVectors = [...this.outputVectors];
    cloned.wasJustMatched = this.wasJustMatched;
    cloned.lastOutputVector = this.lastOutputVector;
    cloned.metadata = { ...this.metadata };
    return cloned;
  }

  /**
   * Serialize to JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      matchAlgorithm: this.matchAlgorithm,
      elements: this.elements,
      state: this.state,
      isActive: this.isActive(),
      nextVectorIds: this.nextVectorIds,
      outputVectors: this.outputVectors,
      isInitial: this.isInitial,
      wasJustMatched: this.wasJustMatched,
      lastOutputVector: this.lastOutputVector,
      metadata: this.metadata
    };
  }

  /**
   * Deserialize from JSON
   */
  public static fromJSON(json: any): RealityVector {
    const vector = new RealityVector(json.elements, json.isInitial, json.id);
    vector.matchAlgorithm = json.matchAlgorithm ?? ComparatorType.GTE;
    vector.state = json.state;
    vector.nextVectorIds = json.nextVectorIds || [];
    vector.outputVectors = json.outputVectors || [];
    vector.wasJustMatched = json.wasJustMatched || false;
    vector.lastOutputVector = json.lastOutputVector || null;
    vector.metadata = json.metadata || {};
    return vector;
  }
}
