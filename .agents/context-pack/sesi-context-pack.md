# Sesi Context Pack

## Project & Language

### project

**architecture**: **execution_engines**: - tree_walking_interpreter
    - bytecode_compiler_and_vm
  **primary_components**: - AI runtime and multi-provider model integration
    - Sesi language lexer, parser, AST, compiler, and VM
    - built-in runtime library
    - static semantic and type checking
    - standard modules for games, audio, drawing, browser automation, APIs, and databases
    - package manager and CLI execution entry points
**description**: A scripting language and runtime with a tree-walking interpreter, bytecode VM, AI model integration, built-in tooling, package management, and standard modules.
**entry_points**: - **exports**: - Lexer
      - Parser
      - Interpreter
      - Environment
      - Compiler
      - VM
      - disassemble
      - runInstall
    **module**: index
  - **functions**: - runSesi
      - runSesiFile
    **module**: runtime
**entrypoints**: **cli**: **functions**: - runSesi
      - runSesiFile
  **library**: **exports**: - Lexer
      - Parser
      - Interpreter
      - Compiler
      - VM
      - Environment
      - disassemble
      - runInstall
**language**: TypeScript
**name**: Sesi
**runtime**: Node.js

### title
Sesi Built-in Functions Reference

### description
Reference for Sesi built-in functions, standard-library modules, normal invocation, and pipe operator usage.

### language

**compiler**: **bytecode**: **capabilities**: - stack_operations
      - globals
      - locals
      - closures
      - upvalues
      - control_flow
      - collections
      - builtins
      - AI_calls
      - imports
      - memory_initialization
      - exception_handling
    **class**: OpCode
  **class**: Compiler
  **output**: Chunk
**diagnostics**: - lexical_errors
  - parser_errors
  - compiler_errors
  - dry_run_semantic_checks
  - type_checks
  - undefined_symbol_detection
  - unused_symbol_warnings
**execution_modes**: - bytecode_vm
  - tree_walking_interpreter
**keywords**: - let
  - fn
  - async
  - await
  - if
  - else
  - while
  - for
  - in
  - to
  - return
  - break
  - continue
  - try
  - catch
  - finally
  - prompt
  - model
  - image
  - convert
  - memory
  - import
  - export
  - allow
  - make
**name**: Sesi
**syntax_features**: - let_declarations
  - functions
  - async_functions
  - closures_and_upvalues
  - make_object_templates
  - arrays
  - objects
  - loops
  - conditions
  - try_catch_finally
  - imports
  - exports
  - memory_bindings
  - prompt_expressions
  - AI_model_expressions
  - image_generation_expressions
  - video_generation_expressions
  - conversion_expressions
  - structured_output
  - tool_calls
  - await_expressions
  - type_annotations
  - variables
  - default_parameters
  - member_access
  - index_access
  - assignments
  - if_else
  - while_loops
  - for_in_loops
  - range_loops
  - allow_namespace_imports
  - prompts
  - model_calls
  - image_calls
  - video_calls
  - await
  - pipeline_operator
**type_annotations**: **compound**: - array<T>
    - object<T>
    - T?
    - union_types
  **primitives**: - number
    - string
    - bool
    - any

### syntax

**normal_call**: function_name(argument1, argument2)
**note**: Piping passes the value on the left as the first function argument. Normal calls are generally recommended for readability.
**pipe_call**: value | function_name(other_arguments)

### sesi_language

**compiler**: **features**: - global_variables
    - local_variables
    - closures
    - upvalues
    - control_flow_jumps
    - exception_handlers
    - native_ai_opcodes
    - built_in_fast_path
  **target**: stack_based_bytecode
**lexical_features**: **expressions**: - binary_operations
    - unary_operations
    - logical_operations
    - assignments
    - calls
    - member_access
    - index_access
    - prompt
    - model
    - image
    - video
    - structured_output
    - tool_call
    - convert
    - await
  **literals**: - number
    - string
    - boolean
    - array
    - object
  **statements**: - let
    - fn
    - async_fn
    - make
    - if_else
    - while
    - for_in
    - for_range
    - return
    - break
    - continue
    - try_catch_finally
    - import
    - allow
    - export
    - memory
**parser**: **class_syntax**: **implementation**: parser_desugaring_to_factory_function
    **keyword**: make
  **strategy**: recursive_descent
  **supported_comments**: - line_comments
    - block_comments
**type_annotations**: **composites**: - array<T>
    - object<T>
    - optional_types
    - union_types
  **primitives**: - number
    - string
    - bool
    - any
**vm**: **execution_model**: stack_based
  **supports**: - closures
    - open_and_closed_upvalues
    - function_frames
    - native_builtin_calls
    - async_builtin_calls
    - try_catch_finally
    - model_calls
    - image_calls
    - video_calls
    - memory_bindings
    - timeout_enforcement

### language_engine

**bytecode**: **opcodes**: - CONSTANT
    - DEFINE_GLOBAL
    - GET_GLOBAL
    - SET_GLOBAL
    - GET_LOCAL
    - SET_LOCAL
    - ADD
    - SUBTRACT
    - MULTIPLY
    - DIVIDE
    - MODULO
    - JUMP
    - JUMP_IF_FALSE
    - LOOP
    - BUILD_ARRAY
    - BUILD_OBJECT
    - CLOSURE
    - CALL
    - CALL_BUILTIN
    - CALL_MODEL
    - CALL_IMAGE
    - CALL_VIDEO
    - PRINT
    - TRY_START
    - IMPORT
    - ALLOW
    - INITIALIZE_MEMORY
    - CONVERT
  **source**: chunk.ts
**compiler**: **optimizations**: - local_slot_variables
    - closure_upvalues
    - builtin_call_fast_path
    - dedicated_ai_opcodes
  **source**: compiler.ts
  **target**: bytecode
**execution_modes**: **default**: bytecode_vm
  **diagnostics**: - token_listing
    - AST_output
    - bytecode_disassembly
    - dry_run_semantic_checks
    - type_checks
    - profiling
  **fallback**: tree_walking_interpreter
**lexer**: **source**: lexer.ts
  **supports**: - identifiers
    - strings
    - numbers
    - comments
    - arrays
    - objects
    - arithmetic
    - logical_operators
    - type_annotations
    - async_await
    - imports
    - prompts
    - model_calls
**parser**: **source**: parser.ts
  **style**: recursive_descent
  **supports**: **expressions**: - literals
      - arrays
      - objects
      - function_calls
      - member_access
      - indexing
      - assignments
      - pipe_operator
      - prompts
      - model
      - image
      - video
      - convert
      - structured_output
      - tool_call
    **statements**: - let
      - fn
      - async_fn
      - make
      - if_else
      - while
      - for
      - return
      - break
      - continue
      - try_catch_finally
      - import
      - allow
      - export
      - memory

### language_features

**syntax**: **ai_primitives**: - model
    - image
    - video
    - structured_output
    - tool_call
  **control_flow**: - if_else
    - while
    - for_in
    - range_for
    - break
    - continue
    - try_catch_finally
    - return
  **declarations**: - let
    - const
    - fn
    - async
    - make
    - memory
    - prompt
  **expressions**: - literals
    - arrays
    - objects
    - indexing
    - member_access
    - assignments
    - arithmetic
    - comparisons
    - logical_short_circuiting
    - conditional_expressions
    - await
  **modules**: - import
    - allow
    - export
    - std_modules

### language_runtime

**bytecode**: **opcodes**: **ai**: - CALL_MODEL
      - CALL_IMAGE
      - CALL_VIDEO
    **arithmetic**: - ADD
      - SUBTRACT
      - MULTIPLY
      - DIVIDE
      - MODULO
      - NEGATE
    **collections**: - BUILD_ARRAY
      - BUILD_OBJECT
      - GET_INDEX
      - SET_INDEX
      - GET_PROPERTY
      - SET_PROPERTY
    **comparison**: - EQUAL
      - NOT_EQUAL
      - LESS
      - LESS_EQUAL
      - GREATER
      - GREATER_EQUAL
    **constants**: - CONSTANT
      - NIL
      - true
      - false
    **control_flow**: - JUMP
      - JUMP_IF_FALSE
      - LOOP
      - RETURN
      - RETURN_VOID
    **conversion**: - CONVERT
    **exceptions**: - TRY_START
      - TRY_END
      - FINALLY_START
      - FINALLY_END
    **functions**: - CLOSURE
      - CALL
      - CALL_BUILTIN
      - CLOSE_UPVALUE
    **memory**: - INITIALIZE_MEMORY
    **modules**: - IMPORT
      - ALLOW
    **variables**: - DEFINE_GLOBAL
      - GET_GLOBAL
      - SET_GLOBAL
      - GET_LOCAL
      - SET_LOCAL
      - GET_UPVALUE
      - SET_UPVALUE
**compiler**: **class**: Compiler
  **optimization**: **builtin_fast_path**: CALL_BUILTIN
  **supports**: - globals
    - local_slots
    - closures
    - upvalues
    - default_parameters
    - loops
    - break_continue
    - try_catch_finally
    - imports
    - memory
    - AI_call_opcodes
**execution_engines**: **bytecode_vm**: **default**: true
    **modules**: - chunk
      - compiler
      - vm
  **tree_walking_interpreter**: **available**: true
    **enabled_with**: treeWalker
**language**: Sesi
**lexer**: **class**: Lexer
  **supports**: - identifiers
    - numbers
    - strings
    - escaped_strings
    - comments
    - arrays
    - objects
    - functions
    - async_await
    - control_flow
    - imports
    - AI expressions
    - type_annotations
**parser**: **class**: Parser
  **language_features**: **ai_syntax**: - prompt
      - model
      - image
      - video
      - structured_output
      - tool_call
      - convert
    **control_flow**: - if_else
      - while
      - for_in
      - for_range
      - try_catch_finally
      - return
      - break
      - continue
    **declarations**: - let
      - fn
      - async_fn
      - make
      - memory
      - import
      - allow
      - export
    **expressions**: - arithmetic
      - comparisons
      - logical_operations
      - assignments
      - conditional_expressions
      - arrays
      - objects
      - indexing
      - member_access
      - function_calls
      - pipes
      - await
  **style**: recursive_descent

### language_toolchain

**bytecode**: **core_opcodes**: - CONSTANT
    - NIL
    - true
    - false
    - POP
    - DEFINE_GLOBAL
    - GET_GLOBAL
    - SET_GLOBAL
    - GET_LOCAL
    - SET_LOCAL
    - ADD
    - SUBTRACT
    - MULTIPLY
    - DIVIDE
    - MODULO
    - NEGATE
    - EQUAL
    - NOT_EQUAL
    - LESS
    - LESS_EQUAL
    - GREATER
    - GREATER_EQUAL
    - NOT
    - JUMP
    - JUMP_IF_FALSE
    - LOOP
    - BUILD_ARRAY
    - BUILD_OBJECT
    - GET_INDEX
    - SET_INDEX
    - GET_PROPERTY
    - SET_PROPERTY
    - CLOSURE
    - CALL
    - RETURN
    - CALL_BUILTIN
    - CALL_MODEL
    - CALL_IMAGE
    - CALL_VIDEO
    - PRINT
    - TRY_START
    - TRY_END
    - FINALLY_START
    - FINALLY_END
    - IMPORT
    - ALLOW
    - INITIALIZE_MEMORY
    - GET_UPVALUE
    - SET_UPVALUE
    - CLOSE_UPVALUE
    - CONVERT
**compiler**: **supports**: - global_variables
    - local_variables
    - closures
    - upvalues
    - default_function_parameters
    - control_flow
    - loops
    - break_continue
    - try_catch_finally
    - builtin_fast_path
    - model_image_video_opcodes
    - imports
    - memory_initialization
    - type_conversion
  **target**: bytecode_vm
**execution_modes**: **default**: bytecode_vm
  **diagnostics**: - token_dump
    - ast_dump
    - bytecode_dump
    - dry_run_semantic_checks
    - static_type_checks
    - profiling
    - execution_timeout
  **fallback**: tree_walking_interpreter
**lexer**: **supports**: - identifiers
    - numbers
    - strings
    - arrays
    - objects
    - comments
    - operators
    - type_annotations
    - async_await
    - imports_exports
    - model_image_video_calls
    - prompt_blocks
    - memory_blocks
**parser**: **architecture**: recursive_descent
  **supports**: **expressions**: - literals
      - arrays
      - objects
      - member_access
      - index_access
      - assignments
      - unary_operations
      - binary_operations
      - logical_operations
      - function_calls
      - await
      - model
      - image
      - video
      - convert
      - structured_output
      - tool_call
      - prompts
    **statements**: - let
      - fn
      - async_fn
      - make
      - if_else
      - while
      - for
      - return
      - break
      - continue
      - try_catch_finally
      - import
      - allow
      - export
      - memory
    **syntactic_sugar**: **make**: **description**: Desugars class-like make declarations into factory functions with self-bound fields, methods, and optional start constructors.


---

## AI Integration

### AIRuntime

**cache**: **cache_key_includes**: - model
    - resolved local model
    - local dtype
    - local device
    - local system prompt
    - prompt
    - temperature
    - maxTokens
    - topK
    - topP
    - ratio
    - size
    - images
    - systemPrompt
    - thinkingLevel
    - search
    - tools
  **cached_response_behavior**: **cached**: true
    **usage**: **inputTokens**: 0
      **outputTokens**: 0
      **thinkingTokens**: 0
  **disabled_when**: request.cache is false
  **enabled_by_default**: true
  **file**: .sesi_cache.json
  **key_algorithm**: SHA-256
  **location**: Current working directory
**embeddings**: **cache_key**: SHA-256 of input text
  **fallback_models**: - gemini-embedding-001
    - gemini-embedding-2
  **method**: embedText
  **provider**: Gemini
**image_generation**: **gemini**: **condition**: request.model contains image
    **output**: Base64 encoded image
    **response_modality**: IMAGE
  **openai**: **handler**: callGPTImageModel
    **ratio_mapping**: **16:9**: 1536x1024
      **1:1**: 1024x1024
      **3:4**: 1024x1536
      **4:3**: 1536x1024
      **9:16**: 1024x1536
    **supported_sizes**: - 1024x1024
      - 1536x1024
      - 1024x1536
**memory**: **operations**: **appendToMemory**: **behavior**: Adds a content entry to a memory history
    **autoTrimMemory**: **behavior**: Trims only when automatic summarization is enabled
    **getMemory**: **behavior**: Returns newline-joined history
    **initializeMemory**: **behavior**: Initializes a memory ID with one entry
    **searchMemory**: **behavior**: Embeds the query and each memory entry, calculates cosine similarity, and returns the highest scoring entries.

    **trimMemory**: **behavior**: Forces memory compression under a supplied token limit
    **updateMemory**: **behavior**: Replaces history with one entry
  **summarization**: **defaults**: **enabled**: true
      **maxTokens**: 900000
      **summaryModel**: gemini-3.5-flash-lite
      **targetTokens**: 60% of maxTokens
    **environment_variables**: **SESI_MEMORY_AUTO_SUMMARIZE**: **disable_value**: false
      **SESI_MEMORY_MAX_TOKENS**: Maximum memory token budget
      **SESI_MEMORY_SUMMARY_MODEL**: Model used for summarization
      **SESI_MEMORY_TARGET_TOKENS**: Target compressed memory token budget
    **strategy**: - Preserves recent memory using approximately 55% of target token budget
      - Summarizes older memory with an AI model
      - Stores summary under "[Memory Summary]"
      - Stores retained recent content under "[Recent Memory]"
      - Applies per-memory locks to prevent concurrent trim races
    **summary_requirements**: - facts
      - decisions
      - constraints
      - user preferences
      - unresolved tasks
      - names
      - dates
      - identifiers
**model_routing**: **gemini**: **condition**: Default provider
    **handler**: Gemini generateContent APIs
  **local**: **condition**: model equals local or starts with local:
    **handler**: callLocalModel
  **openai_image**: **condition**: model starts with gpt- and contains image
    **handler**: callGPTImageModel
  **openai_text**: **condition**: model starts with gpt-
    **handler**: callGPTModel
