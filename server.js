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
