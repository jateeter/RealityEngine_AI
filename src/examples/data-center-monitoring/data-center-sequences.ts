import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector } from '../../models/types.js';

/**
 * Data Center Monitoring - Complex Critical Event Sequences
 *
 * This example demonstrates advanced critical event sequence relationships with:
 * - Non-binary input vectors (continuous sensor readings)
 * - Variable threshold matching functions
 * - Multi-dimensional dependencies
 * - Branching sequences
 * - Correlated failure patterns
 *
 * Event Space: 8-dimensional continuous vectors representing:
 * [0] CPU_TEMP       - CPU temperature (normalized 0.0-1.0, represents 20°C-100°C)
 * [1] CPU_LOAD       - CPU load percentage (0.0-1.0 = 0%-100%)
 * [2] NETWORK_BWTH   - Network bandwidth utilization (0.0-1.0 = 0Gbps-10Gbps)
 * [3] POWER_WATTS    - Power consumption (normalized 0.0-1.0, represents 0-10000W)
 * [4] STORAGE_USED   - Storage capacity used (0.0-1.0 = 0%-100%)
 * [5] MEMORY_USED    - Memory utilization (0.0-1.0 = 0%-100%)
 * [6] DISK_IO        - Disk I/O operations (normalized 0.0-1.0)
 * [7] SECURITY_SCORE - Security threat level (0.0=secure, 1.0=breach)
 *
 * Output Space: 12-dimensional one-hot encoded action vectors
 */

// Output vector definitions (one-hot encoded actions)
const OUTPUT_VECTORS = {
  NORMAL: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  WARNING: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  CRITICAL: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  EMERGENCY: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
  COOLING_ACTIVATE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] as number[],
  LOAD_BALANCER: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0] as number[],
  BACKUP_POWER: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] as number[],
  CLEANUP_STORAGE: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0] as number[],
  SECURITY_LOCKDOWN: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] as number[],
  THROTTLE_CPU: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0] as number[],
  DEDUP_STORAGE: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] as number[],
  CACHE_FLUSH: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] as number[]
};

function createOutput(vector: number[], description: string, severity: string = 'INFO'): OutputVector {
  return {
    id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vector,
    timestamp: Date.now(),
    metadata: { description, severity }
  };
}

/**
 * Sequence 1: Thermal Overload with Load Correlation
 *
 * This sequence demonstrates multi-dimensional dependencies:
 * - CPU temperature rises with CPU load
 * - Different thresholds based on load levels
 * - Emergency cooling triggered when both temp AND load are high
 *
 * Path: Normal → Warm → Hot → Critical → Thermal Emergency
 */
