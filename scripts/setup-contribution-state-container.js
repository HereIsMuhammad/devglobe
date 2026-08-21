import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT?.trim();
const key = process.env.COSMOS_KEY?.trim();
const databaseId = process.env.COSMOS_DATABASE || 'devglobe';
const containerId = process.env.COSMOS_CONTRIBUTION_STATE_CONTAINER || 'contribution-opportunity-state';

if (!endpoint || !key) {
  console.error('COSMOS_ENDPOINT and COSMOS_KEY are required.');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const { resource, statusCode } = await database.containers.createIfNotExists({
  id: containerId,
  partitionKey: { paths: ['/id'], kind: 'Hash' },
  indexingPolicy: {
    indexingMode: 'consistent',
    automatic: true,
    includedPaths: [{ path: '/timestamps/[]/?' }],
    excludedPaths: [{ path: '/*' }],
  },
});

if (resource.partitionKey?.paths?.[0] !== '/id') {
  throw new Error(`${databaseId}/${containerId} exists with an incompatible partition key. Use a new COSMOS_CONTRIBUTION_STATE_CONTAINER.`);
}
console.log(`${statusCode === 201 ? 'Created' : 'Verified'} contribution state container ${databaseId}/${resource.id}.`);