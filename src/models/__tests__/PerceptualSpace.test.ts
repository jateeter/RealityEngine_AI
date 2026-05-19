/**
 * Tests for PerceptualSpace class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PerceptualSpace } from '../PerceptualSpace.js';
import type { PerceptualMapping } from '../types.js';

describe('PerceptualSpace', () => {
  let space: PerceptualSpace;

  beforeEach(() => {
    space = new PerceptualSpace(256);
  });

  describe('constructor', () => {
    it('should create a perceptual space with specified dimension', () => {
      expect(space.getDimension()).toBe(256);
    });

    it('should initialize with zeros', () => {
      const vector = space.getPerceptualVector();
      expect(vector.length).toBe(256);
      expect(vector.every(v => v === 0)).toBe(true);
    });

    it('should default to a fully-dynamic (dimension 0) space', () => {
      // PerceptualSpace is dynamic by design — the default constructor starts at 0
      // and growTo expands the space as machines are registered.
      const defaultSpace = new PerceptualSpace();
      expect(defaultSpace.getDimension()).toBe(0);
    });

    it('should grow to fit a larger vector when set', () => {
      const dyn = new PerceptualSpace();
      dyn.setPerceptualVector([1, 2, 3, 4]);
      expect(dyn.getDimension()).toBe(4);
      expect(dyn.getPerceptualVector()).toEqual([1, 2, 3, 4]);
    });

    it('growTo never shrinks the dimension', () => {
      const dyn = new PerceptualSpace(8);
      dyn.growTo(4);
      expect(dyn.getDimension()).toBe(8);
      dyn.growTo(16);
      expect(dyn.getDimension()).toBe(16);
    });
  });

  describe('setPerceptualVector', () => {
    it('should set the entire perceptual vector', () => {
      const newVector = new Array(256).fill(1);
      space.setPerceptualVector(newVector);
      const retrieved = space.getPerceptualVector();
      expect(retrieved.every(v => v === 1)).toBe(true);
    });

    it('zero-fills the tail when the input is shorter than the current dimension', () => {
      // Tolerant set_vector semantics — shorter inputs overwrite the prefix and
      // leave a zeroed tail, so the full space is always well-defined.
      const shorter = new Array(128).fill(1);
      space.setPerceptualVector(shorter);
      expect(space.getDimension()).toBe(256);
      const v = space.getPerceptualVector();
      expect(v.slice(0, 128).every(x => x === 1)).toBe(true);
      expect(v.slice(128).every(x => x === 0)).toBe(true);
    });

    it('grows to fit when the input is longer than the current dimension', () => {
      const longer = new Array(512).fill(2);
      space.setPerceptualVector(longer);
      expect(space.getDimension()).toBe(512);
      expect(space.getPerceptualVector().every(x => x === 2)).toBe(true);
    });

    it('should create a copy of the vector', () => {
      const original = new Array(256).fill(1);
      space.setPerceptualVector(original);
      original[0] = 999;
      expect(space.getPerceptualVector()[0]).toBe(1);
    });
  });

  describe('extractMachineInput', () => {
    beforeEach(() => {
      // Set En[0:5] = [1, 2, 3, 4, 5]
      space.updateRegion(0, [1, 2, 3, 4, 5]);
    });

    it('should extract machine input from perceptual space', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      const machineInput = space.extractMachineInput(mapping);
      expect(machineInput).toEqual([1, 2, 3]);
    });

    it('should extract from middle of perceptual space', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 2, length: 3 },
        output: { offset: 10, length: 2 }
      };

      const machineInput = space.extractMachineInput(mapping);
      expect(machineInput).toEqual([3, 4, 5]);
    });

    it('should throw error for offset out of bounds', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 256, length: 3 },
        output: { offset: 10, length: 2 }
      };

      expect(() => space.extractMachineInput(mapping)).toThrow(/out of bounds/);
    });

    it('should throw error for length exceeding dimension', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 254, length: 10 },
        output: { offset: 10, length: 2 }
      };

      expect(() => space.extractMachineInput(mapping)).toThrow(/exceeds dimension/);
    });
  });

  describe('mergeMachineOutput', () => {
    it('should merge machine output into perceptual space', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      const outputVector = [42, 43];
      space.mergeMachineOutput(outputVector, mapping);

      const region = space.getRegion(10, 2);
      expect(region).toEqual([42, 43]);
    });

    it('should overwrite existing values', () => {
      space.updateRegion(10, [1, 1, 1, 1]);

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      space.mergeMachineOutput([99, 100], mapping);

      const region = space.getRegion(10, 4);
      expect(region).toEqual([99, 100, 1, 1]);
    });

    it('should throw error for offset out of bounds', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 256, length: 2 }
      };

      expect(() => space.mergeMachineOutput([1, 2], mapping)).toThrow(/out of bounds/);
    });

    it('should throw error for length mismatch', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      expect(() => space.mergeMachineOutput([1, 2, 3], mapping)).toThrow(/does not match/);
    });
  });

  describe('updateRegion and getRegion', () => {
    it('should update and retrieve a region', () => {
      space.updateRegion(10, [5, 6, 7]);
      const region = space.getRegion(10, 3);
      expect(region).toEqual([5, 6, 7]);
    });

    it('should not affect other regions', () => {
      space.updateRegion(10, [5, 6, 7]);
      const before = space.getRegion(0, 5);
      const after = space.getRegion(15, 5);
      expect(before.every(v => v === 0)).toBe(true);
      expect(after.every(v => v === 0)).toBe(true);
    });

    it('should throw error for invalid offset', () => {
      // Negative offsets and offsets at-or-past the end both fail; the messages
      // differ ("must be non-negative" vs "is out of bounds") so we match each.
      expect(() => space.updateRegion(-1, [1, 2])).toThrow(/non-negative/);
      expect(() => space.updateRegion(256, [1, 2])).toThrow(/out of bounds/);
    });

    it('should throw error for exceeding dimension', () => {
      expect(() => space.updateRegion(255, [1, 2])).toThrow(/exceeds dimension/);
    });
  });

  describe('reset', () => {
    it('should reset perceptual space to zeros', () => {
      space.updateRegion(0, [1, 2, 3, 4, 5]);
      space.reset();
      const vector = space.getPerceptualVector();
      expect(vector.every(v => v === 0)).toBe(true);
    });
  });

  describe('validateMapping', () => {
    it('should validate correct mapping', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 10 },
        output: { offset: 10, length: 5 }
      };

      const result = PerceptualSpace.validateMapping(mapping, 256);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect negative offset', () => {
      const mapping: PerceptualMapping = {
        input: { offset: -1, length: 10 },
        output: { offset: 10, length: 5 }
      };

      const result = PerceptualSpace.validateMapping(mapping, 256);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('negative'))).toBe(true);
    });

    it('should detect non-positive length', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 0 },
        output: { offset: 10, length: 5 }
      };

      const result = PerceptualSpace.validateMapping(mapping, 256);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should detect exceeding dimension', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 250, length: 10 },
        output: { offset: 10, length: 5 }
      };

      const result = PerceptualSpace.validateMapping(mapping, 256);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
    });

    it('should detect multiple errors', () => {
      const mapping: PerceptualMapping = {
        input: { offset: -1, length: 0 },
        output: { offset: 300, length: -5 }
      };

      const result = PerceptualSpace.validateMapping(mapping, 256);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      space.updateRegion(0, [1, 2, 3]);
      const json = space.toJSON();

      expect(json.dimension).toBe(256);
      expect(json.perceptualVector).toBeDefined();
      expect(json.perceptualVector[0]).toBe(1);
      expect(json.perceptualVector[1]).toBe(2);
      expect(json.perceptualVector[2]).toBe(3);
    });

    it('should deserialize from JSON', () => {
      const json = {
        dimension: 256,
        perceptualVector: new Array(256).fill(0)
      };
      json.perceptualVector[0] = 42;

      const restored = PerceptualSpace.fromJSON(json);
      expect(restored.getDimension()).toBe(256);
      expect(restored.getRegion(0, 1)).toEqual([42]);
    });

    it('should round-trip correctly', () => {
      space.updateRegion(5, [10, 20, 30]);
      const json = space.toJSON();
      const restored = PerceptualSpace.fromJSON(json);

      expect(restored.getPerceptualVector()).toEqual(space.getPerceptualVector());
    });
  });

  describe('machine interconnection scenario', () => {
    it('should support data flow between machines', () => {
      // Machine 1: input[0:3], output[3:5]
      const machine1Mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 3, length: 2 }
      };

      // Machine 2: input[3:5], output[6:8]
      const machine2Mapping: PerceptualMapping = {
        input: { offset: 3, length: 2 },
        output: { offset: 6, length: 2 }
      };

      // Set input for machine 1
      space.updateRegion(0, [1, 2, 3]);

      // Extract input for machine 1
      const m1Input = space.extractMachineInput(machine1Mapping);
      expect(m1Input).toEqual([1, 2, 3]);

      // Simulate machine 1 processing and outputting
      const m1Output = [10, 20];
      space.mergeMachineOutput(m1Output, machine1Mapping);

      // Extract input for machine 2 (should see machine 1's output)
      const m2Input = space.extractMachineInput(machine2Mapping);
      expect(m2Input).toEqual([10, 20]);

      // Simulate machine 2 processing and outputting
      const m2Output = [100, 200];
      space.mergeMachineOutput(m2Output, machine2Mapping);

      // Verify final state
      expect(space.getRegion(0, 3)).toEqual([1, 2, 3]);   // Original input
      expect(space.getRegion(3, 2)).toEqual([10, 20]);    // Machine 1 output
      expect(space.getRegion(6, 2)).toEqual([100, 200]);  // Machine 2 output
    });
  });
});