export function createThermalOverloadSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Thermal Overload - Load Correlated');

  // State 1: Normal Operating Temperature (20-40°C, <50% load) - INITIAL
  const normal = new RealityVector(
    [
      { value: 0.25, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // CPU_TEMP: ~30°C ±12°C
      { value: 0.30, comparatorType: ComparatorType.THRESHOLD, threshold: 0.25 }, // CPU_LOAD: ~30% ±25%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },     // NETWORK: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },     // POWER: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },     // STORAGE: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },     // MEMORY: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },     // DISK_IO: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }      // SECURITY: any
    ],
    true
  );
  normal.metadata = {
    name: 'Normal Temp',
    description: 'CPU temperature normal (20-40°C)',
    tempRange: '20-40°C',
    loadRange: '0-55%'
  };
  normal.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Thermal status: Normal', 'INFO'));
  seq.addVector(normal);

  // State 2: Warm - Elevated Temperature (40-60°C, 50-70% load)
  const warm = new RealityVector(
    [
      { value: 0.50, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // CPU_TEMP: ~50°C ±10°C
      { value: 0.60, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // CPU_LOAD: ~60% ±15%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  warm.metadata = {
    name: 'Warm',
    description: 'Temperature elevated with increased load',
    tempRange: '40-60°C',
    loadRange: '50-70%'
  };
  warm.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Thermal warning: Temperature rising with load', 'WARNING'));
  normal.addNextVector(warm.id);
  seq.addVector(warm);

  // State 3: Hot - High Temperature (60-75°C, 70-85% load)
  const hot = new RealityVector(
    [
      { value: 0.69, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // CPU_TEMP: ~67°C ±8°C
      { value: 0.78, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // CPU_LOAD: ~78% ±12%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  hot.metadata = {
    name: 'Hot',
    description: 'High temperature with heavy load',
    tempRange: '60-75°C',
    loadRange: '70-85%'
  };
  hot.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Thermal warning: High temperature under load', 'WARNING'));
  warm.addNextVector(hot.id);
  seq.addVector(hot);

  // State 4: Critical - Very High Temperature (75-85°C, >85% load)
  const critical = new RealityVector(
    [
      { value: 0.81, comparatorType: ComparatorType.THRESHOLD, threshold: 0.07 }, // CPU_TEMP: ~80°C ±6°C
      { value: 0.88, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }, // CPU_LOAD: ~88% ±8%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  critical.metadata = {
    name: 'Critical',
    description: 'Critical temperature - throttling recommended',
    tempRange: '75-85°C',
    loadRange: '85-95%'
  };
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Thermal CRITICAL: Temperature approaching thermal limit', 'CRITICAL'));
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.THROTTLE_CPU, 'Action: Throttle CPU to reduce heat', 'ACTION'));
  hot.addNextVector(critical.id);
  seq.addVector(critical);

  // State 5: Thermal Emergency (>85°C, >90% load) - EMERGENCY COOLING REQUIRED
  const emergency = new RealityVector(
    [
      { value: 0.91, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }, // CPU_TEMP: ~92°C ±4°C
      { value: 0.94, comparatorType: ComparatorType.THRESHOLD, threshold: 0.04 }, // CPU_LOAD: ~94% ±4%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  emergency.metadata = {
    name: 'Thermal Emergency',
    description: 'EMERGENCY: Thermal shutdown imminent',
    tempRange: '>85°C',
    loadRange: '>90%',
    risk: 'Hardware damage possible'
  };
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'THERMAL EMERGENCY: Immediate action required', 'EMERGENCY'));
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.COOLING_ACTIVATE, 'Action: Activate emergency cooling systems', 'ACTION'));
  emergency.addOutputVector(createOutput(OUTPUT_VECTORS.THROTTLE_CPU, 'Action: Force CPU throttling', 'ACTION'));
  critical.addNextVector(emergency.id);
  seq.addVector(emergency);

  return seq;
}

/**
 * Sequence 2: Network Traffic Surge Detection
 *
 * Detects sudden spikes in network traffic using tighter thresholds.
 * Demonstrates pattern-based anomaly detection.
 *
 * Path: Baseline → Elevated → Surge → Congestion → Overflow
 */
export function createNetworkSurgeSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Network Traffic Surge Detection');

  // State 1: Baseline Traffic (<3 Gbps) - INITIAL
  const baseline = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.28, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // NETWORK: ~2.8Gbps ±1.5Gbps
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    true
  );
  baseline.metadata = {
    name: 'Baseline Traffic',
    description: 'Normal network traffic levels',
    bandwidth: '<3 Gbps'
  };
  baseline.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Network traffic: Normal', 'INFO'));
  seq.addVector(baseline);

  // State 2: Elevated Traffic (3-5 Gbps)
  const elevated = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.48, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // NETWORK: ~4.8Gbps ±1.2Gbps
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  elevated.metadata = {
    name: 'Elevated Traffic',
    description: 'Network traffic increasing',
    bandwidth: '3-5 Gbps'
  };
  elevated.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Network traffic elevated - monitoring', 'WARNING'));
  baseline.addNextVector(elevated.id);
  seq.addVector(elevated);

  // State 3: Traffic Surge (5-7 Gbps)
  const surge = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.65, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // NETWORK: ~6.5Gbps ±1.0Gbps
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  surge.metadata = {
    name: 'Traffic Surge',
    description: 'Sudden network traffic surge detected',
    bandwidth: '5-7 Gbps'
  };
  surge.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Network surge detected - preparing load balancer', 'WARNING'));
  elevated.addNextVector(surge.id);
  seq.addVector(surge);

  // State 4: Network Congestion (7-9 Gbps)
  const congestion = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.82, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }, // NETWORK: ~8.2Gbps ±0.8Gbps
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  congestion.metadata = {
    name: 'Congestion',
    description: 'Network congestion - performance degraded',
    bandwidth: '7-9 Gbps'
  };
  congestion.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Network CRITICAL: Congestion detected', 'CRITICAL'));
  surge.addNextVector(congestion.id);
  seq.addVector(congestion);

  // State 5: Network Overflow (>9 Gbps) - LOAD BALANCER ACTIVATION
  const overflow = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.93, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }, // NETWORK: ~9.3Gbps ±0.5Gbps
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  overflow.metadata = {
    name: 'Network Overflow',
    description: 'EMERGENCY: Network capacity exceeded',
    bandwidth: '>9 Gbps',
    risk: 'Packet loss imminent'
  };
  overflow.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Network EMERGENCY: Capacity exceeded', 'EMERGENCY'));
  overflow.addOutputVector(createOutput(OUTPUT_VECTORS.LOAD_BALANCER, 'Action: Activate load balancer NOW', 'ACTION'));
  congestion.addNextVector(overflow.id);
  seq.addVector(overflow);

  return seq;
}

