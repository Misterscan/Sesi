# Sesi Language - Complete Implementation Summary

## 📋 Overview

**Sesi** is a highly legible, buildable **programming language**. It provides clean primitives for executing robust internal logic and external APIs, acting as the ideal layer to parse text, orchestrate shell commands, and interact with the file system. Unlike traditional languages, Sesi integrates command execution naturally, enabling developers to build context-aware scripts with minimal boilerplate.

## 🎯 Design Philosophy

1. **Practical Over Perfect**: Focus on what developers actually need, not theoretical completeness.
2. **Transparency Over Magic**: Sesi runs exactly what you write with clear costs and execution maps.
3. **Performance with Clarity**: A bytecode compiler and stack-based virtual machine for fast execution, backed by the original tree-walking interpreter as a proven fallback.
4. **Type Safety with Flexibility**: Static types for normal code, runtime checking for integration outputs.

## 🔧 Technology Stack

| Component | Technology                                       | Rationale                                                           |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Language  | TypeScript                                       | Type safety, IDE support, easy debugging                            |
| Runtime   | Node.js 18+                                      | Wide availability, async support                                    |
| Reasoning | Gemini 3.1                                       | Latest models, 1M token context, fast                               |
| SDK       | @google/genai                                    | Official, well-maintained, async-first                              |
| Parser    | Recursive descent                                | Simple, readable, extensible                                        |
| Execution | Bytecode VM (`vm.ts`) + Compiler (`compiler.ts`) | Fast OpCode dispatch; tree-walking interpreter retained as fallback |
| Testing   | Typescript                                       | Standard Node.js test framework                                     |

### Why a bytecode VM?

- **Performance**: OpCode dispatch is significantly faster than recursive AST traversal
- **Determinism**: Flat instruction sequences are easier to reason about at runtime
- **Iteration**: The compiler shares the same AST so no grammar changes are needed
- **Fallback safety**: The tree-walking interpreter remains for edge-case constructs not yet lowered by the compiler

### Why recursive descent parser?

- **Clarity**: Each grammar rule is a function
- **Flexibility**: Easy to add new constructs
- **Error recovery**: Can synchronize after errors
- **No dependencies**: No external parser generators

### Why Gemini specifically?

- **Instruction following**: Excellent at understanding prompts
- **Function calling**: Built-in tool use support
- **Context window**: 1M tokens for long documents
- **Cost**: Competitive pricing
- **Availability**: Easy to use via official SDK

## 🌟 Language Features (V1)

### Core Language ✅

**Variables & Bindings**

```sesi
let x = 10
let PI = 3.14159
let y  // null initially
```

**Functions**

```sesi
fn add(a: number, b: number) -> number {return a + b}

fn greet(name: string = "World") {print "Hello, " + name}
```

**Control Flow**

```sesi
if condition { ... } else { ... }
while condition { ... }
for x = 0 to 10 { ... }
for item in array { ... }
try { ... } catch (e) { ... }
```

**Operators**

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`, `!`
- Assignment: `=`

**Data Types**

- Primitives: `number`, `string`, `bool`, `null`
- Collections: `array<T>`, `object<T>`
- Functions: First-class values
- Union types: `T | U`
- Optional: `T?`

**Scoping**

- Lexical scoping with environment chain
- Block scope for loops/conditionals
- Closure support

**Prompt Blocks**

```sesi
prompt greeting {"Hello, " name "!"}
```

**Structured Output**

```sesi
let rawJson = "{\"projectName\": \"Sesi\", \"version\": \"1.6.3\", \"status\": \"active\"}"
let parsedRegistry = structured_output({projectName: string, version: string, status: string})(rawJson)
```

### Integrated Reasoning Features ✅

**Reasoning Calls**

```sesi
let response = model("gemini-3-flash-preview") {temperature: 0.7, max_tokens: 1000} {"Your prompt here"}
```

**Web Search Grounding**

```sesi
let response = model("gemini-3.1-flash-lite") {search, max_tokens: 1000} {"What is the weather in Tokyo?"}
```

**Image Generation**

```sesi
let logo = image("gemini-3.1-flash-image") {ratio: "1:1", size: "512"} {"Your prompt here"}
write_image("logo.png", logo)
```

**Temporal Context Injection** ✅

Every reasoning call automatically includes the current UTC date and time in its context, providing the script with a native sense of "now."

**Implicit Statement Termination** ✅

Expressions ending in `}` (such as prompt blocks) no longer strictly require an escape character or semicolon to terminate, allowing for cleaner one-line or multi-line syntax.

**Async Polling for MAX_TOKENS** ✅

The runtime natively polls the model if it hits a `MAX_TOKENS` finish status during large generation tasks.

**Tool Calling**

```sesi
let result = tool_call(functionName)(model(gemini-3.1-flash-lite) {"Your prompt here"})
```

**Memory**

```sesi
memory conversation {"Initial context"}
conversation = conversation + "User: How are you?"
print("Current Conversation Memory:")
print(conversation)

