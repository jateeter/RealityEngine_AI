/**
 * Core type definitions for the Reality Engine system
 */

/**
 * Comparator function types for matching operations
 */
export enum ComparatorType {
  EQUALS = 'equals',
  THRESHOLD = 'threshold',
  PATTERN = 'pattern',
  CUSTOM = 'custom',
  /**
   * Greater-than-or-equal threshold comparator.
   *
   * Each element declares an expected activation state based on whether its
   * value is above or below the threshold:
   *   • value >= threshold  →  element expects HIGH  →  matches when inputValue >= threshold
   *   • value <  threshold  →  element expects LOW   →  matches when inputValue <  threshold
   *
   * This preserves binary machine semantics (value 0 → LOW, value 1 → HIGH
   * when threshold=0.5) and naturally extends to continuous sensors.
   */
  GTE = 'gte',
}

/**
 * Match result for comparator operations
 */
/**
 * Lifecycle metadata for a Critical Event Sequence (or a Machine as a whole).
 * Authoring teams add `deprecatedAt` (ISO date) + `replacedBy` (sequence id
 * within the same machine, or `machineId::sequenceId` across machines)
 * when a sequence is being retired.  The engine emits a Prom counter and
 * stamps each fired output with the deprecation block so listeners and the
 * visualizer can render strikethrough / banner / metric alerts.
 */
export interface CesLifecycle {
  schemaVersion?: string;       // e.g. "1.0.0" — semver for the sequence body
  deprecatedAt?: string;        // ISO-8601 date the sequence was marked deprecated
  replacedBy?:   string;        // forward-pointer to the successor sequence
}

/**
 * Deprecation block stamped onto a mergeBatch entry when a deprecated
 * sequence fires.  `ageDays` is computed at runtime and lets a Grafana
 * panel surface "this stale CES has been firing for 117 days post-deprecation".
 */
export interface DeprecationMark {
  since:      string;
  replacedBy?: string;
  ageDays:    number;
}

export interface MatchResult {
  matched: boolean;
  score?: number;
  metadata?: Record<string, any>;
}

/**
 * Comparator function definition
 */
export type ComparatorFunction = (
  inputValue: number,
  referenceValue: number,
  threshold?: number
) => MatchResult;

/**
 * Vector element with its comparator configuration
 */
export interface VectorElement {
  value: number;
  comparatorType?: ComparatorType;  // Optional — falls back to the machine's matchAlgorithm
  threshold?: number;
  customComparator?: ComparatorFunction;
}

/**
 * Configuration for the Reality Engine system
 */
export interface RealityEngineConfig {
  /** Qdrant collection vector size — fixed schema dimension for similarity search. */
  vectorDimension: number;
  /** Alias for vectorDimension; takes precedence when both are set. */
  qdrantVectorDimension?: number;
  defaultMatchThreshold: number;
  qdrantUrl: string;
  collectionName: string;
}

/**
 * State of a Reality Vector
 */
export enum VectorState {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

/**
 * Output vector that can be asserted to affect reality
 *
 * `provenance` is the ordered list of vector IDs whose matches led to this
 * output firing — populated by the engine, not the source JSON.  For an
 * isInitial vector that emits on its first match, provenance is just
 * `[v.id]`.  For a chained vector, it's the full path from the original
 * activator through every intermediate vector to this emitter, e.g.
 * `["fall-conf-v1", "fall-conf-v2", "fall-conf-v3", "fall-conf-v4",
 *  "fall-conf-v5", "fall-conf-v6"]` for a six-step fall confirmation.
 * Listeners can include this in alert payloads so an operator sees not
 * just "RED fall" but the evidence chain that justified it.
 */
export interface OutputVector {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
  timestamp: number;
  provenance?: string[];
}

/**
 * Perceptual mapping for machine interconnection
 * Maps machine input/output to positions in the shared perceptual space
 */
export interface PerceptualMapping {
  input: {
    offset: number;  // Starting index in perceptual space for input
    length: number;  // Number of dimensions for input
  };
  output: {
    offset: number;  // Starting index in perceptual space for output
    length: number;  // Number of dimensions for output
  };
  /**
   * Option A1 narrow-cell declaration (1, 2, 4, or 8).  Sets the
   * declared per-cell width the machine emits / consumes.  Inert on
   * the engine matching path — engine cells stay Float64 internally
   * for now — but the API layer reads it to pack mergeBatch.values
   * for wire transmission and to range-check incoming writes.
   */
  bitsPerElement?: number;
}

/**
 * Machine transition result - Result of processing input through a machine
 */
export interface MachineTransitionResult {
  inputVector: number[];
  timestamp: number;
  sequenceResults: Map<string, {
    matchedVectors: string[];
    activatedVectors: string[];
    assertedOutputs: OutputVector[];
  }>;
  machineOutput: OutputVector | null;
  arbiterMetadata: {
    rule: string;
    totalInputs: number;
    sequencesWithOutput: number;
    shouldOutput: boolean;
  };
}

/**
 * Universal Input Space Processing Types
 * Types for PreceptionEngine and universal input space handling
 */

/**
 * UniversalInputSpace: The complete 256-byte input vector representing observable reality
 */
export type UniversalInputSpace = number[]; // Fixed length: 256

/**
 * PreceptionResult: Result of resolving universal input to machine-specific input
 */
export interface PreceptionResult {
  universalInputSpace: number[];
  machineId: string;
  machineName: string;
  perceptualMapping: PerceptualMapping;
  resolvedInput: number[];
  timestamp: number;
}

/**
 * UniversalInputProcessingResult: Result of processing universal input through machines
 */
export interface UniversalInputProcessingResult {
  universalInputSpace: number[];
  timestamp: number;
  machineResults: Map<string, MachineTransitionResult>;
  totalMachinesProcessed: number;
  preceptionUsed: boolean;
}
