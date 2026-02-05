/**
 * End-to-End Integration Test for Reality Engine
 *
 * This test covers the complete pipeline:
 * 1. Input reality construction (PreceptionOfReality)
 * 2. Comparison to all active reality vectors (matching)
 * 3. Transition of active vectors to next active vectors
 * 4. Generation of valid output vectors
 */

import { RealityEngine } from '../engine/RealityEngine.js';
import { RealityVector } from '../models/RealityVector.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { PreceptionOfReality } from '../engine/PreceptionOfReality.js';
import type { RawObservation } from '../engine/PreceptionOfReality.js';
import { RealitySampler, SamplingStrategy } from '../engine/RealitySampler.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement, OutputVector } from '../models/types.js';

// Mock VectorStore for testing
class MockVectorStore {
  async initialize() {
    return Promise.resolve();
  }
  async storeVector() {
    return Promise.resolve();
  }
  async storeVectors() {
    return Promise.resolve();
  }
  async getVector() {
    return Promise.resolve(null);
  }
  async searchSimilar() {
    return Promise.resolve([]);
  }
  async storeSequence() {
    return Promise.resolve();
  }
  async getSequence() {
    return Promise.resolve(null);
  }
  async deleteVector() {
    return Promise.resolve();
  }
  async getStats() {
    return Promise.resolve({});
  }
}

