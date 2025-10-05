"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_1 = require("vscode-languageserver/node");
var vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server, using Node's IPC as a transport.
var connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
var documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// --- Define Legacy Features to Detect ---
// Unlike the scanner, a linter should flag outdated or non-standard patterns.
var legacyFeatureChecks = [
    {
        name: 'Old Flexbox Syntax (2009)',
        regex: /display:\s*-webkit-box/,
        message: 'The 2009 `-webkit-box` syntax for Flexbox is obsolete. Use the modern `display: flex` syntax.',
        severity: node_1.DiagnosticSeverity.Warning,
        fileTypes: ['css', 'scss', 'less']
    },
    {
        name: 'Deprecated WebKit Prefixed Gradients',
        regex: /-webkit-gradient\(/,
        message: 'WebKit prefixed gradients are deprecated. Use `linear-gradient()` or `radial-gradient()`.',
        severity: node_1.DiagnosticSeverity.Warning,
        fileTypes: ['css', 'scss', 'less']
    },
    {
        name: 'Deprecated navigator.getUserMedia',
        regex: /navigator\.getUserMedia\s*\(/,
        message: '`navigator.getUserMedia` is deprecated. Use the promise-based `navigator.mediaDevices.getUserMedia()` instead.',
        severity: node_1.DiagnosticSeverity.Warning,
        fileTypes: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']
    },
    // Add more checks for other outdated features here...
];
connection.onInitialize(function (params) {
    var capabilities = params.capabilities;
    var result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // We will add more capabilities like code actions and hovers in the next phase
        }
    };
    return result;
});
// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(function (change) {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function () {
        var text, diagnostics, fileType, applicableChecks, _i, applicableChecks_1, check, match, regex, diagnostic;
        return __generator(this, function (_a) {
            text = textDocument.getText();
            diagnostics = [];
            fileType = textDocument.languageId;
            applicableChecks = legacyFeatureChecks.filter(function (check) { return check.fileTypes.includes(fileType); });
            for (_i = 0, applicableChecks_1 = applicableChecks; _i < applicableChecks_1.length; _i++) {
                check = applicableChecks_1[_i];
                match = void 0;
                regex = new RegExp(check.regex, 'g');
                while ((match = regex.exec(text)) !== null) {
                    diagnostic = {
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
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics });
            return [2 /*return*/];
        });
    });
}
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
