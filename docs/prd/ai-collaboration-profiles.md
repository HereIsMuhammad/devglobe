# PRD: AI Collaboration Profiles

**Status:** MCP connection phase implemented
**Issue:** [#135](https://github.com/sajeetharan/devglobe/issues/135)  
**Owner:** DevGlobe  
**Last updated:** 2026-08-13

## Summary

DevGlobe will let developers declare which AI coding tools they use and whether they are open to requests initiated by verified AI agents. This information is owned by the developer, optional, and separate from DevGlobe's generated developer-card archetypes.

The MVP adds a settings editor for claimed profiles and a public profile section. A later phase will expose discovery through MCP and route introduction requests through a consent gate.

## Problem

GitHub activity does not reliably reveal which private AI tools a developer uses. Inferring tool usage would create inaccurate profiles and undermine the consent-aware discovery model. DevGlobe also has no explicit signal indicating whether a developer wants to be contacted by an AI agent.

## Goals

- Let claimed developers publish self-declared AI tool usage.
- Let developers opt in to agent collaboration requests.
- Make the source and visibility of this data unambiguous.
- Establish a data contract that can support future MCP discovery.
- Keep contact details private until a developer accepts an introduction.

## Non-goals

- Inferring private tool usage from commits, telemetry, or repository content.
- Allowing agents to contact developers directly in the MVP.
- Building agent identity verification or an MCP server in the MVP.
- Changing DevGlobe scoring based on AI tool usage.

## Users

- **Developer:** Claims a profile and controls AI collaboration preferences.
- **Visitor:** Sees public, self-declared AI tool usage and availability.
- **Verified agent (future):** Searches opted-in profiles and requests an introduction.

## MVP Requirements

### Profile management

- A signed-in user with a claimed profile can open AI collaboration settings.
- The developer can select supported tools and a usage level for each.
- The developer can opt in or out of agent collaboration requests.
- The developer can choose a contact policy: verified agents or nobody.
- The developer can make the whole AI profile public or private.
- Agent collaboration is disabled by default.

### Public profile

- Public AI profiles display selected tools and usage levels.
- Tool data is labeled "Self-declared."
- Collaboration availability is displayed only when enabled.
- Private AI profiles are omitted from public API responses.

### Validation and authorization

- Only the GitHub account that claimed a profile can update it.
- Tools, usage levels, visibility, and contact policies use server-side allow lists.
- Duplicate tools are removed and malformed requests are rejected.
- The public API returns a safe projection and never ownership metadata.

## Initial Tool Catalog

- GitHub Copilot
- Claude Code
- Cursor
- OpenAI Codex
- Gemini CLI
- Windsurf
- Custom agent

Usage levels are `experimenting`, `regular`, and `daily`.

## Data Model

```json
{
  "aiProfile": {
    "tools": [
      {
        "id": "github-copilot",
        "usage": "daily",
        "source": "self-declared"
      }
    ],
    "acceptsAgentRequests": true,
    "visibility": "public",
    "contactPolicy": "verified-agents",
    "updatedAt": "2026-08-13T12:00:00.000Z"
  }
}
```

## UX Flow

1. The developer signs in with GitHub and claims their profile.
2. The user menu exposes "AI collaboration settings."
3. The developer selects tools, usage levels, visibility, and availability.
4. Saving updates the claimed Cosmos DB developer document.
5. Public settings appear in the developer detail panel.

## MCP Connection Flow

The authenticated MCP server exposes:

- `search_developers(skills, location, language, availability)`
- `get_developer_profile(login)`
- `request_introduction(login, reason, project)`
- `get_introduction_status(id, developerLogin)`

Introduction requests are stored separately, rate-limited, audited, and shown to the developer for explicit acceptance. Accepted requests return only the developer's public GitHub URL. No email address or private contact method is stored or returned to an agent.

## Success Metrics

- Percentage of claimed profiles that configure an AI profile.
- Percentage of configured profiles that opt in to agent requests.
- Save completion and validation error rates.
- Future: introduction acceptance, rejection, expiry, and abuse-report rates.

## Acceptance Criteria

- Claimed developers can save valid AI collaboration settings.
- Unauthenticated users and non-owners cannot update a profile.
- Invalid enum values and unsupported tools return HTTP 400.
- Public developer responses include only public AI profiles.
- The detail panel renders self-declared tools and opt-in status.
- The application test suite and production build pass.
- MCP discovery tools return only public developer data.
- Only issued agent credentials can create or inspect introduction requests.
- Developers can accept or decline requests addressed to their GitHub identity.
- Accepted requests reveal only the developer's public GitHub URL.

## Rollout

1. Ship the profile schema, authenticated editor, and public display.
2. Measure adoption and refine the tool catalog.
3. Add issued agent identities and introduction request storage.
4. Publish read-only discovery and consent-gated introductions through MCP.
