import React, { useEffect, useRef, useMemo, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import GlobeGL from 'react-globe.gl';
import { getPlatformColor } from '../utils/scoring.js';
import { formatNum } from '../utils/format.js';
import { extractCountry, countryKey } from './Leaderboard.jsx';

// Low-res Natural Earth countries (177 features).
// Pinned to an immutable commit so the data cannot change or disappear unexpectedly.
const GEOJSON_COMMIT = '507cfce3934e66349522bc80351d7a054e46ab6d';
const GEOJSON_PATH = 'example/datasets/ne_110m_admin_0_countries.geojson';
const COUNTRY_GEOJSON_URLS = [
  `https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@${GEOJSON_COMMIT}/${GEOJSON_PATH}`,
  `https://raw.githubusercontent.com/vasturiano/react-globe.gl/${GEOJSON_COMMIT}/${GEOJSON_PATH}`,
];

// Kept below the lowest developer point (0.01) so points stay hoverable
const POLYGON_ALTITUDE = 0.003;
const POLYGON_ALTITUDE_ACTIVE = 0.009;

// Score-based color gradient: blue → green → gold → red
function getScoreColor(score) {
  if (score >= 80) return '#fbbf24'; // gold — elite
  if (score >= 60) return '#34d399'; // emerald — strong
  if (score >= 40) return '#3b82f6'; // blue — solid
  return '#6366f1'; // indigo — emerging
}

function featureName(feat) {
  return feat?.properties?.ADMIN || feat?.properties?.NAME || '';
}

// Stable accessors — a new identity makes react-globe.gl rebuild the whole layer,
// and hovering a country re-renders this component.
const devLat = d => d.lat;
const devLng = d => d.lng;
const pointAltitude = d => 0.01 + (d.score / 100) * 0.06;
const pointRadius = d => 0.3 + (d.score / 100) * 0.7;
const pointColor = d => getScoreColor(d.score);
const ringMaxRadius = d => d.maxR;
const ringPropagationSpeed = d => d.propagationSpeed;
const ringRepeatPeriod = d => d.repeatPeriod;
const ringColor = d => () => d.color;
const labelText = d => d.login;
const labelSize = d => 0.6 + (d.score / 100) * 0.4;
const labelColor = () => 'rgba(226, 232, 240, 0.75)';
const noLabel = () => '';

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(area / 2);
}

// Biggest outer ring, so scattered countries (USA, Russia) target their mainland
function mainRing(geometry) {
  if (!geometry) return null;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let best = null;
  let bestArea = -1;
  for (const polygon of polygons) {
    const area = ringArea(polygon[0]);
    if (area > bestArea) {
      bestArea = area;
      best = polygon[0];
    }
  }
  return best;
}

// Centroid of a country plus a camera altitude that roughly frames it
function countryView(feat) {
  const ring = mainRing(feat?.geometry);
  if (!ring || ring.length < 3) return null;

  // Unwrap longitudes so rings crossing the antimeridian stay contiguous
  const lng0 = ring[0][0];
  const pts = ring.map(([lng, lat]) => [lng - 360 * Math.round((lng - lng0) / 360), lat]);

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    twiceArea += cross;
    cx += (pts[j][0] + pts[i][0]) * cross;
    cy += (pts[j][1] + pts[i][1]) * cross;
  }

  let lat;
  let lng;
  if (Math.abs(twiceArea) < 1e-9) {
    lng = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    lat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  } else {
    lng = cx / (3 * twiceArea);
    lat = cy / (3 * twiceArea);
  }
  lng = ((lng + 540) % 360) - 180;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [x, y] of pts) {
    if (y < minLat) minLat = y;
    if (y > maxLat) maxLat = y;
    if (x < minLng) minLng = x;
    if (x > maxLng) maxLng = x;
  }
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos(lat * Math.PI / 180));

  return { lat, lng, altitude: Math.min(2.2, Math.max(0.55, span / 40)) };
}

