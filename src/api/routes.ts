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
  private perceptualSimulator: PerceptualSpaceSimulator;
  // Staging buffer used by the chunk-based configuration protocol
  private sequenceBuffer: number[][] = [];
  private sequenceBufferConfig: { inputRegion: { offset: number; length: number }; stepDelayMs: number; maxSteps?: number } | null = null;

  constructor(engine: RealityEngine) {
    this.router = express.Router();
    this.engine = engine;
    this.perception = new PreceptionOfReality(config.getVectorDimension());
    this.perceptualSimulator = new PerceptualSpaceSimulator(256);

    // Sync the simulator's evolved perceptual space back into the PreceptionEngine
    // after every simulation step (manual or auto-play).  This ensures the engine's
    // authoritative perceptual state always reflects the output-integrated result of
    // the most recent simulation step, completing the input→process→output→space loop.
    this.perceptualSimulator.setOnStepComplete((_step, spaceVector) => {
      this.engine.getPreceptionEngine().getPerceptualSpace().setPerceptualVector(spaceVector);
    });

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
          // Derive a stable ID from the filename so machine IDs remain
          // consistent across server restarts and localStorage references stay valid.
          const baseName = filename.replace(/\.json$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const machine = MachineLoader.loadFromJSON(jsonString, `machine-${baseName}`);
          this.addMachineToSystem(machine);

          console.log(`  ✓ ${machine.name} loaded from ${filename}`);
          loadedCount++;
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

    // What-if analytic workflow endpoints
    this.router.post('/machines/:id/whatif', this.processMachineWhatIf.bind(this));
    this.router.post('/machines/:id/whatif-universal', this.processMachineUniversalWhatIf.bind(this));

    // Checkpoint / rewind endpoints
    this.router.post('/machines/:id/checkpoints', this.createCheckpoint.bind(this));
    this.router.get('/machines/:id/checkpoints', this.listCheckpoints.bind(this));
    this.router.post('/machines/:id/checkpoints/:checkpointId/restore', this.restoreCheckpoint.bind(this));
    this.router.delete('/machines/:id/checkpoints/:checkpointId', this.deleteCheckpoint.bind(this));

    // Machine JSON endpoints (load/save)
    this.router.get('/machines/json/list', this.listMachineJSONFiles.bind(this));
    this.router.get('/machines/json/:name', this.loadMachineFromJSON.bind(this));
    this.router.post('/machines/json/import', this.importMachineJSON.bind(this));
    this.router.get('/machines/:id/export', this.exportMachineToJSON.bind(this));

    // Machine Graph & Perceptual Space Simulation endpoints
    this.router.get('/machine-graph', this.getMachineGraph.bind(this));
    this.router.post('/perceptual-simulation/configure/chunk', this.appendSequenceChunk.bind(this));
    this.router.post('/perceptual-simulation/configure/commit', this.commitSequenceConfig.bind(this));
    this.router.post('/perceptual-simulation/start', this.startPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/stop', this.stopPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/step', this.stepPerceptualSimulation.bind(this));
    this.router.post('/perceptual-simulation/reset', this.resetPerceptualSimulation.bind(this));
    this.router.get('/perceptual-simulation/state', this.getPerceptualSimulationState.bind(this));
    this.router.get('/perceptual-simulation/history', this.getPerceptualSimulationHistory.bind(this));

    // Demo endpoints
    this.router.get('/demo/multi-step', this.loadMultiStepExample.bind(this));
    this.router.get('/demo/data-center', this.loadDataCenterExample.bind(this));
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
          preceptionUsed: true,
          // Return the perceptual space state AFTER the machine output has been
          // merged back, so callers can observe the integrated perceptual reality.
          perceptualSpaceAfter: this.engine.getPreceptionEngine().getPerceptualSpace().getPerceptualVector()
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
          preceptionUsed: true,
          // Return the perceptual space state AFTER all machine outputs have been
          // merged back (input-atomically).  Callers can use this to observe the
          // fully integrated perceptual reality produced by this processing round.
          perceptualSpaceAfter: this.engine.getPreceptionEngine().getPerceptualSpace().getPerceptualVector()
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

  // ── What-if Analytic Workflow ──────────────────────────────────────────────

  /**
   * Run a hypothetical input against a clone of the machine.
   * POST /api/machines/:id/whatif
   *
   * Body: { "vector": number[] }
   *
   * The live machine's event-sequence state is never touched.
   * Returns the same result shape as /machines/:id/process.
   */
  private processMachineWhatIf(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { vector } = req.body;
      if (!id) { res.status(400).json({ error: 'Machine ID required' }); return; }
      if (!Array.isArray(vector)) { res.status(400).json({ error: 'vector must be an array' }); return; }

      const result = this.engine.processWhatIf(id, vector);
      const sequenceResults: Record<string, any> = {};
      result.sequenceResults.forEach((v, k) => { sequenceResults[k] = v; });

      res.json({
        whatIf: true,
        result: {
          inputVector: result.inputVector,
          timestamp: result.timestamp,
          sequenceResults,
          machineOutput: result.machineOutput,
          arbiterMetadata: result.arbiterMetadata
        }
      });
    } catch (error: any) {
      console.error('Error in what-if processing:', error);
      res.status(500).json({ error: 'What-if processing failed', details: error.message });
    }
  }

  /**
   * Run a hypothetical universal-space input against a clone of the machine
   * via the PreceptionEngine, without mutating live state.
   * POST /api/machines/:id/whatif-universal
   *
   * Body: { "universalInputSpace": number[] }
   */
  private processMachineUniversalWhatIf(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { universalInputSpace } = req.body;
      if (!id) { res.status(400).json({ error: 'Machine ID required' }); return; }
      if (!Array.isArray(universalInputSpace)) {
        res.status(400).json({ error: 'universalInputSpace must be an array' }); return;
      }

      const result = this.engine.processUniversalWhatIf(universalInputSpace, id);
      const sequenceResults: Record<string, any> = {};
      result.sequenceResults.forEach((v, k) => { sequenceResults[k] = v; });

      res.json({
        whatIf: true,
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
      console.error('Error in universal what-if processing:', error);
      res.status(500).json({ error: 'Universal what-if processing failed', details: error.message });
    }
  }

  // ── Checkpoint / Rewind ────────────────────────────────────────────────────

  /**
   * Capture a checkpoint of the machine's current event-sequence state.
   * POST /api/machines/:id/checkpoints
   *
   * Body: { "label": string } (optional)
   */
  private createCheckpoint(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { label } = req.body ?? {};
      if (!id) { res.status(400).json({ error: 'Machine ID required' }); return; }

      const checkpointId = this.engine.createCheckpoint(id, label);
      const checkpoints = this.engine.listCheckpoints(id);
      const checkpoint = checkpoints.find(c => c.id === checkpointId)!;

      res.json({ success: true, checkpoint });
    } catch (error: any) {
      console.error('Error creating checkpoint:', error);
      res.status(500).json({ error: 'Failed to create checkpoint', details: error.message });
    }
  }

  /**
   * List all checkpoints for a machine.
   * GET /api/machines/:id/checkpoints
   */
  private listCheckpoints(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Machine ID required' }); return; }

      const checkpoints = this.engine.listCheckpoints(id);
      res.json({ checkpoints });
    } catch (error: any) {
      console.error('Error listing checkpoints:', error);
      res.status(500).json({ error: 'Failed to list checkpoints', details: error.message });
    }
  }

  /**
   * Restore a machine to a checkpoint state.
   * POST /api/machines/:id/checkpoints/:checkpointId/restore
   *
   * The stored checkpoint is preserved; the machine's live sequences are
   * replaced with a fresh clone of the snapshot.
   */
  private restoreCheckpoint(req: Request, res: Response): void {
    try {
      const { id, checkpointId } = req.params;
      if (!id || !checkpointId) {
        res.status(400).json({ error: 'Machine ID and checkpoint ID required' }); return;
      }

      this.engine.restoreCheckpoint(id, checkpointId);
      res.json({ success: true, machineId: id, restoredFrom: checkpointId, timestamp: Date.now() });
    } catch (error: any) {
      console.error('Error restoring checkpoint:', error);
      res.status(500).json({ error: 'Failed to restore checkpoint', details: error.message });
    }
  }

  /**
   * Delete a checkpoint.
   * DELETE /api/machines/:id/checkpoints/:checkpointId
   */
  private deleteCheckpoint(req: Request, res: Response): void {
    try {
      const { id, checkpointId } = req.params;
      if (!id || !checkpointId) {
        res.status(400).json({ error: 'Machine ID and checkpoint ID required' }); return;
      }

      const deleted = this.engine.deleteCheckpoint(id, checkpointId);
      if (!deleted) {
        res.status(404).json({ error: 'Checkpoint not found' }); return;
      }
      res.json({ success: true, deleted: checkpointId });
    } catch (error: any) {
      console.error('Error deleting checkpoint:', error);
      res.status(500).json({ error: 'Failed to delete checkpoint', details: error.message });
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

      // Read and load the machine with a stable filename-derived ID
      const jsonString = readFileSync(filepath, 'utf8');
      const baseName = filename.replace(/\.json$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const machine = MachineLoader.loadFromJSON(jsonString, `machine-${baseName}`);

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
   * Append a chunk of vectors to the staging buffer.
   * Send { reset: true, inputRegion, stepDelayMs, maxSteps? } on the first chunk
   * to clear any previous buffer and record the configuration.
   * Subsequent chunks only need { vectors }.
   */
  private appendSequenceChunk(req: Request, res: Response): void {
    try {
      const { vectors, reset, inputRegion, stepDelayMs, maxSteps } = req.body;

      if (reset) {
        this.sequenceBuffer = [];
        this.sequenceBufferConfig = {
          inputRegion: inputRegion || { offset: 0, length: 256 },
          stepDelayMs: stepDelayMs || 1000,
          maxSteps
        };
      }

      if (!this.sequenceBufferConfig) {
        res.status(400).json({ success: false, error: 'Send reset:true on the first chunk to initialise the buffer' });
        return;
      }

      if (!Array.isArray(vectors)) {
        res.status(400).json({ success: false, error: 'vectors must be an array' });
        return;
      }

      this.sequenceBuffer.push(...vectors);

      res.json({ success: true, buffered: this.sequenceBuffer.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Commit the staged buffer to the PerceptualSpaceSimulator and clear it.
   */
  private commitSequenceConfig(_req: Request, res: Response): void {
    try {
      if (!this.sequenceBufferConfig) {
        res.status(400).json({ success: false, error: 'No staged configuration — send at least one chunk first' });
        return;
      }

      if (this.sequenceBuffer.length === 0) {
        res.status(400).json({ success: false, error: 'Staged buffer is empty' });
        return;
      }

      this.perceptualSimulator.configure({
        inputSequence: this.sequenceBuffer,
        ...this.sequenceBufferConfig,
      });

      const committed = this.sequenceBuffer.length;
      this.sequenceBuffer = [];
      this.sequenceBufferConfig = null;

      res.json({
        success: true,
        committed,
        config: this.perceptualSimulator.getConfig(),
        timestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
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
