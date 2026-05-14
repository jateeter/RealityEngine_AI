/**
 * PerceptualSpaceSimulator - Simulates reality vector flows through interconnected machines
 *
 * This simulator manages a shared perceptual space and orchestrates the flow of
 * reality vectors through multiple machines based on their perceptual mappings.
 */

import { PerceptualSpace } from '../models/PerceptualSpace.js';
import { Machine } from '../models/Machine.js';
import { PerceptualRegionAllocator } from '../services/PerceptualRegionAllocator.js';
import { CesCoverageRegistry } from '../services/CesCoverageRegistry.js';
import { resolveForOutput } from '../services/GovernanceResolver.js';
import type { PagingDecision } from '../services/GovernanceResolver.js';
import { ComparatorType } from '../models/types.js';
import type { MachineTransitionResult, DeprecationMark } from '../models/types.js';

/**
 * A single region write that occurred during the merge phase of a step.
 *
 * `mergeBatch` (the array of these on SimulationStep) is the authoritative
 * synchronization result — clients should apply these region writes to stay
 * in sync with the engine. The dense `perceptualSpace` field is a debug
 * projection of the post-merge state and is gated via `includePerceptualSpace`
 * when serialized to API consumers.
 *
 * Ordering: entries are sorted by (machineId, sequenceId, outputIndex) so
 * that AI and C++ runtimes produce byte-identical mergeBatch sequences for
 * the same input.
 */
export interface MergeOperation {
  region: { offset: number; length: number };
  machineId: string;
  sequenceId: string;
  outputIndex: number;
  values: number[];
  // Ordered vector IDs whose matches led to this output.  Lets listeners
  // expose the evidence trail that justified the assertion — e.g. a
  // clinician sees not just "RED fall" but the six-tick chain
  // ["fall-conf-v1", …, "fall-conf-v6"] behind it.
  provenance: string[];
  // Paging contract resolved from the machine's governance metadata —
  // owner team, SLA, runbook, escalation policy.  Present only when a
  // triggerConfig rule matches this output.  The CES JSON is the sole
  // source of truth — operators do NOT override this in alerting code.
  governance?: PagingDecision;
  // Stamped when the firing sequence carries metadata.deprecatedAt.  Lets
  // listeners and the visualizer surface stale CESs without re-deriving
  // from the machine JSON.  ageDays is computed at firing time.
  deprecation?: DeprecationMark;
}

/**
 * One latched bit on the event bus.  Emitted by the simulator after the
 * primary merge phase when a (producerMachineId, producerSequenceId) pair
 * fires while at least one machine has declared
 * `metadata.compose.subscriptions[*].producerSequenceId == that sequence`.
 *
 * The simulator writes `1.0` at `bitOffset` so the next step's snapshot
 * carries the producer's "fired" signal as an input bit to the subscribing
 * meta-machine — letting domain workflows be expressed as ordinary CESs
 * over the event bus.
 *
 * `provenance` is the producer's own provenance chain — i.e. how the
 * underlying leaf machine reached this output.  Subscribers (meta-machines)
 * see the bit; when *they* later assert their own output, the engine
 * extends provenance through their own sequence.  Cross-machine provenance
 * threading (linking meta output back to the producer chain) is a future
 * step — for now the per-machine chain is preserved at every layer.
 */
export interface EventBusWrite {
  producerMachineId: string;
  producerSequenceId: string;
  subscriberMachineId: string;
  bitOffset: number;
  value: number;
  provenance: string[];
}

export interface SimulationStep {
  stepNumber: number;
  timestamp: number;
  perceptualSpace: number[];
  machineResults: Map<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
    inputRegion: { offset: number; length: number };
    outputRegion: { offset: number; length: number } | null;
    transitionResult: MachineTransitionResult;
  }>;
  activeRegions: Array<{
    offset: number;
    length: number;
    machineId: string;
    type: 'input' | 'output';
  }>;
  mergeBatch: MergeOperation[];
  // Secondary writes triggered by the primary merge — one entry per
  // (subscriber, producer) where the producer fired this step.  Applied
  // to the perceptual space after mergeBatch so the next step's snapshot
  // sees the latched bit.  Empty when no subscriptions are active.
  eventBus: EventBusWrite[];
}

export interface SimulationConfig {
  inputSequence: number[][];  // Sequence of input vectors to apply to perceptual space
  inputRegion: { offset: number; length: number };  // Where to apply inputs
  stepDelayMs: number;  // Delay between steps in auto-play
  maxSteps?: number;  // Maximum steps before stopping
}

