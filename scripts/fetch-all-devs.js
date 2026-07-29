/**
 * Fetch ALL top developers — aggressive pagination + multiple strategies
 *
 * Uses GitHub REST Search API (100 results/page, 1000 max per query)
 * Then enriches with GraphQL for detailed stats.
 * Resumable — saves progress after each batch.
 *
 * Run: node scripts/fetch-all-devs.js > fetch-all.log 2>&1
 */
import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN required'); process.exit(1); }

const PROGRESS_FILE = 'data/fetch-progress.json';
const OUTPUT_FILE = 'data/github-raw.json';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ LOCATIONS — Comprehensive list ============
const LOCATIONS = [
  // USA
  'San Francisco', 'New York', 'Seattle', 'Los Angeles', 'Austin',
  'Boston', 'Chicago', 'Denver', 'Portland', 'Washington DC',
  'Atlanta', 'Miami', 'Dallas', 'Minneapolis', 'Phoenix',
  'San Jose', 'San Diego', 'Philadelphia', 'Houston', 'Raleigh',
  // China
  'Beijing', 'Shanghai', 'Shenzhen', 'Hangzhou', 'Guangzhou',
  'Chengdu', 'Nanjing', 'Wuhan', "Xi'an", 'Suzhou',
  // India
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi',
  // Europe
  'London', 'Berlin', 'Paris', 'Amsterdam', 'Munich',
  'Barcelona', 'Madrid', 'Stockholm', 'Dublin', 'Zurich',
  'Milan', 'Vienna', 'Prague', 'Warsaw', 'Helsinki',
  'Copenhagen', 'Oslo', 'Lisbon', 'Brussels', 'Hamburg',
  'Frankfurt', 'Lyon', 'Edinburgh', 'Manchester', 'Birmingham',
  'Bucharest', 'Budapest', 'Athens', 'Krakow', 'Tallinn',
  // Canada
  'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary',
  // Brazil
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre',
  // Japan & Korea
  'Tokyo', 'Osaka', 'Kyoto', 'Fukuoka', 'Seoul', 'Busan',
  // Australia & NZ
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Auckland', 'Wellington',
  // Southeast Asia
  'Singapore', 'Jakarta', 'Bangkok', 'Ho Chi Minh', 'Kuala Lumpur',
  'Manila', 'Hanoi',
  // Middle East
  'Tel Aviv', 'Istanbul', 'Dubai', 'Riyadh', 'Cairo',
  // Africa
  'Lagos', 'Nairobi', 'Cape Town', 'Johannesburg', 'Accra',
  'Addis Ababa', 'Dar es Salaam', 'Kigali',
  // South America
  'Buenos Aires', 'Santiago', 'Bogota', 'Medellin', 'Lima',
  'Mexico City', 'Guadalajara', 'Monterrey',
  // Other Asia
  'Taipei', 'Dhaka', 'Lahore', 'Karachi', 'Colombo',
  'Kathmandu',
  // Russia & Eastern Europe
  'Moscow', 'Saint Petersburg', 'Kyiv', 'Minsk',
  // Country-level queries for broader coverage
  'United States', 'China', 'India', 'Germany', 'United Kingdom',
  'France', 'Brazil', 'Canada', 'Japan', 'Australia',
  'Netherlands', 'Sweden', 'Switzerland', 'Israel', 'South Korea',
  'Russia', 'Poland', 'Spain', 'Italy', 'Indonesia',
  'Turkey', 'Nigeria', 'Argentina', 'Ukraine', 'Vietnam',
  'Taiwan', 'Mexico', 'Ireland', 'Finland', 'Denmark',
  'Norway', 'Austria', 'Portugal', 'Czech Republic', 'Romania',
  'Hungary', 'Greece', 'Thailand', 'Malaysia', 'Philippines',
  'Pakistan', 'Bangladesh', 'Colombia', 'Kenya', 'South Africa',
  'Egypt', 'Chile', 'Peru', 'Morocco', 'Ghana', 'Ethiopia',
  'Sri Lanka', 'Nepal', 'Singapore', 'New Zealand'
];

// Multiple follower thresholds to get more depth
const FOLLOWER_THRESHOLDS = [
  { min: 500, sort: 'followers' },
  { min: 100, sort: 'followers' },
  { min: 50, sort: 'repositories' },
];

// ============ REST API Search ============
async function searchUsersREST(query, page = 1, perPage = 100) {
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(query)}&sort=followers&order=desc&per_page=${perPage}&page=${page}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  // Handle rate limiting
  const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '10');
  if (remaining < 3) {
    const resetTime = parseInt(res.headers.get('x-ratelimit-reset') || '0') * 1000;
    const waitMs = Math.max(0, resetTime - Date.now()) + 1000;
    log(`  ⏳ Rate limit low (${remaining}), waiting ${(waitMs/1000).toFixed(0)}s...`);
    await sleep(waitMs);
  }

  if (res.status === 403 || res.status === 429) {
    const resetTime = parseInt(res.headers.get('x-ratelimit-reset') || '0') * 1000;
    const waitMs = Math.max(60000, resetTime - Date.now()) + 1000;
    log(`  ⏳ Rate limited, waiting ${(waitMs/1000).toFixed(0)}s...`);
    await sleep(waitMs);
    return searchUsersREST(query, page, perPage);
  }

  if (!res.ok) {
    log(`  ⚠️ Search API error ${res.status}`);
    return { items: [], total_count: 0 };
  }

  return await res.json();
}

