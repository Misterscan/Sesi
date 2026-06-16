# Model & Image Config in Sesi

`model()` and `image()` take an optional config block between the model name and the prompt. Config keys are unquoted identifiers.

```
model_call := 'model' '(' string ')' config_block? '{' prompt '}'
image_call := 'image' '(' string ')' config_block? '{' prompt '}'
config_block := '{' key ':' value (',' key ':' value)* '}'
```

---

## Basic Call (No Config)

```sesi
let response = model("gemini-3.5-flash") {"Say hello"}
print response
```

---

## `model()` Config Keys

| Key             | Type                      | Description                                                  |
| --------------- | ------------------------- | ------------------------------------------------------------ |
| `thinkingLevel` | `string`                  | Reasoning effort: `"minimal"`, `"low"`, `"medium"`, `"high"` |
| `max_tokens`    | `number`                  | Maximum tokens in the response                               |
| `images`        | `string \| array<string>` | Local file path(s) for vision input                          |
| `stream`        | `bool \| fn`              | Stream output to stdout (`true`) or a callback fn            |
| `cache`         | `bool`                    | Set to `false` to bypass Sesi Logic Caching                  |
| `search`        | _(no value)_              | Enable web search grounding for real-time information        |
| `temperature`   | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |
| `top_k`         | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |
| `top_p`         | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |

---

## `thinkingLevel`

Controls how much reasoning effort the model applies before responding:

```sesi
// Fastest — minimal reasoning
let r1 = model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Summarize in one sentence:" text}

// Balanced
let r2 = model("gemini-3.5-flash") {thinkingLevel: "low"} {"Analyze this code:" code}

// Deep reasoning
let r3 = model("gemini-3.5-flash") {thinkingLevel: "medium"} {"Solve this step by step:" problem}
```

---

## `max_tokens`

Cap the response length:

```sesi
let brief = model("gemini-3.1-flash-lite") {max_tokens: 100} {"Explain quantum computing."}
```

---

## `images` — Vision Input

Pass a local image path to give the model visual input:

```sesi
// Single image
let description = model("gemini-3-flash-preview") {images: "photo.png"} {"Describe what you see."}

// Multiple images
let comparison = model("gemini-3.5-flash") {images: ["before.png", "after.png"]} {"What changed between these two images?"}
```

---

## `stream`

Stream tokens as they arrive instead of waiting for the full response.

### To stdout

```sesi
let response = model("gemini-3.1-flash-lite") {stream: true} {"Write a short poem."}

// tokens print to terminal in real-time
print "Final:" response
```

### To a callback function

```sesi
fn handleChunk(chunk) {
  print "Chunk:" chunk
}

let response = model("gemini-3.1-flash-lite") {stream: handleChunk} {"Explain closures."}
print "Final:" response
```

The return value is always the fully accumulated response string, regardless of whether streaming is on.

---

## `search` — Web Search Grounding

`search` takes no value. Adding it to the config block tells the model to ground its response in live web search results:

```sesi
let response = model("gemini-3.1-flash-lite") {search} {"What is the weather in Tokyo right now?"}
print response
```

Combine with other keys normally:

```sesi
let response = model("gemini-3.1-flash-lite") {search, max_tokens: 200} {"Latest news in Media this week."}
```

---

## `cache`

Sesi caches model responses by default. Set `cache: false` to force a fresh call:

```sesi
let fresh = model("gemini-3-flash-preview") {cache: false} {"What time is it?"}
```

---

## Combining Config Keys

Multiple keys are comma-separated on one line:

```sesi
let result = model("gemini-3.5-flash") {thinkingLevel: "medium", max_tokens: 500} {"Analyze this document:" doc}

let scan = model("gemini-3.5-flash") {images: "receipt.png", thinkingLevel: "minimal"} {"Extract all line items as JSON."}
```

---

## `image()` Config Keys

| Key      | Type                      | Description                                         |
| -------- | ------------------------- | --------------------------------------------------- |
| `ratio`  | `string`                  | Aspect ratio — e.g. `"1:1"`, `"16:9"`, `"4:3"`      |
| `size`   | `string`                  | Output resolution — `"512"`, `"1K"`, `"2K"`, `"4K"` |
| `images` | `string \| array<string>` | Reference image(s) for style/context                |

```sesi
let logo = image("gemini-3.1-flash-image") {ratio: "1:1", size: "512"} {"A minimal logo for a programming language"}
write_image("logo.png", logo)
```

```sesi
let banner = image("gemini-2.5-flash-image") {ratio: "16:9", size: "1K"} {"A dark futuristic cityscape at night"}
write_image("banner.png", banner)
```

---

## Quick Reference

```sesi
// No config
let r = model("gemini-3.5-flash") {"Hello"}

// thinkingLevel
let r = model("gemini-3.5-flash") {thinkingLevel: "low"} {"Summarize:" text}

// max_tokens
let r = model("gemini-3.5-flash") {max_tokens: 200} {"Explain this."}

// Vision input
let r = model("gemini-3.5-flash") {images: "scan.png"} {"Transcribe all text."}

// Streaming to stdout
let r = model("gemini-3.1-flash-lite") {stream: true} {"Write a poem."}

// Streaming with callback
fn onChunk(chunk) { print chunk }
let r = model("gemini-3.1-flash-lite") {stream: onChunk} {"Tell a story."}

// No cache
let r = model("gemini-3.1-flash-lite") {cache: false} {"What's trending?"}

// Combined
let r = model("gemini-3.5-flash") {thinkingLevel: "medium", max_tokens: 500, images: "doc.png"} {"Analyze this."}

// image()
let img = image("gemini-2.5-flash-image") {ratio: "16:9", size: "1K"} {"A sunset over the ocean"}
write_image("output.png", img)
```

---
