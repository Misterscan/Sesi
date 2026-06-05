# Sesi Built-in Functions Reference

## I/O Functions

### print(...args)

Print values to standard output, separated by spaces.

```sesi
print "Hello"
print 42
print "Value:", 10 + 20
print [1, 2, 3]
```

**Returns**: `null`

---

## Type Functions

### type(value) -> string

Get the type name of a value.

```sesi
type(42)           // "number"
type("hello")      // "string"
type(true)         // "bool"
type(null)         // "null"
type([1, 2, 3])    // "array"
type({})           // "object"
```

**Returns**: `string` - one of: `"number"`, `"string"`, `"bool"`, `"null"`, `"array"`, `"object"`, `"unknown"`

---

### str(value) -> string

Convert any value to a string.

```sesi
str(42)            // "42"
str(3.14)          // "3.14"
str(true)          // "true"
str([1, 2, 3])     // "[1, 2, 3]"
str({ "a": 1 })        // "{'a': 1}"
```

**Returns**: `string`

---

### to_json(value) -> string

Convert an array or object into a valid, formatted JSON string.

```sesi
to_json({ "a": 1, "b": [1, 2] })
/*
{
  "a": 1,
  "b": [1, 2]
}
*/
```

**Returns**: `string` (valid JSON)

---

### from_json(string) -> any

Parse a valid JSON string back into a native Sesi primitive, array, or object.

```sesi
let raw = "{\"a\": 1, \"b\": [1, 2]}"
let obj = from_json(raw)
print obj["a"]     // 1
```

**Returns**: `any` - native Sesi primitive, array, or object, or `null` if parsing fails

---

### num(value) -> number

Convert a value to a number.

```sesi
num("42")          // 42
num("3.14")        // 3.14
num(true)          // 1
num(false)         // 0
num("hello")       // null (can't convert)
```

**Returns**: `number` or `null` if conversion fails

---

### bool(value) -> bool

Convert a value to boolean.

```sesi
bool(1)            // true
bool(0)            // false
bool("")           // false
bool("hello")      // true
bool([])           // true
bool(null)         // false
```

**Returns**: `bool` - Uses truthiness rules

---

## Collection Functions

### len(collection) -> number

Get the length of a string, array, or object.

```sesi
len("hello")       // 5
len([1, 2, 3])     // 3
len({ "a": 1, "b": 2 })  // 2
len(null)          // null (invalid)
```

**Returns**: `number` or `null` if not a collection

---

### range(n) -> array

Create an array of numbers from 0 up to (but not including) n.

```sesi
range(5)           // [0, 1, 2, 3, 4]
```

**Returns**: `array<number>`

---

### push(array, value) -> array

Add an element to the end of an array.

```sesi
let arr = [1, 2, 3]
push(arr, 4)
print arr          // [1, 2, 3, 4]
```

**Note**: Modifies array in-place and returns it.

**Returns**: `array`

---

### pop(array) -> any

Remove and return the last element of an array.

```sesi
let arr = [1, 2, 3]
let last = pop(arr)
print last         // 3
print arr          // [1, 2]
```

**Returns**: The removed element, or `null` if array is empty

---

### join(array, separator) -> string

Join array elements into a string with separator.

```sesi
let arr = [1, 2, 3]
join(arr, "-")     // "1-2-3"
join(["a", "b"], ", ")  // "a, b"
```

**Returns**: `string`

---

### split(string, separator) -> array

Split a string into an array by separator.

```sesi
split("a,b,c", ",")     // ["a", "b", "c"]
split("hello world", " ")  // ["hello", "world"]
```

**Returns**: `array<string>`

---

### keys(object) -> array

Get all keys of an object.

```sesi
let obj = { "name": "Alice", "age": 30 }
keys(obj)          // ["name", "age"]
```

**Returns**: `array<string>` or `null` if not an object

---

### values(object) -> array

Get all values of an object.

```sesi
let obj = {"name": "Alice", "age": 30}
values(obj)        // ["Alice", 30]
```

**Returns**: `array<any>` or `null` if not an object

---

## File System Functions

### read_file(path) -> string

