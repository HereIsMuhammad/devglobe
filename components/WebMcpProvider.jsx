'use client';

import { useEffect } from 'react';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `DevGlobe returned ${response.status}`);
  return data;
}

export default function WebMcpProvider() {
  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext?.registerTool) return undefined;

    const controller = new AbortController();
    const options = { signal: controller.signal };

    void modelContext.registerTool({
      name: 'search_developers',
      title: 'Search DevGlobe developers',
      description: 'Search public developer profiles by skills, expertise, name, language, or location.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 200 },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        },
        required: ['query'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ query, limit = 10 }) => {
        const url = new URL('/api/search', location.origin);
        url.searchParams.set('q', String(query).slice(0, 200));
        url.searchParams.set('mode', 'text');
        url.searchParams.set('top', String(Math.min(Math.max(Number(limit) || 10, 1), 20)));
        return readJson(await fetch(url));
      },
    }, options).catch(() => {});

    void modelContext.registerTool({
      name: 'get_developer_profile',
      title: 'Get a DevGlobe profile',
      description: 'Retrieve one public DevGlobe developer profile by GitHub login.',
      inputSchema: {
        type: 'object',
        properties: {
          login: { type: 'string', minLength: 1, maxLength: 39 },
        },
        required: ['login'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ login }) => {
        const url = new URL('/api/developer', location.origin);
        url.searchParams.set('id', String(login).slice(0, 39));
        return readJson(await fetch(url));
      },
    }, options).catch(() => {});

    return () => controller.abort();
  }, []);

  return null;
}