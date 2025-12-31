import { RealityEngine } from '../../src/engine/RealityEngine.js';
import { VectorStore } from '../../src/services/VectorStore.js';
import {
  createDataCenterSequences,
  generateInitialEvents,
  generateProgressionVectors
} from './data-center-sequences.js';

/**
 * Run the Data Center Monitoring Example
 * Demonstrates 5 critical event sequences with minimum depth of 5 each
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Data Center Monitoring - 5 Critical Event Sequences');
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

  // Create and load sequences
  console.log('2. Creating 5 Critical Event Sequences...');
  const sequences = createDataCenterSequences();

  for (const seq of sequences) {
    const validation = seq.validate();
    if (validation.valid) {
      engine.addSequence(seq);
      const vectors = seq.getAllVectors();
      const initialVectors = vectors.filter(v => v.isInitial);
      console.log(`   ✓ ${seq.name}`);
      console.log(`     - Total vectors: ${vectors.length}`);
      console.log(`     - Initial vectors: ${initialVectors.length}`);
      console.log(`     - Sequence depth: ${vectors.length} states`);
    } else {
      console.error(`   ✗ ${seq.name}: ${validation.errors.join(', ')}`);
    }
  }
  console.log();

  // Display engine stats
  const stats = engine.getStats();
  console.log('3. Engine Statistics:');
  console.log(`   Total Sequences: ${stats.totalSequences}`);
  console.log(`   Total Vectors: ${stats.totalVectors}`);
  console.log(`   Active Vectors: ${stats.totalActiveVectors}`);
  console.log();

  // Process initial events
  console.log('4. Processing Initial Events (one per sequence)...');
  console.log('-'.repeat(80));
  const initialEvents = generateInitialEvents();

  for (let i = 0; i < initialEvents.length; i++) {
    const vector = initialEvents[i];
    if (!vector) continue;

    console.log(`\n   Event ${i + 1}: [${vector.slice(0, 5).map(v => v.toFixed(2)).join(', ')}, ...]`);
    const result = engine.processInput(vector);

    console.log(`   → Checked ${result.sequencesChecked} sequences`);
    console.log(`   → Matched ${Array.from(result.sequenceResults.values()).reduce((sum, r) => sum + r.matchedVectors.length, 0)} vectors`);
    console.log(`   → Generated ${result.totalOutputs.length} outputs`);

    if (result.totalOutputs.length > 0) {
      result.totalOutputs.forEach(output => {
        const desc = output.metadata?.description || 'Unknown';
        console.log(`      ✓ ${desc}`);
      });
    }
  }
  console.log('-'.repeat(80));
  console.log();

  // Process progression vectors
  console.log('5. Processing Progression Vectors (escalating all sequences)...');
  console.log('-'.repeat(80));
  const progressionVectors = generateProgressionVectors();

  let criticalOutputCount = 0;
  let emergencyOutputCount = 0;

  for (let i = 0; i < progressionVectors.length; i++) {
    const vector = progressionVectors[i];
    if (!vector) continue;

    const result = engine.processInput(vector);
    const outputDescriptions = result.totalOutputs.map(o => o.metadata?.description || '').join(', ');

    // Count critical and emergency outputs
    const criticals = result.totalOutputs.filter(o =>
      (o.metadata?.description as string)?.toLowerCase().includes('critical')
    );
    const emergencies = result.totalOutputs.filter(o =>
      (o.metadata?.description as string)?.toLowerCase().includes('emergency')
    );

    criticalOutputCount += criticals.length;
    emergencyOutputCount += emergencies.length;

    if (result.totalOutputs.length > 0) {
      console.log(`\n   Step ${i + 1}/20:`);
      console.log(`   Vector: [${vector.slice(0, 5).map(v => v.toFixed(2)).join(', ')}, ...]`);
      console.log(`   → ${result.totalOutputs.length} outputs generated`);

      if (emergencies.length > 0) {
        console.log(`   🚨 EMERGENCY OUTPUTS:`);
        emergencies.forEach(output => {
          console.log(`      ${output.metadata?.description || 'Unknown'}`);
        });
      } else if (criticals.length > 0) {
        console.log(`   ⚠️  CRITICAL OUTPUTS:`);
        criticals.length > 0 && criticals.forEach(output => {
          console.log(`      ${output.metadata?.description || 'Unknown'}`);
        });
      }
    }
  }
  console.log('-'.repeat(80));
  console.log();

  // Final statistics
  console.log('6. Final Composite Machine State:');
  const finalStats = engine.getStats();
  console.log(`   Total Sequences: ${finalStats.totalSequences}`);
  console.log(`   Total Vectors: ${finalStats.totalVectors}`);
  console.log(`   Active Vectors: ${finalStats.totalActiveVectors}`);
  console.log(`   Critical Outputs Generated: ${criticalOutputCount}`);
  console.log(`   Emergency Outputs Generated: ${emergencyOutputCount}`);
  console.log();

  // Active state summary
  console.log('7. Active State Summary (Current State of Each Sequence):');
  const activeVectors = engine.getAllActiveVectors();
  for (const [sequenceId, vectors] of activeVectors) {
    const seq = sequences.find(s => s.id === sequenceId);
    if (seq && vectors.length > 0) {
      console.log(`   ${seq.name}:`);
      vectors.forEach(v => {
        const outputs = v.getOutputVectors();
        if (outputs.length > 0) {
          outputs.forEach(output => {
            console.log(`      → ${output.metadata?.description || 'Unknown state'}`);
          });
        }
      });
    }
  }
  console.log();

  console.log('='.repeat(80));
  console.log('✓ Data Center Monitoring Example Complete');
  console.log('='.repeat(80));
}

// Run the example
main().catch(console.error);
