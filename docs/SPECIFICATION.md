# Sesi Language Specification (v1.5)

## 1. Philosophy & Design Principles

Sesi is built on these core principles:

1. **Conciseness and Legibility**: The syntax is minimal. If a concept can be expressed simply, the language gets out of the way to let you express it.
2. **Buildable from Scratch**: Sesi is a complete, functioning language with its own lexer, parser, and interpreter.
3. **Simplicity Enables Power**: Because the core language is simple, complex operations (like hitting APIs or orchestrating processes) become trivial extensions of the language, rather than tangled SDK implementations.
4. **Transparency Over Magic**: Sesi executes exactly what you write.
5. **Practicality**: Focus on reducing boilerplate code, emphasizing what developers actually need over academic completeness.

## 2. Target Users

**Primary**: Developers who want a clean, fast, and legible language where writing code, whether purely logic-based or calling out to a Reasoning model, is completely frictionless.

**Secondary**:

- Engineers transitioning from traditional languages (TypeScript, Python, Go)
- Developers looking for minimal boilerplate.
- Teams requiring complex logic with a fraction of the boilerplate

**Use Cases**:

- Writing clean CLI tools and scripts
- Interacting with APIs without SDK boilerplate
- Quickly orchestrating shell commands
- Rapid prototyping and scripting

## 3. V1.5 Feature Set (Current)

### Core Language Features

- ✅ Variables and bindings (`let`)
- ✅ Functions (named, anonymous)
- ✅ Conditionals (`if/else`)
- ✅ Loops (`while`, `for`)
- ✅ Error Handling (`try/catch` blocks)
- ✅ Data types (number, string, bool, array, object)
- ✅ Process Execution (`spawn`, `exec`, `time`, `random`)
- ✅ Comments (`//`, `/* */`)
- ✅ Operators (arithmetic, logical, comparison)
- ✅ Standard library (print, len, range, etc.)
- ✅ Interactive REPL shell environment (`sesi --repl`)
- ✅ Diagnostic Tools (`--ast` and `--tokens` pretty visualization)
- ✅ Statement execution tracing (`SESI_DEBUG=1` env variable)
- ✅ `prompt` blocks (composable templates for concise formatting)
- ✅ `structured_output()` (schema-guided structured output with JSON recovery and empty-object fallback on failure)
- ✅ `tool_call()` (Fully functional function calling for tool use)
- ✅ `memory` (simple multi-turn script memory and retrieval context management)

### Reasoning-Native Features

- ✅ `model()` calls (native model with configuration)
- ✅ `image()` calls (native image generation with configuration)
- ✅ `images` config key (multimodal vision input for `model()` and `image()`)

### Type System

- ✅ Primitive types: `number`, `string`, `bool`, `null`
- ✅ Collection types: `array<T>`, `object<T>`
- ✅ Type inference
- ✅ Union types: `T | U`
- ✅ Optional types: `T?`

### Module System

- ✅ `import` / `export`
- ✅ Namespace support
- ✅ Built-in modules
- ✅ Multi-path module resolution (`SESI_PATH`, `~/.sesi/lib` global library)

## 4. Target Language (Syntax)

### 4.1 Lexical Elements

#### Keywords

```
let if else while for fn print import export async
prompt model image convert memory structured_output tool_call break continue try catch true false null await
```

#### Identifiers & Literals

```
identifier: [a-zA-Z_][a-zA-Z0-9_]*
number: [0-9]+ | [0-9]*\.[0-9]+
string: "..." | '...'
comment: // ... | /* ... */
```

#### String Escapes & Multiline Rules

- Supported escape sequences: `\\n`, `\\t`, `\\r`, `\\\\`, `\\"`, `\\'`
- Unknown escape sequences are runtime errors during lexing with line and column context
- Strings can span multiple lines when a literal newline appears before the closing quote
- Unterminated strings report the starting line and column of the string literal

### 4.2 Program Structure

