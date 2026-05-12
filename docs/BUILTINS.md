# Sesi Built-in Functions Reference

## I/O Functions

### print(...args)

Print values to standard output, separated by spaces.

```sesi
print "Hello"
print 42
print "Value:", 10 + 20
print [1, 2, 3]
```

**Returns**: `null`

---

## Type Functions

### type(value) -> string

Get the type name of a value.

```sesi
type(42)           // "number"
type("hello")      // "string"
type(true)         // "bool"
type(null)         // "null"
type([1, 2, 3])    // "array"
type({})           // "object"
```

**Returns**: `string` - one of: `"number"`, `"string"`, `"bool"`, `"null"`, `"array"`, `"object"`, `"unknown"`

---

### str(value) -> string

Convert any value to a string.

```sesi
str(42)            // "42"
str(3.14)          // "3.14"
str(true)          // "true"
str([1, 2, 3])     // "[1, 2, 3]"
str({ "a": 1 })        // "{'a': 1}"
```

**Returns**: `string`

---

### num(value) -> number

Convert a value to a number.

```sesi
num("42")          // 42
num("3.14")        // 3.14
num(true)          // 1
num(false)         // 0
num("hello")       // null (can't convert)
```

**Returns**: `number` or `null` if conversion fails

---

### bool(value) -> bool

Convert a value to boolean.

```sesi
bool(1)            // true
bool(0)            // false
bool("")           // false
bool("hello")      // true
bool([])           // true
bool(null)         // false
```

**Returns**: `bool` - Uses truthiness rules

---

## Collection Functions

### len(collection) -> number

Get the length of a string, array, or object.

```sesi
len("hello")       // 5
len([1, 2, 3])     // 3
len({ "a": 1, "b": 2 })  // 2
len(null)          // null (invalid)
```

**Returns**: `number` or `null` if not a collection

---

### range(n) -> array

Create an array of numbers from 0 up to (but not including) n.

```sesi
range(5)           // [0, 1, 2, 3, 4]
```

**Returns**: `array<number>`

---

### push(array, value) -> array

Add an element to the end of an array.

```sesi
let arr = [1, 2, 3]
push(arr, 4)
print arr          // [1, 2, 3, 4]
```

**Note**: Modifies array in-place and returns it.

**Returns**: `array`

---

### pop(array) -> any

Remove and return the last element of an array.

```sesi
let arr = [1, 2, 3]
let last = pop(arr)
print last         // 3
print arr          // [1, 2]
```

**Returns**: The removed element, or `null` if array is empty

---

### join(array, separator) -> string

Join array elements into a string with separator.

```sesi
let arr = [1, 2, 3]
join(arr, "-")     // "1-2-3"
join(["a", "b"], ", ")  // "a, b"
```

**Returns**: `string`

---

### split(string, separator) -> array

Split a string into an array by separator.

```sesi
split("a,b,c", ",")     // ["a", "b", "c"]
split("hello world", " ")  // ["hello", "world"]
```

**Returns**: `array<string>`

---

### keys(object) -> array

Get all keys of an object.

```sesi
let obj = { "name": "Alice", "age": 30 }
keys(obj)          // ["name", "age"]
```

**Returns**: `array<string>` or `null` if not an object

---

### values(object) -> array

Get all values of an object.

```sesi
let obj = { "name": "Alice", "age": 30 }
values(obj)        // ["Alice", 30]
```

**Returns**: `array<any>` or `null` if not an object

---

## File System Functions

### read_file(path) -> string

Read the contents of a file as a string.

```sesi
let text = read_file("input.txt")
print text
```

**Note**: Paths are resolved relative to the current working directory.

**Returns**: `string`

---

### write_file(path, content) -> bool

Write string content to a file. Overwrites the file if it exists.

```sesi
write_file("output.txt", "Hello World!")
```

**Note**: Paths are resolved relative to the current working directory. Throws on write failure.

**Returns**: `bool` (true if successful)

---

### list_dir(path) -> array

List the contents of a directory as an array of strings. Ignores hidden files starting with `.`.

```sesi
let files = list_dir("src")
print files
```