/**
 * Sequence 3: Power Efficiency Anomaly (Power/Load Ratio)
 *
 * Monitors power consumption relative to CPU load.
 * High power with low load indicates inefficiency.
 *
 * Path: Efficient → Moderate → Inefficient → Wasteful → Power Crisis
 */
export function createPowerEfficiencySequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Power Efficiency Monitoring');

  // State 1: Efficient Operation (Power matches load) - INITIAL
  const efficient = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.35, comparatorType: ComparatorType.THRESHOLD, threshold: 0.20 }, // CPU_LOAD: ~35% ±20%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.38, comparatorType: ComparatorType.THRESHOLD, threshold: 0.18 }, // POWER: ~3800W ±1800W (matches load)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    true
  );
  efficient.metadata = {
    name: 'Efficient',
    description: 'Power consumption matches load',
    efficiency: 'Optimal'
  };
  efficient.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Power efficiency: Optimal', 'INFO'));
  seq.addVector(efficient);

  // State 2: Moderate Efficiency (Slight mismatch)
  const moderate = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.45, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // CPU_LOAD: ~45% ±15%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.58, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // POWER: ~5800W (higher than load)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  moderate.metadata = {
    name: 'Moderate',
    description: 'Power consumption slightly elevated',
    efficiency: 'Acceptable'
  };
  moderate.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Power efficiency: Moderate - monitoring', 'WARNING'));
  efficient.addNextVector(moderate.id);
  seq.addVector(moderate);

  // State 3: Inefficient (Power >> Load)
  const inefficient = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.52, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // CPU_LOAD: ~52% ±12%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // POWER: ~7500W (much higher than load)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inefficient.metadata = {
    name: 'Inefficient',
    description: 'Power consumption disproportionate to load',
    efficiency: 'Poor'
  };
  inefficient.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Power efficiency: Poor - investigate', 'WARNING'));
  moderate.addNextVector(inefficient.id);
  seq.addVector(inefficient);

  // State 4: Wasteful (Major inefficiency)
  const wasteful = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.58, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // CPU_LOAD: ~58% ±10%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.87, comparatorType: ComparatorType.THRESHOLD, threshold: 0.07 }, // POWER: ~8700W (wasteful)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  wasteful.metadata = {
    name: 'Wasteful',
    description: 'Severe power inefficiency detected',
    efficiency: 'Critical'
  };
  wasteful.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Power efficiency CRITICAL: Wasteful operation', 'CRITICAL'));
  inefficient.addNextVector(wasteful.id);
  seq.addVector(wasteful);

  // State 5: Power Crisis (Approaching capacity limit)
  const crisis = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.62, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }, // CPU_LOAD: ~62% ±8%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.96, comparatorType: ComparatorType.THRESHOLD, threshold: 0.04 }, // POWER: ~9600W (near limit)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  crisis.metadata = {
    name: 'Power Crisis',
    description: 'EMERGENCY: Power capacity nearly exceeded',
    efficiency: 'Emergency',
    risk: 'Circuit breaker trip imminent'
  };
  crisis.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Power EMERGENCY: Approaching capacity limit', 'EMERGENCY'));
  crisis.addOutputVector(createOutput(OUTPUT_VECTORS.BACKUP_POWER, 'Action: Prepare backup power systems', 'ACTION'));
  wasteful.addNextVector(crisis.id);
  seq.addVector(crisis);

  return seq;
}

