import { CriticalEventSequence } from '../../dist/models/CriticalEventSequence.js';
export interface DemoDataset {
    sequences: CriticalEventSequence[];
    inputVectors: number[][];
    inputVectorMetadata: any[];
    metadata: {
        name: string;
        version: string;
        created: number;
        totalSequences: number;
        totalVectors: number;
        totalInputVectors: number;
    };
}
/**
 * Generate complete demo dataset with 30 sequences and 100 input vectors
 */
export declare function generateDemoDataset(): DemoDataset;
//# sourceMappingURL=data-generator.d.ts.map