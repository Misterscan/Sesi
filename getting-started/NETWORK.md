# Network in Sesi

Sesi has built-in functions for HTTP requests, HTTP servers, and WebSocket servers — no imports required.

---

## HTTP GET — `web_get`

```
web_get(url, headers?) -> string
```

Fetch a URL and return the response body as a string:

```sesi
let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
print response
```

Parse a JSON response with `from_json`:

```sesi
let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
let post     = from_json(response)
print post["title"]
```

Pass custom headers as the second argument:

```sesi
let data = web_get("https://api.example.com/data", {"Authorization": "Bearer my-token"})
```

---

## HTTP POST — `web_send`

```
web_send(url, body, headers?) -> string
```

Send a POST request with a string body and return the response:

```sesi
let payload  = to_json({"title": "Hello", "body": "From Sesi", "userId": 1})
let response = web_send("https://jsonplaceholder.typicode.com/posts", payload)
print response
```

Set `Content-Type` when the API requires it:

```sesi
let response = web_send(
  "https://api.example.com/submit",
  to_json({"key": "value"}),
  {"Content-Type": "application/json", "Authorization": "Bearer token"}
)
```

---

## Error Handling

Network calls throw on failure. Wrap them in `try/catch`:

```sesi
try {
  let response = web_get("https://api.example.com/data")
  let parsed   = from_json(response)
  print parsed["status"]
} catch (err) {
  print "Request failed:" err
}
```

---

## HTTP Server — `listen`

```
listen(port, handler) -> object
```

Start an HTTP server on a port. The `handler` function receives a request object and returns a response:

```sesi
fn handleRequest(req) {
  print req.method req.path
  return {"status": 200, "body": "Hello from Sesi!"}
}

let http = listen(8080, handleRequest)
```

### Request object fields

| Field     | Type     | Description                        |
| --------- | -------- | ---------------------------------- |
| `method`  | `string` | HTTP method (`"GET"`, `"POST"`, …) |
| `path`    | `string` | URL path (e.g. `"/users"`)         |
| `headers` | `object` | Request headers map                |
| `body`    | `string` | Request body                       |
| `query`   | `object` | URL query parameters map           |

### Response formats

Return a plain string for a `200 text/html` response:

```sesi
fn handler(req) {
  return "<h1>Hello</h1>"
}
```

Return an object for full control over status and headers:

```sesi
fn handler(req) {
  return {
    "status": 200,
    "headers": {"Content-Type": "application/json"},
    "body": to_json({"ok": true})
  }
}
```

### Routing

```sesi
fn handleRequest(req) {
  if req.path == "/health" {
    return {"status": 200, "body": "ok"}
  }

  if req.path == "/echo" && req.method == "POST" {
    return {"status": 200, "body": req.body}
  }

  return {"status": 404, "body": "Not found"}
}

let server = listen(3000, handleRequest)
```

### Stopping the server

Call `.close()` on the returned object:

```sesi
http.close()
```

---

## WebSocket Server — `api`

```
api(port, handler) -> object
```

Start a WebSocket server. The `handler` receives a `client` controller and the incoming `message`:

```sesi
fn handleMessage(client, msg) {
  print "Received:" msg
  client.send("Echo: " + msg)
}

let ws = api(8989, handleMessage)
```

### Client object methods

| Method             | Description                    |
| ------------------ | ------------------------------ |
| `client.send(msg)` | Send a message to the client   |
| `client.close()`   | Close this client's connection |

### Stopping the server

```sesi
ws.close()
```

## Browser Automation — `std/browser`

For complex web pages that require rendering JavaScript, clicking buttons, filling forms, taking screenshots, or exporting to PDF, import the `std/browser` library. Sesi uses Playwright under the hood:

```sesi
allow "std/browser" in with {launch}

// Open browser in headless mode
let browser = launch({"headless": true})
let page = browser.newPage()

// Navigate to the target page
page.goto("https://example.com")

// Get the page title
let title = page.title()
print "Title is:" title

// Click a button/link
page.click("a")

// Retrieve inner text
let heading = page.inner_text("h1")

// Retrieve attributes
let url = page.attribute("a", "href")

// Evaluate JavaScript inside the browser context
let height = page.evaluate("document.body.scrollHeight")

// Take a base64 screenshot or save it to a file
page.screenshot({"path": "screenshot.png"})

// Export the page as a PDF
page.pdf({"path": "output.pdf", "format": "A4"})

// Close browser
browser.close()
```

> [!NOTE]
> `std/browser` requires Sesi to run in local/unsafe mode (pass the `-l` or `--local` flag to `sesi`).

---

## Quick Reference

```sesi
// GET request
let body = web_get("https://example.com/api")

// GET with headers
let body = web_get("https://example.com/api", {"Authorization": "Bearer token"})

// POST request
let res = web_send("https://example.com/api", to_json({"key": "val"}))

// POST with headers
let res = web_send("https://example.com/api", payload, {"Content-Type": "application/json"})

// Parse JSON response
let data = from_json(body)

// HTTP server
fn handler(req) {
  return {"status": 200, "body": "ok"}
}
let http = listen(8080, handler)
http.close()

// WebSocket server
fn onMsg(client, msg) { client.send("Echo: " + msg) }
let ws = api(8989, onMsg)
ws.close()

// Browser Automation (requires -l)
allow "std/browser" in with {launch}
let browser = launch({"headless": true})
let page = browser.newPage()
page.goto("https://example.com")
print page.title()
browser.close()
```

---
