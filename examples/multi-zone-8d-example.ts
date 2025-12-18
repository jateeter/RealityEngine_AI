/**
 * Multi-Zone 8D Vector Example
 *
 * Demonstrates:
 * - 8-dimensional vectors
 * - 3 CriticalEventSequences
 * - Complex pattern matching
 * - Multi-zone sensor monitoring
 *
 * Scenario: Smart Building Monitoring System
 * - Zone 1: Office Area (environmental sensors)
 * - Zone 2: Server Room (IT infrastructure)
 * - Zone 3: Security Area (security sensors)
 */

// Load polyfills for Node.js 16 compatibility
import '../src/polyfills';

import { RealityEngine } from '../src/engine/RealityEngine';
import { RealityVector } from '../src/models/RealityVector';
import { CriticalEventSequence } from '../src/models/CriticalEventSequence';
import { PreceptionOfReality } from '../src/engine/PreceptionOfReality';
import { VectorStore } from '../src/services/VectorStore';
import { ComparatorType, VectorElement, OutputVector } from '../src/models/types';

/**
 * Create Zone 1: Office Area Monitoring
 * Monitors: Temperature, Humidity, Light, Motion, CO2, Sound, Pressure, Air Quality
 */
function createOfficeZone(): CriticalEventSequence {
  const zone = new CriticalEventSequence('Zone 1: Office Area');

  // Normal conditions
  const normal = new RealityVector(
    [
      { value: 22.0, comparatorType: ComparatorType.THRESHOLD, threshold: 2.0 },   // Temperature (°C)
      { value: 45.0, comparatorType: ComparatorType.THRESHOLD, threshold: 10.0 },  // Humidity (%)
      { value: 500.0, comparatorType: ComparatorType.THRESHOLD, threshold: 100.0 }, // Light (lux)
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },    // Motion (0-1)
      { value: 800.0, comparatorType: ComparatorType.THRESHOLD, threshold: 200.0 }, // CO2 (ppm)
      { value: 40.0, comparatorType: ComparatorType.THRESHOLD, threshold: 10.0 },  // Sound (dB)
      { value: 1013.0, comparatorType: ComparatorType.THRESHOLD, threshold: 5.0 }, // Pressure (hPa)
      { value: 85.0, comparatorType: ComparatorType.THRESHOLD, threshold: 15.0 }   // Air Quality (index)
    ],
    true // initial vector
  );

  // Alert conditions
  const alert = new RealityVector(
    [
      { value: 28.0, comparatorType: ComparatorType.THRESHOLD, threshold: 1.0 },
      { value: 65.0, comparatorType: ComparatorType.THRESHOLD, threshold: 5.0 },
      { value: 200.0, comparatorType: ComparatorType.THRESHOLD, threshold: 50.0 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 1200.0, comparatorType: ComparatorType.THRESHOLD, threshold: 100.0 },
      { value: 70.0, comparatorType: ComparatorType.THRESHOLD, threshold: 5.0 },
      { value: 1010.0, comparatorType: ComparatorType.THRESHOLD, threshold: 3.0 },
      { value: 60.0, comparatorType: ComparatorType.THRESHOLD, threshold: 10.0 }
    ],
    false
  );

  const alertOutput: OutputVector = {
    id: 'office-alert',
    vector: [1, 0, 0, 0, 0, 0, 0, 0],
    timestamp: Date.now(),
    metadata: {
      zone: 'Office Area',
      status: 'ALERT',
      message: 'Environmental conditions out of range',
      priority: 'high',
      sensors: {
        temperature: 'HIGH',
        humidity: 'HIGH',
        light: 'LOW',
        co2: 'HIGH'
      }
    }
  };

  alert.addOutputVector(alertOutput);

  // Connect vectors
  normal.addNextVector(alert.id);
  alert.addNextVector(normal.id);

  zone.addVector(normal);
  zone.addVector(alert);

  return zone;
}

/**
 * Create Zone 2: Server Room Monitoring
 * Monitors: Temperature, Humidity, Power, Network, CPU, Memory, Disk, Cooling
 */
