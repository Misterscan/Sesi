# Tutorial: Writing Scripts with Sesi

Sesi is a general-purpose programming language with optional reasoning features. This tutorial focuses on writing practical scripts: command-line tools, file processors, API helpers, automation flows, and small orchestration programs.

By the end, you should know how to structure a script, accept inputs, transform data, call the file system and network, run subprocesses, add optional reasoning, debug problems, and split larger scripts into modules.

---

## 1. What Counts as a Sesi Script?

A Sesi script is a `.sesi` file that can be run from the command line.

```bash
sesi my_script.sesi
```

Inside this repository, you can also run scripts through npm:

```bash
npm run sesi examples/main/01_hello.sesi
```

Use Sesi scripts when you want to:

- Automate repeated command-line work
- Read, write, convert, or organize files
- Fetch data from APIs
- Build small local tools
- Coordinate multiple scripts or processes
- Add model calls only where they make the script more useful

---

## 2. Script Structure

Sesi programs are made of statements.

```sesi
let name = "Sesi"
print "Hello," name
```

For single-line inline scripts, use semicolons:

```bash
sesi -e "let x = 10; let y = 20; print x + y"
```

Comments use `//` or `/* ... */`.

```sesi
// Single-line comment

/*
  Multi-line comment
*/
```

---

## 3. Your First Useful Script

Create `report.sesi`:

```sesi
let started = time()
let files = list_dir(".")

print "Sesi Report"
print "Generated at:" started
print "File count:" len(files)

for file in files {
  print "-" file
}
```

Run it:

```bash
sesi report.sesi
```

This script introduces a common Sesi shape:

- Gather input or state
- Transform it with normal language features
- Print or write the result

---

## 4. Values and Variables

Use `let` for bindings.

```sesi
let count = 3
let title = "Daily Report"
let ready = true
let missing = null
```

Sesi has numbers, strings, booleans, null, arrays, and objects.

```sesi
let scores = [10, 20, 30]
let profile = {"name": "Ada", "role": "developer"}

print scores[0]
print profile["name"]
```

You can update variables and object fields:

```sesi
let total = 0
total = total + 5

let config = {"runs": 0}
config["runs"] = config["runs"] + 1
```

Convert values when you need a specific type:

```sesi
let raw = "42"
let answer = num(raw)
print "Answer:" str(answer)
```

---

## 5. Command-Line Arguments

Arguments passed after the script name are available in the global `args` array.

```bash
sesi greet.sesi Alice
```

`greet.sesi`:

```sesi
if len(args) == 0 {
  print "Usage: sesi greet.sesi <name>"
} else {
  let name = args[0]
  print "Hello," name + "!"
}
```

Validate inputs before using them. This makes scripts easier to run from terminals, cron jobs, package scripts, and other automation.

```sesi
if len(args) < 2 {
  print "Usage: sesi copy_text.sesi <input> <output>"
} else {
  let input_path = args[0]
  let output_path = args[1]
  let text = read_file(input_path)
  write_file(output_path, text)
  print "Copied" input_path "to" output_path
}
```

Inline eval can receive arguments too:

```bash
sesi -e "print 'First arg:' args[0]" hello
```

---

## 6. Control Flow

Use `if` and `else` for branching.

```sesi
let score = 87

if score >= 90 {
  print "excellent"
} else if score >= 70 {
  print "passing"
} else {
  print "needs work"
}
```

Use `while` when a loop depends on a condition:

```sesi
let i = 0
while i < 3 {
  print i
  i = i + 1
}
```

Use numeric `for` loops for ranges:

```sesi
for i = 0 to 5 {
  print "Index:" i
}
```

Use `for ... in` loops for arrays:

```sesi
let names = ["Ada", "Grace", "Linus"]

for name in names {
  print "Hello," name
}
```

`break` and `continue` are available for loop control.

```sesi
for item in [1, 2, 3, 4] {
  if item == 2 {
    continue
  }

  if item == 4 {
    break
  }

  print item
}
```

---

## 7. Functions

Functions help you keep scripts readable as they grow.

```sesi
fn format_status(name: string, ok: bool) {
  if ok {
    return name + ": ok"
  }

  return name + ": failed"
}

print format_status("database", true)
```

You can use functions as small task units:

```sesi
fn read_json(path: string) {
  let text = read_file(path)
  return from_json(text)
}

fn save_json(path: string, data) {
  return write_file(path, to_json(data))
}
```

Default parameters are supported:

```sesi
fn greet(name: string = "World") {
  print "Hello," name
}

greet()
greet("Sesi")
```

### Piping and Function Composition

Sesi supports the piping operator (`|`) to compose function calls and tool executions cleanly, flowing the output of the left expression into the first argument of the right function call.

