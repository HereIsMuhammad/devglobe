import { randomUUID } from 'crypto';

const FALLBACK_ACTIVITIES = [
  { login: 'codeatlas', type: 'generated_card', description: 'had their developer card generated' },
  { login: 'pixelbranch', type: 'logged_in', description: 'signed in to explore the developer globe' },
  { login: 'readmeforge', type: 'generated_readme', description: 'generated their GitHub profile README' },
  { login: 'cloudsyntax', type: 'generated_card', description: 'had their developer card generated' },
  { login: 'commitcraft', type: 'logged_in', description: 'signed in to explore the developer globe' },
];

export function createPlatformActivity({ type, login, avatarUrl, targetLogin, now = new Date() }) {
  const isCard = type === 'generated_card';
  const isReadme = type === 'generated_readme';
  const target = targetLogin || login;
  const description = isCard
    ? target !== login ? `generated @${target}'s developer card` : 'had their developer card generated'
    : isReadme
      ? target !== login ? `generated @${target}'s GitHub profile README` : 'generated their GitHub profile README'
      : 'signed in to DevGlobe';
  return {
    id: `platform:${randomUUID()}`,
    login,
    avatarUrl: avatarUrl || null,
    type,
    description,
    repo: null,
    url: isCard || isReadme ? `/developer/${encodeURIComponent(target)}` : `/developer/${encodeURIComponent(login)}`,
    createdAt: now.toISOString(),
    documentType: 'platform-activity',
  };
}

export function createFallbackActivities(now = Date.now()) {
  const bucketMs = 60 * 60 * 1000;
  const bucket = Math.floor(now / bucketMs);
  const bucketStart = bucket * bucketMs;
  const offset = bucket % FALLBACK_ACTIVITIES.length;

  return FALLBACK_ACTIVITIES.map((_, index) => {
    const activity = FALLBACK_ACTIVITIES[(index + offset) % FALLBACK_ACTIVITIES.length];
    return {
      id: `fallback:${bucket}:${index}`,
      ...activity,
      avatarUrl: null,
      repo: null,
      url: `/developer/${activity.login}`,
      createdAt: new Date(bucketStart - (index + 1) * 7 * 60 * 1000).toISOString(),
      documentType: 'fallback-activity',
      fallback: true,
    };
  });
}