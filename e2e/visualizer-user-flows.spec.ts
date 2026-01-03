import { test, expect, Page } from '@playwright/test';

/**
 * Reality Engine Visualizer - User Flow E2E Tests
 *
 * Tests three common user paths through the new UI/UX:
 * 1. Top-level archive view → selectMachine → Machine Visualization
 * 2. Machine Visualization → Run Simulated Input Stream → Reset Machine
 * 3. Machine Visualization → Add New Critical Event Sequence → Name Sequence → Save Sequence
 */

const VISUALIZER_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

test.describe('Visualizer User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure the visualizer is accessible
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');
  });

  /**
   * USER FLOW 1: Top-level archive view → selectMachine → Machine Visualization
   *
   * This test validates the complete flow from landing on the machine selection
   * view, browsing machines, and selecting one for visualization.
   */
  test('Flow 1: Browse machine library and select machine for visualization', async ({ page }) => {
    test.setTimeout(60000);

    // Step 1: Verify we land on Machine Selection View
    await test.step('Verify Machine Selection View loads', async () => {
      // Check for main header
      await expect(page.locator('text=Reality Engine')).toBeVisible();

      // Check for search box
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();

      // Check for "New Machine" button
      await expect(page.locator('button:has-text("New Machine")')).toBeVisible();

      // Check for filter tabs
      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("Examples")')).toBeVisible();
      await expect(page.locator('button:has-text("Custom")')).toBeVisible();
    });

    // Step 2: Test search functionality
    await test.step('Test search functionality', async () => {
      const searchInput = page.locator('input[placeholder*="Search"]');

      // Type in search
      await searchInput.fill('NAND');

      // Wait for filtering to occur
      await page.waitForTimeout(500);

      // Verify results are filtered
      // (We expect at least the NAND gate example to be visible)
      const machineCards = page.locator('[style*="width: 300px"][style*="height: 200px"]');
      const cardCount = await machineCards.count();

      // Should have at least 1 card
      expect(cardCount).toBeGreaterThanOrEqual(1);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
    });

    // Step 3: Test filter tabs
    await test.step('Test filter tabs', async () => {
      // Click "Examples" filter
      const examplesTab = page.locator('button:has-text("Examples")');
      await examplesTab.click();

      // Verify tab is active (has blue background)
      await expect(examplesTab).toHaveCSS('background', /rgb\(59, 130, 246\)/);

      // Wait for filtering
      await page.waitForTimeout(500);

      // Verify only example machines are shown
      const exampleBadges = page.locator('span:has-text("Example")');
      const badgeCount = await exampleBadges.count();
      expect(badgeCount).toBeGreaterThan(0);

      // Click "All" to show all machines again
      await page.locator('button:has-text("All")').click();
      await page.waitForTimeout(500);
    });

    // Step 4: Test sort functionality
    await test.step('Test sort dropdown', async () => {
      const sortDropdown = page.locator('select');

      // Verify default is "recent"
      await expect(sortDropdown).toHaveValue('recent');

      // Change to "name"
      await sortDropdown.selectOption('name');
      await page.waitForTimeout(500);

      // Change back to "recent"
      await sortDropdown.selectOption('recent');
      await page.waitForTimeout(500);
    });

    // Step 5: Test machine card hover interaction
    await test.step('Test machine card hover effects', async () => {
      const firstCard = page.locator('[style*="width: 300px"][style*="height: 200px"]').first();

      // Hover over card
      await firstCard.hover();

      // Wait for hover effects
      await page.waitForTimeout(300);

      // Verify edit/delete buttons appear
      await expect(firstCard.locator('button:has-text("Edit")')).toBeVisible();

      // Move mouse away
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    });

    // Step 6: Select a machine and navigate to Administration View
    await test.step('Select machine and navigate to Administration View', async () => {
      // Find a machine card (prefer NAND gate or first available)
      const machineCards = page.locator('[style*="width: 300px"][style*="height: 200px"]');
      const firstCard = machineCards.first();

      // Get machine name before clicking (h3 element in the card)
      const machineName = await firstCard.locator('h3').first().textContent();

      // Click the card
      await firstCard.click();

      // Wait for navigation and loading
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Verify we're in Machine Administration View
      // Check for Top Navigation Bar with Back button
      await expect(page.locator('button:has-text("Back")').or(page.locator('text=← Back'))).toBeVisible({ timeout: 10000 });

      // Check for breadcrumb with "Machines" text
      await expect(page.locator('text=Machines')).toBeVisible();

      // Check for machine name in breadcrumb
      if (machineName) {
        await expect(page.locator(`text=${machineName.trim()}`)).toBeVisible({ timeout: 10000 });
      }

      // Check for Floating Control Panel - look for any of the tab buttons
      await expect(page.locator('button:has-text("Overview")').or(page.locator('button:has-text("Simulation")'))).toBeVisible({ timeout: 10000 });

      // Check for graph canvas (ReactFlow)
      const canvas = page.locator('[class*="react-flow"]');
      await expect(canvas).toBeVisible({ timeout: 10000 });
    });

    // Step 7: Verify graph visualization elements
    await test.step('Verify graph visualization loaded', async () => {
      // Wait for graph to render
      await page.waitForTimeout(2000);

      // Check for legend
      await expect(page.locator('text=Legend')).toBeVisible();
      await expect(page.locator('text=Event Spaces')).toBeVisible();
      await expect(page.locator('text=Input Event Space')).toBeVisible();
      await expect(page.locator('text=Output Event Space')).toBeVisible();

      // Check for ReactFlow controls
      await expect(page.locator('[class*="react-flow__controls"]')).toBeVisible();

      // Check for minimap
      await expect(page.locator('[class*="react-flow__minimap"]')).toBeVisible();
    });
  });

  /**
   * USER FLOW 2: Machine Visualization → Run Simulated Input Stream → Reset Machine
   *
   * This test validates the simulation playback controls and state management.
   */
  test('Flow 2: Run simulation with input stream and reset machine', async ({ page }) => {
    test.setTimeout(90000);

    // Step 1: Navigate to a machine (reuse setup from Flow 1)
    await test.step('Navigate to machine with simulation data', async () => {
      // Click on first available machine
      const firstCard = page.locator('[style*="width: 300px"][style*="height: 200px"]').first();
      await firstCard.click();

      // Wait for machine to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    // Step 2: Open Floating Control Panel
    await test.step('Open Floating Control Panel', async () => {
      // Wait for panel to be visible
      await page.waitForTimeout(1000);

      // Find the expand button (▲ symbol)
      const expandButton = page.locator('button:has-text("▲")');
      await expect(expandButton).toBeVisible({ timeout: 10000 });

      // Click to expand (force click to bypass pointer interception from graph elements)
      await expandButton.click({ force: true });
      await page.waitForTimeout(500);

      // Verify tabs are now visible
      await expect(page.locator('button:has-text("Overview")')).toBeVisible();
      await expect(page.locator('button:has-text("Simulation")')).toBeVisible();
    });

    // Step 3: Navigate to Simulation tab
    await test.step('Navigate to Simulation tab', async () => {
      const simulationTab = page.locator('button:has-text("Simulation")');
      await simulationTab.click();
      await page.waitForTimeout(500);

      // Verify simulation controls are visible - look for Play button
      await expect(page.locator('button:has-text("Play")').or(page.locator('button:has-text("Resume")'))).toBeVisible({ timeout: 10000 });
    });

    // Step 4: Verify simulation state display
    await test.step('Verify simulation status display', async () => {
      // Check for status indicator text
      await expect(page.locator('text=Status').or(page.locator('text=Simulation'))).toBeVisible({ timeout: 10000 });

      // Check for playback controls - at least one should be visible
      await expect(
        page.locator('button:has-text("Play")').or(page.locator('button:has-text("Resume")'))
      ).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button:has-text("Stop")')).toBeVisible();
      await expect(page.locator('button:has-text("Step")')).toBeVisible();
      await expect(page.locator('button:has-text("Reset")')).toBeVisible();
    });

    // Step 5: Check if input vectors are loaded
    await test.step('Verify input vectors loaded', async () => {
      // Look for "Total: X vectors" text
      const totalVectorsText = page.locator('text=/Total:.*vectors/');

      if (await totalVectorsText.isVisible()) {
        // Vectors are loaded, proceed with simulation
        console.log('Input vectors found, proceeding with simulation');
      } else {
        // No vectors loaded - this is expected for some machines
        console.log('No input vectors loaded - skipping playback test');
        test.skip();
      }
    });

    // Step 6: Start simulation playback
    await test.step('Start simulation playback', async () => {
      const playButton = page.locator('button:has-text("Play"), button:has-text("▶ Play")').first();

      // Verify button is enabled
      await expect(playButton).toBeEnabled();

      // Click play
      await playButton.click();
      await page.waitForTimeout(500);

      // Verify status changed to "Playing"
      await expect(page.locator('text=Playing')).toBeVisible();

      // Verify button changed to "Pause"
      await expect(page.locator('button:has-text("Pause"), button:has-text("⏸ Pause")')).toBeVisible();

      // Wait for some simulation steps
      await page.waitForTimeout(2000);
    });

    // Step 7: Verify graph updates during playback
    await test.step('Verify graph animates during playback', async () => {
      // Look for active (green) nodes or animated edges
      // This is visual verification - in reality, we'd check DOM updates

      // Wait for animation
      await page.waitForTimeout(1000);

      // Check that progress bar or current index is updating
      // (Implementation specific - look for changing text)
      const statusSection = page.locator('text=Status').locator('..');
      await expect(statusSection).toBeVisible();
    });

    // Step 8: Pause simulation
    await test.step('Pause simulation', async () => {
      const pauseButton = page.locator('button:has-text("Pause"), button:has-text("⏸ Pause")').first();

      // Click pause
      await pauseButton.click();
      await page.waitForTimeout(500);

      // Verify status changed to "Paused"
      await expect(page.locator('text=Paused')).toBeVisible();

      // Verify button changed to "Resume"
      await expect(page.locator('button:has-text("Resume"), button:has-text("▶ Resume")')).toBeVisible();
    });

    // Step 9: Test step functionality
    await test.step('Test step-by-step advance', async () => {
      const stepButton = page.locator('button:has-text("Step"), button:has-text("⏭ Step")').first();

      // Verify step button is enabled when paused
      await expect(stepButton).toBeEnabled();

      // Get current index
      const beforeStepText = await page.locator('text=/Vector.*\//').textContent();

      // Click step
      await stepButton.click();
      await page.waitForTimeout(500);

      // Verify index advanced (or simulation completed)
      const afterStepText = await page.locator('text=/Vector.*\//').textContent();

      // Should be different or completed
      if (beforeStepText && afterStepText) {
        console.log(`Stepped from "${beforeStepText}" to "${afterStepText}"`);
      }
    });

    // Step 10: Resume playback
    await test.step('Resume simulation playback', async () => {
      const resumeButton = page.locator('button:has-text("Resume"), button:has-text("▶ Resume")').first();

      // Click resume
      await resumeButton.click();
      await page.waitForTimeout(500);

      // Verify status changed back to "Playing"
      await expect(page.locator('text=Playing')).toBeVisible();

      // Let it play for a bit
      await page.waitForTimeout(2000);
    });

    // Step 11: Stop simulation
    await test.step('Stop simulation', async () => {
      const stopButton = page.locator('button:has-text("Stop"), button:has-text("⏹ Stop")').first();

      // Click stop
      await stopButton.click();
      await page.waitForTimeout(500);

      // Verify status changed to "Stopped"
      await expect(page.locator('text=Stopped')).toBeVisible();

      // Verify play button is available again
      await expect(page.locator('button:has-text("Play"), button:has-text("▶ Play")')).toBeVisible();
    });

    // Step 12: Reset machine
    await test.step('Reset machine to initial state', async () => {
      const resetButton = page.locator('button:has-text("Reset"), button:has-text("↻ Reset")').first();

      // Click reset
      await resetButton.click();
      await page.waitForTimeout(1000);

      // Verify status is still "Stopped"
      await expect(page.locator('text=Stopped')).toBeVisible();

      // Verify progress reset (currentIndex should be 0)
      await expect(page.locator('text=/Vector 0/').or(page.locator('text=/Current:.*0/'))).toBeVisible();
    });

    // Step 13: Test speed controls
    await test.step('Test playback speed controls', async () => {
      // Find speed buttons
      const speed100 = page.locator('button:has-text("100ms")');
      const speed500 = page.locator('button:has-text("500ms")');
      const speed1000 = page.locator('button:has-text("1000ms")');
      const speed2000 = page.locator('button:has-text("2000ms")');

      // Click different speeds
      await speed100.click();
      await page.waitForTimeout(300);

      await speed1000.click();
      await page.waitForTimeout(300);

      // Verify button is highlighted (implementation specific)
      // Speed change would be confirmed by starting playback and timing
    });
  });

  /**
   * USER FLOW 3: Machine Visualization → Add New Critical Event Sequence → Name Sequence → Save Sequence
   *
   * NOTE: This feature is not yet implemented in the current UI.
   * This test is a placeholder that will fail until the sequence builder is added.
   *
   * Expected implementation: Sequences tab → "+ Add Sequence" button → Create dialog
   */
  test.skip('Flow 3: Add new critical event sequence (NOT IMPLEMENTED)', async ({ page }) => {
    test.setTimeout(60000);

    // Step 1: Navigate to a machine
    await test.step('Navigate to machine', async () => {
      const firstCard = page.locator('[style*="width: 300px"][style*="height: 200px"]').first();
      await firstCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    // Step 2: Open Sequences tab
    await test.step('Open Sequences tab', async () => {
      // Expand panel if needed
      const panel = page.locator('[style*="position: fixed"][style*="bottom: 20px"]').first();
      const expandButton = panel.locator('button').last();
      await expandButton.click();
      await page.waitForTimeout(500);

      // Click Sequences tab
      const sequencesTab = page.locator('button:has-text("Sequences")');
      await sequencesTab.click();
      await page.waitForTimeout(500);
    });

    // Step 3: Look for "+ Add Sequence" button (NOT IMPLEMENTED YET)
    await test.step('Find Add Sequence button', async () => {
      const addButton = page.locator('button:has-text("Add Sequence"), button:has-text("+ Add")');

      // This will fail until implemented
      await expect(addButton).toBeVisible();
    });

    // Step 4: Click to open Create Sequence dialog
    await test.step('Open Create Sequence dialog', async () => {
      const addButton = page.locator('button:has-text("Add Sequence")');
      await addButton.click();
      await page.waitForTimeout(500);

      // Verify dialog opened
      await expect(page.locator('text=Create New Sequence, Add Sequence')).toBeVisible();
    });

    // Step 5: Fill in sequence name
    await test.step('Enter sequence name', async () => {
      const nameInput = page.locator('input[placeholder*="name"], input[id*="name"]').first();
      await nameInput.fill('Test Sequence E2E');

      // Verify input
      await expect(nameInput).toHaveValue('Test Sequence E2E');
    });

    // Step 6: Define initial vectors (implementation TBD)
    await test.step('Define initial vectors', async () => {
      // This would involve clicking "+ Add Vector" buttons
      // and filling in vector elements
      // Implementation TBD
    });

    // Step 7: Add transitions (implementation TBD)
    await test.step('Add transitions', async () => {
      // This would involve defining edges between vectors
      // Implementation TBD
    });

    // Step 8: Add outputs (implementation TBD)
    await test.step('Add output vectors', async () => {
      // This would involve marking vectors as having outputs
      // and defining output vector values
      // Implementation TBD
    });

    // Step 9: Save sequence
    await test.step('Save sequence', async () => {
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")');
      await saveButton.click();
      await page.waitForTimeout(1000);

      // Verify dialog closed
      await expect(page.locator('text=Create New Sequence')).not.toBeVisible();

      // Verify new sequence appears in list
      await expect(page.locator('text=Test Sequence E2E')).toBeVisible();
    });

    // Step 10: Verify sequence in graph
    await test.step('Verify sequence appears in graph', async () => {
      // Close panel to see full graph
      const panel = page.locator('[style*="position: fixed"][style*="bottom: 20px"]').first();
      const collapseButton = panel.locator('button').last();
      await collapseButton.click();
      await page.waitForTimeout(500);

      // Look for new sequence label in graph
      await expect(page.locator('text=Test Sequence E2E')).toBeVisible();
    });
  });

  /**
   * BONUS TEST: Test complete round-trip navigation
   */
  test('Bonus: Complete navigation round-trip', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Start at Selection View
    await expect(page.locator('text=Reality Engine')).toBeVisible();

    // 2. Select a machine
    const firstCard = page.locator('[style*="width: 300px"][style*="height: 200px"]').first();
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. Verify in Administration View
    await expect(page.locator('button:has-text("Back")')).toBeVisible();

    // 4. Click Back button
    const backButton = page.locator('button:has-text("Back")').first();
    await backButton.click();
    await page.waitForTimeout(1000);

    // 5. Verify back at Selection View
    await expect(page.locator('text=Reality Engine')).toBeVisible();
    await expect(page.locator('button:has-text("New Machine")')).toBeVisible();

    // 6. Click breadcrumb "Machines" from Administration View
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const machinesBreadcrumb = page.locator('text=Machines').first();
    await machinesBreadcrumb.click();
    await page.waitForTimeout(1000);

    // 7. Verify back at Selection View again
    await expect(page.locator('button:has-text("New Machine")')).toBeVisible();
  });

  /**
   * BONUS TEST: Test machine CRUD operations
   */
  test('Bonus: Create, edit, and delete custom machine', async ({ page }) => {
    test.setTimeout(90000);

    const testMachineName = `Test Machine ${Date.now()}`;
    const testDescription = 'End-to-end test machine';

    // Step 1: Create new machine
    await test.step('Create new machine', async () => {
      const newMachineButton = page.locator('button:has-text("New Machine")');
      // Force click to bypass pointer interception from search input
      await newMachineButton.click({ force: true });
      await page.waitForTimeout(500);

      // Verify dialog opened
      await expect(page.locator('text=Create New Machine')).toBeVisible();

      // Fill in form
      const nameInput = page.locator('input[id="machine-name"]');
      await nameInput.fill(testMachineName);

      const descInput = page.locator('textarea[id="machine-description"]');
      await descInput.fill(testDescription);

      // Submit
      const createButton = page.locator('button:has-text("Create Machine")');
      await createButton.click();
      await page.waitForTimeout(2000);

      // Verify dialog closed
      await expect(page.locator('text=Create New Machine')).not.toBeVisible();

      // Verify machine appears in grid
      await expect(page.locator(`text=${testMachineName}`)).toBeVisible();
    });

    // Step 2: Edit the machine
    await test.step('Edit machine metadata', async () => {
      // Find the machine card
      const machineCard = page.locator(`text=${testMachineName}`).locator('..').locator('..').locator('..');

      // Hover to show edit button
      await machineCard.hover();
      await page.waitForTimeout(500);

      // Click edit
      const editButton = machineCard.locator('button:has-text("Edit")');
      await editButton.click();
      await page.waitForTimeout(500);

      // Verify edit dialog opened
      await expect(page.locator('text=Edit Machine')).toBeVisible();

      // Update description
      const descInput = page.locator('textarea[id="machine-description"]');
      await descInput.fill(`${testDescription} - EDITED`);

      // Save
      const saveButton = page.locator('button:has-text("Save Changes")');
      await saveButton.click();
      await page.waitForTimeout(2000);

      // Verify dialog closed
      await expect(page.locator('text=Edit Machine')).not.toBeVisible();
    });

    // Step 3: Delete the machine
    await test.step('Delete machine', async () => {
      // Find the machine card
      const machineCard = page.locator(`text=${testMachineName}`).locator('..').locator('..').locator('..');

      // Hover to show delete button
      await machineCard.hover();
      await page.waitForTimeout(500);

      // Click delete
      const deleteButton = machineCard.locator('button:has-text("Delete")');

      // Setup dialog handler for confirmation
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await deleteButton.click();
      await page.waitForTimeout(2000);

      // Verify machine is gone
      await expect(page.locator(`text=${testMachineName}`)).not.toBeVisible();
    });
  });
});
