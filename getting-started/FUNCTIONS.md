# Functions in Sesi

Functions are named, reusable blocks of logic declared with the `fn` keyword. They accept typed parameters, optionally return a value, and can capture the enclosing scope as closures.

---

## Declaration

```
fn_stmt := 'async'? 'fn' identifier '(' parameters ')' '->' type? block
parameters := (identifier ':' type ('=' expr)?)? (',' identifier ':' type ('=' expr)?)*
```

```sesi
fn greet(name: string) {
  print "Hello," name
}

greet("Ada")   // Hello, Ada
```

> **Note:** There are no `function`, `def`, or `func` keywords. Always use `fn`.

---

## Parameters

### Typed Parameters

Parameter types are optional but recommended for clarity:

```sesi
fn add(a: number, b: number) {
  return a + b
}

print add(10, 5)   // 15
```

### Default Parameters

Parameters can have default values. They are used when the caller omits that argument:

```sesi
fn greet(name: string = "World") {
  print "Hello," name
}

greet()        // Hello, World
greet("Sesi")  // Hello, Sesi
```

### Untyped Parameters

Types can be omitted entirely for quick utility functions:

```sesi
fn double(x) {
  return x * 2
}
```

### Type Aliases

`num` and `str` are valid aliases for `number` and `string` in parameter lists:

```sesi
fn format(label: str, value: num) {
  return label + ": " + str(value)
}
```

---

## Return Values

Use `return` inside a `fn` block to send a value back to the caller. `return` is **only valid inside `fn` blocks** — it is not a top-level statement.

```sesi
fn square(x: number) {
  return x * x
}

let result = square(9)
print result   // 81
```

A function without an explicit `return` produces `null`.

### Return Type Annotations

Annotate the return type with `->` after the parameter list:

```sesi
fn multiply(a: number, b: number) -> number {
  return a * b
}

fn status(ok: bool) -> string {
  if ok { return "ok" }
  return "failed"
}
```

---

## Calling Functions

Call a function by name with arguments in parentheses:

```sesi
fn sum(a, b) { return a + b }

let total = sum(3, 7)
print total   // 10
```

---

## Closures

Functions capture variables from the surrounding scope at definition time. The captured binding is **live** — mutations to the outer variable are visible inside the function:

```sesi
let base = 100

fn addBase(n) { return n + base }

print addBase(5)   // 105
base = 200
print addBase(5)   // 205
```

---

## Functions as Values

Functions are first-class values. You can pass them as arguments to other functions — this is the foundation of `map`, `filter`, `reduce`, and `find`:

```sesi
fn isEven(x) { return x % 2 == 0 }

let numbers = [1, 2, 3, 4, 5, 6]
let evens   = filter(numbers, isEven)   // [2, 4, 6]
```

```sesi
fn square(x)     { return x * x }
fn sum(acc, x)   { return acc + x }

let nums    = [1, 2, 3, 4, 5]
let squares = map(nums, square)     // [1, 4, 9, 16, 25]
let total   = reduce(nums, sum)     // 15
```

---

## The Pipe Operator

The `|` operator passes the result of the left expression as the **first argument** to the function on the right. Use it to compose a chain of transformations without nesting:

```sesi
fn add(a, b) { return a + b }
fn mul(a, b) { return a * b }

// 10 → add(5) → 15 → mul(2) → 30
let result = 10 | add(5) | mul(2)
print result   // 30
```

---

## Async Functions

Prefix `fn` with `async` to declare a function that returns a Sesi Promise. Use `await` at the call site to block and resolve the value:

```sesi
async fn fetchGreeting(name: string) {
  return "Hello, " + name
}

let p        = fetchGreeting("Sesi")   // Promise
let greeting = await p                 // "Hello, Sesi"
print greeting
```

> **Note:** Model calls inside a script are blocking by default. `async`/`await` is used when you explicitly want deferred execution.

---

## Exporting Functions

Mark a function with `export` to make it importable from other `.sesi` files:

```sesi
// logger.sesi
export fn info(message: string) {
  print "[INFO]" message
}

export fn warn(message: string) {
  print "[WARN]" message
}
```

Import it in another script using `allow ... in with`:

```sesi
allow "logger" in with {info, warn}

info("Script started")
warn("Using default configuration")
```

```
allow "logger" in with log

log.info("Script started")
log.warn("Using default configuration")
```

---

## Quick Reference

```sesi
// Basic function
fn greet(name: string) { print "Hello," name }
greet("Ada")

// With return value and type annotation
fn add(a: number, b: number) -> number { return a + b }
let sum = add(3, 7)

// Default parameter
fn greet(name: string = "World") { print "Hello," name }
greet()

// Untyped
fn double(x) { return x * 2 }

// First-class — pass as argument
fn isEven(x) { return x % 2 == 0 }
let evens = filter([1, 2, 3, 4], isEven)

// Pipe composition
let result = 10 | add(5) | double

// Async
async fn load(path: string) { return read_file(path) }
let content = await load("data.txt")

// Export
export fn compute(x: number) -> number { return x * x }
```

---
