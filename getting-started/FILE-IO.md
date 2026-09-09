# File I/O in Sesi

Sesi provides a robust, sandbox-secured set of built-in functions for manipulating files and folders. All file path references are resolved relative to the current working directory and are checked against sandbox restrictions to prevent path-traversal security violations.

---

## Reading & Writing Text Files

### read_file(path, mode = "text") -> string

Read the contents of a file as a string.

Modes:

- `"text"` (default): Reads UTF-8 text
- `"base64"`: Reads raw bytes and returns Base64 text

```sesi
try {
  let content = read_file("config.json")
  let image_b64 = read_file("logo.png", "base64")
  show image_b64
  show "Config loaded:" content
} catch (err) {
  show "Failed to read file:" err
}
```

### `write_file(path, content, encoding = null)`

Writes content to a file. If the file already exists, it is overwritten. If it doesn't exist, it is created.

- Default (`encoding = null`): writes UTF-8 text.
- `encoding = "base64"`: decodes Base64 text and writes raw bytes.

```sesi
let content = "Hello from Sesi!"
try {
  write_file("output.txt", content)
  let image_b64 = read_file("logo.png", "base64")
  write_file("logo-copy.png", image_b64, "base64")
  show "Successfully wrote output.txt"
} catch (err) {
  show "Failed to write file:" err
}
```

### append_file(path, content) -> bool

Append string content to the end of a file. Creates the file if it does not exist.

```sesi
let success = append_file("log.txt", "new line\n")
if success {show "File appended successfully"}
```

### open_file(path, options = null) -> bool

Open a local file with OS default behavior, or force a preferred editor/viewer/browser.

```sesi
open_file("README.md")
open_file("README.md", {editor: "Visual Studio Code"})
open_file("favicon.png", {viewer: "Preview"})
open_file("index.html", {mode: "browser", browser: "Google Chrome"})
```

### open(target, options = null) -> bool

Open a URL or local file using the OS default app, or a specific browser/editor/viewer.

```sesi
open("https://code-with-sesi.netlify.app")
open("https://code-with-sesi.netlify.app", {browser: "Google Chrome"})

open("reports/dashboard.html", {browser: "Firefox"})
open("notes/todo.txt", {editor: "Visual Studio Code"})
open("images/logo.png", {image_viewer: "Preview"})
```

**Options**:

- `browser` (`string`, optional): Preferred browser app name.
- `editor` (`string`, optional): Preferred text editor app name.
- `viewer` (`string`, optional): Preferred image viewer app name.
- `image_viewer` (`string`, optional): Alias for `viewer`.
- `mode` (`string`, optional): One of `"auto"`, `"browser"`, `"editor"`, `"viewer"`, `"image_viewer"`.

---

## Saving Images

### `write_image(path, base64_content)`

Writes binary image content (e.g., base64-encoded string returned from image-generation models) into a file:

```sesi
let logo_data = image("gemini-3.1-flash-image") {"design a simple Sesi language logo"}
try {
  write_image("logo.png", logo_data)
  show "Saved logo.png successfully"
} catch (err) {
  show "Failed to save logo:" err
}
```

---

## Directory Manipulation

### `make_dir(path)`

Recursively creates a directory path if it does not already exist. Returns `true` on success.

```sesi
make_dir("projects/demo/src")
```

### `list_dir(path)`

Lists the contents of a directory and returns them as an array of filenames/folder names:

```sesi
let files = list_dir(".")
for file in files {
  if get_ext(file) == "sesi" {
    show "Found script:" file
  }
}
```

Results use natural filename order, so numbered names such as `frame_2.png` come before `frame_10.png`.

---

## Path Inspection

### `exists(path) -> bool`

Checks whether a file or directory exists within the allowed filesystem boundary.

```sesi
if exists("config.json") {
  show "Configuration found"
}
```

### `get_ext(path) -> string`

Gets a lowercase extension without the leading dot. Compound archive extensions such as `tar.gz` are preserved.

```sesi
show get_ext("photo.JPG")      // "jpg"
show get_ext("backup.tar.gz") // "tar.gz"
```

