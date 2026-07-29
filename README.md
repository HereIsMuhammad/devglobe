# DevGlobe — Visualizing the World's Top Open-Source Contributors

Interactive 3D globe showing the world's top GitHub developers, scored by commits, stars, repo reach, and StackOverflow contributions.

## Quick Start (with sample data)

```bash
npm install
npx serve . -l 3000
# Open http://localhost:3000
```

## Build Full Dataset (with API keys)

1. Copy `.env.example` to `.env` and fill in your tokens
2. Run the data pipeline:

```bash
npm run build-data
```

This executes: GitHub fetch → StackOverflow fetch → Geocoding → Scoring

3. Update `DATA_URL` in `src/app.js` to `'data/developers.json'`

## Individual Pipeline Steps

```bash
npm run fetch-github       # Fetch top devs from GitHub GraphQL
npm run fetch-stackoverflow # Enrich with SO reputation
npm run geocode            # Convert locations to lat/lng
```

## Deploy to Vercel

```bash
npx vercel
```

Environment variables needed: `GITHUB_TOKEN`, `SO_API_KEY`, `GEOCODE_API_KEY`

## Project Structure

```
├── index.html              # Main page
├── styles/main.css         # Dark theme UI
├── src/
│   ├── app.js              # Entry point, orchestration
│   ├── globe.js            # 3D globe (globe.gl)
│   ├── detail-panel.js     # D3 charts (radar, heatmap, donut)
│   ├── leaderboard.js      # Ranked sidebar with search/filter
│   └── scoring.js          # Composite scoring algorithm
├── api/
│   └── developers.js       # Vercel serverless endpoint
├── scripts/
│   ├── build-dataset.js    # Full pipeline orchestrator
│   ├── fetch-github.js     # GitHub GraphQL fetcher
│   ├── fetch-stackoverflow.js # SO API fetcher
│   └── geocode.js          # Location → coordinates
└── data/
    └── developers-sample.json # Sample data (20 devs)
```

## Scoring Formula (0-100)

| Dimension       | Weight | Source            |
|----------------|--------|-------------------|
| GitHub Stars    | 25%    | Total stars       |
| GitHub Commits  | 25%    | Yearly commits    |
| Repo Reach      | 20%    | Forks + watchers  |
| SO Reputation   | 15%    | StackOverflow rep |
| SO Engagement   | 10%    | Acceptance × answers |
| Community       | 5%     | Followers + badges |

All dimensions are log-normalized to prevent outlier domination.
