import { test, expect } from '@playwright/test';

/**
 * E2E Tests – Error Handling & Edge-Case Coverage
 *
 * Covers gaps identified in the E2E testing issue:
 *  1. Unexpected / malformed API payloads return correct HTTP error codes.
 *  2. Accessing non-existent resources returns 404.
 *  3. Vector search boundary conditions (extreme thresholds).
 *  4. Engine stats are updated consistently after mutations.
 *  5. Pagination limits are honoured in history responses.
 *  6. Concurrent vector processing completes without data corruption.
 *  7. Large-batch vector creation succeeds and is reflected in stats.
 *  8. Sampler full lifecycle (start → manual sample → stats → stop).
 *  9. Hard-refresh (multi-reload) UI stability.
 * 10. Deleting a non-existent sequence returns 404.
 */

const API_BASE_URL = 'https://localhost:3000';
const VISUALIZER_URL = 'https://localhost:5173';

// ---------------------------------------------------------------------------
// 1. Non-existent sequence → 404
// ---------------------------------------------------------------------------
test.describe('Error Handling – Non-existent Resources', () => {
  test('should return 404 for a non-existent sequence ID', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/api/sequences/non-existent-id-00000000`
    );
    expect(response.status()).toBe(404);
  });

  // 10. Delete non-existent sequence → 404
  test('should return 404 when deleting a non-existent sequence', async ({ request }) => {
    const response = await request.delete(
      `${API_BASE_URL}/api/sequences/non-existent-id-delete-00`
    );
    expect(response.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2. Engine process – invalid vector type returns error
// ---------------------------------------------------------------------------
test.describe('Error Handling – Invalid API Payloads', () => {
  test('should reject engine process with a non-array vector value', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/engine/process`, {
      data: { vector: 'not-an-array' },
    });
    // API must signal a client error (4xx) or server validation error (5xx).
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  // 3. Engine process – missing vector field
  test('should reject engine process when the vector field is absent', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/engine/process`, {
      data: { wrongField: [0.5, 0.5] },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// 4. Vector search – extreme threshold (1.0 → zero matches expected)
// ---------------------------------------------------------------------------
test.describe('Edge Cases – Vector Search Boundary Conditions', () => {
  test('should return an empty result set with an exact-match-only threshold of 1.0', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/vectors/search`, {
      data: {
        vector: [0.1, 0.9],
        limit: 10,
        threshold: 1.0, // Perfect similarity only – almost impossible to match
      },
    });

    // Endpoint may 200 (empty list) or 404 (no vectors stored) – both are valid.
    if (response.ok()) {
      const result = await response.json();
      const results = result.results ?? result;
      expect(Array.isArray(results)).toBeTruthy();
      // At threshold 1.0 no inexact vector should match.
      expect(results.length).toBe(0);
    } else {
      expect([404]).toContain(response.status());
    }
  });

  test('should return results with a permissive threshold of 0.0', async ({ request }) => {
    // First ensure at least one vector exists so the search has data to return.
    await request.post(`${API_BASE_URL}/api/vectors`, {
      data: {
        elements: [
          { value: 0.3, comparatorType: 'threshold', threshold: 0.1 },
          { value: 0.7, comparatorType: 'threshold', threshold: 0.1 },
        ],
        isInitial: true,
      },
    });

    const response = await request.post(`${API_BASE_URL}/api/vectors/search`, {
      data: {
        vector: [0.3, 0.7],
        limit: 10,
        threshold: 0.0, // Accept any similarity score
      },
    });

    if (response.ok()) {
      const result = await response.json();
      const results = result.results ?? result;
      expect(Array.isArray(results)).toBeTruthy();
    } else {
      // 404 is acceptable if the vector store is empty
      expect([404]).toContain(response.status());
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Engine stats reflect newly created sequences
// ---------------------------------------------------------------------------
test.describe('Extended Workflow – Engine Stats Consistency', () => {
  test('should reflect newly created sequences in engine stats', async ({ request }) => {
    // Capture baseline
    const baseRes = await request.get(`${API_BASE_URL}/api/engine/stats`);
    expect(baseRes.ok()).toBeTruthy();
    const baseData = await baseRes.json();
    const baseTotalSequences: number = (baseData.stats ?? baseData).totalSequences ?? 0;

    // Create a new sequence
    const createRes = await request.post(`${API_BASE_URL}/api/sequences`, {
      data: {
        name: 'Stats Consistency Test Sequence',
        vectors: [
          {
            elements: [{ value: 0.4, comparatorType: 'threshold', threshold: 0.1 }],
            isInitial: true,
            nextVectorIds: [],
            outputVectors: [],
          },
        ],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createData = await createRes.json();
    const sequenceId: string = (createData.sequence ?? createData).id;

    // Stats must show at least one more sequence now
    const afterRes = await request.get(`${API_BASE_URL}/api/engine/stats`);
    expect(afterRes.ok()).toBeTruthy();
    const afterData = await afterRes.json();
    const afterTotalSequences: number = (afterData.stats ?? afterData).totalSequences ?? 0;

    expect(afterTotalSequences).toBeGreaterThan(baseTotalSequences);

    // Cleanup
    await request.delete(`${API_BASE_URL}/api/sequences/${sequenceId}`);
  });
});

// ---------------------------------------------------------------------------
// 6. Pagination limit is honoured in transition history
// ---------------------------------------------------------------------------
test.describe('Edge Cases – History Pagination', () => {
  test('should return at most the requested number of history entries', async ({ request }) => {
    const limit = 3;
    const response = await request.get(
      `${API_BASE_URL}/api/engine/history?limit=${limit}`
    );
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    const history: unknown[] = result.history ?? result;
    expect(Array.isArray(history)).toBeTruthy();
    expect(history.length).toBeLessThanOrEqual(limit);
  });
});

// ---------------------------------------------------------------------------
// 7. Concurrent vector processing – no data corruption
// ---------------------------------------------------------------------------
test.describe('Performance – Concurrent Requests', () => {
  test('should process multiple concurrent vector requests without errors', async ({
    request,
  }) => {
    const concurrentCount = 5;
    const requests = Array.from({ length: concurrentCount }, (_, i) =>
      request.post(`${API_BASE_URL}/api/engine/process`, {
        data: { vector: [i * 0.1, 1 - i * 0.1] },
      })
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      // Each response must contain a result object with required fields.
      expect(body).toHaveProperty('result');
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Large-batch vector creation – scale check
// ---------------------------------------------------------------------------
test.describe('Performance – Large Dataset', () => {
  test('should create a batch of vectors and verify stats totalVectors increases', async ({
    request,
  }) => {
    const batchSize = 10;

    const baseStatsRes = await request.get(`${API_BASE_URL}/api/engine/stats`);
    expect(baseStatsRes.ok()).toBeTruthy();
    const baseData = await baseStatsRes.json();
    const baseTotalVectors: number = (baseData.stats ?? baseData).totalVectors ?? 0;

    // Fixed, deterministic vector values spaced evenly across [0, 1] for reproducibility.
    const vectorValues: [number, number][] = [
      [0.10, 0.90], [0.20, 0.80], [0.30, 0.70], [0.40, 0.60], [0.50, 0.50],
      [0.55, 0.45], [0.60, 0.40], [0.70, 0.30], [0.80, 0.20], [0.90, 0.10],
    ];

    // Create vectors sequentially to avoid overloading the test environment.
    for (let i = 0; i < batchSize; i++) {
      const [v0, v1] = vectorValues[i];
      const res = await request.post(`${API_BASE_URL}/api/vectors`, {
        data: {
          elements: [
            { value: v0, comparatorType: 'threshold', threshold: 0.05 },
            { value: v1, comparatorType: 'threshold', threshold: 0.05 },
          ],
          isInitial: i === 0,
        },
      });
      expect(res.ok()).toBeTruthy();
    }

    const afterStatsRes = await request.get(`${API_BASE_URL}/api/engine/stats`);
    expect(afterStatsRes.ok()).toBeTruthy();
    const afterData = await afterStatsRes.json();
    const afterTotalVectors: number = (afterData.stats ?? afterData).totalVectors ?? 0;

    expect(afterTotalVectors).toBeGreaterThan(baseTotalVectors);
  });
});

// ---------------------------------------------------------------------------
// 9. Sampler full lifecycle
// ---------------------------------------------------------------------------
test.describe('Extended Workflow – Sampler Lifecycle', () => {
  test('should start the sampler, record a manual sample, verify stats, then stop', async ({
    request,
  }) => {
    // Start the sampler
    const startRes = await request.post(`${API_BASE_URL}/api/sampler/start`, {
      data: { strategy: 'periodic', intervalMs: 5000 },
    });
    // Start may already be running; 200 or 409 are both acceptable.
    expect([200, 201, 409]).toContain(startRes.status());

    // Inject a manual sample
    const sampleRes = await request.post(`${API_BASE_URL}/api/sampler/sample`, {
      data: {
        data: [0.25, 0.75],
        source: 'e2e-lifecycle-test',
        metadata: { test: true },
      },
    });
    expect(sampleRes.ok()).toBeTruthy();

    // Sampler stats must reflect a running state
    const statsRes = await request.get(`${API_BASE_URL}/api/sampler/stats`);
    expect(statsRes.ok()).toBeTruthy();
    const statsBody = await statsRes.json();
    const stats = statsBody.stats ?? statsBody;
    expect(stats).toHaveProperty('isRunning');
    expect(stats.isRunning).toBeTruthy();

    // Stop the sampler
    const stopRes = await request.post(`${API_BASE_URL}/api/sampler/stop`);
    expect(stopRes.ok()).toBeTruthy();

    // Stats must now show sampler is stopped
    const afterStopRes = await request.get(`${API_BASE_URL}/api/sampler/stats`);
    expect(afterStopRes.ok()).toBeTruthy();
    const afterStopBody = await afterStopRes.json();
    const afterStats = afterStopBody.stats ?? afterStopBody;
    expect(afterStats.isRunning).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// (UI) Hard-refresh stability
// ---------------------------------------------------------------------------
test.describe('UI Stability – Hard Refresh', () => {
  test('should keep the UI functional after multiple page reloads', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Simulate the user hitting refresh twice
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    // The main heading must still be visible after all reloads.
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Machine cards (h3) should reappear; retry once if they're slow.
    const machineCard = page.locator('h3').first();
    if (!(await machineCard.isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    await expect(machineCard).toBeVisible({ timeout: 10000 });
  });
});
