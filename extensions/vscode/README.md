# DevGlobe Developer Discovery for VS Code

Find public developer profiles, share your DevGlobe identity card, and connect AI agents without leaving VS Code.

## Commands

- `DevGlobe: Find a Developer`
- `DevGlobe: Open My Profile`
- `DevGlobe: Copy My Identity Card Link`
- `DevGlobe: Copy MCP Configuration`
- `DevGlobe: Open Agent Setup`

Set `devglobe.githubLogin` in VS Code settings to enable personal profile and card commands. `devglobe.baseUrl` defaults to `https://www.devglobe.dev`.

## Privacy

The extension makes a public API request only when you run a search command. It does not read source code, files, repositories, branches, keystrokes, or editor activity. It emits no custom telemetry and stores no credentials.

## Development

1. Open `extensions/vscode` in VS Code.
2. Run `npm install`.
3. Press `F5` and select **Run Extension**.
4. Run a DevGlobe command in the Extension Development Host.

Run `npm test` for helper tests and `npm run check` for JavaScript syntax checks.

## Packaging

After configuring the marketplace publisher, package from this directory with:

```sh
npx @vscode/vsce package
```

Marketplace publishing is intentionally separate from the repository implementation and requires publisher credentials.