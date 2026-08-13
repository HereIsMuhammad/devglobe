export const SPECIAL_TAGS = {
  'github-star': {
    label: 'GitHub Star',
    shortLabel: 'GH',
    className: 'github',
  },
  'microsoft-mvp': {
    label: 'Microsoft Most Valuable Professional',
    shortLabel: 'M',
    className: 'microsoft',
  },
  'google-developer-expert': {
    label: 'Google Developer Expert',
    shortLabel: 'G',
    className: 'google',
  },
  'docker-champion': {
    label: 'Docker Captain',
    shortLabel: 'D',
    className: 'docker',
  },
  'docker-captain': {
    label: 'Docker Captain',
    shortLabel: 'D',
    className: 'docker',
  },
  'cncf-ambassador': {
    label: 'CNCF Ambassador',
    shortLabel: 'C',
    className: 'cncf',
  },
  'aws-hero': {
    label: 'AWS Hero',
    shortLabel: 'AH',
    className: 'aws',
  },
  'aws-community-builder': {
    label: 'AWS Community Builder',
    shortLabel: 'ACB',
    className: 'aws-community',
  },
};

export function getSpecialTags(tagIds) {
  if (!Array.isArray(tagIds)) return [];
  return [...new Set(tagIds)]
    .map(id => SPECIAL_TAGS[id] ? { id, ...SPECIAL_TAGS[id] } : null)
    .filter(Boolean);
}