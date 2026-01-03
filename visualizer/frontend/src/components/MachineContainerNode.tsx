import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Machine } from '../types';

interface MachineContainerNodeData {
  machine: Machine;
  isActive: boolean;
}

/**
 * MachineContainerNode - Custom ReactFlow node representing the machine boundary
 *
 * Visual specifications:
 * - 1400×900px bordered container
 * - Gradient purple border (#6366f1 → #8b5cf6)
 * - Semi-transparent background
 * - Input port (left) and output port (right)
 */
export const MachineContainerNode: React.FC<NodeProps<MachineContainerNodeData>> = ({ data }) => {
  const { machine, isActive } = data;

  return (
    <div
      style={{
        width: '1400px',
        height: '900px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '4px solid transparent',
        backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), linear-gradient(135deg, #6366f1, #8b5cf6)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        borderRadius: '24px',
        boxShadow: isActive
          ? '0 0 40px rgba(99, 102, 241, 0.5), 0 0 80px rgba(139, 92, 246, 0.3)'
          : '0 0 40px rgba(99, 102, 241, 0.3)',
        position: 'relative',
        overflow: 'visible',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Machine Header */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 10
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #a78bfa, #c4b5fd)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            padding: 0
          }}
        >
          {machine.name}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#94a3b8',
            margin: '8px 0 0 0',
            maxWidth: '600px'
          }}
        >
          {machine.description}
        </p>
        <div
          style={{
            marginTop: '8px',
            display: 'inline-block',
            background: '#3b82f6',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          {machine.sequenceCount} sequences • {machine.totalVectors} vectors
        </div>
      </div>

      {/* Input Port (Left) */}
      <div
        style={{
          position: 'absolute',
          left: '-100px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '3px solid #3b82f6',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            fontSize: '24px',
            fontWeight: 'bold',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
          }}
        >
          ⬇
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#3b82f6',
            letterSpacing: '1px'
          }}
        >
          INPUT
        </div>
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{
            width: '16px',
            height: '16px',
            background: '#3b82f6',
            border: '2px solid #1e40af',
            left: '22px',
            top: '30px'
          }}
        />
      </div>

      {/* Output Port (Right) */}
      <div
        style={{
          position: 'absolute',
          right: '-100px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '3px solid #a855f7',
            background: 'rgba(168, 85, 247, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a855f7',
            fontSize: '24px',
            fontWeight: 'bold',
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)'
          }}
        >
          ⬆
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#a855f7',
            letterSpacing: '1px'
          }}
        >
          OUTPUT
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            width: '16px',
            height: '16px',
            background: '#a855f7',
            border: '2px solid #7e22ce',
            right: '22px',
            top: '30px'
          }}
        />
      </div>

      {/* Content Area - where sequences will be positioned */}
      <div
        style={{
          position: 'absolute',
          top: '120px',
          left: '20px',
          right: '20px',
          bottom: '20px',
          pointerEvents: 'none' // Allow clicking through to sequences
        }}
      />
    </div>
  );
};

export default MachineContainerNode;
