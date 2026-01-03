import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import ReactFlow, { Node, Edge, Controls, Background } from 'reactflow';
import { SequenceGraph, VectorActivation } from '../types';
import 'reactflow/dist/style.css';

interface SequenceBlockNodeData {
  sequence: SequenceGraph;
  isExpanded: boolean;
  onToggle: () => void;
  heatmapData: VectorActivation[];
  isHeatmapEnabled: boolean;
}

/**
 * SequenceBlockNode - Collapsible sequence block that can show summary or full graph
 *
 * States:
 * - Collapsed: 150×100px summary (name, state, activation count, expand icon)
 * - Expanded: 600×400px with embedded ReactFlow showing full sequence graph
 */
const SequenceBlockNode: React.FC<NodeProps<SequenceBlockNodeData>> = ({ data }) => {
  const { sequence, isExpanded, onToggle, heatmapData } = data;

  // Calculate activation count for this sequence
  const activationCount = useMemo(() => {
    return heatmapData.filter(v => v.sequenceId === sequence.sequenceId).length;
  }, [heatmapData, sequence.sequenceId]);

  // Determine if sequence is active
  const isActive = sequence.stats.activeVectors > 0;

  // Build nodes and edges for expanded view
  const { nodes, edges } = useMemo(() => {
    if (!isExpanded) return { nodes: [], edges: [] };

    const flowNodes: Node[] = sequence.nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      position: {
        x: (index % 3) * 120 + 60,
        y: Math.floor(index / 3) * 100 + 80
      },
      data: {
        label: (
          <div style={{ textAlign: 'center', fontSize: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              {node.label}
            </div>
            {node.hasOutput && (
              <div style={{ color: '#f97316', fontSize: '8px' }}>
                {node.outputVectors.length} outputs
              </div>
            )}
          </div>
        )
      },
      style: {
        background: node.isActive ? '#22c55e' : node.isInitial ? '#3b82f6' : '#64748b',
        border: `2px solid ${node.hasOutput ? '#f97316' : 'transparent'}`,
        borderRadius: '50%',
        width: 60,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: '#fff',
        boxShadow: node.isActive ? '0 0 12px rgba(34, 197, 94, 0.6)' : 'none'
      }
    }));

    const flowEdges: Edge[] = sequence.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: sequence.nodes.find(n => n.id === edge.source)?.isActive || false,
      style: {
        stroke: sequence.nodes.find(n => n.id === edge.source)?.isActive ? '#22c55e' : '#64748b',
        strokeWidth: 2
      }
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [isExpanded, sequence]);

  if (isExpanded) {
    // Expanded State: 600×400px with embedded graph
    return (
      <div
        style={{
          width: '600px',
          height: '400px',
          background: '#0f172a',
          border: `3px solid ${isActive ? '#22c55e' : '#475569'}`,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: isActive
            ? '0 0 20px rgba(34, 197, 94, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '40px',
            background: '#1e293b',
            borderBottom: '2px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* State Indicator */}
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isActive ? '#22c55e' : '#64748b',
                boxShadow: isActive ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none'
              }}
            />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e2e8f0' }}>
              {sequence.sequenceName}
            </span>
            {activationCount > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#3b82f6',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '8px'
                }}
              >
                {activationCount} activations
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: '1'
            }}
            title="Collapse sequence"
          >
            ⊖
          </button>
        </div>

        {/* Embedded ReactFlow */}
        <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            panOnScroll={false}
            panOnDrag={true}
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls
              showZoom={false}
              showFitView={true}
              showInteractive={false}
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </ReactFlow>
        </div>
      </div>
    );
  }

  // Collapsed State: 150×100px summary
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: '150px',
        height: '100px',
        background: '#1e293b',
        border: isActive ? '3px solid #22c55e' : '2px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: isActive
          ? '0 0 16px rgba(34, 197, 94, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        transform: 'scale(1)',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = isActive
          ? '0 0 20px rgba(34, 197, 94, 0.6)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = isActive
          ? '0 0 16px rgba(34, 197, 94, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {sequence.sequenceName}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#94a3b8',
              marginTop: '4px'
            }}
          >
            {sequence.stats.totalVectors} vectors
          </div>
        </div>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isActive ? '#22c55e' : '#64748b',
            boxShadow: isActive ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
            flexShrink: 0
          }}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {activationCount > 0 && (
          <div
            style={{
              fontSize: '10px',
              background: '#3b82f6',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '6px'
            }}
          >
            {activationCount}× activated
          </div>
        )}
        <div
          style={{
            marginLeft: 'auto',
            fontSize: '16px',
            color: '#94a3b8',
            lineHeight: '1'
          }}
        >
          ⊕
        </div>
      </div>
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default memo(SequenceBlockNode, (prev, next) => {
  return (
    prev.data.isExpanded === next.data.isExpanded &&
    prev.data.sequence.sequenceId === next.data.sequence.sequenceId &&
    prev.data.sequence.stats.activeVectors === next.data.sequence.stats.activeVectors &&
    prev.data.heatmapData.length === next.data.heatmapData.length
  );
});
