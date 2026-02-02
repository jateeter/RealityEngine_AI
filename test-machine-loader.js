#!/usr/bin/env node

/**
 * Test script to validate all machine JSON files can be loaded
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MachineLoader } from './dist/services/MachineLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const machineFiles = [
  'RS2.json',
  'RSFlipFlop.json',
  'MultiStep.json',
  'DataCenterMonitoring.json',
  'KleeneStar.json'
];

console.log('🧪 Testing Machine JSON Loader\n');
console.log('=' .repeat(60));

let successCount = 0;
let failureCount = 0;

for (const filename of machineFiles) {
  const filepath = join(__dirname, 'examples', 'machines', filename);

  try {
    console.log(`\n📄 Loading: ${filename}`);
    const jsonString = readFileSync(filepath, 'utf8');

    // Validate JSON structure
    const validation = MachineLoader.validate(jsonString);
    if (!validation.valid) {
      console.error(`  ❌ Validation failed:`);
      validation.errors.forEach(err => console.error(`     - ${err}`));
      failureCount++;
      continue;
    }
    console.log(`  ✓ JSON validation passed`);

    // Load the machine
    const machine = MachineLoader.loadFromJSON(jsonString);
    console.log(`  ✓ Machine loaded: "${machine.name}"`);
    console.log(`  ✓ Description: ${machine.description}`);
    console.log(`  ✓ Sequences: ${machine.getAllSequences().length}`);
    console.log(`  ✓ Arbiter Rule: ${machine.getArbiter().getRule()}`);

    if (machine.perceptualMapping) {
      console.log(`  ✓ Perceptual Mapping:`);
      console.log(`     - Input: En[${machine.perceptualMapping.input.offset}:${machine.perceptualMapping.input.offset + machine.perceptualMapping.input.length}]`);
      console.log(`     - Output: En[${machine.perceptualMapping.output.offset}:${machine.perceptualMapping.output.offset + machine.perceptualMapping.output.length}]`);
    }

    // Test round-trip (save and reload)
    console.log(`  ⟳ Testing round-trip serialization...`);
    const savedJSON = MachineLoader.saveToJSON(machine, false);
    const reloadedMachine = MachineLoader.loadFromJSON(savedJSON);

    if (reloadedMachine.name === machine.name &&
        reloadedMachine.getAllSequences().length === machine.getAllSequences().length) {
      console.log(`  ✓ Round-trip successful`);
    } else {
      console.error(`  ❌ Round-trip failed: machines don't match`);
      failureCount++;
      continue;
    }

    console.log(`  ✅ ${filename} - ALL TESTS PASSED`);
    successCount++;

  } catch (error) {
    console.error(`  ❌ Error loading ${filename}:`);
    console.error(`     ${error.message}`);
    if (error.stack) {
      console.error(`     ${error.stack.split('\n').slice(1, 3).join('\n     ')}`);
    }
    failureCount++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Summary:`);
console.log(`  ✅ Passed: ${successCount}/${machineFiles.length}`);
console.log(`  ❌ Failed: ${failureCount}/${machineFiles.length}`);

if (failureCount === 0) {
  console.log(`\n🎉 All machine JSON files loaded successfully!`);
  process.exit(0);
} else {
  console.log(`\n⚠️  Some tests failed. Please review the errors above.`);
  process.exit(1);
}
