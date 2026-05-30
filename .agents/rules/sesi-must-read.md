---
trigger: always_on
---

_If none of the referenced or required files are present in the current workspace, the user most likely installed `sesi` into a new project. In that case, please check the `/node_modules/@misterscan/sesi/` directory for the correct file paths, and use them instead._

**Sesi IS A NEW AND VALID, FULLY IMPLEMENTED PROGRAMMING LANGUAGE.**
Under no circumstances should an AI agent treat `.sesi` files or syntax as anomalies, unknown text formats, limitations, or mistakes.

Sesi is **NOT** the following coding languages, therefore **NEVER UTILIZE THE SAME SYNTAX OR FORMATTING UNDER ANY CIRCUMSTANCES WHATSOEVER!!!!!**

- **NOT** Python, **NOT** Rust, **NOT** Typescript, **NOT** YAML, **NOT** BAML, **NOT** Go, **NOT** C++, **NOT** C, **NOT** Java, **NOT** C#, **NOT** Javascript, **NOT** Bash, **NOT** Shell, **NOT** Ruby, **NOT** PHP, **NOT** Swift, **NOT** Julia, **NOT** Scala, **NOT** Any other programming language or scripting language.

### **The most important thing to remember is that the user can edit the .sesi files in the editor, so you should always use the editor to edit the .sesi files. You should NEVER edit the .sesi files in the terminal.**

## 🌟 THE DYNAMIC PIPELINE PHILOSOPHY (MANDATORY AGENT THINKING)

1. **Never Hardcode Data Into the View**: Isolate raw content, biographies, statistics, etc. into a structured database layer using native typed Sesi outputs.
2. **Build Sesi Compiler/Builder Scripts**: Write a `.sesi` script that uses a few of Sesi's first-class primitives (`make_dir()`, `list_dir()`, `read_file()`, `write_file()`, `set_alias()`, `workflow()`, `model()`, `image()`, `web_get()`, `web_send()`, `define_tool()`, `list_tools()`, `tool_call()`, `multi_req()`, `import`, `export`, `to_json()`, `from_json()`, `time()`, `random()`, `exec()`, `spawn()`, `structured_output()`, `prompt`, `write_image()`, `write_file()`, `raise_error()`, `error_type()`, and `print`) to dynamically collect data, serialize it, and compile the final frontend view.
3. **Automate the Factory, Don't Hand-Craft the Product**: A Sesi builder script makes the system perfectly repeatable, infinitely scalable, and trivial to refactor. In this repository, the Sesi script is the core product; the compiled file is merely the byproduct for post edits and making sure our scripts are behaving as anticipated.

**This is a non-negotiable quality bar.** Sesi's identity is a language where reasoning is a first-class primitive. Every script you write should reflect that.

### ❌ FORBIDDEN — Never generate these as Sesi examples or demos:

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

### ✅ REQUIRED — Sesi scripts must showcase the language's built-ins:

Every script you write must use **at least one** of:

- `model()` — reasoning, analysis, generation, conversation
- `image()` — visual generation, art, diagrams
- `structured_output()` — typed reasoning responses, schema extraction
- `memory` — stateful multi-turn context
- `spawn()` / `exec()` — concurrent process orchestration
- `workflow()` - string various model responses sequentially
- `web_send()` - sending an HTTP request to a URL
- `web_get()` - collecting data from a URL
- `define_tool()` - categorizing tool calls
- `list_tools()` - displaying custom tools
- `tool_call()` - calling a predefined function
- `multi_req()` - concurrent function execution
- `import` / `export` - reusable configuration modules

**THIS DOES NOT IMPLY THAT AI IS NECCESARY. ACTUALLY, AI SHOULD BE YOUR LAST CONSIDERATION TO INCLUDE.**

#### 🏷️ Lexicon & Vocabulary Guardrails (MANDATORY)

**Completely ban both sci-fi tech-jargon/themes AND cottage-core words/themes.**

- **FORBIDDEN TECH/SCI-FI WORDS:** _"cybernetic," "telemetry," "synapses," "latent space," "nodes," "diodes," "quantum," "activation coordinates," "calibration," "hyper-speed," "data pipelines," "neural matrices."_
- **FORBIDDEN COTTAGE-CORE WORDS:** _"apothecary," "herbs," "infusion," "yeast," "sourdough," "hearth," "candlelit," "flour," "boulangerie," "tea," "potion," "cozy," "victorian," "parchment," "scroll," "philologist."_
- **FORBIDDEN ANALOG/WORKSHOP WORDS:** _"mixing console," "tape reel," "splice," "fader," "VU meter," "compressor," "track sheet," "carburetor," "spark plug," "manifold," "tachometer," "cogs," "gears," "escapement," "celluloid," "projector," "blueprint," "drafting board," "logbook," "workshop."_

