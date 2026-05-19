/**
 * CES → localAIStack trigger-envelope parity, single-machine scope.
 *
 * AI-runtime counterpart to:
 *   ../RealityEngine_CPP/tests/e2e_ai_trigger_dispatch.cpp
 *
 * Both tests walk the same machine corpus, replay the same input sequences,
 * and assert the same envelope shape — so a divergence between the two
 * runtimes' governance resolution or sequence dispatch shows up here.
 *
 * What this exercises
 * -------------------
 * Every machine JSON ships its own `inputSequences[]` block (loaded at
 * machine load time, same as all current sources).  For machines that ALSO
 * declare:
 *
 *     metadata.triggerConfig.rules[]    — RAG-coded output→action mapping
 *     metadata.dispatchableAgent        — localAIStack agent id
 *     metadata.aiTrigger                — agent-side trigger hook name
 *
 * this test walks each input sequence, replays its vectors through the
 * machine, and asserts that the (sequenceId, outputVector) the machine
 * produces resolves — via GovernanceResolver.resolveForOutput — to a
 * PagingDecision whose fields are exactly what the dispatcher would
 * project into the envelope at
 * examples/triggers/ai_trigger_envelope.template.json.
 *
 * Skip rules (kept in lock-step with the C++ test):
 *   - Sequences with metadata.expectedOutputCount === 0 are "armed-but-quiescent"
 *     baseline tests; they have no envelope to assert.
 *   - SLA is only required for paging tiers (processStatus ∈ {error, warning}).
 *     The corpus uses null SLAs for info/ok rules by convention.
 */

import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { resolveForOutput, type PagingDecision } from '../services/GovernanceResolver.js';
import type { Machine } from '../models/Machine.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES   = join(dirname(__filename), '../../examples/machines');

interface EnvelopeFields {
  dispatchableAgent: string;
  aiTrigger:         string;
  ragStatusCode:     string;
  processStatus:     string;
  ownerTeam:         string;
  slaSeconds:        number | null;
  runbook:           string | null;
  escalationPolicy:  string | null;
}

/**
 * Build the envelope-projection bundle the dispatcher would emit for a
 * single fired (sequenceId, outputVector) pair, by walking the same fields
 * it would.  Returns null when no triggerConfig rule matches — matches
 * dispatcher's drop-on-miss behaviour.
 */
function envelopeFor(
  machine: Machine,
  machineMd: Record<string, any>,
  sequenceId: string,
  output: number[],
): EnvelopeFields | null {
  const decision = resolveForOutput(machine, sequenceId, output);
  if (!decision) return null;
  return {
    dispatchableAgent: machineMd.dispatchableAgent ?? '',
    aiTrigger:         machineMd.aiTrigger         ?? '',
    ragStatusCode:     decision.ragStatusCode      ?? '',
    processStatus:     decision.processStatus      ?? '',
    ownerTeam:         decision.ownerTeam,
    slaSeconds:        decision.slaSeconds,
    runbook:           decision.runbook,
    escalationPolicy:  decision.escalationPolicy,
  };
}

interface CorpusWalkResult {
  machinesWithTriggers: number;
  inputSequencesRun:    number;
  outputsProduced:      number;
  envelopesResolved:    number;
  failures:             string[];
}

/**
 * Walk every machine JSON under examples/machines/.  Skip files whose
 * machine doesn't declare triggerConfig + dispatchableAgent — those aren't
 * AI-routed and have nothing to assert at this layer.
 *
 * Returns aggregate counters and a list of human-readable failure messages.
 * The describe block below turns "failures.length === 0" into the single
 * top-level expectation, which keeps the failure stream readable when a
 * regression hits multiple machines at once.
 */
