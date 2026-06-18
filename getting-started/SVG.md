# SVG Drawing in Sesi

`std/draw` is Sesi's built-in module for creating SVG graphics. You add shapes and text to a drawing buffer, then either get the SVG as a string or save it directly to a file — no external libraries needed.

---

## Importing the Module

```
allow "std/draw" in with <alias>
```

The name after `with` is your choice — any identifier works:

```sesi
allow "std/draw" in with Draw     // conventional
allow "std/draw" in with canvas   // also fine
allow "std/draw" in with d        // also fine
```

The examples below use `Draw` as a readable convention.

---

## Drawing Shapes

Every draw call appends a shape to an internal buffer. Nothing is rendered or saved until you call `render` or `save_svg`.

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
allow "std/draw" in with Draw

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
allow "std/draw" in with Draw

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
allow "std/draw" in with Draw

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
allow "std/draw" in with Draw

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
allow "std/draw" in with Draw

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
allow "std/draw" in with Draw

Draw.rect(0, 0, 200, 100, "navy")
Draw.text(10, 60, "Sesi", 40, "white")

let svg = Draw.render(200, 100)
print svg
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
allow "std/draw" in with Draw

Draw.rect(0, 0, 400, 300, "#1a1a2e")
Draw.circle(200, 150, 100, "#e94560")
Draw.text(130, 160, "Sesi Draw", 28, "white")

Draw.save_svg("poster.svg", 400, 300)
print "Saved poster.svg"
```

---

## Composing Multiple Shapes

Shapes are layered in the order they are added, so earlier calls appear behind later ones:

```sesi
allow "std/draw" in with Draw

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

## Error Handling

Wrap file-saving calls in `try/catch` to handle path or permission errors:

```sesi
allow "std/draw" in with Draw

Draw.rect(0, 0, 100, 100, "teal")

try {
  Draw.save_svg("output/drawing.svg", 100, 100)
  print "Saved successfully"
} catch (err) {
  print "Draw error:" err
}
```

---

## Quick Reference

```sesi
allow "std/draw" in with Draw

// Shapes
Draw.rect(x, y, width, height, fill)
Draw.circle(x, y, radius, fill)
Draw.line(x1, y1, x2, y2, stroke)
Draw.text(x, y, content, size, fill)

// Reset buffer
Draw.clear()

// Get SVG string
let svg = Draw.render(width, height)

// Save to file
Draw.save_svg("output.svg", width, height)

// Use the SVG string elsewhere
write_file("embed.html", "<body>" + svg + "</body>")
```

---