**Note**: Paths are resolved relative to the current working directory. Returns null if path isn't a directory.

**Returns**: `array<string>` or `null`

---

## Math-like Functions (v2 planned)

These are not yet implemented in v1 but will be added:

```sesi
// Planned for v2:
floor(n)
ceil(n)
round(n)
abs(n)
min(a, b)
max(a, b)
sqrt(n)
pow(a, b)
sin(n), cos(n), tan(n)
```
for i in range(10) {
  print i
}
```

**Returns**: `array<number>`

---

## Function Introspection (v2 planned)

These are planned for v2:

```sesi
// Get function name
name(func) -> string

// Get function arity (parameter count)
arity(func) -> number

// Check if value is a function
is_function(value) -> bool
```

---

## Collection Checks (v2 planned)

```sesi
// Planned for v2:
is_array(value) -> bool
is_object(value) -> bool
is_string(value) -> bool
is_number(value) -> bool
is_bool(value) -> bool
is_null(value) -> bool
```

---

## String Functions (v2 planned)

```sesi
// Planned for v2:
length(string) -> number         // Alias for len()
upper(string) -> string          // Uppercase
lower(string) -> string          // Lowercase
trim(string) -> string           // Remove whitespace
contains(string, substring) -> bool
starts_with(string, prefix) -> bool
ends_with(string, suffix) -> bool
index_of(string, substring) -> number
slice(string, start, end?) -> string
replace(string, from, to) -> string
repeat(string, count) -> string
```

---

## Array Functions (v2 planned)

```sesi
// Planned for v2:
map(array, fn) -> array          // Transform elements
filter(array, fn) -> array       // Keep matching elements
reduce(array, fn, initial) -> any
find(array, fn) -> any           // First match
includes(array, value) -> bool
index_of(array, value) -> number
reverse(array) -> array
sort(array, compareFn?) -> array
unique(array) -> array           // Remove duplicates
flatten(array) -> array          // Flatten one level
```

---

## Error Handling (v2 planned)

```sesi
// Planned for v2:
try {
  // risky code
} catch err {
  print err.message
}

throw "Error message"
```

---

## JSON Functions (std library, future)

```sesi
// Planned for std/json module:
import { parse, stringify } from "std/json"

let obj = parse('{"name": "Alice"}')
let json = stringify({ "name": "Alice" })
```

---

## Tips & Tricks

### Converting values
```sesi
// To string
str(value)
value + ""        // Works for most types

// To number
num(string)
string + 0        // Doesn't work (concatenation)

// To bool
bool(value)
!(!value)         // Double negation
```

### Checking types
```sesi
type(value) == "array"
type(value) == "object"
type(value) == "null"
```

### Working with arrays
```sesi
let arr = [1, 2, 3]

// Length
len(arr)

// Last element
arr[len(arr) - 1]

// Add element
push(arr, 4)

// Remove last
pop(arr)

// Join
join(arr, ", ")
```

### Working with objects
```sesi
let obj = { "a": 1, "b": 2 }

// Get keys
keys(obj)

// Get values
values(obj)

// Check key
keys(obj) contains "a"    // Future: not yet supported
```

---

## Standard Library Modules (v2 planned)

### std/math
```sesi
import { PI, E, sqrt, sin, cos } from "std/math"
```

### std/time
```sesi
import { now, sleep } from "std/time"
```

### std/json
```sesi
import { parse, stringify } from "std/json"
```

### std/http
```sesi
import { get, post } from "std/http"
```

---

## Performance Notes

- **print()** is unbuffered (each call flushes)
- **Array operations** are O(n) for most functions
- **Object operations** are O(1) for key access
- **String concatenation** with + is O(n) (consider pre-allocating)

---

## Return Value Reference

| Function | Return Value on Error |
|----------|----------------------|
| num(value) | `null` |
| len(value) | `null` |
| keys(value) | `null` |
| values(value) | `null` |
| pop([]) | `null` |
| type(value) | `"unknown"` |
| str(value) | `"null"` or string representation |

---

## See Also

- [Specification](./SPECIFICATION.md)
- [AI Features Guide](./AI_FEATURES.md)
- [Examples](../examples/)
