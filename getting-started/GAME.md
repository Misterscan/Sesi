# 3D Games with `std/game`

`std/game` is Sesi's imperative 3D desktop game API. It runs Sesi once inside an isolated Electron window, uses Babylon.js for rendering and GUI, and optionally uses Havok for physics. Meshes, vectors, cameras, materials, and controls are live native objects: changing `player.position.x` changes the object rendered by the engine.

The heavy desktop dependencies are kept out of core Sesi. Install the optional engine package in the project that contains your game:

```bash
npm install @misterscan/sesi-game
```

Run game scripts in local mode. Safe mode intentionally refuses to launch Electron or build an application:

```bash
sesi -l examples/main/38_game_3d_arcade.sesi
```

## First scene

```sesi
allow "std/game" in as Game

let game = Game.create({
  title: "My First 3D Game",
  width: 1280,
  height: 720,
  resizable: true,
  background: "#07111f"
})

let scene = game.create_scene("main")
let camera = scene.orbit_camera("camera", {
  alpha: -1.57,
  beta: 1.0,
  radius: 12,
  target: Game.vec3(0, 1, 0)
})
let sun = scene.hemispheric_light("sun", {intensity: 0.9})
let material = scene.pbr_material("player_material", {
  color: Game.color("#36d1ff"),
  metallic: 0.15,
  roughness: 0.45
})
let player = scene.box("player", {position: Game.vec3(0, 1, 0)})
player.material = material

fn update(dt) {
  player.rotation.y = player.rotation.y + dt
}

game.on_update(update)
game.run()
```

## Coordinate and timing conventions

- Left-handed coordinates, Y up: `+X` is right and `+Z` is forward.
- At zero yaw, a chase camera belongs behind the player on `-Z`; positive Y rotation turns toward `+X` (right).
- Distances are meters.
- Rotations are radians.
- The default window is 1280×720 and resizable.
- WebGPU is preferred; WebGL2 is the automatic fallback.
- Fixed updates run at 1/60 second by default, with at most five catch-up steps.
- Frame deltas are clamped and ticks never overlap.

`game.on_start` and `game.on_stop` may receive asynchronous Sesi functions. Frame, fixed-step, input, GUI, and collision callbacks must be synchronous. A callback failure pauses the loop and displays a selectable error overlay.

## Module exports

```sesi
allow "std/game" in with {
  VERSION,
  create,
  vec2,
  vec3,
  quat,
  color
}
```

- `VERSION` — Sesi game API version.
- `create(config?)` — creates the process's only game/window.
- `vec2(x?, y?)` — mutable two-component vector.
- `vec3(x?, y?, z?)` — mutable three-component vector.
- `quat(x?, y?, z?, w?)` — mutable quaternion.
- `color(r?, g?, b?, a?)` — mutable color. A hex string such as `"#ff8844"` is also accepted.

Creating a second game before disposing the first raises `GameStateError`.

## Game configuration and lifecycle

`Game.create(config?)` accepts:

| Key | Default | Meaning |
| --- | --- | --- |
| `title` | `"Sesi Game"` | Window title and default storage namespace |
| `width`, `height` | `1280`, `720` | Initial content dimensions |
| `resizable` | `true` | Allow window resizing |
| `background` | `"#05070b"` | Scene clear/window background |
| `webgpu` | `true` | Prefer WebGPU when available |
| `fixed_step` | `1 / 60` | Fixed simulation interval in seconds |
| `max_catch_up_steps` | `5` | Maximum fixed ticks per rendered frame |
| `max_frame_delta` | `0.25` | Maximum accepted frame delta |
| `debug` | `false` | Permit Inspector/debug options |
| `permissions` | deny by default | Packaged-app capability manifest |

Game members:

- `game.assets`, `game.input`, and `game.storage` are read-only native service handles.
- `game.active_scene` is the current scene or `null`.
- `game.paused` is mutable.
- `game.running` is read-only.
- `game.create_scene(name, options?)`, `game.scene(name)`, and `game.activate_scene(name)` manage scenes.
- `game.on_start(fn)`, `game.on_update(fn)`, `game.on_fixed_update(fn)`, and `game.on_stop(fn)` register callbacks.
- `game.run(options?)` shows the window and blocks until it closes. Options include `icon` and `inspector`.
- `game.build(path, options?)` creates an unsigned unpacked app for the current OS and architecture.
- `game.dispose()` releases the game and allows another game to be created in tests or tooling.

Scene callbacks are registered with `scene.on_enter(fn)`, `on_exit(fn)`, `on_update(fn)`, and `on_fixed_update(fn)`.

## Assets

Register assets before using them:

```sesi
game.assets.add("ship", "model", "assets/ship.glb")
game.assets.add("metal", "texture", "assets/metal.png", {checksum: "sha256:..."})
game.assets.add("sky", "environment", "https://cdn.example.com/sky.env")
game.assets.add("impact", "audio", "assets/impact.ogg")
game.assets.add("ui", "font", "assets/Inter.woff2")
```

