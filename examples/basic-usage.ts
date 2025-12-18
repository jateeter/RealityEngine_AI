/**
 * Basic Usage Examples for Reality Engine
 *
 * This file demonstrates how to use the Reality Engine system
 * to create and process CriticalEventSequences.
 */

import { RealityEngine } from '../src/engine/RealityEngine';
import { RealityVector } from '../src/models/RealityVector';
import { CriticalEventSequence } from '../src/models/CriticalEventSequence';
import { PreceptionOfReality } from '../src/engine/PreceptionOfReality';
import { RealitySampler, SamplingStrategy } from '../src/engine/RealitySampler';
import { VectorStore } from '../src/services/VectorStore';
import { ComparatorType, VectorElement, OutputVector } from '../src/models/types';

/**
 * Example 1: Simple Binary State Machine
 *
 * Creates a state machine that alternates between two states:
 * State A (1.0) -> State B (0.0) -> State A (1.0) -> ...
 */
async function example1_BinaryStateMachine() {
  console.log('\n=== Example 1: Binary State Machine ===\n');

  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);
  await engine.initialize();

  // Create State A (Initial, active by default)
  const stateA = new RealityVector(
    [{ value: 1.0, comparatorType: ComparatorType.EQUALS }],
    true // initial vector
  );

  // Create State B
  const stateB = new RealityVector(
    [{ value: 0.0, comparatorType: ComparatorType.EQUALS }],
    false
  );

  // Add output vectors to show state changes
  stateA.addOutputVector({
    id: 'state-a-output',
    vector: [1.0],
    timestamp: Date.now(),
    metadata: { state: 'A', message: 'Entering State A' }
  });

  stateB.addOutputVector({
    id: 'state-b-output',
    vector: [0.0],
    timestamp: Date.now(),
    metadata: { state: 'B', message: 'Entering State B' }
  });

  // Connect states: A -> B, B -> A
  stateA.addNextVector(stateB.id);
  stateB.addNextVector(stateA.id);

  // Create sequence
  const sequence = new CriticalEventSequence('Binary Toggle');
  sequence.addVector(stateA);
  sequence.addVector(stateB);

  // Validate and add to engine
  const validation = sequence.validate();
  console.log('Sequence valid:', validation.valid);

  engine.addSequence(sequence);

  // Process transitions
  console.log('\nProcessing State A input (1.0):');
  let result = engine.processInput([1.0]);
  console.log('Matched vectors:', Array.from(result.sequenceResults.values())[0].matchedVectors);
  console.log('Outputs:', result.totalOutputs.length);

  console.log('\nProcessing State B input (0.0):');
  result = engine.processInput([0.0]);
  console.log('Matched vectors:', Array.from(result.sequenceResults.values())[0].matchedVectors);
  console.log('Outputs:', result.totalOutputs.length);

  console.log('\nEngine stats:', engine.getStats());
}

/**
 * Example 2: Pattern Recognition with Thresholds
 *
 * Creates a sequence that recognizes specific patterns in 3D space
 * using threshold-based matching.
 */
async function example2_PatternRecognition() {
  console.log('\n=== Example 2: Pattern Recognition ===\n');

  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);
  await engine.initialize();

  // Create pattern detector (initial vector)
  const patternDetector = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
    ],
    true
  );

  // Create response vector
  const responseVector = new RealityVector(
    [
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
      { value: 1.0, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
    ],
    false
  );

  // Add output to detector
  patternDetector.addOutputVector({
    id: 'pattern-recognized',
    vector: [1.0, 1.0, 1.0],
    timestamp: Date.now(),
    metadata: { type: 'recognition', pattern: 'target-pattern' }
  });

  // Add output to response
  responseVector.addOutputVector({
    id: 'response-generated',
    vector: [0.0, 0.0, 0.0],
    timestamp: Date.now(),
    metadata: { type: 'response', action: 'acknowledge' }
  });

  // Connect vectors
  patternDetector.addNextVector(responseVector.id);
  responseVector.addNextVector(patternDetector.id); // Loop back

  // Create sequence
  const sequence = new CriticalEventSequence('Pattern Recognizer');
  sequence.addVector(patternDetector);
  sequence.addVector(responseVector);

  engine.addSequence(sequence);

  // Test pattern matching
  console.log('Testing pattern matching:\n');

  // Close match - should match
  console.log('Input [0.52, 0.79, 0.31] (close match):');
  let result = engine.processInput([0.52, 0.79, 0.31]);
  console.log('Matched:', Array.from(result.sequenceResults.values())[0].matchedVectors.length > 0);
  console.log('Outputs:', result.totalOutputs.length);

  // Far match - should not match
  console.log('\nInput [0.9, 0.1, 0.9] (far from pattern):');
  result = engine.processInput([0.9, 0.1, 0.9]);
  console.log('Matched:', Array.from(result.sequenceResults.values())[0].matchedVectors.length > 0);
  console.log('Outputs:', result.totalOutputs.length);
}

