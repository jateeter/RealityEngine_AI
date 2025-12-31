import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { RealityEngine } from '../engine/RealityEngine.js';
import { RealityVector } from '../models/RealityVector.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement } from '../models/types.js';
import { PreceptionOfReality } from '../engine/PreceptionOfReality.js';
import { RealitySampler, SamplingStrategy } from '../engine/RealitySampler.js';
import { SimulationController } from '../engine/SimulationController.js';
import config from '../config/config.js';

/**
 * API Routes for Reality Engine
 */
export class RealityEngineAPI {
  private router: Router;
  private engine: RealityEngine;
  private perception: PreceptionOfReality;
  private sampler: RealitySampler | null = null;
  private simulationController: SimulationController | null = null;

  constructor(engine: RealityEngine) {
    this.router = express.Router();
    this.engine = engine;
    this.perception = new PreceptionOfReality(config.getVectorDimension());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.router.get('/health', this.healthCheck.bind(this));

    // Configuration endpoints
    this.router.get('/config', this.getConfig.bind(this));
    this.router.put('/config/dimension', this.updateDimension.bind(this));
    this.router.put('/config/threshold', this.updateThreshold.bind(this));

    // Vector endpoints
    this.router.post('/vectors', this.createVector.bind(this));
    this.router.get('/vectors/:id', this.getVector.bind(this));
    this.router.delete('/vectors/:id', this.deleteVector.bind(this));
    this.router.post('/vectors/search', this.searchVectors.bind(this));

    // Sequence endpoints
    this.router.post('/sequences', this.createSequence.bind(this));
    this.router.get('/sequences', this.getAllSequences.bind(this));
    this.router.get('/sequences/:id', this.getSequence.bind(this));
    this.router.delete('/sequences/:id', this.deleteSequence.bind(this));
    this.router.post('/sequences/:id/reset', this.resetSequence.bind(this));
    this.router.post('/sequences/:id/vectors', this.addVectorToSequence.bind(this));
    this.router.post('/sequences/persist', this.persistSequences.bind(this));

    // Engine endpoints
    this.router.post('/engine/process', this.processInput.bind(this));
    this.router.post('/engine/reset', this.resetEngine.bind(this));
    this.router.get('/engine/stats', this.getEngineStats.bind(this));
    this.router.get('/engine/active', this.getActiveVectors.bind(this));
    this.router.get('/engine/history', this.getHistory.bind(this));

    // Perception endpoints
    this.router.post('/perception/observe', this.observeReality.bind(this));

    // Sampler endpoints
    this.router.post('/sampler/start', this.startSampler.bind(this));
    this.router.post('/sampler/stop', this.stopSampler.bind(this));
    this.router.post('/sampler/sample', this.sampleReality.bind(this));
    this.router.get('/sampler/stats', this.getSamplerStats.bind(this));

    // Simulation endpoints
    this.router.post('/simulation/start', this.startSimulation.bind(this));
    this.router.post('/simulation/pause', this.pauseSimulation.bind(this));
    this.router.post('/simulation/resume', this.resumeSimulation.bind(this));
    this.router.post('/simulation/stop', this.stopSimulation.bind(this));
    this.router.post('/simulation/reset', this.resetSimulation.bind(this));
    this.router.post('/simulation/step', this.stepSimulation.bind(this));
    this.router.post('/simulation/load', this.loadSimulationVectors.bind(this));
    this.router.put('/simulation/speed', this.setSimulationSpeed.bind(this));
    this.router.get('/simulation/state', this.getSimulationState.bind(this));
    this.router.get('/simulation/heatmap', this.getSimulationHeatmap.bind(this));

    // Demo endpoints
    this.router.get('/demo/load', this.loadDemo.bind(this));
    this.router.get('/demo/data-center', this.loadDataCenterExample.bind(this));
    this.router.get('/demo/nand-gate', this.loadNANDGateExample.bind(this));
  }

