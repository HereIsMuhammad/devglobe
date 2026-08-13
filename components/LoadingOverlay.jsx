'use client';

import React, { useState, useEffect } from 'react';

const FACTS = [
  'Mapping contributions across 150+ countries…',
  'Calculating star power and commit velocity…',
  'Ranking the world\'s top contributors…',
  'Building your interactive 3D globe…',
];

const FEATURED_PROFILES = ['torvalds', 'gaearon', 'sindresorhus', 'tj', 'addyosmani'];

function AnimatedCounter({ target, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame;
    const startedAt = performance.now();

    const update = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setCount(Math.floor(target * progress));
      if (progress < 1) frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return <>{count.toLocaleString()}{suffix}</>;
}

export default function LoadingOverlay({ error, datasetCount }) {
  const facts = [
    datasetCount === null
      ? 'Counting indexed open-source developers…'
      : `Indexing ${datasetCount.toLocaleString()} open-source developers…`,
    ...FACTS,
  ];
  const [factIndex, setFactIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const factTimer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % facts.length);
    }, 3000);
    return () => clearInterval(factTimer);
  }, [facts.length]);

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
      <div className="loading-scene" aria-hidden="true">
        <div className="loading-scene__orbit"><span /></div>
        <div className="loading-globe">
          <svg viewBox="0 0 220 220" className="loading-globe__svg">
            <defs>
              <radialGradient id="loadingGlobeFill" cx="35%" cy="28%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="75%" stopColor="currentColor" stopOpacity="0.06" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
              <clipPath id="loadingGlobeClip"><circle cx="110" cy="110" r="78" /></clipPath>
            </defs>
            <circle cx="110" cy="110" r="78" className="loading-globe__surface" />
            <g clipPath="url(#loadingGlobeClip)" className="loading-globe__grid">
              <ellipse cx="110" cy="110" rx="78" ry="29" />
              <ellipse cx="110" cy="110" rx="78" ry="55" />
              <ellipse cx="110" cy="110" rx="31" ry="78" />
              <ellipse cx="110" cy="110" rx="58" ry="78" />
              <path d="M32 110h156M110 32v156" />
            </g>
            <g className="loading-globe__routes" clipPath="url(#loadingGlobeClip)">
              <path d="M58 126 Q103 55 158 94" />
              <path d="M75 74 Q126 143 168 126" />
              <path d="M48 105 Q104 128 145 65" />
            </g>
            <g className="loading-globe__nodes">
              <circle cx="58" cy="126" r="4" />
              <circle cx="158" cy="94" r="4" />
              <circle cx="75" cy="74" r="3" />
              <circle cx="168" cy="126" r="3" />
              <circle cx="145" cy="65" r="3" />
            </g>
            <circle cx="110" cy="110" r="78" className="loading-globe__outline" />
          </svg>
        </div>
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
          <span className="loading-stat__value">
            {datasetCount === null ? '…' : <AnimatedCounter target={datasetCount} duration={1800} />}
          </span>
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
        {facts[factIndex]}
      </div>

      {/* Progress indicator */}
      <div className="loading-progress">
        <div className="loading-progress__bar" />
      </div>
      <div className="loading-status">Preparing your globe{dots}</div>
    </div>
  );
}
