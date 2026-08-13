'use client';

import React, { useState, useEffect } from 'react';

const FACTS = [
  'Indexing 26,000+ open-source developers…',
  'Mapping contributions across 150+ countries…',
  'Calculating star power and commit velocity…',
  'Ranking the world\'s top contributors…',
  'Building your interactive 3D globe…',
];

const FEATURED_PROFILES = ['torvalds', 'gaearon', 'sindresorhus', 'tj', 'addyosmani'];

function AnimatedCounter({ target, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <>{count.toLocaleString()}{suffix}</>;
}

export default function LoadingOverlay({ error }) {
  const [factIndex, setFactIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const factTimer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FACTS.length);
    }, 3000);
    return () => clearInterval(factTimer);
  }, []);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(dotTimer);
  }, []);

  if (error) {
    return (
      <div className="loading-overlay">
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{error}</div>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: '8px 20px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-overlay">
      {/* Animated globe wireframe */}
      <div className="loading-globe">
        <svg viewBox="0 0 200 200" className="loading-globe__svg">
          <circle cx="100" cy="100" r="80" className="loading-globe__outline" />
          <ellipse cx="100" cy="100" rx="80" ry="30" className="loading-globe__ring loading-globe__ring--1" />
          <ellipse cx="100" cy="100" rx="80" ry="55" className="loading-globe__ring loading-globe__ring--2" />
          <ellipse cx="100" cy="100" rx="30" ry="80" className="loading-globe__ring loading-globe__ring--3" />
          <line x1="20" y1="100" x2="180" y2="100" className="loading-globe__line" />
          <line x1="100" y1="20" x2="100" y2="180" className="loading-globe__line" />
          {/* Animated dots representing developers */}
          <circle cx="60" cy="70" r="3" className="loading-globe__dot loading-globe__dot--1" />
          <circle cx="130" cy="85" r="3" className="loading-globe__dot loading-globe__dot--2" />
          <circle cx="90" cy="120" r="3" className="loading-globe__dot loading-globe__dot--3" />
          <circle cx="145" cy="110" r="3" className="loading-globe__dot loading-globe__dot--4" />
          <circle cx="70" cy="135" r="3" className="loading-globe__dot loading-globe__dot--5" />
        </svg>
      </div>

      {/* Branding */}
      <h1 className="loading-brand">
        <img src="/devglobe.png" alt="DevGlobe logo" className="loading-brand__logo" />
        <span>DevGlobe: discover overlooked open-source developers</span>
      </h1>
      <p className="loading-tagline">Search by expertise, location, language, and verified contributions beyond traditional professional networks.</p>

      <nav className="loading-profiles" aria-label="Featured developer profiles">
        {FEATURED_PROFILES.map(login => (
          <a key={login} href={`/share/${login}`}>@{login}</a>
        ))}
      </nav>

      {/* Stats preview */}
      <div className="loading-stats">
        <div className="loading-stat">
          <span className="loading-stat__value"><AnimatedCounter target={26000} duration={2500} suffix="+" /></span>
          <span className="loading-stat__label">Developers</span>
        </div>
        <div className="loading-stat__divider" />
        <div className="loading-stat">
          <span className="loading-stat__value"><AnimatedCounter target={150} duration={2000} suffix="+" /></span>
          <span className="loading-stat__label">Countries</span>
        </div>
        <div className="loading-stat__divider" />
        <div className="loading-stat">
          <span className="loading-stat__value"><AnimatedCounter target={50} duration={1800} suffix="M+" /></span>
          <span className="loading-stat__label">Stars Tracked</span>
        </div>
      </div>

      {/* Rotating facts */}
      <div className="loading-fact" key={factIndex}>
        {FACTS[factIndex]}
      </div>

      {/* Progress indicator */}
      <div className="loading-progress">
        <div className="loading-progress__bar" />
      </div>
      <div className="loading-status">Preparing your globe{dots}</div>
    </div>
  );
}
