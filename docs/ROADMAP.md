# Sesi Language Roadmap

## Version 1.0 - Foundation (Current)

**Status**: Complete V1.0 implementation  
**Ready for**: Exploration, learning, building prototypes  
**Not ready for**: Production systems (until v2.0 with error handling)  
**Next milestone**: V1.1

### Core Language Features ✅
- [x] Variables and bindings (let, const)
- [x] Functions with parameters and types
- [x] Control flow (if/else, while, for, try/catch)
- [x] Operators (arithmetic, logical, comparison)
- [x] Arrays and objects
- [x] Type system with inference
- [x] Comments (// and /* */)
- [x] String concatenation
- [x] Error handling (try/catch blocks)

### AI-Native Features ✅
- [x] Prompt blocks
- [x] Model calls (model())
- [x] Structured output (structured_output())
- [x] Tool calling (tool_call())
- [x] Simple memory management

### Built-in Functions ✅
- [x] print, type, str, num, bool
- [x] len, push, pop, join, split
- [x] range, keys, values
- [x] read_file, write_file
- [x] Array and object operations

### Tooling ✅
- [x] Lexer and parser
- [x] Tree-walking interpreter
- [x] CLI executable (sesi)
- [x] Examples (13 programs)
- [x] Documentation

### Limitations
- Single-threaded execution
- No async/await
- Blocking AI calls
- Limited error messages
- No module system (imports/exports planned)
- No pattern matching
- No generics or custom types

---

## Version 1.1 - Stability & Polish (Q2 2026)

**Focus**: Robustness and user experience

### Improvements
- [ ] Better error messages with line numbers
- [ ] Stack traces for debugging
- [ ] REPL (Read-Eval-Print Loop)
- [ ] More built-in functions
- [ ] Documentation improvements
- [ ] Performance optimizations
- [x] Bug fixes (tool_call argument passing resolved)

### New Features
- [ ] String escape sequences
- [ ] Multiline strings
- [ ] Comments preservation (for docs)
- [ ] Type hints in function signatures
- [ ] Simple error recovery

### Examples & Tutorials
- [ ] Tutorial: Getting started
- [ ] Tutorial: Writing AI-native code
- [ ] Cookbook: Common patterns
- [ ] API reference

---

## Version 2.0 - Advanced AI (Q3-Q4 2026)

**Focus**: Advanced AI features and concurrency

### Async/Await Support
- [ ] async/await syntax
- [ ] Parallel model calls
- [ ] Promise-like operations
- [ ] Concurrent execution

### Advanced AI Features
- [ ] Streaming responses
- [ ] Extended thinking/reasoning budget
- [ ] Multi-step agent workflows
- [ ] Tool composition and piping
- [ ] Custom tool definitions
- [ ] Function calling with automatic orchestration

### Memory System
- [ ] Long-term memory with embeddings
- [ ] Memory search by similarity
- [ ] Context window management
- [ ] Automatic summarization
- [ ] Persistent storage (file-based)

### Error Handling
- [ ] finally blocks (try/catch completed in V1)
- [ ] Custom error types
- [ ] Error recovery strategies
- [ ] Retry logic with exponential backoff
- [ ] Timeout handling

### Performance
- [ ] Bytecode compilation
- [ ] Caching for repeated operations
- [ ] Token counting and cost estimation
- [ ] Lazy evaluation

### New Built-ins
- [ ] String functions (upper, lower, trim, slice, etc.)
- [ ] Array functions (map, filter, reduce, find, etc.)
- [ ] Math functions (sqrt, sin, cos, floor, ceil, etc.)
- [ ] Date/time functions
- [ ] JSON parsing and serialization
- [ ] HTTP client (get, post)

### Module System
- [ ] import/export statements
- [ ] Standard library modules (std/math, std/time, etc.)
- [ ] Third-party package management
- [ ] Namespace support

### Tooling
- [ ] Debugger with breakpoints
- [ ] Profiler for performance analysis
- [ ] AST visualization
- [ ] Type checking tool
- [x] Linter and formatter (ESLint integrated)

### Examples
- [ ] Web scraper with AI analysis
- [ ] Document processor (PDF, DOCX)
- [ ] Chatbot with memory
- [ ] Data pipeline with AI
- [ ] API server (with async)

---

## Version 3.0 - Agent Framework (2027)

**Focus**: Full AI agent support

### Agent System
- [ ] Agent definitions with state machines
- [ ] Agent composition and chaining
- [ ] Multi-agent collaboration
- [ ] Agent communication protocol
- [ ] Agent persistence

### Knowledge Base
- [ ] Vector database integration
- [ ] Semantic search
- [ ] Knowledge graph support
- [ ] RAG (Retrieval-Augmented Generation)
- [ ] Document indexing

### Advanced Patterns
- [ ] Plan-and-execute workflows
- [ ] Hierarchical task decomposition
- [ ] Autonomous loop with safety checks
- [ ] Reflection and self-improvement
- [ ] Human-in-the-loop approval

### Ecosystem
- [ ] Package registry
- [ ] Community extensions
- [ ] Plugin system
- [ ] API server template
- [ ] Dashboard/UI toolkit

### Examples
- [ ] Autonomous research agent
- [ ] Customer support bot
- [ ] Code generation and testing
- [ ] Data analysis pipeline
- [ ] Multi-agent debate

---

## Version 4.0+ - Vision (2027+)

**Focus**: Maturity, optimization, and specialization

### Potential Features
- [ ] Compilation to JavaScript/WASM
- [ ] JIT compilation for hot paths
- [ ] Distributed execution
- [ ] Cross-model orchestration (Gemini, Claude, etc.)
- [ ] Vision model integration
- [ ] Audio processing
- [ ] Real-time streaming
- [ ] Genetic programming / AutoML
- [ ] Formal verification
- [ ] Type refinement system

### New Language Constructs
- [ ] Pattern matching
- [ ] Generics and templates
- [ ] Traits/interfaces
- [ ] Macros
- [ ] DSL support
- [ ] Concurrent primitives (channels, mutexes)

### Performance
- [ ] LLVM backend option
- [ ] WebAssembly compilation
- [ ] GPU acceleration
- [ ] Distributed computing

---

## Feature Priority Matrix

| Feature | Priority | V1 | V2 | V3 | V4+ |
|---------|----------|----|----|----|----|
| Basic syntax | 🔴 High | ✅ |  |  |  |
| Functions | 🔴 High | ✅ |  |  |  |
| Model calls | 🔴 High | ✅ |  |  |  |
| Error handling | 🔴 High | ✅ | ⏳ |  |  |
| Async/await | 🔴 High |  | ⏳ |  |  |
| Streaming | 🟡 Medium |  | ⏳ |  |  |
| Agents | 🟡 Medium |  |  | ⏳ |  |
| Knowledge base | 🟡 Medium |  |  | ⏳ |  |
| Module system | 🟡 Medium |  | ⏳ |  |  |
| Debugger | 🟢 Low |  | ⏳ |  |  |
| Compilation | 🟢 Low |  |  |  | ⏳ |
| GPU support | 🟢 Low |  |  |  | ⏳ |

---

## Release Timeline

```
2026 Q2
└─ v1.1 - Polish & stabilize

2026 Q3-Q4
└─ v2.0 - Advanced AI & async

2027 Q1-Q2
└─ v3.0 - Agent framework

2027 Q3+
└─ v4.0+ - Mature ecosystem
```

---

## Community & Contribution

### Planned Community Activities
- [ ] Public GitHub repository
- [ ] Discord/Slack community
- [ ] Monthly community calls
- [ ] RFCs (Request for Comments) for major features
- [ ] Contribution guidelines
- [ ] Code of conduct

### How to Help (When Open Source)
- [ ] Test programs and report bugs
- [ ] Contribute documentation
- [ ] Submit examples
- [ ] Propose language features
- [ ] Implement built-in functions
- [ ] Build tools and extensions

---

## Backwards Compatibility

### Stability Guarantee
- **v1.x → v1.y**: Full backwards compatibility
- **v1.x → v2.0**: Mostly compatible, deprecation warnings for breaking changes
- **v2.x → v3.0**: New features, old syntax still works

### Deprecation Policy
1. Announce deprecation (1 version ahead)
2. Show warnings in compiler
3. Provide migration guide
4. Remove in next major version

---

## Open Questions & Design Discussions

### For the Community
1. Should we support object-oriented programming (classes, inheritance)?
2. Should we add pattern matching or keep it simple?
3. Should memory be file-based by default or in-memory?
4. How should we handle multi-model orchestration?
5. Should agents be stateful or functional?

### Technical Decisions
- Type system: Gradual or strict?
- Concurrency: Async/await or coroutines?
- Module system: Centralized registry or decentralized?
- Error handling: Exceptions or Result types?

---

## Performance Goals

| Metric | V1 | V2 | V3 |
|--------|----|----|-----|
| Startup time | <100ms | <100ms | <50ms |
| Simple expression eval | <1µs | <100ns | <10ns |
| Function call overhead | <10µs | <1µs | <100ns |
| Model call latency | 2-5s (API) | 2-5s | 2-5s |
| Memory usage | <50MB | <50MB | <100MB |

---

## Inspiration & References

### Language Design
- **Python**: Simplicity, readability
- **Lua**: Lightweight, embeddable
- **JavaScript**: Functions as first-class values
- **Go**: Clear error handling
- **Rust**: Type safety, memory safety

### AI Integration
- **LangChain**: Composable AI workflows
- **AutoGPT**: Agent autonomy
- **Semantic Kernel**: Model abstraction
- **LLM frameworks**: Best practices

### Community
- **Rust community**: Welcoming, inclusive
- **Python community**: Documentation focus
- **Go community**: Simplicity first

---

## Conclusion

Sesi is designed to evolve with AI. The roadmap balances:
- **Simplicity** (v1: core features only)
- **Power** (v2: advanced AI patterns)
- **Agents** (v3: autonomous systems)
- **Scale** (v4+: production readiness)

The journey from v1 (interpreter) to v4+ (distributed compiler) maintains backward compatibility while adding power where needed.

**Current focus**: Ship v1.0 with solid foundations, proven by real programs.

---

## See Also

- [Specification](./SPECIFICATION.md)
- [Architecture](./ARCHITECTURE.md)
- [AI Features](./AI_FEATURES.md)
- [Examples](../examples)
