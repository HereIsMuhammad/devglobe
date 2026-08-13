#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDevGlobeMcpServer } from '../lib/devglobe-mcp-server.js';

const server = createDevGlobeMcpServer();
await server.connect(new StdioServerTransport());
console.error('DevGlobe MCP server running on stdio');
