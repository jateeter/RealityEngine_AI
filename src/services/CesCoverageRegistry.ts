/**
 * CesCoverageRegistry — operational-state coverage telemetry for Critical
 * Event Sequences.
 *
 * Counts every per-vector match / activation / output emission that happens
 * inside the engine and exposes them as Prometheus-compatible metrics.  The
 * intent mirrors test coverage but at runtime: any (machine, sequence,
 * vector) tuple that never increments its counter in production is either
 * over-specified, unreachable, or fed inputs that don't excite it.
 *
 * The PerceptualSpaceSimulator calls `recordTransition()` once per machine
 * per step.  `snapshot()` walks every registered machine via the supplied
 * iterable and computes the unfired-* gauges (counts of sequences and
 * vectors that have never been observed firing).
 *
 * `toPrometheusText()` emits the standard Prometheus text exposition format
 * so the /metrics endpoint can serve it as-is.
 */

import type { MachineTransitionResult } from '../models/types.js';
import type { Machine } from '../models/Machine.js';

/**
 * A flat key+value map keyed by a tab-joined identifier — avoids the
 * allocation cost of nested maps on every step while still letting us
 * decompose the key when emitting metrics.
 */
class LabeledCounter {
  private counts = new Map<string, number>();

  bump(parts: string[]): void {
    const k = parts.join('\t');
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }

  get(parts: string[]): number {
    return this.counts.get(parts.join('\t')) ?? 0;
  }

  entries(): Array<{ parts: string[]; count: number }> {
    return Array.from(this.counts, ([k, count]) => ({ parts: k.split('\t'), count }));
  }
}

export interface CoverageSnapshot {
  totals: {
    machines:  number;
    sequences: number;
    vectors:   number;
    matched:   number;
    activated: number;
    outputs:   number;
  };
  perMachine: Array<{
    machineId:   string;
    machineName: string;
    sequenceCount: number;
    vectorCount:   number;
    firedSequences:    number;
    unfiredSequences:  number;
    firedVectors:      number;
    unfiredVectors:    number;
  }>;
}

export class CesCoverageRegistry {
  // (machineId, machineName, sequenceId, vectorId) → count of matches.
  private matched   = new LabeledCounter();
  // (machineId, machineName, sequenceId, vectorId) → count of activations.
  // "Activated" here means the vector became active for the next step as a
  // result of a predecessor matching; useful for distinguishing reachable but
  // never-actually-fired states.
  private activated = new LabeledCounter();
  // (machineId, machineName, sequenceId) → count of asserted outputs.
  private outputs   = new LabeledCounter();
  // (machineId, machineName) → count of process_input calls.
  private steps     = new LabeledCounter();
  // Paging decisions resolved by the governance contract — counted by
  // (ownerTeam, processStatus, ragStatusCode, machineId).  Lets the ops
  // dashboard show "how often patient-safety-on-call paged in the last hour"
  // without re-deriving from the machine corpus.
  private pagingDecisions = new LabeledCounter();
  // Fires of deprecated sequences, counted by (machine, sequence, replacedBy).
  // Drives the "stale-CES burn-down" panel: any non-zero counter means a
  // sequence past its deprecation date is still hot in production.
  private deprecatedFires = new LabeledCounter();

  private startedAtMs = Date.now();

  /**
   * Record one machine's transition result.  Bumps the per-vector match
   * and activation counters and the per-sequence output counter.
   */
  recordTransition(machine: Machine, result: MachineTransitionResult): void {
    this.steps.bump([machine.id, machine.name]);
    for (const [sequenceId, sr] of result.sequenceResults) {
      for (const vectorId of sr.matchedVectors) {
        this.matched.bump([machine.id, machine.name, sequenceId, vectorId]);
      }
      for (const vectorId of sr.activatedVectors) {
        this.activated.bump([machine.id, machine.name, sequenceId, vectorId]);
      }
      if (result.arbiterMetadata.shouldOutput && sr.assertedOutputs.length > 0) {
        for (let i = 0; i < sr.assertedOutputs.length; i++) {
          this.outputs.bump([machine.id, machine.name, sequenceId]);
        }
      }
    }
  }

  /**
   * Record a governance-resolved paging decision.  Called by the simulator
   * for every mergeBatch entry that ended up with a populated `governance`
   * field — i.e. every output for which a triggerConfig rule matched.
   */
  recordPagingDecision(parts: { ownerTeam: string; processStatus: string; ragStatusCode: string; machineId: string }): void {
    this.pagingDecisions.bump([parts.ownerTeam, parts.processStatus, parts.ragStatusCode, parts.machineId]);
  }

