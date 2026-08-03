import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatNum } from '../utils/format.js';

export default function DetailPanel({ dev, onClose }) {
  const [fullData, setFullData] = useState(null);
  const radarRef = useRef(null);
  const heatmapRef = useRef(null);
  const langRef = useRef(null);

  // Fetch full details on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchFull() {
      try {
        const res = await fetch(`/api/developer?id=${encodeURIComponent(dev.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setFullData(data);
        }
      } catch { /* use existing data */ }
    }
    fetchFull();
    return () => { cancelled = true; };
  }, [dev.id]);

  // Radar chart
  useEffect(() => {
    if (!dev.scoreDimensions || !radarRef.current) return;
    renderRadar(radarRef.current, dev.scoreDimensions);
  }, [dev.scoreDimensions]);

  // Heatmap
  useEffect(() => {
    if (!heatmapRef.current) return;
    renderHeatmap(heatmapRef.current, dev.totalCommits || 500);
  }, [dev.totalCommits]);

  // Languages donut
  useEffect(() => {
    if (!langRef.current) return;
    const langs = fullData?.languages || (dev.topLanguage ? [{ name: dev.topLanguage, percent: 100 }] : []);
    renderLanguages(langRef.current, langs);
  }, [fullData, dev.topLanguage]);

  const merged = { ...dev, ...fullData };
  const repos = merged.topRepos || [];
  const soRep = merged.soReputation || 0;
  const soAnswers = merged.soAnswers || 0;
  const soAcceptRate = merged.soAcceptRate || 0;
  const soBadges = merged.soBadges || 0;

  return (
    <div className="detail-panel open">
      <button className="detail-panel__close" onClick={onClose}>&times;</button>

      {/* Header */}
      <div className="detail-panel__header">
        <div className="detail-header">
          <img className="detail-header__avatar" src={dev.avatarUrl} alt={dev.login} />
          <div>
            <div className="detail-header__name">{dev.name || dev.login}</div>
            <div className="detail-header__location">📍 {dev.location || 'Unknown location'}</div>
            <span className="detail-header__score-badge">Score: {dev.score}/100</span>
            <div className="detail-header__links">
              <a href={`https://github.com/${dev.login}`} target="_blank" rel="noreferrer">GitHub ↗</a>
              {merged.soUserId && (
                <a href={`https://stackoverflow.com/users/${merged.soUserId}`} target="_blank" rel="noreferrer">StackOverflow ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="detail-panel__stats">
        <div className="stats-grid">
          <StatCard label="Stars" value={formatNum(merged.totalStars || 0)} />
          <StatCard label="Commits" value={formatNum(merged.totalCommits || 0)} />
          <StatCard label="Followers" value={formatNum(merged.followers || 0)} />
          <StatCard label="SO Reputation" value={formatNum(soRep)} className="stat-card--so" />
          <StatCard label="SO Answers" value={formatNum(soAnswers)} className="stat-card--so" />
          <StatCard label="SO Badges" value={soBadges || 0} className="stat-card--so" />
        </div>
      </div>

      {/* Charts */}
      <div className="detail-panel__charts">
        <div className="chart-section">
          <h3>Score Breakdown</h3>
          <div ref={radarRef} />
        </div>

        <div className="chart-section">
          <h3>StackOverflow Activity</h3>
          {soRep || soAnswers ? (
            <SOBars rep={soRep} answers={soAnswers} acceptRate={soAcceptRate} badges={soBadges} userId={merged.soUserId} />
          ) : (
            <div className="so-empty">No StackOverflow profile linked</div>
          )}
        </div>

        <div className="chart-section">
          <h3>Contribution Activity</h3>
          <div ref={heatmapRef} />
        </div>

        <div className="chart-section">
          <h3>Languages</h3>
          <div ref={langRef} />
        </div>

        <div className="chart-section">
          <h3>Top Repositories</h3>
          <div>
            {repos.slice(0, 5).map(repo => (
              <div className="repo-item" key={repo.name}>
                <span className="repo-item__name">{repo.name}</span>
                <span className="repo-item__stats">
                  <span>⭐ {formatNum(repo.stars)}</span>
                  <span>🍴 {formatNum(repo.forks)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

function SOBars({ rep, answers, acceptRate, badges, userId }) {
  const metrics = [
    { label: 'Reputation', value: rep, max: 1000000, color: '#f48024' },
    { label: 'Answers', value: answers, max: 10000, color: '#ff9f4a' },
    { label: 'Accept Rate', value: acceptRate, max: 100, color: '#ffcc80', suffix: '%' },
    { label: 'Badges', value: badges, max: 500, color: '#ffe0b2' },
  ];

  return (
    <div>
      <div className="so-bars">
        {metrics.map(m => {
          const pct = Math.min((m.value / m.max) * 100, 100);
          const display = m.suffix ? m.value + m.suffix : formatNum(m.value);
          return (
            <div className="so-bar" key={m.label}>
              <div className="so-bar__label">{m.label}</div>
              <div className="so-bar__track">
                <div className="so-bar__fill" style={{ width: `${pct}%`, background: m.color }} />
              </div>
              <div className="so-bar__value">{display}</div>
            </div>
          );
        })}
      </div>
      {userId && (
        <a className="so-profile-link" href={`https://stackoverflow.com/users/${userId}`} target="_blank" rel="noreferrer">
          View full SO profile ↗
        </a>
      )}
    </div>
  );
}

function renderRadar(container, dims) {
  container.innerHTML = '';
  const data = [
    { axis: 'Stars', value: dims.stars },
    { axis: 'Commits', value: dims.commits },
    { axis: 'Reach', value: dims.repoReach },
    { axis: 'SO Rep', value: dims.soReputation },
    { axis: 'SO Engage', value: dims.soEngagement },
    { axis: 'Community', value: dims.community },
  ];

  const width = 260, height = 260;
  const radius = Math.min(width, height) / 2 - 30;
  const levels = 5;
  const angleSlice = (Math.PI * 2) / data.length;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  for (let i = 1; i <= levels; i++) {
    svg.append('circle')
      .attr('r', (radius / levels) * i)
      .attr('fill', 'none')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 0.5);
  }

  data.forEach((d, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    svg.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', radius * Math.cos(angle))
      .attr('y2', radius * Math.sin(angle))
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 0.5);

    svg.append('text')
      .attr('x', (radius + 16) * Math.cos(angle))
      .attr('y', (radius + 16) * Math.sin(angle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .text(d.axis);
  });

  const line = d3.lineRadial()
    .radius(d => d.value * radius)
    .angle((d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed);

  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('fill', 'rgba(59, 130, 246, 0.2)')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 2);

  data.forEach((d, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    svg.append('circle')
      .attr('cx', d.value * radius * Math.cos(angle))
      .attr('cy', d.value * radius * Math.sin(angle))
      .attr('r', 4)
      .attr('fill', '#3b82f6');
  });
}

function renderHeatmap(container, totalCommits) {
  container.innerHTML = '';
  const days = 364;
  const data = [];
  const avg = totalCommits / days;
  for (let i = 0; i < days; i++) {
    const isWeekend = (i % 7 === 0 || i % 7 === 6);
    const base = isWeekend ? avg * 0.3 : avg * 1.4;
    data.push(Math.max(0, Math.round(base + (Math.random() - 0.5) * avg * 2)));
  }

  const cellSize = 11;
  const weeks = 52;
  const width = weeks * (cellSize + 2) + 40;
  const height = 7 * (cellSize + 2) + 20;

  const colorScale = d3.scaleQuantize()
    .domain([0, d3.max(data)])
    .range(['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%');

  data.forEach((value, i) => {
    const week = Math.floor(i / 7);
    const day = i % 7;
    svg.append('rect')
      .attr('x', week * (cellSize + 2) + 20)
      .attr('y', day * (cellSize + 2))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', colorScale(value));
  });

  ['Mon', 'Wed', 'Fri'].forEach((label, i) => {
    svg.append('text')
      .attr('x', 0)
      .attr('y', (i * 2 + 1) * (cellSize + 2) + cellSize / 2)
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('dominant-baseline', 'middle')
      .text(label);
  });
}

function renderLanguages(container, languages) {
  container.innerHTML = '';
  if (!languages.length) return;

  const width = 120, height = 120;
  const radius = Math.min(width, height) / 2;
  const colors = ['#3b82f6', '#8b5cf6', '#f48024', '#2ea44f', '#64748b'];

  const pie = d3.pie().value(d => d.percent).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  svg.selectAll('path')
    .data(pie(languages))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d, i) => colors[i % colors.length]);

  const legend = d3.select(container)
    .append('div')
    .style('font-size', '11px');

  languages.forEach((lang, i) => {
    legend.append('div')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '6px')
      .style('margin-bottom', '4px')
      .html(`<span style="width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]};display:inline-block"></span>
             <span style="color:#e2e8f0">${lang.name}</span>
             <span style="color:#64748b">${lang.percent}%</span>`);
  });
}