/**
 * Sequence 4: Storage Deduplication Opportunity
 *
 * Detects when high storage usage with high disk I/O indicates
 * potential for deduplication to free space.
 *
 * Path: Healthy → Growing → High → Critical → Dedup Opportunity
 */
export function createStorageDedupSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Storage Deduplication Detection');

  // State 1: Healthy Storage (<50% used, normal I/O) - INITIAL
  const healthy = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.35, comparatorType: ComparatorType.THRESHOLD, threshold: 0.18 }, // STORAGE: ~35% ±18%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.28, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // DISK_IO: normal
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    true
  );
  healthy.metadata = {
    name: 'Healthy Storage',
    description: 'Storage capacity healthy',
    usage: '<50%'
  };
  healthy.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Storage status: Healthy', 'INFO'));
  seq.addVector(healthy);

  // State 2: Growing Storage (50-70% used, elevated I/O)
  const growing = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.62, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // STORAGE: ~62% ±12%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.48, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // DISK_IO: elevated
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  growing.metadata = {
    name: 'Growing',
    description: 'Storage usage increasing',
    usage: '50-70%'
  };
  growing.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Storage growing - monitoring', 'WARNING'));
  healthy.addNextVector(growing.id);
  seq.addVector(growing);

  // State 3: High Storage (70-85% used, high I/O)
  const high = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.78, comparatorType: ComparatorType.THRESHOLD, threshold: 0.09 }, // STORAGE: ~78% ±9%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.72, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // DISK_IO: high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  high.metadata = {
    name: 'High Storage',
    description: 'Storage usage high with heavy I/O',
    usage: '70-85%'
  };
  high.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Storage high - analyzing for duplicates', 'WARNING'));
  growing.addNextVector(high.id);
  seq.addVector(high);

  // State 4: Critical Storage (85-92% used, very high I/O)
  const critical = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.88, comparatorType: ComparatorType.THRESHOLD, threshold: 0.06 }, // STORAGE: ~88% ±6%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.07 }, // DISK_IO: very high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  critical.metadata = {
    name: 'Critical Storage',
    description: 'Storage CRITICAL with high I/O activity',
    usage: '85-92%'
  };
  critical.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'Storage CRITICAL: High usage detected', 'CRITICAL'));
  high.addNextVector(critical.id);
  seq.addVector(critical);

  // State 5: Deduplication Opportunity (>92% used, sustained high I/O)
  const dedupNeeded = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold: 0.04 }, // STORAGE: ~95% ±4%
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.92, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }, // DISK_IO: sustained high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  dedupNeeded.metadata = {
    name: 'Dedup Opportunity',
    description: 'EMERGENCY: Deduplication recommended',
    usage: '>92%',
    recommendation: 'Run deduplication to free space'
  };
  dedupNeeded.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'Storage EMERGENCY: Nearly full', 'EMERGENCY'));
  dedupNeeded.addOutputVector(createOutput(OUTPUT_VECTORS.DEDUP_STORAGE, 'Action: Run storage deduplication', 'ACTION'));
  dedupNeeded.addOutputVector(createOutput(OUTPUT_VECTORS.CLEANUP_STORAGE, 'Action: Initiate cleanup procedures', 'ACTION'));
  critical.addNextVector(dedupNeeded.id);
  seq.addVector(dedupNeeded);

  return seq;
}

/**
 * Sequence 5: Cascading Memory-Cache Failure
 *
 * Detects correlated memory and cache pressure that leads to
 * performance degradation and potential system instability.
 *
 * Path: Normal → Pressure → Thrashing → Cascading → System Failure
 */
