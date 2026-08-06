# Sesi Built-in Functions Reference

**This doc demonstrates both normal usage and piping operators.**

**You can write scripts in whichever format you are most comfortable with.**

## I/O Functions

### print(...args)

Print values to standard output, separated by spaces.

```sesi
print "Hello"
print 42
print "Value:" 10 + 20
print [1, 2, 3]
```

**Returns**: `null`

> `<content> | print` is also supported, but the normal way is reccomended.
---

### input(prompt) -> string

Prompt the user for terminal input, wait for them to press Enter, and return their response.

```sesi
let name = input("Enter your name: ")
let age = "Enter your age" | input
print "Hello," name ". You are" age "years old!"
```

**Parameters**:

- `prompt` (`string`): The text to display as a prompt before reading input. Optional.

**Returns**: `string`

---

## Speech & Translation Functions

These built-ins provide microphone transcription and text translation.

### speech(text, voice = null, gemini_model = null) -> bool|string

Speak text through the system's installed voice. On macOS this uses `say`, on Windows it uses `System.Speech`, and on Linux it uses `espeak-ng`.

```sesi
speech("Your local build is complete.")
speech("Bonjour tout le monde", "Thomas")

"You are learning a new coding language!" | speech
"Hola, buenos dias!" | speech("Mónica")
```

**Returns**: `true` after playback finishes.

Pass a Gemini text-to-speech model as the third argument to return base64-encoded audio instead of using the system voice.

---

### from_speech(audio_path, language = null, gemini_model = null) -> string

Transcribe an audio file using `nodejs-whisper`. `language` is optional (for example, `"en"` or `"fr"`).

```sesi
let transcript = from_speech("meeting.wav", "en")
let lyrics = "song.wav" | from_speech("en", "gemini-3.1-flash-lite")

print transcript
print lyrics
```

**Returns**: the transcript as text. `nodejs-whisper` and a downloaded model must be installed (`npx nodejs-whisper download base.en`).

Pass a Gemini model as the third argument to transcribe through Gemini instead of Whisper.

---

### translate(text, to_language, from_language = "en", gemini_model = null) -> string

