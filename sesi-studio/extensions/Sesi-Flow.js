/*
{
  "name": "Sesi Flow",
  "version": "1.0.0",
  "author": "Sesi",
  "description": "Visualizes script workflows, concurrency graphs, and execution pipelines in real-time.",
  "icon": "data:image/svg+xml;utf8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2224%22%20fill%3D%22%23E0F2FE%22%2F%3E%3Cpath%20d%3D%22M50%2020%20L50%2080%20M30%2040%20L50%2020%20L70%2040%20M30%2060%20L50%2080%20L70%2060%22%20fill%3D%22none%22%20stroke%3D%22%230284C7%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E",
  "commands": [
    "Sesi Flow: Visualize Current Script"
  ]
}
*/

(function() {
  let isSimulating = false;
  let simulationTimeout = null;

  function initSesiFlow() {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) {
      setTimeout(initSesiFlow, 500);
      return;
    }

    const historyParent = sidebarHistory.parentElement;
    const panelHeader = historyParent.querySelector('.panel-header');
    if (!panelHeader) return;

    // 1. Create/Resolve Dynamic Tab Container
    let tabContainer = panelHeader.querySelector('.tab-container-dynamic');
    if (!tabContainer) {
      const origTitle = panelHeader.querySelector('.panel-title');
      if (origTitle && origTitle.id !== 'git-tab-timeline' && origTitle.id !== 'git-tab-git' && origTitle.id !== 'db-tab-database' && origTitle.id !== 'profiler-tab-profiler' && origTitle.id !== 'api-tab-workbench' && origTitle.id !== 'flow-tab-chart') {
        tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container-dynamic';
        tabContainer.style.cssText = 'display: flex; gap: 16px; align-items: center; height: 100%;';
        origTitle.id = 'git-tab-timeline';
        origTitle.style.cssText = 'color: #fff; cursor: pointer; border-bottom: 2px solid var(--accent-cyan); padding-bottom: 4px;';
        
        panelHeader.insertBefore(tabContainer, panelHeader.firstChild);
        tabContainer.appendChild(origTitle);
      } else if (origTitle) {
        tabContainer = origTitle.parentElement;
      }
    }

    // 2. Add Flow tab
    if (tabContainer && !document.getElementById('flow-tab-chart')) {
      const flowTab = document.createElement('span');
      flowTab.id = 'flow-tab-chart';
      flowTab.className = 'panel-title';
      flowTab.style.cssText = 'color: var(--silver-dark); cursor: pointer; padding-bottom: 4px; font-weight: bold; transition: color 0.15s ease;';
      flowTab.innerText = 'Flow';
      flowTab.onclick = () => selectTab('flow');
      tabContainer.appendChild(flowTab);
    }

    // 3. Create Sidebar Panel
    let sidebarFlow = document.getElementById('sidebarFlow');
    if (!sidebarFlow) {
      sidebarFlow = document.createElement('div');
      sidebarFlow.id = 'sidebarFlow';
      sidebarFlow.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 12px; font-size: 11px; color: var(--silver-mid); height: calc(100% - 36px); box-sizing: border-box;';
      
      sidebarFlow.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; margin-bottom: 4px;">
          <span style="font-weight: bold; color: var(--accent-cyan);">Workflow Pipeline</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button id="flow-btn-play" title="Simulate step-by-step workflow execution" style="background: none; border: none; color: #10b981; cursor: pointer; font-size: 12px; padding: 2px;">▶</button>
            <button id="flow-btn-refresh" title="Refresh Flow Graph" style="background: none; border: none; color: var(--accent-cyan); cursor: pointer; font-size: 12px; padding: 2px;">⟳</button>
          </div>
        </div>
        <div id="flow-nodes-container" style="display: flex; flex-direction: column; align-items: center; gap: 0; position: relative; width: 100%; flex: 1; overflow-y: auto; padding-top: 8px;"></div>
      `;

      historyParent.appendChild(sidebarFlow);

      // Event bindings
      document.getElementById('flow-btn-refresh').onclick = renderFlowchart;
      document.getElementById('flow-btn-play').onclick = toggleSimulation;
    }

    // 4. Wrap other tabs non-destructively for highlight synchronization
    const allTabIds = ['git-tab-timeline', 'git-tab-git', 'db-tab-database', 'profiler-tab-profiler', 'api-tab-workbench', 'flow-tab-chart'];
    allTabIds.forEach(id => {
      const tab = document.getElementById(id);
      if (tab && !tab.dataset.wrappedByFlow) {
        tab.dataset.wrappedByFlow = 'true';
        const prevClick = tab.onclick;
        tab.onclick = (e) => {
          if (prevClick) prevClick.call(tab, e);
          updateTabHighlight(id === 'flow-tab-chart' ? 'flow' : id.split('-')[2] || id.split('-')[1]);
        };
      }
    });
  }

  // 5. Tab Highlighter & Show/Hide logic
  function selectTab(tabName) {
    const sidebarHistory = document.getElementById('sidebarHistory');
    if (!sidebarHistory) return;
    const parent = sidebarHistory.parentElement;
    
    // Hide all panels
    Array.from(parent.children).forEach(child => {
      if (!child.classList.contains('panel-header')) {
        child.style.display = 'none';
      }
    });

    const activePanelId = {
      timeline: 'sidebarHistory',
      git: 'sidebarGit',
      database: 'sidebarDB',
      profiler: 'sidebarProfiler',
      api: 'sidebarAPI',
      flow: 'sidebarFlow'
    }[tabName];

    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = (tabName === 'database' || tabName === 'profiler' || tabName === 'api' || tabName === 'flow') ? 'flex' : 'block';
    }

    updateTabHighlight(tabName);

    if (tabName === 'flow') {
      renderFlowchart();
    } else {
      stopSimulation();
    }
  }

  function updateTabHighlight(tabName) {
    const tlTab = document.getElementById('git-tab-timeline') || document.querySelector('.panel-title');
    const gTab = document.getElementById('git-tab-git');
    const dTab = document.getElementById('db-tab-database');
    const pTab = document.getElementById('profiler-tab-profiler');
    const aTab = document.getElementById('api-tab-workbench');
    const fTab = document.getElementById('flow-tab-chart');

    [tlTab, gTab, dTab, pTab, aTab, fTab].forEach(t => {
      if (t) {
        t.style.color = 'var(--silver-dark)';
        t.style.borderBottom = 'none';
      }
    });

    const activeTab = {
      timeline: tlTab,
      git: gTab,
      database: dTab,
      profiler: pTab,
      api: aTab,
      flow: fTab
    }[tabName];

    if (activeTab) {
      activeTab.style.color = '#fff';
      activeTab.style.borderBottom = '2px solid var(--accent-cyan)';
    }

    // Toggle panels visibility
    const panelIdMap = {
      timeline: 'sidebarHistory',
      git: 'sidebarGit',
      database: 'sidebarDB',
      profiler: 'sidebarProfiler',
      api: 'sidebarAPI',
      flow: 'sidebarFlow'
    };

    Object.keys(panelIdMap).forEach(key => {
      const el = document.getElementById(panelIdMap[key]);
      if (el) {
        el.style.display = (key === tabName) ? ((key === 'database' || key === 'profiler' || key === 'api' || key === 'flow') ? 'flex' : 'block') : 'none';
      }
    });

    // Refresh button toggle
    const refreshBtn = document.getElementById('git-refresh-btn');
    if (refreshBtn) {
      refreshBtn.style.display = (tabName === 'git') ? 'inline-block' : 'none';
    }
  }

  // 6. AST/Regex Code Parsing
  function parseWorkflow() {
    if (!window.editor) return [];
    const code = window.editor.getValue();
    const steps = [];
    const lines = code.split('\n');

    const patterns = [
      { regex: /exec\s*\(/, type: 'exec', label: 'Execute Shell', icon: '💻', color: '#38bdf8' },
      { regex: /spawn\s*\(/, type: 'spawn', label: 'Spawn Process', icon: '🚀', color: '#c084fc' },
      { regex: /workflow\s*\(/, type: 'workflow', label: 'Workflow Pipeline', icon: '⛓️', color: '#a855f7' },
      { regex: /web_get\s*\(|web_send\s*\(/, type: 'web', label: 'HTTP API Call', icon: '🌐', color: '#06b6d4' },
      { regex: /read_file\s*\(|write_file\s*\(/, type: 'file', label: 'File I/O', icon: '💾', color: '#f59e0b' },
      { regex: /make_dir\s*\(|list_dir\s*\(/, type: 'file', label: 'Dir Operation', icon: '📁', color: '#f59e0b' },
      { regex: /db\s*\(/, type: 'db', label: 'Database Access', icon: '🗄️', color: '#10b981' }
    ];

    lines.forEach((line, index) => {
      patterns.forEach(p => {
        if (p.regex.test(line)) {
          let detail = '';
          const match = line.match(/["']([^"']+)["']/);
          if (match) {
            detail = match[1];
          }
          steps.push({
            type: p.type,
            label: p.label,
            detail: detail ? detail : p.label,
            line: index + 1,
            icon: p.icon,
            color: p.color
          });
        }
      });
    });

    return steps;
  }

  // 7. Interactive Flow Render
  function renderFlowchart() {
    const container = document.getElementById('flow-nodes-container');
    if (!container) return;

    const steps = parseWorkflow();
    if (steps.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px 8px; text-align: center; color: var(--silver-dark); display: flex; flex-direction: column; gap: 10px; align-items: center; width: 100%;">
          <div style="font-size: 24px;">🌫️</div>
          <div>No process primitives detected in active file.</div>
          <div style="font-size: 9px; line-height: 1.4; max-width: 180px;">Use spawn(), exec(), web_get(), or write_file() in your script to chart its execution pipeline.</div>
        </div>
      `;
      return;
    }

    let html = '';
    
    // Start Node
    html += createNodeMarkup({
      id: 'flow-node-start',
      icon: '🟢',
      title: 'Script Start',
      subtitle: 'Entry Point',
      color: '#10b981',
      isStart: true
    });

    steps.forEach((step, idx) => {
      // Flow Connector Line
      html += createFlowLineMarkup(idx === 0 ? 'flow-node-start' : `flow-node-${idx - 1}`, `flow-node-${idx}`);

      // Step Node
      html += createNodeMarkup({
        id: `flow-node-${idx}`,
        icon: step.icon,
        title: step.label,
        subtitle: step.detail,
        color: step.color,
        line: step.line
      });
    });

    // End Node
    html += createFlowLineMarkup(`flow-node-${steps.length - 1}`, 'flow-node-end');
    html += createNodeMarkup({
      id: 'flow-node-end',
      icon: '🏁',
      title: 'Script End',
      subtitle: 'Exit Code 0',
      color: '#ef4444',
      isEnd: true
    });

    container.innerHTML = html;

    // Attach click events to jump to Monaco lines
    steps.forEach((step, idx) => {
      const el = document.getElementById(`flow-node-${idx}`);
      if (el) {
        el.onclick = () => {
          highlightMonacoLine(step.line);
        };
      }
    });
  }

  function createNodeMarkup(node) {
    const borderStyle = node.isStart || node.isEnd ? `border: 1px dashed ${node.color};` : `border: 1px solid var(--glass-border); border-left: 3px solid ${node.color};`;
    const cursorStyle = node.line ? 'cursor: pointer;' : '';
    
    return `
      <div id="${node.id}" class="flow-node-card" style="width: 90%; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-sizing: border-box; ${borderStyle} ${cursorStyle}" title="${node.line ? 'Click to jump to line ' + node.line : ''}">
        <span style="font-size: 14px; flex-shrink: 0;">${node.icon}</span>
        <div style="overflow: hidden; flex: 1;">
          <div style="font-weight: bold; color: #fff; font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${node.title}</div>
          <div style="font-size: 9px; color: var(--silver-dark); overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${node.subtitle}</div>
        </div>
      </div>
    `;
  }

  function createFlowLineMarkup(fromId, toId) {
    // Elegant marching-ants connecting flow line
    return `
      <div style="height: 18px; width: 2px; background: rgba(255,255,255,0.1); position: relative; margin: 2px 0;">
        <div class="flow-line-pulse" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, transparent, var(--accent-cyan), transparent); animation: flowPulse 1.2s infinite linear;"></div>
      </div>
    `;
  }

  function highlightMonacoLine(line) {
    if (!window.editor) return;
    window.editor.revealLineInCenter(line);
    window.editor.setPosition({ lineNumber: line, column: 1 });
    window.editor.focus();
  }

  // 8. Simulation Step-Through
  function toggleSimulation() {
    if (isSimulating) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }

  function startSimulation() {
    const steps = parseWorkflow();
    if (steps.length === 0) return;

    isSimulating = true;
    const playBtn = document.getElementById('flow-btn-play');
    if (playBtn) {
      playBtn.innerText = '⏹';
      playBtn.style.color = '#ef4444';
    }

    let currentStepIdx = 0;

    function runNextStep() {
      if (!isSimulating) return;

      // Deselect all nodes
      const allCards = document.querySelectorAll('.flow-node-card');
      allCards.forEach(c => {
        c.style.background = 'rgba(0,0,0,0.4)';
        c.style.boxShadow = 'none';
      });

      // Highlight Start
      if (currentStepIdx === 0) {
        const startNode = document.getElementById('flow-node-start');
        if (startNode) {
          startNode.style.background = 'rgba(16, 185, 129, 0.15)';
          startNode.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.3)';
        }
      }

      const activeCard = document.getElementById(`flow-node-${currentStepIdx}`);
      if (activeCard) {
        const step = steps[currentStepIdx];
        activeCard.style.background = 'rgba(0, 229, 255, 0.1)';
        activeCard.style.boxShadow = `0 0 8px ${step.color}44`;
        highlightMonacoLine(step.line);
        currentStepIdx++;
        simulationTimeout = setTimeout(runNextStep, 1500);
      } else {
        // Highlight End
        const endNode = document.getElementById('flow-node-end');
        if (endNode) {
          endNode.style.background = 'rgba(239, 68, 68, 0.15)';
          endNode.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.3)';
        }
        simulationTimeout = setTimeout(stopSimulation, 1500);
      }
    }

    runNextStep();
  }

  function stopSimulation() {
    isSimulating = false;
    clearTimeout(simulationTimeout);
    const playBtn = document.getElementById('flow-btn-play');
    if (playBtn) {
      playBtn.innerText = '▶';
      playBtn.style.color = '#10b981';
    }
    // Clear active highlights
    const allCards = document.querySelectorAll('.flow-node-card');
    allCards.forEach(c => {
      c.style.background = 'rgba(0,0,0,0.4)';
      c.style.boxShadow = 'none';
    });
  }

  // Inject animation keyframes dynamically
  if (!document.getElementById('flow-styles')) {
    const style = document.createElement('style');
    style.id = 'flow-styles';
    style.innerHTML = `
      @keyframes flowPulse {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
      .flow-node-card:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,0.02) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
  }

  // Self-healing check and periodic registration
  setInterval(initSesiFlow, 1000);

  // Command palette registration
  if (window.registerCommand) {
    window.registerCommand("Sesi Flow: Visualize Current Script", () => {
      const flowTab = document.getElementById('flow-tab-chart');
      if (flowTab) flowTab.click();
    });
  }

  console.log("✓ Sesi Flow extension loaded!");
})();