```sesi
fn add(a, b) {
  return a + b
}

fn mul(a, b) {
  return a * b
}

// Flow 10 as first parameter into add(5), and then flow the result into mul(2)
let result = 10 | add(5) | mul(2)
print result // Prints 30
```

---

## 8. Working with Arrays and Objects

Arrays are useful for batches, queues, and collected results.

```sesi
let tasks = []
push(tasks, "lint")
push(tasks, "test")
push(tasks, "build")

print join(tasks, ", ")
print pop(tasks)
```

### Array Processing Functions

Sesi provides standard functional primitives to transform, filter, and aggregate arrays:

- **`map(array, callback)`**: Transforms each element of an array using a callback function.
- **`filter(array, callback)`**: Selects elements that satisfy a condition.
- **`reduce(array, callback, initialValue = null)`**: Accumulates array values into a single result.
- **`find(array, callback)`**: Finds the first element matching a condition.
- **`slice(array, start, end = null)`**: Extracts a portion of an array.

```sesi
let numbers = [1, 2, 3, 4, 5, 6]

// 1. map
fn square(x) { return x * x }
let squares = map(numbers, square) // [1, 4, 9, 16, 25, 36]

// 2. filter
fn isEven(x) { return x % 2 == 0 }
let evens = filter(numbers, isEven) // [2, 4, 6]

// 3. reduce
fn sum(acc, x) { return acc + x }
let total = reduce(numbers, sum) // 21

// 4. find
fn greaterThanFour(x) { return x > 4 }
let match = find(numbers, greaterThanFour) // 5

// 5. slice
let subArray = slice(numbers, 1, 4) // [2, 3, 4]
```

Objects are useful for configuration and structured records.

```sesi
let app = {
  "name": "Sesi",
  "version": "1.5.9"
}

for key in keys(app) {
  print key ":" app[key]
}
```

Prefer JSON helpers when storing structured data.

```sesi
let settings = {"theme": "dark", "limit": 20}
let encoded = to_json(settings)
let decoded = from_json(encoded)

print decoded["theme"]
```

---

## 9. Working with Strings

Sesi provides native string utilities to format, transform, and slice text:

- **`to_upper(string)`**: Converts a string to uppercase.
- **`to_lower(string)`**: Converts a string to lowercase.
- **`trim(string)`**: Removes leading and trailing whitespace.
- **`swap(string, target, replacement)`**: Replaces all occurrences of a target substring with a replacement substring.
- **`slice(string, start, end = null)`**: Extracts a section of a string.
- **`contains(string, sub)`**: Returns `true` if the string contains the given substring.
- **`locate(string, sub)`**: Returns the zero-based index of the first occurrence of a substring, or `-1` if not found.

```sesi
let original = "  Hello, Sesi V2.0!  "

let cleaned = trim(original)                   // "Hello, Sesi V2.0!"
let shouted = to_upper(cleaned)                // "HELLO, SESI V2.0!"
let part = slice(cleaned, 7, 11)               // "Sesi"
let replaced = swap(cleaned, " ", "_")         // "Hello,_Sesi_V2.0!"
let found = contains(cleaned, "Sesi")          // true
let idx = locate(cleaned, "Sesi")             // 7
```

---

## 10. Reading, Writing, and Listing Files

Sesi file paths are resolved relative to the current working directory unless you provide another allowed path.

```sesi
let text = read_file("notes.txt")
print text
```

Write files with `write_file`:

```sesi
let body = "Generated by Sesi at " + str(time())
write_file("report.txt", body)
```

Create folders and list directory entries:

```sesi
make_dir("reports")

let files = list_dir(".")
for file in files {
  print file
}
```

Wrap file operations in `try/catch` when missing files, invalid paths, or permission errors are possible.

```sesi
try {
  let content = read_file("input.txt")
  write_file("output.txt", content)
} catch (err) {
  print "File operation failed:" err
}
```

---

## 11. Converting Files and Content

Use `convert` for supported document, media, or audio conversions.

```sesi
let html = convert(doc) {file_type: "md", output_type: "html"} {"# Hello"}
print html
```

When the input is a file path, Sesi writes the converted file next to the original and returns the new path.

```sesi
let outPath = convert(doc) {output_type: "html"} {"README.md"}
print "Wrote:" outPath
```

---

## 12. Error Recovery and retrying

Sesi provides the `retry(action, options)` built-in function to handle temporary execution failures (e.g. flaky network requests, filesystem contention) automatically with configurable exponential backoff.

```sesi
let attempts = 0
fn flaky_task() {
  attempts = attempts + 1
  if attempts < 3 {
    raise_error("FlakyError", "Network timeout")
  }
  return "success"
}

// Retries the flaky task with options
let result = retry(flaky_task, {
  "max_retries": 3,
  "initial_delay": 500,
  "backoff_factor": 2.0
})

print "Result:" result // Prints "success" after 2 retries
```

