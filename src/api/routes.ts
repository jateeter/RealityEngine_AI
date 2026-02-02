import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RealityEngine } from '../engine/RealityEngine.js';
import { RealityVector } from '../models/RealityVector.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement } from '../models/types.js';
import { PreceptionOfReality } from '../engine/PreceptionOfReality.js';
import { RealitySampler, SamplingStrategy } from '../engine/RealitySampler.js';
import { SimulationController } from '../engine/SimulationController.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import { MachineLoader } from '../services/MachineLoader.js';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * API Routes for Reality Engine
 */
export class RealityEngineAPI {
  private router: Router;
  private engine: RealityEngine;
  private perception: PreceptionOfReality;
  private sampler: RealitySampler | null = null;
  private simulationController: SimulationController | null = null;
  private perceptualSimulator: PerceptualSpaceSimulator;

  constructor(engine: RealityEngine) {
    this.router = express.Router();
    this.engine = engine;
    this.perception = new PreceptionOfReality(config.getVectorDimension());
    this.perceptualSimulator = new PerceptualSpaceSimulator(256);
    this.setupRoutes();
    this.initializeDefaultSequences();
  }

  /**
   * Initialize default machines from JSON files on startup
   */
  private async initializeDefaultSequences(): Promise<void> {
    try {
      console.log('Loading example machines from JSON files on startup...');

      const machinesDir = join(__dirname, '../../examples/machines');

      if (!existsSync(machinesDir)) {
        console.warn('  ⚠ Machines directory not found:', machinesDir);
        return;
      }

      // List of machines to load on startup
      const machinesToLoad = [
        'RSFlipFlop.json',
        'RS2.json',
        'MultiStep.json',
        'DataCenterMonitoring.json',
        'KleeneStar.json'
      ];

      let loadedCount = 0;
      let failedCount = 0;

      for (const filename of machinesToLoad) {
        try {
          const filepath = join(machinesDir, filename);

          if (!existsSync(filepath)) {
            console.warn(`  ⚠ JSON file not found: ${filename}`);
            failedCount++;
            continue;
          }

          const jsonString = readFileSync(filepath, 'utf8');
          const machine = MachineLoader.loadFromJSON(jsonString);
          this.engine.addMachine(machine);

          console.log(`  ✓ ${machine.name} loaded from ${filename}`);
          loadedCount++;

          // Initialize simulation controller with the first machine's test vectors
          if (!this.simulationController && machine.metadata.inputSequences) {
            const inputSequences = machine.metadata.inputSequences as any[];
            if (inputSequences.length > 0) {
              const firstSequence = inputSequences[0];
              if (firstSequence.vectors && Array.isArray(firstSequence.vectors)) {
                this.simulationController = new SimulationController(this.engine, {
                  autoPlayDelayMs: 2000,
                  inputVectors: firstSequence.vectors,
                  loop: true
                });
                console.log(`  ✓ Simulation controller initialized with ${firstSequence.name}`);
              }
            }
          }
        } catch (err: any) {
          console.error(`  ✗ Failed to load ${filename}:`, err.message);
          failedCount++;
        }
      }

      console.log(`\nMachine loading complete: ${loadedCount} loaded, ${failedCount} failed`);
    } catch (error: any) {
      console.error('Error loading machines from JSON:', error.message);
    }
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

    // Machine endpoints
    this.router.get('/machines', this.getAllMachines.bind(this));
    this.router.get('/machines/:id', this.getMachine.bind(this));
    this.router.post('/machines', this.createMachine.bind(this));
    this.router.put('/machines/:id', this.updateMachine.bind(this));
    this.router.delete('/machines/:id', this.deleteMachine.bind(this));
    this.router.post('/machines/:id/process', this.processMachineInput.bind(this));

    // Machine JSON endpoints (load/save)
    this.router.get('/machines/json/list', this.listMachineJSONFiles.bind(this));
    this.router.get('/machines/json/:name', this.loadMachineFromJSON.bind(this));
    this.router.post('/machines/json/import', this.importMachineJSON.bind(this));
    this.router.get('/machines/:id/export', this.exportMachineToJSON.bind(this));

    // Machine Graph & Perceptual Space Simulation endpoints
    this.router.get('/machine-graph', this.getMachineGraph.bind(this));
    this.router.post('/perceptual-simulation/configure', this.configurePerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/start', this.startPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/stop', this.stopPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/step', this.stepPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/reset', this.resetPerceptualSimulation.bind(this));
    this.router.get('/perceptual-simulation/state', this.getPerceptualSimulationState.bind(this));
    this.router.get('/perceptual-simulation/history', this.getPerceptualSimulationHistory.bind(this));

    // Demo endpoints
    this.router.get('/demo/load', this.loadDemo.bind(this));
    this.router.get('/demo/data-center', this.loadDataCenterExample.bind(this));
    this.router.get('/demo/nand-gate', this.loadNANDGateExample.bind(this));
    this.router.get('/demo/multi-step', this.loadMultiStepExample.bind(this));
    this.router.get('/demo/kleene-star', this.loadKleeneStarExample.bind(this));
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
      progress: this.simulationController.getProgress(),
      inputVectors: this.simulationController.getInputVectors(),
      lastResult: this.simulationController.getLastResult()
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

  // Machine endpoints
  private getAllMachines(_req: Request, res: Response): void {
    const machines = this.engine.getAllMachines();
    res.json({
      machines: machines.map(m => ({
        ...m.toJSON(),
        isExample: true, // All current machines are examples
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null
      }))
    });
  }

  private getMachine(req: Request, res: Response): void {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Machine ID required' });
      return;
    }

    const machine = this.engine.getMachine(id);

    if (!machine) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    res.json({
      machine: {
        ...machine.toJSON(),
        isExample: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null
      }
    });
  }

