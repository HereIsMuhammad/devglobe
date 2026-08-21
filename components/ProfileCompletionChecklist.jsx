'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '../lib/analytics.js';

export default function ProfileCompletionChecklist({
  login,
  version,
  onOpenProfile,
  onEditAiProfile,
  onGenerateCard,
  onCloseMenu,
}) {
  const [completion, setCompletion] = useState(null);
  const [updating, setUpdating] = useState(false);
  const previousStepsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile-completion', { cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (cancelled) return;

        const snapshotKey = `devglobe-profile-checklist-${login.toLowerCase()}`;
        let previous = previousStepsRef.current;
        if (!previous) {
          try { previous = JSON.parse(sessionStorage.getItem(snapshotKey)); } catch { /* Analytics snapshots are optional. */ }
        }
        if (previous) {
          for (const step of result.steps) {
            if (step.complete && previous[step.id] === false) {
              track('profile_checklist_step_completed', { step: step.id });
            }
          }
        }
        previousStepsRef.current = Object.fromEntries(result.steps.map(step => [step.id, step.complete]));
        try { sessionStorage.setItem(snapshotKey, JSON.stringify(previousStepsRef.current)); } catch { /* Analytics snapshots are optional. */ }
        setCompletion(result);
        if (!result.dismissed) {
          track('profile_checklist_impression', { completed: result.completed, total: result.total });
        }
      })
      .catch(() => {
        if (!cancelled) setCompletion(null);
      });
    return () => { cancelled = true; };
  }, [login, version]);

  async function setDismissed(dismissed) {
    setUpdating(true);
    try {
      const response = await fetch('/api/profile-completion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCompletion(result);
      track(dismissed ? 'profile_checklist_dismissed' : 'profile_checklist_restored', {
        completed: result.completed,
        total: result.total,
      });
    } catch {
      // Keep the current state when persistence fails.
    } finally {
      setUpdating(false);
    }
  }

  function selectStep(step) {
    track('profile_checklist_step_selected', { step: step.id });
    if (step.action === 'profile') onOpenProfile();
    if (step.action === 'ai-profile') onEditAiProfile();
    if (step.action === 'repositories') {
      window.open(`https://github.com/${encodeURIComponent(login)}?tab=repositories`, '_blank', 'noopener,noreferrer');
    }
    if (step.action === 'card') onGenerateCard();
    onCloseMenu();
  }

  if (!completion) return null;
  if (completion.dismissed) {
    return (
      <button
        type="button"
        className="user-menu__item"
        disabled={updating}
        onClick={() => setDismissed(false)}
      >
        <span className="profile-checklist__restore-icon" aria-hidden="true">&#8635;</span>
        Show profile checklist
      </button>
    );
  }

  return (
    <section className="profile-checklist" aria-labelledby="profile-checklist-title">
      <div className="profile-checklist__header">
        <div>
          <strong id="profile-checklist-title">Profile setup</strong>
          <span>{completion.completed} of {completion.total} complete</span>
        </div>
        <button
          type="button"
          className="profile-checklist__dismiss"
          aria-label="Dismiss profile checklist"
          title="Dismiss checklist"
          disabled={updating}
          onClick={() => setDismissed(true)}
        >&times;</button>
      </div>
      <div
        className="profile-checklist__progress"
        role="progressbar"
        aria-label="Profile setup progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={completion.percent}
      >
        <span style={{ width: `${completion.percent}%` }} />
      </div>
      <div className="profile-checklist__steps">
        {completion.steps.map(step => (
          <button
            type="button"
            key={step.id}
            className={step.complete ? 'profile-checklist__step profile-checklist__step--complete' : 'profile-checklist__step'}
            disabled={step.complete}
            onClick={() => selectStep(step)}
          >
            <span className="profile-checklist__status" aria-hidden="true">{step.complete ? '\u2713' : ''}</span>
            <span>{step.label}</span>
            {!step.complete && <span className="profile-checklist__arrow" aria-hidden="true">&#8250;</span>}
          </button>
        ))}
      </div>
    </section>
  );
}