  /**
   * Record one fire of a deprecated sequence.  `replacedBy` is the empty
   * string when none is declared — keeps the label set always-present so
   * Prom queries don't need conditional grouping.
   */
  recordDeprecatedFire(parts: { machineId: string; machineName: string; sequenceId: string; replacedBy?: string | undefined }): void {
    this.deprecatedFires.bump([
      parts.machineId, parts.machineName, parts.sequenceId, parts.replacedBy ?? '',
    ]);
  }

  /**
   * Compute the unfired-* gauges from the current registry state plus the
   * full set of machines (needed to know what *could* fire).
   */
  snapshot(machines: Iterable<Machine>): CoverageSnapshot {
    const perMachine: CoverageSnapshot['perMachine'] = [];
    let totalSequences = 0;
    let totalVectors   = 0;
    let totalMachines  = 0;
    let totalMatched   = 0;
    let totalActivated = 0;
    let totalOutputs   = 0;

    for (const m of machines) {
      totalMachines++;
      let sequenceCount = 0;
      let vectorCount   = 0;
      let firedSequences = 0;
      let firedVectors   = 0;

      for (const seq of m.getAllSequences()) {
        sequenceCount++;
        if (this.outputs.get([m.id, m.name, seq.id]) > 0) firedSequences++;
        for (const v of seq.getAllVectors()) {
          vectorCount++;
          const matchedCt   = this.matched.get([m.id, m.name, seq.id, v.id]);
          const activatedCt = this.activated.get([m.id, m.name, seq.id, v.id]);
          if (matchedCt > 0 || activatedCt > 0) firedVectors++;
        }
      }
      totalSequences += sequenceCount;
      totalVectors   += vectorCount;
      perMachine.push({
        machineId: m.id,
        machineName: m.name,
        sequenceCount,
        vectorCount,
        firedSequences,
        unfiredSequences: sequenceCount - firedSequences,
        firedVectors,
        unfiredVectors:   vectorCount - firedVectors,
      });
    }
    for (const e of this.matched.entries())   totalMatched   += e.count;
    for (const e of this.activated.entries()) totalActivated += e.count;
    for (const e of this.outputs.entries())   totalOutputs   += e.count;

    return {
      totals: {
        machines:  totalMachines,
        sequences: totalSequences,
        vectors:   totalVectors,
        matched:   totalMatched,
        activated: totalActivated,
        outputs:   totalOutputs,
      },
      perMachine,
    };
  }

  /**
   * Reset counters — useful between test runs.  Does not touch the start
   * timestamp so process uptime stays monotonic.
   */
  reset(): void {
    this.matched   = new LabeledCounter();
    this.activated = new LabeledCounter();
    this.outputs   = new LabeledCounter();
    this.steps     = new LabeledCounter();
  }

