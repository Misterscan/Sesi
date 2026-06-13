/* 
{
  "name": "Extension Manager",
  "version": "1.1.0",
  "author": "Sesi",
  "description": "Core system for managing and discovering Sesi Studio extensions.",
  "icon": "extensions/assets/Extension-Manager.svg",
  "commands": ["Refresh List", "Toggle Modal"]
}
*/
/* Sesi Studio: Core Extension Manager */
(function() {
  async function initExtensionManager() {
    const controls = document.querySelector('.controls');
    if (!controls) return;

    // 🧩 Add Extensions button to header (DEPRECATED: Now in Settings Hub)
    /*
    const extBtn = document.createElement('button');
    extBtn.className = 'btn';
    extBtn.textContent = '🧩 Extensions';
    extBtn.onclick = () => toggleExtensionModal();
    controls.appendChild(extBtn);
    */

    // 🪟 Create Management Modal (DEPRECATED: Now in Settings Hub)
    /*
    const modal = document.createElement('div');
    modal.id = 'extensionModal';
    ...
    */

    window.toggleExtensionModal = () => {
      const m = document.getElementById('extensionModal');
      m.style.display = m.style.display === 'none' ? 'flex' : 'none';
      if (m.style.display === 'flex') refreshExtensionList();
    };

    // Initial populate
    refreshSidebarExtensions();

    if (window.registerCommand) {
      window.registerCommand("Refresh List", () => refreshSidebarExtensions());
      window.registerCommand("Toggle Modal", () => window.toggleExtensionModal());
    }
  }

  window.refreshSidebarExtensions = async function() {
    const sidebar = document.getElementById('sidebarExtensions');
    if (!sidebar) {
      console.log('Sidebar Extensions container not found. Skipping refresh.');
      return;
    }

    try {
      const res = await fetch('/api/extensions');
      const items = await res.json();
      sidebar.innerHTML = '';

      const currentTheme = localStorage.getItem('sesi-studio-theme');

      items.forEach(item => {
        const isTheme = item.name.startsWith('themes/');
        const name = item.displayName || item.name.replace('themes/', '').replace('.css', '').replace('.js', '');
        const isActive = isTheme && currentTheme === item.name;

        const div = document.createElement('div');
        div.className = 'file-item';
        if (isActive) div.classList.add('active');
        div.style.flexDirection = 'column';
        div.style.alignItems = 'flex-start';
        div.style.gap = '2px';
        div.style.padding = '8px 12px';
        
        const defaultEmoji = isTheme ? '🎨' : item.type === 'js' ? '⚙️' : '📄';
        const iconValue = item.icon || defaultEmoji;
        let iconHtml = '';
        if (iconValue.includes('.') || iconValue.startsWith('http') || iconValue.startsWith('data:')) {
          const iconUrl = iconValue.includes('/') ? iconValue : `/extensions/${iconValue}`;
          iconHtml = `<img src="${iconUrl}" style="width: 14px; height: 14px; object-fit: contain; margin-right: 4px;">`;
        } else {
          iconHtml = `<span style="margin-right: 4px;">${iconValue}</span>`;
        }

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <div style="display: flex; align-items: center;">
              ${iconHtml}
              <span style="font-weight: bold; font-size: 11px;">${name}</span>
            </div>
            <span style="font-size: 9px; color: var(--silver-dark);">${item.version || '0.0.1'}</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${item.author ? `<span style="font-size: 9px; color: var(--accent-cyan);">by ${item.author}</span>` : ''}
            ${item.description ? `<div style="font-size: 9px; color: var(--silver-mid); line-height: 1.2; flex: 1;">${item.description}</div>` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            ${isTheme ? `<button onclick="window.applyThemeFromManager ? window.applyThemeFromManager('${item.name}') : alert('Theme Manager extension not loaded')" style="background:none; border:none; color:var(--accent-cyan); cursor:pointer; font-size:9px; padding:0;">Apply</button>` : ''}
            <button onclick="window.loadExtToEditor('${item.name}')" style="background:none; border:none; color:var(--silver-dark); cursor:pointer; font-size:9px; padding:0;">Edit</button>
          </div>
        `;
        sidebar.appendChild(div);
      });
    } catch (err) {
      sidebar.innerHTML = `<div style="padding:8px; font-size:10px; color:#ff5f56;">Error loading.</div>`;
    }
  };

  async function refreshExtensionList() {
    const listEl = document.getElementById('extensionList');
    try {
      const res = await fetch('/api/extensions');
      const items = await res.json();
      listEl.innerHTML = '';

      if (items.length === 0) {
        listEl.innerHTML = '<div style="color: var(--silver-dark);">No extensions found.</div>';
        return;
      }

      const currentTheme = localStorage.getItem('sesi-studio-theme');

      items.forEach(item => {
        const isTheme = item.name.startsWith('themes/');
        const name = item.name.replace('themes/', '');
        const card = document.createElement('div');
        
        let statusTag = '';
        if (isTheme && currentTheme === item.name) {
            statusTag = '<span style="color: var(--accent-green); font-size: 10px; margin-left: 8px;">● Active</span>';
        }

        card.style.cssText = `
          background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border);
          padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;
        `;
        card.innerHTML = `
          <div>
            <div style="font-weight: bold; color: var(--silver-light);">${name}${statusTag}</div>
            <div style="font-size: 11px; color: var(--silver-dark);">${isTheme ? '🎨 Theme' : item.type === 'js' ? '⚙️ Script' : '🎨 CSS Extension'}</div>
          </div>
          <div style="display: flex; gap: 8px;">
             ${isTheme ? `<button class="btn" style="font-size: 10px; border-color: var(--accent-green);" onclick="window.applyThemeFromManager ? window.applyThemeFromManager('${item.name}') : alert('Theme Manager extension not loaded')">Apply</button>` : ''}
             <button class="btn" style="font-size: 10px;" onclick="loadExtToEditor('${item.name}')">Edit Code</button>
          </div>
        `;
        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = `<div style="color: #ff5f56;">Error: ${err.message}</div>`;
    }
  }

  window.loadExtToEditor = async (path) => {
    try {
      const res = await fetch(`/api/file?path=sesi-studio/extensions/${path}`);
      const data = await res.json();
      const modal = document.getElementById('extensionModal');
      if (modal) modal.style.display = 'none';
      
      if (window.editor) {
        window.editor.setValue(data.content);
        window.activeFilePath = `sesi-studio/extensions/${path}`;
        const model = window.editor.getModel();
        const ext = path.split('.').pop();
        monaco.editor.setModelLanguage(model, ext === 'js' ? 'javascript' : 'css');
        updateTabBar();
      }
    } catch (err) {
      alert('Failed to load file: ' + err.message);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtensionManager);
  } else {
    initExtensionManager();
  }
})();
