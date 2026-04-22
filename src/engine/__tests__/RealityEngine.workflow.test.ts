import { describe, expect, test, jest } from '@jest/globals';
import { RealityEngine } from '../RealityEngine.js';
import { Machine } from '../../models/Machine.js';
import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { ComparatorType } from '../../models/types.js';

function makeVector(value: number, isInitial: boolean, id: string): RealityVector {
  return new RealityVector([{ value, comparatorType: ComparatorType.EQUALS }], isInitial, id);
}

function createMockStore() {
  return {
    initialize: jest.fn(async () => undefined),
    storeSequence: jest.fn(async () => undefined),
    getSequence: jest.fn(async () => null),
    searchSimilar: jest.fn(async () => [])
  };
}

function createMappedMachine(machineName = 'machine-a'): Machine {
  const machine = new Machine(
    machineName,
    'test-machine',
    {},
    undefined,
    { input: { offset: 2, length: 1 }, output: { offset: 5, length: 1 } }
  );
  const seq = new CriticalEventSequence('mapped-seq');
  const v1 = makeVector(1, true, 'm-v1');
  v1.addOutputVector({ id: 'mapped-output', vector: [0.9], timestamp: Date.now() });
  seq.addVector(v1);
  machine.addSequence(seq);
  return machine;
}

describe('RealityEngine workflow and checkpoint behavior', () => {
  test('processMachineInput maps input into universal space and merges output metadata', () => {
    const store = createMockStore();
    const engine = new RealityEngine(store as any, 100, 8);
    const machine = createMappedMachine();
    engine.addMachine(machine);

    const result = engine.processMachineInput(machine.id, [1]);

    expect(result.machineOutput?.metadata?.machineId).toBe(machine.id);
    expect(result.machineOutput?.metadata?.machineName).toBe(machine.name);
    expect(
      result.machineOutput?.metadata?.preceptionUsed ??
      result.machineOutput?.metadata?.perceptionUsed
    ).toBe(true);

    const mergedRegion = engine.getPreceptionEngine().getPerceptualSpace().getRegion(5, 1);
    expect(mergedRegion).toEqual([0.9]);
  });

  test('what-if processing does not mutate live machine state', () => {
    const store = createMockStore();
    const engine = new RealityEngine(store as any, 100, 8);
    const machine = new Machine(
      'what-if-machine',
      'test',
      {},
      undefined,
      { input: { offset: 2, length: 1 }, output: { offset: 5, length: 1 } }
    );

    const seq = new CriticalEventSequence('what-if-seq');
    const start = makeVector(1, true, 'start');
    const final = makeVector(2, false, 'final');
    start.addNextVector(final.id);
    final.addOutputVector({ id: 'final-out', vector: [1], timestamp: Date.now() });
    seq.addVector(start);
    seq.addVector(final);
    machine.addSequence(seq);
    engine.addMachine(machine);

    engine.processMachineInput(machine.id, [1]); // advance live state so final is active
    const before = machine.getAllSequences()[0]?.getActiveVectors().map(v => v.id) ?? [];

    const whatIf = engine.processWhatIf(machine.id, [2]);
    const after = machine.getAllSequences()[0]?.getActiveVectors().map(v => v.id) ?? [];

    expect(whatIf.machineOutput?.vector).toEqual([1]);
    expect(whatIf.machineOutput?.metadata?.sources).toContain('final-out');
    expect(after).toEqual(before);
  });

  test('checkpoint restore rewinds machine state and engine persistence methods delegate to store', async () => {
    const store = createMockStore();
    const engine = new RealityEngine(store as any, 100, 8);
    const machine = new Machine(
      'checkpoint-machine',
      'test',
      {},
      undefined,
      { input: { offset: 2, length: 1 }, output: { offset: 5, length: 1 } }
    );

    const seq = new CriticalEventSequence('checkpoint-seq');
    const start = makeVector(1, true, 'cp-start');
    const final = makeVector(2, false, 'cp-final');
    start.addNextVector(final.id);
    final.addOutputVector({ id: 'cp-out', vector: [1], timestamp: Date.now() });
    seq.addVector(start);
    seq.addVector(final);
    machine.addSequence(seq);
    engine.addMachine(machine);

    const checkpointId = engine.createCheckpoint(machine.id, 'before-transition');
    engine.processMachineInput(machine.id, [1]);
    expect(machine.getAllSequences()[0]?.getActiveVectors().map(v => v.id)).toContain('cp-final');

    engine.restoreCheckpoint(machine.id, checkpointId);
    const restoredMachine = engine.getMachine(machine.id);
    const restoredActive = restoredMachine?.getAllSequences()[0]?.getActiveVectors().map(v => v.id) ?? [];
    expect(restoredActive).not.toContain('cp-final');

    expect(engine.listCheckpoints(machine.id).map(cp => cp.id)).toContain(checkpointId);
    expect(engine.deleteCheckpoint(machine.id, checkpointId)).toBe(true);

    await engine.persistAllSequences();
    expect(store.storeSequence).toHaveBeenCalled();

    const loaded = new CriticalEventSequence('loaded-seq');
    const loadedVector = makeVector(3, true, 'loaded-v1');
    loadedVector.addOutputVector({ id: 'loaded-out', vector: [3], timestamp: Date.now() });
    loaded.addVector(loadedVector);
    store.getSequence.mockResolvedValueOnce(loaded);
    const loadedResult = await engine.loadSequence('loaded-id');
    expect(loadedResult?.id).toBe(loaded.id);

    await engine.searchVectors([0.1, 0.2], 2, 0.5);
    expect(store.searchSimilar).toHaveBeenCalledWith([0.1, 0.2], 2, 0.5);
  });
});
