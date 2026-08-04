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
  const globeRef = useRef(null);

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
      <Header onHome={handleHome} />
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
