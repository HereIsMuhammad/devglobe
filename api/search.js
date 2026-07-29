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
      const { resources } = await container.items.query({
        query: `
          SELECT TOP ${limit}
            c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
            c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation
          FROM c
          WHERE FullTextContains(c.login, @q)
             OR FullTextContains(c.name, @q)
             OR FullTextContains(c.location, @q)
             OR FullTextContains(c.bio, @q)
             OR FullTextContains(c.topLanguage, @q)
          ORDER BY RANK FullTextScore(c.login, [@q]) +
                        FullTextScore(c.name, [@q]) +
                        FullTextScore(c.location, [@q]) +
                        FullTextScore(c.bio, [@q]) +
                        FullTextScore(c.topLanguage, [@q])
        `,
        parameters: [{ name: '@q', value: q }]
      }).fetchAll();
      results = resources;

    } else {
      // Hybrid: RRF fusion of vector + full-text
      if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
        return res.status(500).json({ error: 'OpenAI not configured for hybrid search' });
      }
      const embedding = await getEmbedding(q);
      const { resources } = await container.items.query({
        query: `
          SELECT TOP ${limit}
            c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng,
            c.topLanguage, c.score, c.totalStars, c.followers, c.soReputation
          FROM c
          WHERE FullTextContains(c.login, @q)
             OR FullTextContains(c.name, @q)
             OR FullTextContains(c.location, @q)
             OR FullTextContains(c.bio, @q)
             OR FullTextContains(c.topLanguage, @q)
             OR VectorDistance(c.embedding, @embedding) > 0.7
          ORDER BY RANK RRF(
            FullTextScore(c.login, [@q]) +
            FullTextScore(c.name, [@q]) +
            FullTextScore(c.location, [@q]) +
            FullTextScore(c.bio, [@q]) +
            FullTextScore(c.topLanguage, [@q]),
            VectorDistance(c.embedding, @embedding)
          )
        `,
        parameters: [
          { name: '@q', value: q },
          { name: '@embedding', value: embedding }
        ]
      }).fetchAll();
      results = resources;
    }

    res.json({ query: q, mode, count: results.length, results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
}
