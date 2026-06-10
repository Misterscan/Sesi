const vscode = require('vscode');

function activate(context) {
    const docs = {
        'let': {
            signature: 'let identifier = value',
            source: 'Sesi Core Primitives',
            description: 'Declares a variable and binds it to a value. In Sesi, `let` is the single universal binding primitive (forbid using `const`).',
            example: 'let count = 10\ncount = count + 5\nprint count'
        },
        'fn': {
            signature: 'fn name(param1, param2) { ... }',
            source: 'Sesi Core Primitives',
            description: 'Declares a reusable block of code with optional parameters and return values. Inside Sesi functions, `return` is used to output a value.',
            example: 'fn multiply(a, b) {\n  return a * b\n}\n\nlet result = multiply(5, 10)'
        },
        'if': {
            signature: 'if condition { ... } else { ... }',
            source: 'Sesi Control Flow',
            description: 'Executes the first code block if the condition evaluates to `true`. Supports optional nested `else` statements.',
            example: 'let value = random()\nif value > 0.5 {\n  print "Greater than 0.5"\n} else {\n  print "Less than or equal to 0.5"\n}'
        },
        'else': {
            signature: 'else { ... }',
            source: 'Sesi Control Flow',
            description: 'Specifies a block of code to be executed if the corresponding `if` condition evaluates to `false`.',
            example: 'if status == "success" {\n  print "Done"\n} else {\n  print "Failed"\n}'
        },
        'while': {
            signature: 'while condition { ... }',
            source: 'Sesi Loops',
            description: 'Repeatedly executes a block of code as long as the specified condition remains `true`.',
            example: 'let x = 0\nwhile x < 5 {\n  print x\n  x = x + 1\n}'
        },
        'for': {
            signature: 'for element in iterable { ... }',
            source: 'Sesi Loops',
            description: 'Iterates over elements of an array, a range, or an object collection.',
            example: 'let items = ["apple", "banana", "cherry"]\nfor item in items {\n  print item\n}'
        },
        'in': {
            signature: 'element in collection',
            source: 'Sesi Operators',
            description: 'Used inside `for` loops to specify the sequence being iterated over, or as a membership test operator.',
            example: 'for i in range(1, 5) {\n  print i\n}'
        },
        'to': {
            signature: 'start to end',
            source: 'Sesi Operators',
            description: 'Specifies a range boundary operator or transition sequence specifier in Sesi structures.',
            example: '// Used in ranges or custom domain workflows'
        },
        'return': {
            signature: 'return value',
            source: 'Sesi Core Primitives',
            description: 'Terminates function execution and returns a value. Required inside of a `fn` block to output data.',
            example: 'fn add(a, b) {\n  return a + b\n}'
        },
        'try': {
            signature: 'try { ... } catch (error) { ... }',
            source: 'Sesi Resilience',
            description: 'Encloses a block of code that may raise a filesystem or execution error, pairing with a `catch` block to handle exceptions.',
            example: 'try {\n  let content = read_file("missing.txt")\n} catch (e) {\n  print "Caught filesystem error: " e\n}'
        },
        'catch': {
            signature: 'catch (error) { ... }',
            source: 'Sesi Resilience',
            description: 'Handles exceptions thrown within the preceding `try` block, binding the error metadata to the specified identifier.',
            example: 'try {\n  raise_error("Operation failed")\n} catch (e) {\n  print "Error type: " error_type(e)\n}'
        },
        'break': {
            signature: 'break',
            source: 'Sesi Loops',
            description: 'Immediately terminates execution of the innermost active loop block.',
            example: 'let i = 0\nwhile true {\n  if i == 3 { break }\n  i = i + 1\n}'
        },
        'continue': {
            signature: 'continue',
            source: 'Sesi Loops',
            description: 'Skips the remaining statements in the current loop iteration and moves directly to the next loop evaluation.',
            example: 'for x in range(0, 5) {\n  if x == 2 { continue }\n  print x\n}'
        },
        'import': {
            signature: 'import module_name',
            source: 'Sesi Modules',
            description: 'Loads a reusable module or configuration file into the current execution space.',
            example: 'import math'
        },
        'from': {
            signature: 'from module import item',
            source: 'Sesi Modules',
            description: 'Extracts specific functions or definitions from a external module file.',
            example: 'from sys import exec'
        },
        'export': {
            signature: 'export let variable',
            source: 'Sesi Modules',
            description: 'Exposes variables, objects, or functions from the active file as public module API exports.',
            example: 'export let author = "Alice"'
        },
        'number': {
            signature: 'let n: number',
            source: 'Sesi Types',
            description: 'Core numeric primitive representing both integer and floating-point values in Sesi.',
            example: 'let pi = 3.14159\nlet size = 2048'
        },
        'string': {
            signature: 'let s: string',
            source: 'Sesi Types',
            description: 'Core string text primitive representing sequences of UTF-8 characters.',
            example: 'let title = "Sesi Compiler Pipeline"\nlet line = \'Systems Programming\''
        },
        'bool': {
            signature: 'let b: bool',
            source: 'Sesi Types',
            description: 'Core Boolean boolean primitive containing either `true` or `false` values.',
            example: 'let is_valid = true\nlet has_error = false'
        },
        'null': {
            signature: 'let value: null',
            source: 'Sesi Types',
            description: 'Represents the intentional absence of any value or reference.',
            example: 'let config = null'
        },
        'array': {
            signature: 'let list: array',
            source: 'Sesi Types',
            description: 'A dynamic, ordered collection of values indexable by positive integers.',
            example: 'let steps = [1, "compile", true]\nlet first = steps[0]'
        },
        'object': {
            signature: 'let dict: object',
            source: 'Sesi Types',
            description: 'An associative collection of key-value pairs. Standard object literals require quoted string keys in Sesi.',
            example: 'let user = {"name": "Charlie", "role": "admin"}\nprint user["name"]'
        },
        'model': {
            signature: 'model("model-name") { ... }',
            source: 'Sesi AI',
            description: 'Reasoning model evaluation primitive. Calls a specified LLM configuration block to generate a reasoning response.',
            example: 'model("gemini-3.1-flash-lite") {"Outline the systems architecture for a compiler pipeline."}'
        },
        'image': {
            signature: 'image("prompt")',
            source: 'Sesi AI',
            description: 'Generates a synthetic image using advanced text-to-image models based on the prompt parameter.',
            example: 'let graphic = image("A dark, technical isometric blueprint of a compiler lexer graph.")'
        },
        'memory': {
            signature: 'memory',
            source: 'Sesi Stateful Memory',
            description: 'Stateful conversation memory primitive that persists contextual thread arrays.',
            example: '// Memory is injected directly inside your script workflows.'
        },
        'workflow': {
            signature: 'workflow name { ... }',
            source: 'Sesi AI',
            description: 'Chains sequential model executions, transformations, and processing scripts into a unified pipeline.',
            example: 'workflow build_doc {\n  // Sequence steps here\n}'
        },
        'structured_output': {
            signature: 'structured_output(schema)(expression)',
            source: 'Serialization Standard Library',
            description: 'Creates strongly typed, schema-validated structured data from the result of any Sesi expression.',
            example: 'let rawJson = "{\\"projectName\\": \\"Sesi\\", \\"version\\": \\"1.3.0\\"}"\nlet parsed = structured_output({projectName: string, version: string})(rawJson)'
        },
        'prompt': {
            signature: 'prompt { ... }',
            source: 'Sesi Compostion',
            description: 'Constructs highly dynamic and concise template prompts. Safe from literal string hardcoding and concatenations.',
            example: 'let task = "audit logs"\nprompt {"Analyze the system performance regarding: " task}'
        },
        'define_tool': {
            signature: 'define_tool("tool_name", schema) { ... }',
            source: 'Sesi Tooling Integration',
            description: 'Declares a custom system tool schema. This makes standard Sesi functions or scripts discoverable as tool call actions for LLMs.',
            example: 'define_tool("read_config", {file: string}) {\n  return read_file(file)\n}'
        },
        'list_tools': {
            signature: 'list_tools()',
            source: 'Sesi Tooling Integration',
            description: 'Returns an array of all registered system tool definitions currently available in the runtime environment.',
            example: 'let tools = list_tools()\nprint tools'
        },
        'tool_call': {
            signature: 'tool_call("tool_name", args_object)',
            source: 'Sesi Tooling Integration',
            description: 'Invokes a predefined custom tool dynamically by its name and passes the argument payload.',
            example: 'let output = tool_call("read_config", {"file": "config.json"})'
        },
        'multi_req': {
            signature: 'multi_req(requests_array)',
            source: 'Sesi Tooling Integration',
            description: 'Dispatches multiple concurrent model reasoning requests in parallel, returning their results together.',
            example: 'let results = multi_req([\n  {"model": "gemini-3-flash-preview", "prompt": "Audit index.html"},\n  {"model": "gemini-3.1-flash-lite", "prompt": "Audit server.js"}\n])'
        },
        'read_file': {
            signature: 'read_file(path)',
            source: 'System I/O Standard Library',
            description: 'Synchronously reads and returns the full text content of a file located at the specified path.',
            example: 'let source_code = read_file("main/playground.sesi")\nprint source_code'
        },
        'write_file': {
            signature: 'write_file(path, content)',
            source: 'System I/O Standard Library',
            description: 'Writes a string of text content to a file at the designated path. Creates the file or overwrites it if it already exists.',
            example: 'write_file("main/logs/status.txt", "Compiler execution succeeded.")'
        },
        'write_image': {
            signature: 'write_image(path, img_data)',
            source: 'System I/O Standard Library',
            description: 'Saves raw image canvas data or generated image model outputs directly to a file path as an image file (e.g. PNG).',
            example: 'let banner = image("Sleek minimal blueprint logo")\nwrite_image("output/banner.png", banner)'
        },
        'list_dir': {
            signature: 'list_dir(path)',
            source: 'System I/O Standard Library',
            description: 'Retrieves an array containing the names of all files and folders located inside the target directory path.',
            example: 'let files = list_dir("main")\nfor file in files {\n  print file\n}'
        },
        'make_dir': {
            signature: 'make_dir(path)',
            source: 'System I/O Standard Library',
            description: 'Recursively creates nested directory paths on the local system storage.',
            example: 'make_dir("main/tests/cache")'
        },
        'spawn': {
            signature: 'spawn(script_path)',
            source: 'Process Orchestration Standard Library',
            description: 'Asynchronously launches a separate, background Sesi script process concurrently.',
            example: 'spawn("main/compile_service.sesi")'
        },
        'exec': {
            signature: 'exec(command_line)',
            source: 'Process Orchestration Standard Library',
            description: 'Spawns a shell environment command synchronously. Returns the full stdout response of the executed process.',
            example: 'let git_log = exec("git log -n 1 --oneline")\nprint "Latest commit: " git_log'
        },
        'web_get': {
            signature: 'web_get(url)',
            source: 'HTTP Client Standard Library',
            description: 'Performs a synchronous HTTP GET request to the specified web address, returning the textual response body.',
            example: 'let api_response = web_get("https://api.github.com/repos/misterscan/sesi")'
        },
        'web_send': {
            signature: 'web_send(url, payload)',
            source: 'HTTP Client Standard Library',
            description: 'Dispatches an HTTP POST request to the target web endpoint containing the payload data object.',
            example: 'let status = web_send("https://hooks.slack.com/services/...", {"text": "Workflow completed!"})'
        },
        'api': {
            signature: 'api(port, handler)',
            source: 'HTTP Server Standard Library',
            description: 'Starts a non-blocking, multi-threaded native WebSocket server listening on the specified port.',
            example: 'fn handleMessage(client, msg) {\n print "WS received:" msg\n client.send("Echo: " + msg)\n}\n\nlet server = api(8080, handleMessage)'
        },
        'to_json': {
            signature: 'to_json(value)',
            source: 'Serialization Standard Library',
            description: 'Converts a native Sesi value, array, or object into a standardized, valid JSON string.',
            example: 'let payload = {"id": 101, "status": "active"}\nlet json_str = to_json(payload)\nprint json_str'
        },
        'from_json': {
            signature: 'from_json(json_str)',
            source: 'Serialization Standard Library',
            description: 'Parses a structured JSON string and converts it directly into native, indexable Sesi objects or collections.',
            example: 'let raw = \'{"result": "success", "code": 200}\'\nlet obj = from_json(raw)\nprint obj["result"]'
        },
        'time': {
            signature: 'time()',
            source: 'Utility Standard Library',
            description: 'Returns the current high-resolution system timestamp in epoch milliseconds.',
            example: 'let start = time()\n// Run process...\nlet elapsed = time() - start\nprint "Completed in: " elapsed " ms"'
        },
        'random': {
            signature: 'random()',
            source: 'Utility Standard Library',
            description: 'Generates a pseudo-random floating-point decimal value between 0.0 (inclusive) and 1.0 (exclusive).',
            example: 'let rand_val = random()\nif rand_val < 0.2 {\n  print "Critical failure trigger"\n}'
        },
        'raise_error': {
            signature: 'raise_error(message)',
            source: 'Exception Handling Standard Library',
            description: 'Aborts current execution flow and raises a custom error message exception to be caught in a try-catch block.',
            example: 'if path == "" {\n  raise_error("Directory path cannot be empty")\n}'
        },
        'error_type': {
            signature: 'error_type(caught_error)',
            source: 'Exception Handling Standard Library',
            description: 'Extracts the descriptive string categorizing the exception type classification of a caught error.',
            example: 'try {\n  let file = read_file("invalid.txt")\n} catch (e) {\n  print "Error category: " error_type(e)\n}'
        },
        'print': {
            signature: 'print value1 value2 ...',
            source: 'Console I/O Standard Library',
            description: 'Outputs an arbitrary list of arguments sequentially to the Sesi terminal output standard stream.',
            example: 'let user = "developer"\nprint "[LOG] Session initialized by: " user'
        },
        'push': {
            signature: 'push(array, value)',
            source: 'Array Standard Library',
            description: 'Adds an element to the end of an array.',
            example: 'let items = ["apple", "banana"]\npush(items, "cherry")\nprint items'
        },
        'pop': {
            signature: 'pop(array)',
            source: 'Array Standard Library',
            description: 'Removes and returns the last element of an array.',
            example: 'let items = ["apple", "banana", "cherry"]\nlet last = pop(items)\nprint last'
        },
        'join': {
            signature: 'join(array, separator)',
            source: 'Array Standard Library',
            description: 'Join array elements into a string with separator.',
            example: 'let items = ["apple", "banana", "cherry"]\nlet joined = join(items, ", ")\nprint joined'
        },
        'split': {
            signature: 'split(string, separator',
            source: 'Array Standard Library',
            description: 'Split a string into an array by separator.',
            example: 'split("a,b,c", ",")\nsplit("hello world", " ")'
        },
        'keys': {
            signature: 'keys(collection)',
            source: 'Array Standard Library',
            description: 'Get all keys of an object.',
            example: 'let obj = { "name": "Alice", "age": 30 }\nkeys(obj)'
        },
        'values': {
            signature: 'values(collection)',
            source: 'Array Standard Library',
            description: 'Get all values of an object.',
            example: 'let obj = { "name": "Alice", "age": 30 }\nvalues(obj)'
        },
        'len': {
            signature: 'len(collection)',
            source: 'Utility Standard Library',
            description: 'Returns the total number of items, keys, or elements contained within an array, object, or string.',
            example: 'let chars = len("Sesi")\nlet count = len([10, 20, 30])'
        },
        'range': {
            signature: 'range(start, end)',
            source: 'Utility Standard Library',
            description: 'Generates an array of sequential integer elements progressing from start (inclusive) to end (exclusive).',
            example: 'let indices = range(0, 3) // returns [0, 1, 2]'
        },
        'type': {
            signature: 'type(value)',
            source: 'Utility Standard Library',
            description: 'Queries and returns a descriptive string indicating the active type classification of the evaluated parameter.',
            example: 'print type("code") // prints "string"\nprint type(42) // prints "number"'
        },
        'str': {
            signature: 'str(value)',
            source: 'Type Conversion Standard Library',
            description: 'Converts the given parameter value into its explicit text string format representation.',
            example: 'let age_string = str(28)\nprint "User age is: " + age_string'
        },
        'num': {
            signature: 'num(value)',
            source: 'Type Conversion Standard Library',
            description: 'Parses or casts the given string or boolean parameter value into its explicit numeric value form.',
            example: 'let value_num = num("1024")\nprint value_num + 1'
        },
        'exp': {
            signature: 'exp(value)',
            source: 'Advanced Math Functions',
            description: 'Returns Eulers number $e$ (approx. `2.71828`) raised to the power of $x$.',
            example: 'exp(0)\nexp(1)\nlet sigmoid = 1.0 / (1.0 + exp(0.0 - 0.5))\nprint sigmoid'
        },
        'args': {
            signature: 'args[number]',
            source: 'System I/O Standard Library',
            description: 'An array of strings containing the command-line arguments passed to the Sesi script.',
            example: 'print "Number of script args:" len(args)\nif len(args) > 0 {\n  print "First script argument:" args[0]\n}'
        },
        'listen': {
            signature: 'listen(port, handler_function)',
            source: 'Network Server Standard Library',
            description: 'Starts a non-blocking, multi-threaded native HTTP server on the specified port. Calls the async handler function for each incoming connection.',
            example: 'async fn handle(req) {\n  return {"status": 200, "body": "OK"}\n}\nlet server = listen(8080, handle)'
        },
        'db_open': {
            signature: 'db_open(filename)',
            source: 'Database Standard Library (std/db)',
            description: 'Opens or creates a persistent, JSON-backed document database file. Returns a database instance with collection-based CRUD capabilities.',
            example: 'import { db_open } from "std/db"\nlet db = db_open("data.db")\nlet users = db.collection("users")'
        },
        'async': {
            signature: 'async fn name() { ... }',
            source: 'Sesi Control Flow',
            description: 'Declares an asynchronous function that can perform non-blocking operations and suspend execution using the `await` operator.',
            example: 'async fn fetchLogs() {\n  return db.collection("logs").find()\n}'
        },
        'await': {
            signature: 'await expression',
            source: 'Sesi Control Flow',
            description: 'Suspends the execution of an enclosing async function until the target promise or async operation completes and returns its value.',
            example: 'let logs = await fetchLogs()'
        },
        'convert': {
            signature: 'convert(doc_or_media_or_audio) { output_type: ext } { expression }',
            source: 'Media Conversion Standard Library',
            description: 'Native media conversion primitive. Transforms images, videos, audio, or documents to the specified format.',
            example: 'let output = convert(media) { output_type: "jpg" } { "logo.png" }'
        },
        'format': {
            signature: 'format(time, { "timeZone": ... })',
            source: 'System I/O Standard Library',
            description: 'Convert Unix timestamps into readable local format.',
            example: 'format(now(), { "timeZone": "UTC", "dateStyle": "medium", "timeStyle": "short"})'
        },
        'debug': {
            signature: 'debug(message)',
            source: 'Debug Standard Library',
            description: 'Pause execution and launche an interactive debugger REPL in your shell terminal.',
            example: 'let x = 10\nlet y = 20\ndebug()\nprint x + y'
        }
    };

    const hoverProvider = vscode.languages.registerHoverProvider('sesi', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;

            const word = document.getText(range);
            const item = docs[word];
            if (item) {
                const markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;
                markdown.supportHtml = true;

                // 1. Signature
                markdown.appendCodeblock(item.signature, 'sesi');

                // 2. Metadata & Description
                markdown.appendMarkdown(`*Source:* \`${item.source}\`\n\n${item.description}\n\n`);

                // 3. Example
                markdown.appendMarkdown(`**Example:**\n`);
                markdown.appendCodeblock(item.example, 'sesi');

                return new vscode.Hover(markdown);
            }
            return null;
        }
    });

    context.subscriptions.push(hoverProvider);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
