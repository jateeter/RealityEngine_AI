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
 */
export interface OutputVector {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
  timestamp: number;
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
