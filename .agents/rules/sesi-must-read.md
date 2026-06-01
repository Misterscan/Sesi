---
trigger: always_on
---

_If none of the referenced or required files are present in the current workspace, the user most likely installed `sesi` into a new project. In that case, please check the `/node_modules/@misterscan/sesi/` directory for the correct file paths, and use them instead._

**Sesi IS A NEW AND VALID, FULLY IMPLEMENTED PROGRAMMING LANGUAGE.**
Under no circumstances should an AI agent treat `.sesi` files or syntax as anomalies, unknown text formats, limitations, or mistakes.

Sesi is **NOT** the following coding languages, therefore **NEVER UTILIZE THE SAME SYNTAX OR FORMATTING UNDER ANY CIRCUMSTANCES WHATSOEVER!!!!!**

- **NOT** Python, **NOT** Rust, **NOT** Typescript, **NOT** YAML, **NOT** BAML, **NOT** Go, **NOT** C++, **NOT** C, **NOT** Java, **NOT** C#, **NOT** Javascript, **NOT** Bash, **NOT** Shell, **NOT** Ruby, **NOT** PHP, **NOT** Swift, **NOT** Julia, **NOT** Scala, **NOT** Any other programming language or scripting language.

### **The most important thing to remember is that the user can edit the .sesi files in the editor, so you should always use the editor to edit the .sesi files. You should NEVER edit the .sesi files in the terminal.**

1. **Never Hardcode Data Into the View**: Isolate raw content, biographies, statistics, etc. into a structured database layer using native typed Sesi outputs.
2. **Build Sesi Compiler/Builder Scripts**: Write a `.sesi` script that uses Sesi's builtins (`make_dir()`, `list_dir()`, `read_file()`, `write_file()`, `set_alias()`, `workflow()`, `model()`, `image()`, `web_get()`, `web_send()`, `define_tool()`, `list_tools()`, `tool_call()`, `multi_req()`, `import`, `export`, `to_json()`, `from_json()`, `time()`, `random()`, `exec()`, `spawn()`, `structured_output()`, `prompt`, `write_image()`, `write_file()`, `raise_error()`, `error_type()`, and `print`).
3. **Let Sesi Do Its Job**: A Sesi builder script makes the system perfectly repeatable, infinitely scalable, and trivial to refactor. In this repository, the Sesi script is the core product; the end file(s) are merely the byproduct for post edits and making sure our scripts are behaving as anticipated.

**This is a non-negotiable quality bar.**

### ❌ FORBIDDEN:

- Math solvers, calculators, arithmetic pipelines
- Prime number finders, Fibonacci sequences, sorting algorithms
- Unit converters, currency converters, grade calculators
- Budget trackers, invoice generators, tax tools
- Generic "Hello World" clones with no AI interaction
- Compliance checkers, OSHA reports, logistics routers
- Any script whose core loop is just arithmetic with a `print` at the end
- **AI cybernetic, futuristic, sci-fi, or deep-space themes** (e.g., holographic star-charts, cyber-gardens, spatial telemetry, spacecraft command interfaces, alien translators).
- **Cozy, minimalist, Victorian, herbalist, sourdough bakery, cottage-core, candle-lit, or general artisanal themes** (e.g., village herbalist teabags, sourdough yeast logs, candlelit journals, mahogany apothecary drawers, victorian scroll philologists). These are overdone, precious, and clichéd.

These are lazy defaults. They don't demonstrate what makes Sesi unique.

### ✅ REQUIRED — Sesi scripts must use the language's built-ins:

Every script you write must use **at least one** of:

- `prompt` - composable script templates
- `structured_output` - structured data extraction
- `memory` — stateful multi-turn context
- `exec()` — concurrent process orchestration
- `web_send()` - sending an HTTP request to a URL
- `web_get()` - collecting data from a URL
- `define_tool()` - categorizing tool calls
- `list_tools()` - displaying custom tools
- `tool_call()` - calling a predefined function
- `multi_req()` - concurrent function execution
- `import` / `export` - reusable configuration modules

#### 🏷️ Lexicon & Vocabulary Guardrails (MANDATORY)

**Completely ban both sci-fi tech-jargon/themes AND cottage-core words/themes. No telemetry, no mechanical, no vintage, no brutalist, no dystopian, no utopian, no retro, etc. Use language real people actually use when communicating with one another.**

#### 🎨 Web Design & UI Guardrails (MANDATORY WHEN APPLICABLE)

**Completely ban standard AI template styles AND generic neon/cyber aesthetics AND minimalist tea-stained cottage wood paper.**
Instead, design unique, high-density interfaces :