**providers**: **gemini**: **authentication**: **environment_variable**: GEMINI_API_KEY
    **continuation**: **behavior**: When generation ends with MAX_TOKENS, appends partial output to the conversation and asks the model to continue.

      **maximum_polls**: 10
    **model_normalization**: **behavior**: Adds the models/ prefix unless the model is already a models/, projects/, publishers/, or slash-qualified identifier.

    **model_selector**: Gemini model names and Google model paths
    **sdk**: @google/genai
    **supports**: - text generation
      - streaming
      - image input
      - audio input
      - image generation
      - video generation
      - text-to-speech
      - speech transcription
      - function tools
      - Google Search
      - native token counting
      - embeddings
  **local**: **caching**: **fallback**: If a local cached model fails to load, retries while allowing remote download.

      **validates**: - config.json
        - tokenizer.json
        - ONNX model file
        - ONNX external data file for small ONNX headers
    **configuration**: **SESI_LOCAL_CACHE_DIR**: **default**: ~/.cache/sesi/models
        **purpose**: Model cache directory
      **SESI_LOCAL_DEVICE**: **default**: cpu
        **purpose**: Inference device
      **SESI_LOCAL_DTYPE**: **default**: q4
        **purpose**: ONNX model datatype
      **SESI_LOCAL_MODEL**: **purpose**: Overrides the default local model
      **SESI_LOCAL_SYSTEM_PROMPT**: **purpose**: Default system prompt for local models
      **SESI_LOCAL_WARN_TOKENS**: **default**: 2048
        **purpose**: Warning threshold for large local prompts
    **default_model**: onnx-community/Qwen2.5-0.5B-Instruct
    **model_selector**: **accepted**: - local
        - local:<organization/model>
    **runtime**: @huggingface/transformers
    **supported**: - text generation
      - streaming
      - function tools
      - native tokenizer-based token counting
    **unsupported**: - images
      - audio
      - web search
  **openai**: **APIs**: **image**: **condition**: GPT model name contains 'image'
        **endpoint**: images.generate
        **supports**: - prompt-based image generation
          - ratio-to-size mapping
        **unsupported**: - audio input
          - reference images
          - tools
          - web search
          - streaming
      **text**: **endpoint**: responses.create
        **supports**: - text generation
          - streaming
          - images as input
          - function tools
          - web search
          - reasoning effort
          - native input token counting
    **authentication**: **environment_variable**: OPENAI_API_KEY
    **model_selector**: Models whose names begin with gpt-
    **reasoning_effort_mapping**: **high**: high
      **low**: low
      **medium**: medium
      **minimal**: minimal
      **no**: minimal
    **sdk**: openai
**request_features**: **audio**: **supported_by**: - Gemini text
      - Gemini transcription
    **unsupported_by**: - local
      - OpenAI GPT text
      - OpenAI GPT image
  **context_injection**: **enabled_for**: - OpenAI text
      - Gemini text
    **format**: [System context: Current date and time is <UTC date>]
  **images**: **encoding**: Base64
    **source**: Local filesystem paths
    **supported_by**: - OpenAI text
      - Gemini text
      - Gemini image generation
  **search**: **gemini**: **tool**: googleSearch
    **openai**: **tool**: web_search
  **streaming**: **behavior**: **callback**: Calls request.stream when it is a function
      **stdout**: Writes deltas to stdout when request.stream is true
    **supported_by**: - local
      - OpenAI text
      - Gemini text
  **tool_calls**: **gemini**: **response_format**: JSON string representing functionCall or call
    **local**: **accepted_formats**: - structured tool_calls
        - <tool_call>JSON</tool_call>
        - [TOOL_CALLS] JSON
        - fenced JSON
      **response_format**: JSON string with TOOL_CALL finish reason
    **openai**: **response_format**: JSON string containing name, args, and optional call_id
**speech**: **synthesis**: **default_model**: gemini-2.5-flash-preview-tts
    **default_voice**: Vindemiatrix
    **method**: synthesizeSpeech
    **output**: Base64 encoded WAV
    **processing**: - Receives PCM audio from Gemini
      - Extracts sample rate from MIME type
      - Constructs a 44-byte WAV header
    **provider**: Gemini
  **transcription**: **default_model**: gemini-3.5-flash-lite
    **method**: transcribeSpeech
    **optional_language_instruction**: true
    **output**: Plain transcript text
    **provider**: Gemini
**state**: **_client**: **purpose**: Lazy-initialized Google Gemini client
  **_openAIClient**: **purpose**: Lazy-initialized OpenAI client
  **conversationHistory**: **purpose**: Stores memory entries by memory ID
    **type**: Map<string, string[]>
  **embeddingCache**: **purpose**: Caches embeddings by SHA-256 text hash
    **type**: Map<string, number[]>
  **localPipelines**: **purpose**: Caches pending and initialized local text-generation pipelines
    **type**: Map<string, Promise<any>>
  **localTokenizers**: **purpose**: Caches pending and initialized local tokenizers
    **type**: Map<string, Promise<any>>
  **memorySummaryConfigs**: **type**: Map<string, MemorySummaryConfig>
  **memoryTrimLocks**: **purpose**: Prevents concurrent trimming of the same memory
    **type**: Map<string, Promise<MemoryTrimResult>>
**structured_output**: **behavior**: - Attempts to extract a JSON object from model output
    - Filters parsed values to keys declared in the supplied schema
    - If no JSON is found, asks Gemini to convert the response to JSON
    - Returns an empty object if parsing fails
  **method**: parseStructuredOutput
**token_counting**: **gemini**: **endpoint**: models.countTokens
  **heuristic**: **formula**: ceil(text.length / 4)
  **local**: **fallback**: Character-based estimate
    **method**: Local tokenizer encode method
  **openai**: **endpoint**: responses.inputTokens.count
**video_generation**: **handler**: callVideo
  **modes**: **omni**: **condition**: model name contains omni
      **endpoint**: interactions.create
      **supports**: - prompt
        - multiple reference images
        - aspect ratio
        - task configuration
    **standard**: **endpoint**: models.generateVideos
      **polling**: **default_interval_ms**: 10000
        **minimum_interval_ms**: 100
      **supports**: - prompt
        - first reference image
        - aspect ratio
        - duration
        - resolution
        - negative prompt
        - audio generation
  **output**: Base64 encoded MP4 video
  **provider**: Gemini

### ai_features

**caching**: **file**: .sesi_cache.json
  **hash_algorithm**: sha256
  **includes**: - model
    - prompt
    - generation_parameters
    - image_inputs
    - system_prompt
    - tools
    - local_model_configuration
**memory**: **defaults**: **max_tokens**: 900000
    **summary_model**: gemini-3.5-flash-lite
    **target_tokens_ratio**: 0.6
  **features**: - conversation_history
    - embedding_search
    - automatic_summarization
    - token_budget_trimming
    - per_memory_configuration
**tool_orchestration**: **max_tool_calls_default**: 8
  **safety_restrictions**: - exec
    - run
    - spawn
    - python
    - js
    - ffmpeg
    - gif
    - video

### ai_runtime

**cache**: **algorithm**: sha256
  **cache_key_includes**: - model
    - local_model_configuration
    - prompt
    - sampling_configuration
    - image_paths
    - system_prompt
    - thinking_level
    - search
    - tools
  **file**: .sesi_cache.json
**caching**: **algorithm**: sha256
  **behavior**: **cache_hit**: **streams_cached_text**: true
      **usage**: **input_tokens**: 0
        **output_tokens**: 0
        **thinking_tokens**: 0
    **cached_usage**: **inputTokens**: 0
      **outputTokens**: 0
      **thinkingTokens**: 0
  **cache_key_includes**: - model
    - local model configuration
    - prompt
    - generation parameters
    - images
    - system prompt
    - thinking level
    - search setting
    - tools
    - generation_parameters
    - system_prompt
    - thinking_level
    - local_model_configuration
  **cache_key_inputs**: - model
    - prompt
    - local_model_configuration
    - temperature
    - max_tokens
    - sampling_parameters
    - image_inputs
    - system_prompt
    - thinking_level
    - search
    - tools
  **file**: .sesi_cache.json
  **hash_algorithm**: sha256
  **includes**: - model
    - local_model_settings
    - prompt
    - sampling_settings
    - images
    - system_prompt
    - thinking_level
    - search
    - tools
    - resolved_local_model
    - local_dtype
    - local_device
    - generation_parameters
    - image_paths
    - tool_definitions
    - local_model_configuration
**class**: AIRuntime
**common_features**: - request caching in .sesi_cache.json
  - SHA-256 cache keys
  - current UTC time context injection
  - token usage reporting
  - streaming callbacks or stdout streaming
  - structured-output parsing
  - prototype stripping for untrusted objects
  - tool-call extraction
  - image path resolution
  - model-specific request normalization
**default_local_model**: onnx-community/Qwen2.5-0.5B-Instruct
**default_local_warning_tokens**: 2048
**embeddings**: **fallback_models**: - gemini-embedding-001
    - gemini-embedding-2
  **similarity**: cosine
**instance**: aiRuntime
**local_cache**: **file**: .sesi_cache.json
  **includes**: - model
    - prompt
    - sampling_configuration
    - image_paths
    - system_prompt
    - tool_configuration
    - local_model_configuration
  **strategy**: SHA-256
**local_model_handling**: **allowed_model_id_format**: organization/model
  **generation_defaults**: **max_new_tokens**: 512
    **sampling_enabled_when_temperature_positive**: true
  **model_id_validation**: **rejects**: - .
      - ..
      - IDs without exactly one slash
    **segment_pattern**: ^[A-Za-z0-9._-]+$
  **tool_call_formats_supported**: - native_tool_calls
    - <tool_call>{...}</tool_call>
    - [TOOL_CALLS] {...}
    - fenced_json
    - plain_json
**media**: **image_generation**: **gemini**: **response_modality**: IMAGE
      **supports_reference_images**: true
    **openai**: **ratio_mapping**: **16:9**: 1536x1024
        **1:1**: 1024x1024
        **3:4**: 1024x1536
        **4:3**: 1536x1024
        **9:16**: 1024x1536
      **supported_sizes**: - 1024x1024
        - 1536x1024
        - 1024x1536
  **speech_synthesis**: **default_model**: gemini-2.5-flash-preview-tts
    **default_voice**: Vindemiatrix
    **output**: base64_encoded_wav
    **provider**: gemini
  **transcription**: **default_model**: gemini-3.5-flash-lite
    **output**: plain_transcript
    **provider**: gemini
  **video_generation**: **modes**: - omni_interactions
      - generateVideos_operation_polling
    **outputs**: base64_encoded_video
    **provider**: gemini
**memory**: **automatic_summarization**: true
  **capabilities**: - initialize
    - append
    - retrieve
    - update
    - semantic_search
    - automatic_summarization
    - token_budget_trimming
    - initialize memory
    - append memory
    - retrieve memory
    - update memory
    - semantic memory search
    - automatic summarization
    - token-budget trimming
    - concurrent trim locking
  **conversation_history**: in_memory_map
  **default_max_tokens**: 900000
  **default_summary_configuration**: **enabled**: true
    **max_tokens**: 900000
    **model**: gemini-3.5-flash-lite
    **summary_model**: gemini-3.5-flash-lite
    **target_tokens_ratio**: 0.6
  **default_summary_model**: gemini-3.5-flash-lite
  **default_target_ratio**: 0.6
  **defaults**: **auto_summarize**: true
    **max_tokens**: 900000
    **summary_model**: gemini-3.5-flash-lite
    **target_tokens_ratio**: 0.6
  **embedding_cache**: in_memory_map
  **embedding_models**: - gemini-embedding-001
    - gemini-embedding-2
  **embeddings**: **models**: - gemini-embedding-001
      - gemini-embedding-2
    **similarity**: cosine_similarity
  **environment_variables**: **SESI_MEMORY_AUTO_SUMMARIZE**: Set to false to disable automatic summarization.
    **SESI_MEMORY_MAX_TOKENS**: Maximum estimated token count.
    **SESI_MEMORY_SUMMARY_MODEL**: Model used for memory summaries.
    **SESI_MEMORY_TARGET_TOKENS**: Target token count after compaction.
  **features**: - initialize
    - append
    - update
    - retrieve
    - semantic_search
    - automatic_summarization
    - token_budget_trimming
    - per_memory_configuration
    - concurrent_trim_locking
  **functions**: - initializeMemory
    - appendToMemory
    - getMemory
    - updateMemory
    - autoTrimMemory
    - trimMemory
    - searchMemory
    - configureMemorySummary
  **operations**: - initialize
    - append
    - get
    - update
    - semantic_search
    - automatic_trim
    - manual_trim
    - configuration
  **semantic_search**: **embedding_cache**: sha256_keyed
    **embedding_models**: - gemini-embedding-001
      - gemini-embedding-2
    **similarity**: cosine_similarity
  **storage**: in_memory_conversation_history
  **summarization**: **default_max_tokens**: 900000
    **default_model**: gemini-3.5-flash-lite
    **default_target_fraction**: 0.6
    **environment_variables**: - SESI_MEMORY_AUTO_SUMMARIZE
      - SESI_MEMORY_MAX_TOKENS
      - SESI_MEMORY_TARGET_TOKENS
      - SESI_MEMORY_SUMMARY_MODEL
  **summary_format**: - [Memory Summary]
    - [Recent Memory]
**multimedia**: **image_generation**: **providers**: - OpenAI GPT image models
      - Gemini image models
  **speech**: **synthesis**: **default_voice**: Vindemiatrix
      **output**: Base64-encoded WAV
      **provider**: Gemini
    **transcription**: **default_model**: gemini-3.5-flash-lite
      **provider**: Gemini
  **video_generation**: **features**: - reference images
      - aspect ratio
      - duration
      - resolution
      - negative prompt
      - audio generation
      - polling interval
    **provider**: Gemini
    **supported_modes**: - Omni interaction video generation
      - asynchronous generateVideos polling
**persistent_response_cache**: **algorithm**: SHA-256
  **cache_key_includes**: - model
    - local_model_configuration
    - prompt
    - generation_settings
    - images
    - system_prompt
    - reasoning_settings
    - search
    - tools
  **file**: .sesi_cache.json
