# Sesi Systems Language Specification (v1.1)

## 1. Philosophy & Design Principles

Sesi is built on these core principles:

1. **High-Performance Systems Orchestration**: Designed for building resilient, stateful applications with first-class primitives for process management and filesystem orchestration.
2. **Reasoning as a First-Class Citizen**: Model calls, schema definitions, and tool orchestration are treated as language primitives rather than external SDK dependencies.
3. **Transparency Over Magic**: Explicit model calls with clear costs and latency, not hidden inference.
4. **Distributed State Management**: Optimized for coordination and state integrity using filesystem locking and concurrent `spawn()` patterns.
5. **Practical Over Perfect**: Focus on reducing boilerplate code for complex reasoning logic, emphasizing what developers actually need over complete generality.

## 2. Target Users

**Primary**: Developers building resilient, stateful applications that require systems-level orchestration alongside integrated reasoning.

**Secondary**: 
- Engineers transitioning from traditional languages (TypeScript, Python, Go)
- Developers building agentic swarms and distributed systems
- Teams requiring complex logic with a fraction of the boilerplate

**Use Cases**:
- Stateful multi-agent swarm orchestration
- High-performance data pipelines with structured extraction
- Concurrent process management and distributed locking
- Multi-stage reasoning workflows with stateful memory

## 3. V1.1 Feature Set (Current)

### Core Language Features
- ✅ Variables and bindings (`let`, `const`)
- ✅ Functions (named, anonymous)
- ✅ Conditionals (`if/else`)
- ✅ Loops (`while`, `for`)
- ✅ Error Handling (`try/catch` blocks)
- ✅ Data types (number, string, bool, array, object)
- ✅ Systems Orchestration (`spawn`, `exec`, `time`, `random`)
- ✅ Comments (`//`, `/* */`)
- ✅ Operators (arithmetic, logical, comparison)
- ✅ Standard library (print, len, range, etc.)

### Reasoning-Native Features
- ✅ `prompt` blocks (composable message templates)
- ✅ `model()` calls (invoke Gemini with configuration)
- ✅ `structured_output()` (schema-guided structured output with JSON recovery and empty-object fallback on failure)
- ✅ `tool_call()` (Fully functional function calling via models)
- ✅ Simple memory (conversation context)

### Type System
- ✅ Primitive types: `number`, `string`, `bool`, `null`
- ✅ Collection types: `array<T>`, `object<T>`
- ✅ Type inference
- ✅ Union types: `T | U`
- ✅ Optional types: `T?`

### Module System
- ✅ `import` / `export`
- ✅ Namespace support
- ✅ Built-in modules

## 4. Target Language (Syntax)

### 4.1 Lexical Elements

#### Keywords
```
let const if else while for fn return print import export 
prompt model memory structured_output tool_call break continue try catch true false null
```

#### Identifiers & Literals
```
identifier: [a-zA-Z_][a-zA-Z0-9_]*
number: [0-9]+ | [0-9]*\.[0-9]+
string: "..." | '...'
comment: // ... | /* ... */
```

### 4.2 Program Structure

```
program := statement*
statement := declaration | expression_statement | block_statement
```

### 4.3 Declarations

#### Variable Declaration
```
let_stmt := 'let' identifier ('=' expression)? (';' | newline)
const_stmt := 'const' identifier '=' expression (';' | newline)
```

Example:
```sesi
let x = 10
const y = 20
let z  // z is null initially
```

#### Function Declaration
```
fn_stmt := 'fn' identifier '(' parameters ')' '->' type? block
parameters := (identifier ':' type ('=' expr)?)? (',' identifier ':' type ('=' expr)?)*
```

Example:
```sesi
fn add(a: number, b: number) -> number {return a + b}
fn greet(name: string = "World") {print "Hello, " + name}
```

#### Import/Export
```
import_stmt := 'import' (identifier | '{' identifiers '}') 'from' string
export_stmt := 'export' (fn_stmt | let_stmt | const_stmt)
```

Example:
```sesi
import { add, subtract } from "math"
export fn multiply(a, b) { return a * b }
```

### 4.4 Control Flow

#### If Statement
```
if_stmt := 'if' expression block ('else' block)?
```

#### Loops
```
while_stmt := 'while' expression block
for_stmt := 'for' identifier 'in' expression block | 'for' identifier '=' expr 'to' expr block
```

