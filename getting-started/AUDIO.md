# Audio in Sesi

Sesi includes two optional standard-library modules for working with sound: `std/audio` for synthesis and playback, and `std/theory` for music-theory helpers. Neither requires any external installation — just `allow` the module and go.

---

## Importing the Modules

```
allow "std/audio" in with <alias>
allow "std/theory" in with <alias>
```

`allow` loads a module and binds it to any identifier you choose — the name after `with` is just a local namespace alias. These are all equally valid:

```sesi
allow "std/audio" in with Audio      // conventional
allow "std/audio" in with sound      // also fine
allow "std/audio" in with snd        // also fine
allow "std/audio" in with a          // also fine
```

The examples below use `Audio` and `Music` as readable conventions, but you are free to pick any name that fits your script.

---

## std/audio — Sound Synthesis & Playback

### Beep — `Audio.beep`

```
Audio.beep(frequency, duration)
```

Play a simple sine-wave tone. `frequency` is in Hz; `duration` is in milliseconds.

```sesi
allow "std/audio" in with Audio

Audio.beep(440, 200)   // 440 Hz (concert A) for 200 ms
Audio.beep(880, 100)   // one octave up, shorter
```

---

### Play a Note — `Audio.play`

```
Audio.play(note, duration, options?)
```

Play a musical note by name (e.g. `"C4"`, `"A#3"`, `"Bb5"`). `options` accepts ADSR, volume, and panning.

```sesi
allow "std/audio" in with Audio

Audio.play("C4", 500)
Audio.play("E4", 500)
Audio.play("G4", 500)   // C-major chord, played in sequence
```

---

### Synthesize to Base64 — `Audio.synth`

```
Audio.synth(frequency_or_note, duration, type, options?) -> string
```

Returns a base64-encoded WAV string instead of playing audio. Useful for passing audio data to another function or writing it to a file manually.

Supported `type` values: `"sine"`, `"square"`, `"saw"`, `"triangle"`, `"noise"`, `"kick"`, `"snare"`, `"hat"`, `"clap"`.

```sesi
allow "std/audio" in with Audio

let wav_b64 = Audio.synth(440, 1000, "square")
print "WAV data length:" len(wav_b64)
```

---

### Save a Tone — `Audio.save`

```
Audio.save(path, frequency_or_note, duration, type, options?)
```

Synthesize a tone and write it directly to a WAV file.

```sesi
allow "std/audio" in with Audio

// Save a 2-second sine-wave A4 note with fade-in and fade-out
Audio.save("tone.wav", "A4", 2000, "sine", {"attack": 50, "release": 500})
```

---

### Save a Sequence — `Audio.sequence`

```
Audio.sequence(path, notes_array, type, options?)
```

Save a multi-note sequence to a single WAV file. `notes_array` can be:

- An array of note strings: `["C4", "D4", "E4"]`
- An array of note objects with per-note control
- Pre-rendered SF2 note objects (see `Audio.sf2` below)

**Note object fields:**

| Field    | Type     | Description                                  |
| -------- | -------- | -------------------------------------------- |
| `note`   | `string` | Note name (e.g. `"C4"`)                      |
| `ms`     | `number` | Duration in milliseconds                     |
| `vol`    | `number` | Volume `0.0–1.0` (default `1.0`)             |
| `pan`    | `number` | Stereo pan `-1.0` (left) to `1.0` (right)    |
| `cutoff` | `number` | Low-pass filter cutoff frequency in Hz       |

```sesi
allow "std/audio" in with Audio

let song = [
  {"note": "C4", "ms": 500, "vol": 0.8},
  {"note": "E4", "ms": 500, "pan": -0.5},
  {"note": "G4", "ms": 1000, "cutoff": 5000}
]

Audio.sequence("song.wav", song, "triangle")
print "Saved song.wav"
```

---

### Mix Multiple Tracks — `Audio.mix`

```
Audio.mix(path, tracks_array, type, options?)
```

Mix several tracks into a single stereo WAV. `tracks_array` is an array of note arrays — each inner array is one track. The mixer supports ADSR envelopes, LPF filtering (`cutoff`), stereo `pan`, and soft-clipping saturation (`saturate`).

```sesi
allow "std/audio" in with Audio

let melody = [
  {"note": "C4", "ms": 500},
  {"note": "E4", "ms": 500},
  {"note": "G4", "ms": 500}
]

let bass = [
  {"note": "C2", "ms": 1500, "vol": 0.7}
]

Audio.mix("mix.wav", [melody, bass], "sine", {"saturate": 1.2})
print "Saved mix.wav"
```

---

### SoundFont Instruments — `Audio.sf2`

```
Audio.sf2(path, options?) -> fn(note, duration)
```

Load a SoundFont (`.sf2`) file and return an **instrument function** bound to a specific program/patch. Call that function with a note and duration to produce a Sesi-native note object that `Audio.mix` or `Audio.sequence` will batch-render via FluidSynth.

**Options:**

| Field        | Type     | Description                            |
| ------------ | -------- | -------------------------------------- |
| `instrument` | `number` | GM program number (default `0` = piano)|
| `channel`    | `number` | MIDI channel (default `0`)             |
| `gain`       | `number` | Output gain multiplier (default `1.0`) |

