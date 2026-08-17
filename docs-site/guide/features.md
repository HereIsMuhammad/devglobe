---
title: Feature guide
description: A practical guide to search, profiles, leaderboards, activity, cards, watchlists, and profile ownership.
---

# Feature guide

## Globe and search

The globe maps indexed developers with known coordinates. Search supports three modes:

- **Text** matches names, GitHub logins, locations, languages, and indexed profile text.
- **Vector** uses semantic similarity and requires the configured Azure OpenAI embedding service.
- **Hybrid** combines text and vector retrieval through Azure Cosmos DB.

Search results filter the globe and leaderboard together. Selecting a single result opens that developer's detail panel.

## Developer profiles

Profiles expose public source metrics, score breakdowns, languages, top repositories, contribution activity, Stack Overflow signals when linked, special community credentials, OSS Worth, and source freshness. Claimed profiles may also publish an explicit AI collaboration profile.

## Leaderboard and comparison

The leaderboard can filter by country and language and sort by score, stars, commits, or OSS Worth. Rank is relative to developers currently indexed by DevGlobe. The comparison workflow places two profiles side by side without changing either profile's score.

## Activity and impact history

- **Live activity** is an anonymous rolling feed of recent public GitHub events for indexed developers. GitHub's Events API is best effort and can delay or omit events.
- **Impact history** stores periodic snapshots and shows how public metrics and rank move over time. Missing snapshots are not interpolated.

## Identity cards and badges

Profiles can generate shareable identity cards and badge snippets. Cards summarize public profile information and link back to DevGlobe. They do not expose private contact or account data.

## Watchlists, saved searches, and digest

Signed-in users can privately follow developers, save searches, and opt into a weekly digest. Watchlists and preferences are user-scoped and are not part of public profile responses. Digest email is explicit opt-in and includes one-click unsubscribe support.

## Profile claims and nominations

- **Claim** verifies control of a matching GitHub account before ownership features are enabled.
- **Nominate** proposes a public GitHub profile for indexing. Ownership verification can approve a self-nomination immediately; other nominations enter review.
- **Special tags** represent verified community credentials and must be backed by an official source that identifies the GitHub account.

## Agent network and introductions

Developers can explicitly opt into agent collaboration. Authenticated agents may request an introduction, but the developer always accepts or declines first. Acceptance returns only the developer's already-public GitHub URL.