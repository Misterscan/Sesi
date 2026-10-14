# Drawing in Sesi

`std/draw` is Sesi's built-in module for creating SVG graphics and raster pixel art — no external libraries needed.

---

## Importing the Module

```
allow "std/draw" in as <alias>
```

The name after `as` is your choice — any identifier works:

```sesi
allow "std/draw" in as Draw     // conventional
allow "std/draw" in as canvas   // also fine
allow "std/draw" in as d        // also fine
```

The examples below use `Draw` as a readable convention.

---

## Drawing Shapes

Every draw call appends a shape to an internal buffer. Nothing is rendered or saved until you call `render` or `save_svg`. This only applies to SVG output; pixel-based drawings are handled differently. Do not call `save_png` for SVG shapes — only use it when using `Draw.pixel()`, `Draw.pixel_grid()`, or `Draw.pixel_<shape>()` functions.

---

### Rectangle — `Draw.rect`

```
Draw.rect(x, y, width, height, fill)
```

| Parameter | Type     | Description                     |
| --------- | -------- | ------------------------------- |
| `x`       | `number` | Left edge (pixels)              |
| `y`       | `number` | Top edge (pixels)               |
| `width`   | `number` | Width in pixels                 |
| `height`  | `number` | Height in pixels                |
| `fill`    | `string` | CSS color (name, hex, rgb, etc) |

```sesi
allow "std/draw" in as Draw

Draw.rect(10, 10, 80, 50, "steelblue")
Draw.rect(20, 70, 60, 20, "#ff6347")
```

---

### Circle — `Draw.circle`

```
Draw.circle(x, y, radius, fill)
```

| Parameter | Type     | Description                        |
| --------- | -------- | ---------------------------------- |
| `x`       | `number` | Center X coordinate                |
| `y`       | `number` | Center Y coordinate                |
| `radius`  | `number` | Radius in pixels                   |
| `fill`    | `string` | CSS color                          |

```sesi
allow "std/draw" in as Draw

Draw.circle(50, 50, 40, "crimson")
Draw.circle(150, 50, 20, "gold")
```

---

### Line — `Draw.line`

```
Draw.line(x1, y1, x2, y2, stroke)
```

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `x1`      | `number` | Start X                  |
| `y1`      | `number` | Start Y                  |
| `x2`      | `number` | End X                    |
| `y2`      | `number` | End Y                    |
| `stroke`  | `string` | CSS color for the line   |

```sesi
allow "std/draw" in as Draw

Draw.line(0, 0, 200, 200, "white")
Draw.line(200, 0, 0, 200, "white")   // X pattern
```

---

### Text — `Draw.text`

```
Draw.text(x, y, content, size, fill)
```

| Parameter | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| `x`       | `number` | Left edge of the text               |
| `y`       | `number` | Baseline Y position                 |
| `content` | `string` | The text to render                  |
| `size`    | `number` | Font size in pixels                 |
| `fill`    | `string` | CSS color                           |

```sesi
allow "std/draw" in as Draw

Draw.text(10, 30, "Hello, Sesi", 24, "white")
Draw.text(10, 60, "SVG is easy", 16, "#aaa")
```

---

## Clearing the Buffer — `Draw.clear`

```
Draw.clear()
```

Wipes everything in the drawing buffer. Use this to reset between separate drawings in the same script:

```sesi
allow "std/draw" in as Draw

Draw.circle(50, 50, 40, "red")
Draw.clear()                       // start fresh

Draw.rect(10, 10, 80, 80, "blue") // only this will appear
Draw.save_svg("output.svg", 100, 100)
```

---

## Getting the SVG String — `Draw.render`

```
Draw.render(width, height) -> string
```

Flushes the buffer and returns the complete SVG document as a string. The buffer is **not** cleared afterward.

```sesi
allow "std/draw" in as Draw

Draw.rect(0, 0, 200, 100, "navy")
Draw.text(10, 60, "Sesi", 40, "white")

let svg = Draw.render(200, 100)
show svg
```

