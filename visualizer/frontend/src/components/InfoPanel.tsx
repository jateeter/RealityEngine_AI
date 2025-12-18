import React from 'react';
import { VectorNode } from '../types';

interface InfoPanelProps {
  node: VectorNode | null;
  onClose: () => void;
}

export default function InfoPanel({ node, onClose }: InfoPanelProps) {
  if (!node) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '350px',
        maxHeight: '80vh',
        background: 'rgba(0, 0, 0, 0.95)',
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1a1a1a'
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Vector Details</h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Basic info */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Label</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{node.label}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>ID</div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
            {node.id}
          </div>
        </div>

        {/* Status badges */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {node.isInitial && (
            <span
              style={{
                fontSize: '11px',
                background: '#3b82f6',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              INITIAL
            </span>
          )}
          {node.isActive && (
            <span
              style={{
                fontSize: '11px',
                background: '#22c55e',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              ACTIVE
            </span>
          )}
          {node.hasOutput && (
            <span
              style={{
                fontSize: '11px',
                background: '#a855f7',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              HAS OUTPUT
            </span>
          )}
        </div>

        {/* Vector elements */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
            Vector Elements ({node.elements.length}D)
          </div>
          <div
            style={{
              background: '#0a0a0a',
              border: '1px solid #222',
              borderRadius: '6px',
              padding: '12px'
            }}
          >
            {node.elements.map((element, index) => (
              <div
                key={index}
                style={{
                  marginBottom: index < node.elements.length - 1 ? '12px' : '0',
                  paddingBottom: index < node.elements.length - 1 ? '12px' : '0',
                  borderBottom: index < node.elements.length - 1 ? '1px solid #222' : 'none'
                }}
              >
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                  Element {index}
                </div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: '#888' }}>Value:</span>{' '}
                  <span style={{ color: '#3b82f6', fontFamily: 'monospace' }}>
                    {element.value.toFixed(3)}
                  </span>
                </div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: '#888' }}>Comparator:</span>{' '}
                  <span style={{ color: '#8b5cf6' }}>{element.comparatorType}</span>
                </div>
                {element.threshold !== undefined && (
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ color: '#888' }}>Threshold:</span>{' '}
                    <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>
                      {element.threshold.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Output vectors */}
        {node.outputVectors.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
              Output Vectors ({node.outputVectors.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {node.outputVectors.map((output, index) => (
                <div
                  key={index}
                  style={{
                    background: '#0a0a0a',
                    border: '1px solid #222',
                    borderRadius: '6px',
                    padding: '12px'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#a855f7', marginBottom: '6px' }}>
                    {output.id}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                    [{output.vector.map((v) => v.toFixed(2)).join(', ')}]
                  </div>
                  {output.metadata && (
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                      {JSON.stringify(output.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
              Metadata
            </div>
            <div
              style={{
                background: '#0a0a0a',
                border: '1px solid #222',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#64748b',
                overflowX: 'auto'
              }}
            >
              <pre style={{ margin: 0 }}>{JSON.stringify(node.metadata, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
