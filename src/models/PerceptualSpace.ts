import type { PerceptualMapping } from './types.js';

/**
 * PerceptualSpace: Manages the shared n-dimensional perceptual reality space (En)
 *
 * Architecture:
 * - Overall perceptual dimension n — dynamically expandable; grows to
 *   accommodate machine mappings as they are added to the universe.
 * - En: The complete event space representing our perception of reality.
 * - Machines view portions of En via offset/length mappings (Em).
 * - Machine outputs are merged back into En to update reality perception.
 *
 * Dimension management:
 *   growTo(n)            — expands the space to n, padding with zeros.
 *   setPerceptualVector  — auto-grows if the incoming vector is larger than
 *                          the current dimension; shorter vectors zero-fill
 *                          the tail so the full space is always defined.
 */
export class PerceptualSpace {
  private dimension:       number;
  private perceptualVector: number[];

  /**
   * @param dimension  Initial dimension (0 = fully dynamic; will grow on first use).
   */
  constructor(dimension = 0) {
    this.dimension        = dimension;
    this.perceptualVector = new Array<number>(dimension).fill(0);
  }

  // ── Dimension management ───────────────────────────────────────────────────

  /** Current dimension of the perceptual space. */
  public getDimension(): number {
    return this.dimension;
  }

  /**
   * Expand the perceptual space to `newDimension`, padding new elements with
   * zeros.  Calls with `newDimension ≤ this.dimension` are no-ops (never shrinks).
   */
  public growTo(newDimension: number): void {
    if (newDimension <= this.dimension) return;
    const added = new Array<number>(newDimension - this.dimension).fill(0);
    this.perceptualVector = [...this.perceptualVector, ...added];
    this.dimension        = newDimension;
  }

  // ── Vector access ──────────────────────────────────────────────────────────

  /** Return a copy of the full perceptual vector (En). */
  public getPerceptualVector(): number[] {
    return [...this.perceptualVector];
  }

  /**
   * Replace the perceptual vector.
   *
   * - `vector.length > dimension` → auto-grows before writing (non-destructive).
   * - `vector.length < dimension` → provided elements are written to [0, N);
   *   trailing dimensions are zeroed so the full space is always well-defined.
   * - `vector.length === dimension` → exact replacement (original behaviour).
   */
  public setPerceptualVector(vector: number[]): void {
    if (vector.length > this.dimension) {
      this.growTo(vector.length);
    }
    // Write provided elements
    for (let i = 0; i < vector.length; i++) {
      this.perceptualVector[i] = vector[i]!;
    }
    // Zero-fill tail (handles the shorter-vector case)
    for (let i = vector.length; i < this.dimension; i++) {
      this.perceptualVector[i] = 0;
    }
  }

  // ── Region I/O ─────────────────────────────────────────────────────────────

  /**
   * Extract machine input (Em) from perceptual space (En).
   * Maps a continuous portion of En to the machine's input space.
   */
  public extractMachineInput(mapping: PerceptualMapping): number[] {
    const { offset, length } = mapping.input;
    this.assertRegion('input', offset, length);
    return this.perceptualVector.slice(offset, offset + length);
  }

  /**
   * Merge machine output (Ox) back into perceptual space (En).
   * Integrates machine output into overall reality perception.
   */
  public mergeMachineOutput(outputVector: number[], mapping: PerceptualMapping): void {
    const { offset, length } = mapping.output;
    this.assertRegion('output', offset, length);
    if (outputVector.length !== length) {
      throw new Error(
        `Output vector length ${outputVector.length} does not match mapping length ${length}`,
      );
    }
    for (let i = 0; i < length; i++) {
      this.perceptualVector[offset + i] = outputVector[i]!;
    }
  }

  /**
   * Update a specific region of the perceptual space directly.
   */
  public updateRegion(offset: number, values: number[]): void {
    this.assertRegion('update', offset, values.length);
    for (let i = 0; i < values.length; i++) {
      this.perceptualVector[offset + i] = values[i]!;
    }
  }

  /**
   * Read a specific region of the perceptual space.
   */
  public getRegion(offset: number, length: number): number[] {
    this.assertRegion('read', offset, length);
    return this.perceptualVector.slice(offset, offset + length);
  }

  // ── State management ───────────────────────────────────────────────────────

  /**
   * Reset all dimensions to zero (does not change the current dimension).
   */
  public reset(): void {
    this.perceptualVector.fill(0);
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate a perceptual mapping against a given dimension.
   *
   * Note: with dynamic PE spaces, upper-bound violations are resolved by
   * calling `growTo` on the space before adding the machine.  This static
   * method still enforces non-negative offsets and positive lengths so that
   * obviously malformed mappings are caught early.
   */
  public static validateMapping(
    mapping:   PerceptualMapping,
    dimension: number,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (mapping.input.offset < 0) {
      errors.push(`Input offset ${mapping.input.offset} must be non-negative`);
    }
    if (mapping.input.length <= 0) {
      errors.push(`Input length ${mapping.input.length} must be positive`);
    }
    if (dimension > 0 && mapping.input.offset + mapping.input.length > dimension) {
      errors.push(
        `Input mapping [${mapping.input.offset}, ${mapping.input.offset + mapping.input.length}) ` +
        `exceeds dimension ${dimension}`,
      );
    }

    if (mapping.output.offset < 0) {
      errors.push(`Output offset ${mapping.output.offset} must be non-negative`);
    }
    if (mapping.output.length <= 0) {
      errors.push(`Output length ${mapping.output.length} must be positive`);
    }
    if (dimension > 0 && mapping.output.offset + mapping.output.length > dimension) {
      errors.push(
        `Output mapping [${mapping.output.offset}, ${mapping.output.offset + mapping.output.length}) ` +
        `exceeds dimension ${dimension}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  public toJSON(): { dimension: number; perceptualVector: number[] } {
    return {
      dimension:        this.dimension,
      perceptualVector: this.perceptualVector,
    };
  }

  public static fromJSON(json: { dimension: number; perceptualVector: number[] }): PerceptualSpace {
    const space = new PerceptualSpace(json.dimension);
    space.setPerceptualVector(json.perceptualVector);
    return space;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private assertRegion(label: string, offset: number, length: number): void {
    if (offset < 0) {
      throw new Error(`${label} offset ${offset} must be non-negative`);
    }
    if (offset >= this.dimension) {
      throw new Error(`${label} offset ${offset} is out of bounds [0, ${this.dimension})`);
    }
    if (offset + length > this.dimension) {
      throw new Error(
        `${label} region [${offset}, ${offset + length}) exceeds dimension ${this.dimension}`,
      );
    }
  }
}
