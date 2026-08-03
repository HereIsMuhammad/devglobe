<<<<<<< HEAD
<div align="center">

# 🌐 DevGlobe

**Visualizing the World's Top Open-Source Contributors on an Interactive 3D Globe**

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge&logo=vercel)](https://devglobe.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/sajeetharan/devglobe?style=for-the-badge&logo=github)](https://github.com/sajeetharan/devglobe/stargazers)
[![License](https://img.shields.io/github/license/sajeetharan/devglobe?style=for-the-badge)](LICENSE)

<img src="assets/img/devglobe.gif" alt="DevGlobe Demo" width="800" />

*26,000+ developers · ranked by stars, commits, repo reach & StackOverflow reputation*

</div>
=======
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
>>>>>>> origin/main

---

## ✨ Features

<<<<<<< HEAD
- **Interactive 3D Globe** — Explore developers pinned to their real-world locations using Three.js
- **AI-Powered Search** — Hybrid + vector search via Azure Cosmos DB (e.g. "AI & deep learning", "full stack JS dev")
- **Composite Scoring** — Each developer scored 0–100 across 6 dimensions
- **Leaderboard** — Filter by country, language, or sort by score/stars/commits
- **Developer Profiles** — Click any pin to see detailed stats, top repos, and contribution breakdown
- **Mobile Responsive** — Bottom-sheet filters and full-width search on smaller screens

## 🚀 Quick Start
=======
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
>>>>>>> origin/main

```bash
git clone https://github.com/sajeetharan/devglobe.git
cd devglobe
npm install
npm run dev
# Open http://localhost:5173
```

<<<<<<< HEAD
The app runs with sample data out of the box — no API keys needed for local development.
=======
No API keys required — the app ships with bundled sample data for local development.

## 🔧 Build Full Dataset (with API keys)
>>>>>>> origin/main

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Three.js (react-globe.gl), Vite |
| Search | Azure Cosmos DB (vector + hybrid search) |
| API | Vercel Serverless Functions |
| Hosting | Vercel |
| Data Pipeline | Node.js scripts (GitHub GraphQL, StackOverflow API, geocoding) |

## 📊 Scoring Formula (0–100)

| Dimension | Weight | Source |
|-----------|--------|--------|
| GitHub Stars | 25% | Total stars across repos |
| GitHub Commits | 25% | Yearly commit activity |
| Repo Reach | 20% | Forks + watchers |
| SO Reputation | 15% | StackOverflow reputation |
| SO Engagement | 10% | Answer acceptance × count |
| Community | 5% | Followers + badges |

All dimensions are log-normalized to prevent outlier domination.

## 🔧 Building the Full Dataset

Requires API keys — copy `.env.example` to `.env` and fill in your tokens.

```bash
npm run fetch-github          # Fetch top devs from GitHub GraphQL
npm run fetch-stackoverflow   # Enrich with StackOverflow reputation
npm run geocode               # Convert locations to lat/lng
npm run build-data            # Run full pipeline
npm run upload-cosmos         # Upload to Azure Cosmos DB
```

<<<<<<< HEAD
## 📁 Project Structure

```
├── index.html                  # Entry HTML
├── src/
│   ├── main.jsx                # App bootstrap + Vercel Analytics
│   ├── App.jsx                 # Root component, data loading
│   ├── components/
│   │   ├── Globe.jsx           # 3D globe (react-globe.gl)
│   │   ├── Leaderboard.jsx     # Ranked sidebar with filters
│   │   ├── SearchBar.jsx       # Hybrid/vector search input
│   │   ├── DetailPanel.jsx     # Developer detail card
│   │   ├── Header.jsx          # Top bar with branding
│   │   └── LoadingOverlay.jsx  # Loading state
│   └── utils/
│       ├── scoring.js          # Composite scoring algorithm
│       └── format.js           # Number formatting helpers
├── api/
│   ├── developers.js           # List all developers
│   ├── developer.js            # Single developer lookup
│   └── search.js               # Cosmos DB vector/hybrid search
├── scripts/                    # Data pipeline scripts
├── styles/main.css             # Dark theme styles
└── data/
    └── developers-sample.json  # Sample data for local dev
```

## 🌍 Deploy to Vercel
=======
This executes: **GitHub fetch → StackOverflow fetch → Geocoding → Scoring**

3. Update `DATA_URL` in `src/app.js` to `'data/developers.json'`

### Individual Pipeline Steps

```bash
npm run fetch-github        # Fetch top devs from GitHub GraphQL
npm run fetch-stackoverflow # Enrich with SO reputation
npm run geocode              # Convert locations to lat/lng
```

## ☁️ Deploy to Vercel
>>>>>>> origin/main

```bash
npx vercel
```

Required environment variables:

<<<<<<< HEAD
| Variable | Purpose |
|----------|---------|
| `COSMOS_ENDPOINT` | Azure Cosmos DB endpoint |
| `COSMOS_KEY` | Azure Cosmos DB key |
| `COSMOS_DATABASE` | Database name |
| `COSMOS_CONTAINER` | Container name |
=======
---

## 📁 Project Structure
>>>>>>> origin/main

## 🤝 Contributing

<<<<<<< HEAD
Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and areas where help is needed.

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**[⭐ Star this repo](https://github.com/sajeetharan/devglobe)** if you find it useful!

Built with ❤️ by [@sajeetharan](https://github.com/sajeetharan)

</div>
=======
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
>>>>>>> origin/main
