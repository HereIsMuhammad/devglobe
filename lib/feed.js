export const FEED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const FEED_EVENT_TYPES = [
  'rank_movement',
  'milestone',
  'new_top_project',
  'profile_update',
  'github_activity',
  'platform_activity',
];

export class FeedValidationError extends Error {}

/**
 * Normalize a raw source event (from ranking jobs, github ingestion, profile
 * updates, etc.) into the public feed-event shape. Throws on missing
 * required fields so bad publishers fail loudly instead of polluting feeds.
 */
export function normalizeFeedEvent(raw, { isPublicDeveloper = true } = {}) {
  if (!raw || typeof raw !== 'object') throw new FeedValidationError('Feed event payload is required');
  const { eventType, subjectLogin, summary } = raw;
  if (!FEED_EVENT_TYPES.includes(eventType)) throw new FeedValidationError(`Unknown eventType: ${eventType}`);
  if (!subjectLogin) throw new FeedValidationError('subjectLogin is required');
  if (!summary) throw new FeedValidationError('summary is required');

  const createdAt = new Date(raw.createdAt || Date.now());
  if (Number.isNaN(createdAt.getTime())) throw new FeedValidationError('createdAt is invalid');

  const refreshCycle = raw.refreshCycle || createdAt.toISOString().slice(0, 10);

  return {
    id: raw.id || `${eventType}:${subjectLogin}:${refreshCycle}`,
    documentType: 'feed-event',
    eventType,
    subjectLogin,
    project: raw.project || null,
    language: raw.language || null,
    country: raw.country || null,
    summary,
    // `detail` is public-safe by contract: publishers must not put private
    // fields (email, contact info, unclaimed-profile data) in here.
    detail: raw.detail && typeof raw.detail === 'object' ? raw.detail : {},
    createdAt: createdAt.toISOString(),
    refreshCycle,
    visibility: isPublicDeveloper ? 'public' : 'private',
  };
}

/** True if the event matches at least one of the developer's explicit follows. */
export function matchesWatchlist(event, watchlist) {
  const follows = watchlist?.follows || {};
  if (follows.developers?.includes(event.subjectLogin)) return true;
  if (event.project && follows.projects?.includes(event.project)) return true;
  if (event.language && follows.languages?.includes(event.language)) return true;
  if (event.country && follows.countries?.includes(event.country)) return true;
  return false;
}

/** True if the event should be hidden because of an explicit mute. */
export function isMuted(event, watchlist) {
  const mutes = watchlist?.mutes || {};
  if (mutes.eventTypes?.includes(event.eventType)) return true;
  return (mutes.entities || []).some(({ type, value }) => (
    (type === 'developer' && value === event.subjectLogin)
    || (type === 'project' && value === event.project)
    || (type === 'language' && value === event.language)
    || (type === 'country' && value === event.country)
  ));
}

function compareCursorTuple(aCreatedAt, aId, bCreatedAt, bId) {
  return bCreatedAt.localeCompare(aCreatedAt) || bId.localeCompare(aId);
}

/** True if `event` is at or before the read-through cursor, or explicitly marked read. */
export function isRead(event, readState) {
  if (!readState) return false;
  if (readState.readIds?.includes(event.id)) return true;
  const cursor = readState.readThrough;
  if (!cursor) return false;
  // Read-through cursor marks everything at-or-older as read. compareCursorTuple
  // is >= 0 when the cursor is the same age or newer than the event.
  return compareCursorTuple(event.createdAt, event.id, cursor.createdAt, cursor.id) >= 0;
}

/**
 * Compact repeated events from the same developer + event type + refresh
 * cycle into a single feed item. Distinct event types are never merged.
 * Assumes `events` is already sorted newest-first.
 */
export function groupEvents(events) {
  const groups = new Map();
  const order = [];

  for (const event of events) {
    const key = `${event.subjectLogin}:${event.eventType}:${event.refreshCycle}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.groupedIds.push(event.id);
    } else {
      const group = {
        ...event,
        count: 1,
        groupedIds: [event.id],
      };
      groups.set(key, group);
      order.push(key);
    }
  }

  return order.map(key => groups.get(key));
}

/** Apply developer/project/language/country/eventType filters (all AND'd, each OR within itself). */
export function filterEvents(events, filters = {}) {
  const { developers, projects, languages, countries, eventTypes } = filters;
  return events.filter(event => (
    (!developers?.length || developers.includes(event.subjectLogin))
    && (!projects?.length || projects.includes(event.project))
    && (!languages?.length || languages.includes(event.language))
    && (!countries?.length || countries.includes(event.country))
    && (!eventTypes?.length || eventTypes.includes(event.eventType))
  ));
}

export function sortEventsNewestFirst(events) {
  return [...events].sort((a, b) => compareCursorTuple(a.createdAt, a.id, b.createdAt, b.id));
}

export function encodeFeedCursor(event) {
  if (!event) return null;
  return Buffer.from(JSON.stringify({ createdAt: event.createdAt, id: event.id })).toString('base64url');
}

export function decodeFeedCursor(value) {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof cursor.id !== 'string' || Number.isNaN(Date.parse(cursor.createdAt))) return null;
    return cursor;
  } catch {
    return null;
  }
}

/**
 * Full personalization pipeline for one developer's feed: privacy -> watchlist
 * match -> mute -> retention -> sort -> group -> cursor pagination.
 * `events` is the candidate pool (already retention-filtered by the store).
 */
export function buildPersonalizedFeed(events, { watchlist, cursor, limit = 30, filters = {}, unreadOnly = false } = {}) {
  const visible = events.filter(event => event.visibility === 'public');
  const personalized = visible.filter(event => matchesWatchlist(event, watchlist));
  const unmuted = personalized.filter(event => !isMuted(event, watchlist));
  const sorted = sortEventsNewestFirst(unmuted);
  const grouped = groupEvents(sorted);
  const filtered = filterEvents(grouped, filters);
  const unreadCount = filtered.filter(event => !isRead(event, watchlist?.readState)).length;
  const withReadState = filtered.map(event => ({ ...event, read: isRead(event, watchlist?.readState) }));
  const afterCursor = cursor
    ? withReadState.filter(event => compareCursorTuple(event.createdAt, event.id, cursor.createdAt, cursor.id) > 0)
    : withReadState;
  const page = unreadOnly
    ? afterCursor.filter(event => !event.read).slice(0, limit)
    : afterCursor.slice(0, limit);

  return {
    events: page,
    nextCursor: page.length === limit ? encodeFeedCursor(page.at(-1)) : null,
    unreadCount,
  };
}