  /**
   * Render the current state as Prometheus text-format metrics suitable
   * for serving from /metrics.  When `opts.baseLabels` is provided, every
   * metric line — including the unlabelled gauges — is stamped with that
   * label set.  This is how the runtime stamps `runtime="ai"` so a single
   * Prometheus scrape config can drive a cross-runtime Grafana dashboard.
   */
  toPrometheusText(machines: Iterable<Machine>, opts?: { baseLabels?: Record<string, string> }): string {
    const base = opts?.baseLabels ?? {};
    const snap = this.snapshot(machines);
    const lines: string[] = [];

    lines.push('# HELP ces_machines_total Number of machines registered with the simulator.');
    lines.push('# TYPE ces_machines_total gauge');
    lines.push(`ces_machines_total${labels(base)} ${snap.totals.machines}`);

    lines.push('# HELP ces_sequences_total Number of sequences across all registered machines.');
    lines.push('# TYPE ces_sequences_total gauge');
    lines.push(`ces_sequences_total${labels(base)} ${snap.totals.sequences}`);

    lines.push('# HELP ces_vectors_total Number of event vectors across all registered machines.');
    lines.push('# TYPE ces_vectors_total gauge');
    lines.push(`ces_vectors_total${labels(base)} ${snap.totals.vectors}`);

    lines.push('# HELP ces_vector_matched_total Number of times a vector matched its input during a transition phase.');
    lines.push('# TYPE ces_vector_matched_total counter');
    for (const e of this.matched.entries()) {
      const [machineId, machineName, sequenceId, vectorId] = e.parts;
      lines.push(`ces_vector_matched_total${labels({ ...base, machine: machineName!, machine_id: machineId!, sequence: sequenceId!, vector: vectorId! })} ${e.count}`);
    }

    lines.push('# HELP ces_vector_activated_total Number of times a vector was activated as a successor in a transition.');
    lines.push('# TYPE ces_vector_activated_total counter');
    for (const e of this.activated.entries()) {
      const [machineId, machineName, sequenceId, vectorId] = e.parts;
      lines.push(`ces_vector_activated_total${labels({ ...base, machine: machineName!, machine_id: machineId!, sequence: sequenceId!, vector: vectorId! })} ${e.count}`);
    }

    lines.push('# HELP ces_sequence_outputs_total Number of asserted outputs emitted by a sequence.');
    lines.push('# TYPE ces_sequence_outputs_total counter');
    for (const e of this.outputs.entries()) {
      const [machineId, machineName, sequenceId] = e.parts;
      lines.push(`ces_sequence_outputs_total${labels({ ...base, machine: machineName!, machine_id: machineId!, sequence: sequenceId! })} ${e.count}`);
    }

    lines.push('# HELP ces_machine_steps_total Number of process_input calls observed for this machine.');
    lines.push('# TYPE ces_machine_steps_total counter');
    for (const e of this.steps.entries()) {
      const [machineId, machineName] = e.parts;
      lines.push(`ces_machine_steps_total${labels({ ...base, machine: machineName!, machine_id: machineId! })} ${e.count}`);
    }

    // Paging decisions resolved by the governance contract.  Labelled by the
    // on-call team that would receive the page plus severity tags so a dashboard
    // can show "page rate by team" or "RED rate by machine" without re-deriving.
    lines.push('# HELP ces_paging_decisions_total Number of governance-resolved paging decisions issued by the engine.');
    lines.push('# TYPE ces_paging_decisions_total counter');
    for (const e of this.pagingDecisions.entries()) {
      const [ownerTeam, processStatus, ragStatusCode, machineId] = e.parts;
      lines.push(`ces_paging_decisions_total${labels({
        ...base,
        owner_team: ownerTeam!,
        process_status: processStatus!,
        rag_status_code: ragStatusCode!,
        machine_id: machineId!,
      })} ${e.count}`);
    }

    // Deprecated-sequence fires.  A non-zero counter means the engine is
    // still serving outputs from a sequence past its deprecation date —
    // drives the stale-CES burn-down panel.
    lines.push('# HELP ces_deprecated_fires_total Number of times a deprecated sequence emitted output.');
    lines.push('# TYPE ces_deprecated_fires_total counter');
    for (const e of this.deprecatedFires.entries()) {
      const [machineId, machineName, sequenceId, replacedBy] = e.parts;
      lines.push(`ces_deprecated_fires_total${labels({
        ...base,
        machine: machineName!,
        machine_id: machineId!,
        sequence: sequenceId!,
        replaced_by: replacedBy!,
      })} ${e.count}`);
    }

    // Per-machine "code-coverage at the operational-state level" gauges.
    lines.push('# HELP ces_unfired_sequences Number of sequences in this machine that have never emitted output.');
    lines.push('# TYPE ces_unfired_sequences gauge');
    for (const pm of snap.perMachine) {
      lines.push(`ces_unfired_sequences${labels({ ...base, machine: pm.machineName, machine_id: pm.machineId })} ${pm.unfiredSequences}`);
    }

    lines.push('# HELP ces_unfired_vectors Number of vectors in this machine that have never matched or activated.');
    lines.push('# TYPE ces_unfired_vectors gauge');
    for (const pm of snap.perMachine) {
      lines.push(`ces_unfired_vectors${labels({ ...base, machine: pm.machineName, machine_id: pm.machineId })} ${pm.unfiredVectors}`);
    }

    lines.push('# HELP ces_machine_sequence_count Total sequences declared by this machine.');
    lines.push('# TYPE ces_machine_sequence_count gauge');
    for (const pm of snap.perMachine) {
      lines.push(`ces_machine_sequence_count${labels({ ...base, machine: pm.machineName, machine_id: pm.machineId })} ${pm.sequenceCount}`);
    }

    lines.push('# HELP ces_machine_vector_count Total vectors declared by this machine.');
    lines.push('# TYPE ces_machine_vector_count gauge');
    for (const pm of snap.perMachine) {
      lines.push(`ces_machine_vector_count${labels({ ...base, machine: pm.machineName, machine_id: pm.machineId })} ${pm.vectorCount}`);
    }

    const uptimeMs = Date.now() - this.startedAtMs;
    lines.push('# HELP ces_registry_uptime_seconds Seconds since the coverage registry was instantiated.');
    lines.push('# TYPE ces_registry_uptime_seconds gauge');
    lines.push(`ces_registry_uptime_seconds${labels(base)} ${(uptimeMs / 1000).toFixed(3)}`);

    return lines.join('\n') + '\n';
  }
}

/**
 * Render a Prometheus label set.  Escapes backslashes, double quotes, and
 * newlines per the exposition spec — labels generated from machine names
 * frequently contain spaces, parens, and arrows which are otherwise fine.
 */
function labels(set: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(set)) {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    parts.push(`${k}="${escaped}"`);
  }
  return parts.length === 0 ? '' : `{${parts.join(',')}}`;
}
