import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createDevGlobeMcpClient } from './devglobe-mcp-client.js';

function toolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unexpected DevGlobe error' }],
  };
}

export function createDevGlobeMcpServer({ client = createDevGlobeMcpClient() } = {}) {
  const server = new McpServer({ name: 'devglobe', version: '1.0.0' });

  server.registerTool('search_developers', {
    description: 'Search public DevGlobe developer profiles by expertise, location, language, and agent availability.',
    inputSchema: {
      query: z.string().min(1).max(200).describe('Skills, expertise, name, or other search intent'),
      location: z.string().max(100).optional(),
      language: z.string().max(50).optional(),
      availableForAgents: z.boolean().default(false),
      limit: z.number().int().min(1).max(20).default(10),
    },
  }, async input => {
    try {
      return toolResult(await client.searchDevelopers(input));
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool('get_developer_profile', {
    description: 'Get one public DevGlobe developer profile. Private AI collaboration settings are never returned.',
    inputSchema: {
      login: z.string().min(1).max(39).describe('GitHub login'),
    },
  }, async ({ login }) => {
    try {
      return toolResult(await client.getDeveloperProfile(login));
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
  }, async input => {
    try {
      return toolResult(await client.getIntroductionStatus(input));
    } catch (error) {
      return toolError(error);
    }
  });

  return server;
}