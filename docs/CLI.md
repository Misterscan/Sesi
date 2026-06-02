# ⚡ Sesi Command Line Interface Reference

Sesi’s CLI is a powerful, zero-footprint environment orchestrator. It allows you to run robust scripts, evaluate inline code filelessly, query the RAG-powered interactive Co-Pilot, encrypt files, and manage sandboxing controls directly from your shell.

---

## 🗺️ CLI Command Reference Matrix

| Command Syntax               | Execution Mode        | File Dependency                   | Description                                                                         |
| :--------------------------- | :-------------------- | :-------------------------------- | :---------------------------------------------------------------------------------- |
| `sesi <file>`                | Standard              | Yes                               | Runs the Sesi script file sequentially.                                             |
| `sesi <file> <args...>`      | **Parametric Script** | Yes                               | Runs the script and exposes trailing parameters in `args`.                          |
| `sesi -e "<code>"`           | Inline Eval           | **No (Fileless)**                 | Evaluates the string of Sesi code directly in-memory.                               |
| `sesi -e "<code>" <args...>` | **Parametric Eval**   | **No (Fileless)**                 | Evaluates inline code and populates `args` array with inputs.                       |
| `sesi -h "<query>"`          | Co-Pilot Help         | **Yes (Internal chatbot script)** | Converses with Sesi's internal Vector-RAG chatbot (`chatbot/sesi_db_chatbot.sesi`). |
| `sesi <file> -h "<query>"`   | Grounded Help         | **Yes (Chatbot + context file)**  | Converses with the Co-Pilot using both the vector DB and the user's file.           |
| `sesi -r <file>`             | AST Inspector         | Yes                               | Dumps raw syntax tokens and AST nodes without running code.                         |
| `sesi -enc <file> -p <pass>` | Encryption            | Yes                               | Secures a script file using AES-256 password protection.                            |
| `sesi -dec <file> -p <pass>` | Decryption            | Yes                               | Decrypts an encrypted script file back to cleartext `.sesi`.                        |

---

## 🚀 1. Parametric Script Execution

You can feed command-line arguments to Sesi scripts on launch. Sesi parses these inputs and binds them as standard string values in a globally accessible array called `args`.

### Usage

```bash
sesi main/test_args.sesi "hello" "world"
```

### Accessing Arguments in Sesi Scripts

```sesi
// Get the number of inputs
let total = len(args)

// Access indices
if total > 0 {
  print "First argument:" args[0]
}
```

---

## 🔮 2. Fileless Inline Execution (`-e` / `--eval`)

You do not need to create or save `.sesi` files on your disk to use Sesi. Using the `-e` flag, you can execute logic on the fly.

### A. Statement Termination Rules

Sesi requires statements to be terminated by either a **newline** or a **semicolon (`;`)**.

#### Single-line Semicolon Pattern

If writing on a single terminal line, separate statements manually with `;`:

```bash
sesi -e "let x = 10; let y = 20; print x + y"
```

#### Multiline Shell Pattern

If writing a multiline string in your shell, omit semicolons completely:

```bash
sesi -e "
let x = 10
let y = 20
print x + y
"
```

### B. Parametric Fileless Execution

You can pass CLI arguments to fileless inline scripts too! Any positional arguments coming after the inline code string are loaded into the global `args` array.

#### Example: Dynamic File Character Counter

```bash
sesi -e "let path = args[0]; let content = read_file(path); print 'Character count:' len(content)" "package.json"
```

---

## 🎓 3. Interactive Co-Pilot Help (`-h` / `--help`)

Sesi’s CLI features an inline, dynamic RAG (Retrieval-Augmented Generation) co-pilot trained directly on Sesi's grammar rules, standard library, and architecture documentation.

### A. General Knowledge Queries (Fileless)

Ask Sesi how to write loops, parse JSON, what functions are available, what are the best practices in Sesi, etc:

```bash
sesi -h "how do I use standard json module?"
```

### B. Context-Grounded Code Debugging