function createServerZone(): CriticalEventSequence {
  const zone = new CriticalEventSequence('Zone 2: Server Room');

  // Optimal conditions
  const optimal = new RealityVector(
    [
      { value: 18.0, comparatorType: ComparatorType.THRESHOLD, threshold: 1.5 },  // Temperature (°C)
      { value: 40.0, comparatorType: ComparatorType.THRESHOLD, threshold: 5.0 },  // Humidity (%)
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },  // Power usage (0-1)
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },  // Network usage (0-1)
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },   // CPU usage (0-1)
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },   // Memory usage (0-1)
      { value: 0.4, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },   // Disk usage (0-1)
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }   // Cooling efficiency (0-1)
    ],
    true
  );

  // Warning state
  const warning = new RealityVector(
    [
      { value: 22.0, comparatorType: ComparatorType.THRESHOLD, threshold: 1.0 },
      { value: 50.0, comparatorType: ComparatorType.THRESHOLD, threshold: 5.0 },
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.80, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
      { value: 0.65, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
      { value: 0.60, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );

  // Critical state
  const critical = new RealityVector(
    [
      { value: 26.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.5 },
      { value: 60.0, comparatorType: ComparatorType.THRESHOLD, threshold: 3.0 },
      { value: 0.90, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 },
      { value: 0.70, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.80, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.70, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
    ],
    false
  );

  const warningOutput: OutputVector = {
    id: 'server-warning',
    vector: [0, 1, 0, 0, 0, 0, 0, 0],
    timestamp: Date.now(),
    metadata: {
      zone: 'Server Room',
      status: 'WARNING',
      message: 'Server metrics elevated',
      priority: 'medium'
    }
  };

  const criticalOutput: OutputVector = {
    id: 'server-critical',
    vector: [0, 0, 1, 0, 0, 0, 0, 0],
    timestamp: Date.now(),
    metadata: {
      zone: 'Server Room',
      status: 'CRITICAL',
      message: 'Server overload - immediate action required',
      priority: 'critical',
      metrics: {
        temperature: 'CRITICAL',
        cpu: 'HIGH',
        memory: 'HIGH',
        disk: 'HIGH'
      }
    }
  };

  warning.addOutputVector(warningOutput);
  critical.addOutputVector(criticalOutput);

  // Connect vectors
  optimal.addNextVector(warning.id);
  optimal.addNextVector(critical.id);
  warning.addNextVector(optimal.id);
  warning.addNextVector(critical.id);
  critical.addNextVector(optimal.id);

  zone.addVector(optimal);
  zone.addVector(warning);
  zone.addVector(critical);

  return zone;
}

/**
 * Create Zone 3: Security Area Monitoring
 * Monitors: Motion, Door, Window, Camera, Alarm, Access, Vibration, Heat
 */
function createSecurityZone(): CriticalEventSequence {
  const zone = new CriticalEventSequence('Zone 3: Security Area');

  // Secure state (all sensors normal)
  const secure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Motion
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Door (0=closed)
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Window (0=closed)
      { value: 1.0, comparatorType: ComparatorType.EQUALS },  // Camera (1=on)
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Alarm (0=off)
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Access (0=authorized)
      { value: 0.0, comparatorType: ComparatorType.EQUALS },  // Vibration
      { value: 0.0, comparatorType: ComparatorType.EQUALS }   // Heat signature
    ],
    true
  );

  // Breach detected
  const breach = new RealityVector(
    [
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 },
      { value: 1.0, comparatorType: ComparatorType.EQUALS },
      { value: 1.0, comparatorType: ComparatorType.EQUALS },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.3 }
    ],
    false
  );

  const breachOutput: OutputVector = {
    id: 'security-breach',
    vector: [0, 0, 0, 1, 0, 0, 0, 0],
    timestamp: Date.now(),
    metadata: {
      zone: 'Security Area',
      status: 'BREACH',
      message: 'Security breach detected - multiple sensors triggered',
      priority: 'critical',
      triggeredSensors: ['motion', 'door', 'window', 'access', 'vibration', 'heat']
    }
  };

  breach.addOutputVector(breachOutput);

  // Connect vectors
  secure.addNextVector(breach.id);
  breach.addNextVector(secure.id);

  zone.addVector(secure);
  zone.addVector(breach);

  return zone;
}

/**
 * Main execution function
 */
