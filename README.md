<p align="center">
  <img src="./sesi-logo.svg" alt="Sesi Logo" width="250" />
</p>

<h1 align="center">Sesi: A Concise, Legible Programming Language</h1>

<p align="center">
  <em>Pronounced "say-see" — What you say, you'll see.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Interpreter-blue?logo=typescript">
  <img alt="Powered by Gemini" src="https://img.shields.io/badge/Powered%20By-Google%20Gemini-orange">
  <img alt="Framework" src="https://img.shields.io/badge/Node.js-Engine-success?logo=node.js">
</p>

<p align="center">
  <strong>Sesi</strong> is a clean, minimal, and highly legible programming language. Built from the ground up to be concise and buildable, Sesi removes unnecessary boilerplate. Because the language itself is so simple, integrating external tools like shell commands or Reasoning models becomes effortless. It is a language built for clarity.
</p>

<p align="center">
  <a href="https://code-with-sesi.netlify.app/">Homepage</a>
</p>

## Installation

You can install Sesi in three ways:

### 1. Global Installation via npm (Recommended)

If you have Node.js installed, download Sesi directly from the npm registry:

```bash
npm install -g sesi
```

### 2. Standalone Executables

Don't want to install Node.js? Download the standalone executables bundled for Windows, Mac, and Linux directly from our [Downloads page](https://code-with-sesi.netlify.app/downloads). Drop the executable in your system PATH and you're good to go!

For macOS users, Sesi also supports a native PKG installer flow when building from source:

```bash
npm run build:exe
npm run build:mac:pkg
```

This generates installer packages in `releases/` (for available architectures) that install `sesi` to `/usr/local/bin`.

### 3. Build from Source (For contributors)

```bash
git clone https://github.com/Misterscan/Sesi.git
cd Sesi
npm install
npm run build
npm install -g .  # Unlock the `sesi` command locally
```

## Quick Start

You'll need a [Gemini API Key](https://aistudio.google.com/app/apikey) for the reasoning features. Create a `.env` file referencing your key where you run your scripts:

```env
GEMINI_API_KEY="AIzaSy..."
```

Then run any program directly:

```bash
# Standard script execution
sesi main/start.sesi

# Reasoning script example
sesi examples/08_model_call.sesi

# Run all examples
sesi examples.sesi
```

Useful CLI shortcuts:

```bash
# Evaluate a quick snippet
sesi -e "print 'hello'"

# Ask the built-in co-pilot a question
sesi -help "how do I use memory?"

# Ask for help about a specific file
sesi main/playground.sesi -h "why is this failing"

# Encrypt or decrypt a script file
sesi -encrypt my_script.sesi -p "my-password"
sesi -decrypt my_script.sesi -p "my-password"

# Run with sandbox restrictions disabled
sesi main/start.sesi --local
```

# Local Execution (Development)

If you choose not install `sesi` globally, use the helper npm scripts:

```bash
npm run example 01_hello.sesi
npm run example:ai 08_model_call.sesi
npm run example:all
```

## Language Overview

Sesi is designed for developers who want to:

- Write normal code (variables, functions, loops, etc.)
- Call Reasoning directly within code using `prompt` and `model` blocks
- Get structured outputs from Reasoning with type guarantees
- Build Reasoning agents with memory and multi-step reasoning
- Maintain full control and transparency

## Example

```sesi
// Basic computation
let x = 10
let y = 20
let result = x + y
print result // 30

// Reasoning-powered code generation
prompt generateCode {"Write a TypeScript function that reverses a string"}
let code = model("gemini-3.1-pro-preview") {generateCode}
print code
```

## Security & Sandboxing

Sesi is designed to run and orchestrate untrusted AI reasoning pipelines. Because code can be influenced by prompt injections or generated model instructions, Sesi incorporates a **safe-by-default, zero-trust sandboxing engine**.

### 🛡️ Core Security Features

1. **Safe-by-Default Execution**:
   - Sesi's sandbox is **enabled by default**. Any standard Sesi interpreter execution blocks system command lines (`exec`, `spawn`) and locks down imports and paths.
   - *Overriding Safety:* Developers can explicitly bypass safe mode programmatically by initializing the interpreter with options, or on the command line by setting `SESI_SAFE_MODE=false`.

