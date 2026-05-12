# Sesi AI Features Guide

## Overview

Sesi makes AI interaction a core language feature. This guide covers all AI-native constructs and best practices.

## Quick Start: AI Model Calls

The simplest way to use AI in Sesi:

```sesi
let result = model("gemini-3.1-flash-lite") {
  "What is the capital of France?"
}

print result  // "The capital of France is Paris."
```

## 1. Prompt Blocks

Prompts are **composable message templates** that evaluate to strings.

### Basic Prompt
```sesi
prompt simplePrompt {
  "Hello, AI!"
}

print simplePrompt  // "Hello, AI!"
```

### Prompts with Variables
```sesi
let name = "Alice"

prompt greeting {
  "Hello, "
  name
  "! How are you?"
}

print greeting  // "Hello, Alice! How are you?"
```

### Composing Prompts
```sesi
prompt part1 {
  "First part"
}

prompt part2 {
  part1
  "\n"
  "Second part"
}

print part2  // "First part\nSecond part"
```

### Prompts in Functions
```sesi
fn translatePrompt(text: string, language: string) {
  prompt translate {
    "Translate the following text to "
    language
    ":\n"
    text
  }
  
  return translate
}

print translatePrompt("Hello", "Spanish")
```

## 2. Model Calls

Call Gemini with a prompt and get back text.

### Basic Model Call
```sesi
let response = model("gemini-3-flash-preview") {
  "What is machine learning?"
}

print response
```

### Model Configuration
```sesi
let creative = model("gemini-3-flash-preview") {
  "temperature": 0.9,
  "max_tokens": 500
} {
  "Write a creative poem about AI"
}

print creative

// Config options:
// - temperature: 0.0-1.0 (higher = more creative)
// - max_tokens: max length of response
// - top_k: diversity parameter
// - top_p: nucleus sampling parameter
```

### Model Selection
```sesi
// Fast model for simple tasks
let quick = model("gemini-3.1-flash-lite") {
  "Summarize this in one sentence: " + text
}

// Powerful model for complex reasoning
let smart = model("gemini-3.1-pro-preview") {
  "Analyze this code for bugs: " + code
}

// Efficient model for many calls
let cheap = model("gemini-3.1-flash-lite") {
  "Classify: " + item
}
```

### Available Models (v1)
- `gemini-3-flash-preview` - Fast, balanced, 1M tokens
- `gemini-3.1-pro-preview` - Most capable, 1M tokens
- `gemini-3.1-flash-lite` - Fastest, cost-efficient

## 3. Structured Output

Get typed responses from AI with field validation.

### Basic Structured Output
```sesi
let analysis = structured_output({
  sentiment: string,
  confidence: number,
  summary: string
})(
  model("gemini-3-flash-preview") {
    "Analyze sentiment of: " + text
    "\nReturn JSON with sentiment, confidence (0-1), and summary"
  }
)

print analysis["sentiment"]    // "positive"
print analysis["confidence"]   // 0.85
print analysis["summary"]      // "..."
```

### Schema Definition
```sesi
// Schema is a record with field types
let schema = {
  title: string,
  author: string,
  pageCount: number,
  tags: string,
  isFiction: bool
}

let bookInfo = structured_output(schema)(
  model("gemini-3-flash-preview") {
    "Extract book metadata as JSON from: " + description
  }
)
```

### Parsing Tips
- Always include instructions for JSON format
- Specify the exact schema in the prompt
- Use temperature 0 for consistency
- Validate output structure in code

```sesi
let output = structured_output({
  items: string
})(
  model("gemini-3-flash-preview") {
    "temperature": 0
  } {
    "Return JSON with items array containing: "
    listText
  }
)

// Validate
if type(output["items"]) == "array" {
  print "Got " + str(len(output["items"])) + " items"
}
```

## 4. Tool Calls (Function Calling)

Let AI call functions in your program.

### Define Callable Functions
```sesi
fn getWeather(city: string) -> string {
  // Imagine this calls a real API
  return "Sunny, 72°F"
}

fn calculateTax(amount: number, rate: number) -> number {
  return amount * rate
}
```

