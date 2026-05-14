/**
 * ces-diff tool — verification.
 *
 * Each test mutates a copy of a fixture machine JSON, invokes the
 * scripts/ces-diff.mjs CLI against the original and the mutated copy,
 * and asserts that the reported diff catches the change kind we made.
 *
 * The test exercises the public CLI surface (not the internal helpers)
 * so a future refactor of the script stays caught.
 */

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '../..');
const SCRIPT = join(ROOT, 'scripts', 'ces-diff.mjs');
const MACHINES = join(ROOT, 'examples', 'machines');
const ORACLES = join(ROOT, 'examples', 'oracles.json');

interface DiffReport {
  tool: string;
  risk: { level: 'low' | 'medium' | 'high'; advisories: string[] };
  summary: {
    sequencesAdded: number; sequencesRemoved: number; sequencesModified: number;
    vectorsAdded: number; vectorsRemoved: number; vectorsModified: number;
    perceptualMappingChanged: boolean; composeChanged: boolean;
  };
  structural: any;
  behavioral: { deltas: any[]; oraclesConsidered: number };
  oracleMigration?: { updated: number; removed: number; file: string };
}

function runDiff(leftPath: string, rightPath: string, extraArgs: string[] = []): { report: DiffReport; exitCode: number } {
  let stdout: string;
  let exitCode = 0;
  try {
    stdout = execFileSync('node', [SCRIPT, '--left', leftPath, '--right', rightPath, '--json', ...extraArgs],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e: any) {
    stdout = e.stdout?.toString() ?? '';
    exitCode = e.status ?? 1;
  }
  return { report: JSON.parse(stdout), exitCode };
}

let workDir: string;
let originalMachine: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'ces-diff-test-'));
});
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function mutateFallDetection(mutate: (m: any) => void): string {
  // Copy + mutate FallDetection into a fresh path so each test is isolated.
  const src = readFileSync(join(MACHINES, 'FallDetection.json'), 'utf8');
  const obj = JSON.parse(src);
  mutate(obj);
  const path = join(workDir, `FallDetection.${Math.random().toString(36).slice(2, 8)}.json`);
  writeFileSync(path, JSON.stringify(obj, null, 2));
  return path;
}

function findVector(machine: any, sequenceId: string, vectorId: string) {
  const seq = machine.machine.sequences.find((s: any) => s.id === sequenceId);
  return seq.vectors.find((v: any) => v.id === vectorId);
}