function walkCorpus(): CorpusWalkResult {
  const result: CorpusWalkResult = {
    machinesWithTriggers: 0, inputSequencesRun: 0, outputsProduced: 0,
    envelopesResolved: 0, failures: [],
  };

  const files = readdirSync(MACHINES).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    let raw: string;
    let root: any;
    try {
      raw  = readFileSync(join(MACHINES, file), 'utf8');
      root = JSON.parse(raw);
    } catch (e) {
      result.failures.push(`${file}: parse failed — ${(e as Error).message}`);
      continue;
    }
    const md = root?.machine?.metadata ?? {};
    const rules = md?.triggerConfig?.rules;
    if (!Array.isArray(rules) || rules.length === 0)     continue;
    if (typeof md.dispatchableAgent !== 'string' || !md.dispatchableAgent) continue;
    if (typeof md.aiTrigger         !== 'string' || !md.aiTrigger)         continue;

    result.machinesWithTriggers++;
    let machine: Machine;
    try { machine = MachineLoader.loadFromJSON(raw, `trigger-${file}`); }
    catch (e) {
      result.failures.push(`${file}: load failed — ${(e as Error).message}`);
      continue;
    }

    const inputSequences = root?.machine?.inputSequences;
    if (!Array.isArray(inputSequences)) continue;

    for (const seqJson of inputSequences) {
      machine.reset();
      result.inputSequencesRun++;

      const seqName = String(seqJson?.name ?? 'unnamed');
      const scenario = String(seqJson?.metadata?.scenario ?? '');

      // Baseline (expectedOutputCount: 0) sequences intentionally do not fire.
      // Skip them — same rule applied by the C++ test.
      const expectedOutputCount = seqJson?.metadata?.expectedOutputCount;
      if (expectedOutputCount === 0) continue;

      const vectors = seqJson?.vectors;
      if (!Array.isArray(vectors)) {
        result.failures.push(`${file} / ${seqName}: missing input vectors`);
        continue;
      }

      const fired: Array<{ sequenceId: string; output: number[] }> = [];
      for (const inputVec of vectors) {
        const tr = machine.processInput(inputVec);
        for (const [sequenceId, seqResult] of tr.sequenceResults) {
          for (const ov of seqResult.assertedOutputs) {
            fired.push({ sequenceId, output: ov.vector });
            result.outputsProduced++;
          }
        }
      }

      if (typeof expectedOutputCount === 'number' && expectedOutputCount > 0) {
        if (fired.length !== expectedOutputCount) {
          result.failures.push(
            `${file} / ${seqName}: expected ${expectedOutputCount} output(s), got ${fired.length}`,
          );
        }
      }

      let envelopesThisRun = 0;
      for (const { sequenceId, output } of fired) {
        const env = envelopeFor(machine, md, sequenceId, output);
        if (!env) continue;
        envelopesThisRun++;
        result.envelopesResolved++;

        const where = `${file} / ${seqName} / ${scenario}`;
        if (!env.dispatchableAgent)                                        result.failures.push(`${where}: dispatchableAgent empty`);
        if (!env.aiTrigger)                                                result.failures.push(`${where}: aiTrigger empty`);
        if (!['RED', 'AMBER', 'GREEN'].includes(env.ragStatusCode))        result.failures.push(`${where}: ragStatusCode='${env.ragStatusCode}' not in {RED,AMBER,GREEN}`);
        if (!['error', 'warning', 'info', 'ok'].includes(env.processStatus))result.failures.push(`${where}: processStatus='${env.processStatus}' not in {error,warning,info,ok}`);
        if (!env.ownerTeam || env.ownerTeam === 'unrouted')                result.failures.push(`${where}: ownerTeam unrouted (governance not backfilled)`);
        if (env.processStatus === 'error' || env.processStatus === 'warning') {
          if (env.slaSeconds === null || env.slaSeconds <= 0) {
            result.failures.push(`${where}: paging tier '${env.processStatus}' has no slaSeconds — envelope would page with no contract`);
          }
        }
      }

      if (envelopesThisRun === 0) {
        result.failures.push(`${file} / ${seqName}: no fired output matched any triggerConfig rule — envelope would be dropped`);
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cache the corpus walk — it's the bulk of the work, and each describe block
// below pulls a different facet from the same result.
const CORPUS = walkCorpus();

describe('CES → localAIStack envelope dispatch — corpus walk (C++ parity)', () => {
  test('corpus walk produces no failures', () => {
    if (CORPUS.failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('AiTriggerDispatch failures (first 25):');
      for (const m of CORPUS.failures.slice(0, 25)) console.error('  - ' + m);
    }
    expect(CORPUS.failures).toEqual([]);
  });

  test('non-trivial coverage — machines + envelopes both > 0', () => {
    expect(CORPUS.machinesWithTriggers).toBeGreaterThan(0);
    expect(CORPUS.envelopesResolved).toBeGreaterThan(0);
  });

  // Cross-runtime parity pins — the C++ test reports the same four counters
  // on the same corpus.  Pinning the AI side to the SAME numbers catches
  // any runtime divergence in process input/governance resolution.  If the
  // corpus grows the numbers will move in lockstep — update both sides.
  test('counter parity with C++ runtime (e2e_ai_trigger_dispatch)', () => {
    expect(CORPUS.machinesWithTriggers).toBe(895);
    expect(CORPUS.inputSequencesRun).toBe(4480);
    expect(CORPUS.outputsProduced).toBe(3586);
    expect(CORPUS.envelopesResolved).toBe(3586);
  });
});

// ── Yuma-specific tightening ────────────────────────────────────────────────
//
// The user-facing requirement names AGX051 and AGX055 explicitly; the trigger
// example envelopes hard-code the expected dispatch targets.  These two
// checks pin the wire values so a refactor of the generator script can't
// silently re-route the envelopes to a different agent — identical to
// e2e_ai_trigger_dispatch.cpp::test_agx051_envelope_pins / _agx055_envelope_pins.

function loadAndMeta(filename: string, id: string): { machine: Machine; md: Record<string, any> } {
  const raw = readFileSync(join(MACHINES, filename), 'utf8');
  const root = JSON.parse(raw);
  return { machine: MachineLoader.loadFromJSON(raw, id), md: root.machine.metadata };
}

describe('CES → localAIStack envelope dispatch — AGX051 pins', () => {
  const { machine, md } = loadAndMeta('AGX051_yuma-aqua-maintenance-forecaster.json', 'pin-agx051');

  test('agx-051-urgent-maint resolves to aquaculture_predictive_maintenance_agent with RED/error/sla=900', () => {
    const env = envelopeFor(machine, md, 'agx-051-urgent-maint', [1, 0, 0, 0]);
    expect(env).not.toBeNull();
    expect(env!.dispatchableAgent).toBe('aquaculture_predictive_maintenance_agent');
    expect(env!.aiTrigger).toBe('agriculture-yuma-aqua-maintenance-forecaster-maintenance');
    expect(env!.ragStatusCode).toBe('RED');
    expect(env!.processStatus).toBe('error');
    expect(env!.ownerTeam).toBe('agriculture-operations');
    expect(env!.slaSeconds).toBe(900);
  });

  test('agx-051-normal resolves to GREEN', () => {
    const env = envelopeFor(machine, md, 'agx-051-normal', [0, 0, 0, 1]);
    expect(env).not.toBeNull();
    expect(env!.ragStatusCode).toBe('GREEN');
  });
});

describe('CES → localAIStack envelope dispatch — AGX055 pins', () => {
  const { machine, md } = loadAndMeta('AGX055_yuma-facility-ai-synthesis-bridge.json', 'pin-agx055');

  const CASES: Array<{ seq: string; out: number[]; rag: string }> = [
    { seq: 'agx-055-aqua-urgent',     out: [1,0,0,0,0,0,0,0,0,0,0,0], rag: 'RED'   },
    { seq: 'agx-055-do-urgent',       out: [0,0,0,1,0,0,0,0,0,0,0,0], rag: 'RED'   },
    { seq: 'agx-055-climate-urgent',  out: [0,0,0,0,0,0,1,0,0,0,0,0], rag: 'RED'   },
    { seq: 'agx-055-safety-urgent',   out: [0,0,0,0,0,0,0,0,0,1,0,0], rag: 'RED'   },
    { seq: 'agx-055-facility-stable', out: [0,0,0,0,0,0,0,0,0,0,0,1], rag: 'GREEN' },
  ];

  test.each(CASES)('$seq routes to agriculture_yield_optimization_ai with rag=$rag', ({ seq, out, rag }) => {
    const env = envelopeFor(machine, md, seq, out);
    expect(env).not.toBeNull();
    expect(env!.dispatchableAgent).toBe('agriculture_yield_optimization_ai');
    expect(env!.aiTrigger).toBe('ag-yield-optimization-ai-yuma-facility-bridge');
    expect(env!.ragStatusCode).toBe(rag);
    expect(env!.ownerTeam).toBe('agriculture-operations');
  });

  // Projection invariant: AGX055.output region must match
  // AgYieldOptimizationAI.input region exactly — the 12-cell bridge
  // contract is meaningless if those don't overlap.
  test('bridge perceptual contract — AGX055 output region == AgYieldOptimizationAI input region == length 12', () => {
    const bridgeRoot = JSON.parse(readFileSync(join(MACHINES, 'AGX055_yuma-facility-ai-synthesis-bridge.json'), 'utf8'));
    const yieldRoot  = JSON.parse(readFileSync(join(MACHINES, 'AgYieldOptimizationAI.json'),                 'utf8'));
    const bridgeOut  = bridgeRoot.machine.perceptualMapping.output;
    const yieldIn    = yieldRoot.machine.perceptualMapping.input;
    expect(bridgeOut.offset).toBe(yieldIn.offset);
    expect(bridgeOut.length).toBe(yieldIn.length);
    expect(bridgeOut.length).toBe(12);
  });
});
