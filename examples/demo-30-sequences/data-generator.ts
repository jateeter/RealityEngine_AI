import { CriticalEventSequence } from '../../dist/models/CriticalEventSequence.js';
import { RealityVector } from '../../dist/models/RealityVector.js';
import { ComparatorType } from '../../dist/models/types.js';
import { OutputType, createOutputVector } from './output-definitions.js';
import { generateInputVectors, LabeledInputVector } from './input-patterns.js';

export interface DemoDataset {
  sequences: CriticalEventSequence[];
  inputVectors: number[][];
  inputVectorMetadata: any[];
  metadata: {
    name: string;
    version: string;
    created: number;
    totalSequences: number;
    totalVectors: number;
    totalInputVectors: number;
  };
}

/**
 * Generate complete demo dataset with 30 sequences and 100 input vectors
 */
export function generateDemoDataset(): DemoDataset {
  const sequences: CriticalEventSequence[] = [];

  // Category 1: Environmental Monitoring (5 sequences)
  sequences.push(...generateEnvironmentalSequences());

  // Category 2: Industrial Process Control (5 sequences)
  sequences.push(...generateIndustrialSequences());

  // Category 3: Healthcare & Biometrics (4 sequences)
  sequences.push(...generateHealthcareSequences());

  // Category 4: Security & Access Control (4 sequences)
  sequences.push(...generateSecuritySequences());

  // Category 5: Financial & Trading (4 sequences)
  sequences.push(...generateFinancialSequences());

  // Category 6: Smart City Infrastructure (4 sequences)
  sequences.push(...generateSmartCitySequences());

  // Category 7: Communication & Network (4 sequences)
  sequences.push(...generateNetworkSequences());

  // Generate 100 input vectors
  const labeledInputs = generateInputVectors();
  const inputVectors = labeledInputs.map(li => li.vector);
  const inputVectorMetadata = labeledInputs.map(li => li.metadata);

  return {
    sequences,
    inputVectors,
    inputVectorMetadata,
    metadata: {
      name: 'Reality Engine 30-Sequence Demonstration',
      version: '1.0.0',
      created: Date.now(),
      totalSequences: sequences.length,
      totalVectors: sequences.reduce((sum, seq) => sum + seq.getVectors().length, 0),
      totalInputVectors: inputVectors.length
    }
  };
}

// ============= CATEGORY 1: Environmental Monitoring (5 sequences) =============

function generateEnvironmentalSequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 1. Building Climate Control
  const climateSeq = new CriticalEventSequence('Building Climate Control');
  const climateNormal = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // temp
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }  // humidity
    ],
    true
  );
  climateNormal.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, climateSeq.id, { zone: 'climate' }));

  const climateWarning = new RealityVector(
    [
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  climateWarning.addOutputVector(createOutputVector(OutputType.WARNING_ALERT, climateSeq.id, { zone: 'climate', action: 'adjust_hvac' }));
  climateNormal.addNextVector(climateWarning.id);
  climateWarning.addNextVector(climateNormal.id);

  climateSeq.addVector(climateNormal);
  climateSeq.addVector(climateWarning);
  sequences.push(climateSeq);

  // 2. Weather Station Monitoring
  const weatherSeq = new CriticalEventSequence('Weather Station Monitoring');
  const weatherNormal = new RealityVector(
    Array(3).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 })),
    true
  );
  weatherNormal.addOutputVector(createOutputVector(OutputType.NORMAL_OPERATION, weatherSeq.id));
  weatherSeq.addVector(weatherNormal);
  sequences.push(weatherSeq);

  // 3. Air Quality Monitor
  const airQualitySeq = new CriticalEventSequence('Air Quality Monitor');
  const airNormal = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // CO2
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }  // particulates
    ],
    true
  );
  airNormal.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, airQualitySeq.id));

  const airPolluted = new RealityVector(
    [
      { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  airPolluted.addOutputVector(createOutputVector(OutputType.WARNING_ALERT, airQualitySeq.id));
  airNormal.addNextVector(airPolluted.id);

  airQualitySeq.addVector(airNormal);
  airQualitySeq.addVector(airPolluted);
  sequences.push(airQualitySeq);

  // 4. Energy Consumption Monitor
  const energySeq = new CriticalEventSequence('Energy Consumption Monitor');
  const energyLow = new RealityVector(
    [{ value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }],
    true
  );
  energyLow.addOutputVector(createOutputVector(OutputType.OPTIMIZATION_TRIGGER, energySeq.id));
  energySeq.addVector(energyLow);
  sequences.push(energySeq);

  // 5. Water Quality System
  const waterSeq = new CriticalEventSequence('Water Quality System');
  const waterNormal = new RealityVector(
    Array(4).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 })),
    true
  );
  waterNormal.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, waterSeq.id));
  waterSeq.addVector(waterNormal);
  sequences.push(waterSeq);

  return sequences;
}

