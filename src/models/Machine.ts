import { CriticalEventSequence } from './CriticalEventSequence.js';

/**
 * Machine - A collection of critical event sequences that work together
 *
 * A Machine represents a logical grouping of sequences that should be
 * visualized and processed together as a unified system.
 */
export class Machine {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  private sequences: Map<string, CriticalEventSequence>;
  public readonly metadata: Record<string, any>;

  constructor(name: string, description: string = '', metadata: Record<string, any> = {}) {
    this.id = `machine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.description = description;
    this.sequences = new Map();
    this.metadata = metadata;
  }

  /**
   * Add a critical event sequence to this machine
   */
  addSequence(sequence: CriticalEventSequence): void {
    this.sequences.set(sequence.id, sequence);
  }

  /**
   * Remove a sequence from this machine
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
   * Get all sequences in this machine
   */
  getAllSequences(): CriticalEventSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Get total number of sequences
   */
  getSequenceCount(): number {
    return this.sequences.size;
  }

  /**
   * Get total number of vectors across all sequences
   */
  getTotalVectorCount(): number {
    return this.getAllSequences().reduce(
      (total, seq) => total + seq.getAllVectors().length,
      0
    );
  }

  /**
   * Get all sequence IDs
   */
  getSequenceIds(): string[] {
    return Array.from(this.sequences.keys());
  }

  /**
   * Check if machine contains a sequence
   */
  hasSequence(sequenceId: string): boolean {
    return this.sequences.has(sequenceId);
  }

  /**
   * Serialize machine to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      sequenceCount: this.getSequenceCount(),
      totalVectors: this.getTotalVectorCount(),
      sequenceIds: this.getSequenceIds(),
      sequences: this.getAllSequences().map(seq => ({
        id: seq.id,
        name: seq.name
      })),
      metadata: this.metadata
    };
  }
}
