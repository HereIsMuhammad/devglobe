/**
 * Fetch top GitHub developers using GraphQL API
 *
 * Usage: GITHUB_TOKEN=ghp_xxx node scripts/fetch-github.js
 * Output: data/github-raw.json
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  console.error('Create one at https://github.com/settings/tokens');
  process.exit(1);
}

const GRAPHQL_URL = 'https://api.github.com/graphql';

// Countries/regions to search — we fetch top devs per location
const COUNTRY_QUERIES = [
  'United States', 'USA', 'San Francisco', 'New York', 'Seattle',
  'China', 'Beijing', 'Shanghai', 'Shenzhen',
  'India', 'Bangalore', 'Mumbai', 'Delhi',
  'United Kingdom', 'London',
  'Germany', 'Berlin', 'Munich',
  'Brazil', 'São Paulo',
  'Canada', 'Toronto', 'Vancouver',
  'France', 'Paris',
  'Japan', 'Tokyo',
  'Australia', 'Sydney', 'Melbourne',
  'Russia', 'Moscow',
  'Netherlands', 'Amsterdam',
  'Sweden', 'Stockholm',
  'South Korea', 'Seoul',
  'Israel', 'Tel Aviv',
  'Singapore',
  'Poland', 'Warsaw',
  'Spain', 'Barcelona', 'Madrid',
  'Italy', 'Milan',
  'Switzerland', 'Zurich',
  'Indonesia', 'Jakarta',
  'Turkey', 'Istanbul',
  'Nigeria', 'Lagos',
  'Argentina', 'Buenos Aires',
  'Ukraine', 'Kyiv',
  'Vietnam', 'Ho Chi Minh',
  'Taiwan', 'Taipei',
  'Mexico', 'Mexico City',
  'Ireland', 'Dublin',
  'Finland', 'Helsinki',
  'Denmark', 'Copenhagen',
  'Norway', 'Oslo',
  'Portugal', 'Lisbon',
  'Austria', 'Vienna',
  'Czech Republic', 'Prague',
  'Romania', 'Bucharest',
  'Pakistan', 'Karachi',
  'Bangladesh', 'Dhaka',
  'Kenya', 'Nairobi',
  'South Africa', 'Cape Town',
  'Egypt', 'Cairo',
  'Colombia', 'Bogota',
  'Chile', 'Santiago',
  'Philippines', 'Manila',
  'Thailand', 'Bangkok',
  'Malaysia', 'Kuala Lumpur',
  'New Zealand', 'Auckland',
  'Belgium', 'Brussels',
  'Greece', 'Athens',
  'Hungary', 'Budapest',
  'Sri Lanka', 'Colombo',
  'Nepal', 'Kathmandu',
  'Peru', 'Lima',
  'Ghana', 'Accra',
  'Ethiopia', 'Addis Ababa',
  'Morocco',
];

async function graphql(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  // Accept partial data with resource limit warnings
  if (data.errors && !data.data) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors.slice(0, 2))}`);
  }
  if (data.errors) {
    console.log(`    ⚠ Partial data returned (${data.errors.length} resource limit warnings)`);
  }
  return data.data;
}

async function searchUsers(query, first = 100) {
  const gql = `
    query($query: String!, $first: Int!, $after: String) {
      search(query: $query, type: USER, first: $first, after: $after) {
        nodes {
          ... on User {
            login
            name
            avatarUrl
            location
            followers { totalCount }
            repositories(first: 5, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
              totalCount
              nodes {
                name
                stargazerCount
                forkCount
                primaryLanguage { name }
              }
            }
            contributionsCollection {
              totalCommitContributions
              restrictedContributionsCount
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const allNodes = [];
  let after = null;
  // Use small batches (20) to avoid GraphQL resource limits
  const batchSize = 20;
  const pages = Math.ceil(first / batchSize);

  for (let page = 0; page < pages; page++) {
    const remaining = Math.min(batchSize, first - allNodes.length);
    try {
      const data = await graphql(gql, { query: `type:user ${query}`, first: remaining, after });
      const nodes = (data.search.nodes || []).filter(n => n.login);
      allNodes.push(...nodes);

      if (!data.search.pageInfo.hasNextPage || allNodes.length >= first) break;
      after = data.search.pageInfo.endCursor;
    } catch (err) {
      console.log(`    ⚠ Page ${page + 1} failed: ${err.message.slice(0, 80)}`);
      break;
    }

    // Pause between pages
    await new Promise(r => setTimeout(r, 1000));
  }

  return allNodes;
}

function processUser(user) {
  const repos = user.repositories.nodes || [];
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazerCount || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forkCount || 0), 0);
  const totalWatchers = repos.reduce((sum, r) => sum + (r.forkCount || 0), 0); // Use forks as proxy

  // Top language by frequency
  const langCounts = {};
  repos.forEach(r => {
    const lang = r.primaryLanguage?.name;
    if (lang) langCounts[lang] = (langCounts[lang] || 0) + 1;
  });
  const topLanguage = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Language percentages
  const totalLangRepos = Object.values(langCounts).reduce((s, v) => s + v, 0);
  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, percent: Math.round((count / totalLangRepos) * 100) }));

  const contributions = user.contributionsCollection;
  const totalCommits = (contributions?.totalCommitContributions || 0) +
    (contributions?.restrictedContributionsCount || 0);

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.location,
    followers: user.followers?.totalCount || 0,
    totalStars,
    totalCommits,
    totalForks,
    totalWatchers,
    topLanguage,
    languages,
    topRepos: repos.slice(0, 5).map(r => ({
      name: r.name,
      stars: r.stargazerCount,
      forks: r.forkCount
    }))
  };
}

async function main() {
  console.log('Fetching top GitHub developers by country/city...\n');
  const allUsers = new Map();

  // First: get globally top devs
  const globalQueries = [
    'followers:>10000',
    'repos:>100 followers:>5000',
  ];

  for (const query of globalQueries) {
    console.log(`  Global search: ${query}`);
    try {
      const users = await searchUsers(query, 100);
      users.forEach(u => {
        if (!allUsers.has(u.login)) {
          allUsers.set(u.login, processUser(u));
        }
      });
      console.log(`    Found ${users.length} users (total unique: ${allUsers.size})`);
    } catch (err) {
      console.error(`    Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Then: search per country/city with lower follower thresholds
  for (const location of COUNTRY_QUERIES) {
    const query = `followers:>500 location:"${location}"`;
    console.log(`  Searching: ${query}`);
    try {
      const users = await searchUsers(query, 50);
      users.forEach(u => {
        if (!allUsers.has(u.login)) {
          allUsers.set(u.login, processUser(u));
        }
      });
      console.log(`    Found ${users.length} users (total unique: ${allUsers.size})`);
    } catch (err) {
      console.error(`    Error: ${err.message}`);
    }

    // Rate limit pause — GitHub allows 30 requests/min for search
    await new Promise(r => setTimeout(r, 2500));
  }

  // Sort by total stars — no cap, keep all
  const sorted = [...allUsers.values()]
    .sort((a, b) => b.totalStars - a.totalStars);

  mkdirSync('data', { recursive: true });
  writeFileSync('data/github-raw.json', JSON.stringify(sorted, null, 2));
  console.log(`\nSaved ${sorted.length} developers to data/github-raw.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