async function main() {
  console.log('==================================================================');
  console.log('Multi-Zone 8D Vector Example');
  console.log('==================================================================\n');
  console.log('Scenario: Smart Building Monitoring System');
  console.log('Vector Dimension: 8');
  console.log('CriticalEventSequences: 3\n');

  // Initialize system
  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);
  await engine.initialize();

  const perception = new PreceptionOfReality(8, true);

  console.log('✓ System initialized\n');

  // Create zones
  console.log('Creating monitoring zones...\n');

  const officeZone = createOfficeZone();
  engine.addSequence(officeZone);
  console.log(`✓ ${officeZone.name} created (${officeZone.getAllVectors().length} vectors)`);

  const serverZone = createServerZone();
  engine.addSequence(serverZone);
  console.log(`✓ ${serverZone.name} created (${serverZone.getAllVectors().length} vectors)`);

  const securityZone = createSecurityZone();
  engine.addSequence(securityZone);
  console.log(`✓ ${securityZone.name} created (${securityZone.getAllVectors().length} vectors)\n`);

  // Display statistics
  const stats = engine.getStats();
  console.log('System Statistics:');
  console.log(`  Total Sequences: ${stats.totalSequences}`);
  console.log(`  Total Vectors: ${stats.totalVectors}`);
  console.log(`  Active Vectors: ${stats.totalActiveVectors}\n`);

  // Test Scenarios
  console.log('==================================================================');
  console.log('Running Test Scenarios');
  console.log('==================================================================\n');

  // Scenario 1: Normal office conditions
  console.log('Scenario 1: Normal Office Conditions');
  console.log('-------------------------------------');
  const office1 = [22, 45, 500, 0.3, 800, 40, 1013, 85];
  console.log('Input:', office1);
  console.log('(Temp: 22°C, Hum: 45%, Light: 500lux, Motion: 0.3, CO2: 800ppm, Sound: 40dB, Pressure: 1013hPa, AQ: 85)');

  const result1 = engine.processInput(office1);
  console.log(`\nMatches: ${Array.from(result1.sequenceResults.values()).filter(r => r.matchedVectors.length > 0).length}`);
  console.log(`Outputs: ${result1.totalOutputs.length}`);
  if (result1.totalOutputs.length > 0) {
    result1.totalOutputs.forEach(o => console.log(`  - ${o.metadata?.message}`));
  } else {
    console.log('  All zones normal');
  }
  console.log('');

  // Scenario 2: Office alert
  console.log('Scenario 2: Office Alert Condition');
  console.log('-----------------------------------');
  const office2 = [28, 65, 200, 0.8, 1200, 70, 1010, 60];
  console.log('Input:', office2);
  console.log('(High temp & humidity, low light, high motion/CO2/sound)');

  const result2 = engine.processInput(office2);
  console.log(`\nMatches: ${Array.from(result2.sequenceResults.values()).filter(r => r.matchedVectors.length > 0).length}`);
  console.log(`Outputs: ${result2.totalOutputs.length}`);
  result2.totalOutputs.forEach(o => {
    console.log(`  - [${o.metadata?.zone}] ${o.metadata?.status}: ${o.metadata?.message}`);
  });
  console.log('');

  // Scenario 3: Optimal server room
  console.log('Scenario 3: Optimal Server Room');
  console.log('--------------------------------');
  const server1 = [18, 40, 0.6, 0.85, 0.3, 0.5, 0.4, 0.9];
  console.log('Input:', server1);
  console.log('(Temp: 18°C, Hum: 40%, Power: 60%, Net: 85%, CPU: 30%, Mem: 50%, Disk: 40%, Cool: 90%)');

  const result3 = engine.processInput(server1);
  console.log(`\nMatches: ${Array.from(result3.sequenceResults.values()).filter(r => r.matchedVectors.length > 0).length}`);
  console.log(`Outputs: ${result3.totalOutputs.length}`);
  if (result3.totalOutputs.length === 0) {
    console.log('  Server room optimal');
  }
  console.log('');

  // Scenario 4: Server critical
  console.log('Scenario 4: Server Room Critical');
  console.log('---------------------------------');
  const server2 = [26, 60, 0.90, 0.70, 0.85, 0.80, 0.85, 0.70];
  console.log('Input:', server2);
  console.log('(High temp, high utilization across all metrics)');

  const result4 = engine.processInput(server2);
  console.log(`\nMatches: ${Array.from(result4.sequenceResults.values()).filter(r => r.matchedVectors.length > 0).length}`);
  console.log(`Outputs: ${result4.totalOutputs.length}`);
  result4.totalOutputs.forEach(o => {
    console.log(`  - [${o.metadata?.zone}] ${o.metadata?.status}: ${o.metadata?.message}`);
    console.log(`    Priority: ${o.metadata?.priority}`);
  });
  console.log('');

  // Scenario 5: Security breach
  console.log('Scenario 5: Security Breach');
  console.log('----------------------------');
  const security1 = [1, 1, 1, 1, 1, 1, 1, 1];
  console.log('Input:', security1);
  console.log('(All security sensors triggered)');

  const result5 = engine.processInput(security1);
  console.log(`\nMatches: ${Array.from(result5.sequenceResults.values()).filter(r => r.matchedVectors.length > 0).length}`);
  console.log(`Outputs: ${result5.totalOutputs.length}`);
  result5.totalOutputs.forEach(o => {
    console.log(`  - [${o.metadata?.zone}] ${o.metadata?.status}: ${o.metadata?.message}`);
    console.log(`    Priority: ${o.metadata?.priority}`);
    if (o.metadata?.triggeredSensors) {
      console.log(`    Sensors: ${o.metadata.triggeredSensors.join(', ')}`);
    }
  });
  console.log('');

  // Scenario 6: Multi-zone processing
  console.log('Scenario 6: Multi-Zone Simultaneous Processing');
  console.log('-----------------------------------------------');
  const multi = [22, 50, 0.75, 0.80, 0.6, 0.65, 0.60, 0.85];
  console.log('Input:', multi);
  console.log('(Mixed conditions that could match multiple zones)');

  const result6 = engine.processInput(multi);
  const matches = Array.from(result6.sequenceResults.entries()).filter(([, r]) => r.matchedVectors.length > 0);
  console.log(`\nMatches: ${matches.length}`);
  matches.forEach(([seqId, r]) => {
    const seq = engine.getSequence(seqId);
    console.log(`  - ${seq?.name}: ${r.matchedVectors.length} vectors matched`);
  });
  console.log(`Outputs: ${result6.totalOutputs.length}`);
  result6.totalOutputs.forEach(o => {
    console.log(`  - [${o.metadata?.zone}] ${o.metadata?.status}`);
  });
  console.log('');

  // Final statistics
  console.log('==================================================================');
  console.log('Final System State');
  console.log('==================================================================\n');

  const finalStats = engine.getStats();
  console.log('Overall Statistics:');
  console.log(`  Sequences: ${finalStats.totalSequences}`);
  console.log(`  Vectors: ${finalStats.totalVectors}`);
  console.log(`  Active Vectors: ${finalStats.totalActiveVectors}\n`);

  console.log('Per-Sequence Statistics:');
  finalStats.sequenceStats.forEach(seq => {
    console.log(`\n  ${seq.name}:`);
    console.log(`    Total Vectors: ${seq.stats.totalVectors}`);
    console.log(`    Active Vectors: ${seq.stats.activeVectors}`);
    console.log(`    Initial Vectors: ${seq.stats.initialVectors}`);
    console.log(`    Output Vectors: ${seq.stats.outputVectors}`);
  });

  console.log('\n');
  console.log('==================================================================');
  console.log('Example Complete!');
  console.log('==================================================================\n');

  console.log('Key Takeaways:');
  console.log('  ✓ 8-dimensional vectors successfully processed');
  console.log('  ✓ 3 independent CriticalEventSequences managed simultaneously');
  console.log('  ✓ Each sequence monitors different sensor arrays');
  console.log('  ✓ Threshold-based matching works across all dimensions');
  console.log('  ✓ State transitions occur correctly');
  console.log('  ✓ Output vectors generated with rich metadata');
  console.log('  ✓ Multi-zone concurrent processing functional\n');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error running example:', error);
    process.exit(1);
  });
}

export { createOfficeZone, createServerZone, createSecurityZone };
