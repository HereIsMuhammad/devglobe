'use client';

import React from 'react';

export default function ClaimStatusModal({ onClose }) {
  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div
        className="claim-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-status-title"
        onClick={event => event.stopPropagation()}
      >
        <button className="card-modal__close" onClick={onClose} aria-label="Close">&times;</button>
        <div className="claim-status-modal__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h2 id="claim-status-title">Profile claimed and pending review</h2>
        <p>Your profile is still being reviewed. We&apos;ll email you when it is approved and visible on the globe, usually within a week.</p>
        <p>Your identity card will be available after approval.</p>
        <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}