import dotenv from 'dotenv';
import type { RealityEngineConfig } from '../models/types.js';

dotenv.config();

/**
 * Configuration management for Reality Engine
 */
export class Config {
  private static instance: Config;
  private config: RealityEngineConfig;

  private constructor() {
    this.config = {
      vectorDimension: parseInt(process.env.VECTOR_DIMENSION || '128', 10),
      defaultMatchThreshold: parseFloat(process.env.MATCH_THRESHOLD || '0.85'),
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      collectionName: process.env.COLLECTION_NAME || 'reality_vectors'
    };

    this.validate();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public getConfig(): RealityEngineConfig {
    return { ...this.config };
  }

  public getVectorDimension(): number {
    return this.config.vectorDimension;
  }

  public getDefaultMatchThreshold(): number {
    return this.config.defaultMatchThreshold;
  }

  public getQdrantUrl(): string {
    return this.config.qdrantUrl;
  }

  public getCollectionName(): string {
    return this.config.collectionName;
  }

  public updateVectorDimension(dimension: number): void {
    if (dimension < 1 || dimension > 4096) {
      throw new Error('Vector dimension must be between 1 and 4096');
    }
    this.config.vectorDimension = dimension;
  }

  public updateMatchThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Match threshold must be between 0 and 1');
    }
    this.config.defaultMatchThreshold = threshold;
  }

  private validate(): void {
    if (this.config.vectorDimension < 1 || this.config.vectorDimension > 4096) {
      throw new Error('Invalid vector dimension configuration');
    }

    if (this.config.defaultMatchThreshold < 0 || this.config.defaultMatchThreshold > 1) {
      throw new Error('Invalid match threshold configuration');
    }

    if (!this.config.qdrantUrl) {
      throw new Error('Qdrant URL must be configured');
    }
  }
}

export default Config.getInstance();
