const handleTabs = () => { 
  // Selecciona todas las pestañas y contenidos relacionados
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Desactiva todas las pestañas y contenidos
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      // Activa la pestaña seleccionada y su contenido correspondiente
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      logDebug(`Cambiado a la pestaña ${tab.dataset.tab}`);
    });
  });
};

// Ejecuta un script en una pestaña específica para obtener meta tags
const executeMetaScript = async (tab) => {
  const dbg = document.getElementById("debug");
  logDebug(`Iniciando ejecución de script en tab ID ${tab.id}`);
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "executeMetaScript", tabId: tab.id }, (response) => {
      if (response.error) {
        logDebug(`Error en tab ID ${tab.id}: ${response.error}`);
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: N/A, Keywords: N/A`);
      } else if (response.meta) {
        const meta = response.meta;
        logDebug(`Meta tags obtenidas para tab ID ${tab.id}`);
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: ${meta.description}, Keywords: ${meta.keywords}`);
      } else {
        logDebug(`No se obtuvieron meta tags para tab ID ${tab.id}`);
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: N/A, Keywords: N/A`);
      }
      logDebug(`Finalizó ejecución de script en tab ID ${tab.id}`);
    });
  });
};

// Consulta todas las pestañas abiertas en el navegador
const queryTabs = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
};

// Obtiene datos almacenados en el almacenamiento sincronizado de Chrome
const getStorageData = (keys) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data);
      }
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  // Obtiene referencias a elementos del DOM
  const status = document.getElementById("status");
  const statusMessages = document.getElementById("statusMessages");
  const form = document.getElementById("closeForm");
  const dbg = document.getElementById("debug");
  const closeActiveTabCheckbox = document.getElementById("closeActiveTab");
  const sendMetaTagsCheckbox = document.getElementById("sendMetaTags");
  const apiKeyInput = document.getElementById("apiKey");
  const enableDebugCheckbox = document.getElementById("enableDebug");
  const closedTabsList = document.getElementById("closedTabs");

  // Función para registrar mensajes de depuración si está habilitado
  const logDebug = (message) => {
    if (enableDebugCheckbox.checked) {
      dbg.textContent += ` | ${message}`;
    }
  };

  handleTabs(); // Inicializa el manejo de pestañas

  // Cargar opciones almacenadas en Chrome Storage
  chrome.storage.sync.get(['closeActiveTab', 'sendMetaTags', 'geminiApiKey', 'enableDebug'], (data) => {
    closeActiveTabCheckbox.checked = data.closeActiveTab || false;
    sendMetaTagsCheckbox.checked = data.sendMetaTags || false;
    apiKeyInput.value = data.geminiApiKey || '';
    enableDebugCheckbox.checked = data.enableDebug || false;
    logDebug("Opciones cargadas.");
    logDebug(`closeActiveTab: ${closeActiveTabCheckbox.checked}, sendMetaTags: ${sendMetaTagsCheckbox.checked}, enableDebug: ${enableDebugCheckbox.checked}`);
  });

  // Guardar opciones al cambiar el estado de los checkboxes
  closeActiveTabCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ closeActiveTab: closeActiveTabCheckbox.checked });
    logDebug("Opción 'Cerrar también la pestaña activa' actualizada.");
  });

  sendMetaTagsCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ sendMetaTags: sendMetaTagsCheckbox.checked });
    logDebug("Opción 'Enviar etiquetas meta' actualizada.");
  });

  enableDebugCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ enableDebug: enableDebugCheckbox.checked });
    if (!enableDebugCheckbox.checked) {
      dbg.textContent = ""; // Limpia mensajes de depuración si está deshabilitado
    } else {
      logDebug("Depuración habilitada.");
    }
    logDebug("Opción 'Habilitar mensajes de depuración' actualizada.");
  });

  apiKeyInput.addEventListener('input', () => {
    chrome.storage.sync.set({ geminiApiKey: apiKeyInput.value });
    logDebug("Clave API de Gemini actualizada.");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusMessages.innerHTML += "<p>Obteniendo pestañas...</p>";
    logDebug("Formulario enviado.");

    try {
      logDebug("Iniciando consulta de pestañas.");
      const tabs = await queryTabs();
      logDebug("Pestañas obtenidas.");
      const userText = document.getElementById("promptInput").value;
      logDebug(`Texto del usuario: "${userText}"`);

      const sendMetaTags = sendMetaTagsCheckbox.checked;
      logDebug(`Enviar etiquetas meta: ${sendMetaTags}`);
      let tabList = tabs.map(t => `ID: ${t.id}, Title: ${t.title}, URL: ${t.url}`);
      if (sendMetaTags) {
        logDebug("Se iniciará la recopilación de meta tags.");
        const metaTagsPromises = tabs.map(tab => executeMetaScript(tab));
        logDebug("Esperando a que todas las meta tags sean recopiladas.");
        const metaTags = await Promise.all(metaTagsPromises);
        logDebug("Meta tags recopiladas.");
        tabList = metaTags;
      }

      logDebug("Obtención de clave API de Gemini.");
      const storageData = await getStorageData(['geminiApiKey']);
      const geminiApiKey = storageData.geminiApiKey || '';
      logDebug(geminiApiKey ? "Clave API de Gemini obtenida." : "Clave API de Gemini no proporcionada.");
      if (!geminiApiKey) {
        statusMessages.innerHTML += "<p>Por favor, introduce tu clave API de Gemini en las opciones.</p>";
        logDebug("Error: Clave API de Gemini no proporcionada.");
        return;
      }

      const fullPrompt = `
You are a helpful AI that identifies which tabs to close based on a user's text. 
Here is the list of open tabs:
${tabList.join("\n")}
User request: "${userText}"

Instructions:
- Return a valid JSON object in the form {"ids": [1,2,3]}.
- Match tabs by looking if the tab title, URL, Description or Keywords meta tags contain the user's text.
- If no tabs match, return {"ids": []}.
- ${closeActiveTabCheckbox.checked ? "Include the active tab if it matches the criteria." : "Do not include the active tab."}
      `.trim();

      logDebug("Prompt para IA preparado.");
      logDebug(`Prompt enviado: "${fullPrompt}"`);
      statusMessages.innerHTML += "<p>Enviando solicitud a la IA...</p>";
      logDebug("Enviando solicitud a la IA.");

      try {
        logDebug("Iniciando solicitud fetch a la IA.");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          })
        });

        logDebug(`API responded with status: ${response.status}`);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        logDebug("Solicitud enviada, esperando respuesta...");
        const data = await response.json();
        logDebug("Respuesta recibida.");
        logDebug(`Respuesta de la IA: ${JSON.stringify(data)}`);
        const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        logDebug(`Contenido bruto de la respuesta: ${rawContent}`);

        const match = rawContent.match(/\{[\s\S]*\}/);
        let cleanedJson = match ? match[0] : "{}";
        let selectedIds = [];
        try {
          const parsed = JSON.parse(cleanedJson);
          selectedIds = parsed?.ids || [];
          logDebug(`IDs seleccionados: ${selectedIds}`);
        } catch (err) {
          statusMessages.innerHTML += "<p>La IA devolvió un JSON inválido.</p>";
          logDebug("Error al parsear JSON.");
          return;
        }
        statusMessages.innerHTML += "<p>Cerrando pestañas elegidas...</p>";
        logDebug("Cerrando pestañas seleccionadas.");

        if (selectedIds.length === 0) {
          statusMessages.innerHTML += "<p>No se encontraron IDs a cerrar.</p>";
          logDebug("Ningún ID encontrado.");
          return;
        }
        tabs.forEach((tab) => {
          if (selectedIds.includes(tab.id)) {
            logDebug(`Intentando cerrar pestaña ID: ${tab.id}`);
            chrome.tabs.remove(tab.id, () => {
              const listItem = document.createElement('li');
              listItem.textContent = `Cerrada pestaña: ${tab.title}`;
              closedTabsList.appendChild(listItem);
              
              logDebug(`Cerrada pestaña ID: ${tab.id}`);
            });
          }
        });
      } catch (error) {
        statusMessages.innerHTML += `<p>Error: ${error.message}</p>`;
        logDebug(`Error en la solicitud a la IA: ${error.message}`);
        console.error(error);
      }
    } catch (error) {
      statusMessages.innerHTML += `<p>Error: ${error.message}</p>`;
      logDebug(`Error general: ${error.message}`);
      console.error(error);
    }
  });

  document.getElementById("promptInput").focus();
});