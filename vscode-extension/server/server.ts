import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// --- Define Legacy Features to Detect ---
// Unlike the scanner, a linter should flag outdated or non-standard patterns.
const legacyFeatureChecks = [
	{
		name: 'Old Flexbox Syntax (2009)',
		regex: /display:\s*-webkit-box/,
		message: 'The 2009 `-webkit-box` syntax for Flexbox is obsolete. Use the modern `display: flex` syntax.',
		severity: DiagnosticSeverity.Warning,
		fileTypes: ['css', 'scss', 'less']
	},
	{
		name: 'Deprecated WebKit Prefixed Gradients',
		regex: /-webkit-gradient\(/,
		message: 'WebKit prefixed gradients are deprecated. Use `linear-gradient()` or `radial-gradient()`.',
		severity: DiagnosticSeverity.Warning,
		fileTypes: ['css', 'scss', 'less']
	},
	{
		name: 'Deprecated navigator.getUserMedia',
		regex: /navigator\.getUserMedia\s*\(/,
		message: '`navigator.getUserMedia` is deprecated. Use the promise-based `navigator.mediaDevices.getUserMedia()` instead.',
		severity: DiagnosticSeverity.Warning,
		fileTypes: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']
	},
	// Add more checks for other outdated features here...
];


connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// We will add more capabilities like code actions and hovers in the next phase
		}
	};
	return result;
});

// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	const fileType = textDocument.languageId;

	// Filter checks that apply to the current file type
	const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(fileType));

	for (const check of applicableChecks) {
		let match;
		// Use a global regex to find all occurrences in the file
		const regex = new RegExp(check.regex, 'g');
		while ((match = regex.exec(text)) !== null) {
			const diagnostic: Diagnostic = {
				severity: check.severity,
				range: {
					start: textDocument.positionAt(match.index),
					end: textDocument.positionAt(match.index + match[0].length)
				},
				message: check.message,
				source: 'Baseline Recon'
			};
			diagnostics.push(diagnostic);
		}
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();