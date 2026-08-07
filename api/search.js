/**
 * Vercel Serverless Function — Hybrid search for developers
 *
 * Endpoint: /api/search?q=machine+learning+python&mode=hybrid
 * 
 * Modes: vector | text | hybrid (default)
 */
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const EMBEDDING_DEPLOYMENT = process.env.EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

// Cosmos DB emulator uses a self-signed cert — bypass only for local emulator
if (COSMOS_ENDPOINT && /localhost|127\.0\.0\.1/.test(COSMOS_ENDPOINT)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DATABASE = 'devglobe';
const CONTAINER = 'developers';

async function getEmbedding(text) {
  const url = `${OPENAI_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=2024-02-01`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': OPENAI_KEY },
    body: JSON.stringify({ input: [text] })
  });
  const data = await res.json();
  return data.data[0].embedding;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { q, mode = 'hybrid', top = '10' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return res.status(500).json({ error: 'Cosmos DB not configured' });
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);
    const limit = Math.min(parseInt(top), 50);

    let results;

    if (mode === 'vector') {
      if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
        return res.status(500).json({ error: 'OpenAI not configured for vector search' });
      }
      const embedding = await getEmbedding(q);
      const { resources } = await container.items.query({
        query: `
          SELECT TOP ${limit}
            c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
            c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation,
            VectorDistance(c.embedding, @embedding) AS relevance
          FROM c
          ORDER BY VectorDistance(c.embedding, @embedding)
        `,
        parameters: [{ name: '@embedding', value: embedding }]
      }).fetchAll();
      results = resources;

    } else if (mode === 'text') {
      const searchTerm = q.toLowerCase();
      const { resources } = await container.items.query({
        query: `
          SELECT TOP ${limit}
            c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
            c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation
          FROM c
          WHERE CONTAINS(LOWER(c.login), @q)
             OR CONTAINS(LOWER(c.name), @q)
             OR CONTAINS(LOWER(c.location), @q)
             OR CONTAINS(LOWER(c.bio), @q)
             OR CONTAINS(LOWER(c.topLanguage), @q)
          ORDER BY c.score DESC
        `,
        parameters: [{ name: '@q', value: searchTerm }]
      }).fetchAll();
      results = resources;

    } else {
      // Hybrid: client-side RRF fusion of vector + text results
      if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
        return res.status(500).json({ error: 'OpenAI not configured for hybrid search' });
      }
      const searchTerm = q.toLowerCase();
      const embedding = await getEmbedding(q);

      // Run vector and text searches in parallel
      const [vectorRes, textRes] = await Promise.all([
        container.items.query({
          query: `
            SELECT TOP ${limit}
              c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
              c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation
            FROM c
            ORDER BY VectorDistance(c.embedding, @embedding)
          `,
          parameters: [{ name: '@embedding', value: embedding }]
        }).fetchAll(),
        container.items.query({
          query: `
            SELECT TOP ${limit}
              c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
              c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation
            FROM c
            WHERE CONTAINS(LOWER(c.login), @q)
               OR CONTAINS(LOWER(c.name), @q)
               OR CONTAINS(LOWER(c.location), @q)
               OR CONTAINS(LOWER(c.bio), @q)
               OR CONTAINS(LOWER(c.topLanguage), @q)
            ORDER BY c.score DESC
          `,
          parameters: [{ name: '@q', value: searchTerm }]
        }).fetchAll()
      ]);

      // RRF fusion
      const k = 60;
      const rrf = new Map();
      const allMap = new Map();
      vectorRes.resources.forEach((r, i) => { rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)); allMap.set(r.login, r); });
      textRes.resources.forEach((r, i) => { rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)); allMap.set(r.login, r); });
      results = [...rrf.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([login]) => allMap.get(login));
    }

    res.json({ query: q, mode, count: results.length, results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
}