Read the contents of a file as a string.

```sesi
let text = read_file("input.txt")
print text
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `string`

---

### write_file(path, content) -> bool

Write string content to a file. Overwrites the file if it exists.

```sesi
let success = write_file("output.txt", "Hello, Sesi!")
if success {print "File written successfully"}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### write_image(path, base64_content) -> bool

Write base64 encoded string content as an image file. Overwrites the file if it exists.

```sesi
let success = write_image("logo.png", logo_data)
if success {print "Image safely stored"}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### list_dir(path) -> array

List the contents of a directory as an array of strings.

```sesi
let files = list_dir(".")
print files
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `array<string>`

---

### make_dir(path) -> bool

Create a new directory recursively. Returns `true` on success, `false` or throws on failure.

```sesi
let success = make_dir("new_directory")
if success {print "Directory created successfully"}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

### convert(type) { config } { file } -> string

Convert file or document content between formats.

- `type`: `doc` (documents/text), `media` (images/video), or `audio`.
- `config`: Object containing conversion parameters:
  - `file_type`: Input format extension (e.g. `"md"`, `"csv"`, `"png"`, `"wav"`). Optional when input is a local file path (inferred from extension).
  - `output_type`: Target output format extension (e.g. `"html"`, `"json"`, `"jpg"`, `"mp3"`). Required.
- `file`: Input string content or input local file path.

If the input is a local file path, the converted content is saved to a file of the same name and directory with the target extension, and the path to the output file is returned. If the input is raw string content, the converted content is returned directly.

```sesi
// Raw content conversion
let html = convert(doc) {file_type: "md", output_type: "html"} {"# Hello"}
print html // "<h1>Hello</h1>"

// File path conversion
let out_path = convert(doc) {output_type: "html"} {"document.md"}
print out_path // "document.html"
```

**Returns**: `string` (converted content or path to the converted file)

---

## Network Functions

### web_get(url, headers = {}) -> string

Perform a synchronous HTTP GET request and return the response body as a string.

```sesi
let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
print response
```

**Returns**: `string`

---

### web_send(url, body, headers = {}) -> string

Perform a synchronous HTTP POST request with a request body and return the response as a string.

```sesi
let payload = "{\"title\": \"foo\"}"
let response = web_send("https://jsonplaceholder.typicode.com/posts", payload)
print response
```

**Returns**: `string`

---

### listen(port, handler) -> object

Starts a native HTTP server listening on the specified port. Requests are passed to the handler function (which can be a synchronous function or an `async fn`).

The `handler` receives a request object with the following properties:

- `method`: The HTTP method (e.g. `"GET"`, `"POST"`).
- `path`: The path portion of the URL (e.g. `"/test-route"`).
- `headers`: A map of the HTTP request headers.
- `body`: The request body as a string.
- `query`: A map of the URL query parameters.

The `handler` can return:

- A simple string: Sent as the HTTP response body with status `200` and `Content-Type: text/html`.
- A structured response object containing:
  - `"status"`: HTTP status code (default: `200`).
  - `"headers"`: Map of response headers (default: `Content-Type: text/html`).
  - `"body"`: Response body (string, or object which gets serialized to JSON).

Returns a server control object with a `close()` function to stop the server programmatically.

```sesi
async fn handleRequest(req) {
  print "Request path is:" req.path
  return {
    "status": 200,
    "body": "Hello from Sesi Server!"
  }
}

let server = listen(8080, handleRequest)
// ...
server.close()
```

**Returns**: `object` containing a `close` function.

---

### api(port, handler) -> object

Starts a native WebSocket server listening on the specified port. Incoming client messages are passed to the handler function (which can be a synchronous function or an `async fn`).

The `handler` receives two arguments:

- `client`: A controller object for the connected client containing:
  - `send(message)`: Sends a message to the client (automatically converted to a string).
  - `close()`: Closes the connection to this client.
- `message`: The incoming message payload as a string.

Returns a server control object with a `close()` function to stop the server programmatically.

```sesi
fn handleMessage(client, msg) {
  print "WS received:" msg
  client.send("Echo: " + msg)
}