---

## 13. Calling APIs

Use `web_get` for HTTP GET requests.

```sesi
let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
let post = from_json(response)

print "Title:" post["title"]
```

Use `web_send` for HTTP POST requests.

```sesi
let payload = to_json({
  "title": "Sesi HTTP Client",
  "body": "Posting JSON from a script",
  "userId": 42
})

let response = web_send("https://jsonplaceholder.typicode.com/posts", payload)
print response
```

For scripts that rely on external services, always account for failures.

```sesi
try {
  let response = web_get("https://example.com/data.json")
  write_file("data.json", response)
} catch (err) {
  print "Request failed:" err
}
```

---

## 14. Running Shell Commands and Processes

Use `exec` when you need to call an existing command and capture its output.

```sesi
let status = exec("git status --short")

if len(status) > 0 {
  print "Uncommitted changes:"
  print status
} else {
  print "Working tree clean"
}
```

Use `spawn` when you want to start another Sesi script in the background.

```sesi
let pid = spawn("worker.sesi")
print "Worker started with PID:" pid
```

Sesi runs in safe mode by default. Shell commands and broader filesystem access may be blocked unless you intentionally run locally.

```bash
sesi automation.sesi -l
```

You can also allow specific extra paths:

```bash
sesi automation.sesi --a "./data,./reports"
```

Treat `-l` as an explicit trust boundary. Use it for your own scripts, not for code you have not inspected.

---

## 15. Parallel Work

Use `multi_req` to run multiple Sesi functions at the same time and collect their results.

```sesi
fn fetch_post() {
  return web_get("https://jsonplaceholder.typicode.com/posts/1")
}

fn fetch_todo() {
  return web_get("https://jsonplaceholder.typicode.com/todos/1")
}

let results = multi_req([fetch_post, fetch_todo])
print "Post response:" results[0]
print "Todo response:" results[1]
```

This pattern is useful for independent API calls, independent checks, or work that does not need shared mutable state.

---

## 16. Optional Reasoning in Scripts

Reasoning is optional. Use it when a task benefits from classification, summarization, extraction, or generation.

Use `model` for direct model calls:

```sesi
let text = read_file("notes.txt")
let summary = model("gemini-3.1-flash-lite") {"Summarize this in 3 bullets:" text}

print summary
```

### Streaming Responses

You can stream model responses chunk-by-chunk in real-time by adding a `stream` option to the model configuration block.

- Set `stream: true` to output directly to the terminal stdout in real-time.
- Set `stream: callback` to pass each chunk as it arrives to a custom function.

```sesi
// Option 1: Stream directly to stdout
let resp1 = model("gemini-3.1-flash-lite") {stream: true} {"Write a short poem about antigravity."}

// Option 2: Handle chunks using a callback function
fn onChunk(chunk) {
  print "Chunk received:" chunk
}
let resp2 = model("gemini-3.1-flash-lite") {stream: onChunk} {"Explain quantum mechanics."}
```

Use `prompt` blocks to compose readable prompts from strings and variables.

```sesi
let file_name = "notes.txt"
let content = read_file(file_name)

prompt request {"Classify this file as TECHNICAL, LEGAL, MARKETING, or OTHER.
  Return only the category.
  File: " file_name "
  Content: " content}

let category = model("gemini-3.1-flash-lite") {request}
print file_name ":" category
```

Use `structured_output` when the rest of your script needs reliable fields.

```sesi
let raw = "{\"title\": \"Buy milk\", \"completed\": false}"
let task = structured_output({title: string, completed: bool})(raw)

print task["title"]
print task["completed"]
```

You can combine `model` and `structured_output`:

```sesi
let review = "The tool is fast, but the setup was confusing."
let result = structured_output({sentiment: string, summary: string})(model("gemini-3.1-flash-lite") {"Analyze this review and return JSON with sentiment and summary: " review})

print result["sentiment"]
print result["summary"]
```

Use `workflow` for multi-step reasoning.

```sesi
let steps = [
  {"prompt": "Summarize the input."},
  {"prompt": "List the risks in that summary."},
  {"prompt": "Turn the risks into an action checklist."}
]

let result = workflow(steps, read_file("proposal.txt"))
print result["final"]
```

Reasoning calls require a configured provider key, such as `GEMINI_API_KEY`, when you use provider-backed models.

---

## 17. Modules and Reuse

Split larger scripts into modules with `export` and `allow ... in with ...`.

`logger.sesi`:

```sesi
export fn info(message: string) {
  print "[INFO]" message
}

export fn warn(message: string) {
  print "[WARN]" message
}
```

