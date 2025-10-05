import * as path from 'path';
import { workspace, ExtensionContext, commands, window, Uri, ProgressLocation, WebviewPanel, ViewColumn, StatusBarItem, StatusBarAlignment, RelativePattern } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let statusBarItem: StatusBarItem;

interface ScoreHistoryEntry {
  date: string;
  score: number;
  totalFiles: number;
  readyFiles: number;
}

// Define the custom request type for file analysis
const AnalyzeFileRequest = new RequestType<{ content: string, languageId: string }, number, void>('baselineRecon/analyzeFile');

function getHistoryFilePath(): Uri | undefined {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    window.showErrorMessage('Cannot save score history: No workspace folder is open.');
    return undefined;
  }
  // Use the first workspace folder as the base
  const workspaceRoot = workspaceFolders[0].uri;
  return Uri.joinPath(workspaceRoot, '.vscode', 'baselineReconHistory.json');
}

async function readScoreHistory(historyFile: Uri): Promise<ScoreHistoryEntry[]> {
  try {
    const fileContents = await workspace.fs.readFile(historyFile);
    return JSON.parse(fileContents.toString());
  } catch (error) {
    // If the file doesn't exist or is invalid JSON, return an empty array.
    // This is expected on the first run.
    return [];
  }
}

async function writeScoreHistory(historyFile: Uri, history: ScoreHistoryEntry[]): Promise<void> {
  try {
    const content = JSON.stringify(history, null, 2);
    await workspace.fs.writeFile(historyFile, Buffer.from(content, 'utf-8'));
  } catch (error) {
    window.showErrorMessage(`Failed to write score history: ${error}`);
  }
}

async function updateStatusBar(): Promise<void> {
  const historyFile = getHistoryFilePath();
  if (!historyFile) {
    statusBarItem.hide();
    return;
  }

  try {
    const history = await readScoreHistory(historyFile);
    if (history.length > 0) {
      const latestEntry = history[history.length - 1];
      statusBarItem.text = `$(check-all) Baseline: ${latestEntry.score.toFixed(1)}%`;
      statusBarItem.tooltip = `Baseline Ready Score: ${latestEntry.score.toFixed(2)}% (${latestEntry.readyFiles}/${latestEntry.totalFiles} files)\nLast checked: ${new Date(latestEntry.date).toLocaleString()}`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  } catch (error) {
    statusBarItem.hide();
  }
}

function getLanguageIdFromUri(uri: Uri): string {
  const ext = path.extname(uri.fsPath).substring(1).toLowerCase();
  const languageIdMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascriptreact',
    'tsx': 'typescriptreact',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html'
  };

  return languageIdMap[ext] || 'plaintext';
}

