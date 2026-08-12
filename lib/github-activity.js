export function describeGitHubEvent(event) {
  const repo = event.repo?.name || 'a repository';

  switch (event.type) {
    case 'PushEvent': {
      const count = event.payload?.commits?.length || event.payload?.size || 0;
      return `Pushed ${count || 'new'} commit${count === 1 ? '' : 's'} to ${repo}`;
    }
    case 'PullRequestEvent':
      return `${event.payload?.action || 'Updated'} pull request in ${repo}`;
    case 'IssuesEvent':
      return `${event.payload?.action || 'Updated'} an issue in ${repo}`;
    case 'IssueCommentEvent':
      return `Commented on an issue in ${repo}`;
    case 'CreateEvent':
      return `Created ${event.payload?.ref_type || 'content'} in ${repo}`;
    case 'ForkEvent':
      return `Forked ${repo}`;
    case 'WatchEvent':
      return `Starred ${repo}`;
    case 'ReleaseEvent':
      return `${event.payload?.action || 'Published'} a release in ${repo}`;
    default:
      return `Contributed to ${repo}`;
  }
}

export function normalizeGitHubEvent(event, fallbackLogin) {
  const login = event.actor?.login || fallbackLogin;
  if (!event.id || !login || !event.created_at) return null;

  const createdAt = new Date(event.created_at);
  if (Number.isNaN(createdAt.getTime())) return null;

  return {
    id: String(event.id),
    login,
    avatarUrl: event.actor?.avatar_url || null,
    type: event.type || 'UnknownEvent',
    description: describeGitHubEvent(event),
    repo: event.repo?.name || null,
    url: event.repo?.name ? `https://github.com/${event.repo.name}` : `https://github.com/${login}`,
    createdAt: createdAt.toISOString(),
  };
}