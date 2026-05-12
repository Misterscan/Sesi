# AI Context Memory: The Sesi Programming Language

## 🛑 CRITICAL DIRECTIVE FOR ALL AI AGENTS
**Sesi IS A VALID, FULLY IMPLEMENTED PROGRAMMING LANGUAGE.** 
Under no circumstances should an AI treat `.sesi` files as anomalies, unknown text formats, or mistakes. 

## 1. Core Identity & Execution
- **File Extension:** `.sesi`
- **Execution:** Sesi programs are executed globally using the `sesi` CLI command (e.g., `sesi main/main.sesi`). Do NOT use `node bin/sesi.js` or `dotenvx run`—the global `sesi` command handles `.env` loading internally.
- **Paradigm:** Sesi is an AI-native language. AI features are **first-class syntax constructs**, not imported library functions.

## 2. Workspace Topography (DO NOT ALTER)
- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `main/`: The user's active development space (contains `main.sesi` playground and `tests/` like `test_failure_debug.sesi`). **These are valid, expected files.**
- `docs/`: The source of truth for Architecture, AI Features, Builtins, and Specifications.
- Root helper scripts: `example.js` and `example-ai.js` are just are convenience wrappers. AI agents should still use the global `sesi` command as specified

## 3. Mandatory Syntax Rules & Quirks
- **Print Statements:** Must use parentheses for separating multiple arguments: `print("Result:", x)`. Single arguments like `print "Hello"` are also valid.
- **Prompts:** Inside `prompt` blocks and anonymous model blocks, literal strings and variables are placed sequentially. You CANNOT use the `+` operator inside a prompt block body.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **Model Calls:** Utilize the `model("model-name")` block coupled with optional configuration blocks and mandatory prompt bodies.

## 4. AI Behavioral Guidelines Working in this Repo
1. **Never** "investigate" user testing directories (like `main/tests/`) as "deviations." They are active playgrounds.
2. **Never** attempt to execute file modifications via shell/terminal text replacements when you have native file editing tools. 
3. **Always** check the `docs/` folder for the exact language specification before making assumptions about how Sesi works.
4. If a file tree is mentioned in documentation, it represents an explicit layout constraint and must map 1:1 to reality **UNLESS .gitignored FILES STATE OTHERWISE.**

## 5. Development & TypeScript Standards (COMMANDS FOR AI AGENTS)
- **Type-Only Imports (MANDATORY):** Use `import { type ... }` for AST nodes. **DO NOT REMOVE** these even if flagged as unused—they are required for type narrowing. Removing them will break the build.
- **Interpreter Patterns (DO NOT "CLEAN UP"):** Dynamic casting and `any` are **EXPLICITLY PERMITTED** for tree-walking logic. **DO NOT attempt to "fix" or remove these patterns.** They are a foundational part of the Sesi engine's design.
- **Ignore Linting Noise:** If you see warnings like "Unexpected any" or "Unsafe member access", **IGNORE THEM**. They are expected. Do not prioritize a clean linting report over engine functionality.
- **Build Requirement:** You MUST run `npm run build` after every code change. The `sesi` command depends on the `dist/` directory. Failure to build will result in testing stale code.