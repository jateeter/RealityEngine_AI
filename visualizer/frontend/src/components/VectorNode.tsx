import { memo } from 'react';
import { Handle, Position } from 'reactflow';

interface VectorNodeData {
  label: string;
  isInitial: boolean;
  isActive: boolean;
  hasOutput: boolean;
  elements: any[];
  metadata: Record<string, any>;
  outputVectors: any[];
  heatmapCount?: number;
  heatmapMax?: number;
  isHeatmapEnabled?: boolean;
}

interface VectorNodeProps {
  data: VectorNodeData;
  selected: boolean;
}

function VectorNode({ data, selected }: VectorNodeProps) {
  const {
    label,
    isInitial,
    isActive,
    hasOutput,
    elements,
    metadata,
    outputVectors,
    heatmapCount = 0,
    heatmapMax = 1,
    isHeatmapEnabled = false
  } = data;

  // Calculate heatmap intensity (0-1)
  const getHeatmapIntensity = (): number => {
    if (!isHeatmapEnabled || heatmapCount === 0 || heatmapMax === 0) {
      return 0;
    }
    return Math.min(heatmapCount / heatmapMax, 1);
  };

  // Get heatmap color based on intensity
  const getHeatmapColor = (intensity: number): string => {
    if (intensity === 0) return 'transparent';

    // Blue → Green → Yellow → Red gradient
    if (intensity < 0.25) {
      // Blue to Cyan
      const t = intensity / 0.25;
      return `rgba(59, 130, 246, ${0.3 + t * 0.3})`;
    } else if (intensity < 0.5) {
      // Cyan to Green
      const t = (intensity - 0.25) / 0.25;
      return `rgba(34, 197, 94, ${0.4 + t * 0.3})`;
    } else if (intensity < 0.75) {
      // Green to Yellow
      const t = (intensity - 0.5) / 0.25;
      return `rgba(234, 179, 8, ${0.5 + t * 0.3})`;
    } else {
      // Yellow to Red
      const t = (intensity - 0.75) / 0.25;
      return `rgba(239, 68, 68, ${0.6 + t * 0.4})`;
    }
  };

  // Determine node styling based on state
  const getNodeStyle = () => {
    let borderColor = '#444';
    let backgroundColor = '#1a1a1a';
    let glowColor = 'transparent';

    // Apply heatmap styling if enabled
    if (isHeatmapEnabled && heatmapCount > 0) {
      const intensity = getHeatmapIntensity();
      const heatColor = getHeatmapColor(intensity);
      backgroundColor = heatColor;

      // Add subtle glow for high activation
      if (intensity > 0.5) {
        glowColor = heatColor;
      }
    }

    if (isActive) {
      borderColor = '#22c55e'; // green
      glowColor = '#22c55e';
    }

    if (isInitial) {
      borderColor = '#3b82f6'; // blue
      if (isActive) {
        glowColor = '#3b82f6';
      }
    }

    if (selected) {
      borderColor = '#f59e0b'; // amber
      glowColor = '#f59e0b';
    }

    return {
      background: backgroundColor,
      border: `2px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '12px 16px',
      minWidth: '120px',
      boxShadow: isActive || (isHeatmapEnabled && heatmapCount > 0 && getHeatmapIntensity() > 0.5)
        ? `0 0 20px ${glowColor}44, 0 0 40px ${glowColor}22`
        : '0 2px 8px rgba(0, 0, 0, 0.5)',
      transition: 'all 0.3s ease',
      position: 'relative' as const
    };
  };

  return (
    <div style={getNodeStyle()}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: isActive ? '#22c55e' : '#555',
          width: '10px',
          height: '10px',
          border: '2px solid #1a1a1a'
        }}
      />

      {/* Node header */}
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: isActive ? '#22c55e' : '#fff',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {label}
          {isInitial && (
            <span
              style={{
                fontSize: '10px',
                background: '#3b82f6',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              INIT
            </span>
          )}
        </div>

        {/* Active indicator */}
        {isActive && (
          <div
            style={{
              fontSize: '10px',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse 2s infinite'
              }}
            />
            ACTIVE
          </div>
        )}
      </div>

      {/* Vector elements */}
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
        Dimensions: {elements.length}
      </div>

      {/* Output indicator */}
      {hasOutput && (
        <div
          style={{
            fontSize: '10px',
            color: '#a855f7',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '6px'
          }}
        >
          <span style={{ fontSize: '14px' }}>⚡</span>
          {outputVectors.length} output{outputVectors.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Metadata indicator */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div
          style={{
            fontSize: '10px',
            color: '#64748b',
            marginTop: '4px'
          }}
        >
          + metadata
        </div>
      )}

      {/* Heatmap activation count */}
      {isHeatmapEnabled && heatmapCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#1a1a1a',
            border: '2px solid #fff',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}
          title={`Activated ${heatmapCount} time${heatmapCount !== 1 ? 's' : ''}`}
        >
          {heatmapCount}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isActive ? '#22c55e' : '#555',
          width: '10px',
          height: '10px',
          border: '2px solid #1a1a1a'
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

export default memo(VectorNode);
