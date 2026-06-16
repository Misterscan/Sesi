# Loops in Sesi

Sesi has three loop forms: `while` for condition-based repetition, `for ... in` for iterating over arrays, and `for ... = ... to ...` for numeric ranges. All three use the same brace block syntax.

---

## `while`

```
while_stmt := 'while' expression block
```

The block repeats as long as the condition remains truthy:

```sesi
let i = 0

while i < 5 {
  print i
  i = i + 1
}
// 0 1 2 3 4
```

Condensed one-liner form is valid:

```sesi
let x = 10
while x > 0 { x = x - 1 }
print x   // 0
```

> **Note:** Always make sure the condition eventually becomes falsy, or the loop will run forever.

---

## `for ... in` — Iterating Arrays

```
for_stmt := 'for' identifier 'in' expression block
```

Use `for ... in` to visit each element of an array in order:

```sesi
let names = ["Ada", "Grace", "Linus"]

for name in names {
  print "Hello," name
}
```

The loop variable (`name` above) is scoped to the block body.

### Iterating Object Keys

Combine `for ... in` with `keys()` to walk an object's entries:

```sesi
let config = {"theme": "dark", "limit": 20, "debug": false}

for key in keys(config) {
  print key ":" config[key]
}
```

---

## `for ... = ... to ...` — Numeric Range

```
for_stmt := 'for' identifier '=' expr 'to' expr block
```

Use the range form for a known number of iterations. The counter starts at the left value and increments by 1 up to, but **not including**, the right value:

```sesi
for i = 0 to 5 {
  print i
}
// 0 1 2 3 4
```

Use `range()` when you need an array of indices instead of an inline range:

```sesi
let indices = range(5)   // [0, 1, 2, 3, 4]

for i in indices {
  print "Step" i
}
```

---

## `break` — Exit a Loop Early

`break` immediately stops the current loop and continues execution after it:

```sesi
let items = ["lint", "test", "build", "deploy"]

for item in items {
  if item == "build" {
    break
  }
  print item
}
// lint
// test
```

---

## `continue` — Skip to the Next Iteration

`continue` skips the rest of the current iteration and moves to the next one:

```sesi
for i = 0 to 6 {
  if i % 2 == 0 {
    continue
  }
  print i
}
// 1 3 5
```

---

## Accumulating Results

Declare an accumulator variable before the loop and update it inside:

```sesi
let total = 0
let scores = [10, 20, 30, 40]

for score in scores {
  total = total + score
}

print "Total:" total   // 100
```

Building an array inside a loop:

```sesi
let results = []
let files   = list_dir(".")

for file in files {
  if contains(file, ".sesi") {
    push(results, file)
  }
}

print "Sesi files found:" len(results)
```

---

## Nested Loops

Loops can be nested freely. Each `break` or `continue` affects only the innermost loop it belongs to:

```sesi
for i = 0 to 3 {
  for j = 0 to 3 {
    if j == 2 { break }   // only breaks the inner loop
    print i j
  }
}
```

---

## Quick Reference

```sesi
// while — condition-based
let i = 0
while i < 10 { i = i + 1 }

// for ... in — iterate array
let names = ["Ada", "Grace"]
for name in names { print name }

// for ... in — iterate object keys
for key in keys(config) { print key config[key] }

// for range — numeric
for i = 0 to 5 { print i }

// range() as array
for i in range(5) { print i }

// break
for item in items {
  if item == "stop" { break }
  print item
}

// continue
for i = 0 to 10 {
  if i % 2 == 0 { continue }
  print i
}

// accumulate
let total = 0
for n in numbers { total = total + n }
```

---
