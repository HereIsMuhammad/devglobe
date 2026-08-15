# Embeddable developer badge

**Issue:** [#145](https://github.com/sajeetharan/devglobe/issues/145)

Any developer indexed on DevGlobe can embed a live-updating badge in a GitHub README, personal site, or blog. The badge is a small SVG image, in the same spirit as shields.io and committers.top badges.

## Markdown

```markdown
[![devglobe](https://www.devglobe.dev/api/badge/YOUR_GITHUB_USERNAME.svg)](https://www.devglobe.dev/share/YOUR_GITHUB_USERNAME)
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub login. That's the whole setup — nothing to install, no script, no auth.

## HTML

```html
<a href="https://www.devglobe.dev/share/YOUR_GITHUB_USERNAME">
  <img src="https://www.devglobe.dev/api/badge/YOUR_GITHUB_USERNAME.svg" alt="devglobe badge" />
</a>
```

## Choosing what the badge shows

Add `?stat=` to the URL:

| `stat` value | Shows |
|---|---|
| `globalRank` (default) | `Global #4` |
| `countryRank` | `USA #2` |
| `score` | `91/100` |
| `stars` | `182.0K stars` |

Example:

```markdown
![devglobe](https://www.devglobe.dev/api/badge/YOUR_GITHUB_USERNAME.svg?stat=countryRank)
```

## Staying up to date

The badge has no server-side cache beyond a 1-hour edge cache (`s-maxage=3600`), so it reflects the latest data DevGlobe has for that developer — it updates automatically as soon as the developer's underlying stats refresh (currently on DevGlobe's periodic contribution refresh cycle; see [#124](https://github.com/sajeetharan/devglobe/issues/124)). There is nothing for the developer to re-run or re-embed — the same URL just renders differently over time.

## If a developer isn't ranked yet

The endpoint never 404s for a syntactically valid GitHub username — a developer with no DevGlobe data yet gets a grey **"unranked"** badge instead of a broken image, so READMEs never show a broken-image icon.

## Endpoint

`GET /api/badge/[login].svg` — public, no auth required, only exposes fields already public via `/api/developer` (rank, score, star count). See `lib/badge.js` for stat resolution and SVG rendering, and `lib/badge-lookup.js` for the data source (Cosmos DB, falling back to bundled sample data — same pattern as `/api/card`).
