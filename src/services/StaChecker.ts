/**
 * StaChecker — TypeScript twin of scripts/ces-sta-check.mjs.
 *
 * Both implementations operate on the raw machine JSON (not the loaded
 * Machine class) so the analyzer can run before MachineLoader hands the
 * object to the engine.  That ordering matters: MachineLoader.loadFromJSON
 * gates on STA when the machine is tagged `severity: "life-safety"` —
 * a violating machine is refused before any vector instance exists.
 *
 * `computeSta(rawJsonOrObj)` returns the same structured report the CLI
 * emits in --json mode, so a regression in either side is byte-comparable.
 */

const DEFAULT_THRESHOLD = 0.5;

export interface StaTransition {
  from: string;
  to: string;
  kind: 'intra' | 'inter-sequence' | 'dangling';
  hd: number | null;
  fromState?: number[];
  toState?:   number[];
  targetSequenceId?: string;
  violation?: boolean;
  error?:     string;
}

export interface StaSequenceReport {
  id: string;
  name?: string;
  transitions: StaTransition[];
  maxIntraHD: number;
  anyViolation: boolean;
}

export interface StaReport {
  machineId:   string | null;
  machineName: string | null;
  lifeSafety:  boolean;
  declared:    Record<string, unknown> | null;
  sequences:   StaSequenceReport[];
  summary:     { intraViolations: number; interJumps: number; drift: string | null };
}

function elementState(el: { value?: number; threshold?: number } | undefined): number {
  const t = typeof el?.threshold === 'number' ? el.threshold : DEFAULT_THRESHOLD;
  return (el?.value ?? 0) >= t ? 1 : 0;
}

function vectorState(v: { elements?: any[] }): number[] {
  return (v.elements ?? []).map(elementState);
}

function hammingDistance(a: number[], b: number[]): number | null {
  if (a.length !== b.length) return null;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function computeSta(rawJsonOrObj: string | object): StaReport {
  const obj: any = typeof rawJsonOrObj === 'string' ? JSON.parse(rawJsonOrObj) : rawJsonOrObj;
  const m: any = obj.machine ?? obj;
  const md = m.metadata ?? {};
  const lifeSafety = md.severity === 'life-safety';
  const declared = md.singleTransitionAssumption ?? null;

  const indexByVector = new Map<string, { sequenceId: string; vector: any }>();
  for (const seq of m.sequences ?? []) {
    for (const v of seq.vectors ?? []) indexByVector.set(v.id, { sequenceId: seq.id, vector: v });
  }

  const sequences: StaSequenceReport[] = [];
  let intraViolations = 0;
  let interJumps = 0;

  for (const seq of m.sequences ?? []) {
    const localByVector = new Map<string, any>();
    for (const v of seq.vectors ?? []) localByVector.set(v.id, v);

    const transitions: StaTransition[] = [];
    let maxIntra = 0;
    let anyViolation = false;

    for (const v of seq.vectors ?? []) {
      const fromState = vectorState(v);
      for (const nextId of v.nextVectorIds ?? []) {
        const local = localByVector.get(nextId);
        if (local) {
          const toState = vectorState(local);
          const hd = hammingDistance(fromState, toState);
          if (hd === null) {
            transitions.push({ from: v.id, to: nextId, kind: 'intra', hd: null, error: 'element-count-mismatch' });
            anyViolation = true; intraViolations++; continue;
          }
          maxIntra = Math.max(maxIntra, hd);
          const t: StaTransition = { from: v.id, to: nextId, kind: 'intra', hd, fromState, toState };
          if (hd > 1) { t.violation = true; anyViolation = true; intraViolations++; }
          transitions.push(t);
        } else {
          const found = indexByVector.get(nextId);
          if (found) {
            const hd = hammingDistance(fromState, vectorState(found.vector));
            transitions.push({ from: v.id, to: nextId, kind: 'inter-sequence', hd, targetSequenceId: found.sequenceId });
            interJumps++;
          } else {
            transitions.push({ from: v.id, to: nextId, kind: 'dangling', hd: null, error: 'next vector id not found in machine' });
            anyViolation = true; intraViolations++;
          }
        }
      }
    }
    sequences.push({ id: seq.id, name: seq.name, transitions, maxIntraHD: maxIntra, anyViolation });
  }

  let drift: string | null = null;
  if (declared && typeof declared.compliant === 'boolean') {
    const computedCompliant = intraViolations === 0;
    if (declared.compliant !== computedCompliant) {
      drift = `declared compliant=${declared.compliant} but computed compliant=${computedCompliant}`;
    }
    if (typeof declared.maxHammingDistanceIntraSequence === 'number') {
      const declaredMax = declared.maxHammingDistanceIntraSequence;
      const computedMax = sequences.reduce((mx, s) => Math.max(mx, s.maxIntraHD), 0);
      if (declaredMax !== computedMax) {
        drift = (drift ? drift + '; ' : '') +
          `declared maxHammingDistanceIntraSequence=${declaredMax} but computed=${computedMax}`;
      }
    }
  }

  return {
    machineId:   m.id ?? null,
    machineName: m.name ?? null,
    lifeSafety,
    declared,
    sequences,
    summary: { intraViolations, interJumps, drift },
  };
}

/**
 * Throw when a life-safety machine carries any intra-sequence STA
 * violation.  Called by MachineLoader.loadFromJSON when its `strictSta`
 * option is true.  The message lists the offending (sequence, from, to,
 * HD) tuples so the caller has actionable detail.
 */
export class StaViolationError extends Error {
  constructor(report: StaReport) {
    const offenders: string[] = [];
    for (const seq of report.sequences) {
      for (const t of seq.transitions) {
        if (t.violation || t.error) {
          offenders.push(`${seq.id}: ${t.from} → ${t.to} (HD=${t.hd}${t.error ? `, ${t.error}` : ''})`);
        }
      }
    }
    super(
      `STA violation in life-safety machine "${report.machineName ?? report.machineId ?? '?'}": ` +
      `${report.summary.intraViolations} intra-sequence transition(s) with HD>1.\n` +
      offenders.map(o => `  - ${o}`).join('\n')
    );
    this.name = 'StaViolationError';
  }
}

export function assertStaForLifeSafety(rawJsonOrObj: string | object): StaReport {
  const report = computeSta(rawJsonOrObj);
  if (report.lifeSafety && report.summary.intraViolations > 0) {
    throw new StaViolationError(report);
  }
  return report;
}
