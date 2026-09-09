# Model, Image & Video Config in Sesi

`model()`, `image()`, and AI `video()` calls take an optional config block between the model name and the prompt. Config keys are unquoted identifiers.

```
model_call := 'model' '(' string ')' config_block? '{' prompt '}'
image_call := 'image' '(' string ')' config_block? '{' prompt '}'
video_call := 'video' '(' string ')' config_block? '{' prompt '}'
config_block := '{' key ':' value (',' key ':' value)* '}'
```

---

## Basic Call (No Config)

```sesi
let response = model("gemini-3.5-flash-lite") {"Say hello"}
show response
```

---

## `model()` Config Keys

| Key             | Type                      | Description                                                  |
| --------------- | ------------------------- | ------------------------------------------------------------ |
| `thinkingLevel` | `string`                  | Reasoning effort: `"minimal"`, `"low"`, `"medium"`, `"high"` |
| `max_tokens`    | `number`                  | Maximum tokens in the response                               |
| `images`        | `string \| array<string>` | Local file path(s) for vision input                          |
| `stream`        | `bool \| fn`              | Stream output to stdout (`true`) or a callback fn            |
| `response`      | `string`                   | Set to `"full"` to return text, finish reason, cache state, and token usage |
| `cache`         | `bool`                    | Set to `false` to bypass Sesi Logic Caching                  |
| `system`        | `string`                  | System instruction for Gemini, GPT, and local models         |
| `search`        | _(no value)_              | Enable web search grounding for real-time information        |
| `temperature`   | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |
| `top_k`         | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |
| `top_p`         | `number`                  | ⚠️ Deprecated in Gemini 3.5+. Use `thinkingLevel`.           |
| `tools`         | `array<object>`           | Function schemas exposed to models with tool-aware templates |

---

## Local Models

Use `"local"` to run the default quantized instruction model directly:

```sesi
let answer = model("local") {max_tokens: 256, temperature: 0.3} {"Explain closures simply."}
```

The first call downloads the ONNX weights to `~/.cache/sesi/models`. The loaded
pipeline is reused for later calls in the same process, and downloaded weights
are reused across processes.

Configure the provider with environment variables:

| Variable                   | Default                                         |
| -------------------------- | ----------------------------------------------- |
| `SESI_LOCAL_MODEL`         | `onnx-community/Qwen2.5-0.5B-Instruct`          |
| `SESI_LOCAL_DTYPE`         | `q4`                                            |
| `SESI_LOCAL_DEVICE`        | `cpu`                                           |
| `SESI_LOCAL_CACHE_DIR`     | `~/.cache/sesi/models`                          |
| `SESI_LOCAL_SYSTEM_PROMPT` | Sesi's concise local-assistant system prompt    |
| `SESI_LOCAL_WARN_TOKENS`   | `2048`                                          |

An explicit model can also be selected in the model name:

```sesi
let answer = model("local:onnx-community/Qwen3-0.6B-ONNX") {"Say hello."}
```

Local calls support text generation, streaming, logic caching, token usage, and
tool calling for models whose chat templates support tools. Images, audio, and
search grounding are rejected with an explicit error. The `system` config key
overrides `SESI_LOCAL_SYSTEM_PROMPT` for one call.

```sesi
let tools = [{
  type: "function",
  function: {
    name: "lookup_weather",
    description: "Get weather by city",
    parameters: {
      type: "object",
      properties: {city: {type: "string"}},
      required: ["city"]
    }
  }
}]

let call = model("local:onnx-community/Qwen3-0.6B-ONNX") {tools: tools} {"Use lookup_weather for New York City."}
```

When the model requests a tool, Sesi returns canonical JSON containing `name`,
`args`, and an optional `call_id`, matching hosted-model behavior.

Inputs above 2,048 tokens are allowed but emit a CPU-performance warning. See
[Local Models](../../docs/LOCAL_MODELS.md) for context limits, configuration,
and a reference benchmark.

```sesi
model("local") {max_tokens: 256, temperature: 0.5, system: "Use the tone of a motivational speaker that doesn't let clients give up on their tasks."} {query}
```

---

## `thinkingLevel`

Controls how much reasoning effort the model applies before responding:

```sesi
// Fastest — minimal reasoning, not compatible with newer models (e.g., gemini-3.5-flash and later)
let r1 = model("gemini-3.1-pro-preview") {thinkingLevel: "minimal"} {"Summarize in one sentence:" text}

// Balanced
let r2 = model("gemini-3.8-flash") {thinkingLevel: "low"} {"Analyze this code:" code}

// Deep reasoning
let r3 = model("gemini-3.8-flash") {thinkingLevel: "medium"} {"Solve this step by step:" problem}
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
let description = model("gemini-3.5-flash-lite") {images: "photo.png"} {"Describe what you see."}

// Multiple images
let comparison = model("gemini-3.7-flash") {images: ["before.png", "after.png"]} {"What changed between these two images?"}
```

