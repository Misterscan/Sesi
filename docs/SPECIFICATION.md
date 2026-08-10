# Sesi Language Specification

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

## 3. Feature Set

### Core Language Features

- ✅ Variables and bindings (`let`)
- ✅ Functions (named, anonymous)
- ✅ Class-like object templates (`make`)
- ✅ Conditionals (`if/else`)
- ✅ Loops (`while`, `for`)
- ✅ Error Handling (`try/catch` blocks)
- ✅ Data types (number, string, bool, array, object)
- ✅ Process and Desktop Integration (`spawn`, `exec`, `open`, `open_file`, `time`, `random`, `convert`, `format`)
- ✅ Comments (`//`, `/* */`) — text is preserved in AST as `leadingComments` on declarations for doc tooling
- ✅ Operators (arithmetic, logical, comparison)
- ✅ Standard library (print, len, range, etc.)
- ✅ Interactive REPL shell environment (`sesi`)
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
- ✅ Lib support
- ✅ Built-in modules
- ✅ Multi-path module resolution (`SESI_PATH`, `~/.sesi/lib` global library)

## 4. Target Language (Syntax)

### 4.1 Lexical Elements

#### Keywords

```
let if else while for fn make print import export async
prompt model image convert memory structured_output tool_call break continue try catch true false null await
```

These words are reserved and cannot be used as binding, function, parameter, template, prompt, memory, or import names. In particular, `make` is reserved exactly like `prompt`.

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
let_stmt := 'let' identifier (':' type)? ('=' expression)? (';' | newline)
```

Example:

```sesi
let x = 10
let count: number = 10
let name: string = "Ada"
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
allow_stmt := 'allow' string 'in' with (identifier | '{' identifiers '}' | string)
export_stmt := 'export' (fn_stmt | let_stmt)
```

Example:

```sesi
allow "math" in with {
  add, subtract
}
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
logical_or := pipe ('||' pipe)*
pipe := logical_and ('|' logical_and)*
logical_and := equality ('&&' equality)*
equality := comparison (('==' | '!=') comparison)*
comparison := addition (('<' | '>' | '<=' | '>=' | '<>') addition)*
addition := multiplication (('+' | '-') multiplication)*
multiplication := unary (('*' | '/' | '%') unary)*
unary := ('!' | '-' | 'await') unary | postfix
postfix := primary ('['expression']' | '.'identifier | '('args?')' | primary)*
primary := identifier | literal | '('expression')' | prompt | model | image | convert | memory | call
```

#### Object Templates

```
make_declaration := 'make' identifier '{' make_member* '}'
make_member := let_declaration | function_declaration
```

`make` declares a callable, class-like object template. Calling its name
creates a fresh object. `start(self, ...)` supplies the constructor parameters
and initializes the instance. Every method declares `self` first; method calls
bind it automatically.

```sesi
make Person {
  let kind = "person"

  fn start(self, name) {
    self.name = name
  }

  fn greet(self) {
    return "Hello, " + self.name
  }
}

let ada = Person("Ada")
print ada.kind
print ada.greet()
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
prompt codeReview {"Review this code for bugs: "code" Provide specific issues found."}
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
| `stream`        | `model`          | `bool \| fn`              | Enable real-time streaming to stdout (`true`) or a callback function       |
| `system`        | `model`, `image` | `string`                  | Provider-native system instruction                                         |

Example:

```sesi
let result = model("gemini-3.6-flash") {images: "scan.png", thinkingLevel: "low"} {"Transcribe all visible text."}
let output = model("gemini-3.6-flash") {thinkingLevel: "medium"} {prompt}
```

#### Convert Expression

```
convert := 'convert' '('(identifier | STRING)')' config_block? '{'file'}'
```

The `convert` expression transforms documents or media files between different formats (e.g. images, audio, documents).

**Config keys:**

- `file_type`: The input format extension (e.g. `"md"`, `"csv"`, `"png"`, `"wav"`). If the input is a local file path, this key is optional and can be inferred from the file extension.
- `output_type`: The target format extension (e.g. `"html"`, `"json"`, `"jpg"`, `"mp3"`). This key is required.

