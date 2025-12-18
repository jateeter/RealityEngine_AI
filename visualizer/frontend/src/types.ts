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
  metadata?: Record<string, any>;
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