export class PerceptualSpaceSimulator {
  private perceptualSpace: PerceptualSpace;
  private machines: Map<string, Machine>;
  private history: SimulationStep[];
  private currentStep: number;
  private isRunning: boolean;
  private autoPlayTimer: NodeJS.Timeout | undefined;
  private config?: SimulationConfig;
  private onStepCompleteCallback?: (step: SimulationStep, perceptualSpaceVector: number[]) => void;
  private immediateStepCount = 0;
  private allocator: PerceptualRegionAllocator;
  // Bumped on every addMachine / removeMachine. Returned by
  // /api/runtime/vector-space so the C++ runtime, the visualizer, and any
  // external client can cache shape assumptions keyed by this number.
  private mappingVersionCounter = 0;
  // Operational-state coverage counters exposed at /metrics in Prometheus
  // text format.  Every per-machine transition feeds this registry so an
  // operator can see at a glance which sequences are never reached in prod.
  private cesCoverage = new CesCoverageRegistry();
  // Event-bus subscriptions — keyed by `producerMachineId|producerSequenceId`.
  // Populated when addMachine() sees a `metadata.compose.subscriptions` array;
  // consulted in run_phases() after the primary merge.  Lets meta-CES
  // machines listen for "this leaf sequence fired" without coupling at JSON
  // load time — producers don't know they're being subscribed to.
  private eventBusSubscriptions: Map<string, Array<{
    subscriberMachineId: string;
    bitOffset: number;
    producerMachineId: string;
    producerSequenceId: string;
  }>> = new Map();
  // Event-bus bits stay latched at 1.0 from the moment they fire until the
  // simulator is reset.  This captures the "benefits-eligible.fired" /
  // "intake-complete.fired" semantics — workflow milestones don't decay.
  // Re-applied at the top of every step so processImmediate's tolerant
  // setPerceptualVector (which zero-fills tail bits) doesn't clobber them.
  private latchedEventBits: Set<number> = new Set();

  /**
   * @param initialDimension  Starting PE space size (0 = fully dynamic; grows
   *                          automatically as machines are added).
   * @param allocator         Optional region allocator.  When provided, machines
   *                          without an explicit `perceptualMapping` receive
   *                          auto-assigned non-overlapping regions.
   */
  constructor(
    initialDimension = 0,
    allocator?: PerceptualRegionAllocator,
  ) {
    this.perceptualSpace = new PerceptualSpace(initialDimension);
    this.machines        = new Map();
    this.history         = [];
    this.currentStep     = 0;
    this.isRunning       = false;
    this.allocator       = allocator ?? new PerceptualRegionAllocator();
  }

  /**
   * Register a callback invoked after every completed step (manual or auto-play).
   * The callback receives the completed step and the full perceptual space vector
   * AFTER all machine outputs for that step have been merged into it.
   * Use this to propagate the evolved perceptual state to external systems
   * (e.g. the PreceptionEngine's authoritative space).
   */
  public setOnStepComplete(
    callback: (step: SimulationStep, perceptualSpaceVector: number[]) => void
  ): void {
    this.onStepCompleteCallback = callback;
  }

  /**
   * Current dimension of the shared perceptual space (En).
   * Grows automatically as machines are added; never decreases.
   */
  public getDimension(): number {
    return this.perceptualSpace.getDimension();
  }

  /**
   * The region allocator used to auto-assign PE coordinates to machines that
   * do not have an explicit `perceptualMapping` in their definition.
   */
  public getAllocator(): PerceptualRegionAllocator {
    return this.allocator;
  }

