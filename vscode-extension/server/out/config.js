"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLegacyFeatureChecks = void 0;
exports.loadLegacyFeatureChecks = loadLegacyFeatureChecks;
const path = require("path");
const fs = require("fs");
const node_1 = require("vscode-languageserver/node");
// This is now the single source of truth for default checks.
exports.defaultLegacyFeatureChecks = [
    { id: 'oldFlexbox', name: 'Old Flexbox Syntax (2009)', regex: /-webkit-box/, message: 'The 2009 `-webkit-box` syntax for Flexbox is obsolete.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['css', 'scss', 'less'], fix: 'flex', recommendation: 'Use the modern `display: flex` syntax.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS/flex' },
    { id: 'oldGradient', name: 'Deprecated WebKit Prefixed Gradients', regex: /-webkit-gradient\(/, message: 'WebKit prefixed gradients are deprecated.', severity: node_1.DiagnosticSeverity.Warning, weight: 2, fileTypes: ['css', 'scss', 'less'], recommendation: 'Use the standard `linear-gradient()` or `radial-gradient()` functions.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient' },
    { id: 'getUserMedia', name: 'Deprecated navigator.getUserMedia', regex: /navigator\.getUserMedia\s*\(/, message: '`navigator.getUserMedia` is deprecated.', severity: node_1.DiagnosticSeverity.Warning, weight: 2, fileTypes: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'], recommendation: 'Use the modern, promise-based `navigator.mediaDevices.getUserMedia()` API.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia' },
    { id: 'ieOpacity', name: 'IE Alpha Opacity Filter', regex: /filter:\s*alpha\(opacity=/, message: 'The IE-specific `filter: alpha(opacity=...)` is obsolete.', severity: node_1.DiagnosticSeverity.Warning, weight: 2, fileTypes: ['css', 'scss', 'less'], recommendation: 'Use the standard `opacity` property.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS/opacity' },
    { id: 'documentAll', name: 'Non-standard document.all', regex: /document\.all/, message: '`document.all` is a non-standard, legacy feature.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'], recommendation: 'Use `document.getElementById` or `document.querySelector` instead.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/all' },
    { id: 'fontTag', name: 'HTML <font> Tag', regex: /<\s*font\s/i, message: 'The <font> tag is obsolete.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['html'], recommendation: 'Use CSS for styling text instead.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/font' },
    { id: 'centerTag', name: 'HTML <center> Tag', regex: /(<\s*center\b[^>]*>)([\s\S]*?)(<\/\s*center\s*>)/i, message: 'The <center> tag is obsolete.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['html'], recommendation: 'Use CSS for centering content, e.g., with `text-align` or flexbox.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/center' },
    { id: 'cssExpression', name: 'IE CSS Expressions', regex: /\bexpression\s*\(/i, message: 'CSS expressions are a legacy, IE-only feature and a performance/security risk.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['css', 'scss', 'less'], recommendation: 'Use JavaScript for dynamic styling instead.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS/expression' },
    { id: 'attachEvent', name: 'IE attachEvent', regex: /\battachEvent\s*\(/, message: '`attachEvent` is a legacy, IE-only method.', severity: node_1.DiagnosticSeverity.Warning, weight: 3, fileTypes: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'], recommendation: 'Use the standard `addEventListener` instead.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener' }
];
/**
 * Loads legacy feature checks from a `baseline-recon.config.js` file in the workspace root.
 * Falls back to default checks if the config file is not found or is invalid.
 * @param workspaceRoot The root path of the workspace.
 * @param logger A logging function for reporting errors or info.
 * @returns An array of legacy feature checks.
 */
function loadLegacyFeatureChecks(workspaceRoot, logger = console.log) {
    if (!workspaceRoot) {
        return exports.defaultLegacyFeatureChecks;
    }
    const configPath = path.join(workspaceRoot, 'baseline-recon.config.js');
    if (fs.existsSync(configPath)) {
        try {
            // Invalidate require cache to pick up changes
            delete require.cache[require.resolve(configPath)];
            const customConfig = require(configPath);
            if (customConfig.legacyFeatureChecks && Array.isArray(customConfig.legacyFeatureChecks)) {
                logger(`[Baseline Recon] Loaded custom configuration from: ${configPath}`);
                // We need to convert string regexes back to RegExp objects
                return customConfig.legacyFeatureChecks.map((check) => ({
                    ...check,
                    regex: new RegExp(check.regex)
                }));
            }
        }
        catch (e) {
            logger(`[Baseline Recon] Error loading configuration file: ${e.message}`);
        }
    }
    return exports.defaultLegacyFeatureChecks;
}
//# sourceMappingURL=config.js.map