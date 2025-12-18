import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Reality Engine API
 * Tests the API endpoints running in Docker
 */

const API_BASE_URL = 'http://localhost:3000';

test.describe('Reality Engine API - Configuration', () => {
  test('should get current configuration', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/config`);
    expect(response.ok()).toBeTruthy();

    const config = await response.json();
    expect(config).toHaveProperty('vectorDimension');
    expect(config).toHaveProperty('matchThreshold');
    expect(config.vectorDimension).toBe(128);
  });
});

test.describe('Reality Engine API - Engine Stats', () => {
  test('should get engine statistics', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/engine/stats`);
    expect(response.ok()).toBeTruthy();

    const stats = await response.json();
    expect(stats).toHaveProperty('sequenceCount');
    expect(stats).toHaveProperty('totalVectors');
    expect(stats).toHaveProperty('activeVectors');
  });

  test('should get active vectors', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/engine/active`);
    expect(response.ok()).toBeTruthy();

    const active = await response.json();
    expect(Array.isArray(active)).toBeTruthy();
  });

  test('should get transition history', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/engine/history?limit=10`);
    expect(response.ok()).toBeTruthy();

    const history = await response.json();
    expect(Array.isArray(history)).toBeTruthy();
  });
});

test.describe('Reality Engine API - Vectors', () => {
  test('should create a new vector', async ({ request }) => {
    const vectorData = {
      elements: [
        { value: 0.5, comparatorType: 'threshold', threshold: 0.1 },
        { value: 0.8, comparatorType: 'equals' }
      ],
      isInitial: true
    };

    const response = await request.post(`${API_BASE_URL}/api/vectors`, {
      data: vectorData
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('elements');
  });

  test('should search for similar vectors', async ({ request }) => {
    const searchData = {
      vector: [0.5, 0.8],
      limit: 5,
      threshold: 0.85
    };

    const response = await request.post(`${API_BASE_URL}/api/vectors/search`, {
      data: searchData
    });

    // May return 404 if no vectors stored yet, which is okay
    if (response.ok()) {
      const results = await response.json();
      expect(Array.isArray(results)).toBeTruthy();
    } else {
      expect([200, 404]).toContain(response.status());
    }
  });
});

test.describe('Reality Engine API - Sequences', () => {
  let sequenceId: string;

  test('should get all sequences', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/sequences`);
    expect(response.ok()).toBeTruthy();

    const sequences = await response.json();
    expect(Array.isArray(sequences)).toBeTruthy();
  });

  test('should create a new sequence', async ({ request }) => {
    const sequenceData = {
      name: 'E2E Test Sequence',
      vectors: [
        {
          elements: [
            { value: 0.5, comparatorType: 'threshold', threshold: 0.1 }
          ],
          isInitial: true,
          nextVectorIds: ['test-vector-2'],
          outputVectors: []
        },
        {
          id: 'test-vector-2',
          elements: [
            { value: 0.8, comparatorType: 'threshold', threshold: 0.1 }
          ],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'output-1',
              vector: [1.0, 0.5],
              timestamp: Date.now()
            }
          ]
        }
      ]
    };

    const response = await request.post(`${API_BASE_URL}/api/sequences`, {
      data: sequenceData
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toHaveProperty('id');
    sequenceId = result.id;
  });

  test('should get specific sequence', async ({ request }) => {
    if (!sequenceId) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_BASE_URL}/api/sequences/${sequenceId}`);
    expect(response.ok()).toBeTruthy();

    const sequence = await response.json();
    expect(sequence.id).toBe(sequenceId);
    expect(sequence.name).toBe('E2E Test Sequence');
  });

  test('should reset sequence', async ({ request }) => {
    if (!sequenceId) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_BASE_URL}/api/sequences/${sequenceId}/reset`);
    expect(response.ok()).toBeTruthy();
  });

  test('should delete sequence', async ({ request }) => {
    if (!sequenceId) {
      test.skip();
      return;
    }

    const response = await request.delete(`${API_BASE_URL}/api/sequences/${sequenceId}`);
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Reality Engine API - Processing', () => {
  test('should process an input vector', async ({ request }) => {
    const inputData = {
      vector: [0.52, 0.79]
    };

    const response = await request.post(`${API_BASE_URL}/api/engine/process`, {
      data: inputData
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toHaveProperty('result');
    expect(result.result).toHaveProperty('inputVector');
    expect(result.result).toHaveProperty('timestamp');
  });

  test('should reset all sequences', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/engine/reset`);
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Reality Engine API - Sampler', () => {
  test('should manually sample an observation', async ({ request }) => {
    const sampleData = {
      data: [0.5, 0.8],
      source: 'e2e-test',
      metadata: { test: true }
    };

    const response = await request.post(`${API_BASE_URL}/api/sampler/sample`, {
      data: sampleData
    });

    expect(response.ok()).toBeTruthy();
  });

  test('should get sampler stats', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/sampler/stats`);
    expect(response.ok()).toBeTruthy();

    const stats = await response.json();
    expect(stats).toHaveProperty('isRunning');
  });
});
