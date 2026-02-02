import { v4 as uuidv4 } from 'uuid';
import { Machine } from '../models/Machine.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import { RealityVector } from '../models/RealityVector.js';
import { ArbiterRule } from '../models/OutputArbiter.js';
import { ComparatorType } from '../models/types.js';
import type { OutputVector, VectorElement } from '../models/types.js';

/**
 * Machine JSON Format Version
 */
export const MACHINE_JSON_VERSION = '1.0.0';

/**
 * Machine JSON Structure
 */
export interface MachineJSON {
  version: string;
  machine: {
    name: string;
    description: string;
    metadata?: Record<string, any>;
    arbiterRule: string;
    perceptualMapping?: {
      input: { offset: number; length: number };
      output: { offset: number; length: number };
    };
    sequences: SequenceJSON[];
    inputSequences?: InputSequenceJSON[];
  };
}

export interface SequenceJSON {
  id?: string;
  name: string;
  metadata?: Record<string, any>;
  vectors: VectorJSON[];
}

export interface VectorJSON {
  id?: string;
  elements: ElementJSON[];
  isInitial: boolean;
  metadata?: Record<string, any>;
  nextVectorIds?: string[];
  outputVectors?: OutputVectorJSON[];
}

export interface ElementJSON {
  value: number;
  comparatorType: string;
  threshold?: number;
}

export interface OutputVectorJSON {
  id?: string;
  vector: number[];
  metadata?: any;
}

export interface InputSequenceJSON {
  name: string;
  pattern?: string;
  description: string;
  vectors: number[][];
  metadata?: Record<string, any>;
}

/**
 * MachineLoader Service
 *
 * Handles loading and saving machines from/to JSON format
 */
export class MachineLoader {
  /**
   * Load a machine from JSON string
   */
  public static loadFromJSON(jsonString: string): Machine {
    const machineJSON: MachineJSON = JSON.parse(jsonString);

    // Validate version
    if (!machineJSON.version) {
      throw new Error('Missing version field in machine JSON');
    }

    // Parse major version
    const jsonMajorVersion = parseInt(machineJSON.version.split('.')[0] || '0');
    const currentMajorVersion = parseInt(MACHINE_JSON_VERSION.split('.')[0] || '0');

    if (jsonMajorVersion !== currentMajorVersion) {
      throw new Error(
        `Incompatible machine JSON version: ${machineJSON.version} (current: ${MACHINE_JSON_VERSION})`
      );
    }

    // Create machine
    const machineData = machineJSON.machine;

    // Parse arbiter rule
    const arbiterRule = this.parseArbiterRule(machineData.arbiterRule);

    // Parse perceptual mapping
    const perceptualMapping = machineData.perceptualMapping
      ? {
          input: {
            offset: machineData.perceptualMapping.input.offset,
            length: machineData.perceptualMapping.input.length
          },
          output: {
            offset: machineData.perceptualMapping.output.offset,
            length: machineData.perceptualMapping.output.length
          }
        }
      : undefined;

    // Build metadata
    const metadata: Record<string, any> = {
      ...machineData.metadata,
      inputSequences: machineData.inputSequences || []
    };

    // Create machine
    const machine = new Machine(
      machineData.name,
      machineData.description,
      metadata,
      arbiterRule,
      perceptualMapping
    );

    // Load sequences
    for (const seqJSON of machineData.sequences) {
      const sequence = this.loadSequenceFromJSON(seqJSON);
      machine.addSequence(sequence);
    }

    return machine;
  }

  /**
   * Load a sequence from JSON
   */
  private static loadSequenceFromJSON(seqJSON: SequenceJSON): CriticalEventSequence {
    const sequenceId = seqJSON.id || uuidv4();
    const sequence = new CriticalEventSequence(seqJSON.name, sequenceId);

    // Set metadata
    if (seqJSON.metadata) {
      sequence.metadata = seqJSON.metadata;
    }

    // Create vectors (first pass - create all vectors)
    const vectorMap = new Map<string, RealityVector>();

    for (const vecJSON of seqJSON.vectors) {
      const vectorId = vecJSON.id || uuidv4();

      // Parse elements
      const elements: VectorElement[] = vecJSON.elements.map(elem => {
        const element: VectorElement = {
          value: elem.value,
          comparatorType: this.parseComparatorType(elem.comparatorType)
        };
        if (elem.threshold !== undefined) {
          element.threshold = elem.threshold;
        }
        return element;
      });

      // Create vector
      const vector = new RealityVector(elements, vecJSON.isInitial, vectorId);

      // Set metadata
      if (vecJSON.metadata) {
        vector.metadata = vecJSON.metadata;
      }

      // Add output vectors
      if (vecJSON.outputVectors) {
        for (const outJSON of vecJSON.outputVectors) {
          const output: OutputVector = {
            id: outJSON.id || uuidv4(),
            vector: outJSON.vector,
            timestamp: Date.now(),
            metadata: outJSON.metadata
          };
          vector.addOutputVector(output);
        }
      }

      vectorMap.set(vectorId, vector);
      sequence.addVector(vector);
    }

    // Second pass - add next vector references
    for (let i = 0; i < seqJSON.vectors.length; i++) {
      const vecJSON = seqJSON.vectors[i];
      if (!vecJSON) continue;

      const vectorId = vecJSON.id || Array.from(vectorMap.keys())[i];
      if (!vectorId) continue;

      const vector = vectorMap.get(vectorId);
      if (!vector) continue;

      if (vecJSON.nextVectorIds) {
        for (const nextId of vecJSON.nextVectorIds) {
          vector.addNextVector(nextId);
        }
      }
    }

    return sequence;
  }