Translate text with the [`translate`](https://www.npmjs.com/package/translate) package. Language values can use ISO language codes or English language names.

```sesi
let greeting = translate("Good morning", "es", "en")
let instructions = loadedFile | translate("en", "fr")

print greeting
print instructions
```

**Returns**: translated text.

Pass a Gemini model as the fourth argument to translate through Gemini instead of the `translate` package.

---

## Type Functions

### type(value) -> string

Get the type name of a value.

```sesi
type(42)           // "number"
42 | type

type("hello")      // "string"
"hello" | type

type(true)         // "bool"
true | type

type(null)         // "null"
null | type

type([1, 2, 3])    // "array"
([1, 2, 3]) | type

type({})           // "object"
({}) | type
```

**Returns**: `string` - one of: `"number"`, `"string"`, `"bool"`, `"null"`, `"array"`, `"object"`, `"unknown"`

---

### str(value) -> string

Convert any value to a string.

```sesi
str(42)            // "42"
42 | str

str(3.14)          // "3.14"
3.14 | str

str(true)          // "true"
true | str

str([1, 2, 3])     // "[1, 2, 3]"
([1, 2, 3]) | str

str({ "a": 1 })        // "{'a': 1}"
({ "a": 1 }) | str
```

**Returns**: `string`

---

### to_json(value) -> string

Convert an array or object into a valid, formatted JSON string.

```sesi
to_json({ "a": 1, "b": [1, 2] })
({ "a": 1, "b": [1, 2] }) | to_json

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
let piped = raw | from_json

print obj["a"]     // 1
print piped["b"][1]   // 2
```

**Returns**: `any` - native Sesi primitive, array, or object, or `null` if parsing fails

---

### num(value) -> number

Convert a value to a number.

```sesi
num(42)            // 42
42 | num

num("3.14")        // 3.14
"3.14" | num

num(true)          // 1
true | num

num(false)         // 0
false | num

num("hello")       // null (can't convert)
"hello" | num
```

**Returns**: `number` or `null` if conversion fails

---

### float(value) -> number

Convert a value to a floating-point number.

```sesi
float(42)        // 42
42 | float

float("3.14")      // 3.14
"3.14" | float

float(true)        // 1
true | float

float(false)       // 0
false | float

float("hello")     // null (can't convert)
"hello" | float
```

**Returns**: `number` or `null` if conversion fails

---

### bool(value) -> bool

Convert a value to boolean.

```sesi
bool(1)            // true
1 | bool

bool(0)            // false
0 | bool

bool("")           // false
"" | bool

bool("hello")      // true
"hello" | bool

bool([])           // true
[] | bool

bool(null)         // false
null | bool
```

**Returns**: `bool` - Uses truthiness rules

---

### Type Assertion Helpers

Return `true` if the value matches the respective type.

- `is_array(value) -> bool`
  
  `value | is_array`
- `is_object(value) -> bool`
  
  `value | is_object`
- `is_string(value) -> bool`
  
  `value | is_string`
- `is_number(value) -> bool`
  
  `value | is_number`
- `is_bool(value) -> bool`
  
  `value | is_bool`
- `is_null(value) -> bool`
  
  `value | is_null`

---

## Collection Functions

### len(collection) -> number

Get the length of a string, array, or object.

```sesi
len("hello")       // 5
"hello" | len

len([1, 2, 3])     // 3
[1, 2, 3] | len

len({ "a": 1, "b": 2 })  // 2
({ "a": 1, "b": 2 }) | len

len(null)          // null (invalid)
null | len
```

**Returns**: `number` or `null` if not a collection

---

### range(n) -> array

Create an array of numbers from 0 up to (but not including) n.

```sesi
range(5)           // [0, 1, 2, 3, 4]
5 | range
```

**Returns**: `array<number>`

---

### push(array, value) -> array

Add an element to the end of an array.

```sesi
let arr = [1, 2, 3]
push(arr, 4)

print arr          // [1, 2, 3, 4]

let newArr = arr
newArr | push(5)

print newArr      // [1, 2, 3, 4, 5]
```

**Note**: Modifies array in-place and returns it.

**Returns**: `array`

---

### append(collection, value) -> array | string

Append to an array or concatenate to a string.

```sesi
let arr = [1, 2]
append(arr, 3)

print arr            // [1, 2, 3]

let newArr = arr
newArr | append(4)

print newArr         // [1, 2, 3, 4]

append("Hello from", " Sesi")  // "Hello from Sesi"
"Welcome to " | append("Sesi!")  // "Welcome to Sesi!"
```

**Note**: For arrays, this modifies in-place and returns the same array.

**Returns**: `array`, `string`, or `null` for unsupported types

---

### pop(array) -> any

Remove and return the last element of an array.

```sesi
let arr = [1, 2, 3]
let last = pop(arr)

print last         // 3
print arr          // [1, 2]

let newLast = arr | pop

print newLast      // 2
```

**Returns**: The removed element, or `null` if array is empty

---

### join(array, separator) -> string

Join array elements into a string with separator.

```sesi
let arr = [1, 2, 3]
let pairs = [11, 22, 33, 44, 55]

join(arr, "-")     // "1-2-3"
join(["a", "b"], ", ")  // "a, b"

["code", "files", "memory", "folders"] | join(",\n")
pairs | join("a_") | append("a")
```

**Returns**: `string`

---

### split(string, separator) -> array

Split a string into an array by separator.

```sesi
split("a,b,c", ",")     // ["a", "b", "c"]
split("hello sesi", " ")  // ["hello", "sesi"]

"1-2-3-4-5" | split("-")
"This is how
the split function
handles multi-lines" | split("\n")
```

**Returns**: `array<string>`

---

### regex(pattern, text, options = null) -> array | bool | string

Run a JavaScript-compatible regular expression without dropping into `js()`.
The default `match` mode returns every match with its index, capture groups,
and named groups.

```sesi
let matches = regex("(?<word>[A-Z]+)", "IDs ABC and XYZ")

print matches[0]["match"]
print matches[0]["groups"]["word"]

let valid = regex("^[a-z]+$", "Sesi", {"mode": "test", "flags": "i"})

let parts = "[,;]\\s*" | regex("one, two; three", {"mode": "split"})

let cleaned = "\\s+" | regex("too   much space", {"mode": "replace", "flags": "g", "replacement": " "})
```

Options may be a flags string such as `"i"`, or an object:

- `mode`: `"match"` (default), `"test"`, `"replace"`, or `"split"`.
- `flags`: JavaScript regular-expression flags such as `i`, `m`, `s`, or `g`.
- `replacement`: Required string for `replace` mode.
- `limit`: Maximum matches or split parts; defaults to `10000`.

**Returns**: an array for `match`/`split`, a boolean for `test`, or a string for `replace`

---

### tokenize(string, options = null) -> array

Tokenize text into model token IDs (OpenAI-compatible tiktoken-style encoding).

```sesi
let ids = tokenize("Hello Sesi.")
print ids | length

let ids2 = "Hello Sesi" | tokenize("gpt-5.6-sol")

let words = "  Sesi   language   rocks  " | tokenize("simple")
// ["Sesi", "language", "rocks"]
```

**Options**:

- `model` (`string`, default `"gpt-5.6-sol"`): Model name used to pick tokenizer encoding.
- `encoding` (`string`, optional): Explicit tiktoken encoding override (for example `"o200k_base"`).
- `mode` (`string`, optional): Set to `"simple"` for basic whitespace tokenization.

You can also pass a string as the second argument directly:

- `tokenize(text, "simple")` for simple word splitting
- `tokenize(text, "gpt-5.6-sol")` to inspect plain-text token IDs for the current GPT flagship

**Returns**: `array<number>` (model token IDs), `array<string>` in simple mode, or `null` if input/options are invalid

---

### count_tokens(string, options = null) -> number

Count request tokens with the model provider's native counting endpoint.

```sesi
let count = count_tokens("Summarize this text.", "gpt-5.6-sol")
let gemini_count = count_tokens(text, "gemini-3.6-flash")
let local_count = text | count_tokens("local")
```

GPT models use OpenAI's `responses/input_tokens` endpoint. Gemini models use
Gemini's `models.countTokens` endpoint. Local models use their cached tokenizer
without an API request. Provider-backed counting requires the corresponding API
key.

**Returns**: `number`, or `null` if the input/options are invalid

---

### estimate_tokens(string, options = null) -> number

Estimate tokens locally without making a provider request. The options match `tokenize`; unknown and non-OpenAI model names explicitly fall back to `o200k_base`.

```sesi
let approximate = estimate_tokens(long_text, "gemini-3.6-flash")
let guess = longer_prompt | estimate_tokens("gpt-5.6-sol")
```

Use this only when an offline approximation is acceptable. For native Gemini counts, use `count_tokens`.

**Returns**: `number`, or `null` if the input/options are invalid

---

### estimate_cost(model, input, output = 0, rates = null) -> object

Estimate paid-tier text-token cost in USD. `input` and `output` may each be a token count or text.

```sesi
let planned = estimate_cost("gemini-3.6-flash", prompt, 2000)

print planned["input_tokens"]
print planned["total_cost_usd"]

// Unknown/private models can provide USD rates per one million tokens.
let custom = "private-model" | estimate_cost(500000, 100000, {
  "input_per_million": 2,
  "output_per_million": 8
})
```

When `input` or `output` is text, GPT models use local tokenization and Gemini models use native Gemini counting. Passing numeric counts never makes a provider request.

The result includes token counts, separate input/output costs, total cost, per-million rates, pricing source, and pricing snapshot date. Built-in GPT rates cover the current `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` family, including the documented long-context tier. Tool fees, cache storage, audio, images, free-tier allowances, taxes, and negotiated discounts are not included.

**Returns**: `object`, or `null` for an unsupported model without custom rates

---

### model_usage() -> object

Return provider-reported token usage and estimated cost for the most recent `model()` call in the current interpreter.

```sesi
let answer = model("gpt-5.6-sol") {"Explain closures briefly."}
let usage = model_usage()

print "Tokens:" usage["total_tokens"]
print "Estimated USD:" usage["total_cost_usd"]
```

Token counts come from the provider response. Gemini thinking tokens are reported separately as `thinking_tokens` and included in `billable_output_tokens`, `total_tokens`, and cost. Local logic-cache hits return `cached: true`, zero tokens, and zero added cost. Cost fields are `null` when the model has no built-in pricing entry.

**Returns**: `object`, or `null` before the first model call

---

### to_upper(string) -> string

Converts all alphabetic characters in a string to uppercase.

```sesi
to_upper("hello")      // "HELLO"
"hello" | to_upper

to_upper("Sesi V1.8.0")  // "SESI V1.8.0"
"Sesi V1.8.0" | to_upper
```

**Returns**: `string` or `null` if not a string

---

### to_lower(string) -> string

Converts all alphabetic characters in a string to lowercase.

```sesi
to_lower("SESI")      // "sesi"
"SESI" | to_lower

to_lower("Sesi V1.8.0")  // "sesi v1.8.0"
"Sesi V1.8.0" | to_lower
```

**Returns**: `string` or `null` if not a string

---

### trim(string) -> string

Removes whitespace from both ends of a string.

```sesi
trim("  spaces  ")  // "spaces"
"  spaces  " | trim
```

**Returns**: `string` or `null` if not a string

---

### slice(collection, start, end = null) -> string | array

Extracts a section of a string or array and returns it as a new string or array, without modifying the original.

```sesi
slice("abcdef", 1, 4)         // "bcd"
"abcdef" | slice(1, 4)

slice([10, 20, 30, 40], 2)    // [30, 40]
[10, 20, 30, 40] | slice(2)
```

**Parameters**:

- `collection` (`string` or `array`): The collection to slice.
- `start` (`number`): The zero-based index at which to begin extraction.
- `end` (`number`, optional): The zero-based index _before_ which to end extraction. If omitted, slices to the end of the collection.

**Returns**: `string` or `array` based on the input collection type, or `null` if arguments are invalid

---

### swap(string, target, replacement) -> string

Replaces all occurrences of a target substring within a string with a replacement substring.

```sesi
swap("a_b_c", "_", "-")    // "a-b-c"
"a_b_c" | swap("_", "-")
```

**Parameters**:

- `string` (`string`): The source string.
- `target` (`string`): The substring to be replaced.
- `replacement` (`string`): The substring that replaces the target.

**Returns**: `string` or `null` if arguments are invalid

---

### contains(string, sub) -> bool

Returns `true` if the string contains the given substring, `false` otherwise.

```sesi
contains("hello.sesi", ".sesi")  // true
"hello.sesi" | contains(".sesi)

contains("hello.sesi", ".ts")    // false
"hello.sesi" | contains(".ts")
```

**Parameters**:

- `string` (`string`): The string to search within.
- `sub` (`string`): The substring to search for.

**Returns**: `bool` or `null` if arguments are invalid

---

### locate(string, sub) -> number

Returns the index of the first occurrence of a substring within a string. Returns `-1` if the substring is not found.

```sesi
locate("hello.sesi", ".")    // 5
"hello.sesi" | locate(".")

locate("hello.sesi", "ts")   // -1
"hello.sesi" | locate("ts)
```

**Parameters**:

- `string` (`string`): The string to search within.
- `sub` (`string`): The substring to find.

**Returns**: `number` (zero-based index, or `-1` if not found), or `null` if arguments are invalid

---

### keys(object) -> array

Get all keys of an object.

```sesi
let obj = { "name": "Alice", "age": 30 }

keys(obj)          // ["name", "age"]
obj | keys
```

**Returns**: `array<string>` or `null` if not an object

---

### values(object) -> array

Get all values of an object.

```sesi
let obj = {"name": "Alice", "age": 30}

values(obj)        // ["Alice", 30]
obj | values
```

**Returns**: `array<any>` or `null` if not an object

---

### Additional Array / String Utilities

The following utilities work on strings and arrays natively:

- `starts_with(string, prefix) -> bool`

  `string | starts_with(prefix)`
- `ends_with(string, suffix) -> bool`

  `string | ends_with(suffix)`
- `index_of(collection, value) -> number`

  `collection | index_of(value)`
- `includes(collection, value) -> bool`

  `collection | includes(value)`
- `repeat(string, count) -> string`

  `string | repeat(count)`
- `reverse(array) -> array`

  `array | reverse`
- `sort(array, compareFn?) -> array`

  `array | sort(compareFn?)`
- `unique(array) -> array`

  `array | unique`
- `flatten(array) -> array`

  `array | flatten`

---

### map(array, callback) -> array

Creates a new array populated with the results of calling a provided function on every element in the calling array.

```sesi
let numbers = [1, 2, 3]

fn square(x) { return x * x }
let squares = map(numbers, square) // [1, 4, 9]

fn cube(x) { return x * x * x }
let cubed = numbers | map(cube) // [1, 8, 27]
```

**Parameters**:

- `array` (`array`): The source array.
- `callback` (`fn`): Function to execute on each element. Receives arguments: `(item, index, array)`.

**Returns**: `array`

---

### filter(array, callback) -> array

Creates a shallow copy of a portion of a given array, filtered down to just the elements from the given array that pass the test implemented by the provided function.

```sesi
let numbers = [1, 2, 3, 4]

fn isEven(x) { return x % 2 == 0 }
let evens = filter(numbers, isEven) // [2, 4]

fn isOdd(x) { return x % 2 != 0 }
let odd = numbers | filter(isOdd) // [1, 3]
```

**Parameters**:

- `array` (`array`): The source array.
- `callback` (`fn`): Function is a predicate, to test each element of the array. Return a truthy value to keep the element. Receives arguments: `(item, index, array)`.

**Returns**: `array`

---

### reduce(array, callback, initialValue = null) -> any

Executes a user-supplied "reducer" callback function on each element of the array, in order, passing in the return value from the calculation on the preceding element. The final result of running the reducer across all elements of the array is a single value.

```sesi
let numbers = [1, 2, 3, 4]

fn sum(acc, x) { return acc + x }

let total = reduce(numbers, sum) // 10
let totalWithInitial = numbers | reduce(sum, 10) // 20
```

**Parameters**:

- `array` (`array`): The source array.
- `callback` (`fn`): A function to execute on each element in the array (except the first, if no `initialValue` is provided). Receives arguments: `(accumulator, currentValue, index, array)`.
- `initialValue` (`any`, optional): A value to which `accumulator` is initialized on the first call. If no initial value is supplied, the first element in the array is used as the initial accumulator value, and `reduce()` starts executing the callback from the second element (index 1).

**Returns**: `any`

---

### find(array, callback) -> any

Returns the first element in the provided array that satisfies the provided testing function. If no values satisfy the testing function, `null` is returned.

```sesi
let numbers = [1, 3, 4, 7]

fn isEven(x) { return x % 2 == 0 }
let match = find(numbers, isEven) // 4

fn isOdd(x) { return x % 2 != 0 }
let odd = numbers | find(isOdd) // [1]
```

**Parameters**:

- `array` (`array`): The source array.
- `callback` (`fn`): Function to execute on each value in the array. Receives arguments: `(item, index, array)`.

**Returns**: `any` or `null`

---

## File System Functions

### read_file(path, mode = "text") -> string

Read the contents of a file as a string.

Modes:

- `"text"` (default): Reads UTF-8 text
- `"base64"`: Reads raw bytes and returns Base64 text

```sesi
let text = read_file("input.txt")
print text

let image_b64 = read_file("logo.png", "base64")
print image_b64

let pkg = "package.json | read_file
let audio = "audio.wav" | read_file("base64")
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `string` (or `null` for unsupported mode)

---

### write_file(path, content, encoding = null) -> bool

Write content to a file. Overwrites the file if it exists.

Encodings:

- `null` (default): writes UTF-8 text
- `"base64"`: decodes Base64 content and writes raw bytes

```sesi
let success = write_file("output.txt", "Hello, Sesi!")
if success {print "File written successfully"}

let image_b64 = read_file("logo.png", "base64")
write_file("logo-copy.png", image_b64, "base64")

let saved = "filename.txt" | write_file("This was creating with the function piping method!")
let copy = "favicon.png" | read_file("base64")
if saved {"favicon_copy.png" | write_file(copy, "base64")}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### append_file(path, content) -> bool

Append string content to the end of a file. Creates the file if it does not exist.

```sesi
let success = append_file("log.txt", "new line\n")
if success {"log.txt" | append_file("File appended successfully!")}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### write_image(path, base64_content) -> bool

Write base64 encoded string content as an image file. Overwrites the file if it exists.

```sesi
let success = write_image("logo.png", logo_data)
if success {print "Image safely stored"}

let copy = "favicon.png" | read_file("base64")
if success {"favicon_copy.png" | write_image(copy)}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### open(target, options = null) -> bool

Open a URL or local file using the OS default app, or a specific browser/editor/viewer.

```sesi
open("https://code-with-sesi.netlify.app")
"https://code-with-sesi.netlify.app" | open

open("docs/logo.png")
"docs/logo.png" | open

open("https://code-with-sesi.netlify.app", {"browser": "Google Chrome"})
"https://code-with-sesi.netlify.app" | open({"browser": "Google Chrome"})

open("reports/dashboard.html", {"browser": "Firefox"})
"reports/dashboard.html" | open({"browser": "Firefox"})

open("notes/todo.txt", {"editor": "Visual Studio Code"})
"notes/todo.txt" | open({"editor": "Visual Studio Code"})

open("docs/logo.png", {"image_viewer": "Preview"})
"docs/logo.png" | open ({"image_viewer": "Preview"})
```

**Options**:

- `browser` (`string`, optional): Preferred browser app name.
- `editor` (`string`, optional): Preferred text editor app name.
- `viewer` (`string`, optional): Preferred image viewer app name.
- `image_viewer` (`string`, optional): Alias for `viewer`.
- `mode` (`string`, optional): One of `"auto"`, `"browser"`, `"editor"`, `"viewer"`, `"image_viewer"`.

In `auto` mode (default), Sesi chooses based on file extension and the options you provide.

**Returns**: `bool` (true on success, throws on error)

---

### open_file(path, options = null) -> bool

Open a local file with OS default behavior, or force a preferred editor/viewer/browser.

```sesi
open_file("README.md")
"README.md" | open_file

open_file("README.md", {"editor": "Visual Studio Code"})
"README.md" | open_file({"editor": "Visual Studio Code"})

open_file("favicon.png", {"viewer": "Preview"})
"favicon.png" | open_file({"viewer": "Preview"})

open_file("index.html", {"mode": "browser", browser: "Google Chrome"})
"index.html" | open_file({"mode": "browser", browser: "Google Chrome"})
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### list_dir(path) -> array

List the contents of a directory as an array of strings.

```sesi
let files = list_dir(".")
print files

/*
  You can also just simply use "folder_name"
  Including the "/" helps with IDE highlighting and can help with debugging/verification
*/
let docs = "docs/" | list_dir
print docs
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `array<string>`

---

### make_dir(path) -> bool

Create a new directory recursively. Returns `true` on success, `false` or throws on failure.

```sesi
let success = make_dir("new_directory")
if success {print "Directory created successfully"}

let dirCheck = "new_directory" | list_dir
if dirCheck | is_null {"new_directory" | make_dir}
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `bool` (true on success, throws on error)

---

### rename(oldPath, newPath) -> bool

Rename or move a file or directory.

```sesi
let success = rename("old_name.txt", "new_name.txt")
if success {print "File renamed successfully"}

let reverted = "new_name.txt" | rename("old_name.txt")
```

**Parameters**:

- `oldPath` (`string`): The current path of the file or directory.
- `newPath` (`string`): The target path.

**Returns**: `bool` (true on success, throws on error)

---

### archive(sourcePath, destPath = null) -> bool

Recursively backup/copy a file or directory.

```sesi
// Backs up to a target destination
archive("src/index.ts", "backup/index.ts")
"src/index.ts" | archive("backup/index.ts")

// Automatically backs up to the hidden `.archive` directory in project root
archive("src/index.ts") // Saves to .archive/index.ts
"src/index.ts" | archive
```

**Parameters**:

- `sourcePath` (`string`): The file or directory to back up.
- `destPath` (`string`, optional): The destination path. Defaults to `.archive/<basename>` in the current working directory if omitted.

**Returns**: `bool` (true on success, throws on error)

---

### trash(path, autoRemove = false) -> bool

Delete a file or directory. By default, moves the item to a local `.trash` recycle bin directory, uniquely naming it with a timestamp. Can optionally delete permanently.

```sesi
// Moves file to project's .trash folder with a unique timestamp (e.g. temp_1719253450000.txt)
trash("temp.txt")
"temp.txt" | trash

// Permanently and recursively deletes the file/directory immediately
trash("temp.txt", true)
"temp.txt" | trash(true)
```

**Parameters**:

- `path` (`string`): The path of the file or directory to delete.
- `autoRemove` (`bool`, optional): If `true`, permanently deletes the item instead of moving it to the trash folder. Defaults to `false`.

**Returns**: `bool` (true on success, returns `false` if path doesn't exist, throws on error)

### convert(type) { config } { file } -> string

Convert file or document content between formats.

- `type`: `doc` (documents/text), `media` (images/video), or `audio`.
- `config`: Object containing conversion parameters:
  - `file_type`: Input format extension (e.g. `"md"`, `"csv"`, `"png"`, `"wav"`). Optional when input is a local file path (inferred from extension).
  - `output_type`: Target output format extension (e.g. `"html"`, `"json"`, `"jpg"`, `"mp3"`). Required.
- `file`: Input string content or input local file path.

If the input is a local file path, the converted content is saved to a file of the same name and directory with the target extension, and the path to the output file is returned. If the input is raw string content, the converted content is returned directly.

Native document conversions currently include:

- `md -> html`
- `html -> md`
- `html -> txt`
- `csv -> json`
- `tsv -> json`
- `json -> csv`
- `json -> tsv`
- `json -> yaml` / `json -> yml`
- `yaml -> json` / `yml -> json`
- `svg -> html`
- `html -> svg`
- `svg -> txt`

For other `doc` conversions, Sesi falls back to `pandoc` for local files when available, then to the AI conversion fallback if no native or local converter exists.

For `media`, Sesi still prefers external tools such as ImageMagick or `ffmpeg`, but it also has a native fallback for rasterizing `svg` files into `png`, `jpg`, or `jpeg`.

SVG image conversion is available through `convert(media)` for file-path inputs:

- `svg -> png`
- `svg -> jpg`
- `svg -> jpeg`
- `png -> svg`
- `jpg -> svg`
- `jpeg -> svg`
- `gif -> svg`
- `webp -> svg`
- `bmp -> svg`
- `tiff -> svg`
- `avif -> svg`

Raster image to SVG conversion creates an SVG wrapper with the original image embedded as a data URI. It is intended to make SVG output work reliably for image workflows; it does not perform vector tracing.

```sesi
// Raw content conversion
let html = convert(doc) {file_type: "md", output_type: "html"} {"# Hello"}
print html // "<h1>Hello</h1>"

let yaml = convert(doc) {file_type: "json", output_type: "yaml"} {"[{\"name\":\"Alice\"}]"}
print yaml

let markdown = convert(doc) {file_type: "html", output_type: "md"} {"<h1>Hello</h1><p>World</p>"}
print markdown

// File path conversion
let out_path = convert(doc) {output_type: "html"} {"document.md"}
print out_path // "document.html"

let image_path = convert(media) {output_type: "png"} {"diagram.svg"}
print image_path // "diagram.png"

let svg_path = convert(media) {output_type: "svg"} {"photo.png"}
print svg_path // "photo.svg"

let audio_path = convert(audio) {output_type: "mp3"} {"audio.wav"}
print audio_path // "audio.mp3"
```

**Returns**: `string` (converted content or path to the converted file)

---

### gif(input, output, options = null) -> string

Create an animated GIF from a video file or an ordered array of image-frame
paths. This requires the `ffmpeg` CLI and is disabled in Sesi safe mode.

```sesi
let frames = ["frames/001.png", "frames/002.png", "frames/003.png"]
let out_filename = "build/preview.gif"
let config = {
  "fps": 12, 
  "width": 640, 
  "loop": 0
}
let output = ""
let output_plain = ""

if (["-version"] | ffmpeg | is_null) == false {
  print "FFmpeg is installed and available."
  try {
    output = gif(frames, out_filename, config)
    output_plain = frames | gif("build/plain.gif")
  } catch (e) {
    print "Failed to create" out_filename "or build/plain.gif."
  }
} else {
  print "FFmpeg is not installed or not available in the system PATH."
}
```

Options: `fps` (default `12`), `width`, `loop` (`0` means forever),
`overwrite` (default `true`), and `timeout` in milliseconds.

**Returns**: the output path

---

### video(input, output, options = null) -> string

`video()` has two forms: AI generation and local FFmpeg creation.

#### AI video generation

Use the same model/config/prompt block syntax as `image()`. It supports Gemini
Omni Flash and Veo models through the current `@google/genai` SDK and returns
the generated MP4 as Base64 data.

```sesi
let clip = video("gemini-omni-flash-preview") {ratio: "9:16"} {"A marble rolling through a chain-reaction track, continuous smooth shot"}
write_file("marble.mp4", clip, "base64")

let veo_clip = video("veo-3.1-generate-preview") {images: "first-frame.png", ratio: "16:9", duration: 8, resolution: "1080p", audio: true} {"The camera slowly pushes toward the subject as wind moves through the scene"}
write_file("veo.mp4", veo_clip, "base64")
```

AI options include `images`/`image`, `ratio`/`aspectRatio`, `duration`,
`resolution`, `negative_prompt`, `audio`, and `task`. Gemini Omni Flash uses
the Interactions API; Veo uses the long-running video-generation API. Veo calls
wait for generation to finish before returning.

#### Local video creation

With ordinary function arguments, create or transcode video from a media file
or an ordered array of image-frame paths. An optional external audio track can
be attached. This form requires the `ffmpeg` CLI and is disabled in Sesi safe
mode.

```sesi
let filename = "build/preview.mp4"
let config = {
  "fps": 30,
  "width": 1280,
  "height": 720,
  "codec": "libx264",
  "crf": 23,
  "audio": "music.wav"
}

let output = video(frames, filename, config)
let output_basic = frames | video("build/basic.mp4")
```

Options: `fps`, `width`, `height`, `codec`, `crf`, `pixel_format`, `preset`,
`audio`, `mute`, `overwrite`, and `timeout`. Defaults are selected for MP4;
WebM output defaults to `libvpx-vp9`.

**Returns**: Base64 MP4 data for AI generation; the output path for local creation

---

### ffmpeg(args, options = null) -> object

Run FFmpeg directly with a structured argument array. A shell command string is
deliberately rejected. This builtin is disabled in Sesi safe mode.

```sesi
let args = [
  "-y",
  "-i", "input.mov",
  "-c:v", "libx264",
  "output.mp4"
]

let result = ffmpeg(args)
args | ffmpeg({"timeout": 5000})

print result["ok"] result["code"]
```

Options:

- `cwd`: validated working-directory path.
- `timeout`: maximum runtime in milliseconds.
- `throw_on_error`: throw when FFmpeg exits nonzero; defaults to `true`.

The result contains `ok`, `code`, `signal`, `stdout`, `stderr`, and the executed
argument array.

**Returns**: `object`

---

## Network Functions

### web_get(url, headers = {}) -> string

Perform a synchronous HTTP GET request and return the response body as a string.

```sesi
let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
"https://jsonplaceholder.typicode.com/posts/1" | web_get

print response
```

**Returns**: `string`

---

### web_send(url, body, headers = {}) -> string

Perform a synchronous HTTP POST request with a request body and return the response as a string.

```sesi
let payload = "{\"title\": \"foo\"}"

let response = web_send("https://jsonplaceholder.typicode.com/posts", payload)
"https://jsonplaceholder.typicode.com/posts/1" | web_send(payload)

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
8080 | listen(handleRequest)
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
8989 | api(handleMessage)
// ...
server.close()
```

**Returns**: `object` containing a `close` function.

---

### std/api

Includes Sesi's FastAPI-style HTTP API framework with auto-generated Swagger UI docs at `/docs` and OpenAPI 3.1 specification at `/openapi.json`.

```sesi
allow "std/api" in with API

fn listUsers(req) {
  return {"status": 200, "body": {"users": []}}
}
let app_config = {
  "title": "Users API",
  "version": "1.0.0",
  "description": "A user management API"
}
let user_config = {
  "summary": "List users",
  "tags": ["Users"]
}

let app = API.create_app(app_config)
app_config | API.create_app

app.get("/users", user_config, listUsers)
"/users" | app.get(user_config, listUsers)

let server = app.listen(8080)
8080 | app.listen
```

#### API Reference:

##### `create_app(config = null)` -> `app`

Creates an API application instance. `config` options include `title`, `version`, `description`, and `base_path`.

##### `app.get(path, schema, handler)` / `app.post` / `app.put` / `app.patch` / `app.delete`

Registers an HTTP route. `schema` can define `summary`, `description`, `tags`, `query`, `body`, `response`, and `deprecated`.

##### `app.use(middleware)`

Registers a request middleware function `fn(req)`.

##### `app.openapi()` -> `object`

Returns the generated OpenAPI 3.1 specification object.

##### `app.routes()` -> `array`

Returns an array of registered route objects.

##### `app.listen(port, options?)` -> `server`

Starts the HTTP server listening on `port`. Options:

- `docs_path` (default: `"/docs"`): Path for Swagger UI documentation.
- `openapi_path` (default: `"/openapi.json"`): Path for OpenAPI specification JSON.
- `cors` (default: `true`): Enable CORS headers.
- `cors_origin` (default: `"*"`): Allowed CORS origins.

---

## Audio Functions (std/audio)

The `std/audio` module provides functions for sound synthesis and playback.

```sesi
allow "std/audio" in with Audio

let freq = 440
let duration = 200

// Play a simple beep (frequency in Hz, duration in ms)
Audio.beep(freq, duration)
freq | Audio.beep(duration)

// Play a musical note
duration = 500

Audio.play("C4", duration)
"C4" | Audio.play

Audio.play("E4", duration)
"E4" | Audio.play(duration)

Audio.play("G4", duration)
"G4" | Audio.play(duration)

// Synthesize a waveform and get base64 WAV data
freq = 440
duration = 1000

let b64 = Audio.synth(freq, duration, "square")
freq | Audio.synth(duration, "square")

// Save a synthesized tone to a file
let filename = "tone.wav"
let note = "A4"
let opts = {"attack": 50, "release": 500}
duration = 2000

Audio.save(filename, note, duration, "sine", opts)
filename | Audio.save(note, duration, "sine", opts)

// Load a WAV file into an audio_sample object
let sample = Audio.load("drum_loop.wav")
"drum_loop.wav" | Audio.load

// Generate drum hit note objects (base64 WAV)
let k = Audio.kick(300, 1.0)   // kick drum
300 | Audio.kick(1.0)

let s = Audio.snare(200, 0.8)  // snare drum
100 | Audio.snare(0.8)

let h = Audio.hat(50, 0.6)     // hi-hat
50 | Audio.hat(0.6)

// or Native Physical Modeling (Drums)
let kick = {"note": "C1", "ms": 500, "type": "kick"}
let snare = {"note": "C4", "ms": 500, "type": "snare"}
let hat = {"note": "G8", "ms": 250, "type": "hat", "pan": 0.3}

// Professional Sample-Based Synthesis (SoundFonts)
let sf2Lib = "GeneralUser-GS.sf2"

let piano = Audio.sf2(sf2Lib, {"instrument": 0, "gain": 1.5})
sf2Lib | Audio.sf2({"instrument": 0, "gain": 1.5})

let string_pad = Audio.sf2(sf2Lib, {"instrument": 49})
sf2Lib | Audio.sf2({"instrument": 49})

// Save a sequence (song) of notes
let song = [
  {"note": "C4", ms: 500, "vol": 0.8},
  {"note": "E4", ms: 500, "pan": -0.5},
  {"note": "G4", ms: 1000, "cutoff": 5000} // LPF Filter
]
filename = "song.wav"

Audio.sequence(filename, song, "triangle")
filename | Audio.sequence(song, "triangle")

// Save tracks to a MIDI file
filename = "song.mid"

Audio.midi(filename, song)
filename | Audio.midi(song)

// Mix multiple tracks (Native Synthesis and SoundFonts) into a single stereo WAV
let lead = [piano("C4", 500), piano("E4", 500)]
["C4" | piano(500), "E4" | piano(500)]

let bass = [k, s] // or let bass = [kick, snare]
let final_arr = [lead, bass]
filename = "mix.wav"
opts = {"saturate": 1.5}

Audio.mix(filename, final_arr, "sine", opts)
filename | Audio.mix(final_arr, "sine", opts)
```

### beep(frequency, duration)

Plays a simple sine wave beep.

### play(note, duration, options)

Plays a musical note (e.g., `"C4"`, `"A#3"`, `"Bb5"`). Accepts `options` for ADSR, volume, and panning.

### synth(frequency_or_note, duration, type, options)

Returns a base64 encoded WAV string. `type` can be `"sine"`, `"square"`, `"saw"`, `"triangle"`, `"noise"`, `"kick"`, `"snare"`, `"hat"`, or `"clap"`.

### save(path, frequency_or_note, duration, type, options)

Saves a synthesized WAV file to the specified path.

### load(path) -> audio_sample

Loads a WAV file from disk and returns an `audio_sample` object containing the decoded PCM data.

- **`path`**: Path to a `.wav` file.
- **Returns**: An `audio_sample` object with `samples` (array of normalized floats in `[-1, 1]`) and `sampleRate` (integer, Hz).

```sesi
allow "std/audio" in with Audio

let sample = Audio.load("loop.wav")
"loop.wav" | Audio.load

print "Sample rate:" sample.sampleRate
print "Samples:" len(sample.samples)
```

### kick(duration, volume)

Generates a kick drum hit and returns it as a base64-encoded WAV string ready for use in `mix` or `write_file`.

- **`duration`** _(default: 300)_: Length in milliseconds.
- **`volume`** _(default: 1.0)_: Amplitude scalar (`0.0`–`1.0`).

```sesi
let k = Audio.kick(300, 1.0)
300 | Audio.kick(1.0)
```

### snare(duration, volume)

Generates a snare drum hit and returns it as a base64-encoded WAV string.

- **`duration`** _(default: 200)_: Length in milliseconds.
- **`volume`** _(default: 1.0)_: Amplitude scalar.

```sesi
let s = Audio.snare(200, 0.8)
200 | Audio.snare(0.8)
```

### hat(duration, volume)

Generates a hi-hat hit and returns it as a base64-encoded WAV string.

- **`duration`** _(default: 50)_: Length in milliseconds.
- **`volume`** _(default: 1.0)_: Amplitude scalar.

```sesi
let h = Audio.hat(50, 0.6)
50 | Audio.hat(0.6)
```

### sequence(path, notes_array, type, options)

Saves a multi-note sequence to a single WAV file. `notes_array` can be an array of note strings (e.g., `["C4", "D4"]`), objects (e.g., `[{note: "C4", ms: 250, pan: 0.5}]`), or pre-rendered SF2 notes.

### mix(path, tracks_array, type, options)

Saves a Stereo WAV file by mixing multiple tracks together. `tracks_array` is an array of note arrays. The mixer supports real-time ADSR envelopes, low-pass filtering (`cutoff`), stereo `pan`, soft-clipping saturation (`saturate`), and automatic high-speed batch rendering of SoundFont instruments.

### midi(path, tracks)

Saves one or more tracks (arrays of note objects/strings) directly as a standard MIDI (.mid) file on disk.

### sf2(path, options) -> fn(note, duration)

Returns a high-level instrument constructor function bound to a specific SoundFont file.

- `options`: `{"instrument": 0, "channel": 0, "gain": 1.5}`
- The returned function takes `(note, ms)` and generates a Sesi-native note object that the mixer will automatically batch-render using FluidSynth.

---

## Music Theory Functions (std/theory)

The `std/theory` module abstracts the mathematics of music into simple, reusable logic, perfect for algorithmic composition.

```sesi
allow "std/theory" in with Music

// Generate a C Major 7 chord array
let c_maj7 = Music.chord("C4", "M7") // ["C4", "E4", "G4", "B4"]
"C4" | Music.chord("M7")

// Generate an A minor scale array
let a_minor = Music.scale("A3", "minor")
"A3" | Music.scale("minor")

// Transpose notes up by 5 semitones (Perfect 4th)
let shifted = Music.transpose(c_maj7, 5) // ["F4", "A4", "C5", "E5"]
c_maj7 | Music.transpose(5)
```

### chord(root, type) -> array

Generates an array of notes for a given chord type.

- Supported types: `"M"`, `"m"`, `"dim"`, `"aug"`, `"7"`, `"M7"`, `"m7"`, `"sus2"`, `"sus4"`.

### scale(root, type) -> array

Generates an array of notes for a given scale/mode.

- Supported types: `"major"`, `"minor"`, `"dorian"`, `"phrygian"`, `"lydian"`, `"mixolydian"`, `"locrian"`.

### transpose(notes, semitones) -> array

Shifts a note or an array of notes up or down by the specified number of semitones.

### duration(minutes, seconds) -> number

Converts minutes and seconds into Sesi-native absolute milliseconds.

### bar(bars, bpm, beatsPerBar = 4) -> number

Converts a number of musical bars into milliseconds based on BPM and time signature (default: 4/4).

---

## Drawing Functions (std/draw)

The `std/draw` module provides APIs for SVG graphics and raster pixel drawing.

```sesi
allow "std/draw" in with Draw

// Setup gradients
let config = [
  {"offset": "0%", "color": "blue"},
  {"offset": "100%", "color": "black"}
]

Draw.gradient("linear", "sky", config)
"linear" | Draw.gradient("sky", config)

// Setup CSS keyframe animations
let keyframes = "
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 4s infinite linear; transform-origin: 50px 50px; }
"

