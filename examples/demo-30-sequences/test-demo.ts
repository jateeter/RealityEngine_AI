import { RealityEngine } from '../../dist/engine/RealityEngine.js';
import { VectorStore } from '../../dist/services/VectorStore.js';
import { SimulationController } from '../../dist/engine/SimulationController.js';
import { generateDemoDataset } from './data-generator.js';

/**
 * Test script to demonstrate the 30-sequence demo with SimulationController
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Reality Engine 30-Sequence Demonstration Test');
  console.log('='.repeat(80));
  console.log();

  // Initialize Reality Engine
  console.log('1. Initializing Reality Engine...');
  const vectorStore = new VectorStore();
  await vectorStore.initialize();
  const engine = new RealityEngine(vectorStore);
  await engine.initialize();
  console.log('✓ Reality Engine initialized');
  console.log();

  // Generate demo dataset
  console.log('2. Generating demo dataset...');
  const dataset = generateDemoDataset();
  console.log(`✓ Generated ${dataset.sequences.length} sequences`);
  console.log(`✓ Generated ${dataset.inputVectors.length} input vectors`);
  console.log(`✓ Total vectors across all sequences: ${dataset.metadata.totalVectors}`);
  console.log();

  // Load sequences into engine
  console.log('3. Loading sequences into engine...');
  let loadedCount = 0;
  for (const sequence of dataset.sequences) {
    const validation = sequence.validate();
    if (validation.valid) {
      engine.addSequence(sequence);
      loadedCount++;
    } else {
      console.error(`  ✗ Failed to load sequence ${sequence.name}: ${validation.errors.join(', ')}`);
    }
  }
  console.log(`✓ Loaded ${loadedCount} / ${dataset.sequences.length} sequences`);
  console.log();

  // Display sequence breakdown
  console.log('4. Sequence Breakdown:');
  const categories = [
    'Building Climate Control',
    'Manufacturing Line Monitor',
    'Vital Signs Monitor',
    'Multi-Zone Security System',
    'Market Volatility Detector',
    'Traffic Flow Optimizer',
    'Network Congestion Monitor'
  ];

  dataset.sequences.slice(0, 7).forEach((seq, idx) => {
    const vectors = seq.getVectors();
    const initialVectors = vectors.filter(v => v.isInitial);
    console.log(`  ${idx + 1}. ${seq.name}`);
    console.log(`     Vectors: ${vectors.length}, Initial: ${initialVectors.length}`);
  });
  console.log(`  ... and ${dataset.sequences.length - 7} more sequences`);
  console.log();

  // Create simulation controller
  console.log('5. Initializing SimulationController...');
  const controller = new SimulationController(engine, {
    autoPlayDelayMs: 100,
    inputVectors: dataset.inputVectors.slice(0, 10), // Use first 10 for quick test
    loop: false
  });

  // Subscribe to events
  controller.onEvent((event) => {
    console.log(`  [${event.type.toUpperCase()}] Index: ${event.state.currentIndex}/${event.state.totalVectors}, Status: ${event.state.status}`);

    if (event.result) {
      const matchCount = Array.from(event.result.sequenceResults.values())
        .reduce((sum, r) => sum + r.matchedVectors.length, 0);
      const outputCount = event.result.totalOutputs.length;

      if (matchCount > 0) {
        console.log(`    → Matched ${matchCount} vectors, Generated ${outputCount} outputs`);
      }
    }
  });

  console.log('✓ SimulationController ready');
  console.log();

  // Run simulation
  console.log('6. Running simulation (first 10 vectors)...');
  console.log('-'.repeat(80));

  controller.start();

  // Wait for completion
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      const state = controller.getState();
      if (state.status === 'stopped') {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, 50);
  });

  console.log('-'.repeat(80));
  console.log();

  // Display results
  console.log('7. Simulation Results:');
  const state = controller.getState();
  console.log(`  Status: ${state.status}`);
  console.log(`  Processed: ${state.currentIndex} / ${state.totalVectors} vectors`);
  console.log(`  Progress: ${controller.getProgress()}%`);
  console.log();

  // Display heatmap (top 10 most activated vectors)
  console.log('8. Activation Heatmap (Top 10):');
  const heatmap = controller.getHeatmap();
  const sortedActivations = Array.from(heatmap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (sortedActivations.length > 0) {
    sortedActivations.forEach(([key, activation], idx) => {
      console.log(`  ${idx + 1}. ${activation.sequenceId.substring(0, 30)}...`);
      console.log(`     Vector: ${activation.vectorId.substring(0, 20)}... | Activations: ${activation.count}`);
    });
  } else {
    console.log('  No vectors were activated during simulation');
  }
  console.log();

  // Display engine stats
  console.log('9. Engine Statistics:');
  const stats = engine.getStats();
  console.log(`  Total Sequences: ${stats.totalSequences}`);
  console.log(`  Total Vectors: ${stats.totalVectors}`);
  console.log(`  Active Vectors: ${stats.totalActiveVectors}`);
  console.log();

  console.log('='.repeat(80));
  console.log('Test Complete!');
  console.log('='.repeat(80));
}

// Run the test
main().catch(console.error);
