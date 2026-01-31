import type { PerceptualMapping } from './types.js';

/**
 * PerceptualSpace: Manages the shared n-dimensional perceptual reality space (En)
 *
 * Architecture:
 * - Overall perceptual dimension n (default 256)
 * - En: The complete event space representing our perception of reality
 * - Machines view portions of En via offset/length mappings (Em)
 * - Machine outputs are merged back into En to update reality perception
 */
export class PerceptualSpace {
  private dimension: number;
  private perceptualVector: number[];

  constructor(dimension: number = 256) {
    this.dimension = dimension;
    this.perceptualVector = new Array(dimension).fill(0);
  }

  /**
   * Get the current perceptual vector (En)
   */
  public getPerceptualVector(): number[] {
    return [...this.perceptualVector];
  }

  /**
   * Set the entire perceptual vector
   */
  public setPerceptualVector(vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new Error(`Perceptual vector must be of dimension ${this.dimension}, got ${vector.length}`);
    }
    this.perceptualVector = [...vector];
  }

  /**
   * Extract machine input (Em) from perceptual space (En)
   * Maps a continuous portion of En to the machine's input space
   */
  public extractMachineInput(mapping: PerceptualMapping): number[] {
    const { offset, length } = mapping.input;

    // Validate mapping bounds
    if (offset < 0 || offset >= this.dimension) {
      throw new Error(`Input offset ${offset} is out of bounds [0, ${this.dimension})`);
    }
    if (offset + length > this.dimension) {
      throw new Error(`Input mapping [${offset}, ${offset + length}) exceeds dimension ${this.dimension}`);
    }

    // Extract the machine's view of reality
    return this.perceptualVector.slice(offset, offset + length);
  }

  /**
   * Merge machine output (Ox) back into perceptual space (En)
   * Integrates machine output into overall reality perception
   */
  public mergeMachineOutput(outputVector: number[], mapping: PerceptualMapping): void {
    const { offset, length } = mapping.output;

    // Validate mapping bounds
    if (offset < 0 || offset >= this.dimension) {
      throw new Error(`Output offset ${offset} is out of bounds [0, ${this.dimension})`);
    }
    if (offset + length > this.dimension) {
      throw new Error(`Output mapping [${offset}, ${offset + length}) exceeds dimension ${this.dimension}`);
    }
    if (outputVector.length !== length) {
      throw new Error(`Output vector length ${outputVector.length} does not match mapping length ${length}`);
    }

    // Merge output into perceptual space
    for (let i = 0; i < length; i++) {
      this.perceptualVector[offset + i] = outputVector[i]!;
    }
  }

  /**
   * Update a specific region of the perceptual space
   */
  public updateRegion(offset: number, values: number[]): void {
    if (offset < 0 || offset >= this.dimension) {
      throw new Error(`Offset ${offset} is out of bounds [0, ${this.dimension})`);
    }
    if (offset + values.length > this.dimension) {
      throw new Error(`Update region [${offset}, ${offset + values.length}) exceeds dimension ${this.dimension}`);
    }

    for (let i = 0; i < values.length; i++) {
      this.perceptualVector[offset + i] = values[i]!;
    }
  }

  /**
   * Get a region of the perceptual space
   */
  public getRegion(offset: number, length: number): number[] {
    if (offset < 0 || offset >= this.dimension) {
      throw new Error(`Offset ${offset} is out of bounds [0, ${this.dimension})`);
    }
    if (offset + length > this.dimension) {
      throw new Error(`Region [${offset}, ${offset + length}) exceeds dimension ${this.dimension}`);
    }

    return this.perceptualVector.slice(offset, offset + length);
  }

  /**
   * Reset perceptual space to zeros
   */
  public reset(): void {
    this.perceptualVector = new Array(this.dimension).fill(0);
  }

  /**
   * Get the dimension of the perceptual space
   */
  public getDimension(): number {
    return this.dimension;
  }

  /**
   * Validate a perceptual mapping
   */
  public static validateMapping(mapping: PerceptualMapping, dimension: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate input mapping
    if (mapping.input.offset < 0) {
      errors.push(`Input offset ${mapping.input.offset} must be non-negative`);
    }
    if (mapping.input.length <= 0) {
      errors.push(`Input length ${mapping.input.length} must be positive`);
    }
    if (mapping.input.offset + mapping.input.length > dimension) {
      errors.push(`Input mapping [${mapping.input.offset}, ${mapping.input.offset + mapping.input.length}) exceeds dimension ${dimension}`);
    }

    // Validate output mapping
    if (mapping.output.offset < 0) {
      errors.push(`Output offset ${mapping.output.offset} must be non-negative`);
    }
    if (mapping.output.length <= 0) {
      errors.push(`Output length ${mapping.output.length} must be positive`);
    }
    if (mapping.output.offset + mapping.output.length > dimension) {
      errors.push(`Output mapping [${mapping.output.offset}, ${mapping.output.offset + mapping.output.length}) exceeds dimension ${dimension}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Serialize to JSON
   */
  public toJSON(): any {
    return {
      dimension: this.dimension,
      perceptualVector: this.perceptualVector
    };
  }

  /**
   * Deserialize from JSON
   */
  public static fromJSON(json: any): PerceptualSpace {
    const space = new PerceptualSpace(json.dimension);
    space.setPerceptualVector(json.perceptualVector);
    return space;
  }
}
