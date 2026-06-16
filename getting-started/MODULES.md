# Modules in Sesi

Modules let you split code across `.sesi` files and reuse it. Use `export` to expose values from a file and `import` or `allow` to bring them in.

---

## Exporting

Mark any `let` binding or `fn` declaration with `export` to make it available to other files:

```sesi
// math.sesi
export fn add(a, b) { return a + b }
export fn multiply(a, b) { return a * b }
export let PI = 3.14159
```

Only exported names are visible to importers. Everything else stays private to the file.

---

## Importing — `import`

Pull named exports directly into the current scope:

```sesi
import {
  add,
  multiply,
  PI
} from "math"

print add(10, 20)   // 30
print PI            // 3.14159
```

---

## Importing — `allow`

`allow` is Sesi's scoped import syntax. It has two forms:

### Named bindings

Import specific exports directly into scope:

```sesi
allow "math" in with {
  add, multiply
}

print add(3, 4)   // 7
```

### Namespace object

Import the entire module under a single identifier:

```sesi
allow "math" in with Math

print Math.add(3, 4)      // 7
print Math.multiply(2, 5) // 10
```

---

## Standard Library Modules

Sesi ships with built-in standard library modules:

| Module     | Namespace | Description         |
| ---------- | --------- | ------------------- |
| `std/math` | `Math`    | Math operations     |
| `std/time` | `Time`    | Time/date functions |
| `std/json` | `JSON`    | JSON parsing        |
| `std/db`   | —         | Database access     |

```sesi
allow "std/math" in with Math
allow "std/time" in with Time
allow "std/json" in with JSON

print Math.PI
print Time.now()
print JSON.parse("[1,2,3]")
```

---

## Module Resolution Order

When you import `"mymodule"`, Sesi searches for `mymodule.sesi` in this order:

| Priority | Location                  | Description                                                           |
| -------- | ------------------------- | --------------------------------------------------------------------- |
| 1        | Script's own directory    | Same folder as the running `.sesi` file                               |
| 2        | Current working directory | Where you ran `sesi` from                                             |
| 3        | `SESI_PATH`               | Colon-separated (Unix) or semicolon-separated (Windows) list of paths |
| 4        | `~/.sesi/lib`             | Global shared library, available system-wide                          |

---

## Global Library (`~/.sesi/lib`)

Copy a module to the global library to make it importable from any project on your system:

```bash
# macOS / Unix
cp mymodule.sesi ~/.sesi/lib/
```

```powershell
# Windows
copy mymodule.sesi $env:USERPROFILE\.sesi\lib\
```

```sesi
// Now importable from anywhere
allow "mymodule" in with { helper, util }
```

---

## Custom Paths (`SESI_PATH`)

Point `SESI_PATH` to additional directories for team or monorepo setups:

```bash
# macOS / Unix
export SESI_PATH="/mylibs/shared:/projects/common"
```

```powershell
# Windows
$env:SESI_PATH = "C:\MyLibs\shared;C:\Projects\common"
```

---

## Quick Reference

```sesi
// Export
export fn greet(name) { print "Hello," name }
export let VERSION = "2.0"

// import (named)
import { greet, VERSION } from "mymodule"

// allow (named bindings)
allow "mymodule" in with { greet, VERSION }

// allow (namespace)
allow "mymodule" in with Mod
Mod.greet("Ada")

// Standard library
allow "std/math" in with Math
allow "std/time" in with Time
allow "std/json" in with JSON
```

---
