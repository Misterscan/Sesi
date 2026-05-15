# Systems Reasoning & Logic Guide

## Overview

Sesi is a **Systems Language** that treats reasoning as a first-class execution primitive. In this paradigm, AI is used to evaluate state, make logical decisions, and handle complex patterns within a systems-level architecture.

This guide covers how to leverage Sesi's systems-level constructs (`spawn`, `exec`, `try/catch`) alongside its reasoning primitives (`model`, `prompt`, `structured_output`) to build resilient, stateful applications.

## 1. Concurrency & Systems Coordination

The core of Sesi's power lies in its ability to manage distributed execution. Using the `spawn()` builtin, you can launch multiple concurrent Sesi processes that coordinate via shared state or the filesystem.

A master script can launch concurrent processes and poll for their completion.

```sesi
spawn("atm_deposit.sesi")
spawn("atm_withdraw.sesi")
let finished = false
while !finished {
  try {
    if read_file("bank/done_count.txt") == "2" {
      finished = true
    }
  } catch (e) {
    // Wait on I/O contention
    let i = 0 while i < 1000 { i = i + 1 }
  }
}
print "Swarm task completed."
```

### Coordination & Distributed Locking

When multiple processes access shared resources, use Sesi's `try/catch`, `time()`, and `random()` builtins to implement mutual exclusion (locking) via the **Double-Check Write** pattern.

```sesi
let id = "With_" + str(time()) + "_" + str(random())
let locked = true
while locked {
  let status = "error"
  try {
    status = read_file("bank/lock.txt")
  } catch (e) {
    status = "error"
  }
  if status == "unlocked" {
    try {
      write_file("bank/lock.txt", id)
      let i = 0 while i < 500 { i = i + 1 }
      if read_file("bank/lock.txt") == id {
        locked = false
      }
    } catch (e) {
      status = "error"
    }
  } else {
    let j = 0 while j < 1000 { j = j + 1 }
  }
}
```

---

## 2. AI as a Reasoning Primitive

In an orchestrated system, AI is used to make decisions that would be too complex for static logic.

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
prompt part2 {part1 " " "Second part"}
print part2  // "First part Second part"
```

### Prompts in Functions

```sesi
let text = "Testing"
let language = "Spanish"
fn translatePrompt(text: string, language: string) -> string
{prompt translate {"Translate the following text to "language": " text} return translate}
print translatePrompt(text, language)
```

## 2. Model Calls

Call Gemini with a prompt and get back text.

### Basic Model Call

```sesi
let response = model("gemini-3-flash-preview") {"What is machine learning?"}
print response
```

### Model Configuration

```sesi
let creative = model("gemini-3-flash-preview") {"temperature": 0.9, "max_tokens": 500} {"Write a creative poem about technology."}
print creative

// Config options:
// - "temperature": 0.0-1.0 (higher = more creative) (OPTIONAL: if not specified, will use the model's default temperature=0.3)
// - max_tokens: max length of response (OPTIONAL: if not specified, will use the model's default max tokens=2048)
// - top_k: diversity parameter (OPTIONAL)
// - top_p: nucleus sampling parameter (OPTIONAL)
```

### Model Selection

```sesi
// Fast model for simple tasks
let text = " Coding with Reasoning systems language is fun!"
let quick = model("gemini-3.1-flash-lite") {"Summarize this in one sentence:" text}

// Powerful model for complex reasoning
let code = "def calculate_sum(n):
    total = 0
    for i in range(1, n):
        total += i
    return total"
let smart = model("gemini-3.1-pro-preview") {"Analyze this code for bugs:" code}

// Efficient model for many calls
let item = " Programming Languages"
let cheap = model("gemini-3.1-flash-lite") {"temperature": 0} {"Classify:" item}

