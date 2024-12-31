// Escucha mensajes entrantes desde otras partes de la extensión
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "executeMetaScript" && request.tabId) {
    // Ejecuta un script en la pestaña especificada para obtener meta tags
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
        // Responde con el error si ocurre alguno durante la ejecución del script
        sendResponse({ error: chrome.runtime.lastError.message });
      } else if (results && results[0] && results[0].result) {
        // Envía de vuelta las meta tags obtenidas desde la pestaña
        sendResponse({ meta: results[0].result });
      } else {
        // Envía una respuesta indicando que no se obtuvieron meta tags
        sendResponse({ meta: null });
      }
    });
    return true; // Mantiene el canal de mensajes abierto para sendResponse
  }
});