# 📊 Baseline Recon: Modernize Your Web Projects


[![VS Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-brightgreen.svg)](https://chrome.google.com/webstore)

**Baseline Recon** is a comprehensive suite of developer tools designed to analyze, score, and modernize web projects. It operates on two fronts: statically analyzing local codebases for outdated patterns and dynamically analyzing live websites for their adoption of modern web platform features.

It serves not just as a linter, but as an educational tool and an automated guardian of code quality for individuals and teams.

---

## Table of Contents

- [📊 Baseline Recon: Modernize Your Web Projects](#-baseline-recon-modernize-your-web-projects)
  - [Table of Contents](#table-of-contents)
  - [Core Philosophy](#core-philosophy)
  - [Project Components](#project-components)
  - [Key Features](#key-features)
  - [Installation](#installation)
    - [VS Code Extension](#vs-code-extension)
    - [Browser Extension](#browser-extension)
  - [Usage](#usage)
    - [In VS Code](#in-vs-code)
    - [In Your Browser](#in-your-browser)
    - [In CI/CD (GitHub Actions)](#in-cicd-github-actions)
  - [Configuration](#configuration)
  - [Contributing](#contributing)
  - [Contributors](#contributors)

---

## Core Philosophy

Not all features are created equal. Baseline Recon moves beyond simple pass/fail checks to provide a nuanced, **weighted scoring system** that offers a true measure of a project's technical health. By distinguishing between "core", "advanced", and "optional" features, it provides a more realistic and actionable assessment of a codebase's modernity.

## Project Components

1. **VS Code Extension**: Provides real-time feedback, in-depth explanations, and automated Quick Fixes directly within your editor.
2. **Browser Extension**: Enables on-the-fly analysis and scoring of any live website.
3. **CI/CD Integration**: Automates code quality enforcement in team environments using a powerful CLI and GitHub Actions.

## Key Features

* **Dual, Weighted Scoring System**:
    * **Legacy Score (Local)**: Scans your project for outdated features. A higher score means a cleaner, more modern codebase.
    * **Usage Score (Live)**: Scans a website for its use of modern features. A higher score indicates better adoption of the modern web platform.

* **Recon Insights & Quick Fixes**:
    * **Deep Explanations**: Hover over a legacy feature in VS Code to see why it's a problem, a modern recommendation, and a link to relevant MDN documentation.
    * **Automated Refactoring**: Use Quick Fixes (`Ctrl+.` or `⌘.`) to automatically refactor legacy code into its modern equivalent.

* **CI/CD Quality Gate**:
    * Integrates seamlessly with GitHub Actions to run a scan on every pull request.
    * Can be configured to **block PRs** if the project's legacy score drops below a set threshold, preventing technical debt from entering the codebase.

* **Historical Progress Tracking**:
    * Automatically saves project scores to a history file, allowing you to visualize your team's modernization efforts over time.

* **High Configurability**:
    * Tailor the linter to your project's needs by defining custom rules, patterns, and weights in a central `baseline-recon.config.js` file.

## Installation

### VS Code Extension

1. Open Visual Studio Code.
2. Go to the **Extensions** view (`Ctrl+Shift+X`).
3. Search for **"Baseline Recon Linter"**.
4. Click **Install**.

### Browser Extension

*(Coming soon to the Chrome Web Store and Firefox Add-ons store)*

## Usage

### In VS Code

* **Real-time Linting**: Once installed, the extension will automatically highlight legacy features in your code with diagnostic squiggles.
* **Run a Project Scan**: Open the Command Palette (`Ctrl+Shift+P`) and run **"Baseline Recon: Calculate Project Score"** to get a full report in the Output panel.
* **View History**: Run **"Baseline Recon: Show Score History Chart"** to open a webview visualizing your project's score over time.

### In Your Browser

1. Navigate to any website.
2. Click the **Baseline Recon** icon in your browser's toolbar.
3. The popup will display a detailed report on the site's usage of modern web features, categorized and scored.
4. Use the **"Deep Scan"** toggle for a more thorough (but slower) analysis of cross-origin assets.
5. Export the report as **JSON** or **Markdown** for sharing and documentation.

### In CI/CD (GitHub Actions)

Automate code quality checks on every pull request to maintain a high standard of modernity.

1. Create a file named `.github/workflows/baseline-scan.yml` in your repository.
2. Add the following content. This example fails the check if the project score drops below 80% and posts the results as a PR comment.

    ```yaml
    name: 'Baseline Recon Scan'

    on:
      pull_request:
        branches: [ main ] # Or your default branch

    jobs:
      recon-scan:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout code
            uses: actions/checkout@v3

          - name: Set up Node.js
            uses: actions/setup-node@v3
            with:
              node-version: '18'

          - name: Install dependencies and compile
            # Assumes the CLI is part of the vscode-extension package
            working-directory: ./vscode-extension
            run: |
              npm install
              npm run compile

          - name: Run Baseline Recon Scan
            id: scan
            # The script will exit with an error if the score is below the threshold.
            run: |
              MIN_SCORE=80 # Set your desired minimum score
              SCAN_OUTPUT=$(node ./vscode-extension/server/out/cli.js . --min-score=$MIN_SCORE)
              echo "SCAN_OUTPUT<<EOF" >> $GITHUB_OUTPUT
              echo "$SCAN_OUTPUT" >> $GITHUB_OUTPUT
              echo "EOF" >> $GITHUB_OUTPUT

          - name: Comment on PR with Scan Results
            if: always() # Run this step even if the scan fails
            uses: actions/github-script@v6
            with:
              script: |
                const output = `## 📊 Baseline Recon Report\n\n\`\`\`\n${{ steps.scan.outputs.SCAN_OUTPUT }}\n\`\`\``;
                github.rest.issues.createComment({
                  issue_number: context.issue.number,
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  body: output
                })
    ```

## Configuration

Customize the linter's behavior by creating a `baseline-recon.config.js` file in your project's root directory. This allows you to override default rules or add new ones specific to your project's needs.

**Example `baseline-recon.config.js`:**

```javascript
module.exports = {
  // A list of features to check for.
  // You can override existing checks or add new ones.
  legacyFeatures: [
    // Example: Override a default rule to change its severity
    {
      id: 'fontTag', // Must match the ID of the rule to override
      name: '<font> Tag',
      severity: 2, // 1=Error, 2=Warning, 3=Info, 4=Hint
    },

    // Example: Add a new custom rule for a deprecated CSS class
    {
      id: 'custom-old-class',
      name: 'Old .legacy-class',
      // The regex pattern to search for
      regex: /\.legacy-class/,
      // The message displayed on hover and in reports
      message: 'The ".legacy-class" is deprecated and should be replaced.',
      // The suggested modern alternative
      recommendation: 'Use the new design system components instead.',
      // Limit the check to specific file types
      fileTypes: ['css', 'scss', 'less'],
      // Assign a weight for scoring purposes (1-3)
      weight: 2,
    }
  ]
};
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for bugs, feature requests, or suggestions.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## Contributors 

Special thanks to:

- Huge shoutout to [Obi Michael](mailto:obimichael2007@gmail.com) — who hadwritten most of the code that powers this project!. Their work laid down the core features, cleaned up tricky bugs, and set a solid direction for where we’re heading. The repo wouldn’t look anything like it does today without their time, effort, and dedication. Big thanks for pushing the project forward! 🙌
- Special thanks to [Obi David](mailto:obidavid2006@gmail.com) and [Ukpeh Gabriel](mailto:gabrielukpehdev@gmail.com) for their individual efforts that really shaped the project. Obi David jumped in with valuable contributions that improved functionality and polished rough edges, while Ukpeh Gabriel helped package everything up smoothly so the product is easy to use and share. Their combined work made the project feel complete and ready for others to enjoy. 🙏