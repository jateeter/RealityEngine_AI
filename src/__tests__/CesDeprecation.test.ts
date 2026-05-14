/**
 * CES versioning + deprecation — AI runtime tests.
 *
 * Verifies that:
 *   1. metadata.schemaVersion / deprecatedAt / replacedBy round-trip
 *      through MachineLoader → CriticalEventSequence → toJSON.
 *   2. The engine stamps mergeBatch entries with `deprecation` when the
 *      firing sequence carries deprecatedAt.
 *   3. ces_deprecated_fires_total bumps on each fire and renders in the
 *      Prometheus exposition.
 *   4. console.warn is emitted on fire (developer breadcrumb).
 *   5. The ces-deprecation validator surfaces the demo machine and
 *      enforces the --max-age-days CI gate.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '../..');
const MACHINES = join(ROOT, 'examples', 'machines');
const FIXTURE = 'RSFlipFlopDeprecatedDemo.json';

function loadFixture(id = 'dep-demo') {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, FIXTURE), 'utf8'), id);
}

function dense(offset: number, values: number[]): number[] {
  const v = new Array<number>(offset + values.length).fill(0);
  for (let i = 0; i < values.length; i++) v[offset + i] = values[i]!;
  return v;
}

describe('CES versioning + deprecation', () => {
  test('MachineLoader propagates schemaVersion / deprecatedAt / replacedBy', () => {
    const m = loadFixture();
    const reset = m.getSequence('rs-reset-sequence');
    const setSeq = m.getSequence('rs-set-sequence');
    expect(reset).toBeDefined();
    expect(reset!.schemaVersion).toBe('1.0.0');
    expect(reset!.deprecatedAt).toBe('2026-02-01');
    expect(reset!.replacedBy).toBe('rs-set-sequence');
    expect(reset!.isDeprecated()).toBe(true);
    expect(reset!.daysSinceDeprecation()).toBeGreaterThan(0);
    // The replacement sequence is NOT deprecated.
    expect(setSeq!.isDeprecated()).toBe(false);
    expect(setSeq!.schemaVersion).toBe('1.0.0');
  });

  test('engine stamps deprecation on mergeBatch when a deprecated sequence fires', () => {
    const m = loadFixture('dep-stamp');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    // RESET input [0,1] → fires the (deprecated) rs-reset-sequence.
    const origWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => { warnings.push(args.join(' ')); };
    try {
      const step = sim.processImmediate(dense(input.offset, [0, 1]));
      const fired = step.mergeBatch.find(op => op.sequenceId === 'rs-reset-sequence');
      expect(fired).toBeDefined();
      expect(fired!.deprecation).toBeDefined();
      expect(fired!.deprecation!.since).toBe('2026-02-01');
      expect(fired!.deprecation!.replacedBy).toBe('rs-set-sequence');
      expect(fired!.deprecation!.ageDays).toBeGreaterThan(0);
      // A developer-facing warning logged exactly once.
      expect(warnings.some(w => w.includes('rs-reset-sequence') && w.includes('deprecated'))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  test('non-deprecated sequence fires carry no deprecation stamp', () => {
    const m = loadFixture('dep-set');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;
    const step = sim.processImmediate(dense(input.offset, [1, 0]));
    const set = step.mergeBatch.find(op => op.sequenceId === 'rs-set-sequence');
    expect(set).toBeDefined();
    expect(set!.deprecation).toBeUndefined();
  });

  test('ces_deprecated_fires_total renders in the Prometheus exposition', () => {
    const m = loadFixture('dep-prom');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    const origWarn = console.warn; console.warn = () => {};
    try {
      sim.processImmediate(dense(input.offset, [0, 1]));
      sim.processImmediate(dense(input.offset, [0, 1]));
      const prom = sim.getCesCoverage().toPrometheusText([m]);
      expect(prom).toContain('# TYPE ces_deprecated_fires_total counter');
      expect(prom).toMatch(
        /ces_deprecated_fires_total\{[^}]*machine_id="dep-prom"[^}]*sequence="rs-reset-sequence"[^}]*replaced_by="rs-set-sequence"[^}]*\} 2/
      );
    } finally { console.warn = origWarn; }
  });
});

describe('ces-deprecation CLI', () => {
  test('--list --json reports the demo deprecation', () => {
    const out = execFileSync('node', [
      join(ROOT, 'scripts', 'ces-deprecation.mjs'), '--list', '--json',
    ], { encoding: 'utf8' });
    const report = JSON.parse(out);
    expect(report.tool).toBe('ces-deprecation');
    expect(report.deprecatedCount).toBeGreaterThanOrEqual(1);
    const entry = report.deprecated.find((d: any) => d.file === FIXTURE);
    expect(entry).toBeDefined();
    expect(entry.sequenceId).toBe('rs-reset-sequence');
    expect(entry.replacedBy).toBe('rs-set-sequence');
  });

  test('--check --max-age-days 1 fails because the demo seq is older', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [
        join(ROOT, 'scripts', 'ces-deprecation.mjs'), '--check', '--max-age-days', '1',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) { exitCode = e.status ?? 1; }
    expect(exitCode).toBe(1);
  });

  test('--check --max-age-days 36500 (~100 years) passes', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [
        join(ROOT, 'scripts', 'ces-deprecation.mjs'), '--check', '--max-age-days', '36500',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) { exitCode = e.status ?? 1; }
    expect(exitCode).toBe(0);
  });
});
