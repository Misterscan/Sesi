/* 
{
  "name": "Custom AI Provider",
  "version": "1.0.0",
  "author": "Sesi Community",
  "description": "Configure and use your own AI model provider (OpenAI, Gemini, Anthropic, Ollama, etc.) for Co-Pilot Chat and Autocomplete.",
  "icon": "🤖",
  "commands": []
}
*/

(function() {
  console.log("🚀 Sesi Studio: Custom AI Provider Extension loading...");

  const CONFIG_PREFIX = "setting-custom-ai-";
  
  const getConf = (key, fallback = "") => localStorage.getItem(CONFIG_PREFIX + key) || fallback;
  const setConf = (key, val) => localStorage.setItem(CONFIG_PREFIX + key, val);

  // Initialize default configuration
  if (localStorage.getItem(CONFIG_PREFIX + "enabled") === null) {
    setConf("enabled", "false");
    setConf("provider", "openai");
    setConf("api-key", "");
    setConf("model", "gpt-5-mini");
    setConf("endpoint", "https://api.openai.com/v1/chat/completions");
    setConf("use-proxy", "true");
  }

  if (localStorage.getItem(CONFIG_PREFIX + "thinking") === null) {
    setConf("thinking", "default");
  }

  // Inject Styles
  function injectStyles() {
    if (document.getElementById("custom-ai-styles")) return;
    
    const style = document.createElement("style");
    style.id = "custom-ai-styles";
    style.textContent = `
      .custom-ai-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 100%;
        animation: fadeIn 0.2s ease-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .custom-ai-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .custom-ai-field label {
        font-size: 11px;
        color: var(--silver-light);
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .custom-ai-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .custom-ai-input {
        width: 100%;
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--glass-border);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        outline: none;
        font-family: inherit;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .custom-ai-input:focus {
        border-color: var(--accent-cyan);
        box-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
      }
      .custom-ai-select {
        width: 100%;
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--glass-border);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        outline: none;
        cursor: pointer;
        transition: border-color 0.2s;
      }
      .custom-ai-select:focus {
        border-color: var(--accent-cyan);
      }
      .custom-ai-toggle-pwd {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        color: var(--silver-mid);
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
      }
      .custom-ai-btn {
        background: var(--accent-cyan);
        color: #000;
        border: none;
        padding: 10px 16px;
        border-radius: 6px;
        font-weight: bold;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 160px;
      }
      .custom-ai-btn:hover {
        opacity: 0.9;
      }
      .custom-ai-btn:active {
        transform: scale(0.98);
      }
      .custom-ai-btn:disabled {
        background: var(--silver-dark);
        cursor: not-allowed;
        opacity: 0.6;
      }
      .custom-ai-test-log {
        background: rgba(0,0,0,0.4);
        border: 1px solid var(--glass-border);
        padding: 12px;
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--silver-mid);
        margin-top: 10px;
        min-height: 40px;
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      .custom-ai-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .custom-ai-badge.success {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .custom-ai-badge.error {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .custom-ai-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(0,0,0,0.2);
        border-left-color: #000;
        border-radius: 50%;
        animation: ai-spin 0.8s linear infinite;
      }
      @keyframes ai-spin {
        to { transform: rotate(360deg); }
      }

      /* Beautiful toggle switch */
      .ai-toggle-switch {
        position: relative;
        display: inline-block;
        width: 46px;
        height: 24px;
      }
      .ai-toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .ai-toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255,255,255,0.08);
        transition: .3s;
        border-radius: 24px;
        border: 1px solid var(--glass-border);
      }
      .ai-toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: var(--silver-light);
        transition: .3s;
        border-radius: 50%;
      }
      input:checked + .ai-toggle-slider {
        background-color: var(--accent-cyan);
      }
      input:checked + .ai-toggle-slider:before {
        transform: translateX(22px);
        background-color: #000;
      }
    `;
    document.head.appendChild(style);
  }

  // Register settings UI
  function initExtensionUI() {
    const sidebar = document.querySelector('#settingsModal div[style*="width: 200px"]');
    if (!sidebar) {
      setTimeout(initExtensionUI, 200);
      return;
    }

    // Check if tab already exists
    if (document.getElementById('custom-ai-tab')) return;

    // Create our new Settings tab
    const customTab = document.createElement('div');
    customTab.id = 'custom-ai-tab';
    customTab.className = 'settings-tab';
    customTab.style.cssText = 'padding: 10px 24px; cursor: pointer; font-size: 13px; color: var(--silver-mid); transition: all 0.2s;';
    customTab.textContent = '🤖 AI Provider';
    customTab.onclick = () => {
      window.switchSettingsTab('custom-ai', customTab);
    };
    
    // Add to sidebar
    sidebar.appendChild(customTab);

    // Wrap the existing switchSettingsTab to handle our new tab view
    const originalSwitchTab = window.switchSettingsTab;
    window.switchSettingsTab = function(tab, el) {
      // Call original first to clear/update active class on sidebar tabs
      originalSwitchTab(tab, el);
      
      if (tab === 'custom-ai') {
        const content = document.getElementById('settingsContent');
        if (content) {
          renderCustomAISettings(content);
        }
      }
    };
    
    injectStyles();
    console.log("✓ Custom AI Provider Settings tab registered!");
  }

  // Render form
  function renderCustomAISettings(container) {
    const isEnabled = getConf("enabled") === "true";
    const provider = getConf("provider", "openai");
    const apiKey = getConf("api-key");
    const model = getConf("model");
    const endpoint = getConf("endpoint");
    const useProxy = getConf("use-proxy") === "true";
    const thinking = getConf("thinking", "default");

    container.innerHTML = `
      <div class="settings-section">
        <h3>Custom AI Model Provider</h3>
        <p style="font-size: 12px; color: var(--silver-mid); margin: -8px 0 20px 0;">
          Configure your own external AI models to bypass the default studio backend settings. All configurations are stored locally in your browser.
        </p>

        <div class="setting-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px; margin-bottom: 20px;">
          <div class="setting-label">
            <span class="setting-title">Enable Custom Provider</span>
            <span class="setting-desc">Use this custom configuration for Co-Pilot Chat and Autocomplete suggestions instead of the built-in model.</span>
          </div>
          <label class="ai-toggle-switch">
            <input type="checkbox" id="custom-ai-enabled-toggle" ${isEnabled ? 'checked' : ''}>
            <span class="ai-toggle-slider"></span>
          </label>
        </div>

        <div id="custom-ai-form-fields" style="display: ${isEnabled ? 'flex' : 'none'}; flex-direction: column; gap: 16px;">
          
          <div class="custom-ai-field">
            <label for="custom-ai-provider-select">Provider Type</label>
            <select id="custom-ai-provider-select" class="custom-ai-select">
              <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI (ChatGPT)</option>
              <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google (Gemini)</option>
              <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
              <option value="ollama" ${provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
              <option value="custom" ${provider === 'custom' ? 'selected' : ''}>Custom OpenAI-Compatible API</option>
            </select>
          </div>

          <div class="custom-ai-field" id="field-api-key">
            <label for="custom-ai-key-input">API Key</label>
            <div class="custom-ai-input-wrapper">
              <input type="password" id="custom-ai-key-input" class="custom-ai-input" placeholder="Enter provider API key" value="${apiKey}">
              <button class="custom-ai-toggle-pwd" type="button" id="toggle-pwd-btn">👁️</button>
            </div>
          </div>

          <div class="custom-ai-field">
            <label for="custom-ai-model-input">Model Name</label>
            <input type="text" id="custom-ai-model-input" class="custom-ai-input" placeholder="e.g. gpt-5-mini" value="${model}">
          </div>

          <div class="custom-ai-field" id="field-thinking">
            <label for="custom-ai-thinking-select">Thinking / Reasoning Level</label>
            <select id="custom-ai-thinking-select" class="custom-ai-select">
              <option value="default" ${thinking === 'default' ? 'selected' : ''}>Default (Let Provider Choose)</option>
              <option value="low" ${thinking === 'low' ? 'selected' : ''}>Low (Faster / Cheaper)</option>
              <option value="medium" ${thinking === 'medium' ? 'selected' : ''}>Medium (Balanced)</option>
              <option value="high" ${thinking === 'high' ? 'selected' : ''}>High (Deeper reasoning)</option>
            </select>
            <span style="font-size: 10px; color: var(--silver-dark); margin-top: -2px;">
              Only supported by reasoning models (like GPT-5/o-series, Gemini 3+, Claude 3.7+).
            </span>
          </div>

          <div class="custom-ai-field" id="field-endpoint">
            <label for="custom-ai-endpoint-input">Endpoint URL</label>
            <input type="text" id="custom-ai-endpoint-input" class="custom-ai-input" placeholder="https://api.openai.com/v1/chat/completions" value="${endpoint}">
          </div>

          <div class="setting-item" style="border-bottom: none; padding-bottom: 0; margin-bottom: 0;">
            <div class="setting-label">
              <span class="setting-title">CORS Bypass Proxy</span>
              <span class="setting-desc">Route requests through the local Sesi server proxy to prevent browser CORS request blocking. (Highly recommended for OpenAI, Anthropic, Gemini)</span>
            </div>
            <input type="checkbox" id="custom-ai-proxy-toggle" ${useProxy ? 'checked' : ''}>
          </div>

          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <button id="custom-ai-btn-test" class="custom-ai-btn" type="button">Test Connection</button>
              <span id="custom-ai-test-badge"></span>
            </div>
            <div id="custom-ai-test-result" class="custom-ai-test-log" style="display: none;"></div>
          </div>

        </div>
      </div>
    `;

    // Bind event handlers
    const enabledToggle = document.getElementById("custom-ai-enabled-toggle");
    const formFields = document.getElementById("custom-ai-form-fields");
    const providerSelect = document.getElementById("custom-ai-provider-select");
    const keyInput = document.getElementById("custom-ai-key-input");
    const togglePwdBtn = document.getElementById("toggle-pwd-btn");
    const modelInput = document.getElementById("custom-ai-model-input");
    const thinkingSelect = document.getElementById("custom-ai-thinking-select");
    const endpointInput = document.getElementById("custom-ai-endpoint-input");
    const proxyToggle = document.getElementById("custom-ai-proxy-toggle");
    const testBtn = document.getElementById("custom-ai-btn-test");
    const testResult = document.getElementById("custom-ai-test-result");
    const testBadge = document.getElementById("custom-ai-test-badge");

    const updateFieldVisibility = () => {
      const p = providerSelect.value;
      const keyField = document.getElementById("field-api-key");
      const endpointField = document.getElementById("field-endpoint");
      const thinkingField = document.getElementById("field-thinking");

      if (p === "ollama") {
        keyField.style.display = "none";
        endpointField.style.display = "flex";
        thinkingField.style.display = "none";
        if (endpointInput.value === "" || endpointInput.value.includes("openai.com")) {
          endpointInput.value = "http://localhost:11434/v1/chat/completions";
        }
        if (modelInput.value.startsWith("gpt-") || modelInput.value.startsWith("claude-") || modelInput.value.startsWith("gemini-")) {
          modelInput.value = "llama3";
        }
      } else if (p === "custom") {
        keyField.style.display = "flex";
        endpointField.style.display = "flex";
        thinkingField.style.display = "none";
      } else {
        keyField.style.display = "flex";
        endpointField.style.display = "none";
        thinkingField.style.display = "flex";
        
        // Update model placeholders & default endpoints
        if (p === "openai") {
          endpointInput.value = "https://api.openai.com/v1/chat/completions";
          if (!modelInput.value || modelInput.value === "llama3" || modelInput.value.startsWith("claude-") || modelInput.value.startsWith("gemini-")) {
            modelInput.value = "gpt-5-mini";
          }
        } else if (p === "gemini") {
          endpointInput.value = "";
          if (!modelInput.value || modelInput.value === "llama3" || modelInput.value.startsWith("gpt-") || modelInput.value.startsWith("claude-")) {
            modelInput.value = "gemini-3.5-flash";
          }
        } else if (p === "anthropic") {
          endpointInput.value = "https://api.anthropic.com/v1/messages";
          if (!modelInput.value || modelInput.value === "llama3" || modelInput.value.startsWith("gpt-") || modelInput.value.startsWith("gemini-")) {
            modelInput.value = "claude-haiku-4-5";
          }
        }
      }
    };

    updateFieldVisibility();

    // Enabled state toggle
    enabledToggle.onchange = () => {
      const active = enabledToggle.checked;
      setConf("enabled", active ? "true" : "false");
      formFields.style.display = active ? "flex" : "none";
    };

    // Provider select change
    providerSelect.onchange = () => {
      setConf("provider", providerSelect.value);
      updateFieldVisibility();
      saveAllFields();
    };

    // Field changes
    const saveAllFields = () => {
      setConf("api-key", keyInput.value);
      setConf("model", modelInput.value);
      setConf("thinking", thinkingSelect.value);
      setConf("endpoint", endpointInput.value);
      setConf("use-proxy", proxyToggle.checked ? "true" : "false");
    };

    keyInput.oninput = saveAllFields;
    modelInput.oninput = saveAllFields;
    thinkingSelect.onchange = saveAllFields;
    endpointInput.oninput = saveAllFields;
    proxyToggle.onchange = saveAllFields;

    // Toggle password visibility
    togglePwdBtn.onclick = () => {
      if (keyInput.type === "password") {
        keyInput.type = "text";
        togglePwdBtn.textContent = "🙈";
      } else {
        keyInput.type = "password";
        togglePwdBtn.textContent = "👁️";
      }
    };

    // Connection tester
    testBtn.onclick = async () => {
      saveAllFields();
      testBtn.disabled = true;
      testBtn.innerHTML = `<span class="custom-ai-spinner"></span> Testing...`;
      testResult.style.display = "block";
      testResult.textContent = "Sending test request to provider...\n";
      testBadge.innerHTML = "";

      try {
        const payload = {
          query: "Hello! Respond with exactly 'Connection Successful!' and nothing else.",
          sessionId: "test-session",
          filePath: null,
          fileContent: null
        };

        testResult.textContent += `Endpoint: ${providerSelect.value === 'gemini' ? 'Google Gemini API' : endpointInput.value}\n`;
        testResult.textContent += `Model: ${modelInput.value}\n`;

        const responseText = await runTestRequest(payload);
        
        testResult.textContent += `\nResponse Received:\n"${responseText}"\n`;
        
        testBadge.innerHTML = `<span class="custom-ai-badge success">Success</span>`;
        testResult.textContent += `\n✓ Connection test passed successfully!`;
      } catch (err) {
        testBadge.innerHTML = `<span class="custom-ai-badge error">Failed</span>`;
        testResult.textContent += `\n❌ Error: ${err.message}\n`;
        testResult.textContent += `\nTroubleshooting tips:\n1. Verify your API Key.\n2. Ensure CORS Bypass Proxy is enabled if testing standard cloud models.\n3. Verify the Endpoint URL and Model Name.\n4. Check if Sesi Studio backend server is running.`;
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = "Test Connection";
      }
    };
  }

  // Intercept fetch API calls
  const originalFetch = window.fetch;
  window.fetch = async function(resource, options) {
    const url = typeof resource === 'string' ? resource : resource.url;
    const isEnabled = localStorage.getItem(CONFIG_PREFIX + "enabled") === 'true';

    if (isEnabled && (url === '/api/chat' || url === '/api/autocomplete')) {
      try {
        console.log(`[Custom AI] Intercepting fetch request to ${url}`);
        const body = JSON.parse(options.body || '{}');
        
        let resText;
        if (url === '/api/chat') {
          resText = await runClientSideSesiDo(body);
        } else {
          resText = await executeCustomAIRequest(url, body);
        }
        
        // Format response to match Sesi Studio expected output
        const responseData = url === '/api/chat' 
          ? { response: resText } 
          : { suggestion: resText };

        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[Custom AI] Request failed:', err);
        const errMsg = `⚠️ Custom AI Provider Error: ${err.message}`;
        const responseData = url === '/api/chat' 
          ? { response: errMsg } 
          : { suggestion: "" };

        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return originalFetch(resource, options);
  };

  // Intercept WebSocket chat calls for Custom AI Provider
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (e) {
      originalSend.apply(this, arguments);
      return;
    }

    const isEnabled = localStorage.getItem(CONFIG_PREFIX + "enabled") === 'true';
    if (isEnabled && payload && payload.type === 'chat') {
      console.log("[Custom AI] Intercepting WebSocket chat request:", payload);
      handleCustomAIWebSocketChat(this, payload);
      return; // Intercept and block sending to native server
    }

    originalSend.apply(this, arguments);
  };

  async function handleCustomAIWebSocketChat(socket, payload) {
    let accumulatedText = "";
    
    const onChunk = (text) => {
      accumulatedText += text;
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: "chat_chunk",
            chunk: text
          })
        });
      }
    };

    try {
      const finalResult = await runClientSideSesiDoStreaming(payload, onChunk);
      
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: "chat_end",
            response: accumulatedText
          })
        });
      }
    } catch (err) {
      console.error("[Custom AI] WebSocket execution error:", err);
      const errMsg = `\n\n⚠️ Custom AI Error: ${err.message}\n`;
      onChunk(errMsg);
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: "chat_end",
            response: accumulatedText
          })
        });
      }
    }
  }

  const SESI_SYSTEM_INSTRUCTIONS = `You are Sesi Co-Pilot, an expert programmer for the Sesi programming language.
Sesi is a clean, minimal, and highly legible programming language.
Key Syntax Rules:
- Block Termination: Closing braces } do not require newlines or semicolons.
- Prompts & Prints: Inside prompt blocks, anonymous model blocks, and print statements, literal strings and variables are placed sequentially (e.g., print "User:" name). AVOID the + operator in these.
- No Raw Newlines in Prompts: Raw newlines in prompt blocks are forbidden outside string literals. Place them inside double quotes.
- Structured Output Schemas: Keys in schemas must be unquoted identifiers (e.g. {key: string}).
- Object Literals: Conversely, standard object literals {} require strictly quoted string keys (e.g. {"name": "Alice"}).
- JSON: Use to_json(obj) for JSON serialization. Do not use stringify(obj).
- Systems Primitive: Use 'let' instead of 'const'. Do not use main() wrappers. Use return only inside fn blocks.`;

  let cachedDocs = "";

  async function getSesiDocs() {
    if (cachedDocs) return cachedDocs;
    try {
      const mainFiles = ["docs/WRITING_SCRIPTS.md", "docs/BUILTINS.md", "README.md"];
      let gettingStartedFiles = [];
      try {
        const listRes = await originalFetch("/api/files?path=getting-started");
        if (listRes.ok) {
          const items = await listRes.json();
          gettingStartedFiles = items
            .filter(item => !item.isDir && item.name.endsWith(".md"))
            .map(item => item.path);
        }
      } catch (err) {
        console.error("Failed to list getting-started files:", err);
      }

      const allPaths = [...mainFiles, ...gettingStartedFiles];
      const fileContents = await Promise.all(
        allPaths.map(async (filePath) => {
          try {
            const res = await originalFetch(`/api/file?path=${encodeURIComponent(filePath)}`);
            if (res.ok) {
              const data = await res.json();
              return { path: filePath, content: data.content || "" };
            }
          } catch (e) {
            console.error(`Failed to fetch file ${filePath}:`, e);
          }
          return null;
        })
      );

      let compiledDocs = "";
      for (const file of fileContents) {
        if (file && file.content) {
          compiledDocs += `\n\n=== DOCUMENT: ${file.path} ===\n${file.content}\n`;
        }
      }

      cachedDocs = `\n\n=== REFERENCE Sesi Documentation ===\n${compiledDocs}`;
      return cachedDocs;
    } catch (err) {
      console.error("Failed to load Sesi documentation context:", err);
      return "";
    }
  }

  // Client-side SesiDo Loop for Custom AI Provider
  async function runClientSideSesiDo(body) {
    return runClientSideSesiDoStreaming(body, (chunk) => {});
  }

  // Client-side SesiDo Loop with real-time streaming updates
  async function runClientSideSesiDoStreaming(body, onChunk) {
    const provider = getConf("provider", "openai");
    const apiKey = getConf("api-key");
    const model = getConf("model");
    const endpoint = getConf("endpoint");
    const useProxy = getConf("use-proxy") === "true";
    const thinking = getConf("thinking", "default");
    const docs = await getSesiDocs();

    let reactHistory = "";
    let stepsTaken = 0;
    const maxSteps = 5;

    // Define the tools description
    const toolsDesc = `
- list_directory: Lists files in a directory.
  Arguments JSON schema: {"path": string} (optional, defaults to ".")
- read_file: Reads the full content of a file.
  Arguments JSON schema: {"path": string}
- write_file: Writes content to a file, creating or overwriting it.
  Arguments JSON schema: {"path": string, "content": string}
- run_helper_script: Runs a specific Sesi helper script from the helpers/ directory.
  Arguments JSON schema: {"script_name": string, "args_str": string}
- eval_sesi_code: Evaluates inline Sesi code.
  Arguments JSON schema: {"code": string}
- call_image_subagent: Delegates image asset generation to a dedicated prompt-refinement subagent. Generates the image via Sesi's native image engine, saves the file to disk, and returns the result path.
  Arguments JSON schema: {"prompt": string, "aspect_ratio": string (e.g. "1:1", "16:9"), "output_path": string}
- browser_goto: Navigates the browser to a URL.
  Arguments JSON schema: {"url": string}
- browser_click: Clicks an element in the browser.
  Arguments JSON schema: {"selector": string}
- browser_fill: Fills an input value in the browser.
  Arguments JSON schema: {"selector": string, "value": string}
- browser_screenshot: Captures a screenshot of the browser page.
  Arguments JSON schema: {"path": string} (optional)
- browser_get_content: Gets the text content of the body of the page.
  Arguments: {}
- browser_close: Closes the browser.
  Arguments: {}
`;

    // Construct the active file context
    let activeFileContext = "";
    if (body.filePath && body.fileContent) {
      activeFileContext = `\\n\\n[Active File: ${body.filePath}]\\n\`\`\`\\n${body.fileContent}\\n\`\`\`\\n`;
    }

    // Get the base system prompt
    const baseSystemPrompt = SESI_SYSTEM_INSTRUCTIONS + docs;

    // Fetch conversation history from the UI
    let historyMessages = [];
    const activeChat = (window.chats || []).find(c => c.id === body.sessionId);
    if (activeChat && activeChat.messages) {
      const lastMsgs = activeChat.messages.slice(-15);
      for (const msg of lastMsgs) {
        historyMessages.push({
          role: msg.isUser ? "user" : "assistant",
          content: msg.text
        });
      }
    }

    // Construct history string for the prompt
    let historyStr = "";
    historyMessages.forEach(msg => {
      historyStr += `${msg.role === "user" ? "User" : "Co-Pilot"}: ${msg.content}\\n`;
    });

    let finalAnswer = "";

    while (stepsTaken < maxSteps) {
      let promptText = `
System: You are an agent with access to these tools:
${toolsDesc}

Solve the task step-by-step.
At each step, output a JSON object with:
- thought (string): reasoning
- tool_name (string): name of the tool to run, or empty if finished
- tool_args_json (string): JSON string containing all arguments for the tool
- finished (bool): true if done
- final_answer (string): final result if finished is true

Conversation History:
${historyStr}

Active File Context:
${activeFileContext}

Task: ${body.query}

Previous steps and observations:
${reactHistory}

Next Step JSON:`;

      // Call the provider
      let stepText = "";
      try {
        stepText = await sendRequestToProvider({
          provider,
          apiKey,
          model,
          endpoint,
          useProxy,
          systemInstruction: baseSystemPrompt,
          promptText,
          historyMessages: [],
          temperature: 0.1,
          maxTokens: 4096,
          isChat: true,
          thinking
        });
      } catch (e) {
        onChunk(`⚠️ error: failed to call model provider: ${e.message}\n\n`);
        finalAnswer = `Error: Model provider request failed: ${e.message}`;
        break;
      }

      // Parse step JSON
      let step;
      try {
        const jsonMatch = stepText.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          step = JSON.parse(jsonMatch[0]);
        } else {
          // fallback to using a structured output parsing request to the provider
          const parsePrompt = `Convert this response to JSON matching this schema:
{"thought": "string", "tool_name": "string", "tool_args_json": "string", "finished": true/false, "final_answer": "string"}

Response: ${stepText}`;
          const parseRes = await sendRequestToProvider({
            provider,
            apiKey,
            model,
            endpoint,
            useProxy,
            systemInstruction: "You are a JSON converter.",
            promptText: parsePrompt,
            historyMessages: [],
            temperature: 0,
            maxTokens: 500,
            isChat: true,
            thinking: "default"
          });
          const jsonMatch2 = parseRes.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatch2) {
            step = JSON.parse(jsonMatch2[0]);
          } else {
            throw new Error("Could not parse structured step JSON");
          }
        }
      } catch (e) {
        console.error("[Custom AI SesiDo] Parse error:", e, "Step text was:", stepText);
        onChunk(stepText + "\n\n");
        finalAnswer = stepText;
        break;
      }

      if (step.thought) {
        onChunk(`💭 *Thought:* ${step.thought}\n\n`);
      }

      if (step.finished || !step.tool_name) {
        finalAnswer = step.final_answer || step.thought;
        onChunk(finalAnswer + "\n");
        break;
      }

      // Execute tool
      let observation = "";
      const toolName = step.tool_name;
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(step.tool_args_json || "{}");
      } catch(e) {}

      onChunk(`🛠️ *Calling tool:* \`${toolName}\`\n\n`);

      try {
        const res = await originalFetch("/api/agent/tool", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_name: toolName, tool_args: toolArgs })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            observation = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
          } else {
            observation = `Error: ${data.error}`;
          }
        } else {
          const errText = await res.text();
          observation = `HTTP Error ${res.status}: ${errText}`;
        }
      } catch (err) {
        observation = `Error executing tool: ${err.message}`;
      }

      onChunk(`📥 *Observation:* ${observation}\n\n`);

      reactHistory += `Step ${stepsTaken + 1}:\nThought: ${step.thought}\nAction: ${toolName} with ${JSON.stringify(toolArgs)}\nObservation: ${observation}\n\n`;
      stepsTaken++;
    }

    if (stepsTaken >= maxSteps && !finalAnswer) {
      finalAnswer = "Max execution steps reached without a final answer.";
      onChunk(finalAnswer + "\n");
    }

    return finalAnswer;
  }

  // Build the request and execute it
  async function executeCustomAIRequest(url, body) {
    const isChat = url === '/api/chat';
    const provider = getConf("provider", "openai");
    const apiKey = getConf("api-key");
    const model = getConf("model");
    const endpoint = getConf("endpoint");
    const useProxy = getConf("use-proxy") === "true";
    const thinking = getConf("thinking", "default");

    const docs = await getSesiDocs();
    const systemInstruction = isChat 
      ? (SESI_SYSTEM_INSTRUCTIONS + docs)
      : ("You are a professional software engineer acting as an inline code completion engine for the Sesi programming language. Use the following language specification reference:\n" + docs);
    
    const temperature = isChat ? 0.4 : 0.1;
    const maxTokens = isChat ? 4096 : 300;

    let promptText = "";
    let historyMessages = [];

    if (isChat) {
      // Find chat history
      const activeChat = (window.chats || []).find(c => c.id === body.sessionId);
      if (activeChat && activeChat.messages) {
        // Grab last 15 messages for context
        const lastMsgs = activeChat.messages.slice(-15);
        for (const msg of lastMsgs) {
          historyMessages.push({
            role: msg.isUser ? "user" : "assistant",
            content: msg.text
          });
        }
      }

      // Main prompt query
      promptText = body.query;
      if (body.filePath && body.fileContent) {
        promptText = `[Active File: ${body.filePath}]\n\`\`\`\n${body.fileContent}\n\`\`\`\n\nUser Question: ${body.query}`;
      }
    } else {
      // Autocomplete prompt
      promptText = `You are a professional software engineer. Your job is to act as an inline code completion engine (like GitHub Copilot) for the Sesi programming language.

Here is the context of the active file:
File name: ${body.filePath || 'unsaved.sesi'}

Prefix (code before cursor):
${body.prefix}

Suffix (code after cursor):
${body.suffix}

Task: Complete the code exactly from where the cursor left off.
Rules:
- Respond ONLY with the raw code completion that immediately continues the prefix.
- Do NOT wrap your response in markdown code blocks.
- Do NOT include the prefix or suffix in your response.
- Do NOT provide explanations, commentary, or comments.
- Complete only the immediate logical block, line, or expression.
- If no completion makes sense, return absolutely nothing.`;
    }

    return await sendRequestToProvider({
      provider,
      apiKey,
      model,
      endpoint,
      useProxy,
      systemInstruction,
      promptText,
      historyMessages,
      temperature,
      maxTokens,
      isChat,
      thinking
    });
  }

  // Handle connection test execution
  async function runTestRequest(payload) {
    const provider = getConf("provider", "openai");
    const apiKey = getConf("api-key");
    const model = getConf("model");
    const endpoint = getConf("endpoint");
    const useProxy = getConf("use-proxy") === "true";
    const thinking = getConf("thinking", "default");

    return await sendRequestToProvider({
      provider,
      apiKey,
      model,
      endpoint,
      useProxy,
      systemInstruction: "You are a helpful assistant.",
      promptText: payload.query,
      historyMessages: [],
      temperature: 0.1,
      maxTokens: 50,
      isChat: true,
      thinking
    });
  }

  // Base API communicator
  async function sendRequestToProvider({
    provider,
    apiKey,
    model,
    endpoint,
    useProxy,
    systemInstruction,
    promptText,
    historyMessages,
    temperature,
    maxTokens,
    isChat,
    thinking = "default"
  }) {
    let targetUrl = endpoint;
    let headers = { "Content-Type": "application/json" };
    let reqBody = {};

    if (provider === "gemini") {
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const contents = [];
      // Populate history if present (only gemini role is user/model)
      if (isChat && historyMessages.length > 0) {
        historyMessages.forEach(msg => {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
          });
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: promptText }]
      });

      reqBody = {
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature
        }
      };

      if (thinking !== "default") {
        reqBody.generationConfig.thinkingConfig = {
          thinkingLevel: thinking
        };
      }
    } else if (provider === "openai" || provider === "ollama" || provider === "custom") {
      const messages = [
        { role: "system", content: systemInstruction }
      ];
      if (isChat && historyMessages.length > 0) {
        historyMessages.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }
      messages.push({ role: "user", content: promptText });

      reqBody = {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      };

      if (thinking !== "default" && provider === "openai") {
        reqBody.reasoning_effort = thinking;
      }

      if (apiKey && provider !== "ollama") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    } else if (provider === "anthropic") {
      const messages = [];
      if (isChat && historyMessages.length > 0) {
        historyMessages.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }
      messages.push({ role: "user", content: promptText });

      reqBody = {
        model: model,
        system: systemInstruction,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      };

      if (thinking !== "default") {
        reqBody.thinking = { type: "adaptive" };
        reqBody.output_config = { effort: thinking };
      }

      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }

    let responseText = "";

    if (useProxy) {
      // Send through Sesi Studio backend proxy to bypass CORS
      const proxyPayload = {
        url: targetUrl,
        method: "POST",
        headers: headers,
        body: JSON.stringify(reqBody)
      };

      const res = await originalFetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proxyPayload)
      });

      if (!res.ok) {
        throw new Error(`Local Sesi proxy responded with status ${res.status}`);
      }

      const proxyData = await res.json();
      if (!proxyData.success) {
        throw new Error(proxyData.error || "Proxy request execution failed");
      }

      const responseObj = JSON.parse(proxyData.response);
      responseText = parseProviderResponse(provider, responseObj);
    } else {
      // Direct call from browser (CORS restrictions apply)
      const res = await originalFetch(targetUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reqBody)
      });

      if (!res.ok) {
        let errBody = "";
        try { errBody = await res.text(); } catch(e) {}
        throw new Error(`Provider API responded with status ${res.status}: ${errBody}`);
      }

      const responseObj = await res.json();
      responseText = parseProviderResponse(provider, responseObj);
    }

    return responseText;
  }

  // Parse model response output based on provider format
  function parseProviderResponse(provider, responseObj) {
    if (provider === "gemini") {
      if (responseObj.candidates && responseObj.candidates[0] && responseObj.candidates[0].content && responseObj.candidates[0].content.parts[0]) {
        return responseObj.candidates[0].content.parts[0].text;
      }
      throw new Error("Invalid response structure from Gemini: " + JSON.stringify(responseObj));
    } else if (provider === "openai" || provider === "ollama" || provider === "custom") {
      if (responseObj.choices && responseObj.choices[0] && responseObj.choices[0].message) {
        return responseObj.choices[0].message.content;
      }
      throw new Error("Invalid response structure from OpenAI/compatible: " + JSON.stringify(responseObj));
    } else if (provider === "anthropic") {
      if (responseObj.content && responseObj.content[0]) {
        return responseObj.content[0].text;
      }
      throw new Error("Invalid response structure from Anthropic: " + JSON.stringify(responseObj));
    }
    return "";
  }

  // Start initialization loop
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtensionUI);
  } else {
    initExtensionUI();
  }
})();
