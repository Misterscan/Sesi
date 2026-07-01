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

### input(prompt) -> string

Prompt the user for terminal input, wait for them to press Enter, and return their response.

```sesi
let name = input("Enter your name: ")
print "Hello," name
```

**Parameters**:

- `prompt` (`string`): The text to display as a prompt before reading input. Optional.

**Returns**: `string`

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

### to_upper(string) -> string

Converts all alphabetic characters in a string to uppercase.

```sesi
to_upper("hello")      // "HELLO"
to_upper("Sesi V2.0")  // "SESI V2.0"
```

**Returns**: `string` or `null` if not a string

---

### to_lower(string) -> string

Converts all alphabetic characters in a string to lowercase.

```sesi
to_lower("WORLD")      // "world"
to_lower("Sesi V2.0")  // "sesi v2.0"
```

**Returns**: `string` or `null` if not a string

---

### trim(string) -> string

Removes whitespace from both ends of a string.

```sesi
trim("  spaces  ")  // "spaces"
```

**Returns**: `string` or `null` if not a string

---

### slice(collection, start, end = null) -> string | array

Extracts a section of a string or array and returns it as a new string or array, without modifying the original.

```sesi
slice("abcdef", 1, 4)         // "bcd"
slice([10, 20, 30, 40], 2)    // [30, 40]
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
contains("hello.sesi", ".ts")    // false
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
locate("hello.sesi", "ts")   // -1
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

### map(array, callback) -> array

Creates a new array populated with the results of calling a provided function on every element in the calling array.

```sesi
let numbers = [1, 2, 3]
fn square(x) { return x * x }
let squares = map(numbers, square) // [1, 4, 9]
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
let totalWithInitial = reduce(numbers, sum, 10) // 20
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
```

**Parameters**:

- `array` (`array`): The source array.
- `callback` (`fn`): Function to execute on each value in the array. Receives arguments: `(item, index, array)`.

**Returns**: `any` or `null`

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

---

### rename(oldPath, newPath) -> bool

Rename or move a file or directory.

```sesi
let success = rename("old_name.txt", "new_name.txt")
if success {print "File renamed successfully"}
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

// Automatically backs up to the hidden `.archive` directory in project root
archive("src/index.ts") // Saves to .archive/index.ts
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

// Permanently and recursively deletes the file/directory immediately
trash("temp.txt", true)
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

## Audio Functions (std/audio)

The `std/audio` module provides functions for sound synthesis and playback.

```sesi
allow "std/audio" in with Audio

// Play a simple beep (frequency in Hz, duration in ms)
Audio.beep(440, 200)

// Play a musical note
Audio.play("C4", 500)
Audio.play("E4", 500)
Audio.play("G4", 500)

// Synthesize a waveform and get base64 WAV data
let b64 = Audio.synth(440, 1000, "square")

// Save a synthesized tone to a file
Audio.save("tone.wav", "A4", 2000, "sine", {"attack": 50, "release": 500})

// Professional Sample-Based Synthesis (SoundFonts)
let piano = Audio.sf2("GeneralUser-GS.sf2", {"instrument": 0, "gain": 1.5})
let string_pad = Audio.sf2("GeneralUser-GS.sf2", {"instrument": 49})

// Native Physical Modeling (Drums)
let kick = {"note": "C1", "ms": 500, "type": "kick"}
let snare = {"note": "C4", "ms": 500, "type": "snare"}
let hat = {"note": "G8", "ms": 250, "type": "hat", "pan": 0.3}

// Save a sequence (song) of notes
let song = [
  {"note": "C4", ms: 500, "vol": 0.8},
  {"note": "E4", ms: 500, "pan": -0.5},
  {"note": "G4", ms: 1000, "cutoff": 5000} // LPF Filter
]
Audio.sequence("song.wav", song, "triangle")

// Save tracks to a MIDI file
Audio.midi("song.mid", song)

// Mix multiple tracks (Native Synthesis and SoundFonts) into a single stereo WAV
let lead = [piano("C4", 500), piano("E4", 500)]
let bass = [kick, snare]
Audio.mix("mix.wav", [lead, bass], "sine", {"saturate": 1.5})
```

### beep(frequency, duration)

Plays a simple sine wave beep.

### play(note, duration, options)

Plays a musical note (e.g., `"C4"`, `"A#3"`, `"Bb5"`). Accepts `options` for ADSR, volume, and panning.

### synth(frequency_or_note, duration, type, options)

Returns a base64 encoded WAV string. `type` can be `"sine"`, `"square"`, `"saw"`, `"triangle"`, `"noise"`, `"kick"`, `"snare"`, `"hat"`, or `"clap"`.

### save(path, frequency_or_note, duration, type, options)

Saves a synthesized WAV file to the specified path.

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

// Generate an A minor scale array
let a_minor = Music.scale("A3", "minor")

// Transpose notes up by 5 semitones (Perfect 4th)
let shifted = Music.transpose(c_maj7, 5) // ["F4", "A4", "C5", "E5"]
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

The `std/draw` module provides a comprehensive API for creating static or animated SVG graphics.