  /**
   * Save a machine to JSON string
   */
  public static saveToJSON(machine: Machine, pretty: boolean = true): string {
    const machineData: any = {
      name: machine.name,
      description: machine.description,
      metadata: { ...machine.metadata },
      arbiterRule: this.serializeArbiterRule(machine.getArbiter().getRule()),
      sequences: this.saveSequencesToJSON(machine.getAllSequences()),
      inputSequences: machine.metadata.inputSequences || []
    };

    // Add perceptualMapping only if it exists
    if (machine.perceptualMapping) {
      machineData.perceptualMapping = machine.perceptualMapping;
    }

    const machineJSON: MachineJSON = {
      version: MACHINE_JSON_VERSION,
      machine: machineData
    };

    // Remove inputSequences from metadata since it's at top level
    if (machineJSON.machine.metadata) {
      delete machineJSON.machine.metadata.inputSequences;
    }

    return pretty ? JSON.stringify(machineJSON, null, 2) : JSON.stringify(machineJSON);
  }

  /**
   * Save sequences to JSON
   */
  private static saveSequencesToJSON(sequences: CriticalEventSequence[]): SequenceJSON[] {
    return sequences.map(seq => ({
      id: seq.id,
      name: seq.name,
      metadata: seq.metadata,
      vectors: this.saveVectorsToJSON(seq.getAllVectors())
    }));
  }

  /**
   * Save vectors to JSON
   */
  private static saveVectorsToJSON(vectors: RealityVector[]): VectorJSON[] {
    return vectors.map(vec => {
      const vectorJSON: VectorJSON = {
        id: vec.id,
        elements: vec.getElements().map(elem => {
          const elemJSON: ElementJSON = {
            value: elem.value,
            comparatorType: this.serializeComparatorType(elem.comparatorType)
          };
          if (elem.threshold !== undefined) {
            elemJSON.threshold = elem.threshold;
          }
          return elemJSON;
        }),
        isInitial: vec.isInitialVector(),
        metadata: vec.metadata,
        nextVectorIds: vec.getNextVectorIds(),
        outputVectors: vec.getOutputVectors().map(out => ({
          id: out.id,
          vector: out.vector,
          metadata: out.metadata
        }))
      };
      return vectorJSON;
    });
  }

  /**
   * Parse arbiter rule from string
   */
  private static parseArbiterRule(rule: string): ArbiterRule {
    switch (rule.toUpperCase()) {
      case 'PASSTHROUGH':
        return ArbiterRule.PASSTHROUGH;
      case 'AND':
        return ArbiterRule.AND;
      case 'OR':
        return ArbiterRule.OR;
      default:
        throw new Error(`Unknown arbiter rule: ${rule}. Valid options: PASSTHROUGH, AND, OR`);
    }
  }

  /**
   * Serialize arbiter rule to string
   */
  private static serializeArbiterRule(rule: ArbiterRule): string {
    switch (rule) {
      case ArbiterRule.PASSTHROUGH:
        return 'PASSTHROUGH';
      case ArbiterRule.AND:
        return 'AND';
      case ArbiterRule.OR:
        return 'OR';
      default:
        return 'PASSTHROUGH';
    }
  }

  /**
   * Parse comparator type from string
   */
  private static parseComparatorType(type: string): ComparatorType {
    switch (type.toLowerCase()) {
      case 'equals':
        return ComparatorType.EQUALS;
      case 'threshold':
        return ComparatorType.THRESHOLD;
      case 'pattern':
        return ComparatorType.PATTERN;
      case 'custom':
        return ComparatorType.CUSTOM;
      default:
        throw new Error(`Unknown comparator type: ${type}`);
    }
  }

  /**
   * Serialize comparator type to string
   */
  private static serializeComparatorType(type: ComparatorType): string {
    switch (type) {
      case ComparatorType.EQUALS:
        return 'equals';
      case ComparatorType.THRESHOLD:
        return 'threshold';
      case ComparatorType.PATTERN:
        return 'pattern';
      case ComparatorType.CUSTOM:
        return 'custom';
      default:
        return 'equals';
    }
  }

  /**
   * Validate machine JSON structure
   */
  public static validate(jsonString: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const machineJSON: MachineJSON = JSON.parse(jsonString);

      // Check required fields
      if (!machineJSON.version) {
        errors.push('Missing required field: version');
      }

      if (!machineJSON.machine) {
        errors.push('Missing required field: machine');
        return { valid: false, errors };
      }

      if (!machineJSON.machine.name) {
        errors.push('Missing required field: machine.name');
      }

      if (!machineJSON.machine.description) {
        errors.push('Missing required field: machine.description');
      }

      if (!machineJSON.machine.arbiterRule) {
        errors.push('Missing required field: machine.arbiterRule');
      }

      if (!machineJSON.machine.sequences || !Array.isArray(machineJSON.machine.sequences)) {
        errors.push('Missing or invalid field: machine.sequences');
      } else {
        // Validate sequences
        machineJSON.machine.sequences.forEach((seq, idx) => {
          if (!seq.name) {
            errors.push(`Sequence ${idx}: Missing required field: name`);
          }
          if (!seq.vectors || !Array.isArray(seq.vectors)) {
            errors.push(`Sequence ${idx}: Missing or invalid field: vectors`);
          } else {
            // Validate vectors
            seq.vectors.forEach((vec, vecIdx) => {
              if (!vec.elements || !Array.isArray(vec.elements)) {
                errors.push(`Sequence ${idx}, Vector ${vecIdx}: Missing or invalid field: elements`);
              }
              if (vec.isInitial === undefined) {
                errors.push(`Sequence ${idx}, Vector ${vecIdx}: Missing required field: isInitial`);
              }
            });
          }
        });
      }
    } catch (error: any) {
      errors.push(`JSON parse error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
