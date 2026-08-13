function normalizeBaseUrl(value) {
  const url = new URL(value || 'https://www.devglobe.dev');
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('DEVGLOBE_API_URL must use HTTPS');
  }
  return url.origin;
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `DevGlobe API returned ${response.status}`);
  return data;
}

export function createDevGlobeMcpClient({
  baseUrl = process.env.DEVGLOBE_API_URL,
  agentToken = process.env.DEVGLOBE_AGENT_TOKEN,
  fetchImpl = fetch,
} = {}) {
  const origin = normalizeBaseUrl(baseUrl);

  return {
    async searchDevelopers({ query, location, language, availableForAgents = false, limit = 10 }) {
      const searchText = [query, location, language].filter(Boolean).join(' ');
      const searchUrl = new URL('/api/search', origin);
      searchUrl.searchParams.set('q', searchText);
      searchUrl.searchParams.set('mode', 'text');
      searchUrl.searchParams.set('top', String(Math.min(limit, 20)));
      const search = await readJson(await fetchImpl(searchUrl));

      const developers = await Promise.all(search.results.map(async result => {
        const profileUrl = new URL('/api/developer', origin);
        profileUrl.searchParams.set('id', result.login || result.id);
        return readJson(await fetchImpl(profileUrl));
      }));

      return developers.filter(developer => {
        const matchesLocation = !location || developer.location?.toLowerCase().includes(location.toLowerCase());
        const matchesLanguage = !language || developer.topLanguage?.toLowerCase() === language.toLowerCase();
        const matchesAvailability = !availableForAgents || developer.aiProfile?.acceptsAgentRequests === true;
        return matchesLocation && matchesLanguage && matchesAvailability;
      }).slice(0, limit);
    },

    async getDeveloperProfile(login) {
      const url = new URL('/api/developer', origin);
      url.searchParams.set('id', login);
      return readJson(await fetchImpl(url));
    },

    async requestIntroduction(input) {
      if (!agentToken) throw new Error('DEVGLOBE_AGENT_TOKEN is required for introduction requests');
      const url = new URL('/api/agent/introductions', origin);
      return readJson(await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }));
    },

    async getIntroductionStatus({ id, developerLogin }) {
      if (!agentToken) throw new Error('DEVGLOBE_AGENT_TOKEN is required for introduction requests');
      const url = new URL('/api/agent/introductions', origin);
      url.searchParams.set('id', id);
      url.searchParams.set('developerLogin', developerLogin);
      return readJson(await fetchImpl(url, {
        headers: { Authorization: `Bearer ${agentToken}` },
      }));
    },
  };
}
