import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { RealityVector } from '../../models/RealityVector.js';
import { ComparatorType } from '../../models/types.js';

const mockClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  upsert: jest.fn(),
  retrieve: jest.fn(),
  search: jest.fn(),
  delete: jest.fn(),
  getCollection: jest.fn()
};

const QdrantClientMock = jest.fn(() => mockClient);

jest.unstable_mockModule('@qdrant/js-client-rest', () => ({
  QdrantClient: QdrantClientMock
}));

const { VectorStore } = await import('../VectorStore.js');

function resetClientMocks(): void {
  mockClient.getCollections.mockReset().mockResolvedValue({ collections: [] });
  mockClient.createCollection.mockReset().mockResolvedValue(undefined);
  mockClient.upsert.mockReset().mockResolvedValue(undefined);
  mockClient.retrieve.mockReset().mockResolvedValue([]);
  mockClient.search.mockReset().mockResolvedValue([]);
  mockClient.delete.mockReset().mockResolvedValue(undefined);
  mockClient.getCollection.mockReset().mockResolvedValue({ status: 'ok' });
  QdrantClientMock.mockClear();
}

function makeVector(values: number[], id = 'vec-1'): RealityVector {
  return new RealityVector(
    values.map(value => ({ value, comparatorType: ComparatorType.EQUALS })),
    true,
    id
  );
}

describe('VectorStore', () => {
  beforeEach(() => {
    resetClientMocks();
  });

  test('initialize creates collection when missing', async () => {
    const store = new VectorStore();
    (store as any).collectionName = 'test_vectors';
    (store as any).vectorDimension = 3;

    await store.initialize();

    expect(mockClient.getCollections).toHaveBeenCalled();
    expect(mockClient.createCollection).toHaveBeenCalledWith('test_vectors', {
      vectors: { size: 3, distance: 'Cosine' }
    });
  });

  test('storeVector normalizes vectors by padding to configured dimension', async () => {
    const store = new VectorStore();
    (store as any).collectionName = 'test_vectors';
    (store as any).vectorDimension = 3;
    (store as any).initialized = true;

    await store.storeVector(makeVector([1, 2], 'pad-test'));

    const call = mockClient.upsert.mock.calls[0];
    expect(call[0]).toBe('test_vectors');
    expect(call[1].points[0].vector).toEqual([1, 2, 0]);
  });

  test('getVector returns null when no record is found', async () => {
    const store = new VectorStore();
    (store as any).initialized = true;
    mockClient.retrieve.mockResolvedValueOnce([]);

    const result = await store.getVector('missing');
    expect(result).toBeNull();
  });

  test('searchSimilar throws when payload is missing in search result', async () => {
    const store = new VectorStore();
    (store as any).initialized = true;
    mockClient.search.mockResolvedValueOnce([{ score: 0.9, payload: null }]);

    await expect(store.searchSimilar([1, 2, 3], 1)).rejects.toThrow(/payload is missing/);
  });

  test('getSequence returns null on retrieval error', async () => {
    const store = new VectorStore();
    (store as any).collectionName = 'test_vectors';
    (store as any).initialized = true;
    mockClient.retrieve.mockRejectedValueOnce(new Error('read error'));

    const result = await store.getSequence('missing-seq');
    expect(result).toBeNull();
  });
});
