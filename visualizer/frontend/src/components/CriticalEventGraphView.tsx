import React, { useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position
} from 'react-flow-renderer';
import { useVisualizerStore } from '../store';

interface CriticalEventGraphViewProps {
  selectedSequenceId?: string | null;
}

const CriticalEventGraphView: React.FC<CriticalEventGraphViewProps> = ({ selectedSequenceId }) => {
  const { sequences } = useVisualizerStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Get the selected sequence or all sequences
  const displaySequences = useMemo(() => {
    if (selectedSequenceId) {
      return sequences.filter(s => s.sequenceId === selectedSequenceId);
    }
    return sequences;
  }, [sequences, selectedSequenceId]);

  // Build graph data
  useEffect(() => {
    if (displaySequences.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Check if all sequences are simple (single initial event each)
    const allSimpleSequences = displaySequences.every(seq => seq.nodes.length === 1);

    if (allSimpleSequences) {
      // Unified graph layout for simple sequences (like NAND gates)
      const gridCols = Math.ceil(Math.sqrt(displaySequences.length));

      displaySequences.forEach((sequence, seqIndex) => {
        const node = sequence.nodes[0];
        if (!node) return;

        const col = seqIndex % gridCols;
        const row = Math.floor(seqIndex / gridCols);
        const x = 200 + col * 300;
        const y = 150 + row * 200;

        const isActive = node.isActive;
        const isInitial = node.isInitial || false;
        const hasOutputs = node.outputVectors && node.outputVectors.length > 0;

        let nodeColor = '#64748b';
        let borderColor = '#475569';
        let borderWidth = 2;

        if (isActive) {
          nodeColor = '#22c55e';
          borderColor = '#16a34a';
        } else if (isInitial) {
          nodeColor = '#3b82f6';
          borderColor = '#2563eb';
        }

        if (hasOutputs) {
          borderWidth = 4;
          borderColor = '#f59e0b';
        }

        newNodes.push({
          id: node.id,
          type: 'default',
          position: { x, y },
          data: {
            label: (
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: '12px',
                  marginBottom: '6px',
                  color: isActive ? '#fff' : '#e2e8f0'
                }}>
                  {sequence.sequenceName || `Event ${seqIndex + 1}`}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: isActive ? '#d1fae5' : '#94a3b8',
                  marginBottom: '4px'
                }}>
                  {isInitial && '⭐ Initial Event'}
                </div>
                {hasOutputs && (
                  <div style={{
                    fontSize: '9px',
                    color: '#fbbf24',
                    marginTop: '4px'
                  }}>
                    {node.outputVectors.length} output{node.outputVectors.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          },
          style: {
            background: nodeColor,
            border: `${borderWidth}px solid ${borderColor}`,
            borderRadius: '12px',
            width: 180,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '11px',
            padding: '12px',
            boxShadow: isActive
              ? `0 0 20px ${nodeColor}, 0 0 40px ${nodeColor}`
              : '0 4px 6px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease'
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left
        });
      });
    } else {
      // Multi-sequence layout for complex sequences
      let yOffset = 0;

      displaySequences.forEach((sequence, seqIndex) => {
        const xOffset = seqIndex * 400;

        // Add sequence label node
        newNodes.push({
          id: `seq-label-${sequence.sequenceId}`,
          type: 'default',
          position: { x: xOffset + 100, y: yOffset },
          data: {
            label: (
              <div style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'center',
                minWidth: '200px'
              }}>
                {sequence.sequenceName || sequence.sequenceId}
              </div>
            )
          },
          draggable: false,
          selectable: false,
          style: {
            background: 'transparent',
            border: 'none'
          }
        });

        yOffset += 80;

        // Process each node in the sequence
        sequence.nodes.forEach((node, nodeIndex) => {
          const isActive = node.isActive;
          const isInitial = node.isInitial || false;
          const hasOutputs = node.outputVectors && node.outputVectors.length > 0;

          // Determine node color based on state
          let nodeColor = '#64748b'; // Default gray
          let borderColor = '#475569';
          let borderWidth = 2;

          if (isActive) {
            nodeColor = '#22c55e'; // Active = green
            borderColor = '#16a34a';
          } else if (isInitial) {
            nodeColor = '#3b82f6'; // Initial = blue
            borderColor = '#2563eb';
          }

          // Bold outline for output events
          if (hasOutputs) {
            borderWidth = 4;
            borderColor = '#f59e0b'; // Orange border for outputs
          }

          // Calculate position
          const x = xOffset + (nodeIndex % 3) * 120;
          const y = yOffset + Math.floor(nodeIndex / 3) * 120;

          newNodes.push({
            id: node.id,
            type: 'default',
            position: { x, y },
            data: {
              label: (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '11px',
                    marginBottom: '4px',
                    color: isActive ? '#fff' : '#e2e8f0'
                  }}>
                    {node.metadata?.name || `Event ${nodeIndex + 1}`}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    color: isActive ? '#d1fae5' : '#94a3b8'
                  }}>
                    {isInitial && '⭐ '}
                    {hasOutputs && `${node.outputVectors.length} outputs`}
                  </div>
                </div>
              )
            },
            style: {
              background: nodeColor,
              border: `${borderWidth}px solid ${borderColor}`,
              borderRadius: '50%',
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '10px',
              padding: '8px',
              boxShadow: isActive
                ? `0 0 20px ${nodeColor}, 0 0 40px ${nodeColor}`
                : '0 4px 6px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s ease'
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left
          });

        });

        // Add edges from sequence edges
        sequence.edges.forEach(edge => {
          const sourceNode = sequence.nodes.find(n => n.id === edge.source);
          const isSourceActive = sourceNode?.isActive || false;

          newEdges.push({
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: 'smoothstep',
            animated: isSourceActive,
            style: {
              stroke: isSourceActive ? '#22c55e' : '#64748b',
              strokeWidth: isSourceActive ? 3 : 2
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isSourceActive ? '#22c55e' : '#64748b',
              width: 20,
              height: 20
            },
            label: isSourceActive ? '⚡' : undefined,
            labelStyle: {
              fontSize: 16
            }
          });
        });

        yOffset += Math.ceil(sequence.nodes.length / 3) * 120 + 100;
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [displaySequences, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
        style={{ background: '#0a0a0a' }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false
        }}
      >
        <Background color="#1a1a1a" gap={16} />
        <Controls
          style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px'
          }}
        />
        <MiniMap
          nodeColor={(node: Node) => {
            const style = node.style as any;
            return style?.background || '#64748b';
          }}
          style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px'
          }}
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
        fontSize: '12px',
        minWidth: '200px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
          Legend
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #16a34a',
            marginRight: '8px',
            boxShadow: '0 0 10px #22c55e'
          }} />
          <span>Active Event</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#3b82f6',
            border: '2px solid #2563eb',
            marginRight: '8px'
          }} />
          <span>Initial Event</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#64748b',
            border: '2px solid #475569',
            marginRight: '8px'
          }} />
          <span>Inactive Event</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#64748b',
            border: '4px solid #f59e0b',
            marginRight: '8px'
          }} />
          <span>Has Outputs</span>
        </div>

        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ marginRight: '8px', fontSize: '16px' }}>→</span>
            <span>Transition</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', fontSize: '16px', color: '#22c55e' }}>⚡</span>
            <span>Active Transition</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriticalEventGraphView;
