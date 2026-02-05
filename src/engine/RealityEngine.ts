import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { RealityVector } from '../models/RealityVector.js';
import { Machine } from '../models/Machine.js';
import type { OutputVector, MachineTransitionResult } from '../models/types.js';
import { VectorStore } from '../services/VectorStore.js';
import { PreceptionEngine } from './PreceptionEngine.js';

/**
 * TransitionResult: Result of processing an input through the engine
 */
export interface TransitionResult {
  inputVector: number[];
  timestamp: number;
  sequenceResults: Map<string, {
    matchedVectors: string[];
    activatedVectors: string[];
    assertedOutputs: OutputVector[];
  }>;
  totalOutputs: OutputVector[];
}

/**
 * RealityEngine: Core processing engine for Reality Vectors
 *
 * Responsibilities:
 * - Manage CriticalEventSequences
 * - Process InputRealityVectors through all sequences
 * - Coordinate transitions and activations
 * - Collect and assert OutputVectors
 * - Interface with VectorStore for persistence
 */
export class RealityEngine {
  private sequences: Map<string, CriticalEventSequence>;
  private machines: Map<string, Machine>;
  private vectorStore: VectorStore;
  private transitionHistory: TransitionResult[];
  private maxHistorySize: number;
  private preceptionEngine: PreceptionEngine;

  constructor(vectorStore: VectorStore, maxHistorySize: number = 1000, universalDimension: number = 256) {
    this.sequences = new Map();
    this.machines = new Map();
    this.vectorStore = vectorStore;
    this.transitionHistory = [];
    this.maxHistorySize = maxHistorySize;
    this.preceptionEngine = new PreceptionEngine(universalDimension);
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    console.log('RealityEngine initialized');
  }

  /**
   * Add a CriticalEventSequence to the engine
   */
  addSequence(sequence: CriticalEventSequence): void {
    const validation = sequence.validate();
    if (!validation.valid) {
      throw new Error(`Invalid sequence: ${validation.errors.join(', ')}`);
    }

    this.sequences.set(sequence.id, sequence);
    console.log(`Added sequence: ${sequence.name} (${sequence.id})`);
  }

  /**
   * Remove a sequence from the engine
   */
  removeSequence(sequenceId: string): boolean {
    return this.sequences.delete(sequenceId);
  }

  /**
   * Get a sequence by ID
   */
  getSequence(sequenceId: string): CriticalEventSequence | undefined {
    return this.sequences.get(sequenceId);
  }

  /**
   * Get all sequences
   */
  getAllSequences(): CriticalEventSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Add a Machine to the engine
   * This also adds all sequences from the machine
   */
  addMachine(machine: Machine): void {
    this.machines.set(machine.id, machine);

    // Add all sequences from the machine to the engine
    for (const sequence of machine.getAllSequences()) {
      this.addSequence(sequence);
    }

    console.log(`Added machine: ${machine.name} (${machine.id}) with ${machine.getSequenceCount()} sequences`);
  }

  /**
   * Remove a machine from the engine
   * This also removes all sequences from the machine
   */
  removeMachine(machineId: string): boolean {
    const machine = this.machines.get(machineId);
    if (!machine) {
      return false;
    }

    // Remove all sequences from the machine
    for (const sequenceId of machine.getSequenceIds()) {
      this.removeSequence(sequenceId);
    }

    return this.machines.delete(machineId);
  }

  /**
   * Get a machine by ID
   */
  getMachine(machineId: string): Machine | undefined {
    return this.machines.get(machineId);
  }

  /**
   * Get all machines
   */
  getAllMachines(): Machine[] {
    return Array.from(this.machines.values());
  }

