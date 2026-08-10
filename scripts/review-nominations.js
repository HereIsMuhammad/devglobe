/**
 * Admin review flow for "Add me to DevGlobe" nominations.
 *
 * Usage:
 *   node scripts/review-nominations.js list                          # show pending/rejected nominations
 *   node scripts/review-nominations.js status <username>
 *   node scripts/review-nominations.js approve <username> [reviewer]
 *   node scripts/review-nominations.js reject <username> [reviewer] [reason]
 *
 * As of issue #96, nominations live entirely inside the `developers`
 * container as `nomination`-tagged documents — there is no separate
 * container. Approving/rejecting patches the same document in place (never
 * creates a second item) using an ETag precondition, so two people running
 * this concurrently on the same username can't silently overwrite each
 * other's review.
 */
import 'dotenv/config';
import {
  getDevelopersContainer,
  findDeveloperByLogin,
  patchDeveloperNomination,
  normalizeUsername,
  enrichFromGitHub,
} from '../lib/nominate.js';

if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) {
  console.error('Error: COSMOS_ENDPOINT and COSMOS_KEY are required in .env');
  process.exit(1);
}

async function listNominations(container) {
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE IS_DEFINED(c.nomination) AND c.nomination.status IN ('pending', 'rejected') ORDER BY c.nomination.submittedAt",
    })
    .fetchAll();
  if (resources.length === 0) {
    console.log('No pending or rejected nominations found.');
    return;
  }
  console.log(`Found ${resources.length} nomination(s):\n`);
  for (const dev of resources) {
    const date = new Date(dev.nomination.submittedAt).toLocaleString();
    const enrich = dev.nomination.enrichmentStatus !== 'complete' ? ` [enrichment: ${dev.nomination.enrichmentStatus}]` : '';
    console.log(
      `  [${dev.nomination.status}] ${dev.login.padEnd(24)} (${dev.name || '—'})` +
      `${dev.location ? ` — ${dev.location}` : ''} — submitted ${date}${enrich}`
    );
  }
}

async function requireNomination(container, username) {
  const dev = await findDeveloperByLogin(container, username);
  if (!dev) {
    console.error(`No developer document found for "${username}".`);
    process.exit(1);
  }
  if (!dev.nomination) {
    console.error(`"${username}" has no nomination metadata (it's a pre-existing public developer, not a nomination).`);
    process.exit(1);
  }
  return dev;
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

async function approve(container, username, reviewer) {
  const dev = await requireNomination(container, username);
  if (dev.nomination.status === 'approved') {
    console.error(`"${username}" is already approved.`);
    process.exit(1);
  }

  console.log(`Approving "${username}"...`);

  // Re-enrich in case the pending record has stale or partial data (e.g. it
  // was created while GitHub was rate-limiting repo lookups).
  const ghRes = await fetch(`https://api.github.com/users/${dev.login}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'devglobe-review' },
  });
  if (!ghRes.ok) {
    console.error(`Could not re-fetch GitHub profile for "${username}" (status ${ghRes.status}). Aborting approval.`);
    process.exit(1);
  }
  const ghUser = await ghRes.json();
  const enriched = await enrichFromGitHub(dev.login, ghUser);

  if (enriched.enrichmentStatus !== 'complete') {
    console.error(
      `Refusing to approve "${username}": enrichment is still ${enriched.enrichmentStatus} ` +
      `(${enriched.enrichmentError || 'unknown reason'}). Try again once GitHub data is fully available.`
    );
    process.exit(1);
  }

  // Geocode using the location resolved at submission time. `location`
  // itself (the partition key) is intentionally never changed here — only
  // lat/lng and other non-partition fields are updated.
  const coords = await geocode(dev.location);

  try {
    await patchDeveloperNomination(container, dev, {
      name: enriched.name,
      avatarUrl: enriched.avatarUrl,
      bio: enriched.bio,
      githubUrl: enriched.githubUrl,
      followers: enriched.followers,
      publicRepos: enriched.publicRepos,
      totalStars: enriched.totalStars,
      totalForks: enriched.totalForks,
      totalWatchers: enriched.totalWatchers,
      topLanguage: enriched.topLanguage,
      languages: enriched.languages,
      topRepos: enriched.topRepos,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      nomination: {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer || null,
        enrichmentStatus: 'complete',
        enrichedAt: new Date().toISOString(),
        enrichmentError: null,
      },
    });
  } catch (err) {
    if (err.code === 412) {
      console.error(`  ✗ "${username}" was modified by another review action concurrently. Re-run to review the latest version.`);
      process.exit(1);
    }
    throw err;
  }

  console.log(`  ✓ "${username}" approved and now public.`);
}

async function reject(container, username, reviewer, reason) {
  const dev = await requireNomination(container, username);

  try {
    await patchDeveloperNomination(container, dev, {
      nomination: {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer || null,
        rejectionReason: reason || null,
      },
    });
  } catch (err) {
    if (err.code === 412) {
      console.error(`  ✗ "${username}" was modified by another review action concurrently. Re-run to review the latest version.`);
      process.exit(1);
    }
    throw err;
  }

  console.log(`  ✓ "${username}" marked as rejected.`);
}

async function main() {
  const [cmd, rawUsername, ...rest] = process.argv.slice(2);
  const username = normalizeUsername(rawUsername);
  const container = await getDevelopersContainer();

  switch (cmd) {
    case 'list':
      await listNominations(container);
      break;
    case 'status':
      if (!username) { console.error('Usage: review-nominations.js status <username>'); process.exit(1); }
      console.log(JSON.stringify(await findDeveloperByLogin(container, username), null, 2));
      break;
    case 'approve':
      if (!username) { console.error('Usage: review-nominations.js approve <username> [reviewer]'); process.exit(1); }
      await approve(container, username, rest[0]);
      break;
    case 'reject':
      if (!username) { console.error('Usage: review-nominations.js reject <username> [reviewer] [reason]'); process.exit(1); }
      await reject(container, username, rest[0], rest[1]);
      break;
    default:
      console.log(`Usage: node scripts/review-nominations.js <command> [args]
  list                                Show pending/rejected nominations
  status <u>                          Show the full developer/nomination document
  approve <u> [reviewer]              Approve and make public (same document)
  reject <u> [reviewer] [reason]      Reject (same document, excluded from public reads)`);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});