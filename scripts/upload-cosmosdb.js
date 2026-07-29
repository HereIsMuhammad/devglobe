/**
 * Upload developers data to Azure Cosmos DB
 *
 * Usage: node scripts/upload-cosmosdb.js
 * Reads: data/developers.json (or falls back to data/github-raw.json)
 * Target: Cosmos DB NoSQL → devglobe/developers container
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { readFileSync, existsSync } from 'fs';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://devglobe-cosmos.documents.azure.com:443/';
const COSMOS_KEY = process.env.COSMOS_KEY;

if (!COSMOS_KEY) {
  console.error('Error: COSMOS_KEY environment variable is required');
  console.error('Add it to your .env file');
  process.exit(1);
}

const DATABASE_NAME = 'devglobe';
const CONTAINER_NAME = 'developers';

async function main() {
  // Load data
  let dataFile = 'data/developers.json';
  if (!existsSync(dataFile)) {
    dataFile = 'data/github-raw.json';
  }

  console.log(`📂 Loading data from ${dataFile}...`);
  const developers = JSON.parse(readFileSync(dataFile, 'utf-8'));
  console.log(`   Found ${developers.length} developers\n`);

  // Connect to Cosmos DB
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const database = client.database(DATABASE_NAME);
  const container = database.container(CONTAINER_NAME);

  console.log(`🔗 Connected to Cosmos DB: ${DATABASE_NAME}/${CONTAINER_NAME}`);
  console.log(`   Partition key: /location\n`);

  // Upload in batches
  const batchSize = 50;
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < developers.length; i += batchSize) {
    const batch = developers.slice(i, i + batchSize);

    const promises = batch.map(async (dev) => {
      // Ensure each doc has an id and a location (partition key)
      const doc = {
        ...dev,
        id: dev.login,
        location: dev.location || 'Unknown'
      };

      try {
        await container.items.upsert(doc);
        uploaded++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`   ❌ Failed to upload ${dev.login}: ${err.message}`);
        }
      }
    });

    await Promise.all(promises);

    const progress = Math.min(i + batchSize, developers.length);
    process.stdout.write(`\r   Uploaded: ${uploaded}/${developers.length} (errors: ${errors})`);
  }

  console.log(`\n\n✅ Done! Uploaded ${uploaded} developers to Cosmos DB`);
  if (errors > 0) {
    console.log(`   ⚠️  ${errors} documents failed`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
