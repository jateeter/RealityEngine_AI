import type { OutputVector } from './types.js';

/**
 * ArbiterRule - Defines how the arbiter should combine outputs
 */
export enum ArbiterRule {
  AND = 'and',        // All sequences must produce output
  OR = 'or',          // At least one sequence must produce output
  PASSTHROUGH = 'passthrough'  // Pass all outputs through without logic
}

/**
 * ArbiterResult - Result of arbiter processing
 */
export interface ArbiterResult {
  shouldOutput: boolean;
  machineOutput: OutputVector | null;
  metadata: {
    rule: ArbiterRule;
    totalInputs: number;
    sequencesWithOutput: number;
    combinedOutputs: OutputVector[];
  };
}

/**
 * OutputArbiter - Manages the output stream generation flow
 *
 * When final events (vectors with outputs) match, this arbiter:
 * 1. Collects all outputs from matched final events
 * 2. Applies combinatorial logic (AND, OR, etc.)
 * 3. Generates the final machine output vector
 *
 * AND Logic: Machine produces output if and only if ALL sequences
 * that were active and matched during this input cycle produced outputs.
 *
 * The workflow is:
 * 1. Resolve new input reality vector
 * 2. Apply input to all active events (sequences)
 * 3. Resolve output reality vector of the machine (via arbiter)
 */
export class OutputArbiter {
  private rule: ArbiterRule;

  constructor(rule: ArbiterRule = ArbiterRule.AND) {
    this.rule = rule;
  }

  /**
   * Process sequence outputs and determine machine output
   *
   * @param sequenceOutputs - Map of sequence ID to outputs produced by that sequence
   * @param totalSequences - Total number of sequences in the machine
   * @returns ArbiterResult with machine output decision
   */
  public arbitrate(
    sequenceOutputs: Map<string, OutputVector[]>,
    totalSequences: number
  ): ArbiterResult {
    const combinedOutputs: OutputVector[] = [];
    let sequencesWithOutput = 0;

    // Collect all outputs from all sequences
    for (const outputs of sequenceOutputs.values()) {
      if (outputs.length > 0) {
        sequencesWithOutput++;
        combinedOutputs.push(...outputs);
      }
    }

    // Apply combinatorial logic based on rule
    let shouldOutput = false;
    let machineOutput: OutputVector | null = null;

    switch (this.rule) {
      case ArbiterRule.AND:
        // AND: Only produce output if ALL sequences produced output
        shouldOutput = sequencesWithOutput === totalSequences && totalSequences > 0;
        break;

      case ArbiterRule.OR:
        // OR: Produce output if AT LEAST ONE sequence produced output
        shouldOutput = sequencesWithOutput > 0;
        break;

      case ArbiterRule.PASSTHROUGH:
        // PASSTHROUGH: Always produce output if any outputs exist
        shouldOutput = combinedOutputs.length > 0;
        break;
    }

    // Generate machine output if conditions are met
    if (shouldOutput && combinedOutputs.length > 0) {
      machineOutput = this.combineOutputs(combinedOutputs);
    }

    return {
      shouldOutput,
      machineOutput,
      metadata: {
        rule: this.rule,
        totalInputs: totalSequences,
        sequencesWithOutput,
        combinedOutputs
      }
    };
  }

  /**
   * Return a representative OutputVector for API display purposes.
   *
   * The first output is used as the representative value stored in
   * MachineTransitionResult.machineOutput.  Its vector is NOT written to the
   * perceptual space here — that responsibility belongs entirely to the merge
   * sites (RealityEngine, PerceptualSpaceSimulator) which call
   * mergeMachineOutput once per assertedOutput.  The output mapping enforces
   * the region boundary there, so no N×M size blowup is possible.
   */
  private combineOutputs(outputs: OutputVector[]): OutputVector {
    const sources = outputs.map(o => o.id);
    const descriptions: string[] = [];

    for (const output of outputs) {
      if (output.metadata) {
        const desc = typeof output.metadata === 'object'
          ? output.metadata.description
          : output.metadata;
        if (desc) descriptions.push(desc as string);
      }
    }

    return {
      id: `machine-output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vector: outputs[0]!.vector,
      timestamp: Date.now(),
      metadata: {
        arbiter: true,
        combinedFrom: outputs.length,
        sources,
        ...(descriptions.length > 0 ? { descriptions } : {})
      }
    };
  }

  /**
   * Get the current arbiter rule
   */
  public getRule(): ArbiterRule {
    return this.rule;
  }

  /**
   * Set the arbiter rule
   */
  public setRule(rule: ArbiterRule): void {
    this.rule = rule;
  }
}
