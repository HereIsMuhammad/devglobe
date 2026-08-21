export function withNumericScore(developer) {
  return {
    ...developer,
    score: Number.isFinite(developer.score) ? developer.score : 0,
  };
}