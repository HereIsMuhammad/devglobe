const PERIODS = [7, 30, 90];
const METRIC_FIELDS = ['score', 'totalStars', 'followers', 'totalCommits'];

function roundDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Snapshot date is invalid');
  return date.toISOString().slice(0, 10);
}

export function addLanguageRanks(developers) {
  const groups = new Map();
  for (const developer of developers) {
    if (!developer.topLanguage) continue;
    if (!groups.has(developer.topLanguage)) groups.set(developer.topLanguage, []);
    groups.get(developer.topLanguage).push(developer.login);
  }

  const ranks = new Map();
  for (const [language, logins] of groups) {
    logins.forEach((login, index) => ranks.set(login, {
      language,
      languageRank: index + 1,
      languageTotal: logins.length,
    }));
  }
  return developers.map(developer => ({ ...developer, ...(ranks.get(developer.login) || {}) }));
}

export function createImpactSnapshot(developer, capturedAt = new Date().toISOString()) {
  const day = roundDay(capturedAt);
  return {
    id: `${developer.login.toLowerCase()}:${day}`,
    documentType: 'impact-snapshot',
    schemaVersion: 1,
    login: developer.login.toLowerCase(),
    day,
    capturedAt: new Date(capturedAt).toISOString(),
    score: developer.score || 0,
    scoreDimensions: developer.scoreDimensions || {},
    totalStars: developer.totalStars || 0,
    followers: developer.followers || 0,
    totalCommits: developer.totalCommits || 0,
    globalRank: developer.globalRank || null,
    globalTotal: developer.globalTotal || null,
    country: developer.country || null,
    countryRank: developer.countryRank || null,
    countryTotal: developer.countryTotal || null,
    language: developer.language || developer.topLanguage || null,
    languageRank: developer.languageRank || null,
    languageTotal: developer.languageTotal || null,
  };
}

function latestOnOrBefore(history, targetTime) {
  return [...history]
    .filter(snapshot => Date.parse(snapshot.capturedAt) <= targetTime)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] || null;
}

function metricChanges(current, previous) {
  if (!previous) return null;
  return Object.fromEntries(METRIC_FIELDS.map(field => [field, current[field] - previous[field]]));
}

function rankChanges(current, previous) {
  if (!previous) return null;
  const change = field => Number.isInteger(current[field]) && Number.isInteger(previous[field])
    ? previous[field] - current[field]
    : null;
  return {
    globalRank: change('globalRank'),
    countryRank: current.country === previous.country ? change('countryRank') : null,
    languageRank: current.language === previous.language ? change('languageRank') : null,
  };
}

export function explainImpactChange(current, previous) {
  if (!previous || current.score === previous.score) return [];
  const labels = {
    stars: 'GitHub stars',
    commits: 'commit activity',
    repoReach: 'repository reach',
    soReputation: 'Stack Overflow reputation',
    soEngagement: 'Stack Overflow engagement',
    community: 'community reach',
  };
  return Object.keys(labels)
    .map(key => ({ key, change: (current.scoreDimensions?.[key] || 0) - (previous.scoreDimensions?.[key] || 0) }))
    .filter(item => Math.abs(item.change) >= 0.01)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3)
    .map(item => `${labels[item.key]} ${item.change > 0 ? 'increased' : 'decreased'}`);
}

export function buildImpactHistory(history, now = new Date()) {
  const ordered = [...history].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const current = ordered.at(-1) || null;
  if (!current) return { current: null, periods: {}, history: [], explanations: [] };

  const periods = {};
  for (const days of PERIODS) {
    const targetTime = now.getTime() - days * 24 * 60 * 60 * 1000;
    const previous = latestOnOrBefore(ordered, targetTime);
    periods[days] = previous ? {
      available: true,
      since: previous.capturedAt,
      metrics: metricChanges(current, previous),
      ranks: rankChanges(current, previous),
    } : { available: false };
  }

  const previous = ordered.length > 1 ? ordered.at(-2) : null;
  return { current, periods, history: ordered, explanations: explainImpactChange(current, previous) };
}

export function createRankMovementEvent(current, previous) {
  if (!previous || !Number.isInteger(current.globalRank) || !Number.isInteger(previous.globalRank)) return null;
  const movement = previous.globalRank - current.globalRank;
  if (movement === 0) return null;
  return {
    id: `rank_movement:${current.login}:${current.day}`,
    eventType: 'rank_movement',
    subjectLogin: current.login,
    language: current.language,
    country: current.country,
    summary: `Moved ${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} place${Math.abs(movement) === 1 ? '' : 's'} in the global ranking`,
    detail: { previousRank: previous.globalRank, currentRank: current.globalRank },
    createdAt: current.capturedAt,
    refreshCycle: current.day,
  };
}

export function canViewImpactHistory(developer, sessionLogin) {
  if (!developer) return false;
  if (developer.impactHistoryVisibility !== 'private') return true;
  return Boolean(sessionLogin && developer.login.toLowerCase() === sessionLogin.toLowerCase());
}

export { PERIODS };