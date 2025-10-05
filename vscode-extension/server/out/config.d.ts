import { DiagnosticSeverity } from 'vscode-languageserver/node';
export interface LegacyFeatureCheck {
    id: string;
    name: string;
    regex: RegExp;
    message: string;
    severity: DiagnosticSeverity;
    weight: number;
    fileTypes: string[];
    fix?: string;
    recommendation?: string;
    mdnUrl?: string;
}
export declare const defaultLegacyFeatureChecks: LegacyFeatureCheck[];
/**
 * Loads legacy feature checks from a `baseline-recon.config.js` file in the workspace root.
 * Falls back to default checks if the config file is not found or is invalid.
 * @param workspaceRoot The root path of the workspace.
 * @param logger A logging function for reporting errors or info.
 * @returns An array of legacy feature checks.
 */
export declare function loadLegacyFeatureChecks(workspaceRoot: string | undefined, logger?: (message: string) => void): LegacyFeatureCheck[];
