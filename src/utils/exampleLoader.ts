/**
 * Example Data Loader
 * Loads example sequences and machines on startup
 */

import fs from 'fs/promises';
import path from 'path';
import { RealityEngine } from '../engine/RealityEngine.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { RealityVector } from '../models/RealityVector.js';
import { Machine } from '../models/Machine.js';
import { ComparatorType } from '../models/types.js';
import type { VectorElement } from '../models/types.js';

interface CriticalEventSequenceData {
  pattern: string;
  inputs: number[][];
  expectedOutput: number[];
  description?: string;
}

interface ExampleData {
  name: string;
  description: string;
  type: string;
  metadata?: Record<string, any>;
  truthTable?: Record<string, any>;
  testVectors?: Array<any>;
  sequences?: Array<any>;
  CriticalEventSequences?: Record<string, CriticalEventSequenceData>;
  implementation?: {
    vectors: Array<any>;
  };
}

export class ExampleLoader {
  private engine: RealityEngine;
  private dataDir: string;

  constructor(engine: RealityEngine, dataDir: string = './data') {
    this.engine = engine;
    this.dataDir = dataDir;
  }

  /**
   * Load RS Flip-Flop example
   */
  async loadRSFlipFlop(): Promise<{ sequenceId: string; machineId?: string }> {
    console.log('📚 Loading RS Flip-Flop example...');

    try {
      // Read the RS flip-flop data file
      const filePath = path.join(this.dataDir, 'rs-flipflop.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data: ExampleData = JSON.parse(fileContent);

      // Create the sequence
      const sequence = new CriticalEventSequence(data.name);

      // Set metadata
      sequence.metadata = {
        ...data.metadata,
        type: data.type,
        description: data.description,
        isExample: true,
        loadedOnStartup: true,
        truthTable: data.truthTable
      };

      // Build vectors for the sequence
      const vectorDefinitions = [
        // RESET State (Initial)
        {
          id: 'reset-state',
          elements: [
            { value: 0.0, comparatorType: ComparatorType.EQUALS },
            { value: 1.0, comparatorType: ComparatorType.EQUALS }
          ],
          isInitial: true,
          nextVectorIds: ['reset-state', 'set-state', 'hold-from-reset', 'invalid-state'],
          outputVectors: [
            {
              id: 'reset-output',
              vector: [0.0, 1.0],
              timestamp: Date.now(),
              metadata: {
                description: 'RESET state: Q=0, Q_bar=1',
                state: 'RESET',
                Q: 0,
                Q_bar: 1
              }
            }
          ],
          metadata: {
            name: 'RESET State',
            description: 'R=1, S=0: Output Q=0, Q_bar=1',
            stateName: 'RESET',
            color: '#ef4444'
          }
        },
        // SET State (Initial)
        {
          id: 'set-state',
          elements: [
            { value: 1.0, comparatorType: ComparatorType.EQUALS },
            { value: 0.0, comparatorType: ComparatorType.EQUALS }
          ],
          isInitial: true,
          nextVectorIds: ['reset-state', 'set-state', 'hold-from-set', 'invalid-state'],
          outputVectors: [
            {
              id: 'set-output',
              vector: [1.0, 0.0],
              timestamp: Date.now(),
              metadata: {
                description: 'SET state: Q=1, Q_bar=0',
                state: 'SET',
                Q: 1,
                Q_bar: 0
              }
            }
          ],
          metadata: {
            name: 'SET State',
            description: 'S=1, R=0: Output Q=1, Q_bar=0',
            stateName: 'SET',
            color: '#22c55e'
          }
        },
        // HOLD from RESET
        {
          id: 'hold-from-reset',
          elements: [
            { value: 0.0, comparatorType: ComparatorType.EQUALS },
            { value: 0.0, comparatorType: ComparatorType.EQUALS }
          ],
          isInitial: false,
          nextVectorIds: ['reset-state', 'set-state', 'hold-from-reset', 'invalid-state'],
          outputVectors: [
            {
              id: 'hold-reset-output',
              vector: [0.0, 1.0],
              timestamp: Date.now(),
              metadata: {
                description: 'HOLD from RESET: Q=0, Q_bar=1',
                state: 'HOLD_RESET',
                Q: 0,
                Q_bar: 1,
                previousState: 'RESET'
              }
            }
          ],
          metadata: {
            name: 'HOLD from RESET',
            description: 'S=0, R=0: Maintain RESET state (Q=0, Q_bar=1)',
            stateName: 'HOLD',
            previousState: 'RESET',
            color: '#3b82f6'
          }
        },
        // HOLD from SET
        {
          id: 'hold-from-set',
          elements: [
            { value: 0.0, comparatorType: ComparatorType.EQUALS },
            { value: 0.0, comparatorType: ComparatorType.EQUALS }
          ],
          isInitial: false,
          nextVectorIds: ['reset-state', 'set-state', 'hold-from-set', 'invalid-state'],
          outputVectors: [
            {
              id: 'hold-set-output',
              vector: [1.0, 0.0],
              timestamp: Date.now(),
              metadata: {
                description: 'HOLD from SET: Q=1, Q_bar=0',
                state: 'HOLD_SET',
                Q: 1,
                Q_bar: 0,
                previousState: 'SET'
              }
            }
          ],
          metadata: {
            name: 'HOLD from SET',
            description: 'S=0, R=0: Maintain SET state (Q=1, Q_bar=0)',
            stateName: 'HOLD',
            previousState: 'SET',
            color: '#3b82f6'
          }
        },
        // INVALID State
        {
          id: 'invalid-state',
          elements: [
            { value: 1.0, comparatorType: ComparatorType.EQUALS },
            { value: 1.0, comparatorType: ComparatorType.EQUALS }
          ],
          isInitial: false,
          nextVectorIds: ['reset-state', 'set-state', 'invalid-state'],
          outputVectors: [
            {
              id: 'invalid-output',
              vector: [1.0, 1.0],
              timestamp: Date.now(),
              metadata: {
                description: 'INVALID state: S=1, R=1 (undefined behavior)',
                state: 'INVALID',
                Q: 1,
                Q_bar: 1,
                error: 'Both S and R are high - invalid state'
              }
            }
          ],
          metadata: {
            name: 'INVALID State',
            description: 'S=1, R=1: Invalid/undefined state',
            stateName: 'INVALID',
            color: '#f59e0b',
            warning: 'This state should be avoided in practice'
          }
        }
      ];

      // Create and add vectors to sequence
      for (const vecDef of vectorDefinitions) {
        const vectorElements: VectorElement[] = vecDef.elements.map(e => ({
          value: e.value,
          comparatorType: e.comparatorType
        }));

        const vector = new RealityVector(
          vectorElements,
          vecDef.isInitial,
          vecDef.id
        );

        // Add next vector connections
        if (vecDef.nextVectorIds) {
          vecDef.nextVectorIds.forEach(id => vector.addNextVector(id));
        }

        // Add output vectors
        if (vecDef.outputVectors) {
          vecDef.outputVectors.forEach(ov => vector.addOutputVector(ov));
        }

        // Set vector metadata
        if (vecDef.metadata) {
          vector.metadata = vecDef.metadata;
        }

        sequence.addVector(vector);
      }

      // Validate and add sequence to engine
      const validation = sequence.validate();
      if (!validation.valid) {
        throw new Error(`Invalid sequence: ${validation.errors.join(', ')}`);
      }

      this.engine.addSequence(sequence);
      console.log(`  ✓ RS Flip-Flop sequence created: ${sequence.id}`);

      // Load Critical Event Sequences if present
      const criticalEventSequences: CriticalEventSequence[] = [];
      if (data.CriticalEventSequences) {
        const ces = await this.loadCriticalEventSequences(data.CriticalEventSequences, data.name);
        criticalEventSequences.push(...ces);
      }

      // Create a machine for the flip-flop
      try {
        const machine = new Machine(
          'RS Flip-Flop Circuit',
          'A single RS flip-flop implementation demonstrating bistable memory',
          {
            type: 'digital-logic',
            component: 'flip-flop',
            variant: 'RS',
            inputDimension: 2,
            outputDimension: 2,
            isExample: true,
            truthTable: data.truthTable,
            criticalEventSequences: criticalEventSequences.length
          }
        );

        // Add main sequence
        machine.addSequence(sequence);

        // Add Critical Event Sequences to machine
        for (const ces of criticalEventSequences) {
          machine.addSequence(ces);
        }

        this.engine.addMachine(machine);

        console.log(`  ✓ RS Flip-Flop machine created: ${machine.id}`);
        console.log('  ✓ RS Flip-Flop example loaded successfully');

        return {
          sequenceId: sequence.id,
          machineId: machine.id
        };
      } catch (error) {
        console.log('  ⚠ Machine creation skipped (sequences available)');
        return {
          sequenceId: sequence.id
        };
      }
    } catch (error) {
      console.error('  ✗ Failed to load RS Flip-Flop:', error);
      throw error;
    }
  }

  /**
   * Load Critical Event Sequences from JSON data
   */
  private async loadCriticalEventSequences(
    sequences: Record<string, CriticalEventSequenceData>,
    baseName: string
  ): Promise<CriticalEventSequence[]> {
    console.log('  📋 Loading Critical Event Sequences...');

    const createdSequences: CriticalEventSequence[] = [];

    for (const [sequenceName, sequenceData] of Object.entries(sequences)) {
      try {
        // Create a new sequence for this critical event sequence
        const cesName = `${baseName} - ${sequenceName}`;
        const ces = new CriticalEventSequence(cesName);

        // Set metadata
        ces.metadata = {
          type: 'critical-event-sequence',
          pattern: sequenceData.pattern,
          description: sequenceData.description || '',
          basedOn: baseName,
          isExample: true,
          expectedOutput: sequenceData.expectedOutput
        };

        // Create vectors for each input in the sequence
        for (let i = 0; i < sequenceData.inputs.length; i++) {
          const input = sequenceData.inputs[i];
          if (!input) continue;

          const isInitial = i === 0;
          const isFinal = i === sequenceData.inputs.length - 1;

          // Build vector elements
          const vectorElements: VectorElement[] = input.map(value => ({
            value,
            comparatorType: ComparatorType.EQUALS
          }));

          // Create the vector
          const vector = new RealityVector(
            vectorElements,
            isInitial,
            `${sequenceName}-step-${i}`
          );

          // Add next vector connection if not final
          if (!isFinal) {
            vector.addNextVector(`${sequenceName}-step-${i + 1}`);
          }

          // Add output vector on final step
          if (isFinal) {
            vector.addOutputVector({
              id: `${sequenceName}-output`,
              vector: sequenceData.expectedOutput,
              timestamp: Date.now(),
              metadata: {
                description: sequenceData.description || `Output for ${sequenceName}`,
                pattern: sequenceData.pattern,
                sequenceName: sequenceName
              }
            });
          }

          // Set vector metadata
          vector.metadata = {
            name: `${sequenceName} Step ${i + 1}`,
            description: `Input: [${input.join(', ')}]`,
            step: i + 1,
            totalSteps: sequenceData.inputs.length,
            isFinal: isFinal
          };

          ces.addVector(vector);
        }

        // Validate and add sequence to engine
        const validation = ces.validate();
        if (!validation.valid) {
          console.log(`    ⚠ ${sequenceName} validation failed: ${validation.errors.join(', ')}`);
          continue;
        }

        this.engine.addSequence(ces);
        createdSequences.push(ces);
        console.log(`    ✓ ${sequenceName} created (${sequenceData.inputs.length} steps → ${sequenceData.expectedOutput})`);
      } catch (error) {
        console.error(`    ✗ Failed to load ${sequenceName}:`, error);
      }
    }

    return createdSequences;
  }

  /**
   * Load all examples
   */
  async loadAllExamples(): Promise<void> {
    console.log('\n📦 Loading example data...');

    try {
      await this.loadRSFlipFlop();
      console.log('✓ All examples loaded\n');
    } catch (error) {
      console.error('⚠ Some examples failed to load:', error);
      console.log('  Continuing with startup...\n');
    }
  }

  /**
   * Validate that examples are loaded
   */
  async validateExamples(): Promise<boolean> {
    console.log('🔍 Validating examples...');

    try {
      // Check if RS Flip-Flop sequence exists
      const sequences = this.engine.getAllSequences();
      const rsFlipFlop = sequences.find(seq =>
        seq.name === 'RS Flip-Flop' ||
        (seq.metadata as any)?.component === 'rs-flipflop'
      );

      if (rsFlipFlop) {
        console.log(`  ✓ RS Flip-Flop found: ${rsFlipFlop.id}`);

        // Validate it has 5 vectors
        const allVectors = rsFlipFlop.getAllVectors();
        if (allVectors.length === 5) {
          console.log(`  ✓ RS Flip-Flop has 5 states (correct)`);
          console.log('✓ Examples validated\n');
          return true;
        } else {
          console.log(`  ⚠ RS Flip-Flop has ${allVectors.length} states (expected 5)`);
          return false;
        }
      } else {
        console.log('  ⚠ RS Flip-Flop not found');
        return false;
      }
    } catch (error) {
      console.error('  ✗ Validation failed:', error);
      return false;
    }
  }
}