  private createMachine(req: Request, res: Response): void {
    try {
      const { name, description, sequenceIds, metadata } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Machine name required' });
        return;
      }

      // Import Machine class
      const { Machine } = require('../models/Machine.js');
      const machine = new Machine(name, description);

      if (metadata) {
        machine.metadata = metadata;
      }

      // Add sequences if provided
      if (sequenceIds && Array.isArray(sequenceIds)) {
        for (const seqId of sequenceIds) {
          const sequence = this.engine.getSequence(seqId);
          if (sequence) {
            machine.addSequence(sequence);
          }
        }
      }

      this.engine.addMachine(machine);

      res.json({
        machine: {
          ...machine.toJSON(),
          isExample: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: null
        }
      });
    } catch (error: any) {
      console.error('Error creating machine:', error);
      res.status(500).json({
        error: 'Failed to create machine',
        details: error.message
      });
    }
  }

  private updateMachine(req: Request, res: Response): void {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Machine ID required' });
        return;
      }

      const machine = this.engine.getMachine(id);

      if (!machine) {
        res.status(404).json({ error: 'Machine not found' });
        return;
      }

      // Note: Machine properties (name, description) are readonly
      // Only metadata can be modified, but it's also readonly
      // For now, just return the current machine state
      // Future: Implement machine recreation with new properties

      res.json({
        machine: {
          ...machine.toJSON(),
          isExample: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: null
        }
      });
    } catch (error: any) {
      console.error('Error updating machine:', error);
      res.status(500).json({
        error: 'Failed to update machine',
        details: error.message
      });
    }
  }

  private deleteMachine(req: Request, res: Response): void {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Machine ID required' });
        return;
      }

      const machine = this.engine.getMachine(id);

      if (!machine) {
        res.status(404).json({ error: 'Machine not found' });
        return;
      }

      this.engine.removeMachine(id);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting machine:', error);
      res.status(500).json({
        error: 'Failed to delete machine',
        details: error.message
      });
    }
  }

  private processMachineInput(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { vector } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Machine ID required' });
        return;
      }

      if (!Array.isArray(vector)) {
        res.status(400).json({ error: 'Vector must be an array' });
        return;
      }

      // Process input through the machine using the new 3-phase workflow
      const result = this.engine.processMachineInput(id, vector);

      // Convert Map to object for JSON serialization
      const sequenceResults: Record<string, any> = {};
      result.sequenceResults.forEach((value, key) => {
        sequenceResults[key] = value;
      });

      res.json({
        result: {
          inputVector: result.inputVector,
          timestamp: result.timestamp,
          sequenceResults,
          machineOutput: result.machineOutput,
          arbiterMetadata: result.arbiterMetadata
        }
      });
    } catch (error: any) {
      console.error('Error processing machine input:', error);
      res.status(500).json({
        error: 'Failed to process machine input',
        details: error.message
      });
    }
  }

  // Machine JSON endpoints

  /**
   * List all available machine JSON files
   */
  private listMachineJSONFiles(_req: Request, res: Response): void {
    try {
      const machinesDir = join(__dirname, '../../examples/machines');

      if (!existsSync(machinesDir)) {
        res.json({ machines: [] });
        return;
      }

      const files = readdirSync(machinesDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filepath = join(machinesDir, file);
          const jsonString = readFileSync(filepath, 'utf8');
          const machineJSON = JSON.parse(jsonString);

          return {
            filename: file,
            name: machineJSON.machine.name,
            description: machineJSON.machine.description,
            version: machineJSON.version,
            metadata: machineJSON.machine.metadata,
            sequenceCount: machineJSON.machine.sequences.length
          };
        });

      res.json({ machines: files });
    } catch (error: any) {
      console.error('Error listing machine JSON files:', error);
      res.status(500).json({
        error: 'Failed to list machine JSON files',
        details: error.message
      });
    }
  }

  /**
   * Load a machine from JSON file and add it to the engine
   */
  private loadMachineFromJSON(req: Request, res: Response): void {
    try {
      const { name } = req.params;

      if (!name) {
        res.status(400).json({ error: 'Machine name required' });
        return;
      }

      // Construct the file path
      const machinesDir = join(__dirname, '../../examples/machines');
      const filename = name.endsWith('.json') ? name : `${name}.json`;
      const filepath = join(machinesDir, filename);

      if (!existsSync(filepath)) {
        res.status(404).json({ error: `Machine JSON file not found: ${filename}` });
        return;
      }

      // Read and load the machine
      const jsonString = readFileSync(filepath, 'utf8');
      const machine = MachineLoader.loadFromJSON(jsonString);

      // Add machine to engine
      this.engine.addMachine(machine);

      res.json({
        success: true,
        machine: {
          ...machine.toJSON(),
          isExample: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: null
        },
        message: `Machine "${machine.name}" loaded successfully from ${filename}`
      });
    } catch (error: any) {
      console.error('Error loading machine from JSON:', error);
      res.status(500).json({
        error: 'Failed to load machine from JSON',
        details: error.message
      });
    }
  }

  /**
   * Import a machine from JSON string (uploaded by user)
   */
  private importMachineJSON(req: Request, res: Response): void {
    try {
      const { json } = req.body;

      if (!json) {
        res.status(400).json({ error: 'JSON string required' });
        return;
      }

      // Validate the JSON
      const validation = MachineLoader.validate(json);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Invalid machine JSON',
          details: validation.errors
        });
        return;
      }

      // Load the machine
      const machine = MachineLoader.loadFromJSON(json);

      // Add machine to engine
      this.engine.addMachine(machine);

      res.json({
        success: true,
        machine: {
          ...machine.toJSON(),
          isExample: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: null
        },
        message: `Machine "${machine.name}" imported successfully`
      });
    } catch (error: any) {
      console.error('Error importing machine JSON:', error);
      res.status(500).json({
        error: 'Failed to import machine JSON',
        details: error.message
      });
    }
  }

  /**
   * Export a machine to JSON format
   */
  private exportMachineToJSON(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const pretty = req.query.pretty === 'true';

      if (!id) {
        res.status(400).json({ error: 'Machine ID required' });
        return;
      }

      const machine = this.engine.getMachine(id);

      if (!machine) {
        res.status(404).json({ error: 'Machine not found' });
        return;
      }

      // Export machine to JSON
      const jsonString = MachineLoader.saveToJSON(machine, pretty);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${machine.name}.json"`);
      res.send(jsonString);
    } catch (error: any) {
      console.error('Error exporting machine to JSON:', error);
      res.status(500).json({
        error: 'Failed to export machine to JSON',
        details: error.message
      });
    }
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
      const module = await import('../examples/data-center-monitoring/data-center-sequences.js');
      const createDataCenterSequences = module.createDataCenterSequences;
      const generateInitialEvents = module.generateInitialEvents;
      const generateProgressionVectors = module.generateProgressionVectors;

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

  private async loadMultiStepExample(_req: Request, res: Response): Promise<void> {
    try {
      const { createMultiStepMachine, generateTestVectors } =
        await import('../examples/multi-step-sequences/sequence-definitions.js');

      const testVectors = generateTestVectors();
      const allInputVectors = testVectors.map(t => t.vector);

      // Find the machine by name (should already be loaded from startup)
      let machine = this.engine.getAllMachines().find(m => m.name === 'Multi-Step Sequences');

      // If not loaded, create and add it
      if (!machine) {
        machine = createMultiStepMachine();
        this.engine.addMachine(machine);
      }

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1500,
        inputVectors: allInputVectors,
        loop: true
      });

      res.json({
        success: true,
        machine: machine.toJSON(),
        metadata: {
          name: machine.name,
          description: machine.description,
          machineId: machine.id,
          totalSequences: machine.getSequenceCount(),
          sequenceNames: machine.getAllSequences().map(s => s.name),
          totalInputVectors: allInputVectors.length,
          eventSpace: '3D binary vectors: 000-111',
          outputSpace: '2D binary vectors: {00, 01, 10, 11}',
          sequences: [
            {
              name: 'Sequence 1',
              path: '000 → 001 → 011',
              output: '01',
              depth: 3
            },
            {
              name: 'Sequence 2',
              path: '100 → 101 → 111',
              output: '10',
              depth: 3
            }
          ],
          note: 'All sequences in the machine are visualized together and process the same input sequence'
        },
        sequencesLoaded: machine.getSequenceCount(),
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading multi-step sequences example:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load multi-step sequences example',
        message: error.message
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

  private async loadKleeneStarExample(_req: Request, res: Response): Promise<void> {
    try {
      const {
        createKleeneStarMachine,
        generateKleeneStarTestVectors
      } = await import('../examples/kleene-star-operator/kleene-star-sequences.js');

      const testVectors = generateKleeneStarTestVectors();
      const allInputVectors = testVectors.map(t => t.vector);

      // Find the machine by name (should already be loaded from startup)
      let machine = this.engine.getAllMachines().find(m => m.name === '* Operator Test');

      // If not loaded, create and add it
      if (!machine) {
        machine = createKleeneStarMachine();
        this.engine.addMachine(machine);
      }

      // Initialize simulation controller with faster speed for better UX
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 500,
        inputVectors: allInputVectors,
        loop: true
      });

      res.json({
        success: true,
        machine: machine.toJSON(),
        metadata: {
          name: machine.name,
          description: machine.description,
          machineId: machine.id,
          totalSequences: machine.getSequenceCount(),
          sequenceNames: machine.getAllSequences().map(s => s.name),
          totalInputVectors: allInputVectors.length,
          eventSpace: '3D binary vectors: 000-111',
          outputSpace: '2D binary vectors: {01, 10}',
          patterns: [
            {
              pattern: '001+000*+010 -> [01]',
              description: '001, then zero or more 000, then 010, outputs [0,1]'
            },
            {
              pattern: '010+(000+001)*+001 -> [10]',
              description: '010, then zero or more (000 or 001), then 001, outputs [1,0]'
            }
          ],
          note: 'Kleene star implemented via self-loops with exit paths'
        },
        sequencesLoaded: machine.getSequenceCount(),
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading Kleene star example:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load Kleene star example',
        message: error.message
      });
    }
  }

  // Machine Graph & Perceptual Space Simulation endpoints

  /**
   * Get machine graph visualization data
   */
  private async getMachineGraph(_req: Request, res: Response): Promise<void> {
    try {
      // Sync machines from engine to perceptual simulator
      const machines = this.engine.getAllMachines();

      // Clear and re-add all machines to simulator
      const currentMachines = this.perceptualSimulator.getMachines();
      for (const m of currentMachines) {
        this.perceptualSimulator.removeMachine(m.id);
      }

      for (const machine of machines) {
        if (machine.perceptualMapping) {
          this.perceptualSimulator.addMachine(machine);
        }
      }

      const graphData = this.perceptualSimulator.getMachineGraphData();

      res.json({
        success: true,
        data: graphData,
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get machine graph',
        message: error.message
      });
    }
  }

  /**
   * Configure perceptual space simulation
   */
  private async configurePerceptualSimulation(req: Request, res: Response): Promise<void> {
    try {
      const { inputSequence, inputRegion, stepDelayMs, maxSteps } = req.body;

      if (!inputSequence || !Array.isArray(inputSequence)) {
        res.status(400).json({
          success: false,
          error: 'inputSequence is required and must be an array'
        });
        return;
      }

      if (!inputRegion || typeof inputRegion.offset !== 'number' || typeof inputRegion.length !== 'number') {
        res.status(400).json({
          success: false,
          error: 'inputRegion is required with offset and length'
        });
        return;
      }

      this.perceptualSimulator.configure({
        inputSequence,
        inputRegion,
        stepDelayMs: stepDelayMs || 1000,
        maxSteps
      });

      res.json({
        success: true,
        message: 'Simulation configured',
        config: this.perceptualSimulator.getConfig(),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to configure simulation',
        message: error.message
      });
    }
  }

  /**
   * Start perceptual space simulation
   */
  private async startPerceptualSimulation(_req: Request, res: Response): Promise<void> {
    try {
      this.perceptualSimulator.start();

      res.json({
        success: true,
        message: 'Simulation started',
        isRunning: this.perceptualSimulator.getIsRunning(),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to start simulation',
        message: error.message
      });
    }
  }

  /**
   * Stop perceptual space simulation
   */
  private async stopPerceptualSimulation(_req: Request, res: Response): Promise<void> {
    try {
      this.perceptualSimulator.stop();

      res.json({
        success: true,
        message: 'Simulation stopped',
        isRunning: this.perceptualSimulator.getIsRunning(),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to stop simulation',
        message: error.message
      });
    }
  }

  /**
   * Execute one simulation step
   */
  private async stepPerceptualSimulation(_req: Request, res: Response): Promise<void> {
    try {
      const step = this.perceptualSimulator.step();

      if (!step) {
        res.json({
          success: true,
          message: 'Simulation complete',
          step: null,
          timestamp: Date.now()
        });
        return;
      }

      // Convert Map to plain object for JSON serialization
      const machineResults: Record<string, any> = {};
      for (const [key, value] of step.machineResults) {
        machineResults[key] = value;
      }

      res.json({
        success: true,
        step: {
          ...step,
          machineResults
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to execute simulation step',
        message: error.message
      });
    }
  }

  /**
   * Reset perceptual space simulation
   */
  private async resetPerceptualSimulation(_req: Request, res: Response): Promise<void> {
    try {
      this.perceptualSimulator.reset();

      res.json({
        success: true,
        message: 'Simulation reset',
        currentStep: this.perceptualSimulator.getCurrentStep(),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to reset simulation',
        message: error.message
      });
    }
  }

  /**
   * Get perceptual space simulation state
   */
  private async getPerceptualSimulationState(_req: Request, res: Response): Promise<void> {
    try {
      const state = {
        isRunning: this.perceptualSimulator.getIsRunning(),
        currentStep: this.perceptualSimulator.getCurrentStep(),
        config: this.perceptualSimulator.getConfig(),
        perceptualSpace: this.perceptualSimulator.getPerceptualSpace().getPerceptualVector(),
        machines: this.perceptualSimulator.getMachines().map(m => ({
          id: m.id,
          name: m.name,
          perceptualMapping: m.perceptualMapping
        }))
      };

      res.json({
        success: true,
        state,
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get simulation state',
        message: error.message
      });
    }
  }

  /**
   * Get perceptual space simulation history
   */
  private async getPerceptualSimulationHistory(_req: Request, res: Response): Promise<void> {
    try {
      const history = this.perceptualSimulator.getHistory().map(step => {
        // Convert Map to plain object
        const machineResults: Record<string, any> = {};
        for (const [key, value] of step.machineResults) {
          machineResults[key] = value;
        }
        return {
          ...step,
          machineResults
        };
      });

      res.json({
        success: true,
        history,
        count: history.length,
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get simulation history',
        message: error.message
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
