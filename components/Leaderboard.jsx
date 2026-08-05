'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { formatNum } from '../lib/format.js';
import { extractCountry, normalizeCountry, countryKey } from '../lib/country.js';

const ITEM_HEIGHT = 62;
const BUFFER = 10;

export default function Leaderboard({
  developers,
  selectedLogin,
  onSelectDev,
  countryFilter = '',
  onCountryFilterChange,
  claimedLogins,
}) {
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(600);

  // Filters (country is owned by App so the globe can drive it too)
  const [langFilter, setLangFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');

  const countries = useMemo(() => {
    const map = new Map();
    developers.forEach(d => {
      if (d.location) {
        const country = normalizeCountry(extractCountry(d.location));
        if (country && country.length > 1) {
          const entry = map.get(country.toLowerCase());
          if (entry) entry.count++;
          else map.set(country.toLowerCase(), { name: country, count: 1 });
        }
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 50);
  }, [developers]);

  // A country picked on the globe may have no developers, or be spelled
  // differently than the option built from developer locations.
  const selectedCountryOption = useMemo(() => {
    if (!countryFilter) return null;
    const key = countryKey(countryFilter);
    return countries.find(c => c.name.toLowerCase() === key) || null;
  }, [countries, countryFilter]);

  const languages = useMemo(() => {
    const set = new Set();
    developers.forEach(d => { if (d.topLanguage) set.add(d.topLanguage); });
    return [...set].sort();
  }, [developers]);

  const filtered = useMemo(() => {
    const wantedCountry = countryKey(countryFilter);
    let result = developers.filter(d => {
      const matchLang = !langFilter || d.topLanguage === langFilter;
      const matchCountry = !wantedCountry || (d.location && countryKey(extractCountry(d.location)) === wantedCountry);
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
    onCountryFilterChange?.('');
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
          <select
            value={selectedCountryOption ? selectedCountryOption.name : countryFilter}
            onChange={e => onCountryFilterChange?.(e.target.value)}
          >
            <option value="">All Countries</option>
            {countryFilter && !selectedCountryOption && (
              <option value={countryFilter}>
                {countryFilter.length > 15 ? countryFilter.slice(0, 14) + '…' : countryFilter} (0)
              </option>
            )}
            {countries.map(({ name, count }) => (
              <option key={name} value={name}>{name.length > 15 ? name.slice(0, 14) + '…' : name} ({count})</option>
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
                  <div className="lb-item__name">
                    {dev.name || dev.login}
                    {(dev.claimed || claimedLogins?.has(dev.login)) && (
                      <span className="verified-badge verified-badge--sm" title="Claimed profile">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-3.97-3.03a.75.75 0 00-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 00-1.06 1.06L6.97 11.03a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 00-.01-1.05z"/></svg>
                      </span>
                    )}
                  </div>
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
