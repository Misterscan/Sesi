# Conditionals in Sesi

Sesi uses `if` and `else` for branching. The condition is any expression that evaluates to a truthy or falsy value — no parentheses required.

---

## Basic `if`

```
if_stmt := 'if' expression block ('else' block)?
```

```sesi
let score = 87

if score >= 90 {
  show "excellent"
}
```

The block only runs when the condition is truthy. If the condition is false and there is no `else`, execution continues after the block.

---

## `if / else`

```sesi
let ready = false

if ready {
  show "starting"
} else {
  show "not ready yet"
}
```

---

## `else if` Chains

Chain additional conditions with `else if`. Sesi evaluates each branch top to bottom and runs the first one that matches:

```sesi
let score = 72

if score >= 90 {
  show "excellent"
} else if score >= 70 {
  show "passing"
} else if score >= 50 {
  show "marginal"
} else {
  show "needs work"
}
```

---

## Truthy & Falsy Values

Sesi follows straightforward truthiness rules:

| Value              | Truthy? |
| ------------------ | ------- |
| `true`             | ✅ yes  |
| Any non-zero number | ✅ yes  |
| Non-empty string   | ✅ yes  |
| Non-empty array    | ✅ yes  |
| Non-empty object   | ✅ yes  |
| `false`            | ❌ no   |
| `0`                | ❌ no   |
| `""`               | ❌ no   |
| `null`             | ❌ no   |

This means you can test for the presence of a value directly — no `!= null` required:

```sesi
let title = args[0]   // may be null if no arg passed

if title {
  show "Title:" title
} else {
  show "No title provided"
}
```

---

## Comparison Operators

| Operator | Meaning                  |
| -------- | ------------------------ |
| `==`     | Equal                    |
| `!=`     | Not equal                |
| `<`      | Less than                |
| `>`      | Greater than             |
| `<=`     | Less than or equal       |
| `>=`     | Greater than or equal    |
| `<>`     | Not equal (alternate)    |

```sesi
let x = 10

if x == 10  { show "ten" }
if x != 0   { show "non-zero" }
if x >= 5   { show "at least five" }
```

---

## Logical Operators

Combine conditions with `&&` (and), `||` (or), and `!` (not). Both `&&` and `||` short-circuit.

```sesi
let age  = 25
let paid = true

if age >= 18 && paid {
  show "access granted"
}

if age < 13 || !paid {
  show "access denied"
}
```

---

## One-liner Blocks

Block braces can be condensed onto a single line:

```sesi
if ready { show "go" }
if !ready { show "wait" }
```

---

## Conditionals Inside Functions

`if`/`else` is commonly used inside `fn` blocks to control what gets returned:

```sesi
fn classify(score: number) -> string {
  if score >= 90 { return "excellent" }
  if score >= 70 { return "passing" }
  return "needs work"
}

show classify(95)   // excellent
show classify(74)   // passing
show classify(40)   // needs work
```

---

## Quick Reference

```sesi
// Basic if
if x > 0 { show "positive" }

// if / else
if active { show "on" } else { show "off" }

// else if chain
if score >= 90 {
  show "A"
} else if score >= 70 {
  show "B"
} else {
  show "C"
}

// Truthiness check
if value { show "has value" }

// Logical operators
if a > 0 && b > 0 { show "both positive" }
if a == 0 || b == 0 { show "at least one is zero" }
if !flag { show "flag is off" }
```

---