```
program := statement*
statement := declaration | expression_statement | block_statement
```

### 4.3 Declarations

#### Variable Declaration

```
let_stmt := 'let' identifier ('=' expression)? (';' | newline)
```

Example:

```sesi
let x = 10
let y = 20
let z  // z is null initially
```

#### Function Declaration

```
fn_stmt := 'async'? 'fn' identifier '(' parameters ')' '->' type? block
parameters := (identifier ':' type ('=' expr)?)? (',' identifier ':' type ('=' expr)?)*
```

Example:

```sesi
fn add(a: number, b: number) {print a + b}
fn greet(name: string = "World") {print "Hello," name}
```

#### Import/Export

```
import_stmt := 'import' (identifier | '{' identifiers '}') 'from' string
export_stmt := 'export' (fn_stmt | let_stmt)
```

Example:

```sesi
import {add, subtract} from "math"
export fn multiply(a, b) {print a * b}
```

### 4.4 Control Flow

#### If Statement

```
if_stmt := 'if' expression block ('else' block)?
```

#### Loops

```
while_stmt := 'while' expression block
for_stmt := 'for' identifier 'in' expression block | 'for' identifier '=' expr 'to' expr block
```

#### Error Handling

```
try_stmt := 'try' block 'catch' '(' identifier ')' block
```

#### Loop Control

```
break_stmt := 'break'
continue_stmt := 'continue'
```

Example:

```sesi
for i = 0 to 10 {print i}
try
{let result = "Hello"
} catch (e) {
print e}
```

### 4.5 Expressions

#### Literals

```
literal := number | string | bool | null | array | object
array := '[' (expression (',' expression)*)? ']'
object := '{' (string ':' expression (',' string ':' expression)*)? '}'
```

#### Operators (Left to Right, Lowest to Highest Precedence)

```
expr := assignment
assignment := logical_or ('=' assignment)?
logical_or := logical_and ('||' logical_and)*
logical_and := equality ('&&' equality)*
equality := comparison (('==' | '!=') comparison)*
comparison := addition (('<' | '>' | '<=' | '>=' | '<>') addition)*
addition := multiplication (('+' | '-') multiplication)*
multiplication := unary (('*' | '/' | '%') unary)*
unary := ('!' | '-' | 'await') unary | postfix
postfix := primary ('['expression']' | '.'identifier | '('args?')' | primary)*
primary := identifier | literal | '('expression')' | prompt | model | image | convert | memory | call
```

#### Function Call

```
call := identifier '(' (expression (',' expression)*)? ')'
```

#### Prompt Block

```
prompt := 'prompt' identifier '{'content'}'
content := (string | expression | newline)
```

Example:

```sesi
prompt codeReview {"Review this code for bugs:" code "Provide specific issues found."}
```

#### Model & Image Calls

```
model_call := 'model' '('STRING')' config_block? '{'prompt'}'
image_call := 'image' '('STRING')' config_block? '{'prompt'}'
convert := 'convert' '('(identifier | STRING)')' config_block? '{'file'}'
config_block := '{' config_entry (',' config_entry)* '}'
config_entry := (STRING | identifier) ':' expression
```

**Config keys:**

| Key             | Applies to       | Type                      | Description                                                                |
| --------------- | ---------------- | ------------------------- | -------------------------------------------------------------------------- |
| `thinkingLevel` | `model`          | `string \| object`        | **Recommended**: Effort level (`"minimal"`, `"low"`, `"medium"`, `"high"`) |
| `temperature`   | `model`, `image` | `number`                  | \*Will be deprecated in Gemini 3.x+\_ (Sampling temperature)               |
| `max_tokens`    | `model`          | `number`                  | Max output token count                                                     |
| `top_k`         | `model`          | `number`                  | \*Will be deprecated in Gemini 3.x+\_                                      |
| `top_p`         | `model`          | `number`                  | \*Will be deprecated in Gemini 3.x+\_                                      |
| `ratio`         | `image`          | `string`                  | Aspect ratio e.g. `"16:9"`                                                 |
| `size`          | `image`          | `string`                  | `"512"`, `"1K"`, `"2K"`, `"4K"`                                            |
| `images`        | `model`, `image` | `string \| array<string>` | Local file path(s) passed as visual input                                  |

