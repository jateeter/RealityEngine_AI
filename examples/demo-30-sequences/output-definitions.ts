import { OutputVector } from '../../dist/models/types.js';

export enum OutputType {
  NORMAL_OPERATION = 'NORMAL_OPERATION',
  WARNING_ALERT = 'WARNING_ALERT',
  CRITICAL_ALERT = 'CRITICAL_ALERT',
  EMERGENCY = 'EMERGENCY',
  OPTIMIZATION_TRIGGER = 'OPTIMIZATION_TRIGGER',
  MAINTENANCE_REQUIRED = 'MAINTENANCE_REQUIRED',
  EFFICIENCY_BOOST = 'EFFICIENCY_BOOST',
  RESOURCE_SHORTAGE = 'RESOURCE_SHORTAGE',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  SYSTEM_HEALTHY = 'SYSTEM_HEALTHY'
}

export const OUTPUT_DEFINITIONS: Record<OutputType, {
  vector: number[];
  description: string;
  severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
  color: string;
}> = {
  [OutputType.SYSTEM_HEALTHY]: {
    vector: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'System operating within normal parameters',
    severity: 'success',
    color: '#22c55e'
  },
  [OutputType.NORMAL_OPERATION]: {
    vector: [0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Normal operational state',
    severity: 'info',
    color: '#3b82f6'
  },
  [OutputType.WARNING_ALERT]: {
    vector: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Warning condition detected - attention recommended',
    severity: 'warning',
    color: '#eab308'
  },
  [OutputType.CRITICAL_ALERT]: {
    vector: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Critical condition - immediate action required',
    severity: 'error',
    color: '#f97316'
  },
  [OutputType.EMERGENCY]: {
    vector: [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Emergency state - critical intervention needed',
    severity: 'critical',
    color: '#ef4444'
  },
  [OutputType.OPTIMIZATION_TRIGGER]: {
    vector: [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Optimization opportunity detected',
    severity: 'info',
    color: '#06b6d4'
  },
  [OutputType.MAINTENANCE_REQUIRED]: {
    vector: [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
    description: 'Maintenance required soon',
    severity: 'warning',
    color: '#a855f7'
  },
  [OutputType.EFFICIENCY_BOOST]: {
    vector: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    description: 'Efficiency improvement activated',
    severity: 'success',
    color: '#10b981'
  },
  [OutputType.RESOURCE_SHORTAGE]: {
    vector: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    description: 'Resource shortage detected',
    severity: 'warning',
    color: '#f59e0b'
  },
  [OutputType.ANOMALY_DETECTED]: {
    vector: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
    description: 'Anomaly or unusual pattern detected',
    severity: 'warning',
    color: '#8b5cf6'
  }
};

/**
 * Create an output vector with proper metadata
 */
export function createOutputVector(
  type: OutputType,
  sequenceId: string,
  additionalMetadata?: Record<string, any>
): OutputVector {
  const definition = OUTPUT_DEFINITIONS[type];

  return {
    id: `output-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vector: definition.vector,
    metadata: {
      type,
      description: definition.description,
      severity: definition.severity,
      color: definition.color,
      sequenceId,
      ...additionalMetadata
    },
    timestamp: Date.now()
  };
}

/**
 * Get all output types for a given severity level
 */
export function getOutputTypesBySeverity(severity: 'info' | 'success' | 'warning' | 'error' | 'critical'): OutputType[] {
  return Object.entries(OUTPUT_DEFINITIONS)
    .filter(([_, def]) => def.severity === severity)
    .map(([type, _]) => type as OutputType);
}

/**
 * Get output type by vector similarity
 */
export function getOutputTypeByVector(vector: number[]): OutputType | null {
  const threshold = 0.8;

  for (const [type, definition] of Object.entries(OUTPUT_DEFINITIONS)) {
    const similarity = cosineSimilarity(vector, definition.vector);
    if (similarity >= threshold) {
      return type as OutputType;
    }
  }

  return null;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
