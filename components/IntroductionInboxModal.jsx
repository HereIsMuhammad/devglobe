'use client';

import { useEffect, useState } from 'react';
import { getIntroductionLifecycle } from '../lib/agent-network.js';

export default function IntroductionInboxModal({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/introductions', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load agent requests');
        if (!cancelled) setRequests(data.requests);
      })
      .catch(loadError => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const decide = async (id, status) => {
    setUpdatingId(id);
    setError('');
    try {
      const response = await fetch('/api/introductions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update request');
      setRequests(current => current.map(item => item.id === id
        ? { ...item, status: data.request.status, respondedAt: data.request.respondedAt }
        : item));
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const displayStatus = request => request.status === 'pending' && request.expiresAt <= new Date().toISOString()
    ? 'expired'
    : request.status;

  return (
    <div className="introduction-inbox__backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="introduction-inbox" role="dialog" aria-modal="true" aria-labelledby="introduction-inbox-title">
        <button type="button" className="introduction-inbox__close" onClick={onClose} aria-label="Close agent requests">&times;</button>
        <span className="introduction-inbox__eyebrow">CONSENT INBOX</span>
        <h2 id="introduction-inbox-title">Agent requests</h2>
        <p className="introduction-inbox__intro">Review verified-agent introduction requests. Acceptance shares only your public GitHub profile.</p>

        {loading && <p className="introduction-inbox__empty">Loading requests...</p>}
        {!loading && requests.length === 0 && !error && <p className="introduction-inbox__empty">No agent requests yet.</p>}
        {error && <p className="introduction-inbox__error">{error}</p>}

        <div className="introduction-inbox__list">
          {requests.map(request => {
            const status = displayStatus(request);
            return (
              <article className="introduction-request" key={request.id}>
                <header>
                  <div>
                    <strong>{request.requesterAgent.name}</strong>
                    <span>{request.requesterAgent.owner}</span>
                  </div>
                  <small className={`introduction-request__status introduction-request__status--${status}`}>{status}</small>
                </header>
                <ol className="introduction-request__timeline" aria-label={`Request status: ${status}`}>
                  {getIntroductionLifecycle(request.status, request.expiresAt).map(stage => (
                    <li className={`introduction-request__stage introduction-request__stage--${stage.state}`} key={stage.id}>
                      <i aria-hidden="true" />
                      <span>{stage.label}</span>
                    </li>
                  ))}
                </ol>
                <dl>
                  <div><dt>Project</dt><dd>{request.project}</dd></div>
                  <div><dt>Reason</dt><dd>{request.reason}</dd></div>
                </dl>
                {status === 'pending' && (
                  <div className="introduction-request__actions">
                    <button type="button" disabled={updatingId === request.id} onClick={() => decide(request.id, 'declined')}>Decline</button>
                    <button type="button" className="introduction-request__accept" disabled={updatingId === request.id} onClick={() => decide(request.id, 'accepted')}>Accept</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