  /**
   * Process an input through a specific machine (NEW 3-PHASE WORKFLOW)
   *
   * Implements the Reality Engine 3-phase workflow:
   * Phase 1: Resolve new input reality vector
   * Phase 2: Apply input to all active events
   * Phase 3: Resolve output reality vector via arbiter
   *
   * @param machineId - ID of the machine to process input through
   * @param inputVector - The input reality vector
   * @returns MachineTransitionResult with machine output
   */
  processMachineInput(machineId: string, inputVector: number[]): MachineTransitionResult {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${machineId}`);
    }

    // The machine handles the full 3-phase workflow
    const result = machine.processInput(inputVector);

    // Tag the machine output with machine metadata
    if (result.machineOutput) {
      result.machineOutput.metadata = {
        ...result.machineOutput.metadata,
        machineId,
        machineName: machine.name
      };
    }

    return result;
  }

  /**
   * Process universal input space through a specific machine (with Preception)
   *
   * This is the PRIMARY method for processing inputs through the Reality Engine.
   * It demonstrates "preception" - the engine perceives its context by resolving
   * the universal input space to machine-specific event vectors.
   *
   * Flow:
   * 1. PreceptionEngine.resolveInputEventVector() extracts machine-specific input
   * 2. Machine processes the resolved input through its sequences
   * 3. Machine arbiter resolves final output
   *
   * @param universalInputSpace - The 256-byte universal input vector
   * @param machineId - ID of the machine to process through
   * @returns MachineTransitionResult with resolved inputs and outputs
   */
  processUniversalInput(universalInputSpace: number[], machineId: string): MachineTransitionResult {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${machineId}`);
    }

    // PRECEPTION: Resolve universal space to machine-specific input
    const machineInput = this.preceptionEngine.resolveInputEventVectorForMachine(
      universalInputSpace,
      machine
    );

    // Process the resolved input through the machine
    const result = machine.processInput(machineInput);

    // Tag with machine metadata
    if (result.machineOutput) {
      result.machineOutput.metadata = {
        ...result.machineOutput.metadata,
        machineId,
        machineName: machine.name,
        preceptionUsed: true,
        universalSpaceDimension: universalInputSpace.length
      };
    }

    return result;
  }

  /**
   * Process universal input space through ALL machines (with Preception)
   *
   * Efficiently processes the universal input space through all machines.
   * Each machine "perceives" its relevant portion of the universal reality.
   *
   * @param universalInputSpace - The 256-byte universal input vector
   * @returns Map of machine ID to MachineTransitionResult
   */
  processUniversalInputForAllMachines(
    universalInputSpace: number[]
  ): Map<string, MachineTransitionResult> {
    const results = new Map<string, MachineTransitionResult>();

    // Batch resolve inputs for all machines
    const resolvedInputs = this.preceptionEngine.resolveInputsForMachines(
      universalInputSpace,
      this.machines
    );

    // Process each machine with its resolved input
    for (const [machineId, machineInput] of resolvedInputs) {
      const machine = this.machines.get(machineId);
      if (!machine) continue;

      try {
        const result = machine.processInput(machineInput);

        // Tag with machine metadata
        if (result.machineOutput) {
          result.machineOutput.metadata = {
            ...result.machineOutput.metadata,
            machineId,
            machineName: machine.name,
            preceptionUsed: true,
            universalSpaceDimension: universalInputSpace.length
          };
        }

        results.set(machineId, result);
      } catch (error: any) {
        console.error(`Error processing machine ${machineId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get diagnostic information about universal input mapping
   * Shows how the universal input space maps to each machine
   *
   * @param universalInputSpace - The 256-byte universal input vector
   * @returns Diagnostic information for visualization and debugging
   */
  getDiagnosticMapping(universalInputSpace: number[]): any {
    return this.preceptionEngine.getDiagnosticMapping(universalInputSpace, this.machines);
  }

  /**
   * Get the PreceptionEngine instance
   */
  getPreceptionEngine(): PreceptionEngine {
    return this.preceptionEngine;
  }

  /**
   * Process an InputRealityVector through all sequences (LEGACY)
   * This is the legacy entry point for backward compatibility
   * Consider using processUniversalInput() for new code with preception
   */
  processInput(inputVector: number[]): TransitionResult {
    const result: TransitionResult = {
      inputVector,
      timestamp: Date.now(),
      sequenceResults: new Map(),
      totalOutputs: []
    };

    // Process through each sequence
    for (const [sequenceId, sequence] of this.sequences) {
      const transitionResult = sequence.transition(inputVector);

      result.sequenceResults.set(sequenceId, {
        matchedVectors: transitionResult.matchedVectors,
        activatedVectors: transitionResult.activatedVectors,
        assertedOutputs: transitionResult.assertedOutputs
      });

      // Collect all output vectors and tag with sequence ID
      const taggedOutputs = transitionResult.assertedOutputs.map(output => ({
        ...output,
        metadata: {
          ...(typeof output.metadata === 'object' ? output.metadata : { description: output.metadata }),
          sequenceId,
          sequenceName: sequence.name
        }
      }));
      result.totalOutputs.push(...taggedOutputs);
    }

    // Store in history
    this.addToHistory(result);

    return result;
  }

  /**
   * Process multiple inputs in sequence
   */
  processInputSequence(inputVectors: number[][]): TransitionResult[] {
    return inputVectors.map(vector => this.processInput(vector));
  }

  /**
   * Get all active vectors across all sequences
   */
  getAllActiveVectors(): Map<string, RealityVector[]> {
    const activeVectors = new Map<string, RealityVector[]>();

    for (const [sequenceId, sequence] of this.sequences) {
      const active = sequence.getActiveVectors();
      if (active.length > 0) {
        activeVectors.set(sequenceId, active);
      }
    }

    return activeVectors;
  }

  /**
   * Reset all sequences to initial state
   */
  resetAllSequences(): void {
    for (const sequence of this.sequences.values()) {
      sequence.reset();
    }
    console.log('All sequences reset to initial state');
  }

  /**
   * Reset a specific sequence
   */
  resetSequence(sequenceId: string): boolean {
    const sequence = this.sequences.get(sequenceId);
    if (sequence) {
      sequence.reset();
      return true;
    }
    return false;
  }

  /**
   * Persist all sequences to vector store
   */
  async persistAllSequences(): Promise<void> {
    const promises = Array.from(this.sequences.values()).map(sequence =>
      this.vectorStore.storeSequence(sequence)
    );

    await Promise.all(promises);
    console.log(`Persisted ${this.sequences.size} sequences to vector store`);
  }

  /**
   * Load a sequence from vector store
   */
  async loadSequence(sequenceId: string): Promise<CriticalEventSequence | null> {
    const sequence = await this.vectorStore.getSequence(sequenceId);
    if (sequence) {
      this.addSequence(sequence);
    }
    return sequence;
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    totalSequences: number;
    totalVectors: number;
    totalActiveVectors: number;
    sequenceStats: Array<{
      id: string;
      name: string;
      stats: any;
    }>;
  } {
    let totalVectors = 0;
    let totalActiveVectors = 0;
    const sequenceStats = [];

    for (const sequence of this.sequences.values()) {
      const stats = sequence.getStats();
      totalVectors += stats.totalVectors;
      totalActiveVectors += stats.activeVectors;

      sequenceStats.push({
        id: sequence.id,
        name: sequence.name,
        stats
      });
    }

    return {
      totalSequences: this.sequences.size,
      totalVectors,
      totalActiveVectors,
      sequenceStats
    };
  }

  /**
   * Get transition history
   */
  getHistory(limit?: number): TransitionResult[] {
    if (limit) {
      return this.transitionHistory.slice(-limit);
    }
    return [...this.transitionHistory];
  }

  /**
   * Clear transition history
   */
  clearHistory(): void {
    this.transitionHistory = [];
  }

  /**
   * Add result to history with size management
   * Newest results are added to the front of the array (index 0)
   */
  private addToHistory(result: TransitionResult): void {
    this.transitionHistory.unshift(result); // Add to front (newest first)

    // Maintain max history size - trim from the end (oldest entries)
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Find vectors by search query
   */
  async searchVectors(
    queryVector: number[],
    limit: number = 10,
    threshold?: number
  ): Promise<Array<{ vector: RealityVector; score: number }>> {
    return await this.vectorStore.searchSimilar(queryVector, limit, threshold);
  }
}