**providers**: **gemini**: **APIs**: - models.generateContent
      - models.generateContentStream
      - models.countTokens
      - models.embedContent
      - models.generateVideos
      - interactions.create
    **authentication**: GEMINI_API_KEY
    **capabilities**: - text_generation
      - image_input
      - audio_input
      - image_generation
      - video_generation
      - speech_synthesis
      - speech_transcription
      - embeddings
      - token_counting
      - search
      - tools
      - streaming
      - text generation
      - streaming output
      - image inputs
      - audio inputs
      - image generation
      - video generation
      - speech synthesis
      - speech transcription
      - native token counting
      - Google Search tools
      - function declarations
      - thinking configuration
      - google_search_grounding
      - function_tools
      - text_to_speech
      - speech_to_text
      - function_calling
      - google_search
      - web_search
      - tool_calls
      - native_token_counting
      - audio_transcription
      - memory_summarization
    **credential**: GEMINI_API_KEY
    **default_provider**: true
    **default_transcription_model**: gemini-3.5-flash-lite
    **default_tts_model**: gemini-2.5-flash-preview-tts
    **embedding_models**: - gemini-embedding-001
      - gemini-embedding-2
    **features**: - text_generation
      - image_input
      - audio_transcription
      - image_generation
      - video_generation
      - text_to_speech
      - streaming
      - function_tools
      - google_search
      - embeddings
      - token_counting
      - reasoning_configuration
    **model_detection**: gemini-*
    **model_name_normalization**: **default_prefix**: models/
      **prefix**: models/
      **prefixes_preserved**: - models/
        - projects/
        - publishers/
      **preserves_fully_qualified_prefixes**: - models/
        - projects/
        - publishers/
    **model_pattern**: ^(models/)?gemini-
    **model_prefixes**: - gemini-
      - models/gemini-
    **package**: @google/genai
    **required_environment**: - GEMINI_API_KEY
    **sdk**: @google/genai
    **sdk_package**: @google/genai
    **supported_features**: - text_generation
      - streaming
      - image_input
      - audio_input
      - image_generation
      - video_generation
      - embeddings
      - text_to_speech
      - transcription
      - native_token_counting
      - function_tools
      - google_search
    **trigger_models**: - gemini-*
      - models/gemini-*
  **local**: **cache_directory**: ~/.cache/sesi/models
    **cache_validation**: **onnx_directory**: onnx
      **required_files**: - config.json
        - tokenizer.json
      **supports_split_onnx_data_files**: true
    **caching**: **cache_directory_default**: ~/.cache/sesi/models
      **checks**: - config.json
        - tokenizer.json
        - ONNX model file
        - ONNX data file for small model headers
      **fallback_behavior**: If an apparently cached model cannot load, retry with remote downloads enabled.

      **local_model_validation**: **checks_external_onnx_data**: true
        **required_files**: - config.json
          - tokenizer.json
          - onnx/model_<dtype>.onnx
      **pipeline_cache_key**: - model
        - dtype
        - device
        - cache_directory
      **tokenizer_cache_key**: - model
        - cache_directory
    **capabilities**: - text_generation
      - token_counting
      - streaming
      - tool_calls
      - tokenizer_based_token_counting
      - tool_call_parsing
      - local_model_caching
      - local_token_counting
      - tool_call_extraction
      - local_model_download_and_cache
    **configuration**: **cache_directory_default**: ~/.cache/sesi/models
      **default_warning_tokens**: 2048
      **environment_variables**: **SESI_LOCAL_CACHE_DIR**: Local model cache directory
        **SESI_LOCAL_DEVICE**: Execution device; default cpu
        **SESI_LOCAL_DTYPE**: Model quantization/type; default q4
        **SESI_LOCAL_MODEL**: Override default local Hugging Face model ID
        **SESI_LOCAL_SYSTEM_PROMPT**: Default local model system prompt
        **SESI_LOCAL_WARN_TOKENS**: CPU prompt-size warning threshold
    **default_device**: cpu
    **default_dtype**: q4
    **default_model**: onnx-community/Qwen2.5-0.5B-Instruct
    **defaults**: **cache_directory**: ~/.cache/sesi/models
      **device**: cpu
      **device_env**: SESI_LOCAL_DEVICE
      **dtype**: q4
      **dtype_env**: SESI_LOCAL_DTYPE
    **engine**: @huggingface/transformers
    **environment_variables**: **SESI_LOCAL_CACHE_DIR**: Model-cache directory.
      **SESI_LOCAL_DEVICE**: Inference device; defaults to cpu.
      **SESI_LOCAL_DTYPE**: Local ONNX model data type; defaults to q4.
      **SESI_LOCAL_MODEL**: Overrides the default local Hugging Face model.
      **SESI_LOCAL_SYSTEM_PROMPT**: Default local-model system prompt.
      **SESI_LOCAL_WARN_TOKENS**: Input warning threshold; 0 disables warnings.
    **features**: - text_generation
      - streaming
      - tool_call_normalization
      - token_counting
      - local_model_cache
      - Hugging Face Transformers dynamic import
      - Node.js remote-model support
      - local model cache detection
      - tokenizer caching
      - text generation
      - tool-call normalization and parsing
      - input token warnings
    **implementation**: @huggingface/transformers
    **library**: @huggingface/transformers
    **limitations**: - text_only_input
      - no_audio_input
      - no_search
      - no_image_input
      - no_web_search
    **model_prefixes**: - local
      - local:<huggingface-model-id>
      - local:<huggingface-organization/model>
      - local:<huggingface-org/model>
    **model_selector**: **aliases**: - local
        - local:<huggingface-org/model>
      **default_model**: onnx-community/Qwen2.5-0.5B-Instruct
    **package**: @huggingface/transformers
    **restrictions**: - images_not_supported
      - audio_not_supported
      - search_not_supported
      - text_only
      - no_audio_input
      - no_search
    **selector**: **accepted_models**: - local
        - local:<huggingface-organization/model>
    **supported_features**: - text_generation
      - streaming
      - tool_calls
      - local_token_counting
    **task**: text-generation
    **transformer_package**: @huggingface/transformers
    **transformers_package**: @huggingface/transformers
    **trigger_models**: - local
      - local:<huggingface-model-id>
      - local:<huggingface-org>/<model>
    **unsupported_features**: - image_input
      - audio_input
      - web_search
    **unsupported_inputs**: - images
      - audio
      - search
      - web search
  **openai**: **APIs**: - responses.create
      - responses.inputTokens.count
      - images.generate
      - Responses API
      - Images API
      - Input token counting API
    **api**: - responses.create
      - responses.inputTokens.count
      - images.generate
    **authentication**: OPENAI_API_KEY
    **capabilities**: - text_generation
      - image_input
      - image_generation
      - tool_calls
      - web_search
      - streaming
      - native_token_counting
      - text generation
      - streaming output
      - image inputs through base64 data URLs
      - image generation
      - function tools
      - web search
      - reasoning-effort mapping
      - function_tools
      - reasoning_effort
      - responses_api
      - token_counting
      - reasoning_effort_mapping
    **credential**: OPENAI_API_KEY
    **features**: - text_generation
      - image_input
      - image_generation
      - streaming
      - function_tools
      - web_search
      - reasoning_effort
      - token_counting
    **image_model_detection**: GPT model name contains 'image'.
    **image_models**: **detected_when**: GPT model name contains 'image'
      **supported_sizes**: - 1024x1024
        - 1536x1024
        - 1024x1536
    **image_sizes**: - 1024x1024
      - 1536x1024
      - 1024x1536
    **model_detection**: ^gpt-
    **model_pattern**: ^gpt-
    **model_prefix**: gpt-
    **package**: openai
    **reasoning_effort_levels**: - minimal
      - low
      - medium
      - high
    **reasoning_efforts**: - minimal
      - low
      - medium
      - high
    **required_environment**: - OPENAI_API_KEY
    **sdk**: openai
    **sdk_package**: openai
    **selector**: ^gpt-
    **supported_features**: - responses_api
      - streaming
      - image_input
      - tools
      - web_search
      - token_counting
      - image_generation
    **supported_image_sizes**: - 1024x1024
      - 1536x1024
      - 1024x1536
    **trigger_models**: - gpt-*
**request_features**: - model
  - prompt
  - system_prompt
  - temperature
  - max_tokens
  - top_k
  - top_p
  - ratio
  - image_size
  - images
  - audio
  - tools
  - search
  - thinking_level
  - streaming
  - caching
  - cache
  - size
  - image_ratio
  - stream
  - system_prompts
  - reasoning_or_thinking_level
  - tool_schemas
  - web_search
**response_features**: - text
  - finish_reason
  - token_usage
  - thinking_token_usage
  - cached
**response_fields**: - text
  - finishReason
  - usage.inputTokens
  - usage.outputTokens
  - usage.thinkingTokens
  - cached
**safety**: **local_model_id_validation**: true
  **local_tool_call_normalization**: true
  **prototype_stripping**: true
  **tool_argument_json_parsing**: true
**safety_features**: - prototype_stripping_for_external_data
  - local_model_id_validation
  - cached_model_fallback_to_remote_download
  - tool_call_normalization
  - automated_tool_limit
**singleton**: aiRuntime
**singleton_export**: aiRuntime
**speech**: **synthesis**: **default_model**: gemini-2.5-flash-preview-tts
    **default_voice**: Vindemiatrix
    **output**: base64_encoded_wav
    **provider**: Gemini
  **transcription**: **default_model**: gemini-3.5-flash-lite
    **output**: transcript_text
    **provider**: Gemini
**supported_providers**: **gemini**: **authentication**: GEMINI_API_KEY
    **capabilities**: - text_generation
      - image_input
      - audio_transcription
      - image_generation
      - video_generation
      - speech_synthesis
      - embeddings
      - native_token_counting
      - Google_Search_grounding
      - function_tools
      - streaming
    **model_prefixes**: - gemini-
      - models/gemini-
    **sdk**: @google/genai
  **local**: **cache_directory**: ~/.cache/sesi/models
    **capabilities**: - text_generation
      - local_token_counting
      - streaming
      - tool_call_extraction
    **default_device**: cpu
    **default_dtype**: q4
    **default_model**: onnx-community/Qwen2.5-0.5B-Instruct
    **environment_variables**: - SESI_LOCAL_MODEL
      - SESI_LOCAL_DTYPE
      - SESI_LOCAL_DEVICE
      - SESI_LOCAL_CACHE_DIR
      - SESI_LOCAL_SYSTEM_PROMPT
      - SESI_LOCAL_WARN_TOKENS
    **invocation**: dynamic_import
    **limitations**: - text_only_input
      - no_audio_input
      - no_search
    **package**: @huggingface/transformers
  **openai**: **APIs**: - responses.create
      - responses.inputTokens.count
      - images.generate
    **authentication**: OPENAI_API_KEY
    **capabilities**: - text_generation
      - image_input
      - streaming
      - function_tools
      - web_search
      - image_generation
      - token_counting
    **model_detection**: ^gpt-
    **sdk**: openai
**utilities**: - strip_prototypes
  - cosine_similarity
  - token_estimation
  - native_token_counting
  - embedding_cache
  - image_to_base64_conversion
  - audio_pcm_to_wav_conversion
**video_generation**: **output**: base64_encoded_video
  **supports**: - Gemini video generation operations
    - Omni interaction-based video generation
    - reference images
    - aspect ratios
    - durations
    - resolutions
    - negative prompts
    - generated audio
    - operation polling

### ai_usage

- **description**: Estimates paid-tier text-token costs in USD.
  **name**: estimate_cost
  **pipe_supported**: true
  **result_fields**: - input_tokens
    - output_tokens
    - input_cost_usd
    - output_cost_usd
    - total_cost_usd
    - input_per_million
    - output_per_million
    - pricing_source
    - pricing_snapshot_date
  **signature**: estimate_cost(model, input, output = 0, rates = null) -> object|null
- **description**: Returns usage and estimated cost for the latest model() call.
  **name**: model_usage
  **notable_fields**: - total_tokens
    - thinking_tokens
    - billable_output_tokens
    - total_cost_usd
    - cached
  **signature**: model_usage() -> object|null

---

## Builtins & Modules

### builtins

**AI**: - speech
  - from_speech
  - translate
  - count_tokens
  - estimate_tokens
  - estimate_cost
  - model_usage
  - memory_search
  - memory_trim
  - memory_config
  - workflow
  - set_alias
  - define_tool
  - list_tools
**ai**: - speech
  - from_speech
  - translate
  - count_tokens
  - estimate_tokens
  - estimate_cost
  - model_usage
  - memory_search
  - memory_trim
  - memory_config
  - set_alias
  - workflow
  - define_tool
  - list_tools
**archive_support**: **external_archives**: - 7z
    - rar
    - tar
    - tar.gz
    - tgz
    - tar.bz2
    - tbz2
    - tar.xz
    - txz
  **protections**: - validates all archive entry paths
    - rejects absolute archive paths
    - rejects traversal entries
    - disables non-ZIP archives in safe mode
  **zip_containers**: - zip
    - jar
    - apk
    - docx
    - xlsx
    - pptx
    - epub
**categories**: **AI**: - count_tokens
    - estimate_tokens
    - estimate_cost
    - model_usage
    - memory_search
    - memory_trim
    - memory_config
    - define_tool
    - list_tools
    - set_alias
    - workflow
  **AI_and_memory**: - workflow
    - memory_search
    - memory_trim
    - memory_config
    - set_alias
    - define_tool
    - list_tools
    - retry
    - lazy
    - force
    - timeout
  **ai**: - speech
    - from_speech
    - translate
    - count_tokens
    - estimate_tokens
    - estimate_cost
    - model_usage
    - memory_search
    - memory_trim
    - memory_config
    - workflow
    - define_tool
    - list_tools
    - tokenize
    - set_alias
  **ai_and_memory**: - workflow
    - memory_search
    - memory_trim
    - memory_config
    - set_alias
    - define_tool
    - list_tools
  **basic**: - show
    - debug
    - input
    - len
    - type
    - str
    - num
    - float
    - bool
    - time
    - random
    - env
  **collections**: - range
    - push
    - append
    - pop
    - keys
    - values
    - join
    - split
    - map
    - filter
    - reduce
    - find
    - reverse
    - sort
    - unique
    - flatten
  **control_flow**: - retry
    - lazy
    - force
    - timeout
    - multi_req
  **core**: - show
    - debug
    - input
    - len
    - type
    - str
    - num
    - float
    - bool
    - range
    - env
    - time
    - random
  **cryptography**: - encrypt
    - decrypt
  **data**: - len
    - type
    - str
    - num
    - float
    - bool
    - to_json
    - from_json
    - keys
    - values
    - range
    - push
    - append
    - pop
    - join
    - split
    - slice
    - reverse
    - sort
    - unique
    - flatten
  **errors**: - error_type
    - raise_error
  **external_execution**: - exec
    - run
    - spawn
    - python
    - js
    - sesi
  **files**: - read_file
    - write_file
    - append_file
    - write_image
    - list_dir
    - get_ext
    - exists
    - make_dir
    - rename
    - archive
    - trash
    - zip
  **filesystem**: - read_file
    - write_file
    - append_file
    - write_image
    - open_file
    - open
    - list_dir
    - get_ext
    - exists
    - make_dir
    - rename
    - archive
    - trash
    - zip
  **functional**: - map
    - filter
    - reduce
    - find
    - multi_req
    - lazy
    - force
    - timeout
    - retry
    - workflow
  **general**: - show
    - debug
    - input
    - len
    - type
    - str
    - num
    - float
    - bool
    - time
    - random
    - env
    - range
  **json_and_crypto**: - to_json
    - from_json
    - encrypt
    - decrypt
  **matrices**: - matrix_dot
    - matrix_transpose
    - matrix_add
    - matrix_sub
    - matrix_mul_elements
    - matrix_scale
    - matrix_sigmoid
    - matrix_dsigmoid
    - matrix_sum_rows
    - matrix_mse
  **matrix**: - matrix_dot
    - matrix_transpose
    - matrix_add
    - matrix_sub
    - matrix_mul_elements
    - matrix_scale
    - matrix_sigmoid
    - matrix_dsigmoid
    - matrix_sum_rows
    - matrix_mse
  **media**: - speech
    - from_speech
    - translate
    - ffmpeg
    - gif
    - video
  **network**: - web_get
    - web_send
    - listen
    - api
    - live
  **networking**: - web_get
    - web_send
    - listen
    - api
    - live
  **process**: - exec
    - run
    - spawn
    - python
    - js
    - sesi
  **processes**: - spawn
    - exec
    - run
    - python
    - js
    - sesi
  **profiling**: - profile
    - profile_start
    - profile_end
    - profile_report
  **runtime_control**: - retry
    - lazy
    - force
    - timeout
    - profile
    - profile_start
    - profile_end
    - profile_report
    - multi_req
    - live
  **serialization_and_crypto**: - to_json
    - from_json
    - encrypt
    - decrypt
  **strings**: - to_upper
    - to_lower
    - trim
    - slice
    - swap
    - contains
    - locate
    - starts_with
    - ends_with
    - index_of
    - repeat
    - includes
    - regex
    - tokenize
    - split
    - join
  **strings_and_collections**: - range
    - push
    - append
    - pop
    - keys
    - values
    - join
    - split
    - regex
    - to_upper
    - to_lower
    - trim
    - slice
    - swap
    - contains
    - locate
    - starts_with
    - ends_with
    - index_of
    - repeat
    - includes
    - reverse
    - sort
    - unique
    - flatten
  **system**: - open
    - open_file
    - spawn
    - exec
    - run
    - python
    - js
    - ffmpeg
    - gif
    - video
  **tokenization**: **GPT_5_compatibility_encoding**: o200k_base
    **default_model**: gpt-5.6-sol
    **library**: js-tiktoken
  **tokenization_and_costs**: - tokenize
    - count_tokens
    - estimate_tokens
    - estimate_cost
    - model_usage
  **tokens_and_cost**: - tokenize
    - count_tokens
    - estimate_tokens
    - estimate_cost
    - model_usage
  **type_checks**: - is_function
    - is_array
    - is_object
    - is_string
    - is_number
    - is_bool
    - is_null
    - name
    - arity
  **web**: - web_get
    - web_send
    - listen
    - api
    - open
    - open_file
    - live
**collections**: - range
  - push
  - append
  - pop
  - keys
  - values
  - join
  - split
  - map
  - filter
  - reduce
  - find
  - reverse
  - sort
  - unique
  - flatten
**conversion**: - num
  - float
  - bool
  - trunc
  - to_upper
  - to_lower
  - trim
**core**: - show
  - debug
  - input
  - len
  - type
  - str
  - num
  - float
  - bool
  - range
  - push
  - append
  - pop
  - keys
  - values
  - join
  - split
  - map
  - filter
  - reduce
  - find
  - sort
  - unique
  - flatten
**crypto**: - encrypt
  - decrypt
**cryptography**: - encrypt
  - decrypt
  - **algorithm**: aes-256-cbc
  - **key_derivation**: sha256_password_hash
**data_and_collections**: - len
  - type
  - str
  - num
  - float
  - bool
  - range
  - push
  - append
  - pop
  - keys
  - values
  - join
  - split
  - slice
  - reverse
  - sort
  - unique
  - flatten
  - map
  - filter
  - reduce
  - find
**errors**: - error_type
  - raise_error
**external_processes**: - exec
  - run
  - spawn
  - python
  - js
**file_system_security**: **behavior**: - Resolves paths against a base directory.
    - Restricts access to configured allowed paths in safe mode.
    - Includes script directory in permitted paths.
    - Rejects path traversal outside permitted directories.
  **function**: ensureSafePath
**files**: - read_file
  - write_file
  - append_file
  - write_image
  - list_dir
  - exists
  - get_ext
  - make_dir
  - rename
  - archive
  - trash
  - zip
