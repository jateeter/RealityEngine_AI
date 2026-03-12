import { readFileSync } from 'fs';
import { join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { ComparatorType } from '../models/types.js';

const MACHINES = join(process.cwd(), 'examples', 'machines');

describe('MachineLoader — matchAlgorithm', () => {
  describe('JSON parsing', () => {
    test('reads matchAlgorithm from JSON and stamps it on machine and all vectors', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          matchAlgorithm: 'equals',
          sequences: [{
            name: 'Seq',
            vectors: [{
              id: 'v1',
              elements: [{ value: 0.5 }],
              isInitial: true
            }]
          }]
        }
      });

      const machine = MachineLoader.loadFromJSON(json);
      expect(machine.matchAlgorithm).toBe(ComparatorType.EQUALS);

      const vec = machine.getAllSequences()[0].getAllVectors()[0];
      expect(vec.matchAlgorithm).toBe(ComparatorType.EQUALS);
      // EQUALS: 0.5 matches 0.5, but 1.0 does not
      expect(vec.match([0.5]).matched).toBe(true);
      expect(vec.match([1.0]).matched).toBe(false);
    });

    test('defaults to GTE when matchAlgorithm is absent from JSON', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          sequences: [{
            name: 'Seq',
            vectors: [{
              id: 'v1',
              elements: [{ value: 1, threshold: 0.5 }],
              isInitial: true
            }]
          }]
        }
      });

      const machine = MachineLoader.loadFromJSON(json);
      expect(machine.matchAlgorithm).toBe(ComparatorType.GTE);

      const vec = machine.getAllSequences()[0].getAllVectors()[0];
      expect(vec.matchAlgorithm).toBe(ComparatorType.GTE);
      // GTE: value=1 (HIGH), matches input >= 0.5
      expect(vec.match([1]).matched).toBe(true);
      expect(vec.match([0]).matched).toBe(false);
    });

    test('element-level comparatorType overrides machine matchAlgorithm', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          matchAlgorithm: 'gte',
          sequences: [{
            name: 'Seq',
            vectors: [{
              id: 'v1',
              // Element explicitly overrides with EQUALS
              elements: [{ value: 0.5, comparatorType: 'equals' }],
              isInitial: true
            }]
          }]
        }
      });

      const machine = MachineLoader.loadFromJSON(json);
      expect(machine.matchAlgorithm).toBe(ComparatorType.GTE);

      const vec = machine.getAllSequences()[0].getAllVectors()[0];
      // Vector inherits GTE from machine
      expect(vec.matchAlgorithm).toBe(ComparatorType.GTE);
      // But element has EQUALS override — only exact 0.5 matches
      expect(vec.match([0.5]).matched).toBe(true);
      expect(vec.match([1.0]).matched).toBe(false);
    });

    test('all supported algorithms parse correctly', () => {
      for (const [str, expected] of [
        ['equals',    ComparatorType.EQUALS],
        ['threshold', ComparatorType.THRESHOLD],
        ['pattern',   ComparatorType.PATTERN],
        ['custom',    ComparatorType.CUSTOM],
        ['gte',       ComparatorType.GTE],
      ] as const) {
        const json = JSON.stringify({
          version: '1.0.0',
          machine: {
            name: 'T', description: '', arbiterRule: 'PASSTHROUGH',
            matchAlgorithm: str,
            sequences: [{ name: 'S', vectors: [{ elements: [{ value: 0.5 }], isInitial: true }] }]
          }
        });
        const machine = MachineLoader.loadFromJSON(json);
        expect(machine.matchAlgorithm).toBe(expected);
      }
    });
  });

  describe('saveToJSON roundtrip', () => {
    test('saveToJSON emits matchAlgorithm at machine level', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          matchAlgorithm: 'gte',
          sequences: [{
            name: 'Seq',
            vectors: [{ id: 'v1', elements: [{ value: 1, threshold: 0.5 }], isInitial: true }]
          }]
        }
      });
      const machine = MachineLoader.loadFromJSON(json);
      const serialized = JSON.parse(MachineLoader.saveToJSON(machine));
      expect(serialized.machine.matchAlgorithm).toBe('gte');
    });

    test('saveToJSON omits element comparatorType when it matches machine algorithm', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          matchAlgorithm: 'gte',
          sequences: [{
            name: 'Seq',
            vectors: [{ id: 'v1', elements: [{ value: 1, threshold: 0.5 }], isInitial: true }]
          }]
        }
      });
      const machine = MachineLoader.loadFromJSON(json);
      const serialized = JSON.parse(MachineLoader.saveToJSON(machine));
      const elem = serialized.machine.sequences[0].vectors[0].elements[0];
      // No comparatorType emitted — it matches machine algorithm
      expect(elem.comparatorType).toBeUndefined();
      expect(elem.value).toBe(1);
      expect(elem.threshold).toBe(0.5);
    });

    test('saveToJSON emits element comparatorType when it is an override', () => {
      const json = JSON.stringify({
        version: '1.0.0',
        machine: {
          name: 'Test', description: 'test', arbiterRule: 'PASSTHROUGH',
          matchAlgorithm: 'gte',
          sequences: [{
            name: 'Seq',
            vectors: [{
              id: 'v1',
              elements: [{ value: 0.5, comparatorType: 'equals' }],
              isInitial: true
            }]
          }]
        }
      });
      const machine = MachineLoader.loadFromJSON(json);
      const serialized = JSON.parse(MachineLoader.saveToJSON(machine));
      const elem = serialized.machine.sequences[0].vectors[0].elements[0];
      // comparatorType IS emitted — it's an override
      expect(elem.comparatorType).toBe('equals');
    });
  });

  describe('Real machine files', () => {
    test('RSFlipFlop.json loads with matchAlgorithm=GTE and correct binary match behavior', () => {
      const json = readFileSync(join(MACHINES, 'RSFlipFlop.json'), 'utf8');
      const machine = MachineLoader.loadFromJSON(json, 'rs-ff');
      expect(machine.matchAlgorithm).toBe(ComparatorType.GTE);

      // Verify all vectors inherited the algorithm
      for (const seq of machine.getAllSequences()) {
        for (const vec of seq.getAllVectors()) {
          expect(vec.matchAlgorithm).toBe(ComparatorType.GTE);
        }
      }

      // SET vector [1,0]: matches HIGH,LOW inputs (binary GTE semantics)
      const setSeq = machine.getAllSequences().find(s => s.name.includes('SET'))!;
      const setVec = setSeq.getAllVectors()[0];
      expect(setVec.match([1, 0]).matched).toBe(true);
      expect(setVec.match([0, 1]).matched).toBe(false);
      expect(setVec.match([0, 0]).matched).toBe(false);
      expect(setVec.match([1, 1]).matched).toBe(false);
    });

    test('MultiStep.json loads with matchAlgorithm=GTE across all vectors', () => {
      const json = readFileSync(join(MACHINES, 'MultiStep.json'), 'utf8');
      const machine = MachineLoader.loadFromJSON(json, 'ms');
      expect(machine.matchAlgorithm).toBe(ComparatorType.GTE);

      let vectorCount = 0;
      for (const seq of machine.getAllSequences()) {
        for (const vec of seq.getAllVectors()) {
          expect(vec.matchAlgorithm).toBe(ComparatorType.GTE);
          vectorCount++;
        }
      }
      expect(vectorCount).toBe(6); // 3 vectors × 2 sequences
    });
  });
});
