import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createDevGlobeMcpClient, MCP_METHODOLOGY_DISCLAIMER } from './devglobe-mcp-client.js';
import { OPPORTUNITY_TYPES } from './ai-profile.js';

const evidenceSchema = z.object({ label: z.string(), value: z.number() });
const opportunityPreferencesSchema = z.object({
  enabled: z.literal(true),
  types: z.array(z.enum(OPPORTUNITY_TYPES)),
  roles: z.array(z.string()),
  locations: z.array(z.string()),
  workModes: z.array(z.enum(['remote', 'hybrid', 'onsite'])),
  expiresAt: z.string().datetime(),
  source: z.literal('self-declared'),
});
const developerSchema = z.object({
  login: z.string(),
  name: z.string(),
  profileUrl: z.string().url(),
  location: z.string().optional(),
  topLanguage: z.string().optional(),
  score: z.number().optional(),
  globalRank: z.number().int().optional(),
  whyMatched: z.array(z.string()),
  publicEvidence: z.array(evidenceSchema),
  dataFreshness: z.object({ updatedAt: z.string().nullable(), status: z.enum(['reported', 'unknown']) }),
  availableForAgents: z.boolean(),
  opportunityPreferences: opportunityPreferencesSchema.optional(),
  methodologyDisclaimer: z.string(),
});

function toolResult(value, structuredContent) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent,
  };
}

function toolError(error) {
  const message = error instanceof Error ? error.message : 'Unexpected DevGlobe error';
  const normalized = message.toLowerCase();
  const code = normalized.includes('token') || normalized.includes('credential')
    ? 'authentication_required'
    : normalized.includes('rate limit')
      ? 'rate_limited'
      : normalized.includes('not found')
        ? 'not_found'
        : 'upstream_error';
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({
      error: { code, message, retryable: code === 'rate_limited' || code === 'upstream_error' },
    }) }],
  };
}

export function createDevGlobeMcpServer({ client = createDevGlobeMcpClient() } = {}) {
  const server = new McpServer({ name: 'devglobe', version: '1.0.0' });

  server.registerTool('search_developers', {
    description: 'Search public DevGlobe developer profiles by expertise, location, language, agent availability, and active self-declared opportunity intent.',
    inputSchema: {
      query: z.string().min(1).max(200).describe('Skills, expertise, name, or other search intent'),
      location: z.string().max(100).optional(),
      language: z.string().max(50).optional(),
      opportunityType: z.enum(OPPORTUNITY_TYPES).optional(),
      availableForAgents: z.boolean().default(false),
      limit: z.number().int().min(1).max(20).default(10),
    },
    outputSchema: {
      results: z.array(developerSchema),
      resultCount: z.number().int().nonnegative(),
      methodologyDisclaimer: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async input => {
    try {
      const results = await client.searchDevelopers(input);
      return toolResult(results, {
        results,
        resultCount: results.length,
        methodologyDisclaimer: MCP_METHODOLOGY_DISCLAIMER,
      });
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool('get_developer_profile', {
    description: 'Get one public DevGlobe developer profile. Private AI collaboration settings are never returned.',
    inputSchema: {
      login: z.string().min(1).max(39).describe('GitHub login'),
    },
    outputSchema: {
      profile: developerSchema,
      methodologyDisclaimer: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async ({ login }) => {
    try {
      const profile = await client.getDeveloperProfile(login);
      return toolResult(profile, { profile, methodologyDisclaimer: MCP_METHODOLOGY_DISCLAIMER });
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool('request_introduction', {
    description: 'Request a consent-gated introduction to an opted-in developer. This creates a pending request and never returns private contact details.',
    inputSchema: {
      developerLogin: z.string().min(1).max(39),
      reason: z.string().min(20).max(1000),
      project: z.string().min(2).max(200),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  }, async input => {
    try {
      return toolResult(await client.requestIntroduction(input));
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool('get_introduction_status', {
    description: 'Check an introduction request owned by this agent. An accepted request returns only the developer public GitHub contact route.',
    inputSchema: {
      id: z.string().uuid(),
      developerLogin: z.string().min(1).max(39),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async input => {
    try {
      return toolResult(await client.getIntroductionStatus(input));
    } catch (error) {
      return toolError(error);
    }
  });

  return server;
}