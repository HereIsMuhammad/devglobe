# PRD: Developer Impact History and Rank Movement

**Status:** MVP implementation
**Issue:** [#111](https://github.com/sajeetharan/devglobe/issues/111)
**Priority:** P0
**Related:** [#22](https://github.com/sajeetharan/devglobe/issues/22), [#127](https://github.com/sajeetharan/devglobe/issues/127), [#168](https://github.com/sajeetharan/devglobe/issues/168)
**Last updated:** 2026-08-16

## Summary

DevGlobe will capture one compact impact snapshot per public developer per UTC day and show how score, stars, followers, commits, and ranks change over time. Rank movements also become events in the personalized feed for followed developers.

## Goals

- Persist dated metrics without copying full developer documents.
- Show current values and nearest available changes over 7, 30, and 90 days.
- Chart global, country, and primary-language rank history.
- Explain material score changes using normalized score dimensions.
- Represent new profiles and sparse periods as unavailable rather than zero movement.
- Let claimed profile owners make impact history private.

## Non-goals

- Treating the DevGlobe score as an absolute measure of skill.
- Reconstructing history before the first captured snapshot.
- Real-time snapshots after every GitHub event.
- Public follower counts or comparisons between private histories.

## Snapshot model

Snapshots contain only `login`, UTC day/time, score dimensions, aggregate stars/followers/commits, and global/country/language rank metadata. They exclude email, OAuth, contact, biography, repositories, AI preferences, and other full-profile fields. The ID is `<login>:<YYYY-MM-DD>`, making daily reruns idempotent.

## Capture

An Azure Timer Function invokes `/api/cron/impact-history` every 15 minutes with `CRON_SECRET`. The job scores and ranks the complete public dataset, then resumes an RU-bounded daily capture from persisted progress. Each invocation writes up to 500 idempotent snapshots and publishes a deduplicated `rank_movement` feed event when global rank changes. Repeated invocations complete the daily set without exceeding the function duration or overwhelming shared Cosmos throughput.

## History and deltas

The API returns at most 90 days in ascending order. A period comparison uses the nearest snapshot at or before its boundary. If none exists, the period is explicitly unavailable. Country and language movement are omitted when the cohort changed.

## Privacy

History defaults to public because all underlying metrics are already public. A claimed owner can set `impactHistoryVisibility` to `private`; non-owner history requests then return `403`, and future movement events are private. Owners retain access to their own history and can restore public visibility.

## Success metrics

- Claimed-profile weekly return rate.
- History-view opens and 7/30/90 period engagement.
- Personalized-feed opens from rank-movement events.
- Weekly-digest clicks into history.

## Acceptance criteria

- Daily writes are idempotent and compact.
- 7/30/90 changes and sparse periods are tested.
- Global, country, and language rank history is available where cohorts are stable.
- Material score changes identify up to three underlying dimensions.
- Claimed owners can control visibility.
- Full tests and production build pass.