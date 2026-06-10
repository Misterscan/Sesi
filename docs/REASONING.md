# Reasoning & Simple Logic

## Overview

In Sesi, Reasoning is used to evaluate state, make logical decisions, and handle complex patterns. This guide covers how to leverage Sesi's built-in Reasoning functions (`model`, `image`, `workflow`) to build scripts for your designated needs.

## 1. Prompting

In Sesi, calling a reasoning model is as simple as defining a string and executing it.

Prompts are **composable message templates** that evaluate to strings.

### Basic Prompt

```sesi
prompt simplePrompt {"Hello, Sesi!"}
print simplePrompt  // "Hello, Sesi!"
```

### Prompts with Variables

```sesi
let name = "Alice"
prompt greeting {"Hello, " name "! How are you?"}
print greeting  // "Hello, Alice! How are you?"
```

### Composing Prompts

```sesi
prompt part1 {"First part"}
prompt part2 {part1 " Second part"}
print part2  // "First part Second part"
```

### Prompts in Functions

```sesi
let text = "Testing"
let language = "Spanish"
fn translatePrompt(text: string, language: string) -> string
{prompt translate {"Translate " text " to " language ": "} return translate}
print translatePrompt(text, language)
```

## 2. Model Calls

Call a Reasoning model with a prompt and get back text.

### Basic Model Call

```sesi
let response = model("gemini-3-flash-preview") {"What is machine learning?"}
print response
```

### Model Configuration

```sesi
let creative = model("gemini-3.5-flash") {thinkingLevel: "low"} {"Write a creative poem about technology."}
print creative

// Config options:
// - thinkingLevel: "minimal", "low", "medium", "high" (natively configures Gemini's reasoning budget)
// - max_tokens: max length of response (OPTIONAL: if not specified, will use the model's default max tokens=4096)
// - temperature: creative variation (OPTIONAL: defaults to 0.1 for high-fidelity reasoning precision)
// - top_k / top_p: parameter options for specialized sampling configurations
```

### Model Selection

```sesi
// Fast model for simple tasks
let text = "Coding with Reasoning programming language is fun!"
let quick = model("gemini-3.1-flash-lite") {"Summarize this in one sentence: " text}

// Powerful model for complex reasoning
let code = "def calculate_sum(n):
    total = 0
    for i in range(1, n):
        total += i
    return total"
let smart = model("gemini-3.1-pro-preview") {"Analyze this code for bugs: " code}

// Efficient model for many calls
let item = "Programming Languages"
let cheap = model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Classify: " item}

print quick
print smart
print cheap
```

### Available Models (v1.5)

- `gemini-2.5-flash-image` - Standard image model. (No `512` image size support for this model. Only `1K` is supported.)
- `gemini-3-flash-preview` - Fast, most balanced model for coding and minimal tasks.
- `gemini-3.1-flash-lite` - Fastest, most cost-efficient.
- `gemini-3.5-flash` - Newest GA model. Balanced, but token hungry (USE WISELY). Supports all native thinking effort levels (`minimal`, `low`, `medium`, `high`).
- `gemini-3.1-pro-preview` - Most powerful reasoning model, doesn't support `minimal` thinking (falls back to `low`).
- `gemini-3.1-flash-image-preview` - Cost efficient image generation model.
- `gemini-3-pro-image-preview` - High quality image generation model. (No `512` image size support for this model.)

#### Planned for (v2+)

- `OpenAI` integration (GPT, Dall-E, etc.)
- `HuggingFace` integration
- `Midjourney` integration
- `Newer Reasoning Models` - Native upgrades

### Passing Images as Input

Pass one or more local image files to `model()` or `image()` via the `images` config key. The runtime reads each file, base64-encodes it, and injects it as a vision part before the prompt text.

```sesi
// Single image
let referenceImage = "stills/frame_03.jpg"
let caption = model("gemini-3-flash-preview") {images: referenceImage} {"What is the subject of this photograph?"}
print caption

// Multiple images
let pair = ["ref_a.png", "ref_b.png"]
let diff = model("gemini-3-flash-preview") {images: pair} {"List every visual difference between these two."}
print diff

// Mixed with other config keys
let scannedDocument = "doc_scan.jpg"
let result = model("gemini-3.5-flash") {images: scannedDocument, thinkingLevel: "low", max_tokens: 4096} {"Transcribe all text visible in this scan."}
write_file("transcript.txt", result)
```