print quick
print smart
print cheap
```

### Available Models (v1.1)

- `gemini-2.5-flash` - Legacy, but supported. 1M tokens.
- `gemini-2.5-pro` - Legacy, but supported. 1M tokens.
- `gemini-2.5-flash-image` - Legacy, but reliable.
- `gemini-3-flash-preview` - Fast, balanced, 1M tokens
- `gemini-3.1-pro-preview` - Most capable, 1M tokens
- `gemini-3.1-flash-lite` - Fastest, cost-efficient
- `gemini-3.1-flash-image-preview` - Cost efficient while maintaining quality images.
- `gemini-3-pro-image-preview` - High quality image generation.

#### Planned for (v2+)

- `OpenAI` integration (GPT, Dall-E, etc.)
- `HuggingFace` integration
- `Midjourney` integration
- `Newer Reasoning Models` - Native upgrades

## 3. Structured Output

Get typed responses from Reasoning with field validation.

### Basic Structured Output

```sesi
let analysis = structured_output({sentiment: string, confidence: number, summary: string})
(model("gemini-3-flash-preview") {"Analyze sentiment of: " text "Return JSON with sentiment, confidence (0-1), and summary"})
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
- Use "temperature": 0 for consistency
- Validate output structure in code

```sesi
let listText = "eggs, milk, bread, cheese, fruit, vegetables"
let output = structured_output({items: string})(model("gemini-3-flash-preview") {"temperature": 0}{"Return JSON with items array containing: " listText})

// Validate
if type(output["items"]) == "array" {print "Got" str(len(output["items"])) "items"} // Got 6 items
```

## 4. Tool Calls (Function Calling)

Let Reasoning call functions in your program.

### Define Callable Functions

```sesi
let city = "New York"
fn getWeather(city: string) -> string
{let weather = model("gemini-3.1-flash-lite"){"What is the weather like in " city} return weather}
let result = getWeather(city)
print result

// When defined inside a function, local variables MUST be defined on new lines.
// (A current limitation of the parser).
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
{let fullPrompt = conversation + "User:" + userMessage
let response = model("gemini-3-flash-preview") {fullPrompt}

// Append to memory
conversation = conversation + "User:" + userMessage + "Assistant:" + response
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
let summary = model("gemini-3.1-flash-lite") {"Summarize this conversation concisely:" oldConversation}
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
{return model("gemini-3.1-flash-lite") {"temperature": 0}
{"Classify this item into one category. Categories: " categories " Item: " item " Return only the category name."}}
print "Item: " item //banana
print "Category: " classify(item, categories) //fruit
```

### Extraction

```sesi
let text = "Elon Musk is the CEO of Tesla and SpaceX."
fn extractEntities(text: string) -> object
{let result = structured_output({people: string, places: string, organizations: string})
(model("gemini-3.1-flash-lite") {"temperature": 0}{"Extract named entities from:" text})
print "Name(s) found: result"
return result}
print extractEntities(text)

```

### Translation

```sesi
let text = "Hello, world!"
let language = "Spanish"
fn translate(text: string, language: string) -> string
{return model("gemini-3-flash-preview") {"Translate to" language ":" text}}
print "Translation:"
print translate(text, language)
```

### Image Generation

Like `model`, the `image` command evaluates prompts and accepts configuration variables mapping accurately to backend SDKs requirements.

```sesi
let logo = image("gemini-3.1-flash-image-preview") {"ratio": "1:1", "size": "512", "temperature": 0.3} {"A high quality vector logo representing a new programming language named Sesi"}
write_image("logo.png", logo)
print "Image generated!"
```

### Code Generation

```sesi
let requirement = "Write a function that reverses a string."
fn generateCode(requirement: string) -> string
{return model("gemini-3.1-flash-lite") {"temperature": 0.2} {"Generate JavaScript code for:" requirement "Only provide code, no explanation."}}
print "Code generation:"
print generateCode(requirement)
```

### Analysis

```sesi
let text = "I love Sesi!"
fn analyzeSentiment(text: string) -> object
{return structured_output({sentiment: string, score: number, explanation: string})
(model("gemini-3-flash-preview") {"Analyze sentiment of:" text})}
print "Sentiment analysis:"
print analyzeSentiment(text)
```

## 7. Error Handling

Reasoning operations can fail. Handle gracefully.

### Try/Catch (v1.1)

