import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import Globe from './components/Globe.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import { scoreAll } from './utils/scoring.js';

export default function App() {
  const [developers, setDevelopers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedDev, setSelectedDev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
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

  const handleCloseDetail = useCallback(() => {
    setSelectedDev(null);
  }, []);

  if (loading || error) {
    return <LoadingOverlay error={error} />;
  }

  return (
    <div id="app">
      <Header />
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
          onSelectDev={handleSelectDev}
        />
        <Leaderboard
          developers={filtered}
          selectedLogin={selectedDev?.login}
          onSelectDev={handleSelectDev}
        />
        {selectedDev && (
          <DetailPanel dev={selectedDev} onClose={handleCloseDetail} />
        )}
      </main>
    </div>
  );
}