**filesystem**: - read_file
  - write_file
  - append_file
  - write_image
  - list_dir
  - make_dir
  - rename
  - archive
  - trash
  - zip
  - exists
  - get_ext
**functional**: - lazy
  - force
  - timeout
  - retry
  - multi_req
  - map
  - filter
  - reduce
  - find
  - workflow
  - profile
  - profile_start
  - profile_end
  - profile_report
**general**: - show
  - debug
  - input
  - len
  - type
  - str
  - to_json
  - from_json
  - env
  - time
  - random
  - num
  - float
  - bool
**introspection**: - name
  - arity
  - is_function
  - is_array
  - is_object
  - is_string
  - is_number
  - is_bool
  - is_null
**json_and_crypto**: - to_json
  - from_json
  - encrypt
  - decrypt
**math_matrices**: - matrix_dot
  - matrix_transpose
  - matrix_add
  - matrix_sub
  - matrix_mul_elements
  - matrix_scale
  - matrix_sigmoid
  - matrix_dsigmoid
  - matrix_sum_rows
  - matrix_mse
**matrices**: - matrix_dot
  - matrix_transpose
  - matrix_add
  - matrix_sub
  - matrix_mul_elements
  - matrix_scale
  - matrix_sigmoid
  - matrix_dsigmoid
  - matrix_sum_rows
  - matrix_mse
**matrix**: - matrix_dot
  - matrix_transpose
  - matrix_add
  - matrix_sub
  - matrix_mul_elements
  - matrix_scale
  - matrix_sigmoid
  - matrix_dsigmoid
  - matrix_sum_rows
  - matrix_mse
**media**: - ffmpeg
  - gif
  - video
  - speech
  - from_speech
  - translate
**networking**: - web_get
  - web_send
  - listen
  - api
**process**: - exec
  - run
  - spawn
  - python
  - js
  - sesi
**process_and_scripting**: - exec
  - run
  - spawn
  - python
  - js
  - sesi
**profiling**: - profile
  - profile_start
  - profile_end
  - profile_report
**security**: **local_filesystem_override**: SESI_LOCAL_FS=true
  **protected_operations**: - exec
    - run
    - spawn
    - python
    - js
    - open
    - open_file
    - ffmpeg
    - gif
    - video
    - native_http_server
    - websocket_server
    - external_archive_access
  **safe_mode_default**: true
  **safe_mode_override**: SESI_SAFE_MODE=false
**source_module**: builtins.ts
**string_and_collection**: - split
  - join
  - slice
  - swap
  - contains
  - locate
  - starts_with
  - ends_with
  - index_of
  - repeat
  - includes
  - reverse
  - sort
  - unique
  - flatten
  - keys
  - values
  - push
  - pop
  - append
  - range
**string_and_regex**: - to_upper
  - to_lower
  - trim
  - swap
  - contains
  - locate
  - starts_with
  - ends_with
  - index_of
  - repeat
  - includes
  - regex
**strings**: - to_upper
  - to_lower
  - trim
  - slice
  - swap
  - contains
  - locate
  - starts_with
  - ends_with
  - index_of
  - repeat
  - includes
  - regex
**text**: - to_upper
  - to_lower
  - trim
  - slice
  - swap
  - contains
  - locate
  - regex
  - tokenize
**web**: - web_get
  - web_send
  - listen
  - api

### runtime_builtins

**ai_and_tokens**: - speech
  - from_speech
  - translate
  - count_tokens
  - estimate_tokens
  - estimate_cost
  - model_usage
  - workflow
  - memory_search
  - memory_trim
  - memory_config
  - set_alias
  - define_tool
  - list_tools
**collections**: - range
  - push
  - append
  - pop
  - keys
  - values
  - join
  - split
  - map
  - filter
  - reduce
  - find
  - reverse
  - sort
  - unique
  - flatten
**conversion_and_types**: - num
  - float
  - bool
  - is_array
  - is_object
  - is_string
  - is_number
  - is_bool
  - is_null
  - is_function
  - name
  - arity
**files_and_directories**: - read_file
  - write_file
  - append_file
  - write_image
  - open
  - open_file
  - list_dir
  - get_ext
  - exists
  - make_dir
  - rename
  - archive
  - trash
  - zip
**general**: - show
  - debug
  - input
  - len
  - type
  - str
  - to_json
  - from_json
  - env
  - time
  - random
**math**: - exp
  - matrix_dot
  - matrix_transpose
  - matrix_add
  - matrix_sub
  - matrix_mul_elements
  - matrix_scale
  - matrix_sigmoid
  - matrix_dsigmoid
  - matrix_sum_rows
  - matrix_mse
**processes_and_scripting**: - exec
  - run
  - spawn
  - python
  - js
  - sesi
  - ffmpeg
  - gif
  - video
**runtime_control**: - retry
  - lazy
  - force
  - timeout
  - profile
  - profile_start
  - profile_end
  - profile_report
  - error_type
  - raise_error
**strings**: - to_upper
  - to_lower
  - trim
  - trunc
  - slice
  - swap
  - contains
  - locate
  - starts_with
  - ends_with
  - index_of
  - repeat
  - regex
  - tokenize
**web_and_servers**: - web_get
  - web_send
  - listen
  - api
  - live

### modules

**ai_runtime**: **cache**: **algorithm**: sha256
    **cache_key_includes**: - model
      - prompt
      - temperature
      - max_tokens
      - top_k
      - top_p
      - images
      - system_prompt
      - thinking_level
      - search
      - tools
      - local_model_configuration
    **file**: .sesi_cache.json
  **exports**: - DEFAULT_LOCAL_MODEL
    - DEFAULT_LOCAL_MODEL_WARNING_TOKENS
    - AIRuntime
    - aiRuntime
  **key_methods**: - **name**: callModel
      **purpose**: Routes an AI request to local Transformers, OpenAI GPT, or Gemini; supports caching, streaming, tools, media, and generation controls.

    - **name**: countTokens
      **purpose**: Counts tokens through local tokenizer, OpenAI API, or Gemini API.
    - **name**: callVideo
      **purpose**: Generates videos using Gemini video or Omni-style interaction APIs.
    - **name**: synthesizeSpeech
      **purpose**: Produces WAV-compatible base64 audio through Gemini TTS.
    - **name**: transcribeSpeech
      **purpose**: Transcribes provided base64 audio via Gemini.
    - **name**: parseStructuredOutput
      **purpose**: Extracts and validates JSON-like structured output from model text.
    - **name**: embedText
      **purpose**: Generates cached Gemini embeddings.
    - **name**: searchMemory
      **purpose**: Uses cosine similarity over embeddings to retrieve memory chunks.
    - **name**: autoTrimMemory
      **purpose**: Automatically summarizes memory exceeding configured token limits.
    - **name**: trimMemory
      **purpose**: Compresses a memory entry using an AI summary model.
  **memory_summary**: **defaults**: **enabled**: true
      **max_tokens**: 900000
      **summary_model**: gemini-3.5-flash-lite
      **target_tokens_ratio**: 0.6
    **environment_variables**: **SESI_MEMORY_AUTO_SUMMARIZE**: Set to false to disable automatic summarization.
      **SESI_MEMORY_MAX_TOKENS**: Maximum memory token budget.
      **SESI_MEMORY_SUMMARY_MODEL**: Model used to summarize old history.
      **SESI_MEMORY_TARGET_TOKENS**: Desired compressed-memory token budget.
  **providers**: **gemini**: **api_key_environment_variable**: GEMINI_API_KEY
      **model_detection**: Models beginning with gemini- or models/gemini-
      **sdk_package**: @google/genai
      **supported_features**: - text_generation
        - streaming
        - function_tools
        - google_search
        - image_input
        - audio_input
        - image_generation
        - video_generation
        - text_to_speech
        - speech_to_text
        - embeddings
        - token_counting
    **local**: **default_model**: onnx-community/Qwen2.5-0.5B-Instruct
      **environment_variables**: **SESI_LOCAL_CACHE_DIR**: Custom local model-cache directory.
        **SESI_LOCAL_DEVICE**: Inference device; defaults to cpu.
        **SESI_LOCAL_DTYPE**: Model data type; defaults to q4.
        **SESI_LOCAL_MODEL**: Optional default Hugging Face model ID.
        **SESI_LOCAL_SYSTEM_PROMPT**: Default local-model system prompt.
        **SESI_LOCAL_WARN_TOKENS**: Input-token warning threshold.
      **package**: @huggingface/transformers
      **supported_features**: - text_generation
        - streaming
        - tool_calls
        - token_counting
      **unsupported_features**: - image_input
        - audio_input
        - web_search
    **openai**: **APIs**: - responses.create
        - responses.inputTokens.count
        - images.generate
      **api_key_environment_variable**: OPENAI_API_KEY
      **model_detection**: Models beginning with gpt-
      **sdk_package**: openai
      **supported_features**: - text_generation
        - streaming
        - tools
        - web_search
        - image_input
        - reasoning_effort
        - image_generation
**builtins**: **categories**: **filesystem**: - read_file
      - write_file
      - append_file
      - write_image
      - list_dir
      - exists
      - get_ext
      - make_dir
      - rename
      - archive
      - trash
      - zip
    **general**: - show
      - debug
      - input
      - len
      - type
      - str
      - num
      - float
      - bool
      - time
      - random
      - env
    **matrix**: - matrix_dot
      - matrix_transpose
      - matrix_add
      - matrix_sub
      - matrix_mul_elements
      - matrix_scale
      - matrix_sigmoid
      - matrix_dsigmoid
      - matrix_sum_rows
      - matrix_mse
    **media**: - speech
      - from_speech
      - translate
      - ffmpeg
      - gif
      - video
    **memory_and_tools**: - memory_search
      - memory_trim
      - memory_config
      - set_alias
      - define_tool
      - list_tools
      - error_type
      - raise_error
    **networking**: - web_get
      - web_send
      - listen
      - api
    **process_and_scripting**: - exec
      - run
      - spawn
      - sesi
      - python
      - js
    **runtime_control**: - retry
      - lazy
      - force
      - timeout
      - profile
      - profile_start
      - profile_end
      - profile_report
      - map
      - filter
      - reduce
      - find
      - multi_req
    **serialization_and_crypto**: - to_json
      - from_json
      - encrypt
      - decrypt
    **string_and_collection**: - range
      - push
      - append
      - pop
      - keys
      - values
      - join
      - split
      - regex
      - slice
      - swap
      - contains
      - locate
      - to_upper
      - to_lower
      - trim
      - starts_with
      - ends_with
      - index_of
      - repeat
      - includes
      - reverse
      - sort
      - unique
      - flatten
    **tokenization_and_costs**: - tokenize
      - count_tokens
      - estimate_tokens
      - estimate_cost
      - model_usage
    **workflow**: - workflow
      - live
  **exports**: - getBuiltins
    - ensureSafePath
    - isTruthy
    - stripPrototypes
    - isEqual
    - stringify
    - compareValues
  **security**: **disabled_in_safe_mode**: - open
      - open_file
      - spawn
      - exec
      - run
      - python
      - js
      - ffmpeg
      - gif
      - video
      - non_zip_archive_access
      - native_http_server
      - websocket_server
      - std_game_run
    **local_filesystem_override**: SESI_LOCAL_FS
    **path_restriction**: File access is restricted to allowed directories unless local filesystem access is explicitly enabled outside safe mode.

    **safe_mode_default**: true
    **safe_mode_override**: SESI_SAFE_MODE
**bytecode**: **exports**: - OpCode
    - makeChunk
    - addConstant
    - emitByte
    - emitBytes
    - emit16
    - emitJump
    - patchJump
    - emitLoop
    - read16
    - disassemble
  **module**: chunk
  **opcode_groups**: **ai**: - CALL_MODEL
      - CALL_IMAGE
      - CALL_VIDEO
    **collections**: - BUILD_ARRAY
      - BUILD_OBJECT
      - GET_INDEX
      - SET_INDEX
      - GET_PROPERTY
      - SET_PROPERTY
    **control_flow**: - JUMP
      - JUMP_IF_FALSE
      - LOOP
      - TRY_START
      - TRY_END
      - FINALLY_START
      - FINALLY_END
    **conversion**: - CONVERT
    **functions**: - CLOSURE
      - CALL
      - RETURN
      - RETURN_VOID
      - CALL_BUILTIN
    **modules_and_memory**: - IMPORT
      - ALLOW
      - INITIALIZE_MEMORY
    **operations**: - ADD
      - SUBTRACT
      - MULTIPLY
      - DIVIDE
      - MODULO
      - NEGATE
      - EQUAL
      - NOT_EQUAL
      - LESS
      - LESS_EQUAL
      - GREATER
      - GREATER_EQUAL
      - NOT
    **stack_and_constants**: - CONSTANT
      - NIL
      - true
      - false
      - POP
    **variables**: - DEFINE_GLOBAL
      - GET_GLOBAL
      - SET_GLOBAL
      - GET_LOCAL
      - SET_LOCAL
      - GET_UPVALUE
      - SET_UPVALUE
      - CLOSE_UPVALUE
**compiler**: **class**: Compiler
  **compilation_support**: **expressions**: - literals
      - identifiers
      - binary_operations
      - unary_operations
      - logical_operations
      - assignments
      - function_calls
      - properties
      - indexes
      - arrays
      - objects
      - prompts
      - model_calls
      - image_calls
      - video_calls
      - structured_output
      - tool_calls
      - conversion
      - conditional_expressions
      - await_expressions
    **optimizations**: - Known builtin calls compile to CALL_BUILTIN.
      - show(...) compiles to PRINT.
      - Local variables use stack-slot access.
      - Nested functions capture upvalues.
      - Loop break and continue jumps are back-patched.
    **statements**: - let
      - function
      - expression
      - block
      - if_else
      - while
      - for
      - return
      - break
      - continue
      - try_catch_finally
      - import
      - allow
      - memory
      - export
  **input**: Sesi AST
  **output**: Chunk bytecode
**dry_run_semantic_checks**: **diagnostics**: **undefined_symbol**: **code**: undefined-symbol
      **severity**: error
    **unused_symbol**: **code**: unused-symbol
      **severity**: warning
  **export**: runDryRunSemanticChecks
  **features**: - comment_stripping
    - lexical_tokenization
    - nested_scope_tracking
    - declaration_tracking
    - reference_tracking
    - builtin_symbol_exemptions
    - unused_binding_detection
    - make_scope_self_parameter_suppression
**game_module**: **asset_handling**: **local_assets**: Embedded as base64 data URLs.
    **remote_assets**: Allows http, https, and data URLs.
  **export**: createGameModule
  **exports**: **create**: **game_methods**: **add**: **purpose**: Adds a validated game entity.
        **build**: **purpose**: Writes a standalone HTML game file.
        **rule**: **purpose**: Adds collision, key, timer, or bounds behavior.
        **run**: **purpose**: Starts a local preview server and optionally opens a browser.
      **returns**: game_object
  **module_name**: std/game
  **preview**: **host**: 127.0.0.1
    **safe_mode_behavior**: disabled
  **purpose**: Provides a data-driven Canvas game system that creates self-contained HTML previews or game files.

  **supported_entity_shapes**: - rect
    - circle
    - sprite
    - text
  **supported_rule_actions**: - destroy
    - spawn
    - set
    - addScore
    - reverseVelocity
    - sound
  **supported_rule_events**: - collision
    - key
    - timer
    - bounds
**std_api**: **defaults**: **cors**: true
    **cors_origin**: *
    **docs_path**: /docs
    **openapi_path**: /openapi.json
  **description**: FastAPI-style HTTP API framework with Swagger UI and OpenAPI 3.1.
  **functions**: - API.create_app(config = null) -> app
    - app.get(path, schema, handler)
    - app.post(path, schema, handler)
    - app.put(path, schema, handler)
    - app.patch(path, schema, handler)
    - app.delete(path, schema, handler)
    - app.use(middleware)
    - app.openapi() -> object
    - app.routes() -> array
    - app.listen(port, options = null) -> server
  **import**: allow "std/api" in as API
**std_audio**: **functions**: - Audio.beep(frequency, duration)
    - Audio.play(note, duration, options = null)
    - Audio.synth(frequency_or_note, duration, type, options = null) -> base64_wav
    - Audio.save(path, frequency_or_note, duration, type, options = null)
    - Audio.load(path) -> audio_sample
    - Audio.kick(duration = 300, volume = 1.0) -> base64_wav
    - Audio.snare(duration = 200, volume = 1.0) -> base64_wav
    - Audio.hat(duration = 50, volume = 1.0) -> base64_wav
    - Audio.sequence(path, notes_array, type = null, options = null)
    - Audio.mix(path, tracks_array, type = null, options = null)
    - Audio.midi(path, tracks)
    - Audio.sf2(path, options = null) -> fn
  **import**: allow "std/audio" in as Audio
  **waveform_types**: - sine
    - square
    - saw
    - triangle
    - noise
    - kick
    - snare
    - hat
    - clap
