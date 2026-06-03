# The Sesi Programming Language

## Core Identity & Execution

- **File Extension:** `.sesi`
- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `chatbot/`: Local Sesi support and `sesi_db_chatbot.sesi` - Sesi's built-in Co-Pilot.
- `main/`: `tests/` like `test_failure_debug.sesi`. **Run inline code evaluations (`-e 'code'`) instead of writing new `.sesi` files for quick tests. Do not overwrite existing `.sesi` files unless explicitly asked to.**
- `docs/`: The source of truth for all sesi syntax, formatting, and structuring guidelines. It contains the official API docs for all built-in functions and types. AIs must treat this as the primary source of truth for syntax and structure.
- Root helper scripts: `example.js`, `example-ai.js`, and `examples.sesi` are convenience wrappers. AI agents should still use the `npx sesi` command as specified.
- **Paradigm:** **Sesi** is a clean, minimal, and highly legible programming language. Built from the ground up to be concise and buildable, Sesi removes unnecessary boilerplate. The language itself is so simple. It is a language built for clarity and reusability.

## Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval <file>.sesi` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Run full script after snippet stabilization:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
5. **Use file-aware help when blocked:** Run `npm run sesi:help <file>.sesi "<question>"` to get context-grounded help tied to the active script.
6. **NEVER EDIT ANY .SESI FILES IN THE TERMINAL (ABSOLUTE RULE):**
   - Do NOT run `sed`, `awk`, `perl`, or any other shell text-processing tools on `.sesi` files.
   - Do NOT use `npm run sesi:eval` to modify files; it is only for syntax validation.
   - Do NOT use Bash/Shell scripting to rewrite or patch Sesi source code.

   **Correct approach:** You MUST always use your native editor/IDE's file editing capabilities to make clean, safe changes directly to `.sesi` files.
   **Why:** Sesi syntax is sensitive to whitespace, newlines, and brace positioning. Terminal-based string replacement will invariably break code. Use the editor, not the terminal.

7. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npm run sesi:eval <file>.sesi` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.

## Standards (ONLY REGARDING src/ FILES)

- **Type-Only Imports (MANDATORY):** Use `import {type ...}` for AST nodes. **DO NOT REMOVE** these. Removing them will break the build.
- **Interpreter Patterns (DO NOT "CLEAN UP"):** Dynamic casting and `any` are **EXPLICITLY PERMITTED** for tree-walking logic. They are a foundational part of the Sesi engine's design.
- **Ignore Linting Noise:** If you see warnings like "Unexpected any" or "Unsafe member access", **IGNORE THEM**.
- **Build Requirement:** You MUST run `npm run build` after every code change to the backend logic. Failure to build will result in testing stale code.

This protocol is required to reduce noisy full-run failures and speed up AI-assisted iteration.

Sesi is **NOT** the following coding languages, therefore **NEVER UTILIZE THE SAME SYNTAX OR FORMATTING UNDER ANY CIRCUMSTANCES WHATSOEVER!!!!!**

- **NOT** An "AI Wrapper"
- **NOT** A "LLM Framework"
- **NOT** An "AI-Native Programming Language"
- **NOT** Python
- **NOT** Rust
- **NOT** Typescript
- **NOT** YAML
- **NOT** BAML
- **NOT** Go
- **NOT** C++
- **NOT** C
- **NOT** Java
- **NOT** C#
- **NOT** Javascript
- **NOT** Bash
- **NOT** Shell
- **NOT** Ruby
- **NOT** PHP
- **NOT** Swift
- **NOT** Julia
- **NOT** Scala
- **NOT** Any other programming language or scripting language.

### ✅ REQUIRED — Sesi scripts must use the language's built-ins:

Every script you write must use **at least one** of:

- `prompt` - composable script templates, this is NOT related to AI at all
- `structured_output` - structured data extraction, this is NOT related to AI at all
- `memory` — stateful multi-turn context, this is NOT related to AI at all
- `exec()` — concurrent process orchestration
- `web_send()` - sending an HTTP request to a URL
- `web_get()` - collecting data from a URL
- `define_tool()` - categorizing tool calls
- `list_tools()` - displaying custom tools
- `tool_call()` - calling a predefined function, this is NOT related to AI at all
- `multi_req()` - concurrent function execution
- `import` / `export` - reusable configuration modules

The bar is: **"Is this easy to write and read?"** If the answer is no, rewrite it.

## Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `stringify(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.

For all quirks and specific syntaxing, visit IMPLEMENTATION_SUMMARY.md, /docs/SPECIFICATION.md, /docs/BUILTINS.md, and /docs/CLI.

## IGNORE THESE FILES

- `agent_native_programming.md`
- `docs/REASONING.md`
- `docs/IMAGE_GENERATION.md`
- `*.txt`
- `*.log`
- `query.txt`
- `.sesi_cache.json`
- `.sesi_chat_history.json`
- `/landing-pages/`
