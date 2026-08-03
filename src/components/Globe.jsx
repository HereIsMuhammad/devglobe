import React, { useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import GlobeGL from 'react-globe.gl';
import { getPlatformColor } from '../utils/scoring.js';
import { formatNum } from '../utils/format.js';

const Globe = forwardRef(function Globe({ developers, flyTarget, onSelectDev }, ref) {
  const globeEl = useRef();
  const tooltipRef = useRef(null);

  const geoDevs = useMemo(() => {
    return developers
      .filter(d => d.lat != null && d.lng != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5000);
  }, [developers]);

  const labelDevs = useMemo(() => {
    return geoDevs.filter(d => d.score >= 80);
  }, [geoDevs]);

  // Auto-rotate on mount
  useEffect(() => {
    const controls = globeEl.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableDamping = true;
    }
  }, []);

  // Fly to target
  useEffect(() => {
    if (flyTarget && globeEl.current) {
      globeEl.current.pointOfView({ lat: flyTarget.lat, lng: flyTarget.lng, altitude: 1.5 }, 1000);
      const controls = globeEl.current.controls();
      if (controls) controls.autoRotate = false;
    }
  }, [flyTarget]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng) => {
      globeEl.current?.pointOfView({ lat, lng, altitude: 1.5 }, 1000);
    },
  }));

  const handleHover = useCallback((point) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const controls = globeEl.current?.controls();

    if (point) {
      tooltip.innerHTML = `
        <div class="tooltip__header">
          <img class="tooltip__avatar" src="${point.avatarUrl}" alt="${point.login}">
          <div>
            <div class="tooltip__name">${point.name || point.login}</div>
            <div class="tooltip__login">@${point.login}</div>
          </div>
        </div>
        <div class="tooltip__score">Score: ${point.score}/100</div>
        <div class="tooltip__stats">
          <span>⭐ ${formatNum(point.totalStars || 0)}</span>
          <span>👥 ${formatNum(point.followers || 0)}</span>
          ${point.soReputation ? `<span class="tooltip__so">SO ${formatNum(point.soReputation)}</span>` : ''}
        </div>
        <div class="tooltip__meta">
          <span>📍 ${point.location || 'Unknown'}</span>
          ${point.topLanguage ? `<span>· ${point.topLanguage}</span>` : ''}
        </div>
      `;
      tooltip.classList.add('visible');
      if (controls) controls.autoRotate = false;
    } else {
      tooltip.classList.remove('visible');
      if (controls) controls.autoRotate = true;
    }
  }, []);

  const handleClick = useCallback((point) => {
    if (point) onSelectDev(point);
  }, [onSelectDev]);

  // Track mouse for tooltip
  useEffect(() => {
    const handler = (e) => {
      if (tooltipRef.current) {
        tooltipRef.current.style.left = (e.clientX + 12) + 'px';
        tooltipRef.current.style.top = (e.clientY + 12) + 'px';
      }
    };
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, []);

  return (
    <>
      <div id="globe-container">
        <GlobeGL
          ref={globeEl}
          globeImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png"
          showAtmosphere={true}
          atmosphereColor="#3a7ecf"
          atmosphereAltitude={0.2}
          pointsData={geoDevs}
          pointLat={d => d.lat}
          pointLng={d => d.lng}
          pointAltitude={d => 0.01 + (d.score / 100) * 0.06}
          pointRadius={d => 0.3 + (d.score / 100) * 0.7}
          pointColor={d => getPlatformColor(d.scoreDimensions)}
          pointResolution={6}
          labelsData={labelDevs}
          labelLat={d => d.lat}
          labelLng={d => d.lng}
          labelText={d => d.login}
          labelSize={d => 0.6 + (d.score / 100) * 0.4}
          labelColor={() => 'rgba(226, 232, 240, 0.75)'}
          labelDotRadius={0.3}
          labelAltitude={0.02}
          onPointHover={handleHover}
          onPointClick={handleClick}
        />
      </div>
      <div className="tooltip" ref={tooltipRef} />
    </>
  );
});

export default Globe;
