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
  CUSTOM = 'custom'
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
  comparatorType: ComparatorType;
  threshold?: number;
  customComparator?: ComparatorFunction;
}

/**
 * Configuration for the Reality Engine system
 */
export interface RealityEngineConfig {
  vectorDimension: number;
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