```sesi
allow "std/audio" in with Audio

let piano      = Audio.sf2("GeneralUser-GS.sf2", {"instrument": 0,  "gain": 1.5})
let string_pad = Audio.sf2("GeneralUser-GS.sf2", {"instrument": 49})

let lead = [piano("C4", 500), piano("E4", 500), piano("G4", 500)]
let pad  = [string_pad("C3", 1500)]

Audio.mix("full_mix.wav", [lead, pad], "sine")
print "Saved full_mix.wav"
```

---

### Drum Synthesis

The `"kick"`, `"snare"`, `"hat"`, and `"clap"` waveform types use native physical modeling, so no SoundFont is required for basic drum tracks:

```sesi
allow "std/audio" in with Audio

let kick  = {"note": "C1", "ms": 500, "type": "kick"}
let snare = {"note": "C4", "ms": 500, "type": "snare"}
let hat   = {"note": "G8", "ms": 250, "type": "hat", "pan": 0.3}

Audio.sequence("drums.wav", [kick, snare, hat], "kick")
```

---

## std/theory — Music Theory Helpers

`std/theory` removes the manual math from algorithmic composition. All functions return plain arrays of note-name strings compatible with every `Audio` function above.

```sesi
allow "std/theory" in with Music
```

---

### Generate a Chord — `Music.chord`

```
Music.chord(root, type) -> array<string>
```

Return the notes of a chord rooted at `root`.

**Supported types:** `"M"`, `"m"`, `"dim"`, `"aug"`, `"7"`, `"M7"`, `"m7"`, `"sus2"`, `"sus4"`

```sesi
allow "std/theory" in with Music

let c_maj7  = Music.chord("C4", "M7")  // ["C4", "E4", "G4", "B4"]
let a_minor = Music.chord("A3", "m")   // ["A3", "C4", "E4"]

print c_maj7
```

---

### Generate a Scale — `Music.scale`

```
Music.scale(root, type) -> array<string>
```

Return all notes of a scale starting at `root`.

**Supported types:** `"major"`, `"minor"`, `"dorian"`, `"phrygian"`, `"lydian"`, `"mixolydian"`, `"locrian"`

```sesi
allow "std/theory" in with Music

let a_minor = Music.scale("A3", "minor")
print a_minor
```

---

### Transpose Notes — `Music.transpose`

```
Music.transpose(notes, semitones) -> array<string>
```

Shift a note or an array of notes up (positive) or down (negative) by the given number of semitones.

```sesi
allow "std/theory" in with Music

let c_maj7   = Music.chord("C4", "M7")          // ["C4", "E4", "G4", "B4"]
let f_maj7   = Music.transpose(c_maj7, 5)        // ["F4", "A4", "C5", "E5"]
let b_maj7   = Music.transpose(c_maj7, -1)       // ["B3", "D#4", "F#4", "A#4"]

print f_maj7
```

---

## Combining std/audio and std/theory

```sesi
allow "std/audio"  in with Audio
allow "std/theory" in with Music

// Build a progression from music theory
let c_chord = Music.chord("C4", "M")    // ["C4", "E4", "G4"]
let g_chord = Music.chord("G3", "M7")   // ["G3", "B3", "D4", "F4"]

// Sequence each chord
fn chord_notes(notes, duration) {
  let out = []
  let i = 0
  while i < len(notes) {
    push(out, {"note": notes[i], "ms": duration})
    i = i + 1
  }
  return out
}

let c_track = chord_notes(c_chord, 600)
let g_track = chord_notes(g_chord, 600)

Audio.sequence("c_chord.wav", c_track, "sine")
Audio.sequence("g_chord.wav", g_track, "triangle")
print "Chord files saved."
```

---

## Error Handling

Wrap audio I/O in `try/catch` to guard against missing files or unsupported formats:

```sesi
allow "std/audio" in with Audio

try {
  Audio.save("output.wav", "C4", 1000, "sine")
  print "Saved successfully"
} catch (err) {
  print "Audio error:" err
}
```

---

## Quick Reference

```sesi
allow "std/audio"  in with Audio
allow "std/theory" in with Music

// Beep
Audio.beep(440, 200)

// Play a note
Audio.play("A4", 500)

// Synth to base64
let b64 = Audio.synth("C4", 1000, "square")

// Save a single tone
Audio.save("tone.wav", "C4", 1000, "sine", {"attack": 30, "release": 200})

// Save a sequence
Audio.sequence("seq.wav", [{"note": "C4", "ms": 500}, {"note": "E4", "ms": 500}], "triangle")

// Mix tracks
Audio.mix("mix.wav", [[{"note": "C4", "ms": 500}], [{"note": "C2", "ms": 500}]], "sine")

// SoundFont instrument
let piano = Audio.sf2("font.sf2", {"instrument": 0})
Audio.mix("song.wav", [[piano("C4", 500), piano("G4", 500)]], "sine")

// Music theory
let scale  = Music.scale("C4", "major")
let chord  = Music.chord("A3", "m7")
let moved  = Music.transpose(chord, 7)
```

---