```sesi
try
{let response = model("gemini-3-flash-preview") {"Analyze" text}
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
{let result = structured_output({sentiment: string, score: number})(model("gemini-3.1-flash-lite") {"Analyze sentiment and return JSON for:" text})
if len(keys(result)) == 0 {print "Structured parsing failed"
return null}
return result}
catch (e)
{print e
return null}}
print "Analysis Result: " safeAnalyze(text)
```

## 8. Performance Tips

### Minimize API Calls

```sesi
// Bad: Calls API 3 times
for item in items
{let analysis = model("gemini-3.1-flash-lite") {"Analyze:" item}}
print analysis

// Better: Batch into one call (v2: parallel calls)
let analyses = model("gemini-3.1-flash-lite") {"Analyze each:" join(items, " ")}
print analyses
```

### Use Cheaper Models for Simple Tasks

```sesi
// Simple classification → flash-lite
let category = model("gemini-3.1-flash-lite") {"Classify:" item}
print category

// Complex reasoning → pro
let analysis = model("gemini-3.1-pro-preview") {"Deep analysis of:" complex_problem}
print analysis
```

### Reduce Token Usage

```sesi
// Long prompts waste tokens
// Bad:
let response = model("gemini-3-flash-preview") {"Here is a very long system prompt that repeats itself... " "Please analyze the following text very carefully..." text}
print response

// Better:
let response = model("gemini-3-flash-lite") {"Analyze:" text}
print response
```

### Cache Repeated Prompts

```sesi
// Bad: Same analysis done multiple times
for person in people {let assessment = model("gemini-3.1-flash-lite") {"Assess based on criteria A, B, C: "  person}}
print assessment


// Better: Reuse cached prompt
let people = ["Elon Musk", "Bill Gates", "Steve Jobs"]
fn assessPerson(person: string) -> string {return model("gemini-3.1-flash-lite") {"Assess on A, B, C: "  person}}
for person in people {print assessPerson(person)}
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
print "Memory size: " count_tokens(memory, model)
```

## 10. Advanced: Custom Reasoning Workflows

### Multi-Stage Reasoning Workflow

```sesi
let text = "Climate change is a long-term shift in global or regional climate patterns. Often climate change refers specifically to anthropogenic climate change, which is caused by human activities, primarily fossil fuel burning, which increases heat-trapping greenhouse gas levels in Earth's atmosphere. The term is frequently used interchangeably with the term global warming, though the latter refers specifically to the long-term heating of Earth's climate system observed since the pre-industrial period due to human activities."
fn smartSummarize(text: string) -> string

// Chain multiple Reasoning operations
// Step 1: Extract key points
{let keyPoints = model("gemini-3.1-pro-preview") {"temperature": 0} {"Extract 5 key points from:" text}

// Step 2: Analyze topics
let topics = structured_output({ topics: string })(model("gemini-3.1-flash-lite") {"Identify topics in:" keyPoints})

// Step 3: Generate summary
let summary = model("gemini-3-flash-preview") {"Summarize with topics " topics ":" keyPoints} return summary}
print "Summary:" smartSummarize(text)
```

### Reasoning Pattern (V2: native support)

```sesi
// Future: Extended thinking
let analysis = model("gemini-3-flash-preview") {"temperature": 0, "thinking_level": "low"} {"Reason carefully about:" problem}
print analysis
```

### Few-Shot Prompting

```sesi
let text = "banana"
fn classifyWithExamples(text: string) -> string
{return model("gemini-3.1-flash-lite") {"temperature": 0} {"Classify as A, B, or C" "Examples:" "'apple' -> A" "'dog' -> B" "'happy' -> C" "Classify: " text}}
print "Classification:" classifyWithExamples(text)
```

---

## See Also

- [Compare to other languages](COMPARISON.md)
- [Language Specification](SPECIFICATION.md)
- [Image Generation](IMAGE_GENERATION.md)
- [Architecture](ARCHITECTURE.md)
- [Built-ins](BUILTINS.md)
- [Examples](../examples/)
- [Roadmap](ROADMAP.md)
