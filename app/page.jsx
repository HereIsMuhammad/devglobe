'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header.jsx';
import SearchBar from '../components/SearchBar.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import DetailPanel from '../components/DetailPanel.jsx';
import LoadingOverlay from '../components/LoadingOverlay.jsx';
import { scoreAll } from '../lib/scoring.js';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('../components/Globe.jsx'), { ssr: false });

export default function Home() {
  const [developers, setDevelopers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedDev, setSelectedDev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [theme, setTheme] = useState('dark');
  const globeRef = useRef(null);

  useEffect(() => {
    // Mirrors the blocking script in layout.jsx so React state matches the
    // theme already applied to <html> before hydration.
    try {
      const stored = localStorage.getItem('devglobe-theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }
    } catch (err) {
      // localStorage unavailable (e.g. private browsing) — fall back to dark
    }
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('devglobe-theme', next);
      } catch (err) {
        // ignore persistence failures, theme still applies for this session
      }
      if (next === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/developers');
        if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
        const raw = await res.json();
        const scored = scoreAll(raw);
        setDevelopers(scored);
        setFiltered(scored);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSearch = useCallback((results) => {
    const scored = scoreAll(results);
    setFiltered(scored);
  }, []);

  const handleResetFilter = useCallback(() => {
    setFiltered(developers);
  }, [developers]);

  const handleSelectDev = useCallback((dev) => {
    setSelectedDev(dev);
    if (dev?.lat != null && dev?.lng != null) {
      setFlyTarget({ lat: dev.lat, lng: dev.lng });
    }
  }, []);

  const handleSelectCountry = useCallback((country, view) => {
    setSelectedCountry(country);
    if (view) {
      setFlyTarget({ lat: view.lat, lng: view.lng, altitude: view.altitude });
    }
  }, []);

  const handleClearCountry = useCallback(() => {
    setSelectedCountry('');
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedDev(null);
  }, []);

  const handleHome = useCallback(() => {
    setSelectedDev(null);
    setFiltered(developers);
    setFlyTarget(null);
    setSelectedCountry('');
  }, [developers]);

  if (loading || error) {
    return <LoadingOverlay error={error} />;
  }

  return (
    <div id="app">
      <Header onHome={handleHome} theme={theme} onToggleTheme={handleToggleTheme} />
      <SearchBar
        developers={developers}
        onResults={handleSearch}
        onReset={handleResetFilter}
      />
      <main className="main">
        <Globe
          ref={globeRef}
          developers={filtered}
          flyTarget={flyTarget}
          selectedCountry={selectedCountry}
          theme={theme}
          onSelectDev={handleSelectDev}
          onSelectCountry={handleSelectCountry}
          onClearCountry={handleClearCountry}
        />
        <Leaderboard
          developers={filtered}
          selectedLogin={selectedDev?.login}
          onSelectDev={handleSelectDev}
          countryFilter={selectedCountry}
          onCountryFilterChange={setSelectedCountry}
        />
        {selectedDev && (
          <DetailPanel dev={selectedDev} onClose={handleCloseDetail} />
        )}
      </main>
    </div>
  );
}