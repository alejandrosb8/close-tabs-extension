// Manejo de pestañas
const handleTabs = () => { // Modificado
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      logDebug(`Cambiado a la pestaña ${tab.dataset.tab}`); // Modificado
    });
  });
};

const executeMetaScript = async (tab) => { // Modificado
  const dbg = document.getElementById("debug"); // Nuevo
  logDebug(`Iniciando ejecución de script en tab ID ${tab.id}`); // Nuevo
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "executeMetaScript", tabId: tab.id }, (response) => { // Modificado
      if (response.error) {
        logDebug(`Error en tab ID ${tab.id}: ${response.error}`); // Modificado
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: N/A, Keywords: N/A`);
      } else if (response.meta) {
        const meta = response.meta;
        logDebug(`Meta tags obtenidas para tab ID ${tab.id}`); // Modificado
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: ${meta.description}, Keywords: ${meta.keywords}`);
      } else {
        logDebug(`No se obtuvieron meta tags para tab ID ${tab.id}`); // Modificado
        resolve(`ID: ${tab.id}, Title: ${tab.title}, URL: ${tab.url}, Description: N/A, Keywords: N/A`);
      }
      logDebug(`Finalizó ejecución de script en tab ID ${tab.id}`); // Nuevo
    });
  });
};

const queryTabs = () => { // Nuevo
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

const getStorageData = (keys) => { // Nuevo
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
  const status = document.getElementById("status");
  const statusMessages = document.getElementById("statusMessages"); // Nuevo
  const form = document.getElementById("closeForm");
  const dbg = document.getElementById("debug"); // Asegurado
  const closeActiveTabCheckbox = document.getElementById("closeActiveTab");
  const sendMetaTagsCheckbox = document.getElementById("sendMetaTags");
  const apiKeyInput = document.getElementById("apiKey"); // Nuevo
  const enableDebugCheckbox = document.getElementById("enableDebug"); // Nuevo
  const closedTabsList = document.getElementById("closedTabs"); // Nuevo

  // Función para registrar mensajes de depuración
  const logDebug = (message) => { // Nuevo
    if (enableDebugCheckbox.checked) { // Nuevo
      dbg.textContent += ` | ${message}`;
    }
  };

  handleTabs(); // Inicializa el manejo de pestañas

  // Cargar opciones almacenadas
  chrome.storage.sync.get(['closeActiveTab', 'sendMetaTags', 'geminiApiKey', 'enableDebug'], (data) => { // Modificado
    closeActiveTabCheckbox.checked = data.closeActiveTab || false;
    sendMetaTagsCheckbox.checked = data.sendMetaTags || false;
    apiKeyInput.value = data.geminiApiKey || ''; // Nuevo
    enableDebugCheckbox.checked = data.enableDebug || false; // Nuevo
    logDebug("Opciones cargadas."); // Modificado
    logDebug(`closeActiveTab: ${closeActiveTabCheckbox.checked}, sendMetaTags: ${sendMetaTagsCheckbox.checked}, enableDebug: ${enableDebugCheckbox.checked}`); // Modificado
  });

  // Guardar opciones al cambiarlas
  closeActiveTabCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ closeActiveTab: closeActiveTabCheckbox.checked });
    logDebug("Opción 'Cerrar también la pestaña activa' actualizada."); // Modificado
  });

  sendMetaTagsCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ sendMetaTags: sendMetaTagsCheckbox.checked });
    logDebug("Opción 'Enviar etiquetas meta' actualizada."); // Modificado
  });

  enableDebugCheckbox.addEventListener('change', () => { // Nuevo
    chrome.storage.sync.set({ enableDebug: enableDebugCheckbox.checked });
    if (!enableDebugCheckbox.checked) {
      dbg.textContent = ""; // Limpiar mensajes de depuración
    } else {
      logDebug("Depuración habilitada."); // Opcional
    }
    logDebug("Opción 'Habilitar mensajes de depuración' actualizada."); // Modificado
  });

  apiKeyInput.addEventListener('input', () => { // Nuevo
    chrome.storage.sync.set({ geminiApiKey: apiKeyInput.value });
    logDebug("Clave API de Gemini actualizada."); // Añadido
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusMessages.innerHTML += "<p>Obteniendo pestañas...</p>"; // Actualizado
    logDebug("Formulario enviado."); // Reemplazado
    
    try {
      logDebug("Iniciando consulta de pestañas."); // Modificado
      const tabs = await queryTabs();
      logDebug("Pestañas obtenidas."); // Modificado
      const userText = document.getElementById("promptInput").value;
      logDebug(`Texto del usuario: "${userText}"`); // Modificado

      const sendMetaTags = sendMetaTagsCheckbox.checked;
      logDebug(`Enviar etiquetas meta: ${sendMetaTags}`); // Modificado
      let tabList = tabs.map(t => `ID: ${t.id}, Title: ${t.title}, URL: ${t.url}`);
      if (sendMetaTags) {
        logDebug("Se iniciará la recopilación de meta tags."); // Modificado
        const metaTagsPromises = tabs.map(tab => executeMetaScript(tab)); // Modificado

        logDebug("Esperando a que todas las meta tags sean recopiladas."); // Modificado
        const metaTags = await Promise.all(metaTagsPromises);
        logDebug("Meta tags recopiladas."); // Modificado
        tabList = metaTags;
      }

      logDebug("Obtención de clave API de Gemini."); // Modificado
      const storageData = await getStorageData(['geminiApiKey']);
      const geminiApiKey = storageData.geminiApiKey || '';
      logDebug(geminiApiKey ? "Clave API de Gemini obtenida." : "Clave API de Gemini no proporcionada."); // Modificado
      if (!geminiApiKey) {
        statusMessages.innerHTML += "<p>Por favor, introduce tu clave API de Gemini en las opciones.</p>"; // Actualizado
        logDebug("Error: Clave API de Gemini no proporcionada."); // Modificado
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

      logDebug("Prompt para IA preparado."); // Modificado
      logDebug(`Prompt enviado: "${fullPrompt}"`); // Modificado
      statusMessages.innerHTML += "<p>Enviando solicitud a la IA...</p>"; // Actualizado
      logDebug("Enviando solicitud a la IA."); // Modificado

      try {
        logDebug("Iniciando solicitud fetch a la IA."); // Modificado
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, { // Actualizado
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          })
        });

        logDebug(`API responded with status: ${response.status}`); // Modificado
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        logDebug("Solicitud enviada, esperando respuesta..."); // Modificado
        const data = await response.json();
        logDebug("Respuesta recibida."); // Modificado
        logDebug(`Respuesta de la IA: ${JSON.stringify(data)}`); // Modificado
        const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        logDebug(`Contenido bruto de la respuesta: ${rawContent}`); // Modificado

        const match = rawContent.match(/\{[\s\S]*\}/);
        let cleanedJson = match ? match[0] : "{}";
        let selectedIds = [];
        try {
          const parsed = JSON.parse(cleanedJson);
          selectedIds = parsed?.ids || [];
          logDebug(`IDs seleccionados: ${selectedIds}`); // Modificado
        } catch (err) {
          statusMessages.innerHTML += "<p>La IA devolvió un JSON inválido.</p>"; // Actualizado
          logDebug("Error al parsear JSON."); // Modificado
          return;
        }
        statusMessages.innerHTML += "<p>Cerrando pestañas elegidas...</p>"; // Actualizado
        logDebug("Cerrando pestañas seleccionadas."); // Modificado

        if (selectedIds.length === 0) {
          statusMessages.innerHTML += "<p>No se encontraron IDs a cerrar.</p>"; // Actualizado
          logDebug("Ningún ID encontrado."); // Modificado
          return;
        }
        tabs.forEach((tab) => {
          if (selectedIds.includes(tab.id)) {
            logDebug(`Intentando cerrar pestaña ID: ${tab.id}`); // Modificado
            chrome.tabs.remove(tab.id, () => {
              const listItem = document.createElement('li');
              listItem.textContent = `Cerrada pestaña: ${tab.title}`;
              closedTabsList.appendChild(listItem); // Añadido
              
              logDebug(`Cerrada pestaña ID: ${tab.id}`); // Modificado
            });
          }
        });
      } catch (error) {
        statusMessages.innerHTML += `<p>Error: ${error.message}</p>`; // Actualizado
        logDebug(`Error en la solicitud a la IA: ${error.message}`); // Modificado
        console.error(error);
      }
    } catch (error) {
      statusMessages.innerHTML += `<p>Error: ${error.message}</p>`; // Actualizado
      logDebug(`Error general: ${error.message}`); // Modificado
      console.error(error);
    }
  });

  document.getElementById("promptInput").focus();
});