You can pass the returned string to `write_file` or embed it in HTML:

```sesi
let svg  = Draw.render(400, 300)
let page = "<html><body>" + svg + "</body></html>"
write_file("preview.html", page)
```

---

## Saving to a File — `Draw.save_svg`

```
Draw.save_svg(path, width, height)
```

Renders the buffer and writes the SVG directly to `path`. Equivalent to calling `render` then `write_file`.

```sesi
allow "std/draw" in as Draw

Draw.rect(0, 0, 400, 300, "#1a1a2e")
Draw.circle(200, 150, 100, "#e94560")
Draw.text(130, 160, "Sesi Draw", 28, "white")

Draw.save_svg("poster.svg", 400, 300)
show "Saved poster.svg"
```

---

## Raster Pixel Drawing

`Draw.pixel` and `Draw.pixel_<shape>` functions write directly to a raster pixel buffer that is separate from the SVG shape buffer. Calling `Draw.save_png` encodes those raster pixels into a true-color RGBA PNG file.

---

### Single Pixel — `Draw.pixel`

```
Draw.pixel(x, y, color)
```

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `x`       | `number` | Integer X coordinate |
| `y`       | `number` | Integer Y coordinate |
| `color`   | `string` | Color (name, `#hex`, `rgb`, `rgba`) |

```sesi
allow "std/draw" in as Draw

Draw.pixel(0, 0, "#ff4d6d")
Draw.pixel(1, 0, "#ffd166")
Draw.pixel(0, 1, "rgba(6, 214, 160, 0.5)")
Draw.pixel(1, 1, "#118ab2")

Draw.save_png("pixels.png", 2, 2)
```

---

### Pixel Grid — `Draw.pixel_grid`

For pixel art, a palette-indexed grid is compact. String rows use characters as palette keys, expanding each grid cell by `scale`:

```
Draw.pixel_grid(grid, palette, scale, x, y)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `grid`    | `array` | Array of row strings or character arrays |
| `palette` | `object` | Mapping of characters to color strings |
| `scale`   | `number` | Pixel scale multiplier per grid cell |
| `x`       | `number` | Top-left X offset on canvas |
| `y`       | `number` | Top-left Y offset on canvas |

```sesi
let palette = {
  ".": "#111a38",
  "X": "#56d9e9"
}

let grid = [
  ".XX.",
  "X..X",
  "X..X",
  ".XX."
]

Draw.pixel_grid(grid, palette, 128)
Draw.save_png("grid.png", 512, 512)
```

---

### Pixel Rectangle — `Draw.pixel_rect`

Rasterizes a filled or outline rectangle into the pixel buffer.

```
Draw.pixel_rect(x, y, w, h, color, filled)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `x` | `number` | Top-left X coordinate |
| `y` | `number` | Top-left Y coordinate |
| `w` | `number` | Width in pixels |
| `h` | `number` | Height in pixels |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_rect(10, 10, 80, 50, "#e94560", true)
Draw.pixel_rect(20, 20, 60, 30, "#ffffff", false)
Draw.save_png("pixel_rect.png", 100, 100)
```

---

### Pixel Circle — `Draw.pixel_circle`

Rasterizes a filled or outline circle into the pixel buffer using Euclidean distance.

```
Draw.pixel_circle(cx, cy, r, color, filled)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `cx` | `number` | Center X coordinate |
| `cy` | `number` | Center Y coordinate |
| `r` | `number` | Radius in pixels |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_circle(50, 50, 30, "#00f0ff", true)
Draw.save_png("pixel_circle.png", 100, 100)
```

---

### Pixel Line — `Draw.pixel_line`

Rasterizes a line between two points into the pixel buffer using Bresenham's algorithm.

```
Draw.pixel_line(x1, y1, x2, y2, color)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `x1` | `number` | Start X coordinate |
| `y1` | `number` | Start Y coordinate |
| `x2` | `number` | End X coordinate |
| `y2` | `number` | End Y coordinate |
| `color` | `string` | Line color |

