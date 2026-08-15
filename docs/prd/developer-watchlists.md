# PRD: Developer Watchlists

**Status:** MVP implementation
**Issue:** [#113](https://github.com/sajeetharan/devglobe/issues/113)
**Priority:** P0
**Depends on:** [#127](https://github.com/sajeetharan/devglobe/issues/127)
**Last updated:** 2026-08-16

## Summary

DevGlobe will let signed-in users privately follow developers from a profile. These explicit follows seed the personalized activity feed and future opt-in digest, creating a useful record of what changed in a developer's network.

## Problem

Discovery currently ends when a profile is closed. Users cannot retain interesting developers or return to changes from people they care about, so each visit starts from scratch.

## Goals

- Let a signed-in user follow or unfollow a public developer from the profile panel.
- Keep watchlists private and scoped to the authenticated GitHub login.
- Feed existing personalization through `follows.developers` without duplicating storage.
- Normalize GitHub logins, prevent self-following, and bound the MVP list to 100 developers.
- Measure follow and unfollow intent for retention analysis.

## Non-goals

- Public follower counts or social popularity rankings.
- Following private or pending profiles through a direct public UI.
- Push or email notifications in this slice; those are covered by #22 and #165.
- Full management UI for projects, languages, and countries.

## User experience

- A signed-in visitor sees **Follow** on another developer's profile.
- Activating it updates in place to **Following**. Activating **Following** unfollows.
- A signed-out visitor sees **Follow** and is sent to GitHub sign-in when activating it.
- The control is hidden on the user's own profile.
- Loading and failed updates do not optimistically claim success.

## API

- `GET /api/watchlist/developers` returns `{ developers: string[] }` for the authenticated user.
- `POST /api/watchlist/developers` with `{ login }` follows a developer.
- `DELETE /api/watchlist/developers` with `{ login }` unfollows a developer.
- All methods return `401` without a valid session and responses are never publicly cached.

## Data and privacy

One private document is stored per authenticated login in the `watchlists` container, partitioned by `/id`. Developer logins are canonical lowercase strings. The watchlist is never included in public profile, search, card, or MCP responses.

Existing documents are replaced with an ETag precondition so concurrent feed read-state and follow updates fail rather than silently overwriting each other.

## Success metrics

- Percentage of signed-in users following at least one and at least three developers.
- Follow conversion from developer profile views.
- D7 retention difference between followers and non-followers.
- Personalized-feed opens among users with follows.

## Acceptance criteria

- Follow state persists across sessions when Cosmos DB is configured.
- Duplicate casing cannot create duplicate follows.
- Self-follow, invalid logins, and more than 100 follows are rejected.
- The existing personalized feed matches newly followed developers.
- Store tests, the full test suite, and production build pass.