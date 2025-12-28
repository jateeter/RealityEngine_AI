import { OutputType } from './output-definitions.js';

export interface InputVectorMetadata {
  index: number;
  type: 'normal' | 'warning' | 'critical' | 'emergency' | 'optimization' | 'maintenance' | 'anomaly';
  pattern: string;
  description: string;
  expectedOutputs?: OutputType[];
}

export interface LabeledInputVector {
  vector: number[];
  metadata: InputVectorMetadata;
}

/**
 * Generate 100 input vectors with diverse patterns
 * Distribution: 30 normal, 25 warning, 15 critical, 10 optimization, 10 maintenance, 5 emergency, 5 anomaly
 */
export function generateInputVectors(): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];

  // 1-30: Normal operation vectors (30 vectors)
  vectors.push(...generateNormalVectors(30));

  // 31-55: Warning condition vectors (25 vectors)
  vectors.push(...generateWarningVectors(25));

  // 56-70: Critical condition vectors (15 vectors)
  vectors.push(...generateCriticalVectors(15));

  // 71-80: Optimization opportunity vectors (10 vectors)
  vectors.push(...generateOptimizationVectors(10));

  // 81-90: Maintenance required vectors (10 vectors)
  vectors.push(...generateMaintenanceVectors(10));

  // 91-95: Emergency vectors (5 vectors)
  vectors.push(...generateEmergencyVectors(5));

  // 96-100: Anomaly vectors (5 vectors)
  vectors.push(...generateAnomalyVectors(5));

  // Add index to each
  return vectors.map((v, index) => ({
    ...v,
    metadata: { ...v.metadata, index }
  }));
}

/**
 * Generate normal operation vectors - baseline healthy system
 */
function generateNormalVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const baseVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

  for (let i = 0; i < count; i++) {
    const variation = 0.1;
    const vector = baseVector.map(v => v + (Math.random() - 0.5) * variation);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'normal',
        pattern: 'baseline',
        description: `Normal operation ${i + 1}`,
        expectedOutputs: [OutputType.SYSTEM_HEALTHY, OutputType.NORMAL_OPERATION]
      }
    });
  }

  return vectors;
}

/**
 * Generate warning condition vectors - elevated but not critical
 */
function generateWarningVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const patterns = [
    { name: 'high_temp', vector: [0.75, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'high_humidity', vector: [0.5, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'high_load', vector: [0.5, 0.5, 0.5, 0.5, 0.72, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'elevated_co2', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'gradual_increase', vector: [0.6, 0.62, 0.64, 0.66, 0.68, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }
  ];

  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    const noise = 0.05;
    const vector = pattern.vector.map(v => v + (Math.random() - 0.5) * noise);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'warning',
        pattern: pattern.name,
        description: `Warning: ${pattern.name.replace(/_/g, ' ')}`,
        expectedOutputs: [OutputType.WARNING_ALERT]
      }
    });
  }

  return vectors;
}

/**
 * Generate critical condition vectors - serious issues
 */
function generateCriticalVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const patterns = [
    { name: 'very_high_temp', vector: [0.9, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'system_overload', vector: [0.5, 0.5, 0.5, 0.5, 0.95, 0.85, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'pressure_spike', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.88, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'multi_param_critical', vector: [0.85, 0.82, 0.8, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }
  ];

  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    const noise = 0.03;
    const vector = pattern.vector.map(v => v + (Math.random() - 0.5) * noise);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'critical',
        pattern: pattern.name,
        description: `Critical: ${pattern.name.replace(/_/g, ' ')}`,
        expectedOutputs: [OutputType.CRITICAL_ALERT]
      }
    });
  }

  return vectors;
}

/**
 * Generate optimization opportunity vectors - efficiency improvements possible
 */
function generateOptimizationVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const patterns = [
    { name: 'low_efficiency', vector: [0.3, 0.4, 0.3, 0.35, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'resource_underutilization', vector: [0.5, 0.5, 0.25, 0.3, 0.28, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'timing_opportunity', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.32, 0.35, 0.3, 0.5, 0.5, 0.5] }
  ];

  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    const noise = 0.04;
    const vector = pattern.vector.map(v => v + (Math.random() - 0.5) * noise);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'optimization',
        pattern: pattern.name,
        description: `Optimization: ${pattern.name.replace(/_/g, ' ')}`,
        expectedOutputs: [OutputType.OPTIMIZATION_TRIGGER, OutputType.EFFICIENCY_BOOST]
      }
    });
  }

  return vectors;
}

/**
 * Generate maintenance required vectors - wear and tear indicators
 */
function generateMaintenanceVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const patterns = [
    { name: 'component_degradation', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.65, 0.68, 0.7, 0.5] },
    { name: 'vibration_increase', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.72, 0.5, 0.5] },
    { name: 'filter_clogging', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.7, 0.68, 0.5, 0.5, 0.5, 0.5, 0.75] }
  ];

  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    const noise = 0.04;
    const vector = pattern.vector.map(v => v + (Math.random() - 0.5) * noise);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'maintenance',
        pattern: pattern.name,
        description: `Maintenance: ${pattern.name.replace(/_/g, ' ')}`,
        expectedOutputs: [OutputType.MAINTENANCE_REQUIRED]
      }
    });
  }

  return vectors;
}

/**
 * Generate emergency vectors - critical failures
 */
function generateEmergencyVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];
  const patterns = [
    { name: 'catastrophic_failure', vector: [0.98, 0.95, 0.92, 0.9, 0.88, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { name: 'safety_breach', vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.95, 0.92, 0.9, 0.88, 0.5, 0.5] },
    { name: 'system_collapse', vector: [0.85, 0.88, 0.9, 0.92, 0.95, 0.93, 0.91, 0.89, 0.87, 0.5, 0.5, 0.5] }
  ];

  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    const noise = 0.02;
    const vector = pattern.vector.map(v => v + (Math.random() - 0.5) * noise);

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'emergency',
        pattern: pattern.name,
        description: `Emergency: ${pattern.name.replace(/_/g, ' ')}`,
        expectedOutputs: [OutputType.EMERGENCY]
      }
    });
  }

  return vectors;
}

/**
 * Generate anomaly vectors - unusual patterns
 */
function generateAnomalyVectors(count: number): LabeledInputVector[] {
  const vectors: LabeledInputVector[] = [];

  for (let i = 0; i < count; i++) {
    // Create unusual oscillating or erratic patterns
    const vector: number[] = [];

    for (let j = 0; j < 12; j++) {
      if (i % 2 === 0) {
        // Oscillating pattern
        vector.push((Math.sin(j * Math.PI / 3) + 1) / 2);
      } else {
        // Erratic random spikes
        vector.push(Math.random() > 0.7 ? Math.random() * 0.9 + 0.1 : 0.4 + Math.random() * 0.2);
      }
    }

    vectors.push({
      vector,
      metadata: {
        index: 0,
        type: 'anomaly',
        pattern: i % 2 === 0 ? 'oscillating' : 'erratic_spikes',
        description: `Anomaly: ${i % 2 === 0 ? 'oscillating pattern' : 'erratic spikes'}`,
        expectedOutputs: [OutputType.ANOMALY_DETECTED]
      }
    });
  }

  return vectors;
}

/**
 * Get color for input vector type (for timeline visualization)
 */
export function getInputVectorColor(type: string): string {
  const colorMap: Record<string, string> = {
    normal: '#22c55e',      // Green
    warning: '#eab308',     // Yellow
    critical: '#f97316',    // Orange
    emergency: '#ef4444',   // Red
    optimization: '#3b82f6', // Blue
    maintenance: '#a855f7', // Purple
    anomaly: '#6b7280'      // Gray
  };

  return colorMap[type] || '#64748b';
}
