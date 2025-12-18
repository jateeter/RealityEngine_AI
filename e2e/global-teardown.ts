import { FullConfig } from '@playwright/test';

/**
 * Global teardown runs once after all tests
 * Optionally stops Docker services
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global E2E test teardown...');

  // Only stop services in CI environments
  // For local development, leave them running
  if (process.env.CI) {
    console.log('🛑 Stopping Docker services (CI mode)...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('docker-compose down');
      console.log('✅ Services stopped');
    } catch (error) {
      console.error('⚠️  Failed to stop services:', error);
    }
  } else {
    console.log('💡 Leaving services running for local development');
  }

  console.log('✅ Teardown complete');
}

export default globalTeardown;
