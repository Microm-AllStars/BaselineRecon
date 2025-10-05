#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const config_1 = require("./config");
const languageIdMap = {
    'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascriptreact',
    'tsx': 'typescriptreact', 'css': 'css', 'scss': 'scss',
    'less': 'less', 'html': 'html'
};
const relevantExtensions = new Set(Object.keys(languageIdMap));
/**
 * Analyzes a file's content for legacy features.
 * @param {string} content The text content of the file.
 * @param {string} languageId The language ID of the file.
 * @param {LegacyFeatureCheck[]} legacyFeatureChecks The rules to check against.
 * @returns {number} The penalty score for the file. 0 if ready, otherwise the highest weight of a failing check.
 */
function analyzeContent(content, languageId, legacyFeatureChecks) {
    const applicableChecks = legacyFeatureChecks.filter(check => check.fileTypes.includes(languageId) || check.fileTypes.includes('*'));
    const failingChecks = applicableChecks.filter(check => check.regex.test(content));
    if (failingChecks.length === 0) {
        return 0; // No penalty, file is ready.
    }
    // Return the highest weight of the failing checks as the penalty for this file
    return Math.max(...failingChecks.map(c => c.weight));
}
/**
 * Recursively finds all relevant files in a directory.
 * @param {string} dir The directory to scan.
 * @returns {string[]} An array of file paths.
 */
function findFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        // Exclude node_modules and dot-folders like .git, .vscode
        if (item.isDirectory() && item.name !== 'node_modules' && !item.name.startsWith('.')) {
            files = files.concat(findFiles(fullPath));
        }
        else if (item.isFile()) {
            const ext = path.extname(item.name).substring(1).toLowerCase();
            if (relevantExtensions.has(ext)) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
/**
 * Main CLI function.
 */
function main() {
    console.log('--- Running Baseline Recon Scan ---');
    // --- Argument Parsing ---
    const args = process.argv.slice(2);
    const dirArg = args.find(arg => !arg.startsWith('--')) || '.';
    const minScoreArg = args.find(arg => arg.startsWith('--min-score='));
    const minScore = minScoreArg ? parseInt(minScoreArg.split('=')[1], 10) : 80; // Default min score is 80%
    const rootDir = path.resolve(dirArg);
    if (!fs.existsSync(rootDir)) {
        console.error(`Error: Directory not found at ${rootDir}`);
        process.exit(1);
    }
    // --- Load Configuration ---
    const legacyFeatureChecks = (0, config_1.loadLegacyFeatureChecks)(rootDir, console.log);
    // --- Scanning ---
    const allFiles = findFiles(rootDir);
    if (allFiles.length === 0) {
        console.log('No relevant files found to scan.');
        process.exit(0);
    }
    const penalties = [];
    const failedFiles = [];
    for (const file of allFiles) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const ext = path.extname(file).substring(1).toLowerCase();
            const languageId = languageIdMap[ext] || 'plaintext';
            const penalty = analyzeContent(content, languageId, legacyFeatureChecks);
            penalties.push(penalty);
            if (penalty > 0) {
                failedFiles.push(path.relative(rootDir, file));
            }
        }
        catch (e) {
            console.error(`Could not read or analyze file: ${file}: ${e.message}`);
            penalties.push(0); // Don't penalize for unreadable files
        }
    }
    // --- Reporting ---
    const totalFiles = allFiles.length;
    const maxPossibleScore = totalFiles * 3; // Max weight is 3
    const totalPenalty = penalties.reduce((sum, p) => sum + p, 0);
    const totalScore = maxPossibleScore > 0 ? maxPossibleScore - totalPenalty : 0;
    const score = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 100;
    const readyFiles = penalties.filter(p => p === 0).length;
    console.log('\n--- Scan Complete ---');
    console.log(`Total Files Scanned: ${totalFiles}`);
    console.log(`Baseline Ready Files: ${readyFiles}`);
    console.log(`Score: ${score.toFixed(2)}%`);
    if (failedFiles.length > 0) {
        console.log('\nFiles with legacy features:');
        failedFiles.forEach(f => console.log(`- ${f}`));
    }
    // --- CI Enforcement ---
    if (score < minScore) {
        console.error(`\n[FAIL] Score of ${score.toFixed(2)}% is below the minimum threshold of ${minScore}%.`);
        process.exit(1); // Exit with error code to fail the CI job
    }
    else {
        console.log(`\n[PASS] Score of ${score.toFixed(2)}% meets or exceeds the minimum threshold of ${minScore}%.`);
        process.exit(0); // Success
    }
}
main();
//# sourceMappingURL=cli.js.map