/*
{
  "name": "Media Viewer",
  "version": "1.0.0",
  "author": "Sesi Studio",
  "description": "Preview photos and play video and audio from your workspace or local files.",
  "icon": "🎞️",
  "commands": ["Media: Open Viewer", "Media: Open Local Files..."]
}
*/
(function () {
  'use strict';
  window.sesiMediaViewer?.dispose();

  const formats = {
    image: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon' },
    video: { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' },
    audio: { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
      opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac' }
  };
  const commandNames = ['Media: Open Viewer', 'Media: Open Local Files...'];
  const listeners = new AbortController();
  let dialog, style, launcher, originalOpenFile, wrappedOpenFile, retryTimer;
  let mediaRequest, folderRequest, objectUrl, media, previousFocus;
  let entries = [], index = -1, folder = '', zoom = null, disposed = false;
  const $ = id => dialog.querySelector(`[data-media="${id}"]`);
  const normalized = path => String(path || '').replace(/\\/g, '/');
  const parentPath = path => normalized(path).replace(/\/+$/, '').replace(/\/?[^/]+$/, '') || (normalized(path).startsWith('/') ? '/' : '.');
  const nameOf = path => normalized(path).split('/').pop() || path;

  function formatFor(name, mime = '') {
    const ext = String(name).split('.').pop().toLowerCase();
    for (const [kind, types] of Object.entries(formats)) {
      if (types[ext]) return { kind, mime: types[ext] };
    }
    // Local files may have an uncommon extension but a browser-recognized MIME type.
    const kind = mime.split('/')[0];
    return formats[kind] ? { kind, mime } : null;
  }

  function on(element, event, handler) {
    element.addEventListener(event, handler, { signal: listeners.signal });
  }

  function status(message) { $('status').textContent = message; }

  function releaseMedia() {
    mediaRequest?.abort();
    mediaRequest = null;
    if (media && media.tagName !== 'IMG') {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    media = null;
    $('stage').replaceChildren();
    $('download').hidden = true;
    $('download').removeAttribute('href');
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  function show() {
    if (!dialog.open) {
      previousFocus = document.activeElement;
      dialog.showModal();
    }
  }

  function close() { if (dialog.open) dialog.close(); }

  function updateNavigation() {
    $('previous').disabled = index <= 0;
    $('next').disabled = index < 0 || index >= entries.length - 1;
    $('counter').textContent = index < 0 ? '' : `${index + 1} / ${entries.length}`;
    for (const button of $('files').querySelectorAll('[data-entry]')) {
      button.setAttribute('aria-current', Number(button.dataset.entry) === index ? 'true' : 'false');
    }
  }

  function updateZoom(value) {
    zoom = value;
    if (!media || media.tagName !== 'IMG' || !media.naturalWidth) return;
    media.style.width = value === null ? 'auto' : `${media.naturalWidth * value}px`;
    media.style.height = value === null ? 'auto' : `${media.naturalHeight * value}px`;
    media.style.maxWidth = value === null ? '100%' : 'none';
    media.style.maxHeight = value === null ? '100%' : 'none';
    $('scale').textContent = value === null ? 'Fit' : `${Math.round(value * 100)}%`;
  }

  async function select(nextIndex) {
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    releaseMedia();
    index = nextIndex;
    zoom = null;
    updateNavigation();
    const entry = entries[index];
    const format = formatFor(entry.name, entry.file?.type);
    $('title').textContent = entry.name;
    $('details').textContent = entry.path || 'Local file';
    $('zoom').hidden = format.kind !== 'image';
    $('scale').textContent = 'Fit';
    status('Loading media…');
    const request = new AbortController();
    mediaRequest = request;
    try {
      let blob = entry.file;
      if (!blob) {
        const response = await fetch(`/api/file?path=${encodeURIComponent(entry.path)}&encoding=base64`, { signal: request.signal });
        const result = await response.json();
        if (!response.ok || result.exists === false || result.error) throw new Error(result.error || 'Could not read this file.');
        if (!result.isBinary || typeof result.content !== 'string') {
          throw new Error('This Studio server needs the Media Viewer binary file update. Local files can still be opened.');
        }
        const binary = atob(result.content);
        const chunks = [];
        for (let start = 0; start < binary.length; start += 65536) {
          const chunk = binary.slice(start, start + 65536);
          chunks.push(Uint8Array.from(chunk, char => char.charCodeAt(0)));
        }
        blob = new Blob(chunks, { type: format.mime });
      }
      if (request.signal.aborted) return;
      if (!blob.size) throw new Error('This file is empty or could not be read.');
      // Give local files the same known MIME types as workspace files.
      if (blob.type !== format.mime) blob = blob.slice(0, blob.size, format.mime);
      objectUrl = URL.createObjectURL(blob);
      const element = document.createElement(format.kind === 'image' ? 'img' : format.kind);
      media = element;
      element.setAttribute('aria-label', entry.name);
      if (format.kind === 'image') {
        element.alt = entry.name;
        element.draggable = false;
      } else {
        element.controls = true;
        element.preload = 'metadata';
        if (format.kind === 'video') element.playsInline = true;
      }
      const size = blob.size < 1024 * 1024 ? `${(blob.size / 1024).toFixed(1)} KB` : `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
      element.addEventListener(format.kind === 'image' ? 'load' : 'loadedmetadata', () => {
        if (media !== element) return;
        let info = `${format.mime} · ${size}`;
        if (format.kind === 'image') {
          info += ` · ${element.naturalWidth} × ${element.naturalHeight}`;
          updateZoom(null);
        } else {
          if (format.kind === 'video') info += ` · ${element.videoWidth} × ${element.videoHeight}`;
          if (Number.isFinite(element.duration)) info += ` · ${Math.floor(element.duration / 60)}:${String(Math.floor(element.duration % 60)).padStart(2, '0')}`;
        }
        status(info);
      }, { signal: request.signal });
      element.addEventListener('error', () => {
        if (media === element) status('This media could not be decoded. It may be damaged or use a format/codec your browser does not support. You can still download it.');
      }, { signal: request.signal });
      $('stage').appendChild(element);
      const download = $('download');
      download.href = objectUrl;
      download.download = entry.name;
      download.hidden = false;
      element.src = objectUrl;
    } catch (error) {
      if (!request.signal.aborted) status(error.message || 'Could not load media.');
    }
  }

  function fileButton(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = label;
    button.onclick = callback;
    $('files').appendChild(button);
    return button;
  }

  function renderFiles(folders = []) {
    $('files').replaceChildren();
    for (const dir of folders) fileButton(`📁 ${dir.name}`, () => browse(dir.path));
    entries.forEach((entry, i) => {
      const kind = formatFor(entry.name, entry.file?.type).kind;
      const button = fileButton(`${kind === 'image' ? '▧' : kind === 'video' ? '▶' : '♫'} ${entry.name}`, () => select(i));
      button.dataset.entry = i;
    });
    if (!folders.length && !entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No media in this folder. Open a subfolder or choose local files.';
      $('files').appendChild(empty);
    }
    updateNavigation();
  }

  async function browse(path) {
    folderRequest?.abort();
    const request = new AbortController();
    folderRequest = request;
    folder = normalized(path || window.workspaceRoot || '.');
    $('folder').value = folder;
    $('files').textContent = 'Loading folder…';
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(folder)}`, { signal: request.signal });
      const files = await response.json();
      if (!response.ok || !Array.isArray(files)) throw new Error(files.error || 'Could not list this folder.');
      if (request.signal.aborted) return;
      files.sort((a, b) => a.name.localeCompare(b.name));
      const current = entries[index];
      entries = files.filter(file => !file.isDir && formatFor(file.name));
      index = current ? entries.findIndex(entry => entry.path === current.path) : -1;
      renderFiles(files.filter(file => file.isDir));
    } catch (error) {
      if (!request.signal.aborted) $('files').textContent = error.message || 'Could not list this folder.';
    }
  }

  async function openWorkspace(path) {
    show();
    // Browsing may finish later, but it cannot replace a newer file selection.
    const entry = { name: nameOf(path), path };
    entries = [entry];
    index = -1;
    renderFiles();
    select(0);
    await browse(parentPath(path));
  }

  function openLocal(files) {
    show();
    folderRequest?.abort();
    const supported = Array.from(files).filter(file => formatFor(file.name, file.type));
    if (!supported.length) {
      status('Choose an image, video, or audio file in a browser-supported format.');
      return;
    }
    entries = supported.map(file => ({ name: file.name, file }));
    index = -1;
    $('folder').value = 'Local files';
    renderFiles();
    select(0);
  }

  function pickLocal() { show(); $('picker').click(); }

  function mount() {
    style = document.createElement('style');
    style.textContent = `
      #sesi-media-viewer {position:fixed;inset:0;margin:auto;width:min(1120px,94vw);height:min(780px,90vh);max-width:94vw;max-height:90vh;padding:0;border:1px solid var(--glass-border,#444);border-radius:12px;background:var(--bg-panel,#161719);color:var(--silver-light,#eee);font:13px 'Space Grotesk',sans-serif;overflow:hidden;box-shadow:0 24px 80px #0008}
      #sesi-media-viewer::backdrop {background:#0009;backdrop-filter:blur(5px)}
      #sesi-media-viewer [hidden] {display:none!important}
      #sesi-media-viewer .mv-shell {height:100%;display:flex;flex-direction:column}
      #sesi-media-viewer .mv-header,#sesi-media-viewer .mv-toolbar {display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--glass-border,#444);flex-wrap:wrap}
      #sesi-media-viewer .mv-heading {flex:1;min-width:100px}
      #sesi-media-viewer h2 {font-size:15px;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #sesi-media-viewer .mv-details {font-size:11px;color:var(--silver-mid,#aaa);overflow-wrap:anywhere}
      #sesi-media-viewer button,#sesi-media-viewer a {font:inherit;color:inherit;background:var(--bg-base,#0f1012);border:1px solid var(--glass-border,#444);border-radius:5px;padding:7px 10px;cursor:pointer;text-decoration:none}
      #sesi-media-viewer button:hover,#sesi-media-viewer a:hover {border-color:var(--accent-cyan,#8b5cf6)}
      #sesi-media-viewer :focus-visible {outline:2px solid var(--accent-cyan,#8b5cf6);outline-offset:2px}
      #sesi-media-viewer button:disabled {opacity:.35;cursor:default}
      #sesi-media-viewer .mv-body {flex:1;min-height:0;display:grid;grid-template-columns:240px minmax(0,1fr)}
      #sesi-media-viewer aside {display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--glass-border,#444);padding:12px;gap:10px}
      #sesi-media-viewer .mv-folder {display:flex;gap:5px}
      #sesi-media-viewer input[type=text] {width:100%;min-width:0;background:var(--bg-base,#0f1012);color:inherit;border:1px solid var(--glass-border,#444);border-radius:5px;padding:7px;font:inherit}
      #sesi-media-viewer .mv-files {overflow:auto;flex:1;display:flex;flex-direction:column;gap:4px;font-size:12px}
      #sesi-media-viewer .mv-files button {text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
      #sesi-media-viewer .mv-files button[aria-current=true] {border-color:var(--accent-cyan,#8b5cf6);color:var(--accent-cyan,#8b5cf6)}
      #sesi-media-viewer .mv-files p {color:var(--silver-mid,#aaa);line-height:1.6}
      #sesi-media-viewer main {min-width:0;min-height:0;display:flex;flex-direction:column}
      #sesi-media-viewer .mv-stage {flex:1;min-height:0;overflow:auto;display:flex;align-items:safe center;justify-content:safe center;padding:16px;background:var(--bg-base,#0f1012)}
      #sesi-media-viewer .mv-stage:empty::after {content:'Open photos, video, or audio — or drop local files here';color:var(--silver-mid,#aaa);text-align:center;line-height:1.6}
      #sesi-media-viewer img {display:block;object-fit:contain;flex-shrink:0;max-width:100%;max-height:100%}
      #sesi-media-viewer video {display:block;width:100%;max-height:100%}
      #sesi-media-viewer audio {width:min(100%,540px)}
      #sesi-media-viewer .mv-zoom {display:flex;align-items:center;gap:5px;margin-left:auto}
      #sesi-media-viewer .mv-status {padding:10px 16px;min-height:40px;border-top:1px solid var(--glass-border,#444);font-size:12px;color:var(--silver-mid,#aaa);overflow-wrap:anywhere}
      @media(max-width:650px) {#sesi-media-viewer .mv-body {grid-template-columns:150px minmax(0,1fr)} #sesi-media-viewer .mv-header {padding:10px} #sesi-media-viewer aside {padding:8px} #sesi-media-viewer .mv-zoom {margin-left:0} #sesi-media-viewer button {padding:6px}}
    `;
    document.head.appendChild(style);
    dialog = document.createElement('dialog');
    dialog.id = 'sesi-media-viewer';
    dialog.setAttribute('aria-labelledby', 'sesi-media-title');
    dialog.innerHTML = `
      <div class="mv-shell">
        <div class="mv-header">
          <div class="mv-heading"><h2 id="sesi-media-title" data-media="title">Media Viewer</h2><div class="mv-details" data-media="details">Photos, video & audio</div></div>
          <button type="button" data-media="local">Open local files…</button>
          <a data-media="download" hidden>Download</a>
          <button type="button" data-media="close" aria-label="Close media viewer">Close</button>
        </div>
        <div class="mv-body">
          <aside aria-label="Media browser">
            <form class="mv-folder" data-media="folder-form"><input type="text" data-media="folder" aria-label="Workspace folder" placeholder="Workspace folder"><button type="submit">Go</button></form>
            <div class="mv-folder"><button type="button" data-media="up">Up</button><button type="button" data-media="workspace">Workspace</button></div>
            <div class="mv-files" data-media="files"></div>
          </aside>
          <main>
            <div class="mv-toolbar">
              <button type="button" data-media="previous" disabled aria-label="Previous media">←</button>
              <span data-media="counter"></span><button type="button" data-media="next" disabled aria-label="Next media">→</button>
              <div class="mv-zoom" data-media="zoom" hidden>
                <button type="button" data-media="out" aria-label="Zoom out">−</button><span data-media="scale">Fit</span><button type="button" data-media="in" aria-label="Zoom in">+</button>
                <button type="button" data-media="fit">Fit</button><button type="button" data-media="actual">100%</button>
              </div>
            </div>
            <div class="mv-stage" data-media="stage"></div>
            <div class="mv-status" data-media="status" role="status" aria-live="polite">Choose a workspace file or open local files.</div>
          </main>
        </div>
        <input type="file" data-media="picker" multiple hidden>
      </div>`;
    document.body.appendChild(dialog);
    $('picker').accept = 'image/*,video/*,audio/*,' + Object.values(formats).flatMap(types => Object.keys(types).map(ext => `.${ext}`)).join(',');
    on($('close'), 'click', close);
    on($('local'), 'click', pickLocal);
    on($('picker'), 'change', event => { openLocal(event.target.files); event.target.value = ''; });
    on($('folder-form'), 'submit', event => { event.preventDefault(); browse($('folder').value.trim()); });
    on($('up'), 'click', () => browse(parentPath(folder)));
    on($('workspace'), 'click', () => browse(window.workspaceRoot || '.'));
    on($('previous'), 'click', () => select(index - 1));
    on($('next'), 'click', () => select(index + 1));
    on($('fit'), 'click', () => updateZoom(null));
    on($('actual'), 'click', () => updateZoom(1));
    const fitScale = () => media?.naturalWidth ? Math.min(1, ($('stage').clientWidth - 32) / media.naturalWidth, ($('stage').clientHeight - 32) / media.naturalHeight) : 1;
    on($('in'), 'click', () => updateZoom(Math.min(8, (zoom ?? fitScale()) * 1.25)));
    on($('out'), 'click', () => updateZoom(Math.max(.05, (zoom ?? fitScale()) / 1.25)));
    on(dialog, 'cancel', event => { event.preventDefault(); close(); });
    on(dialog, 'close', () => {
      folderRequest?.abort();
      releaseMedia();
      previousFocus?.focus();
    });
    on(dialog, 'keydown', event => {
      // Keep Studio's global shortcuts out of the modal and preserve player/input keys.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (!event.target.closest('input,textarea,select,video,audio')) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); select(index - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); select(index + 1); }
      }
    });
    on(dialog, 'dragover', event => { event.preventDefault(); });
    on(dialog, 'drop', event => { event.preventDefault(); openLocal(event.dataTransfer.files); });
    const controls = document.querySelector('header .controls');
    if (controls) {
      launcher = document.createElement('button');
      launcher.className = 'btn';
      launcher.type = 'button';
      launcher.textContent = 'Media';
      on(launcher, 'click', openViewer);
      controls.appendChild(launcher);
    }
  }

  function openViewer() { show(); browse(window.currentDirectoryPath || window.workspaceRoot || '.'); }

  function init() {
    if (disposed) return;
    if (!document.body || typeof window.registerCommand !== 'function' || typeof window.openFile !== 'function') {
      retryTimer = setTimeout(init, 100);
      return;
    }
    mount();
    originalOpenFile = window.openFile;
    wrappedOpenFile = function (path, ...args) {
      if (!disposed && formatFor(path)) return openWorkspace(path);
      return originalOpenFile.call(this, path, ...args);
    };
    window.openFile = wrappedOpenFile;
    window.registerCommand(commandNames[0], openViewer);
    window.registerCommand(commandNames[1], pickLocal);
  }

  window.sesiMediaViewer = {
    canPreview: path => Boolean(formatFor(path)),
    openWorkspace,
    openLocal,
    open: openViewer,
    dispose() {
      disposed = true;
      clearTimeout(retryTimer);
      folderRequest?.abort();
      if (dialog) { close(); releaseMedia(); dialog.remove(); }
      listeners.abort();
      style?.remove();
      launcher?.remove();
      if (window.openFile === wrappedOpenFile) window.openFile = originalOpenFile;
      if (window.registeredCommands) window.registeredCommands = window.registeredCommands.filter(command => !commandNames.includes(command.name));
      for (const name of commandNames) if (window.extensionCommands) delete window.extensionCommands[name];
    }
  };
  init();
})();
