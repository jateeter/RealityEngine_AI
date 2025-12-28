import { RealityEngine } from './RealityEngine.js';
import type { TransitionResult } from './RealityEngine.js';

export interface SimulationConfig {
  autoPlayDelayMs: number;
  inputVectors: number[][];
  loop: boolean;
}

export interface SimulationState {
  status: 'stopped' | 'playing' | 'paused';
  currentIndex: number;
  totalVectors: number;
  startTime: number | null;
  lastStepTime: number | null;
}

export interface VectorActivation {
  sequenceId: string;
  vectorId: string;
  count: number;
  lastActivated: number;
}

export interface SimulationEvent {
  type: 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'step' | 'complete';
  state: SimulationState;
  result?: TransitionResult;
  timestamp: number;
}

type EventCallback = (event: SimulationEvent) => void;

/**
 * SimulationController manages playback of a sequence of input vectors
 * through the Reality Engine with auto-play and manual stepping capabilities
 */
export class SimulationController {
  private engine: RealityEngine;
  private config: SimulationConfig;
  private state: SimulationState;
  private heatmap: Map<string, Map<string, VectorActivation>>;
  private intervalId: NodeJS.Timeout | null = null;
  private eventCallbacks: EventCallback[] = [];

  constructor(engine: RealityEngine, config: SimulationConfig) {
    this.engine = engine;
    this.config = config;
    this.state = {
      status: 'stopped',
      currentIndex: 0,
      totalVectors: config.inputVectors.length,
      startTime: null,
      lastStepTime: null
    };
    this.heatmap = new Map();
  }

  /**
   * Start auto-play mode
   */
  public start(): void {
    if (this.state.status === 'playing') {
      return; // Already playing
    }

    this.state.status = 'playing';
    this.state.startTime = this.state.startTime || Date.now();

    this.emitEvent({
      type: 'start',
      state: this.getState(),
      timestamp: Date.now()
    });

    this.startPlaybackLoop();
  }

  /**
   * Pause auto-play
   */
  public pause(): void {
    if (this.state.status !== 'playing') {
      return;
    }

    this.state.status = 'paused';
    this.stopPlaybackLoop();

    this.emitEvent({
      type: 'pause',
      state: this.getState(),
      timestamp: Date.now()
    });
  }

  /**
   * Resume auto-play
   */
  public resume(): void {
    if (this.state.status !== 'paused') {
      return;
    }

    this.state.status = 'playing';

    this.emitEvent({
      type: 'resume',
      state: this.getState(),
      timestamp: Date.now()
    });

    this.startPlaybackLoop();
  }

  /**
   * Stop simulation and reset
   */
  public stop(): void {
    this.stopPlaybackLoop();
    this.state.status = 'stopped';

    this.emitEvent({
      type: 'stop',
      state: this.getState(),
      timestamp: Date.now()
    });
  }

  /**
   * Reset simulation to beginning
   */
  public reset(): void {
    this.stopPlaybackLoop();
    this.state = {
      status: 'stopped',
      currentIndex: 0,
      totalVectors: this.config.inputVectors.length,
      startTime: null,
      lastStepTime: null
    };
    this.heatmap.clear();
    this.engine.resetAllSequences();

    this.emitEvent({
      type: 'reset',
      state: this.getState(),
      timestamp: Date.now()
    });
  }

  /**
   * Execute a single step (process next input vector)
   */
  public step(): TransitionResult | null {
    if (this.state.currentIndex >= this.state.totalVectors) {
      if (this.config.loop) {
        this.state.currentIndex = 0;
      } else {
        this.stop();
        this.emitEvent({
          type: 'complete',
          state: this.getState(),
          timestamp: Date.now()
        });
        return null;
      }
    }

    const inputVector = this.config.inputVectors[this.state.currentIndex];
    if (!inputVector) {
      return null;
    }
    const result = this.engine.processInput(inputVector);

    // Update heatmap
    this.updateHeatmap(result);

    this.state.currentIndex++;
    this.state.lastStepTime = Date.now();

    this.emitEvent({
      type: 'step',
      state: this.getState(),
      result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Set playback speed (delay between steps in ms)
   */
  public setSpeed(delayMs: number): void {
    this.config.autoPlayDelayMs = delayMs;

    // If currently playing, restart the loop with new speed
    if (this.state.status === 'playing') {
      this.stopPlaybackLoop();
      this.startPlaybackLoop();
    }
  }

  /**
   * Set input vectors
   */
  public setInputVectors(vectors: number[][]): void {
    this.config.inputVectors = vectors;
    this.state.totalVectors = vectors.length;
  }

  /**
   * Get current state
   */
  public getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Get activation heatmap
   */
  public getHeatmap(): Map<string, VectorActivation> {
    const flatMap = new Map<string, VectorActivation>();

    this.heatmap.forEach((vectorMap, sequenceId) => {
      vectorMap.forEach((activation, vectorId) => {
        const key = `${sequenceId}:${vectorId}`;
        flatMap.set(key, activation);
      });
    });

    return flatMap;
  }

  /**
   * Get progress percentage (0-100)
   */
  public getProgress(): number {
    if (this.state.totalVectors === 0) return 0;
    return Math.floor((this.state.currentIndex / this.state.totalVectors) * 100);
  }

  /**
   * Register event callback
   */
  public onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start the playback loop
   */
  private startPlaybackLoop(): void {
    this.intervalId = setInterval(() => {
      const result = this.step();

      if (result === null && !this.config.loop) {
        this.stopPlaybackLoop();
      }
    }, this.config.autoPlayDelayMs);
  }

  /**
   * Stop the playback loop
   */
  private stopPlaybackLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Update activation heatmap from transition result
   */
  private updateHeatmap(result: TransitionResult): void {
    result.sequenceResults.forEach((seqResult: { matchedVectors: string[]; activatedVectors: string[]; assertedOutputs: any[] }, sequenceId: string) => {
      if (!this.heatmap.has(sequenceId)) {
        this.heatmap.set(sequenceId, new Map());
      }

      const sequenceMap = this.heatmap.get(sequenceId)!;

      // Update matched vectors
      seqResult.matchedVectors.forEach((vectorId: string) => {
        if (!sequenceMap.has(vectorId)) {
          sequenceMap.set(vectorId, {
            sequenceId,
            vectorId,
            count: 0,
            lastActivated: 0
          });
        }

        const activation = sequenceMap.get(vectorId)!;
        activation.count++;
        activation.lastActivated = Date.now();
      });
    });
  }

  /**
   * Emit event to all registered callbacks
   */
  private emitEvent(event: SimulationEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in simulation event callback:', error);
      }
    });
  }
}
