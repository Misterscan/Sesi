/* 
{
  "name": "Theme Manager",
  "version": "1.0.0",
  "author": "Sesi",
  "description": "Handles theme switching and synchronization with the Monaco editor.",
  "icon": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%0D%0A%20%20%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2220%22%20fill%3D%22%231e1e1e%22%2F%3E%0D%0A%20%20%3Cpath%20d%3D%22M50%2025a25%2025%200%200%201%200%2050V25z%22%20fill%3D%22%23ffffff%22%2F%3E%0D%0A%20%20%3Cpath%20d%3D%22M50%2025a25%2025%200%200%200%200%2050V25z%22%20fill%3D%22%23444444%22%2F%3E%0D%0A%20%20%3Cpath%20d%3D%22M82%2050c0-17.7-14.3-32-32-32M18%2050c0%2017.7%2014.3%2032%2032%2032%22%20fill%3D%22none%22%20stroke%3D%22%233794ff%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%2F%3E%0D%0A%20%20%3Cpath%20d%3D%22M72%2018h10v10M28%2082h-10v-10%22%20fill%3D%22none%22%20stroke%3D%22%233794ff%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%0D%0A%3C%2Fsvg%3E",
  "commands": ["Switch Theme"]
}
*/
/* Sesi Studio Extension: Theme Manager */
(function() {
  const THEME_STORAGE_KEY = 'sesi-studio-theme';
  
  async function initThemeManager() {
    try {
      const res = await fetch('/api/extensions');
      if (!res.ok) return;
      const list = await res.json();
      const cssThemes = list.filter(item => item.type === 'css' && item.name.startsWith('themes/'));
      
      if (cssThemes.length === 0) return;

      // Create Dropdown UI (DEPRECATED: Now in Settings Hub)
      /*
      const select = document.createElement('select');
      select.className = 'btn';
      ...
      controls.appendChild(select);
      */

      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        // if (select) select.value = savedTheme;
        applyTheme(savedTheme);
      } else {
        applyTheme('');
      }

      /*
      select.onchange = () => {
        const selected = select.value;
        window.applyThemeFromManager(selected);
      };
      */

      if (window.registerCommand) {
        window.registerCommand("Switch Theme", () => {
          if (window.toggleSettingsModal) {
            const m = document.getElementById('settingsModal');
            if (!m || m.style.display !== 'flex') {
              window.toggleSettingsModal();
            }
            setTimeout(() => {
              const tabEl = Array.from(document.querySelectorAll('.settings-tab')).find(el => el.textContent.includes('Appearance'));
              if (tabEl && window.switchSettingsTab) {
                window.switchSettingsTab('appearance', tabEl);
              }
            }, 50);
          }
        });
      }
    } catch (err) {
      console.error('Theme Manager error:', err);
    }
  }

  window.applyThemeFromManager = (themeName) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    const select = document.querySelector('select.btn');
    if (select) select.value = themeName;
    applyTheme(themeName);
    if (window.refreshSidebarExtensions) window.refreshSidebarExtensions();
  };

  function applyTheme(themeName) {
    const existingThemes = document.querySelectorAll('link[data-extension], link[data-is-theme="true"]');
    existingThemes.forEach(el => {
      const extName = el.getAttribute('data-extension');
      if ((extName && extName.startsWith('themes/')) || el.getAttribute('data-is-theme') === 'true') {
        el.remove();
      }
    });

    if (!themeName) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/extensions/${themeName}`;
    link.setAttribute('data-is-theme', 'true');
    document.head.appendChild(link);
    console.log(`🎨 Applied theme: ${themeName}`);

    // Synchronize with Monaco Editor
    if (window.monaco && themeName.includes('classic')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '00e5ff', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: 'f59e0b', fontStyle: 'bold' },
          { token: 'constant', foreground: '00e5ff', fontStyle: 'bold' },
          { token: 'builtin', foreground: '3b82f6', fontStyle: 'bold' },
          { token: 'identifier', foreground: 'e2e8f0' },
          { token: 'string', foreground: '39ff14' },
          { token: 'string.quote', foreground: '39ff14' },
          { token: 'string.escape', foreground: '00e5ff' },
          { token: 'comment', foreground: '475569', fontStyle: 'italic' },
          { token: 'number', foreground: '0077ff' },
          { token: 'number.float', foreground: '0077ff' },
          { token: 'operator', foreground: '94a3b8' },
          { token: 'delimiter', foreground: '94a3b8' },
          { token: 'bracket', foreground: '94a3b8' },
          { token: 'tag', foreground: '00e5ff', fontStyle: 'bold' },
          { token: 'attribute.name', foreground: 'f59e0b' },
          { token: 'delimiter.bracket', foreground: '94a3b8' },
        ],
        colors: {
          'editor.background': '#070e1b',
          'editor.foreground': '#e2e8f0',
          'editorCursor.foreground': '#00e5ff',
          'editor.lineHighlightBackground': '#0f172a',
          'editorLineNumber.foreground': '#475569',
          'editorLineNumber.activeForeground': '#00e5ff',
          'editorIndentGuide.background': '#1e293b',
          'editorIndentGuide.activeBackground': '#00e5ff',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && themeName.includes('blueprint')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: '99ccff' },
          { token: 'constant', foreground: '00ffcc' },
          { token: 'builtin', foreground: 'ffffff', fontStyle: 'bold' },
          { token: 'string', foreground: 'aaccff' },
          { token: 'comment', foreground: '5588cc', fontStyle: 'italic' },
          { token: 'number', foreground: '00ffcc' },
        ],
        colors: {
          'editor.background': '#002244',
          'editor.foreground': '#ffffff',
          'editorCursor.foreground': '#ffffff',
          'editor.lineHighlightBackground': '#003366',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && themeName.includes('brutalist')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: 'ffffff', fontStyle: 'bold' },
          { token: 'constant', foreground: 'ffff00' },
          { token: 'builtin', foreground: 'ffffff', fontStyle: 'bold' },
          { token: 'string', foreground: '00ff00' },
          { token: 'comment', foreground: 'cccccc', fontStyle: 'italic' },
          { token: 'number', foreground: 'ffff00' },
        ],
        colors: {
          'editor.background': '#000000',
          'editor.foreground': '#ffffff',
          'editorCursor.foreground': '#ffffff',
          'editor.lineHighlightBackground': '#1a1a1a',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && themeName.includes('industrial')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'ff6b00', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: 'e0e0e0' },
          { token: 'constant', foreground: '3d5afe' },
          { token: 'builtin', foreground: 'ff6b00' },
          { token: 'string', foreground: '4caf50' },
          { token: 'comment', foreground: '616161' },
          { token: 'number', foreground: '3d5afe' },
        ],
        colors: {
          'editor.background': '#1a1a1a',
          'editor.foreground': '#e0e0e0',
          'editorCursor.foreground': '#ff6b00',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && themeName.includes('minimalist')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '000000', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: '444444' },
          { token: 'constant', foreground: '0000ff' },
          { token: 'string', foreground: '008000' },
          { token: 'comment', foreground: '888888' },
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000',
          'editorCursor.foreground': '#000000',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && themeName.includes('vintage')) {
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'c2c572', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: 'c2c572' },
          { token: 'constant', foreground: 'c2c572', fontStyle: 'bold' },
          { token: 'string', foreground: 'c2c572' },
          { token: 'comment', foreground: '5c5e38' },
        ],
        colors: {
          'editor.background': '#1a1b12',
          'editor.foreground': '#c2c572',
          'editorCursor.foreground': '#c2c572',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    } else if (window.monaco && !themeName) {
      // Restore default Sesi theme
      monaco.editor.defineTheme('sesi-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '8b5cf6', fontStyle: 'bold' },
          { token: 'typeKeyword', foreground: 'f59e0b', fontStyle: 'bold' },
          { token: 'constant', foreground: 'ef4444' },
          { token: 'builtin', foreground: '3b82f6', fontStyle: 'bold' },
          { token: 'identifier', foreground: 'f3f4f6' },
          { token: 'string', foreground: '10b981' },
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'number', foreground: 'ec4899' },
          { token: 'operator', foreground: '9ca3af' },
          { token: 'tag', foreground: '8b5cf6', fontStyle: 'bold' },
          { token: 'attribute.name', foreground: 'f59e0b' },
          { token: 'delimiter.bracket', foreground: '9ca3af' },
        ],
        colors: {
          'editor.background': '#0f1012',
          'editor.foreground': '#f3f4f6',
          'editorCursor.foreground': '#8b5cf6',
          'editor.lineHighlightBackground': '#161719',
          'editorLineNumber.foreground': '#4b5563',
          'editorLineNumber.activeForeground': '#9ca3af',
        }
      });
      monaco.editor.setTheme('sesi-theme');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeManager);
  } else {
    initThemeManager();
  }
})();