// ============ GraphQL for user details ============
async function getUserDetails(logins) {
  // Batch up to 10 users per GraphQL query
  const fragments = logins.map((login, i) => `
    user${i}: user(login: "${login}") {
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
  `).join('\n');

  const query = `query { ${fragments} }`;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (res.status === 403 || res.status === 429) {
    log('  ⏳ GraphQL rate limited, waiting 60s...');
    await sleep(60000);
    return getUserDetails(logins);
  }

  if (!res.ok) return {};

  const data = await res.json();
  if (data.errors && !data.data) {
    log(`  ⚠️ GraphQL error: ${data.errors[0]?.message}`);
    return {};
  }

  return data.data || {};
}

function parseUserData(userData) {
  if (!userData || !userData.login) return null;
  const repos = userData.repositories?.nodes?.filter(Boolean) || [];
  return {
    login: userData.login,
    name: userData.name || userData.login,
    avatarUrl: userData.avatarUrl,
    location: userData.location || null,
    followers: userData.followers?.totalCount || 0,
    totalStars: repos.reduce((s, r) => s + (r.stargazerCount || 0), 0),
    totalForks: repos.reduce((s, r) => s + (r.forkCount || 0), 0),
    totalCommits: (userData.contributionsCollection?.totalCommitContributions || 0) +
                  (userData.contributionsCollection?.restrictedContributionsCount || 0),
    topLanguage: repos.find(r => r.primaryLanguage)?.primaryLanguage?.name || null,
    topRepos: repos.slice(0, 3).map(r => ({
      name: r.name, stars: r.stargazerCount || 0, forks: r.forkCount || 0
    })),
    repoCount: userData.repositories?.totalCount || 0
  };
}

// ============ MAIN ============
async function main() {
  const startTime = Date.now();
  log('═══════════════════════════════════════════════════');
  log('  FULL DEVELOPER FETCH — All Countries');
  log('═══════════════════════════════════════════════════');

  // Load progress if exists
  let allLogins = new Set();
  let allDevs = new Map();

  if (existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    progress.forEach(d => { allLogins.add(d.login); allDevs.set(d.login, d); });
    log(`  Resuming: ${allDevs.size} developers already fetched`);
  } else if (existsSync(OUTPUT_FILE)) {
    const existing = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    existing.forEach(d => { allLogins.add(d.login); allDevs.set(d.login, d); });
    log(`  Starting with existing: ${allDevs.size} developers`);
  }

  // PHASE 1: Discover user logins via REST Search
  log('\n📡 PHASE 1: Discovering developers via search...');
  const discoveredLogins = new Set([...allLogins]);

  for (let li = 0; li < LOCATIONS.length; li++) {
    const location = LOCATIONS[li];

    for (const threshold of FOLLOWER_THRESHOLDS) {
      const query = `location:"${location}" followers:>=${threshold.min} type:user`;

      try {
        // Fetch first page
        const result = await searchUsersREST(query, 1, 100);
        const totalAvailable = Math.min(result.total_count || 0, 1000);

        if (result.items) {
          result.items.forEach(u => discoveredLogins.add(u.login));
        }

        // Fetch page 2 if there are more
        if (totalAvailable > 100) {
          await sleep(2500);
          const page2 = await searchUsersREST(query, 2, 100);
          if (page2.items) {
            page2.items.forEach(u => discoveredLogins.add(u.login));
          }
        }

        // Fetch page 3 if lots available
        if (totalAvailable > 200) {
          await sleep(2500);
          const page3 = await searchUsersREST(query, 3, 100);
          if (page3.items) {
            page3.items.forEach(u => discoveredLogins.add(u.login));
          }
        }
      } catch (err) {
        log(`  ❌ ${location}/${threshold.min}: ${err.message}`);
      }

      await sleep(2500); // REST search rate: ~30/min
    }

    if ((li + 1) % 10 === 0) {
      log(`  Locations: ${li + 1}/${LOCATIONS.length} | Unique logins: ${discoveredLogins.size}`);
    }
  }

  log(`\n  ✅ Phase 1 done: ${discoveredLogins.size} unique logins discovered`);

  // PHASE 2: Get detailed data via GraphQL (batch 10 at a time)
  log('\n📡 PHASE 2: Fetching detailed user data...');
  const loginsToFetch = [...discoveredLogins].filter(l => !allDevs.has(l));
  log(`  Need to fetch details for ${loginsToFetch.length} new users`);

  for (let i = 0; i < loginsToFetch.length; i += 10) {
    const batch = loginsToFetch.slice(i, i + 10);

    try {
      const data = await getUserDetails(batch);

      for (const key of Object.keys(data)) {
        const parsed = parseUserData(data[key]);
        if (parsed) {
          allDevs.set(parsed.login, parsed);
        }
      }
    } catch (err) {
      log(`  ❌ Batch ${i}: ${err.message}`);
    }

    // Save progress every 100 users
    if ((i + 10) % 100 === 0) {
      const devArray = [...allDevs.values()];
      writeFileSync(PROGRESS_FILE, JSON.stringify(devArray));
      log(`  Progress: ${allDevs.size} developers (batch ${i + 10}/${loginsToFetch.length})`);
    }

    await sleep(2000); // GraphQL: ~5000 pts/hr
  }

  // Save final output
  const finalDevs = [...allDevs.values()];
  writeFileSync(OUTPUT_FILE, JSON.stringify(finalDevs, null, 2));
  writeFileSync(PROGRESS_FILE, JSON.stringify(finalDevs));

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  log('\n═══════════════════════════════════════════════════');
  log(`  ✅ FETCH COMPLETE in ${elapsed} minutes`);
  log(`  Total unique developers: ${finalDevs.length}`);
  log(`  Saved to: ${OUTPUT_FILE}`);
  log('═══════════════════════════════════════════════════');
  log('\nNext: run "node scripts/enrich-and-upload.js" to add SO + geocoding + upload to Cosmos DB');
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
