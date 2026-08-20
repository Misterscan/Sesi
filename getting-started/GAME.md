# Building Browser Games in Sesi

`std/game` is Sesi's data-driven 2D game engine. It creates Canvas games that run in a modern browser without requiring JavaScript callbacks in your Sesi code.

You describe the game using:

- a canvas configuration;
- entities such as rectangles, circles, sprites, and text;
- keyboard controls, velocity, screen bounds, and collision settings;
- declarative rules for scoring, spawning, destroying, changing entities, and playing sounds.

The finished game can be exported as an HTML file or served from a local preview server.

---

## Importing the Module

```sesi
allow "std/game" in as Game
```

The module exports `Game.create(config)`. The returned game object provides `add`, `rule`, `build`, and `run` methods.

---

## Creating a Game

Every game starts with a positive canvas width and height:

```sesi
allow "std/game" in as Game

let game = Game.create({
  "title": "My First Game",
  "width": 640,
  "height": 360,
  "background": "#101426"
})
```

### Game configuration

| Field        | Type     | Required | Description |
| ------------ | -------- | -------- | ----------- |
| `width`      | `number` | Yes      | Canvas width in pixels; must be greater than zero |
| `height`     | `number` | Yes      | Canvas height in pixels; must be greater than zero |
| `title`      | `string` | No       | Browser page title; defaults to `"Sesi Game"` |
| `background` | `string` | No       | Canvas CSS color; defaults to black |
| `input`      | `object` | No       | Named keyboard action bindings |
| `scores`     | `object` | No       | Initial score values shown in the HUD |

The game definition is held in memory until you call `build` or `run`.

---

## Adding Entities

Use `game.add(entity)` to add an object to the scene. Entity IDs must be unique.

```sesi
game.add({
  "id": "player",
  "shape": "rect",
  "x": 40,
  "y": 280,
  "width": 24,
  "height": 24,
  "color": "#64e8ff"
})
```

`game.add` returns the game object, so calls can be chained if desired.

### Common entity fields

| Field      | Type              | Description |
| ---------- | ----------------- | ----------- |
| `id`       | `string`          | Required unique entity ID |
| `shape`    | `string`          | `"rect"`, `"circle"`, `"sprite"`, or `"text"`; defaults to `"rect"` |
| `x`, `y`   | `number`          | Position in canvas pixels |
| `color`    | `string`          | CSS fill color |
| `opacity`  | `number`          | Drawing opacity from `0` to `1` |
| `vx`, `vy` | `number`          | Horizontal and vertical speed in pixels per second |
| `tags`     | `array<string>`   | Labels used by collision rules |
| `collider` | `bool`            | Enables collision checks when `true` |
| `bounds`   | `string`          | `"clamp"`, `"wrap"`, or `"bounce"` |
| `control`  | `object`          | Keyboard movement configuration |

### Rectangles

Rectangles require positive `width` and `height` values:

```sesi
game.add({
  "id": "wall",
  "shape": "rect",
  "x": 200,
  "y": 120,
  "width": 160,
  "height": 18,
  "color": "#59627a",
  "collider": true
})
```

### Circles

Circles require a positive `radius`. Their `x` and `y` values identify the upper-left corner of their collision box.

```sesi
game.add({
  "id": "ball",
  "shape": "circle",
  "x": 60,
  "y": 60,
  "radius": 12,
  "color": "#ff5f8f",
  "vx": 130,
  "vy": 110,
  "bounds": "bounce",
  "collider": true
})
```

### Sprites

Sprites require `width`, `height`, and an `asset` path or URL:

```sesi
game.add({
  "id": "ship",
  "shape": "sprite",
  "x": 40,
  "y": 260,
  "width": 48,
  "height": 48,
  "asset": "assets/ship.png"
})
```

Local sprite files are embedded as Base64 data URLs when the entity is added. Remote `http`, `https`, and existing `data` URLs remain external.

### Text

Text entities use `text` and an optional CSS `font` value:

```sesi
game.add({
  "id": "message",
  "shape": "text",
  "x": 20,
  "y": 32,
  "text": "Avoid the orb!",
  "font": "bold 20px sans-serif",
  "color": "white"
})
```

