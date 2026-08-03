// Weights for each dimension
const WEIGHTS = {
  stars: 0.25,
  commits: 0.25,
  repoReach: 0.20,
  soReputation: 0.15,
  soEngagement: 0.10,
  community: 0.05,
};

function logNormalize(value, max) {
  if (value <= 0 || max <= 0) return 0;
  return Math.log(1 + value) / Math.log(1 + max);
}

function linearNormalize(value, max) {
  if (max <= 0) return 0;
  return Math.min(value / max, 1);
}

function computeScore(dev, maxValues) {
  const dimensions = {
    stars: logNormalize(dev.totalStars || 0, maxValues.stars),
    commits: logNormalize(dev.totalCommits || 0, maxValues.commits),
    repoReach: logNormalize((dev.totalForks || 0) + (dev.totalWatchers || 0), maxValues.repoReach),
    soReputation: logNormalize(dev.soReputation || 0, maxValues.soReputation),
    soEngagement: linearNormalize(
      ((dev.soAcceptRate || 0) / 100) * (dev.soAnswers || 0),
      maxValues.soEngagement
    ),
    community: logNormalize((dev.followers || 0) + (dev.soBadges || 0), maxValues.community),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    score += dimensions[key] * weight;
  }

  return { total: Math.round(score * 100), dimensions };
}

export function scoreAll(developers) {
  const maxValues = {
    stars: Math.max(...developers.map(d => d.totalStars || 0)),
    commits: Math.max(...developers.map(d => d.totalCommits || 0)),
    repoReach: Math.max(...developers.map(d => (d.totalForks || 0) + (d.totalWatchers || 0))),
    soReputation: Math.max(...developers.map(d => d.soReputation || 0)),
    soEngagement: Math.max(...developers.map(d => ((d.soAcceptRate || 0) / 100) * (d.soAnswers || 0))),
    community: Math.max(...developers.map(d => (d.followers || 0) + (d.soBadges || 0))),
  };

  return developers
    .map(dev => {
      const { total, dimensions } = computeScore(dev, maxValues);
      return { ...dev, score: total, scoreDimensions: dimensions };
    })
    .sort((a, b) => b.score - a.score);
}

export function getPlatformColor(dimensions) {
  const githubStrength = dimensions.stars + dimensions.commits + dimensions.repoReach;
  const soStrength = dimensions.soReputation + dimensions.soEngagement;
  if (githubStrength > soStrength * 3) return '#2ea44f';
  if (soStrength > githubStrength * 1.5) return '#f48024';
  return '#3b82f6';
}

export { WEIGHTS };
