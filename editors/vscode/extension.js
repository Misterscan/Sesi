const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getModuleSpecifierAtPosition(document, position) {
    const lineText = document.lineAt(position.line).text;
    const stringRegex = /(["'])(.*?)\1/g;
    let match;
    while ((match = stringRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            const specifier = match[2];
            const beforeString = lineText.substring(0, start).trim();
            const afterString = lineText.substring(end).trim();
            
            const isAllow = /\ballow\s*$/i.test(beforeString) || (beforeString.includes('allow') && afterString.startsWith('in'));
            const isImport = /\bfrom\s*$/i.test(beforeString);
            
            if (isAllow || isImport) {
                const range = new vscode.Range(
                    new vscode.Position(position.line, start + 1),
                    new vscode.Position(position.line, end - 1)
                );
                return { specifier, range, isAllow, isImport };
            }
        }
    }
    return null;
}

function resolveSesiModule(specifier, documentPath, workspaceRoot) {
    if (specifier.startsWith('std/')) {
        return {
            type: 'builtin',
            path: specifier,
            description: `Built-in Sesi Standard Library Module (${specifier})`
        };
    }

    let filePath = specifier;
    if (!filePath.endsWith('.sesi')) filePath += '.sesi';

    const searchDirs = [];

    // 1. Script's own directory
    if (documentPath) {
        searchDirs.push(path.dirname(documentPath));
    }

    // 2. Current working directory / workspace root
    if (workspaceRoot) {
        searchDirs.push(workspaceRoot);
    }
    searchDirs.push(process.cwd());

    // 3. SESI_PATH
    const sesiPath = process.env.SESI_PATH || '';
    if (sesiPath) {
        const sep = process.platform === 'win32' ? ';' : ':';
        sesiPath.split(sep).filter(Boolean).forEach(p => searchDirs.push(p));
    }

    // 4. Global library
    searchDirs.push(path.join(os.homedir(), '.sesi', 'lib'));

    for (const dir of searchDirs) {
        try {
            const resolved = path.resolve(dir, filePath);
            if (fs.existsSync(resolved)) {
                return {
                    type: 'local',
                    path: resolved,
                    searchDir: dir
                };
            }
        } catch (e) {
            // Ignore
        }
    }

    return null;
}

function getExportsFromSesiFile(filePath) {
    const exports = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const exportFnRegex = /\bexport\s+(async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
        const exportLetRegex = /\bexport\s+let\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;

        let match;
        while ((match = exportFnRegex.exec(content)) !== null) {
            exports.push({ type: 'function', name: match[2], params: match[3].trim(), isAsync: !!match[1] });
        }
        while ((match = exportLetRegex.exec(content)) !== null) {
            exports.push({ type: 'variable', name: match[1] });
        }
    } catch (e) {
        // Ignore
    }
    return exports;
}

function stripComments(text) {
    let result = '';
    let i = 0;
    let inString = false;
    let stringQuote = '';
    
    while (i < text.length) {
        const char = text[i];
        
        if (inString) {
            result += char;
            if (char === '\\') {
                if (i + 1 < text.length) {
                    result += text[i + 1];
                    i += 2;
                } else {
                    i++;
                }
            } else if (char === stringQuote) {
                inString = false;
                i++;
            } else {
                i++;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringQuote = char;
                result += char;
                i++;
            } else if (char === '/' && text[i + 1] === '/') {
                result += '  ';
                i += 2;
                while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                    result += ' ';
                    i++;
                }
            } else if (char === '/' && text[i + 1] === '*') {
                result += '  ';
                i += 2;
                while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                    if (text[i] === '\n' || text[i] === '\r') {
                        result += text[i];
                    } else {
                        result += ' ';
                    }
                    i++;
                }
                if (i < text.length) {
                    result += '  ';
                    i += 2;
                }
            } else {
                result += char;
                i++;
            }
        }
    }
    return result;
}

class Scope {
    constructor(parent = null) {
        this.parent = parent;
        this.variables = new Map();
        this.children = [];
        if (parent) parent.children.push(this);
    }
    
    declare(name, info) {
        this.variables.set(name, info);
    }
    
    resolve(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.resolve(name);
        }
        return null;
    }
}

