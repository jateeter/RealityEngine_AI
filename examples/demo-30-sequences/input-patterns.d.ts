import { OutputType } from './output-definitions.js';
export interface InputVectorMetadata {
    index: number;
    type: 'normal' | 'warning' | 'critical' | 'emergency' | 'optimization' | 'maintenance' | 'anomaly';
    pattern: string;
    description: string;
    expectedOutputs?: OutputType[];
}
export interface LabeledInputVector {
    vector: number[];
    metadata: InputVectorMetadata;
}
/**
 * Generate 100 input vectors with diverse patterns
 * Distribution: 30 normal, 25 warning, 15 critical, 10 optimization, 10 maintenance, 5 emergency, 5 anomaly
 */
export declare function generateInputVectors(): LabeledInputVector[];
/**
 * Get color for input vector type (for timeline visualization)
 */
export declare function getInputVectorColor(type: string): string;
//# sourceMappingURL=input-patterns.d.ts.map