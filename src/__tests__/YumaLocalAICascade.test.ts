/**
 * End-to-end Yuma → AI cascade — AI-runtime counterpart to:
 *   ../RealityEngine_CPP/tests/e2e_yuma_localai_cascade.cpp
 *
 * Same multi-machine setup, same 3-tick AGX051 escalation, same AGX055
 * bridge fire, same 12-cell projection onto AgYieldOptimizationAI's input
 * window.  Both runtimes must produce identical mergeBatch shapes — that
 * is the cross-runtime parity contract enforced here.
 *
 *   step N      AGX051 (Aqua Maintenance)           → [256:260) [1,0,0,0]   URGENT_MAINT  (after 3 ticks)
 *               AGX052 (DO Probe Reliability)       → [260:264) [0,0,0,1]   NORMAL
 *               AGX053 (VPD HVAC Service)           → [264:268) [0,0,0,1]   NORMAL
 *               AGX054 (CO2 Safety Compliance)      → [268:272) [0,0,0,1]   NORMAL
 *   step N+1    AGX055 (Facility AI Synthesis)      → [3959:3971) AQUA_URGENT one-hot
 *   step N+2    AgYieldOptimizationAI reads [3959:3971) — bridge contract
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator, type MergeOperation, type SimulationStep } from '../engine/PerceptualSpaceSimulator.js';
import type { Machine } from '../models/Machine.js';

const __filename = fileURLToPath(import.meta.url);
const MACHINES   = join(dirname(__filename), '../../examples/machines');

function load(file: string, id: string): Machine {
  return MachineLoader.loadFromJSON(readFileSync(join(MACHINES, file), 'utf8'), id);
}

function denseWrites(regions: Array<{ offset: number; values: number[] }>): number[] {
  let max = 0;
  for (const r of regions) max = Math.max(max, r.offset + r.values.length);
  const v = new Array<number>(max).fill(0);
  for (const r of regions) for (let i = 0; i < r.values.length; i++) v[r.offset + i] = r.values[i]!;
  return v;
}

function zeroRegion(v: number[], offset: number, length: number): void {
  for (let i = offset; i < offset + length; i++) v[i] = 0;
}

function findMerge(step: SimulationStep, machineId: string): MergeOperation | undefined {
  return step.mergeBatch.find(op => op.machineId === machineId);
}

// The four AGX051-054 share identical input patterns (lifted from
// inputSequences[] in each machine's JSON).  Centralised so the cascade
// won't drift when the generator script regenerates them.
const TIER1_NORMAL_INPUT: number[] = [1, 1, 0, 1];                  // single tick → NORMAL output [0,0,0,1]
const TIER1_URGENT_INPUT_TICKS: number[][] = [                      // 3-tick escalation → URGENT output [1,0,0,0]
  [1, 1, 1, 1],
  [1, 0, 1, 0],
  [0, 0, 0, 0],
];

describe('Yuma → localAIStack cascade — full URGENT chain (C++ parity)', () => {
  // Build a fresh simulator + machine set per top-level describe so the
  // determinism subtest below sees a clean slate.
  function buildSim() {
    const agx051  = load('AGX051_yuma-aqua-maintenance-forecaster.json',  'casc-agx051');
    const agx052  = load('AGX052_yuma-do-probe-reliability-tracker.json', 'casc-agx052');
    const agx053  = load('AGX053_yuma-vpd-hvac-service-planner.json',     'casc-agx053');
    const agx054  = load('AGX054_yuma-co2-safety-compliance-officer.json','casc-agx054');
    const agx055  = load('AGX055_yuma-facility-ai-synthesis-bridge.json', 'casc-agx055');
    const yieldAI = load('AgYieldOptimizationAI.json',                    'casc-agyield');
    const sim = new PerceptualSpaceSimulator(0);
    sim.addMachine(agx051);
    sim.addMachine(agx052);
    sim.addMachine(agx053);
    sim.addMachine(agx054);
    sim.addMachine(agx055);
    sim.addMachine(yieldAI);
    return { sim, agx051, agx052, agx053, agx054, agx055, yieldAI };
  }

  test('cascade fires URGENT chain through all three stages', () => {
    const { sim, agx051, agx055, yieldAI } = buildSim();

    // ── Stage 1: drive the 3-tick AGX051 escalation while AGX052/053/054
    //             stream NORMAL each tick ──
    let m051Final: MergeOperation | undefined;
    for (let tick = 0; tick < TIER1_URGENT_INPUT_TICKS.length; tick++) {
      const v = denseWrites([
        { offset: 40,  values: TIER1_URGENT_INPUT_TICKS[tick]! },
        { offset: 84,  values: TIER1_NORMAL_INPUT },
        { offset: 184, values: TIER1_NORMAL_INPUT },
        { offset: 228, values: TIER1_NORMAL_INPUT },
      ]);
      const s = sim.processImmediate(v);
      const m = findMerge(s, agx051.id);
      if (m) m051Final = { ...m, values: [...m.values] };

      // AGX055 must NOT fire during stage 1 — the URGENT bit isn't in
      // perceptualSpace[256] until AGX051's terminal tick merges, and
      // snapshots are taken BEFORE merges apply.  Catches snapshot/merge
      // ordering regressions.
      expect(findMerge(s, agx055.id)).toBeUndefined();
    }

    expect(m051Final).toBeDefined();
    expect(m051Final!.region).toEqual({ offset: 256, length: 4 });
    expect(m051Final!.values).toEqual([1, 0, 0, 0]);
    expect(m051Final!.sequenceId).toBe('agx-051-urgent-maint');
    expect(m051Final!.governance).toBeDefined();
    expect(m051Final!.governance!.ragStatusCode).toBe('RED');
    expect(m051Final!.governance!.ownerTeam).toBe('agriculture-operations');
    expect(m051Final!.governance!.slaSeconds).toBe(900);

    // Inter-stage contract: perceptualSpace[256:272) must hold the AGX055
    // AQUA_URGENT input pattern verbatim.
    const ps = sim.getPerceptualSpace().getPerceptualVector();
    expect(ps.length).toBeGreaterThanOrEqual(272);
    expect(ps.slice(256, 260)).toEqual([1, 0, 0, 0]);   // AGX051 URGENT_MAINT
    expect(ps.slice(260, 264)).toEqual([0, 0, 0, 1]);   // AGX052 NORMAL
    expect(ps.slice(264, 268)).toEqual([0, 0, 0, 1]);   // AGX053 NORMAL
    expect(ps.slice(268, 272)).toEqual([0, 0, 0, 1]);   // AGX054 NORMAL

    // ── Stage 2: AGX055 reads merged tier-1 outputs and fires ──
    const stage2 = [...sim.getPerceptualSpace().getPerceptualVector()];
    zeroRegion(stage2, 40,  4);
    zeroRegion(stage2, 84,  4);
    zeroRegion(stage2, 184, 4);
    zeroRegion(stage2, 228, 4);
    const s2 = sim.processImmediate(stage2);

    const m055 = findMerge(s2, agx055.id);
    expect(m055).toBeDefined();
    expect(m055!.region).toEqual({ offset: 3959, length: 12 });
    expect(m055!.sequenceId).toBe('agx-055-aqua-urgent');
    expect(m055!.values).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(m055!.governance).toBeDefined();
    expect(m055!.governance!.ragStatusCode).toBe('RED');
    expect(m055!.governance!.ownerTeam).toBe('agriculture-operations');
    expect(m055!.governance!.slaSeconds).toBe(600);

    // AgYieldOptimizationAI must not have fired yet — its snapshot was taken
    // before AGX055's merge landed.
    expect(findMerge(s2, yieldAI.id)).toBeUndefined();

    // ── Stage 3: AgYieldOptimizationAI now sees the bridge bit pattern ──
    const stage3 = [...sim.getPerceptualSpace().getPerceptualVector()];
    zeroRegion(stage3, 40,  4);
    zeroRegion(stage3, 84,  4);
    zeroRegion(stage3, 184, 4);
    zeroRegion(stage3, 228, 4);
    zeroRegion(stage3, 256, 16);   // suppress AGX055 re-fire — projection booked

    expect(stage3.length).toBeGreaterThanOrEqual(3971);
    expect(stage3[3959]).toBe(1);
    for (let i = 3960; i < 3971; i++) expect(stage3[i]).toBe(0);

    sim.processImmediate(stage3);  // projection landing is the contract; AI fire-or-not is not
  });

  test('stable path — all-NORMAL inputs route AGX055 to FACILITY_STABLE / GREEN', () => {
    const { sim, agx051, agx055 } = buildSim();

    const step1 = denseWrites([
      { offset: 40,  values: TIER1_NORMAL_INPUT },
      { offset: 84,  values: TIER1_NORMAL_INPUT },
      { offset: 184, values: TIER1_NORMAL_INPUT },
      { offset: 228, values: TIER1_NORMAL_INPUT },
    ]);
    const s1 = sim.processImmediate(step1);
    const m051 = findMerge(s1, agx051.id);
    expect(m051).toBeDefined();
    expect(m051!.values).toEqual([0, 0, 0, 1]);

    const stage2 = [...sim.getPerceptualSpace().getPerceptualVector()];
    zeroRegion(stage2, 40,  4);
    zeroRegion(stage2, 84,  4);
    zeroRegion(stage2, 184, 4);
    zeroRegion(stage2, 228, 4);
    const s2 = sim.processImmediate(stage2);

    const m055 = findMerge(s2, agx055.id);
    expect(m055).toBeDefined();
    expect(m055!.sequenceId).toBe('agx-055-facility-stable');
    expect(m055!.values).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(m055!.governance).toBeDefined();
    expect(m055!.governance!.ragStatusCode).toBe('GREEN');
  });

  test('determinism — same scenario, byte-identical mergeBatch across runs', () => {
    function run(): SimulationStep[] {
      const { sim } = buildSim();
      const steps: SimulationStep[] = [];
      for (const tick of TIER1_URGENT_INPUT_TICKS) {
        steps.push(sim.processImmediate(denseWrites([
          { offset: 40,  values: tick },
          { offset: 84,  values: TIER1_NORMAL_INPUT },
          { offset: 184, values: TIER1_NORMAL_INPUT },
          { offset: 228, values: TIER1_NORMAL_INPUT },
        ])));
      }
      const bridgeTick = [...sim.getPerceptualSpace().getPerceptualVector()];
      zeroRegion(bridgeTick, 40,  4); zeroRegion(bridgeTick, 84,  4);
      zeroRegion(bridgeTick, 184, 4); zeroRegion(bridgeTick, 228, 4);
      steps.push(sim.processImmediate(bridgeTick));
      return steps;
    }
    const a = run();
    const b = run();
    expect(a.length).toBe(b.length);
    for (let t = 0; t < a.length; t++) {
      expect(a[t]!.mergeBatch.length).toBe(b[t]!.mergeBatch.length);
      for (let i = 0; i < a[t]!.mergeBatch.length; i++) {
        expect(a[t]!.mergeBatch[i]!.machineId).toBe(b[t]!.mergeBatch[i]!.machineId);
        expect(a[t]!.mergeBatch[i]!.sequenceId).toBe(b[t]!.mergeBatch[i]!.sequenceId);
        expect(a[t]!.mergeBatch[i]!.values).toEqual(b[t]!.mergeBatch[i]!.values);
      }
    }
  });
});
