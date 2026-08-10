/**
 * Shared logic for the "Add me to DevGlobe" self-nomination flow.
 *
 * Used by:
 *   - app/api/nominate/route.js (Next.js API route)
 *   - scripts/review-nominations.js (admin review flow)
 *   - scripts/migrate-nominations.js (one-time legacy migration)
 *
 * Data model (see issue #96):
 *   `developers` is the single source of truth for both public profiles and
 *   in-flight nominations. A nomination writes one developer-shaped document
 *   with a `nomination` lifecycle object. Approval/rejection patch that same
 *   document in place; nothing is ever duplicated across containers.
 *
 *   Documents with no `nomination` field are legacy/approved records and are
 *   treated as public. `nomination.status` is one of: pending, approved,
 *   rejected.
 *
 * Flow:
 *   1. Validate the GitHub username exists via the GitHub API.
 *   2. Reject if an approved/public developer already exists for this login.
 *   3. Reject duplicate pending nominations (idempotent).
 *   4. Fetch public GitHub profile + repository data for enrichment.
 *   5. Resolve `location` once (submitted value, else GitHub profile, else
 *      "Unknown") — this becomes the item's partition key and must never
 *      change after creation (see resolveLocation / CosmosDB partition key
 *      contract below).
 *   6. Upsert one developer document with `nomination.status = 'pending'`.
 */
import { CosmosClient } from '@azure/cosmos';

const DATABASE = 'devglobe';
const DEVELOPERS_CONTAINER = 'developers';
const GITHUB_API = 'https://api.github.com';
export const SCHEMA_VERSION = 2;

// GitHub usernames: alphanumeric + single hyphens, 1-39 chars, cannot end with hyphen
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function normalizeUsername(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/^@/, '').toLowerCase();
}

/**
 * A document counts as "public" (visible on every public read surface) when
 * it either predates the nomination lifecycle (no `nomination` field, kept
 * backward-compatible on purpose) or has been explicitly approved.
 */
export function isPublicDeveloper(doc) {
  if (!doc) return false;
  return !doc.nomination || doc.nomination.status === 'approved';
}

/**
 * Resolves the location to store on a new nomination document. This value
 * becomes the Cosmos partition key for the item's entire lifecycle, so it is
 * computed once, here, at creation time, and must not be changed by later
 * review/approval writes (see `patchDeveloperNomination`, which never
 * touches `location`).
 */
export function resolveLocation(submittedLocation, githubLocation) {
  const submitted = String(submittedLocation || '').trim();
  if (submitted) return submitted;
  const gh = String(githubLocation || '').trim();
  if (gh) return gh;
  return 'Unknown';
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devglobe-nomination',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function verifyGitHubUser(username) {
  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, { headers: githubHeaders() });
  if (res.status === 404) return { ok: false, notFound: true };
  if (res.status === 403 || res.status === 429) return { ok: false, rateLimited: true };
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  return { ok: true, user: await res.json() };
}

/**
 * Fetches public GitHub profile + top-repo data for enrichment. Never
 * throws on partial failure (e.g. rate limiting on the repos call) — it
 * returns as much as it could get plus an `enrichmentStatus` so callers can
 * store a pending record without silently pretending the data is complete.
 * `enrichmentStatus` is one of: 'complete', 'partial', 'failed'.
 */
