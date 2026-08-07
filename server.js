/**
 * Local dev server — serves static files + /api/developers from Cosmos DB
 */
import express from 'express';
import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { submitNomination } from './api/lib/nominate.js';

dotenv.config();

// The Cosmos DB emulator uses a self-signed cert; only bypass TLS verification
// when talking to the local emulator (never for real Azure endpoints).
if (process.env.COSMOS_ENDPOINT && /localhost|127\.0\.0\.1/.test(process.env.COSMOS_ENDPOINT)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = 'devglobe';
const CONTAINER = 'developers';

let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/developers', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return res.status(500).json({ error: 'Cosmos DB credentials not configured in .env' });
  }

  // Serve from memory cache if fresh
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return res.json(cachedData);
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);

    const { resources } = await container.items
      .query('SELECT * FROM c')
      .fetchAll();

    cachedData = resources;
    cacheTime = Date.now();

    console.log(`✓ Loaded ${resources.length} developers from Cosmos DB`);
    res.json(resources);
  } catch (err) {
    console.error('Cosmos DB error:', err.message);
    res.status(500).json({ error: 'Failed to fetch from Cosmos DB' });
  }
});

// Search endpoint — supports text, vector, and hybrid search
app.get('/api/search', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { q, mode = 'text', top = '10' } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);
    const limit = Math.min(parseInt(top) || 10, 50);

    let results;

    if (mode === 'vector' || mode === 'hybrid') {
      const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
      const OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
      const DEPLOYMENT = process.env.EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

      if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
        return res.status(500).json({ error: 'OpenAI not configured for vector search' });
      }

      // Generate embedding for the query
      const embRes = await fetch(
        `${OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT}/embeddings?api-version=2024-02-01`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': OPENAI_KEY },
          body: JSON.stringify({ input: [q] })
        }
      );
      const embData = await embRes.json();
      const embedding = embData.data[0].embedding;

      // Vector search
      const { resources: vectorResults } = await container.items.query({
        query: `SELECT TOP ${limit}
          c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
          c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation,
          c.bio, c.totalCommits, c.scoreDimensions,
          VectorDistance(c.embedding, @emb) AS similarity
        FROM c ORDER BY VectorDistance(c.embedding, @emb)`,
        parameters: [{ name: '@emb', value: embedding }]
      }).fetchAll();

      if (mode === 'vector') {
        results = vectorResults;
      } else {
        // Hybrid: also run text search and merge with RRF
        const searchTerm = q.toLowerCase();
        const { resources: textResults } = await container.items.query({
          query: `SELECT TOP ${limit}
            c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
            c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation,
            c.bio, c.totalCommits, c.scoreDimensions
          FROM c
          WHERE CONTAINS(LOWER(c.login), @q)
             OR CONTAINS(LOWER(c.name), @q)
             OR CONTAINS(LOWER(c.location), @q)
             OR CONTAINS(LOWER(c.bio), @q)
             OR CONTAINS(LOWER(c.topLanguage), @q)
          ORDER BY c.score DESC`,
          parameters: [{ name: '@q', value: searchTerm }]
        }).fetchAll();

        // Client-side RRF
        const rrf = new Map();
        const k = 60;
        vectorResults.forEach((r, i) => rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)));
        textResults.forEach((r, i) => rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1)));
        const allMap = new Map();
        [...vectorResults, ...textResults].forEach(r => allMap.set(r.login, r));
        results = [...rrf.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([login]) => allMap.get(login));
      }
    } else {
      // Text search
      const searchTerm = q.toLowerCase();
      const { resources } = await container.items.query({
        query: `SELECT TOP ${limit}
          c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
          c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation,
          c.bio, c.totalCommits, c.scoreDimensions
        FROM c
        WHERE CONTAINS(LOWER(c.login), @q)
           OR CONTAINS(LOWER(c.name), @q)
           OR CONTAINS(LOWER(c.location), @q)
           OR CONTAINS(LOWER(c.bio), @q)
           OR CONTAINS(LOWER(c.topLanguage), @q)
        ORDER BY c.score DESC`,
        parameters: [{ name: '@q', value: searchTerm }]
      }).fetchAll();
      results = resources;
    }

    console.log(`🔍 Search "${q}" (${mode}) → ${results.length} results`);
    res.json({ query: q, mode, count: results.length, results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Single developer detail endpoint
app.get('/api/developer', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Query parameter "id" is required' });

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);
    const { resources } = await container.items.query({
      query: 'SELECT c.id, c.login, c.name, c.avatarUrl, c.bio, c.location, c.lat, c.lng, c.followers, c.totalStars, c.totalForks, c.totalCommits, c.topLanguage, c.languages, c.publicRepos, c.topRepos, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges, c.soUserId FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }]
    }).fetchAll();

    if (resources.length === 0) return res.status(404).json({ error: 'Developer not found' });
    res.json(resources[0]);
  } catch (err) {
    console.error('Detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch developer' });
  }
});

// Add-me self-nomination endpoint
app.post('/api/nominate', async (req, res) => {
  const { username, location } = req.body || {};
  const result = await submitNomination({ username, location });
  res.status(result.status).json(result.body);
});

// Serve static files
app.use(express.static(__dirname));

// SPA fallback
app.use((req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  DevGlobe server running at http://localhost:${PORT}`);
  console.log(`  Data source: Cosmos DB (${COSMOS_ENDPOINT})\n`);
});
