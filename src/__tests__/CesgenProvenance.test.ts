/**
 * CES provenance trail — life-safety audit-loop tests.
 *
 * Every emitted output now carries the ordered list of vector IDs whose
 * matches led to it firing.  For a fall-detection machine this means an
 * alert payload can show not just "RED fall" but the six-tick chain that
 * justified the assertion:
 *
 *   fall-conf-v1 → v2 → v3 → v4 → v5 → v6 → output [4, 3]
 *
 * The tests below drive real machine fixtures through processImmediate and
 * assert the provenance field on the resulting mergeBatch entry matches the
 * canonical path defined by the JSON.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import type { Machine } from '../models/Machine.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES = join(dirname(__filename), '../../examples/machines');

function load(file: string, id: string): Machine {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, file), 'utf8'), id);
}

function dense(offset: number, values: number[]): number[] {
  const v = new Array<number>(offset + values.length).fill(0);
  for (let i = 0; i < values.length; i++) v[offset + i] = values[i]!;
  return v;
}

describe('CES provenance trail', () => {
  test('FallDetection RED — output carries the full 6-vector chain', () => {
    const m = load('FallDetection.json', 'prov-fall-red');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    // The fall-confirmed sequence walks [1,0] → [2,0] → [3,0] → [3,1] → [3,2] → [3,3].
    // After 6 steps the terminal v6 fires and emits [4, 3] at the output region.
    const chain = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
    let last;
    for (const step of chain) {
      last = sim.processImmediate(dense(input.offset, step));
    }

    const fired = last!.mergeBatch.find(op =>
      op.sequenceId === 'fall-confirmed' &&
      op.values[0] === 4 && op.values[1] === 3
    );
    expect(fired).toBeDefined();
    // The audit chain: every vector that participated, in order.  Listeners
    // attach this to the alert payload so a clinician sees the evidence
    // behind the RED, not just the final classification.
    expect(fired!.provenance).toEqual([
      'fall-conf-v1',
      'fall-conf-v2',
      'fall-conf-v3',
      'fall-conf-v4',
      'fall-conf-v5',
      'fall-conf-v6',
    ]);
  });

  test('FallDetection slow-collapse — 3-vector RED chain', () => {
    const m = load('FallDetection.json', 'prov-fall-slow');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    const chain = [[0, 1], [0, 2], [0, 3]];
    let last;
    for (const step of chain) last = sim.processImmediate(dense(input.offset, step));

    const fired = last!.mergeBatch.find(op =>
      op.sequenceId === 'fall-slow-collapse' &&
      op.values[0] === 4 && op.values[1] === 2
    );
    expect(fired).toBeDefined();
    expect(fired!.provenance).toEqual(['fall-slow-v1', 'fall-slow-v2', 'fall-slow-v3']);
  });

  test('RSFlipFlop SET — single-step provenance is just the matching vector', () => {
    // For isInitial vectors that emit on their first match, the provenance is
    // just [v.id] — there's no predecessor to inherit from.
    const m = load('RSFlipFlop.json', 'prov-rsff-set');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    const step = sim.processImmediate(dense(input.offset, [1, 0]));

    const fired = step.mergeBatch.find(op => op.sequenceId === 'rs-set-sequence');
    expect(fired).toBeDefined();
    expect(fired!.values).toEqual([1, 0]);
    expect(fired!.provenance).toEqual(['rs-event-10']);
  });

  test('provenance survives parallel sequences within the same machine', () => {
    // FallDetection has multiple isInitial vectors across different sequences
    // that share input element [1, 0] — fall-stumble-v1, fall-sust-v1,
    // fall-imprec-v1, fall-conf-v1.  Run the impact-recovered 4-step chain
    // and verify only that sequence's provenance shows up.
    const m = load('FallDetection.json', 'prov-fall-impact');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    const chain = [[1, 0], [2, 0], [3, 0], [0, 0]];
    let last;
    for (const step of chain) last = sim.processImmediate(dense(input.offset, step));

    const fired = last!.mergeBatch.find(op =>
      op.sequenceId === 'fall-impact-recovered' &&
      op.values[0] === 3 && op.values[1] === 3
    );
    expect(fired).toBeDefined();
    expect(fired!.provenance).toEqual([
      'fall-imprec-v1',
      'fall-imprec-v2',
      'fall-imprec-v3',
      'fall-imprec-v4',
    ]);
  });

  test('every mergeBatch entry has a non-empty provenance array', () => {
    // Property: any output we emit must carry at least its own emitter ID.
    // This guards against accidentally dropping the chain somewhere in the
    // pipeline (RealityVector → CES → Machine → Simulator → mergeBatch).
    const m = load('RSFlipFlop.json', 'prov-rsff-prop');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    const step = sim.processImmediate(dense(input.offset, [0, 1]));
    expect(step.mergeBatch.length).toBeGreaterThan(0);
    for (const op of step.mergeBatch) {
      expect(Array.isArray(op.provenance)).toBe(true);
      expect(op.provenance.length).toBeGreaterThan(0);
    }
  });
});
