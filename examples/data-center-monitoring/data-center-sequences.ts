import { CriticalEventSequence } from '../../src/models/CriticalEventSequence.js';
import { RealityVector } from '../../src/models/RealityVector.js';
import { ComparatorType, OutputVector } from '../../src/models/types.js';

/**
 * Data Center Monitoring - 5 Critical Event Sequences
 * Each sequence has minimum 5 vectors before reaching critical output
 */

// Output vector definitions
const OUTPUT_VECTORS = {
  NORMAL: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  WARNING: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  CRITICAL: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  EMERGENCY: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  COOLING_ACTIVATE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] as number[],
  LOAD_BALANCER: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0] as number[],
  BACKUP_POWER: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] as number[],
  CLEANUP_STORAGE: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0] as number[],
  SECURITY_LOCKDOWN: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] as number[]
};

function createOutput(vector: number[], description: string): OutputVector {
  return {
    vector,
    confidence: 1.0,
    metadata: { description, timestamp: Date.now() }
  };
}

/**
 * Sequence 1: Server Temperature Monitoring
 * 5 states: Normal → Warm → Hot → Critical → Emergency
 */
export function createTemperatureSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Server Temperature Monitoring');

  // State 1: Normal (68-72°F) - INITIAL
  const normal = new RealityVector(
    [{ value: 0.3, comparatorType: ComparatorType.LESS_THAN, threshold: 0.4 }],
    true
  );
  normal.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Temperature Normal'));
  seq.addVector(normal);

  // State 2: Warm (72-78°F)
  const warm = new RealityVector(
    [{ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }],
    false
  );
  warm.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Temperature Elevated'));
  normal.addNextVector(warm.id);
  seq.addVector(warm);

  // State 3: Hot (78-85°F)
  const hot = new RealityVector(
    [{ value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }],
    false
  );
  hot.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Temperature High'));
  warm.addNextVector(hot.id);
  seq.addVector(hot);

  // State 4: Critical (85-95°F)
  const critical = new RealityVector(
    [{ value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }],
    false
  );
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Temperature Critical'));
  hot.addNextVector(critical.id);
  seq.addVector(critical);

  // State 5: Emergency (>95°F)
  const emergency = new RealityVector(
    [{ value: 0.95, comparatorType: ComparatorType.GREATER_THAN, threshold: 0.9 }],
    false
  );
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Temperature Emergency'));
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.COOLING_ACTIVATE, 'Activate Emergency Cooling'));
  critical.addNextVector(emergency.id);
  seq.addVector(emergency);

  return seq;
}

/**
 * Sequence 2: Network Traffic Monitoring
 * 5 states: Baseline → Elevated → Congested → Overloaded → Failure Imminent
 */
export function createNetworkTrafficSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Network Traffic Monitoring');

  // State 1: Baseline (<40% capacity) - INITIAL
  const baseline = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.3, comparatorType: ComparatorType.LESS_THAN, threshold: 0.4 }
    ],
    true
  );
  baseline.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Network Traffic Normal'));
  seq.addVector(baseline);

  // State 2: Elevated (40-60%)
  const elevated = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  elevated.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Network Traffic Elevated'));
  baseline.addNextVector(elevated.id);
  seq.addVector(elevated);

  // State 3: Congested (60-75%)
  const congested = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  congested.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Network Congested'));
  elevated.addNextVector(congested.id);
  seq.addVector(congested);

  // State 4: Overloaded (75-90%)
  const overloaded = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }
    ],
    false
  );
  overloaded.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Network Overloaded'));
  congested.addNextVector(overloaded.id);
  seq.addVector(overloaded);

  // State 5: Failure Imminent (>90%)
  const failure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.95, comparatorType: ComparatorType.GREATER_THAN, threshold: 0.9 }
    ],
    false
  );
  failure.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Network Failure Imminent'));
  failure.addOutputVector(createOutput(OUTPUT_VECTORS.LOAD_BALANCER, 'Activate Load Balancer'));
  overloaded.addNextVector(failure.id);
  seq.addVector(failure);

  return seq;
}

/**
 * Sequence 3: Power Consumption Monitoring
 * 5 states: Optimal → Increased → High → Critical → Shutdown Required
 */
export function createPowerConsumptionSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Power Consumption Monitoring');

  // State 1: Optimal (<50% capacity) - INITIAL
  const optimal = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.35, comparatorType: ComparatorType.LESS_THAN, threshold: 0.5 }
    ],
    true
  );
  optimal.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Power Consumption Optimal'));
  seq.addVector(optimal);

  // State 2: Increased (50-65%)
  const increased = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.55, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  increased.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Power Consumption Increased'));
  optimal.addNextVector(increased.id);
  seq.addVector(increased);

  // State 3: High (65-80%)
  const high = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.72, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  high.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Power Consumption High'));
  increased.addNextVector(high.id);
  seq.addVector(high);

  // State 4: Critical (80-95%)
  const critical = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.88, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }
    ],
    false
  );
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Power Consumption Critical'));
  high.addNextVector(critical.id);
  seq.addVector(critical);

  // State 5: Shutdown Required (>95%)
  const shutdown = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.98, comparatorType: ComparatorType.GREATER_THAN, threshold: 0.95 }
    ],
    false
  );
  shutdown.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Power Shutdown Required'));
  shutdown.addOutputVector(createOutput(OUTPUT_VECTORS.BACKUP_POWER, 'Switch to Backup Power'));
  critical.addNextVector(shutdown.id);
  seq.addVector(shutdown);

  return seq;
}

