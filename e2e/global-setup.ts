import { chromium, FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Global setup runs once before all tests
 * Ensures Docker services are running and healthy
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');

  // Check if Docker is running
  try {
    await execAsync('docker info');
  } catch (error) {
    console.error('❌ Docker is not running. Please start Docker Desktop.');
    process.exit(1);
  }

  // Start Docker services if not running
  console.log('📦 Starting Docker services...');
  try {
    await execAsync('docker-compose up -d');
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error);
    process.exit(1);
  }

  // Wait for services to be healthy
  console.log('⏳ Waiting for services to be healthy...');
  await waitForServices();

  console.log('✅ All services are ready!');
}

async function waitForServices() {
  const services = [
    { name: 'Qdrant', url: 'http://localhost:6333/' },
    { name: 'Reality Engine', url: 'http://localhost:3000/api/engine/stats' },
    { name: 'Visualizer Backend', url: 'http://localhost:3001/health' },
    { name: 'Visualizer Frontend', url: 'http://localhost:5173/' },
  ];

  const maxRetries = 30; // 30 seconds
  const delay = 1000; // 1 second

  for (const service of services) {
    let healthy = false;
    let retries = 0;

    while (!healthy && retries < maxRetries) {
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        const response = await page.goto(service.url, {
          waitUntil: 'domcontentloaded',
          timeout: 5000,
        });

        if (response && response.ok()) {
          console.log(`  ✅ ${service.name} is healthy`);
          healthy = true;
        }

        await browser.close();
      } catch (error) {
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!healthy) {
      throw new Error(`❌ ${service.name} failed to become healthy`);
    }
  }
}

export default globalSetup;