/**
 * Example 3: Reality Sampling with PreceptionOfReality
 *
 * Demonstrates the full pipeline from raw observations to processed reality.
 */
async function example3_RealitySampling() {
  console.log('\n=== Example 3: Reality Sampling ===\n');

  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);
  await engine.initialize();

  // Create a simple sequence
  const detector = new RealityVector(
    [
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }
    ],
    true
  );

  detector.addOutputVector({
    id: 'detected',
    vector: [1.0, 1.0],
    timestamp: Date.now(),
    metadata: { detected: true }
  });

  const sequence = new CriticalEventSequence('Detector');
  sequence.addVector(detector);
  engine.addSequence(sequence);

  // Create perception and sampler
  const perception = new PreceptionOfReality(2, true);
  const sampler = new RealitySampler(perception, engine, {
    strategy: SamplingStrategy.MANUAL,
    autoProcess: true
  });

  // Sample some observations
  console.log('Sampling raw observations:\n');

  const observation1 = PreceptionOfReality.createObservation(
    [0.45, 0.55],
    'sensor-1',
    { location: 'lab' }
  );

  const result1 = sampler.sample(observation1);
  console.log('Observation 1:', observation1.data);
  console.log('Matched:', result1 ? 'Yes' : 'No');
  console.log('Outputs:', result1?.totalOutputs.length || 0);

  const observation2 = PreceptionOfReality.createObservation(
    [0.9, 0.1],
    'sensor-1',
    { location: 'lab' }
  );

  const result2 = sampler.sample(observation2);
  console.log('\nObservation 2:', observation2.data);
  console.log('Matched:', result2 ? 'Yes' : 'No');
  console.log('Outputs:', result2?.totalOutputs.length || 0);

  console.log('\nSampler stats:', sampler.getStats());
}

/**
 * Example 4: Multi-State Sequence
 *
 * Creates a more complex sequence with multiple interconnected states.
 */
async function example4_MultiStateSequence() {
  console.log('\n=== Example 4: Multi-State Sequence ===\n');

  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);
  await engine.initialize();

  // Create states: IDLE -> DETECTING -> PROCESSING -> COMPLETE -> IDLE
  const idle = new RealityVector(
    [{ value: 0.0, comparatorType: ComparatorType.EQUALS }],
    true
  );

  const detecting = new RealityVector(
    [{ value: 0.25, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }],
    false
  );

  const processing = new RealityVector(
    [{ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }],
    false
  );

  const complete = new RealityVector(
    [{ value: 1.0, comparatorType: ComparatorType.EQUALS }],
    false
  );

  // Add outputs
  idle.addOutputVector({
    id: 'idle-output',
    vector: [0.0],
    timestamp: Date.now(),
    metadata: { state: 'IDLE' }
  });

  detecting.addOutputVector({
    id: 'detecting-output',
    vector: [0.25],
    timestamp: Date.now(),
    metadata: { state: 'DETECTING' }
  });

  processing.addOutputVector({
    id: 'processing-output',
    vector: [0.5],
    timestamp: Date.now(),
    metadata: { state: 'PROCESSING' }
  });

  complete.addOutputVector({
    id: 'complete-output',
    vector: [1.0],
    timestamp: Date.now(),
    metadata: { state: 'COMPLETE' }
  });

  // Connect states
  idle.addNextVector(detecting.id);
  detecting.addNextVector(processing.id);
  processing.addNextVector(complete.id);
  complete.addNextVector(idle.id);

  // Create sequence
  const sequence = new CriticalEventSequence('Multi-State Pipeline');
  sequence.addVector(idle);
  sequence.addVector(detecting);
  sequence.addVector(processing);
  sequence.addVector(complete);

  engine.addSequence(sequence);

  // Process through states
  console.log('Processing state transitions:\n');

  console.log('State: IDLE (0.0)');
  let result = engine.processInput([0.0]);
  console.log('Active states:', engine.getStats().totalActiveVectors);

  console.log('\nState: DETECTING (0.25)');
  result = engine.processInput([0.25]);
  console.log('Active states:', engine.getStats().totalActiveVectors);

  console.log('\nState: PROCESSING (0.5)');
  result = engine.processInput([0.5]);
  console.log('Active states:', engine.getStats().totalActiveVectors);

  console.log('\nState: COMPLETE (1.0)');
  result = engine.processInput([1.0]);
  console.log('Active states:', engine.getStats().totalActiveVectors);

  console.log('\nFinal stats:', engine.getStats());
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_BinaryStateMachine();
    await example2_PatternRecognition();
    await example3_RealitySampling();
    await example4_MultiStateSequence();

    console.log('\n=== All examples completed successfully! ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_BinaryStateMachine,
  example2_PatternRecognition,
  example3_RealitySampling,
  example4_MultiStateSequence
};
