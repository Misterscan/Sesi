# Speech Tools

Sesi can speak and transcribe audio files.

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

`from_speech()` transcribes an audio file through OpenAI by default. Set `OPENAI_API_KEY`.

```sesi
let transcript = from_speech("standup.mp3", "en")
let openai = from_speech("standup.mp3", "en", "gpt-4o-mini-transcribe")
let gemini = from_speech("standup.mp3", "en", "gemini-3.1-flash-lite")
show transcript
```

The default model is `gpt-transcribe`. To use Gemini, pass a Gemini model as the third argument and set `GEMINI_API_KEY`.
