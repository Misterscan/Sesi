/*
{
  "name": "Sesi AST Profiler",
  "version": "1.0.0",
  "author": "Sesi",
  "description": "Visualize Abstract Syntax Tree and profile active execution paths in Sesi Studio.",
  "icon": "data:image/svg+xml;utf8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2224%22%20fill%3D%22%238B5CF6%22%2F%3E%3Cpath%20d%3D%22M50%2080%20V50%20M50%2050%20L35%2035%20M50%2050%20L65%2035%20M35%2035%20L25%2035%20M65%2035%20L75%2035%20M50%2035%20V20%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%226%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
  "commands": [
    "Profile Active File"
  ]
}
*/

(function() {
  let activeTabMode = 'ast'; // 'ast' or 'trace'
  let currentAstData = null;
  let traceSteps = [];
  let currentStepIndex = -1;
  let monacoDecorations = [];
  let playInterval = null;

  function initProfiler() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) {
      setTimeout(initProfiler, 500);
      return;
    }

    // 1. Inject Style sheet
    injectStyles();

    // 2. Inject Profiler Panel
    let sidebarProfiler = document.getElementById('sidebarProfiler');
    if (!sidebarProfiler) {
      sidebarProfiler = document.createElement('div');
      sidebarProfiler.id = 'sidebarProfiler';
      sidebarProfiler.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 12px; height: calc(100% - 35px); font-family: inherit;';
      
      sidebarProfiler.innerHTML = `
        <!-- Control Header -->
        <div style="display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); padding:10px; border-radius:8px;">
          <div style="display:flex; gap:6px;">
            <button id="profiler-run-btn" class="profiler-btn" style="flex:1; background:rgba(139,92,246,0.15); border:1px solid #8b5cf6; color:#c084fc; font-weight:bold;" title="Profile execution of active file">⚡ Profile Script</button>
            <button id="profiler-refresh-btn" class="profiler-btn" style="background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:#fff;" title="Parse and reload AST">🔄 AST</button>
          </div>
          
          <!-- Stepper Controls (Show when profiled) -->
          <div id="profiler-stepper" style="display:none; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px; margin-top:4px;">
            <div style="font-size:10px; color:var(--silver-dark); font-weight:bold;">Step: <span id="profiler-step-info" style="color:#c084fc;">0/0</span></div>
            <div style="display:flex; gap:6px;">
              <button id="profiler-step-prev" class="profiler-small-btn" title="Previous Step">◀</button>
              <button id="profiler-step-play" class="profiler-small-btn" title="Auto Play">▶ Play</button>
              <button id="profiler-step-next" class="profiler-small-btn" title="Next Step">▶</button>
              <button id="profiler-step-reset" class="profiler-small-btn" title="Reset Trace">⏹</button>
            </div>
          </div>
        </div>

        <!-- Tab selection within Profiler -->
        <div style="display:flex; border-bottom:1px solid var(--glass-border); font-size:11px;">
          <div id="profiler-subtab-ast" class="profiler-subtab active" style="flex:1; text-align:center; padding:6px; cursor:pointer;">AST Tree</div>
          <div id="profiler-subtab-trace" class="profiler-subtab" style="flex:1; text-align:center; padding:6px; cursor:pointer;">Execution Trace</div>
        </div>

        <!-- Panel Contents -->
        <div id="profiler-ast-container" style="flex:1; overflow-y:auto; display:block;">
          <div id="profiler-ast-tree" class="ast-tree-root"></div>
        </div>

        <div id="profiler-trace-container" style="flex:1; overflow-y:auto; display:none; flex-direction:column; gap:10px;">
          <div id="profiler-trace-list" style="display:flex; flex-direction:column; gap:6px; flex:1; overflow-y:auto;">
            <div style="font-size:11px; color:var(--silver-dark); font-style:italic; padding:12px; text-align:center;">No profile trace run yet. Click "Profile Script" to capture execution.</div>
          </div>
          <div style="height:100px; display:flex; flex-direction:column; border-top:1px solid var(--glass-border); background:rgba(0,0,0,0.2); border-radius:6px; overflow:hidden;">
            <div style="font-size:10px; color:var(--silver-dark); text-transform:uppercase; font-weight:bold; padding:6px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">Console Output</div>
            <pre id="profiler-console-output" style="margin:0; padding:6px; flex:1; overflow-y:auto; font-family:monospace; font-size:10px; color:#fff; white-space:pre-wrap;"></pre>
          </div>
        </div>
      `;

      sidebarHistory.parentElement.appendChild(sidebarProfiler);

      // Bind actions
      document.getElementById('profiler-run-btn').onclick = profileActiveScript;
      document.getElementById('profiler-refresh-btn').onclick = refreshAST;
      document.getElementById('profiler-subtab-ast').onclick = () => switchSubTab('ast');
      document.getElementById('profiler-subtab-trace').onclick = () => switchSubTab('trace');
      
      document.getElementById('profiler-step-prev').onclick = stepPrev;
      document.getElementById('profiler-step-next').onclick = stepNext;
      document.getElementById('profiler-step-play').onclick = togglePlay;
      document.getElementById('profiler-step-reset').onclick = resetTrace;
    }

    // 3. Start dynamic tab integration
    setInterval(ensureProfilerTab, 500);

    // 4. Register command palette command
    if (window.registerCommand) {
      window.registerCommand("Profile Active File", profileActiveScript);
    }

    // 5. Register Monaco Context Menu
    registerMonacoAction();

    // 6. Initial Load
    refreshAST();
  }

  function injectStyles() {
    if (document.getElementById('profiler-styles')) return;
    const style = document.createElement('style');
    style.id = 'profiler-styles';
    style.innerHTML = `
      .profiler-btn {
        padding: 6px 12px;
        border-radius: 4px;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        outline: none;
        transition: all 0.2s ease;
      }
      .profiler-btn:hover {
        filter: brightness(1.2);
      }
      .profiler-small-btn {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--glass-border);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
        font-family: inherit;
      }
      .profiler-small-btn:hover {
        background: rgba(255,255,255,0.1);
      }
      .profiler-subtab {
        border-bottom: 2px solid transparent;
        color: var(--silver-dark);
        font-weight: bold;
        transition: all 0.2s ease;
      }
      .profiler-subtab:hover {
        color: #fff;
      }
      .profiler-subtab.active {
        color: #fff;
        border-bottom-color: #8b5cf6;
      }
      
      /* AST Tree Styles */
      .ast-tree-root {
        font-family: 'Fira Code', monospace;
        font-size: 11px;
        color: var(--silver-mid);
        padding-left: 2px;
        line-height: 1.5;
      }
      .ast-node {
        display: flex;
        flex-direction: column;
        margin-left: 12px;
        border-left: 1px dashed rgba(255, 255, 255, 0.08);
        padding-left: 6px;
      }
      .ast-node-header {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        transition: background-color 0.1s ease;
      }
      .ast-node-header:hover {
        background: rgba(255,255,255,0.03);
      }
      .ast-node-toggle {
        font-size: 9px;
        color: var(--silver-dark);
        width: 10px;
        text-align: center;
      }
      .ast-node-type {
        font-weight: bold;
      }
      .ast-node-loc {
        color: var(--silver-dark);
        font-size: 9px;
      }
      
      /* Coloring for AST nodes */
      .ast-type-statement { color: #22d3ee; } /* Cyan */
      .ast-type-expression { color: #f472b6; } /* Pink */
      .ast-type-literal { color: #fb923c; } /* Orange */
      .ast-type-identifier { color: #c084fc; } /* Purple */
      
      /* Trace step items */
      .trace-item {
        background: rgba(255,255,255,0.01);
        border: 1px solid var(--glass-border);
        border-radius: 6px;
        padding: 8px;
        font-family: monospace;
        font-size: 10px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s ease;
      }
      .trace-item:hover {
        border-color: #8b5cf6;
        background: rgba(139,92,246,0.03);
      }
      .trace-item.active {
        border-color: #a855f7;
        background: rgba(139,92,246,0.1);
        box-shadow: 0 0 8px rgba(139,92,246,0.2);
      }
      
      /* Monaco editor highlight */
      .ast-profiler-active-line {
        background: rgba(139, 92, 246, 0.18) !important;
        border-left: 3px solid #a855f7 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureProfilerTab() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) return;
    const historyParent = sidebarHistory.parentElement;
    const panelHeader = historyParent.querySelector('.panel-header');
    if (!panelHeader) return;

    let tabContainer = panelHeader.querySelector('.tab-container-dynamic');
    if (!tabContainer) {
      const origTitle = panelHeader.querySelector('.panel-title');
      if (origTitle && origTitle.id !== 'git-tab-timeline' && origTitle.id !== 'git-tab-git' && origTitle.id !== 'db-tab-database' && origTitle.id !== 'profiler-tab-profiler') {
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

    if (tabContainer && !document.getElementById('profiler-tab-profiler')) {
      const profilerTab = document.createElement('span');
      profilerTab.id = 'profiler-tab-profiler';
      profilerTab.className = 'panel-title';
      profilerTab.style.cssText = 'color: var(--silver-dark); cursor: pointer; padding-bottom: 4px;';
      profilerTab.innerText = 'Profiler';
      profilerTab.onclick = () => selectTab('profiler');
      tabContainer.appendChild(profilerTab);
    }

    // Wrap existing tabs non-destructively
    const timelineTab = document.getElementById('git-tab-timeline') || (tabContainer && tabContainer.querySelector('.panel-title'));
    if (timelineTab && !timelineTab.dataset.wrappedByProfiler) {
      timelineTab.dataset.wrappedByProfiler = 'true';
      const prevClick = timelineTab.onclick;
      timelineTab.onclick = (e) => {
        selectTab('timeline');
        if (prevClick) prevClick.call(timelineTab, e);
      };
    }

    const gitTab = document.getElementById('git-tab-git');
    if (gitTab && !gitTab.dataset.wrappedByProfiler) {
      gitTab.dataset.wrappedByProfiler = 'true';
      const prevClick = gitTab.onclick;
      gitTab.onclick = (e) => {
        selectTab('git');
        if (prevClick) prevClick.call(gitTab, e);
      };
    }

    const dbTab = document.getElementById('db-tab-database');
    if (dbTab && !dbTab.dataset.wrappedByProfiler) {
      dbTab.dataset.wrappedByProfiler = 'true';
      const prevClick = dbTab.onclick;
      dbTab.onclick = (e) => {
        selectTab('database');
        if (prevClick) prevClick.call(dbTab, e);
      };
    }
  }

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
      activePanel.style.display = (tabName === 'profiler' || tabName === 'database') ? 'flex' : 'block';
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

    if (tabName === 'profiler') {
      refreshAST();
    }
  }


  function switchSubTab(mode) {
    activeTabMode = mode;
    
    const astSubtab = document.getElementById('profiler-subtab-ast');
    const traceSubtab = document.getElementById('profiler-subtab-trace');
    const astContainer = document.getElementById('profiler-ast-container');
    const traceContainer = document.getElementById('profiler-trace-container');
    
    if (mode === 'ast') {
      astSubtab.classList.add('active');
      traceSubtab.classList.remove('active');
      astContainer.style.display = 'block';
      traceContainer.style.display = 'none';
    } else {
      astSubtab.classList.remove('active');
      traceSubtab.classList.add('active');
      astContainer.style.display = 'none';
      traceContainer.style.display = 'flex';
    }
  }

  // --- AST Parsing and Display ---
  async function refreshAST() {
    if (!window.editor) return;
    const code = window.editor.getValue();
    const tree = document.getElementById('profiler-ast-tree');
    tree.innerHTML = '<div style="font-size:10px; color:var(--silver-dark); padding:12px;">Parsing AST...</div>';
    
    try {
      const res = await fetch('/api/ast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: code })
      });
      const data = await res.json();
      if (data.success && data.ast) {
        currentAstData = data.ast;
        tree.innerHTML = '';
        renderAST(data.ast, tree);
      } else {
        tree.innerHTML = `<div style="font-size:10px; color:#ff5f56; padding:12px; white-space:pre-wrap;">${data.error || 'Parsing error'}</div>`;
      }
    } catch (err) {
      tree.innerHTML = `<div style="font-size:10px; color:#ff5f56; padding:12px;">Fetch error: ${err.message}</div>`;
    }
  }

  function renderAST(ast, parentElement) {
    const rootNode = createASTDOMNode('Program', ast, true);
    parentElement.appendChild(rootNode);
  }

  function getNodeStyleClass(type) {
    if (type.endsWith('Statement') || type === 'Program') return 'ast-type-statement';
    if (type.endsWith('Expression')) return 'ast-type-expression';
    if (type === 'Literal') return 'ast-type-literal';
    if (type === 'Identifier') return 'ast-type-identifier';
    return '';
  }

  function createASTDOMNode(key, value, isRoot = false) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'ast-node';
    if (isRoot) nodeEl.style.marginLeft = '0px';

    const header = document.createElement('div');
    header.className = 'ast-node-header';

    const toggle = document.createElement('span');
    toggle.className = 'ast-node-toggle';
    toggle.innerText = ' ';

    const label = document.createElement('span');
    let typeName = value.type || (Array.isArray(value) ? 'Array' : 'Object');
    label.className = `ast-node-type ${getNodeStyleClass(typeName)}`;
    
    let labelText = key === 'Program' ? 'Program' : `${key}: ${typeName}`;
    
    // Add extra useful details directly in label
    if (value.type === 'LetStatement' && value.name) {
      labelText += ` (name: "${value.name.lexeme || value.name}")`;
    } else if (value.type === 'ConstStatement' && value.name) {
      labelText += ` (name: "${value.name.lexeme || value.name}")`;
    } else if (value.type === 'Identifier') {
      labelText += ` (name: "${value.lexeme || value.name}")`;
    } else if (value.type === 'Literal') {
      labelText += ` (value: ${JSON.stringify(value.value)})`;
    } else if (value.type === 'BinaryExpression') {
      labelText += ` (operator: "${value.operator}")`;
    } else if (value.type === 'FunctionStatement' && value.name) {
      labelText += ` (name: "${value.name.lexeme || value.name}")`;
    }

    label.innerText = labelText;
    
    header.appendChild(toggle);
    header.appendChild(label);

    // Location detail and highlight handler
    if (value.line !== undefined) {
      const loc = document.createElement('span');
      loc.className = 'ast-node-loc';
      loc.innerText = `[${value.line}:${value.column || 1}]`;
      header.appendChild(loc);

      header.onclick = (e) => {
        e.stopPropagation();
        highlightEditorLine(value.line, value.column || 1);
      };
    }

    nodeEl.appendChild(header);

    const childrenContainer = document.createElement('div');
    childrenContainer.style.display = 'block';
    nodeEl.appendChild(childrenContainer);

    let hasChildren = false;
    const childrenKeys = Object.keys(value).filter(k => k !== 'type' && k !== 'line' && k !== 'column' && k !== 'lexeme');

    for (const ck of childrenKeys) {
      const childVal = value[ck];
      if (childVal && typeof childVal === 'object') {
        hasChildren = true;
        if (Array.isArray(childVal)) {
          childVal.forEach((item, index) => {
            if (item && typeof item === 'object') {
              const itemNode = createASTDOMNode(`${ck}[${index}]`, item);
              childrenContainer.appendChild(itemNode);
            }
          });
        } else {
          const itemNode = createASTDOMNode(ck, childVal);
          childrenContainer.appendChild(itemNode);
        }
      }
    }

    if (hasChildren) {
      toggle.innerText = '▼';
      toggle.style.cursor = 'pointer';
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (childrenContainer.style.display === 'none') {
          childrenContainer.style.display = 'block';
          toggle.innerText = '▼';
        } else {
          childrenContainer.style.display = 'none';
          toggle.innerText = '▶';
        }
      };
    }

    return nodeEl;
  }

  function highlightEditorLine(line, col = 1) {
    if (!window.editor) return;
    
    // Position cursor
    window.editor.setPosition({ lineNumber: line, column: col });
    window.editor.revealLineInCenter(line);
    window.editor.focus();

    // Flash background highlight
    monacoDecorations = window.editor.deltaDecorations(monacoDecorations, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'ast-profiler-active-line'
        }
      }
    ]);
  }

  // --- Profiling & Execution Stepping ---
  async function profileActiveScript() {
    if (!window.editor) return;
    const code = window.editor.getValue();
    
    // Reset play states
    resetTrace();
    switchSubTab('trace');
    
    const traceList = document.getElementById('profiler-trace-list');
    traceList.innerHTML = '<div style="font-size:11px; color:var(--silver-dark); padding:12px; text-align:center;">Profiling script execution...</div>';
    document.getElementById('profiler-console-output').innerText = '';

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: code })
      });
      const data = await res.json();
      
      parseProfilerOutput(data.output || '');
    } catch (err) {
      traceList.innerHTML = `<div style="font-size:11px; color:#ff5f56; padding:12px; text-align:center;">Profiling failed: ${err.message}</div>`;
    }
  }

  function parseProfilerOutput(output) {
    const lines = output.split('\n');
    traceSteps = [];
    let consoleLines = [];
    
    lines.forEach(line => {
      const debugMatch = line.match(/^\[DEBUG\] Executing (\w+) line (\d+)/);
      if (debugMatch) {
        traceSteps.push({
          type: debugMatch[1],
          line: parseInt(debugMatch[2])
        });
      } else {
        // Collect console print output
        consoleLines.push(line);
      }
    });

    document.getElementById('profiler-console-output').innerText = consoleLines.join('\n');
    
    const traceList = document.getElementById('profiler-trace-list');
    traceList.innerHTML = '';
    
    if (traceSteps.length === 0) {
      traceList.innerHTML = '<div style="font-size:11px; color:var(--silver-dark); padding:12px; text-align:center;">Script completed with no execution steps logged. Make sure code contains executable statements.</div>';
      document.getElementById('profiler-stepper').style.display = 'none';
      return;
    }

    // Render step items
    traceSteps.forEach((step, idx) => {
      const item = document.createElement('div');
      item.id = `trace-step-${idx}`;
      item.className = 'trace-item';
      item.innerHTML = `
        <span style="font-weight:bold; color:#a855f7;">#${idx + 1}</span>
        <span class="${getNodeStyleClass(step.type)}">${step.type}</span>
        <span style="color:var(--silver-dark);">Line ${step.line}</span>
      `;
      item.onclick = () => selectStep(idx);
      traceList.appendChild(item);
    });

    // Show stepper controls
    document.getElementById('profiler-stepper').style.display = 'flex';
    selectStep(0);
  }

  function selectStep(index) {
    if (index < 0 || index >= traceSteps.length) return;
    
    // De-select previous item
    const prevItem = document.getElementById(`trace-step-${currentStepIndex}`);
    if (prevItem) prevItem.classList.remove('active');
    
    currentStepIndex = index;
    
    // Select new item
    const newItem = document.getElementById(`trace-step-${currentStepIndex}`);
    if (newItem) {
      newItem.classList.add('active');
      newItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    
    // Update step info label
    document.getElementById('profiler-step-info').innerText = `${currentStepIndex + 1}/${traceSteps.length}`;
    
    // Highlight in editor
    const step = traceSteps[currentStepIndex];
    highlightEditorLine(step.line);
  }

  function stepNext() {
    if (currentStepIndex < traceSteps.length - 1) {
      selectStep(currentStepIndex + 1);
    } else {
      // Loop or stop
      if (playInterval) togglePlay();
    }
  }

  function stepPrev() {
    if (currentStepIndex > 0) {
      selectStep(currentStepIndex - 1);
    }
  }

  function togglePlay() {
    const playBtn = document.getElementById('profiler-step-play');
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.innerText = '▶ Play';
      playBtn.style.background = 'rgba(255,255,255,0.05)';
      playBtn.style.color = '#fff';
    } else {
      playBtn.innerText = '⏸ Pause';
      playBtn.style.background = 'rgba(168,85,247,0.2)';
      playBtn.style.color = '#c084fc';
      playInterval = setInterval(stepNext, 600);
    }
  }

  function resetTrace() {
    if (playInterval) togglePlay();
    currentStepIndex = -1;
    document.getElementById('profiler-step-info').innerText = `0/${traceSteps.length}`;
    
    // Clear monaco highlights
    if (window.editor) {
      monacoDecorations = window.editor.deltaDecorations(monacoDecorations, []);
    }
    
    // Remove active styles
    Array.from(document.querySelectorAll('.trace-item')).forEach(item => {
      item.classList.remove('active');
    });
  }

  function registerMonacoAction() {
    if (window.editor) {
      try {
        window.editor.addAction({
          id: 'profile-sesi-ast-action',
          label: 'Profile with Sesi AST',
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.6,
          run: function(ed) {
            selectTab('profiler');
            profileActiveScript();
          }
        });
        console.log('✓ Registered Monaco context menu action for Sesi AST Profiler');
      } catch (err) {
        console.error('Failed to register Monaco action:', err);
      }
    } else {
      setTimeout(registerMonacoAction, 500);
    }
  }

  initProfiler();
})();
