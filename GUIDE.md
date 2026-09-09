# 📚 Sesi Language — Complete Study Guide

## 1. Identity & Philosophy

Sesi is a **clean, minimal, side-effect-oriented** scripting language. It is:

- **NOT** Python, TypeScript, JavaScript, YAML, or any other language — its syntax is unique
- Top-level execution only — no `main()` wrappers
- Built for **clarity and reusability**, with built-in AI primitives, SVG drawing, audio synthesis, networking, and a document database
- Dynamically typed with optional type annotations
- File extension: **`.sesi`**
- Runs via CLI: `npm run sesi <file>.sesi` or `node bin/sesi.js <file>.sesi`

---

## 2. Variables

### Declaration — always `let`, never `const`

```sesi
let name    = "Sesi"
let retries: number = 3
let version = 1.9.0
let active  = true
let missing         // null (uninitialized)
```

### Reassignment — no `let` keyword on re-assign

```sesi
let count = 0
count = count + 1   // count is now 1
```

### Types

| Type     | Alias | Example                  |
| -------- | ----- | ------------------------ |
| `number` | `num` | `42`, `3.14`             |
| `string` | `str` | `"hello"`                |
| `bool`   | —     | `true`, `false`          |
| `null`   | —     | `null`                   |
| `array`  | —     | `[1, 2, 3]`              |
| `object` | —     | `{key: "value"}`         |
| `any`    | —     | any value, no type check |

Type annotations are optional and belong after the variable name:

```sesi
let total: number = 42
let label: string = "draft"
let ready: bool = true
```

### Type Conversion

```sesi
let n = num("42")      // "42" -> 42
let s = str(99)        // 99   -> "99"
let b = bool(0)        // 0    -> false
```

Never use `parseInt`, `Number()`, or JS-style coercions.

### Optional & Union Types (in `fn` signatures)

```sesi
fn greet(name: str, title: str?) { ... }   // title may be null (optional type)
fn find(id: num) -> object? { ... }        // optional return type
fn show(val: number | string) { ... }      // union type
```

### Optional Chaining

```sesi
// Optional chaining: obj?.prop, arr?.[index]
let email = user?.profile?.email
let first = items?.[0]
```

### Built-in Global Variables & Shorthands

```sesi
// CLI: sesi script.sesi Alice 30
let name = args[0]   // "Alice"
let age  = args[1]   // "30"

// Environment variable lookup shorthand ($VAR)
show $USER
let port = $PORT || 8080
let home = $HOME
```

### Collection Mutation

```sesi
let scores = [10, 20, 30]
scores[0] = 99             // [99, 20, 30]

let user = {name: "Ada", role: "admin"}
user.role = "developer"
```

---

## 3. Functions

### Declaration

```sesi
fn greet(name: string) { show "Hello," name }

greet("Ada")   // Hello, Ada
```

Grammar: `'async'? 'fn' identifier '(' parameters ')' '->' type? block`

### Documentation Comments

Write a comment immediately above each public or nontrivial declaration. Sesi uses these comments in hover details, preserves function documentation across exports and imports, and can expose handler documentation through modules such as `std/api`.

There is no required documentation schema—a clear description by itself is useful. For consistent, discoverable API documentation, prefer a short description followed by `Parameters` and `Returns` sections:

```sesi
/**
  Adds two numbers.

  Parameters:
  - `a`: The first number.
  - `b`: The second number.

  Returns:
  - The sum of `a` and `b`.

  Example:
  ```sesi
  add(2, 3)   // 5
  ```

  Notes:
  - This function assumes both `a` and `b` are numbers.
*/
fn add(a: number, b: number) -> number { return a + b }
```

Documentation comments also work on `make` and `let` declarations. They are especially valuable for `let` values containing arrays or objects: describe the purpose of the collection, the shape and ordering of array items, and the important object keys and defaults.

```sesi

/** Collects jobs waiting to be processed. */
make JobQueue {
  /**
  * Runtime settings shared by API requests.
  *
  * Fields:
  * - `hosts`: Ordered fallback API hosts.
  * - `retries`: Maximum attempts per request.
  */
  let settings = {
    "hosts": ["https://primary.example", "https://backup.example"],
    "retries": 3
  }
  
  // Pending job objects in insertion order.
  let jobs = []
}
```

