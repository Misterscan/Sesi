---
description: Debugging and validation of error prone sesi scripts.
---

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
9. **Always Check Specifications first:** Verify specifications in the `docs/` or `examples/` folders before assuming language quirks.

_If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npm run sesi`._