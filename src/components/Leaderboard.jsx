import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { formatNum } from '../utils/format.js';
import { extractCountry } from '../utils/country.js';

const ITEM_HEIGHT = 62;
const BUFFER = 10;

export default function Leaderboard({ developers, selectedLogin, onSelectDev }) {
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(600);

  // Filters
  const [countryFilter, setCountryFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');

  const countries = useMemo(() => {
    const map = new Map();
    developers.forEach(d => {
      if (d.location) {
        const country = extractCountry(d.location);
        if (country && country.length > 1) map.set(country, (map.get(country) || 0) + 1);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  }, [developers]);

  const languages = useMemo(() => {
    const set = new Set();
    developers.forEach(d => { if (d.topLanguage) set.add(d.topLanguage); });
    return [...set].sort();
  }, [developers]);

  const filtered = useMemo(() => {
    let result = developers.filter(d => {
      const matchLang = !langFilter || d.topLanguage === langFilter;
      const matchCountry = !countryFilter || (d.location && extractCountry(d.location) === countryFilter);
      return matchLang && matchCountry;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'stars': return (b.totalStars || 0) - (a.totalStars || 0);
        case 'commits': return (b.totalCommits || 0) - (a.totalCommits || 0);
        case 'soRep': return (b.soReputation || 0) - (a.soReputation || 0);
        default: return b.score - a.score;
      }
    });

    return result;
  }, [developers, langFilter, countryFilter, sortBy]);

  // Virtual scroll range
  const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
  const end = Math.min(filtered.length, Math.ceil((scrollTop + viewHeight) / ITEM_HEIGHT) + BUFFER);
  const totalHeight = filtered.length * ITEM_HEIGHT;
  const visibleItems = filtered.slice(start, end);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setViewHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Scroll to top when filters change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [countryFilter, langFilter, sortBy, developers]);

  // Scroll to selected
  useEffect(() => {
    if (!selectedLogin || !listRef.current) return;
    const idx = filtered.findIndex(d => d.login === selectedLogin);
    if (idx >= 0) {
      listRef.current.scrollTop = idx * ITEM_HEIGHT - viewHeight / 2;
    }
  }, [selectedLogin, filtered, viewHeight]);

  const hasActiveFilter = countryFilter || langFilter;
  const clearFilters = () => {
    setCountryFilter('');
    setLangFilter('');
  };

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__header-row">
          <h2>Leaderboard</h2>
          {hasActiveFilter && (
            <button className="sidebar__clear-btn" onClick={clearFilters} title="Clear all filters">
              ✕ Clear filters
            </button>
          )}
        </div>
        <div className="sidebar__count">{filtered.length} developer{filtered.length !== 1 ? 's' : ''}</div>
        <div className="sidebar__filters">
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
            <option value="">All Countries</option>
            {countries.map(([c, n]) => (
              <option key={c} value={c}>{c.length > 15 ? c.slice(0, 14) + '…' : c} ({n})</option>
            ))}
          </select>
          <select value={langFilter} onChange={e => setLangFilter(e.target.value)}>
            <option value="">All Languages</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="score">Score</option>
            <option value="stars">Stars</option>
            <option value="commits">Commits</option>
            <option value="soRep">SO Rep</option>
          </select>
        </div>
      </div>
      <ul className="sidebar__list" ref={listRef} onScroll={handleScroll} style={{ position: 'relative', overflow: 'auto' }}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map((dev, i) => {
            const idx = start + i;
            return (
              <li
                key={dev.login}
                className={`lb-item${dev.login === selectedLogin ? ' active' : ''}`}
                style={{
                  position: 'absolute',
                  top: idx * ITEM_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ITEM_HEIGHT,
                }}
                onClick={() => onSelectDev(dev)}
              >
                <span className="lb-item__rank">{idx + 1}</span>
                <img className="lb-item__avatar" src={dev.avatarUrl} alt={dev.login} loading="lazy" />
                <div className="lb-item__info">
                  <div className="lb-item__name">{dev.name || dev.login}</div>
                  <div className="lb-item__meta">{dev.topLanguage || ''} · {dev.location || 'Unknown'}</div>
                  <div className="lb-item__badges">
                    <span className="lb-badge lb-badge--gh" title="GitHub Stars">★ {formatNum(dev.totalStars)}</span>
                    {dev.soReputation ? <span className="lb-badge lb-badge--so" title="SO Reputation">● {formatNum(dev.soReputation)}</span> : null}
                  </div>
                </div>
                <span className="lb-item__score">{dev.score}</span>
              </li>
            );
          })}
        </div>
      </ul>
    </aside>
  );
}
