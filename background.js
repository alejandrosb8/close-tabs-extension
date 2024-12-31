chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "executeMetaScript" && request.tabId) {
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      func: () => {
        const meta = {
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || "",
          keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || ""
        };
        return meta;
      }
    }, (results) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else if (results && results[0] && results[0].result) {
        sendResponse({ meta: results[0].result });
      } else {
        sendResponse({ meta: null });
      }
    });
    return true; // Keep the message channel open for sendResponse
  }
});