```sesi
allow "std/draw" in with Draw

// Setup gradients
Draw.gradient("linear", "sky", [
  {"offset": "0%", "color": "blue"},
  {"offset": "100%", "color": "black"}
])

// Setup CSS keyframe animations
Draw.style("
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 4s infinite linear; transform-origin: 50px 50px; }
")

// Render shapes with styling options
Draw.rect(0, 0, 100, 100, "url(#sky)")
Draw.circle(50, 50, 40, "red", {"class": "spinner"})
Draw.ellipse(50, 50, 20, 10, "gold")
Draw.polygon("30,20 85,20 90,75 25,75", "green")
Draw.path("M 10 10 C 20 20, 40 20, 50 10", "none", {"stroke": "white", "stroke-width": 2})

// Get the SVG string
let svg = Draw.render(100, 100)

// Save to a file
Draw.save_svg("drawing.svg", 100, 100)
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

### live(filePath, exportName = "handle") -> fn

Creates a dynamic hot-reloading wrapper function around a Sesi script's exported function. When the returned function is called, it re-reads, re-parses, and re-executes the target file, ensuring changes to the code are instantly reflected without restarting the parent process.

```sesi
// Wrap handler with hot-reloading
let handler = live("server_handler.sesi", "handleRequest")

// Pass it to the web server
listen(8080, handler)
```

**Parameters**:

- `filePath` (`string`): Path to the target file.
- `exportName` (`string`, optional): Name of the exported function in the file to run. Defaults to `"handle"`.

**Returns**: `fn` - A wrapper function that passes all arguments to the hot-reloaded function and returns its result.

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

### format(timestamp, options) -> string

Convert Unix timestamp to a human-readable string.

```sesi
let timestamp = now()
let formatted = format(timestamp, {"timeZone": "America/New_York", "timeStyle": "medium"})
print formatted
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

### retry(action, options = null) -> any

Executes a function, automatically catching errors and retrying execution with exponential backoff if it fails.

```sesi
fn volatileTask() {
  if random() > 0.8 {
    return "Success!"
  }
  raise_error("TemporaryError", "Task failed unpredictably")
}

// Retry up to 5 times (default backoff options)
let result = retry(volatileTask, 5)

// Retry with custom configuration object
let result2 = retry(volatileTask, {
  max_retries: 4,
  initial_delay: 500,
  backoff_factor: 1.5
})
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

Manage the context window of a `memory` binding. If the total token count (estimated at ~4 characters per token) exceeds `max_tokens`, the older half of the memory entries are automatically summarized into a single paragraph using `gemini-3.1-flash-lite`, preserving all key facts and context while reducing token usage.

If the memory is already within the budget, the full memory text is returned unchanged.

```sesi
memory conversation {"System: You are a research assistant."}

// After many turns of conversation...
// Trim to stay within a 500K token budget
let trimmed = memory_trim("conversation", 500000)
print "Memory now:" len(trimmed) "characters"
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
allow "std/math" in with Math

print Math.sqrt(16) // 4
print Math.floor(3.7) // 3
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
let formatted = Time.format(t, {"timeZone": "America/New_York", "timeStyle": "medium"})
print formatted // e.g. "2:27:02 AM"
```

### std/json

Includes JSON serialization: `parse(str)`, `stringify(val)`.

```sesi
allow "std/json" in with Json

let original = {
  "project": "Sesi",
  "version": "1.6.1"
}
print Json.stringify(original)
```

### std/db

Includes Sesi's lightweight embedded Document Database engine: `db_open(filename, password?)`.
A database instance supports opening collections, inserting documents, querying/finding, updating, and deleting records.

#### Encryption & Decryption at Runtime:

If an optional second parameter `password` is provided, Sesi automatically encrypts database contents stored on disk using **AES-256-CBC** with a dynamic, randomized initialization vector (IV) on every write, and decrypts it during reads.

```sesi
allow "std/db" in with {db_open}

let db = db_open("data.db", "secure-passphrase-here")
let users = db.collection("users")

/* CRUD API:
users.insert(object) -> Returns inserted document (adds unique _id if missing)
users.find(query_object?) -> Returns array of matching documents (returns all if query omitted)
users.update(query_object, update_object) -> Returns number of updated documents
users.delete(query_object) -> Returns number of deleted documents */
```
### std/browser

Includes Sesi's browser automation capabilities powered by Playwright: `launch(options?)`.
A browser instance supports opening new pages. A page instance supports navigation, selector actions, JavaScript evaluation, base64 screenshot and PDF generation.

```sesi
allow "std/browser" in with {launch}

// Launch browser (headless or headed)
let browser = launch({"headless": true})

// Open a new page/tab
let page = browser.newPage()

// Navigate to a website
page.goto("https://example.com")

// Get the page title
let title = page.title()
print "Title:" title

// Get inner text of a selector
let heading = page.inner_text("h1")
print "Heading:" heading

// Get an attribute of an element
let link_href = page.attribute("a", "href")

// Evaluate JavaScript on the page
let scrollX = page.evaluate("window.scrollX")

// Take a base64 screenshot
let b64_screenshot = page.screenshot()

// Take a screenshot and save it to a file
page.screenshot({"path": "screenshot.png", "fullPage": true})

// Generate PDF (base64 and saved to file)
page.pdf({"path": "page.pdf", "format": "A4"})

// Wait for a selector
page.wait_for_selector("h1", {"state": "visible", "timeout": 5000})

// Wait for a specific timeout in milliseconds
page.wait_for_timeout(1000)

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
