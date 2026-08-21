import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT?.trim();
const key = process.env.COSMOS_KEY?.trim();
const databaseId = process.env.COSMOS_DATABASE || 'devglobe';
const containerId = process.env.COSMOS_ENGAGEMENT_CONTAINER || 'engagement-events';
const includedPaths = [
  { path: '/documentType/?' },
  { path: '/eventName/?' },
  { path: '/createdAt/?' },
];

if (!endpoint || !key) {
  console.error('COSMOS_ENDPOINT and COSMOS_KEY are required.');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const { resource, statusCode } = await database.containers.createIfNotExists({
  id: containerId,
  partitionKey: { paths: ['/partitionKey'], kind: 'Hash' },
  defaultTtl: -1,
  indexingPolicy: {
    indexingMode: 'consistent',
    automatic: true,
    includedPaths,
    excludedPaths: [{ path: '/*' }],
  },
});

if (statusCode !== 201) {
  const partitionPaths = resource.partitionKey?.paths || [];
  const indexedPaths = new Set(resource.indexingPolicy?.includedPaths?.map(item => item.path));
  const compatible = partitionPaths.length === 1
    && partitionPaths[0] === '/partitionKey'
    && resource.defaultTtl === -1
    && includedPaths.every(item => indexedPaths.has(item.path));
  if (!compatible) {
    throw new Error(`${databaseId}/${containerId} exists with incompatible partition key, TTL, or indexes. Use a new COSMOS_ENGAGEMENT_CONTAINER and rerun setup.`);
  }
}

console.log(`${statusCode === 201 ? 'Created' : 'Verified'} engagement container ${databaseId}/${resource.id}.`);