Draw.style(keyframes)
keyframes | Draw.style

// Render shapes with styling options
// Using piping operators here can get messy, so we reccommend the normal method.
Draw.rect(0, 0, 100, 100, "url(#sky)")
Draw.circle(50, 50, 40, "red", {"class": "spinner"})
Draw.ellipse(50, 50, 20, 10, "gold")
Draw.polygon("30,20 85,20 90,75 25,75", "green")
Draw.path("M 10 10 C 20 20, 40 20, 50 10", "none", {"stroke": "white", "stroke-width": 2})

// Get the SVG string
let svg = Draw.render(100, 100)
100 | Draw.render(100)

// Save to a file
Draw.save_svg("drawing.svg", 100, 100)
"drawing.svg" | Draw.save_svg
```

### clear()

Clears the current drawing and definition buffers.

### circle(x, y, radius, fill, options = {})

Adds a circle to the drawing.

- `options` (`object`, optional): Custom SVG attributes (e.g. `{"id": "c1", "class": "pulse", "stroke-width": 2}`).

### rect(x, y, width, height, fill, options = {})

Adds a rectangle to the drawing.

- `options` (`object`, optional): Custom SVG attributes.

### line(x1, y1, x2, y2, stroke, options = {})

Adds a line to the drawing.

- `options` (`object`, optional): Custom SVG attributes.

### text(x, y, content, size, fill, options = {})

Adds text to the drawing.

- `options` (`object`, optional): Custom SVG attributes.

### ellipse(cx, cy, rx, ry, fill, options = {})

Adds an ellipse to the drawing.

- `options` (`object`, optional): Custom SVG attributes.

### polygon(points, fill, options = {})

Adds a polygon to the drawing.

- `points` (`string`): A space-separated list of coordinate pairs (e.g. `"100,10 250,190 10,190"`).
- `options` (`object`, optional): Custom SVG attributes.

### path(d, fill, options = {})

Adds an SVG path to the drawing.

- `d` (`string`): Path data command string (e.g. `"M 10 10 L 90 90"`).
- `options` (`object`, optional): Custom SVG attributes.

### gradient(type, id, stops, options = {})

Defines a linear or radial gradient in the `<defs>` section.

- `type` (`string`): `"linear"` or `"radial"`.
- `id` (`string`): The identifier to use when referencing the gradient (e.g. `"url(#my-id)"`).
- `stops` (`array<object>`): An array of stop configurations (e.g. `[{"offset": "0%", "color": "red"}, {"offset": "100%", "color": "blue"}]`).
- `options` (`object`, optional): Custom gradient attributes.

### style(cssText)

Defines a `<style>` block in the `<defs>` section. Used for embedding CSS classes or `@keyframes` animations.

### raw(svgCode)

Injects raw SVG markup directly into the element buffer.

### render(width, height) -> string

Returns the complete, formatted SVG string.

### save_svg(path, width, height) -> bool

Saves the formatted SVG drawing to the specified path. Return `true` on success.

### pixel(x, y, color)

Sets one pixel in the raster buffer. Later calls at the same integer coordinate replace the earlier color. Colors may be common names, `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`, or `rgba(...)`.

### pixel_grid(grid, palette, scale = 1, x = 0, y = 0)

Draws a palette-indexed grid into the raster buffer. Rows may be arrays of palette indexes or strings whose characters are palette keys. `scale` expands every logical cell to a square of real pixels; `x` and `y` offset the grid on the output canvas.

```sesi
let palatte = {"0": "transparent", "1": "#56d9e9"}
let grid = [
  "0110",
  "1001",
  "1001",
  "0110"
]