See [Image Generation & Input](IMAGE_GENERATION.md) for the full reference.

## 3. Structured Output

Get typed responses from Reasoning with field validation.

### Basic Structured Output

```sesi
let analysis = structured_output({sentiment: string, confidence: number, summary: string})(model("gemini-3-flash-preview") {"Analyze sentiment of: " text "Return JSON with sentiment, confidence (0-1), and summary"})
print analysis["sentiment"]    // "positive"
print analysis["confidence"]   // 0.85
print analysis["summary"]      // "..."
```

### Schema Definition

```sesi
// Schema is a record with field types
let schema = {title: string, author: string, pageCount: number, tags: string, isFiction: bool}
let bookInfo = structured_output(schema)(model("gemini-3-flash-preview") {"Extract book metadata as JSON from: " description})
print bookInfo["title"]
```

### Parsing Tips

- Always include instructions for JSON format
- Specify the exact schema in the prompt
- Use "thinkingLevel": "minimal" for fast, consistent parsing
- Validate output structure in code

```sesi
let listText = "eggs, milk, bread, cheese, fruit, vegetables"
let output = structured_output({items: string})(model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Return JSON with items array containing: " listText})

// Validate
if type(output["items"]) == "array" {print "Got" str(len(output["items"])) "items"} // Got 6 items
```

## 4. Tool Calls (Function Calling)

Let Reasoning call functions in your program.

### Define Callable Functions

```sesi
let city = "New York"
fn getWeather(city: string) -> string
{let weather = model("gemini-3.1-flash-lite") {"What is the weather like in " city}
return weather}
let result = getWeather(city)
print result

// When defined inside a function, local variables MUST be defined on new lines.
fn calculateTax(amount: number, rate: number) -> number
{let amount = 100
let rate = 0.08
return amount * rate}
let result = calculateTax()
print result
```

### Reasoning Makes Tool Calls

```sesi
let tax = tool_call(calculateTax)(model("gemini-3.1-flash-lite") {"Calculate 8% sales tax on $100"})
print tax  // 8.0
```

### Multiple Tool Availability (Future)

```sesi
// v2: Allow Reasoning to choose from multiple tools
let result = with_tools([getWeather, calculateTax, getTime]) {model("gemini-3-flash-preview") {"What's the weather in NY and the sales tax on $50?"}}
```

## 5. Memory & Conversation

Maintain context across multiple Reasoning calls.

### Simple Memory

```sesi
memory chat {"You are a helpful assistant. Be concise."}

// First turn
let response1 = model("gemini-3-flash-preview") {chat "User: Hello!"}

// Update memory with conversation
chat = chat + "Assistant: " + response1

// Second turn
let response2 = model("gemini-3.1-flash-lite") {chat "User: How are you?"}
print response2  // Has context from turn 1
```

### Memory in Functions

```sesi
memory conversation {"Chat history: "}
fn chat(userMessage: string) -> string
{let fullPrompt = conversation + "User: " + userMessage
let response = model("gemini-3-flash-preview") {fullPrompt}

// Append to memory
conversation = conversation + "User: " + userMessage + "Assistant: " + response
return response}
let msg = "What is the capital of France? "
print "User:" msg
print "Assistant:" chat(msg)
print "Updated Memory!"
```

### Memory Best Practices

- Keep memory concise to save tokens
- Summarize old messages periodically
- Reset memory when topic changes
- Monitor token usage

```sesi
// Summarize old memory
memory conversation {"User: Hello! Assistant: Hi there! User: How are you? Assistant: I'm great!"}
fn summarizeMemory()
{let oldConversation = conversation
let summary = model("gemini-3.1-flash-lite") {"Summarize this conversation concisely: " oldConversation}
conversation = "Previous summary:" + summary + "Recent messages: " + oldConversation}
print "Original Memory:" conversation
summarizeMemory()
print "Summarized!"
print conversation
```

## 6. Practical Patterns

### Classification

