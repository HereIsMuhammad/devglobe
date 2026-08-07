/**
 * DevGlobe score
 * -----------------
 * The 0-100 score is a *relative ranking signal*, not an absolute measure of
 * developer skill or worth. Every dimension is normalized against the
 * maximum value seen in the current indexed dataset, so a score reflects
 * "how this profile compares to the developers DevGlobe has indexed" —
 * it will shift as the dataset grows or changes, and it says nothing about
 * developers who aren't indexed.
 *
 * When a profile has no linked Stack Overflow activity, the two SO-based
 * dimensions (soReputation, soEngagement) contribute 0 and their combined
 * 25% weight is redistributed proportionally across the three GitHub-only
 * dimensions (stars, commits, repoReach) plus community, so the score stays
 * comparable across profiles with and without a Stack Overflow presence.
 */

// Weights for each dimension
const WEIGHTS = {
  stars: 0.25,
  commits: 0.25,
  repoReach: 0.20,
  soReputation: 0.15,
  soEngagement: 0.10,
  community: 0.05,
};

// Human-readable metadata for each scoring dimension, used to render the
// score breakdown in the UI (leaderboard tooltip + profile detail panel).
export const DIMENSIONS = [
  {
    key: 'stars',
    label: 'GitHub Stars',
    description: 'Total stars across owned repositories, log-scaled against the dataset maximum.',
  },
  {
    key: 'commits',
    label: 'Commit Activity',
    description: 'Total tracked commit contributions, log-scaled against the dataset maximum.',
  },
  {
    key: 'repoReach',
    label: 'Repo Reach',
    description: 'Combined forks and watchers across owned repositories, log-scaled.',
  },
  {
    key: 'soReputation',
    label: 'Stack Overflow Reputation',
    description: 'Stack Overflow reputation points, log-scaled. Zero if no SO profile is linked.',
  },
  {
    key: 'soEngagement',
    label: 'Stack Overflow Engagement',
    description: 'Accepted-answer rate weighted by answer volume. Zero if no SO profile is linked.',
  },
  {
    key: 'community',
    label: 'Community',
    description: 'Combined GitHub followers and Stack Overflow badges, log-scaled.',
  },
];

// Neutral, non-evaluative copy for surfacing the score in the UI. Avoid
// language that implies the score measures overall developer ability.
export const SCORE_METHODOLOGY = {
  short:
    'Relative ranking signal (0-100) combining GitHub and Stack Overflow activity, ' +
    'calibrated against developers currently indexed by DevGlobe — not an absolute ' +
    'measure of skill.',
  noSO:
    'This profile has no linked Stack Overflow activity, so that 25% weight was ' +
    'redistributed across GitHub-based dimensions.',
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

  // If developer has no SO data, redistribute SO weight to GitHub dimensions
  const hasSO = Boolean(dev.soUserId) || (dev.soReputation || 0) > 0 || (dev.soAnswers || 0) > 0;
  let weights = WEIGHTS;
  if (!hasSO) {
    const soWeight = WEIGHTS.soReputation + WEIGHTS.soEngagement;
    const ghTotal = WEIGHTS.stars + WEIGHTS.commits + WEIGHTS.repoReach + WEIGHTS.community;
    weights = {
      stars: WEIGHTS.stars + (WEIGHTS.stars / ghTotal) * soWeight,
      commits: WEIGHTS.commits + (WEIGHTS.commits / ghTotal) * soWeight,
      repoReach: WEIGHTS.repoReach + (WEIGHTS.repoReach / ghTotal) * soWeight,
      soReputation: 0,
      soEngagement: 0,
      community: WEIGHTS.community + (WEIGHTS.community / ghTotal) * soWeight,
    };
  }

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += dimensions[key] * weight;
  }

  return { total: Math.round(score * 100), dimensions, weights, hasSO };
}

/**
 * Builds a structured, UI-ready breakdown of how a score was produced:
 * each dimension's weight, normalized value (0-1), and point contribution
 * to the final 0-100 score. Intended for the profile detail panel and any
 * "why this score" explanation surface.
 *
 * Works the same whether the profile has complete, missing, or partial
 * source data — dimensions with no underlying data simply normalize to 0
 * and contribute 0 points (see `hasSO` for whether weight was redistributed).
 */
export function explainScore(dev, maxValues) {
  const { total, dimensions, weights, hasSO } = computeScore(dev, maxValues);

  const breakdown = DIMENSIONS.map(({ key, label, description }) => {
    const normalized = dimensions[key] || 0;
    const weight = weights[key] || 0;
    return {
      key,
      label,
      description,
      weight,
      weightPercent: Math.round(weight * 100),
      normalized,
      contributionPoints: Math.round(normalized * weight * 100),
    };
  });

  return {
    total,
    hasSO,
    redistributed: !hasSO,
    breakdown,
    methodology: hasSO ? SCORE_METHODOLOGY.short : `${SCORE_METHODOLOGY.short} ${SCORE_METHODOLOGY.noSO}`,
  };
}

/**
 * Returns what percentage of scores in `allScores` are strictly below
 * `score` — used to describe calibration ("higher than N% of indexed
 * developers") without implying the score itself is an absolute measure.
 * Returns null for an empty dataset, so callers can omit the line entirely
 * rather than showing a misleading 0%/100%.
 */
export function getScorePercentile(score, allScores) {
  if (!allScores || allScores.length === 0) return null;
  const below = allScores.filter(s => s < score).length;
  return Math.round((below / allScores.length) * 100);
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

  const scored = developers.map(dev => {
    const { total, dimensions, hasSO, weights } = computeScore(dev, maxValues);
    return { ...dev, score: total, scoreDimensions: dimensions, scoreWeights: weights, scoreHasSO: hasSO };
  });

  const allScores = scored.map(d => d.score);

  return scored
    .map(dev => ({ ...dev, scorePercentile: getScorePercentile(dev.score, allScores) }))
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