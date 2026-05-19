/**
 * CellPacking — narrow-cell representation for the perceptual space.
 *
 * The corpus's 1009 machines write into perceptual cells that are
 * almost always {0,1} or {0..3} — at most {0..15}.  A Float64 per cell
 * is ~64× the entropy needed.  Option A1 of the storage refactor:
 * each machine declares `perceptualMapping.bitsPerElement` (1, 2, 4,
 * or 8), the engine validates writes stay in range, and the API
 * boundary packs values for transmission.
 *
 * The engine's internal Float64 storage stays unchanged for now — the
 * blast radius of replacing it would touch every test.  The migration
 * proves the corpus values FIT in narrow cells (so a future refactor
 * is safe) and wire-format consumers get the savings immediately.
 *
 * Bit-packing layout — values are MSB-first within each byte so a
 * hex-dump reads left-to-right like the input vector.  Example for
 * `bitsPerElement: 2`, values = [0, 1, 2, 3, 0, 1]:
 *
 *   byte 0:  00 01 10 11   (0x1B)
 *   byte 1:  00 01 ?? ??   (top two cells set, bottom padded with 0)
 *
 * `pack(values, bits)` and `unpack(bytes, length, bits)` are exact
 * inverses for any values that fit in the declared width.
 */

const ALLOWED_BITS = [1, 2, 4, 8] as const;
export type BitsPerElement = typeof ALLOWED_BITS[number];

export function isAllowedBits(b: number): b is BitsPerElement {
  return (ALLOWED_BITS as readonly number[]).includes(b);
}

/**
 * Smallest bit width that can represent every value in `values` as a
 * non-negative integer ≤ 2^bits - 1.  Returns 1 for the trivial cases
 * and 8 for everything that doesn't fit smaller.  Throws if any value
 * is negative, non-finite, or exceeds 255 — those require a redesign,
 * not a wider cell.
 */
export function minBitsForValues(values: Iterable<number>): BitsPerElement {
  let max = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) throw new RangeError(`non-finite value: ${v}`);
    if (v < 0)               throw new RangeError(`negative value not representable in unsigned cell: ${v}`);
    if (v > 255)             throw new RangeError(`value ${v} exceeds 8-bit cell limit — needs schema redesign`);
    if (v > max) max = v;
  }
  if (max <= 1)   return 1;
  if (max <= 3)   return 2;
  if (max <= 15)  return 4;
  return 8;
}

/**
 * Throws if any value in `values` would overflow `bitsPerElement`
 * cells.  Callers (the migration tool, the API layer) use this to
 * reject machines whose declared width is smaller than the values
 * they actually emit.
 */
export function validateRange(values: ReadonlyArray<number>, bitsPerElement: BitsPerElement): void {
  const max = (1 << bitsPerElement) - 1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v))      throw new RangeError(`cell[${i}]=${v} is not finite`);
    if (v < 0 || v > max || !Number.isInteger(v))
      throw new RangeError(`cell[${i}]=${v} does not fit in ${bitsPerElement}-bit cell (range 0..${max})`);
  }
}

/**
 * Pack an array of small non-negative integers into a Uint8Array,
 * MSB-first within each byte.  Output length = ceil(values.length *
 * bitsPerElement / 8).  Last byte is zero-padded in the unused tail
 * bits — round-tripping through `unpack(..., values.length, bits)`
 * recovers the exact input.
 */
export function pack(values: ReadonlyArray<number>, bitsPerElement: BitsPerElement): Uint8Array {
  if (!isAllowedBits(bitsPerElement))
    throw new RangeError(`bitsPerElement must be one of ${ALLOWED_BITS.join(', ')}, got ${bitsPerElement}`);
  validateRange(values, bitsPerElement);

  const totalBits = values.length * bitsPerElement;
  const bytes = new Uint8Array(Math.ceil(totalBits / 8));
  if (bitsPerElement === 8) {
    for (let i = 0; i < values.length; i++) bytes[i] = values[i]!;
    return bytes;
  }
  const mask = (1 << bitsPerElement) - 1;
  for (let i = 0; i < values.length; i++) {
    const bitIdx = i * bitsPerElement;
    const byteIdx = bitIdx >> 3;
    const shift = 8 - bitsPerElement - (bitIdx & 7);
    bytes[byteIdx]! |= (values[i]! & mask) << shift;
  }
  return bytes;
}

