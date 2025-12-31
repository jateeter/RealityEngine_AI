import React from 'react';

interface ViewToggleProps {
  view: 'list' | 'graph';
  onViewChange: (view: 'list' | 'graph') => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ view, onViewChange }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      background: '#1a1a1a',
      padding: '4px',
      borderRadius: '8px',
      border: '1px solid #333'
    }}>
      <button
        onClick={() => onViewChange('list')}
        style={{
          padding: '8px 16px',
          background: view === 'list'
            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            : 'transparent',
          color: view === 'list' ? '#fff' : '#888',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: view === 'list' ? 'bold' : 'normal',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
        onMouseEnter={(e) => {
          if (view !== 'list') {
            e.currentTarget.style.background = '#2a2a2a';
          }
        }}
        onMouseLeave={(e) => {
          if (view !== 'list') {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <span>📋</span>
        <span>List View</span>
      </button>

      <button
        onClick={() => onViewChange('graph')}
        style={{
          padding: '8px 16px',
          background: view === 'graph'
            ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
            : 'transparent',
          color: view === 'graph' ? '#fff' : '#888',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: view === 'graph' ? 'bold' : 'normal',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
        onMouseEnter={(e) => {
          if (view !== 'graph') {
            e.currentTarget.style.background = '#2a2a2a';
          }
        }}
        onMouseLeave={(e) => {
          if (view !== 'graph') {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <span>🔵</span>
        <span>Graph View</span>
      </button>
    </div>
  );
};

export default ViewToggle;