### Typed Parameters, Defaults, Return Values

```sesi
fn add(a: number, b: number) -> number { return a + b }
fn greet(name: string = "World") { show "Hello," name }
```

> Inside a `fn` block, `return` sends a value back to the caller. At the top level, it stops the current script or module immediately; a supplied value has no caller to receive it.

### Functions as First-Class Values

```sesi
fn isEven(x) { return x % 2 == 0 }
fn square(x) { return x * x }
fn add(a, b) { return a + b }

let evens = filter([1, 2, 3, 4], isEven)   // [2, 4]
let sq = map([1, 2, 3], square)
let total = reduce([1, 2, 3], add)
```

### Pipe Operator `|`

Passes the left value as the **first argument** to the right function:

```sesi
fn add(a, b) { return a + b }
fn mul(a, b) { return a * b }

let result = 10 | add(5) | mul(2)   // 30
```

### Async Functions

```sesi
async fn load(path: string) { return read_file(path) }

let content = await load("data.txt")
```

### Closures

Functions close over **live bindings** — changes to outer variables are visible inside:

```sesi
let base = 100
fn addBase(n) { return n + base }

show addBase(5)   // 105
base = 200
show addBase(5)   // 205
```

### Exporting Functions

```sesi
// math.sesi
export fn add(a, b) { return a + b }
export let PI = 3.14159
```

---

## 4. Conditionals

No parentheses required around conditions.

```sesi
if score >= 90 {
  show "excellent"
} else if score >= 70 {
  show "passing"
} else {
  show "needs work"
}
```

### One-liners

```sesi
if ready { show "go" }
if !ready { show "wait" }
```

### Truthiness Table

| Value            | Truthy? |
| ---------------- | ------- |
| `true`           | ✅      |
| Non-zero number  | ✅      |
| Non-empty string | ✅      |
| Non-empty array  | ✅      |
| Non-empty object | ✅      |
| `false`          | ❌      |
| `0`              | ❌      |
| `""`             | ❌      |
| `null`           | ❌      |

### Operators

| Operator | Meaning               |
| -------- | --------------------- |
| `==`     | Equal                 |
| `!=`     | Not equal             |
| `<`      | Less than             |
| `>`      | Greater than          |
| `<=`     | Less than or equal    |
| `>=`     | Greater than or equal |
| `&&`     | And (short-circuits)  |
| `\|\|`   | Or (short-circuits)   |
| `!`      | Not                   |

---

## 5. Loops

### `while` — condition-based

```sesi
let i = 0
while i < 5 {
  show i
  i = i + 1
}
// One-liner
while x > 0 { x = x - 1 }
```

### `for ... in` — iterate array

```sesi
let names = ["Ada", "Grace", "Linus"]
for name in names { show "Hello," name }

// Object keys
for key in keys(config) { show key ":" config[key] }
```

### `for ... = ... to ...` — numeric range (excludes upper bound)

```sesi
for i = 0 to 5 { show i }
// 0 1 2 3 4
```

### `break` and `continue`

```sesi
for item in items {
  if item == "stop" { break }      // exit loop
  if item == "skip" { continue }   // next iteration
  show item
}
```

### Accumulator Pattern

```sesi
let total = 0
for n in numbers { total = total + n }

let results = []
for file in files {
  if contains(file, ".sesi") { push(results, file) }
}
```

---

## 6. Prompt Blocks

Sesi's unique string-composition primitive. Replaces template literals.

```sesi
let name = "Ada"
let ver  = "1.9.0"

prompt header {"Welcome to Sesi "ver". Hello, "name}
// header = "Welcome to Sesi 1.9.0. Hello, Ada"

show header
write_file("out.txt", header)
```

### Rules

> ⚠️ **NO raw newlines between elements** inside `{ }` (i.e. outside of string literals) — they are treated as statement separators and will cause a syntax error. Write prompt blocks on a single line.
>
> To include actual newlines in the **output**, place them literally inside the string quotes:

