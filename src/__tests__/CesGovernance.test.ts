/**
 * CES governance — paging contract tests.
 *
 * The CES JSON declares ownerTeam / SLA / runbook / escalation policy.
 * The engine stamps the resolved decision onto every mergeBatch entry
 * whose values match a triggerConfig rule.  These tests verify the
 * resolution rules across the three precedence layers:
 *
 *   rule-level override  >  machine-level governance  >  unrouted fallback
 *
 * Plus a smoke test on /api/governance/route (via in-process router
 * invocation) and a validator regression to confirm machines without
 * governance are flagged but a machine with governance passes.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import { resolveForOutput, validateMachineGovernance } from '../services/GovernanceResolver.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '../..');
const MACHINES = join(ROOT, 'examples', 'machines');

function loadFallDetection(id = 'gov-fd'): ReturnType<typeof MachineLoader.loadFromJSON> {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, 'FallDetection.json'), 'utf8'), id);
}

function loadRSFlipFlop(id = 'gov-rsff'): ReturnType<typeof MachineLoader.loadFromJSON> {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, 'RSFlipFlop.json'), 'utf8'), id);
}

function dense(offset: number, values: number[]): number[] {
  const v = new Array<number>(offset + values.length).fill(0);
  for (let i = 0; i < values.length; i++) v[offset + i] = values[i]!;
  return v;
}

describe('CES governance resolver', () => {
  test('rule-level override wins for fall-confirmed RED', () => {
    const m = loadFallDetection();
    const decision = resolveForOutput(m, 'fall-confirmed', [4, 3]);
    expect(decision).not.toBeNull();
    expect(decision!.ragStatusCode).toBe('RED');
    expect(decision!.processStatus).toBe('error');
    // rule-with-override pulled the tier-1 team + 30s SLA + deep-linked runbook
    expect(decision!.ownerTeam).toBe('patient-safety-on-call-tier-1');
    expect(decision!.slaSeconds).toBe(30);
    expect(decision!.runbook).toBe('https://runbooks.example.org/patient-safety/fall-detection#confirmed-red');
    expect(decision!.source).toBe('rule-with-override');
    // Machine-level escalationPolicy still flows through (rule didn't override it).
    expect(decision!.escalationPolicy).toBe('pagerduty:patient-safety-tier-1');
    expect(decision!.hasMachineGovernance).toBe(true);
  });

  test('rule-level partial override merges with machine defaults', () => {
    const m = loadFallDetection();
    // fall-slow-collapse has a rule override that sets slaSeconds + runbook
    // but NOT ownerTeam — the machine-level patient-safety-on-call should
    // still be the resolved team.
    const decision = resolveForOutput(m, 'fall-slow-collapse', [4, 2]);
    expect(decision).not.toBeNull();
    expect(decision!.slaSeconds).toBe(45);
    expect(decision!.runbook).toBe('https://runbooks.example.org/patient-safety/fall-detection#slow-collapse');
    expect(decision!.ownerTeam).toBe('patient-safety-on-call');   // inherited
    expect(decision!.source).toBe('rule-with-override');
  });

  test('rule with no override falls back to machine-level SLA by processStatus', () => {
    const m = loadFallDetection();
    // fall-sustained-instability is a "warning" — should pick up the
    // machine's sla.warning = 1800.
    const decision = resolveForOutput(m, 'fall-sustained-instability', [2, 2]);
    expect(decision).not.toBeNull();
    expect(decision!.processStatus).toBe('warning');
    expect(decision!.slaSeconds).toBe(1800);
    expect(decision!.ownerTeam).toBe('patient-safety-on-call');
    expect(decision!.source).toBe('rule-only');
  });

  test('values that do not match any rule produce null', () => {
    const m = loadFallDetection();
    expect(resolveForOutput(m, 'fall-confirmed', [9, 9])).toBeNull();
    expect(resolveForOutput(m, 'nonexistent-seq', [4, 3])).toBeNull();
  });

  test('machines with no governance block resolve to "unrouted"', () => {
    // The corpus is now fully backfilled with governance metadata, so we
    // construct a machine in-memory that mirrors the legacy "trigger rules
    // but no governance" shape to exercise the machine-fallback path.
    const m = MachineLoader.loadFromJSON(JSON.stringify({
      version: '1.0.0',
      machine: {
        id: 'machine-no-governance',
        name: 'No Governance Probe',
        arbiterRule: 'PASSTHROUGH',
        perceptualMapping: { input: { offset: 0, length: 1 }, output: { offset: 1, length: 1 } },
        metadata: {
          triggerConfig: {
            rules: [{
              sequenceId: 'probe-seq',
              outputMatches: [1],
              ragStatusCode: 'GREEN',
              processStatus: 'info',
              description: 'probe',
            }],
          },
        },
        sequences: [{
          id: 'probe-seq',
          name: 'Probe',
          vectors: [{
            id: 'probe-v',
            isInitial: true,
            elements: [{ value: 1, threshold: 0.5 }],
            outputVectors: [{ id: 'probe-out', vector: [1], metadata: {} }],
          }],
        }],
      },
    }), 'machine-no-governance');

    const decision = resolveForOutput(m, 'probe-seq', [1]);
    expect(decision).not.toBeNull();
    expect(decision!.hasMachineGovernance).toBe(false);
    expect(decision!.ownerTeam).toBe('unrouted');
    expect(decision!.source).toBe('machine-fallback');
  });
});

describe('CES governance — mergeBatch stamping', () => {
  test('the engine stamps governance onto every mergeBatch entry that matches a rule', () => {
    const m = loadFallDetection();
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    // Drive fall-nominal: input [0,0] → output [0,3], RAG=GREEN, processStatus=ok.
    const step = sim.processImmediate(dense(input.offset, [0, 0]));
    const nominal = step.mergeBatch.find(op => op.sequenceId === 'fall-nominal');
    expect(nominal).toBeDefined();
    expect(nominal!.governance).toBeDefined();
    expect(nominal!.governance!.ragStatusCode).toBe('GREEN');
    expect(nominal!.governance!.processStatus).toBe('ok');
    // ok severity → slaSeconds null per the machine SLA table.
    expect(nominal!.governance!.slaSeconds).toBeNull();
  });

  test('confirmed RED falls carry the tier-1 paging contract on mergeBatch', () => {
    const m = loadFallDetection();
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    // 6-step fall-confirmed chain.
    for (const v of [[1,0],[2,0],[3,0],[3,1],[3,2],[3,3]]) sim.processImmediate(dense(input.offset, v));

    const last = sim.processImmediate(dense(input.offset, [3, 3]));
    const red = last.mergeBatch.find(op =>
      op.sequenceId === 'fall-confirmed' &&
      op.values[0] === 4 && op.values[1] === 3
    );
    expect(red).toBeDefined();
    expect(red!.governance).toMatchObject({
      ragStatusCode: 'RED',
      processStatus: 'error',
      ownerTeam: 'patient-safety-on-call-tier-1',
      slaSeconds: 30,
      runbook: 'https://runbooks.example.org/patient-safety/fall-detection#confirmed-red',
      source: 'rule-with-override',
    });
  });

  test('coverage registry records paging decisions per (team, status, rag)', () => {
    const m = loadFallDetection();
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const input = m.perceptualMapping!.input;

    // One nominal step → one paging decision recorded.
    sim.processImmediate(dense(input.offset, [0, 0]));
    const prom = sim.getCesCoverage().toPrometheusText([m]);
    expect(prom).toContain('# TYPE ces_paging_decisions_total counter');
    expect(prom).toMatch(/ces_paging_decisions_total\{[^}]*owner_team="patient-safety-on-call"[^}]*process_status="ok"[^}]*rag_status_code="GREEN"[^}]*\} 1/);
  });

  test('machines whose fired values do not match any rule have no governance stamp', () => {
    // RSFlipFlop now carries triggerConfig.rules from the backfill, so its
    // SET output ([1,0]) DOES match a rule and stamps governance.  To exercise
    // the "no rule matches" branch we construct an in-memory machine whose
    // triggerConfig.rules deliberately don't cover the fired output.
    const m = MachineLoader.loadFromJSON(JSON.stringify({
      version: '1.0.0',
      machine: {
        id: 'machine-noop-rules',
        name: 'No-match probe',
        arbiterRule: 'PASSTHROUGH',
        perceptualMapping: { input: { offset: 0, length: 1 }, output: { offset: 1, length: 2 } },
        metadata: {
          governance: {
            schemaVersion: '1.0.0',
            ownerTeam: 'probe-team',
            sla: { ok: null, info: null, warning: null, error: null },
          },
          triggerConfig: {
            // Rule targets a different vector — the fired output won't match.
            rules: [{
              sequenceId: 'probe-seq', outputMatches: [9, 9],
              ragStatusCode: 'RED', processStatus: 'error', description: 'never fires',
            }],
          },
        },
        sequences: [{
          id: 'probe-seq', name: 'Probe',
          vectors: [{
            id: 'probe-v', isInitial: true,
            elements: [{ value: 1, threshold: 0.5 }],
            outputVectors: [{ id: 'probe-out', vector: [1, 0], metadata: {} }],
          }],
        }],
      },
    }), 'machine-noop-rules');

    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(m);
    const step = sim.processImmediate([1]);
    const fired = step.mergeBatch.find(op => op.sequenceId === 'probe-seq');
    expect(fired).toBeDefined();
    expect(fired!.governance).toBeUndefined();   // no rule matched → no stamp
  });
});

describe('validateMachineGovernance', () => {
  test('FallDetection passes validation cleanly', () => {
    const m = loadFallDetection();
    const issues = validateMachineGovernance(m);
    // We expect zero errors and zero warnings — every rule has processStatus,
    // the runbook is a URL, SLA values are in range.
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
    expect(issues.filter(i => i.severity === 'warning')).toEqual([]);
  });

  test('flags machines with trigger rules but no governance block', () => {
    // Corpus is fully backfilled, so we construct the legacy shape in memory
    // to confirm the validator still catches it on any future regression.
    const m = MachineLoader.loadFromJSON(JSON.stringify({
      version: '1.0.0',
      machine: {
        id: 'machine-legacy-rules',
        name: 'Legacy rules only',
        arbiterRule: 'PASSTHROUGH',
        perceptualMapping: { input: { offset: 0, length: 1 }, output: { offset: 1, length: 1 } },
        metadata: {
          triggerConfig: {
            rules: [{ sequenceId: 'legacy', outputMatches: [1], ragStatusCode: 'GREEN', processStatus: 'info' }],
          },
        },
        sequences: [{
          id: 'legacy', name: 'Legacy',
          vectors: [{ id: 'legacy-v', isInitial: true, elements: [{ value: 1, threshold: 0.5 }],
                       outputVectors: [{ id: 'legacy-out', vector: [1], metadata: {} }] }],
        }],
      },
    }), 'machine-legacy-rules');
    const issues = validateMachineGovernance(m);
    expect(issues.some(i => i.kind === 'missing-governance')).toBe(true);
  });
});

describe('ces-governance CLI', () => {
  test('--validate --json reports machinesScanned and machinesWithGovernance', () => {
    const out = execFileSync('node', [
      join(ROOT, 'scripts', 'ces-governance.mjs'),
      '--validate', '--json',
    ], { encoding: 'utf8' });
    const report = JSON.parse(out);
    expect(report.tool).toBe('ces-governance');
    expect(report.machinesScanned).toBeGreaterThan(0);
    expect(report.machinesWithGovernance).toBeGreaterThanOrEqual(1);   // at least FallDetection
    expect(report.machinesWithTriggerRules).toBeGreaterThanOrEqual(1);
  });

  test('--check exits 0 when there are no errors', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [join(ROOT, 'scripts', 'ces-governance.mjs'), '--check'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    // Current corpus has warnings (missing-governance on 5 machines) but
    // zero errors, so --check without --include-warnings should be 0.
    expect(exitCode).toBe(0);
  });

  test('--check --include-warnings exits 0 once the corpus is fully backfilled', () => {
    // After scripts/backfill-governance.mjs has populated every machine,
    // the strict gate (errors + warnings) must pass.  This test is the
    // CI tripwire — if a new machine sneaks in without governance, this
    // exits 1 and merge is blocked.
    let exitCode = 0;
    try {
      execFileSync('node', [join(ROOT, 'scripts', 'ces-governance.mjs'), '--check', '--include-warnings'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).toBe(0);
  });
});
