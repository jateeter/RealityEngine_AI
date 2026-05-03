import type { PerceptualMapping } from '../models/types.js';

/**
 * PerceptualRegionAllocator
 *
 * Automatically assigns non-overlapping input and output regions within the
 * shared perceptual space (En) as machines are added to the universe.
 *
 * Machines with an explicit `perceptualMapping` in their JSON bypass this
 * allocator entirely — their coordinates are used as-is.  Machines without a
 * mapping (or with only `inputLength` / `outputLength` metadata keys) receive
 * automatically assigned regions advancing from the high-water mark.
 *
 * Per-machine layout (contiguous, no internal gap):
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  input  [hwm … hwm+inputLength)  │ output [hwm+iL … hwm+iL+oL) │
 *   └────────────────────────────────────────────────────────────────┘
 *   hwm advances to hwm + inputLength + outputLength after each call.
 *
 * Gaps and alignment are supported via `advance()` and `alignTo()`.
 */
export class PerceptualRegionAllocator {
  private hwm: number;

  /**
   * @param startOffset  First offset available for allocation (default 0).
   *                     Set to a non-zero value to reserve a prefix of the PE
   *                     space for static / externally assigned regions.
   */
  constructor(startOffset = 0) {
    if (startOffset < 0) throw new Error(`startOffset must be ≥ 0, got ${startOffset}`);
    this.hwm = startOffset;
  }

  // ── Core allocation ────────────────────────────────────────────────────────

  /**
   * Allocate a contiguous input+output region for one machine.
   *
   * @param inputLength   PE dimensions the machine reads  (> 0)
   * @param outputLength  PE dimensions the machine writes (> 0)
   * @returns             PerceptualMapping with non-overlapping regions.
   *                      The PE space will auto-expand to accommodate this
   *                      mapping when the machine is added to the simulator.
   */
  allocate(inputLength: number, outputLength: number): PerceptualMapping {
    if (inputLength  <= 0) throw new Error(`inputLength must be > 0, got ${inputLength}`);
    if (outputLength <= 0) throw new Error(`outputLength must be > 0, got ${outputLength}`);

    const inputOffset  = this.hwm;
    const outputOffset = this.hwm + inputLength;
    this.hwm           = outputOffset + outputLength;

    return {
      input:  { offset: inputOffset,  length: inputLength  },
      output: { offset: outputOffset, length: outputLength },
    };
  }

  // ── High-water mark management ─────────────────────────────────────────────

  /**
   * Advance the high-water mark by `by` positions without allocating.
   * Use this to skip reserved offsets or insert alignment gaps.
   */
  advance(by: number): void {
    if (by < 0) throw new Error(`advance() requires a non-negative value, got ${by}`);
    this.hwm += by;
  }

  /**
   * Align the high-water mark up to the next multiple of `alignment`.
   * Useful for cache-line or SIMD-friendly region boundaries.
   */
  alignTo(alignment: number): void {
    if (alignment <= 0) throw new Error(`alignment must be > 0, got ${alignment}`);
    const rem = this.hwm % alignment;
    if (rem !== 0) this.hwm += alignment - rem;
  }

  /** Current high-water mark — the next offset that can be allocated. */
  getHighWaterMark(): number { return this.hwm; }

  // ── Serialization ──────────────────────────────────────────────────────────

  toJSON(): { hwm: number } {
    return { hwm: this.hwm };
  }

  static fromJSON(json: { hwm: number }): PerceptualRegionAllocator {
    return new PerceptualRegionAllocator(json.hwm);
  }
}
