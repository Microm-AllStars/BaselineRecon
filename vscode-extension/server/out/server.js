"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const config_1 = require("./config");
// Create a connection for the server, using Node's IPC as a transport.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let workspaceRoot;
let legacyFeatureChecks = config_1.defaultLegacyFeatureChecks;
connection.onInitialize((params) => {
    workspaceRoot = params.rootUri ? node_1.TextDocumentIdentifier.is(params.rootUri) ? params.rootUri.uri : params.rootUri : undefined;
    if (workspaceRoot?.startsWith('file:///')) {
        workspaceRoot = new URL(workspaceRoot).pathname;
    }
    legacyFeatureChecks = (0, config_1.loadLegacyFeatureChecks)(workspaceRoot, connection.console.log);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code actions.
            codeActionProvider: true,
            workspace: { workspaceFolders: { supported: true } }
        }
    };
    return result;
});
// Listen for a notification from the client that the config has changed
connection.onNotification('baselineRecon/configChanged', () => {
    legacyFeatureChecks = (0, config_1.loadLegacyFeatureChecks)(workspaceRoot, connection.console.log);
    // Re-validate all open documents
    documents.all().forEach(validateTextDocument);
});
// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
function calculateDiagnostics(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];
    const fileType = textDocument.languageId;
    const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(fileType));
    for (const check of applicableChecks) {
        let match;
        // Use a global regex to find all occurrences in the file
        const regex = new RegExp(check.regex, 'g');
        while ((match = regex.exec(text)) !== null) {
            const markdownMessage = {
                kind: 'markdown',
                value: [
                    `**${check.name}**`,
                    check.message,
                    check.recommendation ? `*Recommendation: ${check.recommendation}*` : '',
                    check.mdnUrl ? `Learn more on MDN` : ''
                ].filter(Boolean).join('\n\n---\n')
            };
            const diagnostic = {
                severity: check.severity,
                range: { start: textDocument.positionAt(match.index), end: textDocument.positionAt(match.index + match[0].length) },
                message: markdownMessage.value, // For hover, we can pass the full markdown string
                source: 'Baseline Recon',
                // Add a data payload to uniquely identify this diagnostic and its fix
                data: { featureId: check.id },
                // Tagging the diagnostic as deprecated can improve editor presentation
                tags: [node_1.DiagnosticTag.Deprecated]
            };
            diagnostics.push(diagnostic);
        }
    }
    return diagnostics;
}
function validateTextDocument(textDocument) {
    const diagnostics = calculateDiagnostics(textDocument);
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
// This handler provides the "Quick Fix" options.
connection.onCodeAction(params => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument === undefined) {
        return undefined;
    }
    const codeActions = [];
    const diagnostics = params.context.diagnostics;
    for (const diagnostic of diagnostics) {
        // Check if the diagnostic is one of ours and has a fix
        const featureId = diagnostic.data?.featureId;
        if (featureId) {
            const check = legacyFeatureChecks.find(c => c.id === featureId);
            if (check && check.fix) {
                const fix = {
                    title: `Replace with '${check.fix}'`,
                    kind: node_1.CodeActionKind.QuickFix,
                    diagnostics: [diagnostic], // Associate this fix with the diagnostic
                    isPreferred: true, // This is the most reasonable fix, so mark it as preferred.
                    edit: {
                        changes: {
                            [params.textDocument.uri]: [
                                node_1.TextEdit.replace(diagnostic.range, check.fix)
                            ]
                        }
                    }
                };
                codeActions.push(fix);
            }
            else if (check && check.id === 'centerTag') {
                // Special handling for <center> tag to remove both opening and closing tags
                const fullMatch = textDocument.getText(diagnostic.range);
                const newText = fullMatch.replace(check.regex, '$2'); // Replace with the content inside the tags
                const fix = {
                    title: `Remove <center> tags`,
                    kind: node_1.CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    isPreferred: true,
                    edit: {
                        changes: {
                            [params.textDocument.uri]: [
                                node_1.TextEdit.replace(diagnostic.range, newText)
                            ]
                        }
                    }
                };
                codeActions.push(fix);
            }
        }
    }
    return codeActions;
});
// Custom request handler for project-wide analysis
connection.onRequest('baselineRecon/analyzeFile', async (params) => {
    try {
        const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(params.languageId));
        const failingChecks = applicableChecks.filter(check => check.regex.test(params.content));
        if (failingChecks.length === 0) {
            return 0; // No penalty
        }
        // Return the highest weight of the failing checks as the penalty for this file
        return Math.max(...failingChecks.map(c => c.weight));
    }
    catch (e) {
        connection.console.error(`Error in analyzeFile: ${e}`);
        return 0; // If there's an error, assume it's fine to not penalize the score.
    }
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map