```sesi
prompt report {"Student: "name"
Score: "score"
Grade: A"}
```

The newline is a real line break _inside the string literal_ — not `\n`, not any escape sequence.

### Composing Prompts

```sesi
prompt fullName {first last}
prompt badge {"[Developer] "fullName}
```

### Prefer prompt blocks over `+` inside `show`

```sesi
// ✅ Idiomatic
show "Hello," name "version" version

// ❌ Avoid
show "Hello, " + name + " version " + str(version)
```

---

## 7. Modules

### Exporting

```sesi
export fn add(a, b) { return a + b }
export let VERSION = "1.9.0"
```

### Importing — `import` (named)

```sesi
import { add, PI } from "math"
```

### Importing — `allow` (Sesi's preferred syntax)

```sesi
// Named bindings
allow "math" in with { add, multiply }
show add(3, 4)

// Namespace object
allow "math" in as Math
show Math.add(3, 4)
```

### Module Resolution Order

1. Script's own directory
2. Current working directory
3. `SESI_PATH` env var
4. `~/.sesi/lib` (global)
5. `sesi_modules` (local modules directory)

### Standard Library Modules

| Module       | Common Alias | Description              |
| ------------ | ------------ | ------------------------ |
| `std/draw`   | `Draw`       | SVG vector drawing       |
| `std/db`     | `{db_open}`  | Embedded document DB     |
| `std/audio`  | `Audio`      | Sound synthesis/playback |
| `std/theory` | `Music`      | Music theory helpers     |
| `std/math`   | `Math`       | Math operations          |
| `std/time`   | `Time`       | Time/date functions      |
> ... for more, visit `getting-started/`

JSON conversion is built in directly through `from_json` and `to_json`; the former `std/json` module has been removed.

---

## 8. Error Handling

```sesi
try {
  let data = read_file("config.json")
  let obj  = from_json(data)
  show obj.key
} catch (err) {
  show "Error:" err
}
```

> Always wrap file I/O and network calls in `try/catch` — this is a Sesi best practice.

---

## 9. std/draw — SVG and Pixel Drawing

```sesi
allow "std/draw" in as Draw
```

### Shapes

```sesi
Draw.rect(x, y, width, height, fill, options?)
Draw.circle(x, y, radius, fill, options?)
Draw.line(x1, y1, x2, y2, stroke, options?)
Draw.text(x, y, content, size, fill, options?)
Draw.ellipse(cx, cy, rx, ry, fill, options?)
Draw.polygon(points, fill, options?)
Draw.path(d, fill, options?)
```

### Gradients

```sesi
Draw.gradient("linear", "myGrad", [
  {offset: "0%", color: "#ff0000"},
  {offset: "100%", color: "#0000ff"}
], {x1: "0%", y1: "0%", x2: "100%", y2: "0%"})

// Reference in fill
Draw.rect(0, 0, 400, 300, "url(#myGrad)")
```

```sesi
Draw.gradient("radial", "glowGrad", [
  {offset: "0%", color: "#ffffff", opacity: 1.0},
  {offset: "100%", color: "#000000", opacity: 0.0}
], {cx: "50%", cy: "50%", r: "50%"})
```

### CSS Animations

```sesi
Draw.style("
  @keyframes pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1.0; }
  }
  .pulsing { animation: pulse 2s infinite ease-in-out; }
")

Draw.circle(200, 200, 80, "#ff0000", {class: "pulsing"})
```

### Raw SVG Injection

```sesi
Draw.raw("<filter id=\"glow\"><feGaussianBlur stdDeviation=\"5\" result=\"blur\" /><feMerge><feMergeNode in=\"blur\" /><feMergeNode in=\"SourceGraphic\" /></feMerge></filter>")
```

### Rendering & Saving

```sesi
let svg = Draw.render(400, 300)    // returns SVG string, buffer stays
Draw.save_svg("output.svg", 400, 300)
Draw.clear()                       // reset buffer
```

### Raster Pixels

