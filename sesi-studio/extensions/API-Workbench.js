/*
{
  "name": "API Workbench",
  "version": "1.0.0",
  "author": "Sesi",
  "description": "An integrated HTTP sandbox to test APIs and generate Sesi web_get/web_send code.",
  "icon": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8cmVjdCB4PSIxNSIgeT0iMTUiIHdpZHRoPSI3MCIgaGVpZ2h0PSI3NSIgcng9IjgiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iIzFlMjkzYiIgc3Ryb2tlLXdpZHRoPSI2Ii8+CiAgPHBhdGggZD0iTTM4IDE1IEwzOCAxMCBRMzggNiA0MiA2IEw1OCA2IFE2MiA2IDYyIDEwIEw2MiAxNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWUyOTNiIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0zMiA1MiBMNDQgNjQgTDY4IDM2IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMGI5ODEiIHN0cm9rZS13aWR0aD0iMTAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxyZWN0IHg9IjMwIiB5PSI3OCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQiIHJ4PSIyIiBmaWxsPSIjZTJlOGYwIi8+Cjwvc3ZnPg==",
  "commands": [
    "API: Open Workbench"
  ]
}
*/

(function() {
  let headers = [
      { key: 'Accept', value: 'application/json' }
    ];
  function initAPIExtension() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) {
      setTimeout(initAPIExtension, 500);
      return;
    }

    const historyParent = sidebarHistory.parentElement;
    const panelHeader = historyParent.querySelector('.panel-header');
    if (!panelHeader) return;

    // 1. Create or resolve dynamic tab container in panel-header
    let tabContainer = panelHeader.querySelector('.tab-container-dynamic');
    if (!tabContainer) {
      const origTitle = panelHeader.querySelector('.panel-title');
      if (origTitle && origTitle.id !== 'git-tab-timeline' && origTitle.id !== 'git-tab-git' && origTitle.id !== 'db-tab-database' && origTitle.id !== 'profiler-tab-profiler') {
        tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container-dynamic';
        tabContainer.style.cssText = 'display: flex; gap: 16px; align-items: center; height: 100%;';
        origTitle.id = 'git-tab-timeline';
        origTitle.style.cssText = 'color: #fff; cursor: pointer; border-bottom: 2px solid var(--accent-cyan); padding-bottom: 4px;';
        
        panelHeader.insertBefore(tabContainer, panelHeader.firstChild);
        tabContainer.appendChild(origTitle);
      } else if (origTitle && (origTitle.id === 'git-tab-timeline' || origTitle.id === 'git-tab-git')) {
        tabContainer = origTitle.parentElement;
      }
    }

    // 2. Add API tab
    let apiTab = document.getElementById('api-tab-workbench');
    if (tabContainer && !apiTab) {
      apiTab = document.createElement('span');
      apiTab.id = 'api-tab-workbench';
      apiTab.className = 'panel-title';
      apiTab.style.cssText = 'color: var(--silver-dark); cursor: pointer; padding-bottom: 4px; font-weight: bold; transition: color 0.15s ease;';
      apiTab.innerText = 'API';
      tabContainer.appendChild(apiTab);
    }
    
    // ALWAYS re-bind the click handler so it doesn't go stale
    if (apiTab) {
      apiTab.onclick = () => selectTab('api');
    }

    // 3. Create the API Workbench Panel inside sidebar
    let sidebarAPI = document.getElementById('sidebarAPI');
    if (!sidebarAPI) {
      sidebarAPI = document.createElement('div');
      sidebarAPI.id = 'sidebarAPI';
      sidebarAPI.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 12px; font-size: 11px; color: var(--silver-mid);';
      
      // Inject the rich, responsive sidebar content
      sidebarAPI.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
          
          <!-- Method & URL -->
          <div style="display: flex; gap: 6px; align-items: center;">
            <select id="api-method" style="padding: 6px; font-size: 11px; font-weight: bold; cursor: pointer; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; outline: none; font-family: inherit;">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input type="text" id="api-url" placeholder="https://api.example.com/get" style="flex: 1; padding: 6px; font-size: 11px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; outline: none; font-family: inherit; min-width: 0;" value="https://httpbin.org/get">
          </div>

          <!-- Headers Section -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: bold; font-size: 9px; color: var(--silver-mid); text-transform: uppercase; letter-spacing: 0.5px;">Headers</span>
              <select id="api-content-type" style="padding: 2px 4px; font-size: 9px; width: auto; border-radius: 4px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; outline: none; font-family: inherit; cursor: pointer;">
                <option value="none">Set Content-Type...</option>
                <option value="json">application/json</option>
                <option value="text">text/plain</option>
                <option value="form">x-www-form-urlencoded</option>
              </select>
            </div>
            <div id="api-headers-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; margin-bottom: 6px; padding-right: 2px;"></div>
            <button id="api-add-header-btn" class="btn" style="width: 100%; padding: 4px; font-size: 10px; background: rgba(255,255,255,0.02); border: 1px dashed var(--glass-border); color: var(--silver-mid); border-radius: 4px; cursor: pointer;">+ Add Header</button>
          </div>

          <!-- Body Section -->
          <div id="api-body-section" style="display: none;">
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 9px; color: var(--silver-mid); text-transform: uppercase; letter-spacing: 0.5px;">Body</div>
            <textarea id="api-body" placeholder='{ "hello": "world" }' style="width: 100%; height: 60px; font-family: monospace; font-size: 10px; padding: 6px; box-sizing: border-box; resize: vertical; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; outline: none;"></textarea>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 8px;">
            <button id="api-send-btn" class="btn" style="flex: 1; padding: 8px; font-size: 11px; font-weight: bold; background: rgba(0, 229, 255, 0.08); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); border-radius: 4px; cursor: pointer;">⚡ Send Request</button>
            <button id="api-gen-btn" class="btn" style="flex: 1; padding: 8px; font-size: 11px; font-weight: bold; background: rgba(139, 92, 246, 0.08); border: 1px solid #8b5cf6; color: #c084fc; border-radius: 4px; cursor: pointer;">✨ Generate Code</button>
          </div>

          <!-- Response Area -->
          <div style="flex: 1; display: flex; flex-direction: column; min-height: 150px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
            <div id="api-response-info" style="display: none; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 10px;">
              <span>Status: <strong id="api-resp-status" style="color: var(--accent-green);">200 OK</strong></span>
              <span id="api-resp-time" style="color: var(--silver-dark);">Time: 0ms</span>
            </div>
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 9px; color: var(--silver-mid); text-transform: uppercase; letter-spacing: 0.5px;">Response Body</div>
            <textarea id="api-response-body" readonly placeholder="Response content will display here..." style="width: 100%; flex: 1; font-family: monospace; font-size: 10px; padding: 6px; box-sizing: border-box; resize: vertical; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: var(--silver-light); border-radius: 4px; outline: none;"></textarea>
          </div>

          <!-- Generated Code Section -->
          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-weight: bold; font-size: 9px; color: var(--silver-mid); text-transform: uppercase; letter-spacing: 0.5px;">Generated Sesi Code</div>
            <pre id="api-generated-code" style="background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 4px; padding: 6px; color: var(--accent-cyan); font-size: 10px; font-family: monospace; margin: 0; min-height: 36px; white-space: pre-wrap; word-break: break-all; max-height: 80px; overflow-y: auto;"></pre>
            <div style="display: flex; gap: 6px;">
              <button id="api-insert-code-btn" class="btn" style="flex: 1; padding: 4px; font-size: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--silver-light); border-radius: 4px; cursor: pointer;">Insert at Cursor</button>
              <button id="api-copy-code-btn" class="btn" style="padding: 4px 10px; font-size: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--silver-light); border-radius: 4px; cursor: pointer;">Copy</button>
            </div>
          </div>

        </div>
      `;
      historyParent.appendChild(sidebarAPI);
    }

    // 4. Styles Injection
    let apiStyles = document.getElementById('api-styles');
    if (!apiStyles) {
      apiStyles = document.createElement('style');
      apiStyles.id = 'api-styles';
      apiStyles.innerHTML = `
        #sidebarAPI select:focus, #sidebarAPI input:focus, #sidebarAPI textarea:focus {
          border-color: var(--accent-cyan) !important;
          box-shadow: 0 0 8px rgba(0, 229, 255, 0.15) !important;
        }
        #sidebarAPI .btn {
          transition: all 0.15s ease;
        }
        #sidebarAPI .btn:hover {
          transform: translateY(-1px);
        }
        #api-send-btn:hover {
          background: rgba(0, 229, 255, 0.15) !important;
          box-shadow: 0 4px 12px rgba(0, 229, 255, 0.15);
        }
        #api-gen-btn:hover {
          background: rgba(139, 92, 246, 0.15) !important;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15) !important;
        }
        #api-headers-list div {
          animation: apiRowFadeIn 0.2s ease-out;
        }
        @keyframes apiRowFadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(apiStyles);
    }

    // 5. Wrap existing tabs non-destructively for self-healing
    const timelineTab = document.getElementById('git-tab-timeline') || (tabContainer && tabContainer.querySelector('.panel-title'));
    if (timelineTab && !timelineTab.dataset.wrappedByAPI) {
      timelineTab.dataset.wrappedByAPI = 'true';
      const prevClick = timelineTab.onclick;
      timelineTab.onclick = (e) => {
        selectTab('timeline');
        if (prevClick) prevClick.call(timelineTab, e);
      };
    }
    const gitTab = document.getElementById('git-tab-git');
    if (gitTab && !gitTab.dataset.wrappedByAPI) {
      gitTab.dataset.wrappedByAPI = 'true';
      const prevClick = gitTab.onclick;
      gitTab.onclick = (e) => {
        selectTab('git');
        if (prevClick) prevClick.call(gitTab, e);
      };
    }
    const dbTab = document.getElementById('db-tab-database');
    if (dbTab && !dbTab.dataset.wrappedByAPI) {
      dbTab.dataset.wrappedByAPI = 'true';
      const prevClick = dbTab.onclick;
      dbTab.onclick = (e) => {
        selectTab('database');
        if (prevClick) prevClick.call(dbTab, e);
      };
    }
    const profilerTab = document.getElementById('profiler-tab-profiler');
    if (profilerTab && !profilerTab.dataset.wrappedByAPI) {
      profilerTab.dataset.wrappedByAPI = 'true';
      const prevClick = profilerTab.onclick;
      profilerTab.onclick = (e) => {
        selectTab('profiler');
        if (prevClick) prevClick.call(profilerTab, e);
      };
    }

    // Only initialize headers and events if we just created the sidebar
    if (!sidebarAPI.dataset.initialized) {
      sidebarAPI.dataset.initialized = 'true';

    // 6. Headers & Body Logic
    function renderHeaders() {
      const list = document.getElementById('api-headers-list');
      if (!list) return;
      list.innerHTML = '';
      
      headers.forEach((h, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 4px; align-items: center;';
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Key';
        keyInput.value = h.key;
        keyInput.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; font-size: 10px; padding: 4px; outline: none; flex: 1; font-family: inherit; min-width: 0; border-radius: 4px;';
        keyInput.oninput = (e) => {
          headers[index].key = e.target.value;
        };

        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        valInput.value = h.value;
        valInput.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; font-size: 10px; padding: 4px; outline: none; flex: 1; font-family: inherit; min-width: 0; border-radius: 4px;';
        valInput.oninput = (e) => {
          headers[index].value = e.target.value;
        };

        const delBtn = document.createElement('button');
        delBtn.innerText = '×';
        delBtn.style.cssText = 'background: none; border: none; color: #ff5f56; font-size: 14px; font-weight: bold; cursor: pointer; padding: 0 4px;';
        delBtn.onclick = () => {
          headers.splice(index, 1);
          renderHeaders();
          generateSesiCode();
        };

        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    }

    // Initialize list
    renderHeaders();

    // Hook events
    const methodSelect = document.getElementById('api-method');
    const bodySection = document.getElementById('api-body-section');
    methodSelect.onchange = () => {
      if (methodSelect.value === 'GET') {
        bodySection.style.display = 'none';
      } else {
        bodySection.style.display = 'block';
      }
      generateSesiCode();
    };

    document.getElementById('api-content-type').onchange = (e) => {
      const val = e.target.value;
      headers = headers.filter(h => h.key.toLowerCase() !== 'content-type');
      if (val === 'json') {
        headers.push({ key: 'Content-Type', value: 'application/json' });
      } else if (val === 'text') {
        headers.push({ key: 'Content-Type', value: 'text/plain' });
      } else if (val === 'form') {
        headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
      }
      renderHeaders();
      generateSesiCode();
    };

    document.getElementById('api-add-header-btn').onclick = () => {
      headers.push({ key: '', value: '' });
      renderHeaders();
    };

    // Code Gen Logic
    function generateSesiCode() {
      const method = methodSelect.value;
      const url = document.getElementById('api-url').value.trim() || 'https://api.example.com';
      const body = document.getElementById('api-body').value;
      const activeHeaders = headers.filter(h => h.key.trim() !== '');
      
      let headersStr = '';
      if (activeHeaders.length > 0) {
        const pairs = activeHeaders.map(h => `"${h.key}": "${h.value.replace(/"/g, '\\"')}"`);
        headersStr = `{${pairs.join(', ')}}`;
      } else {
        headersStr = '{}';
      }

      let code = '';
      if (method === 'GET') {
        code = `let response = web_get("${url}", ${headersStr})\nprint response`;
      } else {
        const escapedBody = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        code = `let payload = "${escapedBody}"\nlet response = web_send("${url}", payload, ${headersStr})\nprint response`;
      }

      const codePre = document.getElementById('api-generated-code');
      if (codePre) {
        codePre.innerText = code;
      }
      return code;
    }

    document.getElementById('api-url').oninput = generateSesiCode;
    document.getElementById('api-body').oninput = generateSesiCode;
    document.getElementById('api-gen-btn').onclick = generateSesiCode;

    // Send Logic
    document.getElementById('api-send-btn').onclick = async () => {
      const method = methodSelect.value;
      const url = document.getElementById('api-url').value.trim();
      const body = document.getElementById('api-body').value;
      const sendBtn = document.getElementById('api-send-btn');
      const infoDiv = document.getElementById('api-response-info');
      const respStatus = document.getElementById('api-resp-status');
      const respTime = document.getElementById('api-resp-time');
      const respBody = document.getElementById('api-response-body');

      if (!url) {
        alert('Please enter a URL.');
        return;
      }

      sendBtn.disabled = true;
      sendBtn.innerText = '⏳ Sending...';
      respBody.value = 'Sending request via Sesi Backend Proxy...';
      infoDiv.style.display = 'none';

      const headersObj = {};
      headers.filter(h => h.key.trim() !== '').forEach(h => {
        headersObj[h.key] = h.value;
      });

      const startTime = Date.now();

      try {
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url,
            method,
            headers: headersObj,
            body: method === 'GET' ? null : body
          })
        });

        const elapsed = Date.now() - startTime;
        sendBtn.disabled = false;
        sendBtn.innerText = '⚡ Send Request';

        const data = await res.json();
        infoDiv.style.display = 'flex';
        respTime.innerText = `Time: ${elapsed}ms`;

        if (res.ok && data.success) {
          respStatus.innerText = '200 OK';
          respStatus.style.color = 'var(--accent-green)';
          
          try {
            const parsed = JSON.parse(data.response);
            respBody.value = JSON.stringify(parsed, null, 2);
          } catch (e) {
            respBody.value = data.response;
          }
        } else {
          respStatus.innerText = 'Error';
          respStatus.style.color = '#ff5f56';
          respBody.value = data.error || 'Request failed';
        }
      } catch (err) {
        sendBtn.disabled = false;
        sendBtn.innerText = '⚡ Send Request';
        infoDiv.style.display = 'flex';
        respStatus.innerText = 'Network Error';
        respStatus.style.color = '#ff5f56';
        respTime.innerText = `Time: ${Date.now() - startTime}ms`;
        respBody.value = err.message;
      }
      
      generateSesiCode();
    };

    document.getElementById('api-insert-code-btn').onclick = () => {
      const code = generateSesiCode();
      if (window.editor) {
        const selection = window.editor.getSelection();
        const range = new monaco.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn
        );
        const op = {
          identifier: { major: 1, minor: 1 },
          range: range,
          text: code,
          forceMoveMarkers: true
        };
        window.editor.executeEdits("api-workbench", [op]);
        window.editor.focus();
      } else {
        alert('No active editor open.');
      }
    };

    document.getElementById('api-copy-code-btn').onclick = () => {
      const code = generateSesiCode();
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('api-copy-code-btn');
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = 'Copy'; }, 1500);
      });
    };

    // Initial code generation
    generateSesiCode();
    } // <-- CLOSE THE IF STATEMENT HERE, right before "// 7. Tab Selection Logic"

    // 7. Tab Selection Logic
    function selectTab(tabName) {
      const parent = sidebarHistory.parentElement;
      
      // Hide all child elements of parent except header
      Array.from(parent.children).forEach(child => {
        if (!child.classList.contains('panel-header')) {
          child.style.display = 'none';
        }
      });

      const tlTab = document.getElementById('git-tab-timeline') || tabContainer.querySelector('.panel-title');
      const gTab = document.getElementById('git-tab-git');
      const dTab = document.getElementById('db-tab-database');
      const pTab = document.getElementById('profiler-tab-profiler');
      const aTab = document.getElementById('api-tab-workbench');
      
      // Reset active tab styles
      [tlTab, gTab, dTab, pTab, aTab].forEach(t => {
        if (t) {
          t.style.color = 'var(--silver-dark)';
          t.style.borderBottom = 'none';
        }
      });
      
      const panelIdMap = {
        timeline: 'sidebarHistory',
        git: 'sidebarGit',
        database: 'sidebarDB',
        profiler: 'sidebarProfiler',
        api: 'sidebarAPI'
      };
      
      const activePanelId = panelIdMap[tabName];
      const activePanel = document.getElementById(activePanelId);
      if (activePanel) {
        // Force the display property with !important to override any IDE native hiding
        activePanel.style.setProperty('display', (tabName === 'database' || tabName === 'profiler' || tabName === 'api') ? 'flex' : 'block', 'important');
      }
      
      const activeTab = {
        timeline: tlTab,
        git: gTab,
        database: dTab,
        profiler: pTab,
        api: aTab
      }[tabName];
      
      if (activeTab) {
        activeTab.style.color = '#fff';
        activeTab.style.borderBottom = '2px solid var(--accent-cyan)';
      }

      const refreshBtn = document.getElementById('git-refresh-btn');
      if (refreshBtn) {
        refreshBtn.style.display = (tabName === 'git') ? 'inline-block' : 'none';
      }
    }
  }

  // Self-healing check to make sure tab remains present
  setInterval(initAPIExtension, 1000);

  // Command palette registration
  if (window.registerCommand) {
    window.registerCommand("API: Open Workbench", () => {
      const apiTab = document.getElementById('api-tab-workbench');
      if (apiTab) apiTab.click();
    });
  }

  console.log("✓ API Workbench extension loaded!");
})();
