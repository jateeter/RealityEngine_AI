import { describe, expect, test, jest } from '@jest/globals';
import { VectorStore } from '../VectorStore.js';
import { RealityVector } from '../../models/RealityVector.js';
import { ComparatorType } from '../../models/types.js';

function makeVector(values: number[], id = 'vec-1'): RealityVector {
  return new RealityVector(
    values.map(value => ({ value, comparatorType: ComparatorType.EQUALS })),
    true,
    id
  );
}

function makeClientMock() {
  return {
    getCollections: jest.fn(async () => ({ collections: [] })),
    createCollection: jest.fn(async () => undefined),
    upsert: jest.fn(async () => undefined),
    retrieve: jest.fn(async () => []),
    search: jest.fn(async () => []),
    delete: jest.fn(async () => undefined),
    getCollection: jest.fn(async () => ({ status: 'ok' }))
  };
}

describe('VectorStore', () => {
  test('initialize creates collection when missing', async () => {
    const store = new VectorStore();
    const client = makeClientMock();
    (store as any).client = client;
    (store as any).collectionName = 'test_vectors';
    (store as any).vectorDimension = 3;

    await store.initialize();

    expect(client.getCollections).toHaveBeenCalled();
    expect(client.createCollection).toHaveBeenCalledWith('test_vectors', {
      vectors: { size: 3, distance: 'Cosine' }
    });
  });

  test('storeVector normalizes vectors by padding to configured dimension', async () => {
    const store = new VectorStore();
    const client = makeClientMock();
    (store as any).client = client;
    (store as any).collectionName = 'test_vectors';
    (store as any).vectorDimension = 3;
    (store as any).initialized = true;

    await store.storeVector(makeVector([1, 2], 'pad-test'));

    const call = client.upsert.mock.calls[0];
    expect(call[0]).toBe('test_vectors');
    expect(call[1].points[0].vector).toEqual([1, 2, 0]);
  });

  test('getVector returns null when no record is found', async () => {
    const store = new VectorStore();
    const client = makeClientMock();
    client.retrieve.mockResolvedValueOnce([]);
    (store as any).client = client;
    (store as any).initialized = true;

    const result = await store.getVector('missing');
    expect(result).toBeNull();
  });

  test('searchSimilar throws when payload is missing in search result', async () => {
    const store = new VectorStore();
    const client = makeClientMock();
    client.search.mockResolvedValueOnce([{ score: 0.9, payload: null }]);
    (store as any).client = client;
    (store as any).initialized = true;

    await expect(store.searchSimilar([1, 2, 3], 1)).rejects.toThrow(/payload is missing/);
  });

  test('getSequence returns null on retrieval error', async () => {
    const store = new VectorStore();
    const client = makeClientMock();
    client.retrieve.mockRejectedValueOnce(new Error('read error'));
    (store as any).client = client;
    (store as any).collectionName = 'test_vectors';
    (store as any).initialized = true;

    const result = await store.getSequence('missing-seq');
    expect(result).toBeNull();
  });
});
