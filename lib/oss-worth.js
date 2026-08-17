export const OSS_WORTH_FORMULA_VERSION = 'oss-worth-v2';
export const OSS_CREDITS_PER_DOLLAR = 10;

export const OSS_WORTH_PLATFORMS = {
  github: {
    dimensions: [
      { key: 'contributions', label: 'Contributions', field: 'totalCommits', dollarsPerUnit: 0.50 },
      { key: 'followers', label: 'Followers', field: 'followers', dollarsPerUnit: 0.10 },
      { key: 'stars', label: 'Repository stars', field: 'totalStars', dollarsPerUnit: 0.30 },
    ],
  },
  stackoverflow: {
    dimensions: [
      { key: 'answers', label: 'Answers', field: 'soAnswers', dollarsPerUnit: 0.50 },
      { key: 'reputation', label: 'Reputation', field: 'soReputation', dollarsPerUnit: 0.10 },
      { key: 'badges', label: 'Badges', field: 'soBadges', dollarsPerUnit: 0.30 },
    ],
  },
};

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
}

function calculatePlatform(dimensions, values, available = true) {
  const breakdown = dimensions.map(dimension => {
    const sourceValue = nonNegativeNumber(values[dimension.key]);
    const dollarValue = available ? sourceValue * dimension.dollarsPerUnit : 0;
    return {
      ...dimension,
      sourceValue,
      dollarValue,
      credits: Math.round(dollarValue * OSS_CREDITS_PER_DOLLAR),
    };
  });
  const dollarValue = breakdown.reduce((total, dimension) => total + dimension.dollarValue, 0);

  return {
    available,
    credits: Math.round(dollarValue * OSS_CREDITS_PER_DOLLAR),
    dollarValue,
    breakdown,
  };
}

export function calculateOssWorth(developer = {}) {
  const hasStackOverflowData = Boolean(developer.soUserId) ||
    nonNegativeNumber(developer.soReputation) > 0 ||
    nonNegativeNumber(developer.soAnswers) > 0 ||
    nonNegativeNumber(developer.soBadges) > 0;

  const github = calculatePlatform(
    OSS_WORTH_PLATFORMS.github.dimensions,
    {
      contributions: developer.totalCommits,
      followers: developer.followers,
      stars: developer.totalStars,
    }
  );
  const stackoverflow = calculatePlatform(
    OSS_WORTH_PLATFORMS.stackoverflow.dimensions,
    {
      answers: developer.soAnswers,
      reputation: developer.soReputation,
      badges: developer.soBadges,
    },
    hasStackOverflowData
  );

  return {
    formulaVersion: OSS_WORTH_FORMULA_VERSION,
    totalCredits: github.credits + stackoverflow.credits,
    totalDollarValue: github.dollarValue + stackoverflow.dollarValue,
    github,
    stackoverflow,
  };
}

export function withOssWorth(developer) {
  return { ...developer, ossWorth: calculateOssWorth(developer) };
}

export function compareOssWorth(left, right) {
  return (right.ossWorth?.totalCredits || 0) - (left.ossWorth?.totalCredits || 0) ||
    (right.score || 0) - (left.score || 0) ||
    String(left.login || '').localeCompare(String(right.login || ''));
}