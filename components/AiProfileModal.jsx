'use client';

import { useEffect, useState } from 'react';

export default function AiProfileModal({ onClose, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const response = await fetch('/api/ai-profile', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load AI settings');
        if (!cancelled) {
          setProfile(data.profile);
          setOptions(data.options);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  const selectedTool = id => profile.tools.find(tool => tool.id === id);

  const toggleTool = id => {
    const existing = selectedTool(id);
    setProfile(current => ({
      ...current,
      tools: existing
        ? current.tools.filter(tool => tool.id !== id)
        : [...current.tools, { id, usage: 'regular' }],
    }));
  };

  const updateUsage = (id, usage) => {
    setProfile(current => ({
      ...current,
      tools: current.tools.map(tool => tool.id === id ? { ...tool, usage } : tool),
    }));
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/ai-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save AI settings');
      onSaved(data.profile.visibility === 'public' ? data.profile : null);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ai-profile-modal__backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="ai-profile-modal" role="dialog" aria-modal="true" aria-labelledby="ai-profile-title">
        <button type="button" className="ai-profile-modal__close" onClick={onClose} aria-label="Close AI collaboration settings">&times;</button>
        <span className="ai-profile-modal__eyebrow">CONSENT-BASED DISCOVERY</span>
        <h2 id="ai-profile-title">AI collaboration settings</h2>
        <p className="ai-profile-modal__intro">Share the tools you use and decide whether verified agents may request an introduction.</p>

        {loading && <div className="ai-profile-modal__status">Loading settings...</div>}
        {!loading && error && !profile && <div className="ai-profile-modal__error">{error}</div>}

        {profile && options && (
          <form onSubmit={save}>
            <fieldset className="ai-profile-modal__fieldset">
              <legend>AI tools</legend>
              <p>Public tool selections are shown as self-declared.</p>
              <div className="ai-profile-modal__tools">
                {options.tools.map(tool => {
                  const selected = selectedTool(tool.id);
                  return (
                    <div className={`ai-tool-option${selected ? ' ai-tool-option--selected' : ''}`} key={tool.id}>
                      <label>
                        <input type="checkbox" checked={Boolean(selected)} onChange={() => toggleTool(tool.id)} />
                        <span>{tool.name}</span>
                      </label>
                      {selected && (
                        <select value={selected.usage} onChange={event => updateUsage(tool.id, event.target.value)} aria-label={`${tool.name} usage level`}>
                          {options.usageLevels.map(level => <option value={level} key={level}>{level}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="ai-profile-modal__fieldset">
              <legend>Visibility and contact</legend>
              <label className="ai-profile-modal__row">
                <span><strong>Public AI profile</strong><small>Show these self-declared tools on your DevGlobe profile.</small></span>
                <input type="checkbox" checked={profile.visibility === 'public'} onChange={event => setProfile(current => ({ ...current, visibility: event.target.checked ? 'public' : 'private' }))} />
              </label>
              <label className="ai-profile-modal__row">
                <span><strong>Accept agent requests</strong><small>Allow verified agents to request an introduction. Contact details remain private.</small></span>
                <input
                  type="checkbox"
                  checked={profile.acceptsAgentRequests}
                  onChange={event => setProfile(current => ({
                    ...current,
                    acceptsAgentRequests: event.target.checked,
                    contactPolicy: event.target.checked ? 'verified-agents' : 'nobody',
                  }))}
                />
              </label>
            </fieldset>

            {error && <div className="ai-profile-modal__error">{error}</div>}
            <div className="ai-profile-modal__actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn ai-profile-modal__save" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
