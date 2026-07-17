# 🐍 Running Python in Sesi

Sesi provides a native `python` built-in function that lets you execute arbitrary Python code directly from your Sesi scripts. It allows you to seamlessly integrate Python's rich ecosystem of data science, machine learning, and utility libraries with Sesi's minimal, side-effect-oriented architecture.

---

## 🚀 Quick Start

To execute basic Python code, call `python` with a string containing your Python code. The function runs the code synchronously and returns its standard output (`stdout`).

```sesi
// Run simple inline Python code
let output = python("print('Hello from Python!')")
print output // Hello from Python!
```

---

## 📥 Passing Arguments

Sesi supports passing structured data or parameters into the Python sub-process via the optional second argument.

### 1. Via Environment Variables (`SESI_ARGS`)
The second argument is automatically serialized to JSON and stored in the `SESI_ARGS` environment variable. You can load this variable in your Python code using `json.loads(os.environ['SESI_ARGS'])`.

```sesi
let data = {"username": "Alice", "score": 98}
let response = python("
import os, json
args = json.loads(os.environ['SESI_ARGS'])
print('User:', args['username'], 'Score:', args['score'])
", data)

print response // User: Alice Score: 98
```

### 2. Via Command Line Arguments (`sys.argv`)
If you pass an **array** as the second argument, individual elements are stringified and forwarded as positional arguments (available via `sys.argv[1:]`).

```sesi
let names = ["Alice", "Bob"]
let response = python("
import sys
print('First:', sys.argv[1])
print('Second:', sys.argv[2])
", names)

print response
// First: Alice
// Second: Bob
```

---

## 📦 Handling Complex Python Scripts & Imports

For complex Python scripts that require importing local modules or using third-party packages, use the following patterns:

### 1. Running External `.py` Files
Writing long Python snippets inside a Sesi string literal can be hard to format and test. Instead, write your Python script in a separate `.py` file, read it using `read_file()`, and run it:

```sesi
// Load and execute an external python script file
let scriptContent = read_file("scripts/data_analysis.py")
let result = python(scriptContent, {"threshold": 10})
print result
```

This allows you to write actual Python files with full editor support, syntax highlighting, and formatting.

### 2. Importing Local Python Modules
When Python is executed via `python()`, it is run with the current working directory (`cwd`) of the parent Sesi process. If you want to import modules relative to the executing Sesi script or a specific directory, append it to `sys.path`:

```sesi
let code = "
import sys, os
# Add the 'modules' subdirectory to sys.path
sys.path.append(os.path.abspath('./modules'))

import local_helper
local_helper.process_data()
"
python(code)
```

### 3. Using Virtual Environments (`venv` / `conda`)
If your Python code depends on external libraries (like `numpy`, `pandas`, `requests`, or `scikit-learn`), Sesi automatically inherits the environment of the parent process.

Before running Sesi, activate your virtual environment:

```bash
# Activate your venv
source venv/bin/activate

# Execute your Sesi script containing the python builtin
npm run sesi main.sesi
```

This ensures that the `python3` command resolves to your virtual environment's executable, giving you full access to all installed third-party libraries.

---

## 🔒 Security & Sandboxing

Because executing arbitrary code is a high-risk operation, Sesi implements strict sandboxing around the `python` built-in:

### 1. Sesi Safe Mode
If Sesi is running in Safe Mode (activated via the `SESI_SAFE_MODE=true` environment variable, or programmatic configuration), any call to `python` will immediately throw a security exception.

```sesi
// If Safe Mode is enabled:
try {
  python("print('Unsafe')")
} catch (err) {
  print "Caught sandbox violation:" err
  // Security Violation: Operation "python" is blocked in Safe Mode.
}
```

### 2. Automated LLM Tool Call Safeguards
To prevent AI models (e.g. via `tool_call`) from executing arbitrary code on your system, `python` is registered as a **sensitive built-in**. Automated tool calls targeting `python` are explicitly forbidden by the interpreter and will throw a validation error.

---

## 🛠️ Requirements & Fallbacks

* **Python 3:** Sesi will attempt to run `python3` first.
* **Python Fallback:** If `python3` is not found on your system path, Sesi will fall back to using `python`.
