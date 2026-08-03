import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { formatNum } from '../utils/format.js';

const ITEM_HEIGHT = 62;
const BUFFER = 10;

// Map common cities to their country for better filtering
const CITY_TO_COUNTRY = {
  'colombo': 'Sri Lanka', 'kandy': 'Sri Lanka', 'galle': 'Sri Lanka', 'jaffna': 'Sri Lanka',
  'bangalore': 'India', 'mumbai': 'India', 'delhi': 'India', 'hyderabad': 'India', 'pune': 'India', 'chennai': 'India', 'kolkata': 'India',
  'london': 'UK', 'manchester': 'UK', 'edinburgh': 'UK', 'birmingham': 'UK',
  'san francisco': 'USA', 'new york': 'USA', 'seattle': 'USA', 'austin': 'USA', 'los angeles': 'USA', 'boston': 'USA', 'chicago': 'USA',
  'toronto': 'Canada', 'vancouver': 'Canada', 'montreal': 'Canada',
  'berlin': 'Germany', 'munich': 'Germany', 'hamburg': 'Germany', 'frankfurt': 'Germany',
  'paris': 'France', 'lyon': 'France',
  'tokyo': 'Japan', 'osaka': 'Japan',
  'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia',
  'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China', 'hangzhou': 'China',
  'são paulo': 'Brazil', 'rio de janeiro': 'Brazil',
  'amsterdam': 'Netherlands',
  'stockholm': 'Sweden',
  'singapore': 'Singapore',
  'seoul': 'South Korea',
  'tel aviv': 'Israel',
  'istanbul': 'Turkey',
  'lagos': 'Nigeria',
  'nairobi': 'Kenya',
  'cape town': 'South Africa',
  'jakarta': 'Indonesia',
  'bangkok': 'Thailand',
  'kuala lumpur': 'Malaysia',
};

// Canonical names for the same country written differently by GitHub users and
// by the Natural Earth GeoJSON used for the globe polygons (properties.ADMIN).
const COUNTRY_ALIASES = {
  'united states of america': 'USA', 'united states': 'USA', 'usa': 'USA', 'us': 'USA',
  'u.s.': 'USA', 'u.s.a.': 'USA', 'america': 'USA',
  'united kingdom': 'UK', 'great britain': 'UK', 'england': 'UK', 'scotland': 'UK',
  'wales': 'UK', 'northern ireland': 'UK', 'uk': 'UK',
  'republic of korea': 'South Korea', 'korea': 'South Korea',
  'russian federation': 'Russia',
  'czechia': 'Czech Republic',
  "people's republic of china": 'China', 'prc': 'China',
  'republic of india': 'India',
  'deutschland': 'Germany',
  'brasil': 'Brazil',
  'españa': 'Spain', 'espana': 'Spain',
  'the netherlands': 'Netherlands', 'nederland': 'Netherlands', 'holland': 'Netherlands',
  'united arab emirates': 'UAE', 'uae': 'UAE',
  'viet nam': 'Vietnam',
  'islamic republic of iran': 'Iran',
  'united republic of tanzania': 'Tanzania',
  'democratic republic of the congo': 'DR Congo', 'republic of the congo': 'Congo',
  'türkiye': 'Turkey', 'turkiye': 'Turkey',
  'republic of serbia': 'Serbia',
  'bosnia and herzegovina': 'Bosnia',
  'hong kong s.a.r.': 'Hong Kong',
  'macedonia': 'North Macedonia',
};

export function normalizeCountry(name) {
  if (!name) return '';
  const trimmed = name.trim();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] || trimmed;
}

// Comparable form — use whenever two country names from different sources are matched
export function countryKey(name) {
  return normalizeCountry(name).toLowerCase();
}

export function extractCountry(location) {
  const parts = location.split(/[,\-–]/).map(s => s.trim());
  const lastPart = parts[parts.length - 1];

  // Check if last part is already a recognizable country
  if (lastPart && lastPart.length > 2) {
    // Normalize common abbreviations
    if (/^(US|USA|U\.S\.?A?\.?)$/i.test(lastPart)) return 'USA';
    if (/^(UK|United Kingdom|England|Scotland|Wales)$/i.test(lastPart)) return 'UK';
  }

  // If only one part (just a city), look up in city map
  if (parts.length === 1) {
    const mapped = CITY_TO_COUNTRY[lastPart.toLowerCase()];
    if (mapped) return mapped;
  }

  // Try matching last part against city map (e.g. "Colombo 02, Sri Lanka" → "Sri Lanka")
  const mapped = CITY_TO_COUNTRY[lastPart.toLowerCase()];
  if (mapped) return mapped;

  return lastPart;
}

export default function Leaderboard({
  developers,
  selectedLogin,
  onSelectDev,
  countryFilter = '',
  onCountryFilterChange,
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
                  <div className="lb-item__name">{dev.name || dev.login}</div>
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
