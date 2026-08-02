# 🌍 DevGlobe — Visualizing the World's Top Open-Source Contributors

<p align="center">
  <img src="https://img.shields.io/badge/status-active-success" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/github/stars/sajeetharan/devglobe?style=social" alt="Stars" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/D3.js-Data%20Viz-F9A03C?logo=d3.js&logoColor=white" alt="D3.js" />
  <img src="https://img.shields.io/badge/globe.gl-3D%20Globe-blueviolet" alt="globe.gl" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Azure%20Cosmos%20DB-Database-0089D6?logo=microsoftazure&logoColor=white" alt="Azure Cosmos DB" />
</p>

<p align="center">
  <b>An interactive 3D globe showcasing 40,000+ top open-source contributors worldwide, ranked by GitHub stars, commits, and Stack Overflow impact.</b>
</p>

<p align="center">
  🔗 <a href="https://dev-globe-viz.vercel.app">Live Demo</a>
</p>

---

## 📸 Preview

<!-- TODO: Replace with an actual screenshot or GIF of the globe in action -->
<p align="center">
  <img src="docs/preview.gif" alt="DevGlobe demo preview" width="800" />
</p>

> Want to add this? Drop a screenshot or screen recording of the globe UI in a `docs/` folder and update the path above — see [good first issues](https://github.com/sajeetharan/devglobe/issues) for details.

---

## ✨ Features

- 🌐 **Interactive 3D globe** — pan, zoom, and rotate through developer locations in real time
- 🏆 **Composite ranking** — developers scored across GitHub stars, commits, repo reach, and Stack Overflow reputation
- 📊 **Rich detail panels** — radar charts, heatmaps, and donut charts per developer, powered by D3.js
- 🔍 **Searchable leaderboard** — filter and search 40,000+ contributors from a ranked sidebar
- ⚡ **Fast, serverless data layer** — Vercel serverless functions backed by Azure Cosmos DB
- 🧩 **Zero-config local dev** — runs instantly with bundled sample data, no API keys required

---

## 🏗️ Architecture

```
                     ┌─────────────────────┐
                     │   Data Sources       │
                     │  GitHub GraphQL API  │
                     │  Stack Overflow API  │
                     │  Geocoding API       │
                     └──────────┬───────────┘
                                │
                                ▼
                 ┌───────────────────────────┐
                 │   scripts/ (build pipeline) │
                 │  fetch → enrich → geocode   │
                 │        → score              │
                 └──────────────┬─────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Azure Cosmos DB      │
                     │  (developer records)  │
                     └──────────┬───────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │  api/developers.js        │
                   │  Vercel serverless        │
                   └──────────────┬───────────┘
                                  │
                                  ▼
                     ┌─────────────────────┐
                     │   Frontend (src/)     │
                     │  globe.js — 3D globe  │
                     │  detail-panel.js — D3 │
                     │  leaderboard.js       │
                     │  scoring.js           │
                     └───────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| 3D Visualization | [globe.gl](https://globe.gl/) (Three.js) |
| Charts | [D3.js](https://d3js.org/) |
| Frontend | Vanilla JavaScript (no framework), CSS custom properties |
| Backend | [Vercel Serverless Functions](https://vercel.com/docs/functions) |
| Database | [Azure Cosmos DB](https://azure.microsoft.com/en-us/products/cosmos-db) |
| Data Sources | GitHub GraphQL API, Stack Overflow API, Geocoding API |

---

## 🚀 Quick Start (with sample data)

```bash
npm install
npx serve . -l 3000
# Open http://localhost:3000
```

No API keys required — the app ships with bundled sample data for local development.

## 🔧 Build Full Dataset (with API keys)

1. Copy `.env.example` to `.env` and fill in your tokens
2. Run the data pipeline:

```bash
npm run build-data
```

This executes: **GitHub fetch → StackOverflow fetch → Geocoding → Scoring**

3. Update `DATA_URL` in `src/app.js` to `'data/developers.json'`

### Individual Pipeline Steps

```bash
npm run fetch-github        # Fetch top devs from GitHub GraphQL
npm run fetch-stackoverflow # Enrich with SO reputation
npm run geocode              # Convert locations to lat/lng
```

## ☁️ Deploy to Vercel

```bash
npx vercel
```

Environment variables needed: `GITHUB_TOKEN`, `SO_API_KEY`, `GEOCODE_API_KEY`

---

## 📁 Project Structure

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

## 📐 Scoring Formula (0–100)

| Dimension | Weight | Source |
|---|---|---|
| GitHub Stars | 25% | Total stars |
| GitHub Commits | 25% | Yearly commits |
| Repo Reach | 20% | Forks + watchers |
| SO Reputation | 15% | StackOverflow rep |
| SO Engagement | 10% | Acceptance × answers |
| Community | 5% | Followers + badges |

All dimensions are log-normalized to prevent outlier domination.

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, code style, and open areas to help with.

## 📄 License

MIT