```sesi
Draw.pixel(x, y, color)
Draw.pixel_grid(grid, palette, scale?, x?, y?)
Draw.pixel_rect(x, y, w, h, color, filled?)
Draw.pixel_circle(cx, cy, r, color, filled?)
Draw.pixel_line(x1, y1, x2, y2, color)
Draw.pixel_ellipse(cx, cy, rx, ry, color, filled?)
Draw.pixel_polygon(points, color, filled?)
Draw.pixel_triangle(x1, y1, x2, y2, x3, y3, color, filled?)
Draw.pixel_star(cx, cy, spikes, outerRadius, innerRadius, color, filled?)
Draw.pixel_ring(cx, cy, radius, thickness, color)
Draw.pixel_arc(cx, cy, radius, startAngle, endAngle, color)
Draw.pixel_bezier(x1, y1, cx, cy, x2, y2, color)
Draw.pixel_path(d, color, filled?)
Draw.pixel_text(x, y, text, color, scale?)
Draw.save_png(path, width, height, background?)
```

Pixel calls write to a raster buffer, not the SVG. `pixel_grid` accepts array rows or compact string rows and expands each cell by `scale`. `save_png` encodes the buffer as a true RGBA PNG; the background defaults to transparent.

### Layer Order

Shapes are rendered in draw-call order — **earlier calls appear behind later ones**.

---

## 10. Model Calls (AI)

### Basic call

```sesi
let response = model("gemini-3.5-flash-lite") {"Summarize this:" text}
show response
```

> The prompt block `{...}` uses the same sequential string composition rules as `prompt`.

### Config block

```sesi
// Config block comes between model name and prompt block
let result = model("gemini-3.8-flash") {thinkingLevel: "medium", max_tokens: 500} {"Analyze this:" doc}
```

> Config keys are **unquoted identifiers** (schema objects).

### Config Keys

| Key             | Type              | Notes                                      |
| --------------- | ----------------- | ------------------------------------------ |
| `thinkingLevel` | `string`          | `"minimal"`, `"low"`, `"medium"`, `"high"` |
| `max_tokens`    | `number`          | Cap response length                        |
| `images`        | `string \| array` | Vision input file path(s)                  |
| `stream`        | `bool \| fn`      | Stream to stdout or callback               |
| `cache`         | `bool`            | `false` = bypass Sesi Logic Caching        |
| `search`        | _(bare key)_      | Enable live web search grounding           |
| `tools`         | `array \| bool`   | Registered names/schemas, or `true` for all |
| `max_tool_calls`| `number`          | Automatic-call limit; defaults to `8`      |

```sesi
// Vision
let desc = model("gemini-3.8-flash") {images: "photo.png"} {"Describe this image."}

// Streaming
let r = model("gemini-3.5-flash-lite") {stream: true} {"Write a poem."}

// No cache + search
let news = model("gemini-3.5-flash-lite") {search, cache: false} {"Latest AI news."}
```

### Automatic Function Calling

Register ordinary Sesi functions, then expose selected names to a model. Sesi derives the provider schema from the function parameters, executes requested calls, and resumes the model with each result until it returns a final answer.

```sesi
fn calculateTax(amount: number, rate: number) -> number {return amount * rate}
define_tool("calculateTax", calculateTax, "Calculate tax for an amount and rate")

let answer = model("gemini-3-flash-preview") {tools: list_tools(), max_tool_calls: 4} {"What is 8% tax on $125?"}
show answer
```

Use `tools: ["calculateTax"]` to expose only selected registered tools, or `tools: true` to expose all of them. Sensitive system functions such as `exec`, `spawn`, `python`, and `ffmpeg` remain blocked from automated model execution.

### Image Generation

```sesi
let img = image("gemini-3.1-flash-image-lite") {ratio: "16:9", size: "1K"} {"A cyberpunk city at night"}
write_image("banner.png", img)
```

---

## 11. Network

Built-in — no imports required.

```sesi
// GET
let body = web_get("https://api.example.com/data")
let body = web_get("https://api.example.com/data", {Authorization: "Bearer token"})

// POST
let res = web_send("https://api.example.com/submit", to_json({key: "val"}))
let res = web_send(url, body, {"Content-Type": "application/json"})

// Parse JSON response
let data = from_json(body)
show data.title
```

### HTTP Server

