// content.js

if (!window.scanPageForUsage) {
  window.scanPageForUsage = async (featureConfig) => {
    const results = Object.fromEntries(featureConfig.map(c => [c.name, false]));

    // --- Performance Optimization: Limit external fetches and add timeouts ---
    const MAX_CROSS_ORIGIN_FETCHES = 15; // Stricter limit
    const FETCH_TIMEOUT = 3000; // 3-second timeout per fetch
    let crossOriginFetches = 0;

    async function fetchWithTimeout(url) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const response = await fetch(url, { signal: controller.signal });
        return response.ok ? response.text() : '';
      } catch (error) {
        return ''; // Gracefully fail on timeout or other network error
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // --- Helper to filter out irrelevant third-party domains ---
    const thirdPartyDomains = [
      'google-analytics.com', 'googletagmanager.com', 'googleadservices.com',
      'connect.facebook.net', 'facebook.com', 'doubleclick.net', 'youtube.com',
      'twitter.com', 'linkedin.com', 'bing.com', 'hotjar.com', 'vimeo.com'
    ];

    function isThirdParty(url) {
      return thirdPartyDomains.some(domain => url.includes(domain));
    }

    // --- Helper to recursively find all shadow roots ---
    function getAllShadowRoots(node, roots = []) {
      if (node.shadowRoot) {
        roots.push(node.shadowRoot);
      }
      for (const child of node.children) {
        getAllShadowRoots(child, roots);
      }
      return roots;
    }

    const allDocuments = [document, ...getAllShadowRoots(document.documentElement)];

    // --- 1. Scan Stylesheets for CSS features ---
    const cssChecks = featureConfig.filter(c => c.regex && c.name.startsWith("CSS"));
    const styleSheetPromises = allDocuments.flatMap(doc => Array.from(doc.styleSheets || [])).map(async (sheet) => {
      // For same-origin sheets, we can read the rules directly.
      try {
        if (sheet.cssRules) {
          return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
        }
      } catch (e) {
        // This will fail for cross-origin stylesheets.
      }
      // For cross-origin sheets, we must re-fetch them.
      if (sheet.href && !isThirdParty(sheet.href)) {
        const isCrossOrigin = new URL(sheet.href).origin !== location.origin;
        if (!isCrossOrigin || (isCrossOrigin && ++crossOriginFetches <= MAX_CROSS_ORIGIN_FETCHES)) {
            return await fetchWithTimeout(sheet.href);
        }
      }
      return '';
    });

    const cssContents = await Promise.all(styleSheetPromises);
    const allCssText = cssContents.join('\n');
    cssChecks.forEach(check => {
      if (new RegExp(check.regex.source, check.regex.flags).test(allCssText)) {
        results[check.name] = true;
      }
    });

    // --- 2. Scan DOM for HTML features ---
    const htmlChecks = featureConfig.filter(c => c.selector);
    htmlChecks.forEach(check => {
      if (allDocuments.some(doc => doc.querySelector(check.selector))) {
        results[check.name] = true;
      }
    });

    // --- 3. Scan script tags for JS features ---
    const jsChecks = featureConfig.filter(c => c.regex && !c.name.startsWith("CSS"));
    const scriptPromises = allDocuments.flatMap(doc => Array.from(doc.scripts || [])).map(async (script) => {
      if (!script.src) {
        // Inline script: just get its content.
        return script.textContent || '';
      }
      if (script.src && !isThirdParty(script.src)) {
        const isCrossOrigin = new URL(script.src, location.origin).origin !== location.origin;
        if (!isCrossOrigin || (isCrossOrigin && ++crossOriginFetches <= MAX_CROSS_ORIGIN_FETCHES)) {
            return await fetchWithTimeout(script.src);
        }
      }
      return '';
    });

    const scriptsContents = await Promise.all(scriptPromises);
    const allJsText = scriptsContents.join('\n');
    jsChecks.forEach(check => {
      if (new RegExp(check.regex.source, check.regex.flags).test(allJsText)) {
        results[check.name] = true;
      }
    });

    return { features: results, userAgent: navigator.userAgent || "" };
  };
}

// Use a named function for the listener to avoid adding it multiple times.
if (!window.baselineReconListenerAttached) {
  window.baselineReconListenerAttached = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "startScan" && msg.config) {
      scanPageForUsage(msg.config).then(pageScanData => {
        chrome.runtime.sendMessage({ type: "featuresResponse", payload: pageScanData });
      }).catch(error => {
        console.error("Baseline Recon: Error during page scan.", error);
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "featuresResponse", payload: { features: {}, userAgent: "" } });
        }
      });
      return true; // Indicate async response
    }
  });
}