`main.sesi`:

```sesi
allow "logger" in with {info, warn}

info("Script started")
warn("Using default configuration")
```

Sesi also includes standard library modules:

```sesi
allow "std/math" in with {
  PI, sqrt
}
allow "std/time" in with {
  now, sleep
}
allow "std/json" in with {
  parse, stringify
}
allow "std/db" in with {db_open}

print "sqrt(9):" sqrt(9)
print "Current time:" now()
```

### Scoped Namespace Imports (`allow`)

You can import standard modules or custom library namespaces into scoped objects using the `allow` keyword:

```sesi
// Import entire math module under a single Namespace
allow "std/math" in with Math
print "PI constant:" Math.PI

// Import specific exports into a scoped block
allow "std/json" in with {
  stringify, parse
}
let original = {
  "project": "Sesi",
  "version": "1.5.9"
}
print stringify(original)
```

Module resolution also supports configured library paths through `SESI_PATH` and the global `~/.sesi/lib` library directory.

---

## 18. Debugging Scripts

Start with a dry run when you only want to check syntax.

```bash
sesi -c my_script.sesi
```

Inspect the parsed AST:

```bash
sesi --ast my_script.sesi
```

Inspect tokens when parsing fails in a confusing place:

```bash
sesi --tokens my_script.sesi
```

Use the REPL for quick experiments:

```bash
sesi
```

Ask the built-in co-pilot about a file:

```bash
sesi my_script.sesi -h "What is this script doing?"
```

Inside a script, print intermediate values and types.

```sesi
let value = read_file("data.txt")
print "value type:" type(value)
print "value length:" len(value)
```

---

## 19. Encrypting Scripts

For encrypted private scripts, use the CLI encryption commands documented in the CLI reference.

```bash
sesi -enc private.sesi -p "my-password"
sesi -dec private.sesi -p "my-password"
```

You can set `SESI_PASSWORD` in your environment to avoid passing a password directly on the command line.

---

## 20. Interactive Input

Sesi provides the `input(prompt)` built-in function to query the user for data sequentially from standard input. This is useful for interactive command-line utilities.

```sesi
let name = input("What is your name? ")
let age = input("What is your age? ")

print "Hello," name "! You are" age "years old."
```

If you are running the script in a non-interactive environment or need to fall back when arguments are not provided:

```sesi
let queryText = ""
if len(args) > 0 {
  queryText = join(args, " ")
} else {
  queryText = input("Enter your question: ")
}
print "Processing query:" queryText
```

---

## 21. Complete Example: Daily Folder Report

This script accepts a folder path (falling back to interactive input if omitted), lists the files robustly using retries, writes a JSON report, and streams a summary using the AI model.

`daily_report.sesi`:

```sesi
let folder = ""
if len(args) > 0 {
  folder = args[0]
} else {
  folder = input("Enter folder path to analyze: ")
}

let started = time()

// Define a robust folder analysis action
fn run_analysis() {
  let files = list_dir(folder)
  let report = {
    "folder": folder,
    "generated_at": started,
    "file_count": len(files),
    "files": files
  }

  make_dir("reports")
  let output_path = "reports/daily_report.json"
  write_file(output_path, to_json(report))
  return output_path
}

// Use retry for robust filesystem operations
let report_path = retry(run_analysis, {"max_retries": 3, "initial_delay": 500})
print "Wrote report to:" report_path
```

Run it:

```bash
sesi daily_report.sesi ./docs
```

Add reasoning only when needed:

```sesi
// Read report path and stream the summary directly to terminal stdout
let report_text = read_file(report_path)
let summary = model("gemini-3.1-flash-lite") {stream: true} {"Summarize this folder report:
  " report_text}
try {
  write_file("reports/daily_report_summary.txt", summary)
  print "Summary saved to reports/daily_report_summary.txt"
} catch (err) {
  print "Analysis failed:" err
}
```

---

## 22. Practical Checklist

When writing a Sesi script, check these points before you call it done:

- Does it validate `args` or use `input()` for interactive prompting?
- Does it use `try/catch` around file, network, process, and model calls?
- Does it write structured data with `to_json` instead of hand-built strings?
- Does it use `-l` only when shell commands or broader paths are truly needed?
- Does it keep repeated logic in functions or modules?
- Can `-c`, `--ast`, or `--tokens` help diagnose it later?
- Are optional model calls using an appropriate model for the job?

---

## Next Steps

- Explore the [Built-in Functions Reference](BUILTINS.md) for every runtime function.
- Read the [CLI Reference](CLI.md) for execution, sandbox, REPL, encryption, and debugging flags.
- Use the [Language Specification](SPECIFICATION.md) when you need exact syntax rules.
- Study the scripts in the [examples](../examples) directory.
