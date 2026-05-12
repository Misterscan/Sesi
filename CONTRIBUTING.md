# Contributing to Sesi

First off, thank you for considering contributing to Sesi! Sesi is building the future of AI-native programming, and community contributions are incredibly valuable.

## Setting Up Your Development Environment

To start developing Sesi locally, you'll need Node.js and TypeScript installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Misterscan/sesi.git
   cd sesi-programming-lang
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   The Sesi core is written in TypeScript. You must compile it to generate the executable engine.
   ```bash
   npm run build
   ```

4. **Install the CLI globally (optional but recommended):**
   ```bash
   npm install -g .
   ```
   Now you can use the `sesi` command anywhere.

5. **Set up your environment variables:**
   Create a `.env` file in the root directory for Gemini access:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

## Understanding the Architecture

Before making changes, we highly recommend reading the following documentation:
* [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Explains the Lexer, Parser, and Interpreter pipeline.
* [SPECIFICATION.md](docs/SPECIFICATION.md) - The source of truth for Sesi syntax.
* [BUILTINS.md](docs/BUILTINS.md) - How native functions are implemented.

### Core Guidelines
* **AST Modifications:** If you add syntax, you must update `src/lexer.ts`, `src/parser.ts`, and `src/types.ts` before modifying `src/interpreter.ts`.
* **TypeScript Settings:** Do not remove `import { type ... }` statements, as they are mandatory for type narrowing.
* **Interpreter Logic:** Tree-walking in `interpreter.ts` uses dynamic casting and `any` types by design. This is intentional for functional execution; do not attempt to "clean up" the dynamic `any` casts in the interpreter core.

## Testing Your Changes

Testing in Sesi involves both internal TypeScript testing and Sesi script execution.

1. **Run Unit Tests:** The core engine logic is tested via automated TypeScript tests found in the `tests/` directory. Run them to catch regressions:
   ```bash
   npm test
   ```

2. **Run Sesi Integration Scripts:** After making a change, rebuild the project and run the testing scripts inside the `main/tests/` or `examples/` directories to verify feature behavior end-to-end:

   ```bash
   npm run build
   sesi examples/01_hello.sesi
   sesi main/tests/test_syntax.sesi
   ```

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Ensure you have run `npm run build` to verify your TypeScript compiles.
3. **Write Unit Tests:** If you are adding a new core feature, built-in, or fixing a bug, you **must** write automated TypeScript unit tests in the `tests/` directory to cover your logic.
4. **Write Integration Scripts:** Write or update `.sesi` test scripts in `main/tests/` to demonstrate your feature or bug fix functioning end-to-end.
5. Follow standard conventional commits for your commit messages.
6. Create a descriptive Pull Request explaining the *why* and *how* of your changes. If it is an architectural change, please link an issue for discussion first.

## Issues and Feature Requests

If you find a bug or have a proposal for the language's roadmap, please open an issue. Provide as much context as possible, including system details, error output, and stripped-down reproducible `.sesi` scripts!
