import { RealityVector } from '../models/RealityVector.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement, OutputVector } from '../models/types.js';

describe('RealityVector', () => {
  describe('Constructor and Basic Operations', () => {
    test('should create a reality vector with correct initial state', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS },
        { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
      ];

      const vector = new RealityVector(elements, false);

      expect(vector.id).toBeDefined();
      expect(vector.isActive()).toBe(false);
      expect(vector.getVector()).toEqual([0.5, 0.8]);
    });

    test('should create initial vector as active', () => {
      const elements: VectorElement[] = [
        { value: 1.0, comparatorType: ComparatorType.EQUALS }
      ];

      const vector = new RealityVector(elements, true);

      expect(vector.isActive()).toBe(true);
      expect(vector.isInitialVector()).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should set and clear active state', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements, false);

      expect(vector.isActive()).toBe(false);

      vector.setActive();
      expect(vector.isActive()).toBe(true);

      vector.clearActive();
      expect(vector.isActive()).toBe(false);
    });

    test('should not deactivate initial vectors', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements, true);

      expect(vector.isActive()).toBe(true);

      vector.clearActive();
      expect(vector.isActive()).toBe(true); // Should still be active
    });
  });

  describe('Next Vectors', () => {
    test('should add and retrieve next vectors', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      vector.addNextVector('vector-1');
      vector.addNextVector('vector-2');

      const nextVectors = vector.getNextVectorIds();
      expect(nextVectors).toContain('vector-1');
      expect(nextVectors).toContain('vector-2');
      expect(nextVectors.length).toBe(2);
    });

    test('should not add duplicate next vectors', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      vector.addNextVector('vector-1');
      vector.addNextVector('vector-1');

      const nextVectors = vector.getNextVectorIds();
      expect(nextVectors.length).toBe(1);
    });
  });

  describe('Output Vectors', () => {
    test('should add and retrieve output vectors', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };

      vector.addOutputVector(output);

      const outputs = vector.getOutputVectors();
      expect(outputs.length).toBe(1);
      expect(outputs[0].id).toBe('output-1');
    });
  });

  describe('Matching Operations', () => {
    test('should match with EQUALS comparator', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS },
        { value: 1.0, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      const result = vector.match([0.5, 1.0]);
      expect(result.matched).toBe(true);
      expect(result.score).toBe(1);
    });

    test('should not match with EQUALS comparator when values differ', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      const result = vector.match([0.6]);
      expect(result.matched).toBe(false);
    });

    test('should match with THRESHOLD comparator within threshold', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
      ];
      const vector = new RealityVector(elements);

      const result = vector.match([0.55]);
      expect(result.matched).toBe(true);
    });

    test('should not match with THRESHOLD comparator outside threshold', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
      ];
      const vector = new RealityVector(elements);

      const result = vector.match([0.7]);
      expect(result.matched).toBe(false);
    });

    describe('GTE comparator', () => {
      test('HIGH element (value=1) matches when input >= threshold', () => {
        const elements: VectorElement[] = [
          { value: 1, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        expect(vector.match([1]).matched).toBe(true);
        expect(vector.match([0.5]).matched).toBe(true);
        expect(vector.match([0.8]).matched).toBe(true);
      });

      test('HIGH element (value=1) does not match when input < threshold', () => {
        const elements: VectorElement[] = [
          { value: 1, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        expect(vector.match([0]).matched).toBe(false);
        expect(vector.match([0.49]).matched).toBe(false);
      });

      test('LOW element (value=0) matches when input < threshold', () => {
        const elements: VectorElement[] = [
          { value: 0, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        expect(vector.match([0]).matched).toBe(true);
        expect(vector.match([0.49]).matched).toBe(true);
      });

      test('LOW element (value=0) does not match when input >= threshold', () => {
        const elements: VectorElement[] = [
          { value: 0, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        expect(vector.match([0.5]).matched).toBe(false);
        expect(vector.match([1]).matched).toBe(false);
      });

      test('multi-element binary vector matches correctly (RS flip-flop SET=[1,0])', () => {
        const elements: VectorElement[] = [
          { value: 1, comparatorType: ComparatorType.GTE, threshold: 0.5 },
          { value: 0, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        expect(vector.match([1, 0]).matched).toBe(true);
        expect(vector.match([0, 0]).matched).toBe(false);
        expect(vector.match([1, 1]).matched).toBe(false);
        expect(vector.match([0, 1]).matched).toBe(false);
      });

      test('score is proportional to distance from threshold on matched side', () => {
        const elements: VectorElement[] = [
          { value: 1, comparatorType: ComparatorType.GTE, threshold: 0.5 }
        ];
        const vector = new RealityVector(elements);
        // Mid-range (0.75): score = (0.75-0.5)/(1-0.5) = 0.5
        // At max (1.0): score = (1.0-0.5)/(1-0.5) = 1.0
        const atMid = vector.match([0.75]);
        const atMax = vector.match([1.0]);
        expect(atMid.matched).toBe(true);
        expect(atMax.matched).toBe(true);
        expect(atMax.score!).toBeGreaterThan(atMid.score!);
      });
    });

    test('should handle dimension mismatch', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);

      const result = vector.match([0.5, 0.6]);
      expect(result.matched).toBe(false);
      expect(result.metadata?.error).toContain('dimension mismatch');
    });
  });

  describe('Transition Operations', () => {
    test('should transition on match and return next vectors', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements, false);
      vector.setActive();
      vector.addNextVector('next-1');
      vector.addNextVector('next-2');

      const result = vector.transition([0.5]);

      expect(result.matched).toBe(true);
      expect(result.nextVectorIds).toContain('next-1');
      expect(result.nextVectorIds).toContain('next-2');
    });

    test('should deactivate non-initial vector on non-match', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements, false);
      vector.setActive();

      expect(vector.isActive()).toBe(true);

      const result = vector.transition([0.6]);

      expect(result.matched).toBe(false);
      expect(vector.isActive()).toBe(false);
    });

    test('should not deactivate initial vector on non-match', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements, true);

      expect(vector.isActive()).toBe(true);

      const result = vector.transition([0.6]);

      expect(result.matched).toBe(false);
      expect(vector.isActive()).toBe(true); // Should remain active
    });

    test('should return output vectors on successful transition', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);
      vector.setActive();

      const output: OutputVector = {
        id: 'output-1',
        vector: [1, 2, 3],
        timestamp: Date.now()
      };
      vector.addOutputVector(output);

      const result = vector.transition([0.5]);

      expect(result.matched).toBe(true);
      expect(result.outputVectors.length).toBe(1);
      expect(result.outputVectors[0].id).toBe('output-1');
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize correctly', () => {
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS },
        { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 }
      ];
      const vector = new RealityVector(elements, true);
      vector.addNextVector('next-1');
      vector.metadata = { test: 'value' };

      const json = vector.toJSON();
      const restored = RealityVector.fromJSON(json);

      expect(restored.id).toBe(vector.id);
      expect(restored.isActive()).toBe(vector.isActive());
      expect(restored.getVector()).toEqual(vector.getVector());
      expect(restored.getNextVectorIds()).toEqual(vector.getNextVectorIds());
      expect(restored.metadata).toEqual(vector.metadata);
    });
  });

  describe('Machine-level matchAlgorithm', () => {
    test('default matchAlgorithm is GTE', () => {
      const vector = new RealityVector([{ value: 1, threshold: 0.5 }]);
      expect(vector.matchAlgorithm).toBe(ComparatorType.GTE);
    });

    test('vector uses matchAlgorithm when elements have no comparatorType', () => {
      // No comparatorType on elements — relies entirely on machine algorithm (GTE)
      const elements: VectorElement[] = [
        { value: 1, threshold: 0.5 },
        { value: 0, threshold: 0.5 }
      ];
      const vector = new RealityVector(elements);
      vector.matchAlgorithm = ComparatorType.GTE;
      // GTE: value=1 expects HIGH (input>=0.5), value=0 expects LOW (input<0.5)
      expect(vector.match([1, 0]).matched).toBe(true);
      expect(vector.match([0, 1]).matched).toBe(false);
      expect(vector.match([0, 0]).matched).toBe(false);
    });

    test('element-level comparatorType overrides matchAlgorithm', () => {
      // Machine algorithm is GTE, but one element explicitly uses EQUALS
      const elements: VectorElement[] = [
        { value: 0.5, comparatorType: ComparatorType.EQUALS }
      ];
      const vector = new RealityVector(elements);
      vector.matchAlgorithm = ComparatorType.GTE;
      // EQUALS: only exact 0.5 matches (not 0.8 which GTE would accept)
      expect(vector.match([0.5]).matched).toBe(true);
      expect(vector.match([0.8]).matched).toBe(false);
    });

    test('matchAlgorithm=EQUALS treats elements without comparatorType as EQUALS', () => {
      const elements: VectorElement[] = [{ value: 0.5 }];
      const vector = new RealityVector(elements);
      vector.matchAlgorithm = ComparatorType.EQUALS;
      expect(vector.match([0.5]).matched).toBe(true);
      expect(vector.match([0.6]).matched).toBe(false);
    });

    test('clone() preserves matchAlgorithm', () => {
      const elements: VectorElement[] = [{ value: 1, threshold: 0.5 }];
      const original = new RealityVector(elements);
      original.matchAlgorithm = ComparatorType.THRESHOLD;
      const cloned = original.clone();
      expect(cloned.matchAlgorithm).toBe(ComparatorType.THRESHOLD);
    });

    test('toJSON()/fromJSON() roundtrip preserves matchAlgorithm', () => {
      const elements: VectorElement[] = [{ value: 1, threshold: 0.5 }];
      const original = new RealityVector(elements);
      original.matchAlgorithm = ComparatorType.EQUALS;
      const restored = RealityVector.fromJSON(original.toJSON());
      expect(restored.matchAlgorithm).toBe(ComparatorType.EQUALS);
    });

    test('fromJSON() defaults matchAlgorithm to GTE when absent', () => {
      const elements: VectorElement[] = [{ value: 1, threshold: 0.5 }];
      const original = new RealityVector(elements);
      const json = original.toJSON();
      delete json.matchAlgorithm;
      const restored = RealityVector.fromJSON(json);
      expect(restored.matchAlgorithm).toBe(ComparatorType.GTE);
    });
  });
});
