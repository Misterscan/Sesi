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
  print "excellent"
}
```

The block only runs when the condition is truthy. If the condition is false and there is no `else`, execution continues after the block.

---

## `if / else`

```sesi
let ready = false

if ready {
  print "starting"
} else {
  print "not ready yet"
}
```

---

## `else if` Chains

Chain additional conditions with `else if`. Sesi evaluates each branch top to bottom and runs the first one that matches:

```sesi
let score = 72

if score >= 90 {
  print "excellent"
} else if score >= 70 {
  print "passing"
} else if score >= 50 {
  print "marginal"
} else {
  print "needs work"
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
  print "Title:" title
} else {
  print "No title provided"
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

if x == 10  { print "ten" }
if x != 0   { print "non-zero" }
if x >= 5   { print "at least five" }
```

---

## Logical Operators

Combine conditions with `&&` (and), `||` (or), and `!` (not). Both `&&` and `||` short-circuit.

```sesi
let age  = 25
let paid = true

if age >= 18 && paid {
  print "access granted"
}

if age < 13 || !paid {
  print "access denied"
}
```

---

## One-liner Blocks

Block braces can be condensed onto a single line:

```sesi
if ready { print "go" }
if !ready { print "wait" }
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

print classify(95)   // excellent
print classify(74)   // passing
print classify(40)   // needs work
```

---

## Quick Reference

```sesi
// Basic if
if x > 0 { print "positive" }

// if / else
if active { print "on" } else { print "off" }

// else if chain
if score >= 90 {
  print "A"
} else if score >= 70 {
  print "B"
} else {
  print "C"
}

// Truthiness check
if value { print "has value" }

// Logical operators
if a > 0 && b > 0 { print "both positive" }
if a == 0 || b == 0 { print "at least one is zero" }
if !flag { print "flag is off" }
```

---
