import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	CodeAction,
	CodeActionKind,
	TextEdit,
	RequestType,
    DiagnosticTag,
    MarkupContent,
	TextDocumentIdentifier
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { defaultLegacyFeatureChecks, loadLegacyFeatureChecks, LegacyFeatureCheck } from './config';

// Create a connection for the server, using Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceRoot: string | undefined;
let legacyFeatureChecks: LegacyFeatureCheck[] = defaultLegacyFeatureChecks;


connection.onInitialize((params: InitializeParams) => {
	workspaceRoot = params.rootUri ? TextDocumentIdentifier.is(params.rootUri) ? params.rootUri.uri : params.rootUri : undefined;
	if (workspaceRoot?.startsWith('file:///')) {
		workspaceRoot = new URL(workspaceRoot).pathname;
	}
	legacyFeatureChecks = loadLegacyFeatureChecks(workspaceRoot, connection.console.log);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code actions.
			codeActionProvider: true,
			workspace: { workspaceFolders: { supported: true } }
		}
	};
	return result;
});

// Listen for a notification from the client that the config has changed
connection.onNotification('baselineRecon/configChanged', () => {
	legacyFeatureChecks = loadLegacyFeatureChecks(workspaceRoot, connection.console.log);
	// Re-validate all open documents
	documents.all().forEach(validateTextDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

function calculateDiagnostics(textDocument: TextDocument): Diagnostic[] {
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	const fileType = textDocument.languageId;

	const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(fileType));

	for (const check of applicableChecks) {
		let match;
		// Use a global regex to find all occurrences in the file
		const regex = new RegExp(check.regex, 'g');
		while ((match = regex.exec(text)) !== null) {
            const markdownMessage: MarkupContent = {
                kind: 'markdown',
                value: [
                    `**${check.name}**`,
                    check.message,
                    check.recommendation ? `*Recommendation: ${check.recommendation}*` : ''
                ].filter(Boolean).join('\n\n---\n')
            };

			const diagnostic: Diagnostic = {
				severity: check.severity,
                range: { start: textDocument.positionAt(match.index), end: textDocument.positionAt(match.index + match[0].length) },
                message: `${check.message} (${check.name})`, // Simple message for Problems panel
				source: 'Baseline Recon',
				codeDescription: check.mdnUrl ? { href: check.mdnUrl } : undefined,
				// Add a data payload to uniquely identify this diagnostic and its fix
				data: { featureId: check.id },
				// Tagging the diagnostic as deprecated can improve editor presentation
				tags: [DiagnosticTag.Deprecated]
			};
			diagnostics.push(diagnostic);
		}
	}

	return diagnostics;
}

function validateTextDocument(textDocument: TextDocument): void {
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

	const codeActions: CodeAction[] = [];
	const diagnostics = params.context.diagnostics;

	for (const diagnostic of diagnostics) {
		// Check if the diagnostic is one of ours and has a fix
		const featureId = diagnostic.data?.featureId;
		if (featureId) {
			const check = legacyFeatureChecks.find(c => c.id === featureId);
			if (check && check.fix) {
				const fix: CodeAction = {
					title: `Replace with '${check.fix}'`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic], // Associate this fix with the diagnostic
					isPreferred: true, // This is the most reasonable fix, so mark it as preferred.
					edit: {
						changes: {
							[params.textDocument.uri]: [
								TextEdit.replace(diagnostic.range, check.fix)
							]
						}
					}
				};
				codeActions.push(fix);
			} else if (check && check.id === 'centerTag') {
				// Special handling for <center> tag to remove both opening and closing tags
				const fullMatch = textDocument.getText(diagnostic.range);
				const newText = fullMatch.replace(check.regex, '$2'); // Replace with the content inside the tags

				const fix: CodeAction = {
					title: `Remove <center> tags`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					isPreferred: true,
					edit: {
						changes: {
							[params.textDocument.uri]: [
								TextEdit.replace(diagnostic.range, newText)
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
connection.onRequest('baselineRecon/analyzeFile', async (params: { content: string, languageId: string }): Promise<number> => {
	try {
		const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(params.languageId));
		const failingChecks = applicableChecks.filter(check => check.regex.test(params.content));

		if (failingChecks.length === 0) {
			return 0; // No penalty
		}
		// Return the highest weight of the failing checks as the penalty for this file
		return Math.max(...failingChecks.map(c => c.weight));
	} catch (e) {
		connection.console.error(`Error in analyzeFile: ${e}`);
		return 0; // If there's an error, assume it's fine to not penalize the score.
	}
});




// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();