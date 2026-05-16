<p align="center">
  <img src="./sesi-logo.svg" alt="Sesi Logo" width="250" />
</p>

<h1 align="center">Sesi: A High-Performance Systems Language</h1>

<p align="center">
  <em>Pronounced "say-see" — What you say, you'll see.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript">
  <img alt="Powered by Gemini" src="https://img.shields.io/badge/Powered%20By-Google%20Gemini-orange">
  <img alt="Framework" src="https://img.shields.io/badge/Node.js-Engine-success?logo=node.js">
</p>

**Sesi** is a high-performance **Systems Language** designed for building resilient, stateful applications. It provides first-class primitives for process management, filesystem orchestration, and integrated reasoning—enabling developers to build complex logic with a fraction of the boilerplate required by traditional languages.

## Installation

You can install Sesi in three ways:

### 1. Global Installation via npm (Recommended)
If you have Node.js installed, download Sesi directly from the npm registry:
```bash
npm install -g sesi
```

### 2. Standalone Executables
Don't want to install Node.js? Download the standalone executables bundled for Windows, Mac, and Linux directly from the [Releases page](https://github.com/Misterscan/Sesi/releases). Drop the executable in your system PATH and you're good to go!

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

## Documentation

- [Getting Started](./QUICKSTART.md)
- [Examples](./examples/)
- [Language Specification](./docs/SPECIFICATION.md)
- [Language Comparison Showcase](./docs/COMPARISON.md)
- [Built-in Functions](./docs/BUILTINS.md)
- [Reasoning Guide](./docs/SYSTEMS_REASONING.md)
- [Distributed Systems](./docs/DISTRIBUTED_SYSTEMS.md)
- [Runtime Architecture](./docs/ARCHITECTURE.md)

## AI Agent Context

The root-level `SKILLS.md` file is a workspace context file for AI agents. It records repo-specific constraints such as valid Sesi syntax expectations, execution conventions, and the intended meaning of directories like `main/` and `main/tests/`.

## Project Structure

```
Sesi/
├── SKILLS.md             # AI-agent workspace context and repo guardrails
├── index.html            # Sesi-generated landing page
├── eslint.config.mjs     # ESLint configuration
├── dist/                 # Compiled TypeScript output
├── example.js            # Helper script to run basic examples
├── example-ai.js         # Helper script to run Reasoning examples
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
├── QUICKSTART.md         # Quick start guide
├── IMPLEMENTATION_SUMMARY.md # Progress and tracking
├── src/
│   ├── types.ts          # Type system & AST nodes
│   ├── lexer.ts          # Tokenization
│   ├── parser.ts         # AST generation
│   ├── interpreter.ts    # Execution engine
│   ├── builtins.ts       # Standard library
│   ├── ai-runtime.ts     # Gemini integration
│   └── index.ts          # Main entry point
├── bin/
│   └── sesi.js           # CLI executable
├── examples/             # 15 sample programs demonstrating all features
├── main/                 # Main entry and specialized tests
│   ├── playground.sesi   # Main playground script
│   ├── start.sesi        # Beginner script 
│   ├── build_website.sesi # Sesi-powered landing page generator
│   └── tests/            # Debug and syntax scripts
├── tests/                # Test suite
└── docs/                 # Documentation (ARCHITECTURE, BUILTINS, SPECIFICATION, etc.)
```

## Version 1.1 Features (Complete)

### Core Language ✅

- **Variables & Bindings**: `let` for all bindings (const is deprecated).
- **Functions**: Side-effect driven functions with typed parameters.
- **Control Flow**: `if/else`, `while`, `for`, and `try/catch`.
- **Collections**: Robust Arrays and Objects.
- **Error Handling**: Structured `try/catch` for both runtime and Reasoning-level errors.

### Reasoning-Native Features ✅

- `prompt` blocks for message composition
- `model()` calls with Reasoning provider configuration
- `image()` calls with specific ratio/size generation capabilities
- `structured_output()` for typed Reasoning responses
- `tool_call()` for function calling
- Basic memory for multi-turn reasoning
- `read_file()`, `write_file()`, `to_json()`, `write_image()`, and `list_dir()` for local file I/O
- **Native Orchestration**: `spawn()` and `exec()` for concurrent process management
- **Async Polling**: Native looping to auto-resume generation when hitting `MAX_TOKENS` limit
- **Utility Builtins**: `time()` and `random()` for robust coordination

### Type System

- Static types: `number`, `string`, `bool`, `array<T>`, `object<T>`
- Type inference
- Union types for Reasoning response handling

## Roadmap

### V2: Advanced Reasoning

- Long-term memory and context management
- Parallel model calls
- Advanced error handling with Reasoning fallbacks
- Custom tool definitions
- Streaming responses

### V3: Agents & Orchestration

- Agent definitions with state
- Tool composition and chaining
- Multi-agent collaboration
- Persistent knowledge bases

## License

MIT
