// popup.js — Baseline Recon (merged, robust)
// Make sure popup.html has buttons with ids: scanBtn, export, exportMD
// and divs with ids: coreResults, advancedResults, optionalResults

// ===== Feature checks (local fallback) - Must align with content.js for accurate merging =====
const allChecks = [
  // Core (Weight 3)
  { name: "CSS Flexbox", weight: 3, regex: /display:\s*flex/ },
  { name: "CSS Grid", weight: 3, regex: /display:\s*grid/ },
  { name: "ES Modules", weight: 3, regex: /(^\s*|;\s*|{\s*)(import|export)\s/m },
  // Advanced (Weight 2)
  { name: "CSS Container Queries", weight: 2, regex: /@container|container-type|container-name/ },
  { name: "backdrop-filter", weight: 2, regex: /backdrop-filter/ },
  { name: "Clipboard API", weight: 2, regex: /navigator\.clipboard/ },
  { name: "Service Workers", weight: 2, regex: /navigator\.serviceWorker/ },
  { name: "HTML <dialog>", weight: 2, selector: 'dialog' },
  { name: "HTML <template>", weight: 2, selector: 'template' },
  // Optional (Weight 1)
  { name: "CSS :has() selector", weight: 1, regex: /:has\(/ },
  { name: "CSS Subgrid", weight: 1, regex: /subgrid/ },
  { name: "WebGPU", weight: 1, regex: /navigator\.gpu/ },
  { name: "WebUSB", weight: 1, regex: /navigator\.usb/ },
  { name: "Notification API", weight: 1, regex: /Notification\.(requestPermission|permission)/ }
];

// ===== Helper: run checks =====
function runChecks(checks) {
  return checks.map(c => ({ name: c.name, supported: !!(typeof c.test === 'function' && c.test()) }));
}

// ===== Render UI =====
function formatList(list) {
  // SVG icons for status
  const supportedIcon = `<svg class="icon supported" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>`;
  const unsupportedIcon = `<svg class="icon unsupported" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM184 232H328c13.3 0 24 10.7 24 24s-10.7 24-24 24H184c-13.3 0-24-10.7-24-24s10.7-24 24-24z"/></svg>`;
  const optionalIcon = `<svg class="icon optional" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM184 232H328c13.3 0 24 10.7 24 24s-10.7 24-24 24H184c-13.3 0-24-10.7-24-24s10.7-24 24-24z"/></svg>`;

  return list.map(feature => {
    let icon;
    let title;
    if (feature.supported) {
      icon = supportedIcon;
      title = "Feature is used on this page.";
    } else {
      // If not supported, check if it's an optional feature (weight: 1)
      if (feature.weight === 1) {
        icon = optionalIcon;
        title = "Optional/Progressive feature not used. No penalty.";
      } else {
        icon = unsupportedIcon;
        title = "Important feature not used. This lowers the score.";
      }
    }
    return `<div class="feature-item" title="${title}" style="display: flex; align-items: center; gap: 8px;">${icon}<span>${feature.name}</span></div>`;
  }).join("");
}

function createTextProgressBar(score, length = 10) {
  const filledCount = Math.round((score / 100) * length);
  const filled = '▓'.repeat(filledCount);
  const empty = '░'.repeat(length - filledCount);
  return `${filled}${empty}`;
}

function calculateCategoryScore(featureList) {
  if (!featureList || featureList.length === 0) {
    return { score: 0, supported: 0, total: 0 };
  }
  const supported = featureList.filter(f => f.supported).length;
  const total = featureList.length;
  const score = Math.round((supported / total) * 100);
  return { score, supported, total };
}

function renderResults(results) {
  // Group features by weight for progressive scoring display
  const groupedFeatures = {
    core: results.filter(f => f.weight === 3),
    advanced: results.filter(f => f.weight === 2),
    optional: results.filter(f => f.weight === 1),
  };

  // Render each weight category
  for (const category of ['core', 'advanced', 'optional']) {
    const container = document.getElementById(`${category}Results`);
    if (!container) continue;

    const categoryData = groupedFeatures[category];
    const { score } = calculateCategoryScore(categoryData);
    const progressBarText = createTextProgressBar(score);

    container.innerHTML = `
      <div class="category-progress">
        <span class="progress-text">${progressBarText}</span> 
        <span class="percentage">${score}%</span>
      </div>
      ${formatList(categoryData)}
    `;    
  }

  // Update the overall score and progress bar
  const scoreEl = document.getElementById("reconScore");
  const score = calculateReconScore(results);
  const progressBar = document.getElementById("reconProgressBar");

  if (scoreEl) scoreEl.textContent = `Usage Score: ${score}%`;

  if (progressBar) {
    progressBar.style.width = `${score}%`;
    // Also update the color to match the badge color
    progressBar.style.backgroundColor = getScoreColor(score);
  }
  // Update the extension badge
  updateBadge(score);
}

// ===== Badge Update =====
function updateBadge(score) {
  const scoreStr = String(score);
  const color = getScoreColor(score);
  chrome.action.setBadgeText({ text: scoreStr });
  chrome.action.setBadgeBackgroundColor({ color });
}

function getScoreColor(score) {
  // Green for high, yellow for medium, red for low
  return score > 80 ? '#28a745' : (score > 50 ? '#ffc107' : '#dc3545');
}

// ===== Initial local scan =====
let results = allChecks.map(c => ({ ...c, supported: false }));

document.addEventListener("DOMContentLoaded", () => renderResults(results));

// ===== Scan button behaviour =====
document.getElementById("scanBtn").addEventListener("click", async () => {
  const scanButton = document.getElementById("scanBtn");
  const spinner = document.getElementById("spinner");

  scanButton.disabled = true;
  spinner.style.display = "block";
  document.getElementById("coreResults").innerHTML = "Scanning page...";
  document.getElementById("advancedResults").innerHTML = "";
  document.getElementById("optionalResults").innerHTML = "";

  // Use a timeout to allow the UI to update before starting the scan
  setTimeout(async () => {
    // attempt to enhance by running page-level checks (best accuracy) — optional
    try {
      const pageScan = await getFeaturesFromPage(); // may return null if unavailable
      if (pageScan && pageScan.features) {
        // merge pageScan features into results for more accurate data
        // pageScan.features is an object: { flexbox: true, grid: true, ... }
        results = mergePageFeaturesIntoResults(results, pageScan.features);
        renderResults(results);
      }
    } catch (err) {
      console.warn("Page-level feature scan failed:", err);
      // Handle the timeout gracefully by showing a partial scan message.
      if (err.message.includes("did not respond in time")) {
        document.getElementById("coreResults").innerHTML = `<div class="feature-item" style="color: var(--unsupported-color);">Scan timed out. The page is too complex for a full analysis.</div>`;
        document.getElementById("advancedResults").innerHTML = "";
        document.getElementById("optionalResults").innerHTML = "";
      }
    } finally {
      scanButton.disabled = false;
      spinner.style.display = "none";
    }
  }, 0);
});

// ===== Merge helper =====
function mergePageFeaturesIntoResults(currentResults, pageFeaturesObj) {
  // Create a new results object to avoid mutating the original
  const newResults = JSON.parse(JSON.stringify(currentResults));

  // The pageFeaturesObj now uses the full feature name as the key.
  return newResults.map(featureItem => {
    if (typeof pageFeaturesObj[featureItem.name] === 'boolean') {
      return { ...featureItem, supported: pageFeaturesObj[featureItem.name] };
    }
    return featureItem;
  });

  return newResults;
}

// ===== Execute script helper =====
async function getFeaturesFromPage() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) throw new Error("No active tab found.");
    const tabId = tabs[0].id;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error("Content script did not respond in time."));
      }, 15000);

      const listener = (message) => {
        if (message.type === "featuresResponse") {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve(message.payload);
        }
      };
      chrome.runtime.onMessage.addListener(listener);

      // Inject the script. The content script will wait for a message with the config.
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      }).then(() => {
        // After injection, send the configuration to start the scan.
        // We must convert RegExp objects to strings for them to be serializable.
        const serializableConfig = allChecks.map(check => ({
          ...check,
          regex: check.regex ? { source: check.regex.source, flags: check.regex.flags } : undefined
        }));

        chrome.tabs.sendMessage(tabId, { type: "startScan", config: serializableConfig });
      }).catch(reject);
    });
  } catch (err) {
    console.error("getFeaturesFromPage error:", err);
    return null;
  }
}

