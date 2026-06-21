# GeneralUser GS Documentation

_GeneralUser GS: **version 2.0.3** (2/22/2026)_  
_Documentation: **revision 6** (2/23/2026)_  
**_by S. Christian Collins_**

Updates to this documentation will be published on [my GeneralUser GS web page](https://www.schristiancollins.com/generaluser) and viewable online at [GitHub](https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/README.md).

---

[TOC]

---

## About GeneralUser GS

[GeneralUser GS](https://www.schristiancollins.com/generaluser) is a [Roland GS](https://en.wikipedia.org/wiki/Roland_GS) and [General MIDI (GM)](https://en.wikipedia.org/wiki/General_MIDI) compatible SoundFont bank for composing, playing MIDI files, and retro gaming. It features 261 instrument presets and 13 drum kits, all while possessing a very low memory footprint (30.7 MB of RAM). GeneralUser GS features detailed instrument programming, making heavy use of SoundFont synthesis and modulator features. This can help it sound as good or better than SoundFonts 2–3 times its size but also makes GeneralUser GS more dependent on having a standards-compliant synth for proper playback of its instruments.

### Preset List

The following presets are included in GeneralUser GS. Banks are selected using MIDI CC0 followed by a preset change (PC) command to select the desired preset. The instrument presets can be accessed on all MIDI channels except for channel 10. The percussion presets can only be accessed on channel 10. I have duplicated the percussion presets to bank 120 within the instrument presets so that the drum kits can be accessed on other channels besides 10.

An instrument list file `GeneralUser GS.ins` is provided in Cakewalk format and can be found in the `support` folder included with GeneralUser GS. This list file is supported by many MIDI applications and will make it much easier to see what preset you are selecting.

## Instrument Presets

| _Bank:_ | _PC:_ | _Preset:_                | _Bank:_ | _PC:_  | _Preset:_            |
| :-----: | :---: | :----------------------- | :-----: | :----: | :------------------- |
|  **0**  | **0** | **Grand Piano**          |  **0**  | **6**  | **Harpsichord**      |
|   11    |       | Piano & Str.-Fade        |    8    |        | Coupled Harpsichord  |
|   12    |       | Bell Piano               |   11    |        | Harpsichord noVel    |
|  **0**  | **1** | **Bright Grand Piano**   |   12    |        | Coupled Harpsi noVel |
|   11    |       | Piano & Str.-Sus         |  **0**  | **7**  | **Clavinet**         |
|  **0**  | **2** | **Electric Grand Piano** |  **0**  | **8**  | **Celeste**          |
|  **0**  | **3** | **Honky-Tonk Piano**     |   11    |        | Tinkling Bells       |
|  **0**  | **4** | **Tine Electric Piano**  |  **0**  | **9**  | **Glockenspiel**     |
|    8    |       | Chorused Tine EP         |  **0**  | **10** | **Music Box**        |
|   11    |       | Tine & FM EPs            |   12    |        | Christmas Bells      |
|   12    |       | Bell Tine EP             |  **0**  | **11** | **Vibraphone**       |
|  **0**  | **5** | **FM Electric Piano**    |   11    |        | Vibraphone No Trem.  |
|    8    |       | Chorused FM EP           |  **0**  | **12** | **Marimba**          |
|   11    |       | Piano & FM EP            |  **0**  | **13** | **Xylophone**        |

| _Bank:_ | _PC:_  | _Preset:_            | _Bank:_ | _PC:_  | _Preset:_             |
| :-----: | :----: | :------------------- | :-----: | :----: | :-------------------- |
|  **0**  | **14** | **Tubular Bells**    |  **0**  | **24** | **Nylon Guitar**      |
|    8    |        | Church Bells         |    8    |        | Ukulele               |
|    9    |        | Carillon             |  **0**  | **25** | **Steel Guitar**      |
|   11    |        | Bell Tower           |    8    |        | 12-String Guitar      |
|  **0**  | **15** | **Dulcimer**         |   16    |        | Mandolin              |
|  **0**  | **16** | **Tonewheel Organ**  |  **0**  | **26** | **Jazz Guitar**       |
|    8    |        | Detuned Tnwl. Organ  |    8    |        | Hawaiian Guitar       |
|   11    |        | Tonewheel Org noVel  |  **0**  | **27** | **Clean Guitar**      |
|   12    |        | Detun Tnwl Org noVel |    8    |        | Chorused Clean Gt.    |
|  **0**  | **17** | **Percussive Organ** |   12    |        | Clean Guitar 2        |
|    8    |        | Detuned Perc. Organ  |  **0**  | **28** | **Muted Guitar**      |
|   11    |        | Percussive Org noVel |    8    |        | Funk Guitar           |
|   12    |        | Detun Perc Org noVel |  **0**  | **29** | **Overdrive Guitar**  |
|  **0**  | **18** | **Rock Organ**       |   11    |        | Wah Guitar (CC21)     |
|   11    |        | Rock Organ noVel     |  **0**  | **30** | **Distortion Guitar** |
|  **0**  | **19** | **Pipe Organ**       |    8    |        | Feedback Guitar       |
|    8    |        | Pipe Organ 2         |  **0**  | **31** | **Guitar Harmonics**  |
|   11    |        | Pipe Organ noVel     |    8    |        | Guitar Feedback       |
|   12    |        | Pipe Organ 2 noVel   |  **0**  | **32** | **Acoustic Bass**     |
|  **0**  | **20** | **Reed Organ**       |  **0**  | **33** | **Finger Bass**       |
|   11    |        | Reed Organ noVel     |  **0**  | **34** | **Pick Bass**         |
|  **0**  | **21** | **Accordion**        |  **0**  | **35** | **Fretless Bass**     |
|    8    |        | Italian Accordion    |  **0**  | **36** | **Slap Bass 1**       |
|  **0**  | **22** | **Harmonica**        |  **0**  | **37** | **Slap Bass 2**       |
|  **0**  | **23** | **Bandoneon**        |         |        |                       |

| _Bank:_ | _PC:_  | _Preset:_             | _Bank:_ | _PC:_  | _Preset:_           |
| :-----: | :----: | :-------------------- | :-----: | :----: | :------------------ |
|  **0**  | **38** | **Synth Bass 1**      |  **0**  | **49** | **Slow Strings**    |
|    1    |        | Synth Bass 101        |    1    |        | Slow Strings Mono   |
|    8    |        | Acid Bass             |   11    |        | Velo Strings        |
|   11    |        | Techno Bass           |   12    |        | Velo Strings Mono   |
|   12    |        | Mean Saw Bass         |  **0**  | **50** | **Synth Strings 1** |
|  **0**  | **39** | **Synth Bass 2**      |    8    |        | Synth Strings 3     |
|    8    |        | Beef FM Bass          |   11    |        | Synth Strings 4     |
|   11    |        | Pulse Bass            |  **0**  | **51** | **Synth Strings 2** |
|  **0**  | **40** | **Violin**            |   11    |        | Synth Strings 5     |
|  **0**  | **41** | **Viola**             |  **0**  | **52** | **Concert Choir**   |
|  **0**  | **42** | **Cello**             |    1    |        | Concert Choir Mono  |
|  **0**  | **43** | **Double Bass**       |  **0**  | **53** | **Voice Oohs**      |
|  **0**  | **44** | **Tremolo Strings**   |  **0**  | **54** | **Synth Voice**     |
|    1    |        | Tremolo Strings Mono  |  **0**  | **55** | **Orchestra Hit**   |
|  **0**  | **45** | **Pizzicato Strings** |  **0**  | **56** | **Trumpet**         |
|  **0**  | **46** | **Orchestral Harp**   |    1    |        | Trumpet 2           |
|  **0**  | **47** | **Timpani**           |  **0**  | **57** | **Trombone**        |
|  **0**  | **48** | **Fast Strings**      |    1    |        | Trombone 2          |
|    1    |        | Fast Strings Mono     |  **0**  | **58** | **Tuba**            |
|    8    |        | Orchestra Pad         |  **0**  | **59** | **Muted Trumpet**   |
|   12    |        | Full Orchestra        |  **0**  | **60** | **French Horns**    |
|   13    |        | Woodwind Choir        |    1    |        | Solo French Horn    |

| _Bank:_ | _PC:_  | _Preset:_          | _Bank:_ | _PC:_  | _Preset:_          |
| :-----: | :----: | :----------------- | :-----: | :----: | :----------------- |
|  **0**  | **61** | **Brass Section**  |  **0**  | **78** | **Whistle**        |
|    1    |        | Brass Section Mono |   11    |        | Whistlin'          |
|    8    |        | Brass Section 2    |  **0**  | **79** | **Ocarina**        |
|   11    |        | Brass Section 3    |  **0**  | **80** | **Square Lead**    |
|  **0**  | **62** | **Synth Brass 1**  |    1    |        | Square Wave        |
|    8    |        | Synth Brass 3      |    8    |        | Sine Wave          |
|  **0**  | **63** | **Synth Brass 2**  |   12    |        | Square Lead 2      |
|    8    |        | Synth Brass 4      |   13    |        | Square Lead 3      |
|  **0**  | **64** | **Soprano Sax**    |  **0**  | **81** | **Saw Lead**       |
|  **0**  | **65** | **Alto Sax**       |    1    |        | Saw Wave           |
|  **0**  | **66** | **Tenor Sax**      |    8    |        | Doctor Solo        |
|  **0**  | **67** | **Baritone Sax**   |   11    |        | Sawtooth Stab      |
|  **0**  | **68** | **Oboe**           |   12    |        | Saw Lead 2         |
|  **0**  | **69** | **English Horn**   |   13    |        | Saw Lead 3         |
|  **0**  | **70** | **Bassoon**        |  **0**  | **82** | **Synth Calliope** |
|  **0**  | **71** | **Clarinet**       |  **0**  | **83** | **Chiffer Lead**   |
|  **0**  | **72** | **Piccolo**        |  **0**  | **84** | **Charang**        |
|  **0**  | **73** | **Flute**          |  **0**  | **85** | **Solo Vox**       |
|  **0**  | **74** | **Recorder**       |  **0**  | **86** | **5th Saw Wave**   |
|  **0**  | **75** | **Pan Flute**      |  **0**  | **87** | **Bass & Lead**    |
|   24    |        | Tin Whistle        |  **0**  | **88** | **Fantasia**       |
|   25    |        | Tin Whistle Nm     |   11    |        | Harpsi Pad         |
|   26    |        | Tin Whistle Or     |   12    |        | Fantasia 2         |
|  **0**  | **76** | **Bottle Blow**    |   13    |        | Night Vision       |
|  **0**  | **77** | **Shakuhachi**     |         |        |                    |

| _Bank:_ |  _PC:_  | _Preset:_        | _Bank:_ |  _PC:_  | _Preset:_          |
| :-----: | :-----: | :--------------- | :-----: | :-----: | :----------------- |
|  **0**  | **89**  | **Warm Pad**     |  **0**  | **106** | **Shamisen**       |
|   11    |         | Solar Wind       |  **0**  | **107** | **Koto**           |
|   12    |         | Solar Wind 2     |    8    |         | Taisho Koto        |
|  **0**  | **90**  | **Polysynth**    |  **0**  | **108** | **Kalimba**        |
|  **0**  | **91**  | **Space Voice**  |  **0**  | **109** | **Bagpipes**       |
|  **0**  | **92**  | **Bowed Glass**  |  **0**  | **110** | **Fiddle**         |
|  **0**  | **93**  | **Metal Pad**    |  **0**  | **111** | **Shenai**         |
|  **0**  | **94**  | **Halo Pad**     |  **0**  | **112** | **Tinker Bell**    |
|  **0**  | **95**  | **Sweep Pad**    |  **0**  | **113** | **Agogo**          |
|  **0**  | **96**  | **Ice Rain**     |  **0**  | **114** | **Steel Drums**    |
|   11    |         | Mystery Pad      |  **0**  | **115** | **Wood Block**     |
|  **0**  | **97**  | **Soundtrack**   |    8    |         | Castanets          |
|  **0**  | **98**  | **Crystal**      |  **0**  | **116** | **Taiko Drum**     |
|    1    |         | Synth Mallet     |    8    |         | Concert Bass Drum  |
|   11    |         | Synth Chime      |  **0**  | **117** | **Melodic Tom**    |
|  **0**  | **99**  | **Atmosphere**   |    8    |         | Melodic Tom 2      |
|  **0**  | **100** | **Brightness**   |  **0**  | **118** | **Synth Drum**     |
|   11    |         | Bright Saw Stack |    8    |         | 808 Tom            |
|  **0**  | **101** | **Goblin**       |  **0**  | **119** | **Reverse Cymbal** |
|  **0**  | **102** | **Echo Drops**   |   11    |         | Cymbal Crash       |
|    2    |         | Echo Pan         |   12    |         | Tambourine         |
|  **0**  | **103** | **Star Theme**   |  **0**  | **120** | **Fret Noise**     |
|  **0**  | **104** | **Sitar**        |    1    |         | Cut Noise          |
|  **0**  | **105** | **Banjo**        |    2    |         | String Slap        |

| _Bank:_ |  _PC:_  | _Preset:_        | _Bank:_ |  _PC:_  | _Preset:_      |
| :-----: | :-----: | :--------------- | :-----: | :-----: | :------------- |
|  **0**  | **121** | **Breath Noise** |  **0**  | **125** | **Helicopter** |
|    1    |         | Fl. Key Click    |    1    |         | Car-Engine     |
|   11    |         | Filter Snap      |    2    |         | Car-Stop       |
|  **0**  | **122** | **Seashore**     |    3    |         | Car-Pass       |
|    1    |         | Rain             |    4    |         | Car-Crash      |
|    2    |         | Thunder          |    5    |         | Siren          |
|    3    |         | Wind             |    6    |         | Train          |
|    4    |         | Stream           |    7    |         | Jet Plane      |
|    5    |         | Bubbles          |    8    |         | Starship       |
|   11    |         | Howling Winds    |    9    |         | Burst Noise    |
|   12    |         | White Noise Wave |  **0**  | **126** | **Applause**   |
|  **0**  | **123** | **Birds**        |    1    |         | Laughing       |
|    1    |         | Dog              |    2    |         | Scream         |
|    2    |         | Horse Gallop     |    3    |         | Punch          |
|    3    |         | Bird 2           |    4    |         | Heart Beat     |
|  **0**  | **124** | **Telephone 1**  |    5    |         | Footsteps      |
|    1    |         | Telephone 2      |  **0**  | **127** | **Gun Shot**   |
|    2    |         | Door Creaking    |    1    |         | Machine Gun    |
|    3    |         | Door             |    2    |         | Lasergun       |
|    4    |         | Scratch          |    3    |         | Explosion      |
|    5    |         | Windchime        |   11    |         | Interference   |
|         |         |                  |   12    |         | Shooting Star  |

<div style="page-break-after: always"></div>

## Percussion Presets

| _Bank 120 or Ch.10:_ |                    |                    |
| :------------------- | ------------------ | ------------------ |
| 0: Standard 1 Kit    | 16: Power Kit      | 32: Jazz Kit       |
| 1: Standard 2 Kit    | 24: Electronic Kit | 40: Brush Kit      |
| 2: Standard 3 Kit    | 25: 808/909 Kit    | 48: Orchestral Kit |
| 8: Room Kit          | 26: Dance Kit      | 56: SFX Kit        |

See the included `Percussion Map.pdf` for a list of the sounds included in each percussion kit.

## Website and Contact

- You can find updates to GeneralUser GS and more of my virtual instruments at <https://www.schristiancollins.com>, where you can also contact me if you have any questions.

- If you’d like to be notified of new releases and updates to my virtual instruments, [follow me on X](https://twitter.com/SChrisCollins).

- For those upgrading from a pre-2.0 version of GeneralUser GS, [I have created a video](https://youtu.be/AtXvMz22y-M) showing some of the changes in GeneralUser GS version 2.0.

- If you have found a bug or issue, you can report it on the [GeneralUser GS GitHub page](https://github.com/mrbumpy409/GeneralUser-GS).

- If you would like to support my work, please consider [buying me a coffee](https://buymeacoffee.com/schristiancollins). :smiley:

Happy music-making!

**_-~Chris_**
