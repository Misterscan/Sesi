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

**Prerequisites:** Node.js 18+ and npm

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
sesi main/start.sesi
```

### Run Tests

For devs working on Sesi, you can verify your backend edits with the built-in test suite:
```bash
npm test
```

## Your First Program

Create a file called `hello.sesi`:

```sesi
print "Hello, Sesi!"
```

Run it:

```bash
sesi hello.sesi
```

## Basic Syntax

### Variables

```sesi
let x = 10
let name = "Alice"
let score = 95.5
print x
print name
print score
```

### Functions

```sesi
fn add(a: number, b: number) {print a + b}
add(5, 3)  // 8
```

### Control Flow

```sesi
let age = 25
if age >= 18 {print "Adult"} else {print "Minor"}
```

### Loops

```sesi
// While loop
let i = 0
while i < 5 {
  print i
  i = i + 1
}

// For loop
for j = 0 to 5 {print j}

// For-in loop
for item in [1, 2, 3] {print item}
```

### Arrays & Objects

```sesi
let numbers = [1, 2, 3, 4, 5]
print numbers[0]        // 1
print len(numbers)      // 5
let age = numbers[4] * 5   // 5 * 5 = 25
let person = {"name": "Alice", "age": age}
print person["name"] "is" person["age"] "years old."    // "Alice is 25 years old."
```

## Reasoning Features

### Requiring Gemini API

To use Reasoning features, set up your API key:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or you can set it up in an `.env` file:

```env
GEMINI_API_KEY="your-api-key-here"
```

Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Simple Model Call

Reasoning features allow passing configuration options via a block format before the prompt.

```sesi
let response = model("gemini-3-flash-preview") {"temperature": 0.8, "max_tokens": 1000} {"What is 2 + 2?"}
print response
```

### Prompts

```sesi
let name = "Developer"
prompt greeting {"Hello, " name "! " "How are you today?"}
print greeting
```

### Structured Output

```sesi
let analysis = structured_output({sentiment: string, score: number})(model("gemini-3.1-flash-lite") {"Analyze sentiment of: This product is great!"})
print "Sentiment: " analysis["sentiment"]
print "Score: " analysis["score"]
```

### Image Generation

Like `model`, the `image` command takes configuration parameters.

```sesi
let logo = image("gemini-3.1-flash-image-preview") {"ratio": '1:1', "size": 512, "temperature": 0.3, "max_tokens": 512} {"make a beautiful logo for the word Sesi"}
write_image("logo.png", logo)
print "Generated image successfully!"
```

### Memory & Conversation

```sesi
memory chat {"You are helpful."}
let response = model("gemini-3-flash-preview") {chat "User: Hello!"}
print response
chat = chat "Assistant:" response
```

### Concurrent Swarms

Sesi can orchestrate multiple concurrent scripts using the `spawn()` builtin.

```sesi
// master.sesi
spawn("worker_1.sesi")
spawn("worker_2.sesi")
print "Both workers are now running concurrently."
```

---

## Built-in Functions

### I/O

```sesi
print value        // Print to stdout
read_file(path)    // Read a file as text
from_json(path)    // Read a JSON file
write_file(path, content) // Write text to a file
write_image(path, content) // Write base64 encoded image to a file
list_dir(path)     // List directory contents
spawn(path)        // Launch concurrent background process
exec(command)      // Synchronous shell execution
time()             // Unix timestamp (ms)
random()           // Random number (0-1)
```

### Type Checking

```sesi
type(value)        // Get type name
str(value)         // Convert to string
to_json(value)      // Convert to valid JSON string
num(value)         // Convert to number
bool(value)        // Convert to boolean
```

### Collections

```sesi
len(array)         // Array/string length
push(array, item)  // Add to array
pop(array)         // Remove from array
join(array, sep)   // Join array into string
split(string, sep) // Split string to array
keys(object)       // Get object keys
values(object)     // Get object values
range(n)           // Create [0, 1, ..., n-1]
```

### Network & Concurrency

```sesi
web_get(url, headers = {})     // Natively fetch from URL via HTTP GET
web_send(url, body, headers = {}) // Natively post body to URL via HTTP POST
multi_req(array<function>)     // Run multiple tasks/requests physically in parallel
```

### Standard Library Modules

Standard library features are available natively in **v1.2+** using imports:

```sesi
import { PI, sqrt } from "std/math"
import { sleep, now } from "std/time"
import { stringify, parse } from "std/json"
```

## Running Examples

Try the included examples:

```bash
# Basic examples
sesi examples/01_hello.sesi
sesi examples/02_variables.sesi
sesi examples/03_functions.sesi
sesi examples/04_conditionals.sesi
sesi examples/05_loops.sesi
sesi examples/06_arrays_objects.sesi

