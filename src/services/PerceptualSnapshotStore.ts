import { QdrantClient } from '@qdrant/js-client-rest';
import { PerceptualVectorCodec } from './PerceptualVectorCodec.js';
import config from '../config/config.js';

export interface SnapshotMeta {
  stepNumber: number;
  timestamp:  number;
  label?:     string;
  dimension:  number;
  [key: string]: unknown;
}

export interface SnapshotRecord {
  id:     string;
  vector: number[];   // full N-dim vector, exact reconstruction
  meta:   SnapshotMeta;
}

/**
 * PerceptualSnapshotStore
 *
 * Persists PE (Perceptual Engine) space snapshots to a dedicated Qdrant
 * collection (`pe_snapshots`).  This collection is completely isolated from:
 *   - `reality_vectors`  — the VectorStore's RealityVector collection
 *   - localAIStack / Ollama embedding collections
 *
 * Storage uses PerceptualVectorCodec so vectors of any length N are stored
 * losslessly, regardless of whether N exceeds Qdrant's collection dimension:
 *
 *   Qdrant `vector` field  → STORAGE_DIM-dim fingerprint (ANN similarity search)
 *   Qdrant `payload` field → verbatim N-dim vector (exact recovery)
 *
 * This store is an opt-in observability layer.  The Reality Engine and
 * PerceptualSpaceSimulator operate independently of it; callers (e.g. the API
 * layer) decide when to persist a snapshot.
 */
export class PerceptualSnapshotStore {
  static readonly COLLECTION = 'pe_snapshots';

  private client:      QdrantClient;
  private initialized = false;

  constructor() {
    this.client = new QdrantClient({ url: config.getQdrantUrl() });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const { collections } = await this.client.getCollections();
      const exists = collections.some(c => c.name === PerceptualSnapshotStore.COLLECTION);
      if (!exists) {
        await this.client.createCollection(PerceptualSnapshotStore.COLLECTION, {
          vectors: {
            size:     PerceptualVectorCodec.STORAGE_DIM,
            distance: 'Cosine',
          },
        });
        console.log(`[PerceptualSnapshotStore] Created collection "${PerceptualSnapshotStore.COLLECTION}"`);
      }
      this.initialized = true;
    } catch (err) {
      console.error('[PerceptualSnapshotStore] Failed to initialize:', err);
      throw err;
    }
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Persist a single PE vector snapshot.
   *
   * @param id      Unique point identifier.  Must be a valid UUID string or an
   *                unsigned integer.  Suggested pattern: `step-<n>-<timestamp>`.
   * @param vector  Full N-dim perceptual space vector (any N).
   * @param meta    Contextual metadata (stepNumber, timestamp, optional label).
   */
  async store(
    id:     string,
    vector: number[],
    meta:   Omit<SnapshotMeta, 'dimension'>,
  ): Promise<void> {
    await this.ensureInit();
    const { fingerprint, payload: codecPayload } = PerceptualVectorCodec.encode(vector);
    await this.client.upsert(PerceptualSnapshotStore.COLLECTION, {
      wait:   true,
      points: [{
        id,
        vector:  fingerprint,
        payload: { ...meta, dimension: vector.length, ...codecPayload },
      }],
    });
  }

  /**
   * Persist multiple snapshots in a single Qdrant upsert call.
   */
  async storeBatch(
    snapshots: Array<{
      id:     string;
      vector: number[];
      meta:   Omit<SnapshotMeta, 'dimension'>;
    }>,
  ): Promise<void> {
    if (!snapshots.length) return;
    await this.ensureInit();
    await this.client.upsert(PerceptualSnapshotStore.COLLECTION, {
      wait:   true,
      points: snapshots.map(({ id, vector, meta }) => {
        const { fingerprint, payload: cp } = PerceptualVectorCodec.encode(vector);
        return {
          id,
          vector:  fingerprint,
          payload: { ...meta, dimension: vector.length, ...cp },
        };
      }),
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Retrieve a single snapshot by its point ID.
   * Returns `null` if not found or if the point lacks codec data.
   */
  async retrieve(id: string): Promise<SnapshotRecord | null> {
    await this.ensureInit();
    try {
      const hits = await this.client.retrieve(PerceptualSnapshotStore.COLLECTION, {
        ids: [id],
      });
      if (!hits.length || !hits[0]?.payload) return null;
      return this.decodeHit(id, hits[0].payload as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  /**
   * Find snapshots whose PE fingerprint is closest to `queryVector`.
   * Returns fully decoded N-dim vectors alongside similarity scores.
   *
   * @param queryVector   Reference vector (any length N — projected internally).
   * @param limit         Maximum results (default 5).
   * @param scoreThreshold Optional minimum cosine similarity (0–1).
   */
  async findSimilar(
    queryVector:     number[],
    limit            = 5,
    scoreThreshold?: number,
  ): Promise<Array<SnapshotRecord & { score: number }>> {
    await this.ensureInit();
    const fingerprint = PerceptualVectorCodec.project(queryVector);
    const hits = await this.client.search(PerceptualSnapshotStore.COLLECTION, {
      vector:          fingerprint,
      limit,
      score_threshold: scoreThreshold ?? null,
      with_payload:    true,
    });
    return hits
      .filter(h => h.payload != null)
      .map(h => ({
        ...this.decodeHit(String(h.id), h.payload as Record<string, unknown>),
        score: h.score,
      }));
  }

  /**
   * Delete a snapshot by ID.
   */
  async delete(id: string): Promise<void> {
    await this.ensureInit();
    await this.client.delete(PerceptualSnapshotStore.COLLECTION, {
      wait:   true,
      points: [id],
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async ensureInit(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  private decodeHit(id: string, raw: Record<string, unknown>): SnapshotRecord {
    const vector = PerceptualVectorCodec.decode(raw);
    if (!vector) {
      throw new Error(`[PerceptualSnapshotStore] No codec data in payload for id "${id}"`);
    }
    // Strip internal codec keys from the returned meta object
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k !== '__pe_v' && k !== '__pe_dim' && k !== '__pe_codec') meta[k] = v;
    }
    return { id, vector, meta: meta as SnapshotMeta };
  }
}
