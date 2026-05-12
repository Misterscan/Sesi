<p align="center">
  <img src="./sesi-logo.svg" alt="Sesi Logo" width="250" />
</p>

<h1 align="center">Sesi: An AI-Native Programming Language</h1>

<p align="center">
  <em>Pronounced "say-see" — What you say, you'll see.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript">
  <img alt="Powered by Gemini" src="https://img.shields.io/badge/Powered%20By-Google%20Gemini-orange">
  <img alt="Framework" src="https://img.shields.io/badge/Node.js-Engine-success?logo=node.js">
</p>

**Sesi** is a programming language where AI interaction is a first-class concept. Write code that seamlessly integrates Gemini AI for reasoning, generation, and tool execution—without sacrificing the simplicity of traditional programming.

## Quick Start

You'll need a [Gemini API Key](https://aistudio.google.com/app/apikey). Create a `.env` file referencing your key:

```env
GEMINI_API_KEY="AIzaSy..."
```

# Global Installation (Recommended)

You can install Sesi globally to use the `sesi` command anywhere on your system:

```bash
npm install -g .
```

Then run any program directly:

```bash
# Standard script execution
sesi examples/01_hello.sesi

# AI script execution (automatically loads .env for Gemini API key)
sesi examples/08_model_call.sesi
```

# Local Execution (Development)

If you don't install it globally, use the helper npm scripts:

```bash
npm run example 01_hello.sesi
npm run example:ai 08_model_call.sesi
```

## Language Overview

Sesi is designed for developers who want to:

- Write normal code (variables, functions, loops, etc.)
- Call AI directly within code using `prompt` and `model` blocks
- Get structured outputs from AI with type guarantees
- Build AI agents with memory and multi-step reasoning
- Maintain full control and transparency

## Example

```sesi
// Basic computation
let x = 10
let y = 20
print x + y  // 30

// AI-powered code generation
prompt generateCode {
  "Write a TypeScript function that reverses a string"
}

let code = model("gemini-3.1-pro-preview") {
  generateCode
}

print code
```

## Documentation

- [Language Specification](./docs/SPECIFICATION.md)
- [Language Comparison Showcase](./docs/COMPARISON.md)
- [Built-in Functions](./docs/BUILTINS.md)
- [AI Features Guide](./docs/AI_FEATURES.md)
- [Runtime Architecture](./docs/ARCHITECTURE.md)
- [Examples](./examples/)

## AI Agent Context

The root-level `memory.md` file is a workspace context file for AI agents. It records repo-specific constraints such as valid Sesi syntax expectations, execution conventions, and the intended meaning of directories like `main/` and `main/tests/`.

## Project Structure

```
sesi-programming-lang/
├── memory.md             # AI-agent workspace context and repo guardrails
├── index.html            # Sesi-generated landing page
├── eslint.config.mjs     # ESLint configuration
├── dist/                 # Compiled TypeScript output
├── example.js            # Helper script to run basic examples
├── example-ai.js         # Helper script to run AI examples
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
├── examples/             # 13 sample programs demonstrating all features
├── main/                 # Main entry and specialized tests
│   ├── main.sesi         # Playground/Bootstrap script
│   ├── build_website.sesi # Sesi-powered landing page generator
│   └── tests/            # Debug and syntax scripts
├── tests/                # Test suite
└── docs/                 # Documentation (ARCHITECTURE, BUILTINS, SPECIFICATION, etc.)
```

## Version 1 Features

### Core Language

- Variables and immutable bindings
- Functions with parameters and return types
- Conditionals (if/else)
- Loops (while, for)
- Error handling with `try/catch`
- Arrays, strings, numbers, booleans
- Objects (key-value maps)
- Import/export syntax is parsed in v1.0.0. Runtime module loading, namespaces, and built-in modules are planned, not implemented.

### AI-Native Features

- `prompt` blocks for message composition
- `model()` calls with AI provider configuration
- `structured_output()` for typed AI responses
- `tool_call()` for function calling
- Basic memory for multi-turn reasoning
- `read_file()`, `write_file()`, and `list_dir()` for local file I/O

### Type System

- Static types: `number`, `string`, `bool`, `array<T>`, `object<T>`
- Type inference
- Union types for AI response handling

## Roadmap

### V2: Advanced AI

- Long-term memory and context management
- Parallel model calls
- Advanced error handling with AI fallbacks
- Custom tool definitions
- Streaming responses

### V3: Agents & Orchestration

- Agent definitions with state
- Tool composition and chaining
- Multi-agent collaboration
- Persistent knowledge bases

## License

MIT
