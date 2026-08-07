/**
 * Generate vector embeddings for developers and upload to Cosmos DB
 * 
 * Usage: node scripts/generate-embeddings.js
 * 
 * Uses Azure OpenAI text-embedding-3-small (1536 dimensions)
 * Reads existing docs from Cosmos DB, generates embeddings, patches them back
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g., https://your-resource.openai.azure.com/
const OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const EMBEDDING_DEPLOYMENT = process.env.EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

const DATABASE_NAME = 'devglobe';
const CONTAINER_NAME = 'developers';
const BATCH_SIZE = 100; // OpenAI supports up to 2048 inputs per request

if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
  console.error('Required: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY in .env');
  process.exit(1);
}

/**
 * Create a searchable text representation of a developer
 * This is what gets embedded into vector space
 */
function buildEmbeddingText(dev) {
  const parts = [
    dev.login,
    dev.name || '',
    dev.location || '',
    dev.bio || '',
    dev.topLanguage ? `Primary language: ${dev.topLanguage}` : '',
    dev.totalStars > 1000 ? `${dev.totalStars} stars` : '',
    dev.soReputation > 1000 ? `StackOverflow reputation: ${dev.soReputation}` : '',
    dev.topRepos ? dev.topRepos.map(r => r.name).join(' ') : ''
  ];
  return parts.filter(Boolean).join(' | ');
}

/**
 * Call Azure OpenAI embeddings API
 */
async function getEmbeddings(texts) {
  const url = `${OPENAI_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=2024-02-01`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': OPENAI_KEY
    },
    body: JSON.stringify({ input: texts })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.data.map(d => d.embedding);
}

async function main() {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log('📊 Generating embeddings for developers...\n');

  // Fetch all developers without embeddings
  const { resources: developers } = await container.items
    .query('SELECT c.id, c.login, c.name, c.location, c.bio, c.topLanguage, c.totalStars, c.soReputation, c.topRepos FROM c WHERE NOT IS_DEFINED(c.embedding)')
    .fetchAll();

  console.log(`   Found ${developers.length} developers needing embeddings\n`);

  let processed = 0;
  let errors = 0;
  for (let i = 0; i < developers.length; i += BATCH_SIZE) {
    const batch = developers.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    // Generate embeddings
    let embeddings;
    try {
      embeddings = await getEmbeddings(texts);
    } catch (err) {
      console.log(`   ⚠ Embedding API error at ${i}: ${err.message.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 5000));
      try { embeddings = await getEmbeddings(texts); } catch { errors += batch.length; continue; }
    }

    // Patch documents in parallel (10 concurrent)
    const CONCURRENCY = 10;
    for (let c = 0; c < batch.length; c += CONCURRENCY) {
      const chunk = batch.slice(c, c + CONCURRENCY);
      await Promise.all(chunk.map(async (dev, idx) => {
        try {
          await container.item(dev.id, dev.location || '').patch({
            operations: [{ op: 'add', path: '/embedding', value: embeddings[c + idx] }]
          });
        } catch { errors++; }
      }));
    }

    processed += batch.length;
    console.log(`   Embedded: ${processed}/${developers.length} (errors: ${errors})`);

    // Rate limit for embedding API
    if (i + BATCH_SIZE < developers.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n✅ Done! ${processed} developers now have vector embeddings.`);
}

main().catch(err => { console.error(err); process.exit(1); });