```sesi
fn handler(req) {
  if req.path == "/health" { return {status: 200, body: "ok"} }
  return {status: 404, body: "Not found"}
}

let http = listen(8080, handler)
http.close()
```

### WebSocket Server

```sesi
fn onMsg(client, msg) {
  client.send("Echo: " + msg)
}

let ws = api(8989, onMsg)
ws.close()
```

---

## 12. Database (std/db)

```sesi
allow "std/db" in with {db_open}

let db    = db_open("store.db")            // plain
let db    = db_open("store.db", "passphrase") // encrypted (AES-256-CBC)

let users = db.collection("users")

// CRUD
users.insert({name: "Ada", role: "admin"})
let all    = users.find()
let admins = users.find({role: "admin"})
let count  = users.update({name: "Ada"}, {role: "lead"})
let del    = users.delete({active: false})
```

Documents auto-get an `_id` if not provided.

---

## 13. Audio (std/audio & std/theory)

```sesi
allow "std/audio"  in as Audio
allow "std/theory" in as Music
```

### Playback & Synthesis

```sesi
Audio.beep(440, 200)          // Hz, ms
Audio.play("C4", 500)         // note name, ms
Audio.save("tone.wav", "A4", 2000, "sine", {attack: 50, release: 500})
Audio.midi("song.mid", track) // export MIDI
```

### Waveform types

`"sine"`, `"square"`, `"saw"`, `"triangle"`, `"noise"`, `"kick"`, `"snare"`, `"hat"`, `"clap"`

### Sequences & Mixing

```sesi
let song = [
  {note: "C4", ms: 500, vol: 0.8},
  {note: "E4", ms: 500, pan: -0.5}
]
Audio.sequence("song.wav", song, "triangle")

Audio.mix("mix.wav", [melody_track, bass_track], "sine", {saturate: 1.2})
```

### SoundFont Instruments

```sesi
let piano = Audio.sf2("GeneralUser-GS.sf2", {instrument: 0, gain: 1.5})
let notes = [piano("C4", 500), piano("E4", 500)]
Audio.mix("song.wav", [notes], "sine")
```

### Music Theory

```sesi
let scale  = Music.scale("C4", "major")
let chord  = Music.chord("A3", "m7")
let moved  = Music.transpose(chord, 7)      // +7 semitones
let ms     = Music.bar(8, 120)              // 8 bars at 120bpm = 16000ms
let ms2    = Music.duration(1, 30)          // 1m30s = 90000ms
```

---

## 14. Core Built-in Functions

These are always available — no imports needed:

### Arrays

| Function             | Description                          |
| -------------------- | ------------------------------------ |
| `push(arr, val)`     | Append to array (mutates in place)   |
| `pop(arr)`           | Remove and return last element       |
| `len(arr)`           | Length of array or string            |
| `range(n)`           | `[0, 1, ..., n-1]`                   |
| `map(arr, fn)`       | Apply fn to each element → new array |
| `filter(arr, fn)`    | Keep elements where fn returns true  |
| `reduce(arr, fn)`    | Accumulate array to single value     |
| `find(arr, fn)`      | First matching element, or null      |
| `contains(str, sub)` | String/array containment check       |
| `keys(obj)`          | Array of object keys                 |
| `slice(arr, s, e)`   | Sub-array from index s to e          |
| `join(arr, sep)`     | Join array elements into string      |
| `split(str, sep)`    | Split string into array              |

### Strings

| Function             | Description                 |
| -------------------- | --------------------------- |
| `to_upper(str)`      | Uppercase                   |
| `to_lower(str)`      | Lowercase                   |
| `trim(str)`          | Strip whitespace            |
| `swap(str, a, b)`    | Replace a with b            |
| `regex(pattern, text, options?)` | Match, test, replace, or split with a regular expression |
| `str(val)`           | Convert any value to string |

### JSON

| Function         | Description                      |
| ---------------- | -------------------------------- |
| `to_json(obj)`   | Serialize object → JSON string   |
| `from_json(str)` | Parse JSON string → object/array |

### Speech

