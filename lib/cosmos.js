import { CosmosClient } from '@azure/cosmos';

const containers = new Map();

export function getCosmosContainer(containerName) {
  const endpoint = process.env.COSMOS_ENDPOINT?.trim();
  const key = process.env.COSMOS_KEY?.trim();
  if (!endpoint || !key) return null;

  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  } catch {
    return null;
  }

  const database = process.env.COSMOS_DATABASE || 'devglobe';
  const container = containerName || process.env.COSMOS_CONTAINER || 'developers';
  const cacheKey = `${endpoint}|${database}|${container}`;
  if (containers.has(cacheKey)) return containers.get(cacheKey);

  const client = new CosmosClient({ endpoint, key });
  const cosmosContainer = client.database(database).container(container);
  containers.set(cacheKey, cosmosContainer);
  return cosmosContainer;
}