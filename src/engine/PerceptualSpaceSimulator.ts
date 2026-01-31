/**
 * PerceptualSpaceSimulator - Simulates reality vector flows through interconnected machines
 *
 * This simulator manages a shared perceptual space and orchestrates the flow of
 * reality vectors through multiple machines based on their perceptual mappings.
 */

import { PerceptualSpace } from '../models/PerceptualSpace.js';
import { Machine } from '../models/Machine.js';
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

  constructor(dimension: number = 256) {
    this.perceptualSpace = new PerceptualSpace(dimension);
    this.machines = new Map();
    this.history = [];
    this.currentStep = 0;
    this.isRunning = false;
  }

  /**
   * Add a machine to the simulation
   */
  public addMachine(machine: Machine): void {
    if (!machine.perceptualMapping) {
      throw new Error(`Machine ${machine.name} does not have a perceptual mapping`);
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

    // Process through all machines in order (sorted by input offset)
    const sortedMachines = Array.from(this.machines.values()).sort((a, b) => {
      const offsetA = a.perceptualMapping?.input.offset ?? 0;
      const offsetB = b.perceptualMapping?.input.offset ?? 0;
      return offsetA - offsetB;
    });

    const machineResults = new Map<string, any>();
    const activeRegions: Array<{
      offset: number;
      length: number;
      machineId: string;
      type: 'input' | 'output';
    }> = [];

    for (const machine of sortedMachines) {
      if (!machine.perceptualMapping) continue;

      // Extract input for this machine
      const machineInput = this.perceptualSpace.extractMachineInput(machine.perceptualMapping);

      // Process through machine
      const transitionResult = machine.processInput(machineInput);

      // Record active input region
      activeRegions.push({
        offset: machine.perceptualMapping.input.offset,
        length: machine.perceptualMapping.input.length,
        machineId: machine.id,
        type: 'input'
      });

      // Merge output back if present
      let outputVector: number[] | null = null;
      let outputRegion: { offset: number; length: number } | null = null;

      if (transitionResult.machineOutput && transitionResult.machineOutput.vector) {
        outputVector = transitionResult.machineOutput.vector;
        this.perceptualSpace.mergeMachineOutput(
          outputVector,
          machine.perceptualMapping
        );

        // Record active output region
        outputRegion = {
          offset: machine.perceptualMapping.output.offset,
          length: machine.perceptualMapping.output.length
        };
        activeRegions.push({
          offset: machine.perceptualMapping.output.offset,
          length: machine.perceptualMapping.output.length,
          machineId: machine.id,
          type: 'output'
        });
      }

      machineResults.set(machine.id, {
        machineId: machine.id,
        machineName: machine.name,
        inputVector: machineInput,
        outputVector,
        inputRegion: {
          offset: machine.perceptualMapping.input.offset,
          length: machine.perceptualMapping.input.length
        },
        outputRegion,
        transitionResult
      });
    }

    // Create simulation step record
    const step: SimulationStep = {
      stepNumber: this.currentStep,
      timestamp: Date.now(),
      perceptualSpace: this.perceptualSpace.getPerceptualVector(),
      machineResults,
      activeRegions
    };

    this.history.push(step);
    this.currentStep++;

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
