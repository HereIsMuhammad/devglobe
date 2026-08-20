# DevGlobe MCP Server

DevGlobe provides a hosted Model Context Protocol server for developer discovery and consent-gated introductions. It uses stateless Streamable HTTP so agents can connect without cloning or running DevGlobe locally.

## Remote Endpoint

```text
https://www.devglobe.dev/mcp
```

Client-specific copyable configurations are available at:

```text
https://www.devglobe.dev/agents
```

For an anonymous discovery-only connection, use this VS Code `mcp.json` entry:

```json
{
  "servers": {
    "devglobe": {
      "type": "http",
      "url": "https://www.devglobe.dev/mcp"
    }
  }
}
```

Public search and profile lookup do not require credentials. To use introduction tools, add an issued token using your MCP client's secure secret or environment-variable support:

```json
{
  "servers": {
    "devglobe": {
      "type": "http",
      "url": "https://www.devglobe.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${env:DEVGLOBE_AGENT_TOKEN}"
      }
    }
  }
}
```

## Tools

- `search_developers` searches public profiles and can require agent availability or an active self-declared opportunity type.
- `get_developer_profile` returns one public profile.
- `request_introduction` creates a pending request for an opted-in developer.
- `get_introduction_status` lets the requesting agent poll its request. After acceptance it returns only the developer's public GitHub URL.

Private AI profile settings and private contact details are never returned.

Opportunity-aware searches may pass `opportunityType` as `employment`, `contract`, `open-source`, `speaking`, or `mentoring`. Matching profiles return only active public preferences, their expiry, and an explicit match reason. Expired preferences are omitted before MCP filtering.

Public discovery tools provide schema-validated `structuredContent` with canonical profile URLs, match explanations, public evidence, freshness, agent availability, and the methodology disclaimer. JSON text content remains available for older clients.

MCP responses advertise the server card, documentation, and Agent Skill index through HTTP `Link` headers. Privacy-safe usage events include only the MCP method, known tool name, outcome, latency, and aggregate result count; prompts and tool arguments are not recorded.

Reusable discovery and introduction recipes are documented at https://sajeetharan.github.io/devglobe/agents/workflows.

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

## Local Stdio Setup

For clients without remote MCP support, install dependencies in this repository and configure the included stdio bridge:

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

## Hosted Endpoint Configuration

The hosted application accepts stateless MCP requests at `/mcp`. Browser-based MCP clients must send an allowed `Origin`. The canonical site is allowed by default; additional trusted origins can be configured as a comma-separated list:

```env
DEVGLOBE_MCP_ALLOWED_ORIGINS=https://trusted-agent-console.example
```

The endpoint does not create server-side MCP sessions. `GET` and `DELETE` session operations are intentionally unsupported, while tool calls use `POST` requests.

## Consent Lifecycle

1. An authenticated agent requests an introduction to a public, opted-in profile.
2. DevGlobe rate-limits the agent and stores a pending request with a 14-day response window.
3. The developer reviews the request from **Agent requests** in their user menu.
4. The developer accepts or declines. Decisions cannot be changed.
5. The agent polls `get_introduction_status`.
6. Acceptance returns the developer's already-public GitHub URL. Declined and expired requests disclose nothing further.
