/**
 * Admin review flow for "Add me to DevGlobe" nominations.
 *
 * Usage:
 *   node scripts/review-nominations.js list                    # show nominations
 *   node scripts/review-nominations.js approve <username>      # add to main dataset
 *   node scripts/review-nominations.js reject <username>       # reject nomination
 *   node scripts/review-nominations.js status <username>       # show single nomination
 *
 * Approving fetches the user's GitHub data, geocodes their location,
 * and upserts the developer document into the 'developers' container.
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = 'devglobe';
const DEVELOPERS_CONTAINER = 'developers';
const NOMINATIONS_CONTAINER = 'nominations';

if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
  console.error('Error: COSMOS_ENDPOINT and COSMOS_KEY are required in .env');
  process.exit(1);
}

const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });

async function ensureContainers() {
  const { database } = await client.databases.createIfNotExists({ id: DATABASE });
  const { container: nominations } = await database.containers.createIfNotExists({
    id: NOMINATIONS_CONTAINER,
    partitionKey: { paths: ['/username'] },
  });
  const { container: developers } = await database.containers.createIfNotExists({
    id: DEVELOPERS_CONTAINER,
    partitionKey: { paths: ['/location'] },
  });
  return { database, nominations, developers };
}

async function listNominations(container) {
  const { resources } = await container.items
    .query({ query: 'SELECT * FROM c ORDER BY c.createdAt' })
    .fetchAll();
  if (resources.length === 0) {
    console.log('No nominations found.');
    return;
  }
  console.log(`Found ${resources.length} nomination(s):\n`);
  for (const n of resources) {
    const date = new Date(n.createdAt).toLocaleString();
    console.log(
      `  [${n.status}] ${n.username.padEnd(24)} (${n.name || '—'})` +
      `${n.location ? ` — ${n.location}` : ''} — submitted ${date}`
    );
  }
}

async function getNomination(container, username) {
  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.username = @username',
      parameters: [{ name: '@username', value: username }],
    })
    .fetchAll();
  return resources[0] || null;
}

async function setStatus(container, nomination, status) {
  const doc = { ...nomination, status, reviewedAt: new Date().toISOString() };
  await container.items.upsert(doc);
  console.log(`  ✓ "${nomination.username}" marked as ${status}`);
}

async function fetchGitHubUser(username) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'devglobe-review' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!userRes.ok) {
    throw new Error(`GitHub API returned ${userRes.status} for user lookup`);
  }
  const user = await userRes.json();

  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?sort=stargazers_count&direction=desc&per_page=5&type=owner`,
    { headers }
  );
  const repos = reposRes.ok ? await reposRes.json() : [];

  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const langCounts = {};
  repos.forEach(r => {
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  });
  const totalLangRepos = Object.values(langCounts).reduce((s, v) => s + v, 0);
  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, percent: Math.round((count / totalLangRepos) * 100) }));
  const topLanguage = languages[0]?.name || null;

  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    location: user.location || 'Unknown',
    followers: user.followers || 0,
    totalStars,
    totalForks,
    totalWatchers: totalForks,
    topLanguage,
    languages,
    topRepos: repos.map(r => ({ name: r.name, stars: r.stargazers_count, forks: r.forks_count })),
    totalCommits: 0,
  };
}

function fallbackGeocode(location) {
  const known = {
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'new york': { lat: 40.7128, lng: -74.006 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'berlin': { lat: 52.52, lng: 13.405 },
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'usa': { lat: 39.8283, lng: -98.5795 },
    'united states': { lat: 39.8283, lng: -98.5795 },
  };
  const normalized = (location || '').toLowerCase();
  for (const [key, coords] of Object.entries(known)) {
    if (normalized.includes(key)) return coords;
  }
  return null;
}

async function geocode(location) {
  if (!location) return null;
  const fallback = fallbackGeocode(location);
  if (fallback) return fallback;

  if (process.env.GEOCODE_API_KEY) {
    try {
      const params = new URLSearchParams({ q: location, key: process.env.GEOCODE_API_KEY, limit: '1', no_annotations: '1' });
      const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params}`);
      const data = await res.json();
      if (data.results?.[0]?.geometry) {
        const { lat, lng } = data.results[0].geometry;
        return { lat, lng };
      }
    } catch { /* fall through */ }
  }
  return null;
}

async function approve(nominations, developers, username) {
  const nomination = await getNomination(nominations, username);
  if (!nomination) {
    console.error(`No nomination found for "${username}".`);
    process.exit(1);
  }
  if (nomination.status === 'approved') {
    console.error(`"${username}" is already approved.`);
    process.exit(1);
  }

  console.log(`Approving "${username}"...`);
  const dev = await fetchGitHubUser(username);
  const coords = await geocode(dev.location);

  const doc = {
    id: dev.login,
    ...dev,
    location: dev.location || 'Unknown',
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };

  await developers.items.upsert(doc);
  await setStatus(nominations, nomination, 'approved');
  console.log(`  ✓ Added "${username}" to the developers dataset.`);
}

async function reject(nominations, username) {
  const nomination = await getNomination(nominations, username);
  if (!nomination) {
    console.error(`No nomination found for "${username}".`);
    process.exit(1);
  }
  await setStatus(nominations, nomination, 'rejected');
}

async function main() {
  const [cmd, username] = process.argv.slice(2);
  const { nominations, developers } = await ensureContainers();

  switch (cmd) {
    case 'list':
      await listNominations(nominations);
      break;
    case 'status':
      if (!username) { console.error('Usage: review-nominations.js status <username>'); process.exit(1); }
      console.log(JSON.stringify(await getNomination(nominations, username), null, 2));
      break;
    case 'approve':
      if (!username) { console.error('Usage: review-nominations.js approve <username>'); process.exit(1); }
      await approve(nominations, developers, username);
      break;
    case 'reject':
      if (!username) { console.error('Usage: review-nominations.js reject <username>'); process.exit(1); }
      await reject(nominations, username);
      break;
    default:
      console.log(`Usage: node scripts/review-nominations.js <command> [username]
  list          Show all nominations
  status <u>    Show details for one nomination
  approve <u>   Approve and add to the developers dataset
  reject <u>    Reject the nomination`);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
