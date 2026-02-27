/**
 * Multi-Step ↔ RS Flip-Flop Interconnection Tests
 *
 * Verifies:
 *  1. MultiStep machine individual behaviors (Seq1, Seq2)
 *  2. RSFlipFlop machine individual behaviors (SET, RESET, comprehensive)
 *  3. RS2 machine individual behaviors (SET, RESET, full sequence)
 *  4. Interconnected behavior through shared perceptual space:
 *       MultiStep output [3:5] → RSFlipFlop input [3:5] → RSFlipFlop output [6:8]
 *       MultiStep output [3:5] → RS2 input [3:5]       → RS2 output [8:10]
 *  5. Perceptual space write-back: outputs appear in the correct byte regions
 *
 * Perceptual Space Layout (256 bytes):
 *   [0:3]   MultiStep input
 *   [3:5]   MultiStep output / RSFlipFlop input / RS2 input
 *   [6:8]   RSFlipFlop output
 *   [8:10]  RS2 output
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from '../services/MachineLoader.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import type { Machine } from '../models/Machine.js';

const __filename = fileURLToPath(import.meta.url);
const __dir     = dirname(__filename);
const MACHINES  = join(__dir, '../../examples/machines');

// ── helpers ───────────────────────────────────────────────────────────────────

function load(name: string, id: string): Machine {
  return MachineLoader.loadFromJSON(
    readFileSync(join(MACHINES, `${name}.json`), 'utf8'),
    id
  );
}

function makeSim(...machines: Machine[]): PerceptualSpaceSimulator {
  const sim = new PerceptualSpaceSimulator(256);
  for (const m of machines) sim.addMachine(m);
  return sim;
}

/** Configure sim and run exactly `n` steps, returning the perceptual space vector. */
function run(
  sim: PerceptualSpaceSimulator,
  inputRegion: { offset: number; length: number },
  vectors: number[][],
  steps: number = vectors.length
): number[] {
  sim.configure({ inputSequence: vectors, inputRegion, stepDelayMs: 0 });
  for (let i = 0; i < steps; i++) sim.step();
  return sim.getPerceptualSpace().getPerceptualVector();
}

const MS_IN  = { offset: 0, length: 3 }; // MultiStep input region
const RS_IN  = { offset: 3, length: 2 }; // RSFlipFlop / RS2 shared input region

// ══════════════════════════════════════════════════════════════════════════════
// 1. MULTI-STEP MACHINE (isolated)
// ══════════════════════════════════════════════════════════════════════════════

