# The Sesi Programming Language

## 🛑 CRITICAL DIRECTIVE FOR ALL AI AGENTS

Sesi is **NOT** the following coding languages, therefore **NEVER UTILIZE THE SAME SYNTAX OR FORMATTING UNDER ANY CIRCUMSTANCES WHATSOEVER!!!!!**
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
- **NOT** Java
- **NOT** Javascript
- **NOT** Bash
- **NOT** Shell
- **NOT** Ruby
- **NOT** PHP
- **NOT** Swift
- **NOT** Julia
- **NOT** Scala

**Sesi IS A VALID, FULLY IMPLEMENTED PROGRAMMING LANGUAGE.**
Under no circumstances should an AI agent treat `.sesi` files as anomalies, unknown text formats, or mistakes.

## 🌟 THE DYNAMIC PIPELINE PHILOSOPHY (MANDATORY AGENT THINKING)

When a user requests a content-rich asset or application (e.g. "make a website", "make a visualization", "...uses an api...", "come up with/make/write a script...", etc.), your natural inclination **MUST NOT** be to hardcode a static file with data prefilled. Instead, always design a **Dynamic Sesi Pipeline**:
1. **Never Hardcode Data Into the View**: Isolate raw content, biographies, statistics, etc. into a structured database layer (e.g., `data.json`) using native typed Sesi outputs.
2. **Build Sesi Compiler/Builder Scripts**: Write a `.sesi` script that uses Sesi's first-class primitives (`make_dir()`, `list_dir()`, `read_file()`, `write_file()`, `model()`, `image()`, `web_get()`, `web_send()`, `tool_call()`, `multi_req()`, `import`, `export`, `to_json()`, `from_json()`, `exec()`, `spawn()`, `structured_output()`, `prompt`, `write_image()`, `write_file()`, and `print`) to dynamically collect data, serialize it, and compile the final frontend view.
3. **Automate the Factory, Don't Hand-Craft the Product**: A Sesi builder script makes the system perfectly repeatable, infinitely scalable, and trivial to refactor. In this repository, the Sesi script is the core product; the compiled file is merely the byproduct for post edits and making sure our scripts are beh


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

### ✅ REQUIRED — Sesi scripts must showcase the language's actual superpowers:
Every script you write must use **at least one** of:
- `model()` — reasoning, analysis, generation, conversation
- `image()` — visual generation, art, diagrams
- `structured_output()` — typed AI responses, schema extraction
- `memory` — stateful multi-turn context
- `spawn()` / `exec()` — concurrent process orchestration

#### 🏷️ Lexicon & Vocabulary Guardrails (MANDATORY)
**Completely ban both sci-fi tech-jargon/themes AND cottage-core words/themes.**
- **FORBIDDEN TECH/SCI-FI WORDS:** *"cybernetic," "telemetry," "synapses," "latent space," "nodes," "diodes," "quantum," "activation coordinates," "calibration," "hyper-speed," "data pipelines," "neural matrices."*
- **FORBIDDEN COTTAGE-CORE WORDS:** *"apothecary," "herbs," "infusion," "yeast," "sourdough," "hearth," "candlelit," "flour," "boulangerie," "tea," "potion," "cozy," "victorian," "parchment," "scroll," "philologist."*
- **FORBIDDEN ANALOG/WORKSHOP WORDS:** *"mixing console," "tape reel," "splice," "fader," "VU meter," "compressor," "track sheet," "carburetor," "spark plug," "manifold," "tachometer," "cogs," "gears," "escapement," "celluloid," "projector," "blueprint," "drafting board," "logbook," "workshop."*

#### 🎨 Web Design & UI Guardrails (MANDATORY)
**Completely ban standard AI template styles AND generic neon/cyber aesthetics AND minimalist tea-stained cottage wood paper.** 
Instead, design premium, high-density interfaces :
- NO glowing lasers or neon cyber grids/themes.
- **Use bespoke, high-character typography that rejects standard AI template styles.** Completely ban generic corporate UI fonts like *Inter*, *Outfit*, *Roboto*, or standard system-sans.