Draw.pixel_grid(grid, palatte, 32)
grid | Draw.pixel_grid(palatte, 32)
```

### save_png(path, width, height, background = "transparent") -> bool

Encodes the raster buffer as a true-color RGBA PNG and saves it to `path`. Pixels outside the requested dimensions are omitted. The optional background accepts the same color formats as `pixel`.

---

## System Functions

### spawn(path) -> number

Launch a Sesi script as a concurrent background process. Returns the process ID (PID).

```sesi
let pid = spawn("worker.sesi")
let pid2 = worker2.sesi" | spawn

print "Launched workers with PIDs:" pid "and" pid2
```

**Returns**: `number` (PID)

---

### live(filePath, exportName = "handle") -> fn

Creates a dynamic hot-reloading wrapper function around a Sesi script's exported function. When the returned function is called, it re-reads, re-parses, and re-executes the target file, ensuring changes to the code are instantly reflected without restarting the parent process.

```sesi
// Wrap handler with hot-reloading
let sesiFile = "server_handler.sesi"

let handler = live(sesiFile, "handleRequest")
sesiFile | live("handleRequest")

// Pass it to the web server
listen(8080, handler)
8080 | listen(handler)
```

**Parameters**:

- `filePath` (`string`): Path to the target file.
- `exportName` (`string`, optional): Name of the exported function in the file to run. Defaults to `"handle"`.

**Returns**: `fn` - A wrapper function that passes all arguments to the hot-reloaded function and returns its result.

---

### exec(command) -> string

Execute a shell command synchronously and return its output.

```sesi
let cmd = "ls -la"

