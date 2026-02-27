export interface VectorNode {
  id: string;
  label: string;
  isInitial: boolean;
  isActive: boolean;
  hasOutput: boolean;
  wasJustMatched?: boolean; // True when a final event was active and just matched by input
  lastOutputVector?: OutputVector | null; // The last output produced, visible until next input
  elements: VectorElement[];
  metadata: Record<string, any>;
  outputVectors: OutputVector[];
}

export interface VectorElement {
  value: number;
  comparatorType: string;
  threshold?: number;
}

export interface OutputVector {
  id: string;
  vector: number[];
  timestamp: number;
  metadata?: string | Record<string, any>;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface SequenceGraph {
  sequenceId: string;
  sequenceName: string;
  metadata: Record<string, any>;
  nodes: VectorNode[];
  edges: Edge[];
  stats: {
    totalVectors: number;
    activeVectors: number;
    initialVectors: number;
    outputVectors: number;
  };
}

export interface Machine {
  id: string;
  name: string;
  description: string;
  sequenceCount: number;
  totalVectors: number;
  sequenceIds: string[];
  sequences: Array<{
    id: string;
    name: string;
  }>;
  metadata: Record<string, any>;
  perceptualMapping?: {
    input: { offset: number; length: number };
    output: { offset: number; length: number };
  };
  isExample: boolean;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
}

export interface MachineCreateRequest {
  name: string;
  description: string;
  sequenceIds?: string[];
  metadata?: Record<string, any>;
}

export interface MachineUpdateRequest {
  name?: string;
  description?: string;
  sequenceIds?: string[];
  metadata?: Record<string, any>;
}

export interface EngineStats {
  totalSequences: number;
  totalVectors: number;
  totalActiveVectors: number;
  sequenceStats: Array<{
    id: string;
    name: string;
    stats: any;
  }>;
}

// ===== Simulation Types =====

export type SimulationStatus = 'stopped' | 'playing' | 'paused';

export interface SimulationState {
  status: SimulationStatus;
  currentIndex: number;
  totalVectors: number;
  startTime: number | null;
  lastStepTime: number | null;
}

export interface ActivityEvent {
  id: string;
  type: 'vector-processed' | 'sequence-matched' | 'output-asserted' | 'transition' | 'error' | 'info';
  message: string;
  timestamp: number;
  severity: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export interface TransitionResult {
  inputVector: number[];
  timestamp: number;
  sequenceResults: Record<string, {
    matched: boolean;
    matchedVectors: string[];
    transitions: Array<{
      fromVectorId: string;
      toVectorId: string;
      timestamp: number;
    }>;
    outputsAsserted: OutputVector[];
  }>;
  totalOutputs: OutputVector[];
}

// ===== Perceptual Input Sequence Types =====

export interface VectorSequenceItem {
  id: string;
  vector: number[];
  timestamp: number;
  source: 'algorithmic' | 'random' | 'manual' | 'override';
  metadata?: any;
}