---

## Keyboard Controls

Define reusable input actions in `Game.create`:

```sesi
let game = Game.create({
  "width": 640,
  "height": 360,
  "input": {
    "left": ["ArrowLeft", "a"],
    "right": ["ArrowRight", "d"],
    "up": ["ArrowUp", "w"],
    "down": ["ArrowDown", "s"]
  }
})
```

Attach those actions to an entity with `control`:

```sesi
game.add({
  "id": "player",
  "shape": "rect",
  "width": 24,
  "height": 24,
  "bounds": "clamp",
  "control": {
    "left": "left",
    "right": "right",
    "up": "up",
    "down": "down",
    "speed": 250
  }
})
```

The direction fields default to the action names `left`, `right`, `up`, and `down`, so the shorter form is usually enough:

```sesi
"control": {"speed": 250}
```

---

## Screen Bounds

The `bounds` field determines what happens when an entity reaches the canvas edge:

| Value      | Behavior |
| ---------- | -------- |
| `"clamp"` | Keeps the entity inside the canvas |
| `"wrap"`  | Moves the entity to the opposite side |
| `"bounce"`| Reverses its velocity and keeps it inside the canvas |

Entities without a recognized `bounds` value are not automatically repositioned.

---

## Collisions

Collision detection uses axis-aligned bounding boxes. Both entities must set `"collider": true`.

```sesi
game.add({
  "id": "player",
  "shape": "rect",
  "width": 24,
  "height": 24,
  "collider": true
})

game.add({
  "id": "enemy1",
  "shape": "circle",
  "radius": 12,
  "collider": true,
  "tags": ["enemy"]
})
```

Tags let one rule match several entities.

---

## Rules

Use `game.rule(rule)` to respond to events. Supported events are:

- `"collision"` — two colliders overlap;
- `"key"` — a keyboard key is pressed;
- `"timer"` — a time interval elapses;
- `"bounds"` — an entity crosses a canvas edge.

Supported actions are `destroy`, `spawn`, `set`, `addScore`, `reverseVelocity`, and `sound`.

### Collision rules

`source` identifies the entity receiving the event. `targetRef` optionally matches the other entity by ID or tag.

```sesi
game.rule({
  "event": "collision",
  "source": "player",
  "targetRef": "enemy",
  "action": "addScore",
  "score": "score",
  "value": -1
})
```

Actions normally affect the source. Set `"target": "other"` to affect the other collider:

```sesi
game.rule({
  "event": "collision",
  "source": "player",
  "targetRef": "coin",
  "target": "other",
  "action": "destroy"
})
```

### Key rules

For key events, `source` is an entity ID or tag and `targetRef` is the browser key name:

```sesi
game.rule({
  "event": "key",
  "source": "player",
  "targetRef": " ",
  "action": "set",
  "property": "color",
  "value": "#ffe66d"
})
```

### Timer rules

Timer rules use `every` milliseconds. They are best suited to global actions such as spawning, changing scores, or playing sounds.

```sesi
game.rule({
  "event": "timer",
  "every": 2000,
  "action": "spawn",
  "entity": {
    "id": "fallingStar",
    "shape": "circle",
    "x": 300,
    "y": 0,
    "radius": 6,
    "color": "gold",
    "vy": 100,
    "bounds": "wrap"
  }
})
```

Spawned entities are runtime copies. If a repeating timer needs multiple simultaneous entities, give the spawned definition gameplay behavior that does not depend on unique rule references.

### Bounds rules

```sesi
game.rule({
  "event": "bounds",
  "source": "player",
  "action": "addScore",
  "score": "escapes",
  "value": 1
})
```

### Sound rules

Without a `sound` URL, the engine creates a short Web Audio oscillator effect:

```sesi
game.rule({
  "event": "collision",
  "source": "ball",
  "targetRef": "wall",
  "action": "sound",
  "frequency": 520,
  "duration": 100
})
```

Set `sound` to a remote or data URL to play an audio clip:

