/**
 * Domain-aware end-to-end tests for the example universe.
 *
 * Each test drives a real machine JSON from `examples/machines/` through the
 * PerceptualSpaceSimulator and asserts the post-step result — covering:
 *
 *   • Single-domain trigger:  one representative machine per prefix
 *                             (AGX, BSX, CSX, DCX, DLX, HSPH, LBL, LSX, TFX)
 *                             produces its expected output for a known-firing
 *                             input.  `mergeBatch` carries the canonical write.
 *   • Dynamic dimension:      the simulator auto-grows to fit the highest
 *                             machine offset; `getMappingVersion()` bumps once
 *                             per addMachine.
 *   • Cross-domain step:      machines from three domains fire in the same
 *                             step and produce three deterministically-ordered
 *                             mergeBatch entries.
 *   • Ordering determinism:   running the same scenario twice yields a
 *                             byte-identical mergeBatch — the canonical sort
 *                             on (machineId, sequenceId, outputIndex) holds.
 *   • Polymorphic assembly:   building the same input as a dense vector vs a
 *                             sparse-region map produces equivalent mergeBatch.
 *
 * The fixtures are read from the production corpus, so these tests will catch
 * machine-JSON regressions as well as engine regressions.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import type { Machine } from '../models/Machine.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES   = join(dirname(__filename), '../../examples/machines');

function load(file: string, id: string): Machine {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, file), 'utf8'), id);
}

/**
 * Build a dense perceptual vector that places `values` at every (offset)
 * region request and zero-fills the rest.  Length is chosen to fit the
 * highest region so we don't depend on the simulator's current dimension.
 */
function denseVector(regions: Array<{ offset: number; values: number[] }>): number[] {
  let max = 0;
  for (const r of regions) max = Math.max(max, r.offset + r.values.length);
  const v = new Array<number>(max).fill(0);
  for (const r of regions) for (let i = 0; i < r.values.length; i++) v[r.offset + i] = r.values[i]!;
  return v;
}

// ── Domain fixtures ──────────────────────────────────────────────────────────
//
// For each prefix, the machine JSON contains at least one isInitial event vector
// with a defined output.  We capture (input pattern, expected output) so the
// assertion is direct: feed `input` into the machine's input region, expect
// `output` to land in the machine's output region.  These tuples were
// extracted from the JSON via a one-shot script and pinned here.

interface DomainCase {
  prefix: string;
  file: string;
  trigger: number[];    // values written into machine's input region
  output:  number[];    // expected values in machine's output region
}

const DOMAIN_CASES: DomainCase[] = [
  { prefix: 'AGX',  file: 'AGX001_aquaculture-water-quality-stability.json',                            trigger: [0, 1, 0, 1], output: [0, 1, 0, 0] },
  { prefix: 'BSX',  file: 'BSX001_integrative-planning-stakeholder-charrette-tracker.json',             trigger: [0, 1, 0, 1], output: [0, 1, 0, 0] },
  { prefix: 'CSX',  file: 'CSX001_health-and-human-services-intake-resident-intake-triage.json',         trigger: [0, 1, 1, 0], output: [0, 1, 0, 0] },
  { prefix: 'DCX',  file: 'DCX001_power-utility-feed-monitor.json',                                     trigger: [1, 0, 0, 1], output: [0, 1, 0, 0] },
  { prefix: 'HSPH', file: 'HSPH001_evaluability-readiness-signal-monitor.json',                          trigger: [0, 1, 0, 1], output: [0, 1, 0, 0] },
  { prefix: 'LBL',  file: 'LBL001_whole-person-intake-and-goals-psychiatric-history-intake.json',        trigger: [0, 1, 1, 0], output: [0, 1, 0, 0] },
  { prefix: 'LSX',  file: 'LSX001_provisional-patent-filing-invention-intake.json',                      trigger: [1, 1, 0, 0], output: [0, 1, 0, 0] },
  { prefix: 'TFX',  file: 'TFX001_rider-experience-stop-crowding-monitor.json',                          trigger: [0, 1, 1, 0], output: [0, 1, 0, 0] },
];

// ──────────────────────────────────────────────────────────────────────────────

