/**
 * PreceptionOfReality: Processes raw observations into InputRealityVectors
 *
 * This component acts as the interface between physical reality observations
 * and the RealityEngine's vector representation.
 *
 * Responsibilities:
 * - Accept raw observation data
 * - Transform observations into normalized vectors
 * - Apply preprocessing and filtering
 * - Provide formatted vectors to the RealityEngine
 */

export interface RawObservation {
  data: number[] | Record<string, number>;
  timestamp: number;
  source?: string;
  metadata?: Record<string, any>;
}

export interface ProcessedPerception {
  inputVector: number[];
  originalObservation: RawObservation;
  processingTimestamp: number;
  transformations: string[];
}

export type TransformFunction = (data: number[]) => number[];

/**
 * PreceptionOfReality transforms raw observations into vectors
 */
export class PreceptionOfReality {
  private transformers: TransformFunction[];
  private vectorDimension: number;
  private preprocessingEnabled: boolean;

  constructor(vectorDimension: number, preprocessingEnabled: boolean = true) {
    this.vectorDimension = vectorDimension;
    this.preprocessingEnabled = preprocessingEnabled;
    this.transformers = [];

    // Add default transformers
    if (preprocessingEnabled) {
      this.addDefaultTransformers();
    }
  }

  /**
   * Add a custom transformation function
   */
  addTransformer(transformer: TransformFunction): void {
    this.transformers.push(transformer);
  }

  /**
   * Process a raw observation into an InputRealityVector
   */
  perceive(observation: RawObservation): ProcessedPerception {
    const transformations: string[] = [];

    // Convert observation data to array if needed
    let vectorData: number[];
    if (Array.isArray(observation.data)) {
      vectorData = observation.data;
    } else {
      vectorData = Object.values(observation.data);
      transformations.push('object-to-array');
    }

    // Apply transformations
    for (const transformer of this.transformers) {
      vectorData = transformer(vectorData);
    }

    // Ensure correct dimensionality
    vectorData = this.ensureDimension(vectorData);
    transformations.push('dimension-normalization');

    return {
      inputVector: vectorData,
      originalObservation: observation,
      processingTimestamp: Date.now(),
      transformations
    };
  }

  /**
   * Process multiple observations
   */
  perceiveMultiple(observations: RawObservation[]): ProcessedPerception[] {
    return observations.map(obs => this.perceive(obs));
  }

  /**
   * Create an observation from raw data
   */
  static createObservation(
    data: number[] | Record<string, number>,
    source?: string,
    metadata?: Record<string, any>
  ): RawObservation {
    const observation: RawObservation = {
      data,
      timestamp: Date.now()
    };

    if (source !== undefined) {
      observation.source = source;
    }

    if (metadata !== undefined) {
      observation.metadata = metadata;
    }

    return observation;
  }

  /**
   * Ensure vector matches configured dimension
   */
  private ensureDimension(vector: number[]): number[] {
    if (vector.length === this.vectorDimension) {
      return vector;
    }

    if (vector.length < this.vectorDimension) {
      // Pad with zeros
      return [...vector, ...new Array(this.vectorDimension - vector.length).fill(0)];
    }

    // Truncate or compress
    return vector.slice(0, this.vectorDimension);
  }

  /**
   * Add default transformation functions
   */
  private addDefaultTransformers(): void {
    // Normalization transformer (scale to 0-1 range)
    this.transformers.push((data: number[]) => {
      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const range = max - min;

      if (range === 0) return data;

      return data.map(v => (v - min) / range);
    });
  }

  /**
   * Clear all transformers
   */
  clearTransformers(): void {
    this.transformers = [];
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    vectorDimension: number;
    preprocessingEnabled: boolean;
    transformerCount: number;
  } {
    return {
      vectorDimension: this.vectorDimension,
      preprocessingEnabled: this.preprocessingEnabled,
      transformerCount: this.transformers.length
    };
  }
}
