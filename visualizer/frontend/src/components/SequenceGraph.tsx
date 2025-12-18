import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SequenceGraph as SequenceGraphType } from '../types';
import VectorNode from './VectorNode';

interface SequenceGraphProps {
  sequence: SequenceGraphType;
  onNodeClick?: (nodeId: string) => void;
}

const nodeTypes = {
  vectorNode: VectorNode
};

function SequenceGraphInner({ sequence, onNodeClick }: SequenceGraphProps) {
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert sequence data to ReactFlow format
  useEffect(() => {
    const flowNodes: Node[] = sequence.nodes.map((node, index) => {
      const angle = (index / sequence.nodes.length) * 2 * Math.PI;
      const radius = Math.max(250, sequence.nodes.length * 50);

      return {
        id: node.id,
        type: 'vectorNode',
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        },
        data: {
          label: node.label,
          isInitial: node.isInitial,
          isActive: node.isActive,
          hasOutput: node.hasOutput,
          elements: node.elements,
          metadata: node.metadata,
          outputVectors: node.outputVectors
        }
      };
    });

    const flowEdges: Edge[] = sequence.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4ade80', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4ade80',
        width: 20,
        height: 20
      }
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);

    // Fit view after a short delay to ensure layout is complete
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  }, [sequence, setNodes, setEdges, fitView]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case '+':
        case '=':
          zoomIn({ duration: 300 });
          break;
        case '-':
        case '_':
          zoomOut({ duration: 300 });
          break;
        case 'f':
        case 'F':
          fitView({ padding: 0.2, duration: 800 });
          break;
        case 'c':
        case 'C':
          setCenter(0, 0, { zoom: 1, duration: 800 });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setCenter(0, -100, { zoom: undefined, duration: 300 });
          break;
        case 'ArrowDown':
          event.preventDefault();
          setCenter(0, 100, { zoom: undefined, duration: 300 });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setCenter(-100, 0, { zoom: undefined, duration: 300 });
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCenter(100, 0, { zoom: undefined, duration: 300 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, fitView, setCenter]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#4ade80', strokeWidth: 2 }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#222" />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid #333',
            borderRadius: '8px'
          }}
        />
      </ReactFlow>

      {/* Keyboard shortcuts help */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #333',
          fontSize: '12px',
          color: '#888'
        }}
      >
        <div><strong style={{ color: '#fff' }}>Keyboard Controls:</strong></div>
        <div>+/- : Zoom in/out</div>
        <div>F : Fit view</div>
        <div>C : Center</div>
        <div>Arrow keys : Pan</div>
      </div>
    </div>
  );
}

export default function SequenceGraph(props: SequenceGraphProps) {
  return (
    <ReactFlowProvider>
      <SequenceGraphInner {...props} />
    </ReactFlowProvider>
  );
}