**std_base64**: **functions**: - Base64.encode(value, mode = text)
    - Base64.decode(base64_text, mode = text)
  **import**: allow "std/base64" in as Base64
  **modes**: - text
    - bytes
**std_browser**: **functions**: - launch(options = null) -> browser
    - browser.newPage() -> page
    - browser.close()
    - page.goto(url)
    - page.content() -> string
    - page.screenshot(options = null) -> string
    - page.click(selector)
    - page.fill(selector, value)
    - page.type(selector, value)
    - page.press(selector, key)
    - page.inner_text(selector) -> string
    - page.attribute(selector, name) -> string
    - page.evaluate(script) -> any
    - page.title() -> string
    - page.close()
    - page.pdf(options = null) -> string
    - page.wait_for_selector(selector, options = null)
    - page.wait_for_timeout(ms)
  **import**: allow "std/browser" in with {launch}
**std_db**: **encryption**: Optional AES-256-CBC encryption is enabled by passing a database password.
  **functions**: - db_open(filename, password = null)
    - db.collection(name)
    - collection.insert(object)
    - collection.find(query_object = null)
    - collection.update(query_object, update_object)
    - collection.delete(query_object)
  **import**: allow "std/db" in with {db_open}
**std_draw**: **functions**: - Draw.clear()
    - Draw.circle(x, y, radius, fill, options = {})
    - Draw.rect(x, y, width, height, fill, options = {})
    - Draw.line(x1, y1, x2, y2, stroke, options = {})
    - Draw.text(x, y, content, size, fill, options = {})
    - Draw.ellipse(cx, cy, rx, ry, fill, options = {})
    - Draw.polygon(points, fill, options = {})
    - Draw.path(d, fill, options = {})
    - Draw.gradient(type, id, stops, options = {})
    - Draw.style(cssText)
    - Draw.raw(svgCode)
    - Draw.render(width, height) -> string
    - Draw.save_svg(path, width, height) -> bool
    - Draw.pixel(x, y, color)
    - Draw.pixel_grid(grid, palette, scale = 1, x = 0, y = 0)
    - Draw.save_png(path, width, height, background = "transparent") -> bool
  **import**: allow "std/draw" in as Draw
**std_game**: **bounds_modes**: - clamp
    - wrap
    - bounce
  **entity_shapes**: - rect
    - circle
    - sprite
    - text
  **functions**: - Game.create(config) -> game
    - game.add(entity)
    - game.rule(rule)
    - game.build(path)
    - game.run(options = null) -> handle
  **import**: allow "std/game" in as Game
  **rule_actions**: - destroy
    - spawn
    - set
    - addScore
    - reverseVelocity
    - sound
  **rule_events**: - collision
    - key
    - timer
    - bounds
**std_terminal**: **formatting_functions**: - Terminal.color(text, color)
    - Terminal.style(text, styles)
    - Terminal.background(text, color)
    - Terminal.rgbBackground(text, red, green, blue)
    - Terminal.rgb(text, red, green, blue)
  **import**: allow "std/terminal" in as Terminal
  **terminal_functions**: - Terminal.clear(mode = screen)
    - Terminal.eraseLine(mode = all)
    - Terminal.eraseScreen(mode = all)
    - Terminal.cursor(x, y)
    - Terminal.move(x, y)
    - Terminal.up(amount = 1)
    - Terminal.down(amount = 1)
    - Terminal.left(amount = 1)
    - Terminal.right(amount = 1)
    - Terminal.saveCursor()
    - Terminal.restoreCursor()
    - Terminal.hideCursor()
    - Terminal.showCursor()
    - Terminal.write(text)
    - Terminal.line(text = null)
    - Terminal.title(text)
    - Terminal.bell()
    - Terminal.size() -> object
**std_theory**: **chord_types**: - M
    - m
    - dim
    - aug
    - 7
    - M7
    - m7
    - sus2
    - sus4
  **functions**: - Music.chord(root, type) -> array
    - Music.scale(root, type) -> array
    - Music.transpose(notes, semitones) -> array
    - Music.duration(minutes, seconds) -> number
    - Music.bar(bars, bpm, beatsPerBar = 4) -> number
  **import**: allow "std/theory" in as Music
  **scale_types**: - major
    - minor
    - dorian
    - phrygian
    - lydian
    - mixolydian
    - locrian
**std_time**: **functions**: - Time.now()
    - Time.sleep(ms)
    - Time.format(timestamp, options = null)
  **import**: allow "std/time" in as Time

### standard_modules

**std/api**: **capabilities**: - route_registration
    - middleware
    - query_validation
    - JSON_body_validation
    - CORS
    - OpenAPI_3_1
    - Swagger_UI
    - routes
    - request_validation
    - OpenAPI_3_1_document_generation
    - validation
    - OpenAPI_generation
  **features**: - HTTP_routing
    - middleware
    - request_validation
    - CORS
    - OpenAPI_3_1_generation
    - Swagger_UI
    - query_validation
    - JSON_body_validation
    - Swagger_UI_docs
    - route_registration
    - cors
    - openapi_3_1
    - swagger_ui
  **purpose**: HTTP API framework with OpenAPI and Swagger UI support
  **requires_safe_mode_disabled**: true
  **restricted_in_safe_mode**: true
  **route_methods**: - get
    - post
    - put
    - delete
    - patch
    - options
    - head
**std/audio**: **capabilities**: - wav_synthesis
    - note_playback
    - waveform_generation
    - MIDI_export
    - SoundFont_rendering
    - track_mixing
  **exports**: - beep
    - play
    - synth
    - save
    - load
    - kick
    - snare
    - hat
    - sf2
    - sequence
    - mix
    - midi
    - render
    - comp
  **features**: - wav_synthesis
    - note_playback
    - audio_sample_loading
    - sequencing
    - mixing
    - MIDI_generation
    - SoundFont_rendering
    - WAV_synthesis
    - audio_mixing
    - waveform_generation
    - music_theory_integration
    - synthesis
    - wav_generation
    - midi_generation
    - soundfont_rendering
  **purpose**: WAV_synthesis_and_MIDI_generation
**std/base64**: **exports**: - encode
    - decode
  **modes**: - text
    - bytes
**std/browser**: **capabilities**: - launch
    - newPage
    - goto
    - content
    - screenshot
    - click
    - fill
    - type
    - press
    - inner_text
    - attribute
    - evaluate
    - pdf
    - navigation
    - screenshots
    - PDF_generation
    - DOM_interaction
    - page_evaluation
    - Chromium_launch
    - PDF_export
  **dependency**: playwright
  **features**: - launch_browser
    - navigation
    - page_content
    - screenshots
    - PDF_generation
    - DOM_interaction
    - page_evaluation
    - launch
    - new_page
    - JavaScript_evaluation
    - chromium_launch
    - page_navigation
    - pdf_generation
    - dom_interaction
  **implementation**: Playwright
  **purpose**: Playwright_browser_automation
  **requires_safe_mode_disabled**: true
  **restricted_in_safe_mode**: true
**std/db**: **capabilities**: - collection
    - insert
    - find
    - update
    - delete
    - optional_AES_256_CBC_encryption
  **collection_methods**: - insert
    - find
    - update
    - delete
  **collection_operations**: - insert
    - find
    - update
    - delete
  **description**: JSON-file document database with optional AES-256-CBC encryption.
  **exports**: - db_open
  **features**: - JSON_document_database
    - collections
    - insert
    - find
    - update
    - delete
    - optional_AES_256_CBC_encryption
  **operations**: - db_open
    - collection
    - insert
    - find
    - update
    - delete
  **optional_encryption**: aes-256-cbc
  **purpose**: JSON-file document database
  **storage**: JSON_file_database
**std/draw**: **capabilities**: - vector_shapes
    - gradients
    - raw_SVG
    - pixel_art
  **exports**: - clear
    - circle
    - rect
    - pixel
    - pixel_grid
    - line
    - text
    - ellipse
    - polygon
    - path
    - gradient
    - style
    - raw
    - render
    - save_svg
    - save_png
  **features**: - SVG_generation
    - PNG_pixel_rendering
    - gradients
    - raw_svg
    - primitive_shapes
    - styles
    - svg_drawing
    - pixel_art
    - png_output
  **output_formats**: - SVG
    - PNG
  **purpose**: SVG_and_pixel_PNG_rendering
**std/game**: **description**: Data-driven Canvas game construction and browser preview.
  **entity_shapes**: - rect
    - circle
    - sprite
    - text
  **exports**: - create
  **features**: - entities
    - sprite_assets
    - rules
    - collisions
    - keyboard_input
    - pointer_input
    - scores
    - timers
    - browser_preview
    - static_html_build
    - sprites
    - keyboard_controls
    - collision_rules
    - scoring
    - HTML_export
    - canvas_game_generation
    - entity_management
    - audio_effects
    - html_build
    - timer_rules
    - score_tracking
    - asset_embedding
    - local_preview_server
    - HTML_build_output
  **purpose**: data_driven_canvas_game_creation
  **rule_actions**: - destroy
    - spawn
    - set
    - addScore
    - reverseVelocity
    - sound
  **rule_events**: - collision
    - key
    - timer
    - bounds
  **type**: browser_canvas_game_builder
**std/math**: **exports**: - PI
    - E
    - sin
    - cos
    - tan
    - sqrt
    - floor
    - ceil
    - abs
    - pow
    - log
    - exp
**std/terminal**: **capabilities**: - colors
    - styles
    - cursor_control
    - screen_erasure
    - terminal_title
    - terminal_size
    - ANSI_styling
    - terminal_dimensions
    - screen_erasing
  **features**: - ANSI_colors
    - text_styles
    - cursor_control
    - screen_erasure
    - terminal_dimensions
    - terminal_title
    - ANSI_styling
    - screen_control
    - terminal_size
    - ANSI_styles
    - terminal_screen_control
    - ansi_styles
    - terminal_output
  **purpose**: ANSI_terminal_control
**std/theory**: **exports**: - chord
    - scale
    - transpose
    - duration
    - bar
  **purpose**: music_theory_helpers
**std/time**: **exports**: - now
    - sleep
    - format

### game_module

**API**: **game.add**: **purpose**: Add a game entity
    **supported_shapes**: - rect
      - circle
      - sprite
      - text
  **game.build**: **output**: HTML file
  **game.rule**: **supported_actions**: - destroy
      - spawn
      - set
      - addScore
      - reverseVelocity
      - sound
    **supported_events**: - collision
      - key
      - timer
      - bounds
  **game.run**: **disabled_in_safe_mode**: true
    **output**: Local preview server object
    **preview_methods**: - url
      - stop
**browser_runtime_features**: - canvas_rendering
  - keyboard_input
  - pointer_input
  - entity_physics
  - gravity
  - collision_detection
  - entity_bounds_modes
  - sprite_assets
  - score_hud
  - sound_effects
  - timer_rules
**capabilities**: - create canvas games from data definitions
  - rectangle entities
  - circle entities
  - sprite entities
  - text entities
  - entity motion and gravity
  - keyboard controls
  - pointer input
  - collision detection
  - bounds handling
  - score tracking
  - timer rules
  - sound effects
  - HTML export
  - local preview server
**exported_function**: create
**game_configuration**: **optional**: - title
    - background
    - input
    - scores
  **required**: - width
    - height
**implementation**: Native Canvas HTML runtime
**methods**: - Game.create
  - game.add
  - game.rule
  - game.build
  - game.run
**module**: std/game
**rule_actions**: - destroy
  - spawn
  - set
  - addScore
  - reverseVelocity
  - sound
**rule_events**: - collision
  - key
  - timer
  - bounds
**type**: native_data_driven_canvas_module

### collections

**arrays**: - **description**: Reverses an array in place.
    **mutates_input**: true
    **name**: reverse
    **pipe_supported**: true
    **signature**: reverse(array) -> array
  - **description**: Sorts an array in place.
    **mutates_input**: true
    **name**: sort
    **pipe_supported**: true
    **signature**: sort(array, compareFn = null) -> array
  - **description**: Returns a new array with duplicates removed.
    **name**: unique
    **pipe_supported**: true
    **signature**: unique(array) -> array
  - **description**: Flattens nested arrays by one level.
    **name**: flatten
    **pipe_supported**: true
    **signature**: flatten(array) -> array
  - **callback_arguments**: - item
      - index
      - array
    **name**: map
    **pipe_supported**: true
    **signature**: map(array, callback) -> array
  - **callback_arguments**: - item
      - index
      - array
    **name**: filter
    **pipe_supported**: true
    **signature**: filter(array, callback) -> array
  - **callback_arguments**: - accumulator
      - currentValue
      - index
      - array
    **name**: reduce
    **pipe_supported**: true
    **signature**: reduce(array, callback, initialValue = null) -> any
  - **callback_arguments**: - item
      - index
      - array
    **name**: find
    **pipe_supported**: true
    **signature**: find(array, callback) -> any|null
**core**: - **description**: Returns the length of a string, array, or object.
    **name**: len
    **pipe_supported**: true
    **signature**: len(collection) -> number|null
  - **description**: Alias for len().
    **name**: length
    **pipe_supported**: true
    **signature**: length(collection) -> number|null
  - **description**: Creates integers from 0 up to, but excluding, n.
    **name**: range
    **pipe_supported**: true
    **signature**: range(n) -> array<number>
  - **description**: Adds an element to the end of an array in place.
    **mutates_input**: true
    **name**: push
    **pipe_supported**: true
    **signature**: push(array, value) -> array
  - **description**: Appends to an array in place or concatenates strings.
    **mutates_arrays**: true
    **name**: append
    **pipe_supported**: true
    **signature**: append(collection, value) -> array|string|null
  - **description**: Removes and returns the final array element.
    **mutates_input**: true
    **name**: pop
    **pipe_supported**: true
    **signature**: pop(array) -> any|null
  - **name**: join
    **pipe_supported**: true
    **signature**: join(array, separator) -> string
  - **name**: split
    **pipe_supported**: true
    **signature**: split(string, separator) -> array<string>
  - **name**: keys
    **pipe_supported**: true
    **signature**: keys(object) -> array<string>|null
  - **name**: values
    **pipe_supported**: true
    **signature**: values(object) -> array<any>|null
**strings**: - **description**: Runs a JavaScript-compatible regular expression.
    **modes**: - match
      - test
      - replace
      - split
    **name**: regex
    **options**: **flags**: JavaScript regex flags, such as i, m, s, and g.
      **limit**: Maximum matches or split parts; defaults to 10000.
      **replacement**: Required when mode is replace.
    **pipe_supported**: true
    **signature**: regex(pattern, text, options = null) -> array|bool|string
  - **description**: Tokenizes text with a tiktoken-style encoding or simple whitespace mode.
    **name**: tokenize
    **options**: **encoding**: Optional explicit tokenizer encoding.
      **mode**: Use "simple" for whitespace tokenization.
      **model**: Tokenizer model; defaults to "gpt-5.6-sol".
    **pipe_supported**: true
    **signature**: tokenize(string, options = null) -> array<number>|array<string>|null
  - **description**: Counts request tokens using a provider-native endpoint where applicable.
    **name**: count_tokens
    **pipe_supported**: true
    **providers**: **gemini**: Uses Gemini models.countTokens.
      **gpt**: Uses OpenAI responses/input_tokens.
      **local**: Uses cached local tokenizer.
    **signature**: count_tokens(string, options = null) -> number|null
  - **description**: Estimates token count locally without a provider request.
    **name**: estimate_tokens
    **pipe_supported**: true
    **signature**: estimate_tokens(string, options = null) -> number|null
  - **name**: to_upper
    **pipe_supported**: true
    **signature**: to_upper(string) -> string|null
  - **name**: to_lower
    **pipe_supported**: true
    **signature**: to_lower(string) -> string|null
  - **name**: trim
    **pipe_supported**: true
    **signature**: trim(string) -> string|null
  - **description**: Returns a sliced string or array without changing the original.
    **name**: slice
    **pipe_supported**: true
    **signature**: slice(collection, start, end = null) -> string|array|null
  - **description**: Replaces every occurrence of target in a string.
    **name**: swap
    **pipe_supported**: true
    **signature**: swap(string, target, replacement) -> string|null
  - **name**: contains
    **pipe_supported**: true
    **signature**: contains(string, sub) -> bool|null
  - **description**: Returns the first matching index or -1 when not found.
    **name**: locate
    **pipe_supported**: true
    **signature**: locate(string, sub) -> number|null
  - **name**: starts_with
    **pipe_supported**: true
    **signature**: starts_with(string, prefix) -> bool
  - **name**: ends_with
    **pipe_supported**: true
    **signature**: ends_with(string, suffix) -> bool
  - **description**: Returns first matching index or -1.
    **name**: index_of
    **pipe_supported**: true
    **signature**: index_of(collection, value) -> number
  - **name**: includes
    **pipe_supported**: true
    **signature**: includes(collection, value) -> bool
  - **name**: repeat
    **pipe_supported**: true
    **signature**: repeat(string, count) -> string

