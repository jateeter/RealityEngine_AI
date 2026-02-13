import { test, expect } from '@playwright/test';

/**
 * Perceptual Space Interconnection E2E Test
 *
 * Tests the complete perceptual space workflow:
 * 1. Multi-Step machine processes input sequences and produces output
 * 2. Multi-Step output (at bytes [3:5]) is perceived as input by RS2 and RSFlipFlop
 * 3. Both RS2 and RSFlipFlop process this input and produce their own outputs
 *
 * Perceptual Space Layout (256 bytes):
 * - [0:3]   Multi-Step input (3 bytes)
 * - [3:5]   Multi-Step output / RS2 & RSFlipFlop input (2 bytes)
 * - [6:8]   RSFlipFlop output (2 bytes)
 * - [8:10]  RS2 output (2 bytes)
 *
 * Input Sequence to Multi-Step:
 * 1. (0,0,0) - No match, perceptual space [3:5] = [0,0]
 * 2. (1,0,0) - Matches Seq2 initial (100), [3:5] still = [0,0]
 * 3. (1,0,1) - Matches Seq2 second (101), [3:5] still = [0,0]
 * 4. (1,1,1) - Matches Seq2 final (111), outputs [1,0], [3:5] = [1,0]
 *
 * Expected Behavior:
 * - Before step 4: Multi-Step output is [0,0], RS2 and RSFlipFlop see [0,0]
 * - At step 4: Multi-Step outputs [1,0]
 * - RS2 sees sequence (0,0)→(1,0) and outputs [1,0]
 * - RSFlipFlop sees (1,0) and outputs [1,0]
 */

const VISUALIZER_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

interface PerceptualVector {
  bytes: number[];
  description: string;
}

// Helper function to create a 256-byte perceptual vector
function createPerceptualVector(inputRegion: number[], description: string): PerceptualVector {
  const bytes = new Array(256).fill(0);
  // Set Multi-Step input region [0:3]
  for (let i = 0; i < inputRegion.length && i < 3; i++) {
    bytes[i] = inputRegion[i];
  }
  return { bytes, description };
}

