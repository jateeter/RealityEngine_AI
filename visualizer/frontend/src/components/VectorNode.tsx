import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

interface VectorNodeData {
  label: string;
  isInitial: boolean;
  isActive: boolean;
  hasOutput: boolean;
  elements: any[];
  metadata: Record<string, any>;
  outputVectors: any[];
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
    outputVectors
  } = data;

  // Determine node styling based on state
  const getNodeStyle = () => {
    let borderColor = '#444';
    let backgroundColor = '#1a1a1a';
    let glowColor = 'transparent';

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
      boxShadow: isActive
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