export function createMemoryCacheFailureSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Memory-Cache Cascading Failure');

  // State 1: Normal Memory/Cache Operation - INITIAL
  const normal = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.40, comparatorType: ComparatorType.THRESHOLD, threshold: 0.20 }, // CPU_LOAD: moderate
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.45, comparatorType: ComparatorType.THRESHOLD, threshold: 0.18 }, // MEMORY: ~45% ±18%
      { value: 0.38, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // DISK_IO: normal
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    true
  );
  normal.metadata = {
    name: 'Normal Operation',
    description: 'Memory and cache operating normally',
    memoryUsage: '<60%'
  };
  normal.addOutputVector(createOutput(OUTPUT_VECTORS.NORMAL, 'Memory/Cache status: Normal', 'INFO'));
  seq.addVector(normal);

  // State 2: Memory Pressure (Memory high, cache misses increasing)
  const pressure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.65, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // CPU_LOAD: elevated
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.72, comparatorType: ComparatorType.THRESHOLD, threshold: 0.10 }, // MEMORY: ~72% ±10%
      { value: 0.58, comparatorType: ComparatorType.THRESHOLD, threshold: 0.12 }, // DISK_IO: elevated (paging)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  pressure.metadata = {
    name: 'Memory Pressure',
    description: 'Memory pressure with increased paging',
    memoryUsage: '60-80%',
    cacheStatus: 'Miss rate increasing'
  };
  pressure.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Memory pressure detected - cache misses rising', 'WARNING'));
  normal.addNextVector(pressure.id);
  seq.addVector(pressure);

  // State 3: Memory Thrashing (High memory, heavy disk I/O)
  const thrashing = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.82, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }, // CPU_LOAD: high (wait states)
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.88, comparatorType: ComparatorType.THRESHOLD, threshold: 0.06 }, // MEMORY: ~88% ±6%
      { value: 0.82, comparatorType: ComparatorType.THRESHOLD, threshold: 0.08 }, // DISK_IO: thrashing
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  thrashing.metadata = {
    name: 'Thrashing',
    description: 'Memory thrashing - severe performance degradation',
    memoryUsage: '80-92%',
    cacheStatus: 'High miss rate - thrashing'
  };
  thrashing.addOutputVector(createOutput(OUTPUT_VECTORS.WARNING, 'Memory thrashing - performance severely degraded', 'WARNING'));
  thrashing.addOutputVector(createOutput(OUTPUT_VECTORS.CACHE_FLUSH, 'Action: Flush non-critical caches', 'ACTION'));
  pressure.addNextVector(thrashing.id);
  seq.addVector(thrashing);

  // State 4: Cascading Failure (Memory exhausted, system degrading)
  const cascading = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.92, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }, // CPU_LOAD: very high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold: 0.03 }, // MEMORY: ~95% ±3%
      { value: 0.94, comparatorType: ComparatorType.THRESHOLD, threshold: 0.04 }, // DISK_IO: maxed out
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  cascading.metadata = {
    name: 'Cascading Failure',
    description: 'CRITICAL: Cascading memory/cache failure in progress',
    memoryUsage: '>92%',
    cacheStatus: 'Cache completely ineffective',
    risk: 'System instability imminent'
  };
  cascading.addOutputVector(createOutput(OUTPUT_VECTORS.CRITICAL, 'CRITICAL: Cascading memory failure detected', 'CRITICAL'));
  thrashing.addNextVector(cascading.id);
  seq.addVector(cascading);

  // State 5: System Failure Imminent (OOM killer activated)
  const failure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.97, comparatorType: ComparatorType.THRESHOLD, threshold: 0.03 }, // CPU_LOAD: critical
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.98, comparatorType: ComparatorType.THRESHOLD, threshold: 0.02 }, // MEMORY: ~98% ±2%
      { value: 0.97, comparatorType: ComparatorType.THRESHOLD, threshold: 0.03 }, // DISK_IO: critical
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  failure.metadata = {
    name: 'System Failure',
    description: 'EMERGENCY: System failure imminent - OOM condition',
    memoryUsage: '>95%',
    cacheStatus: 'Total failure',
    risk: 'Forced process termination imminent'
  };
  failure.addOutputVector(createOutput(OUTPUT_VECTORS.EMERGENCY, 'EMERGENCY: System failure imminent - out of memory', 'EMERGENCY'));
  failure.addOutputVector(createOutput(OUTPUT_VECTORS.CACHE_FLUSH, 'Action: Emergency cache flush', 'ACTION'));
  failure.addOutputVector(createOutput(OUTPUT_VECTORS.THROTTLE_CPU, 'Action: Throttle workload immediately', 'ACTION'));
  cascading.addNextVector(failure.id);
  seq.addVector(failure);

  return seq;
}

/**
 * Generate test input stream demonstrating complex sequence interactions
 *
 * Scenario: Data center experiences gradual degradation leading to multiple
 * critical events as systems become stressed.
 */
