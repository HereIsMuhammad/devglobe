import { getCosmosContainer } from './cosmos.js';

export function getEngagementContainer() {
  return getCosmosContainer(process.env.COSMOS_ENGAGEMENT_CONTAINER || 'engagement-events');
}

export async function saveEngagementEvent(container, event) {
  try {
    await container.items.create(event);
    return true;
  } catch (error) {
    if (error.code === 409 || error.statusCode === 409) return false;
    throw error;
  }
}

export async function loadProfileEngagementEvents(container, login, since) {
  const { resources } = await container.items.query({
    query: `SELECT c.eventName, c.createdAt, c.sessionHash, c.privacyHash
      FROM c
      WHERE c.targetLogin = @login
        AND c.documentType = "engagement-event"
        AND c.createdAt >= @since`,
    parameters: [
      { name: '@login', value: login.toLowerCase() },
      { name: '@since', value: since.toISOString() },
    ],
  }, { partitionKey: login.toLowerCase() }).fetchAll();
  return resources;
}