let files = exec(cmd)
cmd | exec

print files
```

**Returns**: `string` (stdout)

---

### sesi(filePath, local = false, checkOnly = false) -> string

Parse, compile, and run a Sesi file synchronously in the current Sesi process. Unlike `exec()` or `spawn()`, this does not create a child process. Use it when one Sesi script needs to run another script and wait for it to finish.

```sesi
let file = "examples/main/01_hello.sesi"
let localFile = "examples/main/25_webpage_server.sesi"

sesi(file)
file | sesi

// Allow local file access for the invoked script.
sesi(localFile, true)
localFile | sesi(true)

// Check syntax and compilation without running the file.
sesi(file, false, true)
file | sesi(false, true)
```

**Parameters**:

- `filePath` (`string`): Path to the Sesi file to run.
- `local` (`bool`, optional): Enables local file access for the invoked script. Defaults to `false`.
- `checkOnly` (`bool`, optional): Checks syntax and compilation without running the file. Defaults to `false`.

**Returns**: `string` - An empty string after execution, or `"✓ Syntax and Compilation valid"` when `checkOnly` is `true`.

---

### python(code, args) -> string

Execute arbitrary Python code using python3 or python on the host system, and return its standard output. This function is disabled in Sesi safe mode.

```sesi
// Execute simple Python code:
let code = "print('Hello from Python!')"