  /**
   * Add a machine to the simulation.
   *
   * If the machine has no `perceptualMapping`, the internal allocator assigns
   * non-overlapping input/output regions automatically using the machine's
   * `metadata.inputLength` and `metadata.outputLength` values (defaulting to
   * 32 each when absent).
   *
   * The PE space auto-expands to cover the machine's required regions.
   *
   * Machines are deterministic and atomic — applying the match algorithm to
   * active events and advancing their state is fully reproducible given the
   * same input sequence.  The simulator shares the same Machine instance as
   * the RealityEngine; no cloning is needed for normal operation.
   * Use Machine.clone() explicitly when starting a what-if analytic workflow.
   */
  public addMachine(machine: Machine): void {
    // Auto-allocate regions when no explicit mapping is present
    if (!machine.perceptualMapping) {
      const inputLength  = Number((machine.metadata?.['inputLength']  ?? 32));
      const outputLength = Number((machine.metadata?.['outputLength'] ?? inputLength));
      const mapping = this.allocator.allocate(inputLength, outputLength);
      machine.setPerceptualMapping(mapping);
      console.log(
        `[PE] Auto-allocated "${machine.name}": ` +
        `input [${mapping.input.offset}:${mapping.input.offset + mapping.input.length}), ` +
        `output [${mapping.output.offset}:${mapping.output.offset + mapping.output.length})`,
      );
    }

    // Expand the PE space to cover this machine's required coordinates
    const { input, output } = machine.perceptualMapping!;
    const required = Math.max(
      input.offset  + input.length,
      output.offset + output.length,
    );
    if (required > this.perceptualSpace.getDimension()) {
      const prev = this.perceptualSpace.getDimension();
      this.perceptualSpace.growTo(required);
      console.log(`[PE] Grew perceptual space ${prev} → ${required} for machine "${machine.name}"`);
    }

    this.machines.set(machine.id, machine);
    this.mappingVersionCounter++;

    // Compose / meta-CES subscriptions — a machine that declares
    // metadata.compose.subscriptions[i] = { producerMachineId,
    // producerSequenceId, bitOffset } is asking the simulator to latch a
    // 1.0 at bitOffset whenever that producer's sequence fires.  Lets a
    // domain workflow be expressed as a normal CES whose "events" come
    // from other machines' assertions.
    const compose = (machine.metadata as Record<string, unknown> | undefined)?.['compose'] as
      | { subscriptions?: Array<{ producerMachineId: string; producerSequenceId: string; bitOffset: number }> }
      | undefined;
    for (const sub of compose?.subscriptions ?? []) {
      if (typeof sub.bitOffset !== 'number' || sub.bitOffset < 0) continue;
      const key = `${sub.producerMachineId}|${sub.producerSequenceId}`;
      const list = this.eventBusSubscriptions.get(key) ?? [];
      list.push({
        subscriberMachineId: machine.id,
        bitOffset: sub.bitOffset,
        producerMachineId: sub.producerMachineId,
        producerSequenceId: sub.producerSequenceId,
      });
      this.eventBusSubscriptions.set(key, list);
      // Grow the PE space if the subscription bit lives past the current edge.
      if (sub.bitOffset + 1 > this.perceptualSpace.getDimension()) {
        this.perceptualSpace.growTo(sub.bitOffset + 1);
      }
    }
  }

  /**
   * Remove a machine from the simulation
   */
  public removeMachine(machineId: string): void {
    if (this.machines.delete(machineId)) this.mappingVersionCounter++;
    // Drop any subscriptions this machine owned so a future producer firing
    // doesn't try to write to a stale subscriber's bit offset.
    for (const [key, subs] of this.eventBusSubscriptions) {
      const kept = subs.filter(s => s.subscriberMachineId !== machineId);
      if (kept.length === 0) this.eventBusSubscriptions.delete(key);
      else this.eventBusSubscriptions.set(key, kept);
    }
  }

  /**
   * Max(offset + length) across every input and output mapping currently
   * registered. Returned by /api/runtime/vector-space so external clients
   * can detect a stale PE space.
   */
  public getRequiredDimension(): number {
    let required = 0;
    for (const machine of this.machines.values()) {
      const m = machine.perceptualMapping;
      if (!m) continue;
      required = Math.max(required, m.input.offset + m.input.length, m.output.offset + m.output.length);
    }
    return required;
  }

  /**
   * Monotonic counter bumped every time the registered machine set changes.
   * Mirrors PerceptualSpaceSimulator::mapping_version() in the C++ runtime.
   */
  public getMappingVersion(): number {
    return this.mappingVersionCounter;
  }

  /**
   * The CES coverage registry — accumulates per-(machine, sequence, vector)
   * match / activation / output counts.  Used by the /metrics endpoint.
   */
  public getCesCoverage(): CesCoverageRegistry {
    return this.cesCoverage;
  }

  /**
   * Number of registered event-bus subscriptions — used by tests + the
   * future /api/runtime/compose endpoint to introspect meta-CES wiring.
   */
  public getEventBusSubscriptionCount(): number {
    let n = 0;
    for (const list of this.eventBusSubscriptions.values()) n += list.length;
    return n;
  }

