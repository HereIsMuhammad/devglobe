import { addDeveloperRanks } from './ranking.js';
import { withOssWorth } from './oss-worth.js';
import { withNumericScore } from './developer-score.js';

export function prepareDeveloperDataset(developers = []) {
  const ranked = [...developers]
    .map(withNumericScore)
    .sort((left, right) =>
      right.score - left.score || String(left.login || '').localeCompare(String(right.login || ''))
    );

  return addDeveloperRanks(ranked).map(withOssWorth);
}