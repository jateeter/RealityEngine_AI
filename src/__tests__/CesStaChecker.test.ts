/**
 * STA — Single Transition Assumption checker tests.
 *
 * Coverage:
 *   1. computeSta on FallDetection — life-safety, clean, zero violations.
 *   2. computeSta on RSFlipFlop — non-life-safety, isInitial-only, zero violations.
 *   3. Hand-crafted multi-bit-jump fixture — flagged as intra-sequence violation.
 *   4. Drift detection — declared compliant=true but graph has HD>1.
 *   5. MachineLoader.loadFromJSON without strictSta loads a violating machine.
 *   6. MachineLoader with strictSta on a life-safety violator throws StaViolationError.
 *   7. MachineLoader with strictSta on a non-life-safety violator loads fine.
 *   8. CLI report + check exit codes.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { MachineLoader } from '../services/MachineLoader.js';
import { computeSta, StaViolationError } from '../services/StaChecker.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '../..');
const MACHINES = join(ROOT, 'examples', 'machines');

function loadJson(file: string): string {
  return readFileSync(join(MACHINES, file), 'utf8');
}

/**
 * Build a deliberately STA-violating machine in memory.  The chain
 * v1 → v2 changes 2 bits at once (HD=2), which is the canonical
 * "multi-bit jump" the analyzer must flag.
 */
function makeViolatingFixture(opts: { lifeSafety: boolean }): string {
  return JSON.stringify({
    version: '1.0.0',
    machine: {
      id: opts.lifeSafety ? 'sta-violator-life-safety' : 'sta-violator-routine',
      name: opts.lifeSafety ? 'Violator (life-safety)' : 'Violator (routine)',
      arbiterRule: 'PASSTHROUGH',
      perceptualMapping: { input: { offset: 0, length: 2 }, output: { offset: 2, length: 1 } },
      metadata: {
        ...(opts.lifeSafety ? { severity: 'life-safety' } : {}),
      },
      sequences: [{
        id: 'multi-bit-jump',
        name: 'Multi-bit jump',
        vectors: [
          {
            id: 'v1', isInitial: true,
            elements: [{ value: 0, threshold: 0.5 }, { value: 0, threshold: 0.5 }],
            nextVectorIds: ['v2'],
          },
          {
            id: 'v2',
            elements: [{ value: 1, threshold: 0.5 }, { value: 1, threshold: 0.5 }],
            // both bits flip at once → HD=2 from v1
            outputVectors: [{ id: 'v2-out', vector: [1], metadata: {} }],
          },
        ],
      }],
    },
  });
}

describe('computeSta — analyzer', () => {
  test('FallDetection: life-safety, zero violations (canonical clean machine)', () => {
    const report = computeSta(loadJson('FallDetection.json'));
    expect(report.lifeSafety).toBe(true);
    expect(report.summary.intraViolations).toBe(0);
    // STA invariant: every intra-sequence HD must be ≤ 1.  HD=0 is
    // legal (state-identical under the binary projection — no-op
    // transition, the chain still advances internally) and HD=1 is the
    // canonical one-bit-change.  HD>1 is the violation we forbid.
    for (const seq of report.sequences) {
      for (const t of seq.transitions) {
        if (t.kind === 'intra' && t.hd !== null) expect(t.hd).toBeLessThanOrEqual(1);
      }
    }
  });

  test('RSFlipFlop: non-life-safety, zero violations (isInitial-only sequences)', () => {
    const report = computeSta(loadJson('RSFlipFlop.json'));
    expect(report.lifeSafety).toBe(false);
    expect(report.summary.intraViolations).toBe(0);
  });

  test('hand-crafted HD=2 jump: flagged as intra-sequence violation', () => {
    const report = computeSta(makeViolatingFixture({ lifeSafety: false }));
    expect(report.summary.intraViolations).toBe(1);
    expect(report.sequences[0]!.maxIntraHD).toBe(2);
    const offending = report.sequences[0]!.transitions.find(t => t.violation);
    expect(offending).toBeDefined();
    expect(offending!.from).toBe('v1');
    expect(offending!.to).toBe('v2');
    expect(offending!.hd).toBe(2);
  });

  test('drift detection: declared compliant=true with computed violations is flagged', () => {
    // Take the violating fixture and decorate it with a contradicting
    // hand-maintained singleTransitionAssumption block.
    const raw = JSON.parse(makeViolatingFixture({ lifeSafety: false }));
    raw.machine.metadata.singleTransitionAssumption = {
      required: true, compliant: true, scope: 'intra-sequence',
      maxHammingDistanceIntraSequence: 1,
    };
    const report = computeSta(raw);
    expect(report.summary.drift).toBeTruthy();
    expect(report.summary.drift).toMatch(/compliant=true but computed compliant=false/);
  });
});

describe('MachineLoader strictSta gate', () => {
  test('strictSta is opt-in: default loadFromJSON allows STA-violating machines', () => {
    expect(() => MachineLoader.loadFromJSON(makeViolatingFixture({ lifeSafety: true }), 'gate-default'))
      .not.toThrow();
  });

  test('strictSta + life-safety + intra-sequence HD>1 → StaViolationError', () => {
    expect(() => MachineLoader.loadFromJSON(
      makeViolatingFixture({ lifeSafety: true }), 'gate-life-safety', { strictSta: true }
    )).toThrow(StaViolationError);
  });

  test('strictSta + life-safety + clean (FallDetection) → loads fine', () => {
    expect(() => MachineLoader.loadFromJSON(loadJson('FallDetection.json'), 'gate-fd', { strictSta: true }))
      .not.toThrow();
  });

  test('strictSta + non-life-safety + violation → loads (gate is opt-in by severity)', () => {
    expect(() => MachineLoader.loadFromJSON(
      makeViolatingFixture({ lifeSafety: false }), 'gate-routine', { strictSta: true }
    )).not.toThrow();
  });

  test('StaViolationError lists every offending transition in the message', () => {
    try {
      MachineLoader.loadFromJSON(makeViolatingFixture({ lifeSafety: true }), 'gate-msg', { strictSta: true });
      fail('expected StaViolationError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(StaViolationError);
      expect(e.message).toContain('multi-bit-jump: v1 → v2');
      expect(e.message).toContain('HD=2');
    }
  });
});

describe('ces-sta-check CLI', () => {
  const SCRIPT = join(ROOT, 'scripts', 'ces-sta-check.mjs');

  test('--report --json reports machinesScanned and zero life-safety violations', () => {
    // The full corpus dump runs to ~3 MB of JSON — bump the buffer above
    // the 1 MB default.  Scope to FallDetection for the assertion-relevant
    // life-safety machine; that keeps the response tiny.
    const out = execFileSync('node',
      [SCRIPT, '--report', '--json', '--machines', 'FallDetection'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const start = out.indexOf('{');
    const report = JSON.parse(out.slice(start));
    expect(report.tool).toBe('ces-sta-check');
    expect(report.machinesScanned).toBe(1);
    expect(report.lifeSafetyViolations).toBe(0);
  });

  test('--check exits 0 because no life-safety machine violates STA', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [SCRIPT, '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) { exitCode = e.status ?? 1; }
    expect(exitCode).toBe(0);
  });

  test('--check --strict exits 1 because non-life-safety machines have STA violations', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [SCRIPT, '--check', '--strict'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) { exitCode = e.status ?? 1; }
    expect(exitCode).toBe(1);
  });
});
