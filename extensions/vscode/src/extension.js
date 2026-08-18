const vscode = require('vscode');
const {
  agentSetupUrl,
  identityCardUrl,
  mcpConfiguration,
  normalizeLogin,
  normalizeResults,
  profileUrl,
  resolveBaseUrl,
  searchUrl,
} = require('./devglobe');

function configuration() {
  const settings = vscode.workspace.getConfiguration('devglobedev');
  return {
    baseUrl: resolveBaseUrl(settings.get('baseUrl', 'https://www.devglobe.dev')),
    githubLogin: settings.get('githubLogin', ''),
  };
}

async function openExternal(url) {
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function copyWithConfirmation(value, message) {
  await vscode.env.clipboard.writeText(value);
  await vscode.window.showInformationMessage(message);
}

async function configuredLogin() {
  const { githubLogin } = configuration();
  if (githubLogin) return normalizeLogin(githubLogin);

  const action = await vscode.window.showWarningMessage(
    'Set devglobedev.githubLogin to use this command.',
    'Open Settings',
  );
  if (action === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'devglobedev.githubLogin');
  }
  return null;
}

async function searchDevelopers() {
  const query = await vscode.window.showInputBox({
    prompt: 'Search by developer, language, location, or biography',
    placeHolder: 'TypeScript Canada',
    ignoreFocusOut: true,
  });
  if (query === undefined) return;

  const { baseUrl } = configuration();
  let response;
  try {
    response = await fetch(searchUrl(baseUrl, query), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Could not reach DevGlobe: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`DevGlobe search failed with HTTP ${response.status}.`);
  }

  const developers = normalizeResults(await response.json());
  if (developers.length === 0) {
    await vscode.window.showInformationMessage(`No DevGlobe developers found for "${query.trim()}".`);
    return;
  }

  const selected = await vscode.window.showQuickPick(
    developers.map((developer) => ({
      label: developer.name || developer.login,
      description: `@${developer.login}`,
      detail: [developer.language, developer.location, developer.score === null ? '' : `Score ${developer.score}`]
        .filter(Boolean)
        .join(' | '),
      developer,
    })),
    { placeHolder: 'Select a developer' },
  );
  if (!selected) return;

  const action = await vscode.window.showQuickPick([
    { label: '$(link-external) Open profile', value: 'open' },
    { label: '$(copy) Copy profile link', value: 'copy-profile' },
    { label: '$(credit-card) Copy identity card link', value: 'copy-card' },
  ], { placeHolder: `Choose an action for @${selected.developer.login}` });

  if (action?.value === 'open') {
    await openExternal(profileUrl(baseUrl, selected.developer.login));
  } else if (action?.value === 'copy-profile') {
    await copyWithConfirmation(profileUrl(baseUrl, selected.developer.login), 'DevGlobe profile link copied.');
  } else if (action?.value === 'copy-card') {
    await copyWithConfirmation(identityCardUrl(baseUrl, selected.developer.login), 'DevGlobe identity card link copied.');
  }
}

function registerCommand(context, name, handler) {
  context.subscriptions.push(vscode.commands.registerCommand(name, async () => {
    try {
      await handler();
    } catch (error) {
      await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'DevGlobe command failed.');
    }
  }));
}

function activate(context) {
  registerCommand(context, 'devglobedev.searchDevelopers', searchDevelopers);
  registerCommand(context, 'devglobedev.openMyProfile', async () => {
    const login = await configuredLogin();
    if (login) await openExternal(profileUrl(configuration().baseUrl, login));
  });
  registerCommand(context, 'devglobedev.copyIdentityCardUrl', async () => {
    const login = await configuredLogin();
    if (login) {
      await copyWithConfirmation(
        identityCardUrl(configuration().baseUrl, login),
        'Your DevGlobe identity card link was copied.',
      );
    }
  });
  registerCommand(context, 'devglobedev.copyMcpConfiguration', async () => {
    await copyWithConfirmation(mcpConfiguration(configuration().baseUrl), 'DevGlobe MCP configuration copied.');
  });
  registerCommand(context, 'devglobedev.openAgentSetup', async () => {
    await openExternal(agentSetupUrl(configuration().baseUrl));
  });
}

function deactivate() {}

module.exports = { activate, deactivate };