let server = api(8989, handleMessage)
// ...
server.close()
```

**Returns**: `object` containing a `close` function.

---

## System Functions

### spawn(path) -> number

Launch a Sesi script as a concurrent background process. Returns the process ID (PID).

```sesi
let pid = spawn("worker.sesi")
print "Launched worker with PID:" pid
```

**Returns**: `number` (PID)

---

### exec(command) -> string

Execute a shell command synchronously and return its output.

```sesi
let files = exec("ls -la")
print files
```

**Returns**: `string` (stdout)

---

### time() -> number

Returns the current Unix timestamp in milliseconds.

```sesi
let start = time()
// ... do work ...
print "Elapsed time:" time() - start "ms"
```

**Returns**: `number`

---

### multi_req(fns) -> array

Concurrently execute multiple Sesi function closures, builtins, or asynchronous functions in parallel and return their resolved results as an array.

```sesi
async fn job1() {
  return "a"
}
async fn job2() {
  return "b"
}
let results = multi_req([job1, job2])
print results // ["a", "b"]
```

**Returns**: `array<any>` containing the resolved returned values of each function in original index order.

---

### workflow(steps, input = "") -> object

Run a multi-step reasoning workflow where each step can reference prior outputs.

Default behavior is automatic and requires no special syntax:

- Step 1 gets the workflow input appended to its prompt
- Step 2+ gets the previous step output appended to its prompt

Each step is an object with at minimum a `"prompt"` string. Optional keys include:

- `"model"` (default: `"gemini-3.1-flash-lite"`)
- `"temperature"`, `"max_tokens"`, `"top_k"`, `"top_p"`
- `"thinkingLevel"`, `"cache"`, `"search"`

```sesi
let steps = [{"prompt": "Summarize:"}, {"prompt": "Critique:"}, {"prompt": "Finalize:"}]
let result = workflow(steps, "Design a landing page brief")
print result["final"]
```

**Returns**: `object` with keys `"input"`, `"steps"` (array of step outputs), and `"final"`.

---

### set_alias(alias, model) -> bool

Register a custom local name for a model string. Aliases are resolved automatically by `model()`, `image()`, and `workflow()`.

```sesi
set_alias("fast", "gemini-3.1-flash-lite")
let answer = model("fast") {"Summarize this paragraph."}
```

**Returns**: `bool` (`true` when the alias is registered)

---

### define_tool(name, fn, description = "") -> bool

Register a custom tool name that can be called through `tool_call(name)(...)`.

```sesi
fn summarize(text)
{return "Summary: " + text}

define_tool("summarizer", summarize, "Summarizes text")
let result = tool_call(summarizer)("Hello")
```

**Returns**: `bool` (`true` when the tool is registered)

---

### list_tools() -> array

List custom tool names registered by `define_tool`.

```sesi
let tools = list_tools()
print tools
```

**Returns**: `array<string>`

---

### error_type(type, message, data = null) -> object

Create a custom typed error object you can throw with `raise_error`.

```sesi
let err = error_type("ValidationError", "Missing email", {"field": "email"})
```

**Returns**: `object` with keys `"type"`, `"message"`, and `"data"`.

---

### raise_error(type_or_error, message = "", data = null) -> never

Throw a custom typed error that can be handled in `try/catch`.

```sesi
try {
  raise_error("RateLimit", "Too many requests", {"retryIn": 30})
} catch (e) {print "type:" e["type"] "message:" e["message"]}
```

You can also pass an `error_type(...)` object directly:

```sesi
let err = error_type("ValidationError", "Invalid payload", {"field": "email"})
raise_error(err)
```

**Returns**: never (always throws)

---

### random() -> number

Returns a random floating-point number between 0 (inclusive) and 1 (exclusive).

```sesi
let rand = random()
if rand > 0.5 {print "Heads"} else {print "Tails"}
```

---

## Debugging Functions

### debug() -> null

Pauses execution and launches an interactive debugger REPL in your shell terminal.

```sesi
let x = 10
let y = 20
debug()  // Pauses execution and opens interactive sesi-debug REPL
print x + y
```

**REPL Commands**:

- `env` — Displays all variables in the active lexical scope chain.
- `eval <expr>` — Evaluates any Sesi expression in-memory within the active scope context.
- `c` / `continue` — Resumes standard program execution.

**Returns**: `null`

---

## Global Variables

### args

An array of strings containing the command-line arguments passed to the Sesi script. This excludes any Sesi interpreter options (e.g. `-l`) and the script filename itself.

```sesi
print "Number of script args:" len(args)
if len(args) > 0 {
  print "First script argument:" args[0]
}
```

**Type**: `array<string>`

---

## Math Functions

### exp(x) -> number

Returns Euler's number $e$ (approx. `2.71828`) raised to the power of $x$.

```sesi
exp(0)             // 1.0
exp(1)             // 2.718281828459045
let sigmoid = 1.0 / (1.0 + exp(0.0 - 0.5))
print sigmoid      // 0.6224593312018546
```

**Returns**: `number`

---

## Math Functions (std/math)

Additional math functions are available natively by importing the `"std/math"` module:

```sesi
import {sqrt, abs, floor, ceil, sin, cos, tan, pow} from "std/math"