### AI Makes Tool Calls
```sesi
let tax = tool_call(calculateTax)(
  model("gemini-3.1-flash-lite") {
    "Calculate 8% sales tax on $100"
  }
)

print tax  // 8.0
```

### Multiple Tool Availability (Future)
```sesi
// v2: Allow AI to choose from multiple tools
let result = with_tools([getWeather, calculateTax, getTime]) {
  model("gemini-3-flash-preview") {
    "What's the weather in NY and the sales tax on $50?"
  }
}
```

## 5. Memory & Conversation

Maintain context across multiple AI calls.

### Simple Memory
```sesi
memory chat {
  "You are a helpful assistant. Be concise."
}

// First turn
let response1 = model("gemini-3-flash-preview") {
  chat + "\n\nUser: Hello!"
}

// Update memory with conversation
chat = chat + "\nAssistant: " + response1

// Second turn
let response2 = model("gemini-3.1-flash-lite") {
  chat + "\n\nUser: How are you?"
}

print response2  // Has context from turn 1
```

### Memory in Functions
```sesi
memory conversation {
  "Chat history:\n"
}

fn chat(userMessage: string) -> string {
  let fullPrompt = conversation + "User: " + userMessage
  
  let response = model("gemini-3-flash-preview") {
    fullPrompt
  }
  
  // Append to memory
  conversation = conversation + "User: " + userMessage + "\nAssistant: " + response + "\n"
  
  return response
}

print chat("What is Sesi?")
print chat("Can you show me an example?")
print chat("How do I deploy it?")
```

### Memory Best Practices
- Keep memory concise to save tokens
- Summarize old messages periodically
- Reset memory when topic changes
- Monitor token usage

```sesi
// Summarize old memory
fn summarizeMemory() {
  let oldConversation = conversation
  
  let summary = model("gemini-3.1-flash-lite") {
    "Summarize this conversation concisely:\n"
    oldConversation
  }
  
  conversation = "Previous summary: " + summary + "\nRecent messages:\n"
}
```

## 6. Practical Patterns

### Classification
```sesi
fn classify(item: string, categories: string) -> string {
  return model("gemini-3.1-flash-lite") {
    "temperature": 0
  } {
    "Classify this item into one category:\n"
    "Categories: " + categories + "\n"
    "Item: " + item + "\n"
    "Return only the category name."
  }
}

let category = classify("banana", "fruit, vegetable, grain")
print category  // "fruit"
```

### Extraction
```sesi
fn extractEntities(text: string) -> object {
  let result = structured_output({
    people: string,
    places: string,
    organizations: string
  })(
    model("gemini-3.1-flash-lite") {
      "temperature": 0
    } {
      "Extract named entities from:\n"
      text
    }
  )
  
  return result
}
```

### Translation
```sesi
fn translate(text: string, language: string) -> string {
  return model("gemini-3-flash-preview") {
    "Translate to " + language + ":\n"
    text
  }
}

print translate("Hello, world!", "Spanish")
```

### Code Generation
```sesi
fn generateCode(requirement: string) -> string {
  return model("gemini-3.1-pro-preview") {
    "temperature": 0.2
  } {
    "Generate JavaScript code for:\n"
    requirement + "\n"
    "Only provide code, no explanation."
  }
}
```

### Analysis
```sesi
fn analyzeSentiment(text: string) -> object {
  return structured_output({
    sentiment: string,
    score: number,
    explanation: string
  })(
    model("gemini-3-flash-preview") {
      "Analyze sentiment of:\n"
      text
    }
  )
}
```

## 7. Error Handling

AI operations can fail. Handle gracefully.

### Try/Catch (v1)
```sesi
try {
  let response = model("gemini-3-flash-preview") {
    "Analyze " + text
  }

  print response
} catch (e) {
  print "AI call failed"
  print e
}
```

