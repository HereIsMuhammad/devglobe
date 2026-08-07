/**
 * Vercel Serverless Function — serves developer data from Cosmos DB
 *
 * Endpoint: /api/developers
 * Returns the developer dataset from Azure Cosmos DB with caching headers.
 */
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;

const DATABASE = 'devglobe';
const CONTAINER = 'developers';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json');

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    res.status(500).json({ error: 'Cosmos DB credentials not configured' });
    return;
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);

    // Slim projection — only fields needed for globe rendering, leaderboard, and scoring
    // Detail panel fetches full doc on demand via /api/developer?id=...
    const { resources } = await container.items
      .query('SELECT c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng, c.followers, c.totalStars, c.totalForks, c.totalCommits, c.topLanguage, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges FROM c')
      .fetchAll();

    res.status(200).json(resources);
  } catch (err) {
    console.error('Cosmos DB error:', err.message);
    res.status(500).json({ error: 'Failed to fetch developer data' });
  }
}