| Function | Description |
| -------- | ----------- |
| `speech(text, voice?, gemini?)` | Speak text with the system voice or Gemini |
| `from_speech(path, language?, gemini?)` | Transcribe with Whisper or Gemini |

`from_speech()` needs Whisper and a local model.

> Always use `to_json()` for serialization. Never use `stringify()`.

### Token Usage & Cost

| Function | Description |
| -------- | ----------- |
| `tokenize(text, model?)` | Return local plain-text token IDs; also supports `"simple"` word splitting |
| `count_tokens(text, model?)` | Count through the selected OpenAI, Gemini, or local tokenizer |
| `estimate_tokens(text, model?)` | Estimate locally without an API request |
| `estimate_cost(model, input, output?)` | Estimate paid-tier text-token cost |
| `model_usage()` | Inspect actual usage from the latest model call |

```sesi
let planned = estimate_cost("gemini-3.8-flash", prompt, 1000)
let answer = model("gemini-3.8-flash") {max_tokens: 1000} {prompt}
let actual = model_usage()
show actual.total_tokens actual.total_cost_usd
```

These are deliberately separate: `tokenize()` is local and returns IDs, `count_tokens()` asks the selected provider for an exact request count, and `estimate_tokens()` is the explicit offline approximation.

### Math & Randomness

`random()` and `floor(value)` are globally available. Import `std/math` for the complete stable JavaScript `Math` surface supported by Node.js 20+:

```sesi
allow "std/math" in as Math

show floor(3.9)             // 3; global
show Math.atan2(1, 0)       // 1.5707963267948966
show Math.hypot(3, 4)       // 5
show Math.min(8, 3, 5)      // 3
```

Constants: `E`, `LN10`, `LN2`, `LOG10E`, `LOG2E`, `PI`, `SQRT1_2`, `SQRT2`.

Functions: `abs`, `acos`, `acosh`, `asin`, `asinh`, `atan`, `atanh`, `atan2`, `cbrt`, `ceil`, `clz32`, `cos`, `cosh`, `exp`, `expm1`, `floor`, `fround`, `hypot`, `imul`, `log`, `log1p`, `log2`, `log10`, `max`, `min`, `pow`, `random`, `round`, `sign`, `sin`, `sinh`, `sqrt`, `tan`, `tanh`, `trunc`.

### File I/O

| Function                  | Description                         |
| ------------------------- | ----------------------------------- |
| `read_file(path)`         | Read file → string                  |
| `write_file(path, str)`   | Write string to file                |
| `write_image(path, data)` | Write image data to file            |
| `list_dir(path)`          | List directory → array of filenames |
| `make_dir(path)`          | Create directory → bool             |
| `rename(old, new)`        | Rename or move file/directory       |
| `archive(src, dest?)`     | Backup/copy file/directory          |
| `get_ext(path)`           | Get a lowercase file extension      |
| `exists(path)`            | Check whether a path exists         |
| `zip(src, dest?, op?)`    | Create, list, or extract archives   |
| `trash(path, auto?)`      | Delete (trash or permanent remove)  |

### Misc

| Function             | Description                                         |
| -------------------- | --------------------------------------------------- |
| `input(prompt)`      | Read a line from stdin                              |
| `show ...`          | Print space-separated values to stdout              |
| `swap(str, a, b)`    | String swap/replacement utility                     |
| `define_tool(n,f,d)` | Register a function as a named AI tool              |
| `list_tools()`       | List all registered tools                           |
| `sesi(cmd, options?)`| Run a sesi script                                   |
| `exec(cmd)` / `run(cmd)` | Run a system shell command (blocked in Safe Mode) |
| `spawn(path)`        | Run a background Sesi script (blocked in Safe Mode) |
| `python(code, args)` | Run inline Python code (blocked in Safe Mode)       |
| `js(code, args)`     | Run inline JavaScript code (blocked in Safe Mode)   |
| `gif(input, output, options?)` | Create an animated GIF with FFmpeg (blocked in Safe Mode) |
| `video(model) {config} {prompt}` | Generate Base64 video with Gemini Omni Flash or Veo |
| `video(input, output, options?)` | Create or transcode video with FFmpeg (blocked in Safe Mode) |
| `ffmpeg(args, options?)` | Run structured FFmpeg arguments (blocked in Safe Mode) |
| `html(body, opts)`   | Build a complete HTML document string               |