```sesi
let categories = "fruit, vegetable, grain"
let item = "banana"
fn classify(item: string, categories: string) -> string
{return model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Classify this item into one category. Categories: " categories " Item: " item " Return only the category name."}}
print "Item: " item //banana
print "Category: " classify(item, categories) //fruit
```

### Extraction

```sesi
let text = "Elon Musk is the CEO of Tesla and SpaceX."
fn extractEntities(text: string) -> object
{let result = structured_output({people: string, places: string, organizations: string})(model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Extract named entities from: " text})
print "Name(s) found: result"
return result}
print extractEntities(text)

```

### Translation

```sesi
let text = "Hello, world!"
let language = "Spanish"
fn translate(text: string, language: string) -> string
{return model("gemini-3-flash-preview") {"Translate to " language ": " text}}
print "Translation:" translate(text, language)
```

### Web Search Grounding

Access real-time information by enabling the `search` shorthand configuration natively.

```sesi
let response = model("gemini-3.1-flash-lite") {search, max_tokens: 200} {"What is the weather in Tokyo right now?"}
print response
```

### Image Generation

Like `model`, the `image` command evaluates prompts and accepts configuration variables mapping accurately to backend SDKs requirements.

```sesi
let logo = image("gemini-3.1-flash-image-preview") {ratio: "1:1", size: "512"} {"A high quality vector logo representing a new programming language named Sesi"}
write_image("logo.png", logo)
print "Image generated!"
```

![Sesi Logo](logo.png)

### Code Generation

```sesi
let requirement = "Write a function that reverses a string."
fn generateCode(requirement: string) -> string
{return model("gemini-3.5-flash") {thinkingLevel: "low"} {"Generate JavaScript code for: " requirement " Only provide code, no explanation."}}
print "Code generation:"
print generateCode(requirement)
```

### Analysis

```sesi
let text = "I love Sesi!"
fn analyzeSentiment(text: string) -> object
{return structured_output({sentiment: string, score: number, explanation: string})(model("gemini-3-flash-preview") {"Analyze sentiment of: " text})}
print "Sentiment analysis:"
print analyzeSentiment(text)
```

## 7. Error Handling

Reasoning operations can fail. Handle gracefully.

### Try/Catch (v1.x)

```sesi
try
{let response = model("gemini-3-flash-preview") {"Analyze " text}
print response}
catch (e) {print "Reasoning call failed"
print e}
```

### Current Failure Behavior

- `model()` throws when the Gemini SDK fails or when no text is returned. `MAX_TOKENS` finish reasons are handled natively via a polling loop to automatically complete long outputs.
- `structured_output()` first tries to parse JSON from the model text, then retries with a coercion prompt.
- If structured parsing still fails, the runtime currently logs the error and returns `{}`.

### Validation After Success

```sesi
let text = "Coding is evolving rapidly!"
fn safeAnalyze(text: string) {
try
{let result = structured_output({sentiment: string, score: number})(model("gemini-3.1-flash-lite") {"Analyze sentiment, score, and return JSON for: " text})
if len(keys(result)) == 0 {print "Structured parsing failed"
return null}
return result
} catch (e) {print e
return null}}
print "Analysis Result:" safeAnalyze(text)
```

## 8. Performance Tips

### Minimize API Calls

```sesi
// Bad: Calls API 3 times
for item in items
{let analysis = model("gemini-3.1-flash-lite") {"Analyze: " item}}
print analysis

// Better: Batch into one call (v2: parallel calls)
let analyses = model("gemini-3.1-flash-lite") {"Analyze each: " join(items, " ")}
print analyses
```

### Use Cheaper Models for Simple Tasks

```sesi
// Simple classification → flash-lite
let category = model("gemini-3.1-flash-lite") {"Classify: " item}
print category

// Complex reasoning → pro
let analysis = model("gemini-3.1-pro-preview") {"Deep analysis of: " complex_problem}
print analysis
```

### Reduce Token Usage

```sesi
/* Long prompts waste tokens
Bad: */
let response = model("gemini-3-flash-preview") {"Here is a very long system prompt that repeats itself... Please analyze the following text very carefully..." text}
print response

// Better:
let response = model("gemini-3-flash-lite") {"Analyze:" text}
print response
```

### Cache Repeated Prompts