Supported types are `model`, `texture`, `environment`, `audio`, and `font`. During development, relative asset paths use the current working directory, exactly like `read_file`, `write_file`, `Draw.save_png`, and `Audio.save`. Local files must remain inside permitted project roots. Builds download HTTP/HTTPS assets with redirect, timeout, maximum-size, and optional SHA-256 checks, then store content-addressed copies in the app. Registered `.gltf` files and their dependency assets are packaged; prefer `.glb` when a single-file model is convenient.

Use `game.assets.get(name)` and `game.assets.names()` for inspection.

### Generated assets

Generate game art and sound with Sesi, then register the resulting files as assets:

```sesi
allow "std/draw" in as Draw
allow "std/audio" in as Audio

make_dir("assets")
Draw.pixel_grid(["YY", "YY"], {Y: "#facc15"}, 16)
Draw.save_png("assets/coin.png", 32, 32, "transparent")
Audio.save("assets/pickup.wav", "E6", 90, "sine")

game.assets.add("coin", "texture", "assets/coin.png")
game.assets.add("pickup", "audio", "assets/pickup.wav")
```

### App icon

Pass a registered texture asset name or local image path to `game.run`. When `icon` is omitted, Sesi uses its default placeholder icon.

```sesi
game.assets.add("app_icon", "texture", "assets/app-icon.png")
game.run({icon: "app_icon"})
game.build("build/MyGame", {icon: "app_icon"})
```

`game.build` embeds the icon, converts it to the host platform's native application-icon format, and applies it to the packaged executable/app bundle. If the build option is omitted, a registered texture named `icon` is used automatically; otherwise Sesi packages its default placeholder. PNG and JPEG work across desktop platforms; ICO and ICNS are also accepted. You can create a custom logo with `image()`:

```sesi
let logo = image("gemini-3.1-flash-image") {ratio: "1:1", size: "512"} {"A bold square app logo for a colorful arcade game"}
write_image("assets/app-icon.png", logo)
```

For a deterministic pixel-art logo, use `Draw.pixel_grid()`:

```sesi
allow "std/draw" in as Draw

Draw.pixel_grid([
  "0110",
  "1001",
  "1111",
  "1001"
], {"0": "transparent", "1": "#22d3ee"}, 32)
Draw.save_png("assets/app-icon.png", 128, 128, "#07111f")
```

## Meshes and models

Each primitive takes a unique name and optional object:

```sesi
let box = scene.box("box", {width: 2, height: 1, depth: 3})
let sphere = scene.sphere("ball", {diameter: 1, segments: 24})
let plane = scene.plane("sign", {width: 4, height: 2})
let ground = scene.ground("ground", {width: 30, height: 30, subdivisions: 2})
let pillar = scene.cylinder("pillar", {height: 4, diameter: 1})
let ship = scene.load_model("ship", "ship_asset", {position: Game.vec3(0, 1, 0)})
```

`create_box`, `create_sphere`, `create_plane`, `create_ground`, and `create_cylinder` are aliases. Live transform fields are `position`, `rotation`, and `scaling`; their components can be updated in place. Meshes also expose `enabled`, `visible`, `material`, and `metadata`.

Mesh methods include `dispose()`, `intersects(other)`, `apply_force(force, point?)`, `apply_impulse(impulse, point?)`, `set_velocity(velocity)`, `velocity()`, and `on_collision(fn)`.

Use `scene.get(name)`, `scene.remove(object)`, `scene.intersects(left, right)`, and `scene.dispose()` for lookup and lifetime management. Reading a disposed handle, writing a read-only property, using a material from another scene, or accessing a protected prototype property raises a typed Sesi error.

## Cameras and lights

```sesi
scene.free_camera("free", {position: Game.vec3(0, 2, -8)})
scene.orbit_camera("orbit", {alpha: -1.57, beta: 1.1, radius: 14})
scene.follow_camera("follow", {position: Game.vec3(0, 4, -10)})

scene.hemispheric_light("ambient", {intensity: 0.6})
scene.directional_light("sun", {direction: Game.vec3(-1, -2, 1)})
scene.point_light("lamp", {position: Game.vec3(0, 4, 0), range: 20})
scene.spot_light("spot", {position: Game.vec3(0, 6, 0), direction: Game.vec3(0, -1, 0)})
```

Camera fields include `position`, `rotation`, `target`, `fov`, `min_z`, `max_z`, and `active`. Lights expose `position`, `direction`, `color`, `intensity`, `range`, and `angle` where applicable.

## Materials

```sesi
let matte = scene.standard_material("matte", {
  diffuse: Game.color("#4da3ff"),
  emissive: Game.color(0, 0, 0),
  alpha: 1
})

let chrome = scene.pbr_material("chrome", {
  color: Game.color("#dce8ff"),
  metallic: 1,
  roughness: 0.15
})

player.material = chrome
```

Mutable material properties include color fields, `metallic`, `roughness`, `alpha`, and `wireframe`.

## Input

