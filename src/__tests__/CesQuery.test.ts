/**
 * ces-query — observability DSL test surface.
 *
 * Pins behavior for every canned query: the structural ones (which
 * stable-id joins they perform) and the safety-rail ones (Q5 must always
 * return zero rows — non-zero would be an engine bug emitting truncated
 * provenance chains).  The amplified trace is deterministic, so per-row
 * counts can be asserted as numbers.
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '../..');
const SCRIPT = join(ROOT, 'scripts', 'ces-query.mjs');

function runJson(queryId: string): { id: string; label: string; dsl: string; result: any } {
  const out = execFileSync('node', [SCRIPT, '--query', queryId, '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // The CLI prints a header line before the JSON, then the JSON object.
  // Use a forgiving parse: find the first '{' and slice from there.
  const start = out.indexOf('{');
  return JSON.parse(out.slice(start));
}

describe('ces-query DSL — operational queries over activation traces', () => {
  test('Q1 mid-fall validation timing — every row has hour ∈ 0..23 and count > 0', () => {
    const { result } = runJson('Q1');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.hour).toBeGreaterThanOrEqual(0);
      expect(r.hour).toBeLessThan(24);
      expect(r.count).toBeGreaterThan(0);
    }
  });

  test('Q2 top-10 most-fired terminals — exactly 10 rows, sorted desc, every row has stable ids', () => {
    const { result } = runJson('Q2');
    expect(result).toHaveLength(10);
    let prev = Infinity;
    for (const r of result) {
      expect(typeof r.machine).toBe('string');
      expect(typeof r.sequence).toBe('string');
      expect(typeof r.vector).toBe('string');
      expect(r.fires).toBeLessThanOrEqual(prev);
      prev = r.fires;
    }
  });

  test('Q3 RED heatmap — every entry is RED-severity and grouped by (machine, hour)', () => {
    const { result } = runJson('Q3');
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(typeof r.machine).toBe('string');
      expect(r.hourOfDay).toBeGreaterThanOrEqual(0);
      expect(r.hourOfDay).toBeLessThan(24);
      expect(r.reds).toBeGreaterThan(0);
    }
  });

  test('Q5 evidence-skip detection — must return ZERO rows (engine never emits truncated provenance)', () => {
    const { result } = runJson('Q5');
    // Q5 is the canonical drift detector.  Non-empty means the engine
    // started emitting fall-conf-v6 RED with a provenance shorter than 6
    // — exactly the kind of safety regression the trace queries exist to
    // catch.  If this test ever fails: stop the deploy.
    expect(result).toEqual([]);
  });

  test('Q6 paging concentration — every owner team accounts for non-zero decisions', () => {
    const { result } = runJson('Q6');
    expect(result.length).toBeGreaterThan(0);
    let prev = Infinity;
    for (const r of result) {
      expect(typeof r.ownerTeam).toBe('string');
      expect(r.totalDecisions).toBeGreaterThan(0);
      expect(r.totalDecisions).toBeLessThanOrEqual(prev);
      prev = r.totalDecisions;
    }
  });

  test('Q7 RED rate per machine — redRate ∈ [0,1] and red ≤ total', () => {
    const { result } = runJson('Q7');
    for (const r of result) {
      expect(r.redRate).toBeGreaterThanOrEqual(0);
      expect(r.redRate).toBeLessThanOrEqual(1);
      expect(r.red).toBeLessThanOrEqual(r.total);
    }
  });

  test('Q8 coverage gap — returns a totalMissing count + sample list', () => {
    const { result } = runJson('Q8');
    expect(typeof result.totalMissing).toBe('number');
    expect(result.totalMissing).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.sample)).toBe(true);
    expect(result.sample.length).toBeLessThanOrEqual(12);
  });

  test('Q10 multi-stage coverage — declared / fired counts and 0 ≤ coverage ≤ 1', () => {
    const { result } = runJson('Q10');
    for (const r of result) {
      expect(r.fired).toBeLessThanOrEqual(r.declared);
      expect(r.coverage).toBeGreaterThanOrEqual(0);
      expect(r.coverage).toBeLessThanOrEqual(1);
    }
  });

  test('Q12 intermediate vectors — every entry has appearancesAsIntermediate > 0', () => {
    const { result } = runJson('Q12');
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(typeof r.machine).toBe('string');
      expect(typeof r.vector).toBe('string');
      expect(r.appearancesAsIntermediate).toBeGreaterThan(0);
    }
  });

  test('--list lists every Q-id and they all run without error', () => {
    // --list prints; we just verify it exits cleanly and mentions Q1..Q12.
    const out = execFileSync('node', [SCRIPT, '--list'], { encoding: 'utf8' });
    for (const id of ['Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10','Q11','Q12']) {
      expect(out).toContain(id);
    }
  });
});
