import { AI_TOOLS, getPublicAiProfile } from './ai-profile.js';
import { extractCountry, normalizeCountry } from './country.js';

export const AGENT_NETWORK_PRIVACY_THRESHOLD = 3;

function reportMetric(value, threshold) {
  return value >= threshold
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function getIntroductionLifecycle(status, expiresAt, now = new Date()) {
  const expired = status === 'pending' && expiresAt && expiresAt <= now.toISOString();
  const terminal = expired ? 'expired' : status;

  return [
    { id: 'requested', label: 'Requested', state: 'complete' },
    {
      id: 'review',
      label: 'Review',
      state: terminal === 'pending' ? 'current' : 'complete',
    },
    {
      id: terminal === 'pending' ? 'connect' : terminal,
      label: terminal === 'pending' ? 'Connect' : terminal.charAt(0).toUpperCase() + terminal.slice(1),
      state: terminal === 'pending' ? 'upcoming' : 'current',
    },
  ];
}

export function buildAgentNetworkSnapshot({ developers = [], introductionCounts = {} }, threshold = AGENT_NETWORK_PRIVACY_THRESHOLD) {
  const toolNames = new Map(AI_TOOLS.map(tool => [tool.id, tool.name]));
  const toolCounts = new Map();
  const countries = new Set();

  const openDevelopers = developers.filter(developer => {
    const profile = getPublicAiProfile(developer.aiProfile);
    return developer.claimed === true
      && profile?.acceptsAgentRequests === true
      && profile.contactPolicy === 'verified-agents';
  });

  for (const developer of openDevelopers) {
    const country = normalizeCountry(extractCountry(developer.location || ''));
    if (country) countries.add(country.toLowerCase());

    for (const tool of developer.aiProfile.tools) {
      toolCounts.set(tool.id, (toolCounts.get(tool.id) || 0) + 1);
    }
  }

  const tools = [...toolCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([id, count]) => ({ id, name: toolNames.get(id) || id, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));

  return {
    privacyThreshold: threshold,
    metrics: {
      openDevelopers: reportMetric(openDevelopers.length, threshold),
      acceptedConnections: reportMetric(introductionCounts.accepted || 0, threshold),
      pendingRequests: reportMetric(introductionCounts.pending || 0, threshold),
      countries: reportMetric(countries.size, threshold),
    },
    tools,
  };
}
