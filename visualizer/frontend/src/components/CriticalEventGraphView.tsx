import React, { useEffect, useMemo, useState } from 'react';
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
  const { sequences, currentMachine, openSequenceEditor } = useVisualizerStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [legendHovered, setLegendHovered] = useState(false);

  // Helper function to format output vector for display
  const formatOutputVector = (vector: number[]): string => {
    if (vector.length <= 6) {
      return `[${vector.map(v => v.toFixed(2)).join(', ')}]`;
    }
    return `[${vector.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...${vector.slice(-2).map(v => v.toFixed(2)).join(', ')}]`;
  };

  // Get the selected sequence or all sequences
  // For machines or simple sequences (like NAND gates), always show all sequences together
  const displaySequences = useMemo(() => {
    // If there's a current machine, show all its sequences together
    if (currentMachine) {
      return sequences.filter(seq => currentMachine.sequenceIds.includes(seq.sequenceId));
    }

    // Check if all sequences are simple (single node each)
    const allSimpleSequences = sequences.every(seq => seq.nodes.length === 1);

    // If all sequences are simple, show them all together regardless of selection
    if (allSimpleSequences) {
      return sequences;
    }

    // For complex sequences, respect the selection
    if (selectedSequenceId) {
      return sequences.filter(s => s.sequenceId === selectedSequenceId);
    }
    return sequences;
  }, [sequences, selectedSequenceId, currentMachine]);

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
        const isActiveWithOutput = isActive && hasOutputs; // Final event matched with input

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

        // Special highlighting for active outputs (output being applied)
        if (isActiveWithOutput) {
          borderColor = '#fbbf24'; // Bright amber for active output
          borderWidth = 5;
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
                    fontSize: '8px',
                    color: isActiveWithOutput ? '#fde047' : '#fbbf24',
                    marginTop: '4px',
                    fontWeight: isActiveWithOutput ? 'bold' : 'normal',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {isActiveWithOutput && '⚡ OUTPUT: '}
                    {formatOutputVector(node.outputVectors[0].vector)}
                    {node.outputVectors.length > 1 && ` +${node.outputVectors.length - 1} more`}
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
            boxShadow: isActiveWithOutput
              ? `0 0 30px ${borderColor}, 0 0 60px ${borderColor}, 0 0 90px rgba(251, 191, 36, 0.5)`
              : isActive
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
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openSequenceEditor(sequence.sequenceId);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textAlign: 'center',
                  minWidth: '200px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Click to edit sequence"
              >
                {sequence.sequenceName || sequence.sequenceId}
                <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>⚙️</span>
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
          const isActiveWithOutput = isActive && hasOutputs; // Final event matched with input

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

          // Special highlighting for active outputs (output being applied)
          if (isActiveWithOutput) {
            borderColor = '#fbbf24'; // Bright amber for active output
            borderWidth = 5;
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
                <div style={{ textAlign: 'center', padding: '2px' }}>
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
                    color: isActive ? '#d1fae5' : '#94a3b8',
                    marginBottom: hasOutputs ? '2px' : '0'
                  }}>
                    {isInitial && '⭐ '}
                  </div>
                  {hasOutputs && (
                    <div style={{
                      fontSize: '7px',
                      color: isActiveWithOutput ? '#fde047' : '#fbbf24',
                      fontWeight: isActiveWithOutput ? 'bold' : 'normal',
                      maxWidth: '70px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {isActiveWithOutput && '⚡ '}
                      {formatOutputVector(node.outputVectors[0].vector)}
                    </div>
                  )}
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
              boxShadow: isActiveWithOutput
                ? `0 0 30px ${borderColor}, 0 0 60px ${borderColor}, 0 0 90px rgba(251, 191, 36, 0.5)`
                : isActive
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
            animated: false,
            style: {
              stroke: '#64748b',
              strokeWidth: isSourceActive ? 3 : 2
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#64748b',
              width: 20,
              height: 20
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
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
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

      {/* Slide-out Legend Panel */}
      <div
        onMouseEnter={() => setLegendHovered(true)}
        onMouseLeave={() => setLegendHovered(false)}
        style={{
          position: 'absolute',
          top: '50%',
          right: legendHovered ? '0' : '-260px',
          transform: 'translateY(-50%)',
          width: '280px',
          maxHeight: '80vh',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid #3b82f6',
          borderRight: 'none',
          borderTopLeftRadius: '12px',
          borderBottomLeftRadius: '12px',
          boxShadow: legendHovered ? '-5px 0 20px rgba(59, 130, 246, 0.3)' : 'none',
          transition: 'right 0.3s ease-out, box-shadow 0.3s ease-out',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Legend Tab Trigger */}
        <div style={{
          position: 'absolute',
          left: '-40px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '40px',
          height: '100px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #3b82f6',
          borderRight: 'none',
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: legendHovered ? '-3px 0 10px rgba(59, 130, 246, 0.2)' : 'none',
          transition: 'box-shadow 0.3s ease-out'
        }}>
          <div style={{
            transform: 'rotate(-90deg)',
            fontSize: '11px',
            fontWeight: '700',
            color: '#3b82f6',
            letterSpacing: '1px',
            whiteSpace: 'nowrap'
          }}>
            LEGEND
          </div>
        </div>

        {/* Legend Content */}
        <div style={{
          padding: '20px',
          color: '#fff',
          fontSize: '12px',
          overflowY: 'auto',
          flex: 1
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '15px', color: '#3b82f6' }}>
            Graph Legend
          </div>

          {/* Event Spaces Section */}
          <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Event Spaces
            </div>

            <div style={{ marginBottom: '10px', paddingLeft: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  border: '2px solid #2563eb',
                  marginRight: '8px',
                  flexShrink: 0
                }} />
                <span style={{ fontWeight: '600' }}>Input Event Space</span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '24px' }}>
                Initial events where inputs enter the system
              </div>
            </div>

            <div style={{ paddingLeft: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#64748b',
                  border: '4px solid #f59e0b',
                  marginRight: '8px',
                  flexShrink: 0
                }} />
                <span style={{ fontWeight: '600' }}>Output Event Space</span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '24px' }}>
                Events that emit outputs from the system
              </div>
            </div>
          </div>

          {/* Event States Section */}
          <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Event States
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#22c55e',
                border: '2px solid #16a34a',
                marginRight: '8px',
                boxShadow: '0 0 10px #22c55e',
                flexShrink: 0
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
                marginRight: '8px',
                flexShrink: 0
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
                marginRight: '8px',
                flexShrink: 0
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
                marginRight: '8px',
                flexShrink: 0
              }} />
              <span>Has Outputs</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#22c55e',
                border: '5px solid #fbbf24',
                marginRight: '8px',
                boxShadow: '0 0 15px #fbbf24',
                flexShrink: 0
              }} />
              <div>
                <div style={{ fontWeight: '600' }}>⚡ Active Output</div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>Output being applied</div>
              </div>
            </div>
          </div>

          {/* Output Vectors Section */}
          <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Output Vectors
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#e2e8f0', marginBottom: '4px' }}>
                Events with outputs display their output vectors below the event name.
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                Format: [v1, v2, v3, ...]
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#fde047', fontWeight: 'bold', marginBottom: '2px' }}>
                ⚡ OUTPUT: [...]
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                When an active final event matches the input, the output vector is highlighted and will be applied to the machine output stream.
              </div>
            </div>
          </div>

          {/* Transitions Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Transitions
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ marginRight: '8px', fontSize: '16px' }}>→</span>
              <span>Transition</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px', fontSize: '16px' }}>⇒</span>
              <span>Active Transition (thicker)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hide ReactFlow attribution */}
      <style>{`
        .react-flow__attribution {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default CriticalEventGraphView;
