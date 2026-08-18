# DevGlobe VS Code Extension

**Issue:** [#44](https://github.com/sajeetharan/devglobe/issues/44)  
**Status:** Phase 1 implementation

## Summary

Publish a lightweight VS Code extension that brings DevGlobe developer discovery and identity actions into the editor. The first release uses existing public APIs and requires no background access to source code or developer activity.

Authenticated coding-activity heartbeats remain a second phase. DevGlobe does not currently issue scoped developer tokens, and the existing server-side ingestion secret must never be distributed to editor clients.

## Problem

Developers currently need to leave their editor to discover collaborators, open their DevGlobe profile, share their identity card, or configure an AI agent. This limits repeat usage and removes DevGlobe from the place where developers make collaboration decisions.

## Goals

- Make public developer discovery available from the Command Palette.
- Give developers fast access to their profile and shareable identity card.
- Make the DevGlobe MCP endpoint easy to configure in compatible AI clients.
- Attribute extension traffic without collecting custom telemetry.
- Establish a marketplace distribution surface that can be expanded safely.

## Non-goals

- Reading source code, file contents, keystrokes, branches, or repository remotes.
- Tracking coding time or sending background heartbeats in Phase 1.
- Storing GitHub OAuth cookies or server-side ingestion secrets.
- Recreating the globe or the complete web application inside VS Code.
- Contacting developers automatically.

## User Experience

The extension contributes these commands:

| Command | Behavior |
| --- | --- |
| `DevGlobe: Find a Developer` | Prompts for a query, displays public matches, and offers profile/card actions. |
| `DevGlobe: Open My Profile` | Opens the configured GitHub login on DevGlobe. |
| `DevGlobe: Copy My Identity Card Link` | Copies the configured developer's share page. |
| `DevGlobe: Copy MCP Configuration` | Copies a VS Code-compatible Streamable HTTP server configuration. |
| `DevGlobe: Open Agent Setup` | Opens the DevGlobe agent setup hub. |

`devglobe.githubLogin` stores the user's public GitHub login in VS Code settings. `devglobe.baseUrl` defaults to `https://www.devglobe.dev` and supports local or staging environments.

## Architecture

- The extension is isolated under `extensions/vscode`.
- Search calls `GET /api/search?q=<query>&mode=text&top=10` only after a user submits a query.
- Profiles use `/developer/<login>` and identity cards use `/share/<login>`.
- Links include `utm_source=vscode_extension&utm_medium=marketplace`.
- MCP setup copies a configuration pointing to `/mcp`; it never handles agent credentials.
- URL construction and response normalization are framework-independent and unit tested.

## Privacy and Security

- No background network requests.
- No custom telemetry or third-party trackers.
- No source, workspace, repository, branch, file, or keystroke access.
- Search responses are treated as untrusted data and normalized before display.
- The configurable base URL must use HTTPS, except for localhost development.
- Future authentication must use a revocable, narrowly scoped developer token stored with VS Code `SecretStorage`.

## Acceptance Criteria

- A developer can search by login, name, language, location, or biography from VS Code.
- Selecting a result can open its profile or copy its profile/card link.
- A configured user can open their profile and copy their identity-card link.
- A user can copy a valid VS Code MCP server configuration and open setup documentation.
- Invalid base URLs, empty queries, unavailable APIs, and malformed responses produce actionable errors.
- Unit tests cover URL validation, attribution, MCP configuration, and result normalization.
- The extension package contains marketplace metadata and local development instructions.

## Measures

Use existing web analytics through attributed landing URLs:

- Visits with `utm_source=vscode_extension`.
- Profile and identity-card visits originating from the extension.
- Agent setup visits originating from the extension.
- Downstream profile claims and shares attributed to those visits.

Marketplace installs, active installs, ratings, and uninstall trends come from marketplace reporting. The extension itself emits no custom telemetry.

## Phase 2: Activity Reporting

Activity reporting from #44 may proceed only after the backend supports:

1. Browser-based authorization that issues a revocable developer token.
2. Explicit scopes such as `activity:write` and `status:write`.
3. Per-user rate limiting, token rotation, and revocation.
4. A documented heartbeat schema with data minimization controls.
5. Clear opt-in, pause, disconnect, and deletion behavior.

After those prerequisites, the extension can add connection status, coding time, status updates, and opt-in heartbeats using `SecretStorage`.

## Rollout

1. Validate the VSIX locally and with Extension Development Host.
2. Publish an unlisted marketplace preview and verify VS Code forks.
3. Measure attributed visits and claim conversion for two weeks.
4. Publish publicly, then evaluate Phase 2 against its authentication prerequisites.