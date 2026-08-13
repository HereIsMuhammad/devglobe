import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT?.trim();
const key = process.env.COSMOS_KEY?.trim();
const databaseId = process.env.COSMOS_DATABASE || 'devglobe';
const containerId = process.env.COSMOS_ACTIVITY_CONTAINER || 'activities';

if (!endpoint || !key) {
  console.error('COSMOS_ENDPOINT and COSMOS_KEY are required.');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const { resource, statusCode } = await database.containers.createIfNotExists({
  id: containerId,
  partitionKey: { paths: ['/day'], kind: 'Hash' },
  defaultTtl: 48 * 60 * 60,
  indexingPolicy: {
    indexingMode: 'consistent',
    automatic: true,
    includedPaths: [{ path: '/*' }],
    excludedPaths: [{ path: '/"_etag"/?' }],
    compositeIndexes: [[
      { path: '/createdAt', order: 'descending' },
      { path: '/id', order: 'descending' },
    ]],
  },
});

console.log(`${statusCode === 201 ? 'Created' : 'Verified'} ${databaseId}/${resource.id} with 48-hour TTL.`);