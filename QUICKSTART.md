# Quick Start Guide: Sesi Programming Language

## Installation

You can install Sesi in three ways: via npm (easiest for Node.js users), downloading a standalone executable (no Node.js required), or building from source.

### Option 1: Install via npm (Recommended)

If you already have Node.js installed, you can install Sesi globally with a single command:

```bash
npm install -g sesi
```

### Option 2: Standalone Executable

If you don't want to install Node.js, you can download a standalone binary:

1. Go to the [GitHub Releases](https://github.com/Misterscan/Sesi/releases) page.
2. Download the executable for your OS (`sesi-win.exe`, `sesi-macos`, or `sesi-linux`).
3. Add the folder containing the executable to your system's `PATH` variable, or run it directly from the folder (`.\sesi-win.exe`).

### Option 3: Build from Source (For Contributors)

**Prerequisites:** Node.js 20+ and npm

```bash
git clone https://github.com/Misterscan/Sesi.git
cd Sesi
npm install

# Compile the TypeScript files
npm run build

# Link the `sesi` command globally to your local source folder
npm install -g .
```

### Build Native Installers

Windows MSI installer:

```bash
npm run build:installer
```

macOS PKG installer (run on macOS):

```bash
npm run build:mac:installer
```

The generated installer files are written to `releases/`.

### Run a program

Once Sesi is installed, you can run Sesi files globally:

```bash
sesi examples/main/01_hello.sesi
```

You can also pass arguments to your script, which are exposed under the global `args` array:

```bash
sesi main/test_args.sesi arg1 arg2
```

### Ask Sesira for help

Use `-h` with a question to consult the bundled Sesira assistant (maintains conversational history by default):

```bash
sesi -h "how do I use memory?"
```

To run the chatbot directly with arguments:

```bash
npm run sesira "question"
# Start a new chat
npm run sesira new "question"
# Pass file context to Sesira
npm run sesira <filename> "question"
npm run sesira new <filename> "question"
```

### Run Tests

For devs working on Sesi, you can verify your backend edits with the built-in test suite:

```bash
npm test
```

## Your First Program

Create a file called `hello.sesi` and run it:

```bash
sesi -e 'let filename = "hello.sesi"
prompt file {"show \"Hello, Sesi!\""}
filename | write_file(file)
filename | sesi'
```

## Basic Syntax

### Variables

```sesi
let x = 10
let name = "Alice"
let score = 95.5
show x
show name
show score
```

### Functions

```sesi
fn add(a: number, b: number) {show a + b}
5 | add(3)  // 8
```

### Control Flow

```sesi
let age = 25
if age >= 18 {show "Adult"} else {show "Minor"}
```

### Loops

```sesi
// While loop
let i = 0
while i < 5 {
  show i
  i = i + 1
}

// For loop
for j = 0 to 5 {show j}

// For-in loop
for item in [1, 2, 3] {show item}
```

### Arrays & Objects

```sesi
let numbers = [1, 2, 3, 4, 5]
show numbers[0]        // 1
show len(numbers)      // 5
let age = numbers[4] * 5   // 5 * 5 = 25
let person = {"name": "Alice", "age": age}
show person["name"] "is" person["age"] "years old."    // "Alice is 25 years old."
```

Prompts are **composable message templates** that evaluate to strings. You can also utilize these to write clean and concise sesi scripts by nesting variables and even other prompts within prompts.

### Basic Prompt

```sesi
prompt simplePrompt {"Hello, Sesi!"}
show simplePrompt  // "Hello, Sesi!"
```

### Prompts with Variables

```sesi
let name = "Alice"
prompt greeting {"Hello, "name"! How are you?"}
show greeting  // "Hello, Alice! How are you?"
```

### Composing Prompts

```sesi
prompt part1 {"First part "}
prompt part2 {part1 "Second part"}
show part2  // "First part Second part"
```

### Prompts in Functions

```sesi
let title = "Sesi"
let theme = "Premium with cool blues."
let output = "index.sesi.html"

fn makePage(title: string, theme: string, output: string) -> string {
  prompt build {"Create a beautiful landing page with the title "title". Make the theme "theme}
  let generated = ""

  try {
    generated = model("gemini-3.5-flash-lite") {build}
  } catch (e) {
    show e
  }
  output | write_file(generated)

  return generated
}

show title | makePage(theme, output)
```

Structured output allows you to extract structured data natively or via Reasoning. It uses a JSON Schema to define the structure of the output.

### Basic Structured Output

```sesi
let rawJson = "{\"projectName\": \"Sesi\", \"version\": \"1.8.6\", \"status\": \"active\"}"
let analysis = structured_output({projectName: string, version: string, status: string})(rawJson)
show "Project: " analysis["projectName"]
show "Version: " analysis["version"]
show "Status: " analysis["status"]
```

## Reasoning Features

### Requiring Gemini API or OpenAI API

To use Reasoning features, set up your API key:

```bash
export GEMINI_API_KEY="your-gemini-key-here"
# Or your OpenAI key
export OPENAI_API_KEY="your-openai-key-here"
```

Or you can set it up in an `.env` file:

```env
GEMINI_API_KEY="your-api-key-here"
OPENAI_API_KEY="your-openai-key-here"
```

Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Simple Model Call

Reasoning features allow passing configuration options via a block format before the prompt.

```sesi
let response = model("gemini-3-flash-preview") {temperature: 0.8, max_tokens: 1000} {"What is 2 + 2?"}
show response
```

### Reasoning with Structured Output

```sesi
let analysis = structured_output({sentiment: string, score: number})(model("gemini-3.5-flash-lite") {"Analyze sentiment of: This product is great!"})
show "Sentiment: " analysis["sentiment"]
show "Score: " analysis["score"]
```

### Image Generation

Like `model`, the `image` command takes configuration parameters.

```sesi
let logo = image("gemini-3.1-flash-image-preview") {ratio: "1:1", size: "512", temperature: 0.3} {"Make a beautiful logo for the word Sesi"}
"logo.png" | write_image(logo)
show "Generated image successfully!"
```

### Memory & Conversation

```sesi
memory chat {"You are helpful."}
let response = model("gemini-3-flash-preview") {chat "User: Hello!"}
show response
chat = chat "Assistant:" response
```

### Concurrent Processes

Sesi can orchestrate multiple concurrent scripts using the `spawn()` builtin.

```sesi
// master.sesi
"worker_1.sesi" | spawn
"worker_2.sesi" | spawn
show "Both workers are now running concurrently."
```

---

## Opening URLs and Local Files

Use `open()` to hand a URL or existing local file to the operating system:

```sesi
"https://code-with-sesi.netlify.app" | open
"reports/dashboard.html" | open({"mode": "browser", "browser": "Firefox"})
```

Use `open_file()` when the target must be a local file:

```sesi
"README.md" | open_file
"README.md" | open_file({"editor": "Visual Studio Code"})
"favicon.png" | open_file({"viewer": "Preview"})
```

Both functions accept an optional settings object:

- `browser`: browser application name
- `editor`: text editor application name
- `viewer`: viewer application name
- `image_viewer`: alias for `viewer`
- `mode`: `"auto"`, `"browser"`, `"editor"`, `"viewer"`, or `"image_viewer"`

They are desktop integration functions and are disabled in safe mode. Run scripts that use them with explicit local access:

```bash
sesi -l open_report.sesi
# Equivalent:
sesi --local open_report.sesi
```

`open()` recognizes `http`, `https`, `ftp`, `file`, and `mailto` URLs. For non-URL targets, both functions require an existing path and apply Sesi's filesystem path checks. They return `true` once the operating system has accepted the launch request; they do not wait for the opened application to close.

---

## Built-in Functions

### I/O

```sesi
show value        // Print to stdout
prompt | input     // Prompt user for terminal input
text | speech(voice?, gemini_model?) // Speak text
audio_path | from_speech(language?, gemini_model?) // Transcribe an audio file
text | translate(to, from?, gemini_model?) // Translate text
string | read_file(string?) -> string    // Read file contents (text or base64)
path | write_file(content) // Write text to a file
string | append_file(string) -> bool // Append string content to file
path | write_image(content) // Write base64 encoded image to a file
target | open(options?) -> bool // Open a URL or local file in an external app (local mode)
path | open_file(options?) -> bool // Open an existing local file (local mode)
string | from_json  // Parse JSON string back to value

convert(type) { config } { file } // Convert documents/media/audio between formats

path | list_dir     // List directory contents
path | exists       // Check whether a sandbox-approved path exists
path | get_ext      // Get lowercase extension (for example, "tar.gz")
"folder" | zip("bundle.zip") // Create; omit destination to list an archive
"bundle.zip" | zip("output") // Extract
path | make_dir     // Create a new directory
old | rename(new)   // Rename or move a file/directory
src | archive(dest) // Backup/copy file/directory recursively
path | trash(auto)  // Move to trash or permanently remove
path | spawn        // Launch concurrent background process
command | exec      // Synchronous shell execution

time()             // Unix timestamp (ms)
random()           // Random number (0-1)

path | sesi(local) // Run a Sesi file synchronously in-process
code | python(args)  // Execute Python code
code | js(args)      // Execute JavaScript code
body | html(options) // Build a complete HTML page string
key | env(default)  // Get environment variable(s)
```

### Type Checking

```sesi
value | to_json()     // Convert to valid JSON string
value | type        // Get type name
value | str         // Convert to string
value | num         // Convert to number
any | float         // Convert to floating-point number
value | bool        // Convert to boolean
```

### Collections

```sesi
collection | len   // Collection length
array | push(item)  // Add to array
array|string | append(any)     // Append to array or concatenate to string
array | pop         // Remove from array
array | join(sep)   // Join array into string
string | split(sep) // Split string to array
object | keys       // Get object keys
object | values     // Get object values
n | range           // Create [0, 1, ..., n-1]
string | to_upper   // Convert string to uppercase
string | to_lower   // Convert string to lowercase
string | trim       // Remove whitespace from both ends
coll | slice(s, e)  // Slice a string or array
str | swap(tgt, rep) // Replace all occurrences of substring
str | contains(sub) // Check if string contains substring
str | locate(sub)   // Find index of substring (-1 if not found)
array | map(callback) // Map array elements
array | filter(callback) // Filter array elements
array | reduce(callback, initial) // Reduce array elements
array | find(callback) // Find first matching element
```

### Network & Concurrency

```sesi
url | web_get(headers = {})        // Natively fetch from URL via HTTP GET
url | web_send(body, headers = {}) // Natively post body to URL via HTTP POST
array<function> | multi_req        // Run multiple tasks/requests physically in parallel
port | listen(handler)             // Starts HTTP server
port | api(handler)                // Starts WebSocket server
options | launch                   // Launches a browser with given options

browser.newPage()                 // Creates a new page
browser.close()                   // Closes the browser

url | page.goto                    // Navigates to a URL
selector | page.get_attribute(attr) // Retrieves the value of an attribute

page.title()                      // Retrieves the title of the page`
page.content()                    // Retrieves the HTML content of the page

options? | page.screenshot()         // Takes a screenshot of the page
script | page.evaluate()             // Evaluates a script in the page context
selector | page.wait_for_selector(options?) // Waits for a selector to appear
ms | page.wait_for_timeout()         // Waits for a specified time in milliseconds
selector | page.fill(name)         // Fills a form field
selector | page.press(key)         // Presses a key in an element
selector | page.click              // Clicks an element
selector | page.inner_text()         // Retrieves the text content of an element
options? | page.pdf                // Generates a PDF of the current page

page.close()                      // Closes the current page
```

### Reasoning

```sesi
alias | set_alias(model)         // Register a custom local name for a model

workflow(steps, input)          // Run a multi-step reasoning workflow
define_tool(name, fn, desc)     // Register a custom tool
list_tools()                    // List custom tool names
```

### Error Handling

```sesi
type | error_type(message, data) // Create a custom error object
error | raise_error              // Throw an error
```

### Math

```sesi
x | exp             // Exponential function
val | trunc(n?)     // Truncate number or text (char limit)
```

### System & Control

```sesi
filePath | live(exportName)         // Hot-reloading function wrapper
action | retry(options)             // Execute with backoff/retry
debug(message?)                            // Pause execution and launch interactive REPL
```

### Standard Library Modules

Standard library features are available with selective `allow ... in with {...}` imports or namespace `allow ... in as Name` imports:

```sesi
allow "std/math" in with {PI, sqrt}
let jsonText = to_json({"ready": true})
let jsonValue = from_json(jsonText)
allow "std/time" in as Time
// Time.sleep(), Time.now()

allow "std/db" in with {db_open}
// "data.db" | db_open("password") -> Encrypted document DB

allow "std/audio" in as Audio
let note = "C4"
// note | Audio.play(500), Audio.synth(), Audio.save(), Audio.mix()

allow "std/theory" in as Music
// note | Music.chord(, "M7"), Music.scale("A3", "minor")

allow "std/draw" in as Draw
// Draw.rect(), Draw.circle(), "drawing.svg" | Draw.save_svg(100, 100)

allow "std/game" in as Game
// Game.create(), game.add(), game.rule(), game.build("game.html"), game.run()
```

## Running Examples

Try the included examples:

```bash
# Basic examples
sesi examples/main/01_hello.sesi
sesi examples/main/02_variables.sesi
sesi examples/main/03_functions.sesi
sesi examples/main/04_conditionals.sesi
sesi examples/main/05_loops.sesi
sesi examples/main/06_arrays_objects.sesi
sesi examples/main/09_structured_output.sesi
sesi examples/main/11_memory_storage.sesi
sesi examples/main/12_classification.sesi
sesi examples/main/13_data_pipeline.sesi      # lazy/force pipeline summary

# Reasoning examples (automatically loads .env for Gemini API key)
sesi examples/optional/08_model_call.sesi
sesi examples/optional/10_code_generation.sesi
sesi examples/optional/14_folder_explainer.sesi

# Image generation example
sesi examples/optional/15_image_generation.sesi

# Advanced Version 1.3 features
sesi examples/main/16_modules.sesi
sesi examples/main/17_http_client.sesi
sesi examples/main/18_parallel_requests.sesi  # profile/report concurrency timing
sesi examples/main/19_search_web.sesi
sesi examples/optional/20_model_aliases.sesi
sesi examples/main/21_custom_tools.sesi
sesi examples/optional/22_reasoning_plus_custom_tools.sesi

# Advanced Version 1.5 features
sesi examples/main/23_file_conversion.sesi
sesi examples/main/24_http_server.sesi
sesi examples/main/24_http_handler.sesi
sesi examples/main/25_webpage_server.sesi
sesi examples/main/26_database.sesi
sesi examples/main/27_robust_web_db.sesi
sesi examples/optional/28_streaming.sesi
sesi examples/main/29_tool_piping.sesi
sesi examples/main/30_error_recovery.sesi     # retry plus timeout fallback
sesi examples/main/31_synthesizer.sesi

# Pre-2.0 features
sesi examples/main/32_browser_automation.sesi
sesi examples/main/33_base64.sesi             # Base64 plus encrypt/decrypt
sesi examples/main/34_sesi_api.sesi
sesi examples/main/35_speech_language.sesi
sesi examples/main/36_regex_media.sesi
sesi examples/main/37_game_engine.sesi
sesi examples/optional/37_ai_video_generation.sesi
```

## Common Patterns

### Processing Arrays

```sesi
let numbers = [1, 2, 3, 4, 5]

// Iterate
for n in numbers {show n}

// Build new array
let doubled = []
for n in numbers {doubled | push(n * 2)}
show doubled  // [2, 4, 6, 8, 10]
```

### String Operations

```sesi
let text = "hello world"

// Concatenation
prompt greeting {"Hello," "World!"}

// Length
let len = len(text) // or length(text)

// Uppercase/lowercase
let upper = text | to_upper
let lower = text | to_lower

// Split and join
let words = text | split(" ")
let rejoined = words | join("-")
```

### Reasoning Classification

```sesi
fn classify(item: string) {show model("gemini-3-flash-preview"){"Classify as: FRUIT, VEGETABLE, or GRAIN. Item: "item}}

"apple" | classify
"carrot" | classify
"wheat" | classify
```

## Debugging Tips

### Print Intermediate Values

```sesi
fn complex(x: number) {
  let step1 = x * 2
  show "Step 1:" step1
  let step2 = step1 + 10
  show "Step 2:" step2
}

5 | complex
```

### Check Types

```sesi
let value = "hello"
show value | type  // "string"
if (value | type) == "string" {show "It's a string!"}
```

### Validate Model Responses

```sesi
let response = model("gemini-3-flash-preview") {"Respond with YES or NO"}
if response == "" {
  show "Error: no response"
} else if (response | len) > 100 {
  show "Warning: response too long"
} else {show "Response:" response}
```

## Performance Considerations

- **Model calls are blocking**: Each model() call waits for the API response
- **Token usage**: Larger prompts use more tokens and cost more
- **Use appropriate models**: gemini-3.5-flash-lite for most tasks, gemini-3.1-pro-preview for complex reasoning, and gemini-3.6-flash for balanced use.
- **Batch operations**: Ask Reasoning to process multiple items in one call instead of looping

## Next Steps

1. **Tutorial: Writing Scripts**: [WRITING_SCRIPTS.md](docs/WRITING_SCRIPTS.md)
2. **Read the spec**: [SPECIFICATION.md](docs/SPECIFICATION.md)
3. **Learn about reasoning**: [REASONING.md](docs/REASONING.md)
4. **Understand architecture**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. **Check roadmap**: [ROADMAP.md](docs/ROADMAP.md)
6. **Study examples**: [examples/](examples/)

## Getting Help

Sesi comes with an advanced, built-in **Sesira assistant** right in your command line. Instead of static help messages, you can query Sesi directly about how to use any statement, standard library, or architectural pattern:

```bash
# Ask Sesira for help directly
sesi -help "how do I parse a JSON string?"
sesi --help "explain structured_output and give an example"
sesi -h "how to spawn background processes?"
```

You can also pass a file into the help context so Sesira can talk about that exact script:

```bash
sesi examples/main/01_hello.sesi -h
sesi examples/main/01_hello.sesi -h "what is this script doing?"
```

Other useful CLI options:

```bash
# Run a one-line snippet (inline)
sesi -e "show 'hello'"
```

### Security & Sandboxing

```bash
# Encrypt or decrypt a script file (with password parameter)
sesi -enc my_script.sesi -p "my-password"
sesi -dec my_script.sesi -p "my-password"
```

To avoid exposing passwords in your shell's history, you can set the `SESI_PASSWORD` environment variable in your `.env` file (or your system's shell environment).

```bash
export SESI_PASSWORD="my-password"

# Encrypt or decrypt automatically using SESI_PASSWORD environment variable
sesi -enc my_script.sesi
sesi -dec my_script.sesi

# Disable sandbox protections for a run
sesi examples/main/01_hello.sesi -l

# Add extra allowed filesystem paths
sesi examples/main/01_hello.sesi -a ./docs,./examples/*
```

### Repository Script Shortcuts

If working directly inside the Sesi codebase, you can use convenient npm shortcuts to run Sesi commands:

```bash
# Evaluate inline code
npm run sesi:eval "show 'Hello from npm!'"

# Encrypt / Decrypt files using SESI_PASSWORD environment fallback
npm run sesi:encrypt "my_script.sesi"
npm run sesi:decrypt "my_script.sesi"

# Search with Sesira
npm run sesira "how do I use multi_req()?"
```

Sesira retrieves relevant context from Sesi's native repository database and specification documentation to generate a conversational answer in real time.

You can also:

- Check documentation in [docs/](docs/)
- Review examples in [examples/](examples/)
- Read error messages carefully
- Try simpler programs first

## Reporting Issues

When reporting bugs:

1. Provide a minimal example
2. Show the error message
3. Include your Sesi version
4. Specify OS and Node.js version

---

Happy programming with Sesi! 🚀