function tokenize(text) {
    const tokens = [];
    const keywords = new Set([
        'let', 'fn', 'if', 'else', 'while', 'for', 'in', 'return',
        'break', 'continue', 'try', 'catch', 'finally', 'true', 'false', 'null',
        'print', 'prompt', 'model', 'image', 'async', 'await', 'import', 'from',
        'export', 'to', 'allow', 'with', 'convert', 'memory', 'structured_output',
        'tool_call'
    ]);

    const stripped = stripComments(text);
    const tokenRegex = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b[a-zA-Z_][a-zA-Z0-9_]*\b|[{}[\](),;.:=+\-*/%&|!<>]/g;
    let match;
    const lineOffsets = [];
    
    const lines = text.split('\n');
    let currentOffset = 0;
    for (const line of lines) {
        lineOffsets.push(currentOffset);
        currentOffset += line.length + 1;
    }

    function getPosition(offset) {
        let low = 0;
        let high = lineOffsets.length - 1;
        let line = 0;
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (lineOffsets[mid] <= offset) {
                line = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        const col = offset - lineOffsets[line];
        return { line, col };
    }

    while ((match = tokenRegex.exec(stripped)) !== null) {
        const lexeme = match[0];
        const offset = match.index;
        const pos = getPosition(offset);

        let type = 'PUNCTUATION';
        if (lexeme.startsWith('"') || lexeme.startsWith("'")) {
            type = 'STRING';
        } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lexeme)) {
            if (keywords.has(lexeme)) {
                type = lexeme.toUpperCase();
            } else {
                type = 'IDENTIFIER';
            }
        } else if (/^[0-9]+(\.[0-9]+)?$/.test(lexeme)) {
            type = 'NUMBER';
        }

        tokens.push({
            type,
            lexeme,
            line: pos.line,
            col: pos.col,
            length: lexeme.length
        });
    }
    return tokens;
}

function findDeclarationsAndReferences(tokens) {
    const decls = [];
    const refs = [];
    const declaredTokenSet = new Set();
    
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i];
        
        if (tok.type === 'LET') {
            const next = tokens[i + 1];
            if (next && next.type === 'IDENTIFIER') {
                decls.push({ name: next.lexeme, token: next, type: 'variable' });
                declaredTokenSet.add(next);
            }
        }
        else if (tok.type === 'FN') {
            const next = tokens[i + 1];
            if (next && next.type === 'IDENTIFIER') {
                decls.push({ name: next.lexeme, token: next, type: 'function' });
                declaredTokenSet.add(next);
            }
            
            let temp = i + 2;
            while (temp < tokens.length && tokens[temp].lexeme !== '(' && tokens[temp].lexeme !== '{') {
                temp++;
            }
            if (temp < tokens.length && tokens[temp].lexeme === '(') {
                temp++;
                while (temp < tokens.length && tokens[temp].lexeme !== ')') {
                    const paramTok = tokens[temp];
                    if (paramTok.type === 'IDENTIFIER') {
                        const prev = tokens[temp - 1];
                        if (prev && (prev.lexeme === '(' || prev.lexeme === ',')) {
                            decls.push({ name: paramTok.lexeme, token: paramTok, type: 'parameter' });
                            declaredTokenSet.add(paramTok);
                        }
                    }
                    temp++;
                }
            }
        }
        else if (tok.type === 'ALLOW') {
            let temp = i + 1;
            while (temp < tokens.length && tokens[temp].type !== 'WITH') {
                temp++;
            }
            if (temp + 1 < tokens.length) {
                const next = tokens[temp + 1];
                if (next.type === 'IDENTIFIER') {
                    decls.push({ name: next.lexeme, token: next, type: 'import' });
                    declaredTokenSet.add(next);
                } else if (next.lexeme === '{') {
                    let idx = temp + 2;
                    while (idx < tokens.length && tokens[idx].lexeme !== '}') {
                        const subTok = tokens[idx];
                        if (subTok.type === 'IDENTIFIER') {
                            decls.push({ name: subTok.lexeme, token: subTok, type: 'import' });
                            declaredTokenSet.add(subTok);
                        }
                        idx++;
                    }
                }
            }
        }
        else if (tok.type === 'IMPORT') {
            let temp = i + 1;
            if (temp < tokens.length && tokens[temp].lexeme === '{') {
                temp++;
                while (temp < tokens.length && tokens[temp].lexeme !== '}') {
                    const subTok = tokens[temp];
                    if (subTok.type === 'IDENTIFIER') {
                        decls.push({ name: subTok.lexeme, token: subTok, type: 'import' });
                        declaredTokenSet.add(subTok);
                    }
                    temp++;
                }
            } else if (temp < tokens.length && tokens[temp].type === 'IDENTIFIER') {
                decls.push({ name: tokens[temp].lexeme, token: tokens[temp], type: 'import' });
                declaredTokenSet.add(tokens[temp]);
            }
        }
        else if (tok.type === 'FOR') {
            const next = tokens[i + 1];
            if (next && next.type === 'IDENTIFIER') {
                decls.push({ name: next.lexeme, token: next, type: 'loop_variable' });
                declaredTokenSet.add(next);
            }
        }
        else if (tok.type === 'TRY') {
            let temp = i + 1;
            while (temp < tokens.length && tokens[temp].type !== 'CATCH') {
                temp++;
            }
            if (temp < tokens.length && temp + 2 < tokens.length) {
                if (tokens[temp + 1].lexeme === '(' && tokens[temp + 2].type === 'IDENTIFIER') {
                    const catchVar = tokens[temp + 2];
                    decls.push({ name: catchVar.lexeme, token: catchVar, type: 'catch_variable' });
                    declaredTokenSet.add(catchVar);
                }
            }
        }
        else if (tok.type === 'PROMPT' || tok.type === 'MEMORY' || tok.type === 'STRUCTURED_OUTPUT') {
            const next = tokens[i + 1];
            if (next && next.type === 'IDENTIFIER') {
                decls.push({ name: next.lexeme, token: next, type: 'variable' });
                declaredTokenSet.add(next);
            }
        }
        else if (tok.type === 'IDENTIFIER' && tok.lexeme === 'define_tool') {
            if (tokens[i + 1] && tokens[i + 1].lexeme === '(' && tokens[i + 2]) {
                const nameTok = tokens[i + 2];
                let name = '';
                if (nameTok.type === 'STRING') {
                    name = nameTok.lexeme.replace(/['"]/g, '');
                } else if (nameTok.type === 'IDENTIFIER') {
                    name = nameTok.lexeme;
                }
                if (name) {
                    decls.push({ name, token: nameTok, type: 'tool' });
                    declaredTokenSet.add(nameTok);
                }
            }
        }
        
        i++;
    }
    
    for (let j = 0; j < tokens.length; j++) {
        const tok = tokens[j];
        if (tok.type === 'IDENTIFIER' && !declaredTokenSet.has(tok)) {
            const prev = tokens[j - 1];
            if (prev && prev.lexeme === '.') {
                continue;
            }
            const next = tokens[j + 1];
            if (next && next.lexeme === ':') {
                if (prev && (prev.lexeme === '{' || prev.lexeme === ',')) {
                    continue;
                }
            }
            if (isConfigBlockKey(j, tokens)) {
                continue;
            }
            refs.push({ name: tok.lexeme, token: tok });
        }
    }
    
    return { decls, refs };
}