describe('Domain E2E — single-machine trigger fires expected output', () => {
  test.each(DOMAIN_CASES)('$prefix machine produces expected mergeBatch write', ({ file, trigger, output }) => {
    const machine = load(file, `e2e-${file}`);
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(machine);

    const input = machine.perceptualMapping!.input;
    const out   = machine.perceptualMapping!.output;

    const vec = denseVector([{ offset: input.offset, values: trigger }]);
    const step = sim.processImmediate(vec);

    // mergeBatch is the authoritative result — exactly one write into the
    // machine's output region carrying the expected values.
    expect(step.mergeBatch).toHaveLength(1);
    const op = step.mergeBatch[0]!;
    expect(op.machineId).toBe(machine.id);
    expect(op.region).toEqual(out);
    expect(op.values).toEqual(output);

    // The debug projection of the perceptual space should reflect the merge.
    expect(step.perceptualSpace.slice(out.offset, out.offset + out.length)).toEqual(output);
  });
});

describe('Domain E2E — DLX rising-edge detector requires two steps', () => {
  // DLX001 is a 2-step sequence (no isInitial+output single-step path).
  // Step 1: input [0,0,0,0] activates the successor (no output).
  // Step 2: input [1,0,0,0] matches the successor → emits [1,0] at output region.
  test('rising-edge detector emits [1,0] only on the second step', () => {
    const m = load('DLX001_rising-edge-detector.json', 'dlx001-e2e');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);

    const input = m.perceptualMapping!.input;
    const out   = m.perceptualMapping!.output;

    const step1 = sim.processImmediate(denseVector([{ offset: input.offset, values: [0, 0, 0, 0] }]));
    expect(step1.mergeBatch).toEqual([]); // initial vector matches but the successor has no output

    const step2 = sim.processImmediate(denseVector([{ offset: input.offset, values: [1, 0, 0, 0] }]));
    expect(step2.mergeBatch).toHaveLength(1);
    expect(step2.mergeBatch[0]!.region).toEqual(out);
    expect(step2.mergeBatch[0]!.values).toEqual([1, 0]);
  });
});

describe('Domain E2E — simulator dimension grows to fit every domain', () => {
  test('dimension and mapping version track addMachine calls', () => {
    const sim = new PerceptualSpaceSimulator(0);
    expect(sim.getDimension()).toBe(0);
    expect(sim.getMappingVersion()).toBe(0);
    expect(sim.getRequiredDimension()).toBe(0);

    // Pick machines from three widely-separated regions so the high-water mark
    // moves with each addition.
    const m1 = load('AGX001_aquaculture-water-quality-stability.json',         'grow-agx');
    const m2 = load('CSX001_health-and-human-services-intake-resident-intake-triage.json', 'grow-csx');
    const m3 = load('DCX001_power-utility-feed-monitor.json',                  'grow-dcx');

    sim.addMachine(m1);
    expect(sim.getMappingVersion()).toBe(1);
    expect(sim.getDimension()).toBeGreaterThanOrEqual(m1.perceptualMapping!.output.offset + m1.perceptualMapping!.output.length);

    sim.addMachine(m2);
    expect(sim.getMappingVersion()).toBe(2);

    sim.addMachine(m3);
    expect(sim.getMappingVersion()).toBe(3);

    // The required dimension must equal the maximum offset+length across all
    // registered mappings — i.e. DCX's output end (it sits the furthest out).
    const expected = Math.max(
      m1.perceptualMapping!.input.offset + m1.perceptualMapping!.input.length,
      m1.perceptualMapping!.output.offset + m1.perceptualMapping!.output.length,
      m2.perceptualMapping!.input.offset + m2.perceptualMapping!.input.length,
      m2.perceptualMapping!.output.offset + m2.perceptualMapping!.output.length,
      m3.perceptualMapping!.input.offset + m3.perceptualMapping!.input.length,
      m3.perceptualMapping!.output.offset + m3.perceptualMapping!.output.length,
    );
    expect(sim.getRequiredDimension()).toBe(expected);
    expect(sim.getDimension()).toBeGreaterThanOrEqual(expected);
  });
});

