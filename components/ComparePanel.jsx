'use client';

import React from 'react';
import { formatNum } from '../lib/format.js';

const METRICS = [
  { key: 'score', label: 'Score', format: v => v },
  { key: 'totalStars', label: 'Total Stars', format: formatNum },
  { key: 'totalCommits', label: 'Total Commits', format: formatNum },
  { key: 'soReputation', label: 'StackOverflow Reputation', format: formatNum },
];

export default function ComparePanel({ devs, onClose }) {
  const [devA, devB] = devs;

  return (
    <div className="compare-panel-backdrop" onClick={onClose}>
      <div className="compare-panel" onClick={e => e.stopPropagation()}>
        <button className="detail-panel__close compare-panel__close" onClick={onClose}>&times;</button>
        <h2 className="compare-panel__title">Compare Developers</h2>

        <div className="compare-panel__headers">
          <DevHeader dev={devA} />
          <DevHeader dev={devB} />
        </div>

        <div className="compare-panel__metrics">
          {METRICS.map(({ key, label, format }) => {
            const valA = devA[key] || 0;
            const valB = devB[key] || 0;
            const winnerA = valA > valB;
            const winnerB = valB > valA;

            return (
              <div className="compare-row" key={key}>
                <span className={`compare-row__value${winnerA ? ' compare-row__value--winner' : ''}`}>
                  {format(valA)}
                </span>
                <span className="compare-row__label">{label}</span>
                <span className={`compare-row__value${winnerB ? ' compare-row__value--winner' : ''}`}>
                  {format(valB)}
                </span>
              </div>
            );
          })}

          <div className="compare-row">
            <span className="compare-row__value">{devA.topLanguage || '—'}</span>
            <span className="compare-row__label">Top Language</span>
            <span className="compare-row__value">{devB.topLanguage || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevHeader({ dev }) {
  return (
    <div className="compare-panel__dev">
      <img className="compare-panel__avatar" src={dev.avatarUrl} alt={dev.login} />
      <div className="compare-panel__name">{dev.name || dev.login}</div>
      <div className="compare-panel__login">@{dev.login}</div>
    </div>
  );
}
