import { CosmosClient } from '@azure/cosmos';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteUrl } from '../lib/site.js';

const siteUrl = getSiteUrl();
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
const cosmosKey = process.env.COSMOS_KEY;
const databaseName = process.env.COSMOS_DATABASE || 'devglobe';
const containerName = process.env.COSMOS_CONTAINER || 'developers';

export const revalidate = 86400;

async function getProfileLogins() {
  if (!cosmosEndpoint || !cosmosKey) {
    const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
    const developers = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    return developers.map(developer => developer.login).filter(Boolean);
  }

  try {
    const client = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    const container = client.database(databaseName).container(containerName);
    const { resources } = await container.items
      .query("SELECT VALUE c.login FROM c WHERE IS_DEFINED(c.login) AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')")
      .fetchAll();
    return resources.filter(Boolean);
  } catch (error) {
    console.error('Unable to load profiles for sitemap:', error.message);
    return [];
  }
}

export default async function sitemap() {
  const profileLogins = await getProfileLogins();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...profileLogins.map(login => ({
      url: `${siteUrl}/share/${encodeURIComponent(login)}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
  ];
}