/**
 * Reality Engine - Main Application Entry Point
 * Optimized for Node.js 22+ with native ESM, fetch API, and modern features
 */

import express from 'express';
import { RealityEngine } from './engine/RealityEngine.js';
import { VectorStore } from './services/VectorStore.js';
import { RealityEngineAPI } from './api/routes.js';
import { ExampleLoader } from './utils/exampleLoader.js';
import config from './config/config.js';

// Create Express app
const app = express();
app.use(express.json());

console.log('Starting Reality Engine...');

// Initialize vector store with native async/await (no polyfills needed)
const vectorStore = new VectorStore();
await vectorStore.initialize();
console.log('✓ Vector store initialized');

// Initialize reality engine
const engine = new RealityEngine(vectorStore);
await engine.initialize();
console.log('✓ Reality Engine initialized');

// Load example data
const exampleLoader = new ExampleLoader(engine);
await exampleLoader.loadAllExamples();
await exampleLoader.validateExamples();

// Setup API routes
const api = new RealityEngineAPI(engine);
app.use('/api', api.getRouter());

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Reality Engine',
    version: '1.0.1',
    node: process.version,
    description: 'A reality engine system with vector-based state machines',
    endpoints: {
      health: '/api/health',
      config: '/api/config',
      vectors: '/api/vectors',
      sequences: '/api/sequences',
      engine: '/api/engine',
      perception: '/api/perception',
      sampler: '/api/sampler'
    },
    features: [
      'Native ES Modules',
      'Native Fetch API',
      'Native Web Streams',
      'Top-level await',
      'Node.js 22+ optimizations'
    ],
    documentation: 'See README.md for detailed API documentation'
  });
});

// Start server
const port = parseInt(process.env.PORT || '3000', 10);

// Add error handler for port conflicts
const server = app.listen(port, () => {
  console.log(`\n✅ Reality Engine running on port ${port}`);
  console.log(`📊 Vector dimension: ${config.getVectorDimension()}`);
  console.log(`🎯 Match threshold: ${config.getDefaultMatchThreshold()}`);
  console.log(`🗄️  Qdrant URL: ${config.getQdrantUrl()}`);
  console.log(`🚀 Node.js: ${process.version}\n`);
});

// Handle server startup errors
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${port} is already in use`);
    console.error('\nThis usually means:');
    console.error('  1. Another Reality Engine instance is running');
    console.error('  2. Docker containers are using the port');
    console.error('  3. Another application is using the port\n');
    console.error('Solutions:');
    console.error('  • Stop services:    ./scripts/stop-local.sh');
    console.error('  • Check conflicts:  ./scripts/fix-port-conflict.sh');
    console.error('  • Kill process:     lsof -ti:3000 | xargs kill -9\n');
    process.exit(1);
  } else {
    console.error(`\n❌ Server error:`, err);
    process.exit(1);
  }
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log('✓ HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
