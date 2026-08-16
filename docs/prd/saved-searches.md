# PRD: Saved Developer Searches with New-Match Alerts

**Issue:** [#166](https://github.com/sajeetharan/devglobe/issues/166)
**Related:** [#120](https://github.com/sajeetharan/devglobe/issues/120) (restore recent discovery session)
**Status:** MVP implementation

## Summary

Signed-in users can save a search (free-text query and/or structured filters: country, language, minimum score), re-run it on demand, rename or delete it, and opt in to a per-search alert frequency for when new public developers start matching.

## Acceptance criteria covered

- **Save, rename, run, and delete search criteria** — `POST /api/saved-searches`, `PATCH /api/saved-searches/[id]`, `POST /api/saved-searches/[id]/run`, `DELETE /api/saved-searches/[id]`.
- **Support current text/vector/hybrid mode and structured filters** — `lib/saved-search-run.js` fetches candidates using the same text/vector/hybrid patterns as `/api/search`, then `lib/saved-search.js` applies country/language/minScore filters and the free-text query locally.
- **New-match detection is incremental and deduplicated** — each saved search persists a `seenLogins` set; `diffNewMatches()` only reports logins not already in that set, then merges them in, so repeated runs never re-report the same match (see `tests/saved-search.test.js`).
- **Alerts are opt-in with per-search frequency controls** — `alert.frequency` is `off` by default; `daily` / `weekly` can be set per search via `PATCH`.
- **Private or pending profiles never appear** — `isPubliclyVisible()` mirrors the `PUBLIC_FILTER` predicate already used by `/api/search` and `/api/developers` (excludes any profile with `nomination.status` other than `approved`), applied as a local guard regardless of where the candidate pool came from.

## Deployment

Before this ships to production, the `saved-searches` Cosmos container needs to exist:

```bash
npm run setup-saved-search-container
```

This creates it (partitioned by `/login`, matching how `lib/saved-search-store.js` always reads/writes) if it doesn't already exist — safe to run repeatedly. Without this, every `/api/saved-searches*` call 500s with a Cosmos `NotFound` until the container is created.

## Data model

```json
{
  "id": "torvalds:3f1c...",
  "documentType": "saved-search",
  "login": "torvalds",
  "searchId": "3f1c...",
  "name": "Rust devs in Germany",
  "criteria": {
    "query": "rust",
    "mode": "text",
    "filters": { "country": "Germany", "language": null, "minScore": null }
  },
  "alert": { "frequency": "weekly", "enabled": true },
  "seenLogins": ["torvalds", "gaearon"],
  "lastRunAt": "2026-08-15T09:00:00.000Z",
  "createdAt": "2026-08-15T08:00:00.000Z",
  "updatedAt": "2026-08-15T09:00:00.000Z"
}
```

A user may have up to `MAX_SAVED_SEARCHES_PER_USER` (25) saved searches. `seenLogins` is capped at `MAX_SEEN_LOGINS` (2000, oldest dropped) so it can't grow unbounded over years of runs.

## API contract

- `GET /api/saved-searches` — auth required. Returns `{ searches }` for the signed-in user.
- `POST /api/saved-searches` — auth required. Body: `{ name, criteria: { query?, mode?, filters?: { country?, language?, minScore? } }, alert?: { frequency } }`. At least one of `query`/`country`/`language`/`minScore` is required.
- `PATCH /api/saved-searches/[id]` — auth required. Body: `{ name? }` and/or `{ alert: { frequency } }`.
- `DELETE /api/saved-searches/[id]` — auth required.
- `POST /api/saved-searches/[id]/run` — auth required. Executes the saved criteria now, updates `seenLogins`/`lastRunAt`, and returns `{ results, newMatches, lastRunAt }`.

## Out of scope for this PR

- **Alert delivery** (email/push notification when new matches appear on the `daily`/`weekly` cadence). This PR defines the opt-in frequency setting and the incremental new-match detection primitive (`diffNewMatches`) a scheduled job would call per saved search; the job itself, and the delivery channel, are a follow-up — the same split used for the personalized feed's event-generator jobs (#127 → #111).
- **Saved searches UI** (a "Save this search" button in `SearchBar.jsx`/`Leaderboard.jsx`, and a management screen). This PR ships the API contract first; the UI is a natural follow-up once the contract is reviewed.
- **Vector/hybrid mode when Azure OpenAI isn't configured** — `lib/saved-search-run.js` degrades to text mode in that case rather than failing the run, matching how `/api/search` already requires OpenAI config for those modes.
