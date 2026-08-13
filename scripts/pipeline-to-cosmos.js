/**
 * Full Pipeline Background Job — Fetches GitHub + SO + Geocode + Score → Cosmos DB
 *
 * Runs entirely in the background. Logs progress to data/pipeline.log
 * Usage: node scripts/pipeline-to-cosmos.js
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { scoreAll } from '../lib/scoring.js';

// ─── Config ─────────────────────────────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SO_API_KEY = process.env.SO_API_KEY || '';
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || '';
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://devglobe-cosmos.documents.azure.com:443/';
const COSMOS_KEY = process.env.COSMOS_KEY;

const LOG_FILE = 'data/pipeline.log';
mkdirSync('data', { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

if (!GITHUB_TOKEN) { log('ERROR: GITHUB_TOKEN required'); process.exit(1); }
if (!COSMOS_KEY) { log('ERROR: COSMOS_KEY required'); process.exit(1); }

// ─── GitHub Fetch ───────────────────────────────────────────────────────────
const GRAPHQL_URL = 'https://api.github.com/graphql';

const COUNTRY_QUERIES = [
  'United States', 'USA', 'San Francisco', 'New York', 'Seattle', 'Los Angeles', 'Austin', 'Boston', 'Chicago',
  'China', 'Beijing', 'Shanghai', 'Shenzhen', 'Hangzhou',
  'India', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad',
  'United Kingdom', 'London', 'Manchester',
  'Germany', 'Berlin', 'Munich', 'Hamburg',
  'Brazil', 'São Paulo', 'Rio de Janeiro',
  'Canada', 'Toronto', 'Vancouver', 'Montreal',
  'France', 'Paris', 'Lyon',
  'Japan', 'Tokyo', 'Osaka',
  'Australia', 'Sydney', 'Melbourne',
  'Russia', 'Moscow', 'Saint Petersburg',
  'Netherlands', 'Amsterdam',
  'Sweden', 'Stockholm',
  'South Korea', 'Seoul',
  'Israel', 'Tel Aviv',
  'Singapore',
  'Poland', 'Warsaw', 'Krakow',
  'Spain', 'Barcelona', 'Madrid',
  'Italy', 'Milan', 'Rome',
  'Switzerland', 'Zurich',
  'Indonesia', 'Jakarta',
  'Turkey', 'Istanbul',
  'Nigeria', 'Lagos',
  'Argentina', 'Buenos Aires',
  'Ukraine', 'Kyiv',
  'Vietnam', 'Ho Chi Minh',
  'Taiwan', 'Taipei',
  'Mexico', 'Mexico City',
  'Ireland', 'Dublin',
  'Finland', 'Helsinki',
  'Denmark', 'Copenhagen',
  'Norway', 'Oslo',
  'Portugal', 'Lisbon',
  'Austria', 'Vienna',
  'Czech Republic', 'Prague',
  'Pakistan', 'Karachi', 'Lahore',
  'Bangladesh', 'Dhaka',
  'Kenya', 'Nairobi',
  'South Africa', 'Cape Town', 'Johannesburg',
  'Egypt', 'Cairo',
  'Colombia', 'Bogota',
  'Chile', 'Santiago',
  'Philippines', 'Manila',
  'Thailand', 'Bangkok',
  'Malaysia', 'Kuala Lumpur',
  'New Zealand', 'Auckland',
];

async function graphql(query, variables = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 502 || response.status === 503) {
      const wait = (attempt + 1) * 5;
      log(`    ⏳ GitHub ${response.status}, retrying in ${wait}s (attempt ${attempt + 1}/3)`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (response.status === 403) {
      const reset = response.headers.get('x-ratelimit-reset');
      const waitSec = reset ? Math.max(0, parseInt(reset) - Math.floor(Date.now() / 1000)) + 5 : 60;
      log(`    ⏳ Rate limited, waiting ${waitSec}s...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data = await response.json();
    if (data.errors && !data.data) throw new Error(`GraphQL: ${data.errors[0]?.message}`);
    return data.data;
  }
  throw new Error('GitHub API failed after 3 retries');
}

async function searchGitHubUsers(query, first = 50) {
  const gql = `
    query($query: String!, $first: Int!, $after: String) {
      search(query: $query, type: USER, first: $first, after: $after) {
        nodes { ... on User {
          login name avatarUrl location
          followers { totalCount }
          repositories(first: 5, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
            totalCount
            nodes { name stargazerCount forkCount primaryLanguage { name } }
          }
          contributionsCollection { totalCommitContributions restrictedContributionsCount }
        }}
        pageInfo { hasNextPage endCursor }
      }
    }`;

  const allNodes = [];
  let after = null;
  const batchSize = 20;

  for (let page = 0; page < Math.ceil(first / batchSize); page++) {
    try {
      const data = await graphql(gql, { query: `type:user ${query}`, first: Math.min(batchSize, first - allNodes.length), after });
      const nodes = (data.search.nodes || []).filter(n => n && n.login);
      allNodes.push(...nodes);
      if (!data.search.pageInfo.hasNextPage || allNodes.length >= first) break;
      after = data.search.pageInfo.endCursor;
    } catch (err) {
      log(`    ⚠ Search page failed: ${err.message.slice(0, 60)}`);
      // Continue to next page instead of breaking
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return allNodes;
}

function processUser(user) {
  const repos = user.repositories.nodes || [];
  const totalStars = repos.reduce((s, r) => s + (r.stargazerCount || 0), 0);
  const totalForks = repos.reduce((s, r) => s + (r.forkCount || 0), 0);
  const langCounts = {};
  repos.forEach(r => { const l = r.primaryLanguage?.name; if (l) langCounts[l] = (langCounts[l] || 0) + 1; });
  const topLanguage = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalLangRepos = Object.values(langCounts).reduce((s, v) => s + v, 0) || 1;
  const languages = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([name, count]) => ({ name, percent: Math.round((count / totalLangRepos) * 100) }));
  const totalCommits = (user.contributionsCollection?.totalCommitContributions || 0) +
    (user.contributionsCollection?.restrictedContributionsCount || 0);

  return {
    login: user.login, name: user.name, avatarUrl: user.avatarUrl,
    location: user.location || 'Unknown', followers: user.followers?.totalCount || 0,
    totalStars, totalCommits, totalForks, totalWatchers: totalForks,
    topLanguage, languages,
    topRepos: repos.slice(0, 5).map(r => ({ name: r.name, stars: r.stargazerCount, forks: r.forkCount }))
  };
}

// ─── StackOverflow Fetch ────────────────────────────────────────────────────
async function fetchSOUser(searchTerm) {
  const params = new URLSearchParams({
    order: 'desc', sort: 'reputation', inname: searchTerm,
    site: 'stackoverflow', pagesize: '5', filter: '!LnNkvq0d-S*U.QkZOE2'
  });
  if (SO_API_KEY) params.set('key', SO_API_KEY);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.stackexchange.com/2.3/users?${params}`);
    if (response.status === 429) {
      const wait = Math.pow(2, attempt + 1) * 15;
      log(`    Rate limited, waiting ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!response.ok) return [];
    const data = await response.json();
    if (data.backoff) await new Promise(r => setTimeout(r, data.backoff * 1000));
    return data.items || [];
  }
  return [];
}

function bestSOMatch(soUsers, ghUser) {
  if (!soUsers.length) return null;
  const match = soUsers.find(u =>
    u.display_name.toLowerCase() === (ghUser.name || '').toLowerCase() ||
    u.display_name.toLowerCase() === ghUser.login.toLowerCase()
  );
  if (match) return match;
  const partial = soUsers.find(u =>
    u.reputation > 5000 && (
      u.display_name.toLowerCase().includes(ghUser.login.toLowerCase()) ||
      (ghUser.name && u.display_name.toLowerCase().includes(ghUser.name.split(' ')[0].toLowerCase()))
    )
  );
  return partial || null;
}

// ─── Geocoding ──────────────────────────────────────────────────────────────
let geocodeCache = {};
const CACHE_FILE = 'data/geocode-cache.json';
if (existsSync(CACHE_FILE)) {
  try { geocodeCache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch {}
}

const KNOWN_LOCATIONS = {
  'san francisco': { lat: 37.7749, lng: -122.4194 }, 'sf': { lat: 37.7749, lng: -122.4194 },
  'new york': { lat: 40.7128, lng: -74.0060 }, 'nyc': { lat: 40.7128, lng: -74.0060 },
  'london': { lat: 51.5074, lng: -0.1278 }, 'berlin': { lat: 52.5200, lng: 13.4050 },
  'tokyo': { lat: 35.6762, lng: 139.6503 }, 'paris': { lat: 48.8566, lng: 2.3522 },
  'seattle': { lat: 47.6062, lng: -122.3321 }, 'bangalore': { lat: 12.9716, lng: 77.5946 },
  'singapore': { lat: 1.3521, lng: 103.8198 }, 'toronto': { lat: 43.6532, lng: -79.3832 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 }, 'sydney': { lat: -33.8688, lng: 151.2093 },
  'mountain view': { lat: 37.3861, lng: -122.0839 }, 'portland': { lat: 45.5155, lng: -122.6789 },
  'austin': { lat: 30.2672, lng: -97.7431 }, 'beijing': { lat: 39.9042, lng: 116.4074 },
  'shanghai': { lat: 31.2304, lng: 121.4737 }, 'mumbai': { lat: 19.0760, lng: 72.8777 },
  'stockholm': { lat: 59.3293, lng: 18.0686 }, 'zurich': { lat: 47.3769, lng: 8.5417 },
  'vancouver': { lat: 49.2827, lng: -123.1207 }, 'chicago': { lat: 41.8781, lng: -87.6298 },
  'los angeles': { lat: 34.0522, lng: -118.2437 }, 'boston': { lat: 42.3601, lng: -71.0589 },
  'barcelona': { lat: 41.3874, lng: 2.1686 }, 'helsinki': { lat: 60.1699, lng: 24.9384 },
  'oslo': { lat: 59.9139, lng: 10.7522 }, 'copenhagen': { lat: 55.6761, lng: 12.5683 },
  'dublin': { lat: 53.3498, lng: -6.2603 }, 'bangkok': { lat: 13.7563, lng: 100.5018 },
  'munich': { lat: 48.1351, lng: 11.5820 }, 'seoul': { lat: 37.5665, lng: 126.9780 },
  'tel aviv': { lat: 32.0853, lng: 34.7818 }, 'moscow': { lat: 55.7558, lng: 37.6173 },
  'são paulo': { lat: -23.5505, lng: -46.6333 }, 'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'istanbul': { lat: 41.0082, lng: 28.9784 }, 'lagos': { lat: 6.5244, lng: 3.3792 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 }, 'kyiv': { lat: 50.4501, lng: 30.5234 },
  'taipei': { lat: 25.0330, lng: 121.5654 }, 'mexico city': { lat: 19.4326, lng: -99.1332 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 }, 'manila': { lat: 14.5995, lng: 120.9842 },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 }, 'jakarta': { lat: -6.2088, lng: 106.8456 },
  'nairobi': { lat: -1.2921, lng: 36.8219 }, 'cape town': { lat: -33.9249, lng: 18.4241 },
  'cairo': { lat: 30.0444, lng: 31.2357 }, 'prague': { lat: 50.0755, lng: 14.4378 },
  'vienna': { lat: 48.2082, lng: 16.3738 }, 'warsaw': { lat: 52.2297, lng: 21.0122 },
  'lisbon': { lat: 38.7223, lng: -9.1393 }, 'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'delhi': { lat: 28.7041, lng: 77.1025 }, 'shenzhen': { lat: 22.5431, lng: 114.0579 },
  'usa': { lat: 39.8283, lng: -98.5795 }, 'united states': { lat: 39.8283, lng: -98.5795 },
  'uk': { lat: 55.3781, lng: -3.4360 }, 'united kingdom': { lat: 55.3781, lng: -3.4360 },
  'germany': { lat: 51.1657, lng: 10.4515 }, 'france': { lat: 46.2276, lng: 2.2137 },
  'japan': { lat: 36.2048, lng: 138.2529 }, 'china': { lat: 35.8617, lng: 104.1954 },
  'india': { lat: 20.5937, lng: 78.9629 }, 'brazil': { lat: -14.2350, lng: -51.9253 },
  'australia': { lat: -25.2744, lng: 133.7751 }, 'canada': { lat: 56.1304, lng: -106.3468 },
  'south korea': { lat: 35.9078, lng: 127.7669 }, 'israel': { lat: 31.0461, lng: 34.8516 },
  'spain': { lat: 40.4637, lng: -3.7492 }, 'italy': { lat: 41.8719, lng: 12.5674 },
  'netherlands': { lat: 52.1326, lng: 5.2913 }, 'sweden': { lat: 60.1282, lng: 18.6435 },
  'poland': { lat: 51.9194, lng: 19.1451 }, 'switzerland': { lat: 46.8182, lng: 8.2275 },
};

async function geocode(location) {
  if (!location) return null;
  const normalized = location.trim().toLowerCase();
  if (geocodeCache[normalized]) return geocodeCache[normalized];

  // Check known locations
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized.includes(key)) {
      geocodeCache[normalized] = coords;
      return coords;
    }
  }

  // Use OpenCage API
  if (GEOCODE_API_KEY) {
    try {
      const params = new URLSearchParams({ q: location, key: GEOCODE_API_KEY, limit: '1', no_annotations: '1' });
      const resp = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results?.length > 0) {
          const { lat, lng } = data.results[0].geometry;
          geocodeCache[normalized] = { lat, lng };
          return { lat, lng };
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1100)); // OpenCage free: 1 req/sec
  }

  return null;
}

// ─── Cosmos DB Upload ───────────────────────────────────────────────────────
async function uploadToCosmos(developers) {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database('devglobe').container('developers');

  let uploaded = 0, errors = 0;
  const batchSize = 25;

  for (let i = 0; i < developers.length; i += batchSize) {
    const batch = developers.slice(i, i + batchSize);
    await Promise.all(batch.map(async dev => {
      try {
        await container.items.upsert({ ...dev, id: dev.login, location: dev.location || 'Unknown' });
        uploaded++;
      } catch (err) {
        errors++;
        if (errors <= 3) log(`  ❌ Upload failed for ${dev.login}: ${err.message.slice(0, 60)}`);
      }
    }));
    if (i % 100 === 0) log(`  Cosmos upload progress: ${uploaded}/${developers.length}`);
  }

  return { uploaded, errors };
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────
async function main() {
  writeFileSync(LOG_FILE, ''); // Clear log
  log('═══════════════════════════════════════════════════════════');
  log('  DevGlobe Full Pipeline → Cosmos DB');
  log('═══════════════════════════════════════════════════════════');

  // STEP 1: Fetch GitHub developers
  log('\n📌 STEP 1: Fetching GitHub developers...');
  const allUsers = new Map();

  // Global top developers
  for (const q of ['followers:>10000', 'repos:>100 followers:>5000']) {
    log(`  Global: ${q}`);
    try {
      const users = await searchGitHubUsers(q, 100);
      users.forEach(u => { if (!allUsers.has(u.login)) allUsers.set(u.login, processUser(u)); });
      log(`    → ${users.length} found (total: ${allUsers.size})`);
    } catch (err) { log(`    ⚠ ${err.message.slice(0, 60)}`); }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Per-country search
  for (const location of COUNTRY_QUERIES) {
    const q = `followers:>500 location:"${location}"`;
    log(`  ${location}...`);
    try {
      const users = await searchGitHubUsers(q, 50);
      users.forEach(u => { if (!allUsers.has(u.login)) allUsers.set(u.login, processUser(u)); });
      log(`    → ${users.length} found (total: ${allUsers.size})`);
    } catch (err) { log(`    ⚠ ${err.message.slice(0, 60)}`); }
    await new Promise(r => setTimeout(r, 2500));
  }

  let developers = [...allUsers.values()].sort((a, b) => b.totalStars - a.totalStars);
  log(`\n✓ GitHub: ${developers.length} developers fetched`);

  // STEP 2: Enrich with StackOverflow
  log('\n📌 STEP 2: Enriching with StackOverflow data...');
  let soMatched = 0;
  for (let i = 0; i < developers.length; i++) {
    const dev = developers[i];
    const searchTerm = dev.name || dev.login;

    // Skip non-ASCII names
    if (!/^[\x20-\x7E]+$/.test(searchTerm)) {
      developers[i] = { ...dev, soUserId: null, soReputation: 0, soAnswers: 0, soAcceptRate: 0, soBadges: 0 };
      continue;
    }

    try {
      const soUsers = await fetchSOUser(searchTerm);
      const match = bestSOMatch(soUsers, dev);
      if (match) {
        soMatched++;
        developers[i] = {
          ...dev, soUserId: match.user_id, soReputation: match.reputation || 0,
          soAnswers: match.answer_count || 0, soAcceptRate: match.accept_rate || 0,
          soBadges: (match.badge_counts?.gold || 0) + (match.badge_counts?.silver || 0) + (match.badge_counts?.bronze || 0)
        };
      } else {
        developers[i] = { ...dev, soUserId: null, soReputation: 0, soAnswers: 0, soAcceptRate: 0, soBadges: 0 };
      }
    } catch {
      developers[i] = { ...dev, soUserId: null, soReputation: 0, soAnswers: 0, soAcceptRate: 0, soBadges: 0 };
    }

    if ((i + 1) % 50 === 0) log(`  SO progress: ${i + 1}/${developers.length} (matched: ${soMatched})`);
    await new Promise(r => setTimeout(r, SO_API_KEY ? 400 : 2000));
  }
  log(`✓ StackOverflow: ${soMatched} matched out of ${developers.length}`);

  // STEP 3: Geocode locations
  log('\n📌 STEP 3: Geocoding locations...');
  let geoCount = 0;
  const uniqueLocations = [...new Set(developers.map(d => d.location).filter(Boolean))];
  log(`  ${uniqueLocations.length} unique locations to geocode`);

  for (let i = 0; i < developers.length; i++) {
    const coords = await geocode(developers[i].location);
    if (coords) {
      developers[i].lat = coords.lat;
      developers[i].lng = coords.lng;
      geoCount++;
    } else {
      developers[i].lat = null;
      developers[i].lng = null;
    }
    if ((i + 1) % 100 === 0) log(`  Geocode progress: ${i + 1}/${developers.length} (resolved: ${geoCount})`);
  }

  // Save geocode cache
  writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
  log(`✓ Geocoding: ${geoCount}/${developers.length} locations resolved`);

  // STEP 4: Score
  log('\n📌 STEP 4: Computing scores...');
  developers = scoreAll(developers);
  log(`✓ Scored ${developers.length} developers (top score: ${developers[0]?.score})`);

  // Save local copy
  writeFileSync('data/developers.json', JSON.stringify(developers, null, 2));
  log(`✓ Saved data/developers.json`);

  // STEP 5: Upload to Cosmos DB
  log('\n📌 STEP 5: Uploading to Cosmos DB...');
  const { uploaded, errors } = await uploadToCosmos(developers);
  log(`✓ Cosmos DB: ${uploaded} uploaded, ${errors} errors`);

  log('\n═══════════════════════════════════════════════════════════');
  log(`  PIPELINE COMPLETE — ${developers.length} developers in Cosmos DB`);
  log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