### math

**builtins**: - **description**: Returns Euler's number raised to x.
    **name**: exp
    **pipe_supported**: true
    **signature**: exp(x) -> number
  - **description**: Truncates numeric fractional parts or string content.
    **name**: trunc
    **pipe_supported**: true
    **signature**: trunc(value, length = 0) -> number|string|null
**std_math**: **constants**: - PI
    - E
  **functions**: - sin
    - cos
    - tan
    - sqrt
    - floor
    - ceil
    - abs
    - pow
    - log
    - exp
  **import**: allow "std/math" in as Math

### matrix

**functions**: - **name**: matrix_dot
    **signature**: matrix_dot(a, b) -> array
  - **name**: matrix_transpose
    **signature**: matrix_transpose(matrix) -> array
  - **name**: matrix_add
    **notes**: A one-row b matrix broadcasts across rows of a.
    **signature**: matrix_add(a, b) -> array
  - **name**: matrix_sub
    **signature**: matrix_sub(a, b) -> array
  - **name**: matrix_mul_elements
    **signature**: matrix_mul_elements(a, b) -> array
  - **name**: matrix_scale
    **signature**: matrix_scale(matrix, scalar) -> array
  - **name**: matrix_sigmoid
    **signature**: matrix_sigmoid(matrix) -> array
  - **name**: matrix_dsigmoid
    **signature**: matrix_dsigmoid(matrix) -> array
  - **name**: matrix_sum_rows
    **signature**: matrix_sum_rows(matrix) -> array
  - **name**: matrix_mse
    **signature**: matrix_mse(a, b) -> number
**validation**: Matrices must be non-empty rectangular arrays containing finite numbers.

### network

- **name**: web_get
  **pipe_supported**: true
  **signature**: web_get(url, headers = {}) -> string
- **name**: web_send
  **pipe_supported**: true
  **signature**: web_send(url, body, headers = {}) -> string
- **description**: Starts a native HTTP server.
  **handler_request_fields**: - method
    - path
    - headers
    - body
    - query
  **handler_response**: **object_fields**: - status
      - headers
      - body
    **string**: HTTP 200 text/html response.
  **name**: listen
  **pipe_supported**: true
  **returns**: Server control object with close().
  **signature**: listen(port, handler) -> object
- **client_methods**: - send
    - close
  **description**: Starts a native WebSocket server.
  **handler_arguments**: - client
    - message
  **name**: api
  **pipe_supported**: true
  **returns**: Server control object with close().
  **signature**: api(port, handler) -> object

### io

- **description**: Prints values to standard output, separated by spaces.
  **name**: show
  **pipe_supported**: true
  **returns**: null
  **signature**: show(...args) -> null
- **description**: Displays an optional terminal prompt and waits for user input.
  **name**: input
  **parameters**: **prompt**: Optional prompt text.
  **pipe_supported**: true
  **returns**: string
  **signature**: input(prompt = null) -> string

### filesystem

- **modes**: **base64**: Reads raw bytes as Base64.
    **text**: Reads UTF-8 text.
  **name**: read_file
  **pipe_supported**: true
  **signature**: read_file(path, mode = "text") -> string|null
- **encodings**: **base64**: Decodes Base64 content before writing bytes.
    **null**: Writes UTF-8 text.
  **name**: write_file
  **pipe_supported**: true
  **signature**: write_file(path, content, encoding = null) -> bool
- **name**: append_file
  **pipe_supported**: true
  **signature**: append_file(path, content) -> bool
- **name**: write_image
  **pipe_supported**: true
  **signature**: write_image(path, base64_content) -> bool
- **description**: Opens a URL or local file through the OS default or selected app.
  **name**: open
  **options**: **browser**: Preferred browser application.
    **editor**: Preferred text editor.
    **image_viewer**: Alias for viewer.
    **mode**: auto, browser, editor, viewer, or image_viewer.
    **viewer**: Preferred image viewer.
  **pipe_supported**: true
  **signature**: open(target, options = null) -> bool
- **name**: open_file
  **pipe_supported**: true
  **signature**: open_file(path, options = null) -> bool
- **name**: list_dir
  **pipe_supported**: true
  **signature**: list_dir(path) -> array<string>
- **name**: make_dir
  **pipe_supported**: true
  **signature**: make_dir(path) -> bool
- **name**: rename
  **pipe_supported**: true
  **signature**: rename(oldPath, newPath) -> bool
- **default_destination**: .archive/<basename>
  **description**: Copies a file or directory recursively.
  **name**: archive
  **pipe_supported**: true
  **signature**: archive(sourcePath, destPath = null) -> bool
- **description**: Returns a lowercased extension without the leading dot; preserves compound archive extensions.
  **name**: get_ext
  **pipe_supported**: true
  **signature**: get_ext(path) -> string
- **name**: exists
  **pipe_supported**: true
  **signature**: exists(path) -> bool
- **name**: zip
  **operations**: - create
    - list
    - extract
  **signature**: zip(source, destination = null, operation = null) -> bool|array
  **supported_extensions**: - zip
    - jar
    - apk
    - docx
    - xlsx
    - pptx
    - epub
    - 7z
    - rar
    - tar
    - tar.gz
    - tgz
    - tar.bz2
    - tbz2
    - tar.xz
    - txz
- **description**: Moves an item to .trash by default, or permanently deletes it with autoRemove=true.
  **name**: trash
  **pipe_supported**: true
  **signature**: trash(path, autoRemove = false) -> bool

### system

- **description**: Runs a Sesi script as a concurrent background process and returns its PID.
  **name**: spawn
  **pipe_supported**: true
  **signature**: spawn(path) -> number
- **description**: Creates a hot-reloading wrapper around an exported Sesi function.
  **name**: live
  **pipe_supported**: true
  **signature**: live(filePath, exportName = "handle") -> fn
- **description**: Synchronously executes a shell command.
  **name**: exec
  **pipe_supported**: true
  **signature**: exec(command) -> string
- **description**: Exact alias of exec().
  **name**: run
  **pipe_supported**: true
  **signature**: run(command) -> string
- **description**: Parses, compiles, and runs another Sesi file synchronously.
  **name**: sesi
  **pipe_supported**: true
  **signature**: sesi(filePath, local = false, checkOnly = false) -> string
- **description**: Runs Python source with the host Python runtime.
  **name**: python
  **pipe_supported**: true
  **requirements**: Unavailable in Sesi safe mode.
  **signature**: python(code, args = null) -> string
- **description**: Runs JavaScript source using the Sesi Node.js runtime.
  **name**: js
  **pipe_supported**: true
  **requirements**: Unavailable in Sesi safe mode.
  **signature**: js(code, args = null) -> string
- **description**: Builds a complete HTML document.
  **name**: html
  **options**: **head**: Raw markup inserted in head.
    **lang**: Defaults to "en".
    **title**: Defaults to "Sesi".
  **pipe_supported**: true
  **signature**: html(body, options = null) -> string
- **description**: Retrieves one environment variable or all environment variables.
  **name**: env
  **pipe_supported**: true
  **signature**: env(key = null, defaultValue = null) -> string|object
- **description**: Returns the current Unix timestamp in milliseconds.
  **name**: time
  **signature**: time() -> number
- **description**: Formats a Unix timestamp as readable text.
  **name**: format
  **pipe_supported**: true
  **signature**: format(timestamp, options = null) -> string
- **description**: Runs function closures, built-ins, or async functions concurrently.
  **name**: multi_req
  **pipe_supported**: true
  **signature**: multi_req(fns) -> array<any>
- **description**: Runs a multi-step model workflow using previous step outputs as context.
  **name**: workflow
  **pipe_supported**: false
  **result_fields**: - input
    - steps
    - final
  **signature**: workflow(steps, input = "") -> object
  **step_fields**: **optional**: - model
      - temperature
      - max_tokens
      - top_k
      - top_p
      - thinkingLevel
      - cache
      - search
    **required**: - prompt
- **description**: Registers a local alias resolved by model(), image(), and workflow().
  **name**: set_alias
  **pipe_supported**: true
  **signature**: set_alias(alias, model) -> bool
- **description**: Registers a custom Sesi function as an AI-accessible tool.
  **name**: define_tool
  **signature**: define_tool(name, fn, description = "") -> bool
- **description**: Invokes a registered custom tool.
  **name**: tool_call
  **signature**: tool_call(name)(...args) -> any
- **name**: list_tools
  **signature**: list_tools() -> array<string>
- **name**: error_type
  **pipe_supported**: true
  **returns_fields**: - type
    - message
    - data
  **signature**: error_type(type, message, data = null) -> object
- **description**: Throws a typed error.
  **name**: raise_error
  **pipe_supported**: true
  **signature**: raise_error(type_or_error, message = "", data = null) -> never
- **name**: retry
  **options**: **backoff_factor**: 2
    **initial_delay**: 1000
    **max_retries**: 3
  **pipe_supported**: true
  **signature**: retry(action, options = null) -> any
- **description**: Creates a memoized delayed computation.
  **name**: lazy
  **signature**: lazy(action, ...args) -> lazy
- **description**: Resolves lazy values or promises; returns ordinary values unchanged.
  **name**: force
  **signature**: force(value) -> any
- **description**: Runs an action with a deadline; returns fallback or throws TimeoutError.
  **name**: timeout
  **signature**: timeout(action, ms, fallback = unset) -> any
- **name**: profile
  **signature**: profile(name, action) -> any
- **name**: profile_start
  **signature**: profile_start(name) -> string
- **name**: profile_end
  **signature**: profile_end(name) -> object
- **name**: profile_report
  **signature**: profile_report(format = "object") -> array|string
- **description**: Returns a random float in the range [0, 1).
  **name**: random
  **signature**: random() -> number

### conversion

**supported_categories**: **document**: **fallback**: Gemini_document_conversion
    **local_conversions**: - markdown_to_html
      - html_to_markdown
      - html_to_text
      - svg_to_html
      - html_to_svg
      - svg_to_text
      - csv_to_json
      - tsv_to_json
      - json_to_csv
      - json_to_tsv
      - json_to_yaml
      - yaml_to_json
  **media**: **formats**: - images
      - SVG
      - audio
      - video
    **tools**: - sharp
      - Playwright
      - ImageMagick
      - ffmpeg

### conversion_media

- **config**: **file_type**: Optional input extension; inferred for local file paths.
    **output_type**: Required target extension.
  **name**: convert
  **native_document_conversions**: - md_to_html
    - html_to_md
    - html_to_txt
    - csv_to_json
    - tsv_to_json
    - json_to_csv
    - json_to_tsv
    - json_to_yaml
    - yaml_to_json
    - svg_to_html
    - html_to_svg
    - svg_to_txt
  **signature**: convert(type) { config } { file } -> string
  **svg_media_conversions**: - svg_to_png
    - svg_to_jpg
    - svg_to_jpeg
    - png_to_svg
    - jpg_to_svg
    - jpeg_to_svg
    - gif_to_svg
    - webp_to_svg
    - bmp_to_svg
    - tiff_to_svg
    - avif_to_svg
  **types**: **audio**: Audio.
    **doc**: Documents and text.
    **media**: Images and video.
- **name**: gif
  **options**: **fps**: 12
    **loop**: 0 means loop forever.
    **overwrite**: true
    **timeout**: Milliseconds.
    **width**: Optional output width.
  **pipe_supported**: true
  **requirements**: Requires ffmpeg and is unavailable in safe mode.
  **signature**: gif(input, output, options = null) -> string
- **ai_options**: - images
    - image
    - ratio
    - aspectRatio
    - duration
    - resolution
    - negative_prompt
    - audio
    - task
  **forms**: **ai_generation**: Returns base64 MP4 data.
    **local_ffmpeg**: Creates or transcodes a local video and returns output path.
  **local_options**: - fps
    - width
    - height
    - codec
    - crf
    - pixel_format
    - preset
    - audio
    - mute
    - overwrite
    - timeout
  **name**: video
  **pipe_supported**: true
  **signature**: video(input, output, options = null) -> string
- **description**: Runs FFmpeg using a structured argument array; shell command strings are rejected.
  **name**: ffmpeg
  **pipe_supported**: true
  **requirements**: Requires ffmpeg and is unavailable in safe mode.
  **result_fields**: - ok
    - code
    - signal
    - stdout
    - stderr
    - args
  **signature**: ffmpeg(args, options = null) -> object

### media

**audio**: **capabilities**: - Gemini_TTS
    - Gemini_transcription
    - local_whisper_transcription
    - local_system_speech
**conversion**: **document**: **fallback**: Gemini
    **local**: - markdown_to_html
      - html_to_markdown
      - html_to_text
      - SVG_HTML_conversion
      - CSV_JSON_conversion
      - TSV_JSON_conversion
      - JSON_YAML_conversion
  **raster_and_media**: **tools**: - sharp
      - playwright
      - ImageMagick
      - FFmpeg
      - pandoc
**image_generation**: **providers**: - Gemini
    - OpenAI
**video_generation**: **modes**: - Veo_generateVideos
    - Omni_interactions_create
  **output**: base64_video_data
  **provider**: Gemini

### speech_translation

- **description**: Speaks text through the system voice engine.
  **name**: speech
  **parameters**: **gemini_model**: Optional Gemini TTS model; returns base64 audio instead of playback.
    **text**: Text to speak.
    **voice**: Optional installed system voice.
  **pipe_supported**: true
  **returns**: true after playback, or base64 audio when using a Gemini TTS model.
  **signature**: speech(text, voice = null, gemini_model = null) -> bool|string
- **description**: Transcribes an audio file using nodejs-whisper or Gemini.
  **name**: from_speech
  **parameters**: **audio_path**: Path to the audio file.
    **gemini_model**: Optional Gemini transcription model.
    **language**: Optional language code, such as en or fr.
  **pipe_supported**: true
  **requirements**: **whisper**: nodejs-whisper and a downloaded Whisper model are required for local transcription.
  **returns**: Transcript text.
  **signature**: from_speech(audio_path, language = null, gemini_model = null) -> string
- **description**: Translates text using the translate package or an optional Gemini model.
  **name**: translate
  **parameters**: **from_language**: Source ISO code or English language name.
    **gemini_model**: Optional Gemini model.
    **text**: Source text.
    **to_language**: Target ISO code or English language name.
  **pipe_supported**: true
  **returns**: Translated text.
  **signature**: translate(text, to_language, from_language = "en", gemini_model = null) -> string

---

## Compiler & VM

### bytecode

**chunk**: **fields**: **code**: Flat opcode and operand byte array
    **constants**: Constant pool
    **lines**: Source line table
**compiler**: **builtin_optimization**: Known built-in calls compile to CALL_BUILTIN rather than resolving a function object dynamically.

  **class**: Compiler
  **output**: Chunk
  **supports**: - global_variables
    - local_variables
    - lexical_scopes
    - closures
    - upvalues
    - default_function_parameters
    - if_else
    - while_loops
    - for_range_loops
    - for_iterable_loops
    - break
    - continue
    - try_catch_finally
    - imports
    - memory_declarations
    - model_calls
    - image_calls
    - video_calls
    - structured_output
    - tool_calls
    - conversion_expressions
**core_structures**: **Chunk**: **fields**: - code
      - constants
      - lines
  **FunctionProto**: **fields**: - name
      - arity
      - params
      - chunk
      - isAsync
      - upvalues
**key_opcodes**: **flow_control**: - JUMP
    - JUMP_IF_FALSE
    - LOOP
    - TRY_START
    - TRY_END
    - FINALLY_START
    - FINALLY_END
  **operations**: - ADD
    - SUBTRACT
    - MULTIPLY
    - DIVIDE
    - MODULO
    - NEGATE
    - EQUAL
    - NOT_EQUAL
    - LESS
    - LESS_EQUAL
    - GREATER
    - GREATER_EQUAL
    - NOT
  **runtime**: - CALL
    - CALL_BUILTIN
    - CALL_MODEL
    - CALL_IMAGE
    - CALL_VIDEO
    - CONVERT
    - PRINT
    - IMPORT
    - ALLOW
    - INITIALIZE_MEMORY
  **stack**: - CONSTANT
    - NIL
    - true
    - false
    - POP
  **variables**: - DEFINE_GLOBAL
    - GET_GLOBAL
    - SET_GLOBAL
    - GET_LOCAL
    - SET_LOCAL
    - GET_UPVALUE
    - SET_UPVALUE
    - CLOSE_UPVALUE