Native document conversion pairs include `md -> html`, `html -> md`, `html -> txt`, `csv -> json`, `tsv -> json`, `json -> csv`, `json -> tsv`, `json -> yaml`, `yaml -> json`, `svg -> html`, `html -> svg`, and `svg -> txt`.

For image conversion, `convert(media)` also supports rasterizing `svg` file inputs to `png`, `jpg`, and `jpeg`, and wrapping raster image files such as `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `tiff`, and `avif` into SVG output.

Example:

```sesi
let html = convert(doc) {file_type: "md", output_type: "html"} {"# Heading\nHello world"}
let json = convert(doc) {file_type: "csv", output_type: "json"} {"name,age\nAlice,30"}
let yaml = convert(doc) {file_type: "json", output_type: "yaml"} {"[{\"name\":\"Alice\"}]"}
let markdown = convert(doc) {file_type: "html", output_type: "md"} {"<h1>Heading</h1><p>Hello world</p>"}
let converted_file = convert(doc) {file_type: "md", output_type: "html"} {"input.md"}
let rasterized_svg = convert(media) {output_type: "png"} {"logo.svg"}
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
let rawJson = "{\"projectName\": \"Sesi\", \"version\": \"1.8.0\", \"status\": \"active\"}"
let parsedRegistry = structured_output({projectName: string, version: string, status: string})(rawJson)
```

#### Tool Call

The `tool_call` expression allows native Sesi functions registered via `define_tool` to be invoked programmatically.

```sesi
// 1. Define the native Sesi function
fn calculateTax(amount: number, rate: number) -> number { return amount * rate }

// 2. Register the function as a tool
define_tool("calculateTax", calculateTax, "Calculate tax based on amount and rate")

// 3. Invoke the tool programmatically
let taxAmount = tool_call(calculateTax)(100, 0.08)
```

The tool invocation is synchronous and executes the registered function within the current interpreter context. This mechanism can be used by AI agents to perform side-effects, but it functions independently as a core language primitive.



#### Pipe Operator

The pipe operator `|` passes the result of the left expression as the first argument to the function call on the right.

```
pipe_expr := expression '|' function_call_or_identifier
```

Example:

```sesi
fn increment(x) { return x + 1 }
fn double(x) { return x * 2 }

let result = 5 | increment | double // evaluates to 12
```
_Rule of Thumb:_
> Use | for data pipelines: arrays, strings, objects, or multi-step transformations (data | filter | map | print).

> Use standard syntax () for math, boolean logic (!, &&, ||), comparisons (==, !=), and inline checks.

#### Memory (State Management)

```
memory := 'memory' identifier ('{'expressions'}')?
```

Example:

```sesi
memory conversation {"Previous messages here..."}
let userInput = "New message added."
let response = model("gemini-3-flash-preview") {conversation "New question: "userInput}
conversation = conversation + "Assistant:" + response
```

### 4.6 Type Annotations

```
type := primitive_type | collection_type | union_type | optional_type
primitive_type := 'number' | 'num' | 'string' | 'str' | 'bool' | 'null' | 'any'
collection_type := 'array' '<' type '>' | 'object' '<' type '>'
union_type := type ('|' type)
optional_type := type '?'
```

**Type aliases:** `num` is an alias for `number`, `str` is an alias for `string`, and `any` accepts any value. These can be used interchangeably in function signatures, variable annotations, and return types.

Variable annotations go between the variable name and `=`. They are optional, so either of these declarations is valid:

```sesi
let total: number = 42
let label = "draft"
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
- `read_file()`, `write_file()`, `list_dir()`, `open()`, and `open_file()` throw on filesystem or launch failure
- `structured_output()` currently logs parsing failures and returns `{}` if recovery fails

### Desktop Launching

`open()` and `open_file()` hand a target to an external desktop application and return `true` after the operating system accepts the launch request. They do not wait for the application to exit.