print sqrt(16) // 4
print floor(3.7) // 3
```

## Function Introspection (v2 planned)

These are planned for v2:

```sesi
// Get function name
name(func) -> string

// Get function arity (parameter count)
arity(func) -> number

// Check if value is a function
is_function(value) -> bool
```

---

## Collection Checks (v2 planned)

```sesi
// Planned for v2:
is_array(value) -> bool
is_object(value) -> bool
is_string(value) -> bool
is_number(value) -> bool
is_bool(value) -> bool
is_null(value) -> bool
```

---

## String Functions (v2 planned)

```sesi
// Planned for v2:
length(string) -> number         // Alias for len()
upper(string) -> string          // Uppercase
lower(string) -> string          // Lowercase
trim(string) -> string           // Remove whitespace
contains(string, substring) -> bool
starts_with(string, prefix) -> bool
ends_with(string, suffix) -> bool
index_of(string, substring) -> number
slice(string, start, end?) -> string
replace(string, from, to) -> string
repeat(string, count) -> string
```

---

## Array Functions (v2 planned)

```sesi
// Planned for v2:
map(array, fn) -> array          // Transform elements
filter(array, fn) -> array       // Keep matching elements
reduce(array, fn, initial) -> any
find(array, fn) -> any           // First match
includes(array, value) -> bool
index_of(array, value) -> number
reverse(array) -> array
sort(array, compareFn?) -> array
unique(array) -> array           // Remove duplicates
flatten(array) -> array          // Flatten one level
```

---

## Error Handling

Sesi supports structured error handling via `try/catch` blocks.

```sesi
try
{let data = read_file("missing.txt")
}catch (e) {
print "Caught error:", e}


```

---

## Tips & Tricks

### Converting values

```sesi
// To string
str(value)
value + ""        // Works for most types

// To number
num(string)
string + 0        // Doesn't work (concatenation)

// To bool
bool(value)
!(!value)         // Double negation
```

### Checking types

```sesi
type(value) == "array"
type(value) == "object"
type(value) == "null"
```

### Working with arrays

```sesi
let arr = [1, 2, 3]

// Length
len(arr)

// Last element
arr[len(arr) - 1]

// Add element
push(arr, 4)

// Remove last
pop(arr)

// Join
join(arr, ", ")
```

### Working with objects

```sesi
let obj = { "a": 1, "b": 2 }

// Get keys
keys(obj)

// Get values
values(obj)

// Check key
keys(obj) contains "a"    // Future: not yet supported
```

---

## Standard Library Modules (Supported natively in v1.x)

### std/math

Includes math constants and functions: `PI`, `E`, `sin`, `cos`, `tan`, `sqrt`, `floor`, `ceil`, `abs`, `pow`, `log`, `exp`.

```sesi
import {PI, E, sqrt, sin, cos} from "std/math"
```

### std/time

Includes time, sleep, and timezone formatting functions: `now()`, `sleep(ms)`, `format(timestamp, options)`.

```sesi
import {now, sleep, format} from "std/time"

