import { randomUUID } from 'crypto';

const FALLBACK_ACTIVITIES = [
  { login: 'codeatlas', type: 'generated_card', description: 'had their developer card generated' },
  { login: 'pixelbranch', type: 'logged_in', description: 'signed in to explore the developer globe' },
  { login: 'cloudsyntax', type: 'generated_card', description: 'had their developer card generated' },
  { login: 'commitcraft', type: 'logged_in', description: 'signed in to explore the developer globe' },
];

export function createPlatformActivity({ type, login, avatarUrl, targetLogin, now = new Date() }) {
  const isCard = type === 'generated_card';
  return {
    id: `platform:${randomUUID()}`,
    login,
    avatarUrl: avatarUrl || null,
    type,
    description: isCard && targetLogin && targetLogin !== login
      ? `generated @${targetLogin}'s developer card`
      : isCard
        ? 'had their developer card generated'
        : 'signed in to DevGlobe',
    repo: null,
    url: isCard ? `/developer/${encodeURIComponent(targetLogin || login)}` : `/developer/${encodeURIComponent(login)}`,
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