Pass a script file along with `-h` to chat with the co-pilot about your code. The co-pilot will automatically ingest the file contents as grounding context:

```bash
sesi examples/01_hello.sesi -h "how can i improve this script?"
```

---

## ⚙️ 4. Security & Sandbox Overrides

Sesi runs in a safe-by-default, zero-trust sandbox. System shell commands (`exec`, `spawn`) are blocked by default. Use these CLI flags to configure safety parameters:

### A. Disable Sandboxing (`-l` / `--local`)

Unlocks the execution of raw system commands and allows directory whitelist escapes:

```bash
sesi main/script.sesi --local
```

### B. Directory Whitelisting (`-a` / `--allowed-paths`)

Adds custom directories to the safe path whitelist (Current Working Directory and Script Directory are whitelisted by default):

```bash
sesi main/script.sesi -a "./data,./logs"
```

---

## 📦 5. Systems Utilities

### A. AST Raw Parser Dumps (`-r` / `--raw`)

Inspect exactly how Sesi's lexer tokenizes and parses code before execution:

```bash
sesi -r examples/01_hello.sesi
```

### B. AES-256 Script Encryption (`-enc` & `-dec`)

Secure your proprietary reasoning instructions or pipelines using password-based encryption:

```bash
# Encrypt manually with password parameter
sesi -enc my_private_script.sesi -p "my-super-secret-password"

# Decrypt manually with password parameter
sesi -dec my_private_script.sesi -p "my-super-secret-password"
```

#### 🔒 Zero-Configuration Environment Fallback (`SESI_PASSWORD`)

To avoid exposing passwords in your shell's history, you can set the `SESI_PASSWORD` environment variable in your `.env` file (or your system's shell environment).

When Sesi detects `SESI_PASSWORD`, you can omit the `-p` parameter entirely:

```bash
# Encrypt automatically using SESI_PASSWORD from env
sesi -enc my_private_script.sesi

# Decrypt automatically using SESI_PASSWORD from env
sesi -dec my_private_script.sesi
```

---

## 🛠️ 6. Package.json Script Shortcuts

If you are working inside the Sesi repository, you can leverage native package manager shortcuts defined in `package.json` to execute, parse, or encrypt scripts:

| Package Script                      | CLI Equivalence           | Description                                           |
| :---------------------------------- | :------------------------ | :---------------------------------------------------- |
| `npm run lint`                      | `sesi lint.sesi`          | Audits the entire workspace for errors/warnings.      |
| `npm run lint <file>`               | `sesi lint.sesi <file>`   | Audits a single file and prints directly to terminal. |
| `npm run sesi <file>`               | `sesi <file>`             | Runs the Sesi script.                                 |
| `npm run sesi:local <file>`         | `sesi -l <file>`          | Runs a script with safe-mode disabled.                |
| `npm run sesi:eval "<code_to_run>"` | `sesi -e "<code_to_run>"` | Evaluates Sesi code in-memory.                        |
| `npm run sesi:parse <file>`         | `sesi -r <file>`          | Dumps the raw AST representation.                     |
| `npm run sesi:encrypt <file>`       | `sesi -enc <file>`        | Encrypts a file (using env password fallback).        |
| `npm run sesi:decrypt <file>`       | `sesi -dec <file>`        | Decrypts a file (using env password fallback).        |
| `npm run copilot "<query>"`         | `sesi -h "<query>"`       | Consults the RAG-trained Sesi Co-Pilot.               |
| `npm run example:all`               | `sesi examples.sesi`      | Runs all examples in the examples/ directory.         |

### Usage Example

```bash
# Audit the entire workspace and save report to lint_report.md
npm run lint

# Audit a single file and print Errors & Warnings directly to stdout
npm run lint bad-syntax-file.sesi

# Evaluate inline code
npm run sesi:eval "print 'Sesi running via npm!'"

# Encrypt a private script using the .env password
npm run sesi:encrypt "my-pipeline.sesi"
```