const Globe = forwardRef(function Globe({
  developers,
  flyTarget,
  selectedCountry,
  onSelectDev,
  onSelectCountry,
  onClearCountry,
}, ref) {
  const globeEl = useRef();
  const tooltipRef = useRef(null);
  const pointerDownPos = useRef(null);
  const [countryFeatures, setCountryFeatures] = useState([]);
  const [hoverCountry, setHoverCountry] = useState(null);

  const geoDevs = useMemo(() => {
    return developers
      .filter(d => d.lat != null && d.lng != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5000);
  }, [developers]);

  const labelDevs = useMemo(() => {
    return geoDevs.filter(d => d.score >= 80);
  }, [geoDevs]);

  // Pulsing rings for top 10 developers
  const ringsData = useMemo(() => {
    return geoDevs.slice(0, 10).map(d => ({
      lat: d.lat,
      lng: d.lng,
      maxR: 3,
      propagationSpeed: 2,
      repeatPeriod: 1200,
      color: getScoreColor(d.score),
      login: d.login,
    }));
  }, [geoDevs]);

  // Developers per country, keyed the same way the leaderboard filters
  const devCountByCountry = useMemo(() => {
    const counts = new Map();
    developers.forEach(d => {
      if (!d.location) return;
      const key = countryKey(extractCountry(d.location));
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [developers]);

  const selectedFeature = useMemo(() => {
    if (!selectedCountry) return null;
    const key = countryKey(selectedCountry);
    return countryFeatures.find(f => countryKey(featureName(f)) === key) || null;
  }, [selectedCountry, countryFeatures]);

  // Country borders — the globe still works if the CDN is unreachable
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of COUNTRY_GEOJSON_URLS) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const geo = await res.json();
          if (cancelled) return;
          setCountryFeatures((geo.features || []).filter(f => f.properties?.ISO_A2 !== 'AQ'));
          return;
        } catch {
          // try the next mirror
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      globeEl.current.pointOfView({ lat: flyTarget.lat, lng: flyTarget.lng, altitude: flyTarget.altitude ?? 1.5 }, 1000);
      const controls = globeEl.current.controls();
      if (controls) controls.autoRotate = false;
    }
  }, [flyTarget]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng) => {
      globeEl.current?.pointOfView({ lat, lng, altitude: 1.5 }, 1000);
    },
  }));

  const setAutoRotate = useCallback((on) => {
    const controls = globeEl.current?.controls();
    // Stay still while a country is in focus
    if (controls) controls.autoRotate = on && !selectedCountry;
  }, [selectedCountry]);

  const handleHover = useCallback((point) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

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
      setAutoRotate(false);
    } else {
      tooltip.classList.remove('visible');
      setAutoRotate(true);
    }
  }, [setAutoRotate]);

  const handleClick = useCallback((point) => {
    if (point) onSelectDev(point);
  }, [onSelectDev]);

  const polygonAltitude = useCallback((f) => (
    f === hoverCountry || f === selectedFeature ? POLYGON_ALTITUDE_ACTIVE : POLYGON_ALTITUDE
  ), [hoverCountry, selectedFeature]);

  const polygonCapColor = useCallback((f) => {
    if (f === selectedFeature) return 'rgba(251, 191, 36, 0.28)';
    if (f === hoverCountry) return 'rgba(96, 165, 250, 0.30)';
    return 'rgba(59, 130, 246, 0.05)';
  }, [hoverCountry, selectedFeature]);

  const polygonSideColor = useCallback((f) => (
    f === hoverCountry || f === selectedFeature ? 'rgba(96, 165, 250, 0.20)' : 'rgba(59, 130, 246, 0.06)'
  ), [hoverCountry, selectedFeature]);

  const polygonStrokeColor = useCallback((f) => {
    if (f === selectedFeature) return '#fbbf24';
    if (f === hoverCountry) return '#93c5fd';
    return 'rgba(148, 163, 184, 0.35)';
  }, [hoverCountry, selectedFeature]);

  const handleCountryHover = useCallback((feat) => {
    setHoverCountry(feat || null);
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    if (feat) {
      const name = featureName(feat);
      const safeName = String(name).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const count = devCountByCountry.get(countryKey(name)) || 0;
      tooltip.innerHTML = `
        <div class="tooltip__name">${safeName}</div>
        <div class="tooltip__score">${count ? `${formatNum(count)} developer${count === 1 ? '' : 's'}` : 'No developers yet'}</div>
        <div class="tooltip__meta"><span>Click to focus this country</span></div>
      `;
      tooltip.classList.add('visible');
      setAutoRotate(false);
    } else {
      tooltip.classList.remove('visible');
      setAutoRotate(true);
    }
  }, [devCountByCountry, setAutoRotate]);

  const handleCountryClick = useCallback((feat) => {
    if (!feat) return;
    onSelectCountry?.(featureName(feat), countryView(feat));
  }, [onSelectCountry]);

  // Ocean (globe surface not covered by a country polygon)
  const handleGlobeClick = useCallback(() => {
    onClearCountry?.();
  }, [onClearCountry]);

  const handlePointerDown = useCallback((e) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Empty space around the globe — globe.gl has no callback for it
  const handleContainerClick = useCallback((e) => {
    const down = pointerDownPos.current;
    pointerDownPos.current = null;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // camera drag
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = globeEl.current?.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (!coords) onClearCountry?.();
  }, [onClearCountry]);

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
      <div id="globe-container" onPointerDown={handlePointerDown} onClick={handleContainerClick}>
        <GlobeGL
          ref={globeEl}
          globeImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png"
          showAtmosphere={true}
          atmosphereColor="#3a7ecf"
          atmosphereAltitude={0.25}
          polygonsData={countryFeatures}
          polygonAltitude={polygonAltitude}
          polygonCapColor={polygonCapColor}
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={polygonStrokeColor}
          polygonLabel={noLabel}
          polygonsTransitionDuration={250}
          onPolygonHover={handleCountryHover}
          onPolygonClick={handleCountryClick}
          onGlobeClick={handleGlobeClick}
          pointsData={geoDevs}
          pointLat={devLat}
          pointLng={devLng}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointColor={pointColor}
          pointResolution={6}
          ringsData={ringsData}
          ringLat={devLat}
          ringLng={devLng}
          ringMaxRadius={ringMaxRadius}
          ringPropagationSpeed={ringPropagationSpeed}
          ringRepeatPeriod={ringRepeatPeriod}
          ringColor={ringColor}
          labelsData={labelDevs}
          labelLat={devLat}
          labelLng={devLng}
          labelText={labelText}
          labelSize={labelSize}
          labelColor={labelColor}
          labelDotRadius={0.3}
          labelAltitude={0.02}
          onPointHover={handleHover}
          onPointClick={handleClick}
        />
      </div>
      <div className="globe-legend">
        <span className="globe-legend__item"><span className="globe-legend__dot" style={{ background: '#fbbf24' }} />Elite (80+)</span>
        <span className="globe-legend__item"><span className="globe-legend__dot" style={{ background: '#34d399' }} />Strong (60+)</span>
        <span className="globe-legend__item"><span className="globe-legend__dot" style={{ background: '#3b82f6' }} />Solid (40+)</span>
        <span className="globe-legend__item"><span className="globe-legend__dot" style={{ background: '#6366f1' }} />Emerging</span>
      </div>
      <div className="tooltip" ref={tooltipRef} />
    </>
  );
});

export default Globe;