export function generateComplexTestVectors(): Array<{
  vector: number[];
  description: string;
  timestamp?: string;
  expectedSequences?: string[];
}> {
  return [
    {
      vector: [0.25, 0.30, 0.28, 0.38, 0.35, 0.45, 0.38, 0.05],
      description: 'Step 1: Normal baseline - all systems healthy',
      timestamp: '00:00:00',
      expectedSequences: ['All sequences at initial state']
    },
    {
      vector: [0.32, 0.38, 0.32, 0.42, 0.38, 0.48, 0.42, 0.08],
      description: 'Step 2: Slight increase across all metrics',
      timestamp: '00:05:00',
      expectedSequences: []
    },
    {
      vector: [0.48, 0.58, 0.45, 0.55, 0.45, 0.52, 0.48, 0.12],
      description: 'Step 3: Load increasing - temp rising with load',
      timestamp: '00:10:00',
      expectedSequences: ['Thermal: Normal→Warm', 'Power: Efficient→Moderate']
    },
    {
      vector: [0.52, 0.65, 0.52, 0.62, 0.52, 0.58, 0.52, 0.15],
      description: 'Step 4: Moderate stress - efficiency degrading',
      timestamp: '00:15:00',
      expectedSequences: []
    },
    {
      vector: [0.68, 0.75, 0.62, 0.72, 0.58, 0.65, 0.68, 0.18],
      description: 'Step 5: High load with elevated temperature',
      timestamp: '00:20:00',
      expectedSequences: ['Thermal: Warm→Hot', 'Storage: Healthy→Growing']
    },
    {
      vector: [0.72, 0.82, 0.68, 0.78, 0.68, 0.75, 0.72, 0.22],
      description: 'Step 6: Sustained high load - storage growing',
      timestamp: '00:25:00',
      expectedSequences: ['Network: Baseline→Elevated→Surge', 'Power: Moderate→Inefficient']
    },
    {
      vector: [0.78, 0.88, 0.75, 0.85, 0.75, 0.82, 0.78, 0.28],
      description: 'Step 7: Critical thermal levels - network surge detected',
      timestamp: '00:30:00',
      expectedSequences: ['Thermal: Hot→Critical', 'Storage: Growing→High', 'Memory: Normal→Pressure']
    },
    {
      vector: [0.82, 0.90, 0.82, 0.88, 0.82, 0.88, 0.82, 0.32],
      description: 'Step 8: Multiple systems approaching critical',
      timestamp: '00:35:00',
      expectedSequences: ['Network: Surge→Congestion', 'Power: Inefficient→Wasteful']
    },
    {
      vector: [0.88, 0.94, 0.88, 0.92, 0.88, 0.92, 0.88, 0.38],
      description: 'Step 9: Cascading failures beginning - memory thrashing',
      timestamp: '00:40:00',
      expectedSequences: ['Storage: High→Critical', 'Memory: Pressure→Thrashing']
    },
    {
      vector: [0.91, 0.96, 0.92, 0.95, 0.92, 0.95, 0.92, 0.42],
      description: 'Step 10: EMERGENCY - Thermal emergency + Network overflow',
      timestamp: '00:45:00',
      expectedSequences: ['Thermal: Critical→Emergency (COOLING + THROTTLE)', 'Network: Congestion→Overflow (LOAD_BALANCER)']
    },
    {
      vector: [0.94, 0.98, 0.95, 0.97, 0.95, 0.96, 0.95, 0.45],
      description: 'Step 11: CRITICAL - Power crisis + Storage dedup needed',
      timestamp: '00:50:00',
      expectedSequences: ['Power: Wasteful→Crisis (BACKUP_POWER)', 'Storage: Critical→Dedup (DEDUP + CLEANUP)']
    },
    {
      vector: [0.96, 0.99, 0.97, 0.98, 0.97, 0.98, 0.97, 0.48],
      description: 'Step 12: TOTAL FAILURE - Memory exhausted, cascading failure',
      timestamp: '00:55:00',
      expectedSequences: ['Memory: Thrashing→Cascading→Failure (CACHE_FLUSH + THROTTLE)']
    }
  ];
}

/**
 * Generate random input vector within data center operating ranges
 */
