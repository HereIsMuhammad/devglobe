import React, { useState, useRef, useCallback } from 'react';
import { scoreAll } from '../utils/scoring.js';

const SAMPLES = [
  { query: 'open source contributors in San Francisco', label: 'SF contributors' },
  { query: 'Python developer working on AI and deep learning', label: 'AI & deep learning' },
  { query: 'full stack JavaScript developer', label: 'full stack JS dev' },
  { query: 'Linux kernel and systems programming in C', label: 'Linux kernel devs' },
];

export default function SearchBar({ developers, onResults, onReset }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [searching, setSearching] = useState(false);
  const [resultCount, setResultCount] = useState(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  const doSearch = useCallback(async (q, m) => {
    if (!q.trim()) {
      onReset();
      setResultCount(null);
      return;
    }

    if (m === 'text') {
      const lower = q.toLowerCase();
      const results = developers.filter(d =>
        (d.login && d.login.toLowerCase().includes(lower)) ||
        (d.name && d.name.toLowerCase().includes(lower)) ||
        (d.location && d.location.toLowerCase().includes(lower))
      );
      onResults(results);
      setResultCount(results.length);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&mode=${m}&top=20`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (!controller.signal.aborted) {
        const results = data.results || [];
        onResults(results);
        setResultCount(results.length);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Search failed:', e);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [developers, onResults, onReset]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val, mode), 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(timerRef.current);
      doSearch(query, mode);
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  const handleModeChange = (e) => {
    const m = e.target.value;
    setMode(m);
    if (query.trim()) doSearch(query, m);
  };

  const handleSample = (q) => {
    setQuery(q);
    doSearch(q, mode);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery('');
    setResultCount(null);
    onReset();
    inputRef.current?.focus();
  };

  return (
    <div className="search-bar" id="search-bar">
      <div className="search-bar__inner">
        {searching ? (
          <div className="search-bar__spinner" />
        ) : (
          <svg className="search-bar__icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Search developers, languages, or locations..."
          autoComplete="off"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className="search-bar__clear" onClick={handleClear} title="Clear search (Esc)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        <select value={mode} onChange={handleModeChange} title="Search mode">
          <option value="text">Text</option>
          <option value="vector">Vector (AI)</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
      {resultCount !== null && query && (
        <div className="search-bar__results">
          {resultCount === 0 ? 'No results found' : `${resultCount} developer${resultCount !== 1 ? 's' : ''} found`}
          <button className="search-bar__reset" onClick={handleClear} title="Clear filter and show all">
            ✕ Clear
          </button>
        </div>
      )}
      <div className={`search-bar__samples${query ? ' hidden' : ''}`}>
        <span>Try:</span>
        {SAMPLES.map(s => (
          <button key={s.label} onClick={() => handleSample(s.query)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
