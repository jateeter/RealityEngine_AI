import { describe, expect, test } from '@jest/globals';
import { Machine } from '../Machine.js';
import { CriticalEventSequence } from '../CriticalEventSequence.js';
import { RealityVector } from '../RealityVector.js';
import { PerceptualSpace } from '../PerceptualSpace.js';
import { ArbiterRule } from '../OutputArbiter.js';
import { ComparatorType } from '../types.js';

function makeVector(value: number, isInitial: boolean, id: string): RealityVector {
  return new RealityVector([{ value, comparatorType: ComparatorType.EQUALS }], isInitial, id);
}

describe('Machine', () => {
  test('processInputFromPerceptualSpace extracts mapped input and merges output', () => {
    const machine = new Machine(
      'mapped-machine',
      'test',
      {},
      ArbiterRule.PASSTHROUGH,
      { input: { offset: 1, length: 1 }, output: { offset: 3, length: 1 } }
    );

    const sequence = new CriticalEventSequence('seq');
    const vector = makeVector(1, true, 'v1');
    vector.addOutputVector({ id: 'out', vector: [0.75], timestamp: Date.now() });
    sequence.addVector(vector);
    machine.addSequence(sequence);

    const space = new PerceptualSpace(8);
    space.updateRegion(1, [1]);

    const result = machine.processInputFromPerceptualSpace(space);

    expect(result.machineOutput?.vector).toEqual([0.75]);
    expect(space.getRegion(3, 1)).toEqual([0.75]);
  });

  test('processInputFromPerceptualSpace throws when mapping is missing', () => {
    const machine = new Machine('unmapped-machine');
    const space = new PerceptualSpace(8);

    expect(() => machine.processInputFromPerceptualSpace(space)).toThrow(
      /does not have a perceptual mapping/
    );
  });

  test('clone creates independent mutable sequence state', () => {
    const machine = new Machine('clone-source');
    const sequence = new CriticalEventSequence('clone-seq');
    const v1 = makeVector(1, true, 'v1');
    const v2 = makeVector(2, false, 'v2');
    v2.addOutputVector({ id: 'final', vector: [1], timestamp: Date.now() });
    v1.addNextVector(v2.id);
    sequence.addVector(v1);
    sequence.addVector(v2);
    machine.addSequence(sequence);

    const cloned = machine.clone();
    cloned.processInput([1]); // activates v2 on clone only

    const originalActiveIds = machine.getAllSequences()[0]?.getActiveVectors().map(v => v.id) ?? [];
    const cloneActiveIds = cloned.getAllSequences()[0]?.getActiveVectors().map(v => v.id) ?? [];

    expect(originalActiveIds).not.toContain('v2');
    expect(cloneActiveIds).toContain('v2');
  });
});
