/**
 * Full Background Pipeline — Fetch GitHub + SO + Geocode → Insert into Cosmos DB
 *
 * Run and go to sleep:
 *   node scripts/pipeline-background.js > pipeline.log 2>&1
 *
 * Or on Windows:
 *   Start-Process -NoNewWindow -FilePath node -ArgumentList "scripts/pipeline-background.js" -RedirectStandardOutput pipeline.log -RedirectStandardError pipeline-err.log
 *
 * Progress is logged to pipeline.log. Check results in Cosmos DB when you wake up.
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

// ============ CONFIG ============
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SO_API_KEY = process.env.SO_API_KEY || '';
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || '';
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://devglobe-cosmos.documents.azure.com:443/';
const COSMOS_KEY = process.env.COSMOS_KEY;

if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN required'); process.exit(1); }
if (!COSMOS_KEY) { console.error('COSMOS_KEY required'); process.exit(1); }

const DATABASE_NAME = 'devglobe';
const CONTAINER_NAME = 'developers';
const LOG_FILE = 'pipeline.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

// ============ GITHUB FETCH ============
const GRAPHQL_URL = 'https://api.github.com/graphql';

const COUNTRY_QUERIES = [
  'United States', 'San Francisco', 'New York', 'Seattle', 'Los Angeles',
  'China', 'Beijing', 'Shanghai', 'Shenzhen',
  'India', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad',
  'United Kingdom', 'London',
  'Germany', 'Berlin', 'Munich',
  'Brazil', 'São Paulo', 'Rio de Janeiro',
  'Canada', 'Toronto', 'Vancouver',
  'France', 'Paris',
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
  'Austria', 'Vienna',
  'Portugal', 'Lisbon',
  'Czech Republic', 'Prague',
  'New Zealand', 'Auckland',
  'Thailand', 'Bangkok',
  'Pakistan', 'Karachi', 'Lahore',
  'Colombia', 'Bogota', 'Medellin',
  'Kenya', 'Nairobi',
  'South Africa', 'Cape Town', 'Johannesburg',
  'Egypt', 'Cairo',
  'Chile', 'Santiago',
  'Philippines', 'Manila',
  'Bangladesh', 'Dhaka',
  'Romania', 'Bucharest',
  'Hungary', 'Budapest',
  'Greece', 'Athens',
  'Malaysia', 'Kuala Lumpur',
  'Peru', 'Lima',
  'Sri Lanka', 'Colombo',
  'Morocco', 'Casablanca',
  'Ghana', 'Accra',
  'Ethiopia', 'Addis Ababa',
  'Nepal', 'Kathmandu'
];

async function graphql(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 403 || response.status === 429) {
    log('  Rate limited, waiting 60s...');
    await sleep(60000);
    return graphql(query, variables);
  }

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  if (data.errors) {
    // Partial data is OK — just log
    log(`  GraphQL warnings: ${data.errors[0]?.message}`);
  }
  return data.data;
}

async function fetchGitHubUsers(location, first = 20) {
  const gql = `
    query($query: String!, $first: Int!) {
      search(query: $query, type: USER, first: $first) {
        nodes {
          ... on User {
            login
            name
            avatarUrl
            location
            followers { totalCount }
            repositories(first: 5, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
              totalCount
              nodes {
                name
                stargazerCount
                forkCount
                primaryLanguage { name }
              }
            }
            contributionsCollection {
              totalCommitContributions
              restrictedContributionsCount
            }
          }
        }
      }
    }
  `;

  const query = `location:"${location}" followers:>100 repos:>5`;
  const data = await graphql(gql, { query, first });

  if (!data?.search?.nodes) return [];

  return data.search.nodes
    .filter(u => u && u.login) // Filter null/org nodes
    .map(u => {
      const repos = u.repositories?.nodes || [];
      return {
        login: u.login,
        name: u.name || u.login,
        avatarUrl: u.avatarUrl,
        location: u.location || location,
        followers: u.followers?.totalCount || 0,
        totalStars: repos.reduce((s, r) => s + (r?.stargazerCount || 0), 0),
        totalForks: repos.reduce((s, r) => s + (r?.forkCount || 0), 0),
        totalCommits: (u.contributionsCollection?.totalCommitContributions || 0) +
                      (u.contributionsCollection?.restrictedContributionsCount || 0),
        topLanguage: repos.find(r => r?.primaryLanguage)?.primaryLanguage?.name || null,
        topRepos: repos.slice(0, 3).map(r => ({
          name: r?.name, stars: r?.stargazerCount || 0, forks: r?.forkCount || 0
        }))
      };
    });
}

// ============ STACKOVERFLOW FETCH ============
async function fetchSOReputation(login) {
  if (!SO_API_KEY) return null;

  const url = `https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${encodeURIComponent(login)}&site=stackoverflow&key=${SO_API_KEY}&pagesize=1&filter=!nNPvSNVZJS`;

  try {
    const res = await fetch(url);
    if (res.status === 429) return null; // Skip on rate limit
    if (!res.ok) return null;

    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const user = data.items[0];
      return {
        soUserId: user.user_id,
        soReputation: user.reputation || 0,
        soAnswers: user.answer_count || 0,
        soAcceptRate: user.accept_rate || 0,
        soBadges: (user.badge_counts?.gold || 0) + (user.badge_counts?.silver || 0) + (user.badge_counts?.bronze || 0)
      };
    }
  } catch (e) { /* skip */ }
  return null;
}

