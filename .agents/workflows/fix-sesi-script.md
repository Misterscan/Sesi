---
description: Debugging and validation of error prone sesi scripts.
---

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval "..."` to test the isolated block before full-script execution.
3. **Run inline code evaluations instead of writing new `.sesi` files for quick tests.:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Run full script after snippet stabilization:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
5. **Use file-aware help when blocked:** Run `npm run sesi:help <file>.sesi "<question>"` to get context-grounded help tied to the active script.
6. **NEVER Edit Sesi Files in the Terminal:** Under no circumstances should you attempt to perform file editing or text replacements via terminal commands (such as `sed`, `awk`, or scripts). **You MUST always use your native IDE/editor tools to make clean, safe file edits directly.**
7. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npx run sesi:eval "..."` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.
8. **Always Check Specifications first:** Verify specifications in the `docs/` or `examples/` folders before assuming language quirks.

_If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npm run sesi`._