function isConfigBlockKey(j, tokens) {
    // 1. Find the opening '{' of the block containing tokens[j]
    let braceLevel = 0;
    let openBraceIdx = -1;
    for (let k = j - 1; k >= 0; k--) {
        const t = tokens[k];
        if (t.lexeme === '}') {
            braceLevel++;
        } else if (t.lexeme === '{') {
            if (braceLevel === 0) {
                openBraceIdx = k;
                break;
            }
            braceLevel--;
        }
    }
    if (openBraceIdx === -1) return false;

    // 2. Scan forward from openBraceIdx to find the matching '}' and check for top-level comma or colon
    let isConfig = false;
    let scanLevel = 0;
    for (let k = openBraceIdx; k < tokens.length; k++) {
        const t = tokens[k];
        if (t.lexeme === '{' || t.lexeme === '[' || t.lexeme === '(') {
            scanLevel++;
        } else if (t.lexeme === '}' || t.lexeme === ']' || t.lexeme === ')') {
            scanLevel--;
            if (scanLevel === 0) break; // Reached matching '}'
        } else if (scanLevel === 1) {
            if (t.lexeme === ',' || t.lexeme === ':') {
                isConfig = true;
            }
        }
    }

    // Check if it's a model config block by checking for a second block
    let closeBraceIdx = -1;
    let braceLevel2 = 0;
    for (let k = openBraceIdx; k < tokens.length; k++) {
        const t = tokens[k];
        if (t.lexeme === '{') braceLevel2++;
        else if (t.lexeme === '}') {
            braceLevel2--;
            if (braceLevel2 === 0) {
                closeBraceIdx = k;
                break;
            }
        }
    }
    if (closeBraceIdx !== -1) {
        let nextIdx = closeBraceIdx + 1;
        while (nextIdx < tokens.length && (tokens[nextIdx].type === 'NEWLINE' || tokens[nextIdx].type === 'COMMENT')) {
            nextIdx++;
        }
        if (nextIdx < tokens.length && tokens[nextIdx].lexeme === '{') {
            isConfig = true;
        }
    }

    if (!isConfig) return false;

    // 3. Check if tokens[j] is immediately preceded by '{' or ',' (skipping newlines/comments)
    for (let k = j - 1; k >= openBraceIdx; k--) {
        const t = tokens[k];
        if (t.type === 'NEWLINE' || t.type === 'COMMENT') {
            continue;
        }
        if (t.lexeme === '{' || t.lexeme === ',') {
            return true;
        }
        break;
    }

    return false;
}