```sesi
open("https://code-with-sesi.netlify.app")
open("reports/dashboard.html", {"mode": "browser", "browser": "Firefox"})

open_file("README.md", {"editor": "Visual Studio Code"})
open_file("favicon.png", {"viewer": "Preview"})
```

Both functions are disabled in safe mode and require `sesi -l` or `sesi --local`.

`open(target, options?)` accepts an `http`, `https`, `ftp`, `file`, or `mailto` URL. When its target is not a URL, it behaves like `open_file()` and resolves an existing local path through the filesystem safety checks. `open_file(path, options?)` accepts only an existing local path.

The optional settings object supports:

| Key | Type | Meaning |
| --- | --- | --- |
| `browser` | `string` | Preferred browser application |
| `editor` | `string` | Preferred text editor application |
| `viewer` | `string` | Preferred viewer application |
| `image_viewer` | `string` | Alias for `viewer` |
| `mode` | `string` | `"auto"`, `"browser"`, `"editor"`, `"viewer"`, or `"image_viewer"` |

In `"auto"` mode, Sesi uses the requested image viewer for image extensions, the requested editor for text extensions, or the requested browser for browser-friendly extensions. If no matching application is specified, the operating system default is used.

## 8. Built-in Functions

```
print(any)                    // Output to stdout
debug()                       // Pauses and opens interactive REPL debugger
len(array | string | object)  // Length
range(number) -> array        // [0, 1, ..., n-1]
type(any) -> string           // Type name
str(any) -> string            // Convert to string
num(any) -> number            // Convert to number
float(any) -> number          // Convert to floating-point number
bool(any) -> bool             // Convert to bool
keys(object) -> array         // Object keys
values(object) -> array       // Object values
push(array, any)              // Add element
append(array|string, any)     // Append to array or concatenate to string
pop(array) -> any             // Remove last
join(array, string) -> string // Join with separator
split(string, string) -> array // Split by separator
regex(string, string, string|object?) -> array|bool|string // Regular-expression operations
tokenize(string, string|object?) -> array // Local OpenAI-compatible token IDs
count_tokens(string, string|object?) -> number // Native OpenAI/Gemini request count
estimate_tokens(string, string|object?) -> number // Explicit local approximation
estimate_cost(string, number|string, number|string?, object?) -> object // Token cost estimate
model_usage() -> object|null   // Latest provider-reported usage and estimated cost
gif(string|array, string, object?) -> string // FFmpeg-backed animated GIF creation
video(string) {object?} {expression} -> string // AI video generation; returns Base64 MP4
video(string|array, string, object?) -> string // FFmpeg-backed video creation/transcoding overload
ffmpeg(array, object?) -> object // Structured raw FFmpeg invocation
matrix_dot(array, array) -> array // Native rectangular matrix multiplication
matrix_transpose(array) -> array // Native matrix transpose
matrix_add(array, array) -> array // Native addition with single-row bias broadcasting
matrix_sub(array, array) -> array // Native same-shape subtraction
matrix_mul_elements(array, array) -> array // Native elementwise multiplication
matrix_scale(array, number) -> array // Native scalar multiplication
matrix_sigmoid(array) -> array // Native elementwise sigmoid
matrix_dsigmoid(array) -> array // Native sigmoid-output derivative
matrix_sum_rows(array) -> array // Native column sums as a single-row matrix
matrix_mse(array, array) -> number // Native mean squared error
to_upper(string) -> string       // Convert to uppercase
to_lower(string) -> string       // Convert to lowercase
trim(string) -> string        // Trim whitespace
slice(collection, number, number?) -> collection // Slice string or array
swap(string, string, string) -> string // Replace all target substrings
contains(string, string) -> bool       // Check if string contains substring
locate(string, string) -> number       // First index of substring, or -1
map(array, fn) -> array       // Transform array elements
filter(array, fn) -> array    // Filter array elements
reduce(array, fn, any?) -> any // Accumulate array elements
find(array, fn) -> any        // Find matching element
retry(fn, number | object) -> any // Execute function with retry and backoff
lazy(fn, ...args) -> lazy     // Create a memoized delayed computation
force(any) -> any             // Resolve lazy values and promises
timeout(fn, number, any?) -> any // Run function with millisecond deadline
profile(string, fn) -> any    // Measure function runtime and return its result
profile_start(string) -> string // Begin manual profiling section
profile_end(string) -> object // End manual profiling section
profile_report(string?) -> array | string // Return profiler measurements
read_file(string, string?) -> string    // Read file contents (text or base64)
encrypt(string, string) -> string       // AES-256-CBC encrypt UTF-8 string content
decrypt(string, string) -> string       // AES-256-CBC decrypt iv:ciphertext content
write_file(string, string) -> bool // Write file contents
append_file(string, string) -> bool // Append string content to file
write_image(string, string) -> bool // Write base64 image data to file
open(string, object?) -> bool    // Open URL or local file in external app; local mode only
open_file(string, object?) -> bool // Open existing local file in external app; local mode only
list_dir(string) -> array<string> // List directory contents
make_dir(string) -> bool          // Create directory (recursive)
spawn(string) -> number           // Concurrent process creation
exec(string) -> string            // Synchronous shell execution
sesi(string, bool?, bool?) -> string // Synchronous in-process Sesi execution or compile check
python(string, args) -> string    // Inline Python code execution
js(strings, args) -> string       // In-proccess Javascript execution
time() -> number                  // Current Unix timestamp
random() -> number                // Random float (0.0 to 1.0)
trunc(value, number?) -> any      // Truncate number (integer part) or string (char limit)
convert() -> bool                 // Convert between formats
memory_search(string, string, number?) -> array // Semantic similarity search over memory entries
memory_trim(string, number?) -> string          // Context window management with auto-summarization
```