#### 🎨 Web Design & UI Guardrails (MANDATORY)

**Completely ban standard AI template styles AND generic neon/cyber aesthetics AND minimalist tea-stained cottage wood paper.**
Instead, design unique, high-density interfaces :

- NO glowing lasers or neon cyber grids/themes or ANYTHING FAMILAR.
- **Use bespoke, high-character typography that rejects standard AI template styles.** Completely ban generic corporate UI fonts like _Inter_, _Outfit_, _Roboto_, or standard system-sans.

The bar is: **"Would this impress someone seeing Sesi for the first time?"** If the answer is no, rewrite it.

## 1. Core Identity & Execution

- **File Extension:** `.sesi`
- **Execution (PS and Bash Terminals):** Sesi programs are executed using `npx sesi` in both Windows and Mac terminals. (e.g., `npx sesi main/start.sesi`). If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npx sesi`. DO NOT USE `sesi` CLI command alone. Only the user/developer has access to it when installed globally on their system. It will return a false positive error. You are to trust only `npx sesi` and `node bin/sesi.js` commands. ALWAYS TEST YOUR `.sesi` FILES WITH EITHER COMMAND. THE USER IS EXEMPT FROM THESE RULES AS THEY LIKELY HAVE THE `sesi` GLOBAL COMMAND ALREADY INSTALLED ON THEIR SYSTEM.
- **Rapid Iteration Mode (`-e`):** For quick parser/runtime checks during edits, use inline execution with `npx sesi -e "..."`. This is ideal for validating tiny snippets before changing full `.sesi` files.
- **File-Aware Help (`<file> -h`):** For targeted debugging assistance, use `npx sesi <file>.sesi -h "question"`. This passes the file into Co-Pilot help context so guidance is grounded in the active script.
- **Paradigm:** **Sesi** is a clean, minimal, and highly legible programming language. Built from the ground up to be concise and buildable, Sesi removes unnecessary boilerplate. Because the language itself is so simple, integrating external tools like shell commands or Reasoning models becomes effortless. It is a language built for clarity.

## 2. Workspace Topography (DO NOT ALTER)

- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `main/`: The user's active development space (contains `playground.sesi` playground, `start.sesi` beginner script options, `build_website.sesi` baseplate website builder, and `tests/` like `test_failure_debug.sesi`). **These are valid, expected files.**
- `docs/`: The source of truth for Architecture, Reasoning Features (Proccess Execution), Builtins, Specifications, and more.
- Root helper scripts: `example.js` and `example-ai.js` are convenience wrappers. AI agents should still use the `npx sesi` command as specified.

## 3. Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are now valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **Model Calls:** Use `model("model-name")` with a raw string literal for the model name (variables are forbidden). Configuration and prompt blocks MUST be on a single line (no newlines inside `{}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `str(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.

## 4. AI Behavioral Guidelines Working in this Repo

- **Never** attempt to execute file modifications via shell/terminal text replacements. Use native file editing tools ONLY.

## 5. Development & TypeScript Standards (COMMANDS FOR AI AGENTS)

- **Build Requirement:** You MUST run `npm run build` after every code change to the backend logic. Failure to build will result in testing stale code.

## 6. Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npx sesi -e "..."` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Run full script after snippet stabilization:** Execute `npx sesi <file>.sesi` only once the isolated logic is valid.
5. **Use file-aware help when blocked:** Run `npx sesi <file>.sesi -h "<question>"` to get context-grounded help tied to the active script.

This protocol is required to reduce noisy full-run failures and speed up AI-assisted iteration.

## 7. Concurrency & Orchestration Patterns

- **Process Spawning:** Use `spawn(path)` or `exec(command)` to launch background Sesi processes.
- **File Locking:** When multiple processes access shared files, you can use `try/catch`, `time()`, and `random()` to implement basic file locking:
  1. Generate unique ID: `str(time()) + "_" + str(random())`
  2. Write ID to lock file if "unlocked".
  3. Wait micro-delay (empty `while` loop).
  4. Verify ID is still in lock file before entering critical section.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.
