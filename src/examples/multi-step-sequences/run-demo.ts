import { RealityEngine } from '../../engine/RealityEngine.js';
import { VectorStore } from '../../services/VectorStore.js';
import { createMultiStepSequences, generateTestVectors } from './sequence-definitions.js';

/**
 * Multi-Step Sequences Demonstration
 *
 * Demonstrates critical event sequences with:
 * - 3-step chains (initial → intermediate → terminal)
 * - Output assertions at terminal states
 * - State transition tracking
 */

async function runDemo() {
  console.log('========================================');
  console.log('Multi-Step Sequences Demonstration');
  console.log('========================================\n');

  // Initialize engine with vector store
  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  const engine = new RealityEngine(vectorStore);

  // Load sequences
  console.log('Loading sequences...\n');
  const sequences = createMultiStepSequences();

  for (const sequence of sequences) {
    engine.addSequence(sequence);
    console.log(`✓ Loaded: ${sequence.name}`);
    console.log(`  Total events: ${sequence.getAllVectors().length}`);
    console.log(`  Initial events: ${sequence.getInitialVectors().length}`);
    console.log(`  Output events: ${sequence.getAllVectors().filter(v => v.getOutputVectors().length > 0).length}`);
    console.log('');
  }

  // Display sequence details
  console.log('========================================');
  console.log('Sequence Details');
  console.log('========================================\n');

  sequences.forEach((seq, idx) => {
    console.log(`Sequence ${idx + 1}: ${seq.name}`);
    const vectors = seq.getAllVectors();

    vectors.forEach(v => {
      const isInitial = seq.getInitialVectors().some((iv: any) => iv.id === v.id);
      const label = isInitial ? '⭐ INITIAL' : v.getOutputVectors().length > 0 ? '🎯 OUTPUT' : '○ INTERMEDIATE';
      const pattern = v.getVector().join('');
      const nextCount = v.getNextVectorIds().length;
      const outputCount = v.getOutputVectors().length;

      console.log(`  ${label} [${pattern}] → ${nextCount} next, ${outputCount} outputs`);

      if (outputCount > 0) {
        v.getOutputVectors().forEach(out => {
          const outPattern = out.vector.join('');
          console.log(`    → Output: [${outPattern}] - ${out.metadata?.description}`);
        });
      }
    });
    console.log('');
  });

  // Run test vectors
  console.log('========================================');
  console.log('Running Test Vectors');
  console.log('========================================\n');

  const testVectors = generateTestVectors();
  let testsPassed = 0;
  let testsFailed = 0;

  for (const test of testVectors) {
    console.log(`Test: ${test.description}`);
    console.log(`Input: [${test.vector.join(', ')}]`);

    const result = engine.processInput(test.vector);

    console.log(`  Sequences checked: ${Object.keys(result.sequenceResults).length}`);
    console.log(`  Matched vectors: ${Object.values(result.sequenceResults).filter((r: any) => r.matched).length}`);
    console.log(`  Outputs generated: ${result.totalOutputs.length}`);

    if (result.totalOutputs.length > 0) {
      result.totalOutputs.forEach(output => {
        const outputPattern = output.vector.join('');
        console.log(`  ✓ Output asserted: [${outputPattern}] - ${output.metadata?.description}`);

        if (test.expectedOutput && outputPattern === test.expectedOutput) {
          console.log(`  ✅ PASS: Output matches expected [${test.expectedOutput}]`);
          testsPassed++;
        } else if (test.expectedOutput) {
          console.log(`  ❌ FAIL: Expected [${test.expectedOutput}], got [${outputPattern}]`);
          testsFailed++;
        }
      });
    } else if (test.expectedOutput) {
      console.log(`  ❌ FAIL: Expected output [${test.expectedOutput}], but no output generated`);
      testsFailed++;
    } else {
      console.log('  ○ No output (expected)');
    }

    console.log('');
  }

  // Display final statistics
  console.log('========================================');
  console.log('Final Statistics');
  console.log('========================================\n');

  const allSequences = engine.getAllSequences();
  const totalVectors = allSequences.reduce((sum, seq) => sum + seq.getAllVectors().length, 0);
  const activeVectors = allSequences.reduce((sum, seq) =>
    sum + seq.getAllVectors().filter(v => v.isActive).length, 0);

  console.log(`Total Sequences: ${allSequences.length}`);
  console.log(`Total Events: ${totalVectors}`);
  console.log(`Active Events: ${activeVectors}`);
  console.log('');

  console.log('Test Results:');
  console.log(`  Passed: ${testsPassed}`);
  console.log(`  Failed: ${testsFailed}`);
  console.log(`  Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('');

  // Display active sequences
  console.log('Active Event Chains:');
  sequences.forEach(seq => {
    const activeVectors = seq.getAllVectors().filter(v => v.isActive);
    if (activeVectors.length > 0) {
      console.log(`  ${seq.name}:`);
      activeVectors.forEach(v => {
        const pattern = v.getVector().join('');
        console.log(`    → [${pattern}] ${v.metadata?.name || 'unnamed'}`);
      });
    }
  });

  console.log('\n========================================');
  console.log('Demonstration Complete');
  console.log('========================================\n');
}

// Run the demonstration
runDemo().catch(console.error);