```sesi
// Bad: Same analysis done multiple times
for person in people
{let assessment = model("gemini-3.1-flash-lite") {"Assess based on criteria A, B, C: "  person}}
print assessment


// Better: Reuse cached prompt
let people = ["Elon Musk", "Bill Gates", "Steve Jobs"]
fn assessPerson(person: string) -> string
{return model("gemini-3.1-flash-lite") {"Assess on A, B, C: "  person}}
for person in people
{print assessPerson(person)}
```

## 9. Token Counting (Future)

V2 will include token counters:

```sesi
// Planned for v2:
let tokens = count_tokens(text, model)
print "This costs " str(tokens * PRICE_PER_TOKEN) " cents"

// Plan memory size
let remaining = MAX_TOKENS - count_tokens(memory, model)
if remaining < 500 {summarizeMemory()}
print "Memory size:" count_tokens(memory, model)
```

## 10. Advanced: Custom Reasoning Workflows

### Multi-Stage Reasoning Workflow

```sesi
let text = "Climate change is a long-term shift in global or regional climate patterns. Often climate change refers specifically to anthropogenic climate change, which is caused by human activities, primarily fossil fuel burning, which increases heat-trapping greenhouse gas levels in Earth's atmosphere. The term is frequently used interchangeably with the term global warming, though the latter refers specifically to the long-term heating of Earth's climate system observed since the pre-industrial period due to human activities."
fn smartSummarize(text: string) -> string

/* Chain multiple Reasoning operations
Step 1: Extract key points */
{let keyPoints = model("gemini-3.1-pro-preview") {thinkingLevel: "low"} {"Extract 5 key points from: " text}

// Step 2: Analyze topics
let topics = structured_output({topics: string})(model("gemini-3.5-flash") {thinkingLevel: "low"} {"Identify topics in: " keyPoints})

// Step 3: Generate summary
let summary = model("gemini-3-flash-preview") {"Summarize with topics " topics ": " keyPoints}
return summary}
print "Summary:" smartSummarize(text)
```

### Reasoning Pattern

```sesi
let analysis = model("gemini-3.5-flash") {thinkingLevel: "medium", max_tokens: 8192} {"Reason carefully about: " problem}
print analysis
```

### Few-Shot Prompting

```sesi
let text = "banana"
fn classifyWithExamples(text: string) -> string
{return model("gemini-3.5-flash") {thinkingLevel: "minimal"} {"Classify as A, B, or C. Examples: 'apple' -> A , 'dog' -> B , 'happy' -> C. Classify: " text}}
print "Classification:" classifyWithExamples(text)
```

---

## 11. Built-in Tools

### Built-in Workflows

Sesi provides a native `workflow` function to easily chain reasoning steps:

```sesi
let steps = [
  {"prompt": "Summarize:"},
  {"prompt": "Critique:"},
  {"prompt": "Finalize:"}
]
let result = workflow(steps, "Design a landing page brief")
print result["final"]
```

### Model Aliases

You can define custom names for models using `set_alias`:

```sesi
set_alias("fast", "gemini-3.1-flash-lite")
let answer = model("fast") {"Summarize this paragraph."}
print answer
```

### Custom Tools

Sesi allows you to define custom tools that can be invoked during reasoning operations.

```sesi
fn get_weather(city: string, conditions: string) -> string
{return "It is currently " + conditions + " in " + city}
// Register the tool
define_tool("weather", get_weather, "Get weather for a city")

// List available tools
print list_tools()

// Call the tool
let weatherData = structured_output({city: string, conditions: string})(model("gemini-3.1-flash-lite") {search} {"What is the weather like in London? Return JSON with the exact 'conditions' and 'city' name."})
let result = tool_call(weather)(weatherData["city"], weatherData["conditions"])
print result
```

---

## See Also

- [Quick Start Guide](../QUICKSTART.md)
- [Language Specification](SPECIFICATION.md)
- [Runtime Architecture](ARCHITECTURE.md)
- [Built-in Functions Reference](BUILTINS.md)
- [Command Line Interface (CLI) Reference](CLI.md)
- [Image Generation & Input](IMAGE_GENERATION.md)
- [Compare to other languages](COMPARISON.md)
- [Reasoning & Simple Logic](REASONING.md)
- [Examples](../examples)
