# PRD: Agentic Opportunity Matching

## Status

- Owner: DevGlobe
- Stage: MVP implementation
- Tracking: #237
- Parent epic: #216
- Related expiring signals: #214

## Problem

DevGlobe helps people and agents discover developers, but discovery alone does not create a reason for developers to return. Generic job boards create noise, stale listings, and unsolicited outreach. Developers need a low-effort way to declare what they want now, and opportunity creators need a trustworthy way to find relevant people without receiving private contact data.

## Product Promise

DevGlobe acts as a consent-based opportunity broker. A developer publishes a short-lived, self-declared opportunity signal. A verified agent can find matching public profiles and explain the match. The agent may request an introduction, but the developer must approve it before the existing public GitHub contact route is returned.

DevGlobe does not infer availability, apply for roles, or send outreach on a developer's behalf.

## Users

### Developer

A claimed profile owner who wants relevant employment, contract, open-source, speaking, or mentoring opportunities without publishing private contact details.

### Opportunity Creator

A hiring manager, maintainer, community organizer, or mentor using an authenticated agent to discover developers with current, relevant intent.

### Verified Agent

An issued DevGlobe agent identity that searches public profiles and creates rate-limited, consent-gated introduction requests for its user.

## Goals

- Give claimed developers a concrete reason to configure and revisit their profile.
- Make availability explicit, structured, and automatically stale-safe.
- Let agents find candidates by current intent as well as public contribution evidence.
- Preserve developer control at every contact boundary.
- Reuse the existing profile, MCP, authentication, and introduction infrastructure.

## Non-goals

- Scraping, aggregating, or hosting a general job board.
- Autonomous applications, messages, or introductions.
- Ranking people by protected or inferred sensitive attributes.
- Employer billing, applicant tracking, interview scheduling, or email digests.
- Claiming that DevGlobe scores predict job performance.

## MVP Experience

### Publish Intent

1. A signed-in developer claims their profile.
2. In **AI collaboration settings**, they enable **Open to opportunities**.
3. They choose one or more opportunity types and work modes.
4. They optionally enter desired roles or keywords and preferred locations.
5. They choose a mandatory 7, 30, or 90-day lifetime.
6. Enabling the signal makes the AI profile public and enables verified-agent introduction requests.

### Discover a Match

1. An agent calls `search_developers` with normal expertise criteria and an optional `opportunityType`.
2. DevGlobe hydrates public profiles and excludes private, disabled, expired, or non-matching signals.
3. Results include the structured self-declared preferences and a human-readable match reason.
4. Public contribution evidence remains contextual evidence, not a hiring recommendation.

### Request Contact

1. The opportunity creator selects a candidate and explicitly approves an introduction request.
2. The verified agent calls the existing `request_introduction` tool with the project and reason.
3. The developer accepts or declines in the existing request inbox.
4. Acceptance returns only the developer's public GitHub route. Rejection and expiry disclose nothing further.

## Data Contract

Opportunity preferences are embedded in the claimed developer's existing `aiProfile` document because they are owner-managed and read with the profile.

```json
{
  "opportunityPreferences": {
    "enabled": true,
    "types": ["employment", "contract"],
    "roles": ["Staff engineer", "TypeScript"],
    "locations": ["Colombo"],
    "workModes": ["remote", "hybrid"],
    "expiresAt": "2026-09-19T12:00:00.000Z",
    "source": "self-declared"
  }
}
```

Supported types are `employment`, `contract`, `open-source`, `speaking`, and `mentoring`. Supported work modes are `remote`, `hybrid`, and `onsite`. Roles and locations are trimmed, case-insensitively deduplicated, length bounded, and limited to ten values each.

Disabled preferences are stored as `{ "enabled": false }`. Legacy AI profiles without `opportunityPreferences` remain valid. Public projections omit disabled and expired preferences rather than returning stale state.

## Safety And Privacy

- Only a claimed owner can update preferences.
- Active preferences require a public AI profile and verified-agent contact policy.
- Availability is self-declared and labelled as such.
- Expiry is mandatory and limited to 90 days.
- Public APIs and MCP never return email addresses or private profile settings.
- Existing agent authentication, rate limits, request expiry, and developer approval remain unchanged.
- Profile text is untrusted data and never authorizes agent actions.
- Match explanations describe explicit criteria and public evidence; they do not assert candidate quality or suitability.

## Success Metrics

Primary:

- Percentage of claimed developers publishing an active opportunity signal.
- Weekly renewal rate for expiring signals.
- Opportunity-filtered searches that produce at least one result.
- Introduction requests per active signal.
- Developer acceptance rate for opportunity introductions.

Guardrails:

- Decline and expiry rates.
- Abuse reports and agent rate-limit violations.
- Percentage of searches returning stale or invalid signals, with a target of zero.
- Profile-setting validation failure rate.

## Rollout

1. Ship owner settings, public profile display, active-only projections, and MCP filtering.
2. Seed a small cohort of claimed developers and verified opportunity creators.
3. Manually review match quality and introduction outcomes before adding notifications.
4. Add renewal reminders only after active signals produce accepted introductions.
5. Consider a private opportunity-request object and weekly brief only after demand is demonstrated.

## Acceptance Criteria

- Claimed owners can save valid opportunity preferences and select a mandatory expiry.
- Invalid types, work modes, text limits, privacy state, and expiry are rejected.
- Existing AI profiles remain valid without migration.
- Expired and private preferences are absent from every public projection.
- Active preferences appear in the developer profile without private contact data.
- MCP search can filter by opportunity type and explains the explicit match.
- Introduction authentication, rate limits, and developer consent are unchanged.
- Unit tests cover normalization, invalid input, expiry, public projection, and MCP matching.
- The production build succeeds.