// Demonstrate using the memory in a model call
print("Calling model with memory context...")
let response = model("gemini-3-flash-preview") {conversation}
print("Reasoning Response:", response)
```

## 🌍 Built-in Global Variables

- `args` (`array<string>`): Contains the command-line arguments passed to the script, excluding Sesi runtime options and the script path.

## 🛠️ Built-in Functions

### I/O

- `print(...args)` - Output to stdout
- `read_file(path)` - Read file contents
- `write_file(path, content)` - Write file contents
- `write_image(path, content)` - Write base64 image data to file
- `list_dir(path)` - List directory contents
- `make_dir(path)` - Create a new directory
- `spawn(path)` - Launch concurrent background process
- `exec(command)` - Synchronous shell execution
- `time()` - Unix timestamp (ms)
- `random()` - Random number (0-1)
- `debug()` - Pause execution and launch an interactive debugging REPL

### Type & Conversion Functions

- `type(value)` - Get type name
- `str(value)` - Convert to string
- `to_json(value)` - Convert to JSON string
- `from_json(string)` - Parse JSON string back into a native Sesi primitive/array/object
- `num(value)` - Convert to number
- `bool(value)` - Convert to boolean
- `convert(type) { config } { file }` - Convert file or document content between formats (e.g. Markdown to HTML, CSV to JSON, images, audio)

### Collection Functions

- `len(collection)` - Get length
- `push(array, value)` - Add element
- `pop(array)` - Remove element
- `join(array, sep)` - Join to string
- `split(string, sep)` - Split to array
- `keys(object)` - Get keys
- `values(object)` - Get values
- `range(n)` - Create range array

### Network

- `web_get(url, headers)` - Perform HTTP GET request
- `web_send(url, body, headers)` - Perform HTTP POST request
- `listen(port, handler)` - Start a native HTTP server listening on the specified port
- `api(port, handler)` - Start a native WebSocket server listening on the specified port
- `live(filePath, exportName)` - Create a dynamic hot-reloading wrapper function around a Sesi script's exported function for instant request reload

### Concurrency

- `multi_req(fns)` - Concurrently execute multiple closures/functions in parallel

### Tools

- `define_tool(name, fn, description)` - Register a custom tool
- `list_tools()` - List custom tool names
- `tool_call(name)(...)` - Call a custom tool

### Reasoning

- `workflow(steps, input)` - Run a multi-step reasoning workflow
- `set_alias(alias, model)` - Register a custom local name for a model

### Error Handling

- `error_type(type, message, data)` - Create a custom error object
- `raise_error(type_or_error, message, data)` - Throw an error

### Math

- `exp(x)` - Exponential function

### Standard Library Modules

Sesi supports importing standard utility library modules natively at runtime:

- **`std/math`**: Constants `PI`, `E`, and functions `sin`, `cos`, `tan`, `sqrt`, `floor`, `ceil`, `abs`, `pow`, `log`, `exp`
- **`std/time`**: `now()`, `sleep(ms)`, and `format(timestamp, options)` for timezone/locale formatting
- **`std/json`**: `stringify(val)` and `parse(str)`
- **`std/audio`**: `play`, `beep`, `synth`, `save`, `sequence`, `mix` for sound synthesis. Upgraded to a professional DSP backend with **Stereo Panning**, **ADSR Envelopes**, **Low-Pass Filtering**, **Soft-Clipping**, physical modeling drums (`kick`, `snare`, `hat`, `clap`), and `sf2` (High-speed FluidSynth batch-rendering for SoundFonts).
- **`std/theory`**: `chord(root, type)`, `scale(root, type)`, `transpose(notes, steps)`, `duration(minutes, seconds)`, and `bar(bars, bpm, beatsPerBar?)` for algorithmic composition, timing conversions, and harmonic logic.
- **`std/draw`**: Upgraded SVG generation library supporting complex shapes (`ellipse`, `polygon`, `path`), definition management (`gradient`, `style`), inline XML (`raw`), formatting/indentation, and class/attribute mappings via optional trailing `options` dictionaries.
- **`std/db`**: `db_open(filename, password?)` returning a Document Database instance (with automatic AES-256-CBC disk encryption if a passphrase is provided) supporting collections and CRUD operations:
  - `db.collection(name)` -> Collection object
  - `collection.insert(document)`
  - `collection.find(query?)`
  - `collection.update(query, update_obj)`
  - `collection.delete(query)`

## 📊 Implementation Statistics

| Metric              | Value  |
| ------------------- | ------ |
| Total lines of code | ~4,000 |
| Source files        | 9      |
| Documentation pages | 23     |
| Example programs    | 31     |
| Built-in functions  | 50+    |
| Supported operators | 20+    |
| AST node types      | 30+    |
| Token types         | 50+    |

## 🚀 Getting Started

### Installation

```bash
cd Sesi
npm install
npm run build
npm install -g .
```

### Run Example

```bash
sesi examples/main/01_hello.sesi
```

### Run with Reasoning

```bash
sesi examples/optional/08_model_call.sesi
```

### Run Tests

```bash
npm test
```

## 💡 Key Implementation Details

### Lexer Design

- Character-by-character scanning
- Keyword recognition
- String/number literal parsing
- Comment stripping
- Position tracking for error messages

### Parser Design

- Recursive descent parsing
- Expression precedence (11 levels)
- Error recovery via synchronization
- Full AST construction
- Support for all language constructs

### Execution Design

- Bytecode compiler (`compiler.ts`) performs a single-pass AST lowering into a `Chunk`
- Stack-based VM (`vm.ts`) dispatches OpCode instructions in a tight loop
- Call frames manage local variable slots resolved at compile time
- Closures, loops, conditionals, try/catch, and imports are all handled natively
- Tree-walking interpreter (`interpreter.ts`) retained as fallback for unsupported constructs
- Built-in function dispatch shared across both execution paths

### Reasoning Runtime Design

- Async Gemini API calls (via @google/genai)
- Response parsing and validation
- Memory buffer management
- Structured output JSON extraction with automatic schema simplification
- Automatic injection of current UTC date/time context
- Graceful error handling

## 📚 Documentation Coverage

✅ **SPECIFICATION.md** (600+ lines)

- Complete language grammar
- All language constructs
- Type system details
- Built-in functions
- Runtime semantics
- Module system design

✅ **ARCHITECTURE.md** (400+ lines)

- Component stack diagram
- Execution flow explanation
- Scope management
- Type system details
- Reasoning integration flow
- Error handling strategy
- Performance characteristics

✅ **BUILTINS.md** (450+ lines)

- Complete function reference
- Usage examples
- Return value documentation
- Performance notes
- Standard library plans

✅ **REASONING.md** (500+ lines)

- Systems reasoning overview
- Prompt blocks explained
- Model call configuration
- Structured output guide
- Memory system details
- Practical patterns
- Error handling
- Performance tips

✅ **ROADMAP.md** (400+ lines)

- V1.0 features (Complete)
- V1.5 improvements (Complete)
- V2.0 async & advanced reasoning (Q3-Q4 2026)
- V3.0 systems framework
- V4.0+ vision
- Community involvement
- Backwards compatibility

## 🎓 Example Programs

| File                                         | Demonstrates                                          |
| -------------------------------------------- | ----------------------------------------------------- |
| main/01_hello.sesi                           | Basic print                                           |
| main/02_variables.sesi                       | Variables and operations                              |
| main/03_functions.sesi                       | Functions, parameters, defaults                       |
| main/04_conditionals.sesi                    | If/else logic                                         |
| main/05_loops.sesi                           | While, for, for-in                                    |
| main/06_arrays_objects.sesi                  | Collections and indexing                              |
| main/07_prompts.sesi                         | Prompt blocks                                         |
| optional/08_model_call.sesi                  | Basic reasoning calls                                 |
| main/09_structured_output.sesi               | Structured output                                     |
| optional/10_code_generation.sesi             | Code generation                                       |
| main/11_memory_storage.sesi                  | Multi-turn with memory                                |
| main/12_classification.sesi                  | Classification                                        |
| main/13_data_pipeline.sesi                   | Data pipeline                                         |
| optional/14_folder_explainer.sesi            | Directory parsing & reasoning                         |
| optional/15_image_generation.sesi            | Image generation                                      |
| main/16_modules.sesi                         | Imports/exports & std namespaces                      |
| main/17_http_client.sesi                     | HTTP GET and POST operations                          |
| main/18_parallel_requests.sesi               | Parallel request concurrency                          |
| main/19_search_web.sesi                      | Web search integration                                |
| optional/20_model_aliases.sesi               | Custom model naming aliases                           |
| main/21_custom_tools.sesi                    | Custom runtime tool definitions                       |
| optional/22_reasoning_plus_custom_tools.sesi | Compose reasoning & tools                             |
| main/23_file_conversion.sesi                 | Document and media conversion via `convert()`         |
| main/24_http_server.sesi                     | Native async HTTP server (`listen`, `live`)           |
| main/24_http_handler.sesi                    | Dynamic routing HTTP handler                          |
| main/25_webpage_server.sesi                  | High-performance dynamic HTML site rendering          |
| main/26_database.sesi                        | Embedded Document Database (`std/db`) crud operations |
| main/27_robust_web_db.sesi                   | Secured combined API server backed by persistent DB   |
| optional/28_streaming.sesi                   | Streaming API responses                               |
| main/29_tool_piping.sesi                     | Tool-chaining and data pipelining                     |
| main/30_error_recovery.sesi                  | Robust error handling and retry policies              |
| main/31_synthesizer.sesi                     | Music and SVG native capabilities                     |

## 🔮 Future Directions

### V2: Async & Advanced Logic

- Async/await
- Streaming responses
- Advanced memory with embeddings
- finally blocks, custom error types, retry policies, timeout handling

### V3: Systems Framework

- System state machines
- Multi-process collaboration
- Knowledge base integration
- RAG (Retrieval-Augmented Generation)

### V4+: Scale & Optimization

- Bytecode compilation
- JIT compilation
- Distributed execution
- Cross-model orchestration

## 🧪 Testing Strategy

**Component Testing**

- Lexer: Token stream correctness
- Parser: AST structure correctness
- Interpreter: Evaluation correctness

**Example Coverage**

- 31 complete example programs
- Covers all major language features
- Demonstrates reasoning integration
- Real-world use cases

## 📖 Learning Path

1. **Start**: [QUICKSTART.md](QUICKSTART.md) - Get running in 5 minutes
2. **Builtins**: [BUILTINS.md](docs/BUILTINS.md) - Built-in functions
3. **CLI**: [CLI.md](docs/CLI.md) - Complete CLI flags & parametric execution guide
4. **Basics**: examples/main/01-06 - Core language features
5. **Prompts**: examples/main/07 - Prompt blocks
6. **Reasoning**: examples/optional/08, examples/main/09, examples/optional/10, examples/main/11-12 - Reasoning feature exploration
7. **Advanced**: [REASONING.md](docs/REASONING.md) - Patterns and best practices
8. **Systems**: examples/main/13, examples/optional/14 - Systems reasoning and data pipelines
9. **Modules**: examples/main/16 - Modules & std library namespaces
10. **Image Generation**: [IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md) examples/optional/15 - Generating images natively
11. **Concurrency**: examples/main/17-18 - Concurrency & coordination
12. **Web Search**: examples/main/19 - Web search integration
13. **Model Aliases**: examples/optional/20 - Custom model naming aliases
14. **Custom Tools**: examples/main/21, examples/optional/22 - Custom runtime tool definitions and compose reasoning with custom tools
15. **Specification**: [SPECIFICATION.md](docs/SPECIFICATION.md) - Complete grammar
16. **Architecture**: [ARCHITECTURE.md](docs/ARCHITECTURE.md) - How it works
17. **Roadmap**: [ROADMAP.md](docs/ROADMAP.md) - Future vision

## 🤝 Contributing Path

1. Report bugs with minimal examples
2. Suggest language features via RFCs
3. Add built-in functions
4. Improve documentation
5. Submit example programs
6. Help with test coverage

## 🎁 What's Included

- ✅ Bytecode compiler + VM (V2.0, expressions, loops, functions, closures, try/catch, imports)
- ✅ Tree-walking interpreter retained as fallback (3000+ lines of TypeScript)
- ✅ Full language specification (600+ lines)
- ✅ Architecture documentation (400+ lines)
- ✅ API reference (450+ lines)
- ✅ Systems reasoning guide (500+ lines)
- ✅ Development roadmap (400+ lines)
- ✅ 30+ example programs
- ✅ CLI executable
- ✅ Test suite
- ✅ Quick start guide

## 📝 Next Steps

1. **Build and install**: `npm install && npm run build && npm install -g .`
2. **Try examples**: `sesi examples/main/01_hello.sesi`
3. **Set up Reasoning**: Set GEMINI_API_KEY in `.env`
4. **Explore Reasoning**: `sesi examples/optional/08_model_call.sesi`
5. **Read docs**: Start with SPECIFICATION.md
6. **Write programs**: Create your own .sesi files
7. **Check roadmap**: See where language is headed

## 🚀 Philosophy

> "Sesi demonstrates that coding shouldn't need to be hard to understand, eliminating the boilerplate of traditional development and lowering the entry-level for those interested in code or programming."

The language is designed to evolve. V1+ provides a solid foundation. V2+ adds power. The architecture supports this gracefully without breaking existing programs.

---

**Status**: ⏳ In-Progress V2.0 implementation  
**Ready for**: File manipulation, process orchestration, and high-throughput scripting  
**Not ready for**: Massive-scale production (until V3.0+)  
**Next milestone**: V3.0 (Systems Framework & Knowledge Base)

Sesi is not just an experiment in language design. Use it to learn, explore, and evolve what the future of coding will become.

---

For more information, see the documentation in `docs/` and examples in `examples/`.