// ===== Recon score calculation =====
function calculateReconScore(results) {
  let totalPenalty = 0;
  let maxPossibleScore = 0;
  let achievedScore = 0;

  const FEATURE_WEIGHTS = {
    core: 0.7,       // must-have features (weight 3)
    advanced: 0.2,   // nice-to-have (weight 2)
    optional: 0.1    // bleeding edge, bonus only (weight 1)
  };

  results.forEach(feature => {
    let category;
    if (feature.weight === 3) category = 'core';
    else if (feature.weight === 2) category = 'advanced';
    else category = 'optional';

    const weight = FEATURE_WEIGHTS[category] || 0.2;

    // Optional features do not contribute to the max possible score unless they are present.
    if (category === 'optional' && !feature.supported) {
      return; // No penalty for missing optional features.
    }

    maxPossibleScore += weight;
    if (feature.supported) achievedScore += weight;
  });

  return maxPossibleScore > 0 ? Math.round((achievedScore / maxPossibleScore) * 100) : 100;
}

// ===== Download helper (send to background for safe downloads) =====
function sendDownload(dataStr, mime, filename) {
  const blob = new Blob([dataStr], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({ type: "downloadReport", url, filename });
}

// ===== Export JSON =====
document.getElementById("export").addEventListener("click", async (e) => {
  e.target.disabled = true;
  e.target.textContent = "Preparing...";
  try {
    // enrich with page-level scan if possible
    const pageScan = await getFeaturesFromPage();
    let finalResults = results;
    let scannedUrl = "";
    let ua = "";

    if (pageScan && pageScan.features) {
      finalResults = mergePageFeaturesIntoResults(results, pageScan.features);
      scannedUrl = (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url;
      ua = pageScan.userAgent || "";
    }

    const report = {
      scannedAt: new Date().toISOString(),
      scannedUrl,
      userAgent: ua,
      usageScore: calculateReconScore(finalResults),
      features: finalResults // Add the detailed feature breakdown
    };

    sendDownload(JSON.stringify(report, null, 2), "application/json", `baseline-report-${Date.now()}.json`);
    e.target.innerHTML = "Exported!";
  } catch (err) {
    console.error("Export JSON error:", err);
    alert("Failed to export JSON: " + (err.message || err));
    e.target.textContent = "Export";
  } finally {
    setTimeout(() => { e.target.disabled = false; e.target.textContent = "Export JSON"; }, 1500);
  }
});

// ===== Export Markdown =====
document.getElementById("exportMD").addEventListener("click", async (e) => {
  e.target.disabled = true;
  e.target.textContent = "Preparing MD...";
  try {
    const pageScan = await getFeaturesFromPage();
    let finalResults = results;
    if (pageScan && pageScan.features) finalResults = mergePageFeaturesIntoResults(results, pageScan.features);

    let md = `# 📊 Baseline Recon Report\n\n`;
    md += `**Usage Score: ${calculateReconScore(finalResults)}%**\n\n`;
    md += `This report details the usage of modern web platform features on the scanned page.\n\n`;
    md += `### Legend\n`;
    md += `- ✅ **Used**: The feature is actively used on the page.\n`;
    md += `- ❌ **Missing**: An important feature that is not used. This lowers the score.\n`;
    md += `- ➖ **Not Used**: An optional or progressive feature that is not used. This does not lower the score.\n\n`;
    md += `--- \n\n`;

    const grouped = {
      "Core Features (Weight 3)": finalResults.filter(f => f.weight === 3),
      "Advanced Features (Weight 2)": finalResults.filter(f => f.weight === 2),
      "Optional & Experimental Features (Weight 1)": finalResults.filter(f => f.weight === 1),
    };

    for (const [title, list] of Object.entries(grouped)) {
      md += `### ${title}\n\n`;
      list.forEach(c => md += `- ${c.supported ? "✅" : (c.weight > 1 ? "❌" : "➖")} ${c.name}\n`);
      md += `\n`;
    }

    sendDownload(md, "text/markdown", `baseline-report-${Date.now()}.md`);
    e.target.innerHTML = "Exported!";
  } catch (err) {
    console.error("Export MD error:", err);
    alert("Failed to export MD: " + (err.message || err));
    e.target.textContent = "Export MD";
  } finally {
    setTimeout(() => { e.target.disabled = false; e.target.textContent = "Export Markdown"; }, 1500);
  }
});