test.describe('Perceptual Space Interconnection - Multi-Step → RS2 + RSFlipFlop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should complete full perceptual space workflow with machine interconnection', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for comprehensive test

    // ===== STEP 1: Load Machine Interconnection View =====
    await test.step('Navigate to Machine Interconnection View', async () => {
      console.log('Step 1: Loading Machine Interconnection View...');

      await page.waitForTimeout(2000);

      // Look for the Machine Interconnection link/button
      const interconnectionButton = page.locator('text=/Machine.*Interconnection|Interconnection.*View/i').first();

      if (await interconnectionButton.isVisible({ timeout: 5000 })) {
        await interconnectionButton.click();
        await page.waitForTimeout(3000);
        console.log('✓ Machine Interconnection View loaded');
      } else {
        // Alternative: Load Multi-Step machine directly
        const multiStepHeading = page.locator('h3:has-text("Multi-Step State Machine")');
        if (await multiStepHeading.isVisible({ timeout: 5000 })) {
          await multiStepHeading.click();
          await page.waitForTimeout(3000);
          console.log('✓ Multi-Step machine loaded (direct)');
        }
      }
    });

    // ===== STEP 2: Load Multi-Step Machine and Configure =====
    await test.step('Load and verify Multi-Step machine configuration', async () => {
      console.log('Step 2: Loading Multi-Step machine...');

      // If we're in the machine list, click Multi-Step
      const multiStepCard = page.locator('h3:has-text("Multi-Step"), .machine-card:has-text("Multi-Step")').first();
      if (await multiStepCard.isVisible({ timeout: 5000 })) {
        await multiStepCard.click();
        await page.waitForTimeout(3000);
      }

      // Verify we're viewing Multi-Step machine
      const machineTitle = page.locator('text=/Multi-Step/i').first();
      await expect(machineTitle).toBeVisible({ timeout: 10000 });

      console.log('✓ Multi-Step machine loaded and configured');
    });

    // ===== STEP 3: Create Input Perceptual Sequence =====
    await test.step('Create input perceptual sequence', async () => {
      console.log('Step 3: Creating input perceptual sequence...');

      // Define the input sequence
      const inputSequence: PerceptualVector[] = [
        createPerceptualVector([0, 0, 0], 'Initial zero vector'),
        createPerceptualVector([1, 0, 0], 'Seq2 initial: 100'),
        createPerceptualVector([1, 0, 1], 'Seq2 second: 101'),
        createPerceptualVector([1, 1, 1], 'Seq2 final: 111 → outputs [1,0]'),
      ];

      // Navigate to sequence manager
      const logsButton = page.locator('button:has-text("📋 Logs"), button[title*="sequence"]').first();
      if (await logsButton.isVisible({ timeout: 5000 })) {
        await logsButton.click();
        await page.waitForTimeout(1000);
      }

      // Look for the sequence manager or input queue panel
      const sequenceManager = page.locator('text=/Sequence.*Manager|Input.*Queue|Perceptual.*Input/i').first();
      if (await sequenceManager.isVisible({ timeout: 5000 })) {
        console.log('✓ Sequence manager accessible');
      }

      // Use the API to load the sequence directly
      const response = await page.request.post(`${API_URL}/api/simulation/load`, {
        data: {
          vectors: inputSequence.map(v => v.bytes),
          autoPlayDelayMs: 1000,
          loop: false,
          usePerceptualSpace: true
        }
      });

      expect(response.ok()).toBeTruthy();
      console.log(`✓ Input sequence loaded: ${inputSequence.length} vectors`);
    });

    // ===== STEP 4: Execute Sequence and Verify Initial State =====
    await test.step('Execute sequence and verify initial state (output = 0,0)', async () => {
      console.log('Step 4: Executing initial vectors...');

      // Start simulation
      const startResponse = await page.request.post(`${API_URL}/api/simulation/start`);
      expect(startResponse.ok()).toBeTruthy();

      await page.waitForTimeout(1000);

      // Step through first 3 vectors
      for (let i = 0; i < 3; i++) {
        const stepResponse = await page.request.post(`${API_URL}/api/simulation/step`);
        expect(stepResponse.ok()).toBeTruthy();

        const stepData = await stepResponse.json();
        console.log(`  Step ${i + 1}: Input = [${stepData.state.currentVector?.slice(0, 3)}]`);

        await page.waitForTimeout(1000);
      }

      // Verify perceptual space [3:5] is still [0,0]
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];
      const multiStepOutput = perceptualSpace.slice(3, 5);

      console.log(`  Perceptual space [3:5] = [${multiStepOutput}]`);
      expect(multiStepOutput[0]).toBe(0);
      expect(multiStepOutput[1]).toBe(0);

      console.log('✓ Initial state verified: Multi-Step output = [0,0]');
    });

    // ===== STEP 5: Execute Final Vector and Verify Multi-Step Output =====
    await test.step('Execute final vector and verify Multi-Step outputs [1,0]', async () => {
      console.log('Step 5: Executing final vector (1,1,1)...');

      // Step to the final vector
      const stepResponse = await page.request.post(`${API_URL}/api/simulation/step`);
      expect(stepResponse.ok()).toBeTruthy();

      const stepData = await stepResponse.json();
      console.log(`  Step 4: Input = [${stepData.state.currentVector?.slice(0, 3)}]`);

      await page.waitForTimeout(1500);

      // Verify Multi-Step produced output [1,0] at bytes [3:5]
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];
      const multiStepOutput = perceptualSpace.slice(3, 5);

      console.log(`  Perceptual space [3:5] = [${multiStepOutput}]`);
      expect(multiStepOutput[0]).toBe(1);
      expect(multiStepOutput[1]).toBe(0);

      console.log('✓ Multi-Step output verified: [1,0]');
    });

    // ===== STEP 6: Verify RS2 and RSFlipFlop Receive Input =====
    await test.step('Verify RS2 and RSFlipFlop perceive Multi-Step output', async () => {
      console.log('Step 6: Verifying RS2 and RSFlipFlop perceive [1,0] as input...');

      // Get the current perceptual space state
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];

      // RS2 input region is [3:5]
      const rs2Input = perceptualSpace.slice(3, 5);
      console.log(`  RS2 input [3:5] = [${rs2Input}]`);
      expect(rs2Input[0]).toBe(1);
      expect(rs2Input[1]).toBe(0);

      // RSFlipFlop input region is also [3:5]
      const rsFlipFlopInput = perceptualSpace.slice(3, 5);
      console.log(`  RSFlipFlop input [3:5] = [${rsFlipFlopInput}]`);
      expect(rsFlipFlopInput[0]).toBe(1);
      expect(rsFlipFlopInput[1]).toBe(0);

      console.log('✓ Both machines perceive correct input [1,0]');
    });

    // ===== STEP 7: Load RS2 Machine and Verify Output =====
    await test.step('Load RS2 machine and verify output [1,0]', async () => {
      console.log('Step 7: Loading RS2 machine...');

      // Navigate back to machine selection
      const backButton = page.locator('button:has-text("Back"), button[title*="back"]').first();
      if (await backButton.isVisible({ timeout: 5000 })) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }

      // Load RS2 machine
      const rs2Card = page.locator('h3:has-text("RS2"), .machine-card:has-text("RS2")').first();
      if (await rs2Card.isVisible({ timeout: 10000 })) {
        await rs2Card.click();
        await page.waitForTimeout(3000);
      }

      // Verify RS2 machine loaded
      const rs2Title = page.locator('text=/RS2/i').first();
      await expect(rs2Title).toBeVisible({ timeout: 10000 });

      // Load the same perceptual sequence for RS2
      const inputSequence: PerceptualVector[] = [
        createPerceptualVector([0, 0, 0], 'Initial zero vector'),
        createPerceptualVector([1, 0, 0], 'Seq2 initial: 100'),
        createPerceptualVector([1, 0, 1], 'Seq2 second: 101'),
        createPerceptualVector([1, 1, 1], 'Seq2 final: 111 → outputs [1,0]'),
      ];

      // Reset simulation first
      await page.request.post(`${API_URL}/api/simulation/reset`);
      await page.waitForTimeout(1000);

      // Load sequence
      const loadResponse = await page.request.post(`${API_URL}/api/simulation/load`, {
        data: {
          vectors: inputSequence.map(v => v.bytes),
          autoPlayDelayMs: 1000,
          loop: false,
          usePerceptualSpace: true
        }
      });
      expect(loadResponse.ok()).toBeTruthy();

      // Start and step through simulation
      await page.request.post(`${API_URL}/api/simulation/start`);
      await page.waitForTimeout(1000);

      // Step through all vectors
      for (let i = 0; i < 4; i++) {
        await page.request.post(`${API_URL}/api/simulation/step`);
        await page.waitForTimeout(1000);
      }

      // Verify RS2 output at bytes [8:10]
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];
      const rs2Output = perceptualSpace.slice(8, 10);

      console.log(`  RS2 output [8:10] = [${rs2Output}]`);
      expect(rs2Output[0]).toBe(1);
      expect(rs2Output[1]).toBe(0);

      console.log('✓ RS2 output verified: [1,0]');
    });

    // ===== STEP 8: Load RSFlipFlop Machine and Verify Output =====
    await test.step('Load RSFlipFlop machine and verify output [1,0]', async () => {
      console.log('Step 8: Loading RS Flip Flop machine...');

      // Navigate back to machine selection
      const backButton = page.locator('button:has-text("Back"), button[title*="back"]').first();
      if (await backButton.isVisible({ timeout: 5000 })) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }

      // Load RS Flip Flop machine
      const rsFlipFlopCard = page.locator('h3:has-text("RS Flip Flop"), .machine-card:has-text("RS Flip Flop")').first();
      if (await rsFlipFlopCard.isVisible({ timeout: 10000 })) {
        await rsFlipFlopCard.click();
        await page.waitForTimeout(3000);
      }

      // Verify RS Flip Flop machine loaded
      const rsFlipFlopTitle = page.locator('text=/RS Flip Flop/i').first();
      await expect(rsFlipFlopTitle).toBeVisible({ timeout: 10000 });

      // Load the same perceptual sequence
      const inputSequence: PerceptualVector[] = [
        createPerceptualVector([0, 0, 0], 'Initial zero vector'),
        createPerceptualVector([1, 0, 0], 'Seq2 initial: 100'),
        createPerceptualVector([1, 0, 1], 'Seq2 second: 101'),
        createPerceptualVector([1, 1, 1], 'Seq2 final: 111 → outputs [1,0]'),
      ];

      // Reset simulation first
      await page.request.post(`${API_URL}/api/simulation/reset`);
      await page.waitForTimeout(1000);

      // Load sequence
      const loadResponse = await page.request.post(`${API_URL}/api/simulation/load`, {
        data: {
          vectors: inputSequence.map(v => v.bytes),
          autoPlayDelayMs: 1000,
          loop: false,
          usePerceptualSpace: true
        }
      });
      expect(loadResponse.ok()).toBeTruthy();

      // Start and step through simulation
      await page.request.post(`${API_URL}/api/simulation/start`);
      await page.waitForTimeout(1000);

      // Step through all vectors
      for (let i = 0; i < 4; i++) {
        await page.request.post(`${API_URL}/api/simulation/step`);
        await page.waitForTimeout(1000);
      }

      // Verify RSFlipFlop output at bytes [6:8]
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];
      const rsFlipFlopOutput = perceptualSpace.slice(6, 8);

      console.log(`  RSFlipFlop output [6:8] = [${rsFlipFlopOutput}]`);
      expect(rsFlipFlopOutput[0]).toBe(1);
      expect(rsFlipFlopOutput[1]).toBe(0);

      console.log('✓ RS Flip Flop output verified: [1,0]');
    });

    // ===== STEP 9: Verify All Active and Final Events =====
    await test.step('Verify all active and final events presented to output perception', async () => {
      console.log('Step 9: Verifying event propagation through perceptual space...');

      // Get the complete history
      const historyResponse = await page.request.get(`${API_URL}/api/simulation/history`);
      const historyData = await historyResponse.json();

      const history = historyData.history || [];
      console.log(`  Total simulation steps: ${history.length}`);

      // Verify each step had proper perceptual space updates
      let activeEventCount = 0;
      let finalEventCount = 0;

      for (let i = 0; i < history.length; i++) {
        const step = history[i];

        // Check if this step activated any events
        if (step.matches && step.matches.length > 0) {
          activeEventCount++;
          console.log(`  Step ${i + 1}: ${step.matches.length} event(s) activated`);
        }

        // Check if this step generated any outputs
        if (step.outputs && step.outputs.length > 0) {
          finalEventCount++;
          console.log(`  Step ${i + 1}: ${step.outputs.length} output(s) generated`);
        }
      }

      console.log(`  Total active events: ${activeEventCount}`);
      console.log(`  Total final events (outputs): ${finalEventCount}`);

      expect(activeEventCount).toBeGreaterThan(0);
      expect(finalEventCount).toBeGreaterThan(0);

      console.log('✓ Event propagation verified through perceptual space');
    });

    // ===== STEP 10: Verify Complete Perceptual Space State =====
    await test.step('Verify complete perceptual space final state', async () => {
      console.log('Step 10: Verifying complete perceptual space state...');

      // Get final state
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const stateData = await stateResponse.json();

      const perceptualSpace = stateData.state.currentVector || [];

      console.log('  Final Perceptual Space State:');
      console.log(`    Multi-Step input [0:3]:  [${perceptualSpace.slice(0, 3)}]`);
      console.log(`    Multi-Step output [3:5]: [${perceptualSpace.slice(3, 5)}]`);
      console.log(`    RS2/RSFlipFlop input [3:5]: [${perceptualSpace.slice(3, 5)}]`);
      console.log(`    RSFlipFlop output [6:8]: [${perceptualSpace.slice(6, 8)}]`);
      console.log(`    RS2 output [8:10]: [${perceptualSpace.slice(8, 10)}]`);

      // Verify the expected final state
      expect(perceptualSpace.slice(0, 3)).toEqual([1, 1, 1]); // Last input to Multi-Step
      expect(perceptualSpace.slice(3, 5)).toEqual([1, 0]);    // Multi-Step output
      expect(perceptualSpace.slice(6, 8)).toEqual([1, 0]);    // RSFlipFlop output
      expect(perceptualSpace.slice(8, 10)).toEqual([1, 0]);   // RS2 output

      console.log('✓ Complete perceptual space state verified');
    });

    console.log('✅ Perceptual space interconnection test completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log('  1. Multi-Step machine processed sequence: (0,0,0)→(1,0,0)→(1,0,1)→(1,1,1)');
    console.log('  2. Multi-Step produced output [1,0] at bytes [3:5]');
    console.log('  3. RS2 perceived [0,0]→[1,0] sequence and produced output [1,0] at bytes [8:10]');
    console.log('  4. RSFlipFlop perceived [1,0] and produced output [1,0] at bytes [6:8]');
    console.log('  5. All active and final events presented to output perception');
    console.log('  6. Complete perceptual space verified with all binary inputs/outputs');
  });

  test('should verify perceptual space remains consistent across machine switches', async ({ page }) => {
    test.setTimeout(120000);

    await test.step('Verify perceptual space consistency', async () => {
      console.log('Verifying perceptual space consistency across machines...');

      // Create and load perceptual sequence
      const inputSequence = [
        createPerceptualVector([0, 0, 0], 'Initial'),
        createPerceptualVector([1, 0, 0], 'Step 1'),
        createPerceptualVector([1, 0, 1], 'Step 2'),
        createPerceptualVector([1, 1, 1], 'Final'),
      ];

      await page.request.post(`${API_URL}/api/simulation/reset`);
      await page.request.post(`${API_URL}/api/simulation/load`, {
        data: {
          vectors: inputSequence.map(v => v.bytes),
          usePerceptualSpace: true
        }
      });

      // Execute full sequence
      await page.request.post(`${API_URL}/api/simulation/start`);
      for (let i = 0; i < 4; i++) {
        await page.request.post(`${API_URL}/api/simulation/step`);
        await page.waitForTimeout(500);
      }

      // Get perceptual space state
      const stateResponse = await page.request.get(`${API_URL}/api/simulation/state`);
      const initialState = await stateResponse.json();
      const initialPerceptualSpace = initialState.state.currentVector || [];

      console.log('  Initial perceptual space captured');

      // Switch to different machine view (RS2)
      await page.goto(VISUALIZER_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const rs2Card = page.locator('h3:has-text("RS2")').first();
      if (await rs2Card.isVisible({ timeout: 5000 })) {
        await rs2Card.click();
        await page.waitForTimeout(2000);
      }

      // Verify perceptual space is still consistent
      const stateResponse2 = await page.request.get(`${API_URL}/api/simulation/state`);
      const currentState = await stateResponse2.json();
      const currentPerceptualSpace = currentState.state.currentVector || [];

      expect(currentPerceptualSpace).toEqual(initialPerceptualSpace);

      console.log('✓ Perceptual space remains consistent across machine switches');
    });
  });
});
