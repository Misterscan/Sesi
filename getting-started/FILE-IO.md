# File I/O in Sesi

Sesi provides a robust, sandbox-secured set of built-in functions for manipulating files and folders. All file path references are resolved relative to the current working directory and are checked against sandbox restrictions to prevent path-traversal security violations.

---

## Reading & Writing Text Files

### `read_file(path)`

Reads the entire content of a text file and returns it as a string:

```sesi
try {
  let content = read_file("config.json")
  print "Config loaded:" content
} catch (err) {
  print "Failed to read file:" err
}
```

### `write_file(path, content)`

Writes string content to a file. If the file already exists, it is overwritten. If it doesn't exist, it is created.

```sesi
let content = "Hello from Sesi!"
try {
  write_file("output.txt", content)
  print "Successfully wrote output.txt"
} catch (err) {
  print "Failed to write file:" err
}
```

---

## Saving Images

### `write_image(path, base64_content)`

Writes binary image content (e.g., base64-encoded string returned from image-generation models) into a file:

```sesi
let logo_data = image("gemini-3.1-flash-image-preview") {"design a simple Sesi language logo"}
try {
  write_image("logo.png", logo_data)
  print "Saved logo.png successfully"
} catch (err) {
  print "Failed to save logo:" err
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
  if contains(file, ".sesi") {
    print "Found script:" file
  }
}
```

---

## Renaming & Moving Files/Folders

### `rename(oldPath, newPath)`

Renames or moves a file or directory to a new path. Returns `true` on success.

```sesi
try {
  rename("old_name.txt", "new_name.txt")
  print "Renamed file!"
} catch (err) {
  print "Rename failed:" err
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
  print "Blocked:" err
}
```

### Environment-based Paths

You can use the `env()` function to retrieve environment variables (like `HOME` or `USERPROFILE`) to dynamicize path selection. Note that if these paths lie outside the project sandbox directory, they will still trigger security violations unless Sesi is run in local filesystem mode (e.g. `sesi -l`) or if the `SESI_SAFE_MODE` environment variable is set to `false`:

```sesi
let homeDir = env("HOME", env("USERPROFILE"))
if homeDir != null {
  print "User home directory: " homeDir
}
```

---

## Quick Reference

```sesi
read_file(path)              // Read text file -> string
write_file(path, str)        // Write text file -> bool
write_image(path, base64)    // Save image -> bool
make_dir(path)               // Create directory recursively -> bool
list_dir(path)               // List folder contents -> array<string>
rename(old, new)             // Rename/move file or folder -> bool
archive(src, dest = null)    // Backup file/folder -> bool
trash(path, auto = false)    // Safe trash or permanent delete -> bool
```
