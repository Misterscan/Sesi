Regex (Regular Expressions) is a language for describing text patterns. Think of it as a "find and replace" tool on steroids.

While AI agents use it to parse and debug code, it is a fundamental skill for any developer to automate text processing, validation, and data extraction.

The `regex()` built-in function supports four modes: `match` (default), `test`, `replace`, and `split`.

### 1. Validation (`mode: "test"`)

Use this mode to verify that a string matches a specific pattern, such as an email address, a date format, or a username.

```sesi
/*
  Validating a username:
  - Must be alphanumeric
  - Must be between 3 and 16 characters
*/
let username = "user_123"
let isValid = regex("^[a-zA-Z0-9]{3,16}$", username, {"mode": "test"})

if isValid {
  print "Username is valid"
} else {
  print "Username is invalid"
}
```

### 2. Extraction (`mode: "match"`)

This is the default mode. It is useful for pulling specific data points out of a larger string, such as IDs, timestamps, or specific keywords.

```sesi
/*
  Extracting an ID from a log line
*/
let logLine = "System update completed. ID: 98765-AB"
let matches = regex("ID: (\\d+-[A-Z]+)", logLine)

if matches {
  // The first match is at index 0
  print "Extracted ID:" matches[0]["groups"][0]
}
```

### 3. Text Transformation (`mode: "replace"`)

Use this to clean up strings, remove unwanted characters, or mask sensitive information.

```sesi
/*
  Cleaning up excessive whitespace
*/
let messy = "This    is   a   messy   string"
let clean = regex("\\s+", messy, {"mode": "replace", "flags": "g", "replacement": " "})

print "Cleaned string:" clean
```

### 4. Parsing (`mode: "split"`)

This is more powerful than the standard `split()` function because it allows you to split a string using multiple delimiters simultaneously.

```sesi
/*
  Splitting a string by commas, semicolons, or pipes
*/
let data = "apple;banana,orange|grape"
let items = regex("[;,|]", data, {"mode": "split"})

print "Items found:" items
```

### Quick Reference

| Mode      | Purpose          | Returns                   |
| :-------- | :--------------- | :------------------------ |
| `match`   | Extracting data  | `array` of matches/groups |
| `test`    | Validation       | `bool`                    |
| `replace` | Cleaning/Masking | `string`                  |
| `split`   | Parsing          | `array` of parts          |

---

Here is a cheatsheet for the most common patterns you will use in Sesi.

### 1. The Building Blocks (Character Classes)

These represent specific types of characters.

| Pattern  | Description                                       |
| :------- | :------------------------------------------------ |
| `\\d`    | Any digit (0-9)                                   |
| `\\w`    | Any word character (letters, numbers, underscore) |
| `\\s`    | Any whitespace (space, tab, newline)              |
| `.`      | Any character (except newline)                    |
| `[a-z]`  | Any lowercase letter                              |
| `[A-Z]`  | Any uppercase letter                              |
| `[^abc]` | Any character _except_ a, b, or c                 |

_Note: In Sesi strings, you must use double backslashes (e.g., `\\d`) to represent a single backslash for the regex engine._

### 2. Quantifiers (How many?)

These tell the engine how many times to match the preceding character or group.

| Pattern | Description               |
| :------ | :------------------------ |
| `*`     | 0 or more times           |
| `+`     | 1 or more times           |
| `?`     | 0 or 1 time (optional)    |
| `{n}`   | Exactly `n` times         |
| `{n,m}` | Between `n` and `m` times |

### 3. Anchors (Where?)

These define the position in the string.

| Pattern | Description         |
| :------ | :------------------ |
| `^`     | Start of the string |
| `$`     | End of the string   |

### 4. Grouping & Logic

| Pattern | Description                                           |
| :------ | :---------------------------------------------------- |
| `(abc)` | Capture group: treats `abc` as a single unit          |
| `\|`    | OR operator (e.g., `cat\|dog` matches "cat" or "dog") |

---

### Practical Sesi Examples

#### A. Validation (`mode: "test"`)

Use this to ensure input matches a specific format, like a phone number.

```sesi
/*
  Pattern: 3 digits, hyphen, 3 digits, hyphen, 4 digits
  ^\\d{3}-\\d{3}-\\d{4}$
*/
let phone = "555-0199-1234"
let isValid = regex("^\\d{3}-\\d{3}-\\d{4}$", phone, {"mode": "test"})

if isValid {
  print "Phone number is valid"
} else {
  print "Phone number is invalid"
}
```

#### B. Extraction (`mode: "match"`)

Use this to pull specific data out of a string.

```sesi
/*
  Extracting a date in YYYY-MM-DD format
*/
let text = "The event is scheduled for 2026-12-25."
let matches = regex("(\\d{4})-(\\d{2})-(\\d{2})", text)

if matches {
  // matches[0]["groups"] contains the captured parts
  let year  = matches[0]["groups"][0]
  let month = matches[0]["groups"][1]
  let day   = matches[0]["groups"][2]

  print "Year:" year
  print "Month:" month
  print "Day:" day
}
```

#### C. Cleaning/Masking (`mode: "replace"`)

Use this to remove sensitive info or clean up text.

```sesi
/*
  Masking an email address
*/
let email = "user@example.com"
// Replace everything before the @ with ****
let masked = regex("^[^@]+", email, {"mode": "replace", "replacement": "****"})

print "Masked email:" masked // ****@example.com
```

---

### Tips for Best Results

- **Use Flags:** When using `regex()`, you can pass a `flags` string in the options object. For example, `{"flags": "i"}` makes the pattern case-insensitive, and `{"flags": "g"}` enables global replacement.
- **Named Groups:** If you use named capture groups in your regex (e.g., `(?<id>\d+)`), the `match` mode will include these in the `groups` object, making your code much more readable than relying on numeric indices.
- **Escape Characters:** Remember that Sesi strings use backslashes for escaping. If your regex pattern requires a backslash (like `\d` for digits), you may need to double-escape it in your string literal (e.g., `"\\d+"`) depending on the pattern complexity.
- **Start Simple:** Don't try to write one giant regex for a complex problem. If you need to parse a complex file, it is often better to split the string first, then run regex on the smaller parts.
- **Use `regex()` with `mode: "split"`:** If you have a string with inconsistent separators (like spaces, tabs, and commas), `regex("[\\s,]+", data, {"mode": "split"})` will handle all of them at once.
- **Test in Small Steps:** When building a pattern, test it against a single string first. If it fails, remove parts of the pattern until it matches, then add them back one by one to find the error.
- **The "Any" Character (`.`):** Be careful with `.` because it matches _everything_. If you want to match a literal dot, you must escape it: `\\.`.
- **Greediness:** Quantifiers like `*` and `+` are "greedy" by default—they match as much text as possible. If you find your regex is matching too much (e.g., matching from the start of the string to the very last quote instead of the first), you may need to learn about "non-greedy" quantifiers (adding a `?` after the quantifier, like `*?`).
