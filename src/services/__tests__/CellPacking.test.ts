import { describe, it, expect } from '@jest/globals';
import {
  pack, unpack, asFloatView, fromFloatView,
  encodePackedBase64, decodePackedBase64,
  minBitsForValues, validateRange, storageFootprint,
} from '../CellPacking.js';

describe('CellPacking — minBitsForValues', () => {
  it('binary values fit in 1 bit', () => {
    expect(minBitsForValues([0, 1, 0, 1, 1])).toBe(1);
    expect(minBitsForValues([0])).toBe(1);
  });
  it('values up to 3 fit in 2 bits', () => {
    expect(minBitsForValues([0, 1, 2, 3])).toBe(2);
    expect(minBitsForValues([2])).toBe(2);
  });
  it('values 4..15 fit in 4 bits', () => {
    expect(minBitsForValues([0, 1, 4, 15])).toBe(4);
  });
  it('values 16..255 fit in 8 bits', () => {
    expect(minBitsForValues([0, 16, 100, 255])).toBe(8);
  });
  it('rejects negatives, non-finite, and >255', () => {
    expect(() => minBitsForValues([-1])).toThrow(RangeError);
    expect(() => minBitsForValues([NaN])).toThrow(RangeError);
    expect(() => minBitsForValues([256])).toThrow(RangeError);
  });
});

describe('CellPacking — validateRange', () => {
  it('passes when values fit', () => {
    expect(() => validateRange([0, 1], 1)).not.toThrow();
    expect(() => validateRange([0, 1, 2, 3], 2)).not.toThrow();
    expect(() => validateRange([15], 4)).not.toThrow();
  });
  it('throws when a cell would overflow', () => {
    expect(() => validateRange([2], 1)).toThrow(/0\.\.1/);
    expect(() => validateRange([4], 2)).toThrow(/0\.\.3/);
    expect(() => validateRange([0.5], 4)).toThrow(/does not fit/);
  });
});

describe('CellPacking — pack / unpack round-trips', () => {
  it('1-bit cells', () => {
    const vals = [1, 0, 1, 1, 0, 0, 1, 0, 1];
    const bytes = pack(vals, 1);
    expect(bytes.length).toBe(2);   // ceil(9/8)=2
    expect(unpack(bytes, vals.length, 1)).toEqual(vals);
  });
  it('2-bit cells', () => {
    const vals = [0, 1, 2, 3, 0, 1, 2, 3, 2];
    const bytes = pack(vals, 2);
    expect(bytes.length).toBe(3);   // ceil(9*2/8)=3
    // MSB-first: byte 0 = 00 01 10 11 = 0x1B
    expect(bytes[0]).toBe(0b00011011);
    expect(unpack(bytes, vals.length, 2)).toEqual(vals);
  });
  it('4-bit cells', () => {
    const vals = [0, 15, 8, 7, 1, 14];
    const bytes = pack(vals, 4);
    expect(bytes.length).toBe(3);
    expect(unpack(bytes, vals.length, 4)).toEqual(vals);
  });
  it('8-bit cells round-trip', () => {
    const vals = [0, 1, 127, 200, 255];
    const bytes = pack(vals, 8);
    expect(bytes.length).toBe(5);
    expect(Array.from(bytes)).toEqual(vals);
    expect(unpack(bytes, vals.length, 8)).toEqual(vals);
  });
  it('zero-length array round-trips', () => {
    expect(pack([], 4).length).toBe(0);
    expect(unpack(new Uint8Array(0), 0, 4)).toEqual([]);
  });
  it('rejects illegal bit widths', () => {
    expect(() => pack([0], 3 as any)).toThrow(/must be one of/);
    expect(() => unpack(new Uint8Array(1), 1, 5 as any)).toThrow(/must be one of/);
  });
});

describe('CellPacking — asFloatView / fromFloatView', () => {
  it('1-bit cells map to {0, 1}', () => {
    expect(asFloatView([0, 1, 1, 0], 1)).toEqual([0, 1, 1, 0]);
    expect(fromFloatView([0, 1, 1, 0], 1)).toEqual([0, 1, 1, 0]);
  });
  it('2-bit cells map to [0, 1] thirds', () => {
    expect(asFloatView([0, 1, 2, 3], 2)).toEqual([0, 1/3, 2/3, 1]);
    expect(fromFloatView([0, 1/3, 2/3, 1], 2)).toEqual([0, 1, 2, 3]);
  });
  it('4-bit cells normalize to fifteenths', () => {
    const back = fromFloatView(asFloatView([0, 5, 10, 15], 4), 4);
    expect(back).toEqual([0, 5, 10, 15]);
  });
  it('fromFloatView clamps and rounds', () => {
    expect(fromFloatView([-0.5, 0.3, 1.7, NaN], 2)).toEqual([0, 1, 3, 0]);
  });
});

describe('CellPacking — base64 transport', () => {
  it('round-trips through base64', () => {
    const vals = [0, 2, 3, 1, 0, 0, 1, 2, 3, 3, 2, 1];
    const encoded = encodePackedBase64(vals, 2);
    expect(typeof encoded).toBe('string');
    expect(decodePackedBase64(encoded, vals.length, 2)).toEqual(vals);
  });
});

describe('CellPacking — storageFootprint', () => {
  it('quotes the headline 4128-cell shrinkage from the spec', () => {
    // 4128 cells at 2 bpe = ceil(4128*2/8) = 1032 bytes packed vs
    // 4128 * 8 = 33024 bytes as float64 → 32× shrink.
    const fp = storageFootprint(4128, 2);
    expect(fp.float64Bytes).toBe(33024);
    expect(fp.packedBytes).toBe(1032);
    expect(fp.shrinkFactor).toBe(32);
  });
  it('1-bit cells give 64× shrink', () => {
    const fp = storageFootprint(4128, 1);
    expect(fp.shrinkFactor).toBeCloseTo(64, 1);
  });
});