Example:

```sesi
let result = model("gemini-3.5-flash") {images: "scan.png", thinkingLevel: "low"} {"Transcribe all visible text."}
let output = model("gemini-3.5-flash") {thinkingLevel: "medium"} {prompt}
```

#### Convert Expression

```
convert := 'convert' '('(identifier | STRING)')' config_block? '{'file'}'
```

The `convert` expression transforms documents or media files between different formats (e.g. images, audio, documents).

**Config keys:**

- `file_type`: The input format extension (e.g. `"md"`, `"csv"`, `"png"`, `"wav"`). If the input is a local file path, this key is optional and can be inferred from the file extension.
- `output_type`: The target format extension (e.g. `"html"`, `"json"`, `"jpg"`, `"mp3"`). This key is required.

Example:

```sesi
let html = convert(doc) {file_type: "md", output_type: "html"} {"# Heading\nHello world"}
let json = convert(doc) {file_type: "csv", output_type: "json"} {"name,age\nAlice,30"}
let converted_file = convert(doc) {file_type: "md", output_type: "html"} {"input.md"}
```

#### Await Expression

```
await_expr := 'await' expression
```

The `await` expression is used to block execution and resolve the value of a Sesi Promise returned by an asynchronous function.

Example:

```sesi
async fn getGreeting(name) {
  return "Hello, " + name
}

let p = getGreeting("Alice") // returns a Sesi promise
let greeting = await p // blocks and resolves to "Hello, Alice"
```

#### Structured Output

```
structured_output := 'structured_output' '('schema')' '('expression')'
schema := '{' (identifier ':' type (',' identifier ':' type)*)? '}'
```

Example:

```sesi
let rawJson = "{\"projectName\": \"Sesi\", \"version\": \"1.5.0\", \"status\": \"active\"}"
let parsedRegistry = structured_output({projectName: string, version: string, status: string})(rawJson)
```

#### Tool Call

```
tool_call := 'tool_call' '('function_name')' '('(model_call | expressions)?')'
```

Example (Native Sandboxed Dispatch):

```sesi
fn add(a: number, b: number) -> number { return a + b }
let sum = tool_call(add)(10, 20)
```

#### Memory (State Management)

```
memory := 'memory' identifier ('{'expressions'}')?
```

Example:

```sesi
memory conversation {"Previous messages here"}
let response = model("gemini-3-flash-preview") {prompt {conversation "New question:" userInput}}
conversation = conversation "Assistant:" response
```

### 4.6 Type Annotations

```
type := primitive_type | collection_type | union_type | optional_type
primitive_type := 'number' | 'string' | 'bool' | 'null'
collection_type := 'array' '<' type '>' | 'object' '<' type '>'
union_type := type ('|' type)
optional_type := type '?'
```

## 5. Expression Evaluation Rules

1. **Short-circuit evaluation**: `&&` and `||` short-circuit
2. **Type coercion**: Automatic for numeric operations; explicit for string/number
3. **Null propagation**: Operations on `null` return `null` (no exceptions in v1.x)
4. **Model responses**: Always returned as strings initially; structured_output provides type safety

## 6. Scope and Binding

- **Global scope**: Module level
- **Function scope**: Within function definitions
- **Block scope**: Within blocks (if/while/for)
- **Lexical scoping**: Inner scopes shadow outer scopes
- **Closure support**: Functions capture enclosing scope

## 7. Runtime Semantics

### Execution Order

1. Tokenize (lexer)
2. Parse (parser) → AST
3. Evaluate (interpreter)
4. Model calls are **blocking** (no async in v1)

### Memory Model