function analyzeScope(tokens, decls, refs) {
    const declMap = new Map(decls.map(d => [d.token, d]));
    
    const rootScope = new Scope();
    let currentScope = rootScope;
    let skipNextBraceScope = false;
    
    const tokenScopes = new Map();
    
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        
        if (tok.lexeme === '}') {
            if (currentScope.parent) {
                currentScope = currentScope.parent;
            }
        }
        
        tokenScopes.set(tok, currentScope);
        
        if (tok.type === 'FN') {
            const nameTok = tokens[i + 1];
            if (nameTok && nameTok.type === 'IDENTIFIER') {
                currentScope.declare(nameTok.lexeme, {
                    token: nameTok,
                    type: 'function',
                    readCount: 0
                });
            }
            currentScope = new Scope(currentScope);
            skipNextBraceScope = true;
            
            let temp = i + 2;
            while (temp < tokens.length && tokens[temp].lexeme !== '(' && tokens[temp].lexeme !== '{') {
                temp++;
            }
            if (temp < tokens.length && tokens[temp].lexeme === '(') {
                temp++;
                while (temp < tokens.length && tokens[temp].lexeme !== ')') {
                    const paramTok = tokens[temp];
                    if (paramTok.type === 'IDENTIFIER') {
                        const prev = tokens[temp - 1];
                        if (prev && (prev.lexeme === '(' || prev.lexeme === ',')) {
                            currentScope.declare(paramTok.lexeme, {
                                token: paramTok,
                                type: 'parameter',
                                readCount: 0
                            });
                        }
                    }
                    temp++;
                }
            }
        }
        else if (tok.type === 'FOR') {
            currentScope = new Scope(currentScope);
            skipNextBraceScope = true;
            const varTok = tokens[i + 1];
            if (varTok && varTok.type === 'IDENTIFIER') {
                currentScope.declare(varTok.lexeme, {
                    token: varTok,
                    type: 'loop_variable',
                    readCount: 0
                });
            }
        }
        else if (tok.type === 'CATCH') {
            currentScope = new Scope(currentScope);
            skipNextBraceScope = true;
            if (tokens[i + 1] && tokens[i + 1].lexeme === '(' && tokens[i + 2] && tokens[i + 2].type === 'IDENTIFIER') {
                const catchVar = tokens[i + 2];
                currentScope.declare(catchVar.lexeme, {
                    token: catchVar,
                    type: 'catch_variable',
                    readCount: 0
                });
            }
        }
        else if (tok.lexeme === '{') {
            if (skipNextBraceScope) {
                skipNextBraceScope = false;
            } else {
                currentScope = new Scope(currentScope);
            }
        }
        else if (tok.type === 'LET') {
            const nameTok = tokens[i + 1];
            if (nameTok && nameTok.type === 'IDENTIFIER') {
                currentScope.declare(nameTok.lexeme, {
                    token: nameTok,
                    type: 'variable',
                    readCount: 0
                });
            }
        }
        else if (tok.type === 'ALLOW' || tok.type === 'IMPORT') {
            const tokDecls = decls.filter(d => d.token.line === tok.line);
            for (const d of tokDecls) {
                currentScope.declare(d.name, {
                    token: d.token,
                    type: 'import',
                    readCount: 0
                });
            }
        }
        else if (tok.type === 'PROMPT' || tok.type === 'MEMORY') {
            const next = tokens[i + 1];
            if (next && next.type === 'IDENTIFIER') {
                currentScope.declare(next.lexeme, {
                    token: next,
                    type: 'variable',
                    readCount: 0
                });
            }
        }
        else if (tok.type === 'IDENTIFIER' && tok.lexeme === 'define_tool') {
            if (tokens[i + 1] && tokens[i + 1].lexeme === '(' && tokens[i + 2]) {
                const nameTok = tokens[i + 2];
                let name = '';
                if (nameTok.type === 'STRING') {
                    name = nameTok.lexeme.replace(/['"]/g, '');
                } else if (nameTok.type === 'IDENTIFIER') {
                    name = nameTok.lexeme;
                }
                if (name) {
                    currentScope.declare(name, {
                        token: nameTok,
                        type: 'tool',
                        readCount: 0
                    });
                }
            }
        }
    }
    
    const diagnostics = [];
    const builtinsSet = new Set([
        'print', 'str', 'type', 'num', 'bool', 'from_json', 'to_json', 'len', 'read_file', 'write_file', 'write_image', 'list_dir', 'make_dir', 'exp', 'random', 'sleep', 'now', 'model', 'image', 'structured_output', 'tool_call', 'spawn', 'exec', 'time', 'range', 'push', 'pop', 'join', 'split', 'keys', 'values', 'array', 'PI', 'E', 'sin', 'cos', 'tan', 'sqrt', 'floor', 'ceil', 'abs', 'pow', 'log', 'parse', 'stringify', 'workflow', 'set_alias', 'define_tool', 'list_tools', 'error_type', 'raise_error', 'multi_req', 'web_get', 'web_send', 'listen', 'convert', 'api', 'prompt', 'debug', 'to_upper', 'to_lower', 'trim', 'slice', 'swap', 'retry', 'map', 'filter', 'reduce', 'find', 'format', 'db_open', 'args', 'input', 'contains', 'locate', 'doc', 'media', 'audio',
        'string', 'number', 'bool', 'array', 'any', 'object', 'num', 'str', 'null', 'dict', 'int', 'float'
    ]);
    
    for (const ref of refs) {
        const tok = ref.token;
        const name = ref.name;
        
        const scope = tokenScopes.get(tok);
        if (scope) {
            const decl = scope.resolve(name);
            if (decl) {
                decl.readCount++;
            } else if (builtinsSet.has(name)) {
                continue;
            } else {
                diagnostics.push({
                    type: 'error',
                    token: tok,
                    message: `Undefined symbol: "${name}". Referenced but not declared in this scope.`
                });
            }
        }
    }
    
    function checkUnused(scope) {
        if (scope !== rootScope) {
            for (const [name, decl] of scope.variables.entries()) {
                if (decl.readCount === 0 && decl.type !== 'catch_variable') {
                    diagnostics.push({
                        type: 'warning',
                        token: decl.token,
                        message: `Unused symbol: "${name}". Declared but never read.`
                    });
                }
            }
        }
        for (const child of scope.children) {
            checkUnused(child);
        }
    }
    checkUnused(rootScope);
    
    diagnostics.tokenScopes = tokenScopes;
    return diagnostics;
}

function validateImports(document, workspaceRoot) {
    const diagnostics = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        const stringRegex = /(["'])(.*?)\1/g;
        let match;
        while ((match = stringRegex.exec(lineText)) !== null) {
            const specifier = match[2];
            const start = match.index;
            const end = match.index + match[0].length;
            
            const beforeString = lineText.substring(0, start).trim();
            const afterString = lineText.substring(end).trim();
            
            const isAllow = /\ballow\s*$/i.test(beforeString) || (beforeString.includes('allow') && afterString.startsWith('in'));
            const isImport = /\bfrom\s*$/i.test(beforeString);
            
            if (isAllow || isImport) {
                const resolved = resolveSesiModule(specifier, document.uri.fsPath, workspaceRoot);
                if (!resolved) {
                    const range = new vscode.Range(
                        new vscode.Position(lineIdx, start),
                        new vscode.Position(lineIdx, end)
                    );
                    const message = `Module not found: "${specifier}". Checked relative paths, SESI_PATH, and ~/.sesi/lib.`;
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.code = 'module-not-found';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }
    return diagnostics;
}

const documentScopesCache = new Map();

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
        'input': {
            signature: 'input(prompt)',
            source: 'Console I/O Standard Library',
            description: 'Prompts the user for console input, halts execution until they press enter, and returns the entered string response.',
            example: 'let name = input("Enter your name: ")\nprint "Hello," name'
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
        },
        'allow': {
            signature: 'allow "module" in with LibName\nallow "module" in with { names }',
            source: 'Sesi Modules / Libs',
            description: 'Imports a module or specific module functions, binding it to a scoped library namespace or importing names directly.',
            example: 'allow "std/math" in with Math\nprint Math.PI'
        },
        'with': {
            signature: 'allow "module" in with LibName\nallow "module" in with { names }',
            source: 'Sesi Modules / Libs',
            description: 'Used in allow statements to designate the namespace identifier or function list to bind.',
            example: 'allow "std/math" in with Math'
        },
        'to_upper': {
            signature: 'to_upper(string)',
            source: 'String Utility Standard Library',
            description: 'Returns the uppercase representation of the input string.',
            example: 'let text = to_upper("hello")\nprint text'
        },
        'to_lower': {
            signature: 'to_lower(string)',
            source: 'String Utility Standard Library',
            description: 'Returns the lowercase representation of the input string.',
            example: 'let text = to_lower("WORLD")\nprint text'
        },
        'trim': {
            signature: 'trim(string)',
            source: 'String Utility Standard Library',
            description: 'Removes leading and trailing whitespace from the string parameter.',
            example: 'let cleaned = trim("  hello  ")\nprint cleaned'
        },
        'slice': {
            signature: 'slice(collection, start, end = null)',
            source: 'Collection Utility Standard Library',
            description: 'Extracts a slice from a string or array starting at the start index up to (but not including) the end index.',
            example: 'let part = slice("Hello World", 0, 5)\nprint part'
        },
        'swap': {
            signature: 'swap(string, target, replacement)',
            source: 'String Utility Standard Library',
            description: 'Globally searches for the target string/character within the input string and replaces all occurrences with the replacement string.',
            example: 'let res = swap("hello world", " ", "_")\nprint res'
        },
        'contains': {
            signature: 'contains(string, sub)',
            source: 'String Utility Standard Library',
            description: 'Returns `true` if the string contains the given substring, `false` otherwise. Returns `null` if either argument is not a string.',
            example: 'let found = contains("hello.sesi", ".sesi")\nprint found // true\nprint contains("hello.sesi", ".ts") // false'
        },
        'locate': {
            signature: 'locate(string, sub)',
            source: 'String Utility Standard Library',
            description: 'Returns the zero-based index of the first occurrence of a substring within a string. Returns `-1` if not found, or `null` if either argument is not a string.',
            example: 'let idx = locate("hello.sesi", ".")\nprint idx // 5\nprint locate("hello.sesi", "ts") // -1'
        },
        'map': {
            signature: 'map(array, fn)',
            source: 'Array Utility Standard Library',
            description: 'Applies a mapping function to each element of the array and returns a new array of mapped values.',
            example: 'fn double(x) { return x * 2 }\nlet doubled = map([1, 2, 3], double)'
        },
        'filter': {
            signature: 'filter(array, fn)',
            source: 'Array Utility Standard Library',
            description: 'Filters the elements of the array using a predicate function, returning a new array with all matching elements.',
            example: 'fn isEven(x) { return x % 2 == 0 }\nlet evens = filter([1, 2, 3, 4], isEven)'
        },
        'reduce': {
            signature: 'reduce(array, fn, initialValue = null)',
            source: 'Array Utility Standard Library',
            description: 'Reduces the elements of the array to a single value using an accumulator function starting with an optional initial value.',
            example: 'fn add(acc, x) { return acc + x }\nlet sum = reduce([1, 2, 3, 4], add, 0)'
        },
        'find': {
            signature: 'find(array, fn)',
            source: 'Array Utility Standard Library',
            description: 'Returns the first element in the array that satisfies the provided predicate function, or null if no element matches.',
            example: 'fn isThree(x) { return x == 3 }\nlet item = find([1, 2, 3], isThree)'
        },
        'retry': {
            signature: 'retry(fn, options)',
            source: 'Fault Tolerance Standard Library',
            description: 'Executes the given function with automatic retry and exponential backoff configuration upon encountering an exception.',
            example: 'fn dangerousAction() { ... }\nlet res = retry(dangerousAction, { "max_retries": 3 })'
        }
    };

    let workspaceRoot = '';
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    const hoverProvider = vscode.languages.registerHoverProvider('sesi', {
        provideHover(document, position, token) {
            const moduleInfo = getModuleSpecifierAtPosition(document, position);
            if (moduleInfo) {
                const resolved = resolveSesiModule(moduleInfo.specifier, document.uri.fsPath, workspaceRoot);
                const markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;
                markdown.supportHtml = true;

                if (resolved) {
                    if (resolved.type === 'builtin') {
                        markdown.appendMarkdown(`### Module: \`${moduleInfo.specifier}\` *(Built-in)*\n\n`);
                        markdown.appendMarkdown(`Sesi Standard Library built-in module.\n\n`);

                        const builtinExports = {
                            'std/math': [
                                'PI (number)', 'E (number)',
                                'sin(x)', 'cos(x)', 'tan(x)', 'sqrt(x)',
                                'floor(x)', 'ceil(x)', 'abs(x)', 'pow(x, y)',
                                'log(x)', 'exp(x)'
                            ],
                            'std/time': [
                                'now()', 'sleep(ms)', 'format(timestamp, options)'
                            ],
                            'std/json': [
                                'stringify(val)', 'parse(str)'
                            ],
                            'std/db': [
                                'db_open(filename, password)'
                            ]
                        };

                        const exportsList = builtinExports[moduleInfo.specifier];
                        if (exportsList) {
                            markdown.appendMarkdown(`**Exports:**\n`);
                            for (const item of exportsList) {
                                markdown.appendMarkdown(`* \`${item}\`\n`);
                            }
                        }
                    } else {
                        markdown.appendMarkdown(`### Module: \`${moduleInfo.specifier}\`\n\n`);
                        markdown.appendMarkdown(`*Type:* Local Sesi Module  \n`);
                        markdown.appendMarkdown(`*Path:* \`${resolved.path}\`  \n`);
                        markdown.appendMarkdown(`*Resolved in:* \`${resolved.searchDir}\`\n\n`);

                        const exportsList = getExportsFromSesiFile(resolved.path);
                        if (exportsList && exportsList.length > 0) {
                            markdown.appendMarkdown(`**Exports:**\n`);
                            for (const exp of exportsList) {
                                if (exp.type === 'function') {
                                    markdown.appendMarkdown(`* \`${exp.isAsync ? 'async fn' : 'fn'} ${exp.name}(${exp.params})\`\n`);
                                } else {
                                    markdown.appendMarkdown(`* \`let ${exp.name}\`\n`);
                                }
                            }
                        } else {
                            markdown.appendMarkdown(`*No exports found in file.*`);
                        }
                    }
                } else {
                    markdown.appendMarkdown(`### Module: \`${moduleInfo.specifier}\`\n\n`);
                    markdown.appendMarkdown(`⚠️ **Module not found**  \n`);
                    markdown.appendMarkdown(`Could not resolve this module in relative paths, \`SESI_PATH\`, or \`~/.sesi/lib\`.\n`);
                }

                return new vscode.Hover(markdown, moduleInfo.range);
            }

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

            // Check local declarations
            const cache = documentScopesCache.get(document.uri.toString());
            if (cache) {
                const { tokens, tokenScopes } = cache;
                const line = position.line;
                const char = position.character;
                const tok = tokens.find(t => t.line === line && char >= t.col && char <= t.col + t.length);
                if (tok && tok.type === 'IDENTIFIER') {
                    const scope = tokenScopes.get(tok);
                    if (scope) {
                        const decl = scope.resolve(tok.lexeme);
                        if (decl) {
                            const markdown = new vscode.MarkdownString();
                            markdown.isTrusted = true;
                            
                            let detail = '';
                            if (decl.type === 'function') {
                                detail = `fn ${tok.lexeme}`;
                            } else if (decl.type === 'parameter') {
                                detail = `(parameter) ${tok.lexeme}`;
                            } else if (decl.type === 'variable') {
                                detail = `let ${tok.lexeme}`;
                            } else if (decl.type === 'loop_variable') {
                                detail = `(loop variable) ${tok.lexeme}`;
                            } else if (decl.type === 'catch_variable') {
                                detail = `(catch variable) ${tok.lexeme}`;
                            } else if (decl.type === 'import') {
                                detail = `(import) ${tok.lexeme}`;
                            } else if (decl.type === 'tool') {
                                detail = `(tool) ${tok.lexeme}`;
                            } else {
                                detail = `${decl.type} ${tok.lexeme}`;
                            }
                            
                            markdown.appendCodeblock(detail, 'sesi');
                            return new vscode.Hover(markdown, range);
                        }
                    }
                }
            }
            return null;
        }
    });

    const definitionProvider = vscode.languages.registerDefinitionProvider('sesi', {
        provideDefinition(document, position, token) {
            const moduleInfo = getModuleSpecifierAtPosition(document, position);
            if (moduleInfo) {
                const resolved = resolveSesiModule(moduleInfo.specifier, document.uri.fsPath, workspaceRoot);
                if (resolved && resolved.type === 'local') {
                    return new vscode.Location(
                        vscode.Uri.file(resolved.path),
                        new vscode.Position(0, 0)
                    );
                }
            }

            // Check local declarations for Go to Definition
            const cache = documentScopesCache.get(document.uri.toString());
            if (cache) {
                const { tokens, tokenScopes } = cache;
                const line = position.line;
                const char = position.character;
                const tok = tokens.find(t => t.line === line && char >= t.col && char <= t.col + t.length);
                if (tok && tok.type === 'IDENTIFIER') {
                    const scope = tokenScopes.get(tok);
                    if (scope) {
                        const decl = scope.resolve(tok.lexeme);
                        if (decl && decl.token) {
                            return new vscode.Location(
                                document.uri,
                                new vscode.Range(
                                    new vscode.Position(decl.token.line, decl.token.col),
                                    new vscode.Position(decl.token.line, decl.token.col + decl.token.length)
                                )
                            );
                        }
                    }
                }
            }
            return null;
        }
    });

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('sesi');
    context.subscriptions.push(diagnosticCollection);

    let debounceTimer;
    function triggerDiagnostics(document) {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            runValidation(document);
        }, 300);
    }

    function runValidation(document) {
        const text = document.getText();
        const diagnostics = validateImports(document, workspaceRoot);

        try {
            const tokens = tokenize(text);
            const { decls, refs } = findDeclarationsAndReferences(tokens);
            const scopeDiagnostics = analyzeScope(tokens, decls, refs);
            
            documentScopesCache.set(document.uri.toString(), {
                tokens,
                tokenScopes: scopeDiagnostics.tokenScopes
            });
            
            for (const d of scopeDiagnostics) {
                const range = new vscode.Range(
                    new vscode.Position(d.token.line, d.token.col),
                    new vscode.Position(d.token.line, d.token.col + d.token.length)
                );
                
                const severity = d.type === 'error' 
                    ? vscode.DiagnosticSeverity.Error 
                    : vscode.DiagnosticSeverity.Warning;
                    
                const diag = new vscode.Diagnostic(
                    range,
                    d.message,
                    severity
                );
                diag.code = d.type === 'error' ? 'undefined-symbol' : 'unused-symbol';
                diagnostics.push(diag);
            }
        } catch (err) {
            // Ignore static scope analysis failures
        }

        const fs = require('fs');
        const localSesiPath = path.join(workspaceRoot, 'bin', 'sesi.js');
        let command;
        if (workspaceRoot && fs.existsSync(localSesiPath)) {
            command = `node "${localSesiPath}" -c -`;
        } else {
            command = `npx sesi -c -`;
        }

        const cp = require('child_process');
        const child = cp.spawn(command, [], {
            shell: true,
            cwd: workspaceRoot || process.cwd()
        });

        let stderr = '';
        let stdout = '';
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });

        child.on('close', (code) => {
            const output = stderr || stdout;
            
            // Clean up output (remove dotenvx log prefix)
            let cleanedOutput = output.replace(/◇ retrieving[\s\S]*?dotenvx@[\d.]+/g, '').trim();
            
            const lineColMatch = cleanedOutput.match(/at line (\d+), column (-?\d+)/);
            if (lineColMatch) {
                const lineNum = parseInt(lineColMatch[1], 10) - 1; // 0-indexed in VS Code
                let colNum = parseInt(lineColMatch[2], 10);
                if (colNum < 0) colNum = 0;
                
                if (lineNum >= 0 && lineNum < document.lineCount) {
                    const lineText = document.lineAt(lineNum).text;
                    const range = new vscode.Range(
                        new vscode.Position(lineNum, Math.max(0, colNum - 1)),
                        new vscode.Position(lineNum, lineText.length)
                    );
                    
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        cleanedOutput,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            } else if (code !== 0 && cleanedOutput) {
                // Fallback for general execution errors
                const range = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(0, document.lineAt(0).text.length)
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    cleanedOutput,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            
            diagnosticCollection.set(document.uri, diagnostics);
        });

        child.stdin.write(text);
        child.stdin.end();
    }

    context.subscriptions.push(hoverProvider);
    context.subscriptions.push(definitionProvider);

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === 'sesi') {
                triggerDiagnostics(document);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'sesi') {
                triggerDiagnostics(event.document);
            }
        })
    );

    // Initial check for all open documents
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'sesi') {
            triggerDiagnostics(document);
        }
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
