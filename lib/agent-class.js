/**
 * Classify a developer into an AI Agent archetype based on their stats.
 */

const AGENT_CLASSES = [
  {
    id: 'stack-sage',
    name: 'The Stack Sage',
    icon: '🧙',
    tagline: 'Wisdom flows through every answer',
    color: '#f48024',
    gradient: ['#f48024', '#e06c10'],
    test: (d) => (d.soReputation || 0) >= 50000,
    priority: 1,
  },
  {
    id: 'star-collector',
    name: 'The Star Collector',
    icon: '⭐',
    tagline: 'Building what the world wants',
    color: '#f0c040',
    gradient: ['#f0c040', '#d4a020'],
    test: (d) => (d.totalStars || 0) >= 50000,
    priority: 2,
  },
  {
    id: 'committer',
    name: 'The Committer',
    icon: '⚡',
    tagline: 'Relentless force of contribution',
    color: '#8b5cf6',
    gradient: ['#8b5cf6', '#6d28d9'],
    test: (d) => (d.totalCommits || 0) >= 10000,
    priority: 3,
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    icon: '🛡️',
    tagline: 'Protecting critical infrastructure',
    color: '#3b82f6',
    gradient: ['#3b82f6', '#1d4ed8'],
    test: (d) => (d.totalForks || 0) >= 10000,
    priority: 4,
  },
  {
    id: 'architect',
    name: 'The Architect',
    icon: '🏗️',
    tagline: 'Designing the digital frontier',
    color: '#10b981',
    gradient: ['#10b981', '#059669'],
    test: (d) => (d.publicRepos || 0) >= 100,
    priority: 5,
  },
  {
    id: 'neural-net',
    name: 'The Neural Net',
    icon: '🤖',
    tagline: 'All systems fully operational',
    color: '#06b6d4',
    gradient: ['#06b6d4', '#0891b2'],
    test: () => true, // default fallback
    priority: 99,
  },
];

export function classifyAgent(dev) {
  // Score-based override: top-tier all-rounders get Neural Net
  if ((dev.score || 0) >= 85 && (dev.totalStars || 0) >= 10000 && (dev.soReputation || 0) >= 10000) {
    return AGENT_CLASSES.find(a => a.id === 'neural-net');
  }

  // Find the highest-priority matching class
  const matches = AGENT_CLASSES.filter(a => a.test(dev));
  matches.sort((a, b) => a.priority - b.priority);
  return matches[0] || AGENT_CLASSES[AGENT_CLASSES.length - 1];
}

/**
 * Get a power tier label based on score.
 */
export function getPowerTier(score) {
  if (score >= 90) return { tier: 'S', label: 'LEGENDARY', color: '#f0c040' };
  if (score >= 75) return { tier: 'A', label: 'ELITE', color: '#8b5cf6' };
  if (score >= 60) return { tier: 'B', label: 'ADVANCED', color: '#3b82f6' };
  if (score >= 40) return { tier: 'C', label: 'RISING', color: '#10b981' };
  return { tier: 'D', label: 'EMERGING', color: '#64748b' };
}
