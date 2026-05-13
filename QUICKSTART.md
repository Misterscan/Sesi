# Quick Start Guide: Sesi Programming Language

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. **Clone and install**:

```bash
cd sesi-programming-lang
npm install -g
```

2. **Build from TypeScript**:

```bash
npm run build
```

3. **Run a program (if installed globally)**:

```bash
sesi main/start.sesi
```

_(If not installed globally, you can use `npm run example 01_hello.sesi`)_

### Run Tests

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
const PI = 3.14159
print x
print name
print PI
```

### Functions

```sesi
fn add(a: number, b: number) -> number {return a + b}
let result = add(5, 3)
print result  // 8
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
print person["name"] + " is " + person["age"] + " years old."    // "Alice is 25 years old."
```

## AI Features

### Requiring Gemini API

To use AI features, set up your API key:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Simple Model Call

```sesi
let response = model("gemini-3-flash-preview") {"What is 2 + 2?"}
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
let analysis = structured_output({sentiment: string, score: number})
(model("gemini-3.1-flash-lite") {"Analyze sentiment of: This product is great!"})
print "Sentiment: " analysis["sentiment"]
print "Score: " analysis["score"]
```

### Memory & Conversation

memory chat {"You are helpful."}
let response = model("gemini-3-flash-preview") {chat + "\n\nUser: Hello!"}
print response
chat = chat + "\nAssistant: " + response
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
write_file(path, content) // Write text to a file
```

### Type Checking

```sesi
type(value)        // Get type name
str(value)         // Convert to string
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

# AI examples (automatically loads .env for Gemini API key)
sesi examples/08_model_call.sesi
sesi examples/09_structured_output.sesi
sesi examples/10_code_generation.sesi
sesi examples/11_memory_conversation.sesi
sesi examples/12_classification.sesi
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
let greeting = "Hello, " + "World!"

// Length
let len = len(text)

// Uppercase/lowercase (v2+)
// let upper = upper(text)
// let lower = lower(text)

// Split and join
let words = split(text, " ")
let rejoined = join(words, "-")
```

### AI Classification

```sesi
fn classify(item: string) -> string {return model("gemini-3-flash-preview")
{"Classify as: FRUIT, VEGETABLE, or GRAIN. Item: " item}}
print "apple -> " classify("apple")
print "carrot -> " classify("carrot")
print "wheat -> " classify("wheat")
```

## Debugging Tips

### Print Intermediate Values

```sesi
fn complex(x: number) {
  let step1 = x * 2
  print "Step 1: " + str(step1)
  let step2 = step1 + 10
  print "Step 2: " + str(step2)
  return step2
}
print complex(5)
```

### Check Types

```sesi
let value = "hello"
print type(value)  // "string"
if type(value) == "string" {print "It's a string!"}
```

### Validate AI Responses

```sesi
let response = model("gemini-3-flash-preview") {"Respond with YES or NO"}
if response == "" {print "Error: no response"}
else if len(response) > 100 {print "Warning: response too long"}
else {print "Response: " response}
```

## Performance Considerations

- **AI calls are blocking**: Each model() call waits for the API response
- **Token usage**: Larger prompts use more tokens and cost more
- **Use appropriate models**: gemini-3.1-flash-lite for most tasks, gemini-3.1-pro-preview for complex reasoning
- **Batch operations**: Ask AI to process multiple items in one call instead of looping

## Next Steps

1. **Read the spec**: [SPECIFICATION.md](docs/SPECIFICATION.md)
2. **Learn about reasoning **: [SYSTEMS_REASONING.md](docs/SYSTEMS_REASONING.md)
3. **Understand architecture**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. **Check roadmap**: [ROADMAP.md](docs/ROADMAP.md)
5. **Study examples**: [examples/](examples/)

## Getting Help

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
