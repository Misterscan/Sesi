    const lessons = [
      {
        id: "first-program",
        unit: "Start here",
        title: "Your first Sesi program",
        time: "5 min",
        level: "Core",
        summary: "Meet Sesi’s statement-oriented syntax, run a program, and learn how values reach the terminal.",
        goals: [
          "Run a complete .sesi program",
          "Use show with one or many values",
          "Recognize newlines as statement boundaries"
        ],
        concepts: [
          {
            title: "Statements stay small",
            body: "A Sesi file is a sequence of statements. A newline normally finishes a statement, so semicolons are optional in regular files."
          },
          {
            title: "Printing is intentionally direct",
            body: "Write <code>show</code> followed by values. Sesi inserts spaces between them: <code>show \"Score:\" 42</code>."
          }
        ],
        challenge: "Change the second show statement so the program introduces Sesi and reports version 1.9.0 exactly as shown in Expected output.",
        hint: "Pass three values to show: the label, the language name, and the version string.",
        starter: String.raw`// Comments begin with two slashes.
show "Hello from Sesi!"
show "Language:" "Sesi" "version 1.0"`,
        solution: String.raw`// Comments begin with two slashes.
show "Hello from Sesi!"
show "Language:" "Sesi" "version 1.9.0"`,
        expected: "Hello from Sesi!\nLanguage: Sesi version 1.9.0"
      },
      {
        id: "values-variables",
        unit: "Language foundations",
        title: "Values, variables, and operators",
        time: "8 min",
        level: "Core",
        summary: "Store data with let, update bindings, inspect types, and combine values with arithmetic and comparison operators.",
        goals: [
          "Declare and reassign variables",
          "Work with numbers, strings, booleans, and null",
          "Use arithmetic, comparison, and logical operators"
        ],
        concepts: [
          {
            title: "Bindings use let",
            body: "Declare a name with <code>let total = 0</code>. Reassign it later with <code>total = total + 1</code>; do not repeat <code>let</code>."
          },
          {
            title: "Types are values you can inspect",
            body: "Sesi has <code>number</code>, <code>string</code>, <code>bool</code>, <code>null</code>, <code>array</code>, and <code>object</code> values. The <code>type()</code> builtin reports the runtime type."
          },
          {
            title: "Operators read conventionally",
            body: "Use <code>+ - * / %</code> for math, <code>== != &lt; &lt;= &gt; &gt;=</code> for comparisons, and <code>&amp;&amp; || !</code> for logic."
          }
        ],
        challenge: "Set quantity to 4 and unit_price to 12.5. Compute subtotal rather than hard-coding it, then make is_large true using a comparison.",
        hint: "Multiply quantity by unit_price. Compare subtotal with 40.",
        starter: String.raw`let quantity = 2
let unit_price = 10
let subtotal = 0
let is_large = false

show "Subtotal:" subtotal
show "Large order?" is_large
show "Subtotal type:" type(subtotal)`,
        solution: String.raw`let quantity = 4
let unit_price = 12.5
let subtotal = quantity * unit_price
let is_large = subtotal > 40

show "Subtotal:" subtotal
show "Large order?" is_large
show "Subtotal type:" type(subtotal)`,
        expected: "Subtotal: 50\nLarge order? true\nSubtotal type: number"
      },
      {
        id: "strings-prompts",
        unit: "Language foundations",
        title: "Strings and prompt templates",
        time: "8 min",
        level: "Core",
        summary: "Transform text with builtins and use prompt blocks as readable, composable string templates.",
        goals: [
          "Transform and inspect strings",
          "Compose text without noisy concatenation",
          "Understand that prompt blocks are ordinary strings"
        ],
        concepts: [
          {
            title: "Text helpers cover common work",
            body: "Useful builtins include <code>trim</code>, <code>to_upper</code>, <code>to_lower</code>, <code>contains</code>, <code>split</code>, <code>join</code>, and <code>swap</code>."
          },
          {
            title: "Prompts are not inherently AI",
            body: "A <code>prompt</code> block composes strings and expressions. You can print it, save it, or later pass it to a model. The language’s reasoning features remain optional."
          }
        ],
        challenge: "Normalize the padded name, then finish the greeting prompt so its output matches the target.",
        hint: "Use trim(raw_name), then place normalized and role inside the prompt block.",
        starter: String.raw`let raw_name = "  Ada  "
let normalized = raw_name
let role = "engineer"

prompt greeting {"Welcome, " normalized ". Role: " role}
show greeting
show "Uppercase:" to_upper(normalized)`,
        solution: String.raw`let raw_name = "  Ada  "
let normalized = trim(raw_name)
let role = "engineer"

prompt greeting {"Welcome, " normalized ". Role: " role}
show greeting
show "Uppercase:" to_upper(normalized)`,
        expected: "Welcome, Ada. Role: engineer\nUppercase: ADA"
      },
      {
        id: "collections-json",
        unit: "Language foundations",
        title: "Arrays, objects, and JSON",
        time: "10 min",
        level: "Core",
        summary: "Model ordered collections and named records, mutate them, and cross the JSON boundary safely.",
        goals: [
          "Read and update arrays and objects",
          "Use collection helpers",
          "Serialize and parse JSON"
        ],
        concepts: [
          {
            title: "Arrays are zero-indexed",
            body: "Create arrays with <code>[]</code>, read items with <code>items[0]</code>, and use <code>push</code>, <code>pop</code>, <code>slice</code>, or <code>len</code>."
          },
          {
            title: "Objects use keys",
            body: "Object literals look like JSON. Read or update a field with <code>user.name</code>. Use <code>keys()</code> and <code>values()</code> to inspect records."
          },
          {
            title: "JSON helpers preserve structure",
            body: "<code>to_json(value)</code> serializes data and <code>from_json(text)</code> parses it back into Sesi values."
          }
        ],
        challenge: "Add \"test\" to the stages array and update the project status to \"ready\" before printing.",
        hint: "Use push(stages, \"test\") and assign project.status.",
        starter: String.raw`let stages = ["lint", "build"]
let project = {name: "Sesi", status: "draft"}

// Add one stage and update one object field.

show "Stages:" join(stages, " -> ")
show "Project:" project.name
show "Status:" project.status
show "Stage count:" len(stages)`,
        solution: String.raw`let stages = ["lint", "build"]
let project = {name: "Sesi", status: "draft"}

push(stages, "test")
project.status = "ready"

show "Stages:" join(stages, " -> ")
show "Project:" project.name
show "Status:" project.status
show "Stage count:" len(stages)`,
        expected: "Stages: lint -> build -> test\nProject: Sesi\nStatus: ready\nStage count: 3"
      },
      {
        id: "conditionals",
        unit: "Control flow",
        title: "Make decisions with conditionals",
        time: "8 min",
        level: "Core",
        summary: "Branch on data with if, else if, and else while keeping conditions free of extra punctuation.",
        goals: [
          "Write multi-branch conditionals",
          "Combine conditions safely",
          "Understand truthy values and short-circuit logic"
        ],
        concepts: [
          {
            title: "No parentheses required",
            body: "Write <code>if score &gt;= 90 { ... }</code>. Braces define each branch; <code>else if</code> adds intermediate cases."
          },
          {
            title: "Logical operators short-circuit",
            body: "With <code>&amp;&amp;</code>, the right side runs only when the left is true. With <code>||</code>, it runs only when the left is false."
          }
        ],
        challenge: "Complete the middle branch so a score from 80 through 89 receives B. Keep the remaining C fallback.",
        hint: "The earlier A branch already excludes scores 90 and above, so the middle condition only needs score >= 80.",
        starter: String.raw`let score = 86
let grade = "?"

if score >= 90 {
  grade = "A"
} else if false {
  grade = "B"
} else {
  grade = "C"
}

show "Score:" score
show "Grade:" grade`,
        solution: String.raw`let score = 86
let grade = "?"

if score >= 90 {
  grade = "A"
} else if score >= 80 {
  grade = "B"
} else {
  grade = "C"
}

show "Score:" score
show "Grade:" grade`,
        expected: "Score: 86\nGrade: B"
      },
      {
        id: "loops",
        unit: "Control flow",
        title: "Repeat work with loops",
        time: "10 min",
        level: "Core",
        summary: "Choose between collection loops, numeric ranges, and condition-driven while loops.",
        goals: [
          "Iterate with for…in",
          "Use exclusive numeric ranges",
          "Control loops with break and continue"
        ],
        concepts: [
          {
            title: "Use for…in for collections",
            body: "<code>for item in items</code> visits each array value. To walk an object, iterate over <code>keys(object)</code>."
          },
          {
            title: "Numeric ranges exclude the end",
            body: "<code>for i = 0 to 4</code> produces 0, 1, 2, and 3. The right boundary is not included."
          },
          {
            title: "while depends on a condition",
            body: "Use <code>while</code> when the stopping point depends on changing state. Remember to update that state inside the loop."
          }
        ],
        challenge: "Accumulate only the odd numbers. Use continue to skip even values and produce a total of 9.",
        hint: "A number is even when n % 2 == 0.",
        starter: String.raw`let numbers = [1, 2, 3, 4, 5]
let total = 0

for n in numbers {
  total = total + n
}

show "Odd total:" total`,
        solution: String.raw`let numbers = [1, 2, 3, 4, 5]
let total = 0

for n in numbers {
  if n % 2 == 0 {
    continue
  }
  total = total + n
}

show "Odd total:" total`,
        expected: "Odd total: 9"
      },
      {
        id: "functions",
        unit: "Reusable programs",
        title: "Functions and typed contracts",
        time: "10 min",
        level: "Core",
        summary: "Extract reusable behavior, return values, and document expectations with optional type annotations and defaults.",
        goals: [
          "Declare and call functions",
          "Return computed values",
          "Use parameter, return, and default annotations"
        ],
        concepts: [
          {
            title: "Functions use fn",
            body: "A declaration has a name, parameters, and a block: <code>fn add(a, b) { return a + b }</code>."
          },
          {
            title: "Types communicate intent",
            body: "Annotations such as <code>name: string</code> and <code>-&gt; string</code> are optional, but make public functions easier to understand."
          },
          {
            title: "Defaults belong after required parameters",
            body: "A default like <code>suffix = \"!\"</code> is used when the caller omits that argument."
          }
        ],
        challenge: "Finish format_label so it returns the name and suffix. The second call should override the default.",
        hint: "Return name + suffix from inside the function.",
        starter: String.raw`fn format_label(name: string, suffix: string = "!") -> string {
  return name
}

show format_label("Sesi")
show format_label("Build", " complete")`,
        solution: String.raw`fn format_label(name: string, suffix: string = "!") -> string {
  return name + suffix
}

show format_label("Sesi")
show format_label("Build", " complete")`,
        expected: "Sesi!\nBuild complete"
      },
      {
        id: "pipelines",
        unit: "Reusable programs",
        title: "Collections and pipelines",
        time: "12 min",
        level: "Intermediate",
        summary: "Transform arrays with callbacks, then compose small functions with Sesi’s pipe operator.",
        goals: [
          "Use map, filter, reduce, and find",
          "Pass functions as callback values",
          "Read a left-to-right pipeline"
        ],
        concepts: [
          {
            title: "Callbacks keep collection logic focused",
            body: "<code>map</code> transforms every item, <code>filter</code> keeps matches, <code>reduce</code> combines values, and <code>find</code> returns the first match."
          },
          {
            title: "The pipe supplies the first argument",
            body: "<code>10 | add(5) | multiply(2)</code> is equivalent to <code>multiply(add(10, 5), 2)</code>. It reads in execution order."
          }
        ],
        challenge: "Filter to even numbers, double each remaining number, and reduce the result into 24.",
        hint: "Use filter(numbers, is_even), then map(evens, double), then reduce(doubled, add, 0). Use | for data pipelines: arrays, strings, objects, or multi-step transformations (data | filter | map | show).\n- Use standard syntax () for math, boolean logic (!, &&, ||), comparisons (==, !=), and inline checks.",
        starter: String.raw`let numbers = [1, 2, 3, 4, 5, 6]

fn is_even(n) { return n % 2 == 0 }
fn double(n) { return n * 2 }
fn add(total, n) { return total + n }

let evens = numbers
let doubled = evens
let total = 0

show "Evens:" join(evens, ",")
show "Doubled:" join(doubled, ",")
show "Total:" total`,
        solution: String.raw`let numbers = [1, 2, 3, 4, 5, 6]

fn is_even(n) { return n % 2 == 0 }
fn double(n) { return n * 2 }
fn add(total, n) { return total + n }

let evens = filter(numbers, is_even)
let doubled = map(evens, double)
let total = reduce(doubled, add, 0)

show "Evens:" join(evens, ",")
show "Doubled:" join(doubled, ",")
show "Total:" total`,
        expected: "Evens: 2,4,6\nDoubled: 4,8,12\nTotal: 24"
      },
      {
        id: "errors",
        unit: "Reliable scripts",
        title: "Errors, recovery, and cleanup",
        time: "10 min",
        level: "Intermediate",
        summary: "Represent failures explicitly with try, catch, finally, and custom structured errors.",
        goals: [
          "Catch runtime failures",
          "Raise typed errors with data",
          "Guarantee cleanup with finally"
        ],
        concepts: [
          {
            title: "Caught errors are structured",
            body: "<code>raise_error(type, message, data)</code> creates an error whose fields can be read in <code>catch (err)</code>."
          },
          {
            title: "finally always runs",
            body: "Use <code>finally</code> for cleanup that must occur whether the protected work succeeds, throws, or returns."
          },
          {
            title: "Retries are for transient failures",
            body: "<code>retry(action, options)</code> supports maximum retries, initial delay, and backoff. Do not retry validation failures that cannot heal."
          }
        ],
        challenge: "Reject a negative quantity with a ValidationError and print its type and field from catch.",
        hint: "Call raise_error with three arguments. Put {field: \"quantity\"} in its data object.",
        starter: String.raw`let quantity = -2

try {
  if quantity < 0 {
    // Raise a structured error here.
  }
  show "Quantity accepted"
} catch (err) {
  show "Caught:" err.type
  show "Field:" err.data.field
} finally {
  show "Validation finished"
}`,
        solution: String.raw`let quantity = -2

try {
  if quantity < 0 {
    raise_error("ValidationError", "Quantity cannot be negative", {field: "quantity"})
  }
  show "Quantity accepted"
} catch (err) {
  show "Caught:" err.type
  show "Field:" err.data.field
} finally {
  show "Validation finished"
}`,
        expected: "Caught: ValidationError\nField: quantity\nValidation finished"
      },
      {
        id: "files",
        unit: "Practical scripting",
        title: "Files and safe local automation",
        time: "12 min",
        level: "Intermediate",
        summary: "Read and write files, protect risky operations with error handling, and understand Sesi’s default filesystem sandbox.",
        goals: [
          "Write, read, and remove a local file",
          "Persist structured data as JSON",
          "Understand safe mode and allowed paths"
        ],
        concepts: [
          {
            title: "Paths are sandboxed by default",
            body: "Regular Sesi execution allows the current working directory and script directory. Traversal outside allowed paths is blocked unless you explicitly opt into local mode."
          },
          {
            title: "Choose deletion semantics deliberately",
            body: "<code>trash(path)</code> moves an item to the project recycle area. <code>trash(path, true)</code> permanently removes it and should be used only for known temporary files."
          },
          {
            title: "Store structure as JSON",
            body: "Pair <code>write_file</code> with <code>to_json</code>, and <code>read_file</code> with <code>from_json</code>."
          }
        ],
        challenge: "Save the settings object, load it back, print its theme, and remove the known temporary file in finally.",
        hint: "Use to_json(settings), from_json(read_file(path)), and trash(path, true).",
        starter: String.raw`let path = "tutorial/.lesson_settings.json"
let settings = {theme: "ocean", font_size: 14}

try {
  // Save and load settings here.
  let loaded = settings
  show "Theme:" loaded.theme
  show "Font size:" loaded.font_size
} catch (err) {
  show "File error:" err
} finally {
  // Remove the tutorial's temporary file here.
}`,
        solution: String.raw`let path = "tutorial/.lesson_settings.json"
let settings = {theme: "ocean", font_size: 14}

try {
  write_file(path, to_json(settings))
  let loaded = from_json(read_file(path))
  show "Theme:" loaded.theme
  show "Font size:" loaded.font_size
} catch (err) {
  show "File error:" err
} finally {
  trash(path, true)
}`,
        expected: "Theme: ocean\nFont size: 14"
      },
      {
        id: "modules",
        unit: "Practical scripting",
        title: "Modules and the standard library",
        time: "10 min",
        level: "Intermediate",
        summary: "Import focused capabilities with allow, choose named or namespace imports, and split your own programs with export.",
        goals: [
          "Load a standard library module",
          "Choose namespace or named imports",
          "Understand local module exports"
        ],
        concepts: [
          {
            title: "Namespace imports show provenance",
            body: "<code>allow \"std/math\" in with Math</code> keeps module members behind <code>Math</code>, making larger scripts easy to scan."
          },
          {
            title: "Named imports stay concise",
            body: "<code>allow \"std/json\" in with { parse, stringify }</code> brings only those exports into the current scope."
          },
          {
            title: "Your files can export too",
            body: "Prefix top-level declarations with <code>export</code>, then load the file with <code>allow</code> or <code>import</code>. Module resolution starts near the running script."
          }
        ],
        challenge: "Use Math.pow to calculate 3 to the fourth power and print 81.",
        hint: "Replace the hard-coded result with Math.pow(base, exponent).",
        starter: String.raw`allow "std/math" in with Math

let base = 3
let exponent = 4
let result = 0

show "Result:" result
show "PI is greater than 3?" Math.PI > 3`,
        solution: String.raw`allow "std/math" in with Math

let base = 3
let exponent = 4
let result = Math.pow(base, exponent)

show "Result:" result
show "PI is greater than 3?" Math.PI > 3`,
        expected: "Result: 81\nPI is greater than 3? true"
      },
      {
        id: "async",
        unit: "Practical scripting",
        title: "Asynchronous functions",
        time: "8 min",
        level: "Intermediate",
        summary: "Represent work that completes later with async functions and resolve Sesi promises with await.",
        goals: [
          "Declare an async function",
          "Observe a promise value",
          "Resolve it with await"
        ],
        concepts: [
          {
            title: "async changes the call result",
            body: "Calling an <code>async fn</code> returns a Sesi promise, even if its body immediately returns a value."
          },
          {
            title: "await unwraps the result",
            body: "Use <code>await</code> where you need the completed value. This is especially useful for independent network or model workflows."
          }
        ],
        challenge: "Await the promise before printing so the terminal receives the greeting string.",
        hint: "Assign await pending to a new variable.",
        starter: String.raw`async fn build_greeting(name: string) -> string {
  return "Hello, " + name
}

let pending = build_greeting("Ada")
let greeting = pending
show greeting`,
        solution: String.raw`async fn build_greeting(name: string) -> string {
  return "Hello, " + name
}

let pending = build_greeting("Ada")
let greeting = await pending
show greeting`,
        expected: "Hello, Ada"
      },
      {
        id: "structured-output",
        unit: "Data workflows",
        title: "Validate structured output",
        time: "10 min",
        level: "Intermediate",
        summary: "Turn JSON text into a predictable record with a schema, whether the text came from a file, an API, or an optional model call.",
        goals: [
          "Define a structured output schema",
          "Validate JSON-shaped text",
          "Consume fields from the parsed result"
        ],
        concepts: [
          {
            title: "Schemas describe the result",
            body: "<code>structured_output({name: string, count: number})(text)</code> parses JSON and checks the requested field types."
          },
          {
            title: "The source does not have to be AI",
            body: "Structured output is useful for ordinary APIs and files. It also provides a clean boundary when you later choose to use a model."
          }
        ],
        challenge: "Add the active boolean to the schema, then print all three validated fields.",
        hint: "The schema entry is active: bool. Access it with record[\"active\"].",
        starter: String.raw`let raw = "{\"project\":\"Sesi\",\"tasks\":3,\"active\":true}"
let record = structured_output({project: string, tasks: number})(raw)

show "Project:" record.project
show "Tasks:" record.tasks`,
        solution: String.raw`let raw = "{\"project\":\"Sesi\",\"tasks\":3,\"active\":true}"
let record = structured_output({project: string, tasks: number, active: bool})(raw)

show "Project:" record.project
show "Tasks:" record.tasks
show "Active:" record.active`,
        expected: "Project: Sesi\nTasks: 3\nActive: true"
      },
      {
        id: "reasoning",
        unit: "Optional reasoning",
        title: "Add a model call—only when useful",
        time: "10 min",
        level: "Optional",
        summary: "Compose a prompt, configure a model call, and keep probabilistic reasoning behind a small, explicit boundary.",
        goals: [
          "Keep normal program logic separate from model work",
          "Pass a prompt and explicit configuration",
          "Handle missing credentials or service errors"
        ],
        concepts: [
          {
            title: "Reasoning is an optional capability",
            body: "Everything in the previous lessons runs without a model. Use <code>model()</code> only when a task genuinely benefits from language understanding or generation."
          },
          {
            title: "Credentials come from the environment",
            body: "Gemini-backed calls require <code>GEMINI_API_KEY</code>, commonly loaded from a local <code>.env</code> file. Never hard-code keys into tutorial or source files."
          },
          {
            title: "Treat model output as untrusted input",
            body: "Use clear prompts, small scopes, error handling, and <code>structured_output</code> when downstream code needs a stable shape."
          }
        ],
        challenge: "If you have configured a Gemini key, run the example. Otherwise, read the boundary carefully and continue—the lesson is intentionally optional.",
        hint: "Create .env in the repository root with GEMINI_API_KEY=\"…\". A model name can change over time, so use one supported by your installed Sesi runtime.",
        starter: String.raw`let topic = "why small functions are easier to test"
prompt request {"Explain in exactly two short sentences:" topic}

try {
  let answer = model("gemini-3-flash-preview") {thinkingLevel: "low"} {request}
  show answer
} catch (err) {
  show "Model call unavailable."
  show "Configure GEMINI_API_KEY or continue without this optional step."
}`,
        solution: String.raw`let topic = "why small functions are easier to test"
prompt request {"Explain in exactly two short sentences:" topic}

try {
  let answer = model("gemini-3-flash-preview") {thinkingLevel: "low"} {request}
  show answer
} catch (err) {
  show "Model call unavailable."
  show "Configure GEMINI_API_KEY or continue without this optional step."
}`,
        expected: null
      },
      {
        id: "cli-workflows",
        unit: "Ship a script",
        title: "Arguments and CLI workflows",
        time: "9 min",
        level: "Core",
        summary: "Turn a file into a reusable command, validate positional arguments, and know which CLI diagnostic to reach for.",
        goals: [
          "Read the global args array",
          "Provide a usage message",
          "Run, evaluate, inspect, and check scripts from the CLI"
        ],
        concepts: [
          {
            title: "Arguments follow the file name",
            body: "Running <code>sesi greet.sesi Ada</code> makes <code>args[0]</code> equal to <code>\"Ada\"</code>. Validate <code>len(args)</code> before indexing."
          },
          {
            title: "The CLI supports investigation",
            body: "Use <code>sesi -e</code> for inline code, <code>sesi --tokens file.sesi</code> for lexical output, and <code>sesi --ast file.sesi</code> to inspect parsed structure."
          },
          {
            title: "This browser runner has no positional args",
            body: "The practice code uses a fallback so it remains runnable here. Save it as a file and run it from a terminal to try real arguments."
          }
        ],
        challenge: "Use the first argument when present; otherwise use \"Developer\". Then construct the greeting.",
        hint: "Start with a default name and assign args[0] inside if len(args) > 0.",
        starter: String.raw`let name = "Developer"

// In a saved script, replace the fallback when an argument exists.

show "Hello," name "!"
show "Argument count:" len(args)`,
        solution: String.raw`let name = "Developer"

if len(args) > 0 {
  name = args[0]
}

show "Hello," name "!"
show "Argument count:" len(args)`,
        expected: "Hello, Developer!\nArgument count: 0"
      },
      {
        id: "capstone",
        unit: "Ship a script",
        title: "Capstone: a release summary",
        time: "20 min",
        level: "Project",
        summary: "Combine collections, functions, branching, iteration, and structured records into a small deterministic command-line report.",
        goals: [
          "Break a task into data, transformations, and output",
          "Compose several core language features",
          "Produce a useful result without optional services"
        ],
        concepts: [
          {
            title: "Start from a data shape",
            body: "The release object holds a version and a list of checks. Each check has a name and an <code>ok</code> boolean."
          },
          {
            title: "Keep policy in one function",
            body: "A tiny <code>status_label</code> function owns the rule for translating booleans into display labels."
          },
          {
            title: "Accumulate before deciding",
            body: "Count successful checks in the loop, then compare the count with the total to choose the final release state."
          }
        ],
        challenge: "Complete status_label, count successful checks, and set ready only when every check passes.",
        hint: "Increment passed inside if check[\"ok\"]. Then compare passed == len(release[\"checks\"]).",
        starter: String.raw`let release = {
  version: "1.9.0",
  checks: [
    {name: "lint", ok: true},
    {name: "tests", ok: true},
    {name: "docs", ok: true}
  ]
}

fn status_label(ok: bool) -> string {
  return "TODO"
}

let passed = 0
for check in release.checks {
  show check.name status_label(check.ok)
}

let ready = false
show "Passed:" passed "/" len(release.checks)
show "Release" release.version "ready?" ready`,
        solution: String.raw`let release = {
  version: "1.9.0",
  checks: [
    {name: "lint", ok: true},
    {name: "tests", ok: true},
    {name: "docs", ok: true}
  ]
}

fn status_label(ok: bool) -> string {
  if ok {
    return "PASS"
  }
  return "FAIL"
}

let passed = 0
for check in release.checks {
  show check.name status_label(check.ok)
  if check.ok {
    passed = passed + 1
  }
}

let ready = passed == len(release.checks)
show "Passed:" passed "/" len(release.checks)
show "Release" release.version "ready?" ready`,
        expected: "lint PASS\ntests PASS\ndocs PASS\nPassed: 3 / 3\nRelease 1.9.0 ready? true"
      }
    ];

    const STORAGE_KEY = "sesi-tutorial-progress-v2";
    const state = {
      currentIndex: Math.max(0, lessons.findIndex((lesson) => lesson.id === location.hash.slice(1))),
      completed: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")),
      showingSolution: false,
      running: false
    };

    const $ = (id) => document.getElementById(id);
    const editor = $("editor");
    const output = $("output");

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function normalizeOutput(value) {
      return String(value || "")
        .replace(/\u001b\[[0-9;]*m/g, "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => !line.startsWith("⟐ injected env"))
        .join("\n")
        .trim();
    }

    function saveProgress() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.completed]));
      updateProgress();
      renderLessonList($("lesson-search").value);
    }

    function updateProgress() {
      const count = state.completed.size;
      $("progress-label").textContent = `${count} of ${lessons.length} complete`;
      $("progress-fill").style.width = `${(count / lessons.length) * 100}%`;
      $("mark-complete").textContent = state.completed.has(lessons[state.currentIndex].id)
        ? "Completed ✓"
        : "Mark complete";
    }

    function renderLessonList(query = "") {
      const list = $("lesson-list");
      const normalizedQuery = query.trim().toLowerCase();
      const grouped = new Map();

      lessons.forEach((lesson, index) => {
        const haystack = `${lesson.title} ${lesson.summary} ${lesson.unit}`.toLowerCase();
        if (normalizedQuery && !haystack.includes(normalizedQuery)) return;
        if (!grouped.has(lesson.unit)) grouped.set(lesson.unit, []);
        grouped.get(lesson.unit).push({ lesson, index });
      });

      list.innerHTML = "";
      if (grouped.size === 0) {
        list.innerHTML = '<div class="empty-search">No lessons match that search.</div>';
        return;
      }

      grouped.forEach((items, unitName) => {
        const section = document.createElement("section");
        section.className = "unit";
        const title = document.createElement("h2");
        title.className = "unit-title";
        title.textContent = unitName;
        section.appendChild(title);

        items.forEach(({ lesson, index }) => {
          const button = document.createElement("button");
          const isDone = state.completed.has(lesson.id);
          button.className = `lesson-link${index === state.currentIndex ? " active" : ""}${isDone ? " done" : ""}`;
          button.innerHTML = `
            <span class="lesson-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="lesson-link-title">${escapeHtml(lesson.title)}</span>
            <span class="lesson-check" aria-label="${isDone ? "Complete" : "Incomplete"}">${isDone ? "✓" : "○"}</span>
          `;
          button.addEventListener("click", () => loadLesson(index));
          section.appendChild(button);
        });
        list.appendChild(section);
      });
    }

    function loadLesson(index) {
      if (index < 0 || index >= lessons.length) return;
      state.currentIndex = index;
      state.showingSolution = false;
      const lesson = lessons[index];
      location.hash = lesson.id;

      $("lesson-eyebrow").textContent = `${lesson.unit} · Lesson ${index + 1} of ${lessons.length}`;
      $("lesson-title").textContent = lesson.title;
      $("lesson-summary").textContent = lesson.summary;
      $("lesson-meta").innerHTML = `
        <span class="pill">${escapeHtml(lesson.time)}</span>
        <span class="pill">${escapeHtml(lesson.level)}</span>
        <span class="pill">${lesson.expected === null ? "Optional external service" : "Runs locally"}</span>
      `;
      $("lesson-goals").innerHTML = lesson.goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join("");
      $("lesson-concepts").innerHTML = lesson.concepts.map((concept) => `
        <div class="concept-card">
          <strong>${escapeHtml(concept.title)}</strong>
          <p>${concept.body}</p>
        </div>
      `).join("");
      $("lesson-challenge").textContent = lesson.challenge;
      $("lesson-hint").textContent = lesson.hint;
      $("file-label").textContent = `${String(index + 1).padStart(2, "0")}_${lesson.id.replaceAll("-", "_")}.sesi`;
      editor.value = lesson.starter;
      $("show-solution").textContent = "Show solution";
      $("previous-lesson").disabled = index === 0;
      $("next-lesson").disabled = index === lessons.length - 1;
      $("next-lesson").textContent = index === lessons.length - 1 ? "Course complete ✓" : "Next lesson →";
      $("check-code").disabled = lesson.expected === null;
      $("check-code").title = lesson.expected === null
        ? "This optional model response is intentionally non-deterministic."
        : "Run and compare with the expected output.";
      output.className = "";
      output.textContent = lesson.expected === null
        ? "This lesson calls an optional external model. It is safe to continue without running it."
        : `Expected output:\n${lesson.expected}`;
      $("console-status").textContent = "Ready";
      $("lesson-panel").scrollTop = 0;
      renderLessonList($("lesson-search").value);
      updateProgress();
    }

    async function executeCode(checkAnswer = false) {
      if (state.running) return;
      const lesson = lessons[state.currentIndex];
      state.running = true;
      $("run-code").disabled = true;
      $("check-code").disabled = true;
      $("console-status").textContent = checkAnswer ? "Checking…" : "Running…";
      output.className = "";
      output.textContent = "Running your Sesi program…";

      try {
        const response = await fetch("/run", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ code: editor.value })
        });
        const result = await response.json();

        if (result.error) {
          output.className = "error";
          output.textContent = result.error;
          $("console-status").textContent = "Error";
          return;
        }

        const actual = normalizeOutput(result.output);
        output.textContent = actual || "Execution finished with no printed output.";

        if (checkAnswer && lesson.expected !== null) {
          const expected = normalizeOutput(lesson.expected);
          if (actual === expected) {
            output.className = "success";
            output.textContent = `✓ Lesson complete\n\n${actual}`;
            $("console-status").textContent = "Passed";
            state.completed.add(lesson.id);
            saveProgress();
          } else {
            output.className = "check-fail";
            output.textContent = `Not quite yet.\n\nYour output:\n${actual || "(no output)"}\n\nExpected:\n${expected}`;
            $("console-status").textContent = "Try again";
          }
        } else {
          output.className = "success";
          $("console-status").textContent = "Finished";
        }
      } catch (error) {
        output.className = "error";
        output.textContent = `Could not reach the tutorial runner.\n${error.message}`;
        $("console-status").textContent = "Connection error";
      } finally {
        state.running = false;
        $("run-code").disabled = false;
        $("check-code").disabled = lesson.expected === null;
      }
    }

    $("run-code").addEventListener("click", () => executeCode(false));
    $("check-code").addEventListener("click", () => executeCode(true));
    $("reset-code").addEventListener("click", () => {
      const lesson = lessons[state.currentIndex];
      editor.value = lesson.starter;
      state.showingSolution = false;
      $("show-solution").textContent = "Show solution";
      output.className = "";
      output.textContent = lesson.expected === null
        ? "This lesson calls an optional external model. It is safe to continue without running it."
        : `Expected output:\n${lesson.expected}`;
      $("console-status").textContent = "Reset";
      editor.focus();
    });
    $("show-solution").addEventListener("click", () => {
      const lesson = lessons[state.currentIndex];
      state.showingSolution = !state.showingSolution;
      editor.value = state.showingSolution ? lesson.solution : lesson.starter;
      $("show-solution").textContent = state.showingSolution ? "Show starter" : "Show solution";
      $("console-status").textContent = state.showingSolution ? "Solution shown" : "Starter restored";
      editor.focus();
    });
    $("previous-lesson").addEventListener("click", () => loadLesson(state.currentIndex - 1));
    $("next-lesson").addEventListener("click", () => loadLesson(state.currentIndex + 1));
    $("mark-complete").addEventListener("click", () => {
      const id = lessons[state.currentIndex].id;
      if (state.completed.has(id)) state.completed.delete(id);
      else state.completed.add(id);
      saveProgress();
    });
    $("reset-progress").addEventListener("click", () => {
      if (!confirm("Clear completion marks for all tutorial lessons?")) return;
      state.completed.clear();
      saveProgress();
    });
    $("lesson-search").addEventListener("input", (event) => renderLessonList(event.target.value));

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.setRangeText("  ", start, end, "end");
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        executeCode(false);
      }
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        executeCode(true);
      }
    });

    window.addEventListener("hashchange", () => {
      const index = lessons.findIndex((lesson) => lesson.id === location.hash.slice(1));
      if (index >= 0 && index !== state.currentIndex) loadLesson(index);
    });

    renderLessonList();
    loadLesson(state.currentIndex);