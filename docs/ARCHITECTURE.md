# Sesi Runtime Architecture

## Overview

**Sesi** is a high-performance **Systems Language** designed for building resilient, stateful applications. It uses a tree-walking interpreter model with asynchronous host-side model execution, but no language-level `async/await` syntax in v1. The architecture is optimized for coordination, distributed state management, and first-class reasoning primitives.

## Component Stack

```
┌─────────────────────────────────────────────┐
│         Sesi Program (.sesi file)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Lexer (src/lexer.ts)                   │
│  Converts source text → Tokens              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Parser (src/parser.ts)                 │
│  Converts Tokens → Abstract Syntax Tree     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Interpreter (src/interpreter.ts)       │
│  Tree-walking interpreter                   │
│  - Evaluates expressions                    │
│  - Executes statements                      │
│  - Manages scopes/environments              │
└──────┬───────────────────────┬──────────────┘
       │                       │
       │                       │
┌──────▼──────────────┐  ┌────▼────────────────┐
│ Builtins            │  │ AI Runtime          │
│ (src/builtins.ts)   │  │ (src/ai-runtime.ts) │
│                     │  │                     │
│ - print()           │  │ - Gemini API calls  │
│ - len()             │  │ - Memory mgmt       │
│ - read_file()       │  │ - Structured output │
│ - write_file()      │  │ - Tool calling      │
│ - spawn()           │  │                     │
│ - exec()            │  │                     │
│ - time()            │  │                     │
│ - random()          │  │                     │
│ - etc.              │  │                     │
└─────────────────────┘  └────┬────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Gemini API        │
                    │  (@google/genai)   │
                    └────────────────────┘
```

## Execution Flow

### 1. Lexical Analysis (Lexer)

- **Input**: Source code string
- **Process**: Character-by-character tokenization
  - Identifier and keyword recognition
  - Number and string literal parsing
  - Operator and delimiter recognition
  - Comment stripping
- **Output**: Token stream

**Example**:

```
Source: let x = 10
Tokens: [LET, IDENTIFIER("x"), EQUAL, NUMBER(10), EOF]
```

### 2. Parsing (Parser)

- **Input**: Token stream
- **Process**: Recursive descent parsing
  - Statement parsing (declarations, control flow)
  - Expression parsing (operators, function calls, AI constructs)
  - AST construction
  - Error recovery
- **Output**: Abstract Syntax Tree (AST)

**Example AST Node**:

```javascript
{
  type: 'LetStatement',
  name: 'x',
  value: {
    type: 'Literal',
    value: 10,
    rawType: 'number'
  }
}
```

### 3. Interpretation (Interpreter)

- **Input**: AST
- **Process**: Recursive tree evaluation
  - Statement execution in order
  - Expression evaluation with proper operator precedence
  - Environment/scope management with lexical scoping
  - Blocking host-side async calls for AI operations
  - Control flow (return, break, continue)
- **Output**: Program side effects (print, AI calls, etc.)

## Scope and Environment Management

Sesi uses **lexical scoping** with an environment chain:

```
┌─────────────────────────┐
│  Global Environment     │
│  - Built-in functions  │
│  - Global variables    │
└────────┬────────────────┘
         │
    ┌────▼────────────────┐
    │ Function Environment │
    │ - Parameters         │
    │ - Local variables    │
    └────┬─────────────────┘
         │
    ┌────▼────────────────┐
    │  Block Environment  │
    │  - Block variables  │
    └─────────────────────┘
```

### Environment Lookup

1. Check current environment
2. Walk up parent chain until found
3. If not found anywhere, error

### Variable Assignment

1. Try to update in current scope
2. If not in current scope, try parent scopes
3. Update in the scope where variable was found

## Type System

Sesi has a **dynamic type system** with runtime type checking:

```
RuntimeValue =
  | number
  | string
  | boolean
  | null
  | Array<RuntimeValue>
  | Object<string, RuntimeValue>
  | RuntimeFunction
  | RuntimeModule
```

### Type Coercion Rules

**String Concatenation** (operator `+`):

```
"Hello" + 5        → "Hello5"
"Age: " + 30       → "Age: 30"
any + string       → toString(any) + string
string + any       → string + toString(any)
```

**Numeric Operations**:

```
10 + 20            → 30
"10" + 20          → "1020" (not numeric!)
```

**Truthiness**:

```
null   → false
false  → false
0      → false
""     → false
[]     → true
{}     → true
```

## AI Integration

### AI Runtime Lifecycle

1. **Initialization**:
   - Load @google/genai SDK
   - Validate GEMINI_API_KEY environment variable
2. **During Execution**:
   - Parse model calls from AST
   - Construct prompt from string concatenation
   - Make async API call to Gemini

- Wait for response (blocking in v1)
- Validate finish reason and non-empty text
- Return text response to program or throw

3. **Memory Management**:
   - Simple string buffers per memory ID
   - Append/update operations
   - Passed to next model call

### Model Call Flow

```
ModelCallExpression (AST)
    │
    ├─ Evaluate prompt expression
    ├─ Extract configuration (temperature, max_tokens)
    ├─ Call AIRuntime.callModel()
    │   │
    │   ├─ Create Gemini interaction request
    │   ├─ Send to Gemini API
    │   ├─ Wait for response
    │   ├─ Validate finish reason == STOP
    │   └─ Extract text from response
    │
    └─ Return text to program or throw
```

## Error Handling (V1)

Sesi now has basic exception-style error handling in v1:

1. **Parse Errors**: Parser logs the error and synchronizes to continue parsing later statements.
2. **Runtime Errors**: Interpreter errors throw and can be caught with `try/catch`.
3. **Built-in I/O Errors**: `read_file()`, `write_file()`, and `list_dir()` throw on filesystem failure.
4. **AI Errors**: `model()` throws when the SDK fails, when no text is returned, or when Gemini reports a non-`STOP` finish reason such as `MAX_TOKENS`.
5. **Structured Output**: `structured_output()` attempts recovery, but currently logs parsing failures and returns `{}` if coercion still fails.

## Memory Model

### Stack

- Local variables
- Function parameters
- Scope frames

### Heap

- Arrays (dynamic)
- Objects (key-value maps)
- Strings (immutable)

### AI Context

- Conversation memory per memory ID
- String buffers, not structured storage

## Performance Characteristics

| Operation       | Time  | Notes                     |
| --------------- | ----- | ------------------------- |
| Variable lookup | O(n)  | n = scope depth           |
| Array access    | O(1)  | Direct indexing           |
| Object access   | O(1)  | Map lookup                |
| Function call   | O(1)  | + body execution          |
| Model call      | ~2-5s | Depends on Gemini latency |
| Array iteration | O(n)  | Foreach loop              |

## Limitations (V1)

- **Interpreter Single-threaded**: Each individual Sesi process is single-threaded.
- **Process-level Concurrency**: Sesi uses a multi-process model via `spawn()` for concurrent task execution.
- **No optimization**: No bytecode or JIT.
- **Simple type system**: Runtime checking only.
- **No macro system**: No compile-time code generation
- **No introspection**: Can't inspect function bodies
- **Limited error info**: Basic error messages

## Future Architecture (V2+)

### V2 Planned Improvements

- Async/await syntax for concurrent AI calls
- Bytecode compiler for faster execution
- Advanced error handling with stack traces
- Streaming response support
- Function composition and piping

### V3+ Vision

- Agent framework with state machines
- Knowledge base integration
- Advanced memory with embedding search
- Multi-agent orchestration
- Custom type definitions
- Macro system

## Code Organization

```
memory.md                 # AI-agent workspace context and repo guardrails
index.html                # Sesi-generated landing page
eslint.config.mjs         # ESLint configuration
dist/                     # Compiled TypeScript output
example.js                # Helper script to run basic examples
example-ai.js             # Helper script to run AI examples
package.json              # Dependencies & scripts
tsconfig.json             # TypeScript configuration
QUICKSTART.md             # Quick start guide
IMPLEMENTATION_SUMMARY.md # Progress and tracking
README.md                 # Project overview

src/
├── types.ts              # Type definitions and AST
├── lexer.ts              # Tokenization
├── parser.ts             # AST generation
├── interpreter.ts        # Execution engine
├── ai-runtime.ts         # Gemini integration
├── builtins.ts           # Built-in functions
└── index.ts              # Main entry point

bin/
└── sesi.js               # CLI executable

main/                     # Main user scripts and debugging
├── main.sesi             # Main playground script
├── build_website.sesi    # Sesi-generated landing page builder
└── tests/                # Additional syntax validation scripts

examples/
├── 01_hello.sesi         # Basic example
├── 02_variables.sesi     # Variables & operations
├── 03_functions.sesi     # Functions with parameters
├── 04_conditionals.sesi  # If/else control flow
├── 05_loops.sesi         # Loops & iteration
├── 06_arrays_objects.sesi# Arrays & objects
├── 07_prompts.sesi       # Prompts and string templating
├── 08_model_call.sesi    # Basic AI model calls
├── 09_structured_output.sesi # Schema-guided structured output with JSON recovery and empty-object fallback on failure
├── 10_code_generation.sesi   # AI-powered code gen
├── 11_memory_conversation.sesi # AI conversations
├── 12_classification.sesi    # Classification
└── 13_data_pipeline.sesi     # Pipeline demo

docs/
├── SPECIFICATION.md      # Language spec
├── ARCHITECTURE.md       # This file
├── BUILTINS.md           # Built-in reference
├── COMPARISON.md         # Language comparison showcase
├── SYSTEMS_REASONING.md  # Integrated reasoning guide
├── DISTRIBUTED_SYSTEMS.md # Swarm & coordination guide
└── ROADMAP.md            # Future plans

tests/
└── basic.test.ts         # Test suite
```

## Workspace Context File

The root-level `memory.md` file is part of the practical repo architecture. It is not consumed by the Sesi runtime, but it is intended to guide AI-assisted development in this workspace.

It defines repo-specific operating rules such as valid Sesi assumptions, normal execution via the global `sesi` command, and the fact that `main/` and `main/tests/` are intentional user workspace areas rather than anomalies.

## Testing Strategy

**Unit Tests** (per component):

```typescript
// Lexer: tokenization correctness
// Parser: AST structure correctness
// Interpreter: evaluation correctness
// AI Runtime: Gemini integration
```

**Integration Tests**:

```typescript
// Full program execution
// Complex AI workflows
// Error handling
```

**Example Programs**:

- Basic arithmetic and control flow
- Functions and scoping
- Arrays and objects
- AI model calls
- Structured output parsing
- Memory-based conversations

## Debugging

### Debug Output

Enable debug logging (future):

```bash
SESI_DEBUG=1 sesi program.sesi
```

### AST Visualization

Print AST (future):

```bash
sesi --ast program.sesi
```

### Token Stream

Print tokens (future):

```bash
sesi --tokens program.sesi
```

## Conclusion

Sesi's architecture prioritizes **clarity and simplicity** over performance. The tree-walking interpreter is ideal for:

- Easy debugging
- Simple extensions
- Clear control flow
- Smooth AI integration

As the language matures, optimizations can be added without changing the API.
