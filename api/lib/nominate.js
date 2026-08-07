/**
 * Shared logic for the "Add me to DevGlobe" self-nomination flow.
 *
 * Used by:
 *   - server.js (local dev server, Cosmos DB emulator)
 *   - api/nominate.js (Vercel serverless function)
 *
 * Flow:
 *   1. Validate the GitHub username exists via the GitHub API.
 *   2. Reject if the developer is already in the main dataset.
 *   3. Reject duplicate pending nominations.
 *   4. Store the nomination in the 'nominations' container (status: pending).
 */
import { CosmosClient } from '@azure/cosmos';

const DATABASE = 'devglobe';
const DEVELOPERS_CONTAINER = 'developers';
const NOMINATIONS_CONTAINER = 'nominations';
const GITHUB_API = 'https://api.github.com';

// GitHub usernames: alphanumeric + single hyphens, 1-39 chars, cannot end with hyphen
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function normalizeUsername(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/^@/, '');
}

async function verifyGitHubUser(username) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devglobe-nomination',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, { headers });
  if (res.status === 404) return { ok: false, notFound: true };
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  return { ok: true, user: await res.json() };
}

async function getClient() {
  // Cosmos DB emulator uses a self-signed cert — bypass only for local emulator
  if (process.env.COSMOS_ENDPOINT && /localhost|127\.0\.0\.1/.test(process.env.COSMOS_ENDPOINT)) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  return new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
}

async function ensureNominationsContainer(client) {
  const { database } = await client.databases.createIfNotExists({ id: DATABASE });
  const { container } = await database.containers.createIfNotExists({
    id: NOMINATIONS_CONTAINER,
    partitionKey: { paths: ['/username'] },
  });
  return { database, container };
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
    if (!verified.ok) {
      return { status: 502, body: { error: 'Could not verify the GitHub username. Please try again.' } };
    }
    ghUser = verified.user;
  } catch (err) {
    console.error('GitHub validation error:', err.message);
    return { status: 502, body: { error: 'Could not verify the GitHub username. Please try again.' } };
  }

  const client = await getClient();
  const { database, container } = await ensureNominationsContainer(client);
  const developersContainer = database.container(DEVELOPERS_CONTAINER);

  try {
    // Already in the main dataset?
    const { resources: existing } = await developersContainer.items
      .query({
        query: 'SELECT VALUE c.login FROM c WHERE c.login = @login',
        parameters: [{ name: '@login', value: cleanUsername }],
      })
      .fetchAll();
    if (existing.length > 0) {
      return { status: 409, body: { error: 'This developer is already on the globe.' } };
    }

    // Duplicate pending nomination?
    const { resources: dupes } = await container.items
      .query({
        query: 'SELECT VALUE c FROM c WHERE c.username = @username AND c.status = @status',
        parameters: [
          { name: '@username', value: cleanUsername },
          { name: '@status', value: 'pending' },
        ],
      })
      .fetchAll();
    if (dupes.length > 0) {
      return { status: 409, body: { error: 'This username is already in the review queue.' } };
    }

    const now = new Date().toISOString();
    const nomination = {
      id: cleanUsername,
      username: cleanUsername,
      name: ghUser.name || cleanUsername,
      avatarUrl: ghUser.avatar_url,
      location: String(location || '').trim(),
      status: 'pending',
      createdAt: now,
      githubUrl: ghUser.html_url,
    };

    await container.items.upsert(nomination);

    return {
      status: 201,
      body: { message: "Thanks! We'll review and add you within a week.", username: cleanUsername },
    };
  } catch (err) {
    console.error('Nomination storage error:', err.message);
    return { status: 500, body: { error: 'Failed to store nomination.' } };
  }
}
