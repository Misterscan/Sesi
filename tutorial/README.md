<div align="center">
<img src="banner.svg" alt="banner" width="100%" />
<img src="status-badge.svg" alt="status-banner" height="20" />
</div>

This directory contains two complementary tutorials:

- A 16-lesson browser course with an editor, real execution, answer checks, hints, solutions, search, and saved progress.
- A 10-lesson terminal course for learning directly from the command line.

Both tracks begin with deterministic, general-purpose Sesi programming. Model calls are introduced only in a clearly marked optional lesson.

## Interactive browser course

From the repository root:

```bash
npm run tutorial
```

The script opens [http://localhost:8080](http://localhost:8080) in your default browser and keeps the terminal process running while you work. Press Enter in the terminal to stop the local server.

The browser course covers:

1. Programs and printing
2. Values, variables, and operators
3. Strings and prompt templates
4. Arrays, objects, and JSON
5. Conditionals
6. Loops
7. Functions and typed contracts
8. Collection transforms and pipelines
9. Errors and cleanup
10. Safe file operations
11. Modules and the standard library
12. Async functions and `await`
13. Structured output
14. Optional model calls
15. CLI arguments and diagnostics
16. A deterministic release-summary capstone

Code submitted by the browser is compiled first, then run through the Sesi CLI in safe mode. The local runner limits snippet size and deletes its temporary source file after every request.

## Terminal course

Start or resume:

```bash
npm run tutorial
```

Navigate:

```bash
npm run tutorial narrate
npm run tutorial next
npm run tutorial back
npm run tutorial list
npm run tutorial name Ada
npm run tutorial reset
```

Notes:

- `narrate` enables accessibility text-to-speech for the lesson and advances to the next step, similar to `next`.
- Other commands may prompt for accessibility so narration can be enabled interactively.

Progress is saved to `tutorial/.sesi_tutorial_progress.json`. That local file is created only after the CLI course runs.

## Troubleshooting

- **Port 8080 is already in use:** stop the other local server, then rerun `npm run tutorial`.
- **The page cannot run code:** confirm the terminal running the tutorial server is still open.
- **A model lesson reports missing credentials:** this is expected unless `GEMINI_API_KEY` is configured. All core lessons work without it.
- **A filesystem example is blocked:** run the tutorial from the repository root so its relative paths remain inside the project sandbox.
- **Text-to-speech is unavailable:** Sesi uses local OS speech tools (`say` on macOS, PowerShell System.Speech on Windows, `espeak-ng` on Linux). Install the platform dependency or run without accessibility narration.
