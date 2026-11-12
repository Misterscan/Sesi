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

let clip = video("gemini-omni-1.1-flash") {ratio: "16:9"} {prompt}
output | write_file(clip, "base64")
show "Saved" output
```

See [the runnable example](examples/optional/37_ai_video_generation.sesi).

## Choose a model

| Use case | Model | Sesi API behavior |
| --- | --- | --- |
| Fast generation and image-guided clips | `gemini-omni-1.1-flash` | Calls Gemini's synchronous Interactions API. |

Use an available Gemini Omni video model. Availability, pricing, quotas, and
capabilities can change. Sesi no longer supports Veo generation: SDK 3.x
removed `generateVideos` for the Gemini Developer API. Non-Omni models are
rejected before a remote video request is sent, in both Node and browser
execution. Selecting `v1beta` does not restore the removed method.

## Sesi configuration

The configuration block accepts these aliases. Unknown keys are ignored by the
Sesi video runtime.

| Sesi key | Aliases | Applies to | Provider field / notes |
| --- | --- | --- | --- |
| `ratio` | `aspectRatio`, `aspect_ratio` | Omni | `"16:9"` (provider default) or `"9:16"`. |
| `images` | `image`, `imgs`, `imgRefs`, `img_refs` | Omni | A path or array of local reference-image paths. Sends every supplied image. |
| `task` | — | Omni | One of `text_to_video`, `image_to_video`, `reference_to_video`, or `edit`. Usually omit it and let the model infer the task. |

The former Veo controls (`duration`, `poll_interval`,
`negative_prompt`, and `audio`, including their aliases) no longer have an
effect. Express timing, exclusions, and desired sound in the Omni prompt.
Browser builds continue to forward `resolution`/`size` to Omni; the Node
runtime does not expose that control.

### Omni: image to video

```sesi
let clip = video("gemini-omni-1.1-flash") {images: "assets/product.png", ratio: "16:9", task: "image_to_video"} {"Bring this product shot to life on a clean studio tabletop. Slow orbiting camera move, soft natural shadows, no text overlays."}

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

For those Omni workflows, call the Interactions API directly with the current
`@google/genai` SDK. Retain an Omni interaction ID if you need
conversational edits; Sesi returns only the generated video data.

## Operational and safety notes

- Do not rely on multi-video prompting: reasoning across multiple video
  inputs is unsupported or can degrade results.
- Generated videos are SynthID watermarked. Gemini safety filters apply to the
  prompt and output, and regional restrictions apply to some people and media
  editing cases.
- Omni is preview-only. It does not currently support audio references, voice
  editing, video extension, or interpolation. Some uploaded-image/video editing
  functionality is unavailable in the EEA, Switzerland, and the UK.

## Official references

- [SDK 3.0.0 breaking changes](https://github.com/googleapis/js-genai/releases/tag/v3.0.0)
- [Generate and edit videos with Gemini Omni Flash](https://ai.google.dev/gemini-api/docs/omni)
