/**
 * cesgen verification — keeps the generated TypeScript stubs in sync with the
 * source-of-truth machine JSON.
 *
 * For every machine that has a generated module (re-exported from
 * `src/generated/machines/index.ts`), this test:
 *
 *   1. Re-loads the corresponding JSON via MachineLoader.
 *   2. Asserts the generated `perceptualMapping`, dimension constants,
 *      machineId / machineName / machineSlug all match the JSON.
 *   3. Asserts every vector ID present in the JSON appears in the generated
 *      `StateId` map and vice versa.
 *   4. Asserts every sequence ID is present in the generated `SequenceId`
 *      and that `initialStates` matches each sequence's isInitial vectors.
 *   5. Asserts `transitions[v]` matches `nextVectorIds` for every vector.
 *   6. Asserts `outputs[v]` matches the JSON's outputVector arrays.
 *
 * If any test fails, regenerate with:
 *
 *   node scripts/cesgen.mjs --all              # or --names / --domains
 *
 * The cesgen `--check` mode is the CI gate; this Jest test is the
 * semantic gate.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { machines } from '../generated/machines/index.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES_DIR = join(dirname(__filename), '../../examples/machines');

function loadRaw(slug: string): any {
  const file = join(MACHINES_DIR, `${slug}.json`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('cesgen — generated stubs match source JSON', () => {
  const slugs = Object.keys(machines).sort();

  // Sanity: the index must export at least the named test machines and the
  // single representative we generated per domain prefix.
  test('registry exposes every generated machine', () => {
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs).toContain('RSFlipFlop');
    expect(slugs).toContain('MultiStep');
    expect(slugs).toContain('RS2');
  });

  test.each(slugs)('%s — header constants match JSON', (slug) => {
    const gen = (machines as any)[slug];
    const raw = loadRaw(slug).machine ?? loadRaw(slug);
    expect(gen.machineSlug).toBe(slug);
    expect(gen.machineName).toBe(raw.name);
    if (raw.id) expect(gen.machineId).toBe(raw.id);
    expect(gen.perceptualMapping.input.offset).toBe(raw.perceptualMapping.input.offset);
    expect(gen.perceptualMapping.input.length).toBe(raw.perceptualMapping.input.length);
    expect(gen.perceptualMapping.output.offset).toBe(raw.perceptualMapping.output.offset);
    expect(gen.perceptualMapping.output.length).toBe(raw.perceptualMapping.output.length);
    expect(gen.inputDim).toBe(raw.perceptualMapping.input.length);
    expect(gen.outputDim).toBe(raw.perceptualMapping.output.length);
  });

  test.each(slugs)('%s — state and sequence IDs are exhaustive', (slug) => {
    const gen = (machines as any)[slug];
    const raw = loadRaw(slug).machine ?? loadRaw(slug);

    const jsonStateIds = new Set<string>();
    const jsonSeqIds   = new Set<string>();
    for (const s of raw.sequences) {
      jsonSeqIds.add(s.id);
      for (const v of s.vectors) jsonStateIds.add(v.id);
    }
    const genStateIds = new Set<string>(Object.values(gen.StateId));
    const genSeqIds   = new Set<string>(Object.values(gen.SequenceId));

    expect(genStateIds).toEqual(jsonStateIds);
    expect(genSeqIds).toEqual(jsonSeqIds);
  });

  test.each(slugs)('%s — initialStates per sequence match JSON', (slug) => {
    const gen = (machines as any)[slug];
    const raw = loadRaw(slug).machine ?? loadRaw(slug);
    for (const s of raw.sequences) {
      const jsonInitial = s.vectors.filter((v: any) => v.isInitial).map((v: any) => v.id).sort();
      const genInitial  = ([...gen.initialStates[s.id]] as string[]).sort();
      expect(genInitial).toEqual(jsonInitial);
    }
  });

  test.each(slugs)('%s — transitions and outputs match JSON', (slug) => {
    const gen = (machines as any)[slug];
    const raw = loadRaw(slug).machine ?? loadRaw(slug);
    for (const s of raw.sequences) {
      for (const v of s.vectors) {
        const expectedNext = (v.nextVectorIds ?? []).slice().sort();
        const actualNext   = ([...gen.transitions[v.id]] as string[]).slice().sort();
        expect(actualNext).toEqual(expectedNext);

        const expectedOuts = (v.outputVectors ?? []).map((o: any) => o.vector ?? []);
        const actualOuts   = (gen.outputs[v.id] as ReadonlyArray<ReadonlyArray<number>>).map(a => [...a]);
        expect(actualOuts).toEqual(expectedOuts);
      }
    }
  });

  test('generator engine integration — the generated mapping registers cleanly with the simulator', async () => {
    // Spot-check that the generated perceptualMapping matches what the
    // engine actually allocates for a real machine.  If the generator
    // drifted, addMachine would auto-grow to a different dimension than
    // the generated stub claims.
    const { PerceptualSpaceSimulator } = await import('../engine/PerceptualSpaceSimulator.js');
    const sim = new PerceptualSpaceSimulator(0);
    const m = MachineLoader.loadFromJSON(readFileSync(join(MACHINES_DIR, 'RSFlipFlop.json'), 'utf8'), 'cesgen-verify');
    sim.addMachine(m);

    const gen = (machines as any)['RSFlipFlop'];
    expect(sim.getRequiredDimension()).toBe(Math.max(
      gen.perceptualMapping.input.offset  + gen.perceptualMapping.input.length,
      gen.perceptualMapping.output.offset + gen.perceptualMapping.output.length,
    ));
  });
});
