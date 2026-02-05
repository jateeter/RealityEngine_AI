/**
 * Tests for PreceptionEngine class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PreceptionEngine } from '../PreceptionEngine.js';
import { Machine } from '../../models/Machine.js';
import { PerceptualSpace } from '../../models/PerceptualSpace.js';
import type { PerceptualMapping } from '../../models/types.js';
import { ArbiterRule } from '../../models/OutputArbiter.js';

describe('PreceptionEngine', () => {
  let engine: PreceptionEngine;

  beforeEach(() => {
    engine = new PreceptionEngine(256);
  });

  describe('constructor', () => {
    it('should create engine with default 256-byte universal dimension', () => {
      const defaultEngine = new PreceptionEngine();
      expect(defaultEngine.getUniversalDimension()).toBe(256);
    });

    it('should create engine with custom universal dimension', () => {
      const customEngine = new PreceptionEngine(512);
      expect(customEngine.getUniversalDimension()).toBe(512);
    });

    it('should initialize with a perceptual space', () => {
      const space = engine.getPerceptualSpace();
      expect(space).toBeInstanceOf(PerceptualSpace);
      expect(space.getDimension()).toBe(256);
    });
  });

  describe('resolveInputEventVector', () => {
    it('should extract machine-specific input from universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1;
      universalSpace[1] = 2;
      universalSpace[2] = 3;

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      const machineInput = engine.resolveInputEventVector(universalSpace, mapping);

      expect(machineInput).toEqual([1, 2, 3]);
    });

    it('should extract from middle of universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[10] = 42;
      universalSpace[11] = 43;
      universalSpace[12] = 44;

      const mapping: PerceptualMapping = {
        input: { offset: 10, length: 3 },
        output: { offset: 50, length: 2 }
      };

      const machineInput = engine.resolveInputEventVector(universalSpace, mapping);

      expect(machineInput).toEqual([42, 43, 44]);
    });

    it('should extract from end of universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[254] = 99;
      universalSpace[255] = 100;

      const mapping: PerceptualMapping = {
        input: { offset: 254, length: 2 },
        output: { offset: 0, length: 1 }
      };

      const machineInput = engine.resolveInputEventVector(universalSpace, mapping);

      expect(machineInput).toEqual([99, 100]);
    });

    it('should throw error for invalid universal space dimension', () => {
      const invalidSpace = new Array(128).fill(0);

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      expect(() => engine.resolveInputEventVector(invalidSpace, mapping)).toThrow(
        /Universal input space must be 256 bytes/
      );
    });

    it('should handle single-byte extraction', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[100] = 7;

      const mapping: PerceptualMapping = {
        input: { offset: 100, length: 1 },
        output: { offset: 200, length: 1 }
      };

      const machineInput = engine.resolveInputEventVector(universalSpace, mapping);

      expect(machineInput).toEqual([7]);
    });

    it('should handle large extraction ranges', () => {
      const universalSpace = new Array(256).fill(0);
      // Set a pattern in bytes 0-49
      for (let i = 0; i < 50; i++) {
        universalSpace[i] = i;
      }

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 50 },
        output: { offset: 100, length: 10 }
      };

      const machineInput = engine.resolveInputEventVector(universalSpace, mapping);

      expect(machineInput.length).toBe(50);
      expect(machineInput[0]).toBe(0);
      expect(machineInput[49]).toBe(49);
    });

    it('should update perceptual space on each call', () => {
      const space1 = new Array(256).fill(0);
      space1[0] = 1;

      const space2 = new Array(256).fill(0);
      space2[0] = 2;

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 1 },
        output: { offset: 10, length: 1 }
      };

      const result1 = engine.resolveInputEventVector(space1, mapping);
      expect(result1).toEqual([1]);

      const result2 = engine.resolveInputEventVector(space2, mapping);
      expect(result2).toEqual([2]);
    });
  });

  describe('resolveInputEventVectorForMachine', () => {
    it('should resolve input using machine perceptual mapping', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[3] = 1;
      universalSpace[4] = 0;

      const mapping: PerceptualMapping = {
        input: { offset: 3, length: 2 },
        output: { offset: 5, length: 2 }
      };

      const machine = new Machine('Test Machine', 'Test', {}, ArbiterRule.PASSTHROUGH, mapping);

      const machineInput = engine.resolveInputEventVectorForMachine(universalSpace, machine);

      expect(machineInput).toEqual([1, 0]);
    });

    it('should throw error if machine has no perceptual mapping', () => {
      const universalSpace = new Array(256).fill(0);
      const machine = new Machine('Test Machine', 'No mapping');

      expect(() => engine.resolveInputEventVectorForMachine(universalSpace, machine)).toThrow(
        /does not have a perceptual mapping configured/
      );
    });

    it('should work with complex machine configurations', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[50] = 10;
      universalSpace[51] = 20;
      universalSpace[52] = 30;
      universalSpace[53] = 40;
      universalSpace[54] = 50;

      const mapping: PerceptualMapping = {
        input: { offset: 50, length: 5 },
        output: { offset: 100, length: 3 }
      };

      const machine = new Machine(
        'Complex Machine',
        'Multi-dimensional input',
        { type: 'sensor-array' },
        ArbiterRule.ANY,
        mapping
      );

      const machineInput = engine.resolveInputEventVectorForMachine(universalSpace, machine);

      expect(machineInput).toEqual([10, 20, 30, 40, 50]);
    });
  });

  describe('resolveInputsForMachines', () => {
    it('should resolve inputs for multiple machines simultaneously', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1;
      universalSpace[1] = 2;
      universalSpace[10] = 10;
      universalSpace[11] = 11;
      universalSpace[20] = 20;

      const machine1 = new Machine('Machine 1', 'First', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 2 },
        output: { offset: 5, length: 1 }
      });

      const machine2 = new Machine('Machine 2', 'Second', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 10, length: 2 },
        output: { offset: 15, length: 1 }
      });

      const machine3 = new Machine('Machine 3', 'Third', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 20, length: 1 },
        output: { offset: 25, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);
      machines.set(machine3.id, machine3);

      const results = engine.resolveInputsForMachines(universalSpace, machines);

      expect(results.size).toBe(3);
      expect(results.get(machine1.id)).toEqual([1, 2]);
      expect(results.get(machine2.id)).toEqual([10, 11]);
      expect(results.get(machine3.id)).toEqual([20]);
    });

    it('should skip machines without perceptual mapping', () => {
      const universalSpace = new Array(256).fill(0);

      const machine1 = new Machine('Machine 1', 'Has mapping', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 2 },
        output: { offset: 5, length: 1 }
      });

      const machine2 = new Machine('Machine 2', 'No mapping');

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);

      const results = engine.resolveInputsForMachines(universalSpace, machines);

      expect(results.size).toBe(1);
      expect(results.has(machine1.id)).toBe(true);
      expect(results.has(machine2.id)).toBe(false);
    });

    it('should handle empty machine map', () => {
      const universalSpace = new Array(256).fill(0);
      const machines = new Map<string, Machine>();

      const results = engine.resolveInputsForMachines(universalSpace, machines);

      expect(results.size).toBe(0);
    });

    it('should throw error for invalid universal space dimension', () => {
      const invalidSpace = new Array(100).fill(0);
      const machines = new Map<string, Machine>();

      expect(() => engine.resolveInputsForMachines(invalidSpace, machines)).toThrow(
        /Universal input space must be 256 bytes/
      );
    });

    it('should set universal input space only once for efficiency', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1;
      universalSpace[10] = 10;
      universalSpace[20] = 20;

      const machine1 = new Machine('M1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 1 },
        output: { offset: 5, length: 1 }
      });

      const machine2 = new Machine('M2', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 10, length: 1 },
        output: { offset: 15, length: 1 }
      });

      const machine3 = new Machine('M3', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 20, length: 1 },
        output: { offset: 25, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);
      machines.set(machine3.id, machine3);

      const results = engine.resolveInputsForMachines(universalSpace, machines);

      // All machines should see the same universal input space
      expect(results.get(machine1.id)).toEqual([1]);
      expect(results.get(machine2.id)).toEqual([10]);
      expect(results.get(machine3.id)).toEqual([20]);
    });
  });

  describe('validateMapping', () => {
    it('should validate correct mapping', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 10 },
        output: { offset: 20, length: 5 }
      };

      const result = engine.validateMapping(mapping);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid input offset', () => {
      const mapping: PerceptualMapping = {
        input: { offset: -1, length: 10 },
        output: { offset: 20, length: 5 }
      };

      const result = engine.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid input length', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 0 },
        output: { offset: 20, length: 5 }
      };

      const result = engine.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect input exceeding dimension', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 250, length: 10 },
        output: { offset: 20, length: 5 }
      };

      const result = engine.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
    });

    it('should detect invalid output mapping', () => {
      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 10 },
        output: { offset: 300, length: 5 }
      };

      const result = engine.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getDiagnosticMapping', () => {
    it('should provide diagnostic information for universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1;
      universalSpace[10] = 10;
      universalSpace[20] = 20;

      const machine1 = new Machine('Machine 1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 2 },
        output: { offset: 5, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      expect(diagnostic.universalSpace.dimension).toBe(256);
      expect(diagnostic.universalSpace.nonZeroIndices).toContain(0);
      expect(diagnostic.universalSpace.nonZeroIndices).toContain(10);
      expect(diagnostic.universalSpace.nonZeroIndices).toContain(20);
      expect(diagnostic.universalSpace.nonZeroValues.length).toBe(3);
    });

    it('should show machine mappings in diagnostic', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[3] = 1;
      universalSpace[4] = 0;

      const machine1 = new Machine('RS Flip Flop', 'Memory', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 3, length: 2 },
        output: { offset: 5, length: 2 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      expect(diagnostic.machineMappings.length).toBe(1);
      expect(diagnostic.machineMappings[0].machineName).toBe('RS Flip Flop');
      expect(diagnostic.machineMappings[0].inputMapping).toEqual({ offset: 3, length: 2 });
      expect(diagnostic.machineMappings[0].resolvedInput).toEqual([1, 0]);
      expect(diagnostic.machineMappings[0].universalIndices).toEqual([3, 4]);
    });

    it('should handle multiple machines in diagnostic', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1;
      universalSpace[10] = 10;

      const machine1 = new Machine('M1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 1 },
        output: { offset: 5, length: 1 }
      });

      const machine2 = new Machine('M2', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 10, length: 1 },
        output: { offset: 15, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      expect(diagnostic.machineMappings.length).toBe(2);
      expect(diagnostic.machineMappings[0].resolvedInput).toEqual([1]);
      expect(diagnostic.machineMappings[1].resolvedInput).toEqual([10]);
    });

    it('should skip machines without mapping in diagnostic', () => {
      const universalSpace = new Array(256).fill(0);

      const machine1 = new Machine('M1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 1 },
        output: { offset: 5, length: 1 }
      });

      const machine2 = new Machine('M2', 'No mapping');

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      expect(diagnostic.machineMappings.length).toBe(1);
      expect(diagnostic.machineMappings[0].machineName).toBe('M1');
    });

    it('should handle empty universal space', () => {
      const universalSpace = new Array(256).fill(0);
      const machines = new Map<string, Machine>();

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      expect(diagnostic.universalSpace.nonZeroIndices).toHaveLength(0);
      expect(diagnostic.universalSpace.nonZeroValues).toHaveLength(0);
      expect(diagnostic.machineMappings).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset perceptual space to zeros', () => {
      const universalSpace = new Array(256).fill(5);

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 10 },
        output: { offset: 20, length: 5 }
      };

      engine.resolveInputEventVector(universalSpace, mapping);
      engine.reset();

      const space = engine.getPerceptualSpace();
      const vector = space.getPerceptualVector();

      expect(vector.every(v => v === 0)).toBe(true);
    });

    it('should allow new resolutions after reset', () => {
      const space1 = new Array(256).fill(1);
      const space2 = new Array(256).fill(2);

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      engine.resolveInputEventVector(space1, mapping);
      engine.reset();
      const result = engine.resolveInputEventVector(space2, mapping);

      expect(result).toEqual([2, 2, 2]);
    });
  });

  describe('preception workflow scenarios', () => {
    it('should demonstrate preception - engine perceiving its context', () => {
      // Universal space represents complete observable reality
      const universalSpace = new Array(256).fill(0);

      // Sensor data in bytes 0-7: temperature (2 bytes), CPU load (2 bytes), memory (4 bytes)
      universalSpace[0] = 72; // temp high byte
      universalSpace[1] = 45; // temp low byte
      universalSpace[2] = 85; // CPU load high
      universalSpace[3] = 30; // CPU load low
      universalSpace[4] = 50; // memory usage

      // Network events in bytes 10-12
      universalSpace[10] = 1;  // network active
      universalSpace[11] = 128; // packet count

      // Binary signals in bytes 50-51
      universalSpace[50] = 1; // SET signal
      universalSpace[51] = 0; // RESET signal

      // Machine 1: System Monitor - perceives temp and CPU
      const systemMonitor = new Machine('System Monitor', 'Temp/CPU monitor', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 8 },
        output: { offset: 100, length: 2 }
      });

      // Machine 2: Network Monitor - perceives network signals
      const networkMonitor = new Machine('Network Monitor', 'Network state', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 10, length: 3 },
        output: { offset: 110, length: 2 }
      });

      // Machine 3: RS Flip Flop - perceives binary signals
      const rsFlipFlop = new Machine('RS Flip Flop', 'Binary memory', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 50, length: 2 },
        output: { offset: 120, length: 2 }
      });

      const machines = new Map<string, Machine>();
      machines.set(systemMonitor.id, systemMonitor);
      machines.set(networkMonitor.id, networkMonitor);
      machines.set(rsFlipFlop.id, rsFlipFlop);

      // PRECEPTION: Each machine perceives its relevant portion of reality
      const resolvedInputs = engine.resolveInputsForMachines(universalSpace, machines);

      // Verify each machine perceives its specific view
      expect(resolvedInputs.get(systemMonitor.id)).toEqual([72, 45, 85, 30, 50, 0, 0, 0]);
      expect(resolvedInputs.get(networkMonitor.id)).toEqual([1, 128, 0]);
      expect(resolvedInputs.get(rsFlipFlop.id)).toEqual([1, 0]);

      // This is "preception" - the Reality Engine perceiving its context
      expect(resolvedInputs.size).toBe(3);
    });

    it('should support overlapping perceptual regions', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[10] = 42;
      universalSpace[11] = 43;
      universalSpace[12] = 44;

      // Machine 1 perceives bytes [10, 11]
      const machine1 = new Machine('M1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 10, length: 2 },
        output: { offset: 50, length: 1 }
      });

      // Machine 2 perceives bytes [11, 12] - overlaps with Machine 1
      const machine2 = new Machine('M2', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 11, length: 2 },
        output: { offset: 60, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);

      const resolvedInputs = engine.resolveInputsForMachines(universalSpace, machines);

      // Both machines perceive correctly despite overlap
      expect(resolvedInputs.get(machine1.id)).toEqual([42, 43]);
      expect(resolvedInputs.get(machine2.id)).toEqual([43, 44]);
    });

    it('should handle sparse universal input space efficiently', () => {
      const universalSpace = new Array(256).fill(0);

      // Only a few bytes are non-zero (sparse)
      universalSpace[0] = 1;
      universalSpace[50] = 5;
      universalSpace[200] = 10;
      universalSpace[255] = 99;

      const machine1 = new Machine('M1', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 0, length: 1 },
        output: { offset: 10, length: 1 }
      });

      const machine2 = new Machine('M2', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 50, length: 1 },
        output: { offset: 60, length: 1 }
      });

      const machine3 = new Machine('M3', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 200, length: 1 },
        output: { offset: 210, length: 1 }
      });

      const machine4 = new Machine('M4', '', {}, ArbiterRule.PASSTHROUGH, {
        input: { offset: 255, length: 1 },
        output: { offset: 220, length: 1 }
      });

      const machines = new Map<string, Machine>();
      machines.set(machine1.id, machine1);
      machines.set(machine2.id, machine2);
      machines.set(machine3.id, machine3);
      machines.set(machine4.id, machine4);

      const diagnostic = engine.getDiagnosticMapping(universalSpace, machines);

      // Should correctly identify sparse non-zero values
      expect(diagnostic.universalSpace.nonZeroIndices).toEqual([0, 50, 200, 255]);
      expect(diagnostic.universalSpace.nonZeroValues).toEqual([
        { index: 0, value: 1 },
        { index: 50, value: 5 },
        { index: 200, value: 10 },
        { index: 255, value: 99 }
      ]);

      // All machines should resolve correctly
      expect(diagnostic.machineMappings.length).toBe(4);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle zero-length universal space (edge case)', () => {
      const customEngine = new PreceptionEngine(0);
      const emptySpace: number[] = [];

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 0 },
        output: { offset: 0, length: 0 }
      };

      // This is an edge case - should validate mapping first
      const validation = customEngine.validateMapping(mapping);
      expect(validation.valid).toBe(false);
    });

    it('should handle very large universal spaces', () => {
      const largeEngine = new PreceptionEngine(4096);
      const largeSpace = new Array(4096).fill(0);
      largeSpace[4000] = 123;

      const mapping: PerceptualMapping = {
        input: { offset: 4000, length: 1 },
        output: { offset: 0, length: 1 }
      };

      const result = largeEngine.resolveInputEventVector(largeSpace, mapping);
      expect(result).toEqual([123]);
    });

    it('should handle floating point values in universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = 1.5;
      universalSpace[1] = 2.7;
      universalSpace[2] = 3.9;

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 3 },
        output: { offset: 10, length: 2 }
      };

      const result = engine.resolveInputEventVector(universalSpace, mapping);
      expect(result).toEqual([1.5, 2.7, 3.9]);
    });

    it('should handle negative values in universal space', () => {
      const universalSpace = new Array(256).fill(0);
      universalSpace[0] = -5;
      universalSpace[1] = -10;

      const mapping: PerceptualMapping = {
        input: { offset: 0, length: 2 },
        output: { offset: 10, length: 1 }
      };

      const result = engine.resolveInputEventVector(universalSpace, mapping);
      expect(result).toEqual([-5, -10]);
    });
  });
});
