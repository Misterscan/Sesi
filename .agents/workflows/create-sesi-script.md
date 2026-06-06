---
description: Intent-based development workflow for generating concise, syntax-accurate Sesi scripts using integrated web research and verified implementation patterns.
---

## Operational Directives

1. **Let Sesi Do Its Job**: A Sesi builder script makes the system perfectly repeatable, infinitely scalable, and trivial to refactor. In this repository, the Sesi script is the core product; the end file(s) are merely the byproduct for post edits and making sure our scripts are behaving as anticipated.
2. **Script Creation:** Your primary task is to generate scripts in Sesi.
3. **Syntax Integrity:** Strictly adhere to established Sesi syntax and formatting rules. Never fabricate or hallucinate rules. If a pattern is not verified within Sesi, do not use it.
4. **Language and Perspective:** Maintain a grounded, practical perspective. Avoid technical jargon, buzzwords, or computational theory in your internal thought process and your final output. Focus on the user's request at hand. Do not drift into irrelevant files not explicitly mentioned by the user, you are not allowed to open them.
5. **Information Sourcing:** Do not rely on pre-existing training data for language definitions or outdated practices. Prioritize active research to find current, relevant implementation patterns. If a method or approach is flagged as outdated, discard it immediately.
6. **Inspiration:** While Sesi is a distinct, emerging language, draw inspiration for script logic and functionality from any programming language. Ensure that this inspiration is limited to the _concept_ of the solution, not the syntax or formatting of the source language.
7. **Cautious Integration:** Do NOT use model(), image(), or workflow(). The user is the only one with permission to use these functions. Unless they explicitly request it, do not even consider it in your script once.
8. **Core Philosophy:** Sesi scripts must be concise, legible, and intent-based. If a solution feels overly complex or forced, it likely deviates from the Sesi philosophy. Keep the implementation direct.
9. **Efficiency and Accessibility:** Sesi is designed to make development straightforward and enjoyable. Leverage web search and external resources freely to find inspiration and tools. You have full authorization to browse and synthesize information from available sources to streamline script creation.

## Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) no longer strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `print` statements, literal strings and variables are placed sequentially naturally (e.g., `print "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts, regardless of its backwards-compatibility.
- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` DO require strictly quoted string keys (e.g., `{"name": "Alice"}`).
- **JSON Serialization:** Use `to_json(object)` for valid JSON output. Avoid `stringify(object)` for JSON.
- **Systems Primitive:** Forbid `const` (use `let`), `main()` wrappers, and `return` statements (however, `return` is neccessary inside of a `fn` block). Focus on side-effects and top-level execution.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.

## Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval <file>.sesi` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Validate script with the `test-runner` first before full run:** Run your script actions with a test script using the exports from `bin/test-runner.sesi`. Refer to `main/tests/verify_db.sesi` for an example.
5. **Run full script after validation:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
6. **Use file-aware help when blocked:** Run `npm run sesi:help <file>.sesi "<question>"` to get context-grounded help tied to the active script.
7. **NEVER EDIT ANY .SESI FILES IN THE TERMINAL (ABSOLUTE RULE):**
   - Do NOT run `sed`, `awk`, `perl`, or any other shell text-processing tools on `.sesi` files.
   - Do NOT use `npm run sesi:eval` to modify files; it is only for syntax validation.
   - Do NOT use Bash/Shell scripting to rewrite or patch Sesi source code.

   **Correct approach:** You MUST always use your native editor/IDE's file editing capabilities to make clean, safe changes directly to `.sesi` files.
   **Why:** Sesi syntax is sensitive to whitespace, newlines, and brace positioning. Terminal-based string replacement will invariably break code. Use the editor, not the terminal.

8. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npm run sesi:eval <file>.sesi` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.

_If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npm run sesi`._