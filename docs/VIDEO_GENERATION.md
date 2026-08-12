# Video generation

Sesi can generate an MP4 with the Gemini API through its AI form of `video()`:

```sesi
video(model) {config} {prompt}
```

The expression returns the MP4 as a Base64 string. Write it with
`write_file(path, value, "base64")`. This is different from the local-media
form, `video(input, output, options?)`, which uses FFmpeg to create or
transcode a video.

Keep the configuration and prompt contents on one physical line. In Sesi,
newlines inside these `video()` blocks are statement separators.

Video generation is a remote, billed operation. It requires `GEMINI_API_KEY`,
can take from seconds to minutes, and should be written to disk immediately
with failure handling.

```sesi
let output = "generated_media/clip.mp4"
let prompt = "A tiny glass robot walks through a rain-soaked neon garden, cinematic tracking shot, soft rain and distant city ambience"

let clip = video("gemini-omni-flash-preview") {ratio: "16:9"} {prompt}
output | write_file(clip, "base64")
show "Saved" output
```

See [the runnable example](examples/optional/37_ai_video_generation.sesi).

## Choose a model

| Use case | Model | Sesi API behavior |
| --- | --- | --- |
| Fast generation and image-guided clips | `gemini-omni-flash-preview` | Calls Gemini's synchronous Interactions API. |
| Cinematic Veo output, including 4K | `veo-3.1-generate-preview` | Starts and polls a long-running Veo operation. |
| Lower-latency Veo preview | `veo-3.1-fast-generate-preview` | Same Veo operation workflow. |
| Cost-conscious Veo preview | `veo-3.1-lite-generate-preview` | Same workflow; 4K and video extension are unavailable. |

All of these model IDs are previews, so availability, pricing, quotas, and
capabilities can change. Do not use the deprecated Veo 3.0 or Veo 2 IDs in new
work.

## Sesi configuration

The configuration block accepts these aliases. Unknown keys are ignored by the
Sesi video runtime.

| Sesi key | Aliases | Applies to | Gemini API field / notes |
| --- | --- | --- | --- |
| `ratio` | `aspectRatio`, `aspect_ratio` | Omni, Veo | `"16:9"` (default) or `"9:16"`. |
| `images` | `image` | Omni, Veo | A path or array of local reference-image paths. Omni sends every supplied image; the current Veo wrapper sends the first only. |
| `task` | — | Omni | One of `text_to_video`, `image_to_video`, `reference_to_video`, or `edit`. Usually omit it and let the model infer the task. |
| `duration` | `durationSeconds`, `duration_seconds` | Veo | `4`, `6`, or `8` seconds. Use `8` for 1080p/4K. |
| `resolution` | `size` | Veo | `"720p"` (default), `"1080p"`, or `"4k"`; Lite does not support 4K. |
| `poll_interval` | `pollInterval` | Veo | Milliseconds between operation checks; defaults to 10,000 and is clamped to at least 100. |
| `negative_prompt` | `negativePrompt` | Veo only | Passed to Veo. Omni does not support this control; put exclusions in the prompt instead. |
| `audio` | `generateAudio`, `generate_audio` | Veo only | Passed through for model variants that support it. Veo 3.1 natively generates audio, and Omni generates video with audio. |

### Veo: text to video

```sesi
let clip = video("veo-3.1-generate-preview") {ratio: "9:16", duration: 8, resolution: "1080p", poll_interval: 10000} {"Vertical tracking shot of a red paper boat drifting down a rain-filled city gutter at night; neon reflections, shallow depth of field, gentle rainfall and distant traffic ambience."}

"generated_media/veo.mp4" | write_file(clip, "base64")
```

Veo 3.1 produces 24-fps video with native audio. Higher resolutions cost more
and typically take longer. Veo requests are asynchronous in Gemini; Sesi polls
them until complete before returning the Base64 MP4.

### Omni: image to video

```sesi
let clip = video("gemini-omni-flash-preview") {images: "assets/product.png", ratio: "16:9", task: "image_to_video"} {"Bring this product shot to life on a clean studio tabletop. Slow orbiting camera move, soft natural shadows, no text overlays."}

"generated_media/product.mp4" | write_file(clip, "base64")
```

Omni takes text or text plus local images and returns the completed result from
the Interactions API. It is well suited to quick iterations and image-guided
generation.

## Prompting

State the subject, setting, action, visual style, camera movement, lighting,
mood, and desired sound when it matters. Describe audio directly rather than
assuming a soundtrack or dialogue.

```text
Wide shot: a brass automaton repairs a small sailboat in a foggy harbor at dawn.
The camera slowly dollies from the dock toward the boat. Warm lantern light,
muted teal fog, hand-crafted stop-motion texture. Wood creaks, water laps, and
the automaton quietly hums; no captions or logos.
```

For Omni, express negatives in normal prompt language, such as “no captions or
logos.” Its API does not support a separate negative-prompt parameter.

## Current Sesi scope

Sesi intentionally exposes the common generate-from-text and generate-from-image
paths. The following Gemini capabilities are not represented by `video()` yet:

- Omni stateful editing with `previous_interaction_id`, uploaded-video editing,
  URI delivery, and background/stream controls.
- Veo video extension, first/last-frame interpolation, and up to three Veo
  reference images.
- Veo controls such as seed and person-generation settings.

For those workflows, call the Gemini API directly with the current
`@google/genai` SDK. In particular, retain an Omni interaction ID if you need
conversational edits; Sesi returns only the generated video data.

## Operational and safety notes

- Download or save a Veo result promptly. Gemini documents a two-day server
  retention period for generated Veo videos.
- Do not rely on multi-video prompting: both model guides warn that reasoning
  across multiple video inputs is unsupported or can degrade results.
- Generated videos are SynthID watermarked. Gemini safety filters apply to the
  prompt and output, and regional restrictions apply to some people and media
  editing cases.
- Omni is preview-only. It does not currently support audio references, voice
  editing, video extension, or interpolation. Some uploaded-image/video editing
  functionality is unavailable in the EEA, Switzerland, and the UK.

## Official references

- [Generate videos with Veo 3.1](https://ai.google.dev/gemini-api/docs/veo)
- [Generate and edit videos with Gemini Omni Flash](https://ai.google.dev/gemini-api/docs/omni)
