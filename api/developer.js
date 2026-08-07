/**
 * Vercel Serverless Function — serves a single developer's full data from Cosmos DB
 *
 * Endpoint: /api/developer?id=<login>
 */
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;

// Cosmos DB emulator uses a self-signed cert — bypass only for local emulator
if (COSMOS_ENDPOINT && /localhost|127\.0\.0\.1/.test(COSMOS_ENDPOINT)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DATABASE = 'devglobe';
const CONTAINER = 'developers';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json');

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Query parameter "id" is required' });
  }

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return res.status(500).json({ error: 'Cosmos DB credentials not configured' });
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);

    const { resources } = await container.items.query({
      query: 'SELECT c.id, c.login, c.name, c.avatarUrl, c.bio, c.location, c.lat, c.lng, c.followers, c.totalStars, c.totalForks, c.totalCommits, c.topLanguage, c.languages, c.publicRepos, c.topRepos, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges, c.soUserId FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }]
    }).fetchAll();

    if (resources.length === 0) {
      return res.status(404).json({ error: 'Developer not found' });
    }

    res.status(200).json(resources[0]);
  } catch (err) {
    console.error('Cosmos DB error:', err.message);
    res.status(500).json({ error: 'Failed to fetch developer data' });
  }
}