```sesi
game.input.bind("move_left", ["KeyA", "ArrowLeft"])
game.input.bind("jump", ["Space", "Gamepad0Button0"])

fn fixed_update(dt) {
  if game.input.down("move_left") {
    player.position.x = player.position.x - 5 * dt
  }
  if game.input.pressed("jump") {
    player.apply_impulse(Game.vec3(0, 5, 0))
  }
}

fn jumped(action) { show "Jump pressed" }
game.input.on("jump", jumped)
game.on_fixed_update(fixed_update)
```

Actions support `down`, `pressed`, and `released`. The input service also exposes pointer position, wheel delta, gamepad snapshots, `on(action, fn)`, and `pointer_lock(enabled?)`. Keyboard `code` and `key` values are both tracked. Pointer buttons use names such as `Pointer0`.

## Physics

Physics is opt-in per scene:

```sesi
scene.enable_physics({gravity: Game.vec3(0, -9.81, 0)})
scene.add_body(ground, {type: "static", shape: "box", friction: 0.8})
scene.add_body(player, {
  type: "dynamic",
  shape: "capsule",
  mass: 1,
  friction: 0.4,
  restitution: 0.1
})
```

Body types are `static`, `dynamic`, `animated`, and `trigger`. Shapes are `box`, `sphere`, `capsule`, `cylinder`, `convex_hull`, and `mesh`. Bodies support force, impulse, velocity, mass, friction, restitution, raycasts, and collision callbacks.

```sesi
fn collided(other) {
  if other != null { show "Hit" other.name }
}

player.on_collision(collided)
```

## Raycasts and animation

```sesi
let hit = scene.raycast(
  Game.vec3(0, 2, -10),
  Game.vec3(0, 0, 1),
  100
)

if hit.hit { show hit.object.name hit.point }

scene.animate(player, "rotation.y", 6.28318, {
  duration: 2,
  loop: true,
  easing: "linear"
})
```

Loaded glTF animation groups remain associated with their model. `scene.animate` covers numeric values and vector transform components.

## Sound and GUI

```sesi
scene.play_sound("impact", {volume: 0.8, spatial: true, position: player.position})

let title = scene.gui_text("title", {
  text: "SCORE 0",
  color: "white",
  width: "220px",
  height: "52px",
  left: "24px",
  top: "20px",
  horizontal_alignment: "left",
  vertical_alignment: "top"
})
let button = scene.gui_button("restart", {text: "Restart", background: "#19324d"})

fn restart() { game.activate_scene("main") }
button.on_click(restart)
```

GUI constructors are `gui_text`, `gui_image`, `gui_button`, `gui_panel`, and `gui_stack`. Controls expose mutable `text`, `source`, `color`, `background`, `width`, `height`, `left`, `top`, `horizontal_alignment`, `vertical_alignment`, `visible`, and `enabled` properties. Width, height, and offsets accept finite numbers or strings such as `"220px"` and `"10%"`; width and height also accept `"auto"`. Horizontal alignment is `"left"`, `"center"`, or `"right"`; vertical alignment is `"top"`, `"center"`, or `"bottom"`. Alignment defaults to the center. Panels and stacks accept controls through `add(control)`.

## Save storage

App-scoped key/value storage is always available:

```sesi
let best = game.storage.get("best_score", 0)
game.storage.set("best_score", 9001)
game.storage.remove("old_setting")
game.storage.clear()
```

Values are JSON-compatible and isolated by the game's storage name.

## Building a desktop app

```sesi
if includes(args, "--build") {
  game.build("build/MyGame", {overwrite: true})
  // Compress the build output into a single archive file for easier distribution.
  zip("build/MyGame", "MyGame.zip")
} else {
  game.run({inspector: true})
}
```

```bash
sesi -l game.sesi --build
```

The result is an unsigned unpacked application for the host OS and architecture. The build includes compiled entry/transitive Sesi bytecode, registered assets, Babylon, Havok, and Electron runtime files; `.sesi` source is omitted. Existing output is rejected unless `overwrite` is true. Code signing and installers are separate release steps.

## Packaged permissions

Permissions are deny-by-default and declared in `Game.create`:

```sesi
let game = Game.create({
  title: "Networked Scores",
  permissions: {
    network: ["https://scores.example.com"],
    external_links: ["https://example.com"],
    filesystem: ["app_assets", "user_data", "temp"],
    clipboard: false,
    localhost_server: false,
    process: ["platform", "arch"]
  }
})
```

Navigation and new windows are denied. Electron uses `contextIsolation: true` and `nodeIntegration: false`; the preload bridge is allowlisted. AI providers, browser automation, and media-conversion tools are not exposed to packaged games in V1.

## Debugging

Pass `{debug: true}` to `Game.create` and `{inspector: true}` to `game.run` to enable Babylon Inspector during development. Use `str(handle)`, `type(handle)`, `keys(handle)`, and `values(handle)` for safe native-object introspection. The runtime preserves object identity and bound method identity.

Common typed failures include `SecurityError`, `GameAddonError`, `GameStateError`, `SceneError`, `AssetError`, `PhysicsError`, `NativePropertyError`, `ReadOnlyPropertyError`, `CrossSceneError`, `DisposedObjectError`, and `AsyncCallbackError`.
