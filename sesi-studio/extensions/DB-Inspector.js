/*
{
  "name": "DB Inspector",
  "version": "1.0.0",
  "author": "Sesi",
  "description": "Inspect and manage native Sesi databases (.db/.json).",
  "icon": "data:image/svg+xml;utf8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2224%22%20fill%3D%22%230D9488%22%2F%3E%3Cpath%20d%3D%22M30%2030%20C30%2020%2070%2020%2070%2030%20C70%2040%2030%2040%2030%2050%20C30%2060%2070%2060%2070%2070%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
  "commands": [
    "Inspect Current Database"
  ]
}
*/

(function() {
  let activeCollection = null;

  function initDBInspector() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) {
      setTimeout(initDBInspector, 500);
      return;
    }

    // 1. Inject Database Panel
    let sidebarDB = document.getElementById('sidebarDB');
    if (!sidebarDB) {
      sidebarDB = document.createElement('div');
      sidebarDB.id = 'sidebarDB';
      sidebarDB.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 12px; height: calc(100% - 35px); font-family: inherit;';
      
      sidebarDB.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; gap:6px;">
            <select id="db-selector" style="flex:1; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); color:#fff; border-radius:4px; padding:6px; font-size:11px; font-family:inherit; outline:none;"></select>
            <button id="db-refresh-btn-ui" style="background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:#fff; cursor:pointer; padding:6px 10px; border-radius:4px; font-size:11px; outline:none;" title="Refresh databases list">🔄</button>
          </div>
          <div id="db-password-container" style="display:none; flex-direction:column; gap:6px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#f87171; font-weight:bold;">Database is Encrypted</div>
            <input type="password" id="db-password-input" placeholder="Enter password" style="background:rgba(0,0,0,0.6); border:1px solid var(--glass-border); color:#fff; border-radius:4px; padding:6px; font-size:11px; font-family:inherit; outline:none;" />
            <button id="db-auth-btn" style="background:var(--accent-cyan); color:#000; border:none; padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; outline:none;">Unlock</button>
          </div>
        </div>
        <div id="db-schema-container" style="display:flex; flex-direction:column; gap:8px; flex:1; overflow-y:auto;">
          <div style="font-size:10px; color:var(--silver-dark); text-transform:uppercase; font-weight:bold; letter-spacing:0.05em;">Collections</div>
          <div id="db-collections-list" style="display:flex; flex-direction:column; gap:6px;"></div>
          
          <div id="db-query-section" style="display:none; flex-direction:column; gap:8px; margin-top:10px; border-top:1px solid var(--glass-border); padding-top:10px;">
            <div style="font-size:10px; color:var(--silver-dark); text-transform:uppercase; font-weight:bold; letter-spacing:0.05em;">Query (<span id="db-active-col-name" style="color:var(--accent-cyan);"></span>)</div>
            <textarea id="db-query-input" placeholder='Filter e.g. {"botId": "chef_luigi"}' style="background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); color:#fff; border-radius:4px; padding:6px; font-size:10px; font-family:monospace; min-height:45px; resize:vertical; outline:none;"></textarea>
            <div style="display:flex; gap:6px;">
              <button id="db-run-query-btn" style="flex:1; background:rgba(6,182,212,0.15); border:1px solid var(--accent-cyan); color:var(--accent-cyan); padding:6px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; outline:none;">Run Query</button>
              <button id="db-stream-query-btn" style="background:rgba(168,85,247,0.15); border:1px solid #a855f7; color:#c084fc; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; outline:none;" title="Stream formatted JSON query results directly to the Sesi Studio integrated terminal">Stream to Term</button>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
              <div style="font-size:10px; color:var(--silver-dark); text-transform:uppercase; font-weight:bold; letter-spacing:0.05em;">Documents</div>
              <button id="db-add-doc-btn" style="background:none; border:none; color:var(--accent-cyan); cursor:pointer; font-size:10px; font-family:inherit; font-weight:bold;">+ Add Document</button>
            </div>
            <div id="db-documents-list" style="display:flex; flex-direction:column; gap:6px; overflow-y:auto; padding-right:2px;"></div>
          </div>
        </div>
      `;

      sidebarHistory.parentElement.appendChild(sidebarDB);

      // Event Listeners
      document.getElementById('db-selector').onchange = onDatabaseSelected;
      document.getElementById('db-refresh-btn-ui').onclick = loadDatabases;
      document.getElementById('db-auth-btn').onclick = onDatabaseSelected;
      document.getElementById('db-run-query-btn').onclick = runQuery;
      document.getElementById('db-stream-query-btn').onclick = streamQueryToTerminal;
      document.getElementById('db-add-doc-btn').onclick = () => openDocumentEditor();
    }

    // 2. Start dynamic tab integration
    setInterval(ensureDatabaseTab, 500);

    // 3. Register command palette command
    if (window.registerCommand) {
      window.registerCommand("Inspect Current Database", inspectActiveFileAsDatabase);
    }

    // 4. Register Monaco context menu action
    registerMonacoAction();

    // 5. Initial load
    loadDatabases();
  }

  // Self-healing tab controller
  function ensureDatabaseTab() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) return;
    const historyParent = sidebarHistory.parentElement;
    const panelHeader = historyParent.querySelector('.panel-header');
    if (!panelHeader) return;

    let tabContainer = panelHeader.querySelector('.tab-container-dynamic');
    if (!tabContainer) {
      const origTitle = panelHeader.querySelector('.panel-title');
      if (origTitle && origTitle.id !== 'git-tab-timeline' && origTitle.id !== 'git-tab-git' && origTitle.id !== 'db-tab-database') {
        tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container-dynamic';
        tabContainer.style.cssText = 'display: flex; gap: 16px; align-items: center; height: 100%;';
        
        origTitle.id = 'git-tab-timeline';
        origTitle.style.cursor = 'pointer';
        origTitle.style.borderBottom = '2px solid var(--accent-cyan)';
        origTitle.style.paddingBottom = '4px';
        origTitle.onclick = () => selectTab('timeline');
        
        panelHeader.insertBefore(tabContainer, panelHeader.firstChild);
        tabContainer.appendChild(origTitle);
      } else if (origTitle && (origTitle.id === 'git-tab-timeline' || origTitle.id === 'git-tab-git')) {
        tabContainer = origTitle.parentElement;
      }
    }

    if (tabContainer && !document.getElementById('db-tab-database')) {
      const dbTab = document.createElement('span');
      dbTab.id = 'db-tab-database';
      dbTab.className = 'panel-title';
      dbTab.style.cssText = 'color: var(--silver-dark); cursor: pointer; padding-bottom: 4px;';
      dbTab.innerText = 'Database';
      dbTab.onclick = () => selectTab('database');
      tabContainer.appendChild(dbTab);
    }

    // Bind all existing tabs non-destructively
    const timelineTab = document.getElementById('git-tab-timeline') || (tabContainer && tabContainer.querySelector('.panel-title'));
    if (timelineTab && !timelineTab.dataset.wrappedByDB) {
      timelineTab.dataset.wrappedByDB = 'true';
      const prevClick = timelineTab.onclick;
      timelineTab.onclick = (e) => {
        selectTab('timeline');
        if (prevClick) prevClick.call(timelineTab, e);
      };
    }
    const gitTab = document.getElementById('git-tab-git');
    if (gitTab && !gitTab.dataset.wrappedByDB) {
      gitTab.dataset.wrappedByDB = 'true';
      const prevClick = gitTab.onclick;
      gitTab.onclick = (e) => {
        selectTab('git');
        if (prevClick) prevClick.call(gitTab, e);
      };
    }
  }

  // Switch active tabs
  function selectTab(tabName) {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) return;
    const parent = sidebarHistory.parentElement;
    
    // Hide all child elements of the parent container except header
    Array.from(parent.children).forEach(child => {
      if (!child.classList.contains('panel-header')) {
        child.style.display = 'none';
      }
    });

    const timelineTab = document.getElementById('git-tab-timeline') || document.querySelector('.panel-title');
    const gitTab = document.getElementById('git-tab-git');
    const dbTab = document.getElementById('db-tab-database');
    const profilerTab = document.getElementById('profiler-tab-profiler');
    
    // Reset styles
    [timelineTab, gitTab, dbTab, profilerTab].forEach(t => {
      if (t) {
        t.style.color = 'var(--silver-dark)';
        t.style.borderBottom = 'none';
      }
    });
    
    const panelIdMap = {
      timeline: 'sidebarHistory',
      git: 'sidebarGit',
      database: 'sidebarDB',
      profiler: 'sidebarProfiler'
    };
    
    const activePanelId = panelIdMap[tabName];
    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = (tabName === 'database' || tabName === 'profiler') ? 'flex' : 'block';
    }
    
    const activeTab = {
      timeline: timelineTab,
      git: gitTab,
      database: dbTab,
      profiler: profilerTab
    }[tabName];
    
    if (activeTab) {
      activeTab.style.color = '#fff';
      activeTab.style.borderBottom = `2px solid ${tabName === 'profiler' ? '#8b5cf6' : 'var(--accent-cyan)'}`;
    }

    const refreshBtn = document.getElementById('git-refresh-btn');
    if (refreshBtn) {
      refreshBtn.style.display = (tabName === 'git') ? 'inline-block' : 'none';
    }
    
    if (tabName === 'database') {
      loadDatabases();
    }
  }

  async function loadDatabases() {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_databases' })
      });
      const data = await res.json();
      const selector = document.getElementById('db-selector');
      const currentVal = selector.value;
      
      selector.innerHTML = '<option value="">-- Select Database --</option>';
      if (data.databases) {
        data.databases.forEach(db => {
          const opt = document.createElement('option');
          opt.value = db;
          opt.innerText = db;
          selector.appendChild(opt);
        });
      }
      if (currentVal) {
        selector.value = currentVal;
      }
    } catch (err) {
      console.error('Failed to list databases:', err);
    }
  }

  async function onDatabaseSelected() {
    const selector = document.getElementById('db-selector');
    const dbPath = selector.value;
    const pwdInput = document.getElementById('db-password-input');
    const pwdContainer = document.getElementById('db-password-container');
    const querySection = document.getElementById('db-query-section');
    
    pwdContainer.style.display = 'none';
    querySection.style.display = 'none';
    document.getElementById('db-collections-list').innerHTML = '';
    
    if (!dbPath) return;
    
    try {
      const schemaRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_schema', dbPath, password: pwdInput.value })
      });
      const schemaData = await schemaRes.json();
      
      if (schemaData.encrypted && !schemaData.authenticated) {
        pwdContainer.style.display = 'flex';
        return;
      }
      
      renderCollections(schemaData.collections);
    } catch (err) {
      document.getElementById('db-collections-list').innerHTML = `<div style="font-size:10px; color:#ff5f56; padding:4px;">Error: ${err.message}</div>`;
    }
  }

  function renderCollections(collections) {
    const list = document.getElementById('db-collections-list');
    list.innerHTML = '';
    if (!collections || collections.length === 0) {
      list.innerHTML = '<div style="font-size:10px; color:var(--silver-dark); padding:4px;">No collections found.</div>';
      return;
    }
    
    collections.forEach(col => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.style.cssText = 'padding:6px 8px; border-radius:4px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); cursor:pointer; font-size:11px; color:#fff; display:flex; justify-content:space-between; align-items:center;';
      div.innerHTML = `
        <span style="font-weight:bold;">📁 ${col.name}</span>
      `;
      div.onclick = () => {
        // Toggle active selection styling
        Array.from(list.children).forEach(c => c.style.borderColor = 'var(--glass-border)');
        div.style.borderColor = 'var(--accent-cyan)';
        selectCollection(col.name);
      };
      list.appendChild(div);
    });
  }

  function selectCollection(colName) {
    activeCollection = colName;
    document.getElementById('db-active-col-name').innerText = colName;
    document.getElementById('db-query-section').style.display = 'flex';
    runQuery();
  }

  async function runQuery() {
    const dbPath = document.getElementById('db-selector').value;
    const password = document.getElementById('db-password-input').value;
    const queryInput = document.getElementById('db-query-input').value;
    const docsList = document.getElementById('db-documents-list');
    
    docsList.innerHTML = '<div style="font-size:10px; color:var(--silver-dark);">Querying...</div>';
    
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_documents', dbPath, password, collection: activeCollection, query: queryInput })
      });
      const data = await res.json();
      renderDocuments(data.documents || []);
    } catch (err) {
      docsList.innerHTML = `<div style="font-size:10px; color:#ff5f56;">Error: ${err.message}</div>`;
    }
  }

  function renderDocuments(documents) {
    const docsList = document.getElementById('db-documents-list');
    docsList.innerHTML = '';
    if (documents.length === 0) {
      docsList.innerHTML = '<div style="font-size:10px; color:var(--silver-dark); padding:4px;">No documents found.</div>';
      return;
    }
    
    documents.forEach(doc => {
      const card = document.createElement('div');
      card.style.cssText = 'background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); padding:8px; border-radius:6px; display:flex; flex-direction:column; gap:4px; font-size:10px; position:relative;';
      
      const nonIdKeys = Object.keys(doc).filter(k => k !== '_id');
      const summaryItems = nonIdKeys.slice(0, 3).map(k => `<strong>${k}:</strong> ${JSON.stringify(doc[k])}`).join('<br>');
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px; margin-bottom:4px;">
          <span style="color:var(--accent-cyan); font-family:monospace; font-weight:bold;">ID: ${doc._id}</span>
          <div style="display:flex; gap:6px;">
            <button class="doc-edit-btn" style="background:none; border:none; color:var(--silver-light); cursor:pointer; font-size:10px; outline:none;" title="Edit Document">✏️</button>
            <button class="doc-del-btn" style="background:none; border:none; color:#ff5f56; cursor:pointer; font-size:10px; outline:none;" title="Delete Document">🗑️</button>
          </div>
        </div>
        <div style="color:var(--silver-mid); max-height:60px; overflow-y:auto; line-height:1.3; font-family:monospace;">
          ${summaryItems || '<span style="font-style:italic;">Empty document</span>'}
        </div>
      `;
      
      card.querySelector('.doc-edit-btn').onclick = () => openDocumentEditor(doc);
      
      card.querySelector('.doc-del-btn').onclick = async () => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        const dbPath = document.getElementById('db-selector').value;
        const password = document.getElementById('db-password-input').value;
        
        try {
          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_document', dbPath, password, collection: activeCollection, documentId: doc._id })
          });
          const resData = await res.json();
          if (resData.success) {
            runQuery();
          } else {
            alert('Delete failed: ' + resData.error);
          }
        } catch (err) {
          alert('Delete error: ' + err.message);
        }
      };
      
      docsList.appendChild(card);
    });
  }

  function openDocumentEditor(doc = null) {
    const isNew = !doc;
    const initialText = isNew ? '{\n  \n}' : JSON.stringify(doc, null, 2);
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; justify-content:center; align-items:center; z-index:99999;';
    
    overlay.innerHTML = `
      <div style="background:var(--bg-base); border:1px solid var(--glass-border); width:400px; padding:20px; border-radius:12px; display:flex; flex-direction:column; gap:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5); font-family:inherit;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:14px; color:#fff;">${isNew ? 'Add Document' : 'Edit Document'}</h3>
          <span class="close-overlay" style="cursor:pointer; color:var(--silver-dark); font-size:16px;">&times;</span>
        </div>
        <textarea id="overlay-doc-json" style="flex:1; min-height:220px; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); color:#fff; font-family:monospace; font-size:11px; padding:8px; border-radius:6px; resize:vertical; outline:none;"></textarea>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-secondary cancel-overlay" style="font-size:11px; padding:6px 12px; background:transparent; border:1px solid var(--glass-border); color:#fff; border-radius:4px; cursor:pointer;">Cancel</button>
          <button class="btn btn-primary save-overlay" style="font-size:11px; padding:6px 12px; background:var(--accent-cyan); color:#000; font-weight:bold; border:none; border-radius:4px; cursor:pointer;">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const textarea = overlay.querySelector('#overlay-doc-json');
    textarea.value = initialText;
    
    const close = () => {
      document.body.removeChild(overlay);
    };
    
    overlay.querySelector('.close-overlay').onclick = close;
    overlay.querySelector('.cancel-overlay').onclick = close;
    
    overlay.querySelector('.save-overlay').onclick = async () => {
      try {
        const parsedDoc = JSON.parse(textarea.value);
        if (!isNew && doc._id) {
          parsedDoc._id = doc._id;
        }
        
        const dbPath = document.getElementById('db-selector').value;
        const password = document.getElementById('db-password-input').value;
        
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_document', dbPath, password, collection: activeCollection, document: parsedDoc })
        });
        const resData = await res.json();
        
        if (resData.success) {
          close();
          runQuery();
        } else {
          alert('Save failed: ' + resData.error);
        }
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      }
    };
  }

  async function streamQueryToTerminal() {
    const dbPath = document.getElementById('db-selector').value;
    const password = document.getElementById('db-password-input').value;
    const queryInput = document.getElementById('db-query-input').value;
    
    if (!window.terminalSocket || window.terminalSocket.readyState !== WebSocket.OPEN) {
      alert('Integrated terminal WebSocket is not connected.');
      return;
    }
    
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_documents', dbPath, password, collection: activeCollection, query: queryInput })
      });
      const data = await res.json();
      const docs = data.documents || [];
      
      const header = `\r\n\x1b[35m[Sesi DB Explorer] Streamed ${docs.length} documents from ${activeCollection}:\x1b[0m\r\n`;
      const bodyText = JSON.stringify(docs, null, 2);
      const formattedBody = bodyText.split('\n').join('\r\n') + '\r\n';
      
      window.terminalSocket.send(JSON.stringify({
        type: 'terminal_write',
        data: header + formattedBody
      }));
    } catch (err) {
      alert('Failed to stream query results: ' + err.message);
    }
  }

  function inspectActiveFileAsDatabase() {
    if (!window.activeFilePath) {
      alert('No active file is open in the workspace.');
      return;
    }
    
    const path = window.activeFilePath;
    const filename = path.split('/').pop();
    const parts = filename.split('.');
    const ext = parts[parts.length - 1];
    
    if (ext !== 'db' && ext !== 'json') {
      alert(`File "${filename}" does not appear to be a Sesi Database (.db or .json).`);
      return;
    }
    
    const selector = document.getElementById('db-selector');
    
    let found = false;
    for (let i = 0; i < selector.options.length; i++) {
      if (selector.options[i].value === filename) {
        selector.value = filename;
        found = true;
        break;
      }
    }
    
    if (!found) {
      const opt = document.createElement('option');
      opt.value = filename;
      opt.innerText = filename;
      selector.appendChild(opt);
      selector.value = filename;
    }
    
    selectTab('database');
    onDatabaseSelected();
  }

  function registerMonacoAction() {
    if (window.editor) {
      try {
        window.editor.addAction({
          id: 'inspect-database-action',
          label: 'Inspect as Sesi Database',
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.5,
          run: function(ed) {
            inspectActiveFileAsDatabase();
          }
        });
        console.log('✓ Registered Monaco context menu action for Sesi DB Explorer');
      } catch (err) {
        console.error('Failed to register Monaco action:', err);
      }
    } else {
      setTimeout(registerMonacoAction, 500);
    }
  }

  initDBInspector();
})();
