/**
 * Search developers using Cosmos DB Vector Search + Hybrid Search
 * 
 * Usage:
 *   node scripts/search-developers.js "machine learning Python expert in Berlin"
 *   node scripts/search-developers.js "React TypeScript frontend" --mode=hybrid
 *   node scripts/search-developers.js "kubernetes" --mode=text
 * 
 * Modes:
 *   --mode=vector  — Pure vector (semantic) search
 *   --mode=text    — Pure full-text (BM25) search
 *   --mode=hybrid  — Combined vector + full-text with RRF ranking (default)
 */
import 'dotenv/config';
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

const DATABASE_NAME = 'devglobe';
const CONTAINER_NAME = 'developers';

// Parse args
const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'hybrid';
const query = args.filter(a => !a.startsWith('--')).join(' ');

if (!query) {
  console.error('Usage: node scripts/search-developers.js "your search query" [--mode=hybrid|vector|text]');
  process.exit(1);
}

async function getQueryEmbedding(text) {
  const url = `${OPENAI_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=2024-02-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': OPENAI_KEY },
    body: JSON.stringify({ input: [text] })
  });
  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log(`\n🔍 Searching: "${query}" (mode: ${mode})\n`);

  let results;

  if (mode === 'vector') {
    // ─── Pure Vector Search ─────────────────────────────────────────────────
    // Semantic search: finds developers by meaning, not exact words
    const embedding = await getQueryEmbedding(query);

    const { resources } = await container.items.query({
      query: `
        SELECT TOP 10
          c.login, c.name, c.location, c.topLanguage, c.score,
          c.totalStars, c.followers, c.soReputation,
          VectorDistance(c.embedding, @embedding) AS similarityScore
        FROM c
        WHERE VectorDistance(c.embedding, @embedding) > 0.7
        ORDER BY VectorDistance(c.embedding, @embedding)
      `,
      parameters: [{ name: '@embedding', value: embedding }]
    }).fetchAll();
    results = resources;

  } else if (mode === 'text') {
    // ─── Pure Full-Text Search (BM25) ───────────────────────────────────────
    // Keyword search: matches exact terms in indexed fields
    const { resources } = await container.items.query({
      query: `
        SELECT TOP 10
          c.login, c.name, c.location, c.topLanguage, c.score,
          c.totalStars, c.followers, c.soReputation
        FROM c
        WHERE CONTAINS(LOWER(c.login), @query)
           OR CONTAINS(LOWER(c.name), @query)
           OR CONTAINS(LOWER(c.location), @query)
           OR CONTAINS(LOWER(c.bio), @query)
           OR CONTAINS(LOWER(c.topLanguage), @query)
        ORDER BY c.score DESC
      `,
      parameters: [{ name: '@query', value: query.toLowerCase() }]
    }).fetchAll();
    results = resources;

  } else {
    // ─── Hybrid Search (Vector + Text) ──────────────────────────────────────
    // Combines semantic vector similarity with keyword matching
    if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
      return console.error('OpenAI credentials required for hybrid search');
    }
    const embedding = await getQueryEmbedding(query);

    // Get vector results
    const { resources: vectorResults } = await container.items.query({
      query: `
        SELECT TOP 10
          c.login, c.name, c.location, c.topLanguage, c.score,
          c.totalStars, c.followers, c.soReputation,
          VectorDistance(c.embedding, @embedding) AS similarity
        FROM c
        ORDER BY VectorDistance(c.embedding, @embedding)
      `,
      parameters: [{ name: '@embedding', value: embedding }]
    }).fetchAll();

    // Get text results
    const searchLower = query.toLowerCase();
    const { resources: textResults } = await container.items.query({
      query: `
        SELECT TOP 10
          c.login, c.name, c.location, c.topLanguage, c.score,
          c.totalStars, c.followers, c.soReputation
        FROM c
        WHERE CONTAINS(LOWER(c.login), @q)
           OR CONTAINS(LOWER(c.name), @q)
           OR CONTAINS(LOWER(c.location), @q)
           OR CONTAINS(LOWER(c.bio), @q)
           OR CONTAINS(LOWER(c.topLanguage), @q)
        ORDER BY c.score DESC
      `,
      parameters: [{ name: '@q', value: searchLower }]
    }).fetchAll();

    // Client-side RRF (Reciprocal Rank Fusion)
    const rrf = new Map();
    const k = 60; // RRF constant
    vectorResults.forEach((r, i) => {
      rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1));
    });
    textResults.forEach((r, i) => {
      rrf.set(r.login, (rrf.get(r.login) || 0) + 1 / (k + i + 1));
    });

    // Merge and sort by RRF score
    const allResults = new Map();
    [...vectorResults, ...textResults].forEach(r => allResults.set(r.login, r));
    results = [...rrf.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([login]) => allResults.get(login));
  }

  // Display results
  if (results.length === 0) {
    console.log('   No results found.\n');
    return;
  }

  console.log(`   Found ${results.length} developers:\n`);
  console.log('   #  Login              Score  Stars    Location             Language');
  console.log('   ─  ─────              ─────  ─────    ────────             ────────');
  results.forEach((dev, i) => {
    console.log(
      `   ${(i + 1).toString().padEnd(2)} ${(dev.login || '').padEnd(18)} ` +
      `${(dev.score || 0).toString().padEnd(6)} ` +
      `${formatNum(dev.totalStars || 0).padEnd(8)} ` +
      `${(dev.location || 'Unknown').slice(0, 20).padEnd(20)} ` +
      `${dev.topLanguage || 'N/A'}`
    );
  });
  console.log('');
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

main().catch(err => { console.error(err); process.exit(1); });
