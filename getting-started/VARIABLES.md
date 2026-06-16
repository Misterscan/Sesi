# Variables in Sesi

Variables are the fundamental way to store and name values in Sesi. They are declared with the `let` keyword and follow lexical (block) scoping rules.

---

## Declaration

```
let_stmt := 'let' identifier ('=' expression)? (';' | newline)
```

All variables are declared with `let`. There is no `const`, `var`, or any other binding keyword.

```sesi
let name = "Sesi"
let version = 2
let active = true
let missing        // declared but uninitialized — value is null
```

> **Note:** `const` is forbidden in Sesi. All bindings are mutable by design.

---

## Assignment & Mutation

After declaration, a variable can be reassigned using `=` without repeating `let`.

```sesi
let count = 0
count = count + 1
count = count + 1
print count        // 2
```

Object fields and array elements can also be mutated directly:

```sesi
let scores = [10, 20, 30]
scores[0] = 99
print scores       // [99, 20, 30]

let user = {"name": "Ada", "role": "admin"}
user["role"] = "developer"
print user["name"] // Ada
```

---

## Types

Sesi infers the type of a variable from its assigned value. The primitive types are:

| Type     | Alias | Example                        |
| -------- | ----- | ------------------------------ |
| `number` | `num` | `let x = 42` / `let pi = 3.14` |
| `string` | `str` | `let msg = "hello"`            |
| `bool`   | —     | `let ready = true`             |
| `null`   | —     | `let empty = null`             |

Collection types are also supported:

```sesi
let tags = ["sesi", "lang", "v2"]          // array
let config = {"theme": "dark", "limit": 20} // object
```

### Type Aliases

`num` is interchangeable with `number`, and `str` is interchangeable with `string`. These aliases are most useful inside function signatures:

```sesi
fn double(x: num) -> num { return x * 2 }
fn greet(name: str) { print "Hello," name }
```

### The `any` Type

`any` accepts any value and bypasses type checking. Use it in function signatures when the argument type is genuinely variable:

```sesi
fn display(value: any) { print value }
```

### Optional Types (`T?`)

Append `?` to mark a parameter as optional (value may be `null`):

```sesi
fn greet(name: str, title: str?) {
  if title { print title name }
  else { print name }
}
```

### Union Types (`T | U`)

A variable or parameter can hold one of several types:

```sesi
fn show(value: number | string) { print value }
```

---

## Type Conversion

Explicit conversion is done with the built-in cast functions:

```sesi
let raw = "42"
let n   = num(raw)      // 42  (number)
let s   = str(n)        // "42" (string)
let b   = bool(0)       // false
```

These are the only valid conversion primitives. Do **not** use `parseInt`, `Number()`, or any JavaScript-style coercion.

---

## Scope & Binding Rules

Sesi uses **lexical (block) scoping**. A variable is visible from its declaration point to the end of the block it lives in.

| Scope Level    | Description                                  |
| -------------- | -------------------------------------------- |
| Global scope   | Top-level module declarations                |
| Function scope | Variables declared inside a `fn` block       |
| Block scope    | Variables inside `if`, `while`, `for` blocks |

Inner scopes **shadow** outer scopes — declaring a `let` with the same name inside a block creates a new binding without affecting the outer one.

```sesi
let x = 10

fn example() {
  let x = 99   // shadows the outer x
  print x      // 99
}

example()
print x        // 10
```

**Closures** are supported. Functions capture the enclosing scope at definition time:

```sesi
let base = 100

fn addBase(n) { return n + base }

print addBase(5)   // 105
base = 200
print addBase(5)   // 205 — closes over the live binding
```

---

## Built-in Global Variables

Sesi exposes one built-in global variable available in every script:

| Variable | Type            | Description                                                                                     |
| -------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `args`   | `array<string>` | Command-line arguments passed to the script (excludes runtime flags and the script path itself) |

```sesi
// Run as: sesi myscript.sesi Alice 30
let name = args[0]   // "Alice"
let age  = args[1]   // "30"
print "Hello," name
```

---

## Uninitialized Variables

Declaring a `let` without a value sets it to `null`. Operations on `null` propagate `null` rather than throwing (v1.x behavior):

```sesi
let pending
print pending          // null
print pending + 1      // null
```

---

## Quick Reference

```sesi
// Primitive bindings
let count   = 3
let title   = "Daily Report"
let ready   = true
let missing = null

// Collections
let scores  = [10, 20, 30]
let profile = {"name": "Ada", "role": "developer"}

// Reassignment
count = count + 1

// Type conversion
let raw    = "42"
let answer = num(raw)

// CLI args
let input_path  = args[0]
let output_path = args[1]
```

---
