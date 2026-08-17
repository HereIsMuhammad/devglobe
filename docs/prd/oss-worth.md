# PRD: OSS Worth

**Status:** Proposed
**Issue:** [#185](https://github.com/sajeetharan/devglobe/issues/185)
**Priority:** P1
**Last updated:** 2026-08-17

## Summary

DevGlobe will add a playful, transparent OSS Worth measure derived from the public GitHub and Stack Overflow contribution metrics it already indexes. A developer profile will show separate GitHub Worth and Stack Overflow Worth cards, while the leaderboard will show the combined OSS Worth and allow sorting by it.

OSS Worth is shown as fictional **OSS Credits (OSC)** and a playful estimated USD value. GitHub and Stack Overflow are valued independently and then added together. A profile without linked Stack Overflow data receives zero Stack Overflow value and clearly shows that the source is unavailable.

## Problem

DevGlobe exposes detailed contribution metrics and a relative 0-100 score, but users do not have a simple, shareable summary of their contribution footprint across both major sources. Existing public worth calculators provide engaging GitHub-only experiences. DevGlobe can provide a more complete version because it already combines GitHub creation signals with Stack Overflow knowledge-sharing signals.

The current DevGlobe score cannot be reused directly as worth because it is normalized against the current dataset. Its value can move when the indexed cohort changes, even if a developer's metrics do not. OSS Worth must be deterministic for the same inputs and formula version.

## Goals

- Produce a deterministic OSS Worth from existing public contribution metrics.
- Value GitHub and Stack Overflow independently with fixed per-unit rates.
- Explain every input and contribution to the result.
- Show GitHub and Stack Overflow as two distinct, equally understandable surfaces.
- Show compact OSS Worth in the leaderboard and support sorting by it.
- Keep values stable and uncapped as the DevGlobe dataset grows.
- Handle absent and partial source data honestly.
- Make the formula independently testable and versioned.

## Non-goals

- Estimating salary, consulting rates, employability, seniority, or commercial value.
- Replacing the existing DevGlobe score or changing existing rankings.
- Scraping private activity or data not already available through public APIs.
- Presenting the estimate as compensation, salary, or market value.
- Comparing contribution quality, code correctness, or answer correctness.

## Product principles

1. **Celebratory, not evaluative.** Every surface labels OSC as fictional and avoids language such as net worth, market value, cheap, expensive, or hireable.
2. **Transparent.** Users can inspect source metrics, normalized values, weights, caps, and formula version.
3. **Stable.** Fixed per-unit rates mean a result changes only when source metrics or the formula version changes.
4. **Source-aware.** Missing Stack Overflow data is unavailable, not zero participation and not a reason to change GitHub value.
5. **Additive.** Every public contribution signal adds value directly; there are no allocation ceilings or normalization caps.

## Formula v2

### Credits and dollars

Every calculated dollar maps to ten OSS Credits:

```text
credits = round(estimatedDollars * 10)
```

### GitHub Worth

GitHub follows the direct-value formula published by GitEstimate.

```text
githubDollars =
  totalCommits * $0.50 +
  followers * $0.10 +
  totalStars * $0.30
```

### Stack Overflow Worth

Stack Overflow uses analogous direct rates and remains separate from GitHub.

```text
stackoverflowDollars =
  soAnswers * $0.50 +
  soReputation * $0.10 +
  soBadges * $0.30
```

`hasStackOverflowData` is true when `soUserId` is present or at least one Stack Overflow metric is positive. A linked profile with all-zero public metrics is available with zero credits; an unlinked profile is unavailable with zero credits.

### Combined OSS Worth

```text
totalDollars = githubDollars + stackoverflowDollars
totalCredits = githubCredits + stackoverflowCredits
```

There is no maximum, allocation, normalization, or redistribution between platforms.

### Returned model

The pure calculator returns:

```json
{
  "formulaVersion": "oss-worth-v2",
  "totalCredits": 0,
  "totalDollarValue": 0,
  "github": {
    "available": true,
    "credits": 0,
    "dollarValue": 0,
    "breakdown": []
  },
  "stackoverflow": {
    "available": false,
    "credits": 0,
    "dollarValue": 0,
    "breakdown": []
  }
}
```

Each breakdown entry contains the source value, per-unit dollar rate, resulting dollar value, and credits.

## Data contract

No new external API calls are required. The v2 inputs already exist in developer documents:

- GitHub: `totalStars`, `totalCommits`, `followers`.
- Stack Overflow: `soUserId`, `soReputation`, `soAnswers`, `soBadges`.

The list and detail projections must include every formula input consistently. Search, cards, MCP, and persisted documents do not need new fields unless they display OSS Worth.

Worth should be computed through one shared pure module, proposed as `lib/oss-worth.js`. Callers may enrich a developer response with the returned model, but formula logic must not be duplicated in React components or API routes.

Persisting calculated credits is not required for MVP. If later needed for Cosmos sorting or querying, persist `ossWorth`, `githubWorth`, `stackoverflowWorth`, and `ossWorthFormulaVersion` together and refresh them whenever source metrics change.

## User experience

### Developer detail

Add an unframed **OSS Worth** section after the primary contribution statistics and before the existing score breakdown.

The section contains:

- A combined headline showing OSC and estimated USD with a short playful-estimate disclaimer.
- A GitHub Worth card showing its independent USD and OSC value and three source metrics.
- A Stack Overflow Worth card showing its independent USD and OSC value and three source metrics.
- A compact “How this is calculated” disclosure with formula version and per-unit rates.

The two cards are siblings, never nested. On desktop they use a two-column grid; on narrow screens they stack. GitHub and Stack Overflow retain their recognizable platform accents without making the page a one-color theme.

When Stack Overflow is unavailable, its card remains visible in an unavailable state with `No linked Stack Overflow profile` and zero value. It must not imply poor performance.

### Leaderboard

- Add a compact badge such as `OSC 428K · $42.8K` to each row.
- Add `Worth` to the existing sort menu.
- Sort descending by `totalCredits`, with the existing score and login as deterministic tie-breakers.
- Preserve the row's fixed height and virtualized layout; the new badge must not shift action controls or truncate the developer name.
- The existing score remains visible and remains the default sort.

### Accessibility and formatting

- Screen-reader text expands OSC to “OSS Credits.”
- Values use the existing compact-number formatter; tooltips expose the full integer.
- Platform cards do not rely on color alone.
- The disclaimer is visible text, not tooltip-only content.
- Zero and unavailable are distinct labels.

## Integration plan

1. Add `lib/oss-worth.js` with fixed rates, platform calculations, and combined calculation.
2. Add fixture-driven unit tests in `tests/oss-worth.test.js`.
3. Include every v2 formula input in the developer list/detail projections.
4. Enrich developers once in the landing-page data pipeline; do not calculate repeatedly during renders or sorting.
5. Add the OSS Worth section and two platform cards to `DetailPanel`.
6. Add the compact value and Worth sort option to `Leaderboard`.
7. Add responsive styles using the existing design tokens.
8. Document the formula and fictional-value disclaimer in public methodology copy.

## Analytics

Track only aggregate interaction events:

- `oss_worth_detail_viewed`
- `oss_worth_breakdown_opened`
- `leaderboard_sorted_by_worth`

Do not include raw contribution metrics, calculated credit values, email, or private profile data in analytics payloads.

## Testing

### Unit tests

- All-zero inputs produce zero credits.
- GitHub inputs produce the exact GitEstimate direct-value result.
- Stack Overflow values are calculated separately and added to the total.
- A linked all-zero Stack Overflow profile produces `available: true` and zero SO credits.
- Doubling any one metric doubles that metric's contribution.
- Negative, missing, and non-finite inputs are safely clamped.
- Formula version is always returned.

### UI tests

- Both cards render with complete data.
- The unavailable Stack Overflow state renders without hiding the card.
- Compact and full values are formatted correctly.
- Worth sorting is descending with deterministic ties.
- Leaderboard rows retain stable dimensions at desktop and mobile widths.
- The detail section stacks without overflow on mobile.

### Regression checks

- Existing DevGlobe scores and ranks are unchanged.
- Profiles, search, globe markers, and leaderboard still load when optional metrics are absent.
- `npm test` and `npm run build` pass.

## Rollout

1. Ship the pure calculator and tests behind no UI dependency.
2. Add API projections and compare sampled outputs for low, median, and high-activity profiles.
3. Enable the detail section.
4. Enable leaderboard display and sorting after virtualized-row checks.
5. Monitor UI errors and sort usage; formula changes require a new version and release note.

## Success metrics

- Percentage of profile-detail visitors who open the calculation disclosure.
- Percentage of leaderboard sessions that sort by Worth.
- Share-card generation after viewing OSS Worth, if sharing is added later.
- No measurable regression in leaderboard rendering or initial data-load time.

## Risks and mitigations

- **Misread as financial value:** use OSS Credits, display the disclaimer, and prohibit currency conversion in v1.
- **Metric gaming:** describe the direct estimate as playful rather than authoritative and expose every per-unit rate.
- **Stale source data:** show the existing metrics freshness timestamp near the methodology.
- **Missing Stack Overflow profiles:** show the source as unavailable and leave its value at zero.
- **Formula drift:** export constants from one module and include `formulaVersion` in every result.
- **Large payloads:** return the full breakdown only on detail surfaces if list payload size becomes material; leaderboard needs only total credits.

## References

- [GitEstimate](https://github.com/taqui-786/GitEstimate): direct GitHub valuation using contributions, followers, and stars.
- [CommitWorth](https://github.com/andreluizdasilvaa/CommitWorth): direct contribution rates, dashboard metrics, achievements, and generated cards.

The references inform product behavior only. DevGlobe will implement its own formula and code against its existing data model.