---

## `stream`

Stream tokens as they arrive instead of waiting for the full response.

### To stdout

```sesi
let response = model("gemini-3.1-flash-lite") {stream: true} {"Write a short poem."}

// tokens show to terminal in real-time
show "Final:" response
```

### To a callback function

```sesi
fn handleChunk(chunk) {
  show "Chunk:" chunk
}

let response = model("gemini-3.1-flash-lite") {stream: handleChunk} {"Explain closures."}
show "Final:" response
```

The return value is always the fully accumulated response string, regardless of whether streaming is on.

---

## `search` — Web Search Grounding

`search` takes no value. Adding it to the config block tells the model to ground its response in live web search results:

```sesi
let response = model("gemini-3.1-flash-lite") {search} {"What is the weather in Tokyo right now?"}
show response
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
let result = model("gemini-3.8-flash") {thinkingLevel: "medium", max_tokens: 500} {"Analyze this document:" doc}

let scan = model("gemini-3.8-flash") {images: "receipt.png", thinkingLevel: "low"} {"Extract all line items as JSON."}
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

## `video()` Config Keys

The AI form is `video(model) {config} {prompt}`. It returns Base64 MP4 data;
save it with `write_file(path, value, "base64")`. The local, no-AI form is
documented in [VIDEO.md](../VIDEO.md).

| Key | Aliases | Type | Applies to | Description |
| --- | --- | --- | --- | --- |
| `ratio` | `aspectRatio`, `aspect_ratio` | `string` | Omni, Veo | Aspect ratio: `"16:9"` (default) or `"9:16"`. |
| `images` | `image` | `string \| array<string>` | Omni, Veo | Local reference-image path or paths. Veo currently uses the first path. |
| `task` | — | `string` | Omni | `text_to_video`, `image_to_video`, `reference_to_video`, or `edit`. Usually omit it. |
| `duration` | `durationSeconds`, `duration_seconds` | `number` | Veo | Clip length: `4`, `6`, or `8` seconds. |
| `resolution` | `size` | `string` | Veo | `"720p"` (default), `"1080p"`, or `"4k"`. Veo Lite does not support 4K. |
| `poll_interval` | `pollInterval` | `number` | Veo | Milliseconds between generation-status checks; defaults to `10000`. |
| `negative_prompt` | `negativePrompt` | `string` | Veo | Content to exclude from the generated clip. |
| `audio` | `generateAudio`, `generate_audio` | `bool` | Veo | Enable generated audio for model variants that support it. |

```sesi
let clip = video("veo-3.1-fast-generate-preview") {ratio: "9:16", duration: 8, resolution: "1080p", audio: true} {"A paper boat travels through a rain-filled neon street at night, slow tracking camera, no captions."}
write_file("generated_media/boat.mp4", clip, "base64")
```

For image-guided Gemini Omni Flash generation:

```sesi
let clip = video("gemini-omni-flash-preview") {images: "product.png", ratio: "16:9", task: "image_to_video"} {"Slow orbit around the product on a bright studio tabletop, soft natural shadows, no text overlays."}
write_file("generated_media/product.mp4", clip, "base64")
```

---

## Quick Reference

```sesi
// No config
let r = model("gemini-3.5-flash-lite") {"Hello"}

// thinkingLevel
let r = model("gemini-3.8-flash") {thinkingLevel: "low"} {"Summarize:" text}

// max_tokens
let r = model("gemini-3.7-flash") {max_tokens: 200} {"Explain this."}

// Vision input
let r = model("gemini-3.5-flash-lite") {images: "scan.png"} {"Transcribe all text."}

// Streaming to stdout
let r = model("gemini-3.1-flash-lite") {stream: true} {"Write a poem."}

// Streaming with callback
fn onChunk(chunk) { show chunk }
let r = model("gemini-3.1-flash-lite") {stream: onChunk} {"Tell a story."}

// No cache
let r = model("gemini-3.1-flash-lite") {cache: false} {"What's trending?"}

// Combined
let r = model("gemini-3.8-flash") {thinkingLevel: "medium", max_tokens: 500, images: "doc.png"} {"Analyze this."}

// image()
let img = image("gemini-2.5-flash-image") {ratio: "16:9", size: "1K"} {"A sunset over the ocean"}
write_image("output.png", img)

// AI video()
let clip = video("veo-3.1-fast-generate-preview") {ratio: "16:9", duration: 8} {"A kite flying above a beach at sunrise."}
write_file("clip.mp4", clip, "base64")
```

---
