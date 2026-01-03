import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  ReactFlowProvider,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Machine, SequenceGraph } from '../types';
import { useVisualizerStore } from '../store';
import MachineContainerNode from './MachineContainerNode';
import SequenceBlockNode from './SequenceBlockNode';
import InputOutputPanel from './InputOutputPanel';
import InputTimeline from './InputTimeline';

interface MachineViewProps {
  machine: Machine | null;
  sequences: SequenceGraph[];
}

// Custom node types
const nodeTypes = {
  machineContainer: MachineContainerNode,
  sequenceBlock: SequenceBlockNode
};

/**
 * MachineView - Top-level machine visualization showing N sequences with I/O streams
 *
 * Features:
 * - Machine container with input/output ports
 * - Grid layout of collapsible sequence blocks
 * - Input timeline integration
 * - I/O panels showing current vectors
 * - Expand/collapse interactions
 */
export const MachineView: React.FC<MachineViewProps> = ({ machine, sequences }) => {
  const {
    expandedSequenceIds,
    toggleSequenceExpansion,
    heatmapData,
    isHeatmapEnabled,
    simulationState,
    inputVectors,
    currentOutputVectors
  } = useVisualizerStore();

  // Calculate grid layout for sequence blocks
  const { nodes, edges } = useMemo(() => {
    if (!machine || sequences.length === 0) {
      return { nodes: [], edges: [] };
    }

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Add machine container node
    flowNodes.push({
      id: 'machine-container',
      type: 'machineContainer',
      position: { x: 200, y: 50 },
      data: {
        machine,
        isActive: (simulationState?.status === 'playing') || false
      },
      draggable: false,
      selectable: false
    });

    // Calculate grid layout for sequences
    const sequenceCount = sequences.length;
    const cols = Math.ceil(Math.sqrt(sequenceCount));

    sequences.forEach((seq, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const isExpanded = expandedSequenceIds.has(seq.sequenceId);

      // Dynamic spacing based on expansion state
      const baseSpacing = 180;
      const expandedSpacing = 630;
      const spacing = isExpanded ? expandedSpacing : baseSpacing;

      // Position within machine container
      // Container is at (200, 50) with size 1400×900
      // Available space starts at (200+20, 50+120) = (220, 170)
      const xOffset = 220 + 100; // Machine X + left padding + initial offset
      const yOffset = 170 + 100; // Machine Y + header space + initial offset

      flowNodes.push({
        id: `sequence-${seq.sequenceId}`,
        type: 'sequenceBlock',
        position: {
          x: xOffset + col * spacing,
          y: yOffset + row * spacing
        },
        data: {
          sequence: seq,
          isExpanded,
          onToggle: () => toggleSequenceExpansion(seq.sequenceId),
          heatmapData,
          isHeatmapEnabled
        },
        draggable: false,
        selectable: true
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    machine,
    sequences,
    expandedSequenceIds,
    toggleSequenceExpansion,
    heatmapData,
    isHeatmapEnabled,
    simulationState
  ]);

  // Get current input vector
  const currentInputVector = useMemo(() => {
    if (!simulationState || !inputVectors.length) return null;
    const index = simulationState.currentIndex;
    return inputVectors[index - 1] || null; // -1 because currentIndex is 1-based after stepping
  }, [simulationState, inputVectors]);

  // Handle keyboard shortcuts
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === 'e' || event.key === 'E') {
      const { expandAllSequences } = useVisualizerStore.getState();
      expandAllSequences();
    } else if (event.key === 'c' || event.key === 'C') {
      const { collapseAllSequences } = useVisualizerStore.getState();
      collapseAllSequences();
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  if (!machine) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '16px'
        }}
      >
        No machine loaded. Select a machine to view.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
      {/* Input Timeline at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '80px',
          zIndex: 50,
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '2px solid #1e293b',
          padding: '8px 16px'
        }}
      >
        <InputTimeline />
      </div>

      {/* Main ReactFlow visualization */}
      <div style={{ width: '100%', height: '100%', paddingTop: '80px' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
              minZoom: 0.3,
              maxZoom: 1
            }}
            attributionPosition="bottom-right"
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            zoomOnScroll={true}
            panOnScroll={true}
            panOnDrag={true}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#64748b'
              }
            }}
          >
            <Background color="#1e293b" gap={32} size={2} />
            <Controls
              showZoom={true}
              showFitView={true}
              showInteractive={false}
              style={{
                background: '#1e293b',
                border: '2px solid #334155',
                borderRadius: '8px'
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Input/Output Panels */}
      <InputOutputPanel
        inputVector={currentInputVector}
        outputVectors={[]}
        currentIndex={simulationState?.currentIndex || 0}
        side="left"
      />

      <InputOutputPanel
        inputVector={null}
        outputVectors={currentOutputVectors}
        currentIndex={0}
        side="right"
      />

      {/* Keyboard shortcuts hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid #334155',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '12px',
          color: '#94a3b8',
          zIndex: 10,
          display: 'flex',
          gap: '16px'
        }}
      >
        <span>
          <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569' }}>E</kbd>
          {' '}Expand All
        </span>
        <span>
          <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569' }}>C</kbd>
          {' '}Collapse All
        </span>
        <span>
          <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569' }}>Scroll</kbd>
          {' '}Zoom
        </span>
      </div>
    </div>
  );
};

export default MachineView;
