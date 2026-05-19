/**
 * CES composition / meta-CES tests.
 *
 * Verifies the event-bus subscription model: a meta-machine declares
 * `metadata.compose.subscriptions[*]`, and when the producer sequences it
 * subscribes to fire, the simulator latches `1.0` at the meta-machine's
 * input region.  The meta-machine then runs as an ordinary CES over those
 * bits — letting domain workflows be expressed in the same formalism as
 * the leaf machines.
 *
 * Scenario uses the CommunityCommandAgent fixture: a 4-vector CES whose
 * inputs are the fire-events of three producer sequences:
 *
 *   benefits-eligibility.bel-finalize    → bit 5500
 *   intake-triage.intake-finalize        → bit 5501
 *   housing-placement.housing-place      → bit 5502
 *
 * Terminal output `referral-complete` ([1,0,0,0]) fires only after all
 * three milestones have been latched in order: benefits → intake → housing.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { Machine } from '../models/Machine.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { RealityVector } from '../models/RealityVector.js';
import { ComparatorType } from '../models/types.js';
import { ArbiterRule } from '../models/OutputArbiter.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES = join(dirname(__filename), '../../examples/machines');

function loadAgent(): Machine {
  return MachineLoader.loadFromJSON(
    readFileSync(join(MACHINES, 'CommunityCommandAgent.json'), 'utf8'),
    'machine-community-command-agent',
  );
}

/**
 * Build a trivial producer machine whose sole sequence emits one output
 * for an isInitial single-step match.  Used in place of fixture JSONs so
 * the test focuses on the composition mechanism, not the producer corpus.
 *
 * `inputBit` is a single-position input region in PE that we toggle from
 * outside (via inputRegion in `sim.configure(...)` or processImmediate).
 * `outputRegion` is where the producer's output lands — pinned to a part
 * of PE that doesn't collide with the meta-machine's input/output regions
 * (5500..5506).  We park producer outputs at the very end of PE.
 */
function producer(id: string, sequenceId: string, inputBit: number, outputOffset: number): Machine {
  const machine = new Machine(
    `producer-${id}`,
    'meta-CES composition producer',
    {},
    ArbiterRule.PASSTHROUGH,
    { input: { offset: inputBit, length: 1 }, output: { offset: outputOffset, length: 1 } },
    id,
  );
  machine.matchAlgorithm = ComparatorType.GTE;
  const seq = new CriticalEventSequence(`${sequenceId} sequence`, sequenceId);
  const v = new RealityVector(
    [{ value: 1, comparatorType: ComparatorType.GTE, threshold: 0.5 }],
    true,
    `${sequenceId}-fire`,
  );
  v.addOutputVector({ id: `${sequenceId}-out`, vector: [1], metadata: {}, timestamp: 0 });
  seq.addVector(v);
  machine.addSequence(seq);
  return machine;
}

function dense(length: number, writes: Array<{ offset: number; value: number }>): number[] {
  const v = new Array<number>(length).fill(0);
  for (const w of writes) v[w.offset] = w.value;
  return v;
}