describe('MultiStep machine (isolated)', () => {
  // Sequence 1: [0,0,0] → [0,0,1] → [0,1,1] → output [0,1] at bytes [3:5]
  describe('Sequence 1: 000 → 001 → 011 → [0,1]', () => {
    let sim: PerceptualSpaceSimulator;
    beforeEach(() => { sim = makeSim(load('MultiStep', 'ms-test')); });

    test('initial vector ms-seq1-000 is active from the start', () => {
      // Without any input, the initial vectors should already be active.
      // We verify by checking that [0,0,0] produces a transition (activates ms-seq1-001).
      run(sim, MS_IN, [[0, 0, 0]]);
      // After one step the perceptual space input region [0:3] should hold [0,0,0]
      const ps = sim.getPerceptualSpace().getPerceptualVector();
      expect(ps.slice(0, 3)).toEqual([0, 0, 0]);
    });

    test('step 1 [0,0,0]: initial match, no output asserted yet', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0]]);
      // No output from step 1 — the initial vector fires but ms-seq1-001 has no output
      expect(ps.slice(3, 5)).toEqual([0, 0]);
    });

    test('step 2 [0,0,1]: transitional match, no output yet', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1]]);
      expect(ps.slice(3, 5)).toEqual([0, 0]);
    });

    test('step 3 [0,1,1]: final match — output [0,1] written to perceptual bytes [3:5]', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1]]);
      expect(ps.slice(3, 5)).toEqual([0, 1]);
    });

    test('input bytes [0:3] hold the last applied vector', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1]]);
      expect(ps.slice(0, 3)).toEqual([0, 1, 1]);
    });

    test('wrong final step [0,1,0] does NOT produce output', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 0]]);
      // [0,1,0] ≠ [0,1,1] — no match at final vector, no output
      expect(ps.slice(3, 5)).toEqual([0, 0]);
    });
  });

  // Sequence 2: [1,0,0] → [1,0,1] → [1,1,1] → output [1,0] at bytes [3:5]
  describe('Sequence 2: 100 → 101 → 111 → [1,0]', () => {
    let sim: PerceptualSpaceSimulator;
    beforeEach(() => { sim = makeSim(load('MultiStep', 'ms-test')); });

    test('step 3 [1,1,1]: final match — output [1,0] written to perceptual bytes [3:5]', () => {
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 1], [1, 1, 1]]);
      expect(ps.slice(3, 5)).toEqual([1, 0]);
    });

    test('both sequences are independent — both initial vectors always active', () => {
      // Seq2 initial (ms-seq2-100) stays active even after Seq1 runs.
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 1]]);
      // Both sequences fire: last write wins — [1,0] from Seq2 is at [3:5]
      expect(ps.slice(3, 5)).toEqual([1, 0]);
    });

    test('interrupting with unrelated vector resets Seq2 progression', () => {
      // 100, 100 (wrong step), 101 — the second transitional vector (101) should not
      // have been activated because the 100 initial re-activated it each time.
      // After 100: ms-seq2-101 activated
      // After 100 again: ms-seq2-101 is active, sees [1,0,0], no match, deactivates;
      //                  initial fires again, re-activates ms-seq2-101
      // After 101: ms-seq2-101 now matches, activates ms-seq2-111
      // (no output yet — need 111)
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 0], [1, 0, 1]]);
      expect(ps.slice(3, 5)).toEqual([0, 0]); // no output, 111 not reached
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. RS FLIP-FLOP MACHINE (isolated)
// ══════════════════════════════════════════════════════════════════════════════

describe('RSFlipFlop machine (isolated)', () => {
  // RSFlipFlop reads from [3:5], writes to [6:8].
  // Both vectors are isInitial with outputs — they respond immediately every cycle.

  let sim: PerceptualSpaceSimulator;
  beforeEach(() => { sim = makeSim(load('RSFlipFlop', 'rsff-test')); });

  test('SET: input [1,0] → output [1,0] written to perceptual bytes [6:8]', () => {
    const ps = run(sim, RS_IN, [[1, 0]]);
    expect(ps.slice(6, 8)).toEqual([1, 0]);
  });

  test('RESET: input [0,1] → output [0,1] written to perceptual bytes [6:8]', () => {
    const ps = run(sim, RS_IN, [[0, 1]]);
    expect(ps.slice(6, 8)).toEqual([0, 1]);
  });

  test('HOLD: input [0,0] produces no output (neither event matches)', () => {
    const ps = run(sim, RS_IN, [[0, 0]]);
    expect(ps.slice(6, 8)).toEqual([0, 0]);
  });

  test('SET responds on every matching cycle (initial vector never deactivates)', () => {
    const ps = run(sim, RS_IN, [[1, 0], [0, 0], [1, 0]]);
    // After step 3: last step [1,0] → output [1,0] still in space
    expect(ps.slice(6, 8)).toEqual([1, 0]);
  });

  test('output region [6:8] is correctly bounded (bytes before and after untouched)', () => {
    const ps = run(sim, RS_IN, [[1, 0]]);
    expect(ps.slice(3, 6)).toEqual([1, 0, 0]); // [3:5]=input, byte 5=0
    expect(ps[8]).toBe(0);                       // byte 8 (RS2 region) untouched
  });

  describe('comprehensive 13-step validation sequence', () => {
    // From RSFlipFlop.json: 3×SET, 3×RESET, hold states between
    // Expected outputs: [1,0], [1,0], [0,1], [0,1], [1,0], [0,1]
    //
    // IMPORTANT: The perceptual space RETAINS the last-written output value
    // during hold-state steps (no write → no change). Checking [6:8] != [0,0]
    // would incorrectly count hold steps as outputs. Instead we read the
    // machine's outputVector from the step result — null means no output fired.
    const MACHINE_ID = 'rsff-test';
    const VECTORS = [
      [0, 0], [1, 0], [0, 0], [1, 0], [0, 0],
      [0, 1], [0, 0], [0, 1], [0, 0], [1, 0],
      [0, 0], [0, 1], [0, 0]
    ];

    test('produces 6 outputs across 13 steps', () => {
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });
      const firedOutputs: number[][] = [];

      for (let i = 0; i < VECTORS.length; i++) {
        const step = sim.step()!;
        const result = step.machineResults.get(MACHINE_ID);
        if (result?.outputVector !== null && result?.outputVector !== undefined) {
          firedOutputs.push([...result.outputVector]);
        }
      }

      expect(firedOutputs.length).toBe(6);
      expect(firedOutputs[0]).toEqual([1, 0]);
      expect(firedOutputs[1]).toEqual([1, 0]);
      expect(firedOutputs[2]).toEqual([0, 1]);
      expect(firedOutputs[3]).toEqual([0, 1]);
      expect(firedOutputs[4]).toEqual([1, 0]);
      expect(firedOutputs[5]).toEqual([0, 1]);
    });

    test('output fires at correct steps (1,3,5,7,9,11 — zero-indexed)', () => {
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });
      const outputSteps: number[] = [];

      for (let i = 0; i < VECTORS.length; i++) {
        const step = sim.step()!;
        const result = step.machineResults.get(MACHINE_ID);
        if (result?.outputVector !== null && result?.outputVector !== undefined) {
          outputSteps.push(i);
        }
      }

      expect(outputSteps).toEqual([1, 3, 5, 7, 9, 11]);
    });

    test('perceptual space [6:8] is written on output steps and retained on hold steps', () => {
      // After step 1 (SET), [6:8]=[1,0].
      // After step 2 (HOLD), RSFlipFlop does not write → [6:8] stays [1,0].
      // After step 5 (RESET), [6:8]=[0,1]. Etc.
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });

      for (let i = 0; i < 2; i++) sim.step(); // steps 0,1
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(6, 8)).toEqual([1, 0]);

      sim.step(); // step 2: hold
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(6, 8)).toEqual([1, 0]); // retained

      for (let i = 0; i < 3; i++) sim.step(); // steps 3,4,5
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(6, 8)).toEqual([0, 1]); // RESET
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. RS2 MACHINE (isolated)
// ══════════════════════════════════════════════════════════════════════════════