The bar is: **"Would this impress someone seeing Sesi for the first time?"** If the answer is no, rewrite it.

## 1. Core Identity & Execution

- **File Extension:** `.sesi`
- **Execution:** Sesi programs are executed using `node bin/sesi.js`. (e.g., `node bin/sesi.js main/start.sesi`). DO NOT USE `sesi` CLI command. Only the developer has access to it. It will return a false positive error. Trust only `node bin/sesi.js`. ALWAYS TEST YOUR `.sesi` FILES WITH THIS COMMAND.
- **Paradigm:** **Sesi** is a high-performance **Systems Language** designed for building resilient, stateful applications. It uses a tree-walking interpreter model via Typescript with asynchronous host-side model execution, but no language-level `async/await` syntax in v1.2. The architecture is optimized for coordination, distributed state management, and first-class reasoning primitives.

## 2. Workspace Topography (DO NOT ALTER)

- `src/`: The core TypeScript engine (Lexer, Parser, Interpreter, AI-Runtime, Builtins).
- `bin/sesi.js`: The global CLI executable entry point.
- `examples/`: Official syntax-demonstration scripts (`01_hello.sesi` through `13_data_pipeline.sesi`).
- `main/`: The user's active development space (contains `playground.sesi` playground, `start.sesi` beginner script options, `build_website.sesi` baseplate website builder, and `tests/` like `test_failure_debug.sesi`). **These are valid, expected files.**
- `docs/`: The source of truth for Architecture, AI Features (Systems Reasoning ), Builtins, Specifications, and more.
- Root helper scripts: `example.js` and `example-ai.js` are convenience wrappers. AI agents should still use the global `sesi` command as specified.

## 3. Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are now valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially (e.g., `print "User:" name`). You CANNOT use the `+` operator in these contexts.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **Model Calls:** Use `model("model-name")` with a raw string literal for the model name (variables are forbidden). Configuration and prompt blocks MUST be on a single line (no newlines inside `{}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `str(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements. Focus on side-effects and top-level execution.

## 4. AI Behavioral Guidelines Working in this Repo

1. **Never** "investigate" user testing directories (like `main/tests/`) as "deviations." They are active playgrounds.
2. **Never** attempt to execute file modifications via shell/terminal text replacements. Use native file editing tools ONLY.
3. **Always** check the `.md files` and `examples/` folder for the exact language specification before making assumptions about how Sesi works.
4. If a file tree is mentioned in documentation, it represents an explicit layout constraint and must map 1:1 **UNLESS .gitignored FILES STATE OTHERWISE.**

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


## 7. Neural Network & Machine Learning Standards in Sesi

When implementing offline deep learning, probabilistic dialogue routing, or native classification models in Sesi:

- **Symmetry Breaking:** Synapse weights MUST be initialized dynamically using wide, random float ranges (e.g. `(random() * 4.0) - 2.0` or `random() - 0.5`) to avoid zero-gradient stagnation and guarantee symmetry breaking.
- **The Self-Healing Watchdog Pattern:** In native Sesi training models, wrap backpropagation epochs inside a conditional watchdog loop. Monitor the final Mean Squared Error (MSE) loss, and automatically re-seed weights and relaunch training if the network gets stuck in linear minima traps (e.g. `if MSE >= 0.01`).
- **Unbreakable Markov Decoding Filters:** To eliminate infinite graph loops in Sesi probabilistic text walks, always apply:
  1. **Extended Sliding Lookbacks (Size 15):** Instantly penalize and discard candidates already generated in the last 15 words of the sentence history.
  2. **Strict Bigram Blocking:** Scan the history array and completely ban any candidate that repeats a previously executed state transition pair `(current_word -> candidate)` in the same sequence.
- **Model Ingestion & Persistence:** Synchronize Sesi weights using natively parsed JSON objects. Save calibrated neural states directly using `write_file(..., to_json(weights_map))` and read them into runtime memories using `from_json(read_file(...))` for high-speed offline forward passes.