import React, { useState, useEffect, useRef } from 'react';

const SUCCESS_MESSAGE = "Thanks! We'll review and add you within a week.";

export default function AddMeModal({ onClose }) {
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'submitting') return;

    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      setStatus('error');
      setError('Please enter your GitHub username.');
      return;
    }

    setStatus('submitting');
    setError('');
    try {
      const res = await fetch('/api/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, location: location.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add me to DevGlobe">
        <button className="modal__close" onClick={onClose} aria-label="Close" type="button">✕</button>

        {status === 'success' ? (
          <div className="modal__success">
            <div className="modal__success-icon">🎉</div>
            <h2 className="modal__title">You're on the list!</h2>
            <p className="modal__message">{SUCCESS_MESSAGE}</p>
            <button className="btn btn--primary" onClick={onClose} type="button">Done</button>
          </div>
        ) : (
          <>
            <h2 className="modal__title">Add me to DevGlobe</h2>
            <p className="modal__subtitle">
              Submit your GitHub username to be featured on the globe. We'll review and add you within a week.
            </p>
            <form className="modal__form" onSubmit={handleSubmit}>
              <label className="modal__label" htmlFor="nominate-username">
                GitHub username <span className="modal__required">*</span>
              </label>
              <input
                id="nominate-username"
                ref={inputRef}
                className="modal__input"
                type="text"
                placeholder="octocat"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />

              <label className="modal__label" htmlFor="nominate-location">
                Location <span className="modal__optional">(optional)</span>
              </label>
              <input
                id="nominate-location"
                className="modal__input"
                type="text"
                placeholder="San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                autoComplete="off"
              />

              {status === 'error' && <div className="modal__error">{error}</div>}

              <button
                className="btn btn--primary modal__submit"
                type="submit"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit nomination'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