let output = python(code)
code | python

print output

// Pass arguments to the Python environment:
let customArgs = { "name": "Alice", "score": 98 }

code = "import os, json
# Retrieve structured variables from environment
data = json.loads(os.environ['SESI_ARGS'])
print('Hello, ' + data['name'] + '! Score is ' + str(data['score']))
"

let out = python(code, customArgs)
code | python(customArgs)

print out
```

**Parameters**:

- `code` (`string`): The Python source code to execute.
- `args` (`any`, optional): Optional argument data. If provided:
  - It is serialized to JSON and stored in the child process environment variable `SESI_ARGS`.
  - If `args` is an array, individual elements are stringified and passed as positional command-line arguments to the python script (available via `sys.argv[1:]`).
  - Otherwise, the argument itself is stringified and passed as a single command-line argument.

**Returns**: `string` (stdout of the Python process)

---

### js(code, args) -> string

Execute arbitrary JavaScript code using the same Node.js runtime that is running Sesi, and return its standard output. This function is disabled in Sesi safe mode.

```sesi
// Execute simple JavaScript code:
let code = "console.log('Hello from JavaScript!')"

let output = js(code)
code | js

print output

// Pass structured data to JavaScript:
let customArgs = { "name": "Alice", "score": 98 }

code = "const data = JSON.parse(process.env.SESI_ARGS)
console.log('Hello, ' + data.name + '! Score is ' + data.score)
"

let out = js(code, customArgs)
code | js(customArgs)

print out

// Pass positional command-line arguments:
let termPass = "console.log(process.argv[2])"
let argIn = ["first"]

let argOut = js(termPass, argIn)
termPass | js(argIn)

print argOut
```

**Parameters**:

- `code` (`string`): The JavaScript source code to execute.
- `args` (`any`, optional): Optional argument data. If provided:
  - It is serialized to JSON and stored in the child process environment variable `SESI_ARGS`.
  - If `args` is an array, individual elements are stringified and passed as positional command-line arguments.
  - Otherwise, the argument itself is stringified and passed as a single command-line argument.

**Returns**: `string` (stdout of the JavaScript process)

---

### html(body, options) -> string

Create a complete HTML document string from body markup. Use this with `write_file()` to generate an entire webpage.

```sesi
let title = "My Sesi Webpage"

let css = "<style>
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #f4f6f8;
    color: #1f2933;
  }

  header {
    padding: 48px 24px;
    background: #111827;
    color: white;
    text-align: center;
  }

  main {
    max-width: 760px;
    margin: 32px auto;
    padding: 0 20px;
  }

  section {
    margin-bottom: 28px;
    padding: 20px;
    background: white;
    border: 1px solid #d8dee6;
  }

  input {
    padding: 10px;
    width: 70%;
    border: 1px solid #b8c2cc;
  }

  button {
    padding: 10px 14px;
    border: 0;
    background: #2563eb;
    color: white;
    cursor: pointer;
  }

  li {
    margin-top: 8px;
  }

  footer {
    padding: 20px;
    text-align: center;
    color: #52606d;
  }
</style>"

let body = "
<header>
  <h1>My Sesi Webpage</h1>
  <p>A complete HTML page generated from a Sesi script.</p>
</header>

<main>
  <section>
    <h2>About</h2>
    <p>This page was created with the html() builtin and saved with write_file().</p>
  </section>

  <section>
    <h2>Todo List</h2>
    <input id='todoInput' placeholder='Add a task...' />
    <button onclick='addTodo()'>Add</button>
    <ul id='todoList'></ul>
  </section>
</main>

<footer>
  <p>Generated by Sesi</p>
</footer>

<script>
function addTodo() {
  const input = document.getElementById('todoInput')
  const text = input.value.trim()

  if (!text) return

  const item = document.createElement('li')
  item.textContent = text
  document.getElementById('todoList').appendChild(item)

  input.value = ''
}
</script>
"

let config = {
  "title": title,
  "head": css,
  "lang": "en"
}

let page = html(body, config)
body | html(config)

let filename = "sesi.html"

write_file(filename, page)
filename | write_file(page)

print "Wrote sesi.html"
```

**Parameters**:

- `body` (`string`): Markup to place inside the generated document's `<body>`.
- `options` (`object`, optional): Document metadata and head content:
  - `title` (`string`): Text for the generated `<title>` tag. Defaults to `"Sesi"`.
  - `head` (`string`): Raw markup appended inside `<head>`, commonly CSS, meta tags, or scripts.
  - `lang` (`string`): Value for the `<html lang="...">` attribute. Defaults to `"en"`.

**Returns**: `string` (complete HTML document)

---

### env(key = null, defaultValue = null) -> string | object

Retrieve the value of an environment variable, or retrieve all environment variables as an object.

```sesi
// Get a specific environment variable
let apiKey = env("GEMINI_API_KEY")
"GEMINI_API_KEY" | env

print apiKey

// Get with a fallback default value
let port = env("PORT", "8080")
"PORT" | env("8080")

print port

// Get all environment variables as an object
let allEnvs = env()

print allEnvs["HOME"]
```

**Parameters**:

- `key` (`string`, optional): The name of the environment variable. If omitted or null, the entire environment is returned as an object.
- `defaultValue` (`any`, optional): The fallback value to return if the environment variable is not defined. Defaults to `null`.

**Returns**: `string` (value of the env var), `object` (all env vars if key is omitted), or the `defaultValue` if not found.

---

### time() -> number

Returns the current Unix timestamp in milliseconds.

```sesi
let start = time()
// ... do work ...
let total = time() - start

print "Elapsed time:" total "ms"
```

**Returns**: `number`

---

### format(timestamp, options) -> string

Convert Unix timestamp to a human-readable string.

```sesi
let timestamp = now()

let formattedDate = format(timestamp, {"dateStyle": "short"})
timestamp | format({"dateStyle": "short"})

let formattedBasic = format(timestamp)
timestamp | format

print formattedDate
print formattedBasic
```

**Returns**: `string`

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

let jobs = [job1, job2]

let results = multi_req(jobs)
jobs | multi_req

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

- `"model"` (default: `"gemini-3.5-flash-lite"`)
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
let name = "fast"

set_alias(name, "gemini-3.5-flash-lite")
name | set_alias("gemini-3.5-flash-lite")

let answer = model("fast") {"Summarize this paragraph."}
```

**Returns**: `bool` (`true` when the alias is registered)

---

### define_tool(name, fn, description = "") -> bool

Register a custom Sesi function as an AI-accessible tool.

```sesi
fn summarize(text) {return "Summary: " + text}

// Register the tool
define_tool("summarizer", summarize, "Summarizes text for the AI")

// Invoke the tool using tool_call()
let result = tool_call(summarizer)("Hello world")
```

**Parameters**:

- `name` (`string`): The name used to invoke the tool via `tool_call`.
- `fn` (`fn`): The Sesi function to wrap.
- `description` (`string`, optional): A concise description for the AI explaining when to use this tool.

**Returns**: `bool` (`true` when the tool is successfully registered).

---

### tool_call(name)(...args) -> any

Invoke a previously registered tool by name.

```sesi
// Calling with direct arguments:
let result = tool_call(summarizer)("Hello world")

// Calling with a model output as the argument:
let input = model("gemini-3.5-flash-lite") {"Provide a long sentence."}
let summary = tool_call(summarizer)(input)
```

**Parameters**:

- `name`: The tool name registered via `define_tool`.
- `args`: Arguments passed to the underlying function.

**Returns**: The result of the wrapped function, or `null` if the tool is not found.

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
let title = "ValidationError"
let message = "Missing email"
let data = {"field": "email"}

let err = error_type(title, message, data)
title | error_type(message, data)

```

**Returns**: `object` with keys `"type"`, `"message"`, and `"data"`.

---

### raise_error(type_or_error, message = "", data = null) -> never

Throw a custom typed error that can be handled in `try/catch`.

```sesi
try {
  "RateLimit" | raise_error("Too many requests", {"retryIn": 30})
} catch (e) {print "type:" e["type"] "message:" e["message"]}
```

You can also pass an `error_type(...)` object directly:

```sesi
let err = error_type("ValidationError", "Invalid payload", {"field": "email"})
"ValidationError" | error_type("Invalid payload", {"field": "email"})

raise_error(err)
err | raise_error
```

**Returns**: never (always throws)

---

### retry(action, options = null) -> any

Executes a function, automatically catching errors and retrying execution with exponential backoff if it fails.

```sesi
fn volatileTask() {
  if random() > 0.8 {
    return "Success!"
  }
  "TemporaryError" | raise_error("Task failed unpredictably")
}

// Retry up to 5 times (default backoff options)
let result = retry(volatileTask, 5)
volatileTask | retry(5)

