import React, { useState } from 'react';
import { Machine } from '../types';

interface MachineCardProps {
  machine: Machine;
  onSelect: (machineId: string) => void;
  onEdit: (machine: Machine) => void;
  onDelete: (machineId: string) => void;
}

const MachineCard: React.FC<MachineCardProps> = ({ machine, onSelect, onEdit, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatLastAccessed = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      onClick={() => onSelect(machine.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      style={{
        width: '300px',
        height: '200px',
        background: '#1a1a1a',
        border: isHovered ? '2px solid #3b82f6' : '1px solid #333',
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 8px 24px rgba(59, 130, 246, 0.15)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              marginRight: '8px'
            }}
          >
            {machine.name}
          </h3>
          {machine.isExample && (
            <span
              style={{
                background: '#3b82f6',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '600',
                flexShrink: 0
              }}
            >
              Example
            </span>
          )}
        </div>

        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            color: '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4',
            minHeight: '36px'
          }}
        >
          {machine.description || 'No description available'}
        </p>
      </div>

      {/* Stats */}
      <div>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Sequences</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0' }}>
              {machine.sequenceCount}
            </span>
          </div>
          <div
            style={{
              width: '1px',
              background: '#333'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Vectors</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0' }}>
              {machine.totalVectors}
            </span>
          </div>
        </div>

        {/* Last Accessed */}
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Last accessed: <span style={{ color: '#94a3b8' }}>{formatLastAccessed(machine.lastAccessedAt)}</span>
        </div>
      </div>

      {/* Action Buttons (shown on hover) */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            gap: '6px'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(machine);
            }}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#94a3b8',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.color = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Edit
          </button>
          {!machine.isExample && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete "${machine.name}"?`)) {
                  onDelete(machine.id);
                }
              }}
              style={{
                background: '#7f1d1d',
                border: '1px solid #991b1b',
                borderRadius: '6px',
                color: '#fecaca',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#991b1b';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#7f1d1d';
                e.currentTarget.style.color = '#fecaca';
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MachineCard;
