---
description: Debugging and validating sesi scripts.
---

### **The most important thing to remember is that the user can edit the .sesi files in the editor, so you should always use the editor to edit the .sesi files. You should NEVER edit the .sesi files in the terminal.**

## Agent Debug Protocol

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npx sesi -e "..."` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Run full script after snippet stabilization:** Execute `npx sesi <file>.sesi` only once the isolated logic is valid.
5. **Use file-aware help when blocked:** Run `npx sesi <file>.sesi -h "<question>"` to get context-grounded help tied to the active script.

_If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npx sesi`._
