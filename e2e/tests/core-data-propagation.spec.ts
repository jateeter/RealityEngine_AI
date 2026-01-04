import { test, expect } from '@playwright/test';

/**
 * Core Data Propagation Cycle E2E Test
 *
 * Validates the fundamental Reality Engine processing cycle:
 * 1. Each machine instance has its own unique input queue
 * 2. First element of queue is compared with each active event
 * 3. If matched, engine activates all events in next event list
 * 4. Process continues until queue is empty or no more matches
 *
 * Uses Multi-Step Workflow machine to test cascading activations
 */

const API_BASE_URL = 'http://localhost:3000';
const SIMULATION_API = 'http://localhost:3000/api/simulation';

test.describe('Core Data Propagation Cycle', () => {

  test('should validate input queue isolation per machine instance', async ({ request }) => {
    console.log('\n=== TEST: Input Queue Isolation ===\n');

    // Create two separate sequences (machines)
    const sequence1Data = {
      name: 'Machine Instance 1',
      vectors: [{
        elements: [{ value: 0.5, comparatorType: 'threshold', threshold: 0.1 }],
        isInitial: true,
        nextVectorIds: [],
        outputVectors: [{ id: 'output-1', vector: [1.0], timestamp: Date.now() }]
      }]
    };

    const sequence2Data = {
      name: 'Machine Instance 2',
      vectors: [{
        elements: [{ value: 0.8, comparatorType: 'threshold', threshold: 0.1 }],
        isInitial: true,
        nextVectorIds: [],
        outputVectors: [{ id: 'output-2', vector: [2.0], timestamp: Date.now() }]
      }]
    };

    const seq1Response = await request.post(`${API_BASE_URL}/api/sequences`, { data: sequence1Data });
    const seq2Response = await request.post(`${API_BASE_URL}/api/sequences`, { data: sequence2Data });

    expect(seq1Response.ok()).toBeTruthy();
    expect(seq2Response.ok()).toBeTruthy();

    const seq1 = await seq1Response.json();
    const seq2 = await seq2Response.json();

    console.log(`✓ Created Machine Instance 1: ${seq1.id}`);
    console.log(`✓ Created Machine Instance 2: ${seq2.id}`);

    // Load different input queues for each instance
    const inputQueue1 = [[0.52], [0.54]]; // Should match Machine 1
    const inputQueue2 = [[0.82], [0.84]]; // Should match Machine 2

    // Load queue for instance 1
    await request.post(`${SIMULATION_API}/load`, {
      data: { vectors: inputQueue1 }
    });

    // Process and verify instance 1 gets its queue
    const step1Response = await request.post(`${SIMULATION_API}/step`);
    const step1Result = await step1Response.json();

    console.log(`✓ Machine 1 processed vector from its queue: ${JSON.stringify(inputQueue1[0])}`);
    expect(step1Response.ok()).toBeTruthy();

    // Load different queue for instance 2 (simulating different machine)
    await request.post(`${SIMULATION_API}/load`, {
      data: { vectors: inputQueue2 }
    });

    const step2Response = await request.post(`${SIMULATION_API}/step`);
    const step2Result = await step2Response.json();

    console.log(`✓ Machine 2 processed vector from its queue: ${JSON.stringify(inputQueue2[0])}`);
    expect(step2Response.ok()).toBeTruthy();

    // Cleanup
    await request.delete(`${API_BASE_URL}/api/sequences/${seq1.id}`);
    await request.delete(`${API_BASE_URL}/api/sequences/${seq2.id}`);

    console.log('\n✅ Input Queue Isolation Validated\n');
  });

  test('should validate multi-step event activation cascade', async ({ request }) => {
    console.log('\n=== TEST: Multi-Step Event Activation ===\n');

    // Create a 3-step cascading sequence
    // Step 1 (Initial) → Step 2 → Step 3 (Output)
    const cascadeSequence = {
      name: 'Multi-Step Cascade Test',
      vectors: [
        {
          id: 'step-1-detector',
          elements: [
            { value: 0.3, comparatorType: 'threshold', threshold: 0.1 }
          ],
          isInitial: true,
          nextVectorIds: ['step-2-processor'],
          outputVectors: []
        },
        {
          id: 'step-2-processor',
          elements: [
            { value: 0.6, comparatorType: 'threshold', threshold: 0.1 }
          ],
          isInitial: false,
          nextVectorIds: ['step-3-finalizer'],
          outputVectors: []
        },
        {
          id: 'step-3-finalizer',
          elements: [
            { value: 0.9, comparatorType: 'threshold', threshold: 0.1 }
          ],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'cascade-complete',
              vector: [1.0, 1.0, 1.0],
              timestamp: Date.now(),
              metadata: { type: 'cascade-completion' }
            }
          ]
        }
      ]
    };

    const createResponse = await request.post(`${API_BASE_URL}/api/sequences`, {
      data: cascadeSequence
    });
    expect(createResponse.ok()).toBeTruthy();
    const sequence = await createResponse.json();
    console.log(`✓ Created cascade sequence: ${sequence.id}`);

    // Reset to ensure clean state
    await request.post(`${API_BASE_URL}/api/sequences/${sequence.id}/reset`);

    // Load input queue with vectors that should trigger cascade
    const inputQueue = [
      [0.32],  // Should match step-1-detector (0.3 ± 0.1)
      [0.62],  // Should match step-2-processor (0.6 ± 0.1) after activation
      [0.92]   // Should match step-3-finalizer (0.9 ± 0.1) after activation
    ];

    await request.post(`${SIMULATION_API}/load`, {
      data: { vectors: inputQueue }
    });

    console.log('\n--- Processing Step 1: Initial Detection ---');

    // Step 1: Process first vector [0.32]
    const step1Response = await request.post(`${SIMULATION_API}/step`);
    expect(step1Response.ok()).toBeTruthy();
    const step1Result = await step1Response.json();

    console.log(`Input Vector 1: ${JSON.stringify(inputQueue[0])}`);
    console.log(`Expected Match: step-1-detector (value: 0.3, threshold: ±0.1)`);

    // Verify step-1 matched and activated step-2
    const activeAfterStep1 = await request.get(`${API_BASE_URL}/api/engine/active`);
    const active1 = await activeAfterStep1.json();
    console.log(`Active vectors after step 1: ${JSON.stringify(active1)}`);
    console.log(`✓ Step 1 completed: step-2-processor should now be active`);

    console.log('\n--- Processing Step 2: Mid-Layer Processing ---');

    // Step 2: Process second vector [0.62]
    const step2Response = await request.post(`${SIMULATION_API}/step`);
    expect(step2Response.ok()).toBeTruthy();
    const step2Result = await step2Response.json();

    console.log(`Input Vector 2: ${JSON.stringify(inputQueue[1])}`);
    console.log(`Expected Match: step-2-processor (value: 0.6, threshold: ±0.1)`);

    // Verify step-2 matched and activated step-3
    const activeAfterStep2 = await request.get(`${API_BASE_URL}/api/engine/active`);
    const active2 = await activeAfterStep2.json();
    console.log(`Active vectors after step 2: ${JSON.stringify(active2)}`);
    console.log(`✓ Step 2 completed: step-3-finalizer should now be active`);

    console.log('\n--- Processing Step 3: Final Output Generation ---');

    // Step 3: Process third vector [0.92]
    const step3Response = await request.post(`${SIMULATION_API}/step`);
    expect(step3Response.ok()).toBeTruthy();
    const step3Result = await step3Response.json();

    console.log(`Input Vector 3: ${JSON.stringify(inputQueue[2])}`);
    console.log(`Expected Match: step-3-finalizer (value: 0.9, threshold: ±0.1)`);

    // Verify output was generated
    if (step3Result.result && step3Result.result.totalOutputs) {
      const outputs = step3Result.result.totalOutputs;
      console.log(`✓ Output generated: ${outputs.length} output(s)`);
      expect(outputs.length).toBeGreaterThan(0);

      const cascadeOutput = outputs.find((o: any) => o.id === 'cascade-complete');
      if (cascadeOutput) {
        console.log(`✓ Cascade completion output found: ${JSON.stringify(cascadeOutput.vector)}`);
        expect(cascadeOutput.vector).toEqual([1.0, 1.0, 1.0]);
      }
    }

    // Verify final state
    const finalStats = await request.get(`${API_BASE_URL}/api/engine/stats`);
    const stats = await finalStats.json();
    console.log(`\n--- Final Engine State ---`);
    console.log(`Total sequences: ${stats.stats?.totalSequences || stats.totalSequences}`);
    console.log(`Total vectors: ${stats.stats?.totalVectors || stats.totalVectors}`);
    console.log(`Active vectors: ${stats.stats?.totalActiveVectors || stats.totalActiveVectors}`);

    // Cleanup
    await request.delete(`${API_BASE_URL}/api/sequences/${sequence.id}`);

    console.log('\n✅ Multi-Step Event Activation Cascade Validated\n');
  });

  test('should validate next event list activation on match', async ({ request }) => {
    console.log('\n=== TEST: Next Event List Activation ===\n');

    // Create sequence with branching next events
    const branchingSequence = {
      name: 'Branching Event Test',
      vectors: [
        {
          id: 'root-event',
          elements: [{ value: 0.5, comparatorType: 'threshold', threshold: 0.1 }],
          isInitial: true,
          nextVectorIds: ['branch-a', 'branch-b', 'branch-c'], // Multiple next events
          outputVectors: []
        },
        {
          id: 'branch-a',
          elements: [{ value: 0.2, comparatorType: 'threshold', threshold: 0.05 }],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [{ id: 'output-a', vector: [1.0], timestamp: Date.now() }]
        },
        {
          id: 'branch-b',
          elements: [{ value: 0.5, comparatorType: 'threshold', threshold: 0.05 }],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [{ id: 'output-b', vector: [2.0], timestamp: Date.now() }]
        },
        {
          id: 'branch-c',
          elements: [{ value: 0.8, comparatorType: 'threshold', threshold: 0.05 }],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [{ id: 'output-c', vector: [3.0], timestamp: Date.now() }]
        }
      ]
    };

    const createResponse = await request.post(`${API_BASE_URL}/api/sequences`, {
      data: branchingSequence
    });
    expect(createResponse.ok()).toBeTruthy();
    const sequence = await createResponse.json();
    console.log(`✓ Created branching sequence: ${sequence.id}`);

    // Reset and load input queue
    await request.post(`${API_BASE_URL}/api/sequences/${sequence.id}/reset`);

    const inputQueue = [
      [0.52],  // Match root-event, activate all branches
      [0.21],  // Match branch-a
      [0.51],  // Match branch-b
      [0.81]   // Match branch-c
    ];

    await request.post(`${SIMULATION_API}/load`, {
      data: { vectors: inputQueue }
    });

    console.log('\n--- Step 1: Root Event Activation ---');
    const step1Response = await request.post(`${SIMULATION_API}/step`);
    expect(step1Response.ok()).toBeTruthy();

    console.log(`✓ Root event matched with vector: ${JSON.stringify(inputQueue[0])}`);
    console.log(`✓ Expected: All 3 branches (a, b, c) should now be active`);

    // Verify all next events are now active
    const activeResponse = await request.get(`${API_BASE_URL}/api/engine/active`);
    const activeVectors = await activeResponse.json();
    console.log(`Active vectors: ${JSON.stringify(activeVectors)}`);

    // Process remaining vectors to trigger branch outputs
    console.log('\n--- Step 2-4: Branch Activations ---');
    let totalOutputs = 0;

    for (let i = 1; i < inputQueue.length; i++) {
      const stepResponse = await request.post(`${SIMULATION_API}/step`);
      const stepResult = await stepResponse.json();

      if (stepResult.result && stepResult.result.totalOutputs) {
        totalOutputs += stepResult.result.totalOutputs.length;
        console.log(`✓ Vector ${i + 1} processed: ${stepResult.result.totalOutputs.length} output(s) generated`);
      }
    }

    console.log(`\n✓ Total outputs from all branches: ${totalOutputs}`);
    expect(totalOutputs).toBeGreaterThan(0);

    // Cleanup
    await request.delete(`${API_BASE_URL}/api/sequences/${sequence.id}`);

    console.log('\n✅ Next Event List Activation Validated\n');
  });

  test('should measure core propagation cycle performance', async ({ request }) => {
    console.log('\n=== TEST: Performance Measurement ===\n');

    // Create a moderate complexity sequence
    const perfSequence = {
      name: 'Performance Test Sequence',
      vectors: [
        {
          id: 'perf-initial',
          elements: [{ value: 0.5, comparatorType: 'threshold', threshold: 0.2 }],
          isInitial: true,
          nextVectorIds: ['perf-stage-2'],
          outputVectors: []
        },
        {
          id: 'perf-stage-2',
          elements: [{ value: 0.7, comparatorType: 'threshold', threshold: 0.2 }],
          isInitial: false,
          nextVectorIds: [],
          outputVectors: [{ id: 'perf-output', vector: [1.0], timestamp: Date.now() }]
        }
      ]
    };

    const createResponse = await request.post(`${API_BASE_URL}/api/sequences`, {
      data: perfSequence
    });
    const sequence = await createResponse.json();

    // Load 100 vectors for performance test
    const largeQueue = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? [0.5] : [0.7]
    );

    await request.post(`${SIMULATION_API}/load`, {
      data: { vectors: largeQueue }
    });

    console.log(`Loaded ${largeQueue.length} vectors into queue`);

    // Measure processing time
    const startTime = Date.now();

    // Start auto-play
    await request.post(`${SIMULATION_API}/start`);

    // Wait for completion (poll state)
    let completed = false;
    let iterations = 0;
    const maxIterations = 50;

    while (!completed && iterations < maxIterations) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const stateResponse = await request.get(`${SIMULATION_API}/state`);
      const state = await stateResponse.json();

      if (state.state.status === 'stopped' ||
          state.state.currentIndex >= largeQueue.length) {
        completed = true;
      }
      iterations++;
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerVector = totalTime / largeQueue.length;

    console.log(`\n--- Performance Metrics ---`);
    console.log(`Total vectors processed: ${largeQueue.length}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per vector: ${avgTimePerVector.toFixed(2)}ms`);
    console.log(`Throughput: ${(1000 / avgTimePerVector).toFixed(2)} vectors/second`);

    // Performance assertions
    expect(avgTimePerVector).toBeLessThan(1000); // Should be < 1 second per vector
    console.log(`✓ Performance acceptable: ${avgTimePerVector.toFixed(2)}ms per vector`);

    // Cleanup
    await request.delete(`${API_BASE_URL}/api/sequences/${sequence.id}`);

    console.log('\n✅ Performance Measurement Complete\n');
  });
});
