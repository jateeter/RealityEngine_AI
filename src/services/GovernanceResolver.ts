/**
 * GovernanceResolver — turns a CES machine + a fired output into a paging
 * decision derived solely from the machine JSON.
 *
 * The CES JSON is the sole source of truth for:
 *   - severity classification: triggerConfig.rules[].(ragStatusCode, processStatus)
 *   - on-call routing:        machine.metadata.governance.ownerTeam (with optional
 *                             rule-level override) and escalationPolicy
 *   - response time:          machine.metadata.governance.sla[processStatus] with
 *                             rule-level override slaSeconds
 *   - operator playbook:      runbook URL, again with rule-level override
 *   - contact roster:         contact.primary / contact.secondary fallback chain
 *
 * Callers ask:  resolveForOutput(machine, sequenceId, values)
 *
 * The resolver returns either a populated PagingDecision or null when the
 * fired output isn't covered by a triggerConfig rule (i.e. the machine
 * doesn't care about this output for paging).  Missing top-level governance
 * is reported separately by the validator — this resolver returns a best-effort
 * decision with placeholders rather than throwing, so a live engine keeps
 * serving alerts even mid-rollout of governance metadata.
 */

import type { Machine } from '../models/Machine.js';

/** Severity model already encoded in the corpus. */
export type ProcessStatus = 'ok' | 'info' | 'warning' | 'error';
export type RagStatusCode = 'GREEN' | 'AMBER' | 'RED';

export interface GovernanceContact {
  primary?: string;
  secondary?: string;
}

export interface MachineGovernance {
  schemaVersion?: string;
  ownerTeam: string;
  runbook?: string;
  escalationPolicy?: string;
  contact?: GovernanceContact;
  sla?: Partial<Record<ProcessStatus, number | null>>;
  notes?: string;
}

export interface RuleGovernanceOverride {
  ownerTeam?: string;
  slaSeconds?: number | null;
  runbook?: string;
  escalationPolicy?: string;
  contact?: GovernanceContact;
}

export interface TriggerRule {
  sequenceId: string;
  outputMatches: number[];
  ragStatusCode?: RagStatusCode;
  processStatus?: ProcessStatus;
  description?: string;
  governance?: RuleGovernanceOverride;
}

export interface PagingDecision {
  machineId: string;
  machineName: string;
  sequenceId: string;
  ragStatusCode: RagStatusCode | null;
  processStatus: ProcessStatus | null;
  ownerTeam: string;
  slaSeconds: number | null;
  runbook: string | null;
  escalationPolicy: string | null;
  contact: GovernanceContact;
  description?: string | undefined;
  // Marker fields so consumers know which side of the contract they're on.
  source: 'rule-with-override' | 'rule-only' | 'machine-fallback';
  // True when the machine declared a `governance` block.  False values still
  // produce a decision (best-effort) so the engine doesn't block on legacy
  // machines, but operators should backfill — the validator script will flag it.
  hasMachineGovernance: boolean;
}

/**
 * Resolve a paging decision for one fired output, or null if no
 * triggerConfig rule covers it.  Both inputs come from a mergeBatch entry:
 * sequenceId from MergeOperation.sequenceId, values from MergeOperation.values.
 */
