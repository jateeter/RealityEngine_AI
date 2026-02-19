import type { PerceptualMapping } from '../models/types.js';
import { PerceptualSpace } from '../models/PerceptualSpace.js';
import type { Machine } from '../models/Machine.js';

/**
 * PreceptionEngine: Resolves universal input space to machine-specific event vectors
 *
 * The PreceptionEngine provides the "preception" capability - allowing the Reality Engine
 * to perceive its context through mapping a universal 256-byte input space to machine-specific
 * event vectors. This is the FIRST step in the event matching and output propagation flow.
 *
 * Key Concepts:
 * - Universal Input Space: A 256-byte vector representing the complete observable reality
 * - Preception: The process of extracting machine-relevant information from the universal space
 * - Resolution: Mapping the universal space to machine-specific input vectors via perceptualMapping
 *
 * Flow:
 * 1. Universal Input Space (256 bytes) arrives at PreceptionEngine
 * 2. For each machine, ResolveInputEventVector extracts relevant portion
 * 3. Extracted vector becomes the machine's input for event matching
 * 4. Machine processes its specific view of reality
 *
 * Example:
 * ```
 * Universal Space: [256 bytes with sensor data, network events, system state, ...]
 * Machine A mapping: { input: { offset: 0, length: 8 } }  → Extracts bytes [0-7] for temp/load
 * Machine B mapping: { input: { offset: 10, length: 3 } } → Extracts bytes [10-12] for signals
 * Machine C mapping: { input: { offset: 50, length: 2 } } → Extracts bytes [50-51] for binary
 * ```
 */
export class PreceptionEngine {
  private perceptualSpace: PerceptualSpace;
  private universalDimension: number;

  /**
   * Create a new PreceptionEngine
   * @param universalDimension - Dimension of the universal input space (default: 256)
   */
  constructor(universalDimension: number = 256) {
    this.universalDimension = universalDimension;
    this.perceptualSpace = new PerceptualSpace(universalDimension);
  }

  /**
   * ResolveInputEventVector: Extract machine-specific input from universal space
   *
   * This is the core "preception" operation - the Reality Engine "perceives"
   * its context by resolving the universal input space to machine-specific vectors.
   *
   * @param universalInputSpace - The complete 256-byte input vector
   * @param perceptualMapping - Machine's offset/length mapping
   * @returns Machine-specific input vector ready for event matching
   */
  public resolveInputEventVector(
    universalInputSpace: number[],
    perceptualMapping: PerceptualMapping
  ): number[] {
    // Validate universal input space dimension
    if (universalInputSpace.length !== this.universalDimension) {
      throw new Error(
        `Universal input space must be ${this.universalDimension} bytes, got ${universalInputSpace.length}`
      );
    }

    // Update perceptual space with new universal input
    this.perceptualSpace.setPerceptualVector(universalInputSpace);

    // Extract machine-specific input based on perceptual mapping
    const machineInput = this.perceptualSpace.extractMachineInput(perceptualMapping);

    return machineInput;
  }

  /**
   * ResolveInputEventVectorForMachine: Convenience method that takes a Machine object
   *
   * @param universalInputSpace - The complete 256-byte input vector
   * @param machine - Machine object with perceptualMapping
   * @returns Machine-specific input vector
   */
  public resolveInputEventVectorForMachine(
    universalInputSpace: number[],
    machine: Machine
  ): number[] {
    const mapping = machine.getPerceptualMapping();

    if (!mapping) {
      throw new Error(
        `Machine ${machine.name} does not have a perceptual mapping configured`
      );
    }

    return this.resolveInputEventVector(universalInputSpace, mapping);
  }