2. **Absolute Prototype Pollution Immunity**:
   - Sesi uses **prototype-free objects (`Object.create(null)`)** for all object literals, JSON parses (`from_json` or `std/json`), and structured model responses inside the interpreter.
   - Because these objects do not inherit from standard JavaScript prototypes and possess no `__proto__` or prototype chain, **prototype pollution is physically and architecturally impossible**.

3. **Strict Path Whitelisting**:
   - Sesi validates all filesystem and subprocess paths against a **strict directory whitelist** (by default, only the Current Working Directory and the Script's base directory are allowed).
   - Any path traversal resolving outside the whitelist is instantly rejected with a `Security Violation` exception.

4. **Automated LLM Tool Call Sanitization**:
   - Even if safe mode is explicitly turned off for developer automation, Sesi **strictly blocks automated tool execution** of sensitive commands (like `exec` and `spawn`) when requested dynamically by the model via `tool_call`. This completely isolates the host from prompt-injection RCE.

5. **Deep isolation & Map Cloning**:
   - Sub-interpreters loaded via concurrent workflows (`multi_req`) are fully isolated. Sesi **deep-clones** prompts and memories, preventing concurrent agent tasks from leaking state or polluting each other.

### ⚙️ Programmatic Embedding Configurations
When embedding Sesi inside a host application, you can statically configure safety settings directly in code:
```typescript
const interpreter = new Interpreter(scriptDir, {
  safeMode: true,        // Enable full sandbox limits (on by default)
  allowLocalFs: false,  // Block directory escapes (on by default)
  allowedPaths: ['/var/tmp/sandbox'] // Custom strict whitelist directories
});
```

## Documentation

- [Getting Started](./QUICKSTART.md)
- [Examples](./examples/)
- [Language Specification](./docs/SPECIFICATION.md)
- [Language Comparison Showcase](./docs/COMPARISON.md)
- [Built-in Functions](./docs/BUILTINS.md)
- [Reasoning](./docs/REASONING.md)
- [Concurrency Systems](./docs/CONCURRENCY.md)
- [Runtime Architecture](./docs/ARCHITECTURE.md)

## Agent Context

The root-level `SKILLS.md` file is a workspace context file for AI agents. It records repo-specific constraints such as valid Sesi syntax expectations, execution conventions, and the intended meaning of directories like `main/` and `main/tests/`.

## Project Structure

```
Sesi/
├── SKILLS.md                        # Workspace context and repo guardrails
├── index.html                       # Sesi-generated systems landing page
├── eslint.config.mjs                # ESLint configuration
├── example.js                       # Helper script to run basic examples
├── example-ai.js                    # Helper script to run reasoning examples
├── examples.sesi                    # Central execution suite for examples
├── README.md                        # Project overview
├── QUICKSTART.md                    # Getting started guide
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── dist/                            # Compiled TypeScript output
│
├── src/                             # Source code
│   ├── types.ts                     # Type definitions & AST nodes (400+ lines)
│   ├── lexer.ts                     # Tokenization (350+ lines)
│   ├── parser.ts                    # Recursive descent parser (700+ lines)
│   ├── interpreter.ts               # Tree-walking interpreter (600+ lines)
│   ├── builtins.ts                  # Built-in functions (250+ lines)
│   ├── ai-runtime.ts                # Integrated reasoning integration (120+ lines)
│   └── index.ts                     # Entry point (30+ lines)
│
├── bin/
│   └── sesi.js                      # CLI executable
│
├── main/                            # Playgrounds & debugging
│   ├── playground.sesi              # Main playground script
│   ├── start.sesi                   # Beginner script
│   └── tests/                       # Additional syntax validation scripts
│
├── docs/
│   ├── SPECIFICATION.md             # Complete language spec (600+ lines)
│   ├── ARCHITECTURE.md              # Runtime & system design (400+ lines)
│   ├── BUILTINS.md                  # Built-in functions reference (450+ lines)
│   ├── COMPARISON.md                # Language comparison showcase
│   ├── CONCURRENCY.md               # Concurrency & coordination guide (>100 lines)
│   ├── IMAGE_GENERATION.md          # Image generation guide (>100 lines)
│   ├── REASONING.md                 # Reasoning and simple logic guide (>500 lines)
│   ├── ROADMAP.md                   # V2-V4+ development plan (400+ lines)
│   └── sesi_ai_chronicles.md        # AI project history & notes
│
├── examples/
│   ├── 01_hello.sesi                # Hello World
│   ├── 02_variables.sesi            # Variables & operations
│   ├── 03_functions.sesi            # Functions with parameters
│   ├── 04_conditionals.sesi         # If/else control flow
│   ├── 05_loops.sesi                # While, for, for-in loops
│   ├── 06_arrays_objects.sesi       # Collections
│   ├── 07_prompts.sesi              # Reasoning blocks
│   ├── 08_model_call.sesi           # Basic reasoning calls
│   ├── 09_structured_output.sesi    # Type-safe reasoning responses
│   ├── 10_code_generation.sesi      # Systems logic generation
│   ├── 11_memory_conversation.sesi  # Multi-turn stateful reasoning
│   ├── 12_classification.sesi       # Systems classification loop
│   ├── 13_data_pipeline.sesi        # Complete systems pipeline
│   ├── 14_folder_explainer.sesi     # Directory parsing & reasoning
│   ├── 15_image_generation.sesi     # Image generation API test
│   ├── 16_modules.sesi              # Modules & std library namespaces
│   ├── 17_http_client.sesi          # Network GET/POST client
│   ├── 18_parallel_requests.sesi    # Parallel requests concurrency
│   ├── 19_search_web.sesi           # Web search integration
│   ├── 20_model_aliases.sesi        # Custom model naming aliases
│   ├── 21_custom_tools.sesi         # Custom runtime tool definitions
│   └── 22_reasoning_plus_custom_tools.sesi # Reasoning composed with custom tools
│
└── tests/                           # Engine test suite
    ├── basic.test.ts                # Core parsing & evaluation tests
    ├── cache.test.ts                # Execution caching tests
    ├── http.test.ts                 # Web request builtins testing
    ├── module.test.ts               # Imports & module loading tests
    ├── parallel.test.ts             # Concurrent execution tests
    ├── security.test.ts             # Sandbox & guardrail tests
    ├── test-gemini.ts               # Base model integration test
    ├── test-gemini2.ts              # Extended model integration test
    └── workflow.test.ts             # Complex sequence workflows tests
```

## Version 1.3 Features (In Progress)

### Core Language ✅

- **Variables & Bindings**: `let` for all bindings (const is deprecated).
- **Functions**: Side-effect driven functions with typed parameters.
- **Control Flow**: `if/else`, `while`, `for`, and `try/catch`.
- **Collections**: Robust Arrays and Objects.
- **Error Handling**: Structured `try/catch` for both runtime and Reasoning-level errors.
- **Local Module Imports/Exports**: Import custom local `.sesi` modules cleanly using relative import/export syntax!
- **Standard Library Modules**: Native support for imported standard libraries, including:
  - `std/math` (providing `PI`, `E`, `sqrt`, `pow`, `sin`, `cos`, etc.)
  - `std/time` (providing `sleep` and `now`)
  - `std/json` (providing JSON serialization/deserialization)

### Reasoning-Native Features ✅

- `prompt` blocks for message composition
- `model()` calls with Reasoning provider configuration
- `image()` calls with specific ratio/size generation capabilities
- `structured_output()` for typed Reasoning responses
- `tool_call()` for function calling
- Basic memory for multi-turn reasoning
- `read_file()`, `write_file()`, `to_json()`, `write_image()`, and `list_dir()` for local file I/O
- **Native Concurrency**: `spawn()` and `exec()` for concurrent process management, and `multi_req(array<function>)` for physical parallel request execution.
- **Logic Caching**: High-efficiency Sesi Logic Caching (`.sesi_cache.json`) for local call caching.
- **Thinking Scale**: Scaled Gemini reasoning configurations using the `thinking` parameters.
- **HTTP Client**: Built-in, native HTTP client support using `web_get(url)` and `web_send(url, body, headers)` with zero external dependencies.
- **Async Polling**: Native looping to auto-resume generation when hitting `MAX_TOKENS` limit
- **Utility Builtins**: `time()` and `random()` for robust coordination

### Type System

- Static types: `number`, `string`, `bool`, `array<T>`, `object<T>`
- Type inference
- Union types for Reasoning response handling

## Roadmap

### V2: Advanced Reasoning

- Long-term memory and context management
- Custom tool definitions
- Streaming responses

### V3: Agents & Orchestration

- Agent definitions with state
- Tool composition and chaining
- Multi-agent collaboration
- Persistent knowledge bases

## License

MIT