export function generateRandomDataCenterVector(): number[] {
  return [
    0.2 + Math.random() * 0.7,  // CPU_TEMP: 20-90% range
    0.2 + Math.random() * 0.7,  // CPU_LOAD: 20-90%
    0.1 + Math.random() * 0.8,  // NETWORK: 10-90%
    0.2 + Math.random() * 0.7,  // POWER: 20-90%
    0.2 + Math.random() * 0.7,  // STORAGE: 20-90%
    0.3 + Math.random() * 0.6,  // MEMORY: 30-90%
    0.2 + Math.random() * 0.7,  // DISK_IO: 20-90%
    0.0 + Math.random() * 0.3   // SECURITY: 0-30% (usually low)
  ];
}

/**
 * Create all data center monitoring sequences
 */
export function createDataCenterSequences(): CriticalEventSequence[] {
  return [
    createThermalOverloadSequence(),
    createNetworkSurgeSequence(),
    createPowerEfficiencySequence(),
    createStorageDedupSequence(),
    createMemoryCacheFailureSequence()
  ];
}

/**
 * Create a Data Center Monitoring Machine with comprehensive metadata
 */
export function createDataCenterMachine(): Machine {
  const testVectors = generateComplexTestVectors();

  const machine = new Machine(
    'Data Center Monitoring',
    'Complex critical event sequences demonstrating multi-dimensional dependencies, variable thresholds, and correlated failure patterns',
    {
      eventSpace: '8D continuous vectors: [CPU_TEMP, CPU_LOAD, NETWORK_BWTH, POWER_WATTS, STORAGE_USED, MEMORY_USED, DISK_IO, SECURITY_SCORE]',
      outputSpace: '12D one-hot encoded action vectors',
      sequenceCount: 5,
      inputVectorCount: testVectors.length,
      description: 'Advanced monitoring with thermal-load correlation, network surge detection, power efficiency analysis, storage deduplication, and cascading memory failures',
      sequences: [
        {
          name: 'Thermal Overload (Load Correlated)',
          path: 'Normal→Warm→Hot→Critical→Emergency',
          output: '[EMERGENCY, COOLING_ACTIVATE, THROTTLE_CPU]',
          description: 'Temperature monitoring with CPU load correlation'
        },
        {
          name: 'Network Traffic Surge Detection',
          path: 'Baseline→Elevated→Surge→Congestion→Overflow',
          output: '[EMERGENCY, LOAD_BALANCER]',
          description: 'Network bandwidth surge detection and load balancing'
        },
        {
          name: 'Power Efficiency Monitoring',
          path: 'Efficient→Moderate→Inefficient→Wasteful→Crisis',
          output: '[EMERGENCY, BACKUP_POWER]',
          description: 'Power consumption relative to load (efficiency monitoring)'
        },
        {
          name: 'Storage Deduplication Detection',
          path: 'Healthy→Growing→High→Critical→Dedup',
          output: '[EMERGENCY, DEDUP_STORAGE, CLEANUP_STORAGE]',
          description: 'Storage usage with I/O correlation for dedup opportunities'
        },
        {
          name: 'Memory-Cache Cascading Failure',
          path: 'Normal→Pressure→Thrashing→Cascading→Failure',
          output: '[EMERGENCY, CACHE_FLUSH, THROTTLE_CPU]',
          description: 'Correlated memory/cache pressure leading to cascading failures'
        }
      ],
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.description,
        timestamp: tv.timestamp,
        expectedSequences: tv.expectedSequences
      })),
      inputSequences: [
        {
          name: 'Gradual Degradation Scenario',
          pattern: '12-step escalation from normal to total failure',
          description: 'Complete test scenario showing gradual system degradation with multiple correlated failures',
          vectors: testVectors.map(tv => tv.vector)
        }
      ],
      features: [
        'Non-binary continuous input vectors (sensor readings)',
        'Variable threshold matching (tight thresholds for critical metrics)',
        'Multi-dimensional dependencies (temp correlates with load)',
        'Complex pattern detection (power efficiency = power/load ratio)',
        'Correlated failure sequences (memory thrashing causes disk I/O surge)',
        'Multiple outputs per critical event (emergency triggers multiple actions)'
      ]
    }
  );

  // Add all sequences to the machine
  const sequences = createDataCenterSequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}