  /**
   * Resolve inputs for multiple machines from the same universal space
   * Efficient batch processing when multiple machines need to perceive the same reality
   *
   * @param universalInputSpace - The complete 256-byte input vector
   * @param machines - Map of machine ID to Machine object
   * @returns Map of machine ID to resolved input vector
   */
  public resolveInputsForMachines(
    universalInputSpace: number[],
    machines: Map<string, Machine>
  ): Map<string, number[]> {
    // Validate and set universal input space once
    if (universalInputSpace.length !== this.universalDimension) {
      throw new Error(
        `Universal input space must be ${this.universalDimension} bytes, got ${universalInputSpace.length}`
      );
    }

    this.perceptualSpace.setPerceptualVector(universalInputSpace);

    // Resolve input for each machine
    const resolvedInputs = new Map<string, number[]>();

    for (const [machineId, machine] of machines) {
      const mapping = machine.getPerceptualMapping();

      if (mapping) {
        try {
          const machineInput = this.perceptualSpace.extractMachineInput(mapping);
          resolvedInputs.set(machineId, machineInput);
        } catch (error: any) {
          console.error(
            `Failed to resolve input for machine ${machineId}: ${error.message}`
          );
          // Continue processing other machines
        }
      } else {
        console.warn(
          `Machine ${machineId} (${machine.name}) does not have perceptual mapping, skipping`
        );
      }
    }

    return resolvedInputs;
  }

  /**
   * Validate that a machine's perceptual mapping is compatible with universal space
   *
   * @param perceptualMapping - Machine's mapping configuration
   * @returns Validation result with errors if any
   */
  public validateMapping(perceptualMapping: PerceptualMapping): {
    valid: boolean;
    errors: string[];
  } {
    return PerceptualSpace.validateMapping(perceptualMapping, this.universalDimension);
  }

  /**
   * Get the current perceptual space (the last universal input processed)
   */
  public getPerceptualSpace(): PerceptualSpace {
    return this.perceptualSpace;
  }

  /**
   * Get the universal dimension
   */
  public getUniversalDimension(): number {
    return this.universalDimension;
  }

  /**
   * Merge a machine output vector back into the authoritative perceptual space.
   *
   * This is the output-integration half of the perceptual resolution cycle.
   * After a machine processes its input and produces an output vector, that
   * output must be written back into the perceptual space at the machine's
   * registered output region so that it becomes visible to subsequent inputs
   * and to other machines that share overlapping output/input regions.
   *
   * @param outputVector - The machine's output vector (length must equal mapping.output.length)
   * @param mapping - The machine's perceptual mapping (supplies output offset + length)
   */
  public mergeOutputIntoPerceptualSpace(outputVector: number[], mapping: PerceptualMapping): void {
    this.perceptualSpace.mergeMachineOutput(outputVector, mapping);
  }

  /**
   * Reset the perceptual space to zeros
   */
  public reset(): void {
    this.perceptualSpace.reset();
  }

  /**
   * Get a diagnostic view of how a universal input maps to machine inputs
   * Useful for debugging and visualization
   *
   * @param universalInputSpace - The complete 256-byte input vector
   * @param machines - Machines to analyze
   * @returns Diagnostic information showing the mapping
   */
  public getDiagnosticMapping(
    universalInputSpace: number[],
    machines: Map<string, Machine>
  ): {
    universalSpace: {
      dimension: number;
      nonZeroIndices: number[];
      nonZeroValues: { index: number; value: number }[];
    };
    machineMappings: Array<{
      machineId: string;
      machineName: string;
      inputMapping: { offset: number; length: number };
      resolvedInput: number[];
      universalIndices: number[];
    }>;
  } {
    // Analyze universal space
    const nonZeroIndices: number[] = [];
    const nonZeroValues: { index: number; value: number }[] = [];

    universalInputSpace.forEach((value, index) => {
      if (value !== 0) {
        nonZeroIndices.push(index);
        nonZeroValues.push({ index, value });
      }
    });

    // Resolve inputs for all machines
    const resolvedInputs = this.resolveInputsForMachines(universalInputSpace, machines);

    // Build machine mapping diagnostics
    const machineMappings = Array.from(machines.entries())
      .map(([machineId, machine]) => {
        const mapping = machine.getPerceptualMapping();
        if (!mapping) return null;

        const resolvedInput = resolvedInputs.get(machineId) || [];
        const { offset, length } = mapping.input;

        // List which universal indices map to this machine
        const universalIndices = Array.from({ length }, (_, i) => offset + i);

        return {
          machineId,
          machineName: machine.name,
          inputMapping: { offset, length },
          resolvedInput,
          universalIndices
        };
      })
      .filter((m) => m !== null) as Array<{
        machineId: string;
        machineName: string;
        inputMapping: { offset: number; length: number };
        resolvedInput: number[];
        universalIndices: number[];
      }>;

    return {
      universalSpace: {
        dimension: this.universalDimension,
        nonZeroIndices,
        nonZeroValues
      },
      machineMappings
    };
  }
}
