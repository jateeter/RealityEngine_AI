import { QdrantClient } from '@qdrant/js-client-rest';
import { RealityVector } from '../models/RealityVector.js';
import { CriticalEventSequence } from '../models/CriticalEventSequence.js';
import config from '../config/config.js';

/**
 * VectorStore: Interface to Qdrant vector database
 * Handles storage, retrieval, and search of RealityVectors
 */
export class VectorStore {
  private client: QdrantClient;
  private collectionName: string;
  private vectorDimension: number;
  private initialized: boolean = false;

  constructor() {
    const qdrantUrl = config.getQdrantUrl();
    this.client = new QdrantClient({ url: qdrantUrl });
    this.collectionName = config.getCollectionName();
    this.vectorDimension = config.getVectorDimension();
  }

  /**
   * Initialize the vector store and create collection if needed
   */
  async initialize(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        c => c.name === this.collectionName
      );

      if (!exists) {
        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorDimension,
            distance: 'Cosine'
          }
        });
        console.log(`Created collection: ${this.collectionName}`);
      }

      this.initialized = true;
      console.log('VectorStore initialized successfully');
    } catch (error) {
      console.error('Failed to initialize VectorStore:', error);
      throw error;
    }
  }

  /**
   * Store a RealityVector in the database
   */
  async storeVector(vector: RealityVector): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: vector.id,
            vector: this.normalizeVector(vector.getVector()),
            payload: {
              ...vector.toJSON(),
              timestamp: Date.now()
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to store vector:', error);
      throw error;
    }
  }

  /**
   * Store multiple RealityVectors
   */
  async storeVectors(vectors: RealityVector[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: vectors.map(vector => ({
          id: vector.id,
          vector: this.normalizeVector(vector.getVector()),
          payload: {
            ...vector.toJSON(),
            timestamp: Date.now()
          }
        }))
      });
    } catch (error) {
      console.error('Failed to store vectors:', error);
      throw error;
    }
  }

  /**
   * Retrieve a RealityVector by ID
   */
  async getVector(id: string): Promise<RealityVector | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.client.retrieve(this.collectionName, {
        ids: [id]
      });

      if (result.length === 0 || !result[0] || !result[0].payload) {
        return null;
      }

      return RealityVector.fromJSON(result[0].payload);
    } catch (error) {
      console.error('Failed to retrieve vector:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async searchSimilar(
    vector: number[],
    limit: number = 10,
    scoreThreshold?: number
  ): Promise<Array<{ vector: RealityVector; score: number }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results = await this.client.search(this.collectionName, {
        vector: this.normalizeVector(vector),
        limit,
        score_threshold: scoreThreshold ?? null,
        with_payload: true
      });

      return results.map(result => {
        if (!result.payload) {
          throw new Error('Result payload is missing');
        }
        return {
          vector: RealityVector.fromJSON(result.payload),
          score: result.score
        };
      });
    } catch (error) {
      console.error('Failed to search vectors:', error);
      throw error;
    }
  }

  /**
   * Store a CriticalEventSequence
   */
  async storeSequence(sequence: CriticalEventSequence): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Store all vectors in the sequence
    const vectors = sequence.getAllVectors();
    await this.storeVectors(vectors);

    // Store sequence metadata
    const sequenceCollectionName = `${this.collectionName}_sequences`;

    try {
      // Check if sequences collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        c => c.name === sequenceCollectionName
      );

      if (!exists) {
        await this.client.createCollection(sequenceCollectionName, {
          vectors: {
            size: this.vectorDimension,
            distance: 'Cosine'
          }
        });
      }

      // Use a dummy vector for sequence storage (we're mainly interested in payload)
      const dummyVector = new Array(this.vectorDimension).fill(0);

      await this.client.upsert(sequenceCollectionName, {
        wait: true,
        points: [
          {
            id: sequence.id,
            vector: dummyVector,
            payload: sequence.toJSON()
          }
        ]
      });
    } catch (error) {
      console.error('Failed to store sequence:', error);
      throw error;
    }
  }

  /**
   * Retrieve a CriticalEventSequence by ID
   */
  async getSequence(id: string): Promise<CriticalEventSequence | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const sequenceCollectionName = `${this.collectionName}_sequences`;

    try {
      const result = await this.client.retrieve(sequenceCollectionName, {
        ids: [id]
      });

      if (result.length === 0 || !result[0] || !result[0].payload) {
        return null;
      }

      return CriticalEventSequence.fromJSON(result[0].payload);
    } catch (error) {
      console.error('Failed to retrieve sequence:', error);
      return null;
    }
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id]
      });
    } catch (error) {
      console.error('Failed to delete vector:', error);
      throw error;
    }
  }

  /**
   * Normalize vector to ensure it's within valid range
   */
  private normalizeVector(vector: number[]): number[] {
    // Pad or truncate to match configured dimension
    if (vector.length < this.vectorDimension) {
      return [...vector, ...new Array(this.vectorDimension - vector.length).fill(0)];
    } else if (vector.length > this.vectorDimension) {
      return vector.slice(0, this.vectorDimension);
    }
    return vector;
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }
}