```sesi
allow "std/draw" in as Draw

Draw.pixel_line(0, 0, 99, 99, "#ff0077")
Draw.save_png("pixel_line.png", 100, 100)
```

---

### Pixel Ellipse — `Draw.pixel_ellipse`

Rasterizes an ellipse into the pixel buffer.

```
Draw.pixel_ellipse(cx, cy, rx, ry, color, filled)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `cx` | `number` | Center X coordinate |
| `cy` | `number` | Center Y coordinate |
| `rx` | `number` | Horizontal radius |
| `ry` | `number` | Vertical radius |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_ellipse(50, 50, 40, 20, "#ffb703", true)
Draw.save_png("pixel_ellipse.png", 100, 100)
```

---

### Pixel Polygon — `Draw.pixel_polygon`

Rasterizes an arbitrary closed polygon using scanline fill.

```
Draw.pixel_polygon(points, color, filled)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `points` | `array` or `string` | Point coordinate pairs (e.g., `[[0,0],[40,0],[20,40]]` or `"0,0 40,0 20,40"`) |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_polygon([[10,10], [90,10], [50,90]], "#06d6a0", true)
Draw.save_png("pixel_polygon.png", 100, 100)
```

---

### Pixel Triangle — `Draw.pixel_triangle`

Rasterizes a triangle into the pixel buffer.

```
Draw.pixel_triangle(x1, y1, x2, y2, x3, y3, color, filled = true)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `x1`, `y1` | `number` | Point 1 coordinates |
| `x2`, `y2` | `number` | Point 2 coordinates |
| `x3`, `y3` | `number` | Point 3 coordinates |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_triangle(10, 80, 50, 10, 90, 80, "#ff4d6d", true)
Draw.save_png("pixel_triangle.png", 100, 100)
```

---

### Pixel Star — `Draw.pixel_star`

Rasterizes a multi-pointed star shape into the pixel buffer.

```
Draw.pixel_star(cx, cy, spikes, outerRadius, innerRadius, color, filled = true)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `cx`, `cy` | `number` | Center coordinates |
| `spikes` | `number` | Number of star points (e.g. `5`) |
| `outerRadius` | `number` | Outer point radius |
| `innerRadius` | `number` | Inner point radius |
| `color` | `string` | Fill/stroke color |
| `filled` | `boolean` | `true` for solid fill, `false` for outline |

```sesi
allow "std/draw" in as Draw

Draw.pixel_star(50, 50, 5, 40, 18, "#ffd166", true)
Draw.save_png("pixel_star.png", 100, 100)
```

---

### Pixel Ring — `Draw.pixel_ring`

Rasterizes a ring / annulus band into the pixel buffer.

```
Draw.pixel_ring(cx, cy, radius, thickness, color)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `cx`, `cy` | `number` | Center coordinates |
| `radius` | `number` | Outer radius |
| `thickness` | `number` | Band thickness in pixels |
| `color` | `string` | Ring color |

```sesi
allow "std/draw" in as Draw

Draw.pixel_ring(50, 50, 40, 8, "#118ab2")
Draw.save_png("pixel_ring.png", 100, 100)
```

---

### Pixel Arc — `Draw.pixel_arc`

Rasterizes a circular arc segment in degrees into the pixel buffer.

```
Draw.pixel_arc(cx, cy, radius, startAngle, endAngle, color)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `cx`, `cy` | `number` | Center coordinates |
| `radius` | `number` | Arc radius |
| `startAngle` | `number` | Start angle in degrees |
| `endAngle` | `number` | End angle in degrees |
| `color` | `string` | Arc line color |

```sesi
allow "std/draw" in as Draw