let t = now()
// Format time with a specific timezone
let formatted = format(t, {"timeZone": "America/New_York", "timeStyle": "medium"})
print formatted // e.g. "2:27:02 AM"
```

### std/json

Includes JSON serialization: `parse(str)`, `stringify(val)`.

```sesi
import {parse, stringify} from "std/json"
```

### std/db

Includes Sesi's lightweight embedded Document Database engine: `db_open(filename, password?)`.
A database instance supports opening collections, inserting documents, querying/finding, updating, and deleting records.

#### Encryption & Decryption at Runtime:

If an optional second parameter `password` is provided, Sesi automatically encrypts database contents stored on disk using **AES-256-CBC** with a dynamic, randomized initialization vector (IV) on every write, and decrypts it during reads.

```sesi
import {db_open} from "std/db"

// Open database with a passphrase
let db = db_open("data.db", "secure-passphrase-here")
let users = db.collection("users")

// CRUD API:
// users.insert(object) -> Returns inserted document (adds unique _id if missing)
// users.find(query_object?) -> Returns array of matching documents (returns all if query omitted)
// users.update(query_object, update_object) -> Returns number of updated documents
// users.delete(query_object) -> Returns number of deleted documents
```

---

## Module Resolution (v1.x)

Sesi resolves local module imports by searching directories in priority order:

| Priority | Location                  | Notes                                               |
| -------- | ------------------------- | --------------------------------------------------- |
| 1        | Script's own directory    | Same folder as the running `.sesi` file             |
| 2        | Current working directory | Where you ran `sesi` from                           |
| 3        | `SESI_PATH` env var       | Semicolon (Windows) or colon (Unix) separated paths |
| 4        | `~/.sesi/lib`             | Global shared library, available system-wide        |

### Global Library (`~/.sesi/lib`)

Place any `.sesi` module in `~/.sesi/lib` (Windows: `%USERPROFILE%\.sesi\lib`) to make it importable from any project on your system:

```powershell
# Install a module globally (Windows)
copy mymodule.sesi $env:USERPROFILE\.sesi\lib\
```

```bash
# Install a module globally (Linux/Unix)
cp mymodule.sesi ~/.sesi/lib/
```

```sesi
// Now importable from any folder
import {callAPI, saveImage} from "retrorender"
import {GetProfile} from "profiles"
import {GetGuide} from "guides"
```

### `SESI_PATH` Environment Variable

Point `SESI_PATH` to one or more additional directories for shared modules:

```powershell
# Windows
$env:SESI_PATH = "C:\MyLibs;C:\Projects\shared"
```

```bash
# Unix / macOS
export SESI_PATH="/mylibs:/projects/shared"
```

### Error Output

If a module cannot be found in any search location, Sesi prints a detailed error showing exactly where it looked:

```
Module not found: "retrorender"
Searched in:
  C:\MyApp
  C:\MyApp
  C:\Users\owner\.sesi\lib
Tip: add a folder to SESI_PATH, or place shared modules in ~/.sesi/lib
```

---

## Performance Notes

- **print()** is unbuffered (each call flushes)
- **Array operations** are O(n) for most functions
- **Object operations** are O(1) for key access
- **String concatenation** with + is O(n) (consider pre-allocating)

---

## Return Value Reference

| Function      | Return Value on Error             |
| ------------- | --------------------------------- |
| num(value)    | `null`                            |
| len(value)    | `null`                            |
| keys(value)   | `null`                            |
| values(value) | `null`                            |
| pop([])       | `null`                            |
| type(value)   | `"unknown"`                       |
| str(value)    | `"null"` or string representation |

---

## See Also

- [Quick Start Guide](../QUICKSTART.md)
- [Language Specification](SPECIFICATION.md)
- [Runtime Architecture](ARCHITECTURE.md)
- [Built-in Functions Reference](BUILTINS.md)
- [Command Line Interface (CLI) Reference](CLI.md)
- [Image Generation & Input](IMAGE_GENERATION.md)
- [Compare to other languages](COMPARISON.md)
- [Reasoning & Simple Logic](REASONING.md)
- [Examples](../examples)