export function resolveForOutput(
  machine: Machine,
  sequenceId: string,
  values: number[],
): PagingDecision | null {
  const md = (machine.metadata ?? {}) as Record<string, unknown>;
  const triggerConfig = (md['triggerConfig'] as { rules?: TriggerRule[] } | undefined) ?? {};
  const rules = triggerConfig.rules ?? [];
  const machineGov = (md['governance'] as MachineGovernance | undefined) ?? null;

  const rule = rules.find(r => r.sequenceId === sequenceId && arraysEqual(r.outputMatches, values));
  if (!rule) return null;

  const processStatus = rule.processStatus ?? null;
  const ragStatusCode = rule.ragStatusCode ?? null;

  const ruleGov = rule.governance ?? {};

  // Resolution precedence per field: rule override → machine governance →
  // null.  This lets a single rule (e.g. fall-confirmed RED) tighten the SLA
  // without restating the rest of the contract.
  const ownerTeam        = ruleGov.ownerTeam        ?? machineGov?.ownerTeam        ?? 'unrouted';
  const escalationPolicy = ruleGov.escalationPolicy ?? machineGov?.escalationPolicy ?? null;
  const runbook          = ruleGov.runbook          ?? machineGov?.runbook          ?? null;
  const contact          = ruleGov.contact          ?? machineGov?.contact          ?? {};
  let slaSeconds: number | null;
  if (ruleGov.slaSeconds !== undefined) {
    slaSeconds = ruleGov.slaSeconds;
  } else if (machineGov?.sla && processStatus && Object.prototype.hasOwnProperty.call(machineGov.sla, processStatus)) {
    slaSeconds = machineGov.sla[processStatus] ?? null;
  } else {
    slaSeconds = null;
  }

  let source: PagingDecision['source'];
  if (rule.governance) source = 'rule-with-override';
  else if (machineGov) source = 'rule-only';
  else                 source = 'machine-fallback';

  return {
    machineId: machine.id,
    machineName: machine.name,
    sequenceId,
    ragStatusCode,
    processStatus,
    ownerTeam,
    slaSeconds,
    runbook,
    escalationPolicy,
    contact,
    description: rule.description,
    source,
    hasMachineGovernance: machineGov !== null,
  };
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface GovernanceValidationIssue {
  machineId: string;
  machineName: string;
  severity: 'error' | 'warning';
  kind: 'missing-governance' | 'missing-required-field' | 'unknown-process-status' | 'sla-out-of-range' | 'rule-has-no-process-status' | 'invalid-runbook';
  detail: string;
}

const REQUIRED_MACHINE_FIELDS: Array<keyof MachineGovernance> = ['ownerTeam'];
const VALID_PROCESS_STATUSES: ProcessStatus[] = ['ok', 'info', 'warning', 'error'];

export function validateMachineGovernance(machine: Machine): GovernanceValidationIssue[] {
  const issues: GovernanceValidationIssue[] = [];
  const md = (machine.metadata ?? {}) as Record<string, unknown>;
  const gov = md['governance'] as MachineGovernance | undefined;
  const triggerConfig = md['triggerConfig'] as { rules?: TriggerRule[] } | undefined;
  const hasRules = (triggerConfig?.rules?.length ?? 0) > 0;

  if (!gov) {
    if (hasRules) {
      issues.push({
        machineId: machine.id,
        machineName: machine.name,
        severity: 'warning',
        kind: 'missing-governance',
        detail: 'machine declares triggerConfig.rules but no metadata.governance block — alerts will route to "unrouted"',
      });
    }
    return issues;
  }

  for (const field of REQUIRED_MACHINE_FIELDS) {
    if (!gov[field]) {
      issues.push({
        machineId: machine.id, machineName: machine.name,
        severity: 'error', kind: 'missing-required-field',
        detail: `metadata.governance.${field} is required`,
      });
    }
  }

  if (gov.runbook && !/^https?:\/\//.test(gov.runbook)) {
    issues.push({
      machineId: machine.id, machineName: machine.name,
      severity: 'warning', kind: 'invalid-runbook',
      detail: `metadata.governance.runbook should be a URL, got: ${gov.runbook}`,
    });
  }

  for (const [status, seconds] of Object.entries(gov.sla ?? {})) {
    if (!VALID_PROCESS_STATUSES.includes(status as ProcessStatus)) {
      issues.push({
        machineId: machine.id, machineName: machine.name,
        severity: 'warning', kind: 'unknown-process-status',
        detail: `metadata.governance.sla.${status} — unknown processStatus`,
      });
    }
    if (seconds !== null && (typeof seconds !== 'number' || seconds < 0 || seconds > 86400)) {
      issues.push({
        machineId: machine.id, machineName: machine.name,
        severity: 'warning', kind: 'sla-out-of-range',
        detail: `metadata.governance.sla.${status} = ${seconds} — expected null or a non-negative integer ≤ 86400 (1 day)`,
      });
    }
  }

  for (const rule of triggerConfig?.rules ?? []) {
    if (!rule.processStatus) {
      issues.push({
        machineId: machine.id, machineName: machine.name,
        severity: 'warning', kind: 'rule-has-no-process-status',
        detail: `triggerConfig.rules[sequenceId=${rule.sequenceId}] has no processStatus — paging defaults to no SLA`,
      });
    }
  }

  return issues;
}