# Reasoning examples (automatically loads .env for Gemini API key)
sesi examples/08_model_call.sesi
sesi examples/09_structured_output.sesi
sesi examples/10_code_generation.sesi
sesi examples/11_memory_conversation.sesi
sesi examples/12_classification.sesi
sesi examples/13_data_pipeline.sesi
sesi examples/14_folder_explainer.sesi

# Image generation example
sesi examples/15_image_generation.sesi

# Advanced Version 1.3 features
sesi examples/16_modules.sesi
sesi examples/17_http_client.sesi
sesi examples/18_parallel_requests.sesi
sesi examples/19_search_web.sesi
sesi examples/20_model_aliases.sesi
sesi examples/21_custom_tools.sesi
sesi examples/22_reasoning_plus_custom_tools.sesi
```

## Common Patterns

### Processing Arrays

```sesi
let numbers = [1, 2, 3, 4, 5]

// Iterate
for n in numbers {print n}

// Build new array
let doubled = []
for n in numbers {push(doubled, n * 2)}
print doubled  // [2, 4, 6, 8, 10]
```

### String Operations

```sesi
let text = "hello world"

// Concatenation
let greeting = "Hello," + "World!"

// Length
let len = len(text)

// Uppercase/lowercase (v2+)
// let upper = upper(text)
// let lower = lower(text)

// Split and join
let words = split(text, " ")
let rejoined = join(words, "-")
```

### Reasoning Classification

```sesi
fn classify(item: string) {print model("gemini-3-flash-preview")
{"Classify as: FRUIT, VEGETABLE, or GRAIN. Item: " item}}
classify("apple")
classify("carrot")
classify("wheat")
```

## Debugging Tips

### Print Intermediate Values

```sesi
fn complex(x: number) {
  let step1 = x * 2
  print "Step 1:" str(step1)
  let step2 = step1 + 10
  print "Step 2:" str(step2)
}
complex(5)
```

### Check Types

```sesi
let value = "hello"
print type(value)  // "string"
if type(value) == "string" {print "It's a string!"}
```

### Validate Model Responses

```sesi
let response = model("gemini-3-flash-preview") {"Respond with YES or NO"}
if response == "" {print "Error: no response"}
else if len(response) > 100 {print "Warning: response too long"}
else {print "Response: " response}
```

## Performance Considerations

- **Model calls are blocking**: Each model() call waits for the API response
- **Token usage**: Larger prompts use more tokens and cost more
- **Use appropriate models**: gemini-3.1-flash-lite for most tasks, gemini-3.1-pro-preview for complex reasoning
- **Batch operations**: Ask Reasoning to process multiple items in one call instead of looping

## Next Steps

1. **Read the spec**: [SPECIFICATION.md](docs/SPECIFICATION.md)
2. **Learn about reasoning**: [SYSTEMS_REASONING.md](docs/SYSTEMS_REASONING.md)
3. **Understand architecture**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. **Check roadmap**: [ROADMAP.md](docs/ROADMAP.md)
5. **Study examples**: [examples/](examples/)

## Getting Help

Sesi comes with an advanced, built-in **Interactive RAG Co-Pilot** right in your command line! Instead of static help messages, you can query Sesi directly about how to use any statement, standard library, or architectural pattern:

```bash
# Ask the Sesi Co-Pilot for help directly
sesi -help "how do I parse a JSON string?"
sesi --help "explain structured_output and give an example"
sesi -h "how to spawn background processes?"
```

You can also pass a file into the help context so the co-pilot can talk about that exact script:

```bash
sesi main/playground.sesi -h
sesi main/playground.sesi -h "why is this failing?"
```

Other useful CLI options:

```bash
# Run a one-line snippet
sesi -e "print 'hello'"

# Disable sandbox protections for a run
sesi main/start.sesi --local

# Add extra allowed filesystem paths
sesi main/start.sesi --allowed-paths ./docs,./examples
```

The co-pilot will dynamically index and train on Sesi's native repository database and retrieve full RAG context from our standard specification docs to generate a syntactically correct, 100% accurate, conversational answer in real-time!

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
