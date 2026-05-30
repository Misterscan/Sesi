---
description: Create a script using sesi.
---

### **The most important thing to remember is that the user can edit the .sesi files in the editor, so you should always use the editor to edit the .sesi files. You should NEVER edit the .sesi files in the terminal.**

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

## Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are now valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **Model Calls:** Use `model("model-name")` with a raw string literal for the model name (variables are forbidden). Configuration and prompt blocks MUST be on a single line (no newlines inside `{}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `str(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.

## Behavioral Guidelines

- **Never** attempt to execute file modifications via shell/terminal text replacements. Use native file editing tools ONLY.
