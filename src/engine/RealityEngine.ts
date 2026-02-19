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
interface MachineCheckpoint {
  id: string;
  machineId: string;
  machineName: string;
  label?: string;
  timestamp: number;
  snapshot: Machine;  // deep clone of the machine at checkpoint time
}

export class RealityEngine {
  private sequences: Map<string, CriticalEventSequence>;
  private machines: Map<string, Machine>;
  private vectorStore: VectorStore;
  private transitionHistory: TransitionResult[];
  private maxHistorySize: number;
  private preceptionEngine: PreceptionEngine;
  private universalDimension: number;
  /** checkpoints keyed by machineId → checkpointId → MachineCheckpoint */
  private checkpoints: Map<string, Map<string, MachineCheckpoint>>;
  /**
   * When true, a debug log entry is emitted after each machine completes its
   * processing cycle.  Callers assume fire-and-forget completion; this flag
   * provides an optional observability point without changing the async contract.
   */
  private verboseLogging: boolean;

  constructor(
    vectorStore: VectorStore,
    maxHistorySize: number = 1000,
    universalDimension: number = 256,
    verboseLogging: boolean = false
  ) {
    this.sequences = new Map();
    this.machines = new Map();
    this.vectorStore = vectorStore;
    this.transitionHistory = [];
    this.maxHistorySize = maxHistorySize;
    this.universalDimension = universalDimension;
    this.preceptionEngine = new PreceptionEngine(universalDimension);
    this.checkpoints = new Map();
    this.verboseLogging = verboseLogging;
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

    const mapping = machine.perceptualMapping;
    if (!mapping) {
      throw new Error(
        `Machine "${machine.name}" has no perceptual mapping — cannot route through PreceptionEngine. ` +
        `Configure a perceptual mapping for this machine or supply the full universal input space ` +
        `via POST /machines/${machineId}/process-universal.`
      );
    }

    if (inputVector.length !== mapping.input.length) {
      throw new Error(
        `Input vector length ${inputVector.length} does not match machine input region length ${mapping.input.length}`
      );
    }

    // Embed the machine-specific input vector into a zero-padded universal space
    // at the machine's registered input offset, then route through the PreceptionEngine
    // so every input participates in the unified perceptual resolution flow.
    const universalSpace = new Array(this.universalDimension).fill(0);
    for (let i = 0; i < inputVector.length; i++) {
      universalSpace[mapping.input.offset + i] = inputVector[i];
    }

    return this.processUniversalInput(universalSpace, machineId);
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

    // Merge each sequence's assertedOutputs individually into the authoritative
    // perceptual space, guarded by the arbiter's yes/no decision.
    // mergeMachineOutput constrains every write to [offset, offset+length) via
    // the output mapping, so no overflow is architecturally possible.
    const mapping = machine.perceptualMapping;
    if (result.arbiterMetadata.shouldOutput && mapping) {
      for (const seqResult of result.sequenceResults.values()) {
        for (const assertedOutput of seqResult.assertedOutputs) {
          this.preceptionEngine.mergeOutputIntoPerceptualSpace(assertedOutput.vector, mapping);
        }
      }
    }

    // Tag with machine metadata
    if (result.machineOutput) {
      result.machineOutput.metadata = {
        ...result.machineOutput.metadata,
        machineId,
        machineName: machine.name,
        preceptionUsed: true,
        universalSpaceDimension: universalInputSpace.length,
        outputMergedToPerceptualSpace: !!(result.arbiterMetadata.shouldOutput && mapping)
      };
    }

    if (this.verboseLogging) {
      console.debug(
        `[RealityEngine] machine=${machine.name} id=${machineId} ` +
        `sequencesWithOutput=${result.arbiterMetadata.sequencesWithOutput} ` +
        `shouldOutput=${result.arbiterMetadata.shouldOutput} ` +
        `ts=${result.timestamp}`
      );
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

    // Batch resolve inputs for all machines from the same universal space snapshot.
    // All machine inputs are captured before any machine runs, preserving
    // input-atomicity: no machine observes another machine's output as its input
    // within the same processing round.
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

        if (this.verboseLogging) {
          console.debug(
            `[RealityEngine] machine=${machine.name} id=${machineId} ` +
            `sequencesWithOutput=${result.arbiterMetadata.sequencesWithOutput} ` +
            `shouldOutput=${result.arbiterMetadata.shouldOutput} ` +
            `ts=${result.timestamp}`
          );
        }
      } catch (error: any) {
        console.error(`Error processing machine ${machineId}: ${error.message}`);
      }
    }

