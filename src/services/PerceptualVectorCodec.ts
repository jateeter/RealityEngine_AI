/**
 * PerceptualVectorCodec
 *
 * Decouples the Perceptual Engine (PE) vector dimension N from the Qdrant
 * storage dimension (default 768).  Provides lossless serialization of an
 * N-length PE vector into a fixed-size Qdrant point and exact reconstruction
 * on retrieval.
 *
 *   Qdrant `vector` field  — STORAGE_DIM-dim segment-average fingerprint,
 *                             used purely for ANN similarity search.
 *   Qdrant `payload` field — verbatim N-dim vector (JSON array), used for
 *                             lossless reconstruction; opaque to callers.
 *
 * Usage:
 *   const { fingerprint, payload } = PerceptualVectorCodec.encode(myVector);
 *   // upsert { vector: fingerprint, payload: { ...otherFields, ...payload } }
 *
 *   const original = PerceptualVectorCodec.decode(qdrantPoint.payload);
 */
export class PerceptualVectorCodec {
  /** Must match the Qdrant collection schema dimension. */
  static readonly STORAGE_DIM = 768;

  private static readonly KEY_VECTOR  = '__pe_v';
  private static readonly KEY_DIM     = '__pe_dim';
  private static readonly KEY_VERSION = '__pe_codec';
  private static readonly VERSION     = 1;

  // ── Encode ─────────────────────────────────────────────────────────────────

  /**
   * Encode a PE vector of length N into a Qdrant-compatible representation.
   *
   * @param vector  Full N-dim perceptual-space vector (any N ≥ 0).
   * @returns       `fingerprint` — exactly STORAGE_DIM floats for the Qdrant
   *                               `vector` field (segment-average projection).
   *                `payload`    — fragment to merge into the Qdrant point payload;
   *                               carries the verbatim original for lossless recovery.
   */
  static encode(vector: number[]): {
    fingerprint: number[];
    payload: Record<string, unknown>;
  } {
    return {
      fingerprint: this.project(vector),
      payload: {
        [this.KEY_VECTOR]:  vector,
        [this.KEY_DIM]:     vector.length,
        [this.KEY_VERSION]: this.VERSION,
      },
    };
  }

  // ── Decode ─────────────────────────────────────────────────────────────────

  /**
   * Recover the exact original N-dim vector from a Qdrant point payload.
   * Returns `null` if the payload was not written by this codec.
   */
  static decode(payload: Record<string, unknown>): number[] | null {
    if (!this.isEncoded(payload)) return null;
    const v = payload[this.KEY_VECTOR];
    if (!Array.isArray(v)) return null;
    return v as number[];
  }

  /** Returns true when the payload was produced by `encode`. */
  static isEncoded(payload: Record<string, unknown>): boolean {
    return this.KEY_VERSION in payload && this.KEY_VECTOR in payload;
  }

  // ── Projection ─────────────────────────────────────────────────────────────

  /**
   * Project an N-dim vector to exactly STORAGE_DIM dimensions via
   * segment-average pooling.
   *
   *   N ≤ STORAGE_DIM : zero-padded — fingerprint equals input with no loss.
   *   N > STORAGE_DIM : each output dimension is the arithmetic mean of a
   *                     contiguous slice of the input.  Semantically meaningful
   *                     for ANN search; deterministic; requires no stored matrix.
   *
   * Exposed as a public static so callers can project query vectors for
   * similarity search without needing a full encode/decode round-trip.
   */
  static project(vector: number[]): number[] {
    const N = vector.length;
    if (N === 0) return new Array<number>(this.STORAGE_DIM).fill(0);

    if (N <= this.STORAGE_DIM) {
      const out = new Array<number>(this.STORAGE_DIM).fill(0);
      for (let i = 0; i < N; i++) out[i] = vector[i]!;
      return out;
    }

    const out = new Array<number>(this.STORAGE_DIM);
    for (let i = 0; i < this.STORAGE_DIM; i++) {
      const lo = Math.floor((i       * N) / this.STORAGE_DIM);
      const hi = Math.floor(((i + 1) * N) / this.STORAGE_DIM);
      let sum = 0;
      for (let j = lo; j < hi; j++) sum += vector[j]!;
      out[i] = sum / (hi - lo);
    }
    return out;
  }
}
