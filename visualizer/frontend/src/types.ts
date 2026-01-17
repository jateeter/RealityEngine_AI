export interface VectorNode {
  id: string;
  label: string;
  isInitial: boolean;
  isActive: boolean;
  hasOutput: boolean;
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
  metadata?: Record<string, any> | string;
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

export interface HistoryEntry {
  inputVector: number[];
  timestamp: number;
  sequenceResults: Record<string, any>;
  totalOutputs: OutputVector[];
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

export interface VectorActivation {
  key: string;
  sequenceId: string;
  vectorId: string;
  count: number;
  lastActivated: number;
}

export interface ActivityEvent {
  id: string;
  type: 'vector-processed' | 'sequence-matched' | 'output-asserted' | 'transition' | 'error' | 'info';
  message: string;
  timestamp: number;
  severity: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

export interface DemoMetadata {
  name: string;
  version: string;
  totalSequences: number;
  totalVectors: number;
  totalInputVectors: number;
  totalOutputTypes: number;
  categories: string[];
}

export interface DemoDataset {
  metadata: DemoMetadata;
  sequences: any[];
  inputVectors: number[][];
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

// ===== Sequence Editing Types =====

export interface VectorNodeUpdate {
  id: string;
  label?: string;
  isInitial?: boolean;
  hasOutput?: boolean;
  elements?: VectorElement[];
  metadata?: Record<string, any>;
  outputVectors?: OutputVector[];
}

export interface EdgeUpdate {
  id: string;
  source?: string;
  target?: string;
}

export interface SequenceUpdateRequest {
  sequenceName?: string;
  metadata?: Record<string, any>;
  nodes?: VectorNodeUpdate[];
  edges?: EdgeUpdate[];
  addNodes?: VectorNode[];
  removeNodeIds?: string[];
  addEdges?: Edge[];
  removeEdgeIds?: string[];
}
