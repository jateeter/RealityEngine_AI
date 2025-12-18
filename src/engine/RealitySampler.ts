import { PreceptionOfReality } from './PreceptionOfReality.js';
import type { RawObservation } from './PreceptionOfReality.js';
import { RealityEngine } from './RealityEngine.js';
import type { TransitionResult } from './RealityEngine.js';

/**
 * SamplingStrategy: How observations are sampled from reality
 */
export enum SamplingStrategy {
  CONTINUOUS = 'continuous',
  PERIODIC = 'periodic',
  EVENT_DRIVEN = 'event-driven',
  MANUAL = 'manual'
}

/**
 * SamplingConfig: Configuration for reality sampling
 */
export interface SamplingConfig {
  strategy: SamplingStrategy;
  intervalMs?: number; // For periodic sampling
  maxBufferSize?: number;
  autoProcess?: boolean;
}

/**
 * RealitySampler: Samples observations from reality and feeds them to the engine
 *
 * This component:
 * - Collects observations from various sources
 * - Manages sampling strategies (continuous, periodic, event-driven)
 * - Buffers observations
 * - Coordinates between PreceptionOfReality and RealityEngine
 * - Represents the "WorldViewOfReality" formation process
 */
export class RealitySampler {
  private perception: PreceptionOfReality;
  private engine: RealityEngine;
  private config: SamplingConfig;
  private observationBuffer: RawObservation[];
  private isRunning: boolean;
  private intervalId: NodeJS.Timeout | undefined = undefined;
  private sampleCount: number;

  constructor(
    perception: PreceptionOfReality,
    engine: RealityEngine,
    config: SamplingConfig
  ) {
    this.perception = perception;
    this.engine = engine;
    this.config = {
      maxBufferSize: 1000,
      autoProcess: true,
      ...config
    };
    this.observationBuffer = [];
    this.isRunning = false;
    this.sampleCount = 0;
  }

  /**
   * Start sampling based on configured strategy
   */
  start(): void {
    if (this.isRunning) {
      console.log('Sampler already running');
      return;
    }

    this.isRunning = true;

    switch (this.config.strategy) {
      case SamplingStrategy.PERIODIC:
        this.startPeriodicSampling();
        break;
      case SamplingStrategy.CONTINUOUS:
        this.startContinuousSampling();
        break;
      case SamplingStrategy.EVENT_DRIVEN:
      case SamplingStrategy.MANUAL:
        // These modes don't auto-start
        break;
    }

    console.log(`RealitySampler started with ${this.config.strategy} strategy`);
  }

  /**
   * Stop sampling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('RealitySampler stopped');
  }

  /**
   * Sample a single observation and process it
   */
  sample(observation: RawObservation): TransitionResult | null {
    this.sampleCount++;

    // Add to buffer
    this.addToBuffer(observation);

    // Process if auto-processing is enabled
    if (this.config.autoProcess) {
      return this.processSingle(observation);
    }

    return null;
  }

  /**
   * Sample multiple observations
   */
  sampleMultiple(observations: RawObservation[]): TransitionResult[] {
    const results: TransitionResult[] = [];

    for (const observation of observations) {
      this.addToBuffer(observation);

      if (this.config.autoProcess) {
        const result = this.processSingle(observation);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Process buffered observations
   */
  processBuffer(): TransitionResult[] {
    const results: TransitionResult[] = [];

    while (this.observationBuffer.length > 0) {
      const observation = this.observationBuffer.shift();
      if (observation) {
        const result = this.processSingle(observation);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Process a single observation through the pipeline
   */
  private processSingle(observation: RawObservation): TransitionResult {
    // 1. Perceive: Transform observation into InputRealityVector
    const perception = this.perception.perceive(observation);

    // 2. Process: Feed to RealityEngine
    const result = this.engine.processInput(perception.inputVector);

    return result;
  }

  /**
   * Start periodic sampling
   */
  private startPeriodicSampling(): void {
    const interval = this.config.intervalMs || 1000;

    this.intervalId = setInterval(() => {
      this.processBuffer();
    }, interval);
  }

  /**
   * Start continuous sampling
   */
  private startContinuousSampling(): void {
    const processNext = () => {
      if (!this.isRunning) return;

      if (this.observationBuffer.length > 0) {
        this.processBuffer();
      }

      // Use setImmediate for non-blocking continuous processing
      setImmediate(processNext);
    };

    processNext();
  }

  /**
   * Add observation to buffer with size management
   */
  private addToBuffer(observation: RawObservation): void {
    this.observationBuffer.push(observation);

    const maxSize = this.config.maxBufferSize || 1000;
    if (this.observationBuffer.length > maxSize) {
      // Remove oldest observations
      this.observationBuffer = this.observationBuffer.slice(-maxSize);
    }
  }

  /**
   * Create a quantum foam-like random observation
   * (As mentioned in the specification)
   */
  generateQuantumFoamSample(dimension: number): RawObservation {
    const data = Array.from({ length: dimension }, () => Math.random());

    return PreceptionOfReality.createObservation(
      data,
      'quantum-foam',
      { type: 'stochastic', generator: 'quantum-foam' }
    );
  }

  /**
   * Get sampler statistics
   */
  getStats(): {
    isRunning: boolean;
    strategy: SamplingStrategy;
    sampleCount: number;
    bufferSize: number;
    config: SamplingConfig;
  } {
    return {
      isRunning: this.isRunning,
      strategy: this.config.strategy,
      sampleCount: this.sampleCount,
      bufferSize: this.observationBuffer.length,
      config: this.config
    };
  }

  /**
   * Clear observation buffer
   */
  clearBuffer(): void {
    this.observationBuffer = [];
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.sampleCount = 0;
    this.clearBuffer();
  }

  /**
   * Get current buffer
   */
  getBuffer(): RawObservation[] {
    return [...this.observationBuffer];
  }
}