### Built-in Global Variables

- `args` - `array<string>`: Contains the command-line arguments passed to the script, excluding Sesi runtime options and the script path.

## 9. Module System

Runtime module execution and standard library modules are fully implemented and natively supported in v1.x.

### Defining Modules

```sesi
// math.sesi
export fn add(a, b) {print a + b}
export fn multiply(a, b) {print a * b}
export let PI = 3.14159
```

### Importing Modules

You can import variables and functions from other modules using traditional `import` or the scoped library `allow` syntax:

```sesi
// Option 1: import named bindings directly
import {
  add,
  multiply,
  PI
} from "math"
let result = add(10, 20)

// Option 2: allow module to bind under a scoped library namespace
allow "math" in with Math
let result = Math.add(10, 20)

// Option 3: allow module to bind specific names directly
allow "math" in with {
  add, multiply
}
let result = add(10, 20)
```

### Built-in Standard Library Modules

```sesi
allow "std/time" in with Time    // Time/date functions
allow "std/math" in with Math    // Math operations
allow "std/json" in with JSON    // JSON parsing
allow "std/draw" in with Draw    // SVG/Pixel creation
allow "std/audio" in with Audio  // Audio synthesis
allow "std/theory" in with Music   // Music Theory
allow "std/terminal" in with Term  // Terminal options
allow "std/base64" in with Base64 // Base64 encode/decode
allow "std/api" in with API       // FastAPI-style HTTP API framework
```

### Module Resolution Order (v1.x)

When you write `allow "mymodule" in with {x}` , Sesi searches for `mymodule.sesi` in the following order, stopping at the first match:

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
allow "mymodule" in with {
  function1,
  function2,
  function3
}
allow "another-module" in with Name
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
prompt generate {"Craft a full report on the following: "sourceText}
prompt summarize {"Summarize this in 3 sentences: "sourceText}
prompt combined {summarize" Now "generate}
```

### Model & Image Calls

Model calls can take optional configuration parameters (written on a single line) followed by one or more prompts/strings.

```sesi
// Model call with native thinking effort level
let response = model("gemini-3.6-flash") {thinkingLevel: "low"} {"Say hello"}
print response  // Returns string