describe('CES composition / meta-CES', () => {
  test('agent registers three event-bus subscriptions on add', () => {
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    expect(sim.getEventBusSubscriptionCount()).toBe(3);
    // The subscription bits force the perceptual space to cover 5500..5502
    // even though the agent's input region nominally covers them already.
    expect(sim.getDimension()).toBeGreaterThanOrEqual(5503);
  });

  test('benefits-only fire latches bit 5500 but does NOT advance the agent', () => {
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    sim.addMachine(producer('machine-benefits-eligibility', 'bel-finalize', 6000, 6010));

    // Drive the benefits producer.
    const step = sim.processImmediate(dense(6011, [{ offset: 6000, value: 1 }]));

    // mergeBatch has the producer's primary output.
    expect(step.mergeBatch.find(op => op.sequenceId === 'bel-finalize')).toBeDefined();

    // eventBus has exactly one latch entry → bitOffset 5500.
    expect(step.eventBus).toHaveLength(1);
    expect(step.eventBus[0]).toMatchObject({
      producerMachineId: 'machine-benefits-eligibility',
      producerSequenceId: 'bel-finalize',
      subscriberMachineId: 'machine-community-command-agent',
      bitOffset: 5500,
      value: 1,
    });

    // The agent has not yet emitted referral-complete — only the first
    // milestone has fired.
    const referral = step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' && op.sequenceId === 'referral-completion'
    );
    expect(referral).toBeUndefined();
  });

  test('all three producers firing drives the meta-CES to referral-complete', () => {
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    sim.addMachine(producer('machine-benefits-eligibility', 'bel-finalize', 6000, 6010));
    sim.addMachine(producer('machine-intake-triage',        'intake-finalize', 6001, 6011));
    sim.addMachine(producer('machine-housing-placement',    'housing-place',   6002, 6012));

    const tick = (triggers: number[]) => sim.processImmediate(dense(7000,
      triggers.map(offset => ({ offset, value: 1 }))));

    // eventBus on each step contains only the writes triggered that step
    // (new producer fires).  Latched bits from earlier steps persist on
    // the perceptual space but don't re-appear in the eventBus payload.
    //
    // Step 1: fire benefits → eventBus = [bit 5500].
    let step = tick([6000]);
    expect(step.eventBus.map(w => w.bitOffset)).toEqual([5500]);
    expect(step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' &&
      op.sequenceId === 'referral-completion'
    )).toBeUndefined();

    // Step 2: fire intake → eventBus = [bit 5501].  Bit 5500 is still
    // latched on the perceptual space but isn't re-emitted on the event bus.
    step = tick([6001]);
    expect(step.eventBus.map(w => w.bitOffset)).toEqual([5501]);
    expect(step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' &&
      op.sequenceId === 'referral-completion'
    )).toBeUndefined();

    // Step 3: fire housing → eventBus = [bit 5502].
    step = tick([6002]);
    expect(step.eventBus.map(w => w.bitOffset)).toEqual([5502]);

    // Step 4: the meta-CES snapshot now reads [1,1,1].  ccr-all-milestones-reached
    // matches → REFERRAL_COMPLETE [1,0,0,0] lands at the agent's output region.
    step = tick([]);
    const referral = step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' &&
      op.sequenceId === 'referral-completion'
    );
    expect(referral).toBeDefined();
    expect(referral!.values).toEqual([1, 0, 0, 0]);
    expect(referral!.region).toEqual({ offset: 5503, length: 4 });
    // The meta-CES's own evidence chain — terminates at the asserter.
    // Cross-machine provenance (linking the producers' chains in here)
    // is a future enhancement; for now the chain stops at the meta-machine boundary.
    expect(referral!.provenance).toEqual(['ccr-all-milestones-reached']);
  });

  test('a single producer firing is not enough to drive the meta-CES to completion', () => {
    // Fire only housing.  Bit 5502 latches, but the meta-CES requires
    // all three milestones to be reached, so referral-completion stays silent.
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    sim.addMachine(producer('machine-housing-placement', 'housing-place', 6002, 6012));

    const step = sim.processImmediate(dense(7000, [{ offset: 6002, value: 1 }]));
    expect(step.eventBus.map(w => w.bitOffset)).toEqual([5502]);
    expect(step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' &&
      op.sequenceId === 'referral-completion'
    )).toBeUndefined();

    // The agent's referral-incomplete sequence does fire — its [0,0,0]
    // pattern matched the snapshot taken before housing's bit latched.
    expect(step.mergeBatch.find(op =>
      op.machineId === 'machine-community-command-agent' &&
      op.sequenceId === 'referral-incomplete'
    )).toBeDefined();
  });

  test('event-bus writes are sorted (subscriberMachineId, bitOffset, ...) deterministically', () => {
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    sim.addMachine(producer('machine-housing-placement',    'housing-place',   6002, 6012));
    sim.addMachine(producer('machine-benefits-eligibility', 'bel-finalize',    6000, 6010));
    sim.addMachine(producer('machine-intake-triage',        'intake-finalize', 6001, 6011));

    // Fire all three producers in one step — note that producer addMachine
    // order is housing-first to confirm ordering depends on the canonical
    // sort, not on add order or mergeBatch iteration order.
    const step = sim.processImmediate(dense(7000, [
      { offset: 6000, value: 1 },
      { offset: 6001, value: 1 },
      { offset: 6002, value: 1 },
    ]));
    expect(step.eventBus.map(w => w.bitOffset)).toEqual([5500, 5501, 5502]);
  });

  test('removing the meta-machine drops its subscriptions', () => {
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(loadAgent());
    expect(sim.getEventBusSubscriptionCount()).toBe(3);
    sim.removeMachine('machine-community-command-agent');
    expect(sim.getEventBusSubscriptionCount()).toBe(0);
  });
});
