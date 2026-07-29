/**
 * Setup Cosmos DB container with vector search + full-text search for hybrid queries
 * 
 * Usage: node scripts/setup-vector-search.js
 * 
 * This recreates the 'developers' container with:
 * - Vector embedding policy (1536-dim for text-embedding-3-small)
 * - Vector index (quantizedFlat for cost efficiency)
 * - Full-text index on searchable fields (for hybrid search)
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE_NAME = 'devglobe';
const CONTAINER_NAME = 'developers';

async function main() {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const database = client.database(DATABASE_NAME);

  console.log('⚙️  Setting up vector search container...\n');

  // Container definition with vector embedding policy
  const containerDef = {
    id: CONTAINER_NAME,
    partitionKey: { paths: ['/location'] },
    indexingPolicy: {
      indexingMode: 'consistent',
      automatic: true,
      includedPaths: [{ path: '/*' }],
      excludedPaths: [{ path: '/embedding/*' }],
      // Full-text indexes for hybrid search
      fullTextIndexes: [
        { path: '/login' },
        { path: '/name' },
        { path: '/location' },
        { path: '/bio' },
        { path: '/topLanguage' }
      ],
      // Vector index
      vectorIndexes: [
        {
          path: '/embedding',
          type: 'quantizedFlat'  // Good for < 100K docs. Use 'diskANN' for larger datasets
        }
      ]
    },
    // Vector embedding policy — defines how vectors are stored
    vectorEmbeddingPolicy: {
      vectorEmbeddings: [
        {
          path: '/embedding',
          dataType: 'float32',
          dimensions: 1536,           // text-embedding-3-small
          distanceFunction: 'cosine'
        }
      ]
    },
    // Full-text policy for BM25 text ranking
    fullTextPolicy: {
      defaultLanguage: 'en-US',
      fullTextPaths: [
        { path: '/login', language: 'en-US' },
        { path: '/name', language: 'en-US' },
        { path: '/location', language: 'en-US' },
        { path: '/bio', language: 'en-US' },
        { path: '/topLanguage', language: 'en-US' }
      ]
    }
  };

  // Delete and recreate container (WARNING: deletes existing data!)
  console.log('⚠️  This will delete and recreate the container.');
  console.log('   Make sure you have the pipeline to re-upload data.\n');

  try {
    // Test if vector policy is supported before deleting
    const testContainer = {
      id: '_vector_test_' + Date.now(),
      partitionKey: { paths: ['/id'] },
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [{
          path: '/embedding', dataType: 'float32', dimensions: 3, distanceFunction: 'cosine'
        }]
      }
    };
    const { container: testC } = await database.containers.create(testContainer);
    await testC.delete();
    console.log('   ✓ Vector search capability confirmed\n');
  } catch (e) {
    if (e.body?.message?.includes('not been enabled')) {
      console.error('❌ Vector search capability is not yet propagated on your account.');
      console.error('   The capability was enabled but needs time to propagate (15-30 min).');
      console.error('   Re-run this script in a few minutes: node scripts/setup-vector-search.js');
      process.exit(1);
    }
    throw e;
  }

  try {
    await database.container(CONTAINER_NAME).delete();
    console.log('   Deleted existing container');
  } catch (e) {
    if (e.code !== 404) throw e;
  }

  const { container } = await database.containers.create(containerDef, { offerThroughput: 1000 });
  console.log(`✅ Created container "${CONTAINER_NAME}" with vector + full-text indexes`);
  console.log('   Vector: 1536-dim, cosine, quantizedFlat');
  console.log('   Full-text: login, name, location, bio, topLanguage\n');
  console.log('Next steps:');
  console.log('  1. Run: node scripts/generate-embeddings.js  (generate & upload embeddings)');
  console.log('  2. Query with: node scripts/search-developers.js "your query"');
}

main().catch(err => { console.error(err); process.exit(1); });
