import { getCosmosContainer } from './cosmos.js';
import { FEED_RETENTION_MS, normalizeFeedEvent } from './feed.js';

const memoryEvents = new Map();

function getFeedContainer() {
  return getCosmosContainer(process.env.COSMOS_FEED_CONTAINER || 'feed-events');
}

export async function saveFeedEvents(rawEvents, { isPublicDeveloper = true } = {}) {
  const container = getFeedContainer();
  let inserted = 0;

  for (const raw of rawEvents) {
    const event = normalizeFeedEvent(raw, { isPublicDeveloper });
    const document = { ...event, ttl: Math.ceil(FEED_RETENTION_MS / 1000) };

    if (!container) {
      if (!memoryEvents.has(document.id)) inserted += 1;
      memoryEvents.set(document.id, document);
      continue;
    }

    try {
      await container.items.upsert(document);
      inserted += 1;
    } catch (error) {
      if (error.code !== 409) throw error;
    }
  }

  return { inserted };
}

/**
 * Candidate pool for personalization: all non-expired, public feed events.
 * Personalization (watchlist match, mute, grouping, pagination) happens in
 * lib/feed.js, kept separate from storage so it stays cheap to unit test.
 */
export async function listCandidateFeedEvents() {
  const cutoff = new Date(Date.now() - FEED_RETENTION_MS).toISOString();
  const container = getFeedContainer();

  if (!container) {
    return [...memoryEvents.values()].filter(event => event.createdAt >= cutoff);
  }

  const { resources } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.documentType = "feed-event" AND c.createdAt >= @cutoff',
    parameters: [{ name: '@cutoff', value: cutoff }],
  }).fetchAll();
  return resources;
}

export function __resetMemoryFeedStoreForTests() {
  memoryEvents.clear();
}