#### Error Handling
```
try_stmt := 'try' block 'catch' '(' identifier ')' block
```

#### Loop Control
```
break_stmt := 'break'
continue_stmt := 'continue'
```

Example:
```sesi
for i = 0 to 10 {print i}
try {
  let result = model("Hello")
} catch (e) {
  print e
}
```

### 4.5 Expressions

#### Literals
```
literal := number | string | bool | null | array | object
array := '[' (expression (',' expression)*)? ']'
object := '{' (string ':' expression (',' string ':' expression)*)? '}'
```

#### Operators (Left to Right, Lowest to Highest Precedence)
```
expr := assignment
assignment := logical_or ('=' assignment)?
logical_or := logical_and ('||' logical_and)*
logical_and := equality ('&&' equality)*
equality := comparison (('==' | '!=') comparison)*
comparison := addition (('<' | '>' | '<=' | '>=' | '<>') addition)*
addition := multiplication (('+' | '-') multiplication)*
multiplication := unary (('*' | '/' | '%') unary)*
unary := ('!' | '-') unary | postfix
postfix := primary ('[' expression ']' | '.' identifier | '(' args? ')')*
primary := identifier | literal | '(' expression ')' | prompt | model | memory | call
```

#### Function Call
```
call := identifier '(' (expression (',' expression)*)? ')'
```

#### Prompt Block
```
prompt := 'prompt' identifier '{' content '}'
content := (string | expression | newline)+
```

Example:
```sesi
prompt codeReview {"Review this code for bugs:" code "Provide specific issues found."}
```

#### Model Call
```
model_call := 'model' '(' STRING ')' '{' config (optional) '}' '{' prompt '}'
            | 'model' '(' STRING ')' '{' prompt '}'
config := (STRING ':' expression (',' STRING ':' expression)*)?
```

Example:
```sesi
let result = model("gemini-3.1-flash-lite") {codeReview}
let output = model("gemini-3.1-flash-lite") {"temperature": 0.4, "max_tokens": 2000} {prompt}
```

#### Structured Output
```
structured_output := 'structured_output' '(' schema ')' '(' expression ')'
schema := '{' (identifier ':' type (',' identifier ':' type)*)? '}'
```

Example:
```sesi
let analysis = structured_output({sentiment: string, score: number, keywords: array<string>})(model("gemini-3.1-flash-lite") { analyzeText })
```

#### Tool Call
```
tool_call := 'tool_call' '(' function_name ')' '(' model_call ')'
```

#### Memory (State Management)
```
memory := 'memory' identifier ('{' expressions '}')?
```

Example:
```sesi
memory conversation {"Previous messages here"}
let response = model("gemini-3-flash-preview") {prompt {conversation "New question:" userInput}}
conversation = conversation + "Assistant: " + response
```

### 4.6 Type Annotations

```
type := primitive_type | collection_type | union_type | optional_type
primitive_type := 'number' | 'string' | 'bool' | 'null'
collection_type := 'array' '<' type '>' | 'object' '<' type '>'
union_type := type ('|' type)+
optional_type := type '?'
```

## 5. Expression Evaluation Rules

1. **Short-circuit evaluation**: `&&` and `||` short-circuit
2. **Type coercion**: Automatic for numeric operations; explicit for string/number
3. **Null propagation**: Operations on `null` return `null` (no exceptions in v1)
4. **Model responses**: Always returned as strings initially; structured_output provides type safety

## 6. Scope and Binding

- **Global scope**: Module level
- **Function scope**: Within function definitions
- **Block scope**: Within blocks (if/while/for)
- **Lexical scoping**: Inner scopes shadow outer scopes
- **Closure support**: Functions capture enclosing scope

## 7. Runtime Semantics

### Execution Order
1. Tokenize (lexer)
2. Parse (parser) → AST
3. Evaluate (interpreter)
4. Model calls are **blocking** (no async in v1)

### Memory Model
- **Stack**: Local variables, function parameters
- **Heap**: Arrays, objects, strings
- **Reasoning Context**: Implicit conversation history per `memory` binding

