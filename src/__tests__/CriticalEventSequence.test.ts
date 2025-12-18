import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { RealityVector } from '../models/RealityVector.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement, OutputVector } from '../models/types.js';

describe('CriticalEventSequence', () => {
  describe('Constructor and Basic Operations', () => {
    test('should create a sequence with name and id', () => {
      const sequence = new CriticalEventSequence('Test Sequence');

      expect(sequence.id).toBeDefined();
      expect(sequence.name).toBe('Test Sequence');
    });

    test('should add and retrieve vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      sequence.addVector(vector);

      expect(sequence.getVector(vector.id)).toBe(vector);
      expect(sequence.getAllVectors().length).toBe(1);
    });
  });

  describe('Initial Vectors', () => {
    test('should track initial vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const initialVector = new RealityVector(elements, true);
      const regularVector = new RealityVector(elements, false);

      sequence.addVector(initialVector);
      sequence.addVector(regularVector);

      const initialVectors = sequence.getInitialVectors();
      expect(initialVectors.length).toBe(1);
      expect(initialVectors[0].id).toBe(initialVector.id);
    });
  });

  describe('Active Vectors', () => {
    test('should return only active vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector1 = new RealityVector(elements, true); // Active by default
      const vector2 = new RealityVector(elements, false); // Inactive

      sequence.addVector(vector1);
      sequence.addVector(vector2);

      const activeVectors = sequence.getActiveVectors();
      expect(activeVectors.length).toBe(1);
      expect(activeVectors[0].id).toBe(vector1.id);
    });
  });

  describe('Validation', () => {
    test('should validate sequence with initial and output vectors', () => {
      const sequence = new CriticalEventSequence('Valid Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const initialVector = new RealityVector(elements, true);
      const outputVector = new RealityVector(elements, false);
      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };
      outputVector.addOutputVector(output);

      sequence.addVector(initialVector);
      sequence.addVector(outputVector);

      const validation = sequence.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should fail validation without initial vector', () => {
      const sequence = new CriticalEventSequence('Invalid Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector = new RealityVector(elements, false);
      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };
      vector.addOutputVector(output);

      sequence.addVector(vector);

      const validation = sequence.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'CriticalEventSequence must have at least one initial vector'
      );
    });

    test('should fail validation without output vector', () => {
      const sequence = new CriticalEventSequence('Invalid Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const initialVector = new RealityVector(elements, true);
      sequence.addVector(initialVector);

      const validation = sequence.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'CriticalEventSequence must have at least one vector with output'
      );
    });
  });

  describe('Transition Operations', () => {
    test('should process transitions and activate next vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector1 = new RealityVector(elements, true);
      const vector2 = new RealityVector(elements, false);
      vector1.addNextVector(vector2.id);

      sequence.addVector(vector1);
      sequence.addVector(vector2);

      expect(vector2.isActive()).toBe(false);

      const result = sequence.transition([0.5]);

      expect(result.matchedVectors).toContain(vector1.id);
      expect(result.activatedVectors).toContain(vector2.id);
      expect(vector2.isActive()).toBe(true);
    });

    test('should collect output vectors from matched vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector = new RealityVector(elements, true);
      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };
      vector.addOutputVector(output);

      sequence.addVector(vector);

      const result = sequence.transition([0.5]);

      expect(result.assertedOutputs.length).toBe(1);
      expect(result.assertedOutputs[0].id).toBe('output-1');
    });

    test('should not match inactive vectors', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector = new RealityVector(elements, false); // Not active
      sequence.addVector(vector);

      const result = sequence.transition([0.5]);

      expect(result.matchedVectors.length).toBe(0);
    });
  });

  describe('Reset Operations', () => {
    test('should reset sequence to initial state', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const initialVector = new RealityVector(elements, true);
      const regularVector = new RealityVector(elements, false);
      regularVector.setActive();

      sequence.addVector(initialVector);
      sequence.addVector(regularVector);

      expect(regularVector.isActive()).toBe(true);

      sequence.reset();

      expect(initialVector.isActive()).toBe(true);
      expect(regularVector.isActive()).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should return correct statistics', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const initialVector = new RealityVector(elements, true);
      const regularVector = new RealityVector(elements, false);
      const outputVector = new RealityVector(elements, false);
      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };
      outputVector.addOutputVector(output);

      sequence.addVector(initialVector);
      sequence.addVector(regularVector);
      sequence.addVector(outputVector);

      const stats = sequence.getStats();

      expect(stats.totalVectors).toBe(3);
      expect(stats.activeVectors).toBe(1); // Only initial vector
      expect(stats.initialVectors).toBe(1);
      expect(stats.outputVectors).toBe(1);
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize correctly', () => {
      const sequence = new CriticalEventSequence('Test Sequence');
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];

      const vector1 = new RealityVector(elements, true);
      const vector2 = new RealityVector(elements, false);

      sequence.addVector(vector1);
      sequence.addVector(vector2);
      sequence.metadata = { test: 'value' };

      const json = sequence.toJSON();
      const restored = CriticalEventSequence.fromJSON(json);

      expect(restored.id).toBe(sequence.id);
      expect(restored.name).toBe(sequence.name);
      expect(restored.getAllVectors().length).toBe(2);
      expect(restored.metadata).toEqual(sequence.metadata);
    });
  });
});