describe('ces-diff CLI', () => {
  test('identity diff reports no structural or behavioral changes', () => {
    const orig = join(MACHINES, 'FallDetection.json');
    const { report, exitCode } = runDiff(orig, orig);
    expect(exitCode).toBe(0);
    expect(report.summary.sequencesModified).toBe(0);
    expect(report.summary.vectorsModified).toBe(0);
    expect(report.behavioral.deltas).toEqual([]);
    expect(report.risk.level).toBe('low');
  });

  test('output-value change is HIGH risk with values-changed delta', () => {
    const mutated = mutateFallDetection(m => {
      const v = findVector(m, 'fall-slow-collapse', 'fall-slow-v3');
      v.outputVectors[0].vector = [4, 4];   // was [4, 2]
    });
    const { report, exitCode } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);

    expect(exitCode).toBe(1);   // unmigrated delta => non-zero exit
    expect(report.risk.level).toBe('high');
    expect(report.summary.vectorsModified).toBe(1);
    expect(report.behavioral.deltas).toHaveLength(1);
    expect(report.behavioral.deltas[0]).toMatchObject({
      sequenceId: 'fall-slow-collapse',
      vectorId: 'fall-slow-v3',
      changeKind: 'values-changed',
      before: { values: [4, 2] },
      after:  { values: [4, 4] },
    });
  });

  test('element/threshold mutation is HIGH risk (matching rule changed)', () => {
    const mutated = mutateFallDetection(m => {
      const v = findVector(m, 'fall-slow-collapse', 'fall-slow-v1');
      v.elements[0].threshold = 0.7;     // was 0.5
    });
    const { report } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);
    expect(report.risk.level).toBe('high');
    expect(report.risk.advisories.some(a => a.includes('matching elements changed'))).toBe(true);
  });

  test('nextVectorIds change is MEDIUM risk (transition graph altered)', () => {
    const mutated = mutateFallDetection(m => {
      const v = findVector(m, 'fall-slow-collapse', 'fall-slow-v1');
      v.nextVectorIds = ['fall-slow-v3'];   // skip v2
    });
    const { report } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);
    expect(['medium', 'high']).toContain(report.risk.level);
    expect(report.risk.advisories.some(a => a.includes('nextVectorIds changed'))).toBe(true);
  });

  test('sequence removal is HIGH risk', () => {
    const mutated = mutateFallDetection(m => {
      m.machine.sequences = m.machine.sequences.filter((s: any) => s.id !== 'fall-slow-collapse');
    });
    const { report } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);
    expect(report.risk.level).toBe('high');
    expect(report.summary.sequencesRemoved).toBe(1);
    expect(report.risk.advisories.some(a => a.includes('Sequence fall-slow-collapse removed'))).toBe(true);
  });

  test('perceptualMapping change is HIGH risk', () => {
    const mutated = mutateFallDetection(m => {
      m.machine.perceptualMapping.input.offset += 100;
    });
    const { report } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);
    expect(report.risk.level).toBe('high');
    expect(report.summary.perceptualMappingChanged).toBe(true);
    expect(report.risk.advisories.some(a => a.includes('perceptualMapping changed'))).toBe(true);
  });

  test('cosmetic name change is LOW risk and produces no behavioral deltas', () => {
    const mutated = mutateFallDetection(m => {
      m.machine.name = m.machine.name + ' (renamed)';
    });
    const { report, exitCode } = runDiff(join(MACHINES, 'FallDetection.json'), mutated);
    expect(exitCode).toBe(0);
    expect(report.risk.level).toBe('low');
    expect(report.summary.sequencesModified).toBe(0);
    expect(report.behavioral.deltas).toEqual([]);
  });

  test('--apply-oracle-updates without --i-understand-the-risk refuses to migrate', () => {
    const mutated = mutateFallDetection(m => {
      const v = findVector(m, 'fall-slow-collapse', 'fall-slow-v3');
      v.outputVectors[0].vector = [4, 4];
    });
    // Use spawnSync to inspect exitCode for the gate failure.
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node', [SCRIPT, '--left', join(MACHINES, 'FallDetection.json'),
                            '--right', mutated, '--json', '--apply-oracle-updates'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      exitCode = e.status ?? 0;
      stderr = e.stderr?.toString() ?? '';
    }
    expect(exitCode).toBe(2);
    expect(stderr).toContain('--i-understand-the-risk');
  });

  test('--apply-oracle-updates with acknowledgement migrates and exits 0', () => {
    // Snapshot, mutate, run with --apply-oracle-updates, then restore.
    const oracleSnap = readFileSync(ORACLES, 'utf8');
    try {
      const mutated = mutateFallDetection(m => {
        const v = findVector(m, 'fall-slow-collapse', 'fall-slow-v3');
        v.outputVectors[0].vector = [4, 7];
      });
      const { report, exitCode } = runDiff(join(MACHINES, 'FallDetection.json'), mutated,
        ['--apply-oracle-updates', '--i-understand-the-risk']);
      expect(exitCode).toBe(0);
      expect(report.oracleMigration?.updated).toBe(1);

      // The oracle file should now reflect the new expected.values.
      const updated = JSON.parse(readFileSync(ORACLES, 'utf8'));
      const o = updated.oracles.find((x: any) =>
        x.id.startsWith('FallDetection.json::fall-slow-collapse::fall-slow-v3'));
      expect(o.expected.values).toEqual([4, 7]);
    } finally {
      writeFileSync(ORACLES, oracleSnap);
    }
  });
});