/**
 * Sequence 4: Storage Capacity Monitoring
 * 5 states: Healthy → Filling → Near Full → Critical → Emergency Cleanup
 */
export function createStorageCapacitySequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Storage Capacity Monitoring');

  // State 1: Healthy (<60% used) - INITIAL
  const healthy = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.4, comparatorType: ComparatorType.LESS_THAN, threshold: 0.6 }
    ],
    true
  );
  healthy.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Storage Capacity Healthy'));
  seq.addVector(healthy);

  // State 2: Filling (60-75%)
  const filling = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.68, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  filling.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Storage Filling'));
  healthy.addNextVector(filling.id);
  seq.addVector(filling);

  // State 3: Near Full (75-85%)
  const nearFull = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }
    ],
    false
  );
  nearFull.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Storage Near Full'));
  filling.addNextVector(nearFull.id);
  seq.addVector(nearFull);

  // State 4: Critical (85-95%)
  const critical = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.06 }
    ],
    false
  );
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Storage Critical'));
  nearFull.addNextVector(critical.id);
  seq.addVector(critical);

  // State 5: Emergency Cleanup (>95%)
  const emergency = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.97, comparatorType: ComparatorType.GREATER_THAN, threshold: 0.95 }
    ],
    false
  );
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Storage Emergency'));
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.CLEANUP_STORAGE, 'Initiate Emergency Cleanup'));
  critical.addNextVector(emergency.id);
  seq.addVector(emergency);

  return seq;
}

/**
 * Sequence 5: Security Threat Detection
 * 5 states: Secure → Suspicious → Threat Detected → Active Attack → Breach
 */
export function createSecurityThreatSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Security Threat Detection');

  // State 1: Secure (baseline) - INITIAL
  const secure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.1, comparatorType: ComparatorType.LESS_THAN, threshold: 0.2 }
    ],
    true
  );
  secure.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Security Status: Secure'));
  seq.addVector(secure);

  // State 2: Suspicious (anomaly detected)
  const suspicious = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.35, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
    ],
    false
  );
  suspicious.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Suspicious Activity Detected'));
  secure.addNextVector(suspicious.id);
  seq.addVector(suspicious);

  // State 3: Threat Detected (confirmed threat)
  const threat = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
    ],
    false
  );
  threat.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Threat Confirmed'));
  suspicious.addNextVector(threat.id);
  seq.addVector(threat);

  // State 4: Active Attack (ongoing attack)
  const attack = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }
    ],
    false
  );
  attack.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Active Attack in Progress'));
  threat.addNextVector(attack.id);
  seq.addVector(attack);

  // State 5: Breach (security compromised)
  const breach = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.EXACT, threshold: 0.0 },
      { value: 0.95, comparatorType: ComparatorType.GREATER_THAN, threshold: 0.9 }
    ],
    false
  );
  breach.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Security Breach Detected'));
  breach.addOutputVector(createOutput(OUTPUT_VECTORS.SECURITY_LOCKDOWN, 'Initiate Security Lockdown'));
  attack.addNextVector(breach.id);
  seq.addVector(breach);

  return seq;
}

/**
 * Generate initial events for all 5 sequences
 */
export function generateInitialEvents(): number[][] {
  return [
    // Event 1: Temperature normal, all else baseline
    [0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],

    // Event 2: Network baseline, all else normal
    [0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],

    // Event 3: Power optimal, all else normal
    [0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],

    // Event 4: Storage healthy, all else normal
    [0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],

    // Event 5: Security secure, all else normal
    [0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  ];
}

/**
 * Generate progression vectors that escalate all 5 sequences
 */
export function generateProgressionVectors(): number[][] {
  const vectors: number[][] = [];

  // Gradual escalation across all dimensions
  for (let step = 1; step <= 20; step++) {
    const intensity = step / 20; // 0.05 to 1.0

    vectors.push([
      0.3 + (intensity * 0.68),  // Temperature: 0.3 → 0.98
      0.25 + (intensity * 0.73), // Network: 0.25 → 0.98
      0.3 + (intensity * 0.68),  // Power: 0.3 → 0.98
      0.35 + (intensity * 0.63), // Storage: 0.35 → 0.98
      0.05 + (intensity * 0.93), // Security: 0.05 → 0.98
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5 // Other dimensions stable
    ]);
  }

  return vectors;
}

/**
 * Create all 5 sequences
 */
export function createDataCenterSequences(): CriticalEventSequence[] {
  return [
    createTemperatureSequence(),
    createNetworkTrafficSequence(),
    createPowerConsumptionSequence(),
    createStorageCapacitySequence(),
    createSecurityThreatSequence()
  ];
}
