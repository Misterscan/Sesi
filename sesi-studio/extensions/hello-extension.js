console.log("🚀 Sesi Studio: Hello Extension loaded successfully!");

// Wait for Monaco Editor to be fully loaded and initialized
function initExtension() {
  if (window.editor && window.monaco) {
    window.editor.addAction({
      id: 'say-hello',
      label: 'Sesi: Say Hello',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyH
      ],
      precondition: null,
      keybindingContext: null,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: function(ed) {
        alert("Hello from Sesi Studio Extension!");
      }
    });
    console.log("✓ Registered 'Sesi: Say Hello' Action (Shift+Cmd+H)");
  } else {
    // Retry if editor is not quite ready
    setTimeout(initExtension, 100);
  }
}

initExtension();
