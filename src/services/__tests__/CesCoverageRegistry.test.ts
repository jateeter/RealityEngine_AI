/**
 * Unit tests for CesCoverageRegistry — the AI side of the CES coverage gauge.
 *
 * The property under test is "after N transitions, every counter & unfired-*
 * gauge reflects what actually happened in the engine".  These tests use
 * RSFlipFlop because its two single-step sequences make the expected gauge
 * deltas trivial to enumerate.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../MachineLoader.js';
import { PerceptualSpaceSimulator } from '../../engine/PerceptualSpaceSimulator.js';
import { CesCoverageRegistry } from '../CesCoverageRegistry.js';

const MACHINES = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/machines');

function loadRSFlipFlop(id = 'cov-rsff'): ReturnType<typeof MachineLoader.loadFromJSON> {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, 'RSFlipFlop.json'), 'utf8'), id);
}

describe('CesCoverageRegistry', () => {
  let sim: PerceptualSpaceSimulator;
  let registry: CesCoverageRegistry;

  beforeEach(() => {
    sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadRSFlipFlop());
    registry = sim.getCesCoverage();
  });

  it('reports both sequences unfired before any input', () => {
    const m = sim.getMachines()[0]!;
    const snap = registry.snapshot([m]);
    expect(snap.perMachine[0]!.sequenceCount).toBe(2);
    expect(snap.perMachine[0]!.unfiredSequences).toBe(2);
    expect(snap.perMachine[0]!.unfiredVectors).toBe(2);
  });

  it('marks the SET sequence as fired after a [1,0] input', () => {
    const m = sim.getMachines()[0]!;
    const inp = m.perceptualMapping!.input;
    const v = new Array<number>(inp.offset + inp.length).fill(0);
    v[inp.offset]     = 1;
    v[inp.offset + 1] = 0;
    sim.processImmediate(v);

    const snap = registry.snapshot([m]);
    expect(snap.perMachine[0]!.firedSequences).toBe(1);
    expect(snap.perMachine[0]!.unfiredSequences).toBe(1);
    expect(snap.totals.outputs).toBeGreaterThanOrEqual(1);
  });

  it('exposes Prometheus text with the canonical metric names', () => {
    const m = sim.getMachines()[0]!;
    const inp = m.perceptualMapping!.input;
    const v = new Array<number>(inp.offset + inp.length).fill(0);
    v[inp.offset]     = 1;
    v[inp.offset + 1] = 0;
    sim.processImmediate(v);

    const text = registry.toPrometheusText([m]);
    expect(text).toContain('# TYPE ces_machines_total gauge');
    expect(text).toContain('# TYPE ces_vector_matched_total counter');
    expect(text).toContain('# TYPE ces_sequence_outputs_total counter');
    expect(text).toContain('# TYPE ces_unfired_sequences gauge');
    expect(text).toContain('ces_machines_total 1');
    expect(text).toMatch(/ces_sequence_outputs_total\{[^}]*sequence="rs-set-sequence"[^}]*\} 1/);
    expect(text).toMatch(/ces_unfired_sequences\{[^}]*machine="RS Flip Flop"[^}]*\} 1/);
  });

  it('reset clears every counter', () => {
    const m = sim.getMachines()[0]!;
    const inp = m.perceptualMapping!.input;
    const v = new Array<number>(inp.offset + inp.length).fill(0);
    v[inp.offset] = 1;
    sim.processImmediate(v);
    expect(registry.snapshot([m]).totals.matched).toBeGreaterThan(0);

    registry.reset();
    const snap = registry.snapshot([m]);
    expect(snap.totals.matched).toBe(0);
    expect(snap.totals.activated).toBe(0);
    expect(snap.totals.outputs).toBe(0);
    expect(snap.perMachine[0]!.unfiredSequences).toBe(snap.perMachine[0]!.sequenceCount);
  });
});
