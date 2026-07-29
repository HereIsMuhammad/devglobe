/**
 * Geocode developer locations to lat/lng coordinates
 *
 * Usage: GEOCODE_API_KEY=xxx node scripts/geocode.js
 * Input: data/github-so-merged.json
 * Output: data/github-so-geo.json
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY;
const GEOCODE_URL = 'https://api.opencagedata.com/geocode/v1/json';

// Cache to avoid redundant lookups for same location string
let geocodeCache = {};
const CACHE_FILE = 'data/geocode-cache.json';

if (existsSync(CACHE_FILE)) {
  try {
    geocodeCache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`Loaded ${Object.keys(geocodeCache).length} cached locations`);
  } catch { /* ignore */ }
}

async function geocodeLocation(location) {
  if (!location) return null;

  const normalized = location.trim().toLowerCase();
  if (geocodeCache[normalized]) return geocodeCache[normalized];

  if (!GEOCODE_API_KEY) {
    // Fallback: try to match known cities/countries
    return fallbackGeocode(normalized);
  }

  const params = new URLSearchParams({
    q: location,
    key: GEOCODE_API_KEY,
    limit: '1',
    no_annotations: '1'
  });

  const response = await fetch(`${GEOCODE_URL}?${params}`);
  if (!response.ok) {
    console.error(`  Geocode API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  if (data.results && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry;
    const result = { lat, lng };
    geocodeCache[normalized] = result;
    return result;
  }

  return null;
}

// Basic fallback geocoding for common developer locations
function fallbackGeocode(location) {
  const KNOWN_LOCATIONS = {
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'sf': { lat: 37.7749, lng: -122.4194 },
    'new york': { lat: 40.7128, lng: -74.0060 },
    'nyc': { lat: 40.7128, lng: -74.0060 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'berlin': { lat: 52.5200, lng: 13.4050 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'amsterdam': { lat: 52.3676, lng: 4.9041 },
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'mountain view': { lat: 37.3861, lng: -122.0839 },
    'portland': { lat: 45.5155, lng: -122.6789 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'beijing': { lat: 39.9042, lng: 116.4074 },
    'shanghai': { lat: 31.2304, lng: 121.4737 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'stockholm': { lat: 59.3293, lng: 18.0686 },
    'zurich': { lat: 47.3769, lng: 8.5417 },
    'vancouver': { lat: 49.2827, lng: -123.1207 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'barcelona': { lat: 41.3874, lng: 2.1686 },
    'helsinki': { lat: 60.1699, lng: 24.9384 },
    'oslo': { lat: 59.9139, lng: 10.7522 },
    'copenhagen': { lat: 55.6761, lng: 12.5683 },
    'dublin': { lat: 53.3498, lng: -6.2603 },
    'bangkok': { lat: 13.7563, lng: 100.5018 },
    'osaka': { lat: 34.6937, lng: 135.5023 },
    'usa': { lat: 39.8283, lng: -98.5795 },
    'uk': { lat: 55.3781, lng: -3.4360 },
    'germany': { lat: 51.1657, lng: 10.4515 },
    'france': { lat: 46.2276, lng: 2.2137 },
    'japan': { lat: 36.2048, lng: 138.2529 },
    'china': { lat: 35.8617, lng: 104.1954 },
    'india': { lat: 20.5937, lng: 78.9629 },
    'brazil': { lat: -14.2350, lng: -51.9253 },
    'australia': { lat: -25.2744, lng: 133.7751 },
    'canada': { lat: 56.1304, lng: -106.3468 }
  };

  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (location.includes(key)) {
      geocodeCache[location] = coords;
      return coords;
    }
  }

  return null;
}

async function main() {
  console.log('Geocoding developer locations...\n');

  let developers;
  try {
    developers = JSON.parse(readFileSync('data/github-so-merged.json', 'utf-8'));
  } catch {
    console.error('Error: data/github-so-merged.json not found.');
    console.error('Run fetch-github.js and fetch-stackoverflow.js first.');
    process.exit(1);
  }

  let geocoded = 0;
  const result = [];

  for (const dev of developers) {
    if (dev.lat && dev.lng) {
      // Already has coordinates
      result.push(dev);
      geocoded++;
      continue;
    }

    const coords = await geocodeLocation(dev.location);
    if (coords) {
      result.push({ ...dev, lat: coords.lat, lng: coords.lng });
      geocoded++;
      console.log(`  ✓ ${dev.login}: ${dev.location} → (${coords.lat}, ${coords.lng})`);
    } else {
      // Assign random visible location so they still appear on globe
      const randomLat = (Math.random() - 0.5) * 120;
      const randomLng = (Math.random() - 0.5) * 300;
      result.push({ ...dev, lat: randomLat, lng: randomLng });
      console.log(`  ✗ ${dev.login}: "${dev.location}" - using random position`);
    }

    // Rate limit: OpenCage free tier is 1 req/sec
    if (GEOCODE_API_KEY) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  // Save cache
  writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));

  // Save result
  writeFileSync('data/github-so-geo.json', JSON.stringify(result, null, 2));
  console.log(`\nGeocoded ${geocoded}/${developers.length} developers.`);
  console.log('Saved to data/github-so-geo.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