// Retry with custom configuration object
let config = {
  max_retries: 4,
  initial_delay: 500,
  backoff_factor: 1.5
}

let result2 = retry(volatileTask, config)
volatileTask | retry(config)
```

**Parameters**:

- `action` (`fn`): The function to execute.
- `options` (`number` or `object`): Either a number representing `max_retries`, or a configuration object with fields:
  - `max_retries` (`number`): The maximum number of retry attempts (default: `3`).
  - `initial_delay` (`number`): Initial wait time in milliseconds before the first retry (default: `1000`).
  - `backoff_factor` (`number`): Multiplier applied to the delay after each failure (default: `2.0`).

**Returns**: `any` (the return value of the successfully executed `action` function). Throws the last encountered error if all retry attempts are exhausted.

---

### random() -> number

Returns a random floating-point number between 0 (inclusive) and 1 (exclusive).

```sesi
let rand = random()
if rand > 0.5 {print "Heads"} else {print "Tails"}
```

---

## Memory Functions

### memory_search(name, query, top_k = 3) -> array

Search a `memory` binding's history for entries most semantically similar to a query string. Uses Gemini embedding models (`gemini-embedding-001` with `gemini-embedding-2` fallback) to generate vector embeddings for each memory chunk, then ranks them by cosine similarity.

Embedding results are locally cached by content hash — repeated searches over the same memory entries will not make redundant API calls.

```sesi
memory chat {"System: You are a helpful assistant."}
chat = chat "User: Tell me about databases"
chat = chat "Assistant: Databases store structured data..."
chat = chat "User: What about caching?"
chat = chat "Assistant: Caching improves performance..."

let results = memory_search("chat", "database storage")
"chat" | memory_search("database storage")

for item in results {
  print "Score:" item["score"]
  print "Text:" item["text"]
  print "---"
}
```

**Parameters**:

- `name` (`string`): The name of the memory binding to search.
- `query` (`string`): The search query string.
- `top_k` (`number`, optional): Maximum number of results to return, sorted by descending similarity score. Defaults to `3`.

**Returns**: `array<object>` — Each object contains `"text"` (the matching memory entry) and `"score"` (cosine similarity from 0.0 to 1.0).

---

### memory_trim(name, max_tokens = 900000) -> string

Manage the context window of a `memory` binding. If the total token count (estimated at ~4 characters per token) exceeds `max_tokens`, the older half of the memory entries are automatically summarized into a single paragraph using `gemini-3.5-flash-lite`, preserving all key facts and context while reducing token usage.

If the memory is already within the budget, the full memory text is returned unchanged.

```sesi
memory conversation {"System: You are a research assistant."}

// After many turns of conversation...
// Trim to stay within a 500K token budget
let trimmed = memory_trim("conversation", 500000)
"conversation" | memory_trim(500000)

print "Memory now:" trimmed | length "characters"
```

**Parameters**:

- `name` (`string`): The name of the memory binding to manage.
- `max_tokens` (`number`, optional): Maximum token budget. Defaults to `900000` (suitable for Gemini's 1M context window with headroom).

**Returns**: `string` — The memory text after trimming (or unchanged if within budget). The memory binding is updated in-place.

---

## Debugging Functions

### debug() -> null

Pauses execution and launches an interactive debugger REPL in your shell terminal.

```sesi
let x = 10
let y = 20

// Pauses execution and opens interactive sesi-debug REPL
debug()

// You can also leave a comment inside the function for referencing, it won't affect your script
debug("Verify x and y using 'print' in eval") 
"Verify x and y using 'print' in eval" | debug

print x + y
```

**REPL Commands**:

- `env` — Displays all variables in the active lexical scope chain.
- `eval <expr>` — Evaluates any Sesi expression in-memory within the active scope context.
- `help` / `?` – Display available debug commands.
- `c` / `continue` — Resumes standard program execution.

**Returns**: `null`

---

## Global Variables

### args

An array of strings containing the command-line arguments passed to the Sesi script. This excludes any Sesi interpreter options (e.g. `-l`) and the script filename itself.

```sesi
print "Number of script args:" length(args) // len() works too, length() works best for readability
args | length

if (args | length) > 0 {
  print "First script argument:" args[0]
}
```

**Type**: `array<string>`

---

## Native Matrix Functions

Native matrix functions operate on non-empty rectangular arrays containing only finite numbers. They execute in the Sesi runtime rather than interpreted Sesi loops.

### matrix_dot(a, b) -> array

Multiply two matrices. The number of columns in `a` must equal the number of rows in `b`.

```sesi
let product = matrix_dot([[1, 2]], [[3], [4]]) // [[11]]
[[1, 2]] | matrix_dot([[3], [4]])
```

### matrix_transpose(matrix) -> array

Exchange matrix rows and columns.

### matrix_add(a, b) -> array

Add two matrices. If `b` has one row, that row is broadcast across every row of `a`.

### matrix_sub(a, b) -> array

Subtract identically shaped matrices.

### matrix_mul_elements(a, b) -> array

Multiply corresponding elements of identically shaped matrices.

### matrix_scale(matrix, scalar) -> array

Multiply every element by a finite numeric scalar.

### matrix_sigmoid(matrix) -> array

Apply the logistic sigmoid function to every element.

### matrix_dsigmoid(matrix) -> array

Calculate `y * (1 - y)` for each element containing a sigmoid output.

### matrix_sum_rows(matrix) -> array

Sum each column across all rows and return a single-row matrix.

### matrix_mse(a, b) -> number

Return the mean squared error across two identically shaped matrices.

---

## Math Functions

### exp(x) -> number

Returns Euler's number $e$ (approx. `2.71828`) raised to the power of $x$.

```sesi
exp(0)             // 1.0
0 | exp

exp(1)             // 2.718281828459045
1 | exp

let sigmoid = 1.0 / (1.0 + exp(0.0 - 0.5))
1.0 / (1.0 + (0.0 - 0.5 | exp))

print sigmoid      // 0.6224593312018546
```

**Returns**: `number`

---

### trunc(value, length = 0) -> number|string

Truncates a value. If the value is a number, it returns the integer part by removing fractional digits. If the value is a string, it truncates the text to the specified `length`.

```sesi
// Numeric truncation
trunc(10.5)        // 10
10.5 | trunc

trunc(-10.5)       // -10
-10.5 | trunc

// String truncation
trunc("Hello World", 5)  // "Hello"
"Hello World" | trunc(5)
```

**Parameters**:

- `value` (`number`|`string`): The value to truncate.
- `length` (`number`): The character limit for string truncation. Optional.

**Returns**: `number`, `string`, or `null` if the first argument is not a number or string.

---

## Math Functions (std/math)

Additional math functions are available natively by importing the `"std/math"` module:

```sesi
allow "std/math" in with Math

print Math.sqrt(16) // 4
16 | Math.sqrt

print Math.floor(3.7) // 3
3.7 | Math.floor
```

## Function Introspection

### name(func) -> string

Returns the name of a given function.

```sesi
fn my_func() {}

print name(my_func) // "my_func"
my_func | name
```

**Parameters**:

- `func` (`fn`): The function to introspect.

**Returns**: `string` (or `null` if the value is not a function)

---

### arity(func) -> number

Returns the number of parameters a function expects.

```sesi
fn add(a, b) { return a + b }

print arity(add) // 2
add | arity
```

**Parameters**:

- `func` (`fn`): The function to introspect.

**Returns**: `number` (or `null` if the value is not a function)

---

### is_function(value) -> bool

Checks whether a value is a function.

```sesi
fn my_func() {}

is_function(my_func) // true
my_func | is_function

is_function(42)      // false
42 | is_function
```

**Parameters**:

- `value` (`any`): The value to check.

**Returns**: `bool`

---

## Collection Checks

### is_array(value) -> bool

### is_object(value) -> bool

### is_string(value) -> bool

### is_number(value) -> bool

### is_bool(value) -> bool

### is_null(value) -> bool

Type-checking utility functions that return a boolean indicating whether the provided value is of the specified type.

```sesi
is_array([1, 2])         // true
[1, 2] | is_array

is_object({"a": 1})      // true
{"a": 1} | is_object 

is_string("hello")       // true
"hello" | is_string

is_number(42)            // true
42 | is_number

is_bool(true)            // true
true | is_bool

is_null(null)            // true
null | is_null
```

**Parameters**:

- `value` (`any`): The value to check.

**Returns**: `bool`

---

## String Functions

### length(string) -> number

An alias for `len()`. Returns the length of the string.

```sesi
length("hello") // 5
"hello" | length
```

**Returns**: `number`

---

### starts_with(string, prefix) -> bool

Checks if a string starts with the given prefix.

```sesi
starts_with("hello", "he") // true
"hello" | starts_with("he")
```

**Returns**: `bool`

---

### ends_with(string, suffix) -> bool

Checks if a string ends with the given suffix.

```sesi
ends_with("hello", "lo") // true
"hello" | ends_with("lo")
```

**Returns**: `bool`

---

### index_of(collection, value) -> number

Returns the first index at which a given value can be found in the collection (string or array), or -1 if it is not present.

```sesi
index_of("hello", "l") // 2
"hello" | index_of("l")

index_of([1, 2, 3], 2) // 1
[1, 2, 3] | index_of(2)
```

**Returns**: `number`

---

### repeat(string, count) -> string

Constructs and returns a new string which contains the specified number of copies of the string concatenated together.

```sesi
repeat("a", 3) // "aaa"
"a" | repeat(3)
```

**Returns**: `string`

---

_(Note: `to_upper`, `to_lower`, `trim`, `contains`, `slice`, and `swap` are documented under Collection Functions.)_

---

## Array Functions

### includes(collection, value) -> bool

Checks if a collection (array or string) includes a certain value.

```sesi
includes([1, 2, 3], 2) // true
[1, 2, 3] | includes(2)

