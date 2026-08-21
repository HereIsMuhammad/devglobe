# Personalized contribution opportunities

## Owner workflow

Claimed developers choose up to five languages from a finite supported set, contribution interests, and a difficulty. DevGlobe defaults supported languages from the claimed profile and stores these preferences plus the numeric IDs of dismissed public GitHub issues on the developer document.

## Eligible issues

Recommendations come from GitHub's public issue search. A candidate must be open, unassigned, unlocked, updated within 180 days, and belong to a public, active, non-archived repository with issues enabled. DevGlobe verifies that GitHub's repository community profile exposes a contribution guide. Pull requests, stale work, inaccessible repositories, short or spam-like titles, and repositories without contribution guidance are excluded.

The UI links to the canonical GitHub issue. A private, owner-scoped cache stores at most eight public issue summaries for 15 minutes. DevGlobe never stores issue bodies, comments, contributor identities, or repository content.

## Ranking

The bounded ranker prefers the developer's languages, selected interests, matching difficulty labels, recently updated work, and established repositories. Results include human-readable reasons, never a quality score. Ordering is deterministic, dismissed issue IDs are excluded, and at most eight recommendations are returned.

GitHub responses are cached briefly to protect API quota. Each claimed owner can perform at most two uncached recommendation fetches in five minutes, and an atomic shared Cosmos budget permits at most four cold refreshes per minute across all owners and app replicas. Each refresh uses one issue search and verifies at most three repositories. Cached reads do not consume either allowance. Missing configuration, rate limits, and upstream verification failures produce an unavailable state; valid searches with no eligible matches produce a separate empty state.