/**
 * Inverse of `pack`.  `length` is the count of cells (not bytes) the
 * caller stored; we need it to know where to stop within the last byte's
 * zero-padding.
 */
export function unpack(bytes: Uint8Array, length: number, bitsPerElement: BitsPerElement): number[] {
  if (!isAllowedBits(bitsPerElement))
    throw new RangeError(`bitsPerElement must be one of ${ALLOWED_BITS.join(', ')}, got ${bitsPerElement}`);
  const required = Math.ceil((length * bitsPerElement) / 8);
  if (bytes.length < required)
    throw new RangeError(`bytes.length=${bytes.length} too small for ${length} cells at ${bitsPerElement} bpe (need ${required})`);

  const out = new Array<number>(length);
  if (bitsPerElement === 8) {
    for (let i = 0; i < length; i++) out[i] = bytes[i]!;
    return out;
  }
  const mask = (1 << bitsPerElement) - 1;
  for (let i = 0; i < length; i++) {
    const bitIdx = i * bitsPerElement;
    const byteIdx = bitIdx >> 3;
    const shift = 8 - bitsPerElement - (bitIdx & 7);
    out[i] = (bytes[byteIdx]! >>> shift) & mask;
  }
  return out;
}

/**
 * Visualizer "view as float" projection — the user-asked-for
 * mitigation for the heatmap losing its smooth gradient when cells
 * become narrow integers.  Upcasts each cell to [0, 1] by dividing by
 * the maximum representable value (e.g. 4-bit cells map 0/15..15/15).
 * 1-bit cells become exactly 0 or 1.
 */
export function asFloatView(values: ReadonlyArray<number>, bitsPerElement: BitsPerElement): number[] {
  const denom = (1 << bitsPerElement) - 1;
  if (denom === 0) return values.map(() => 0);
  return values.map(v => v / denom);
}

/** Inverse: quantize a float view back to integer cells. */
export function fromFloatView(values: ReadonlyArray<number>, bitsPerElement: BitsPerElement): number[] {
  const denom = (1 << bitsPerElement) - 1;
  return values.map(v => {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(denom, Math.round(v * denom)));
  });
}

/**
 * Helper for the API layer: encode a packed region for transport as a
 * base64 string.  We deliberately avoid hex (2× the payload) and JSON
 * arrays (which lose the packing benefit entirely).
 */
export function encodePackedBase64(values: ReadonlyArray<number>, bitsPerElement: BitsPerElement): string {
  const bytes = pack(values, bitsPerElement);
  // Buffer is the Node-friendly path; in browsers, btoa works on a
  // binary string.  Tests run in Node so Buffer is fine.
  return Buffer.from(bytes).toString('base64');
}

export function decodePackedBase64(s: string, length: number, bitsPerElement: BitsPerElement): number[] {
  const bytes = new Uint8Array(Buffer.from(s, 'base64'));
  return unpack(bytes, length, bitsPerElement);
}

/**
 * The byte savings claim from the user's note: a 4128-cell region in
 * float64 is 33,024 bytes; in 2-bit cells it's 1,032 bytes (32×
 * smaller).  This helper makes the comparison auditable from the API.
 */
export function storageFootprint(length: number, bitsPerElement: BitsPerElement): {
  float64Bytes: number;
  packedBytes: number;
  shrinkFactor: number;
} {
  const float64Bytes = length * 8;
  const packedBytes  = Math.ceil((length * bitsPerElement) / 8);
  return {
    float64Bytes,
    packedBytes,
    shrinkFactor: packedBytes === 0 ? 0 : float64Bytes / packedBytes,
  };
}
