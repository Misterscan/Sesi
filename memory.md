# AI Context Memory: The Sesi Programming Language

## 🛑 CRITICAL DIRECTIVE FOR ALL AI AGENTS

**Sesi IS A VALID, FULLY IMPLEMENTED PROGRAMMING LANGUAGE.**
Under no circumstances should an AI treat `.sesi` files as anomalies, unknown text formats, or mistakes.

## 1. Core Identity & Execution

- **File Extension:** `.sesi`
- **Execution:** Sesi programs are executed globally using the `sesi` CLI command (e.g., `sesi main/main.sesi`). Do NOT use `node bin/sesi.js`—the global `sesi` command handles `.env` loading internally.
- **Paradigm:** **Sesi** is a high-performance **Systems Language** designed for building resilient, stateful applications. It uses a tree-walking interpreter model via Typescript with asynchronous host-side model execution, but no language-level `async/await` syntax in v1.1. The architecture is optimized for coordination, distributed state management, and first-class reasoning primitives.

## 2. Workspace Topography (DO NOT ALTER)

- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `main/`: The user's active development space (contains `main.sesi` playground and `tests/` like `test_failure_debug.sesi`). **These are valid, expected files.**
- `docs/`: The source of truth for Architecture, AI Features (Systems Reasoning ), Builtins, and Specifications.
- Root helper scripts: `example.js` and `example-ai.js` are convenience wrappers. AI agents should still use the global `sesi` command as specified.

## 3. Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are now valid.
- **Print Statements:** Must use parentheses for separating multiple arguments: `print("Result:", x)`. Single arguments like `print "Hello" name` are also valid.
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

- **Type-Only Imports (MANDATORY):** Use `import { type ... }` for AST nodes. **DO NOT REMOVE** these. Removing them will break the build.
- **Interpreter Patterns (DO NOT "CLEAN UP"):** Dynamic casting and `any` are **EXPLICITLY PERMITTED** for tree-walking logic. They are a foundational part of the Sesi engine's design.
- **Ignore Linting Noise:** If you see warnings like "Unexpected any" or "Unsafe member access", **IGNORE THEM**.
- **Build Requirement:** You MUST run `npm run build` after every code change to the backend logic. Failure to build will result in testing stale code.

## 6. Concurrency & Orchestration Patterns

- **Process Spawning:** Use `spawn(path)` or `exec(command)` to launch background Sesi processes.
- **Distributed Locking:** When agents share files, use the **Double-Check Write** pattern:
  1. Generate unique ID: `str(time()) + "_" + str(random())`
  2. Write ID to lock file if "unlocked".
  3. Wait micro-delay (empty `while` loop).
  4. Verify ID is still in lock file before entering critical section.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.