    // Merge all machine outputs back into the authoritative perceptual space
    // after ALL machines have finished (not during) to preserve input-atomicity.
    // Each assertedOutput from every qualifying sequence is written individually
    // via mergeMachineOutput, which constrains the write to the machine's
    // registered output region — overflow is architecturally impossible.
    for (const [machineId, result] of results) {
      const machine = this.machines.get(machineId);
      if (!machine?.perceptualMapping || !result.arbiterMetadata.shouldOutput) continue;

      const mapping = machine.perceptualMapping;
      try {
        for (const seqResult of result.sequenceResults.values()) {
          for (const assertedOutput of seqResult.assertedOutputs) {
            this.preceptionEngine.mergeOutputIntoPerceptualSpace(assertedOutput.vector, mapping);
          }
        }
        if (result.machineOutput) {
          result.machineOutput.metadata = {
            ...result.machineOutput.metadata,
            outputMergedToPerceptualSpace: true
          };
        }
      } catch (error: any) {
        console.error(`Failed to merge output for machine ${machineId}: ${error.message}`);
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

  // ── What-if Analytic Workflow ──────────────────────────────────────────────

  /**
   * Run a hypothetical input through a cloned copy of the machine without
   * mutating the machine's live event-sequence state.
   *
   * The clone becomes the head of the what-if workflow: the match algorithm
   * advances its internal state in exactly the same way it would advance the
   * live machine, but all mutations are confined to the clone.  The live
   * machine is completely unaffected.
   *
   * For a machine with a perceptual mapping use processUniversalWhatIf()
   * instead so the input is resolved through the PreceptionEngine first.
   *
   * @param machineId - ID of the machine to hypothesize against
   * @param inputVector - Machine-dimension input to apply to the clone
   */
  processWhatIf(machineId: string, inputVector: number[]): MachineTransitionResult {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${machineId}`);
    }
    return machine.clone().processInput(inputVector);
  }

  /**
   * Run a hypothetical universal-space input through a cloned machine via the
   * PreceptionEngine, without mutating the live machine's state.
   *
   * @param universalInputSpace - Full universal input vector (length == universalDimension)
   * @param machineId - ID of the machine to hypothesize against
   */
  processUniversalWhatIf(
    universalInputSpace: number[],
    machineId: string
  ): MachineTransitionResult {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${machineId}`);
    }
    const machineInput = this.preceptionEngine.resolveInputEventVectorForMachine(
      universalInputSpace,
      machine
    );
    return machine.clone().processInput(machineInput);
  }

  // ── Checkpoint / Rewind ────────────────────────────────────────────────────

  /**
   * Capture a named checkpoint of the machine's current event-sequence state.
   *
   * The checkpoint stores a full deep clone of the machine (all sequences and
   * their active-vector state) at the moment of the call.  Multiple checkpoints
   * can be taken per machine; each is retained until explicitly deleted or the
   * engine is restarted.
   *
   * Checkpoints are the foundation for temporal-rewind analytics: by restoring
   * a checkpoint you roll the machine's active-event progression back to any
   * previously captured moment, enabling branching "what happened after X?"
   * analysis without re-running the full input history.
   *
   * @param machineId - ID of the machine to checkpoint
   * @param label     - Optional human-readable label (e.g. "before fault injection")
   * @returns         - The generated checkpoint ID
   */
  createCheckpoint(machineId: string, label?: string): string {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${machineId}`);
    }
    const checkpointId = `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (!this.checkpoints.has(machineId)) {
      this.checkpoints.set(machineId, new Map());
    }
    this.checkpoints.get(machineId)!.set(checkpointId, {
      id: checkpointId,
      machineId,
      machineName: machine.name,
      ...(label !== undefined ? { label } : {}),
      timestamp: Date.now(),
      snapshot: machine.clone()
    });
    return checkpointId;
  }

  /**
   * List all checkpoints recorded for a machine.
   */
  listCheckpoints(machineId: string): Array<{
    id: string;
    machineId: string;
    machineName: string;
    label?: string;
    timestamp: number;
  }> {
    const bucket = this.checkpoints.get(machineId);
    if (!bucket) return [];
    return Array.from(bucket.values()).map(({ id, machineId, machineName, label, timestamp }) => ({
      id,
      machineId,
      machineName,
      ...(label !== undefined ? { label } : {}),
      timestamp
    }));
  }

  /**
   * Restore a machine to a previously captured checkpoint state.
   *
   * The checkpoint snapshot is re-cloned before restoration so the stored
   * checkpoint remains intact and can be restored again later (supporting
   * multi-branch rewind scenarios).
   *
   * The machine's entry in both this.machines and this.sequences is replaced
   * with the restored clone, ensuring the engine's sequence map stays coherent.
   *
   * @param machineId    - ID of the machine to restore
   * @param checkpointId - ID of the checkpoint to restore from
   */
  restoreCheckpoint(machineId: string, checkpointId: string): void {
    const checkpoint = this.checkpoints.get(machineId)?.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found for machine ${machineId}`);
    }
    // Remove the live machine (and its sequences) from the engine
    this.removeMachine(machineId);
    // Re-clone the snapshot so the stored checkpoint is preserved for future restores
    this.addMachine(checkpoint.snapshot.clone());
  }

  /**
   * Delete a specific checkpoint.
   */
  deleteCheckpoint(machineId: string, checkpointId: string): boolean {
    return this.checkpoints.get(machineId)?.delete(checkpointId) ?? false;
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
