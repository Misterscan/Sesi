# 🧩 Sesi Studio: Extensions & Themes Guide

Sesi Studio is designed to be highly extensible. Developers can customize the IDE's appearance and functionality by adding simple `.css` and `.js` files to the `sesi-studio/extensions/` directory.

---

## 📝 The Extension Manifest

Every extension or theme **must** start with a JSON metadata block inside a comment. This manifest allows the IDE to index and display your extension in the **Settings Hub** and **Sidebar**.

### Example Manifest (JavaScript Extension)

```javascript
/* 
{
  "name": "My Custom Tool",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Adds a custom command to the editor.",
  "icon": "🛠️",
  "commands": ["Run Custom Logic"]
}
*/

(function () {
  console.log("My Custom Tool loaded!");
  // Your logic here...
})();
```

### Supported Fields:

| Field         | Type   | Description                                                        |
| :------------ | :----- | :----------------------------------------------------------------- |
| `name`        | String | The display name in the Settings Hub.                              |
| `version`     | String | Semantic version of your extension.                                |
| `author`      | String | Your name or organization.                                         |
| `description` | String | A short summary of what it does.                                   |
| `icon`        | String | An emoji (e.g. `"🚀"`) or a path to a file (e.g. `"my-icon.svg"`). |
| `commands`    | Array  | A list of key features or quick commands.                          |

---

## 🎨 Creating Themes (`.css`)

Themes are CSS files placed in `sesi-studio/extensions/themes/`. They primarily define CSS variables that control the IDE's "shell" and provide a configuration for the Monaco Editor.

### 1. Style the UI

Use the following CSS variables to match your aesthetic:

```css
:root {
  --bg-base: #070e1b;
  --bg-panel: #0f172a;
  --accent-cyan: #00e5ff;
  /* ... see classic.css for full list */
}
```

### 2. Style the Editor (Monaco)

To ensure the code editor matches your UI, the `Theme Manager` automatically looks for your theme name. If you want a custom color scheme for the code editor, you can add it to the `Theme Manager` logic in `extension-manager.js` or use standard CSS overrides for Monaco classes.

### 3. Packaging Themes (`.sesitheme`)

Sesi Studio supports distributing CSS themes as a single, portable `.sesitheme` bundle file. This file contains both the manifest metadata and the raw CSS content, eliminating the need to copy multiple files or copy-paste code.

#### Manifest Comment Requirement

Themes designed for packaging must declare their JSON metadata block at the very beginning of the CSS file using a multi-line comment:

```css
/* 
{
  "name": "My Theme Name",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Short description of the theme's aesthetic.",
  "icon": "🎨",
  "commands": []
}
*/
```

#### Theme Packager Commands

Sesi provides a native theme packager utility to manage these bundles from the root directory:

- **Validate a theme manifest**:
  ```bash
  npm run css:validate <css-file-path>
  ```
- **Pack a theme into a `.sesitheme` bundle**:
  ```bash
  npm run css:pack <css-file-path> [output-dir]
  ```
- **Unpack a `.sesitheme` bundle**:
  ```bash
  npm run css:unpack <sesitheme-file-path> [output-dir]
  ```

---

## ⚙️ Creating Functionality (`.js`)

JavaScript extensions are placed directly in `sesi-studio/extensions/`. They have full access to the browser's global scope, including:

- `window.monaco`: The Monaco Editor API.
- `window.editor`: The active editor instance.
- `window.terminal`: The integrated terminal instance.

### Common Use Cases:

- **Language Intelligence**: Registering hover providers or autocomplete for new languages.
- **Custom Keybindings**: Adding IDE-wide shortcuts.
- **UI Tweaks**: Adding new buttons to the header or sidebar.

### Packaging JS Extensions (`.sesiext`)

Sesi Studio supports distributing JavaScript extensions as a single, portable `.sesiext` bundle file. This file contains both the manifest metadata and the raw JS content.

#### Manifest Comment Requirement

JS extensions designed for packaging must declare their JSON metadata block at the very beginning of the JS file using a multi-line comment:

```javascript
/* 
{
  "name": "My Extension Name",
  "version": "1.0.0",
  "description": "Short description of the extension functionality.",
  "icon": "⚙️",
  "commands": ["My Command Name"]
}
*/
```

#### Extension Packager Commands

Sesi provides a native extension packager utility to manage these bundles from the root directory:

- **Validate an extension manifest**:
  ```bash
  npm run ext:validate <js-file-path>
  ```
- **Pack an extension into a `.sesiext` bundle**:
  ```bash
  npm run ext:pack <js-file-path> [output-dir]
  ```
- **Unpack a `.sesiext` bundle**:
  ```bash
  npm run ext:unpack <sesiext-file-path> [output-dir]
  ```

---

## 🚀 Installation & Distribution

### 📂 Manual File Installation

1. **Local Install**: Drop your `.js` or `.css` file (and any assets like `.svg`) into the `sesi-studio/extensions/` folder (custom themes go under `sesi-studio/extensions/themes/`).
2. **Refresh**: Click "Refresh" in the Workspace sidebar or reload the page.
3. **Themes**: Open **Settings -> Appearance** to activate your new theme.

### 📥 UI-Driven Installation

For portable `.sesitheme` and `.sesiext` bundles, you can install them dynamically within the editor:

1. **Settings Hub**:
   - **Themes**: Navigate to the **Appearance & Themes** panel and click **"Install Theme..."** to upload a `.sesitheme` bundle file.
   - **Extensions**: Navigate to the **Extensions** panel and click **"Install Extension..."** to upload a `.sesiext` bundle file.
2. **Command Palette**: Run **"Appearance: Install .sesitheme..."** or **"Install from .sesiext..."** (`Cmd/Ctrl+P`) to trigger the installer.
3. **Endpoints**: The installer invokes `/api/install-theme` or `/api/install-extension` via `POST` requests, which validates and installs them instantly without restarting the studio.

---

## 🌟 Community Tips

- **Keep it Lightweight**: Sesi Studio is built for speed. Avoid heavy dependencies.
- **Icons**: SVG is preferred for custom icons to ensure they look sharp at any density.
- **Namespacing**: Wrap your JS logic in an IIFE `(function() { ... })();` to avoid polluting the global namespace.

---

_Created something cool? Share it with the Sesi community on GitHub!_