Draw.pixel_arc(50, 50, 35, 0, 180, "#7209b7")
Draw.save_png("pixel_arc.png", 100, 100)
```

---

### Pixel Bezier Curve — `Draw.pixel_bezier`

Rasterizes a quadratic Bezier curve into the pixel buffer.

```
Draw.pixel_bezier(x1, y1, cx, cy, x2, y2, color)
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `x1`, `y1` | `number` | Start point coordinates |
| `cx`, `cy` | `number` | Control point coordinates |
| `x2`, `y2` | `number` | End point coordinates |
| `color` | `string` | Curve line color |

```sesi
allow "std/draw" in as Draw

Draw.pixel_bezier(10, 90, 50, 10, 90, 90, "#4cc9f0")
Draw.save_png("pixel_bezier.png", 100, 100)
```

---

### Pixel Text — `Draw.pixel_text`

Rasterizes text directly into the pixel buffer. The default `classic` face uses
the built-in 5x7 bitmap font. The `bubble` and `impact` faces render smooth,
antialiased, full-scale lettering.

```
Draw.pixel_text(x, y, text, color, scale = 1, font = "classic")
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `x` | `number` | Left X position |
| `y` | `number` | Top Y position |
| `text` | `string` | Text string to render |
| `color` | `string` | Text color |
| `scale` | `number` | Text scale; multiplies bitmap cells for `classic` and controls rendered size for smooth faces |
| `font` | `string` | Font face: `"classic"`, `"bubble"`, or `"impact"` |

```sesi
allow "std/draw" in as Draw

Draw.pixel_text(10, 10, "PIXEL ART", "#f72585", 2)
Draw.save_png("pixel_text.png", 200, 50)
```

```sesi
allow "std/draw" in as Draw

Draw.pixel_rect(0, 0, 900, 240, "#101522", true)
Draw.pixel_text(30, 25, "Bubble Text", "#79e6ff", 12, "bubble")
Draw.pixel_text(30, 125, "IMPACT STYLE", "#fff1d0", 12, "impact")
Draw.save_png("font_faces.png", 900, 240)
```

---

### Saving PNG Output — `Draw.save_png`

```
Draw.save_png(path, width, height, background = "transparent")
```

Encodes all raster pixels in the buffer to a PNG image file. Coordinates are floored to integers. A later call at the same coordinate replaces the earlier pixel color. `Draw.clear()` resets both the SVG and raster pixel buffers.

---

### Key Differences When Working With Full Resolutions:
1. **Canvas Allocation**: `Draw.save_png(path, width, height, "transparent")` instructs the raster engine to write a complete width×height viewport. Any primitives placed outside that bounding box are clipped, and undefined pixels receive the specified background color (or transparency).
2. **Scale Multipliers**:
   - `Draw.pixel_text(x, y, text, color, scale, font)`: For the `classic` face, `scale = 2` or `scale = 3` enlarges bitmap glyph cells. The smooth `bubble` and `impact` faces use the same value to control their rendered size.
   - `Draw.pixel_grid(grid, palette, scale)`: When using palette grids on an HD canvas, set `scale` (e.g., `32`, `64`, or `128`) so that character cells map to sizable multi-pixel blocks rather than single 1px dots.
3. **Primitive Sizing**: Coordinates for `pixel_polygon`, `pixel_triangle`, `pixel_star`, `pixel_circle`, and `pixel_rect` must scale with the destination dimensions. Radius values of `40` to `100` and heights of `300` to `600` fill out a 720p or 1080p frame proportionally for reference.

---

## Composing Multiple Shapes

Shapes are layered in the order they are added, so earlier calls appear behind later ones:

```sesi
allow "std/draw" in as Draw

// Background
Draw.rect(0, 0, 300, 200, "#0f0f23")

// Sun
Draw.circle(250, 50, 40, "#ffd700")

// Ground
Draw.rect(0, 150, 300, 50, "#2d6a4f")

// Tree trunk
Draw.rect(135, 110, 30, 60, "#6b4226")

// Tree top
Draw.circle(150, 100, 40, "#52b788")