let logo = image("gemini-3.1-flash-image") {ratio: "1:1", size: "512"} {"A vector logo"}
write_image("logo.png", logo)
print "Image written to logo.png"
```

#### Config Block Options:

- **`thinkingLevel`**: `string` (`"minimal"`, `"low"`, `"medium"`, `"high"`) or legacy `object` with keys `"thinking"` and `"level"`. Natively configures Gemini's reasoning budget.
- **`max_tokens`**: `number` (maximum response tokens)
- **`images`**: `string` or `array<string>` (paths to multimodal vision input files)
- **`cache`**: `bool` (set to `false` to explicitly bypass Sesi Logic Caching)
- **`stream`**: `bool | fn` (set to `true` to stream tokens to standard output, or pass a Sesi function reference to handle incoming chunks)
- **`temperature`**: _ Will be deprecated in Gemini 3.x+, use thinkingLevel instead._ — reasoning is pre-optimized for defaults.
- **`top_k` / `top_p`**: _ Will be deprecated in Gemini 3.x+, use thinkingLevel instead._ — reasoning is pre-optimized for defaults.

### Speech, Transcription, and Translation

Sesi provides built-ins for spoken output, transcription, and translation.

```sesi
speech("Analysis complete")
let transcript = from_speech("interview.wav", "en")
let spanish = translate(transcript, "es", "en")
print spanish
```

- `speech(text, voice = null, gemini_model = null)` speaks through the operating system's local voice tool, or uses the optional Gemini model.
- `from_speech(audio_path, language = null, gemini_model = null)` transcribes with `nodejs-whisper`, or the optional Gemini model.
- `translate(text, to_language, from_language = "en", gemini_model = null)` translates through the `translate` package, or the optional Gemini model.

### Reasoning with Structured Output

```sesi
let result = structured_output({title: string, category: string, confidence: number})
(model("gemini-3.5-flash-lite") {"Extract metadata from this text: "text})
print result["title"]       // Access fields
print result["confidence"]  // Type-safe access
```

### Reasoning with Tool Calling

While `tool_call()` is a core language feature, it is the primary interface for AI agents to interact with your Sesi scripts. When an agent is given access to tools, it can decide to invoke them based on its reasoning process.

```sesi
fn calculateTax(amount: number, rate: number) -> number { return amount * rate }

// Register as a tool
define_tool("calculateTax", calculateTax, "Calculate tax based on amount and rate")

// Agent-driven usage:
// The model decides to invoke 'calculateTax' with specific parameters
let taxAmount = tool_call(calculateTax)(model("gemini-3.5-flash-lite") {"Extract tax amount and rate from text"}, 0.08)
```



### Reasoning with Memory

```sesi
memory chat {"System: You are a helpful assistant."}
fn askQuestion(question: string) {
  let response = model("gemini-3-flash-preview") {chat "User:" question}
  chat = chat + "Assistant:" + response
  return chat
}
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
let text = "Reasoning is transforming industries!"
fn analyzeText(text: string) -> string {return model("gemini-3.6-flash") {thinkingLevel: "low"} {"Analyze this text and return key insights: "text}}
print analyzeText()
```

### Example 3: Reasoning with Structured Output

```sesi
let userInput = "I love working with Sesi!"
let sentiment = structured_output({label: string, score: number})(model("gemini-3-flash-preview") {"Analyze sentiment of: "userInput})
print sentiment.label
print sentiment.score
```

## 12. Undefined Behavior & Limitations

- **No custom types**: Only built-in types are supported natively.
- **No pattern matching**: Basic if/else only.
- **No generics**: Array and object collections are untyped at runtime.
- **Limited introspection**: Basic type() only.
- **No macros**: No compile-time code generation.
- **Single-threaded runtime**: Execution per script event loop is single-threaded. System-level concurrency is handled via multi-process `spawn()`.
- **No garbage collection tuning**: Rely on Node.js GC.

## 13. Compatibility Notes

- Sesi programs run on Node.js 20+, using local models relies on Node.js 22+
- Requires `@google/genai` SDK v2.0.1+
- Requires valid Gemini API key (GEMINI_API_KEY env var)
