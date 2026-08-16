import { getCosmosContainer } from './cosmos.js';
import { saveFeedEvents } from './feed-store.js';
import { addDeveloperRanks } from './ranking.js';
import { scoreAll } from './scoring.js';
import { addLanguageRanks, createImpactSnapshot, createRankMovementEvent } from './impact-history.js';
import { getLatestImpactSnapshot, saveImpactSnapshot } from './impact-history-store.js';

async function listPublicDevelopers() {
  const container = getCosmosContainer();
  if (!container) throw new Error('Cosmos DB is not configured');
  const { resources } = await container.items.query(`SELECT * FROM c
    WHERE NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved'`).fetchAll();
  return resources;
}

export async function captureImpactHistory(options = {}) {
  const now = options.now || new Date();
  const developers = options.developers || await listPublicDevelopers();
  const getPrevious = options.getPrevious || getLatestImpactSnapshot;
  const saveSnapshot = options.saveSnapshot || saveImpactSnapshot;
  const saveEvents = options.saveEvents || saveFeedEvents;
  const ranked = addLanguageRanks(addDeveloperRanks(scoreAll(developers)));
  let snapshots = 0;
  let movements = 0;

  for (const developer of ranked) {
    const snapshot = createImpactSnapshot(developer, now.toISOString());
    const previous = await getPrevious(snapshot.login, snapshot.day);
    await saveSnapshot(snapshot);
    snapshots += 1;

    const event = createRankMovementEvent(snapshot, previous);
    if (event) {
      const result = await saveEvents([event], {
        isPublicDeveloper: developer.impactHistoryVisibility !== 'private',
      });
      movements += result.inserted;
    }
  }
  return { developers: ranked.length, snapshots, movements, day: now.toISOString().slice(0, 10) };
}