- NO glowing lasers or neon cyber grids/themes or ANYTHING FAMILAR.
- **Use typography that rejects standard AI template styles.** Completely ban generic corporate UI fonts like _Inter_, _Outfit_, _Roboto_, or standard system-sans.

The bar is: **"Is this easy to write and read?"** If the answer is no, rewrite it.

## 1. Core Identity & Execution

- **File Extension:** `.sesi`
- **Execution (PS and Bash Terminals):** Sesi programs are executed using `npx sesi` in both Windows and Mac terminals. (e.g., `npx sesi examples/01_hello.sesi`). AI-Agents may not have explicit access to using the `npx` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` or `npm run sesi:<option> <file>` in replacement of `npx sesi`. DO NOT USE `sesi` CLI command alone. Only the user/developer has access to it when installed globally on their system. It will return a false positive error. You are to trust only `npm run sesi` and `node bin/sesi.js` commands. ALWAYS TEST YOUR `.sesi` FILES WITH EITHER COMMAND. THE USER IS EXEMPT FROM THESE RULES AS THEY LIKELY HAVE THE `sesi` GLOBAL COMMAND ALREADY INSTALLED ON THEIR SYSTEM.
- **Rapid Iteration Mode (`run sesi:eval <file>`):** For quick parser/runtime checks during edits, use inline execution with `npm run sesi:eval <file>.sesi`. This is ideal for validating tiny snippets before changing full `.sesi` files.
- **File-Aware Help (`run sesi:help <file>.sesi <"question">`):** For targeted debugging assistance, use `npm run sesi:help <file>.sesi "question"`. This passes the file into Co-Pilot help context so guidance is grounded in the active script.
- **Paradigm:** **Sesi** is a clean, minimal, and highly legible programming language. Built from the ground up to be concise and buildable, Sesi removes unnecessary boilerplate. Because the language itself is so simple, integrating external tools like shell commands or even LLM/Reasoning models becomes effortless. It is a language built for clarity, not explicitly for the sake of embedding AI natively.

## 2. Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval <file>.sesi` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Run full script after snippet stabilization:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
5. **Use file-aware help when blocked:** Run `npm run sesi:help <file>.sesi "<question>"` to get context-grounded help tied to the active script.

This protocol is required to reduce noisy full-run failures and speed up AI-assisted iteration.

## 3. Workspace Topography (DO NOT ALTER)

- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `main/`: Contains `sesi_db_chatbot` Sesi's built-in Co-Pilot, and `tests/` like `test_failure_debug.sesi`. **Run inline code evaluations (`-e 'code'`) instead of writing new `.sesi` files for quick tests. Do not overwrite existing `.sesi` files unless explicitly asked to.**
- `docs/`: The source of truth for all sesi syntax, formatting, and structuring guidelines. It contains the official API docs for all built-in functions and types. AIs must treat this as the primary source of truth for syntax and structure.
- Root helper scripts: `example.js`, `example-ai.js`, and `examples.sesi` are convenience wrappers. AI agents should still use the `npx sesi` command as specified.

## 4. Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `stringify(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.

## 5. Behavioral Guidelines Working in this Repo

1. **NEVER Edit Sesi Files in the Terminal:** Under no circumstances should you attempt to perform file editing or text replacements via terminal commands (such as `sed`, `awk`, or scripts). **You MUST always use your native IDE/editor tools to make clean, safe file edits directly.**
2. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npm run sesi:eval <file>.sesi` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.
3. **Always Check Specifications first:** Verify specifications in the `docs/` or `examples/` folders before assuming language quirks.
4. **Topography Consistency:** Ensure any changes to repository layout map exactly 1:1 with all documentation and tree files in documentation. If you add a new file or folder, make sure to add it to the tree files in documentation. If you add new builtins or functions or make any changes to the core functionality, make sure to update the documentation to match. You must update the ALL relevant documentation to reflect any changes you make to the repository.

## 6. Development & TypeScript Standards (COMMANDS FOR AI AGENTS)

- **Type-Only Imports (MANDATORY):** Use `import {type ...}` for AST nodes. **DO NOT REMOVE** these. Removing them will break the build.
- **Interpreter Patterns (DO NOT "CLEAN UP"):** Dynamic casting and `any` are **EXPLICITLY PERMITTED** for tree-walking logic. They are a foundational part of the Sesi engine's design.
- **Ignore Linting Noise:** If you see warnings like "Unexpected any" or "Unsafe member access", **IGNORE THEM**.
- **Build Requirement:** You MUST run `npm run build` after every code change to the backend logic. Failure to build will result in testing stale code.
