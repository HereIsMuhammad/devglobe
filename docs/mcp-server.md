# DevGlobe MCP Server

DevGlobe provides a stdio Model Context Protocol server for developer discovery and consent-gated introductions.

## Tools

- `search_developers` searches public profiles and can require agent availability.
- `get_developer_profile` returns one public profile.
- `request_introduction` creates a pending request for an opted-in developer.
- `get_introduction_status` lets the requesting agent poll its request. After acceptance it returns only the developer's public GitHub URL.

Private AI profile settings and private contact details are never returned.

## Application Setup

Create the introduction request container:

```bash
npm run setup-introductions-container
```

Issue a credential for an agent owner:

```bash
npm run create-agent-key -- --id=engineering-agent --name="Engineering Agent" --owner="Example Org"
```

Give the generated token to the agent owner once. Add the generated object to the server environment as a JSON array:

```env
DEVGLOBE_AGENT_KEYS=[{"id":"engineering-agent","name":"Engineering Agent","owner":"Example Org","tokenHash":"sha256-hash"}]
COSMOS_INTRODUCTIONS_CONTAINER=agent-introductions
DEVGLOBE_AGENT_RATE_LIMIT=10
```

Restart the application after changing credentials. Never store raw agent tokens in the application environment or repository.

## MCP Client Setup

Install dependencies in this repository, then configure a stdio MCP server. A VS Code `mcp.json` entry can use:

```json
{
  "servers": {
    "devglobe": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/absolute/path/to/devglobe/scripts/devglobe-mcp-server.js"],
      "env": {
        "DEVGLOBE_API_URL": "https://www.devglobe.dev",
        "DEVGLOBE_AGENT_TOKEN": "issued-token"
      }
    }
  }
}
```

The token is required only for introduction tools. Public search and profile lookup work without one.

## Consent Lifecycle

1. An authenticated agent requests an introduction to a public, opted-in profile.
2. DevGlobe rate-limits the agent and stores a pending request with a 14-day response window.
3. The developer reviews the request from **Agent requests** in their user menu.
4. The developer accepts or declines. Decisions cannot be changed.
5. The agent polls `get_introduction_status`.
6. Acceptance returns the developer's already-public GitHub URL. Declined and expired requests disclose nothing further.
