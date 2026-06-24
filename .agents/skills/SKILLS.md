---
name: sesi-programming-lang
description: The core identity and execution rules for the Sesi programming language.
---

## Core Identity & Execution

- **File Extension:** `.sesi`
- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/main`: Official syntax-demonstration scripts (covers examples like `01_hello.sesi` and `13_data_pipeline.sesi`).
- `chatbot/`: Local Sesi support and `sesi_db_chatbot.sesi` - Sesi's built-in Co-Pilot.
- `main/`: `tests/` like `test_failure_debug.sesi`. **Run inline code evaluations (`-e 'code'`) instead of writing new `.sesi` files for quick tests. Do not overwrite existing `.sesi` files unless explicitly asked to.**
- `docs/`: The source of truth for all sesi syntax, formatting, and structuring guidelines. It contains the official API docs for all built-in functions and types. AIs must treat this as the primary source of truth for syntax and structure.
- Root helper scripts: `example.js`, `example-ai.js`, and `examples.sesi` are convenience wrappers. AI agents should still use the `npx sesi` command as specified.
- **Paradigm:** **Sesi** is a clean, minimal, and highly legible programming language. Built from the ground up to be concise and buildable, Sesi removes unnecessary boilerplate. The language itself is so simple. It is a language built for clarity and reusability.

## Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval "sesi code"` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Validate script with the `test-runner` first before full run:** Run your script actions with a test script using the exports from `bin/test-runner.sesi`. Refer to `main/tests/verify_db.sesi` for an example.
5. **Run full script after validation:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
6. **Use file-aware help when blocked:** Run `npm run sesi:help <file>.sesi "<question>"` to get context-grounded help tied to the active script.
7. **NEVER EDIT ANY .SESI FILES IN THE TERMINAL (ABSOLUTE RULE):**
   - Do NOT run `sed`, `awk`, `perl`, or any other shell text-processing tools on `.sesi` files.
   - Do NOT use `npm run sesi:eval` to modify files; it is only for syntax validation.
   - Do NOT use Bash/Shell scripting to rewrite or patch Sesi source code.

   **Automated Refactoring & Codemods (MANDATORY):**
   - If you need to automate file edits, mass refactoring, or search-and-replace tasks across the workspace, you MUST utilize the helpers/ scripts. These are designed SPECIFICALLY for edits within this workspace.
   - Do NOT write Python scripts, Node.js scripts, or Bash/Shell scripts for workspace file manipulations. Always let Sesi do its job.
     **Why:** Sesi syntax is sensitive to whitespace, newlines, and brace positioning. Terminal-based string replacement will invariably break code.

8. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npm run sesi:eval "sesi code"` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.

## Standards (ONLY REGARDING src/ FILES)

- **Type-Only Imports (MANDATORY):** Use `import {type ...}` for AST nodes. **DO NOT REMOVE** these. Removing them will break the build.
- **Interpreter Patterns (DO NOT "CLEAN UP"):** Dynamic casting and `any` are **EXPLICITLY PERMITTED** for tree-walking logic. They are a foundational part of the Sesi engine's design.
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

## Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **No Raw Newlines in Prompt Blocks:** Raw newlines (e.g. formatting layout carriage returns) are strictly forbidden outside of string literals inside prompt blocks `{}` (e.g., between `{` and the first string, or between elements). These will be parsed as statement separators and trigger syntax errors. Write prompt blocks inline on a single line (e.g., `{"prompt text " variable}`), or place newlines inside the double quotes of a multiline string. To include actual newlines in the **output**, place them literally inside the string quotes:

```sesi
prompt report {"Student: " name "
Score: " score "
Grade: A"}
```

The newline is a real line break _inside the string literal_ — not `\n`, not any escape sequence.

- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `stringify(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.

For all quirks and specific syntaxing, visit GUIDE.md, /docs/WRITING_SCRIPTS.md, /docs/BUILTINS.md, /docs/CLI, and getting-started/.

## IGNORE THESE FILES/DIRECTORIES

- `agent_native_programming.md`
- `docs/REASONING.md`
- `docs/IMAGE_GENERATION.md`
- `*.txt`
- `*.log`
- `query.txt`
- `.sesi_cache.json`
- `.sesi_chat_history.json`
- `ai-exclude/`
- `AI-IGNORE/`
