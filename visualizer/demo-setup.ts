/**
 * Demo Setup Script for Reality Engine Visualizer
 *
 * This script creates sample sequences in the Reality Engine
 * to demonstrate the visualization capabilities.
 *
 * Run with: ts-node visualizer/demo-setup.ts
 */

import axios from 'axios';

const REALITY_ENGINE_URL = 'http://localhost:3000/api';

async function createDemoSequences() {
  console.log('Creating demo sequences for visualizer...\n');

  try {
    // Demo Sequence 1: Simple Linear Flow
    console.log('Creating Sequence 1: Simple Linear Flow');
    const sequence1 = {
      name: 'Linear State Machine',
      vectors: [
        {
          elements: [
            { value: 0.1, comparatorType: 'THRESHOLD', threshold: 0.05 },
            { value: 0.2, comparatorType: 'THRESHOLD', threshold: 0.05 }
          ],
          isInitial: true,
          id: 'start-vector',
          nextVectorIds: ['process-vector'],
          outputVectors: [
            {
              id: 'start-output',
              vector: [1.0, 0.0],
              timestamp: Date.now(),
              metadata: { stage: 'start', message: 'Process initiated' }
            }
          ]
        },
        {
          elements: [
            { value: 0.5, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.6, comparatorType: 'THRESHOLD', threshold: 0.1 }
          ],
          isInitial: false,
          id: 'process-vector',
          nextVectorIds: ['end-vector'],
          outputVectors: [
            {
              id: 'process-output',
              vector: [0.5, 0.5],
              timestamp: Date.now(),
              metadata: { stage: 'process', message: 'Processing data' }
            }
          ]
        },
        {
          elements: [
            { value: 0.9, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.9, comparatorType: 'THRESHOLD', threshold: 0.1 }
          ],
          isInitial: false,
          id: 'end-vector',
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'end-output',
              vector: [0.0, 1.0],
              timestamp: Date.now(),
              metadata: { stage: 'complete', message: 'Process completed' }
            }
          ]
        }
      ]
    };

    const response1 = await axios.post(`${REALITY_ENGINE_URL}/sequences`, sequence1);
    console.log('✓ Sequence 1 created:', response1.data.sequence.id);
    console.log('  - 3 vectors in linear chain\n');

    // Demo Sequence 2: Branching Flow
    console.log('Creating Sequence 2: Branching State Machine');
    const sequence2 = {
      name: 'Branching Detector',
      vectors: [
        {
          elements: [
            { value: 0.5, comparatorType: 'THRESHOLD', threshold: 0.2 }
          ],
          isInitial: true,
          id: 'detector',
          nextVectorIds: ['path-a', 'path-b'],
          outputVectors: [
            {
              id: 'detection-signal',
              vector: [1.0],
              timestamp: Date.now(),
              metadata: { type: 'detection' }
            }
          ]
        },
        {
          elements: [
            { value: 0.3, comparatorType: 'THRESHOLD', threshold: 0.15 }
          ],
          isInitial: false,
          id: 'path-a',
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'path-a-output',
              vector: [0.3],
              timestamp: Date.now(),
              metadata: { path: 'A', message: 'Low value path' }
            }
          ]
        },
        {
          elements: [
            { value: 0.7, comparatorType: 'THRESHOLD', threshold: 0.15 }
          ],
          isInitial: false,
          id: 'path-b',
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'path-b-output',
              vector: [0.7],
              timestamp: Date.now(),
              metadata: { path: 'B', message: 'High value path' }
            }
          ]
        }
      ]
    };

    const response2 = await axios.post(`${REALITY_ENGINE_URL}/sequences`, sequence2);
    console.log('✓ Sequence 2 created:', response2.data.sequence.id);
    console.log('  - 1 detector branching to 2 paths\n');

    // Demo Sequence 3: Complex Network
    console.log('Creating Sequence 3: Complex Network');
    const sequence3 = {
      name: 'Complex Event Network',
      vectors: [
        {
          elements: [
            { value: 0.2, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.3, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.4, comparatorType: 'THRESHOLD', threshold: 0.1 }
          ],
          isInitial: true,
          id: 'init-1',
          nextVectorIds: ['mid-1', 'mid-2'],
          outputVectors: [
            {
              id: 'init-1-out',
              vector: [1.0, 0.0, 0.0],
              timestamp: Date.now(),
              metadata: { node: 'init-1' }
            }
          ]
        },
        {
          elements: [
            { value: 0.8, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.2, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.5, comparatorType: 'THRESHOLD', threshold: 0.1 }
          ],
          isInitial: true,
          id: 'init-2',
          nextVectorIds: ['mid-2'],
          outputVectors: [
            {
              id: 'init-2-out',
              vector: [0.0, 1.0, 0.0],
              timestamp: Date.now(),
              metadata: { node: 'init-2' }
            }
          ]
        },
        {
          elements: [
            { value: 0.4, comparatorType: 'THRESHOLD', threshold: 0.15 },
            { value: 0.5, comparatorType: 'THRESHOLD', threshold: 0.15 },
            { value: 0.6, comparatorType: 'THRESHOLD', threshold: 0.15 }
          ],
          isInitial: false,
          id: 'mid-1',
          nextVectorIds: ['final'],
          outputVectors: []
        },
        {
          elements: [
            { value: 0.6, comparatorType: 'THRESHOLD', threshold: 0.15 },
            { value: 0.7, comparatorType: 'THRESHOLD', threshold: 0.15 },
            { value: 0.5, comparatorType: 'THRESHOLD', threshold: 0.15 }
          ],
          isInitial: false,
          id: 'mid-2',
          nextVectorIds: ['final'],
          outputVectors: [
            {
              id: 'mid-2-out',
              vector: [0.5, 0.5, 0.0],
              timestamp: Date.now(),
              metadata: { node: 'mid-2' }
            }
          ]
        },
        {
          elements: [
            { value: 0.9, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.9, comparatorType: 'THRESHOLD', threshold: 0.1 },
            { value: 0.9, comparatorType: 'THRESHOLD', threshold: 0.1 }
          ],
          isInitial: false,
          id: 'final',
          nextVectorIds: [],
          outputVectors: [
            {
              id: 'final-out',
              vector: [0.0, 0.0, 1.0],
              timestamp: Date.now(),
              metadata: { node: 'final', message: 'Network complete' }
            }
          ]
        }
      ]
    };

    const response3 = await axios.post(`${REALITY_ENGINE_URL}/sequences`, sequence3);
    console.log('✓ Sequence 3 created:', response3.data.sequence.id);
    console.log('  - 2 initial vectors, 2 mid-layer, 1 final\n');

    // Summary
    console.log('='.repeat(60));
    console.log('Demo sequences created successfully!');
    console.log('='.repeat(60));
    console.log('\nYou can now view these sequences in the visualizer:');
    console.log('1. Start the visualizer backend: cd visualizer/backend && npm run dev');
    console.log('2. Start the visualizer frontend: cd visualizer/frontend && npm run dev');
    console.log('3. Open http://localhost:5173 in your browser');
    console.log('\nTry processing some inputs to see the visualizations update:');
    console.log('- Sequence 1: [0.1, 0.2] -> [0.5, 0.6] -> [0.9, 0.9]');
    console.log('- Sequence 2: [0.5] (detector) then [0.3] or [0.7]');
    console.log('- Sequence 3: [0.2, 0.3, 0.4] or [0.8, 0.2, 0.5]\n');

  } catch (error: any) {
    console.error('Error creating demo sequences:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    console.error('\nMake sure the Reality Engine is running on port 3000!');
    console.error('Start it with: npm run dev (from the root directory)\n');
    process.exit(1);
  }
}

// Run the demo setup
createDemoSequences();