---

## Renaming & Moving Files/Folders

### `rename(oldPath, newPath)`

Renames or moves a file or directory to a new path. Returns `true` on success.

```sesi
try {
  rename("old_name.txt", "new_name.txt")
  show "Renamed file!"
} catch (err) {
  show "Rename failed:" err
}
```

---

## Backups & Copying

### `archive(sourcePath, destPath = null)`

Recursively copies/backs up a file or folder.

- If `destPath` is specified, it clones the file/folder to that target path.
- If `destPath` is omitted (or `null`), it automatically copies the item to a hidden `.archive/` directory in the current working directory, retaining the source name.

```sesi
// Explicit copy/backup
archive("src/main.ts", "backup/main.ts")

// Automatic backup to hidden cache folder: .archive/main.ts
archive("src/main.ts")
```

---

## Archive Management

### `zip(source, destination = null, operation = null)`

Creates, lists, or extracts an archive. When `operation` is omitted, Sesi infers it from the source and destination.

```sesi
zip("assets", "assets.zip")           // Create
let entries = zip("assets.zip")        // List
zip("assets.zip", "restored")         // Extract
zip("assets.7z", "restored", "extract")
```

ZIP-compatible formats are handled natively. The `7z`, RAR, and tar families require local mode and the corresponding system utility.

---

## Deletion & Trash

### `trash(path, autoRemove = false)`

Safely deletes a file or directory.

- **Safe Recycle Bin (Default)**: If `autoRemove` is omitted or `false`, Sesi moves the item into a local `.trash/` folder in the project root. To prevent naming collisions, the files are uniquely renamed with a millisecond timestamp (e.g., `temp_1719253450000.txt`).
- **Permanent Deletion**: If `autoRemove` is set to `true`, the file or folder is recursively and permanently deleted from the filesystem immediately.

```sesi
// Moves to local .trash recycle bin safely
trash("temp.txt")

// Deletes permanently and immediately (recursive)
trash("temp.txt", true)
```

---

## Sandbox & Path Safety

Sesi programs run inside a directory-level sandbox. Paths are resolved using `ensureSafePath()`. Any attempt to access, write, rename, or trash a file outside of the allowed directory boundary (e.g., using parent traversal `../../etc/passwd` or absolute path breakouts) will throw a **Security Violation** error:

```sesi
try {
  // Throws Security Violation: Path traversal detected
  read_file("../outside_file.txt")
} catch (err) {
  show "Blocked:" err
}
```

### Environment-based Paths

You can use the `env()` function to retrieve environment variables (like `HOME` or `USERPROFILE`) to dynamicize path selection. Note that if these paths lie outside the project sandbox directory, they will still trigger security violations unless Sesi is run in local filesystem mode (e.g. `sesi -l`) or if the `SESI_SAFE_MODE` environment variable is set to `false`:

```sesi
let homeDir = env("HOME", env("USERPROFILE"))
if homeDir != null {
  show "User home directory: " homeDir
}
```

You can also use `$` for Unix-style environment variable expansion in paths.
```sesi
let configPath = $HOME + "/.config/sesi"
show "Config path:" configPath
```

---

## Quick Reference

```sesi
read_file(path, mode = "text")            // Read file -> string
write_file(path, str)                     // Write text file -> bool
append_file(path, str)                    // Appends to text file -> bool
open_file(path, options = null) -> bool   // Open a local file -> bool
open(path, options = null) -> bool        // Open a local file or URL -> bool
write_image(path, base64)                 // Save image -> bool
make_dir(path)                            // Create directory recursively -> bool
list_dir(path)                            // List folder contents -> array<string>
exists(path)                              // Check file/directory existence -> bool
get_ext(path)                             // Get file extension -> string
rename(old, new)                          // Rename/move file or folder -> bool
archive(src, dest = null)                 // Backup file/folder -> bool
zip(source, dest = null, operation = null) // Create/list/extract archive
trash(path, auto = false)                 // Safe trash or permanent delete -> bool
env(name, default = null)                  // Get environment variable -> string or null
```