**module**: chunk
**opcode_groups**: **AI**: - CALL_MODEL
    - CALL_IMAGE
    - CALL_VIDEO
  **ai**: - CALL_MODEL
    - CALL_IMAGE
    - CALL_VIDEO
  **arithmetic**: - ADD
    - SUBTRACT
    - MULTIPLY
    - DIVIDE
    - MODULO
    - NEGATE
  **collections**: - BUILD_ARRAY
    - BUILD_OBJECT
    - GET_INDEX
    - SET_INDEX
    - GET_PROPERTY
    - SET_PROPERTY
  **comparison**: - EQUAL
    - NOT_EQUAL
    - LESS
    - LESS_EQUAL
    - GREATER
    - GREATER_EQUAL
    - NOT
  **control_flow**: - JUMP
    - JUMP_IF_FALSE
    - LOOP
    - TRY_START
    - TRY_END
    - FINALLY_START
    - FINALLY_END
  **conversion**: - CONVERT
  **functions**: - CLOSURE
    - CALL
    - CALL_BUILTIN
    - RETURN
    - RETURN_VOID
  **memory**: - INITIALIZE_MEMORY
  **modules**: - IMPORT
    - ALLOW
  **output**: - PRINT
  **stack_and_constants**: - CONSTANT
    - NIL
    - TRUE
    - FALSE
    - POP
    - true
    - false
  **variables**: - DEFINE_GLOBAL
    - GET_GLOBAL
    - SET_GLOBAL
    - GET_LOCAL
    - SET_LOCAL
    - GET_UPVALUE
    - SET_UPVALUE
    - CLOSE_UPVALUE
**source_modules**: - chunk.ts
  - compiler.ts
**virtual_machine_model**: stack_based

### compiler

**architecture**: **compiler**: Compiler
  **execution_engines**: - bytecode_vm
    - tree_walking_interpreter
  **lexer**: Lexer
  **parser**: Parser
  **source_language**: Sesi
**built_in_call_opcode**: CALL_BUILTIN
**bytecode**: **opcode_categories**: - constants_and_stack
    - global_variables
    - local_variables
    - arithmetic
    - comparison
    - logical_operations
    - control_flow
    - collections
    - functions_and_closures
    - builtins
    - AI_calls
    - output
    - exceptions
    - imports
    - memory
    - upvalues
    - conversions
  **structure**: - code
    - constants
    - lines
  **supports**: - closures
    - upvalues
    - local_slot_variables
    - default_parameters
    - loops
    - break
    - continue
    - try_catch_finally
    - imports
    - model_calls
    - image_calls
    - video_calls
    - conversion_calls
    - bytecode_disassembly
**class**: Compiler
**optimizations**: - slot_based_local_variables
  - closure_upvalue_capture
  - builtin_fast_path
  - short_circuit_logical_operators
  - bytecode_jump_patching
**source**: Sesi_AST
**supported_expressions**: - literals
  - identifiers
  - binary_operations
  - unary_operations
  - logical_operations
  - assignments
  - function_calls
  - member_access
  - index_access
  - arrays
  - objects
  - prompts
  - model_calls
  - image_calls
  - video_calls
  - structured_output
  - tool_calls
  - conversion
  - conditional_expressions
  - await_expressions
**supported_statements**: - let
  - function
  - expression
  - block
  - if_else
  - while
  - for
  - return
  - break
  - continue
  - try_catch_finally
  - import
  - allow
  - memory
  - export
**target**: bytecode_chunk

### compiler_and_vm

**bytecode**: **core_types**: - Chunk
    - FunctionProto
    - OpCode
  **features**: - constant pool
    - source line table
    - bytecode disassembly
    - closures and upvalues
    - local stack slots
    - globals
    - arrays and objects
    - property and index access
    - function calls
    - built-in fast path
    - AI call opcodes
    - loops
    - conditional branches
    - try/catch/finally
    - imports and module permissions
    - memory initialization
**compiler**: **class**: Compiler
  **supported_constructs**: - variables
    - functions
    - default parameters
    - blocks and lexical scopes
    - if/else
    - while loops
    - for loops
    - break and continue
    - return
    - try/catch/finally
    - imports
    - allow statements
    - memory declarations
    - prompt expressions
    - model, image, and video expressions
    - structured output
    - tool calls
    - conversion expressions
    - conditional expressions
    - await expressions
**specialized_opcodes**: - CALL_MODEL
  - CALL_IMAGE
  - CALL_VIDEO
  - INITIALIZE_MEMORY
  - CONVERT
  - CALL_BUILTIN
  - CLOSURE
  - GET_UPVALUE
  - SET_UPVALUE
  - CLOSE_UPVALUE

### execution

**engines**: **bytecode_vm**: **capabilities**: - globals
      - local_slots
      - closures
      - upvalues
      - control_flow
      - builtins_fast_path
      - model_call_opcodes
      - try_catch_finally
    **components**: - chunk
      - compiler
      - vm
      - disassembler
    **default**: true
  **tree_walking_interpreter**: **capabilities**: - lexical_scopes
      - async_functions
      - model_tool_orchestration
      - standard_module_loading
      - runtime_type_values
    **role**: fallback
**safety**: **default_safe_mode**: true
  **environment_variables**: **SESI_LOCAL_FS**: Set to true to permit local filesystem access when safe mode is disabled.
    **SESI_SAFE_MODE**: Set to false to enable unsafe process and external-tool features.
  **restricted_in_safe_mode**: - exec
    - run
    - spawn
    - python
    - js
    - ffmpeg
    - gif
    - video
    - open
    - open_file
    - native_http_server
    - websocket_server
    - browser_module
    - non_zip_archive_access
    - external_media_processes

### semantic_analysis

**checks**: - lexical declarations
  - function declarations
  - parameters
  - imports
  - loop variables
  - catch variables
  - memory and prompt declarations
  - tool declarations
  - builtin symbol recognition
  - scope nesting
**component**: Dry-run scope checker
**diagnostics**: **errors**: - undefined-symbol
  **warnings**: - unused-symbol

### semantic_checks

**analysis**: - strips line and block comments while preserving strings
  - tokenizes source code
  - creates lexical scope hierarchy
  - tracks declarations and references
  - recognizes built-ins
  - validates imports and allow bindings
  - suppresses selected unused warnings for loop variables and underscore-prefixed names
**diagnostics**: **undefined_symbol**: **code**: undefined-symbol
    **severity**: error
  **unused_symbol**: **code**: unused-symbol
    **severity**: warning
**function**: runDryRunSemanticChecks
**module**: dry-run-semantic-checks.ts

### static_analysis

**dry_run**: **diagnostics**: - undefined_symbols
    - unused_symbols
    - type_mismatches
    - return_type_mismatches
**type_system**: **supported_annotations**: - number
    - string
    - bool
    - any
    - array<T>
    - object<T>
    - optional_types
    - union_types

### validation_and_analysis

**dry_run_checker**: **diagnostics**: - undefined-symbol
    - unused-symbol
**profiler**: **metrics**: - invocation_count
    - total_duration_ms
    - average_duration_ms
    - minimum_duration_ms
    - maximum_duration_ms
    - last_duration_ms
**type_checker**: **diagnostics**: - type-mismatch
    - return-type-mismatch
    - argument-type-mismatch

### types

**assertions**: - **name**: is_array
    **signature**: is_array(value) -> bool
  - **name**: is_object
    **signature**: is_object(value) -> bool
  - **name**: is_string
    **signature**: is_string(value) -> bool
  - **name**: is_number
    **signature**: is_number(value) -> bool
  - **name**: is_bool
    **signature**: is_bool(value) -> bool
  - **name**: is_null
    **signature**: is_null(value) -> bool
  - **name**: is_function
    **signature**: is_function(value) -> bool
**conversion**: - **name**: type
    **pipe_supported**: true
    **returns**: One of: number, string, bool, null, array, object, unknown.
    **signature**: type(value) -> string
  - **description**: Converts any value to a string representation.
    **name**: str
    **pipe_supported**: true
    **signature**: str(value) -> string
  - **description**: Converts an array or object to formatted valid JSON.
    **name**: to_json
    **pipe_supported**: true
    **returns**: Formatted JSON string.
    **signature**: to_json(value) -> string
  - **description**: Parses JSON into a native Sesi primitive, array, or object.
    **name**: from_json
    **pipe_supported**: true
    **returns**: Parsed value, or null when parsing fails.
    **signature**: from_json(string) -> any
  - **description**: Encrypts UTF-8 content with AES-256-CBC.
    **name**: encrypt
    **pipe_supported**: true
    **returns**: iv:ciphertext encrypted payload.
    **signature**: encrypt(content, password) -> string
  - **description**: Decrypts an AES-256-CBC iv:ciphertext payload.
    **name**: decrypt
    **pipe_supported**: true
    **returns**: Decrypted UTF-8 content.
    **signature**: decrypt(content, password) -> string
  - **description**: Converts a value to a number.
    **name**: num
    **pipe_supported**: true
    **returns**: Number or null when conversion fails.
    **signature**: num(value) -> number|null
  - **description**: Converts a value to a floating-point number.
    **name**: float
    **pipe_supported**: true
    **returns**: Number or null when conversion fails.
    **signature**: float(value) -> number|null
  - **description**: Converts a value using Sesi truthiness rules.
    **name**: bool
    **pipe_supported**: true
    **signature**: bool(value) -> bool
**pipe_supported**: true

---

## CLI & Tools

### cli

**entry_functions**: - runSesi
  - runSesiFile
**options**: - safeMode
  - allowLocalFs
  - allowedPaths
  - encrypt
  - decrypt
  - password
  - raw
  - ast
  - tokens
  - dry
  - bytecode
  - bytecodeDump
  - treeWalker
  - timeoutMs
  - profile
**output_modes**: - token_table
  - raw_ast_json
  - AST_tree
  - bytecode_disassembly
  - semantic_diagnostics
  - runtime_profile

### cli_runtime

**diagnostics**: - token table output
  - AST tree output
  - bytecode disassembly
  - dry-run semantic checks
  - type checks
  - structured runtime errors
**entrypoints**: - runSesi
  - runSesiFile
**execution_modes**: **bytecode_vm**: **default**: true
  **tree_walker**: **option**: treeWalker
**supported_options**: - safeMode
  - allowLocalFs
  - allowedPaths
  - encrypt
  - decrypt
  - password
  - raw
  - ast
  - tokens
  - dry
  - bytecode
  - bytecodeDump
  - treeWalker
  - timeoutMs
  - deadlineAt
  - profile

### developer_tools

**bytecode**: **CLI_option**: bytecodeDump
  **disassembler**: disassemble
**dry_run**: **diagnostics**: **errors**: - undefined-symbol
    **warnings**: - unused-symbol
  **semantic_checker**: runDryRunSemanticChecks
**profiling**: **class**: SesiProfiler
  **report_formatter**: formatProfileReport
**type_checking**: **function**: runTypeChecks

### debugging

- **description**: Pauses execution and opens the interactive sesi-debug REPL.
  **name**: debug
  **pipe_supported**: true
  **repl_commands**: **continue**: Resumes normal execution.
    **env**: Shows active lexical scope variables.
    **eval**: Evaluates a Sesi expression in the active scope.
    **help**: Displays debugger help.
  **signature**: debug(message = null) -> null

### quality_tools

**diagnostics**: - lexer_errors
  - parser_errors
  - compiler_errors
  - runtime_errors
  - structured_runtime_errors
  - stack_traces
**dry_run**: **semantic_checks**: - undefined_symbol_detection
    - unused_symbol_detection
    - type_checks
**profiling**: **class**: SesiProfiler
  **reports**: - object
    - text

### tool_orchestration

**blocked_automated_tools**: - exec
  - run
  - spawn
  - python
  - js
  - ffmpeg
  - gif
  - video
**custom_tools**: **automatic_execution**: supported
  **default_max_tool_calls**: 8
  **discovery**: list_tools
  **discovery_builtin**: list_tools
  **listing_builtin**: list_tools
  **max_tool_calls_default**: 8
  **registration**: define_tool
  **registration_builtin**: define_tool
  **schema_generation**: JSON_Schema
  **supported_parameter_types**: - number
    - string
    - bool
    - array
    - object
    - optional
    - union
    - any
  **supports**: - typed_parameter_schema_generation
    - required_parameter_detection
    - automatic_execution
    - multi_turn_model_tool_loops
    - tool_result_transcripts
**execution**: **behavior**: - send_tool_schemas_to_model
    - parse_model_tool_call
    - validate_tool_arguments
    - execute_registered_tool
    - append_serialized_tool_result_to_follow_up_prompt
    - continue_until_final_model_response
  **blocked_automated_tools**: - exec
    - run
    - spawn
    - python
    - js
    - ffmpeg
    - gif
    - video
  **max_default_tool_calls**: 8
**protected_automated_tools**: - exec
  - run
  - spawn
  - python
  - js
  - ffmpeg
  - gif
  - video
**schema_generation**: **format**: JSON_schema_function_declarations
  **source**: Sesi function parameters and type annotations
**supported_tool_formats**: - OpenAI_function_tools
  - Gemini_functionDeclarations
  - local_transformers_function_tools

### package_management

**installation**: **archive_extractors**: **unix**: - unzip
      - tar
    **windows**: - PowerShell Expand-Archive
      - tar
  **package_manager_user_agent**: Sesi-PackageManager/1.8.6
  **source**: GitHub_zipball
  **source_archive**: GitHub ZIP archive
**manifest**: sesi.json
**modules_directory**: sesi_modules
**supported_sources**: - owner/repository#ref
  - github:owner/repository#ref
  - https://github.com/owner/repository
**supported_specifications**: - owner/repository
  - owner/repository#ref
  - github:owner/repository
  - https://github.com/owner/repository

### package_manager

**installation**: **extraction_tools**: - unzip
    - tar
    - PowerShell_Expand_Archive
  **source**: GitHub_zipball
**installation_method**: - download_GitHub_zipball
  - extract_archive
  - save_to_sesi_modules
  - update_manifest_dependencies
**installation_source**: GitHub ZIP archives
**manifest**: sesi.json
**modules_directory**: sesi_modules
**source**: pm.ts
**source_support**: - owner/repository#ref
  - github:owner/repository#ref
  - https://github.com/owner/repository#ref
**supported_sources**: - owner/repository#reference
  - github:owner/repository#reference
  - https://github.com/owner/repository#reference
**supported_specifications**: - owner/repository
  - owner/repository#ref
  - github:owner/repository#ref
  - https://github.com/owner/repository

### pricing

**currency**: USD
**pricing_as_of**: 2026-07-27
**pricing_sources**: **gemini**: https://ai.google.dev/gemini-api/docs/pricing
  **openai**: https://developers.openai.com/api/docs/pricing
**source**: token-pricing.ts
**supported_model_families**: - gemini-2.5
  - gemini-3.1
  - gemini-3.5
  - gemini-3.6
  - gpt-5.6
**unit**: per_million_tokens

### token_pricing

**currency**: USD
**functionality**: - per_million_token_rates
  - long_context_rate_thresholds
  - input_output_cost_estimation
  - custom_rate_overrides
**pricing_as_of**: 2026-07-27
**pricing_sources**: **gemini**: https://ai.google.dev/gemini-api/docs/pricing
  **openai**: https://developers.openai.com/api/docs/pricing
**providers**: **gemini**: **configured_models**: - gemini-3.6-flash
      - gemini-3.5-flash-lite
      - gemini-3.5-flash
      - gemini-3.1-flash-lite
      - gemini-3.1-pro-preview
      - gemini-2.5-flash-lite
      - gemini-2.5-flash
      - gemini-2.5-pro
    **source**: https://ai.google.dev/gemini-api/docs/pricing
  **openai**: **configured_models**: - gpt-5.6-sol
      - gpt-5.6-terra
      - gpt-5.6-luna
    **source**: https://developers.openai.com/api/docs/pricing
**sources**: **gemini**: https://ai.google.dev/gemini-api/docs/pricing
  **openai**: https://developers.openai.com/api/docs/pricing
**supported_families**: - gemini
  - gpt-5.6
**supported_model_families**: - gemini-2.5
  - gemini-3.1
  - gemini-3.5
  - gemini-3.6
  - gpt-5.6
**unit**: per 1,000,000 tokens

### introspection

- **name**: name
  **pipe_supported**: true
  **signature**: name(func) -> string|null
- **name**: arity
  **pipe_supported**: true
  **signature**: arity(func) -> number|null

### error_return_reference

