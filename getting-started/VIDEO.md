# Local Video in Sesi

Use `video()` to create a video from an ordered list of image frames or to
transcode an existing media file. This is the no-AI form:

```sesi
video(input, output, options?) -> string
```

It uses the local `ffmpeg` command-line tool, requires FFmpeg on your `PATH`,
and is unavailable in safe mode. The function returns the output path.

---

## Image Frames to Video

Pass frame paths in their intended display order. The output directory is
created when needed.

```sesi
let frames = [
  "frames/001.png",
  "frames/002.png",
  "frames/003.png"
]

let output = video(frames, "build/preview.mp4", {
  fps: 24,
  width: 1280,
  height: 720,
  codec: "libx264",
  crf: 23,
  preset: "medium"
})

show "Saved" output
```

## Transcode a Video

Pass an existing media-file path as the input to convert it to another format
or apply output settings.

```sesi
let output = video("recording.mov", "build/recording.mp4", {
  fps: 30,
  width: 1920,
  codec: "libx264",
  crf: 20
})

show "Saved" output
```

## Add or Remove Audio

Use `audio` to attach a local audio file. Sesi maps the first video stream and
the supplied audio stream, then stops when the shorter stream ends. Use `mute`
to omit all audio instead.

```sesi
let output = video("source.mp4", "build/with-music.mp4", {
  audio: "music.wav",
  codec: "libx264",
  crf: 21
})

let silent = video("source.mp4", "build/silent.mp4", {mute: true})
```

## Options

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `fps` | `number` | `30` | Output frame rate, from `1` to `240`. |
| `width` | `number` | source width | Output width, up to `8192`. If only one dimension is set, the other is calculated and kept even. |
| `height` | `number` | source height | Output height, up to `8192`. If only one dimension is set, the other is calculated and kept even. |
| `codec` | `string` | `libx264` for MP4; `libvpx-vp9` for WebM | FFmpeg video encoder. |
| `crf` | `number` | `23` | Encoder quality value from `0` to `63`; lower generally means higher quality and larger files. |
| `pixel_format` | `string` | `yuv420p` | Output pixel format. |
| `preset` | `string \| false` | `medium` | x264/x265 encoder speed preset; set to `false` to omit it. |
| `audio` | `string` | none | Local audio-file path to add to the output. |
| `mute` | `bool` | `false` | Remove audio; takes precedence over `audio`. |
| `overwrite` | `bool` | `true` | Set to `false` to fail instead of overwriting an existing output file. |
| `timeout` | `number` | none | Maximum FFmpeg runtime in milliseconds, from `1` to `86400000`. |

`.mp4`, `.m4v`, and `.mov` outputs are prepared for progressive playback.
For WebM, use a `.webm` output path; Sesi selects `libvpx-vp9` unless you set a
different codec.

## Check FFmpeg

`ffmpeg()` accepts a structured argument array and returns process details. It
can be used to check whether FFmpeg is available before rendering:

```sesi
let installed = !(["-version"] | ffmpeg | is_null)

if installed {
  show "FFmpeg is ready."
} else {
  show "Install FFmpeg and ensure it is available on PATH."
}
```