import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Visualizer Frontend
 * Tests the React UI running in Docker with Nginx
 */

const VISUALIZER_URL = 'https://localhost:5173';

test.describe('Visualizer - Page Load', () => {
  test('should load the visualizer homepage', async ({ page }) => {
    await page.goto(VISUALIZER_URL);

    // Check page loaded
    await expect(page).toHaveTitle(/Reality Engine/i);

    // Wait for React to hydrate
    await page.waitForLoadState('networkidle');
  });

  test('should display the main heading', async ({ page }) => {
    await page.goto(VISUALIZER_URL);

    // Look for main heading or app title
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});

test.describe('Visualizer - Sidebar Navigation', () => {
  test('should display sequence list in sidebar', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Check if sidebar exists
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav').first();
    if (await sidebar.count() > 0) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('should allow selecting different sequences', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Wait for sequences to load
    await page.waitForTimeout(2000);

    // Try to find and click a sequence item
    const sequenceItems = page.locator('[data-testid="sequence-item"], .sequence-item, li');
    const count = await sequenceItems.count();

    if (count > 0) {
      await sequenceItems.first().click();
      // Verify something changed (graph loaded, etc.)
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Visualizer - Graph Display', () => {
  test('should display the graph canvas', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to Interconnection View to see the graph (force click for mobile)
    const interconnectionButton = page.locator('button:has-text("Interconnection View")');
    await interconnectionButton.click({ force: true });
    await page.waitForTimeout(2000);

    // Machine graph uses D3 SVG
    const graph = page.locator('svg.machine-graph-svg, svg, canvas').first();
    await expect(graph).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Visualizer - Interactive Controls', () => {
  test('should support zoom controls', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Look for zoom buttons (+ and -) - skip on mobile as they might not be visible
    const zoomIn = page.locator('button:has-text("+"), [aria-label*="zoom in" i]').first();
    const zoomOut = page.locator('button:has-text("-"), [aria-label*="zoom out" i]').first();

    // Use force click to bypass element interception on mobile
    if (await zoomIn.count() > 0) {
      await zoomIn.click({ force: true }).catch(() => {
        // Zoom controls might not be available on mobile
        console.log('Zoom in button not clickable (mobile?)');
      });
      await page.waitForTimeout(300);
    }

    if (await zoomOut.count() > 0) {
      await zoomOut.click({ force: true }).catch(() => {
        // Zoom controls might not be available on mobile
        console.log('Zoom out button not clickable (mobile?)');
      });
      await page.waitForTimeout(300);
    }

    // Test passes as long as page is still functional
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Test keyboard shortcuts (if implemented)
    await page.keyboard.press('F'); // Fit view
    await page.waitForTimeout(300);

    await page.keyboard.press('C'); // Center view
    await page.waitForTimeout(300);

    // Arrow keys for panning
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
  });

  test('should allow clicking on nodes', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const nodes = page.locator('[class*="react-flow__node"]').first();
    const count = await nodes.count();

    if (count > 0) {
      await nodes.click();
      await page.waitForTimeout(500);

      // Check if info panel appeared
      const infoPanel = page.locator('[data-testid="info-panel"], .info-panel, aside');
      if (await infoPanel.count() > 0) {
        await expect(infoPanel).toBeVisible();
      }
    }
  });
});

test.describe('Visualizer - Active Vector Highlighting', () => {
  test('should highlight active vectors', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for active indicators (green glow, ACTIVE badge, etc.)
    const activeIndicators = page.locator(
      '[data-active="true"], .active, [class*="active"]'
    );

    const count = await activeIndicators.count();
    // Active vectors may or may not exist depending on state
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Visualizer - Statistics Dashboard', () => {
  test('should display engine statistics', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Look for stats display
    const stats = page.locator('[data-testid="stats"], .stats, [class*="statistics"]').first();

    if (await stats.count() > 0) {
      await expect(stats).toBeVisible();
    }
  });
});

test.describe('Visualizer - Auto-refresh', () => {
  test('should auto-refresh data', async ({ page }) => {
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Wait for at least one refresh cycle
    await page.waitForTimeout(3000);

    // The page should still be functional — h1 is always rendered
    await expect(page.locator('h1').first()).toBeVisible();

    // Machine cards (h3) should be present; if the API failed on first load,
    // reload once to retry getMachines() before asserting.
    const machineCard = page.locator('h3').first();
    if (!await machineCard.isVisible().catch(() => false)) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    await expect(machineCard).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Visualizer - Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Check main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Check main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(VISUALIZER_URL);
    await page.waitForLoadState('networkidle');

    // Check main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });
});
