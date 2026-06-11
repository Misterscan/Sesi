/* 
{
  "name": "Word Counter",
  "version": "1.0.0",
  "description": "Adds a 'Count' button to the header to analyze your script.",
  "icon": "📊",
  "commands": ["Count Words"]
}
*/

(function() {
  function initWordCounter() {
    // Wait for the UI controls to be available in the header
    const controls = document.querySelector('.controls');
    if (!controls) {
      setTimeout(initWordCounter, 500);
      return;
    }

    // Create the button
    const countBtn = document.createElement('button');
    countBtn.className = 'btn';
    countBtn.style.marginLeft = '8px';
    countBtn.innerHTML = '📊 Count';
    
    countBtn.onclick = () => {
      if (!window.editor) return;
      
      const text = window.editor.getValue();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      
      // You can output to an alert, or even write directly to the integrated terminal
      if (window.terminal) {
        window.terminal.write(`\r\n\x1b[36m[Word Counter]\x1b[0m ${words} words, ${chars} characters.\r\n`);
      } else {
        alert(`Words: ${words}\nCharacters: ${chars}`);
      }
    };

    controls.appendChild(countBtn);
    console.log("✓ Word Counter extension loaded!");
  }

  initWordCounter();
})();