# PRD: Personalized Developer Activity and Watchlist Feed

**Status:** MVP implementation
**Issue:** [#127](https://github.com/sajeetharan/devglobe/issues/127)
**Depends on:** [#113](https://github.com/sajeetharan/devglobe/issues/113) (watchlists), [#111](https://github.com/sajeetharan/devglobe/issues/111) (rank movement), [#90](https://github.com/sajeetharan/devglobe/issues/90) (activity feed drawer)
**Last updated:** 2026-08-13

## Summary

DevGlobe will add a personalized, chronological feed built from a signed-in developer's watchlists (followed developers, projects, languages, countries) and DevGlobe's own contribution snapshots. The feed surfaces meaningful changes — rank movement, milestones, new top projects, and profile updates — instead of a generic social stream, and gives the developer control over what they see.

## Problem

Watchlists (#113) can notify a developer about an isolated update, but there is no single place to review everything that happened across the people, projects, languages, and countries a developer cares about. Without this, watchlists don't create a reason to come back to DevGlobe.

## Goals

- Build a feed strictly from explicit follows and interests, never from implicit or purchased signals.
- Surface a small set of meaningful event types, not every raw activity.
- Group repeated changes from the same developer/refresh cycle into a single feed item.
- Let a developer filter, mute, and mark items read without leaving the feed.
- Respect claimed-profile privacy and never leak private fields into a public data path.
- Keep the feed bounded: defined retention and compaction rules, cursor-based pagination.

## Non-goals

- Public like counts, reactions, or an unrestricted posting/comment system.
- Inferring interests the developer did not explicitly select.
- Real-time push/websocket delivery (polling + cursor pagination is sufficient for MVP).
- Building the watchlist management UI itself — this PRD adds the minimal follow/mute storage the feed needs; the full watchlist UX is #113.

## Users

- **Signed-in developer:** Follows entities, reads their personalized feed, filters, mutes, and marks items read.
- **DevGlobe ingestion pipelines:** Existing GitHub/platform activity ingestion (and future rank-movement/milestone jobs from #111) publish feed events through a single internal contract.

## Event model

A feed event is the compaction unit. Every event has:

```json
{
  "id": "rank_movement:torvalds:2026-08-13",
  "documentType": "feed-event",
  "eventType": "rank_movement",
  "subjectLogin": "torvalds",
  "project": null,
  "language": "C",
  "country": "USA",
  "summary": "Moved up 3 spots in the global ranking",
  "detail": { "previousRank": 7, "currentRank": 4 },
  "createdAt": "2026-08-13T09:00:00.000Z",
  "refreshCycle": "2026-08-13",
  "visibility": "public"
}
```

Supported `eventType` values for MVP: `rank_movement`, `milestone`, `new_top_project`, `profile_update`, `github_activity`, `platform_activity`.

`visibility` is derived at write time from the subject developer's claimed-profile privacy settings (mirrors the projection already used by the agent-network aggregate — see `docs/prd/agent-network-visualization.md`). Feed reads never re-derive privacy from a client-supplied flag.

## Personalization

An event reaches a developer's feed only if it matches at least one of their explicit follows:

- `follows.developers` — exact `subjectLogin` match
- `follows.projects` — exact `project` match
- `follows.languages` — exact `language` match
- `follows.countries` — exact `country` match

This is an OR match across categories, matching how watchlists are described in #113 ("notify about isolated updates" from any followed entity).

## Grouping and compaction

Events sharing `subjectLogin` + `eventType` + `refreshCycle` are compacted into one feed item with a `count` and the most recent `summary`, so a single refresh run never floods the feed with near-duplicate rows. Distinct event types from the same developer are never merged into each other.

## Filters

The feed endpoint supports filtering by developer, project, language, country, and event type, all combinable, applied after personalization matching.

## Read state

Per-developer read state is a `readThrough` cursor (everything at or before it is read) plus a small set of explicitly-marked `readIds` for items that arrive after the cursor was last advanced. `unreadOnly=true` excludes anything covered by either.

## Mute

A developer can mute a specific entity (`developer`, `project`, `language`, `country`) or an entire `eventType`. Muted events are excluded before pagination, independent of filters.

## Retention and pagination

Feed events are retained for 30 days (`FEED_RETENTION_MS`) and paginated with an opaque `createdAt`+`id` cursor, matching the existing `activity-store.js` cursor contract.

## Privacy

- Feed reads never return raw source payloads — only the pre-derived public `summary`/`detail` fields.
- An event for a developer whose claimed profile is private, or who has not opted into public metrics, is written with `visibility: "private"` and is excluded from every feed response, including the subject's own followers.
- Ingestion is authenticated the same way as `app/api/activities/ingest` (bearer secret), not by end users.

## API contract

- `GET /api/feed` — auth required. Query: `cursor`, `limit`, `developer[]`, `project[]`, `language[]`, `country[]`, `eventType[]`, `unreadOnly`. Returns `{ events, nextCursor, unreadCount }`.
- `PATCH /api/feed` — auth required. Body: `{ eventIds: [...] }` to mark specific items read, or `{ markAllRead: true }` to advance the read-through cursor to now.
- `POST /api/feed/mute` — auth required. Body: `{ type, value }`.
- `DELETE /api/feed/mute` — auth required. Body: `{ type, value }`.
- `POST /api/feed/ingest` — bearer-secret auth (internal). Body: `{ events: [...] }` raw source events; normalized, privacy-projected, and stored.

## Out of scope for this PR

- Watchlist management UI (follow/unfollow buttons across the app) — #113.
- Rank-movement and milestone *generation* jobs — #111. This PR defines the event shape they should publish; a stub generator is not included.
- Feed UI component — a follow-up once the API contract is reviewed.
