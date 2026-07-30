# Local Models

Sesi runs local text models directly in Node.js:

```sesi
let answer = model("local") {max_tokens: 256} {"Explain closures."}
print answer
```

A provider API key is not required. The default model is `onnx-community/Qwen2.5-0.5B-Instruct` with the `q4` CPU
backend. Model weights are downloaded once and cached locally.

## Context and performance thresholds

The default model has a 32,768-token context window shared by the system
prompt, user input, chat-template overhead, and generated output.

Sesi's recommended CPU threshold is **2,048 input tokens**. Calls above
that threshold are allowed, but Sesi prints a warning because latency and
memory use increase sharply with longer prompts.

```sesi
let tokens = count_tokens(document, "local")
if tokens > 2048 {
  print "Consider chunking this document before local inference."
}
```

Configure or disable the warning:

```bash
# Warn above 4,096 input tokens
export SESI_LOCAL_WARN_TOKENS=4096

# Disable the warning
export SESI_LOCAL_WARN_TOKENS=0
```

The exported runtime constants are:

- `DEFAULT_LOCAL_MODEL`
- `DEFAULT_LOCAL_MODEL_WARNING_TOKENS`

## Reference benchmark

Observed on July 28, 2026:

| Item | Value |
| --- | --- |
| Computer | MacBook Air (Apple M2) |
| CPU | 8 cores: 4 performance, 4 efficiency |
| Memory | 8 GB |
| Architecture | arm64 |
| Operating system | macOS 26.6, build 25G5043d |
| Node.js | 24.12.0 |
| Runtime | Transformers.js 4.2.0, ONNX q4 CPU |
| Input | README.md, 18,829 characters / 4,612 tokens |
| Output cap | 256 tokens |
| Result | No response returned within five minutes; call stopped manually |

This is a single reference point, not a universal benchmark. Performance varies
with hardware, model, dtype, device, prompt length, and output length. On the
reference 8 GB M2 system, keep interactive prompts below 2,048 tokens and chunk
larger documents.

## Configuration

| Variable | Default |
| --- | --- |
| `SESI_LOCAL_MODEL` | `onnx-community/Qwen2.5-0.5B-Instruct` |
| `SESI_LOCAL_DTYPE` | `q4` |
| `SESI_LOCAL_DEVICE` | `cpu` |
| `SESI_LOCAL_CACHE_DIR` | `~/.cache/sesi/models` |
| `SESI_LOCAL_SYSTEM_PROMPT` | Sesi's local-assistant prompt |
| `SESI_LOCAL_WARN_TOKENS` | `2048` |

Use `model("local:organization/model")` to select a different compatible ONNX
model for one call.