// ============= CATEGORY 2: Industrial Process Control (5 sequences) =============

function generateIndustrialSequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 6. Manufacturing Line Monitor
  const mfgSeq = new CriticalEventSequence('Manufacturing Line Monitor');
  const mfgRunning = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }, // speed
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }  // quality
    ],
    true
  );
  mfgRunning.addOutputVector(createOutputVector(OutputType.NORMAL_OPERATION, mfgSeq.id));

  const mfgOverload = new RealityVector(
    [
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  mfgOverload.addOutputVector(createOutputVector(OutputType.CRITICAL_ALERT, mfgSeq.id));
  mfgRunning.addNextVector(mfgOverload.id);

  mfgSeq.addVector(mfgRunning);
  mfgSeq.addVector(mfgOverload);
  sequences.push(mfgSeq);

  // 7-10: Create 4 more industrial sequences with different patterns
  for (let i = 0; i < 4; i++) {
    const names = ['Chemical Process Control', 'Equipment Monitor', 'Supply Chain Tracker', 'Bottleneck Detection'];
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(3).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 })),
      true
    );
    vec.addOutputVector(createOutputVector(i % 2 === 0 ? OutputType.NORMAL_OPERATION : OutputType.EFFICIENCY_BOOST, seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}

// ============= CATEGORY 3: Healthcare & Biometrics (4 sequences) =============

function generateHealthcareSequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 11. Vital Signs Monitor
  const vitalSeq = new CriticalEventSequence('Vital Signs Monitor');
  const vitalNormal = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // heart rate
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // blood pressure
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }  // oxygen
    ],
    true
  );
  vitalNormal.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, vitalSeq.id));

  const vitalCritical = new RealityVector(
    [
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 },
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 },
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.05 }
    ],
    false
  );
  vitalCritical.addOutputVector(createOutputVector(OutputType.EMERGENCY, vitalSeq.id));
  vitalNormal.addNextVector(vitalCritical.id);

  vitalSeq.addVector(vitalNormal);
  vitalSeq.addVector(vitalCritical);
  sequences.push(vitalSeq);

  // 12-14: Create 3 more healthcare sequences
  const names = ['Outbreak Detection System', 'Medical Equipment Alert', 'Treatment Progress Tracker'];
  for (let i = 0; i < 3; i++) {
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(4).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 })),
      true
    );
    vec.addOutputVector(createOutputVector(OutputType.NORMAL_OPERATION, seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}

// ============= CATEGORY 4: Security & Access Control (4 sequences) =============

function generateSecuritySequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 15. Multi-Zone Security System
  const securitySeq = new CriticalEventSequence('Multi-Zone Security System');
  const securitySecure = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.EQUALS }, // motion
      { value: 0.0, comparatorType: ComparatorType.EQUALS }  // door
    ],
    true
  );
  securitySecure.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, securitySeq.id));

  const securityBreach = new RealityVector(
    [
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  securityBreach.addOutputVector(createOutputVector(OutputType.EMERGENCY, securitySeq.id));
  securitySecure.addNextVector(securityBreach.id);

  securitySeq.addVector(securitySecure);
  securitySeq.addVector(securityBreach);
  sequences.push(securitySeq);

  // 16-18: Create 3 more security sequences
  const names = ['Access Pattern Analyzer', 'Intrusion Detection System', 'Network Security Monitor'];
  for (let i = 0; i < 3; i++) {
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(3).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 })),
      true
    );
    vec.addOutputVector(createOutputVector(i === 1 ? OutputType.CRITICAL_ALERT : OutputType.NORMAL_OPERATION, seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}

// ============= CATEGORY 5: Financial & Trading (4 sequences) =============

function generateFinancialSequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 19-22: Create 4 financial sequences
  const names = ['Market Volatility Detector', 'Fraud Detection System', 'Trading Signal Generator', 'Portfolio Risk Monitor'];
  const outputs = [OutputType.WARNING_ALERT, OutputType.CRITICAL_ALERT, OutputType.OPTIMIZATION_TRIGGER, OutputType.WARNING_ALERT];

  for (let i = 0; i < 4; i++) {
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(5).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 })),
      true
    );
    vec.addOutputVector(createOutputVector(outputs[i], seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}

// ============= CATEGORY 6: Smart City Infrastructure (4 sequences) =============

function generateSmartCitySequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 23. Traffic Flow Optimizer
  const trafficSeq = new CriticalEventSequence('Traffic Flow Optimizer');
  const trafficFlow = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }, // congestion
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }  // speed
    ],
    true
  );
  trafficFlow.addOutputVector(createOutputVector(OutputType.NORMAL_OPERATION, trafficSeq.id));

  const trafficJam = new RealityVector(
    [
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  trafficJam.addOutputVector(createOutputVector(OutputType.OPTIMIZATION_TRIGGER, trafficSeq.id));
  trafficFlow.addNextVector(trafficJam.id);

  trafficSeq.addVector(trafficFlow);
  trafficSeq.addVector(trafficJam);
  sequences.push(trafficSeq);

  // 24-26: Create 3 more smart city sequences
  const names = ['Public Transport Monitor', 'Utility Grid Manager', 'Emergency Dispatch System'];
  for (let i = 0; i < 3; i++) {
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(4).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 })),
      true
    );
    vec.addOutputVector(createOutputVector(i === 2 ? OutputType.EMERGENCY : OutputType.NORMAL_OPERATION, seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}

// ============= CATEGORY 7: Communication & Network (4 sequences) =============

function generateNetworkSequences(): CriticalEventSequence[] {
  const sequences: CriticalEventSequence[] = [];

  // 27. Network Congestion Monitor
  const netSeq = new CriticalEventSequence('Network Congestion Monitor');
  const netNormal = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }, // bandwidth
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }  // latency
    ],
    true
  );
  netNormal.addOutputVector(createOutputVector(OutputType.SYSTEM_HEALTHY, netSeq.id));

  const netCongested = new RealityVector(
    [
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );
  netCongested.addOutputVector(createOutputVector(OutputType.WARNING_ALERT, netSeq.id));
  netNormal.addNextVector(netCongested.id);

  netSeq.addVector(netNormal);
  netSeq.addVector(netCongested);
  sequences.push(netSeq);

  // 28-30: Create 3 more network sequences
  const names = ['Service Degradation Detector', 'Bandwidth Optimizer', 'Latency Spike Monitor'];
  for (let i = 0; i < 3; i++) {
    const seq = new CriticalEventSequence(names[i]);
    const vec = new RealityVector(
      Array(3).fill(null).map(() => ({ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 })),
      true
    );
    vec.addOutputVector(createOutputVector(i === 1 ? OutputType.EFFICIENCY_BOOST : OutputType.WARNING_ALERT, seq.id));
    seq.addVector(vec);
    sequences.push(seq);
  }

  return sequences;
}