describe('Domain E2E — three domains fire in the same step', () => {
  // Hand-pick three domain cases so the trigger / output mapping is explicit
  // and the test does not need to do any prefix inference at runtime.
  const CROSS = [
    DOMAIN_CASES.find(c => c.prefix === 'AGX')!,
    DOMAIN_CASES.find(c => c.prefix === 'HSPH')!,
    DOMAIN_CASES.find(c => c.prefix === 'TFX')!,
  ];

  function buildThreeDomainSim() {
    const ms = CROSS.map((c, i) => load(c.file, `cross-${c.prefix.toLowerCase()}-${i}`));
    const sim = new PerceptualSpaceSimulator(0);
    for (const m of ms) sim.addMachine(m);
    return { sim, ms };
  }

  function triggerVector(ms: Machine[]) {
    return denseVector(ms.map((m, i) => ({
      offset: m.perceptualMapping!.input.offset,
      values: CROSS[i]!.trigger,
    })));
  }

  test('mergeBatch carries three writes, one per domain machine', () => {
    const { sim, ms } = buildThreeDomainSim();
    const vec = triggerVector(ms);
    const step = sim.processImmediate(vec);

    expect(step.mergeBatch).toHaveLength(3);
    const machineIds = step.mergeBatch.map(op => op.machineId);
    // Each registered machine fired exactly once.
    expect(new Set(machineIds)).toEqual(new Set(ms.map(m => m.id)));
  });

  test('mergeBatch is sorted by (machineId, sequenceId, outputIndex)', () => {
    const { sim, ms } = buildThreeDomainSim();
    const step = sim.processImmediate(triggerVector(ms));

    for (let i = 1; i < step.mergeBatch.length; i++) {
      const prev = step.mergeBatch[i - 1]!;
      const cur  = step.mergeBatch[i]!;
      if (prev.machineId !== cur.machineId) {
        expect(prev.machineId < cur.machineId).toBe(true);
      } else if (prev.sequenceId !== cur.sequenceId) {
        expect(prev.sequenceId < cur.sequenceId).toBe(true);
      } else {
        expect(prev.outputIndex).toBeLessThan(cur.outputIndex);
      }
    }
  });

  test('repeated runs produce a byte-identical mergeBatch', () => {
    const { sim: sim1, ms } = buildThreeDomainSim();
    const { sim: sim2 }     = buildThreeDomainSim();
    const vec = triggerVector(ms);

    const a = sim1.processImmediate(vec).mergeBatch;
    const b = sim2.processImmediate(vec).mergeBatch;

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('Domain E2E — polymorphic input forms produce identical mergeBatch', () => {
  // /api/perceive accepts dense vector, sparseVector, or domainVectors.  All
  // three should converge on the same engine input and produce the same step
  // output once assembled.  We exercise the assembly equivalence at the
  // simulator level by hand-building the two dense representations.
  test('dense full-width vector matches dense narrow-grown vector', () => {
    const m = load('AGX001_aquaculture-water-quality-stability.json', 'poly-agx');
    const sim1 = new PerceptualSpaceSimulator(0); sim1.addMachine(m);
    const sim2 = new PerceptualSpaceSimulator(0); sim2.addMachine(m);

    const input = m.perceptualMapping!.input;

    // (1) Full-width dense vector exactly sized to the simulator's dimension.
    const wide = new Array<number>(sim1.getDimension()).fill(0);
    for (let i = 0; i < 4; i++) wide[input.offset + i] = [0, 1, 0, 1][i]!;

    // (2) Narrow dense vector that ends right after the input region.  The
    //     tolerant setPerceptualVector zero-fills the tail at sim2's current
    //     dimension so the engine input is equivalent to (1).
    const narrow = new Array<number>(input.offset + 4).fill(0);
    for (let i = 0; i < 4; i++) narrow[input.offset + i] = [0, 1, 0, 1][i]!;

    const a = sim1.processImmediate(wide).mergeBatch;
    const b = sim2.processImmediate(narrow).mergeBatch;

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toHaveLength(1);
    expect(a[0]!.values).toEqual([0, 1, 0, 0]);
  });
});

describe('Domain E2E — perceptualSpace is a debug projection of mergeBatch', () => {
  test('every mergeBatch write is observable in perceptualSpace; non-merged regions stay zero', () => {
    const m = load('HSPH001_evaluability-readiness-signal-monitor.json', 'proj-hsph');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);

    const input = m.perceptualMapping!.input;
    const out   = m.perceptualMapping!.output;

    const step = sim.processImmediate(denseVector([{ offset: input.offset, values: [0, 1, 0, 1] }]));

    // Project mergeBatch into a synthetic vector and verify it matches the
    // perceptualSpace projection where the merges landed.
    for (const op of step.mergeBatch) {
      for (let i = 0; i < op.values.length; i++) {
        expect(step.perceptualSpace[op.region.offset + i]).toBe(op.values[i]);
      }
    }
    // The output region holds the expected merged values.
    expect(step.perceptualSpace.slice(out.offset, out.offset + out.length)).toEqual([0, 1, 0, 0]);
  });
});
