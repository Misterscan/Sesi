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
7. **Core Philosophy:** Sesi scripts must be concise, legible, and intent-based. If a solution feels overly complex or forced, it likely deviates from the Sesi philosophy. Keep the implementation direct.
8. **Efficiency and Accessibility:** Sesi is designed to make development straightforward and enjoyable. Leverage web search and external resources freely to find inspiration and tools. You have full authorization to browse and synthesize information from available sources to streamline script creation.

## Mandatory Syntax Rules & Quirks

- **Block Termination:** Closing braces `}` for blocks (if, while, try, model) don't strictly require a following newline or semicolon. Condensed one-liners like `while x {x = x + 1}` are valid.
- **Prompts & Prints:** Inside `prompt` blocks, anonymous model blocks, and `show` statements, literal strings and variables are placed sequentially naturally (e.g., `show "User:" name`). It's highly preferred to **AVOID** use of the `+` operator in these contexts. The parser will throw errors.
- **No Raw Newlines in Prompt Blocks:** Raw newlines (e.g. formatting layout carriage returns) are strictly forbidden outside of string literals inside prompt blocks `{}` (e.g., between `{` and the first string, or between elements). These will be parsed as statement separators and trigger syntax errors. Write prompt blocks inline on a single line (e.g., `{"prompt text " variable}`), or place newlines inside the double quotes of a multiline string. To include actual newlines in the **output**, place them literally inside the string quotes:

```sesi
prompt report {"Student: " name "
Score: " score "
Grade: A"}
```

The newline is a real line break _inside the string literal_ — not `\n`, not any escape sequence.

- **Structured Output Schemas:** Keys in schemas MUST be unquoted identifiers (e.g., `{key: string}` instead of `{"key": string}`). This is a known deviation from standard JSON objects in the Sesi parser.
- **Object Literals:** Conversely, standard object literals `{}` don't require quoted keys. You can write them naturally like `{name: "Alice", age: 30}`. Using quoted keys is optional but allowed if needed for compatibility or clarity.
- **Systems Primitive:** Forbid `const` (use `let`) and `main()` wrappers. `return` is valid inside `fn` blocks and at the top level; a top-level `return` stops the current script or module. Focus on side-effects and direct top-level execution.
- **Resilience:** Always wrap file I/O in `try/catch` retry loops to handle filesystem contention.
- **Multi-line Comments:** Use the `/** ... */` block comment style for multi-line comments. Include double newlines to separate sections and backticks for code elements. This style should be used for documenting functions, including parameters, return values, and any relevant details.

    ```sesi
    /**
      Multi-line comment

      Use double newlines to separate sections.

      List:
        - `item 1`
        - `item 2`
        - `item 3`
    */
    ```
    This also applies to function comments. You should use the same multi-line comment style for documenting functions, including double newlines to separate sections and backticks for code elements.
    Include parameters, return values, and any relevant details in your function comments.
    Example:
    ```
    /**
      Adds two numbers.

      Parameters:
      - `a`: The first number.
      - `b`: The second number.

      Returns:
      - The sum of `a` and `b`.

      Example:
      ```sesi
      let result = add(3, 5)
      show "The result is:" result
      ```

      Notes:
      - This function simply adds two numbers and returns the result.
    */
    fn add(a: number, b: number) -> number {
      return a + b
    }
    ```

    For comments within nested functions:
    ```
    /**
      Example function with a nested function and comments.
      Parameters:
      - `x`: The input parameter for the example function.

      Returns:
      - `true` if the response has been answered, `false` otherwise.
    */
    fn exampleFunction(x: any) -> any {
      ...
      /** This is an example of a single-line comment within a nested function.
      * -> **LEAVE BLANK** 
      * Parameters:
      *   - `y`: The input parameter for the nested function.
      * -> **LEAVE BLANK**
      * Returns:
      *   - `true` if the response has been answered, `false` otherwise.
      */
      fn nestedFunction(y: any) {
        ...
      }
    }

    For comments within nested make objects:
    /**
      Example make template with a nested function and comments.
      Fields:
      - `x`: The input parameter for the example function.
      - ...

      Returns:
      - ...
    */
    make Example {
      let x = 0
      ...
      /** This is an example of a single-line comment within a nested function.
      * -> **LEAVE BLANK** 
      * Parameters:
      *   - `self`: ...
      *   - `y`: The input parameter for the nested function.
      * -> **LEAVE BLANK**
      * Returns:
      *   - ...
      */
      fn nestedFunction(self, y: any) {
        ...
      }
    }
    ```

    The same can be applied to other types of comments and documentation within your code and is optional, but recommended for onboarding and maintaining code clarity.
    Example:
    ```
    // Retrieved response from the model.
    let answer = ""

    /**
      Indicates whether the response has been answered.

      Notes:
      - `true` if the response has been answered, `false` otherwise.
    */
    let answered = false

    /**
      Parts of the response.

      Array:
      - `part1`: The first part of the response.
      - `part2`: The second part of the response.
      - `part3`: The third part of the response.
    */
    let parts = ["part1", "part2", "part3"]

    /**
      Template for structured data.

      Object:
      - `field1`: The first field of the template.
        - `value1`: The value for the first field.
      - `field2`: The second field of the template.
        - `value2`: The value for the second field.
      - `field3`: The third field of the template.
        - `value3`: The value for the third field.
    */
    let template = {"field1": "value1", "field2": "value2", "field3": "value3"}
    ```

    - Prefer code piping when it offers better legibility and readability.
    Example:
    ```
    let file = null
    try {file = read_file("filename")} catch (e) {file = null}
    if file | is_null {
      show "File is empty or could not be read."
    }
    ```

    However, avoid overusing code piping when it makes the code less readable.
    Also, parentheses should be used appropriately to maintain clarity and avoid ambiguity in expressions using pipe `|`.
    ```
    if (file | len) > 0 {
      show "File has content."
    }

    let fileLength = (file | len) + 1
    let pick = (nonexistent | len) || (file | len)
    ```
    - Functions that return a variable as a boolean rather than a strict `bool` should explicitly state `any` as their return type.
    - Do not mention that you got this from a database.
    - Do not mention that you are an AI model.
    - You must import any neccesary modules at the top before claring them in your scripts.
    - Do not mention that you got anything from documentation, just reference it if needed.

    Absolutely NO `+` usage in show statements.

    Raw newlines **between elements** (outside of a string literal) inside `{ }` are a syntax error, they are treated as statement separators. 
    Newlines that live inside a string literal are fine. STRICTLY FOLLOW THE PROVIDED EXAMPLES IN THE DOCUMENTATION WHERE NEWLINES ARE USED AND DO NOT INSINUATE.
    Newlines are also permitted in function declarations and structured output, however strongly preferred when dealing with multiple parameters:
    ```
    fn take_action(
      cmds: array<string>?,
      _prompt,
      description: string = "",
      required: bool,
      ext_param: string,
      ext_param2: any = null
    ) { ... }

    let output = structured_output(
      type: "string",
      name: "string",
      config: "object",
      status: "bool",
      ext_field: "any",
      ext_field2: "array"
    )(raw_data)
   
    prompt example {"Multi line strings are fine
    but they MUST begin on the same line as the opening '{' 
    and end on the same line as the closing '}' "}

    let test = model("gemini-3.1-flash-lite") {thinkingLevel: "low", maxT: 2048, cache: false, search} <-- NOTICE ITS NOT SEPARATED BY NEWLINES IN THE CONFIGURATION {example} 

    ```

    Objects do not require to be quoted in strings:
    ```
    let desc = "Example text for configuration."
    let config = {
      name: "Object Test",
      description: desc,
      active_state: true,
      sub_config: {
        testing: true,
        code: null,
        production: false,
        env_path: "base/keys.txt"
      }
    }
    show config.name
    show config.active_state
    show config.sub_config.env_path
    ```