### Current Failure Behavior
- `model()` throws when the Gemini SDK fails, when no text is returned, or when the model stops for a non-success reason such as `MAX_TOKENS`.
- `structured_output()` first tries to parse JSON from the model text, then retries with a coercion prompt.
- If structured parsing still fails, the runtime currently logs the error and returns `{}`.

### Validation After Success
```sesi
fn safeAnalyze(text: string) {
  try {
    let result = structured_output({
      sentiment: string,
      score: number
    })(
      model("gemini-3.1-flash-lite") {
        "Analyze sentiment and return JSON for: " + text
      }
    )

    if len(keys(result)) == 0 {
      print "Structured parsing failed"
      return null
    }

    return result
  } catch (e) {
    print e
    return null
  }
}
```

## 8. Performance Tips

### Minimize API Calls
```sesi
// Bad: Calls API 3 times
for item in items {
  let analysis = model("gemini-3.1-flash-lite") {
    "Analyze: " + item
  }
  print analysis
}

// Better: Batch into one call (v2: parallel calls)
let analyses = model("gemini-3.1-flash-lite") {
  "Analyze each:\n"
  join(items, "\n")
}
```

### Use Cheaper Models for Simple Tasks
```sesi
// Simple classification → flash-lite
let category = model("gemini-3.1-flash-lite") {
  "Classify: " + item
}

// Complex reasoning → pro
let analysis = model("gemini-3.1-pro-preview") {
  "Deep analysis of: " + complex_problem
}
```

### Reduce Token Usage
```sesi
// Long prompts waste tokens
// Bad:
let response = model(...) {
  "Here is a very long system prompt that repeats itself... "
  "Please analyze the following text very carefully..."
  text
}

// Better:
let response = model(...) {
  "Analyze: " + text
}
```

### Cache Repeated Prompts
```sesi
// Bad: Same analysis done multiple times
for person in people {
  let assessment = model(...) {
    "Assess based on criteria A, B, C: " + person
  }
}

// Better: Reuse cached prompt
fn assessPerson(person: string) -> string {
  return model(...) {
    "Assess on A, B, C: " + person
  }
}

for person in people {
  print assessPerson(person)
}
```

## 9. Token Counting (Future)

V2 will include token counters:

```sesi
// Planned for v2:
let tokens = count_tokens(text, model)
print "This costs " + str(tokens * PRICE_PER_TOKEN) + " cents"

// Plan memory size
let remaining = MAX_TOKENS - count_tokens(memory, model)
if remaining < 500 {
  summarizeMemory()
}
```

## 10. Advanced: Custom AI Workflows

### Orchestration Pattern
```sesi
fn smartSummarize(text: string) -> string {
  // Chain multiple AI operations
  
  // Step 1: Extract key points
  let keyPoints = model("gemini-3.1-pro-preview") {
    "Extract 5 key points from:\n" + text
  }
  
  // Step 2: Analyze topics
  let topics = structured_output({ topics: string })(
    model("gemini-3.1-flash-lite") {
      "Identify topics in:\n" + keyPoints
    }
  )
  
  // Step 3: Generate summary
  let summary = model("gemini-3-flash-preview") {
    "Summarize with topics " + topics["topics"] + ":\n" + keyPoints
  }
  
  return summary
}
```

### Reasoning Pattern (V2: native support)
```sesi
// Future: Extended thinking
let analysis = model("gemini-3-flash-preview") {
  "thinking_budget": 1000  // tokens for reasoning
} {
  "Reason carefully about: " + problem
}
```

### Few-Shot Prompting
```sesi
fn classifyWithExamples(text: string) -> string {
  return model("gemini-3.1-flash-lite") {
    "temperature": 0
  } {
    "Classify as A, B, or C\n"
    "\nExamples:\n"
    "'apple' -> A\n"
    "'dog' -> B\n"
    "'happy' -> C\n"
    "\nClassify: " + text
  }
}
```

## See Also

- [Language Specification](./SPECIFICATION.md)
- [Architecture](./ARCHITECTURE.md)
- [Examples](../examples/)
- [Roadmap](./ROADMAP.md)
