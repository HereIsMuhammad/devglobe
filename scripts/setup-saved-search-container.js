import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT?.trim();
const key = process.env.COSMOS_KEY?.trim();
const databaseId = process.env.COSMOS_DATABASE || 'devglobe';
const containerId = process.env.COSMOS_SAVED_SEARCH_CONTAINER || 'saved-searches';

if (!endpoint || !key) {
  console.error('COSMOS_ENDPOINT and COSMOS_KEY are required.');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
// Partitioned by /login: lib/saved-search-store.js always reads/writes with
// the owning developer's login as the partition key.
const { resource, statusCode } = await database.containers.createIfNotExists({
  id: containerId,
  partitionKey: { paths: ['/login'], kind: 'Hash' },
  indexingPolicy: {
    indexingMode: 'consistent',
    automatic: true,
    includedPaths: [{ path: '/*' }],
    excludedPaths: [{ path: '/"_etag"/?' }],
    compositeIndexes: [[
      { path: '/login', order: 'ascending' },
      { path: '/createdAt', order: 'descending' },
    ]],
  },
});

console.log(`${statusCode === 201 ? 'Created' : 'Verified'} ${databaseId}/${resource.id}.`);