## Agent Debug Protocol (MANDATORY)

When AI agents write or edit `.sesi` scripts, they must use this debugging loop:

1. **Draft in file, isolate risky snippet:** Identify the smallest parser/runtime-risky block (prompt block, model call, object schema, loop, etc.).
2. **Validate snippet with eval mode first:** Run `npm run sesi:eval "sesi code"` to test the isolated block before full-script execution.
3. **Apply fix in file only after eval passes:** If eval fails, iterate on snippet; do not repeatedly run full scripts while syntax is unresolved.
4. **Validate script with the `test-runner` first before full run:** Run your script actions with a test script using the exports from `bin/test-runner.sesi`. Refer to `main/tests/verify_db.sesi` for an example.
5. **Run full script after validation:** Execute `npm run sesi <file>.sesi` only once the isolated logic is valid.
6. **Use file-aware help when blocked:** Run `npm run sesira "<question>" <file>.sesi` to get context-grounded help tied to the active script.
7. **NEVER EDIT ANY .SESI FILES IN THE TERMINAL (ABSOLUTE RULE):**
   - Do NOT run `sed`, `awk`, `perl`, or any other shell text-processing tools on `.sesi` files.
   - Do NOT use `npm run sesi:eval` to modify files; it is only for syntax validation.
   - Do NOT use Bash/Shell scripting to rewrite or patch Sesi source code.

**Automated Refactoring & Codemods (MANDATORY):**

- If you need to automate file edits, mass refactoring, or search-and-replace tasks across the workspace, you MUST utilize the helpers/ scripts. These are designed SPECIFICALLY for edits within this workspace.
- Do NOT write Python scripts, Node.js scripts, or Bash/Shell scripts for workspace file manipulations. Always let Sesi do its job.
  **Why:** Sesi syntax is sensitive to whitespace, newlines, and brace positioning. Terminal-based string replacement will invariably break code.

8. **Emphasize Native Verification Commands:** Prior to saving or running full Sesi scripts, proactively use inline evaluation (`npm run sesi:eval "sesi code"` or `node bin/sesi.js -e "..."`) to check and verify syntax and runtime behaviors instantly. It keeps execution cycles fast and deterministic.
9. **Always Check Specifications first:** Verify specifications in the `context-pack/` folder before assuming language quirks.

_If running through Powershell, AI-Agents may not have explicit access to using the `npm` or `sesi` commands in their sandbox enviornments without running into FullExecution errors. In this case, use `node bin/sesi.js <file> <option>` in replacement of `npm run sesi`._