```sesi
game.rule({
  "event": "collision",
  "source": "player",
  "targetRef": "coin",
  "action": "sound",
  "sound": "https://example.com/coin.wav"
})
```

Browsers may delay sound until the player first interacts with the page.

---

## Scores and the HUD

Initial scores are defined in the game configuration:

```sesi
let game = Game.create({
  "width": 640,
  "height": 360,
  "scores": {"score": 0, "lives": 3}
})
```

Use `addScore` to change them:

```sesi
game.rule({
  "event": "collision",
  "source": "player",
  "targetRef": "coin",
  "action": "addScore",
  "score": "score",
  "value": 10
})
```

Scores are displayed automatically in the upper-left HUD.

---

## Exporting a Standalone Game

Use `game.build(path)` to create an HTML file:

```sesi
game.build("my-game.html")
show "Built my-game.html"
```

The output contains the game definition and Canvas runtime. Embedded sprite assets travel with the HTML file; remote URLs still require network access.

The output path must end in `.html` and must pass Sesi's normal filesystem safety checks.

---

## Running a Local Preview

`game.run(options?)` starts a localhost server and can open the game in your browser:

```sesi
let preview = game.run({"port": 0, "open": true})
show "Playing at" preview.url()

input("Press Enter to stop the preview...")
preview.stop()
```

| Option | Type     | Default | Description |
| ------ | -------- | ------- | ----------- |
| `port` | `number` | `0`     | Local port; `0` asks the operating system for an available port |
| `open` | `bool`   | `true`  | Opens the preview URL in the default browser |

Preview servers are disabled in Sesi safe mode because they open a local network listener and browser. Run the script in local mode:

```bash
sesi -l game.sesi
```

Call `preview.stop()` when the preview is no longer needed.

---

## Complete Example

```sesi
allow "std/game" in as Game

let game = Game.create({
  "title": "Sesi Dodge",
  "width": 640,
  "height": 360,
  "background": "#101426",
  "input": {
    "left": ["ArrowLeft", "a"],
    "right": ["ArrowRight", "d"],
    "up": ["ArrowUp", "w"],
    "down": ["ArrowDown", "s"]
  },
  "scores": {"score": 0}
})

game.add({
  "id": "player",
  "shape": "rect",
  "x": 300,
  "y": 300,
  "width": 24,
  "height": 24,
  "color": "#64e8ff",
  "bounds": "clamp",
  "collider": true,
  "control": {"speed": 250}
})

game.add({
  "id": "orb",
  "shape": "circle",
  "x": 60,
  "y": 60,
  "radius": 12,
  "color": "#ff5f8f",
  "vx": 130,
  "vy": 110,
  "bounds": "bounce",
  "collider": true,
  "tags": ["hazard"]
})

game.rule({
  "event": "collision",
  "source": "player",
  "targetRef": "hazard",
  "action": "addScore",
  "score": "score",
  "value": -1
})

game.build("sesi-dodge.html")
show "Built sesi-dodge.html — open it in a browser to play."
```

The same example is available at `examples/main/37_game_engine.sesi`.

---

## Validation and Common Errors

The engine reports errors before export or preview when it finds invalid definitions:

| Error | Cause |
| ----- | ----- |
| Game width/height must be positive | Missing, zero, negative, or non-numeric canvas size |
| Duplicate game entity ID | Two entities use the same `id` |
| Unsupported entity shape | `shape` is not `rect`, `circle`, `sprite`, or `text` |
| Asset was not found | A local sprite path does not exist or is not readable |
| Rule source/target does not match | A collision or bounds rule references an unknown entity ID/tag |
| Preview is disabled in safe mode | `game.run` was called without local mode |

Build definitions incrementally and keep entity IDs descriptive. Tags are preferable when one rule should apply to several entities.

---

## Current Scope

The first version focuses on small arcade-style Canvas games. It does not currently include WebGL, multiplayer networking, tile maps, cameras, sprite animation state machines, an editor, or user-authored JavaScript callbacks.

Game logic is intentionally declarative: the browser runtime owns frame updates while the Sesi script supplies entities and rules.
