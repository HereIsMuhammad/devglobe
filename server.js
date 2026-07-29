/**
 * Local dev server — serves static files + /api/developers from Cosmos DB
 */
import express from 'express';
import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

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

// Search endpoint — supports text search now, upgrades to hybrid when vector is ready
app.get('/api/search', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { q, mode = 'text', top = '10' } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);
    const limit = Math.min(parseInt(top) || 10, 50);
    const searchTerm = q.toLowerCase();

    const { resources } = await container.items.query({
      query: `
        SELECT TOP @limit
          c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
          c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation,
          c.bio, c.totalCommits, c.scoreDimensions
        FROM c
        WHERE CONTAINS(LOWER(c.login), @q)
           OR CONTAINS(LOWER(c.name), @q)
           OR CONTAINS(LOWER(c.location), @q)
           OR CONTAINS(LOWER(c.bio), @q)
           OR CONTAINS(LOWER(c.topLanguage), @q)
        ORDER BY c.score DESC
      `,
      parameters: [
        { name: '@q', value: searchTerm },
        { name: '@limit', value: limit }
      ]
    }).fetchAll();

    console.log(`🔍 Search "${q}" → ${resources.length} results`);
    res.json({ query: q, mode, count: resources.length, results: resources });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
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
