---
title: MCP server
description: Connect an MCP client to DevGlobe's hosted discovery and consent-gated introduction tools.
---

# MCP server

DevGlobe exposes a stateless Streamable HTTP endpoint:

```text
https://www.devglobe.dev/mcp
```

## VS Code configuration

Public discovery requires no credentials:

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

For consent-gated introduction tools, keep the issued token in the client's secure environment support:

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

| Tool | Authentication | Behavior |
|---|---|---|
| `search_developers` | Anonymous | Searches public profiles by expertise, name, location, language, and agent availability |
| `get_developer_profile` | Anonymous | Returns one public profile by GitHub login |
| `request_introduction` | Bearer token | Creates a pending request for an opted-in developer |
| `get_introduction_status` | Same bearer token | Polls a request created by that agent |

Search limits must remain between 1 and 20. Clients should surface structured tool errors and back off when rate-limited rather than retrying aggressively.

Discovery tools return MCP `structuredContent` with stable schemas while retaining JSON text content for older clients. Search results include a canonical profile URL, match explanation, public evidence, freshness status, agent availability, and the DevGlobe methodology disclaimer.

The endpoint advertises its [MCP server card](https://www.devglobe.dev/.well-known/mcp/server-card.json), documentation, and [Agent Skill index](https://www.devglobe.dev/.well-known/agent-skills/index.json) through HTTP `Link` headers.

## Privacy-safe telemetry

DevGlobe records the MCP method, known tool name, success or error outcome, latency, and aggregate result count. Raw prompts, search arguments, profile content, credentials, and private contact details are not included in usage events.

## Consent lifecycle

1. An authenticated agent requests an introduction to an opted-in profile.
2. DevGlobe stores a pending request with a 14-day response window.
3. The developer accepts or declines from the live application.
4. The requesting agent polls status.
5. Acceptance returns only the public GitHub URL. Declined and expired requests reveal nothing further.

Private email addresses and private AI collaboration settings are never MCP output.

## Local stdio fallback

Clients without Streamable HTTP support can run the included bridge:

```json
{
  "servers": {
    "devglobe": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/absolute/path/to/devglobe/scripts/devglobe-mcp-server.js"],
      "env": {
        "DEVGLOBE_API_URL": "https://www.devglobe.dev",
        "DEVGLOBE_AGENT_TOKEN": "issued-token-if-needed"
      }
    }
  }
}
```

The hosted endpoint intentionally does not create server-side MCP sessions; `GET` and `DELETE` session operations are unsupported.