function getWebviewContent(historyData: ScoreHistoryEntry[]): string {
  const labels = historyData.map(entry => new Date(entry.date).toLocaleString());
  const scores = historyData.map(entry => entry.score);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Baseline Recon Score History</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          padding: 20px;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
        }
        h1 {
          font-weight: lighter;
        }
      </style>
  </head>
  <body>
      <h1>Baseline Recon Score History</h1>
      <canvas id="scoreChart"></canvas>
      <script>
        const ctx = document.getElementById('scoreChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: 'Baseline Ready Score (%)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              data: ${JSON.stringify(scores)},
              fill: true,
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  color: 'var(--vscode-editor-foreground)'
                },
                grid: {
                  color: 'var(--vscode-editorWidget-border)'
                }
              },
              x: {
                ticks: {
                  color: 'var(--vscode-editor-foreground)'
                },
                grid: {
                  color: 'var(--vscode-editorWidget-border)'
                }
              }
            },
            plugins: {
                legend: {
                    labels: { color: 'var(--vscode-editor-foreground)' }
                }
            }
          }
        });
      </script>
  </body>
  </html>`;
}

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  // We need to tell the client what file types we care about.
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'css' },
      { scheme: 'file', language: 'scss' },
      { scheme: 'file', language: 'less' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'html' }
    ]
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'baselineReconLinter',
    'Baseline Recon Linter',
    serverOptions,
    clientOptions
  );

  // The ready promise is used to delay command execution until the client is ready.
  const ready = client.start();

  // Create and configure the status bar item
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'baselineRecon.showHistoryChart';
  context.subscriptions.push(statusBarItem);

  // Update status bar on activation
  updateStatusBar();

  // Watch for changes in the configuration file
  const historyFile = getHistoryFilePath();
  if (historyFile) {
    const configWatcher = workspace.createFileSystemWatcher(new RelativePattern(workspace.getWorkspaceFolder(historyFile)!, 'baseline-recon.config.js'));
    configWatcher.onDidChange(() => client.sendNotification('baselineRecon/configChanged'));
    configWatcher.onDidCreate(() => client.sendNotification('baselineRecon/configChanged'));
    configWatcher.onDidDelete(() => client.sendNotification('baselineRecon/configChanged'));
    context.subscriptions.push(configWatcher);
  }

  // Register command to calculate project score
  commands.registerCommand('baselineRecon.calculateScore', async () => {
    // Wait until the client is ready before sending requests.
    await ready;
    // Find all relevant files in the workspace
    const includePattern = '**/*.{css,js,ts,scss,less,html}'; // Adjust as needed
    const excludePattern = '**/node_modules/**';

    const files = await workspace.findFiles(includePattern, excludePattern);

    if (files.length === 0) {
      window.showInformationMessage('No relevant files found in the workspace.');
      return;
    }

    await window.withProgress({
      location: ProgressLocation.Notification,
      title: "Baseline Recon: Analyzing project...",
      cancellable: false
    }, async (progress) => {
      // Process files in parallel for better performance
      const analysisPromises = files.map(async (file, index) => {
        // Read file content and send it to the server for analysis
        const content = await workspace.fs.readFile(file);
        const text = Buffer.from(content).toString('utf-8');

        const languageId = getLanguageIdFromUri(file);
        const penalty = await client.sendRequest(AnalyzeFileRequest, {
          content: text,
          languageId: languageId
        });

        // Report progress for each file processed
        progress.report({ increment: (1 / files.length) * 100, message: `Scanning ${path.basename(file.fsPath)}` });
        return penalty;
      });

      const penalties = await Promise.all(analysisPromises);

      // Calculate weighted score
      const maxPossibleScore = files.length * 3; // Max weight is 3
      const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty, 0);
      const totalScore = maxPossibleScore > 0 ? maxPossibleScore - totalPenalty : 0;

      const percentage = maxPossibleScore > 0 ? (Math.max(0, totalScore) / maxPossibleScore) * 100 : 100;
      const readyFilesCount = penalties.filter(p => p === 0).length;

      if (files.length > 0) {
        window.showInformationMessage(`Baseline Ready Score: ${percentage.toFixed(2)}% (${readyFilesCount}/${files.length} files ready)`);

        // Save the result to the history file
        const historyFile = getHistoryFilePath();
        if (historyFile) {
            const history = await readScoreHistory(historyFile);
            history.push({
                date: new Date().toISOString(),
                score: percentage,
                totalFiles: files.length,
                readyFiles: readyFilesCount
            });
            await writeScoreHistory(historyFile, history);
            await updateStatusBar(); // Update status bar after saving new score
        }
      } else {
        window.showInformationMessage('No relevant files found to score.');
      }
    });
  });

  // Register command to show score history
  commands.registerCommand('baselineRecon.showHistory', async () => {
    const historyFile = getHistoryFilePath();
    if (!historyFile) {
      // Error is already shown by getHistoryFilePath
      return;
    }

    const history = await readScoreHistory(historyFile);
    if (history.length === 0) {
      window.showInformationMessage('No score history found.');
      return;
    }

    const outputChannel = window.createOutputChannel('Baseline Recon History');
    outputChannel.clear();
    outputChannel.appendLine('--- Baseline Recon Score History ---');
    outputChannel.appendLine('');

    history.forEach(entry => {
      const date = new Date(entry.date).toLocaleString();
      outputChannel.appendLine(`${date}: ${entry.score.toFixed(2)}% (${entry.readyFiles}/${entry.totalFiles} files)`);
    });

    outputChannel.show();
  });

  // Register command to show score history chart
  let chartPanel: WebviewPanel | undefined = undefined;
  commands.registerCommand('baselineRecon.showHistoryChart', async () => {
    const historyFile = getHistoryFilePath();
    if (!historyFile) return;

    const history = await readScoreHistory(historyFile);
    if (history.length === 0) {
      window.showInformationMessage('No score history found to chart.');
      return;
    }

    const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : undefined;

    if (chartPanel) {
      chartPanel.reveal(column);
    } else {
      chartPanel = window.createWebviewPanel(
        'baselineReconChart',
        'Baseline Recon History',
        column || ViewColumn.One,
        { enableScripts: true }
      );

      chartPanel.onDidDispose(() => { chartPanel = undefined; }, null, context.subscriptions);
    }

    chartPanel.webview.html = getWebviewContent(history);
  });

  context.subscriptions.push(workspace.onDidSaveTextDocument(async (document) => {
    if (document.uri.fsPath.endsWith('baselineReconHistory.json')) { await updateStatusBar(); }
  }));
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}