> ## FOR MORE, PLEASE VISIT "BUILTINS.md" EITHER IN `docs/` OR `node_modules/@misterscan/sesi/docs/`

---

## 15. Quirks & Gotchas (Critical)

### 1. No raw newlines **between elements** inside prompt `{}` or model `{}`

Raw newlines outside of string literals are statement separators — they break the block.

```sesi
// ✅ Correct — all elements on one line
prompt title {"Hello," name "— version" version}

// ✅ Also correct — newline is INSIDE the string literal
prompt report {"Name: "name"
Score: "score}

// ❌ WRONG — raw newline between elements (outside string literals)
prompt title {
  "Hello," name
}

// Same applies to model `{}` blocks and other similar constructs
// ✅ Correct — all elements on one line
model("gemini-3.1-flash-lite") {"What is the latest in tech? Return a list with the top 5 trends."}

// ✅ Also correct — newline is INSIDE the string literal
model("gemini-3.1-flash-lite") {"What is the latest in tech? 
Return a list with the top 5 trends."}

// ❌ WRONG — raw newline between elements (outside string literals)
model("gemini-3.1-flash-lite") {
  "What is the latest in tech? 
  Return a list with the top 5 trends.
"

// ❌ Also WRONG — raw newline between elements (outside string literals) and manual string concatenation
model("gemini-3.1-flash-lite") {
  "What is the latest in tech?" +
  "Return a list with the top 5 trends."
}
}
```

### 2. Object keys: quoted vs unquoted

```sesi
// Object literals: quoted
let obj = {"name": "Ada", "age": 42}
// Object literals: unquoted
let obj2 = {name: "Ada", age: 42}

// Config/schema blocks: unquoted identifiers
let r = model("gemini-3.6-flash") {thinkingLevel: "low", max_tokens: 100} {"Hello"}
```

### 3. No `const` or `var`; top-level `return` is allowed

```sesi
// ✅
let x = 10
fn double(n) { return n * 2 }
if x < 0 { return }  // stop the script early

// ❌
const x = 10         // forbidden; use let
var y = 20           // forbidden; use let
```

### 4. `show` concatenation style

```sesi
// ✅ Idiomatic — space-separated values
show "Hello," name "your score is" score

// ❌ Avoid
show "Hello, " + name + " your score is " + str(score)
```

### 5. Block condensing is valid

```sesi
while x { x = x - 1 }     // valid one-liner
if ready { show "go" }    // valid one-liner
```

### 6. `%` operator for modulo

```sesi
if i % 2 == 0 { continue }
```

### 7. Type aliases in signatures

`num` = `number`, `str` = `string` — both valid in `fn` parameter lists.

---

## 16. CLI Commands

```bash
npm run sesi <file>.sesi        # Run a script
npm run sesi:local              # Run a script with local permissions
npm run sesi <file>.sesi arg1   # Run with args (available as args[] inside the script)
npm run eval "sesi code"        # Inline eval (syntax testing)
npm run help                    # Show CLI help
npm run lint                    # Run linter on workspace
npm run lint <file>.sesi        # Run linter on a specific file
npm run encrypt                 # Encrypt a .sesi file
npm run decrypt                 # Decrypt a .sesi file
```
> Visit CLI.md for more details.

Aliases via `node bin/sesi.js`:

- `-e "code"` → inline eval
- `-l file.sesi` → run file
- `-h` → help
- `-enc` / `-dec` → encrypt/decrypt

---

## 17. Idiomatic Patterns from Real Scripts

### Starfield / random particle generation

```sesi
let i = 0
while i < 180 {
  let cx = random() * 800
  let cy = random() * 800
  let r  = random() * 1.6 + 0.4
  Draw.circle(cx, cy, r, "#ffffff", {opacity: random() * 0.7 + 0.3})
  i = i + 1
}
```

### Conditional color assignment

```sesi
let color = "#00ffff"
if random() > 0.5 { color = "#ff00ff" }
```

### Polygon point string construction