// Label
Draw.text(10, 190, "A Sesi landscape", 14, "#ccc")

Draw.save_svg("landscape.svg", 300, 200)
```

---

## Advanced Features (Gradients, Animations, Options)

Sesi's drawing module has built-in support for:
1. **Attributes / Options**: You can pass a dictionary of attributes as the final argument to shape rendering functions to add CSS classes, IDs, strokes, and more.
2. **Gradients**: Define linear/radial gradients inside the `<defs>` element using `Draw.gradient`.
3. **CSS Keyframe Animations**: Inject custom `@keyframes` styling into the generated SVG header using `Draw.style`.
4. **Complex Shapes**: Draw curves and lines via `ellipse`, `polygon`, and `path`.
5. **Raw Elements**: Inject arbitrary SVG markup tags directly using `Draw.raw`.

### Example: Animated Vector Art with Gradients

```sesi
allow "std/draw" in as Draw

// 1. Define a radial gradient for a neon glow
Draw.gradient("radial", "glow_grad", [
  {offset: "0%", color: "#ff00ff"},
  {offset: "100%", color: "transparent"}
])

// 2. Define standard CSS animations for pulsating and spinning
Draw.style("
  @keyframes heartbeat {
    0% { transform: scale(1); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  .pulse {
    animation: heartbeat 2s infinite ease-in-out;
    transform-origin: 200px 200px;
  }
")

// 3. Draw using options to bind classes and gradients
Draw.rect(0, 0, 400, 400, "#0a0018")
Draw.circle(200, 200, 100, "url(#glow_grad)", {class: "pulse"})
Draw.ellipse(200, 200, 50, 25, "#00ffff")

Draw.save_svg("neon.svg", 400, 400)
```

---

## Error Handling

Wrap file-saving calls in `try/catch` to handle path or permission errors:

```sesi
allow "std/draw" in as Draw

Draw.rect(0, 0, 100, 100, "teal")

try {
  Draw.save_svg("output/drawing.svg", 100, 100)
  show "Saved successfully"
} catch (err) {
  show "Draw error:" err
}
```

---

## Quick Reference

```sesi
allow "std/draw" in as Draw

// Setup & Formatting
Draw.gradient(type, id, stops, options = {})
Draw.style(cssText)
Draw.raw(svgCode)

// Shapes (all accept optional custom attributes dictionary)
Draw.rect(x, y, width, height, fill, options = {})
Draw.circle(x, y, radius, fill, options = {})
Draw.line(x1, y1, x2, y2, stroke, options = {})
Draw.text(x, y, content, size, fill, options = {})
Draw.ellipse(cx, cy, rx, ry, fill, options = {})
Draw.polygon(points, fill, options = {})
Draw.path(d, fill, options = {})

// Buffer actions
Draw.clear()
let svg = Draw.render(width, height)
Draw.save_svg("output.svg", width, height)

// Raster pixels
Draw.pixel(x, y, color)
Draw.pixel_grid(grid, palette, scale = 1, x = 0, y = 0)
Draw.pixel_rect(x, y, w, h, color, filled = true)
Draw.pixel_circle(cx, cy, r, color, filled = true)
Draw.pixel_line(x1, y1, x2, y2, color)
Draw.pixel_ellipse(cx, cy, rx, ry, color, filled = true)
Draw.pixel_polygon(points, color, filled = true)
Draw.pixel_triangle(x1, y1, x2, y2, x3, y3, color, filled = true)
Draw.pixel_star(cx, cy, spikes, outerRadius, innerRadius, color, filled = true)
Draw.pixel_ring(cx, cy, radius, thickness, color)
Draw.pixel_arc(cx, cy, radius, startAngle, endAngle, color)
Draw.pixel_bezier(x1, y1, cx, cy, x2, y2, color)
Draw.pixel_text(x, y, text, color, scale = 1, font = "classic")
Draw.save_png("output.png", width, height, "transparent")
```

---
