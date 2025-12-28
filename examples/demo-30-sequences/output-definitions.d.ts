import { OutputVector } from '../../dist/models/types.js';
export declare enum OutputType {
    NORMAL_OPERATION = "NORMAL_OPERATION",
    WARNING_ALERT = "WARNING_ALERT",
    CRITICAL_ALERT = "CRITICAL_ALERT",
    EMERGENCY = "EMERGENCY",
    OPTIMIZATION_TRIGGER = "OPTIMIZATION_TRIGGER",
    MAINTENANCE_REQUIRED = "MAINTENANCE_REQUIRED",
    EFFICIENCY_BOOST = "EFFICIENCY_BOOST",
    RESOURCE_SHORTAGE = "RESOURCE_SHORTAGE",
    ANOMALY_DETECTED = "ANOMALY_DETECTED",
    SYSTEM_HEALTHY = "SYSTEM_HEALTHY"
}
export declare const OUTPUT_DEFINITIONS: Record<OutputType, {
    vector: number[];
    description: string;
    severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
    color: string;
}>;
/**
 * Create an output vector with proper metadata
 */
export declare function createOutputVector(type: OutputType, sequenceId: string, additionalMetadata?: Record<string, any>): OutputVector;
/**
 * Get all output types for a given severity level
 */
export declare function getOutputTypesBySeverity(severity: 'info' | 'success' | 'warning' | 'error' | 'critical'): OutputType[];
/**
 * Get output type by vector similarity
 */
export declare function getOutputTypeByVector(vector: number[]): OutputType | null;
//# sourceMappingURL=output-definitions.d.ts.map