// ============ GEOCODING ============
const geoCache = new Map();

async function geocodeLocation(location) {
  if (!location || !GEOCODE_API_KEY) return { lat: null, lng: null };
  if (geoCache.has(location)) return geoCache.get(location);

  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${GEOCODE_API_KEY}&limit=1&no_annotations=1`;
    const res = await fetch(url);
    if (!res.ok) { geoCache.set(location, { lat: null, lng: null }); return { lat: null, lng: null }; }

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      geoCache.set(location, { lat, lng });
      return { lat, lng };
    }
  } catch (e) { /* skip */ }

  geoCache.set(location, { lat: null, lng: null });
  return { lat: null, lng: null };
}

// ============ SCORING ============
function scoreDevs(developers) {
  const maxValues = {
    stars: Math.max(1, ...developers.map(d => d.totalStars || 0)),
    commits: Math.max(1, ...developers.map(d => d.totalCommits || 0)),
    repoReach: Math.max(1, ...developers.map(d => (d.totalForks || 0))),
    soReputation: Math.max(1, ...developers.map(d => d.soReputation || 0)),
    community: Math.max(1, ...developers.map(d => d.followers || 0))
  };

  return developers.map(dev => {
    const norm = (val, max) => Math.log(1 + val) / Math.log(1 + max);
    const dims = {
      stars: norm(dev.totalStars || 0, maxValues.stars),
      commits: norm(dev.totalCommits || 0, maxValues.commits),
      repoReach: norm(dev.totalForks || 0, maxValues.repoReach),
      soReputation: norm(dev.soReputation || 0, maxValues.soReputation),
      soEngagement: norm(((dev.soAcceptRate || 0) / 100) * (dev.soAnswers || 0), 1000),
      community: norm(dev.followers || 0, maxValues.community)
    };

    const score = Math.round(
      (dims.stars * 0.25 + dims.commits * 0.25 + dims.repoReach * 0.20 +
       dims.soReputation * 0.15 + dims.soEngagement * 0.10 + dims.community * 0.05) * 100
    );

    return { ...dev, score, scoreDimensions: dims };
  });
}

// ============ UTILITIES ============
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ MAIN PIPELINE ============
async function main() {
  const startTime = Date.now();
  log('═══════════════════════════════════════════');
  log('  DevGlobe Full Pipeline → Cosmos DB');
  log('═══════════════════════════════════════════');

  mkdirSync('data', { recursive: true });

  // STEP 1: Fetch GitHub data
  log('\n📡 STEP 1: Fetching GitHub developers...');
  const allDevs = new Map();

  for (let i = 0; i < COUNTRY_QUERIES.length; i++) {
    const location = COUNTRY_QUERIES[i];
    log(`  [${i + 1}/${COUNTRY_QUERIES.length}] Searching: ${location}`);

    try {
      const users = await fetchGitHubUsers(location);
      users.forEach(u => {
        if (!allDevs.has(u.login)) {
          allDevs.set(u.login, u);
        }
      });
      log(`    Found ${users.length} users (total unique: ${allDevs.size})`);
    } catch (err) {
      log(`    ❌ Error: ${err.message}`);
    }

    await sleep(2000); // Respect GitHub rate limits
  }

  log(`\n  ✅ GitHub fetch complete: ${allDevs.size} unique developers`);

  // STEP 2: Enrich with StackOverflow
  log('\n📡 STEP 2: Fetching StackOverflow data...');
  let soEnriched = 0;
  const devList = [...allDevs.values()];

  for (let i = 0; i < devList.length; i++) {
    const dev = devList[i];
    // Only try ASCII logins (SO search doesn't handle non-ASCII well)
    if (/^[a-zA-Z0-9_-]+$/.test(dev.login)) {
      const soData = await fetchSOReputation(dev.login);
      if (soData) {
        Object.assign(dev, soData);
        soEnriched++;
      }
    }

    // Default SO fields
    dev.soUserId = dev.soUserId || null;
    dev.soReputation = dev.soReputation || 0;
    dev.soAnswers = dev.soAnswers || 0;
    dev.soAcceptRate = dev.soAcceptRate || 0;
    dev.soBadges = dev.soBadges || 0;

    if ((i + 1) % 50 === 0) {
      log(`  Progress: ${i + 1}/${devList.length} (enriched: ${soEnriched})`);
    }
    await sleep(350); // SO rate limit: ~3/sec with key
  }

  log(`  ✅ SO enrichment complete: ${soEnriched} profiles matched`);

  // STEP 3: Geocode locations
  log('\n📡 STEP 3: Geocoding locations...');
  let geocoded = 0;

  for (let i = 0; i < devList.length; i++) {
    const dev = devList[i];
    const { lat, lng } = await geocodeLocation(dev.location);
    dev.lat = lat;
    dev.lng = lng;
    if (lat) geocoded++;

    if ((i + 1) % 50 === 0) {
      log(`  Progress: ${i + 1}/${devList.length} (geocoded: ${geocoded})`);
    }

    // Only sleep if not cached (OpenCage: 1 req/sec on free tier)
    if (!geoCache.has(dev.location)) {
      await sleep(1100);
    }
  }

  log(`  ✅ Geocoding complete: ${geocoded}/${devList.length} locations resolved`);

  // STEP 4: Score
  log('\n📊 STEP 4: Computing scores...');
  const scored = scoreDevs(devList);
  scored.sort((a, b) => b.score - a.score);

  // Save locally as backup
  writeFileSync('data/developers.json', JSON.stringify(scored, null, 2));
  log(`  ✅ Saved data/developers.json (${scored.length} developers)`);

  // STEP 5: Upload to Cosmos DB
  log('\n☁️  STEP 5: Uploading to Cosmos DB...');
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  let uploaded = 0;
  let errors = 0;
  const batchSize = 25;

  for (let i = 0; i < scored.length; i += batchSize) {
    const batch = scored.slice(i, i + batchSize);
    const promises = batch.map(async (dev) => {
      const doc = { ...dev, id: dev.login, location: dev.location || 'Unknown' };
      try {
        await container.items.upsert(doc);
        uploaded++;
      } catch (err) {
        errors++;
        if (errors <= 3) log(`  ❌ ${dev.login}: ${err.message}`);
      }
    });

    await Promise.all(promises);

    if ((i + batchSize) % 100 === 0 || i + batchSize >= scored.length) {
      log(`  Uploaded: ${uploaded}/${scored.length}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  log('\n═══════════════════════════════════════════');
  log(`  ✅ PIPELINE COMPLETE in ${elapsed} minutes`);
  log(`  Developers: ${scored.length}`);
  log(`  SO enriched: ${soEnriched}`);
  log(`  Geocoded: ${geocoded}`);
  log(`  Cosmos DB: ${uploaded} uploaded, ${errors} errors`);
  log('═══════════════════════════════════════════');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
