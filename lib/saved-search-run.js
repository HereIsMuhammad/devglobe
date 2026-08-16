import { CosmosClient } from '@azure/cosmos';
import { promises as fs } from 'fs';
import path from 'path';
import { runSavedSearchAgainstCandidates } from './saved-search.js';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const EMBEDDING_DEPLOYMENT = process.env.EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

// Same predicate as /api/search and /api/developers: excludes pending/rejected
// self-nominations. Legacy documents with no `nomination` field stay public.
const PUBLIC_FILTER = "(NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')";
const CANDIDATE_FIELDS = 'c.id, c.login, c.name, c.avatarUrl, c.location, c.topLanguage, c.score, c.totalStars, c.followers, c.nomination';
const CANDIDATE_POOL_SIZE = 200;

async function getEmbedding(text) {
  const url = `${OPENAI_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=2024-02-01`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': OPENAI_KEY },
    body: JSON.stringify({ input: [text] }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

async function getSampleCandidates() {
  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Fetch a candidate pool matching the saved search's mode + free-text query
 * (before structured filters/privacy are applied — see runSavedSearch below).
 * Falls back to bundled sample data when Cosmos isn't configured, same as
 * every other route in this repo.
 */
async function fetchCandidates({ query, mode }) {
  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return getSampleCandidates();
  }

  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database(DATABASE).container(CONTAINER);

  // No free-text query: structured-filters-only search. Pull a broad, scored
  // candidate pool and let lib/saved-search.js narrow it down locally.
  if (!query) {
    const { resources } = await container.items.query({
      query: `SELECT TOP ${CANDIDATE_POOL_SIZE} ${CANDIDATE_FIELDS} FROM c WHERE ${PUBLIC_FILTER} ORDER BY c.score DESC`,
    }).fetchAll();
    return resources;
  }

  if (mode === 'vector' || mode === 'hybrid') {
    if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
      // Degrade to text mode rather than failing the whole saved search run.
      mode = 'text';
    }
  }

  if (mode === 'vector') {
    const embedding = await getEmbedding(query);
    const { resources } = await container.items.query({
      query: `SELECT TOP ${CANDIDATE_POOL_SIZE} ${CANDIDATE_FIELDS}
        FROM c WHERE ${PUBLIC_FILTER} ORDER BY VectorDistance(c.embedding, @embedding)`,
      parameters: [{ name: '@embedding', value: embedding }],
    }).fetchAll();
    return resources;
  }

  if (mode === 'hybrid') {
    const searchTerm = query.toLowerCase();
    const embedding = await getEmbedding(query);
    const [vectorRes, textRes] = await Promise.all([
      container.items.query({
        query: `SELECT TOP ${CANDIDATE_POOL_SIZE} ${CANDIDATE_FIELDS}
          FROM c WHERE ${PUBLIC_FILTER} ORDER BY VectorDistance(c.embedding, @embedding)`,
        parameters: [{ name: '@embedding', value: embedding }],
      }).fetchAll(),
      container.items.query({
        query: `SELECT TOP ${CANDIDATE_POOL_SIZE} ${CANDIDATE_FIELDS}
          FROM c
          WHERE (CONTAINS(LOWER(c.login), @q) OR CONTAINS(LOWER(c.name), @q)
            OR CONTAINS(LOWER(c.location), @q) OR CONTAINS(LOWER(c.bio), @q)
            OR CONTAINS(LOWER(c.topLanguage), @q))
            AND ${PUBLIC_FILTER}
          ORDER BY c.score DESC`,
        parameters: [{ name: '@q', value: searchTerm }],
      }).fetchAll(),
    ]);

    // RRF fusion, same k as /api/search.
    const k = 60;
    const rrf = new Map();
    const allMap = new Map();
    vectorRes.resources.forEach((r, i) => { rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)); allMap.set(r.login, r); });
    textRes.resources.forEach((r, i) => { rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)); allMap.set(r.login, r); });
    return [...rrf.keys()].map(login => allMap.get(login));
  }

  // text mode
  const searchTerm = query.toLowerCase();
  const { resources } = await container.items.query({
    query: `SELECT TOP ${CANDIDATE_POOL_SIZE} ${CANDIDATE_FIELDS}
      FROM c
      WHERE (CONTAINS(LOWER(c.login), @q) OR CONTAINS(LOWER(c.name), @q)
        OR CONTAINS(LOWER(c.location), @q) OR CONTAINS(LOWER(c.bio), @q)
        OR CONTAINS(LOWER(c.topLanguage), @q))
        AND ${PUBLIC_FILTER}
      ORDER BY c.score DESC`,
    parameters: [{ name: '@q', value: searchTerm }],
  }).fetchAll();
  return resources;
}

/**
 * Execute a saved search's criteria end-to-end: fetch candidates for the
 * requested mode, then apply privacy + structured filters + text query
 * locally (lib/saved-search.js) so filtering logic stays in one, unit-tested
 * place regardless of where the candidate pool came from.
 */
export async function runSavedSearch(criteria) {
  const candidates = await fetchCandidates({ query: criteria.query, mode: criteria.mode });
  return runSavedSearchAgainstCandidates(candidates, criteria);
}
