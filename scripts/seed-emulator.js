/**
 * Seed the Azure Cosmos DB Emulator with sample developer data.
 *
 * Prerequisites:
 *   1. Install and start the Cosmos DB Emulator:
 *      https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-develop-emulator
 *   2. The emulator runs at https://localhost:8081 by default.
 *
 * Usage:
 *   node scripts/seed-emulator.js
 *
 * Environment variables (optional — defaults match the emulator):
 *   COSMOS_ENDPOINT   - default: https://localhost:8081
 *   COSMOS_KEY        - default: emulator's well-known key
 *   COSMOS_DATABASE   - default: devglobe
 *   COSMOS_CONTAINER  - default: developers
 */

import { CosmosClient } from '@azure/cosmos';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Emulator well-known key (this is public and documented by Microsoft)
const EMULATOR_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

const ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://localhost:8081';
const KEY = process.env.COSMOS_KEY || EMULATOR_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

async function main() {
  console.log(`\n🔗 Connecting to Cosmos DB at ${ENDPOINT}`);
  console.log(`   Database: ${DATABASE} | Container: ${CONTAINER}\n`);

  const client = new CosmosClient({
    endpoint: ENDPOINT,
    key: KEY,
    // Accept self-signed cert from emulator
    connectionPolicy: { enableEndpointDiscovery: false },
  });

  // Disable TLS verification for local emulator
  if (ENDPOINT.includes('localhost') || ENDPOINT.includes('127.0.0.1')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  // Create database if it doesn't exist
  console.log('📦 Creating database...');
  const { database } = await client.databases.createIfNotExists({ id: DATABASE });

  // Create container with /login as partition key
  console.log('📦 Creating container...');
  const { container } = await database.containers.createIfNotExists({
    id: CONTAINER,
    partitionKey: { paths: ['/login'] },
  });

  // Load sample data
  const dataPath = path.join(__dirname, '..', 'data', 'developers-sample.json');
  const developers = JSON.parse(readFileSync(dataPath, 'utf-8'));
  console.log(`📄 Loaded ${developers.length} developers from sample data\n`);

  // Upsert each developer
  let success = 0;
  for (const dev of developers) {
    // Ensure each document has an id (use login as id if not present)
    const doc = { ...dev, id: dev.id || dev.login };
    try {
      await container.items.upsert(doc);
      console.log(`  ✅ ${dev.login} (${dev.name})`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${dev.login}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Seeded ${success}/${developers.length} developers successfully!`);
  console.log('\nNext steps:');
  console.log('  1. Create a .env.local file with:');
  console.log(`     COSMOS_ENDPOINT=${ENDPOINT}`);
  console.log(`     COSMOS_KEY=${KEY}`);
  console.log('  2. Run: npm run dev');
  console.log('  3. Open http://localhost:3000\n');
}

main().catch(err => {
  console.error('\n❌ Failed to seed emulator:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('\n💡 Make sure the Cosmos DB Emulator is running.');
    console.error('   Download: https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-develop-emulator\n');
  }
  process.exit(1);
});
