# Speech and Language Tools

Sesi can speak, transcribe audio files, and translate text.

## Speak text

`speech()` sends text to your operating system's installed voice engine.

```sesi
speech("Hello from Sesi")
speech("Bonjour depuis Sesi", "Thomas")
```

The optional voice name is platform-specific. Sesi uses `say` on macOS, `System.Speech` on Windows, and `espeak-ng` on Linux.

Pass a Gemini TTS model as the third argument to return base64 audio instead:

```sesi
let audio = speech("Hello from Sesi", "Kore", "gemini-2.5-flash-preview-tts")

// Save the returned base64 WAV audio to disk
write_file("speech.wav", audio, "base64")
```

## Transcribe audio

`from_speech()` transcribes an audio file using `nodejs-whisper`.

```sesi
let transcript = from_speech("standup.mp3", "en")
show transcript
```

A downloaded model must be installed (`npx nodejs-whisper download base.en`).

Pass a Gemini model as the third argument to use it instead of Whisper.

## Translate text

`translate()` uses the `translate` package. Pass the destination language first and an optional source language second.

```sesi
let french = translate("Good morning", "fr", "en")
show french
```

Language values can use ISO codes or English names.

Pass a Gemini model as the fourth argument to use it instead of the `translate` package.