describe('End-to-End Reality Engine Pipeline', () => {
  let vectorStore: any;
  let engine: RealityEngine;
  let perception: PreceptionOfReality;
  let sampler: RealitySampler;

  beforeAll(async () => {
    // Initialize the complete system with mock store
    vectorStore = new MockVectorStore();
    await vectorStore.initialize();

    engine = new RealityEngine(vectorStore);
    await engine.initialize();

    perception = new PreceptionOfReality(3, true); // 3D vectors with preprocessing

    sampler = new RealitySampler(perception, engine, {
      strategy: SamplingStrategy.MANUAL,
      autoProcess: false // Manual control for testing
    });
  });

  describe('Complete Pipeline: Observation to Output', () => {
    test('should process raw observation through complete pipeline', async () => {
      // ============================================================
      // STAGE 1: Input Reality Construction (PreceptionOfReality)
      // ============================================================

      console.log('\n=== STAGE 1: Input Reality Construction ===');

      // Create raw observation from "physical reality"
      const rawObservation: RawObservation = {
        data: [0.3, 0.7, 0.5], // Raw sensor data
        timestamp: Date.now(),
        source: 'sensor-array-1',
        metadata: {
          location: 'laboratory',
          environment: 'controlled'
        }
      };

      console.log('Raw Observation:', rawObservation.data);

      // Process through PreceptionOfReality
      const processedPerception = perception.perceive(rawObservation);

      console.log('Processed InputVector:', processedPerception.inputVector);
      console.log('Transformations Applied:', processedPerception.transformations);

      // Verify input construction
      expect(processedPerception.inputVector).toBeDefined();
      expect(processedPerception.inputVector.length).toBe(3);
      expect(processedPerception.transformations).toContain('dimension-normalization');
      expect(processedPerception.originalObservation).toBe(rawObservation);

      // ============================================================
      // STAGE 2: Comparison to Active Reality Vectors
      // ============================================================

      console.log('\n=== STAGE 2: Vector Comparison ===');

      // Create CriticalEventSequence with multiple states
      const sequence = new CriticalEventSequence('E2E Test Sequence');

      // State 1: Initial detector (always active)
      const detector = new RealityVector(
        [
          { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
          { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
          { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
        ],
        true // initial vector
      );

      // State 2: Processing state
      const processor = new RealityVector(
        [
          { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },
          { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },
          { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }
        ],
        false
      );

      // State 3: Output generator
      const generator = new RealityVector(
        [
          { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },
          { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 },
          { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }
        ],
        false
      );

      // Add outputs to vectors
      detector.addOutputVector({
        id: 'detection-signal',
        vector: [1.0, 0.0, 0.0],
        timestamp: Date.now(),
        metadata: { stage: 'detection', message: 'Pattern detected' }
      });

      processor.addOutputVector({
        id: 'processing-signal',
        vector: [0.0, 1.0, 0.0],
        timestamp: Date.now(),
        metadata: { stage: 'processing', message: 'Processing initiated' }
      });

      generator.addOutputVector({
        id: 'output-signal',
        vector: [0.0, 0.0, 1.0],
        timestamp: Date.now(),
        metadata: { stage: 'output', message: 'Final output generated' }
      });

      // Connect the states: detector -> processor -> generator
      detector.addNextVector(processor.id);
      processor.addNextVector(generator.id);

      // Add to sequence
      sequence.addVector(detector);
      sequence.addVector(processor);
      sequence.addVector(generator);

      // Validate sequence
      const validation = sequence.validate();
      expect(validation.valid).toBe(true);
      console.log('Sequence validated:', validation.valid);

      // Add to engine
      engine.addSequence(sequence);

      // Check initial active vectors
      const initialActiveVectors = engine.getAllActiveVectors();
      console.log('Initial Active Vectors:', Array.from(initialActiveVectors.values())[0]?.length || 0);
      expect(Array.from(initialActiveVectors.values())[0]?.length).toBe(1); // Only detector

      // Process the input through engine
      const result1 = engine.processInput(processedPerception.inputVector);

      console.log('Matched Vectors:', Array.from(result1.sequenceResults.values())[0].matchedVectors);
      console.log('Outputs Generated:', result1.totalOutputs.length);

      // ============================================================
      // STAGE 3: Active Vector Transitions
      // ============================================================

      console.log('\n=== STAGE 3: Vector Transitions ===');

      const sequenceResult1 = Array.from(result1.sequenceResults.values())[0];

      // Verify matching occurred
      expect(sequenceResult1.matchedVectors.length).toBeGreaterThan(0);
      expect(sequenceResult1.matchedVectors).toContain(detector.id);
      console.log('Detector matched:', sequenceResult1.matchedVectors.includes(detector.id));

      // Verify next vector activation
      expect(sequenceResult1.activatedVectors.length).toBeGreaterThan(0);
      expect(sequenceResult1.activatedVectors).toContain(processor.id);
      console.log('Processor activated:', sequenceResult1.activatedVectors.includes(processor.id));

      // Verify processor is now active
      const afterTransition1 = engine.getAllActiveVectors();
      const activeVectorIds1 = Array.from(afterTransition1.values())[0]?.map(v => v.id) || [];
      expect(activeVectorIds1).toContain(processor.id);
      console.log('Active vectors after transition 1:', activeVectorIds1.length);

      // ============================================================
      // STAGE 4: Output Vector Generation
      // ============================================================

      console.log('\n=== STAGE 4: Output Vector Generation ===');

      // Verify output was generated in first transition
      expect(result1.totalOutputs.length).toBeGreaterThan(0);
      const output1 = result1.totalOutputs[0];
      expect(output1.id).toBe('detection-signal');
      expect(output1.vector).toEqual([1.0, 0.0, 0.0]);
      expect(output1.metadata?.stage).toBe('detection');
      console.log('Output 1 Generated:', output1.id, '-', output1.metadata?.message);

      // Continue processing - trigger processor
      console.log('\n--- Processing Stage 2 ---');
      const result2 = engine.processInput([0.5, 0.8, 0.6]);

      const sequenceResult2 = Array.from(result2.sequenceResults.values())[0];
      console.log('Matched Vectors:', sequenceResult2.matchedVectors);
      console.log('Activated Vectors:', sequenceResult2.activatedVectors);

      // Verify processor matched and generator activated
      expect(sequenceResult2.matchedVectors).toContain(processor.id);
      expect(sequenceResult2.activatedVectors).toContain(generator.id);

      // Verify processor output
      expect(result2.totalOutputs.length).toBeGreaterThan(0);
      const output2 = result2.totalOutputs.find(o => o.id === 'processing-signal');
      expect(output2).toBeDefined();
      expect(output2?.metadata?.stage).toBe('processing');
      console.log('Output 2 Generated:', output2?.id, '-', output2?.metadata?.message);

      // Final processing - trigger generator
      console.log('\n--- Processing Stage 3 ---');
      const result3 = engine.processInput([0.9, 0.9, 0.9]);

      const sequenceResult3 = Array.from(result3.sequenceResults.values())[0];
      console.log('Matched Vectors:', sequenceResult3.matchedVectors);
      console.log('Outputs Generated:', result3.totalOutputs.length);

      // Verify generator matched and produced output
      expect(sequenceResult3.matchedVectors).toContain(generator.id);
      expect(result3.totalOutputs.length).toBeGreaterThan(0);

      const output3 = result3.totalOutputs.find(o => o.id === 'output-signal');
      expect(output3).toBeDefined();
      expect(output3?.vector).toEqual([0.0, 0.0, 1.0]);
      expect(output3?.metadata?.stage).toBe('output');
      console.log('Output 3 Generated:', output3?.id, '-', output3?.metadata?.message);

      // ============================================================
      // VERIFICATION: Complete Pipeline Summary
      // ============================================================

      console.log('\n=== PIPELINE SUMMARY ===');
      console.log('Total Transitions:', 3);
      console.log('Total Outputs Generated:', [output1, output2, output3].filter(Boolean).length);
      console.log('Pipeline Status: COMPLETE');

      // Verify all stages completed successfully
      expect(processedPerception).toBeDefined(); // Stage 1
      expect(sequenceResult1.matchedVectors.length).toBeGreaterThan(0); // Stage 2
      expect(sequenceResult1.activatedVectors.length).toBeGreaterThan(0); // Stage 3
      expect([output1, output2, output3].filter(Boolean).length).toBe(3); // Stage 4

      // Get final stats
      const finalStats = engine.getStats();
      console.log('\nEngine Stats:', {
        totalSequences: finalStats.totalSequences,
        totalVectors: finalStats.totalVectors,
        totalActiveVectors: finalStats.totalActiveVectors
      });

      expect(finalStats.totalSequences).toBe(1);
      expect(finalStats.totalVectors).toBe(3);
    });
  });

  describe('Multi-Sequence Pipeline Test', () => {
    test('should handle multiple concurrent sequences with different patterns', async () => {
      console.log('\n=== MULTI-SEQUENCE TEST ===');

      // Reset engine
      engine.resetAllSequences();

      // Create Sequence A: Low-value detector
      const seqA = new CriticalEventSequence('Low Value Detector');
      const detectorA = new RealityVector(
        [
          { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
          { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
        ],
        true
      );
      detectorA.addOutputVector({
        id: 'low-value-detected',
        vector: [1.0, 0.0],
        timestamp: Date.now(),
        metadata: { type: 'low-value' }
      });
      seqA.addVector(detectorA);

      // Create Sequence B: High-value detector
      const seqB = new CriticalEventSequence('High Value Detector');
      const detectorB = new RealityVector(
        [
          { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 },
          { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
        ],
        true
      );
      detectorB.addOutputVector({
        id: 'high-value-detected',
        vector: [0.0, 1.0],
        timestamp: Date.now(),
        metadata: { type: 'high-value' }
      });
      seqB.addVector(detectorB);

      // Add both sequences
      engine.addSequence(seqA);
      engine.addSequence(seqB);

      // Test input that matches Sequence A
      console.log('\n--- Testing Low Value Input ---');
      const lowValueInput = [0.25, 0.32];
      const resultLow = engine.processInput(lowValueInput);

      console.log('Input:', lowValueInput);
      console.log('Sequences matched:', resultLow.sequenceResults.size);
      console.log('Total outputs:', resultLow.totalOutputs.length);

      expect(resultLow.totalOutputs.length).toBeGreaterThan(0);
      const lowOutput = resultLow.totalOutputs.find(o => o.id === 'low-value-detected');
      expect(lowOutput).toBeDefined();
      console.log('Output:', lowOutput?.id, '-', lowOutput?.metadata?.type);

      // Test input that matches Sequence B
      console.log('\n--- Testing High Value Input ---');
      const highValueInput = [0.82, 0.88];
      const resultHigh = engine.processInput(highValueInput);

      console.log('Input:', highValueInput);
      console.log('Sequences matched:', resultHigh.sequenceResults.size);
      console.log('Total outputs:', resultHigh.totalOutputs.length);

      expect(resultHigh.totalOutputs.length).toBeGreaterThan(0);
      const highOutput = resultHigh.totalOutputs.find(o => o.id === 'high-value-detected');
      expect(highOutput).toBeDefined();
      console.log('Output:', highOutput?.id, '-', highOutput?.metadata?.type);

      // Test input that matches neither
      console.log('\n--- Testing Mid-Range Input (no match) ---');
      const midValueInput = [0.5, 0.5];
      const resultMid = engine.processInput(midValueInput);

      console.log('Input:', midValueInput);
      console.log('Sequences matched:', resultMid.sequenceResults.size);
      console.log('Total outputs:', resultMid.totalOutputs.length);

      // Should produce no outputs since no patterns match
      const matchedCount = Array.from(resultMid.sequenceResults.values())
        .filter(r => r.matchedVectors.length > 0).length;
      expect(matchedCount).toBe(0);
      console.log('No patterns matched (expected)');
    });
  });

  describe('Reality Sampler Integration', () => {
    test('should process observations through sampler with full pipeline', async () => {
      console.log('\n=== SAMPLER INTEGRATION TEST ===');

      // Reset and create simple sequence
      engine.resetAllSequences();

      const sequence = new CriticalEventSequence('Sampler Test');
      const detector = new RealityVector(
        [{ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }],
        true
      );
      detector.addOutputVector({
        id: 'sampled-detection',
        vector: [1.0],
        timestamp: Date.now(),
        metadata: { source: 'sampler' }
      });
      sequence.addVector(detector);
      engine.addSequence(sequence);

      // Create new perception and sampler for 1D vectors
      const perception1D = new PreceptionOfReality(1, true);
      const testSampler = new RealitySampler(perception1D, engine, {
        strategy: SamplingStrategy.MANUAL,
        autoProcess: true
      });

      // Sample observation
      const observation = PreceptionOfReality.createObservation(
        [0.48], // Close to 0.5
        'test-sensor',
        { test: true }
      );

      console.log('Sampling observation:', observation.data);
      const result = testSampler.sample(observation);

      expect(result).toBeDefined();
      expect(result?.totalOutputs.length).toBeGreaterThan(0);
      console.log('Sampler produced output:', result?.totalOutputs[0].id);

      const samplerStats = testSampler.getStats();
      console.log('Sampler stats:', {
        sampleCount: samplerStats.sampleCount,
        bufferSize: samplerStats.bufferSize
      });

      expect(samplerStats.sampleCount).toBe(1);
    });
  });

  describe('State Persistence and Recovery', () => {
    test('should persist and restore sequence state', async () => {
      console.log('\n=== PERSISTENCE TEST ===');

      // Create sequence
      const sequence = new CriticalEventSequence('Persistence Test');
      const v1 = new RealityVector(
        [{ value: 0.5, comparatorType: ComparatorType.EQUALS }],
        true
      );
      const v2 = new RealityVector(
        [{ value: 1.0, comparatorType: ComparatorType.EQUALS }],
        false
      );
      v1.addNextVector(v2.id);
      v1.addOutputVector({
        id: 'persist-output',
        vector: [1.0],
        timestamp: Date.now()
      });

      sequence.addVector(v1);
      sequence.addVector(v2);

      // Serialize
      const serialized = sequence.toJSON();
      console.log('Serialized sequence ID:', serialized.id);

      // Deserialize
      const restored = CriticalEventSequence.fromJSON(serialized);
      console.log('Restored sequence ID:', restored.id);

      expect(restored.id).toBe(sequence.id);
      expect(restored.name).toBe(sequence.name);
      expect(restored.getAllVectors().length).toBe(2);

      // Verify state is preserved
      const restoredV1 = restored.getVector(v1.id);
      expect(restoredV1?.isActive()).toBe(true);
      expect(restoredV1?.getNextVectorIds()).toContain(v2.id);
      console.log('State preserved correctly');
    });
  });

  describe('Transition History Tracking', () => {
    test('should maintain accurate transition history', async () => {
      console.log('\n=== HISTORY TRACKING TEST ===');

      engine.resetAllSequences();
      engine.clearHistory();

      // Create simple sequence
      const sequence = new CriticalEventSequence('History Test');
      const detector = new RealityVector(
        [{ value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.2 }],
        true
      );
      detector.addOutputVector({
        id: 'history-output',
        vector: [1.0],
        timestamp: Date.now()
      });
      sequence.addVector(detector);
      engine.addSequence(sequence);

      // Process multiple inputs
      const inputs = [[0.5], [0.6], [0.4], [0.55]];
      console.log('Processing', inputs.length, 'inputs');

      for (const input of inputs) {
        engine.processInput(input);
      }

      // Check history
      const history = engine.getHistory();
      console.log('History entries:', history.length);
      expect(history.length).toBe(inputs.length);

      // Verify each entry (history is newest first, so reverse comparison)
      history.forEach((entry, index) => {
        const inputIndex = inputs.length - 1 - index; // Map to correct input
        expect(entry.inputVector).toEqual(inputs[inputIndex]);
        expect(entry.timestamp).toBeDefined();
        console.log(`Entry ${index + 1}:`, entry.inputVector, '→', entry.totalOutputs.length, 'outputs');
      });

      // Test history limit
      const recentHistory = engine.getHistory(2);
      expect(recentHistory.length).toBe(2);
      console.log('Recent history (last 2):', recentHistory.length, 'entries');
    });
  });
});