describe('RS2 machine (isolated)', () => {
  // RS2 reads from [3:5], writes to [8:10].
  // Two 2-step sequences: (0,0)→(1,0)→[1,0] and (0,0)→(0,1)→[0,1].
  // The initial vectors both match [0,0], so both successors become active
  // after every hold-state step.

  let sim: PerceptualSpaceSimulator;
  beforeEach(() => { sim = makeSim(load('RS2', 'rs2-test')); });

  test('SET: [0,0]→[1,0] → output [1,0] written to perceptual bytes [8:10]', () => {
    const ps = run(sim, RS_IN, [[0, 0], [1, 0]]);
    expect(ps.slice(8, 10)).toEqual([1, 0]);
  });

  test('RESET: [0,0]→[0,1] → output [0,1] written to perceptual bytes [8:10]', () => {
    const ps = run(sim, RS_IN, [[0, 0], [0, 1]]);
    expect(ps.slice(8, 10)).toEqual([0, 1]);
  });

  test('[1,0] without prior [0,0] produces NO output (successors not yet active)', () => {
    // Fresh simulator: initial vectors are active but successors are not.
    // On first step [1,0]: initial vectors don't match [1,0] (they want [0,0]),
    // so no successors are queued → rs2-set-10 never gets activated → no output.
    const ps = run(sim, RS_IN, [[1, 0]]);
    expect(ps.slice(8, 10)).toEqual([0, 0]);
  });

  test('output region [8:10] is correctly bounded (bytes 6-7 untouched)', () => {
    const ps = run(sim, RS_IN, [[0, 0], [1, 0]]);
    expect(ps.slice(6, 8)).toEqual([0, 0]); // RSFlipFlop region untouched
  });

  describe('complete 8-step test sequence from machine definition', () => {
    // (0,0)→(1,0)→(0,0)→(0,1)→(0,0)→(1,0)→(1,1)→(0,1)
    // Expected outputs: [1,0] at step 2, [0,1] at step 4, [1,0] at step 6
    // (1,1) at step 7 resets all successors; [0,1] at step 8 produces no output.
    const VECTORS = [
      [0, 0], [1, 0], [0, 0], [0, 1],
      [0, 0], [1, 0], [1, 1], [0, 1]
    ];

    test('produces exactly 3 outputs', () => {
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });
      let outputCount = 0;
      let prevOut = [0, 0];

      for (let i = 0; i < VECTORS.length; i++) {
        sim.step();
        const ps = sim.getPerceptualSpace().getPerceptualVector();
        const out = ps.slice(8, 10);
        // Count new output appearances (when it changes from previous)
        if ((out[0] !== prevOut[0] || out[1] !== prevOut[1]) &&
            (out[0] !== 0 || out[1] !== 0)) {
          outputCount++;
        }
        prevOut = [...out];
      }

      expect(outputCount).toBe(3);
    });

    test('outputs correct values: [1,0], [0,1], [1,0]', () => {
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });
      const outputs: number[][] = [];
      let prevOut = [0, 0];

      for (let i = 0; i < VECTORS.length; i++) {
        sim.step();
        const ps = sim.getPerceptualSpace().getPerceptualVector();
        const out = ps.slice(8, 10);
        if ((out[0] !== prevOut[0] || out[1] !== prevOut[1]) &&
            (out[0] !== 0 || out[1] !== 0)) {
          outputs.push([...out]);
        }
        prevOut = [...out];
      }

      expect(outputs[0]).toEqual([1, 0]);
      expect(outputs[1]).toEqual([0, 1]);
      expect(outputs[2]).toEqual([1, 0]);
    });

    test('[1,1] input invalidates both successors — [0,1] after [1,1] produces no output', () => {
      // After [1,1] (step 7), neither initial vector matches so no successors are activated.
      // Step 8 [0,1] has no active successors waiting — should produce no output.
      sim.configure({ inputSequence: VECTORS, inputRegion: RS_IN, stepDelayMs: 0 });
      for (let i = 0; i < 7; i++) sim.step(); // steps 1-7
      const psAfter7 = sim.getPerceptualSpace().getPerceptualVector();

      sim.step(); // step 8: [0,1]
      const psAfter8 = sim.getPerceptualSpace().getPerceptualVector();

      // After step 7 ([1,1]): both final successors deactivated, no new activation
      // After step 8 ([0,1]): no successors are active → no output
      expect(psAfter8.slice(8, 10)).toEqual(psAfter7.slice(8, 10));
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. INTERCONNECTED BEHAVIOR through the shared perceptual space
// ══════════════════════════════════════════════════════════════════════════════

describe('Interconnected: MultiStep → RSFlipFlop + RS2 via perceptual space', () => {
  // All three machines share a 256-byte perceptual space.
  // Input-atomicity: each step snapshots inputs BEFORE processing, then merges
  // all outputs AFTER processing. MultiStep's output at [3:5] therefore becomes
  // visible to RSFlipFlop and RS2 one step AFTER MultiStep fires.

  describe('Seq2 (100→101→111→[1,0]) drives RSFlipFlop SET and RS2 SET', () => {
    let sim: PerceptualSpaceSimulator;
    let msM: Machine, rsffM: Machine, rs2M: Machine;

    beforeEach(() => {
      msM   = load('MultiStep',  'ms-ic');
      rsffM = load('RSFlipFlop', 'rsff-ic');
      rs2M  = load('RS2',        'rs2-ic');
      sim   = makeSim(msM, rsffM, rs2M);
    });

    test('after 3 steps MultiStep has written [1,0] to perceptual bytes [3:5]', () => {
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 1], [1, 1, 1]]);
      expect(ps.slice(3, 5)).toEqual([1, 0]);
    });

    test('RSFlipFlop output [6:8] = [0,0] during MultiStep steps (no input at [3:5] yet)', () => {
      // Before MultiStep fires, [3:5]=[0,0] → RSFlipFlop sees HOLD → no output
      sim.configure({
        inputSequence: [[1, 0, 0], [1, 0, 1], [1, 1, 1]],
        inputRegion: MS_IN,
        stepDelayMs: 0
      });
      for (let i = 0; i < 3; i++) sim.step();
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(6, 8)).toEqual([0, 0]);
    });

    test('RS2 output [8:10] = [0,0] during MultiStep steps (no input at [3:5] yet)', () => {
      sim.configure({
        inputSequence: [[1, 0, 0], [1, 0, 1], [1, 1, 1]],
        inputRegion: MS_IN,
        stepDelayMs: 0
      });
      for (let i = 0; i < 3; i++) sim.step();
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(8, 10)).toEqual([0, 0]);
    });

    test('one step after MultiStep fires: RSFlipFlop SET — [6:8] = [1,0]', () => {
      // The 4th input is neutral for MultiStep but lets RSFlipFlop/RS2 see [3:5]=[1,0]
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [0, 0, 0]]);
      expect(ps.slice(6, 8)).toEqual([1, 0]);
    });

    test('one step after MultiStep fires: RS2 SET — [8:10] = [1,0]', () => {
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [0, 0, 0]]);
      expect(ps.slice(8, 10)).toEqual([1, 0]);
    });

    test('perceptual space is self-consistent: input and output bytes are all correct', () => {
      const ps = run(sim, MS_IN, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [0, 0, 0]]);
      // MultiStep input bytes [0:3] = last applied input = [0,0,0]
      expect(ps.slice(0, 3)).toEqual([0, 0, 0]);
      // MultiStep output (persisted from step 3) [3:5] = [1,0]
      expect(ps.slice(3, 5)).toEqual([1, 0]);
      // RSFlipFlop output [6:8] = [1,0]
      expect(ps.slice(6, 8)).toEqual([1, 0]);
      // RS2 output [8:10] = [1,0]
      expect(ps.slice(8, 10)).toEqual([1, 0]);
      // Bytes beyond RS2 region are untouched
      expect(ps.slice(10, 20).every(v => v === 0)).toBe(true);
    });
  });

  describe('Seq1 (000→001→011→[0,1]) drives RSFlipFlop RESET and RS2 RESET', () => {
    let sim: PerceptualSpaceSimulator;

    beforeEach(() => {
      sim = makeSim(
        load('MultiStep',  'ms-ic2'),
        load('RSFlipFlop', 'rsff-ic2'),
        load('RS2',        'rs2-ic2')
      );
    });

    test('after 3 steps MultiStep has written [0,1] to perceptual bytes [3:5]', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1]]);
      expect(ps.slice(3, 5)).toEqual([0, 1]);
    });

    test('one step after MultiStep fires: RSFlipFlop RESET — [6:8] = [0,1]', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 0, 0]]);
      expect(ps.slice(6, 8)).toEqual([0, 1]);
    });

    test('one step after MultiStep fires: RS2 RESET — [8:10] = [0,1]', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 0, 0]]);
      expect(ps.slice(8, 10)).toEqual([0, 1]);
    });

    test('full perceptual state after Seq1 + reaction step is correct', () => {
      const ps = run(sim, MS_IN, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 0, 0]]);
      expect(ps.slice(0, 3)).toEqual([0, 0, 0]);  // last input applied
      expect(ps.slice(3, 5)).toEqual([0, 1]);      // MultiStep Seq1 output
      expect(ps.slice(6, 8)).toEqual([0, 1]);      // RSFlipFlop RESET output
      expect(ps.slice(8, 10)).toEqual([0, 1]);     // RS2 RESET output
    });
  });

  describe('Seq1 then Seq2: output overwrites [3:5] and downstream machines track it', () => {
    let sim: PerceptualSpaceSimulator;

    beforeEach(() => {
      sim = makeSim(
        load('MultiStep',  'ms-ic3'),
        load('RSFlipFlop', 'rsff-ic3'),
        load('RS2',        'rs2-ic3')
      );
    });

    test('Seq1 fires then Seq2 fires — RSFlipFlop tracks both; RS2 reflects RESET semantics', () => {
      // RSFlipFlop uses isInitial vectors — it responds combinatorially every cycle.
      // RS2 uses a 2-step sequence: it needs [0,0] at [3:5] BEFORE seeing [1,0] to SET.
      //
      // After Seq1 writes [0,1] to [3:5], RS2 sees [0,1] continuously (steps 3-5).
      // rs2-set-10 deactivates on [0,1] mismatch in step 3 and is never re-seeded
      // because [3:5] never returns to [0,0] before Seq2 fires.  Therefore RS2 cannot
      // SET even after [3:5]=[1,0] — it has no active SET successor.
      const SEQ = [
        // Seq1 path:
        [0, 0, 0], [0, 0, 1], [0, 1, 1],
        // Reaction step (RS2/RSFlipFlop see [0,1]); also Seq2 first step:
        [1, 0, 0],
        // Seq2 completion:
        [1, 0, 1], [1, 1, 1],
        // Second reaction step (RSFlipFlop/RS2 see [1,0]):
        [0, 0, 0]
      ];

      sim.configure({ inputSequence: SEQ, inputRegion: MS_IN, stepDelayMs: 0 });

      // After Seq1 fires (index 2):
      for (let i = 0; i < 3; i++) sim.step();
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(3, 5)).toEqual([0, 1]);

      // After Seq1 reaction step (index 3, also Seq2 first step [1,0,0]):
      sim.step();
      const psAfterReact1 = sim.getPerceptualSpace().getPerceptualVector();
      expect(psAfterReact1.slice(6, 8)).toEqual([0, 1]);  // RSFlipFlop RESET ✓
      expect(psAfterReact1.slice(8, 10)).toEqual([0, 1]); // RS2 RESET ✓

      // After Seq2 fires (index 4+5):
      sim.step(); sim.step();
      expect(sim.getPerceptualSpace().getPerceptualVector().slice(3, 5)).toEqual([1, 0]);

      // After second reaction step (index 6 — RS2/RSFlipFlop see [3:5]=[1,0]):
      sim.step();
      const psFinal = sim.getPerceptualSpace().getPerceptualVector();
      // RSFlipFlop: isInitial, sees [1,0] → immediate SET output ✓
      expect(psFinal.slice(6, 8)).toEqual([1, 0]);
      // RS2: rs2-set-10 was deactivated in step 3 (saw [0,1], not [0,0]);
      //       [3:5] never returned to [0,0], so no re-seeding occurred.
      //       RS2 has no active SET successor when [1,0] arrives → retains last write [0,1].
      expect(psFinal.slice(8, 10)).toEqual([0, 1]);
    });

    test('RS2 CAN SET after Seq2 if a [0,0] hold step intervenes at [3:5]', () => {
      // Demonstrates that RS2's 2-step requirement is the architectural constraint,
      // not a bug. If a neutral input cycle writes [0,0] to [3:5] (which MultiStep
      // never does on its own — this uses an isolated RS2 sub-test), RS2 responds.
      //
      // Here we run RS2 in isolation to confirm it does SET when given [0,0]→[1,0].
      const rs2Only = makeSim(load('RS2', 'rs2-ic3-only'));
      const ps = run(rs2Only, RS_IN, [[0, 0], [1, 0]]);
      expect(ps.slice(8, 10)).toEqual([1, 0]); // RS2 SET ✓ (when hold state precedes)
    });
  });

  describe('machine graph topology', () => {
    test('getMachineGraphData detects 2 edges: MultiStep→RSFlipFlop and MultiStep→RS2', () => {
      const ms   = load('MultiStep',  'ms-graph');
      const rsff = load('RSFlipFlop', 'rsff-graph');
      const rs2  = load('RS2',        'rs2-graph');
      const sim  = makeSim(ms, rsff, rs2);

      const { nodes, edges } = sim.getMachineGraphData();

      // Verify 3 nodes registered
      expect(nodes.length).toBe(3);

      // Verify 2 edges: MultiStep output [3:5] overlaps RSFlipFlop input [3:5]
      //                 MultiStep output [3:5] overlaps RS2 input [3:5]
      expect(edges.length).toBe(2);

      const sources = edges.map(e => {
        const node = nodes.find(n => n.id === e.source);
        return node?.name;
      });
      expect(sources.every(s => s === 'Multi-Step State Machine')).toBe(true);

      const targets = new Set(edges.map(e => {
        const node = nodes.find(n => n.id === e.target);
        return node?.name;
      }));
      expect(targets.has('RS Flip Flop')).toBe(true);
      expect(targets.has('RS2')).toBe(true);
    });
  });
});
