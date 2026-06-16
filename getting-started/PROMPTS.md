# Prompt Blocks in Sesi

A `prompt` block is Sesi's string composition primitive. It lets you assemble a named string from literals and variables — similar to template literals in other languages — without concatenation operators.

---

## Declaration

```
prompt := 'prompt' identifier '{' content '}'
content := (string | expression)*
```

Place string literals and variable names sequentially inside the braces. Sesi joins them automatically:

```sesi
let name    = "Ada"
let version = "2.0"

prompt header {"Welcome to Sesi" version ". Hello," name}
```

`header` now holds the composed string `"Welcome to Sesi 2.0. Hello, Ada"`.

> **Rule:** Raw newlines **between elements** (outside of a string literal) inside `{ }` are a syntax error — they are treated as statement separators. Newlines that live inside a string literal are fine.

---

## Printing a Prompt

A prompt block is a value. Pass it to `print` like any other variable:

```sesi
let lang = "Sesi"
let ver  = "2.0"

prompt title {"Welcome to" lang ver}

print title   // Welcome to Sesi 2.0
```

---

## Using a Prompt as a String

Prompts resolve to plain strings and can be used anywhere a string is expected:

```sesi
let user = "Ada"

prompt greeting {"Hello," user ". Glad you're here."}

write_file("welcome.txt", greeting)
```

---

## Multiline Content

A literal newline inside a string literal spans the prompt across lines:

```sesi
let name  = "Ada"
let score = 98

prompt report {"Student: " name "
Score: " score "
Grade: A"}

print report
// Student: Ada
// Score: 98
// Grade: A
```

---

## Composing Prompts from Other Prompts

A prompt can reference another prompt by name, building up complex strings in layers:

```sesi
let first = "Ada "
let last  = "Lovelace"

prompt fullName {first last}
prompt badge {"[Developer]" fullName}

print badge   // [Developer] Ada Lovelace
```

---

## Prompts vs. `+` Concatenation

Both produce the same result. Prefer prompt blocks for readability when combining several pieces:

```sesi
let name = "Ada"
let role = "admin"

// Using +
let line1 = "User: " + name + " | Role: " + role

// Using prompt
prompt line2 {"User:" name "| Role:" role}
```

> **Preferred:** Avoid `+` inside `print` statements and prompt blocks. Sequential placement is idiomatic Sesi.

---

## Quick Reference

```sesi
// Declare
prompt title {"Hello," name "— version" version}

// Print directly
print title

// Use as a string value
write_file("out.txt", title)

// Multiline newlines inside string literals
prompt report {"Name: " name "
Score: " score}

// Compose from other prompts
prompt full  {first last}
prompt badge {"[Admin]" full}
```

---