export async function enrichFromGitHub(username, ghUser) {
  const headers = githubHeaders();
  let repos = [];
  let enrichmentStatus = 'complete';
  let enrichmentError = null;

  try {
    const reposRes = await fetch(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?sort=stargazers_count&direction=desc&per_page=5&type=owner`,
      { headers }
    );
    if (reposRes.status === 403 || reposRes.status === 429) {
      enrichmentStatus = 'partial';
      enrichmentError = 'GitHub API rate limit reached while fetching repositories.';
    } else if (!reposRes.ok) {
      enrichmentStatus = 'partial';
      enrichmentError = `GitHub API returned ${reposRes.status} while fetching repositories.`;
    } else {
      repos = await reposRes.json();
    }
  } catch (err) {
    enrichmentStatus = 'partial';
    enrichmentError = err.message;
  }

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

  return {
    login: ghUser.login,
    name: ghUser.name || ghUser.login,
    avatarUrl: ghUser.avatar_url,
    bio: ghUser.bio || null,
    githubUrl: ghUser.html_url,
    followers: ghUser.followers || 0,
    publicRepos: ghUser.public_repos || 0,
    totalStars,
    totalForks,
    totalWatchers: totalForks,
    topLanguage: languages[0]?.name || null,
    languages,
    topRepos: repos.map(r => ({ name: r.name, stars: r.stargazers_count, forks: r.forks_count })),
    totalCommits: 0,
    githubLocation: ghUser.location || null,
    enrichmentStatus,
    enrichmentError,
  };
}

async function getClient() {
  return new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
}

export async function getDevelopersContainer() {
  const client = await getClient();
  const { database } = await client.databases.createIfNotExists({ id: DATABASE });
  const { container } = await database.containers.createIfNotExists({
    id: DEVELOPERS_CONTAINER,
    partitionKey: { paths: ['/location'] },
  });
  return container;
}

/**
 * Looks up a developer document by canonical (lowercased) login, returning
 * the resource including its `_etag` for optimistic-concurrency writes.
 */
export async function findDeveloperByLogin(container, login) {
  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE LOWER(c.login) = @login',
      parameters: [{ name: '@login', value: login.toLowerCase() }],
    })
    .fetchAll();
  return resources[0] || null;
}

/**
 * Patches an existing nomination document's lifecycle fields in place using
 * an ETag precondition, so two simultaneous review actions on the same
 * nomination can't silently clobber each other — the losing write gets a
 * Cosmos precondition-failed (412) error instead.
 *
 * Never touches `location` (the partition key) or `id`/`login`, so the
 * item's partition assignment is stable for its entire lifecycle.
 */
export async function patchDeveloperNomination(container, doc, updates) {
  const next = {
    ...doc,
    ...updates,
    nomination: { ...doc.nomination, ...updates.nomination },
  };
  delete next._etag;
  delete next._rid;
  delete next._self;
  delete next._ts;

  const item = container.item(doc.id, doc.location);
  const { resource } = await item.replace(next, { accessCondition: { type: 'IfMatch', condition: doc._etag } });
  return resource;
}

export async function submitNomination({ username, location }) {
  if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) {
    return { status: 500, body: { error: 'Cosmos DB credentials not configured' } };
  }

  const cleanUsername = normalizeUsername(username);
  if (!USERNAME_RE.test(cleanUsername)) {
    return {
      status: 400,
      body: { error: 'Please enter a valid GitHub username (letters, numbers, hyphens).' },
    };
  }

  let ghUser;
  try {
    const verified = await verifyGitHubUser(cleanUsername);
    if (!verified.ok && verified.notFound) {
      return { status: 404, body: { error: 'GitHub user does not exist.' } };
    }
    if (!verified.ok && verified.rateLimited) {
      return { status: 503, body: { error: 'GitHub API rate limit reached. Please try again shortly.' } };
    }
    if (!verified.ok) {
      return { status: 502, body: { error: 'Could not verify the GitHub username. Please try again.' } };
    }
    ghUser = verified.user;
  } catch (err) {
    console.error('GitHub validation error:', err.message);
    return { status: 502, body: { error: 'Could not verify the GitHub username. Please try again.' } };
  }

  let container;
  try {
    container = await getDevelopersContainer();
  } catch (err) {
    console.error('Cosmos DB connection error:', err.message);
    return { status: 500, body: { error: 'Could not connect to the database. Please try again.' } };
  }

  try {
    const existing = await findDeveloperByLogin(container, cleanUsername);

    if (existing && isPublicDeveloper(existing)) {
      // Never overwrite an existing approved/public developer document.
      return { status: 409, body: { error: 'This developer is already on the globe.' } };
    }

    if (existing && existing.nomination?.status === 'pending') {
      // Idempotent: repeating the same request shouldn't error or duplicate.
      return {
        status: 200,
        body: { message: 'This username is already in the review queue.', username: cleanUsername, status: 'pending' },
      };
    }

    // `existing` is either absent, or a previously-rejected nomination that
    // the person is resubmitting — both fall through to (re)create it as a
    // fresh pending nomination below.

    const enriched = await enrichFromGitHub(cleanUsername, ghUser);
    const resolvedLocation = resolveLocation(location, enriched.githubLocation);
    const now = new Date().toISOString();

    const doc = {
      id: enriched.login.toLowerCase(),
      login: enriched.login,
      name: enriched.name,
      avatarUrl: enriched.avatarUrl,
      bio: enriched.bio,
      githubUrl: enriched.githubUrl,
      location: resolvedLocation,
      followers: enriched.followers,
      publicRepos: enriched.publicRepos,
      totalStars: enriched.totalStars,
      totalForks: enriched.totalForks,
      totalWatchers: enriched.totalWatchers,
      totalCommits: enriched.totalCommits,
      topLanguage: enriched.topLanguage,
      languages: enriched.languages,
      topRepos: enriched.topRepos,
      schemaVersion: SCHEMA_VERSION,
      source: 'self-nomination',
      nomination: {
        status: 'pending',
        submittedAt: now,
        submittedLocation: String(location || '').trim() || null,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        enrichmentStatus: enriched.enrichmentStatus,
        enrichedAt: now,
        enrichmentError: enriched.enrichmentError,
      },
    };

    await container.items.upsert(doc);

    return {
      status: 201,
      body: { message: "Thanks! We'll review and add you within a week.", username: cleanUsername, status: 'pending' },
    };
  } catch (err) {
    console.error('Nomination storage error:', err.message);
    return { status: 500, body: { error: 'Failed to store nomination.' } };
  }
}