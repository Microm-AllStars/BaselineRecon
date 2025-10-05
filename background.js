chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "downloadReport") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || "baseline-report.json",
      saveAs: true
      }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("Download started with ID:", downloadId);
        sendResponse({ success: true, id: downloadId });
      }
    });
    return true;
  }
});
