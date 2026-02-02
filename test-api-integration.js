#!/usr/bin/env node

/**
 * Test script to validate machine JSON API integration
 * Tests the new JSON load/save endpoints
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

console.log('🧪 Testing Machine JSON API Integration\n');
console.log('=' .repeat(60));
console.log(`API URL: ${API_URL}\n`);

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, testFn) {
  try {
    console.log(`\n📋 Test: ${name}`);
    await testFn();
    console.log(`  ✅ PASSED`);
    testsPassed++;
  } catch (error) {
    console.error(`  ❌ FAILED: ${error.message}`);
    if (error.response?.data) {
      console.error(`     Response:`, JSON.stringify(error.response.data, null, 2));
    }
    testsFailed++;
  }
}

async function main() {
  // Test 1: List available machine JSON files
  await runTest('List available machine JSON files', async () => {
    const response = await axios.get(`${API_URL}/api/machines/json/list`);

    if (!response.data.machines || !Array.isArray(response.data.machines)) {
      throw new Error('Expected machines array in response');
    }

    console.log(`  ✓ Found ${response.data.machines.length} machine JSON files`);
    response.data.machines.forEach(m => {
      console.log(`     - ${m.filename}: ${m.name} (${m.sequenceCount} sequences)`);
    });

    if (response.data.machines.length < 5) {
      throw new Error(`Expected at least 5 machine files, found ${response.data.machines.length}`);
    }
  });

  // Test 2: Load a specific machine from JSON
  await runTest('Load RS2 machine from JSON', async () => {
    const response = await axios.get(`${API_URL}/api/machines/json/RS2`);

    if (!response.data.success) {
      throw new Error('Expected success: true in response');
    }

    if (!response.data.machine) {
      throw new Error('Expected machine in response');
    }

    console.log(`  ✓ Loaded: ${response.data.machine.name}`);
    console.log(`  ✓ Description: ${response.data.machine.description}`);
    console.log(`  ✓ Sequences: ${response.data.machine.sequences.length}`);
  });

  // Test 3: Get all machines (should include loaded ones)
  await runTest('Get all machines', async () => {
    const response = await axios.get(`${API_URL}/api/machines`);

    if (!response.data.machines || !Array.isArray(response.data.machines)) {
      throw new Error('Expected machines array in response');
    }

    console.log(`  ✓ Total machines in engine: ${response.data.machines.length}`);

    // Check if RS2 is in the list
    const rs2 = response.data.machines.find(m => m.name === 'RS2');
    if (!rs2) {
      throw new Error('RS2 machine not found in engine after loading');
    }

    console.log(`  ✓ RS2 machine found in engine`);
  });

  // Test 4: Export a machine to JSON
  await runTest('Export machine to JSON', async () => {
    // First get the machine ID
    const machinesResponse = await axios.get(`${API_URL}/api/machines`);
    const rs2 = machinesResponse.data.machines.find(m => m.name === 'RS2');

    if (!rs2) {
      throw new Error('RS2 machine not found');
    }

    // Export the machine
    const response = await axios.get(`${API_URL}/api/machines/${rs2.id}/export?pretty=true`);

    if (typeof response.data !== 'string' && typeof response.data !== 'object') {
      throw new Error('Expected JSON string or object in response');
    }

    const json = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const parsed = JSON.parse(json);

    if (!parsed.version || !parsed.machine) {
      throw new Error('Invalid machine JSON format');
    }

    console.log(`  ✓ Exported machine: ${parsed.machine.name}`);
    console.log(`  ✓ Version: ${parsed.version}`);
    console.log(`  ✓ Sequences: ${parsed.machine.sequences.length}`);
  });

  // Test 5: Import a machine from JSON
  await runTest('Import machine from JSON', async () => {
    const testMachineJSON = JSON.stringify({
      "version": "1.0.0",
      "machine": {
        "name": "Test Import Machine",
        "description": "Machine created via import API",
        "metadata": {
          "category": "test",
          "tags": ["test", "import"]
        },
        "arbiterRule": "PASSTHROUGH",
        "sequences": [
          {
            "name": "Test Sequence",
            "vectors": [
              {
                "elements": [
                  { "value": 1, "comparatorType": "equals", "threshold": 0.05 }
                ],
                "isInitial": true,
                "outputVectors": [
                  {
                    "vector": [1],
                    "metadata": { "description": "Test output" }
                  }
                ]
              }
            ]
          }
        ],
        "inputSequences": []
      }
    });

    const response = await axios.post(`${API_URL}/api/machines/json/import`, {
      json: testMachineJSON
    });

    if (!response.data.success) {
      throw new Error('Expected success: true in response');
    }

    console.log(`  ✓ Imported machine: ${response.data.machine.name}`);
    console.log(`  ✓ Machine ID: ${response.data.machine.id}`);
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`  ✅ Passed: ${testsPassed}/5`);
  console.log(`  ❌ Failed: ${testsFailed}/5`);

  if (testsFailed === 0) {
    console.log(`\n🎉 All API integration tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Please check the errors above.`);
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error('\n❌ Test suite failed:', error.message);
  process.exit(1);
});
