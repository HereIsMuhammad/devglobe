'use client';

import { useState } from 'react';
import { formatNum } from '../lib/format.js';

const LABELS = {
  profileViews: 'Profile views',
  searchAppearances: 'Search appearances',
  cardGenerations: 'Cards generated',
  shareActions: 'Share actions',
};

function Trend({ metric }) {
  if (metric.value == null) return <span className="profile-insights__private">Private until 3 sessions</span>;
  if (metric.change == null) return <span className="profile-insights__trend">No prior comparison</span>;
  const direction = metric.change > 0 ? 'up' : metric.change < 0 ? 'down' : '';
  return <span className={`profile-insights__trend${direction ? ` profile-insights__trend--${direction}` : ''}`}>{metric.change > 0 ? '+' : ''}{formatNum(metric.change)} vs prior</span>;
}

export default function ProfileInsights() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [period, setPeriod] = useState(7);
  const [status, setStatus] = useState('idle');

  async function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || result || status === 'loading') return;
    setStatus('loading');
    try {
      const response = await fetch('/api/profile-insights', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  const selected = result?.periods.find(item => item.days === period);
  return (
    <div className="profile-insights">
      <button type="button" className="user-menu__item" onClick={toggle} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" />
        </svg>
        Visibility insights
        <span className="profile-insights__chevron">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <section className="profile-insights__panel" aria-label="Private profile visibility insights">
          {status === 'loading' && <p>Loading insights...</p>}
          {status === 'error' && <p>Insights are unavailable right now.</p>}
          {selected && (
            <>
              <div className="profile-insights__periods" aria-label="Insights period">
                {result.periods.map(item => (
                  <button type="button" key={item.days} className={period === item.days ? 'active' : ''} onClick={() => setPeriod(item.days)}>{item.days}d</button>
                ))}
              </div>
              <div className="profile-insights__metrics">
                {Object.entries(selected.metrics).map(([name, metric]) => (
                  <div key={name}>
                    <span>{LABELS[name]}</span>
                    <strong>{metric.value == null ? '—' : formatNum(metric.value)}</strong>
                    <Trend metric={metric} />
                  </div>
                ))}
              </div>
              <p className="profile-insights__note">Search terms and visitor identities are never shown. Low-volume metrics stay private.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}