  /**
   * Apply event-bus subscriptions: for each mergeBatch entry, look up its
   * (producerMachineId, producerSequenceId) in the subscription map and
   * latch 1.0 at every subscriber's bitOffset.  Returns the canonical
   * sorted list of writes so the step result and downstream consumers see
   * deterministic ordering — same sort key shape as mergeBatch.
   */
  private applyEventBus(mergeBatch: MergeOperation[]): EventBusWrite[] {
    if (this.eventBusSubscriptions.size === 0) return [];
    const writes: EventBusWrite[] = [];
    // Dedup so a sequence that emits N outputs in one step doesn't write
    // the same bit N times — the bit is binary.
    const seen = new Set<string>();
    for (const op of mergeBatch) {
      const key = `${op.machineId}|${op.sequenceId}`;
      const subs = this.eventBusSubscriptions.get(key);
      if (!subs) continue;
      for (const sub of subs) {
        const dedupKey = `${sub.subscriberMachineId}|${sub.bitOffset}|${key}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        writes.push({
          producerMachineId: op.machineId,
          producerSequenceId: op.sequenceId,
          subscriberMachineId: sub.subscriberMachineId,
          bitOffset: sub.bitOffset,
          value: 1,
          provenance: op.provenance,
        });
        this.latchedEventBits.add(sub.bitOffset);
      }
    }
    writes.sort((a, b) => {
      if (a.subscriberMachineId !== b.subscriberMachineId) return a.subscriberMachineId < b.subscriberMachineId ? -1 : 1;
      if (a.bitOffset !== b.bitOffset) return a.bitOffset - b.bitOffset;
      if (a.producerMachineId !== b.producerMachineId) return a.producerMachineId < b.producerMachineId ? -1 : 1;
      return a.producerSequenceId < b.producerSequenceId ? -1 : a.producerSequenceId > b.producerSequenceId ? 1 : 0;
    });
    for (const w of writes) this.perceptualSpace.updateRegion(w.bitOffset, [w.value]);
    return writes;
  }

  /**
   * Get all machines in the simulation
   */
  public getMachines(): Machine[] {
    return Array.from(this.machines.values());
  }

  /**
   * Get the current perceptual space
   */
  public getPerceptualSpace(): PerceptualSpace {
    return this.perceptualSpace;
  }

  /**
   * Reset the simulation
   */
  public reset(): void {
    this.stop();
    this.perceptualSpace.reset();
    this.history = [];
    this.currentStep = 0;
    // Drop every latched event-bus bit — a fresh simulation starts with
    // no producer milestones reached.
    this.latchedEventBits.clear();

    // Reset all machines
    for (const machine of this.machines.values()) {
      machine.reset();
    }
  }

  /**
   * Configure and start the simulation
   */
  public configure(config: SimulationConfig): void {
    this.config = config;
    this.reset();
  }

  /**
   * Execute a single simulation step
   */
  public step(): SimulationStep | null {
    if (!this.config) {
      throw new Error('Simulation not configured. Call configure() first.');
    }

    // Check if we've reached the end of the input sequence
    if (this.currentStep >= this.config.inputSequence.length) {
      this.stop();
      return null;
    }

    // Check max steps
    if (this.config.maxSteps && this.currentStep >= this.config.maxSteps) {
      this.stop();
      return null;
    }

    // Apply the next input to the perceptual space
    const inputVector = this.config.inputSequence[this.currentStep];
    if (!inputVector) {
      this.stop();
      return null;
    }

    this.perceptualSpace.updateRegion(
      this.config.inputRegion.offset,
      inputVector
    );

    const mappedMachines = Array.from(this.machines.values()).filter(
      (m) => m.perceptualMapping !== undefined
    );

    // ── Phase 1: Snapshot ────────────────────────────────────────────────────
    // Extract every machine's input from the current perceptual space BEFORE
    // any machine runs.  This guarantees that all active event-match operations
    // observe the same perceptual state; no machine can observe another machine's
    // output as its input within the same step (input-atomicity).
    const inputSnapshots = new Map<string, number[]>();
    for (const machine of mappedMachines) {
      inputSnapshots.set(
        machine.id,
        this.perceptualSpace.extractMachineInput(machine.perceptualMapping!)
      );
    }

    // ── Phase 2: Process ─────────────────────────────────────────────────────
    // Run each machine with its snapshot input.  Collect transition results
    // and pending assertedOutputs without touching the perceptual space yet.
    const machineResults = new Map<string, any>();
    const pendingOutputs: Array<{ machine: Machine; sequenceId: string; outputIndex: number; vector: number[]; provenance: string[] }> = [];

    for (const machine of mappedMachines) {
      const snapshotInput = inputSnapshots.get(machine.id)!;
      const transitionResult = machine.processInput(snapshotInput);
      this.cesCoverage.recordTransition(machine, transitionResult);

      // Representative output for display purposes only.
      const outputVector = transitionResult.machineOutput?.vector ?? null;

      // Collect each sequence's individual assertedOutputs for Phase 3.
      // The arbiter's shouldOutput flag gates all writes for this machine.
      if (transitionResult.arbiterMetadata.shouldOutput) {
        for (const [sequenceId, seqResult] of transitionResult.sequenceResults) {
          for (let i = 0; i < seqResult.assertedOutputs.length; i++) {
            pendingOutputs.push({
              machine,
              sequenceId,
              outputIndex: i,
              vector: seqResult.assertedOutputs[i]!.vector,
              provenance: seqResult.assertedOutputs[i]!.provenance ?? [],
            });
          }
        }
      }

      machineResults.set(machine.id, {
        machineId: machine.id,
        machineName: machine.name,
        inputVector: snapshotInput,
        outputVector,
        inputRegion: {
          offset: machine.perceptualMapping!.input.offset,
          length: machine.perceptualMapping!.input.length
        },
        outputRegion: outputVector
          ? {
              offset: machine.perceptualMapping!.output.offset,
              length: machine.perceptualMapping!.output.length
            }
          : null,
        transitionResult
      });
    }

    // ── Phase 3: Merge ───────────────────────────────────────────────────────
    // Build the canonical mergeBatch — sorted by (machineId, sequenceId,
    // outputIndex) so AI and C++ runtimes apply writes in identical order.
    // mergeBatch is the authoritative synchronization result; the dense
    // perceptualSpace field below is a debug projection of the post-merge state.
    const mergeBatch: MergeOperation[] = pendingOutputs.map(({ machine, sequenceId, outputIndex, vector, provenance }) => {
      // Resolve the paging contract from the machine's governance metadata.
      // Returns null when no triggerConfig rule matches this output — that's
      // fine, paging is only relevant for outputs the machine explicitly
      // classified.  The decision is stamped onto the mergeBatch entry so
      // listeners read it from the same record as the asserted values.
      const governance = resolveForOutput(machine, sequenceId, vector);
      const op: MergeOperation = {
        region: { offset: machine.perceptualMapping!.output.offset, length: machine.perceptualMapping!.output.length },
        machineId: machine.id,
        sequenceId,
        outputIndex,
        values: vector,
        provenance,
      };
      if (governance) op.governance = governance;
      // Deprecation stamp — when the firing sequence carries deprecatedAt,
      // attach a small block so listeners can surface "this RED came from
      // a stale CES, scheduled for removal".  We pull the sequence
      // directly from the machine so the engine sees the authoritative
      // lifecycle fields (not metadata copies).
      const seq = machine.getSequence(sequenceId);
      if (seq?.isDeprecated()) {
        op.deprecation = {
          since:      seq.deprecatedAt!,
          ...(seq.replacedBy ? { replacedBy: seq.replacedBy } : {}),
          ageDays:    seq.daysSinceDeprecation(),
        };
      }
      return op;
    });
    // Canonical merge ordering: (machineId, sequenceId, outputIndex) ascending,
    // using byte-wise lex comparison (NOT localeCompare) so the result matches
    // C++ std::string::operator< exactly on ASCII identifiers.
    mergeBatch.sort((a, b) => {
      if (a.machineId !== b.machineId) return a.machineId < b.machineId ? -1 : 1;
      if (a.sequenceId !== b.sequenceId) return a.sequenceId < b.sequenceId ? -1 : 1;
      return a.outputIndex - b.outputIndex;
    });
    for (const op of mergeBatch) {
      this.perceptualSpace.updateRegion(op.region.offset, op.values.slice(0, op.region.length));
      if (op.governance) {
        // Count paging decisions so the /metrics endpoint exposes a
        // per-team / per-severity rate.  Lets the ops dashboard tell
        // "patient-safety-on-call paged 12 times this hour" at a glance.
        this.cesCoverage.recordPagingDecision({
          ownerTeam:     op.governance.ownerTeam,
          processStatus: op.governance.processStatus ?? 'unknown',
          ragStatusCode: op.governance.ragStatusCode ?? 'unknown',
          machineId:     op.machineId,
        });
      }
      if (op.deprecation) {
        // Bump the stale-CES counter and log one warning per fire — the
        // counter is the canonical signal; the log is a developer-friendly
        // breadcrumb during the deprecation window.
        const machine = this.machines.get(op.machineId);
        this.cesCoverage.recordDeprecatedFire({
          machineId:   op.machineId,
          machineName: machine?.name ?? op.machineId,
          sequenceId:  op.sequenceId,
          replacedBy:  op.deprecation.replacedBy,
        });
        console.warn(`[CES] deprecated sequence "${op.sequenceId}" on machine "${machine?.name ?? op.machineId}" fired (deprecatedAt=${op.deprecation.since}${op.deprecation.replacedBy ? `, replacedBy=${op.deprecation.replacedBy}` : ''}).`);
      }
    }

    // Phase 4: Event bus — for every (machineId, sequenceId) that just
    // fired, latch a 1.0 at the offsets that subscribers asked for.  The
    // next step's snapshot will carry these bits into the subscribers'
    // input regions, letting meta-CES machines run as ordinary CESs.
    const eventBus = this.applyEventBus(mergeBatch);

    // Build active region list from the final machineResults
    const activeRegions: Array<{
      offset: number;
      length: number;
      machineId: string;
      type: 'input' | 'output';
    }> = [];

    for (const [, entry] of machineResults) {
      activeRegions.push({
        offset: entry.inputRegion.offset,
        length: entry.inputRegion.length,
        machineId: entry.machineId,
        type: 'input'
      });
      if (entry.outputRegion) {
        activeRegions.push({
          offset: entry.outputRegion.offset,
          length: entry.outputRegion.length,
          machineId: entry.machineId,
          type: 'output'
        });
      }
    }

    // Create simulation step record
    const step: SimulationStep = {
      stepNumber: this.currentStep,
      timestamp: Date.now(),
      perceptualSpace: this.perceptualSpace.getPerceptualVector(),
      machineResults,
      activeRegions,
      mergeBatch,
      eventBus,
    };

    this.history.unshift(step); // Add to front (newest first)
    this.currentStep++;

    // Notify any registered listener with the completed step and the full
    // post-merge perceptual space vector so external systems (e.g. PreceptionEngine)
    // can stay in sync with the simulator's evolved perceptual state.
    if (this.onStepCompleteCallback) {
      this.onStepCompleteCallback(step, this.perceptualSpace.getPerceptualVector());
    }

    return step;
  }

  /**
   * Process a pre-assembled 256-byte perceptual vector immediately, bypassing
   * the configured input sequence. This is the entry point for the external
   * Perception Engine: the caller has already assembled the full reality vector
   * from heterogeneous sources and presents it here for machine processing.
   *
   * Mirrors the 3-phase snapshot→process→merge logic of step() but:
   * - Installs the caller-provided vector directly into the perceptual space
   * - Does not read or modify this.config, this.currentStep, or this.isRunning
   * - Uses a separate immediateStepCount counter for stepNumber
   * - Still fires onStepCompleteCallback so external systems stay in sync
   */
  public processImmediate(vector: number[], matchAlgorithmOverride?: ComparatorType): SimulationStep {
    this.perceptualSpace.setPerceptualVector(vector);
    // Re-apply any event-bus bits that have already fired in prior steps.
    // setPerceptualVector zero-fills bits past the caller's vector length,
    // and the caller usually doesn't know which bits the simulator latched.
    for (const bit of this.latchedEventBits) {
      if (bit < this.perceptualSpace.getDimension()) {
        this.perceptualSpace.updateRegion(bit, [1]);
      }
    }

    const mappedMachines = Array.from(this.machines.values()).filter(
      (m) => m.perceptualMapping !== undefined
    );

    // ── Phase 1: Snapshot ────────────────────────────────────────────────────
    const inputSnapshots = new Map<string, number[]>();
    for (const machine of mappedMachines) {
      inputSnapshots.set(
        machine.id,
        this.perceptualSpace.extractMachineInput(machine.perceptualMapping!)
      );
    }

    // ── Phase 2: Process ─────────────────────────────────────────────────────
    const machineResults = new Map<string, any>();
    const pendingOutputs: Array<{ machine: Machine; sequenceId: string; outputIndex: number; vector: number[]; provenance: string[] }> = [];

    for (const machine of mappedMachines) {
      const snapshotInput = inputSnapshots.get(machine.id)!;
      const transitionResult = machine.processInput(snapshotInput, matchAlgorithmOverride);
      this.cesCoverage.recordTransition(machine, transitionResult);

      const outputVector = transitionResult.machineOutput?.vector ?? null;

      if (transitionResult.arbiterMetadata.shouldOutput) {
        for (const [sequenceId, seqResult] of transitionResult.sequenceResults) {
          for (let i = 0; i < seqResult.assertedOutputs.length; i++) {
            pendingOutputs.push({
              machine,
              sequenceId,
              outputIndex: i,
              vector: seqResult.assertedOutputs[i]!.vector,
              provenance: seqResult.assertedOutputs[i]!.provenance ?? [],
            });
          }
        }
      }

      machineResults.set(machine.id, {
        machineId: machine.id,
        machineName: machine.name,
        inputVector: snapshotInput,
        outputVector,
        inputRegion: {
          offset: machine.perceptualMapping!.input.offset,
          length: machine.perceptualMapping!.input.length
        },
        outputRegion: outputVector
          ? {
              offset: machine.perceptualMapping!.output.offset,
              length: machine.perceptualMapping!.output.length
            }
          : null,
        transitionResult
      });
    }

    // ── Phase 3: Merge ───────────────────────────────────────────────────────
    // Canonical mergeBatch — same ordering rule as step(): sort by
    // (machineId, sequenceId, outputIndex). C++ applies the identical sort.
    const mergeBatch: MergeOperation[] = pendingOutputs.map(({ machine, sequenceId, outputIndex, vector, provenance }) => {
      // Resolve the paging contract from the machine's governance metadata.
      // Returns null when no triggerConfig rule matches this output — that's
      // fine, paging is only relevant for outputs the machine explicitly
      // classified.  The decision is stamped onto the mergeBatch entry so
      // listeners read it from the same record as the asserted values.
      const governance = resolveForOutput(machine, sequenceId, vector);
      const op: MergeOperation = {
        region: { offset: machine.perceptualMapping!.output.offset, length: machine.perceptualMapping!.output.length },
        machineId: machine.id,
        sequenceId,
        outputIndex,
        values: vector,
        provenance,
      };
      if (governance) op.governance = governance;
      // Deprecation stamp — when the firing sequence carries deprecatedAt,
      // attach a small block so listeners can surface "this RED came from
      // a stale CES, scheduled for removal".  We pull the sequence
      // directly from the machine so the engine sees the authoritative
      // lifecycle fields (not metadata copies).
      const seq = machine.getSequence(sequenceId);
      if (seq?.isDeprecated()) {
        op.deprecation = {
          since:      seq.deprecatedAt!,
          ...(seq.replacedBy ? { replacedBy: seq.replacedBy } : {}),
          ageDays:    seq.daysSinceDeprecation(),
        };
      }
      return op;
    });
    // Canonical merge ordering: (machineId, sequenceId, outputIndex) ascending,
    // using byte-wise lex comparison (NOT localeCompare) so the result matches
    // C++ std::string::operator< exactly on ASCII identifiers.
    mergeBatch.sort((a, b) => {
      if (a.machineId !== b.machineId) return a.machineId < b.machineId ? -1 : 1;
      if (a.sequenceId !== b.sequenceId) return a.sequenceId < b.sequenceId ? -1 : 1;
      return a.outputIndex - b.outputIndex;
    });
    for (const op of mergeBatch) {
      this.perceptualSpace.updateRegion(op.region.offset, op.values.slice(0, op.region.length));
      if (op.governance) {
        this.cesCoverage.recordPagingDecision({
          ownerTeam:     op.governance.ownerTeam,
          processStatus: op.governance.processStatus ?? 'unknown',
          ragStatusCode: op.governance.ragStatusCode ?? 'unknown',
          machineId:     op.machineId,
        });
      }
      if (op.deprecation) {
        const machine = this.machines.get(op.machineId);
        this.cesCoverage.recordDeprecatedFire({
          machineId:   op.machineId,
          machineName: machine?.name ?? op.machineId,
          sequenceId:  op.sequenceId,
          replacedBy:  op.deprecation.replacedBy,
        });
        console.warn(`[CES] deprecated sequence "${op.sequenceId}" on machine "${machine?.name ?? op.machineId}" fired (deprecatedAt=${op.deprecation.since}${op.deprecation.replacedBy ? `, replacedBy=${op.deprecation.replacedBy}` : ''}).`);
      }
    }

    // Phase 4 — see step() for the rationale.  Same event-bus latching
    // logic applies on the immediate-input code path.
    const eventBus = this.applyEventBus(mergeBatch);

    const activeRegions: Array<{
      offset: number;
      length: number;
      machineId: string;
      type: 'input' | 'output';
    }> = [];

    for (const [, entry] of machineResults) {
      activeRegions.push({
        offset: entry.inputRegion.offset,
        length: entry.inputRegion.length,
        machineId: entry.machineId,
        type: 'input'
      });
      if (entry.outputRegion) {
        activeRegions.push({
          offset: entry.outputRegion.offset,
          length: entry.outputRegion.length,
          machineId: entry.machineId,
          type: 'output'
        });
      }
    }

    const step: SimulationStep = {
      stepNumber: this.immediateStepCount++,
      timestamp: Date.now(),
      perceptualSpace: this.perceptualSpace.getPerceptualVector(),
      machineResults,
      activeRegions,
      mergeBatch,
      eventBus,
    };

    this.history.unshift(step);

    if (this.onStepCompleteCallback) {
      this.onStepCompleteCallback(step, this.perceptualSpace.getPerceptualVector());
    }

    return step;
  }

  /**
   * Start auto-play simulation
   */
  public start(): void {
    if (this.isRunning) return;
    if (!this.config) {
      throw new Error('Simulation not configured. Call configure() first.');
    }

    this.isRunning = true;
    this.autoPlay();
  }

  /**
   * Stop the simulation
   */
  public stop(): void {
    this.isRunning = false;
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = undefined;
    }
  }

  /**
   * Auto-play loop
   */
  private autoPlay(): void {
    if (!this.isRunning || !this.config) return;

    const stepResult = this.step();

    if (stepResult && this.isRunning) {
      this.autoPlayTimer = setTimeout(() => {
        this.autoPlay();
      }, this.config.stepDelayMs);
    } else {
      this.stop();
    }
  }

  /**
   * Get the current step number
   */
  public getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get simulation history
   */
  public getHistory(): SimulationStep[] {
    return this.history;
  }

  /**
   * Get a specific step from history
   */
  public getStep(stepNumber: number): SimulationStep | undefined {
    return this.history[stepNumber];
  }

  /**
   * Check if simulation is running
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get simulation configuration
   */
  public getConfig(): SimulationConfig | undefined {
    return this.config;
  }

  /**
   * Get machine graph data for visualization
   */
  public getMachineGraphData(): {
    nodes: Array<{
      id: string;
      name: string;
      description: string;
      inputMapping: { offset: number; length: number };
      outputMapping: { offset: number; length: number };
      metadata: Record<string, any>;
    }>;
    edges: Array<{
      source: string;
      target: string;
      sourceRegion: { offset: number; length: number };
      targetRegion: { offset: number; length: number };
      overlap: boolean;
    }>;
    perceptualSpaceDimension: number;
  } {
    const nodes = Array.from(this.machines.values()).map(machine => ({
      id: machine.id,
      name: machine.name,
      description: machine.description,
      inputMapping: machine.perceptualMapping!.input,
      outputMapping: machine.perceptualMapping!.output,
      metadata: machine.metadata
    }));

    // Detect edges (connections between machines based on overlapping regions)
    const edges: Array<{
      source: string;
      target: string;
      sourceRegion: { offset: number; length: number };
      targetRegion: { offset: number; length: number };
      overlap: boolean;
    }> = [];

    const machineList = Array.from(this.machines.values());
    for (let i = 0; i < machineList.length; i++) {
      const sourceM = machineList[i];
      if (!sourceM || !sourceM.perceptualMapping) continue;

      for (let j = 0; j < machineList.length; j++) {
        if (i === j) continue;
        const targetM = machineList[j];
        if (!targetM || !targetM.perceptualMapping) continue;

        // Check if source's output region overlaps with target's input region
        const sourceOutput = sourceM.perceptualMapping.output;
        const targetInput = targetM.perceptualMapping.input;

        const sourceEnd = sourceOutput.offset + sourceOutput.length;
        const targetEnd = targetInput.offset + targetInput.length;

        const overlaps = !(sourceEnd <= targetInput.offset || sourceOutput.offset >= targetEnd);

        if (overlaps) {
          edges.push({
            source: sourceM.id,
            target: targetM.id,
            sourceRegion: sourceOutput,
            targetRegion: targetInput,
            overlap: true
          });
        }
      }
    }

    return {
      nodes,
      edges,
      perceptualSpaceDimension: this.perceptualSpace.getDimension()
    };
  }

  /**
   * Serialize to JSON
   */
  public toJSON(): any {
    return {
      perceptualSpace: this.perceptualSpace.toJSON(),
      machines: Array.from(this.machines.values()).map(m => m.toJSON()),
      currentStep: this.currentStep,
      historyLength: this.history.length,
      isRunning: this.isRunning,
      config: this.config
    };
  }
}
