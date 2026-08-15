export const BADGE_STATS = ['globalRank', 'countryRank', 'cityRank', 'score', 'stars'];
export const DEFAULT_BADGE_STAT = 'globalRank';

const BRAND = {
  bg: '#0b1017',
  labelBg: '#000000',
  valueBg: '#1d4ed8',
  divider: '#1e293b',
  border: '#cbd5e1',
  labelText: '#ffffff',
  valueText: '#ffffff',
  muted: '#94a3b8',
  unrankedText: '#64748b',
};

function formatCompactNumber(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Resolve which stat to show and its display value for a developer.
 * Returns { value: string, unranked: boolean } — unranked is true when the
 * developer exists but doesn't have that particular stat (e.g. no country
 * detected), so the badge can degrade gracefully instead of breaking.
 */
export function resolveBadgeStat(developer, statParam) {
  const stat = BADGE_STATS.includes(statParam) ? statParam : DEFAULT_BADGE_STAT;

  if (!developer) return { stat, value: 'unranked', unranked: true };

  switch (stat) {
    case 'cityRank': {
      if (!developer.cityRank || !developer.cityTotal) return { stat, value: 'unranked', unranked: true };
      return { stat, value: `${developer.city || 'City'} #${developer.cityRank}`, unranked: false };
    }
    case 'countryRank': {
      if (!developer.countryRank || !developer.countryTotal) return { stat, value: 'unranked', unranked: true };
      return { stat, value: `${developer.country || 'Country'} #${developer.countryRank}`, unranked: false };
    }
    case 'score': {
      if (!Number.isFinite(developer.score)) return { stat, value: 'unranked', unranked: true };
      return { stat, value: `${Math.round(developer.score)}/100`, unranked: false };
    }
    case 'stars': {
      if (!Number.isFinite(developer.totalStars)) return { stat, value: 'unranked', unranked: true };
      return { stat, value: `${formatCompactNumber(developer.totalStars)} stars`, unranked: false };
    }
    case 'globalRank':
    default: {
      if (!developer.globalRank || !developer.globalTotal) return { stat, value: 'unranked', unranked: true };
      return { stat, value: `Global #${developer.globalRank}`, unranked: false };
    }
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Rough monospace-ish width estimate so the badge is only as wide as it
// needs to be, matching the shields.io convention of tight auto-sizing.
function estimateTextWidth(text, fontSize) {
  return Math.round(text.length * fontSize * 0.62);
}

/**
 * Render a flat, two-segment badge: "devglobe" label + a stat value,
 * following the shields.io/committers.top visual convention.
 */
export function renderBadgeSvg({ value, unranked = false, height = 20 }) {
  const fontSize = 11;
  const paddingX = 10;
  const labelText = 'Devglobe rank';
  const valueText = value;

  const labelWidth = estimateTextWidth(labelText, fontSize) + paddingX * 2;
  const valueWidth = estimateTextWidth(valueText, fontSize) + paddingX * 2;
  const totalWidth = labelWidth + valueWidth;
  const valueTextColor = unranked ? BRAND.unrankedText : BRAND.valueText;
  const radius = 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${escapeXml(`${labelText}: ${valueText}`)}">
  <title>${escapeXml(`${labelText}: ${valueText}`)}</title>
  <clipPath id="round">
    <rect width="${totalWidth - 1}" height="${height - 1}" x="0.5" y="0.5" rx="${radius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="${height}" fill="${BRAND.labelBg}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${BRAND.valueBg}"/>
    <rect x="${labelWidth}" y="0" width="1" height="${height}" fill="${BRAND.divider}"/>
  </g>
  <rect width="${totalWidth - 1}" height="${height - 1}" x="0.5" y="0.5" rx="${radius}" fill="none" stroke="${BRAND.border}"/>
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${fontSize}">
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" fill="${BRAND.labelText}">${escapeXml(labelText)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" fill="${valueTextColor}">${escapeXml(valueText)}</text>
  </g>
</svg>`;
}
