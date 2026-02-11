import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { RealityEngine } from '../engine/RealityEngine.js';
import { RealityVector } from '../models/RealityVector.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { Machine } from '../models/Machine.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement } from '../models/types.js';
import { PreceptionOfReality } from '../engine/PreceptionOfReality.js';
import { RealitySampler, SamplingStrategy } from '../engine/RealitySampler.js';
import { SimulationController } from '../engine/SimulationController.js';
import { PerceptualSpaceSimulator } from '../engine/PerceptualSpaceSimulator.js';
import { MachineLoader } from '../services/MachineLoader.js';
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
   * Helper: Add machine to both RealityEngine and PerceptualSpaceSimulator
   * Ensures machines are properly synchronized across both systems
   */
  private addMachineToSystem(machine: Machine): void {
    // Add to RealityEngine (always)
    this.engine.addMachine(machine);

    // Add to PerceptualSpaceSimulator (only if it has perceptual mapping)
    if (machine.perceptualMapping) {
      this.perceptualSimulator.addMachine(machine);
      console.log(`  ✓ Machine "${machine.name}" registered with perceptual simulator`);
      console.log(`    Input region: [${machine.perceptualMapping.input.offset}:${machine.perceptualMapping.input.offset + machine.perceptualMapping.input.length}]`);
      console.log(`    Output region: [${machine.perceptualMapping.output.offset}:${machine.perceptualMapping.output.offset + machine.perceptualMapping.output.length}]`);
    } else {
      console.log(`  ⚠ Machine "${machine.name}" has no perceptual mapping - not added to perceptual simulator`);
    }
  }

  /**
   * Helper: Convert machine-specific input vectors to universal perceptual space vectors
   * Embeds machine inputs at their designated offset in 256-byte universal vectors
   */
  private convertToUniversalInputs(
    machineInputs: number[][],
    machine: Machine,
    universalDimension: number = 256
  ): number[][] {
    if (!machine.perceptualMapping) {
      throw new Error(`Machine "${machine.name}" has no perceptual mapping - cannot convert to universal inputs`);
    }

    const { input: { offset, length } } = machine.perceptualMapping;

    return machineInputs.map(machineInput => {
      // Create zero-filled universal vector
      const universalVector = new Array(universalDimension).fill(0);

      // Validate machine input length
      if (machineInput.length !== length) {
        console.warn(
          `Machine input length (${machineInput.length}) doesn't match mapping length (${length}). Adjusting...`
        );
      }

      // Embed machine input at the designated offset
      for (let i = 0; i < Math.min(machineInput.length, length); i++) {
        if (offset + i < universalDimension) {
          universalVector[offset + i] = machineInput[i] || 0;
        }
      }

      return universalVector;
    });
  }

  /**
   * Initialize default machines from JSON files on startup
   */
  private async initializeDefaultSequences(): Promise<void> {
    try {
      console.log('Loading example machines from JSON files on startup...');

      // Use process.cwd() for reliable path to project root
      const machinesDir = join(process.cwd(), 'examples/machines');

      console.log('Looking for machines in:', machinesDir);

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
          this.addMachineToSystem(machine);

          console.log(`  ✓ ${machine.name} loaded from ${filename}`);
          loadedCount++;

          // Initialize simulation controller with the first machine's test vectors
          if (!this.simulationController && machine.metadata.inputSequences && machine.perceptualMapping) {
            const inputSequences = machine.metadata.inputSequences as any[];
            if (inputSequences.length > 0) {
              const firstSequence = inputSequences[0];
              if (firstSequence.vectors && Array.isArray(firstSequence.vectors)) {
                // Convert machine-specific inputs to universal perceptual space inputs
                const universalInputs = this.convertToUniversalInputs(
                  firstSequence.vectors,
                  machine
                );

                this.simulationController = new SimulationController(this.engine, {
                  autoPlayDelayMs: 2000,
                  inputVectors: universalInputs,
                  loop: true,
                  machineId: machine.id,
                  usePerceptualSpace: true
                });
                console.log(`  ✓ Simulation controller initialized with ${firstSequence.name} (universal perceptual space mode)`);
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

    // Universal Input Space (Preception) endpoints
    this.router.post('/machines/:id/process-universal', this.processUniversalInput.bind(this));
    this.router.post('/machines/process-universal/all', this.processUniversalInputForAllMachines.bind(this));
    this.router.post('/preception/diagnostic', this.getPreceptionDiagnostic.bind(this));

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
    this.router.get('/demo/rs-flip-flop', this.loadRSFlipFlopExample.bind(this));
    this.router.get('/demo/rs2', this.loadRS2Example.bind(this));
    this.router.get('/demo/multi-step', this.loadMultiStepExample.bind(this));
    this.router.get('/demo/data-center', this.loadDataCenterExample.bind(this));
    this.router.get('/demo/kleene-star', this.loadKleeneStarExample.bind(this));
    this.router.get('/demo/nand-gate', this.loadNANDGateExample.bind(this)); // Deprecated
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
      const { vectors, autoPlayDelayMs, loop, machineId, usePerceptualSpace } = req.body;

      if (!Array.isArray(vectors)) {
        res.status(400).json({ error: 'Vectors must be an array' });
        return;
      }

      // Determine if we should use perceptual space mode
      // Default to perceptual mode if machineId is provided
      const shouldUsePerceptualSpace = usePerceptualSpace !== undefined
        ? usePerceptualSpace
        : (machineId !== undefined);

      // Create or reinitialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: autoPlayDelayMs || 1000,
        inputVectors: vectors,
        loop: loop !== undefined ? loop : true,
        machineId: machineId,
        usePerceptualSpace: shouldUsePerceptualSpace
      });

      console.log(`Loaded simulation with ${vectors.length} vectors`);
      console.log(`  Perceptual space mode: ${shouldUsePerceptualSpace ? 'ENABLED' : 'DISABLED (legacy)'}`);
      if (machineId) {
        console.log(`  Machine ID: ${machineId}`);
      }

      res.json({
        success: true,
        state: this.simulationController.getState(),
        mode: shouldUsePerceptualSpace ? 'perceptual' : 'legacy'
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

      this.addMachineToSystem(machine);

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

  /**
   * Process universal input space through a specific machine (with Preception)
   * POST /api/machines/:id/process-universal
   *
   * Body:
   * {
   *   "universalInputSpace": number[] // 256-byte universal input vector
   * }
   */
  private processUniversalInput(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { universalInputSpace } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Machine ID required' });
        return;
      }

      if (!Array.isArray(universalInputSpace)) {
        res.status(400).json({ error: 'universalInputSpace must be an array' });
        return;
      }

      if (universalInputSpace.length !== 256) {
        res.status(400).json({
          error: 'universalInputSpace must be 256 bytes',
          provided: universalInputSpace.length
        });
        return;
      }

      // Process through PreceptionEngine → Machine
      const result = this.engine.processUniversalInput(universalInputSpace, id);

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
        },
        preception: {
          universalSpaceDimension: universalInputSpace.length,
          resolvedInputDimension: result.inputVector.length,
          preceptionUsed: true
        }
      });
    } catch (error: any) {
      console.error('Error processing universal input:', error);
      res.status(500).json({
        error: 'Failed to process universal input',
        details: error.message
      });
    }
  }

  /**
   * Process universal input space through ALL machines (with Preception)
   * POST /api/machines/process-universal/all
   *
   * Body:
   * {
   *   "universalInputSpace": number[] // 256-byte universal input vector
   * }
   */
  private processUniversalInputForAllMachines(req: Request, res: Response): void {
    try {
      const { universalInputSpace } = req.body;

      if (!Array.isArray(universalInputSpace)) {
        res.status(400).json({ error: 'universalInputSpace must be an array' });
        return;
      }

      if (universalInputSpace.length !== 256) {
        res.status(400).json({
          error: 'universalInputSpace must be 256 bytes',
          provided: universalInputSpace.length
        });
        return;
      }

      // Process through PreceptionEngine → All Machines
      const resultsMap = this.engine.processUniversalInputForAllMachines(universalInputSpace);

      // Convert Map to object for JSON serialization
      const results: Record<string, any> = {};
      resultsMap.forEach((result, machineId) => {
        const sequenceResults: Record<string, any> = {};
        result.sequenceResults.forEach((value, key) => {
          sequenceResults[key] = value;
        });

        results[machineId] = {
          inputVector: result.inputVector,
          timestamp: result.timestamp,
          sequenceResults,
          machineOutput: result.machineOutput,
          arbiterMetadata: result.arbiterMetadata
        };
      });

      res.json({
        results,
        summary: {
          totalMachines: resultsMap.size,
          universalSpaceDimension: universalInputSpace.length,
          timestamp: Date.now(),
          preceptionUsed: true
        }
      });
    } catch (error: any) {
      console.error('Error processing universal input for all machines:', error);
      res.status(500).json({
        error: 'Failed to process universal input for all machines',
        details: error.message
      });
    }
  }

  /**
   * Get diagnostic information about universal input space mapping
   * POST /api/preception/diagnostic
   *
   * Body:
   * {
   *   "universalInputSpace": number[] // 256-byte universal input vector
   * }
   */
  private getPreceptionDiagnostic(req: Request, res: Response): void {
    try {
      const { universalInputSpace } = req.body;

      if (!Array.isArray(universalInputSpace)) {
        res.status(400).json({ error: 'universalInputSpace must be an array' });
        return;
      }

      if (universalInputSpace.length !== 256) {
        res.status(400).json({
          error: 'universalInputSpace must be 256 bytes',
          provided: universalInputSpace.length
        });
        return;
      }

      // Get diagnostic mapping
      const diagnostic = this.engine.getDiagnosticMapping(universalInputSpace);

      res.json({
        diagnostic,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('Error getting preception diagnostic:', error);
      res.status(500).json({
        error: 'Failed to get preception diagnostic',
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
      // Use process.cwd() for reliable path to project root
      const machinesDir = join(process.cwd(), 'examples/machines');

      console.log('Looking for machines in:', machinesDir);
      console.log('Directory exists:', existsSync(machinesDir));

      if (!existsSync(machinesDir)) {
        console.warn('Machines directory not found at:', machinesDir);
        res.json({ machines: [] });
        return;
      }

      const allFiles = readdirSync(machinesDir);
      console.log('Files in directory:', allFiles);

      const jsonFiles = allFiles.filter(file => file.endsWith('.json'));
      console.log('JSON files found:', jsonFiles);

      const files = jsonFiles.map(file => {
        try {
          const filepath = join(machinesDir, file);
          console.log('Reading file:', filepath);
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
        } catch (error: any) {
          console.error(`Error reading file ${file}:`, error.message);
          return null;
        }
      }).filter(f => f !== null);

      console.log('Successfully parsed files:', files.length);
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

      // Construct the file path - use process.cwd() for reliable path to project root
      const machinesDir = join(process.cwd(), 'examples/machines');
      const filename = name.endsWith('.json') ? name : `${name}.json`;
      const filepath = join(machinesDir, filename);

      console.log('Loading machine from:', filepath);

      if (!existsSync(filepath)) {
        console.warn('Machine file not found:', filepath);
        res.status(404).json({ error: `Machine JSON file not found: ${filename}` });
        return;
      }

      // Read and load the machine
      const jsonString = readFileSync(filepath, 'utf8');
      const machine = MachineLoader.loadFromJSON(jsonString);

      // Add machine to system (engine + perceptual simulator)
      this.addMachineToSystem(machine);

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

      // Add machine to system (engine + perceptual simulator)
      this.addMachineToSystem(machine);

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
      // Load the first available machine from JSON
      const machines = this.engine.getAllMachines();

      if (machines.length === 0) {
        res.status(404).json({
          error: 'No machines loaded. Please ensure machine JSON files are available in examples/machines/'
        });
        return;
      }

      // Use the first machine
      const machine = machines[0];

      if (!machine) {
        res.status(404).json({
          error: 'No machines available'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1000,
        inputVectors: allInputVectors,
        loop: true
      });

      res.json({
        success: true,
        metadata: {
          name: machine.name,
          description: machine.description,
          machineId: machine.id,
          totalSequences: machine.getSequenceCount(),
          totalMachines: machines.length
        },
        sequencesLoaded: machine.getSequenceCount(),
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading demo:', error);
      res.status(500).json({
        error: 'Failed to load demo dataset',
        details: error.message
      });
    }
  }

  private async loadRSFlipFlopExample(_req: Request, res: Response): Promise<void> {
    try {
      // Find the RS Flip Flop machine (should be loaded from JSON)
      const machine = this.engine.getAllMachines().find(m => m.name === 'RS Flip Flop');

      if (!machine) {
        res.status(404).json({
          error: 'RS Flip Flop machine not found. Please ensure RSFlipFlop.json is loaded.'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1000,
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
          ...machine.metadata
        },
        sequencesLoaded: machine.getSequenceCount(),
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading RS Flip Flop example:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load RS Flip Flop example',
        message: error.message
      });
    }
  }

  private async loadRS2Example(_req: Request, res: Response): Promise<void> {
    try {
      // Find the RS2 machine (should be loaded from JSON)
      const machine = this.engine.getAllMachines().find(m => m.name === 'RS2');

      if (!machine) {
        res.status(404).json({
          error: 'RS2 machine not found. Please ensure RS2.json is loaded.'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1000,
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
          ...machine.metadata
        },
        sequencesLoaded: machine.getSequenceCount(),
        inputVectorsLoaded: allInputVectors.length
      });
    } catch (error: any) {
      console.error('Error loading RS2 example:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load RS2 example',
        message: error.message
      });
    }
  }

  private async loadDataCenterExample(_req: Request, res: Response): Promise<void> {
    try {
      // Find the Data Center Monitoring machine (should be loaded from JSON)
      const machine = this.engine.getAllMachines().find(m => m.name === 'Data Center Monitoring');

      if (!machine) {
        res.status(404).json({
          error: 'Data Center Monitoring machine not found. Please ensure DataCenterMonitoring.json is loaded.'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

      // Initialize simulation controller
      this.simulationController = new SimulationController(this.engine, {
        autoPlayDelayMs: 1500,
        inputVectors: allInputVectors,
        loop: false
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
          ...machine.metadata
        },
        sequencesLoaded: machine.getSequenceCount(),
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
      // Find the Multi-Step State Machine (should be loaded from JSON)
      const machine = this.engine.getAllMachines().find(m => m.name === 'Multi-Step State Machine');

      if (!machine) {
        res.status(404).json({
          error: 'Multi-Step State Machine not found. Please ensure MultiStep.json is loaded.'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

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
          ...machine.metadata
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
      res.status(410).json({
        error: 'NAND Gate example has been deprecated',
        message: 'NAND Gate machine is no longer available. Please use one of the other example machines.',
        alternatives: [
          'RS Flip Flop',
          'RS2',
          'Multi-Step State Machine',
          'Data Center Monitoring',
          'Kleene Star Operator'
        ]
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
      // Find the Kleene Star Operator machine (should be loaded from JSON)
      const machine = this.engine.getAllMachines().find(m => m.name === 'Kleene Star Operator');

      if (!machine) {
        res.status(404).json({
          error: 'Kleene Star Operator machine not found. Please ensure KleeneStar.json is loaded.'
        });
        return;
      }

      // Get input vectors from machine metadata
      const inputSequences = machine.metadata.inputSequences as any[] || [];
      const allInputVectors = inputSequences.length > 0
        ? inputSequences[0].vectors || []
        : [];

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
          ...machine.metadata
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