includes("hello", "e") // true
"hello" | includes("e")
```

**Returns**: `bool`

---

### reverse(array) -> array

Reverses an array in place and returns it.

```sesi
reverse([1, 2, 3]) // [3, 2, 1]
[1, 2, 3] | reverse
```

**Returns**: `array`

---

### sort(array, compareFn?) -> array

Sorts the elements of an array and returns it. Optionally takes a comparison function.

```sesi
sort(["c", "a", "b"]) // ["a", "b", "c"]
["c", "a", "b"] | sort
```

**Returns**: `array`

---

### unique(array) -> array

Returns a new array with all duplicate elements removed.

```sesi
unique([1, 1, 2, 3, 3]) // [1, 2, 3]
[1, 1, 2, 3, 3] | unique
```

**Returns**: `array`

---

### flatten(array) -> array

Returns a new array with all sub-array elements concatenated into it recursively up to one level.

```sesi
flatten([[1, 2], [3, 4]]) // [1, 2, 3, 4]
[[1, 2], [3, 4]] | flatten
```

**Returns**: `array`

---

_(Note: `map`, `filter`, `reduce`, and `find` are documented under Collection Functions.)_

---

## Error Handling

Sesi supports structured error handling via `try/catch` blocks.

```sesi
try {
  let data = "missing.txt" | read_file
} catch (e) {
  print "Caught error:" e
}

```

---

## Tips & Tricks

### Converting values

```sesi
// To string
str(value)
value | str
value + ""        // Works for most types

// To number
num(string)
string | num
string + 0        // Doesn't work (concatenation)

// To bool
bool(value)
value | bool
!(!value)         // Double negation
```

### Checking types

```sesi
is_array(value | type)
type(value) == "array"
(value | type) == "array"
type(value) | is_array
(value | type) | is_array

is_object(value | type)
type(value) == "object"
(value | type) == "object"
type(value) | is_object
(value | type) | is_object

is_null(value | type)
type(value) == "null"
(value | type) == "null"
type(value) | is_null
(value | type) | is_null
```

### Working with arrays

```sesi
let arr = [1, 2, 3]

// Length
length(arr)
arr | length

// Last element
let arrLength = arr | length
arr[arrLength - 1]

// Add element
push(arr, 4)
arr | push(4)

// Remove last
pop(arr)
arr | pop

// Join
join(arr, ", ")
arr | join(", ")
```

### Working with objects

```sesi
let obj = { "a": 1, "b": 2 }

// Get keys
keys(obj)
obj | keys

// Get values
values(obj)
values | obj

// Check key
includes(keys(obj), "a")
keys(obj) | includes("a")
obj | keys | includes("a")
```

---

## Standard Library Modules (Supported natively in v1.x)

### std/math

Includes math constants and functions: `PI`, `E`, `sin`, `cos`, `tan`, `sqrt`, `floor`, `ceil`, `abs`, `pow`, `log`, `exp`.

```sesi
allow "std/math" in with {
  sqrt,
  abs,
  floor,
  ceil,
  sin,
  cos,
  tan,
  pow
}
```

### std/time

Includes time, sleep, and timezone formatting functions: `now()`, `sleep(ms)`, `format(timestamp, options)`.

```sesi
allow "std/time" in with Time

let t = Time.now()
// Format time with a specific timezone
let formatted = t | Time.format({"timeZone": "America/New_York", "timeStyle": "medium"})
print formatted // e.g. "2:27:02 AM"
```

### std/json

Includes JSON serialization: `parse(str)`, `stringify(val)`. 

**Will be deprecated in v2, use `from_json` and `to_json` instead.**

```sesi
allow "std/json" in with Json

let original = {
  "project": "Sesi",
  "version": "1.8.0"
}
print Json.stringify(original)
```

### std/base64

Includes Base64 conversion helpers with optional modes:

- `encode(value, mode?)`
- `decode(base64_text, mode?)`

Modes:

- `"text"` (default): encode/decode UTF-8 strings
- `"bytes"`: encode/decode raw byte arrays (`array<number>` in range 0..255)

```sesi
allow "std/base64" in with Base64

let encoded = Base64.encode("Hello, Sesi!")
"Hello, Sesi!" | Base64.encode

print encoded

let decoded = Base64.decode(encoded)
encoded | Base64.decode

print decoded // "Hello, Sesi!"

let bin = [0, 255, 16, 32]

let b64 = Base64.encode(bin, "bytes")
bin | Base64.encode("bytes")

let back = Base64.decode(b64, "bytes")
b64 | Base64.decode("bytes")

print back // [0, 255, 16, 32]
```

### std/db

Includes Sesi's lightweight embedded Document Database engine: `db_open(filename, password?)`.
A database instance supports opening collections, inserting documents, querying/finding, updating, and deleting records.

#### Encryption & Decryption at Runtime:

If an optional second parameter `password` is provided, Sesi automatically encrypts database contents stored on disk using **AES-256-CBC** with a dynamic, randomized initialization vector (IV) on every write, and decrypts it during reads.

```sesi
allow "std/db" in with {db_open}

let db = "data.db" | db_open("secure-passphrase-here")
let users = "users" | db.collection

/* CRUD API:
users.insert(object) -> Returns inserted document (adds unique _id if missing)
users.find(query_object?) -> Returns array of matching documents (returns all if query omitted)
users.update(query_object, update_object) -> Returns number of updated documents
users.delete(query_object) -> Returns number of deleted documents */
```

### std/terminal

Includes raw ANSI terminal control functions for building CLI applications: `clear`, `cursor`, `color`.

```sesi
allow "std/terminal" in with Terminal

// Clear the screen
Terminal.clear()

// Move cursor to x=10, y=5
Terminal.cursor(10, 5)

// Output colored text
print "Hello!" | Terminal.color("green")
```

**Available Colors**: `"red"`, `"green"`, `"yellow"`, `"blue"`, `"magenta"`, `"cyan"`, `"white"`, `"bold"`.

### std/browser

Includes Sesi's browser automation capabilities powered by Playwright: `launch(options?)`.
A browser instance supports opening new pages. A page instance supports navigation, selector actions, JavaScript evaluation, base64 screenshot and PDF generation.

```sesi
allow "std/browser" in with {launch}

// Launch browser (headless or headed)
let browser = {"headless": true} | launch

// Open a new page/tab
let page = browser.newPage()

// Navigate to a website
"https://example.com" | page.goto

// Get the page title
let title = page.title()
print "Title:" title

// Get inner text of a selector
let heading = "h1" | page.inner_text
print "Heading:" heading

// Get an attribute of an element
let link_href = "a" | page.attribute("href")

// Evaluate JavaScript on the page
let scrollX = "window.scrollX" | page.evaluate

// Take a base64 screenshot
let b64_screenshot = page.screenshot()

// Take a screenshot and save it to a file
{"path": "screenshot.png", "fullPage": true} | page.screenshot

// Generate PDF (base64 and saved to file)
{"path": "page.pdf", "format": "A4"} | page.pdf

// Wait for a selector
"h1" | page.wait_for_selector({"state": "visible", "timeout": 5000})

// Wait for a specific timeout in milliseconds
1000 | page.wait_for_timeout

// Clean up
page.close()
browser.close()
```

#### API Reference:

##### `launch(options)` -> `browser`

Launches a browser instance. `options` is an object with:

- `headless` (`bool`, optional): Whether to run browser in headless mode. Defaults to `true`.

##### `browser.newPage()` -> `page`

Creates a new page/tab.

##### `browser.close()`

Closes the browser instance.

##### `page.goto(url)`

Navigates to the specified URL.

##### `page.content()` -> `string`

Gets the full HTML content of the page.

##### `page.screenshot(options?)` -> `string` (base64)

Takes a screenshot of the page. Returns a base64 encoded string.
`options` is an optional object containing:

- `path` (`string`): File path to save the screenshot.
- `fullPage` (`bool`): Whether to capture the full scrollable page.

##### `page.click(selector)`

Clicks the element matching the selector.

##### `page.fill(selector, value)`

Fills the input matching the selector with the specified value.

##### `page.type(selector, value)`

Types the specified value into the element matching the selector.

##### `page.press(selector, key)`

Presses the specified key on the element matching the selector.

##### `page.inner_text(selector)` -> `string`

Gets the inner text of the element matching the selector.

##### `page.attribute(selector, name)` -> `string`

Gets the value of the attribute `name` of the element matching the selector.

##### `page.evaluate(script)` -> `any`

Evaluates a JavaScript script/expression in the page context and returns the result.

##### `page.title()` -> `string`

Gets the page title.

##### `page.close()`

Closes the page.

##### `page.pdf(options?)` -> `string` (base64)

Generates a PDF of the page. Returns a base64 encoded string.
`options` is an optional object containing:

- `path` (`string`): File path to save the PDF.
- `format` (`string`): Paper format (e.g. `"A4"`, `"Letter"`).

##### `page.wait_for_selector(selector, options?)`

Waits for the element matching the selector to satisfy the options.
`options` is an optional object containing:

- `state` (`string`): Wait for state (`"attached"`, `"detached"`, `"visible"`, `"hidden"`).
- `timeout` (`number`): Timeout in milliseconds.

##### `page.wait_for_timeout(ms)`

Waits for the specified duration in milliseconds.

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
allow "mymodule1" in with {
  function1,
  function2
}
allow "mymodule2" in with Name
allow "mymodule3" in with {function4}
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