  // Health check
  private async healthCheck(_req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0'
    });
  }

  // Configuration endpoints
  private getConfig(_req: Request, res: Response): void {
    res.json({
      vectorDimension: config.getVectorDimension(),
      matchThreshold: config.getDefaultMatchThreshold(),
      qdrantUrl: config.getQdrantUrl(),
      collectionName: config.getCollectionName()
    });
  }

  private updateDimension(req: Request, res: Response): void {
    try {
      const { dimension } = req.body;
      config.updateVectorDimension(dimension);
      res.json({ success: true, dimension });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private updateThreshold(req: Request, res: Response): void {
    try {
      const { threshold } = req.body;
      config.updateMatchThreshold(threshold);
      res.json({ success: true, threshold });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Vector endpoints
  private createVector(req: Request, res: Response): void {
    try {
      const { elements, isInitial } = req.body;

      // Validate and create vector elements
      const vectorElements: VectorElement[] = elements.map((e: any) => ({
        value: e.value,
        comparatorType: e.comparatorType || ComparatorType.THRESHOLD,
        threshold: e.threshold
      }));

      const vector = new RealityVector(vectorElements, isInitial);

      res.json({
        success: true,
        vector: vector.toJSON()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async getVector(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Note: In a full implementation, we'd retrieve from vector store
      res.json({ message: 'Vector retrieval endpoint', id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async deleteVector(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Note: In a full implementation, we'd delete from vector store
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async searchVectors(req: Request, res: Response): Promise<void> {
    try {
      const { vector, limit, threshold } = req.body;
      const results = await this.engine.searchVectors(vector, limit, threshold);
      res.json({ results });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Sequence endpoints
  private createSequence(req: Request, res: Response): void {
    try {
      const { name, vectors } = req.body;
      const sequence = new CriticalEventSequence(name);

      // Add vectors if provided
      if (vectors && Array.isArray(vectors)) {
        for (const vectorData of vectors) {
          const vectorElements: VectorElement[] = vectorData.elements.map((e: any) => ({
            value: e.value,
            comparatorType: e.comparatorType || ComparatorType.THRESHOLD,
            threshold: e.threshold
          }));

          const vector = new RealityVector(
            vectorElements,
            vectorData.isInitial,
            vectorData.id
          );

          // Add next vector connections
          if (vectorData.nextVectorIds) {
            vectorData.nextVectorIds.forEach((id: string) => vector.addNextVector(id));
          }

          // Add output vectors
          if (vectorData.outputVectors) {
            vectorData.outputVectors.forEach((ov: any) => vector.addOutputVector(ov));
          }

          sequence.addVector(vector);
        }
      }

      // Validate sequence
      const validation = sequence.validate();
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors });
        return;
      }

      this.engine.addSequence(sequence);

      res.json({
        success: true,
        sequence: sequence.toJSON()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private getAllSequences(_req: Request, res: Response): void {
    const sequences = this.engine.getAllSequences();
    res.json({
      sequences: sequences.map(s => s.toJSON())
    });
  }

  private getSequence(req: Request, res: Response): void {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Sequence ID required' });
      return;
    }

    const sequence = this.engine.getSequence(id);

    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    res.json({ sequence: sequence.toJSON() });
  }

  private deleteSequence(req: Request, res: Response): void {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Sequence ID required' });
      return;
    }

    const removed = this.engine.removeSequence(id);

    if (!removed) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    res.json({ success: true });
  }

  private resetSequence(req: Request, res: Response): void {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Sequence ID required' });
      return;
    }

    const reset = this.engine.resetSequence(id);

    if (!reset) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    res.json({ success: true });
  }

  private addVectorToSequence(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { elements, isInitial } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Sequence ID required' });
        return;
      }

      const sequence = this.engine.getSequence(id);
      if (!sequence) {
        res.status(404).json({ error: 'Sequence not found' });
        return;
      }

      const vectorElements: VectorElement[] = elements.map((e: any) => ({
        value: e.value,
        comparatorType: e.comparatorType || ComparatorType.THRESHOLD,
        threshold: e.threshold
      }));

      const vector = new RealityVector(vectorElements, isInitial);
      sequence.addVector(vector);

      res.json({
        success: true,
        vector: vector.toJSON()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async persistSequences(_req: Request, res: Response): Promise<void> {
    try {
      await this.engine.persistAllSequences();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Engine endpoints
  private processInput(req: Request, res: Response): void {
    try {
      const { vector } = req.body;

      if (!Array.isArray(vector)) {
        res.status(400).json({ error: 'Vector must be an array' });
        return;
      }

      const result = this.engine.processInput(vector);
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private resetEngine(_req: Request, res: Response): void {
    this.engine.resetAllSequences();
    res.json({ success: true });
  }

  private getEngineStats(_req: Request, res: Response): void {
    const stats = this.engine.getStats();
    res.json({ stats });
  }

  private getActiveVectors(_req: Request, res: Response): void {
    const activeVectors = this.engine.getAllActiveVectors();
    const result: any = {};

    for (const [sequenceId, vectors] of activeVectors) {
      result[sequenceId] = vectors.map(v => v.toJSON());
    }

    res.json({ activeVectors: result });
  }

  private getHistory(req: Request, res: Response): void {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = this.engine.getHistory(limit);
    res.json({ history });
  }

  // Perception endpoints
  private observeReality(req: Request, res: Response): void {
    try {
      const { data, source, metadata } = req.body;

      const observation = PreceptionOfReality.createObservation(
        data,
        source,
        metadata
      );

      const perception = this.perception.perceive(observation);

      res.json({
        success: true,
        perception
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Sampler endpoints
  private startSampler(req: Request, res: Response): void {
    try {
      const { strategy, intervalMs } = req.body;

      if (!this.sampler) {
        this.sampler = new RealitySampler(
          this.perception,
          this.engine,
          {
            strategy: strategy || SamplingStrategy.MANUAL,
            intervalMs: intervalMs || 1000
          }
        );
      }

      this.sampler.start();

      res.json({
        success: true,
        stats: this.sampler.getStats()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private stopSampler(_req: Request, res: Response): void {
    if (!this.sampler) {
      res.status(400).json({ error: 'Sampler not initialized' });
      return;
    }

    this.sampler.stop();
    res.json({ success: true });
  }

  private sampleReality(req: Request, res: Response): void {
    try {
      const { data, source, metadata } = req.body;

      if (!this.sampler) {
        this.sampler = new RealitySampler(
          this.perception,
          this.engine,
          { strategy: SamplingStrategy.MANUAL }
        );
      }

      const observation = PreceptionOfReality.createObservation(
        data,
        source,
        metadata
      );

      const result = this.sampler.sample(observation);

      res.json({
        success: true,
        result
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private getSamplerStats(_req: Request, res: Response): void {
    if (!this.sampler) {
      res.status(400).json({ error: 'Sampler not initialized' });
      return;
    }

    res.json({ stats: this.sampler.getStats() });
  }

  // Simulation endpoints
  private startSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized. Load simulation vectors first.' });
      return;
    }

    this.simulationController.start();
    res.json({
      success: true,
      state: this.simulationController.getState()
    });
  }

  private pauseSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    this.simulationController.pause();
    res.json({
      success: true,
      state: this.simulationController.getState()
    });
  }

  private resumeSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    this.simulationController.resume();
    res.json({
      success: true,
      state: this.simulationController.getState()
    });
  }

  private stopSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    this.simulationController.stop();
    res.json({
      success: true,
      state: this.simulationController.getState()
    });
  }

  private resetSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    this.simulationController.reset();
    res.json({
      success: true,
      state: this.simulationController.getState()
    });
  }

  private stepSimulation(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    const result = this.simulationController.step();
    res.json({
      success: true,
      state: this.simulationController.getState(),
      result
    });
  }

  private loadSimulationVectors(req: Request, res: Response): void {
    try {
      const { vectors, autoPlayDelayMs, loop } = req.body;

      if (!Array.isArray(vectors)) {
        res.status(400).json({ error: 'Vectors must be an array' });
        return;
      }

      // Create or reinitialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: autoPlayDelayMs || 1000,
        inputVectors: vectors,
        loop: loop !== undefined ? loop : true
      });

      res.json({
        success: true,
        state: this.simulationController.getState()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private setSimulationSpeed(req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    const { delayMs } = req.body;

    if (typeof delayMs !== 'number' || delayMs < 0) {
      res.status(400).json({ error: 'Invalid delay value' });
      return;
    }

    this.simulationController.setSpeed(delayMs);
    res.json({
      success: true,
      delayMs
    });
  }

  private getSimulationState(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    res.json({
      state: this.simulationController.getState(),
      progress: this.simulationController.getProgress()
    });
  }

  private getSimulationHeatmap(_req: Request, res: Response): void {
    if (!this.simulationController) {
      res.status(400).json({ error: 'Simulation not initialized' });
      return;
    }

    const heatmap = this.simulationController.getHeatmap();
    const heatmapArray = Array.from(heatmap.entries()).map(([key, activation]) => ({
      key,
      ...activation
    }));

    res.json({ heatmap: heatmapArray });
  }

  // Demo endpoints
  private async loadDemo(_req: Request, res: Response): Promise<void> {
    try {
      const { generateDemoDataset } = await import('../demo/data-generator.js');
      const dataset = generateDemoDataset();

      // Clear existing sequences
      const existingSequences = this.engine.getAllSequences();
      for (const seq of existingSequences) {
        this.engine.removeSequence(seq.id);
      }

      // Load new sequences
      for (const sequence of dataset.sequences) {
        this.engine.addSequence(sequence);
      }

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1000,
        inputVectors: dataset.inputVectors,
        loop: true
      });

      res.json({
        success: true,
        metadata: dataset.metadata,
        sequencesLoaded: dataset.sequences.length,
        inputVectorsLoaded: dataset.inputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading demo:', error);
      res.status(500).json({
        error: 'Failed to load demo dataset',
        details: error.message
      });
    }
  }

  private async loadDataCenterExample(_req: Request, res: Response): Promise<void> {
    try {
      const {
        createDataCenterSequences,
        generateInitialEvents,
        generateProgressionVectors
      } = await import('../examples/data-center-monitoring/data-center-sequences.js');

      // Generate sequences and input vectors
      const sequences = createDataCenterSequences();
      const initialEvents = generateInitialEvents();
      const progressionVectors = generateProgressionVectors();
      const allInputVectors = [...initialEvents, ...progressionVectors];

      // Clear existing sequences
      const existingSequences = this.engine.getAllSequences();
      for (const seq of existingSequences) {
        this.engine.removeSequence(seq.id);
      }

      // Load new sequences
      for (const sequence of sequences) {
        this.engine.addSequence(sequence);
      }

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1500,
        inputVectors: allInputVectors,
        loop: false
      });

      res.json({
        success: true,
        metadata: {
          name: 'Data Center Monitoring - 5 Critical Event Sequences',
          description: 'Demonstrates 5 critical event sequences with depth of 5 each',
          totalSequences: sequences.length,
          sequenceNames: sequences.map(s => s.name),
          totalInputVectors: allInputVectors.length,
          initialEvents: initialEvents.length,
          progressionVectors: progressionVectors.length
        },
        sequencesLoaded: sequences.length,
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading data center example:', error);
      res.status(500).json({
        error: 'Failed to load data center example',
        details: error.message
      });
    }
  }

  private async loadNANDGateExample(_req: Request, res: Response): Promise<void> {
    try {
      const {
        createNANDGateSequences,
        generateNANDTestVectors
      } = await import('../examples/nand-gate/nand-gate-sequences.js');

      // Generate sequences and test vectors
      const sequences = createNANDGateSequences();
      const testVectors = generateNANDTestVectors();
      const allInputVectors = testVectors.map(t => t.vector);

      // Clear existing sequences
      const existingSequences = this.engine.getAllSequences();
      for (const seq of existingSequences) {
        this.engine.removeSequence(seq.id);
      }

      // Load new sequences
      for (const sequence of sequences) {
        this.engine.addSequence(sequence);
      }

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 2000,
        inputVectors: allInputVectors,
        loop: true
      });

      res.json({
        success: true,
        metadata: {
          name: 'NAND Gate Implementation - Universal Logic Gate',
          description: 'Demonstrates 4 NAND gate sequences implementing complete truth table',
          totalSequences: sequences.length,
          sequenceNames: sequences.map(s => s.name),
          totalInputVectors: allInputVectors.length,
          truthTable: [
            'NAND(0, 0) = 1',
            'NAND(0, 1) = 1',
            'NAND(1, 0) = 1',
            'NAND(1, 1) = 0'
          ],
          note: 'All sequences have initial events that activate on matching input patterns'
        },
        sequencesLoaded: sequences.length,
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading NAND gate example:', error);
      res.status(500).json({
        error: 'Failed to load NAND gate example',
        details: error.message
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
