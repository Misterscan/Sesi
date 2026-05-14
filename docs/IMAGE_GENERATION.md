# Image Generation in Sesi

Sesi provides a native, language-level primitive for generating images using AI models. This primitive is designed to interoperate seamlessly with Sesi's file system builtins, allowing you to generate and persist images with minimal boilerplate.

## The `image` Primitive

To generate an image, use the `image` keyword followed by the model name, an optional configuration block, and a prompt block.

### Syntax

The syntax parallels standard `model` calls:

```
image("model-name") {"configKey": "configValue"} {"Prompt text"}
```

### Basic Example

Here is a simple example demonstrating how to generate a single image and save it to disk directly:

```sesi
// 1. Define the generation prompt natively
prompt request {"A simple minimalist company logo for a bakery"}

// 2. Call the image generation primitive
let imageData = image("gemini-3.1-flash-image-preview") {"ratio": "1:1", "size": "1K"} {request}

// 3. Write the payload to disk
try 
{let success = write_image("bakery_logo.png", imageData)
if success {print "Saved bakery_logo.png successfully."}} 
catch (e) {print "Failed to generate image:"
print e}
```

### Advanced Example: Batch Asset Generation Workflow

Here is a practical script demonstrating how to iterate over a data set, generate assets, and save them to a specific directory. This is useful for building automated pipelines like generating UI placeholders or product catalog images.

```sesi
// Set up output directory
let outputDir = "assets/products/"
make_dir(outputDir)
let products = ["coffee_mug", "desk_lamp", "notebook"]

// Iterate through the list and generate a file for each
for product in products 
{print "Generating asset for:" product

// Construct the instruction for the model
prompt request {"A clean studio presentation photograph of a " product " on a solid white background."}
prompt filename { outputDir product ".png" }
try 
{let imageData = image("gemini-3.1-flash-image-preview") {"ratio": '1:1', "size": "1K"} {request}

// Attempt local file write
let success = write_image(filename, imageData)
if success {print "Saved:" filename}} 
catch (e) {print "Failed processing" product ":"
print e}}
print "Asset generation complete."
```

## Configuration Options

When configuring the `image` call (specifically for models like `gemini-3.1-flash-image-preview`), the configuration block maps directly to backend SDK capabilities:

- `"ratio"`: The aspect ratio of the image (e.g., `"1:1"`, `"16:9"`, `"9:16"`).
- `"size"`: Dimensional sizing constraints (Must be `"512"`, `"1K"`, `"2K"`, or `"4K"`).
- `"temperature"`: Controls variance (e.g., `0.3`).

## File I/O Integration: `write_image`

The `image()` call evaluates to a `string` (specifically, base64-encoded image data). To convert this into a standard image file on disk, you must use the `write_image(path, base64_content)` builtin. 

**Important:** Do *not* use `write_file` for image payloads—`write_image` is explicitly implemented in the Sesi engine (`src/builtins.ts`) to handle `Buffer.from(content, 'base64')` decoding for writing safe binary formats.