- **Stack**: Local variables, function parameters
- **Heap**: Arrays, objects, strings
- **Reasoning Context**: Implicit conversation history per `memory` binding

### Error Handling (V1 Simple)

- Runtime and model errors can be caught with `try/catch`
- Model errors throw when Gemini returns no text or a non-`STOP` finish reason
- `read_file()`, `write_file()`, and `list_dir()` throw on filesystem failure
- `structured_output()` currently logs parsing failures and returns `{}` if recovery fails

## 8. Built-in Functions (V1.x)

```
print(any)                    // Output to stdout
debug()                       // Pauses and opens interactive REPL debugger
len(array | string | object)  // Length
range(number) -> array        // [0, 1, ..., n-1]
type(any) -> string           // Type name
str(any) -> string            // Convert to string
num(any) -> number            // Convert to number
bool(any) -> bool             // Convert to bool
keys(object) -> array         // Object keys
values(object) -> array       // Object values
push(array, any)              // Add element
pop(array) -> any             // Remove last
join(array, string) -> string // Join with separator
split(string, string) -> array // Split by separator
read_file(string) -> string    // Read file contents
write_file(string, string) -> bool // Write file contents
write_image(string, string) -> bool // Write base64 image data to file
list_dir(string) -> array<string> // List directory contents
make_dir(string) -> bool          // Create directory (recursive)
spawn(string) -> number           // Concurrent process creation
exec(string) -> string            // Synchronous shell execution
time() -> number                  // Current Unix timestamp
random() -> number                // Random float (0.0 to 1.0)
```

### Built-in Global Variables

- `args` - `array<string>`: Contains the command-line arguments passed to the script, excluding Sesi runtime options and the script path.

## 9. Module System

Runtime module execution and standard namespace modules are fully implemented and natively supported in v1.x.

### Defining Modules

```sesi
// math.sesi
export fn add(a, b) {print a + b}
export fn multiply(a, b) {print a * b}
export let PI = 3.14159
```

### Importing Modules

```sesi
import {add, multiply, PI} from "math"
let result = add(10, 20)
```

### Built-in Standard Library Modules

```sesi
import time from "std/time"    // Time/date functions
import math from "std/math"    // Math operations
import json from "std/json"    // JSON parsing
```

### Module Resolution Order (v1.x)

When you write `import {x} from "mymodule"`, Sesi searches for `mymodule.sesi` in the following order, stopping at the first match:

| Priority | Location                      | Description                                                                            |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| 1        | **Script's own directory**    | Same folder as the currently running `.sesi` file                                      |
| 2        | **Current working directory** | The directory you ran `sesi` from                                                      |
| 3        | **`SESI_PATH`**               | Semicolon-separated (Windows) or colon-separated (Unix) list of additional directories |
| 4        | **`~/.sesi/lib`**             | Global shared library directory — available system-wide                                |

This means imports always resolve correctly regardless of where you run `sesi` from.

### Global Library: `~/.sesi/lib`

The global library directory (`C:\Users\<you>\.sesi\lib` on Windows, `~/.sesi/lib` on Unix) lets you maintain shared modules that are importable from **any project on your system**.

To install a module globally, copy it to the lib directory:

```powershell
# Windows
copy mymodule.sesi $env:USERPROFILE\.sesi\lib\

# Unix / macOS
cp mymodule.sesi ~/.sesi/lib/
```

Then import it from any project without copying the file:

```sesi
// Works from any folder anywhere on your system
import {callAPI, saveImage} from "retrorender"
import {GetProfile} from "profiles"
```

### Custom Library Paths: `SESI_PATH`

For team or monorepo setups, set the `SESI_PATH` environment variable to point to one or more shared library directories:

```powershell
# Windows — add to your shell profile for persistence
$env:SESI_PATH = "C:\MyLibs\sesi-shared;C:\Projects\common"

# Unix / macOS
export SESI_PATH="/mylibs/sesi-shared:/projects/common"
```

