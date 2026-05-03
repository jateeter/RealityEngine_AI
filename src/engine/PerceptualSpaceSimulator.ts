/**
 * PerceptualSpaceSimulator - Simulates reality vector flows through interconnected machines
 *
 * This simulator manages a shared perceptual space and orchestrates the flow of
 * reality vectors through multiple machines based on their perceptual mappings.
 */

import { PerceptualSpace } from '../models/PerceptualSpace.js';
import { Machine } from '../models/Machine.js';
import { PerceptualRegionAllocator } from '../services/PerceptualRegionAllocator.js';
import { ComparatorType } from '../models/types.js';
import type { MachineTransitionResult } from '../models/types.js';

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
  }

  /**
   * Remove a machine from the simulation
   */
  public removeMachine(machineId: string): void {
    this.machines.delete(machineId);
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
    const pendingOutputs: Array<{ machine: Machine; vector: number[] }> = [];

    for (const machine of mappedMachines) {
      const snapshotInput = inputSnapshots.get(machine.id)!;
      const transitionResult = machine.processInput(snapshotInput);

      // Representative output for display purposes only.
      const outputVector = transitionResult.machineOutput?.vector ?? null;

      // Collect each sequence's individual assertedOutputs for Phase 3.
      // The arbiter's shouldOutput flag gates all writes for this machine.
      if (transitionResult.arbiterMetadata.shouldOutput) {
        for (const seqResult of transitionResult.sequenceResults.values()) {
          for (const assertedOutput of seqResult.assertedOutputs) {
            pendingOutputs.push({ machine, vector: assertedOutput.vector });
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
    // Write all pending assertedOutputs into the perceptual space after every
    // machine has finished processing.  Each write is constrained by the
    // machine's output mapping, making overflow architecturally impossible.
    // The merged outputs become visible only on the NEXT step (input-atomicity).
    for (const { machine, vector } of pendingOutputs) {
      this.perceptualSpace.mergeMachineOutput(vector, machine.perceptualMapping!);
    }

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
      activeRegions
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
    const pendingOutputs: Array<{ machine: Machine; vector: number[] }> = [];

    for (const machine of mappedMachines) {
      const snapshotInput = inputSnapshots.get(machine.id)!;
      const transitionResult = machine.processInput(snapshotInput, matchAlgorithmOverride);

      const outputVector = transitionResult.machineOutput?.vector ?? null;

      if (transitionResult.arbiterMetadata.shouldOutput) {
        for (const seqResult of transitionResult.sequenceResults.values()) {
          for (const assertedOutput of seqResult.assertedOutputs) {
            pendingOutputs.push({ machine, vector: assertedOutput.vector });
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
    for (const { machine, vector: outputVec } of pendingOutputs) {
      this.perceptualSpace.mergeMachineOutput(outputVec, machine.perceptualMapping!);
    }

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
      activeRegions
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
