'use client';

import { useEffect, useState } from 'react';
import { formatNum } from '../lib/format.js';

const PERIODS = [7, 30, 90];
const RANK_SERIES = [
  { key: 'globalRank', label: 'Global', color: '#0891b2' },
  { key: 'countryRank', label: 'Country', color: '#2ea44f' },
  { key: 'languageRank', label: 'Language', color: '#d97706' },
];

function Delta({ value, rank = false }) {
  if (value == null) return <span className="impact-delta impact-delta--empty">No comparison</span>;
  const positive = value > 0;
  const display = `${positive ? '+' : ''}${formatNum(value)}`;
  return <span className={`impact-delta${positive ? ' impact-delta--up' : value < 0 ? ' impact-delta--down' : ''}`}>{display}{rank && value !== 0 ? ' places' : ''}</span>;
}

function RankChart({ history }) {
  const available = RANK_SERIES.filter(series => history.some(item => Number.isInteger(item[series.key])));
  if (history.length < 2 || available.length === 0) {
    return <p className="impact-history__empty">Rank trends appear after at least two daily snapshots.</p>;
  }

  const width = 720;
  const height = 220;
  const padding = 24;
  const pointsFor = key => {
    const values = history.map(item => item[key]).filter(Number.isInteger);
    const max = Math.max(...values);
    const min = Math.min(...values);
    return history.map((item, index) => {
      if (!Number.isInteger(item[key])) return null;
      const x = padding + index * ((width - padding * 2) / Math.max(history.length - 1, 1));
      const y = padding + ((item[key] - min) / Math.max(max - min, 1)) * (height - padding * 2);
      return `${x},${y}`;
    }).filter(Boolean).join(' ');
  };

  return (
    <div className="impact-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Global, country, and language rank history; higher on the chart means a better numerical rank">
        {[0, 1, 2, 3, 4].map(index => <line key={index} x1={padding} x2={width - padding} y1={padding + index * 43} y2={padding + index * 43} />)}
        {available.map(series => <polyline key={series.key} points={pointsFor(series.key)} stroke={series.color} />)}
      </svg>
      <div className="impact-chart__legend">
        {available.map(series => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}
      </div>
    </div>
  );
}

export default function ImpactHistoryPanel({ login }) {
  const [result, setResult] = useState(null);
  const [period, setPeriod] = useState(7);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/impact-history?login=${encodeURIComponent(login)}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load impact history');
        if (!cancelled) {
          setResult(data);
          setStatus('ready');
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError.message);
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [login]);

  const updateVisibility = async event => {
    const visibility = event.target.checked ? 'public' : 'private';
    setError('');
    try {
      const response = await fetch('/api/impact-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update visibility');
      setResult(current => ({ ...current, visibility: data.visibility }));
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  if (status === 'loading') return <section className="impact-history"><p className="impact-history__empty">Loading impact history...</p></section>;
  if (status === 'error') return <section className="impact-history"><p className="impact-history__empty">{error}</p></section>;
  if (!result.current) return (
    <section className="impact-history" aria-labelledby="impact-history-title">
      <div className="impact-history__heading"><div><span>DAILY SNAPSHOTS</span><h2 id="impact-history-title">Impact history</h2></div></div>
      <p className="impact-history__empty">History starts with the next daily snapshot. No earlier activity is inferred.</p>
    </section>
  );

  const comparison = result.periods[period];
  const current = result.current;
  return (
    <section className="impact-history" aria-labelledby="impact-history-title">
      <div className="impact-history__heading">
        <div><span>DAILY SNAPSHOTS</span><h2 id="impact-history-title">Impact history</h2></div>
        {result.owner && (
          <label className="impact-history__visibility">
            <span>Public history</span>
            <input type="checkbox" checked={result.visibility === 'public'} onChange={updateVisibility} />
          </label>
        )}
      </div>

      <div className="impact-history__periods" aria-label="Comparison period">
        {PERIODS.map(days => <button type="button" key={days} className={period === days ? 'active' : ''} onClick={() => setPeriod(days)}>{days} days</button>)}
      </div>

      <div className="impact-metrics">
        <div><span>Score</span><strong>{current.score}</strong><Delta value={comparison.metrics?.score} /></div>
        <div><span>Stars</span><strong>{formatNum(current.totalStars)}</strong><Delta value={comparison.metrics?.totalStars} /></div>
        <div><span>Followers</span><strong>{formatNum(current.followers)}</strong><Delta value={comparison.metrics?.followers} /></div>
        <div><span>Commits</span><strong>{formatNum(current.totalCommits)}</strong><Delta value={comparison.metrics?.totalCommits} /></div>
      </div>

      {!comparison.available && <p className="impact-history__notice">A {period}-day comparison is not available yet. DevGlobe will show it after enough snapshots are collected.</p>}

      <div className="impact-ranks">
        <div><span>Global rank</span><strong>{current.globalRank ? `#${formatNum(current.globalRank)}` : '—'}</strong><Delta value={comparison.ranks?.globalRank} rank /></div>
        <div><span>{current.country ? `${current.country} rank` : 'Country rank'}</span><strong>{current.countryRank ? `#${formatNum(current.countryRank)}` : '—'}</strong><Delta value={comparison.ranks?.countryRank} rank /></div>
        <div><span>{current.language ? `${current.language} rank` : 'Language rank'}</span><strong>{current.languageRank ? `#${formatNum(current.languageRank)}` : '—'}</strong><Delta value={comparison.ranks?.languageRank} rank /></div>
      </div>

      <RankChart history={result.history} />

      {result.explanations.length > 0 && (
        <div className="impact-history__explanation"><strong>What changed the score</strong><p>{result.explanations.join(', ')}.</p></div>
      )}
      {error && <p className="impact-history__error" role="status">{error}</p>}
    </section>
  );
}