import React from 'react';

export default function LoadingOverlay({ error }) {
  if (error) {
    return (
      <div className="loading-overlay">
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{error}</div>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: '8px 20px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">Loading developer data...</div>
    </div>
  );
}