Multiple paths are separated by `;` on Windows and `:` on Unix.

### Sub-module Resolution

When a module is loaded from any search path, its own imports are resolved **relative to that module's directory first**. This means modules can safely import their own siblings without any path configuration.

## 10. Reasoning Features Details

### Prompt Blocks

Prompts are composable message templates:

```sesi
prompt translate {"translate the following to Spanish:" sourceText}
prompt summarize {"Summarize this in 3 sentences:" text}
prompt combined {summarize " Now " translate}
```

### Model & Image Calls

Model calls can take optional configuration parameters (written on a single line) followed by one or more prompts/strings.

```sesi
// Model call with native thinking effort level
let response = model("gemini-3.5-flash") {thinkingLevel: "low"} {"Say hello"}
print response  // Returns string

let logo = image("gemini-3.1-flash-image-preview") {ratio: "1:1", size: "512"} {"A vector logo"}
write_image("logo.png", logo)
print "Image written to logo.png"
```

#### Config Block Options:

- **`thinkingLevel`**: `string` (`"minimal"`, `"low"`, `"medium"`, `"high"`) or legacy `object` with keys `"thinking"` and `"level"`. Natively configures Gemini's reasoning budget.
- **`max_tokens`**: `number` (maximum response tokens)
- **`images`**: `string` or `array<string>` (paths to multimodal vision input files)
- **`cache`**: `bool` (set to `false` to explicitly bypass Sesi Logic Caching)
- **`temperature`**: _ Will be deprecated in Gemini 3.x+, use thinkingLevel instead._ — reasoning is pre-optimized for defaults.
- **`top_k` / `top_p`**: _ Will be deprecated in Gemini 3.x+, use thinkingLevel instead._ — reasoning is pre-optimized for defaults.

### Reasoning with Structured Output

```sesi
let result = structured_output({title: string, category: string, confidence: number})(model("gemini-3.1-flash-lite") {"Extract metadata from this text:" text})
print result.title       // Access fields
print result.confidence  // Type-safe access
```

### Reasoning with Tool Calling

```sesi
fn calculateTax(amount: number, rate: number) {print amount * rate}
let taxAmount = tool_call(calculateTax)(model("gemini-3.1-flash-lite") {"Calculate 8% tax on $100"})
taxAmount
```

### Reasoning with Memory

```sesi
memory chat {"System: You are a helpful assistant."}
fn askQuestion(question: string)
{let response = model("gemini-3-flash-preview") {chat "User:" question}
chat = chat "Assistant:" response}
```

## 11. Examples

### Example 1: Simple Computation

```sesi
let x = 10
let y = 20
print x + y  // Output: 30
```

### Example 2: Function with Reasoning

```sesi
fn analyzeText(text: string) -> string {return model("gemini-3.5-flash") {thinkingLevel: "low"} {"Analyze this text and return key insights:" text}}
print analyzeText("Reasoning is transforming industries")
```

### Example 3: Reasoning with Structured Output

```sesi
let sentiment = structured_output({label: string, score: number})(model("gemini-3-flash-preview") {"Analyze sentiment of:" userInput})
print sentiment.label
print sentiment.score
```

## 12. Undefined Behavior & Limitations (V1.x)

- **No async/await**: All operations within a script are blocking (including model calls). Concurrency must be achieved via `spawn()`.
- **No custom types**: Only built-in types are supported natively.
- **No pattern matching**: Basic if/else only.
- **No generics**: Array and object collections are untyped at runtime.
- **Limited introspection**: Basic type() only.
- **No macros**: No compile-time code generation.
- **Single-threaded runtime**: Execution per script is single-threaded. System-level concurrency is handled via multi-process `spawn()`.
- **No garbage collection tuning**: Rely on Node.js GC.

## 13. Compatibility Notes

- Sesi programs run on Node.js 18+
- Requires `@google/genai` SDK v2.0.1+
- Requires valid Gemini API key (GEMINI_API_KEY env var)
