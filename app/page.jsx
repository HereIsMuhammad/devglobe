'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header.jsx';
import SearchBar from '../components/SearchBar.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import DetailPanel from '../components/DetailPanel.jsx';
import ComparePanel from '../components/ComparePanel.jsx';
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
  const [compareDevs, setCompareDevs] = useState([]);
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [claimStatus, setClaimStatus] = useState('unclaimed'); // 'unclaimed' | 'claimed' | 'no_match'
  const [claimedLogins, setClaimedLogins] = useState(new Set());
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

  // Fetch session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch { /* not authenticated */ }
    }
    loadSession();
  }, []);

  // Check claim status when user and developers are loaded
  useEffect(() => {
    if (!user || developers.length === 0) return;
    const match = developers.find(d => d.login === user.login);
    if (match?.claimed) {
      setClaimStatus('claimed');
      setClaimedLogins(prev => new Set(prev).add(user.login));
    } else {
      setClaimStatus('unclaimed');
    }
  }, [user, developers]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setClaimStatus('unclaimed');
  }, []);

  const handleClaim = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/claim', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setClaimStatus('claimed');
        setClaimedLogins(prev => new Set(prev).add(user.login));
        // If a new profile was created, reload developers to include it
        if (result.created) {
          const devRes = await fetch('/api/developers');
          if (devRes.ok) {
            const raw = await devRes.json();
            const scored = scoreAll(raw);
            setDevelopers(scored);
            setFiltered(scored);
            const claimed = new Set(raw.filter(d => d.claimed).map(d => d.login));
            setClaimedLogins(claimed);
          }
        }
      } else {
        const data = await res.json();
        console.error('Claim failed:', data.error);
      }
    } catch (err) {
      console.error('Claim error:', err);
    }
  }, [user]);

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
        // Build set of all claimed logins from data
        const claimed = new Set(raw.filter(d => d.claimed).map(d => d.login));
        setClaimedLogins(claimed);
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

  const handleToggleCompare = useCallback((dev) => {
    setCompareDevs(prev => {
      const idx = prev.findIndex(d => d.login === dev.login);
      if (idx >= 0) return prev.filter(d => d.login !== dev.login);
      if (prev.length >= 2) return prev;
      return [...prev, dev];
    });
  }, []);

  const handleCloseCompare = useCallback(() => {
    setCompareDevs([]);
  }, []);

  const handleHome = useCallback(() => {
    setSelectedDev(null);
    setCompareDevs([]);
    setFiltered(developers);
    setFlyTarget(null);
    setSelectedCountry('');
  }, [developers]);

  if (loading || error) {
    return <LoadingOverlay error={error} />;
  }

  return (
    <div id="app">
      <Header onHome={handleHome} theme={theme} onToggleTheme={handleToggleTheme} user={user} onLogout={handleLogout} onClaim={handleClaim} claimStatus={claimStatus} />
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
          compareLogins={compareDevs.map(d => d.login)}
          onToggleCompare={handleToggleCompare}
          claimedLogins={claimedLogins}
        />
        {selectedDev && (
          <DetailPanel dev={selectedDev} onClose={handleCloseDetail} claimedLogins={claimedLogins} />
        )}
        {compareDevs.length === 2 && (
          <ComparePanel devs={compareDevs} onClose={handleCloseCompare} />
        )}
      </main>
    </div>
  );
}