### Error Handling (V1 Simple)
- Runtime and model errors can be caught with `try/catch`
- Model errors throw when Gemini returns no text or a non-`STOP` finish reason
- `read_file()`, `write_file()`, and `list_dir()` throw on filesystem failure
- `structured_output()` currently logs parsing failures and returns `{}` if recovery fails

## 8. Built-in Functions (V1)

```
print(any)                    // Output to stdout
len(array | string | object)  // Length
range(number) -> array        // [0, 1, ..., n-1]
type(any) -> string           // Type name
str(any) -> string            // Convert to string
num(any) -> number            // Convert to number
bool(any) -> bool             // Convert to bool
keys(object) -> array         // Object keys
values(object) -> array       // Object values
push(array, any)              // Add element
pop(array) -> any             // Remove last
join(array, string) -> string // Join with separator
split(string, string) -> array // Split by separator
read_file(string) -> string    // Read file contents
write_file(string, string) -> bool // Write file contents
list_dir(string) -> array<string> // List directory contents
make_dir(string) -> bool          // Create directory (recursive)
spawn(string) -> number           // Concurrent process creation
exec(string) -> string            // Synchronous shell execution
time() -> number                  // Current Unix timestamp
random() -> number                // Random float (0.0 to 1.0)
```

## 9. Module System

Parser support for `import` / `export` syntax exists in v1.1, but runtime module execution is not implemented yet.

### Defining Modules
```sesi
// math.sesi
export fn add(a, b) { return a + b }
export fn multiply(a, b) { return a * b }
export const PI = 3.14159
```

### Importing Modules
```sesi
import { add, multiply, PI } from "math"
let result = add(10, 20)
```

### Built-in Modules
```sesi
import time from "std/time"    // Time/date functions
import math from "std/math"    // Math operations
import json from "std/json"    // JSON parsing
```

## 10. Reasoning Features Details

### Prompt Blocks

Prompts are composable message templates:

```sesi
prompt translate {"Translate the following to Spanish:" sourceText}
prompt summarize {"Summarize this in 3 sentences:" text}
prompt combined {summarize "Now translate:" translate}
```

### Model Calls

```sesi
let response = model("gemini-3-flash-preview") {"temperature": 0} {"Say hello"}
print response  // Returns string
```

### Structured Output

```sesi
let result = structured_output({title: string, category: string, confidence: number})(model("gemini-3.1-flash-lite") {"Extract metadata from this text:" text})
print result.title       // Access fields
print result.confidence  // Type-safe access
```

### Tool Calling

```sesi
fn calculateTax(amount: number, rate: number) {return amount * rate}
let taxAmount = tool_call(calculateTax)(model("gemini-3.1-flash-lite") {"Calculate 8% tax on $100"})
```

### Memory

```sesi
memory chat {"System: You are a helpful assistant."}
fn askQuestion(question: string) -> string 
{let response = model("gemini-3-flash-preview") {chat "User: " + question}
chat = chat + "Assistant: " + response
return response}
```

## 11. Examples

### Example 1: Simple Computation
```sesi
let x = 10
let y = 20
print x + y  // Output: 30
```

### Example 2: Function with Reasoning
```sesi
fn analyzeText(text: string) -> string {return model("gemini-3.1-pro-preview") {"temperature": 0} {"Analyze this text and return key insights:" text}}
print analyzeText("Reasoning is transforming industries")
```

### Example 3: Structured Output
```sesi
let sentiment = structured_output({label: string, score: number})(model("gemini-3-flash-preview") {"Analyze sentiment of:" userInput})
print sentiment.label
print sentiment.score
```

## 12. Undefined Behavior & Limitations (V1.1)

- **No async/await**: All operations within a script are blocking (including model calls). Concurrency must be achieved via `spawn()`.
- **No custom types**: Only built-in types are supported natively.
- **No pattern matching**: Basic if/else only.
- **No generics**: Array and object collections are untyped at runtime.
- **Limited introspection**: Basic type() only.
- **No macros**: No compile-time code generation.
- **Single-threaded runtime**: Execution per script is single-threaded. System-level concurrency is handled via multi-process `spawn()`.
- **No garbage collection tuning**: Rely on Node.js GC.

## 13. Compatibility Notes

- Sesi programs run on Node.js 18+
- Requires `@google/genai` SDK v1.33.0+
- Requires valid Gemini API key (GEMINI_API_KEY env var)