```sesi
let pts = str(x1) + "," + str(y1) + " " + str(x2) + "," + str(y2)
Draw.polygon(pts, "url(#myGrad)")
```

### Accumulating loop with counter variable

```sesi
let lineY = 418
for i = 0 to 9 {
  Draw.line(292, lineY, 360, lineY, "#f43f5e", {"stroke-width": 4.5})
  lineY = lineY + 12
}
```

### Scoped function inside another function (valid)

```sesi
fn draw_building(x, y, w, h, has_antenna) {
  fn draw_antenna(ax, ay) {
    Draw.line(ax, ay, ax, ay - 40, "#768da3", {"stroke-width": 2})
    Draw.circle(ax, ay - 40, 4, "#ffffff", {filter: "url(#glow)"})
  }
  if has_antenna { draw_antenna(x + w / 2, y) }
}
```

### Test runner pattern

```sesi
allow "bin/test-runner" in with { assert_equals, run_test_suite }

let results = [
  assert_equals(add(2, 3), 5, "add two positives"),
  assert_equals(add(-1, 1), 0, "add to zero")
]

run_test_suite("Math Tests", results)
```

---

## 18. Agent Debug Protocol (Mandatory Workflow)

1. **Draft in file** — write the `.sesi` script in your editor
2. **Eval risky snippets** — `npm run eval "sesi code"` to validate isolated blocks
3. **Fix in file only** — never use `sed`, `awk`, or shell manipulation on `.sesi` files
4. **Run the full script** — `npm run sesi <file>.sesi` only after eval passes
5. **File-aware help** — `node bin/sesi.js -h <file>.sesi "question"` when stuck

> **ABSOLUTE RULE:** Never edit `.sesi` files via terminal shell tools. Always use the IDE editor directly.

---

## 19. Quick Cheat Sheet

```sesi
// Variables
let x = 42
let msg = "hello"
let items = [1, 2, 3]
let cfg = {key: "val"}

// Functions
fn add(a: num, b: num) -> num { return a + b }
fn greet(name: str = "World") { show "Hello," name }

// Control flow
if x > 0 { show "pos" } else { show "neg" }
for item in items { show item }
for i = 0 to 5 { show i }
while x > 0 { x = x - 1 }

// Prompt blocks
prompt msg {"Value is:" x "and name is" name}

// Modules
allow "std/draw" in as Draw
allow "std/db" in with {db_open}
allow "std/game" in as Game
import { fn1, fn2 } from "mymodule"

// Error handling
try { let data = read_file("f.json") } catch (err) { show "Error:" err }

// AI
let r = model("gemini-3.8-flash") {thinkingLevel: "low"} {"Question:" q}
let img = image("gemini-3.1-flash-image-lite") {ratio: "1:1"} {"A forest"}
write_image("out.png", img)

// Network
let body = web_get("https://api.example.com")
let data = from_json(body)
let res  = web_send("https://api.example.com", to_json({k: "v"}))

// JSON
let json_str = to_json({name: "Ada"})
let obj = from_json(json_str)

// SVG
allow "std/draw" in as Draw
Draw.rect(0, 0, 400, 300, "#1a1a2e")
Draw.circle(200, 150, 80, "#e94560")
Draw.text(100, 160, "Hello", 28, "white")
Draw.save_svg("out.svg", 400, 300)
```

## 3D desktop games

Install `@misterscan/sesi-game`, run with `sesi -l`, and use live native handles:

```sesi
allow "std/game" in as Game
let game = Game.create({title: "Guide Game"})
let scene = game.create_scene("main")
let camera = scene.orbit_camera("camera", {radius: 10})
let light = scene.hemispheric_light("light")
let cube = scene.box("cube")
fn update(dt) { cube.rotation.y = cube.rotation.y + dt }
game.on_update(update)
game.run()
```

Game scenes use left-handed coordinates: Y is up, `+X` is right, and `+Z` is forward. Relative generated and registered asset paths both resolve from the current working directory.

Read [getting-started/GAME.md](getting-started/GAME.md) for the complete scenes, assets, physics, input, GUI, audio, storage, permissions, and build API.