**keys**: null
**len**: null
**num**: null
**pop_empty_array**: null
**str**: String representation, including null as string text.
**type**: unknown
**values**: null

### performance_notes

- show() is unbuffered and flushes on every call.
- Most array operations are O(n).
- Object key access is generally O(1).
- String concatenation with + is O(n).

---

## Configuration & Environment

### configuration

**environment_variables**: **GEMINI_API_KEY**: **purpose**: Gemini_provider_authentication
  **OPENAI_API_KEY**: **purpose**: OpenAI_provider_authentication
  **SESI_DEBUG**: **purpose**: interpreter_execution_debug_logging
  **SESI_LOCAL_CACHE_DIR**: **purpose**: local_model_cache_directory
  **SESI_LOCAL_DEVICE**: **purpose**: local_model_device
  **SESI_LOCAL_DTYPE**: **purpose**: local_model_quantization_dtype
  **SESI_LOCAL_FS**: **purpose**: allow_local_filesystem_when_safe_mode_is_disabled
  **SESI_LOCAL_MODEL**: **purpose**: override_default_local_model
  **SESI_LOCAL_SYSTEM_PROMPT**: **purpose**: default_local_system_prompt
  **SESI_LOCAL_WARN_TOKENS**: **purpose**: local_model_input_warning_threshold
  **SESI_MEMORY_AUTO_SUMMARIZE**: **purpose**: enable_or_disable_memory_auto_summarization
  **SESI_MEMORY_MAX_TOKENS**: **purpose**: memory_maximum_token_budget
  **SESI_MEMORY_SUMMARY_MODEL**: **purpose**: memory_summary_model
  **SESI_MEMORY_TARGET_TOKENS**: **purpose**: memory_summary_target_token_budget
  **SESI_PASSWORD**: **purpose**: default_encryption_password
  **SESI_PATH**: **purpose**: additional_module_search_paths
  **SESI_SAFE_MODE**: **purpose**: control_default_safe_mode

### constants

**DEFAULT_LOCAL_MODEL**: onnx-community/Qwen2.5-0.5B-Instruct
**DEFAULT_LOCAL_MODEL_WARNING_TOKENS**: 2048

### environment_variables

**GEMINI_API_KEY**: Gemini API authentication key
**OPENAI_API_KEY**: OpenAI API authentication key
**SESI_DEBUG**: Set to 1 to print interpreter execution debug output
**SESI_LOCAL_CACHE_DIR**: Local model cache directory
**SESI_LOCAL_DEVICE**: Local inference device
**SESI_LOCAL_DTYPE**: Local ONNX model quantization/dtype
**SESI_LOCAL_FS**: Set to true to permit local filesystem access when safe mode is off
**SESI_LOCAL_MODEL**: Default local Hugging Face model
**SESI_LOCAL_SYSTEM_PROMPT**: Default local-model system prompt
**SESI_LOCAL_WARN_TOKENS**: Local input token warning threshold
**SESI_MEMORY_AUTO_SUMMARIZE**: Automatic memory summarization toggle
**SESI_MEMORY_MAX_TOKENS**: Memory maximum token budget
**SESI_MEMORY_SUMMARY_MODEL**: Memory summary model
**SESI_MEMORY_TARGET_TOKENS**: Memory target token budget
**SESI_PASSWORD**: Default encryption password
**SESI_PATH**: Additional module search paths
**SESI_SAFE_MODE**: Set to false to relax safe-mode restrictions

### global_variables

**args**: **description**: Command-line script arguments excluding interpreter options and script filename.
  **type**: array<string>

### security

**additional_protections**: - prototype_pollution_blocking
  - archive_entry_traversal_validation
  - sensitive_automated_tool_blocking
  - constrained_local_module_imports
**archive_protection**: - validates_archive_entry_paths
  - blocks_absolute_archive_paths
  - blocks_null_byte_paths
  - blocks_directory_traversal_entries
**automated_tools**: **blocked_sensitive_tools**: - exec
    - run
    - spawn
    - python
    - js
    - ffmpeg
    - gif
    - video
**blocked_automated_tools**: - exec
  - run
  - spawn
  - python
  - js
  - ffmpeg
  - gif
  - video
**controls**: - path_traversal_protection
  - allowed_directory_enforcement
  - archive_entry_validation
  - prototype_pollution_protection
  - restricted_external_process_execution_in_safe_mode
  - restricted_browser_server_and_websocket_features_in_safe_mode
  - restricted_non_zip_archive_access_in_safe_mode
  - restricted_automated_sensitive_tool_execution
**cryptography**: **algorithm**: AES-256-CBC
  **functions**: - encrypt
    - decrypt
  **implementation_details**: **initialization_vector**: Random 16-byte IV
    **key_derivation**: SHA-256 password hash
    **serialized_format**: <iv-hex>:<ciphertext-hex>
**default_mode**: safe
**defaults**: **environment_override**: SESI_SAFE_MODE=false
  **local_filesystem_access**: false
  **local_filesystem_override**: SESI_LOCAL_FS=true
  **safe_mode**: true
**environment_controls**: **local_filesystem**: SESI_LOCAL_FS
  **safe_mode**: SESI_SAFE_MODE
**environment_variables**: **SESI_LOCAL_FS**: Set to "true" to permit local filesystem access
  **SESI_SAFE_MODE**: Set to "false" to disable safe mode
**filesystem**: **allowed_paths**: - current_working_directory
    - script_directory
    - explicitly_configured_paths
  **default_allowed_directory**: current_working_directory
  **environment_variable**: SESI_LOCAL_FS
  **optional_local_access**: **environment_variable**: SESI_LOCAL_FS
    **required_value**: true
  **path_validation**: ensureSafePath
  **path_validation_function**: ensureSafePath
  **path_validator**: ensureSafePath
  **protected_against**: - path_traversal
  **protections**: - resolves paths against a controlled base directory
    - blocks traversal outside allowed paths
    - supports explicit allowed paths
    - supports script-directory access
    - validates archive extraction entries
    - path_traversal_prevention
    - archive_entry_validation
    - prototype_pollution_protection
**path_protection**: **behavior**: - resolves_paths_against_allowed_directories
    - blocks_path_traversal
    - supports_interpreter_specific_allowed_paths
    - supports_script_directory_allowlisting
  **controls**: - path_traversal_prevention
    - allowed_directory_enforcement
    - script_directory_access
    - optional_local_filesystem_mode
  **function**: ensureSafePath
  **protections**: - path_traversal_prevention
    - allowed_directory_validation
    - safe_mode_local_filesystem_lockdown
**protected_operations**: - local_filesystem_access
  - external_application_launching
  - shell_execution
  - Python_execution
  - JavaScript_execution
  - FFmpeg_execution
  - native_HTTP_server
  - WebSocket_server
  - non_ZIP_archive_access
**protections**: - filesystem_path_traversal_validation
  - prototype_pollution_blocking
  - safe_mode_process_execution_restrictions
  - safe_mode_external_application_restrictions
  - safe_mode_http_server_restrictions
  - safe_mode_browser_restrictions
  - safe_mode_non_zip_archive_restrictions
  - safe_mode_ffmpeg_restrictions
  - sensitive_automated_tool_blocklist
  - archive_entry_path_validation
**prototype_pollution**: **blocked_assignment_keys**: - __proto__
    - prototype
    - constructor
    - __defineGetter__
    - __defineSetter__
    - __lookupGetter__
    - __lookupSetter__
  **protections**: - stripPrototypes
    - **blocked_property_names**: - __proto__
        - prototype
        - constructor
        - __defineGetter__
        - __defineSetter__
        - __lookupGetter__
        - __lookupSetter__
  **sanitization_function**: stripPrototypes
**restricted_in_safe_mode**: - exec
  - run
  - spawn
  - python
  - js
  - ffmpeg
  - gif
  - video
  - open
  - open_file
  - browser_module
  - native_http_server
  - websocket_server
  - external_archive_access
  - media_conversion
  - non_zip_archive_access
  - std/browser
  - std/game.run
  - command_line_media_conversion
**safe_mode**: **default**: true
  **effects**: - disables unrestricted_local_filesystem_access
    - disables_external_application_launching
    - disables_process_spawning
    - disables_shell_execution
    - disables_python_execution
    - disables_javascript_execution
    - disables_ffmpeg_and_media_processing
    - disables_non_zip_archive_access
    - disables_native_http_and_websocket_servers
    - disables_browser_automation
  **environment_override**: SESI_SAFE_MODE=false
  **environment_variable**: SESI_SAFE_MODE
  **restrictions**: - local filesystem access is constrained to allowed directories
    - arbitrary shell execution is disabled
    - Python execution is disabled
    - JavaScript execution is disabled
    - external process spawning is disabled
    - opening external applications is disabled
    - native HTTP and WebSocket servers are disabled
    - FFmpeg and media processing are disabled
    - non-ZIP archive access is disabled
    - game preview server is disabled
    - local_filesystem_access
    - process_execution
    - browser_launching
    - native_http_server
    - websocket_server
    - external_archive_access
    - media_processing
**safe_mode_default**: true
**sensitive_tools**: - exec
  - run
  - spawn
  - python
  - js
  - ffmpeg
  - gif
  - video

### security_notes

**archive_protection**: - Validates extraction entry paths.
  - Blocks non-ZIP archive access in safe mode.
**model_tool_protection**: - Prevents automated execution of sensitive process-control tools.
**path_protection**: - Resolves paths against configured allowed directories.
  - Blocks traversal outside allowed roots in safe mode.
**prototype_pollution_protection**: - Uses prototype-free objects for external or parsed data.
  - Blocks assignments to dangerous prototype-related property names.

### memory

- **description**: Searches a memory binding using semantic similarity.
  **embedding_models**: **fallback**: gemini-embedding-2
    **primary**: gemini-embedding-001
  **name**: memory_search
  **pipe_supported**: true
  **result_fields**: - text
    - score
  **signature**: memory_search(name, query, top_k = 3) -> array<object>
- **description**: Configures automatic memory summarization.
  **name**: memory_config
  **options**: **enabled**: true
    **max_tokens**: 900000
    **summary_model**: gemini-3.5-flash-lite
    **target_tokens**: 60% of max_tokens by default.
  **pipe_supported**: true
  **signature**: memory_config(name, options = {}) -> object
- **description**: Compacts a memory binding when it exceeds its token budget.
  **name**: memory_trim
  **pipe_supported**: true
  **signature**: memory_trim(name, max_tokens = 900000) -> string

---

## Dependencies & Exports

### dependencies

**AI**: - @huggingface/transformers
  - @google/genai
  - openai
**ai**: - @huggingface/transformers
  - @google/genai
  - openai
**archives**: - adm-zip
**browser**: - playwright
**conversion**: - html-to-text
  - js-yaml
  - marked
  - turndown
  - sharp
  - image-size
**external_tools**: - ffmpeg
  - tar
  - 7z
  - 7zz
  - unrar
  - rar
  - cmake
  - Python
  - espeak-ng
  - macOS say
  - PowerShell System.Speech
**media**: - sharp
  - image-size
  - playwright
**networking**: - ws
**node_standard_library**: - fs
  - os
  - path
  - http
  - crypto
  - child_process
  - vm
**optional_or_feature_specific**: - playwright
  - translate
  - nodejs-whisper
  - smart-whisper
  - node-wav
  - ffmpeg
  - ImageMagick
  - pandoc
  - fluidsynth
  - espeak-ng
**optional_or_platform_dependent**: - ffmpeg
  - tar
  - 7zip
  - unrar
  - rar
  - nodejs-whisper
  - smart-whisper
  - node-wav
  - translate
  - espeak-ng
  - cmake
**parsing_and_conversion**: - js-yaml
  - marked
  - turndown
  - html-to-text
**required_or_core**: - @google/genai
  - openai
  - @huggingface/transformers
  - js-tiktoken
  - adm-zip
  - ws
**required_or_optional**: - @huggingface/transformers
  - @google/genai
  - openai
  - js-tiktoken
  - adm-zip
  - ws
  - translate
  - html-to-text
  - nodejs-whisper
  - smart-whisper
  - node-wav
**required_or_primary**: - @google/genai
  - @huggingface/transformers
  - openai
  - js-tiktoken
  - js-yaml
  - marked
  - turndown
  - sharp
  - html-to-text
  - image-size
  - adm-zip
  - ws
**runtime**: - @huggingface/transformers
  - @google/genai
  - openai
  - js-tiktoken
  - adm-zip
  - ws
  - translate
  - nodejs-whisper
  - smart-whisper
  - node-wav
**tokenization**: - js-tiktoken
**transcription_optional**: - nodejs-whisper
  - smart-whisper
  - node-wav
**utilities**: - js-tiktoken
  - adm-zip
  - ws
  - smart-whisper
  - nodejs-whisper
  - node-wav

### key_dependencies

**ai**: - @google/genai
  - @huggingface/transformers
  - openai
**conversion**: - sharp
  - marked
  - turndown
  - html-to-text
  - image-size
  - js-yaml
**runtime**: - js-tiktoken
  - adm-zip
  - ws
  - playwright
**speech**: - nodejs-whisper
  - smart-whisper
  - node-wav

### external_dependencies

**ai**: - @huggingface/transformers
  - openai
  - @google/genai
  - js-tiktoken
**archives**: - adm-zip
**browser_automation**: - playwright
**document_conversion**: - html-to-text
  - js-yaml
  - marked
  - turndown
**image_processing**: - sharp
  - image-size
**optional_system_tools**: - ffmpeg
  - pandoc
  - ImageMagick
  - tar
  - 7zip
  - unrar
  - fluidsynth
  - cmake
  - espeak-ng
**transcription**: - nodejs-whisper
  - smart-whisper
  - node-wav
**websocket**: - ws

### entry_points

**execution**: - runSesi
  - runSesiFile
**exports**: - Lexer
  - Parser
  - Interpreter
  - Environment
  - Compiler
  - VM
  - disassemble
  - runInstall
**supported_options**: - safeMode
  - allowLocalFs
  - allowedPaths
  - encrypt
  - decrypt
  - password
  - raw
  - ast
  - tokens
  - args
  - dry
  - bytecode
  - bytecodeDump
  - treeWalker
  - timeoutMs
  - deadlineAt
  - profile

### exported_instances

**aiRuntime**: **singleton**: true
  **type**: AIRuntime

### imports

- @huggingface/transformers
- ./types
- fs
- os
- path
- crypto
- openai
- @google/genai

### interfaces

**MemorySummaryConfig**: **fields**: **enabled**: boolean
    **maxTokens**: number
    **summaryModel**: string
    **targetTokens**: number
**MemoryTrimResult**: **fields**: **error**: string?
    **summarized**: boolean
    **summaryModel**: string?
    **text**: string
    **tokensAfter**: number
    **tokensBefore**: number
    **usage**: AIResponse.usage?
**VideoGenerationRequest**: **fields**: **audio**: boolean?
    **duration**: number?
    **images**: string[]?
    **model**: string
    **negativePrompt**: string?
    **pollInterval**: number?
    **prompt**: string
    **ratio**: string?
    **resolution**: string?
    **task**: string?

### module

**language**: TypeScript
**name**: ai-runtime
**purpose**: Provides a unified AI runtime supporting local Hugging Face Transformers, OpenAI GPT, Google Gemini, image generation, video generation, speech, embeddings, caching, tool calls, streaming, and memory summarization.


### module_resolution

**search_order**: - Directory containing the running Sesi script.
  - Current working directory.
  - Directories specified by SESI_PATH.
  - ~/.sesi/lib global library directory.
**sesi_path_separator**: **unix**: :
  **windows**: ;

### utility_functions

**cosineSimilarity**: **edge_cases**: - Returns 0 for empty vectors
    - Returns 0 for unequal vector lengths
    - Returns 0 when either vector has zero magnitude
  **purpose**: Calculates cosine similarity between equally sized numeric vectors.
**importTransformersModule**: **async**: true
  **behavior**: - Dynamically imports "@huggingface/transformers"
    - Enables remote model downloads through transformers.env.allowRemoteModels
    - Returns the Transformers module
**stripPrototypes**: **purpose**: Recursively converts objects into prototype-free plain objects.

### analysis_and_diagnostics

**bytecode**: **opcode_categories**: - stack_and_constants
    - globals_and_locals
    - arithmetic
    - comparisons
    - control_flow
    - collections
    - closures
    - builtins
    - ai_calls
    - exceptions
    - imports
    - memory
  **supports_disassembly**: true
**dry_run**: **checks**: - undefined_symbols
    - unused_symbols
    - declared_type_mismatches
    - return_type_mismatches
**profiling**: **implementation**: SesiProfiler
  **measurements**: - count
    - total_ms
    - average_ms
    - min_ms
    - max_ms
    - last_ms

---

