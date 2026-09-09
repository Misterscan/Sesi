const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SESI_MATH_CONSTANTS = ['E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'];
const SESI_MATH_FUNCTION_SIGNATURES = {
    abs: 'abs(x)', acos: 'acos(x)', acosh: 'acosh(x)', asin: 'asin(x)', asinh: 'asinh(x)',
    atan: 'atan(x)', atanh: 'atanh(x)', atan2: 'atan2(y, x)', cbrt: 'cbrt(x)', ceil: 'ceil(x)',
    clz32: 'clz32(x)', cos: 'cos(x)', cosh: 'cosh(x)', exp: 'exp(x)', expm1: 'expm1(x)',
    floor: 'floor(x)', fround: 'fround(x)', hypot: 'hypot(...values)', imul: 'imul(x, y)', log: 'log(x)',
    log1p: 'log1p(x)', log2: 'log2(x)', log10: 'log10(x)', max: 'max(...values)', min: 'min(...values)',
    pow: 'pow(x, y)', random: 'random()', round: 'round(x)', sign: 'sign(x)', sin: 'sin(x)',
    sinh: 'sinh(x)', sqrt: 'sqrt(x)', tan: 'tan(x)', tanh: 'tanh(x)', trunc: 'trunc(x)'
};
const SESI_MATH_FUNCTIONS = Object.keys(SESI_MATH_FUNCTION_SIGNATURES);

function getModuleSpecifierAtPosition(document, position) {
    if (isPositionInComment(document, position)) return null;
    const lineText = stripComments(document.getText()).split('\n')[position.line] || '';
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

function getStringLiteralAtPosition(document, position) {
    if (isPositionInComment(document, position)) return null;
    const lineText = stripComments(document.getText()).split('\n')[position.line] || '';
    const stringRegex = /(["'])(.*?)\1/g;
    let match;
    while ((match = stringRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (position.character >= start && position.character <= end) {
            const range = new vscode.Range(
                new vscode.Position(position.line, start + 1),
                new vscode.Position(position.line, end - 1)
            );
            return {
                value: match[2],
                range,
                lineText,
                start,
                end
            };
        }
    }
    return null;
}

function isLikelyFileSpecifier(specifier) {
    if (!specifier || typeof specifier !== 'string') return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(specifier)) return false;
    if (/^(data|mailto):/i.test(specifier)) return false;

    return (
        specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        specifier.startsWith('/') ||
        specifier.startsWith('~/') ||
        specifier.includes('/') ||
        /\.[a-zA-Z0-9_\-]{1,8}$/.test(specifier)
    );
}

function resolveExistingPath(specifier, documentPath, workspaceRoot) {
    if (!isLikelyFileSpecifier(specifier)) return null;

    let normalized = specifier;
    if (normalized.startsWith('~/')) {
        normalized = path.join(os.homedir(), normalized.slice(2));
    }

    const candidates = [];
    if (path.isAbsolute(normalized)) {
        candidates.push(normalized);
    } else {
        if (documentPath) candidates.push(path.resolve(path.dirname(documentPath), normalized));
        if (workspaceRoot) candidates.push(path.resolve(workspaceRoot, normalized));
        candidates.push(path.resolve(process.cwd(), normalized));
    }

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch (e) {
            // Ignore malformed candidate paths.
        }
    }

    return null;
}

function getFileSpecifierAtPosition(document, position, workspaceRoot) {
    const stringInfo = getStringLiteralAtPosition(document, position);
    if (!stringInfo) return null;

    const resolvedPath = resolveExistingPath(stringInfo.value, document.uri.fsPath, workspaceRoot);
    if (!resolvedPath) return null;

    return {
        path: resolvedPath,
        range: stringInfo.range,
        specifier: stringInfo.value
    };
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
    const hasExtension = filePath.endsWith('.sesi');
    if (!hasExtension) filePath += '.sesi';

    const searchDirs = [];

    // 1. Script's own directory
    if (documentPath) {
        searchDirs.push(path.dirname(documentPath));
    }

    // 2. Current working directory / workspace root
    if (workspaceRoot) {
        searchDirs.push(workspaceRoot);
        searchDirs.push(path.join(workspaceRoot, 'sesi_modules'));
    }
    searchDirs.push(process.cwd());
    searchDirs.push(path.join(process.cwd(), 'sesi_modules'));

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
            // 1. Try directly as file
            const resolvedFile = path.resolve(dir, filePath);
            if (fs.existsSync(resolvedFile) && !fs.statSync(resolvedFile).isDirectory()) {
                return {
                    type: 'local',
                    path: resolvedFile,
                    searchDir: dir
                };
            }

            // 2. Try resolving as a directory module
            if (!hasExtension) {
                const dirPath = path.resolve(dir, specifier);
                if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                    const indexSesi = path.join(dirPath, 'index.sesi');
                    if (fs.existsSync(indexSesi) && !fs.statSync(indexSesi).isDirectory()) {
                        return {
                            type: 'local',
                            path: indexSesi,
                            searchDir: dir
                        };
                    }
                    const mainSesi = path.join(dirPath, 'main.sesi');
                    if (fs.existsSync(mainSesi) && !fs.statSync(mainSesi).isDirectory()) {
                        return {
                            type: 'local',
                            path: mainSesi,
                            searchDir: dir
                        };
                    }
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    return null;
}

function getExportsFromSesiFile(filePath, sourceText = null) {
    const exports = [];
    try {
        const content = typeof sourceText === 'string' ? sourceText : fs.readFileSync(filePath, 'utf-8');
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

function cleanDocumentationComment(commentText) {
    const lines = commentText
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*\*\s?/, '').replace(/\s+$/, ''));

    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length === 0) return '';

    const indents = lines
        .filter(line => line.trim() !== '')
        .map(line => (line.match(/^\s*/) || [''])[0].length);
    const commonIndent = indents.length > 0 ? Math.min(...indents) : 0;
    return lines.map(line => line.slice(commonIndent)).join('\n');
}

function getModuleDocumentation(text) {
    if (typeof text !== 'string') return '';

    const source = text.replace(/^\uFEFF/, '').replace(/^\s*/, '');
    if (source.startsWith('/*')) {
        const end = source.indexOf('*/', 2);
        if (end < 0) return '';
        return cleanDocumentationComment(source.slice(2, end));
    }

    if (!source.startsWith('//')) return '';
    const commentLines = [];
    for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^\s*\/\/\/?\s?(.*)$/);
        if (!match) break;
        commentLines.push(match[1]);
    }
    return cleanDocumentationComment(commentLines.join('\n'));
}

function readSesiModuleSource(filePath) {
    const openDocuments = vscode.workspace && Array.isArray(vscode.workspace.textDocuments)
        ? vscode.workspace.textDocuments
        : [];
    const openDocument = openDocuments.find(candidate => candidate.uri.fsPath === filePath);
    if (openDocument) return openDocument.getText();

    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return null;
    }
}

function appendLocalModuleHover(markdown, specifier, resolved) {
    const sourceText = readSesiModuleSource(resolved.path);
    const documentation = getModuleDocumentation(sourceText);

    markdown.appendMarkdown(`### Module: \`${specifier}\`\n\n`);
    if (documentation) {
        markdown.appendText(documentation);
        markdown.appendMarkdown('\n\n');
    }
    markdown.appendMarkdown(`*Type:* Local Sesi Module  \n`);
    markdown.appendMarkdown(`*Path:* \`${resolved.path}\`  \n`);
    markdown.appendMarkdown(`*Resolved in:* \`${resolved.searchDir}\`\n\n`);

    const exportsList = getExportsFromSesiFile(resolved.path, sourceText);
    if (exportsList.length > 0) {
        markdown.appendMarkdown('**Exports:**\n');
        for (const exp of exportsList) {
            if (exp.type === 'function') {
                markdown.appendMarkdown(`* \`${exp.isAsync ? 'async fn' : 'fn'} ${exp.name}(${exp.params})\`\n`);
            } else {
                markdown.appendMarkdown(`* \`let ${exp.name}\`\n`);
            }
        }
    } else {
        markdown.appendMarkdown('*No exports found in file.*');
    }
}

function findExportDefinitionInText(text, exportName) {
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'EXPORT') continue;

        let cursor = i + 1;
        if (tokens[cursor] && tokens[cursor].type === 'ASYNC') cursor++;
        const declarationKeyword = tokens[cursor];
        if (!declarationKeyword || !['FN', 'MAKE', 'LET'].includes(declarationKeyword.type)) continue;

        const nameToken = tokens[cursor + 1];
        if (!nameToken || nameToken.type !== 'IDENTIFIER' || nameToken.lexeme !== exportName) continue;

        const declaration = {
            token: nameToken,
            type: declarationKeyword.type === 'LET' ? 'variable' : 'function',
            readCount: 0
        };
        return {
            token: nameToken,
            declaration,
            details: getDeclarationDetails(text, tokens, declaration)
        };
    }
    return null;
}

function findMakeMemberDefinitionInText(text, makeName, memberName) {
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i].type !== 'MAKE' || tokens[i + 1].lexeme !== makeName) continue;

        let openingBrace = i + 2;
        while (openingBrace < tokens.length && tokens[openingBrace].lexeme !== '{') openingBrace++;
        if (openingBrace >= tokens.length) return null;
        const closingBrace = findMatchingToken(tokens, openingBrace, '{', '}');
        if (closingBrace < 0) return null;

        let depth = 1;
        for (let cursor = openingBrace + 1; cursor < closingBrace; cursor++) {
            const current = tokens[cursor];
            if (current.lexeme === '{') {
                depth++;
                continue;
            }
            if (current.lexeme === '}') {
                depth--;
                continue;
            }
            if (depth !== 1 || current.type !== 'FN') continue;

            const nameToken = tokens[cursor + 1];
            if (!nameToken || nameToken.type !== 'IDENTIFIER' || nameToken.lexeme !== memberName) continue;
            const declaration = { token: nameToken, type: 'function', readCount: 0 };
            return {
                token: nameToken,
                declaration,
                details: getDeclarationDetails(text, tokens, declaration),
                makeName
            };
        }
    }
    return null;
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

function isPositionInComment(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const stripped = stripComments(text);
    return offset < text.length && text[offset] !== stripped[offset];
}

class Scope {
    constructor(parent = null, isMakeScope = false) {
        this.parent = parent;
        this.isMakeScope = isMakeScope;
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
        'show', 'prompt', 'model', 'image', 'make', 'async', 'await', 'import', 'from',
        'export', 'to', 'allow', 'as', 'with', 'convert', 'memory', 'structured_output',
        'tool_call'
    ]);

    const stripped = stripComments(text);
    const tokenRegex = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\$[a-zA-Z_][a-zA-Z0-9_]*|\b[a-zA-Z_][a-zA-Z0-9_]*\b|->|[{}[\](),;.:?=+\-*/%&|!<>]/g;
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
        } else if (lexeme.startsWith('$')) {
            type = 'ENV_LOOKUP';
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
            offset,
            line: pos.line,
            col: pos.col,
            length: lexeme.length
        });
    }
    return tokens;
}

/**
 * Find Sesi string literals whose values are executed by python() or js().
 *
 * This deliberately performs a small, conservative data-flow pass instead of
 * relying on variable names. It understands direct arguments, pipe calls,
 * simple assignments, and aliases. When a value can flow to both runtimes it
 * is left unclassified rather than applying misleading highlighting.
 */
function findEmbeddedCodeRanges(text) {
    const tokens = [];
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (char === '/' && text[i + 1] === '/') {
            i += 2;
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }
        if (char === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i = Math.min(text.length, i + 2);
            continue;
        }
        if (char === '"' || char === "'") {
            const quote = char;
            const start = i++;
            while (i < text.length) {
                if (text[i] === '\\') {
                    i += Math.min(2, text.length - i);
                    continue;
                }
                if (text[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            const end = i;
            tokens.push({ type: 'string', value: text.slice(start, end), start, end, contentStart: start + 1, contentEnd: Math.max(start + 1, end - 1) });
            continue;
        }
        if (/[A-Za-z_]/.test(char)) {
            const start = i++;
            while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) i++;
            tokens.push({ type: 'identifier', value: text.slice(start, i), start, end: i });
            continue;
        }
        tokens.push({ type: 'punctuation', value: char, start: i, end: i + 1 });
        i++;
    }

    const languagesByVariable = new Map();
    const assignments = [];
    const directRanges = [];
    const addLanguage = (name, language) => {
        if (!name) return false;
        let languages = languagesByVariable.get(name);
        if (!languages) {
            languages = new Set();
            languagesByVariable.set(name, languages);
        }
        const oldSize = languages.size;
        languages.add(language);
        return languages.size !== oldSize;
    };
    const addOperand = (token, language, direct = false) => {
        if (!token) return;
        if (token.type === 'string') directRanges.push({ token, language, direct });
        else if (token.type === 'identifier') addLanguage(token.value, language);
    };

    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.type === 'identifier' && (token.value === 'python' || token.value === 'js') && tokens[index + 1]?.value === '(') {
            addOperand(tokens[index + 2], token.value === 'python' ? 'python' : 'javascript', true);
        }
        if (token.value === '|' && tokens[index + 1]?.type === 'identifier' && (tokens[index + 1].value === 'python' || tokens[index + 1].value === 'js')) {
            addOperand(tokens[index - 1], tokens[index + 1].value === 'python' ? 'python' : 'javascript');
        }

        if (token.type !== 'identifier' || tokens[index + 1]?.value !== '=') continue;
        const previous = tokens[index - 1];
        if (previous?.value === '.') continue;
        const rhs = tokens[index + 2];
        if (rhs?.type === 'string' || rhs?.type === 'identifier') {
            assignments.push({ name: token.value, value: rhs });
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const assignment of assignments) {
            const languages = languagesByVariable.get(assignment.name);
            if (!languages) continue;
            if (assignment.value.type === 'identifier') {
                for (const language of languages) changed = addLanguage(assignment.value.value, language) || changed;
            }
        }
    }

    const ranges = [...directRanges];
    for (const assignment of assignments) {
        if (assignment.value.type !== 'string') continue;
        const languages = languagesByVariable.get(assignment.name);
        if (languages?.size === 1) ranges.push({ token: assignment.value, language: [...languages][0] });
    }

    const seen = new Set();
    return ranges
        .filter(({ token, language }) => {
            const key = `${token.contentStart}:${token.contentEnd}:${language}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((left, right) => left.token.contentStart - right.token.contentStart)
        .map(({ token, language, direct = false }) => ({
            language,
            direct,
            start: token.contentStart,
            end: token.contentEnd,
            text: text.slice(token.contentStart, token.contentEnd)
        }));
}

const EMBEDDED_TOKEN_KINDS = [
    'Comment', 'String', 'Keyword', 'Storage', 'Number', 'Regexp',
    'Operator', 'Type', 'Function', 'Variable', 'Class'
];
const EMBEDDED_SEMANTIC_TOKEN_TYPES = [
    ...EMBEDDED_TOKEN_KINDS.map(kind => `embeddedJs${kind}`),
    ...EMBEDDED_TOKEN_KINDS.map(kind => `embeddedPython${kind}`)
];

function embeddedSemanticTokenType(language, kind) {
    const normalized = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `${language === 'javascript' ? 'embeddedJs' : 'embeddedPython'}${normalized}`;
}

function tokenizeEmbeddedCode(text, language) {
    const javascriptKeywords = new Set([
        'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function',
        'get', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'set', 'static',
        'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        'true', 'false', 'null', 'undefined'
    ]);
    const pythonKeywords = new Set([
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
        'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
        'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while',
        'with', 'yield'
    ]);
    const javascriptStorageKeywords = new Set(['class', 'const', 'function', 'let', 'var']);
    const typeNames = language === 'python'
        ? new Set(['bool', 'bytes', 'dict', 'float', 'frozenset', 'int', 'list', 'object', 'set', 'str', 'tuple'])
        : new Set(['Array', 'BigInt', 'Boolean', 'Date', 'Error', 'Map', 'Number', 'Object', 'Promise', 'RegExp', 'Set', 'String', 'Symbol']);
    const keywords = language === 'python' ? pythonKeywords : javascriptKeywords;
    const tokens = [];
    let index = 0;
    let blockComment = false;
    let multilineQuote = null;

    const push = (start, end, type) => {
        if (end > start) tokens.push({ start, end, type });
    };
    const nextNonWhitespace = start => {
        let cursor = start;
        while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
        return text[cursor] || '';
    };

    while (index < text.length) {
        const char = text[index];
        if (/\s/.test(char)) {
            index++;
            continue;
        }
        if (blockComment) {
            const start = index;
            const end = text.indexOf('*/', index);
            if (end < 0) {
                push(start, text.length, 'comment');
                break;
            }
            index = end + 2;
            push(start, index, 'comment');
            blockComment = false;
            continue;
        }
        if (multilineQuote) {
            const start = index;
            const end = text.indexOf(multilineQuote, index);
            if (end < 0) {
                push(start, text.length, 'string');
                break;
            }
            index = end + multilineQuote.length;
            push(start, index, 'string');
            multilineQuote = null;
            continue;
        }
        if (language === 'javascript' && char === '/' && text[index + 1] === '*') {
            const start = index;
            index += 2;
            const end = text.indexOf('*/', index);
            if (end < 0) {
                push(start, text.length, 'comment');
                blockComment = true;
                break;
            }
            index = end + 2;
            push(start, index, 'comment');
            continue;
        }
        if ((language === 'javascript' && char === '/' && text[index + 1] === '/') || (language === 'python' && char === '#')) {
            const start = index;
            while (index < text.length && text[index] !== '\n') index++;
            push(start, index, 'comment');
            continue;
        }

        const triple = language === 'python' && (text.startsWith("'''", index) || text.startsWith('"""', index));
        const escapedSesiQuote = char === '\\' && text[index + 1] === '"';
        if (triple || char === '"' || char === "'" || char === '`' || escapedSesiQuote) {
            const start = index;
            const quote = triple ? text.slice(index, index + 3) : (escapedSesiQuote ? '\\"' : char);
            index += quote.length;
            let closed = false;
            while (index < text.length) {
                if (!escapedSesiQuote && text[index] === '\\') {
                    index += Math.min(2, text.length - index);
                    continue;
                }
                if (text.startsWith(quote, index)) {
                    index += quote.length;
                    closed = true;
                    break;
                }
                if (text[index] === '\n' && quote !== '`' && !triple) break;
                index++;
            }
            push(start, index, 'string');
            if (!closed && (quote === '`' || triple)) multilineQuote = quote;
            continue;
        }
        if (/\d/.test(char)) {
            const start = index++;
            while (index < text.length && /[\dA-Fa-f_xXobO.eE+-]/.test(text[index])) index++;
            push(start, index, 'number');
            continue;
        }
        if (/[A-Za-z_$]/.test(char)) {
            const start = index++;
            while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index++;
            const word = text.slice(start, index);
            let type = 'variable';
            if (language === 'javascript' && javascriptStorageKeywords.has(word)) type = 'storage';
            else if (keywords.has(word)) type = 'keyword';
            else if (typeNames.has(word)) type = 'type';
            else if (nextNonWhitespace(index) === '(') type = 'function';
            let previous = start - 1;
            while (previous >= 0 && /\s/.test(text[previous])) previous--;
            const prefix = text.slice(Math.max(0, previous - 12), previous + 1);
            if (/\bclass\s*$/.test(prefix)) type = 'class';
            else if (/\b(def|function)\s*$/.test(prefix)) type = 'function';
            push(start, index, type);
            continue;
        }
        const start = index++;
        while (index < text.length && /[+\-*\/%=&|!<>?:.,;()[\]{}]/.test(text[index])) index++;
        push(start, index, 'operator');
    }

    return tokens;
}

function splitEmbeddedTokenAcrossLines(text, token) {
    const parts = [];
    let start = token.start;
    while (start < token.end) {
        const newline = text.indexOf('\n', start);
        const end = newline >= 0 && newline < token.end ? newline : token.end;
        if (end > start) parts.push({ start, end, type: token.type });
        start = end + 1;
    }
    return parts;
}

function normalizeDeclarationText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function findMatchingToken(tokens, startIndex, opening, closing) {
    let depth = 0;
    for (let i = startIndex; i < tokens.length; i++) {
        if (tokens[i].lexeme === opening) depth++;
        else if (tokens[i].lexeme === closing) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function tokensToText(tokens, startIndex, endIndex) {
    if (startIndex < 0 || endIndex < startIndex || !tokens[startIndex]) return '';

    let result = '';
    for (let i = startIndex; i <= endIndex && i < tokens.length; i++) {
        const lexeme = tokens[i].lexeme;
        if (!result) {
            result = lexeme;
        } else if ([',', ')', ']', '<', '>', '?'].includes(lexeme)) {
            result += lexeme;
        } else if (lexeme === ':') {
            result += ': ';
        } else if (['(', '[', '<', ':'].includes(tokens[i - 1].lexeme)) {
            result += lexeme;
        } else if (lexeme === '.') {
            result += '.';
        } else if (tokens[i - 1].lexeme === '.') {
            result += lexeme;
        } else {
            result += ` ${lexeme}`;
        }
    }
    return result;
}

function inferSimpleType(tokens, startIndex) {
    const token = tokens[startIndex];
    if (!token) return 'any';

    if (token.type === 'STRING') return 'string';
    if (token.type === 'NUMBER') return 'number';
    if (token.type === 'TRUE' || token.type === 'FALSE') return 'bool';
    if (token.type === 'NULL') return 'null';
    if (token.lexeme === '[') return 'array<any>';
    if (token.lexeme === '{') return 'object<any>';
    if (token.type === 'PROMPT' || token.lexeme === 'input') return 'string';
    if (token.type === 'IMAGE') return 'string';

    return 'any';
}

function getLeadingDocumentation(text, declarationLine) {
    const lines = text.split(/\r?\n/);
    let line = declarationLine - 1;
    if (line < 0) return '';

    const lineCommentParts = [];
    while (line >= 0 && /^\s*\/\//.test(lines[line])) {
        lineCommentParts.unshift(lines[line].replace(/^\s*\/\/\/?\s?/, '').trim());
        line--;
    }
    if (lineCommentParts.length > 0) return lineCommentParts.join('\n');

    if (!/\*\/\s*$/.test(lines[line] || '')) return '';
    const blockParts = [];
    while (line >= 0) {
        const current = lines[line];
        blockParts.unshift(current);
        if (/\/\*/.test(current)) break;
        line--;
    }
    if (blockParts.length === 0 || !/\/\*/.test(blockParts[0])) return '';

    return blockParts
        .join('\n')
        .replace(/^\s*\/\*\*?/, '')
        .replace(/\*\/\s*$/, '')
        .split('\n')
        .map(part => part.replace(/^\s*\*\s?/, '').trimEnd())
        .join('\n')
        .trim();
}

function getDeclarationDetails(text, tokens, declaration) {
    const tokenIndex = tokens.indexOf(declaration.token);
    if (tokenIndex < 0) return null;

    const line = declaration.token.line + 1;
    const documentation = getLeadingDocumentation(text, declaration.token.line);

    if (declaration.type === 'function') {
        let keywordIndex = tokenIndex - 1;
        if (!tokens[keywordIndex] || !['FN', 'MAKE'].includes(tokens[keywordIndex].type)) return null;
        if (tokens[keywordIndex - 1] && tokens[keywordIndex - 1].type === 'ASYNC') keywordIndex--;

        let signatureEnd = tokenIndex;
        let openingParen = -1;
        for (let i = tokenIndex + 1; i < tokens.length && tokens[i].lexeme !== '{'; i++) {
            if (tokens[i].lexeme === '(') {
                openingParen = i;
                break;
            }
        }
        if (openingParen >= 0) {
            const closingParen = findMatchingToken(tokens, openingParen, '(', ')');
            signatureEnd = closingParen >= 0 ? closingParen : signatureEnd;
            let cursor = signatureEnd + 1;
            if (tokens[cursor] && tokens[cursor].lexeme === '->') {
                cursor++;
                while (cursor < tokens.length && tokens[cursor].lexeme !== '{') cursor++;
                signatureEnd = cursor - 1;
            } else if (tokens[cursor] && tokens[cursor].lexeme === '-' && tokens[cursor + 1] && tokens[cursor + 1].lexeme === '>') {
                cursor += 2;
                while (cursor < tokens.length && tokens[cursor].lexeme !== '{') cursor++;
                signatureEnd = cursor - 1;
            }
        }

        const firstToken = tokens[keywordIndex];
        const lastToken = tokens[signatureEnd];
        const signature = firstToken && lastToken
            ? normalizeDeclarationText(text.slice(firstToken.offset, lastToken.offset + lastToken.length))
            : `${declaration.type} ${declaration.token.lexeme}`;
        return { signature, documentation, line, type: declaration.type };
    }

    if (declaration.type === 'parameter') {
        let endIndex = tokenIndex;
        let nesting = 0;
        for (let i = tokenIndex + 1; i < tokens.length; i++) {
            const lexeme = tokens[i].lexeme;
            if (['(', '[', '{', '<'].includes(lexeme)) nesting++;
            else if ([')', ']', '}', '>'].includes(lexeme)) {
                if (nesting === 0 && lexeme === ')') break;
                nesting--;
            }
            if (nesting === 0 && lexeme === ',') break;
            endIndex = i;
        }
        return {
            signature: `(parameter) ${tokensToText(tokens, tokenIndex, endIndex)}`,
            documentation: '',
            line,
            type: declaration.type
        };
    }

    if (declaration.type === 'variable') {
        const keyword = tokens[tokenIndex - 1];
        let typeLabel = '';
        let cursor = tokenIndex + 1;
        if (tokens[cursor] && tokens[cursor].lexeme === ':') {
            const typeStart = cursor + 1;
            cursor = typeStart;
            while (
                cursor < tokens.length &&
                tokens[cursor].line === declaration.token.line &&
                tokens[cursor].lexeme !== '='
            ) cursor++;
            typeLabel = tokensToText(tokens, typeStart, cursor - 1);
        } else {
            while (cursor < tokens.length && tokens[cursor].line === declaration.token.line && tokens[cursor].lexeme !== '=') cursor++;
            if (tokens[cursor] && tokens[cursor].lexeme === '=') {
                typeLabel = inferSimpleType(tokens, cursor + 1);
            }
        }

        const declarationKeyword = keyword && ['LET', 'PROMPT', 'MEMORY', 'STRUCTURED_OUTPUT'].includes(keyword.type)
            ? keyword.lexeme
            : 'let';
        const signature = `${declarationKeyword} ${declaration.token.lexeme}${typeLabel ? `: ${typeLabel}` : ''}`;
        return { signature, documentation, line, type: declaration.type };
    }

    const labels = {
        loop_variable: 'loop variable',
        catch_variable: 'catch variable',
        import: 'import',
        tool: 'tool'
    };
    const label = labels[declaration.type] || declaration.type;
    return {
        signature: `(${label}) ${declaration.token.lexeme}`,
        documentation,
        line,
        type: declaration.type
    };
}

function getImportBindingInfo(tokens, declaration) {
    if (!declaration || declaration.type !== 'import' || !declaration.keywordToken) return null;

    const keywordIndex = tokens.indexOf(declaration.keywordToken);
    const bindingIndex = tokens.indexOf(declaration.token);
    if (keywordIndex < 0 || bindingIndex < 0) return null;

    let specifierToken = null;
    if (declaration.keywordToken.type === 'ALLOW') {
        specifierToken = tokens.slice(keywordIndex + 1, bindingIndex + 1).find(token => token.type === 'STRING') || null;
    } else if (declaration.keywordToken.type === 'IMPORT') {
        const fromIndex = tokens.findIndex((token, index) => index > keywordIndex && token.type === 'FROM');
        if (fromIndex >= 0) specifierToken = tokens[fromIndex + 1] || null;
    }
    if (!specifierToken || specifierToken.type !== 'STRING') return null;

    return {
        specifier: specifierToken.lexeme.slice(1, -1),
        bindingName: declaration.token.lexeme,
        namespace: declaration.keywordToken.type === 'ALLOW' && tokens[bindingIndex - 1] && tokens[bindingIndex - 1].type === 'AS'
    };
}

function getImportTargetAtToken(tokens, tokenScopes, token) {
    const tokenIndex = tokens.indexOf(token);
    if (tokenIndex < 0) return null;

    const scope = tokenScopes.get(token);
    if (!scope) return null;

    if (
        tokens[tokenIndex - 1] && tokens[tokenIndex - 1].lexeme === '.' &&
        tokens[tokenIndex - 2] && tokens[tokenIndex - 2].type === 'IDENTIFIER'
    ) {
        const namespaceToken = tokens[tokenIndex - 2];
        const declaration = scope.resolve(namespaceToken.lexeme);
        const importInfo = getImportBindingInfo(tokens, declaration);
        if (!importInfo || !importInfo.namespace) return null;
        return {
            ...importInfo,
            exportName: token.lexeme,
            declaration
        };
    }

    const declaration = scope.resolve(token.lexeme);
    const importInfo = getImportBindingInfo(tokens, declaration);
    if (!importInfo || importInfo.namespace) return null;
    return {
        ...importInfo,
        exportName: token.lexeme,
        declaration
    };
}

function getNamespaceImportAtToken(tokens, tokenScopes, token) {
    if (!token || token.type !== 'IDENTIFIER') return null;

    const scope = tokenScopes.get(token);
    if (!scope) return null;

    const declaration = scope.resolve(token.lexeme);
    const importInfo = getImportBindingInfo(tokens, declaration);
    if (!importInfo || !importInfo.namespace) return null;
    return {
        ...importInfo,
        declaration
    };
}

function getMakeMemberTargetAtToken(tokens, tokenScopes, memberToken) {
    const memberIndex = tokens.indexOf(memberToken);
    if (
        memberIndex < 2 ||
        tokens[memberIndex - 1].lexeme !== '.' ||
        tokens[memberIndex - 2].type !== 'IDENTIFIER'
    ) return null;

    const instanceToken = tokens[memberIndex - 2];
    const scope = tokenScopes.get(instanceToken) || tokenScopes.get(memberToken);
    const instanceDeclaration = scope && scope.resolve(instanceToken.lexeme);
    if (!instanceDeclaration || instanceDeclaration.type !== 'variable') return null;

    const declarationIndex = tokens.indexOf(instanceDeclaration.token);
    if (declarationIndex < 0) return null;
    let equalsIndex = declarationIndex + 1;
    while (equalsIndex < tokens.length && tokens[equalsIndex].lexeme !== '=') {
        if (tokens[equalsIndex].type === 'NEWLINE') return null;
        equalsIndex++;
    }
    if (equalsIndex >= tokens.length) return null;

    let factoryIndex = equalsIndex + 1;
    while (factoryIndex < tokens.length && ['NEWLINE', 'COMMENT'].includes(tokens[factoryIndex].type)) factoryIndex++;
    const factoryToken = tokens[factoryIndex];
    if (!factoryToken || factoryToken.type !== 'IDENTIFIER') return null;

    // Namespace construction: let value = Module.Template(...)
    if (tokens[factoryIndex + 1]?.lexeme === '.' && tokens[factoryIndex + 2]?.type === 'IDENTIFIER') {
        const namespaceDeclaration = scope.resolve(factoryToken.lexeme);
        const importInfo = getImportBindingInfo(tokens, namespaceDeclaration);
        if (!importInfo || !importInfo.namespace) return null;
        return {
            instanceName: instanceToken.lexeme,
            memberName: memberToken.lexeme,
            makeName: tokens[factoryIndex + 2].lexeme,
            specifier: importInfo.specifier,
            local: false
        };
    }

    const factoryDeclaration = scope.resolve(factoryToken.lexeme);
    const importInfo = getImportBindingInfo(tokens, factoryDeclaration);
    if (importInfo && !importInfo.namespace) {
        return {
            instanceName: instanceToken.lexeme,
            memberName: memberToken.lexeme,
            makeName: factoryToken.lexeme,
            specifier: importInfo.specifier,
            local: false
        };
    }

    if (factoryDeclaration) {
        const factoryDeclarationIndex = tokens.indexOf(factoryDeclaration.token);
        if (factoryDeclarationIndex > 0 && tokens[factoryDeclarationIndex - 1].type === 'MAKE') {
            return {
                instanceName: instanceToken.lexeme,
                memberName: memberToken.lexeme,
                makeName: factoryToken.lexeme,
                local: true
            };
        }
    }
    return null;
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
        else if (tok.type === 'FN' || tok.type === 'MAKE') {
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
            while (temp < tokens.length && tokens[temp].type !== 'WITH' && tokens[temp].type !== 'AS') {
                temp++;
            }
            let nextIdx = temp + 1;
            while (nextIdx < tokens.length && tokens[nextIdx].type === 'NEWLINE') {
                nextIdx++;
            }
            if (nextIdx < tokens.length) {
                const next = tokens[nextIdx];
                if (next.type === 'IDENTIFIER') {
                    decls.push({ name: next.lexeme, token: next, type: 'import', keywordToken: tok });
                    declaredTokenSet.add(next);
                } else if (next.lexeme === '{') {
                    let idx = nextIdx + 1;
                    while (idx < tokens.length && tokens[idx].lexeme !== '}') {
                        const subTok = tokens[idx];
                        if (subTok.type === 'IDENTIFIER') {
                            decls.push({ name: subTok.lexeme, token: subTok, type: 'import', keywordToken: tok });
                            declaredTokenSet.add(subTok);
                        }
                        idx++;
                    }
                }
            }
        }
        else if (tok.type === 'IMPORT') {
            let temp = i + 1;
            while (temp < tokens.length && tokens[temp].type === 'NEWLINE') {
                temp++;
            }
            if (temp < tokens.length && tokens[temp].lexeme === '{') {
                temp++;
                while (temp < tokens.length && tokens[temp].lexeme !== '}') {
                    const subTok = tokens[temp];
                    if (subTok.type === 'IDENTIFIER') {
                        decls.push({ name: subTok.lexeme, token: subTok, type: 'import', keywordToken: tok });
                        declaredTokenSet.add(subTok);
                    }
                    temp++;
                }
            } else if (temp < tokens.length && tokens[temp].type === 'IDENTIFIER') {
                decls.push({ name: tokens[temp].lexeme, token: tokens[temp], type: 'import', keywordToken: tok });
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

function shouldPushScope(idx, tokens) {
    // Walk backward to find the first non-newline/non-comment token
    let prevIdx = idx - 1;
    while (prevIdx >= 0 && (tokens[prevIdx].type === 'NEWLINE' || tokens[prevIdx].type === 'COMMENT')) {
        prevIdx--;
    }
    if (prevIdx < 0) return true; // Top-level block at start of file

    const prev = tokens[prevIdx];

    // 1. If preceded by WITH or IMPORT, it's allow/import list -> no scope
    if (prev.type === 'WITH' || prev.type === 'IMPORT') {
        return false;
    }

    // 2. If preceded by '=', ':', ',', '(', or other assignment/separator operators -> it's an object literal/config -> no scope
    if (prev.lexeme === '=' || prev.lexeme === ':' || prev.lexeme === ',' || prev.lexeme === '(' || prev.lexeme === '[' || prev.lexeme === '|') {
        return false;
    }

    // 3. If preceded by ')', check if it's a model call or structured_output call
    if (prev.lexeme === ')') {
        // Find matching '('
        let parenLevel = 0;
        let openParenIdx = -1;
        for (let k = prevIdx; k >= 0; k--) {
            if (tokens[k].lexeme === ')') parenLevel++;
            else if (tokens[k].lexeme === '(') {
                parenLevel--;
                if (parenLevel === 0) {
                    openParenIdx = k;
                    break;
                }
            }
        }
        if (openParenIdx > 0) {
            let funcTokIdx = openParenIdx - 1;
            while (funcTokIdx >= 0 && (tokens[funcTokIdx].type === 'NEWLINE' || tokens[funcTokIdx].type === 'COMMENT')) {
                funcTokIdx--;
            }
            if (funcTokIdx >= 0) {
                const funcTok = tokens[funcTokIdx];
                if (funcTok.type === 'IDENTIFIER' && (funcTok.lexeme === 'model' || funcTok.lexeme === 'structured_output' || funcTok.lexeme === 'image_model')) {
                    return false;
                }
            }
        }
    }

    // 4. If preceded by '}', check if it's the prompt block of a model call
    if (prev.lexeme === '}') {
        // Find matching '{'
        let braceLevel = 0;
        let openBraceIdx = -1;
        for (let k = prevIdx; k >= 0; k--) {
            if (tokens[k].lexeme === '}') braceLevel++;
            else if (tokens[k].lexeme === '{') {
                braceLevel--;
                if (braceLevel === 0) {
                    openBraceIdx = k;
                    break;
                }
            }
        }
        if (openBraceIdx > 0) {
            // Check if the block that just closed was a model config block
            // Walk backward from openBraceIdx to see if it's preceded by model(...)
            let beforeIdx = openBraceIdx - 1;
            while (beforeIdx >= 0 && (tokens[beforeIdx].type === 'NEWLINE' || tokens[beforeIdx].type === 'COMMENT')) {
                beforeIdx--;
            }
            if (beforeIdx >= 0 && tokens[beforeIdx].lexeme === ')') {
                let parenLevel = 0;
                let openParenIdx = -1;
                for (let k = beforeIdx; k >= 0; k--) {
                    if (tokens[k].lexeme === ')') parenLevel++;
                    else if (tokens[k].lexeme === '(') {
                        parenLevel--;
                        if (parenLevel === 0) {
                            openParenIdx = k;
                            break;
                        }
                    }
                }
                if (openParenIdx > 0) {
                    let funcTokIdx = openParenIdx - 1;
                    while (funcTokIdx >= 0 && (tokens[funcTokIdx].type === 'NEWLINE' || tokens[funcTokIdx].type === 'COMMENT')) {
                        funcTokIdx--;
                    }
                    if (funcTokIdx >= 0) {
                        const funcTok = tokens[funcTokIdx];
                        if (funcTok.type === 'IDENTIFIER' && (funcTok.lexeme === 'model' || funcTok.lexeme === 'image_model')) {
                            return false;
                        }
                    }
                }
            }
        }
    }

    return true;
}

function analyzeScope(tokens, decls, refs) {
    const declMap = new Map(decls.map(d => [d.token, d]));
    
    const rootScope = new Scope();
    let currentScope = rootScope;
    let skipNextBraceScope = false;
    const pushedScopeStack = [];
    
    const tokenScopes = new Map();
    
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        
        if (tok.lexeme === '}') {
            const popped = pushedScopeStack.pop();
            if (popped && currentScope.parent) {
                currentScope = currentScope.parent;
            }
        }
        
        tokenScopes.set(tok, currentScope);
        
        if (tok.type === 'FN' || tok.type === 'MAKE') {
            const isMakeMethod = tok.type === 'FN' && currentScope.isMakeScope;
            const nameTok = tokens[i + 1];
            if (nameTok && nameTok.type === 'IDENTIFIER') {
                currentScope.declare(nameTok.lexeme, {
                    token: nameTok,
                    type: 'function',
                    readCount: 0
                });
            }
            // make block scope: members are accessed via instance dot-notation,
            // never as bare identifiers, so mark to skip unused-symbol checks.
            currentScope = new Scope(currentScope, tok.type === 'MAKE');
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
                                readCount: 0,
                                suppressUnused: isMakeMethod && paramTok.lexeme === 'self'
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
                    readCount: 0,
                    suppressUnused: true
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
                pushedScopeStack.push(true);
            } else if (shouldPushScope(i, tokens)) {
                currentScope = new Scope(currentScope);
                pushedScopeStack.push(true);
            } else {
                pushedScopeStack.push(false);
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
            const tokDecls = decls.filter(d => d.keywordToken === tok);
            for (const d of tokDecls) {
                currentScope.declare(d.name, {
                    token: d.token,
                    type: 'import',
                    keywordToken: d.keywordToken,
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
        'show', 'str', 'type', 'num', 'float', 'bool', 'from_json', 'to_json', 'encrypt', 'decrypt',
  'speech', 'from_speech', 'len', 'read_file', 'write_file', 'append_file', 'write_image',
  'open', 'open_file', 'list_dir', 'make_dir', 'rename', 'archive', 'zip', 'exists', 'get_ext', 'trash', 'exp', 'trunc',
  'random', 'sleep', 'now', 'model', 'image', 'js', 'html', 'structured_output', 'tool_call',
  'spawn', 'exec', 'run', 'sesi', 'python', 'time', 'env', 'range', 'push', 'append', 'pop', 'join', 'split',
  'keys', 'values', 'array', ...SESI_MATH_CONSTANTS, ...SESI_MATH_FUNCTIONS,
  'workflow', 'set_alias', 'define_tool', 'list_tools', 'error_type', 'raise_error', 'multi_req',
  'web_get', 'web_send', 'listen', 'live', 'convert', 'api', 'prompt', 'debug', 'to_upper', 'to_lower',
  'trim', 'slice', 'swap', 'retry', 'map', 'filter', 'reduce', 'find', 'format', 'db_open', 'args', 'input',
    'contains', 'locate', 'doc', 'media', 'audio', 'launch', 'memory_search', 'memory_trim', 'memory_config',
  'lazy', 'force', 'timeout', 'profile', 'profile_start', 'profile_end', 'profile_report',
  'string', 'number', 'bool', 'array', 'object', 'num', 'str', 'null', 'float', 'any',
  'name', 'arity', 'is_function', 'is_array', 'is_object', 'is_string', 'is_number', 'is_bool', 'is_null',
  'length', 'starts_with', 'ends_with', 'index_of', 'repeat', 'includes', 'reverse', 'sort', 'unique', 'flatten',
  'play', 'beep', 'synth', 'save', 'sequence', 'mix', 'comp', 'render', 'sf2', 'chord', 'scale', 'transpose', 'duration', 'bar', 'midi',
  'create', 'drum_kit', 'program', 'pad', 'sixteen_levels', 'note_repeat', 'swaing', 'chop', 'sample', 'vintage', 'effect', 'fx', 'song',
  'render_wav', 'render_midi',
  'clear', 'circle', 'rect', 'line', 'text', 'save_svg', 'ellipse', 'polygon', 'path', 'gradient', 'style', 'raw',
  'regex', 'tokenize', 'count_tokens', 'estimate_tokens', 'estimate_cost', 'model_usage',
  'gif', 'video', 'ffmpeg',
  'matrix_dot', 'matrix_transpose', 'matrix_add', 'matrix_sub', 'matrix_mul_elements',
  'matrix_scale', 'matrix_sigmoid', 'matrix_dsigmoid', 'matrix_sum_rows', 'matrix_mse',
  'Game', 'VERSION', 'vec2', 'vec3', 'quat', 'create_scene', 'activate_scene', 'enable_physics'
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
            // Skip unused checks for make block scopes: fields and methods are
            // accessed via instance dot-notation (e.g. ada.kind, ada.greet())
            // and never appear as bare identifier references.
            if (!scope.isMakeScope) {
                for (const [name, decl] of scope.variables.entries()) {
                    if (
                        decl.readCount === 0 &&
                        !decl.suppressUnused &&
                        decl.type !== 'catch_variable' &&
                        decl.type !== 'tool' &&
                        name !== 'req' &&
                        !name.startsWith('_')
                    ) {
                        diagnostics.push({
                            type: 'warning',
                            token: decl.token,
                            message: `Unused symbol: "${name}". Declared but never read.`
                        });
                    }
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
    const text = stripComments(document.getText());
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

function getDocumentScopeAnalysis(document) {
    const key = document.uri.toString();
    const cached = documentScopesCache.get(key);
    if (cached && cached.version === document.version) return cached;

    const text = document.getText();
    const tokens = tokenize(text);
    const { decls, refs } = findDeclarationsAndReferences(tokens);
    const diagnostics = analyzeScope(tokens, decls, refs);
    const analysis = {
        version: document.version,
        tokens,
        tokenScopes: diagnostics.tokenScopes,
        diagnostics
    };
    documentScopesCache.set(key, analysis);
    return analysis;
}

function getIdentifierTokenAtPosition(tokens, position) {
    return tokens.find(token => (
        token.type === 'IDENTIFIER' &&
        token.line === position.line &&
        position.character >= token.col &&
        position.character < token.col + token.length
    ));
}

function resolveImportedSymbolAtPosition(document, position, workspaceRoot) {
    const analysis = getDocumentScopeAnalysis(document);
    const token = getIdentifierTokenAtPosition(analysis.tokens, position);
    if (!token) return null;

    const importTarget = getImportTargetAtToken(analysis.tokens, analysis.tokenScopes, token);
    if (!importTarget) return null;

    const resolvedModule = resolveSesiModule(importTarget.specifier, document.uri.fsPath, workspaceRoot);
    if (!resolvedModule) {
        return { ...importTarget, kind: 'unresolved-module' };
    }
    if (resolvedModule.type === 'builtin') {
        return { ...importTarget, kind: 'builtin', resolvedModule };
    }

    const sourceText = readSesiModuleSource(resolvedModule.path);
    if (sourceText === null) return { ...importTarget, kind: 'unreadable-module', resolvedModule };

    const exportDefinition = findExportDefinitionInText(sourceText, importTarget.exportName);
    return {
        ...importTarget,
        kind: exportDefinition ? 'local-export' : 'missing-export',
        resolvedModule,
        exportDefinition
    };
}

function resolveMakeMemberAtPosition(document, position, workspaceRoot) {
    const analysis = getDocumentScopeAnalysis(document);
    const memberToken = getIdentifierTokenAtPosition(analysis.tokens, position);
    if (!memberToken) return null;

    const target = getMakeMemberTargetAtToken(analysis.tokens, analysis.tokenScopes, memberToken);
    if (!target) return null;

    if (target.local) {
        const definition = findMakeMemberDefinitionInText(document.getText(), target.makeName, target.memberName);
        return definition ? { ...target, kind: 'local-member', definition } : null;
    }

    const resolvedModule = resolveSesiModule(target.specifier, document.uri.fsPath, workspaceRoot);
    if (!resolvedModule || resolvedModule.type !== 'local') return null;
    const sourceText = readSesiModuleSource(resolvedModule.path);
    if (sourceText === null) return null;
    const definition = findMakeMemberDefinitionInText(sourceText, target.makeName, target.memberName);
    return definition ? { ...target, kind: 'imported-member', definition, resolvedModule } : null;
}

function activate(context) {
    let workspaceRoot = '';
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    const embeddedLegend = new vscode.SemanticTokensLegend(EMBEDDED_SEMANTIC_TOKEN_TYPES, []);
    const embeddedCodeProvider = vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'sesi' },
        {
            provideDocumentSemanticTokens(document) {
                const source = document.getText();
                const builder = new vscode.SemanticTokensBuilder(embeddedLegend);
                for (const embedded of findEmbeddedCodeRanges(source)) {
                    // Direct calls are tokenized by the real VS Code TextMate grammar.
                    // Semantic tokens are retained only for code reached through Sesi variables.
                    if (embedded.direct) continue;
                    const embeddedTokens = tokenizeEmbeddedCode(embedded.text, embedded.language);
                    for (const token of embeddedTokens) {
                        for (const part of splitEmbeddedTokenAcrossLines(embedded.text, token)) {
                            const start = document.positionAt(embedded.start + part.start);
                            const end = document.positionAt(embedded.start + part.end);
                            if (start.line !== end.line || start.character === end.character) continue;
                            builder.push(
                                new vscode.Range(start, end),
                                embeddedSemanticTokenType(embedded.language, part.type),
                                []
                            );
                        }
                    }
                }
                return builder.build();
            }
        },
        embeddedLegend
    );
    context.subscriptions.push(embeddedCodeProvider);

    const docs = {
        'Game': {
            signature: 'allow "std/game" in as Game',
            source: '3D Game Standard Library (std/game)',
            description: 'Loads the optional left-handed Babylon.js/Electron 3D engine. +X is right, +Z is forward, and relative asset paths use the current working directory. Install @misterscan/sesi-game and run with sesi -l.',
            example: 'allow "std/game" in as Game\nlet game = Game.create({title: "Arena"})'
        },
        'vec3': {
            signature: 'Game.vec3(x = 0, y = 0, z = 0) -> vec3',
            source: '3D Game Standard Library (std/game)',
            description: 'Creates a live mutable three-component vector used for positions, rotations, scaling, directions, forces, and velocities.',
            example: 'let position = Game.vec3(0, 2, -5)\nposition.y = 3'
        },
        'create_scene': {
            signature: 'game.create_scene(name, options = null) -> scene',
            source: '3D Game Standard Library (std/game)',
            description: 'Creates a named left-handed Babylon scene and returns its live native handle.',
            example: 'let scene = game.create_scene("main")\nlet cube = scene.box("cube")'
        },
        'enable_physics': {
            signature: 'scene.enable_physics(options = null) -> scene',
            source: '3D Game Standard Library (std/game)',
            description: 'Enables the pinned Havok physics backend for a scene.',
            example: 'scene.enable_physics({gravity: Game.vec3(0, -9.81, 0)})'
        },
        'let': {
            signature: 'let identifier = value',
            source: 'Sesi Core Primitives',
            description: 'Declares a variable and binds it to a value. In Sesi, `let` is the single universal binding primitive (forbid using `const`).',
            example: 'let count = 10\ncount = count + 5\nshow count'
        },
        'make': {
            signature: 'make identifier { ... }',
            source: 'Sesi Core Primitives',
            description: 'Declares a callable, class-like object template. Calling its name creates a fresh object.',
            example: 'make Person {\n   let kind = "person"\n\n   fn start(self, name) {\n      self.name = name\n   }\n\n   fn greet(self) {\n      return "Hello, " + self.name\n   }\n}'
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
            example: 'let value = random()\nif value > 0.5 {\n  show "Greater than 0.5"\n} else {\n  show "Less than or equal to 0.5"\n}'
        },
        'else': {
            signature: 'else { ... }',
            source: 'Sesi Control Flow',
            description: 'Specifies a block of code to be executed if the corresponding `if` condition evaluates to `false`.',
            example: 'if status == "success" {\n  show "Done"\n} else {\n  show "Failed"\n}'
        },
        'while': {
            signature: 'while condition { ... }',
            source: 'Sesi Loops',
            description: 'Repeatedly executes a block of code as long as the specified condition remains `true`.',
            example: 'let x = 0\nwhile x < 5 {\n  show x\n  x = x + 1\n}'
        },
        'for': {
            signature: 'for element in iterable { ... }',
            source: 'Sesi Loops',
            description: 'Iterates over elements of an array, a range, or an object collection.',
            example: 'let items = ["apple", "banana", "cherry"]\nfor item in items {\n  show item\n}'
        },
        'in': {
            signature: 'element in collection',
            source: 'Sesi Operators',
            description: 'Used inside `for` loops to specify the sequence being iterated over, or as a membership test operator.',
            example: 'for i in range(5) {\n  show i\n}'
        },
        'to': {
            signature: 'start to end',
            source: 'Sesi Operators',
            description: 'Specifies a range boundary operator or transition sequence specifier in Sesi structures.',
            example: 'for i = 0 to 5 {\n  show i\n}\n '
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
            example: 'try {\n  let content = read_file("missing.txt")\n} catch (e) {\n  show "Caught filesystem error: " e\n}'
        },
        'catch': {
            signature: 'catch (error) { ... }',
            source: 'Sesi Resilience',
            description: 'Handles exceptions thrown within the preceding `try` block, binding the error metadata to the specified identifier.',
            example: 'try {\n  write_file("readonly.txt", "data")\n} catch (e) {\n  show e\n}'
        },
        'finally': {
            signature: 'finally { ... }',
            source: 'Sesi Resilience',
            description: 'Defines a block of code that will always execute after a `try` block, regardless of whether an exception was thrown.',
            example: 'try {\n  write_file("readonly.txt", "data")\n} catch (e) {\n  show e\n} finally {\n  show "Cleanup actions"\n}'
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
            example: 'for x in range(5) {\n  if x == 2 { continue }\n  show x\n}'
        },
        'import': {
            signature: 'import { item } from "module"',
            source: 'Sesi Modules',
            description: 'Loads a reusable module or configuration file into the current execution space.',
            example: 'import { add, multiply } from "math"'
        },
        'from': {
            signature: 'import { item } from "module"',
            source: 'Sesi Modules',
            description: 'Extracts specific functions or definitions from an external module file.',
            example: 'import { now } from "std/time"'
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
            example: 'let user = {name: "Charlie", role: "admin"}\nshow user.name'
        },
        'model': {
            signature: 'model("model-name") { ... }',
            source: 'Sesi AI',
            description: 'Reasoning model evaluation primitive. Calls a specified LLM configuration block to generate a reasoning response.',
            example: 'model("gemini-3.7-flash") {"Outline the systems architecture for a compiler pipeline."}'
        },
        'image': {
            signature: 'image("prompt")',
            source: 'Sesi AI',
            description: 'Generates a synthetic image using advanced text-to-image models based on the prompt parameter.',
            example: 'let graphic = image("gemini-3.1-flash-image") {ratio: "16:9", size: "1K"} {"A dark, technical isometric blueprint of a compiler lexer graph."}'
        },
        'memory': {
            signature: 'memory',
            source: 'Sesi Stateful Memory',
            description: 'Stateful conversation memory primitive that persists contextual thread arrays.',
            example: 'memory conversation { "USER: Hello, how are you?" }\nshow conversation\nconversation = conversation + "USER: I am fine, thank you."\nshow conversation'
        },
        'set_alias': {
            signature: 'set_alias(alias, model)',
            source: 'Sesi AI',
            description: 'Register a custom local name for a model string.',
            example: 'set_alias("fast", "gemini-3.5-flash-lite")\nlet answer = model("fast") {"Summarize this paragraph."}'
        },
        'workflow': {
            signature: 'workflow(steps, initialContext)',
            source: 'Sesi AI',
            description: 'Chains sequential model executions, transformations, and processing scripts into a unified pipeline.',
            example: 'let context = read_file("system_performance.txt")\nlet steps = [\n   {prompt: "Summarize the findings." },\n   {prompt: "Provide recommendations based on the analysis."},\n   {prompt: "Create a comprehensive report: " + context}\n]\nlet final = workflow(steps, "Analyze the system performance based on the following: " + context)\nshow final'
        },
        'structured_output': {
            signature: 'structured_output(schema)(expression)',
            source: 'Serialization Standard Library',
            description: 'Creates strongly typed, schema-validated structured data from the result of any Sesi expression.',
            example: 'let rawJson = "{\\"projectName\\": \\"Sesi\\", \\"version\\": \\"1.9.0\\"}"\nlet parsed = structured_output({projectName: string, version: string})(rawJson)'
        },
        'prompt': {
            signature: 'prompt { ... }',
            source: 'Sesi Compostion',
            description: 'Constructs highly dynamic and concise template prompts. Safe from literal string hardcoding and concatenations.',
            example: 'let task = "audit logs"\nprompt {"Analyze the system performance regarding: " task}'
        },
        'define_tool': {
            signature: 'define_tool("tool_name", function, description)',
            source: 'Sesi Tooling Integration',
            description: 'Declares a custom system tool schema. This makes standard Sesi functions or scripts discoverable as tool call actions for LLMs.',
            example: 'fn read_config(file: string) -> string {\n  return read_file(file)\n}\ndefine_tool("read", read_config, "Reads a configuration file from disk.")'
        },
        'list_tools': {
            signature: 'list_tools()',
            source: 'Sesi Tooling Integration',
            description: 'Returns an array of all registered system tool definitions currently available in the runtime environment.',
            example: 'let tools = list_tools()\nshow tools'
        },
        'tool_call': {
            signature: 'tool_call(tool_name, tool_params)',
            source: 'Sesi Tooling Integration',
            description: 'Invokes a predefined custom tool dynamically by its name and passes the argument payload.',
            example: 'let output = tool_call(read_config, "config.json")'
        },
        'multi_req': {
            signature: 'multi_req(functions_array)',
            source: 'Sesi Tooling Integration',
            description: 'Runs an array of zero-argument functions concurrently and returns their results in the same order.',
            example: 'fn auditIndex() { return model("gemini-3-flash-preview") {"Audit index.html"} }\nfn auditServer() { return model("gemini-3.1-flash-lite") {"Audit server.js"} }\nlet results = multi_req([auditIndex, auditServer])'
        },
        'read_file': {
            signature: 'read_file(path, mode = "text")',
            source: 'System I/O Standard Library',
            description: 'Synchronously reads a file from disk. Use mode "text" for UTF-8 text (default) or mode "base64" to read binary files (such as images) as Base64.',
            example: 'let source_code = read_file("main/playground.sesi")\nshow source_code\n\nlet image_b64 = read_file("output/banner.png", "base64")\nshow "Image size:" len(image_b64)'
        },
        'write_file': {
            signature: 'write_file(path, content)',
            source: 'System I/O Standard Library',
            description: 'Writes a string of text content to a file at the designated path. Creates the file or overwrites it if it already exists.',
            example: 'write_file("main/logs/status.txt", "Compiler execution succeeded.")'
        },
        'append_file': {
            signature: 'append_file(path, content)',
            source: 'System I/O Standard Library',
            description: 'Appends string content to the end of a file at the designated path. Creates the file if it does not already exist.',
            example: 'append_file("main/logs/status.txt", "\nCompiler step 2 complete.")'
        },
        'write_image': {
            signature: 'write_image(path, img_data)',
            source: 'System I/O Standard Library',
            description: 'Saves raw image canvas data or generated image model outputs directly to a file path as an image file (e.g. PNG).',
            example: 'let banner = image("gemini-3.1-flash-image") {ratio: "16:9", size: "1K"} {"Sleek minimal blueprint logo"}\nwrite_image("output/banner.png", banner)'
        },
        'open': {
            signature: 'open(target, options = null)',
            source: 'Desktop Integration Standard Library',
            description: 'Opens an HTTP, HTTPS, FTP, file, or mailto URL, or an existing local file, with the operating system default application. Optional `browser`, `editor`, `viewer`, `image_viewer`, and `mode` settings can select an application. Disabled in safe mode; run the script with `-l` or `--local`.',
            example: 'open("https://code-with-sesi.netlify.app")\nopen("reports/dashboard.html", {mode: "browser", browser: "Firefox"})'
        },
        'open_file': {
            signature: 'open_file(path, options = null)',
            source: 'Desktop Integration Standard Library',
            description: 'Opens an existing local file with the operating system default application or a requested browser, editor, or viewer. The path is resolved through Sesi filesystem safety checks. Disabled in safe mode; run the script with `-l`, `--local`, or `SESI_SAFE_MODE` set to false.',
            example: 'open_file("README.md", {editor: "Visual Studio Code"})\nopen_file("favicon.png", {viewer: "Preview"})'
        },
        'list_dir': {
            signature: 'list_dir(path)',
            source: 'System I/O Standard Library',
            description: 'Retrieves an array containing the names of all files and folders located inside the target directory path.',
            example: 'let files = list_dir("main")\nfor file in files {\n  show file\n}'
        },
        'get_ext': {
            signature: 'get_ext(path)',
            source: 'System I/O Standard Library',
            description: 'Returns the lowercase file extension without a leading dot. Compound archive extensions such as tar.gz are preserved.',
            example: 'show get_ext("backup.tar.gz") // tar.gz'
        },
        'exists': {
            signature: 'exists(path)',
            source: 'System I/O Standard Library',
            description: 'Returns whether a sandbox-approved filesystem path exists.',
            example: 'if exists("config.json") { show "Found config" }'
        },
        'make_dir': {
            signature: 'make_dir(path)',
            source: 'System I/O Standard Library',
            description: 'Recursively creates nested directory paths on the local system storage.',
            example: 'let cacheDir = "main/tests/cache"\nif !exists(cacheDir) { make_dir(cacheDir) }'
        },
        'rename': {
            signature: 'rename(old_path, new_path)',
            source: 'System I/O Standard Library',
            description: 'Renames or moves a file or directory on the filesystem.',
            example: 'rename("main/temp.txt", "main/final.txt")'
        },
        'archive': {
            signature: 'archive(source_path, dest_path = null)',
            source: 'System I/O Standard Library',
            description: 'Recursively copies/backs up a file or folder. If dest_path is null, automatically saves inside the hidden .archive directory in the workspace root.',
            example: 'archive("main/tests", "main/backups/tests")'
        },
        'zip': {
            signature: 'zip(source, destination = null, operation = null)',
            source: 'Archive I/O Standard Library',
            description: 'Creates, lists, or extracts ZIP and related archive formats. ZIP is native; RAR, 7z, and tar-family formats use installed archive tools.',
            example: 'zip("assets", "assets.zip")\nlet entries = zip("assets.zip")\nzip("assets.zip", "restored")'
        },
        'trash': {
            signature: 'trash(path, auto_remove = false)',
            source: 'System I/O Standard Library',
            description: 'Safely deletes a file or directory. By default, moves the item into a local .trash recycle bin directory with a unique timestamped name. If auto_remove is true, deletes permanently.',
            example: 'trash("main/temp.txt", true)'
        },
        'spawn': {
            signature: 'spawn(script_path)',
            source: 'Process Orchestration Standard Library',
            description: 'Asynchronously launches a separate, background Sesi script process concurrently.',
            example: 'let PID = spawn("main/compile_service.sesi")\n show "Spawned process ID:" PID'
        },
        'exec': {
            signature: 'exec(command_line)',
            source: 'Process Orchestration Standard Library',
            description: 'Spawns a shell environment command synchronously. Returns the full stdout response of the executed process.',
            example: 'let git_log = exec("git log -n 1 --oneline")\nshow "Latest commit: " git_log'
        },
        'run': {
            signature: 'run(command_line)',
            source: 'Process Orchestration Standard Library',
            description: 'Exact alias of exec(). Executes a shell command synchronously and returns stdout. Disabled in safe mode.',
            example: 'let branch = run("git branch --show-current")\nshow branch'
        },
        'sesi': {
            signature: 'sesi(file_path, local = false, check_only = false)',
            source: 'Process Orchestration Standard Library',
            description: 'Parses and compiles a Sesi file synchronously in the current process without launching a child process. Set local to true to enable local file access, or check_only to true to validate without executing the file.',
            example: 'sesi("examples/main/01_hello.sesi")\nsesi("examples/main/25_webpage_server.sesi", true)\nsesi("main/check.sesi", false, true)'
        },
        'python': {
            signature: 'python(code, args)',
            source: 'Process Orchestration Standard Library',
            description: 'Executes arbitrary Python code synchronously via stdin and returns its standard output. The optional second parameter `args` is serialized to JSON and stored in the environment variable `SESI_ARGS`. If `args` is an array, elements are also passed as command line arguments (via sys.argv).',
            example: 'let result = python("show(\'Hello from Python!\')")\nshow result'
        },
        'js': {
            signature: 'js(code, args)',
            source: 'Process Orchestration Standard Library',
            description: 'Executes arbitrary JavaScript code synchronously with the current Node.js runtime and returns its standard output. The optional second parameter `args` is serialized to JSON and stored in the environment variable `SESI_ARGS`. If `args` is an array, elements are also passed as command line arguments.',
            example: 'let result = js("console.log(\'Hello from JavaScript!\')")\nshow result'
        },
        'html': {
            signature: 'html(body, options)',
            source: 'HTML Document Standard Library',
            description: 'Wraps body markup in a complete HTML document string. Optional `options` may include `title`, `head`, and `lang`.',
            example: 'let page = html("<main>Hello</main>", {title: "Demo"})\nwrite_file("index.html", page)'
        },
        'web_get': {
            signature: 'web_get(url, headers = {})',
            source: 'HTTP Client Standard Library',
            description: 'Performs an HTTP GET request to the specified web address, optionally sending request headers and returning the textual response body.',
            example: 'let api_response = web_get("https://api.github.com/repos/misterscan/sesi")'
        },
        'web_send': {
            signature: 'web_send(url, payload, headers = {})',
            source: 'HTTP Client Standard Library',
            description: 'Dispatches an HTTP POST request to the target web endpoint, optionally sending request headers with the payload.',
            example: 'let status = web_send("https://hooks.slack.com/services/...", {text: "Workflow completed!"})'
        },
        'api': {
            signature: 'api(port, handler)',
            source: 'HTTP Server Standard Library',
            description: 'Starts a native WebSocket server listening on the specified port and calls the handler for each connected client message.',
            example: 'fn handleMessage(client, msg) {\n show "WS received:" msg\n client.send("Echo: " + msg)\n}\n\nlet server = api(8080, handleMessage)'
        },
        'to_json': {
            signature: 'to_json(value)',
            source: 'Serialization Standard Library',
            description: 'Converts a native Sesi value, array, or object into a standardized, valid JSON string.',
            example: 'let payload = {id: 101, status: "active"}\nlet json_str = to_json(payload)\nshow json_str'
        },
        'from_json': {
            signature: 'from_json(json_str)',
            source: 'Serialization Standard Library',
            description: 'Parses a structured JSON string and converts it directly into native, indexable Sesi objects or collections.',
            example: 'let raw = \'{"result": "success", "code": 200}\'\nlet obj = from_json(raw)\nshow obj.result'
        },
        'encrypt': {
            signature: 'encrypt(content, password) -> string',
            source: 'Cryptography Standard Library',
            description: 'Encrypts UTF-8 string content with AES-256-CBC and returns the same iv:ciphertext format used by the Sesi CLI encryption flow.',
            example: 'let secret = encrypt("private notes", "passphrase")\nshow secret'
        },
        'decrypt': {
            signature: 'decrypt(content, password) -> string',
            source: 'Cryptography Standard Library',
            description: 'Decrypts an AES-256-CBC iv:ciphertext string produced by encrypt(...) or the compatible Sesi CLI encryption format.',
            example: 'let secret = encrypt("private notes", "passphrase")\nshow decrypt(secret, "passphrase")'
        },
        'speech': {
            signature: 'speech(text, voice = null, gemini_model = null) -> bool|string',
            source: 'Local Speech Standard Library',
            description: 'Speaks text with a local system voice engine, or returns base64 audio when an optional Gemini TTS model is supplied.',
            example: 'speech("Build complete")\nspeech("Bonjour", "Thomas")'
        },
        'from_speech': {
            signature: 'from_speech(audio_path, language = null, gemini_model = null) -> string',
            source: 'Speech Recognition Standard Library',
            description: 'Transcribes an audio file with nodejs-whisper by default, or with an optional Gemini model. Requires a downloaded model (`npx nodejs-whisper download base.en`).',
            example: 'let transcript = from_speech("meeting.wav", "en")\nshow transcript'
        },
        'encode': {
            signature: 'encode(value, mode = "text")',
            source: 'Encoding Standard Library (std/base64)',
            description: 'Encodes either UTF-8 text or raw byte arrays into a Base64 string. Use mode "text" for strings and mode "bytes" for arrays of numbers (0..255).',
            example: 'allow "std/base64" in with {encode}\nshow encode("Hello")\nshow encode([0, 255, 16], "bytes")'
        },
        'decode': {
            signature: 'decode(base64_text, mode = "text")',
            source: 'Encoding Standard Library (std/base64)',
            description: 'Decodes Base64 input (standard or URL-safe). Returns UTF-8 text in mode "text" or a byte array in mode "bytes".',
            example: 'allow "std/base64" in with {decode}\nshow decode("SGVsbG8=")\nshow decode("AP8Q", "bytes")'
        },
        'time': {
            signature: 'time()',
            source: 'Utility Standard Library',
            description: 'Returns the current high-resolution system timestamp in epoch milliseconds.',
            example: 'let start = time()\n// Run process...\nlet elapsed = (time() - start) / 1000\nshow "Completed in: " elapsed " s"'
        },
        'random': {
            signature: 'random()',
            source: 'Utility Standard Library',
            description: 'Generates a pseudo-random floating-point decimal value between 0.0 (inclusive) and 1.0 (exclusive).',
            example: 'let rand_val = random()\nif rand_val < 0.2 {\n  show "Critical failure trigger"\n}'
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
            example: 'try {\n  let file = read_file("invalid.txt")\n} catch (e) {\n  show "Error category: " error_type(e)\n}'
        },
        'show': {
            signature: 'show value1 value2 ...',
            source: 'Console I/O Standard Library',
            description: 'Outputs an arbitrary list of arguments sequentially to the Sesi terminal output standard stream.',
            example: 'let user = "developer"\nshow "[LOG] Session initialized by: " user'
        },
        'input': {
            signature: 'input(prompt)',
            source: 'Console I/O Standard Library',
            description: 'Prompts the user for console input, halts execution until they press enter, and returns the entered string response.',
            example: 'let name = input("Enter your name: ")\nshow "Hello," name'
        },
        'push': {
            signature: 'push(array, value)',
            source: 'Array Standard Library',
            description: 'Adds an element to the end of an array.',
            example: 'let items = ["apple", "banana"]\npush(items, "cherry")\nshow items'
        },
        'append': {
            signature: 'append(collection, value)',
            source: 'Collection Standard Library',
            description: 'Appends a value to an array in place, or concatenates a value to the end of a string.',
            example: 'let items = ["apple"]\nappend(items, "banana")\nshow items\n\nlet title = append("Sesi", " Runtime")\nshow title'
        },
        'pop': {
            signature: 'pop(array)',
            source: 'Array Standard Library',
            description: 'Removes and returns the last element of an array.',
            example: 'let items = ["apple", "banana", "cherry"]\nlet last = pop(items)\nshow last'
        },
        'join': {
            signature: 'join(array, separator)',
            source: 'Array Standard Library',
            description: 'Join array elements into a string with separator.',
            example: 'let items = ["apple", "banana", "cherry"]\nlet joined = join(items, ", ")\nshow joined'
        },
        'split': {
            signature: 'split(string, separator)',
            source: 'Array Standard Library',
            description: 'Split a string into an array by separator.',
            example: 'split("a,b,c", ",")\nsplit("hello world", " ")'
        },
        'regex': {
            signature: 'regex(pattern, text, options = null)',
            source: 'String Utility Standard Library',
            description: 'Matches, tests, replaces, or splits text using a JavaScript-compatible regular expression.',
            example: 'let matches = regex("[A-Z]+", "ID ABC and XYZ")\nlet valid = regex("^[a-z]+$", "sesi", {"mode": "test", "flags": "i"})'
        },
        'tokenize': {
            signature: 'tokenize(string, options = null)',
            source: 'String Utility Standard Library',
            description: 'Tokenizes text into model token IDs using OpenAI-compatible tiktoken-style encoding.',
            example: 'let ids = tokenize("Hello world")\nshow len(ids)\n\nlet ids2 = tokenize("Hello world", {"model": "gpt-5.6-sol"})\nshow ids2\n\nlet words = tokenize("one two", "simple")\nshow words'
        },
        'count_tokens': {
            signature: 'count_tokens(string, options = null)',
            source: 'AI Utility Standard Library',
            description: 'Counts request tokens through the native OpenAI or Gemini provider endpoint.',
            example: 'let count = count_tokens("Hello world", "gemini-3.5-flash")'
        },
        'estimate_tokens': {
            signature: 'estimate_tokens(string, options = null)',
            source: 'AI Utility Standard Library',
            description: 'Estimates tokens locally, explicitly allowing fallback encoding for non-OpenAI models.',
            example: 'let approximate = estimate_tokens(text, "gemini-3.6-flash")'
        },
        'estimate_cost': {
            signature: 'estimate_cost(model, input, output = 0, rates = null)',
            source: 'AI Utility Standard Library',
            description: 'Estimates paid-tier text-token cost in USD from counts or text.',
            example: 'let cost = estimate_cost("gpt-5.6-terra", promptText, 500)\nshow cost["total_cost_usd"]'
        },
        'model_usage': {
            signature: 'model_usage()',
            source: 'AI Utility Standard Library',
            description: 'Returns provider-reported tokens and estimated cost for the latest model call.',
            example: 'let answer = model("gemini-3.5-flash-lite") {"Hello"}\nshow model_usage()'
        },
        'matrix_dot': {
            signature: 'matrix_dot(a, b)',
            source: 'Native Matrix Runtime',
            description: 'Multiplies two rectangular numeric matrices. The inner dimensions must match.',
            example: 'let result = matrix_dot([[1, 2]], [[3], [4]])'
        },
        'matrix_transpose': {
            signature: 'matrix_transpose(matrix)',
            source: 'Native Matrix Runtime',
            description: 'Returns a matrix with its rows and columns exchanged.',
            example: 'let result = matrix_transpose([[1, 2], [3, 4]])'
        },
        'matrix_add': {
            signature: 'matrix_add(a, b)',
            source: 'Native Matrix Runtime',
            description: 'Adds numeric matrices. A single-row second matrix is broadcast across all rows of the first.',
            example: 'let result = matrix_add([[1, 2], [3, 4]], [[10, 20]])'
        },
        'matrix_sub': {
            signature: 'matrix_sub(a, b)',
            source: 'Native Matrix Runtime',
            description: 'Subtracts two numeric matrices with identical shapes.',
            example: 'let result = matrix_sub([[3, 4]], [[1, 2]])'
        },
        'matrix_mul_elements': {
            signature: 'matrix_mul_elements(a, b)',
            source: 'Native Matrix Runtime',
            description: 'Multiplies corresponding elements of two identically shaped numeric matrices.',
            example: 'let result = matrix_mul_elements([[2, 3]], [[4, 5]])'
        },
        'matrix_scale': {
            signature: 'matrix_scale(matrix, scalar)',
            source: 'Native Matrix Runtime',
            description: 'Multiplies every matrix element by a finite numeric scalar.',
            example: 'let result = matrix_scale([[2, 4]], 0.5)'
        },
        'matrix_sigmoid': {
            signature: 'matrix_sigmoid(matrix)',
            source: 'Native Matrix Runtime',
            description: 'Applies the logistic sigmoid function to every matrix element.',
            example: 'let result = matrix_sigmoid([[0, 1]])'
        },
        'matrix_dsigmoid': {
            signature: 'matrix_dsigmoid(matrix)',
            source: 'Native Matrix Runtime',
            description: 'Calculates y * (1 - y) for each matrix element containing a sigmoid output.',
            example: 'let result = matrix_dsigmoid([[0.5, 0.75]])'
        },
        'matrix_sum_rows': {
            signature: 'matrix_sum_rows(matrix)',
            source: 'Native Matrix Runtime',
            description: 'Sums each matrix column across its rows and returns a single-row matrix.',
            example: 'let result = matrix_sum_rows([[1, 2], [3, 4]])'
        },
        'matrix_mse': {
            signature: 'matrix_mse(a, b)',
            source: 'Native Matrix Runtime',
            description: 'Returns mean squared error across two identically shaped numeric matrices.',
            example: 'let loss = matrix_mse([[1, 2]], [[1, 3]])'
        },
        'keys': {
            signature: 'keys(collection)',
            source: 'Array Standard Library',
            description: 'Get all keys of an object.',
            example: 'let obj = { name: "Alice", age: 30 }\nkeys(obj)'
        },
        'values': {
            signature: 'values(collection)',
            source: 'Array Standard Library',
            description: 'Get all values of an object.',
            example: 'let obj = { name: "Alice", age: 30 }\nvalues(obj)'
        },
        'len': {
            signature: 'len(collection)',
            source: 'Utility Standard Library',
            description: 'Returns the total number of items, keys, or elements contained within an array, object, or string.',
            example: 'let chars = len("Sesi")\nlet count = len([10, 20, 30])'
        },
        'range': {
            signature: 'range(n)',
            source: 'Utility Standard Library',
            description: 'Generates the integers from 0 up to, but not including, n.',
            example: 'let indices = range(3) // returns [0, 1, 2]'
        },
        'type': {
            signature: 'type(value)',
            source: 'Utility Standard Library',
            description: 'Queries and returns a descriptive string indicating the active type classification of the evaluated parameter.',
            example: 'show type("code") // shows "string"\nshow type(42) // shows "number"'
        },
        'str': {
            signature: 'str(value)',
            source: 'Type Conversion Standard Library',
            description: 'Converts the given parameter value into its explicit text string format representation.',
            example: 'let age_string = str(28)\nshow "User age is: " age_string'
        },
        'num': {
            signature: 'num(value)',
            source: 'Type Conversion Standard Library',
            description: 'Parses or casts the given string or boolean parameter value into its explicit numeric value form.',
            example: 'let value_num = num("1024")\nshow value_num + 1'
        },
        'float': {
            signature: 'float(value)',
            source: 'Type Conversion Standard Library',
            description: 'Parses or casts the given string, number, or boolean parameter value into a floating-point number.',
            example: 'let ratio = float("3.14159")\nshow ratio\nshow float(true)'
        },
        'floor': {
            signature: 'floor(value)',
            source: 'Global Math Function / Math Standard Library (std/math)',
            description: 'Rounds a number down to the nearest integer. The bare floor() function is globally available without an import, and Math.floor() is available through std/math.',
            example: 'show floor(3.9) // 3\nallow "std/math" in as Math\nshow Math.floor(3.9)'
        },
        'exp': {
            signature: 'exp(value)',
            source: 'Advanced Math Functions',
            description: 'Returns Eulers number $e$ (approx. `2.71828`) raised to the power of $x$.',
            example: 'exp(0)\nexp(1)\nlet sigmoid = 1.0 / (1.0 + exp(0.0 - 0.5))\nshow sigmoid'
        },
        'trunc': {
            signature: 'trunc(value, length = 0)',
            source: 'Advanced Math & String Utility',
            description: 'Truncates a value. If the value is a number, it returns the integer part. If the value is a string, it truncates the text to the specified `length`.',
            example: 'trunc(10.5) // 10\ntrunc("Hello World", 5) // "Hello"'
        },
        'args': {
            signature: 'args[number]',
            source: 'System I/O Standard Library',
            description: 'An array of strings containing the command-line arguments passed to the Sesi script.',
            example: 'show "Number of script args:" len(args)\nif len(args) > 0 {\n  show "First script argument:" args[0]\n}'
        },
        'listen': {
            signature: 'listen(port, handler_function)',
            source: 'Network Server Standard Library',
            description: 'Starts a native HTTP server on the specified port and calls the handler function for each incoming connection.',
            example: 'async fn handle(req) {\n  return {status: 200, body: "OK"}\n}\nlet server = listen(8080, handle)'
        },
        'live': {
            signature: 'live(filePath, exportName = "handle")',
            source: 'Network Server Standard Library',
            description: 'Creates a dynamic hot-reloading wrapper around a Sesi script\'s exported function. When the returned function is called, it re-reads, re-parses, and re-executes the target file, ensuring changes to the code are instantly reflected without restarting the parent process.',
            example: 'let handler = live("handler.sesi", "handleRequest")\nlet server = listen(8080, handler)'
        },
        'db_open': {
            signature: 'db_open(filename, password?)',
            source: 'Database Standard Library (std/db)',
            description: 'After importing `std/db`, opens or creates a persistent document database file. An optional password enables encrypted storage.',
            example: 'allow "std/db" in with {db_open}\nlet db = db_open("data.db")\nlet users = db.collection("users")'
        },
        'launch': {
            signature: 'launch(options?)',
            source: 'Browser Standard Library (std/browser)',
            description: 'After importing `std/browser`, launches a Playwright browser instance. Options can configure settings such as headless mode.',
            example: 'allow "std/browser" in with {launch}\nlet browser = launch({"headless": true})\nlet page = browser.newPage()\npage.goto("https://code-with-sesi.netlify.app")'
        },
        'sf2': {
            signature: 'sf2(path, options)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, creates an instrument function bound to a SoundFont (.sf2) file.',
            example: 'allow "std/audio" in as Audio\nlet piano = Audio.sf2("GeneralUser-GS.sf2", {instrument: 0, gain: 1.5})\nlet note = piano("C4", 500)'
        },
        'mix': {
            signature: 'mix(path, tracks_array, type, options)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, saves a stereo WAV file by mixing multiple tracks together.',
            example: 'allow "std/audio" in as Audio\nAudio.mix("song.wav", [bass_track, piano_track], "sine", {saturate: 1.5})'
        },
        'synth': {
            signature: 'synth(freq_or_note, duration_ms, type, options)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, returns a base64-encoded WAV string of a generated tone.',
            example: 'allow "std/audio" in as Audio\nlet kick_b64 = Audio.synth(60, 500, "kick")'
        },
        'chord': {
            signature: 'chord(root_note, type)',
            source: 'Theory Standard Library (std/theory)',
            description: 'After importing `std/theory`, generates an array of notes for a given chord type.',
            example: 'allow "std/theory" in as Music\nlet c_maj7 = Music.chord("C4", "M7") // ["C4", "E4", "G4", "B4"]'
        },
        'scale': {
            signature: 'scale(root_note, type)',
            source: 'Theory Standard Library (std/theory)',
            description: 'After importing `std/theory`, generates an array of notes for a given scale or mode.',
            example: 'allow "std/theory" in as Music\nlet a_minor = Music.scale("A3", "minor")'
        },
        'transpose': {
            signature: 'transpose(note_or_array, semitones)',
            source: 'Theory Standard Library (std/theory)',
            description: 'After importing `std/theory`, shifts a note or an array of notes by the specified number of semitones.',
            example: 'allow "std/theory" in as Music\nlet shifted = Music.transpose(["C4", "E4"], 7) // ["G4", "B4"]'
        },
        'duration': {
            signature: 'duration(minutes, seconds)',
            source: 'Theory Standard Library (std/theory)',
            description: 'After importing `std/theory`, converts minutes and seconds into milliseconds.',
            example: 'allow "std/theory" in as Music\nlet ms = Music.duration(1, 30) // 90000 ms'
        },
        'bar': {
            signature: 'bar(bars, bpm, beatsPerBar?)',
            source: 'Theory Standard Library (std/theory)',
            description: 'After importing `std/theory`, converts musical bars into milliseconds based on BPM and time signature.',
            example: 'allow "std/theory" in as Music\nlet ms = Music.bar(8, 120) // 16000 ms'
        },
        'sequence': {
            signature: 'sequence(path, notes_array, type, options?)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, saves a multi-note sequence to a WAV file.',
            example: 'allow "std/audio" in as Audio\nAudio.sequence("melody.wav", [{note: "C4", ms: 500}], "saw")'
        },
        'midi': {
            signature: 'midi(path, tracks)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, saves one or more tracks directly to a MIDI file.',
            example: 'allow "std/audio" in as Audio\nAudio.midi("song.mid", melody_track)'
        },
        'play': {
            signature: 'play(note, duration_ms, options?)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, plays a musical note through the system audio device.',
            example: 'allow "std/audio" in as Audio\nAudio.play("E4", 500, {attack: 50, release: 200})'
        },
        'beep': {
            signature: 'beep(freq, duration_ms)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, plays a basic sine-wave beep at the specified frequency in Hz.',
            example: 'allow "std/audio" in as Audio\nAudio.beep(440, 200)'
        },
        'save': {
            signature: 'save(path, freq_or_note, duration_ms, type, options?)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, generates a single tone and saves it to a WAV file.',
            example: 'allow "std/audio" in as Audio\nAudio.save("kick.wav", 60, 500, "kick")'
        },
        'comp': {
            signature: 'comp(sf2_path, notes_array, options?)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, batch-renders a sequence of notes using a SoundFont.',
            example: 'allow "std/audio" in as Audio\nlet rendered_track = Audio.comp("font.sf2", melody_track)'
        },
        'render': {
            signature: 'render(sf2_path, tracks_array, output_path, options?)',
            source: 'Audio Standard Library (std/audio)',
            description: 'After importing `std/audio`, batch-renders a complete multi-track arrangement through a SoundFont to a WAV file.',
            example: 'allow "std/audio" in as Audio\nAudio.render("font.sf2", [track1, track2], "master.wav")'
        },
        'sixteen_levels': {
            signature: 'sixteen_levels(pad, mode?, options?)',
            source: 'Akai MPC Standard Library (std/mpc)',
            description: 'Official Akai MPC 16 Levels mode. Spreads a pad sound across 16 pads by velocity, tune, filter, decay, or attack.',
            example: 'allow "std/mpc" in as MPC\nlet bass_16 = MPC.sixteen_levels(pad1, "tune")'
        },
        'note_repeat': {
            signature: 'note_repeat(pad, rate?, bars?, options?)',
            source: 'Akai MPC Standard Library (std/mpc)',
            description: 'Official Akai MPC Note Repeat function. Generates rhythmic repeats with swing and velocity ramps.',
            example: 'allow "std/mpc" in as MPC\nlet rolls = MPC.note_repeat(3, "1/32", 1, {ramp: "crescendo"})'
        },
        'drum_kit': {
            signature: 'drum_kit(nameOrPreset?)',
            source: 'Akai MPC Standard Library (std/mpc)',
            description: 'Creates a 16-pad Akai MPC drum program with tuning, levels, panning, envelopes, and choke groups.',
            example: 'allow "std/mpc" in as MPC\nlet kit = MPC.drum_kit("boom_bap")'
        },
        'render_wav': {
            signature: 'render_wav(target, path, options?)',
            source: 'Akai MPC Standard Library (std/mpc)',
            description: 'Renders an MPC sequence, song, or sample directly to a 16-bit 44.1kHz stereo WAV file.',
            example: 'allow "std/mpc" in as MPC\nseq.render_wav("beat.wav")'
        },
        'render_midi': {
            signature: 'render_midi(target, path)',
            source: 'Akai MPC Standard Library (std/mpc)',
            description: 'Exports an MPC sequence to a multi-track Standard MIDI File preserving Roger Linn swing timing.',
            example: 'allow "std/mpc" in as MPC\nseq.render_midi("beat.mid")'
        },
        'clear': {
            signature: 'clear()',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Clears the current SVG drawing buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.clear()'
        },
        'circle': {
            signature: 'circle(x, y, radius, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a circle on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.circle(250, 250, 100, "red")'
        },
        'rect': {
            signature: 'rect(x, y, width, height, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a rectangle on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.rect(0, 0, 500, 500, "#1a1a1a")'
        },
        'pixel': {
            signature: 'pixel(x, y, color)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Sets one color value in the raster pixel buffer at (x, y).',
            example: 'allow "std/draw" in as Draw\nDraw.pixel(4, 4, "#ff00aa")'
        },
        'pixel_rect': {
            signature: 'pixel_rect(x, y, w, h, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster rectangle in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_rect(0, 0, 16, 16, "#ff00aa")'
        },
        'pixel_circle': {
            signature: 'pixel_circle(cx, cy, r, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster circle in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_circle(10, 10, 5, "#00ffaa")'
        },
        'pixel_line': {
            signature: 'pixel_line(x1, y1, x2, y2, color)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster line in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_line(0, 0, 20, 20, "#ffffff")'
        },
        'pixel_ellipse': {
            signature: 'pixel_ellipse(cx, cy, rx, ry, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster ellipse in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_ellipse(15, 15, 8, 4, "#ffff00")'
        },
        'pixel_polygon': {
            signature: 'pixel_polygon(points, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster polygon in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_polygon([[0,0],[10,0],[5,10]], "#ff00ff")'
        },
        'pixel_triangle': {
            signature: 'pixel_triangle(x1, y1, x2, y2, x3, y3, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster triangle in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_triangle(2, 14, 8, 2, 14, 14, "#ff4d6d")'
        },
        'pixel_star': {
            signature: 'pixel_star(cx, cy, spikes, outerRadius, innerRadius, color, filled = true)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster star with configurable spike and radius counts in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_star(16, 16, 5, 14, 6, "#ffd166")'
        },
        'pixel_ring': {
            signature: 'pixel_ring(cx, cy, radius, thickness, color)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster ring with the requested thickness in the pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_ring(16, 16, 12, 3, "#118ab2")'
        },
        'pixel_arc': {
            signature: 'pixel_arc(cx, cy, radius, startAngle, endAngle, color)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster circular arc between two angles measured in degrees.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_arc(16, 16, 12, 0, 180, "#7209b7")'
        },
        'pixel_bezier': {
            signature: 'pixel_bezier(x1, y1, cx, cy, x2, y2, color)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a raster quadratic Bezier curve through one control point.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_bezier(2, 28, 16, 2, 30, 28, "#4cc9f0")'
        },
        'pixel_text': {
            signature: 'pixel_text(x, y, text, color, scale = 1)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Rasterizes text into the pixel buffer with the built-in 5x7 bitmap font.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_text(2, 2, "PIXEL ART", "#f72585", 2)'
        },
        'pixel_grid': {
            signature: 'pixel_grid(grid, palette, scale = 1, x = 0, y = 0)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a palette-indexed grid into the raster pixel buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.pixel_grid(["01", "10"], {"0": "black", "1": "white"}, 16)'
        },
        'line': {
            signature: 'line(x1, y1, x2, y2, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a line on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.line(0, 400, 500, 400, "white")'
        },
        'text': {
            signature: 'text(x, y, text_string, font_size, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws text on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.text(20, 480, "Generated by Sesi", 14, "gray")'
        },
        'save_svg': {
            signature: 'save_svg(path, width, height)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Saves the current drawing buffer to an SVG file on disk.',
            example: 'allow "std/draw" in as Draw\nDraw.save_svg("art.svg", 500, 500)'
        },
        'save_png': {
            signature: 'save_png(path, width, height, background = "transparent")',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Encodes the raster pixel buffer and saves it as a PNG file.',
            example: 'allow "std/draw" in as Draw\nDraw.save_png("pixels.png", 64, 64)'
        },
        'ellipse': {
            signature: 'ellipse(cx, cy, rx, ry, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws an ellipse on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.ellipse(250, 250, 100, 50, "cyan")'
        },
        'polygon': {
            signature: 'polygon(points, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws a polygon on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.polygon("100,10 250,190 10,190", "magenta")'
        },
        'path': {
            signature: 'path(d, color, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Draws an SVG path on the SVG canvas.',
            example: 'allow "std/draw" in as Draw\nDraw.path("M 10 10 L 90 90", "white")'
        },
        'gradient': {
            signature: 'gradient(type, id, stops, options = {})',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Defines a linear or radial gradient in the SVG defs.',
            example: 'allow "std/draw" in as Draw\nDraw.gradient("linear", "sky", [{offset: "0%", color: "blue"}, {offset: "100%", color: "black"}])'
        },
        'style': {
            signature: 'style(cssText)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Defines a stylesheet block in the SVG defs for CSS styling or animations.',
            example: 'allow "std/draw" in as Draw\nDraw.style(".spin { animation: spin 2s infinite; }")'
        },
        'raw': {
            signature: 'raw(svgCode)',
            source: 'Drawing Standard Library (std/draw)',
            description: 'Injects raw SVG markup directly into the drawing buffer.',
            example: 'allow "std/draw" in as Draw\nDraw.raw("<g>...</g>")'
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
            example: 'async fn fetchLogs() {\n  return db.collection("logs").find()\n}\nlet logs = await fetchLogs()'
        },
        'convert': {
            signature: 'convert(doc_or_media_or_audio) { output_type: ext } { expression }',
            source: 'Media Conversion Standard Library',
            description: 'Native media conversion primitive. Transforms images, videos, audio, or documents to the specified format.',
            example: 'let output = convert(media) { output_type: "jpg" } { "logo.png" }'
        },
        'gif': {
            signature: 'gif(input, output, options = null)',
            source: 'FFmpeg Media Standard Library',
            description: 'Creates an animated GIF from a video file or an array of image-frame paths.',
            example: 'let output = gif(\n   ["frame1.png", "frame2.png"],\n   "preview.gif",\n    {fps: 12, width: 640}\n)'
        },
        'video': {
            signature: 'video(model) { config } { prompt } | video(input, output, options = null)',
            source: 'AI Generation / FFmpeg Media Standard Library',
            description: 'Generates video with Gemini Omni Flash or Veo, or creates/transcodes local media with FFmpeg.',
            example: 'let localVid = video(frames, "build/preview.mp4", {\n  fps: 30,\n  width: 1280,\n  height: 720,\n  codec: "libx264",\n  crf: 23,\n  audio: "music.wav"\n})\nlet aiVid = video("veo-3.1-generate-preview") {duration: 8, ratio: "16:9"} {"A cinematic ocean shot"}'
        },
        'ffmpeg': {
            signature: 'ffmpeg(args, options = null)',
            source: 'FFmpeg Media Standard Library',
            description: 'Runs FFmpeg with a structured argument array and returns its exit status and captured output.',
            example: 'let info = ffmpeg(["-version"], {throw_on_error: false})'
        },
        'format': {
            signature: 'format(timestamp, options = {})',
            source: 'Time Standard Library (std/time)',
            description: 'After importing `std/time`, converts a Unix timestamp into a readable localized string.',
            example: 'allow "std/time" in as Time\nlet formatted = Time.format(Time.now(), {timeZone: "UTC", dateStyle: "medium", timeStyle: "short"})'
        },
        'debug': {
            signature: 'debug(message)',
            source: 'Debug Standard Library',
            description: 'Pause execution and launch an interactive debugger REPL in your shell terminal.',
            example: 'let x = 10\nlet y = 20\ndebug()\nlet z = x + y\nshow z'
        },
        'allow': {
            signature: 'allow "module" in as LibName\nallow "module" in with { names }',
            source: 'Sesi Modules / Libs',
            description: 'Imports a module or specific module functions, binding it to a scoped library namespace or importing names directly.',
            example: 'allow "std/math" in as Math\nshow Math.PI'
        },
        'with': {
            signature: 'allow "module" in as LibName\nallow "module" in with { names }',
            source: 'Sesi Modules / Libs',
            description: 'Used in allow statements to designate the namespace identifier or function list to bind.',
            example: 'allow "std/math" in with { max, min }'
        },
        'to_upper': {
            signature: 'to_upper(string)',
            source: 'String Utility Standard Library',
            description: 'Returns the uppercase representation of the input string.',
            example: 'let text = to_upper("hello")\nshow text'
        },
        'to_lower': {
            signature: 'to_lower(string)',
            source: 'String Utility Standard Library',
            description: 'Returns the lowercase representation of the input string.',
            example: 'let text = to_lower("WORLD")\nshow text'
        },
        'trim': {
            signature: 'trim(string)',
            source: 'String Utility Standard Library',
            description: 'Removes leading and trailing whitespace from the string parameter.',
            example: 'let cleaned = trim("  hello  ")\nshow cleaned'
        },
        'slice': {
            signature: 'slice(collection, start, end = null)',
            source: 'Collection Utility Standard Library',
            description: 'Extracts a slice from a string or array starting at the start index up to (but not including) the end index.',
            example: 'let part = slice("Hello World", 0, 5)\nshow part'
        },
        'swap': {
            signature: 'swap(string, target, replacement)',
            source: 'String Utility Standard Library',
            description: 'Globally searches for the target string/character within the input string and replaces all occurrences with the replacement string.',
            example: 'let res = swap("hello world", " ", "_")\nshow res'
        },
        'contains': {
            signature: 'contains(string, sub)',
            source: 'String Utility Standard Library',
            description: 'Returns `true` if the string contains the given substring, `false` otherwise. Returns `null` if either argument is not a string.',
            example: 'let found = contains("hello.sesi", ".sesi")\nshow found // true\nshow contains("hello.sesi", ".ts") // false'
        },
        'locate': {
            signature: 'locate(string, sub)',
            source: 'String Utility Standard Library',
            description: 'Returns the zero-based index of the first occurrence of a substring within a string. Returns `-1` if not found, or `null` if either argument is not a string.',
            example: 'let idx = locate("hello.sesi", ".")\nshow idx // 5\nshow locate("hello.sesi", "ts") // -1'
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
            example: 'fn dangerousAction() { ... }\nlet res = retry(dangerousAction, { max_retries: 3 })'
        },
        'lazy': {
            signature: 'lazy(fn, ...args)',
            source: 'Runtime Control Standard Library',
            description: 'Creates a memoized delayed computation. The function is not executed until the lazy value is passed to `force(...)`, and the result is cached after the first force.',
            example: 'fn expensive() { return 42 }\nlet delayed = lazy(expensive)\nshow force(delayed)'
        },
        'force': {
            signature: 'force(value)',
            source: 'Runtime Control Standard Library',
            description: 'Resolves a lazy value or promise. Non-lazy values are returned unchanged.',
            example: 'let delayed = lazy(expensive)\nlet value = force(delayed)'
        },
        'timeout': {
            signature: 'timeout(fn, ms, fallback = unset)',
            source: 'Fault Tolerance Standard Library',
            description: 'Runs a function with a millisecond deadline. If it times out, returns the optional fallback value or throws a TimeoutError when no fallback is provided.',
            example: 'fn slow() { sleep(1000); return "done" }\nlet value = timeout(slow, 100, "too slow")'
        },
        'profile': {
            signature: 'profile(name, fn)',
            source: 'Profiler Standard Library',
            description: 'Measures a function call under the given profile name and returns the wrapped function result unchanged.',
            example: 'fn work() { return 42 }\nlet result = profile("work", work)'
        },
        'profile_start': {
            signature: 'profile_start(name)',
            source: 'Profiler Standard Library',
            description: 'Starts a named manual profiling section and returns the normalized section name.',
            example: 'profile_start("load")\nlet data = read_file("input.txt")\nprofile_end("load")'
        },
        'profile_end': {
            signature: 'profile_end(name)',
            source: 'Profiler Standard Library',
            description: 'Ends a named manual profiling section and returns the latest measurement summary object.',
            example: 'profile_start("work")\nrun_work()\nlet measurement = profile_end("work")'
        },
        'profile_report': {
            signature: 'profile_report(format = "object")',
            source: 'Profiler Standard Library',
            description: 'Returns recorded profiler measurements sorted by total runtime. Pass "text" for a printable table.',
            example: 'show profile_report("text")'
        },
        'name': {
            signature: 'name(func)',
            source: 'Function Introspection',
            description: 'Returns the name of a given function.',
            example: 'show name(read_file)'
        },
        'arity': {
            signature: 'arity(func)',
            source: 'Function Introspection',
            description: 'Returns the number of parameters a function expects.',
            example: 'show arity(web_get)'
        },
        'is_function': {
            signature: 'is_function(value)',
            source: 'Function Introspection',
            description: 'Checks whether a value is a function.',
            example: 'show is_function(list_dir)'
        },
        'is_array': {
            signature: 'is_array(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is an array.',
            example: 'show is_array([1, 2])'
        },
        'is_object': {
            signature: 'is_object(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is an object.',
            example: 'show is_object({a: 1})'
        },
        'is_string': {
            signature: 'is_string(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is a string.',
            example: 'show is_string("hello")'
        },
        'is_number': {
            signature: 'is_number(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is a number.',
            example: 'show is_number(42)'
        },
        'is_bool': {
            signature: 'is_bool(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is a boolean.',
            example: 'show is_bool(true)'
        },
        'is_null': {
            signature: 'is_null(value)',
            source: 'Collection Checks',
            description: 'Checks whether a value is null.',
            example: 'show is_null(null)'
        },
        'length': {
            signature: 'length(collection)',
            source: 'String Functions',
            description: 'Alias for len(). Returns the number of characters, elements, or object keys.',
            example: 'show length("hello")'
        },
        'starts_with': {
            signature: 'starts_with(string, prefix)',
            source: 'String Functions',
            description: 'Checks if a string starts with the given prefix.',
            example: 'show starts_with("hello", "he")'
        },
        'ends_with': {
            signature: 'ends_with(string, suffix)',
            source: 'String Functions',
            description: 'Checks if a string ends with the given suffix.',
            example: 'show ends_with("hello", "lo")'
        },
        'index_of': {
            signature: 'index_of(collection, value)',
            source: 'String & Array Functions',
            description: 'Returns the first index at which a given value can be found in the collection (string or array), or -1 if it is not present.',
            example: 'show index_of("hello", "l")'
        },
        'repeat': {
            signature: 'repeat(string, count)',
            source: 'String Functions',
            description: 'Constructs and returns a new string which contains the specified number of copies of the string concatenated together.',
            example: 'show repeat("a", 3)'
        },
        'includes': {
            signature: 'includes(collection, value)',
            source: 'String & Array Functions',
            description: 'Checks if a collection (array or string) includes a certain value.',
            example: 'show includes([1, 2, 3], 2)'
        },
        'reverse': {
            signature: 'reverse(array)',
            source: 'Array Functions',
            description: 'Returns a reversed copy of the array without modifying the original.',
            example: 'show reverse([1, 2, 3])'
        },
        'sort': {
            signature: 'sort(array, compareFn?)',
            source: 'Array Functions',
            description: 'Sorts the elements of an array and returns it. Optionally takes a comparison function.',
            example: 'show sort(["c", "a", "b"])'
        },
        'unique': {
            signature: 'unique(array)',
            source: 'Array Functions',
            description: 'Returns a new array with all duplicate elements removed.',
            example: 'show unique([1, 1, 2, 3, 3])'
        },
        'flatten': {
            signature: 'flatten(array)',
            source: 'Array Functions',
            description: 'Returns a new array with nested elements concatenated by one level.',
            example: 'show flatten([[1, 2], [3, 4]])'
        },
        'env': {
            signature: 'env(key = null, defaultValue = null)',
            source: 'System Functions Standard Library',
            description: 'Retrieve the value of an environment variable, or retrieve all environment variables as an object.',
            example: 'let apiKey = env("GEMINI_API_KEY")\nlet port = env("PORT", "8080")\nlet allEnvs = env()'
        },
        'create_app': {
            signature: 'create_app(config = null)',
            source: 'API Framework Standard Library (std/api)',
            description: 'Creates an API application instance. `config` options include `title`, `version`, `description`, and `base_path`.',
            example: 'allow "std/api" in with API\nlet app = API.create_app({\n  "title": "Users API",\n  "version": "1.0.0",\n  "description": "A user management API"\n})'
        }
    };

    const hoverProviderDocsBoundary = null;
    // The boundary above keeps Sesi Studio's syntax-documentation extractor
    // anchored before the generated math documentation below.

    for (const constant of SESI_MATH_CONSTANTS) {
        if (!docs[constant]) {
            docs[constant] = {
                signature: constant,
                source: 'Math Standard Library (std/math)',
                description: `Numeric constant exported by std/math as Math.${constant}.`,
                example: `allow "std/math" in as Math\nshow Math.${constant}`
            };
        }
    }
    for (const [name, signature] of Object.entries(SESI_MATH_FUNCTION_SIGNATURES)) {
        if (!docs[name]) {
            const exampleArgs = name === 'random'
                ? ''
                : ['atan2', 'imul', 'pow'].includes(name)
                    ? '1, 2'
                    : ['hypot', 'max', 'min'].includes(name)
                        ? '3, 4'
                        : '1';
            docs[name] = {
                signature,
                source: 'Math Standard Library (std/math)',
                description: `JavaScript-compatible numeric function exported by std/math as Math.${name}.`,
                example: `allow "std/math" in as Math\nshow Math.${name}(${exampleArgs})`
            };
        }
    }

    const hoverProvider = vscode.languages.registerHoverProvider('sesi', {
        provideHover(document, position, token) {
            if (isPositionInComment(document, position)) return null;
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
                                ...SESI_MATH_CONSTANTS.map(name => `${name} (number)`),
                                ...Object.values(SESI_MATH_FUNCTION_SIGNATURES)
                            ],
                            'std/time': [
                                'now()', 'sleep(ms)', 'format(timestamp, options)'
                            ],
                            'std/game': [
                                'VERSION', 'create(config?)', 'vec2(x, y)', 'vec3(x, y, z)', 'quat(x, y, z, w)', 'color(r, g, b, a)',
                                'game.assets.add(name, type, source, options?)', 'game.create_scene(name, options?)',
                                'game.scene(name)', 'game.activate_scene(name)', 'game.on_start(fn)', 'game.on_update(fn)',
                                'game.on_fixed_update(fn)', 'game.on_stop(fn)', 'game.run(options?)', 'game.build(path, options?)',
                                'scene.box/sphere/plane/ground/cylinder(name, options?)', 'scene.load_model(name, asset, options?)',
                                'scene.free_camera/orbit_camera/follow_camera(name, options?)',
                                'scene.hemispheric_light/directional_light/point_light/spot_light(name, options?)',
                                'scene.standard_material/pbr_material(name, options?)', 'scene.enable_physics(options?)',
                                'scene.add_body(mesh, options)', 'scene.raycast(origin, direction, distance?)'
                            ],
                            'std/base64': [
                                'encode(value, mode?)', 'decode(base64_text, mode?)'
                            ],
                            'std/db': [
                                'db_open(filename, password)', '.collection(name)', '.find(query)', '.insert(doc)', '.update(query, update)', '.delete(query)'
                            ],
                            'std/browser': [
                                'launch(options)',
                                '.newPage()', '.goto(url)', '.page.title()', '.click(selector)', '.inner_text(selector)',
                                '.attribute(selector, attr)', '.evaluate(jsCode)', '.screenshot(path, options)',
                                '.pdf(path, options)', '.close()'
                            ],
                            'std/audio': [
                                'sf2(path, options)', 'mix(path, tracks, type, options)', 
                                'sequence(path, notes, type, options)', 'play(note, ms, options)', 
                                'synth(freq, ms, type, options)', 'save(path, freq, ms, type, options)',
                                'beep(freq, ms)', 'midi(path, tracks)'
                            ],
                            'std/theory': [
                                'chord(root, type)', 'scale(root, type)', 'transpose(notes, steps)', 'duration(min, sec)', 'bar(bars, bpm, beatsPerBar?)'
                            ],
                            'std/draw': [
                                'clear()', 'circle(x, y, r, fill, options?)', 'rect(x, y, w, h, fill, options?)',
                                'pixel(x, y, color)', 'pixel_grid(grid, palette, scale?, x?, y?)',
                                'pixel_rect(x, y, w, h, color, filled?)', 'pixel_circle(cx, cy, r, color, filled?)',
                                'pixel_line(x1, y1, x2, y2, color)', 'pixel_ellipse(cx, cy, rx, ry, color, filled?)',
                                'pixel_polygon(points, color, filled?)', 'pixel_triangle(x1, y1, x2, y2, x3, y3, color, filled?)',
                                'pixel_star(cx, cy, spikes, outerRadius, innerRadius, color, filled?)',
                                'pixel_ring(cx, cy, radius, thickness, color)', 'pixel_arc(cx, cy, radius, startAngle, endAngle, color)',
                                'pixel_bezier(x1, y1, cx, cy, x2, y2, color)', 'pixel_text(x, y, text, color, scale?)',
                                'line(x1, y1, x2, y2, color, options?)', 'text(x, y, text, size, color, options?)',
                                'ellipse(cx, cy, rx, ry, fill, options?)', 'polygon(points, fill, options?)',
                                'path(d, fill, options?)', 'gradient(type, id, stops, options?)',
                                'style(cssText)', 'raw(svgCode)',
                                'render(w, h)', 'save_svg(path, w, h)', 'save_png(path, w, h, background?)'
                            ],
                            'std/terminal': [
                                'clear(mode?)', 'color(text, color)', 'style(text, styles)', 'background(text, color)',
                                'rgb(text, red, green, blue)', 'rgbBackground(text, red, green, blue)',
                                'write(text)', 'line(text?)', 'eraseLine(mode?)', 'eraseScreen(mode?)',
                                'cursor(x, y)', 'move(x, y)', 'up(amount?)', 'down(amount?)', 'left(amount?)', 'right(amount?)',
                                'saveCursor()', 'restoreCursor()', 'hideCursor()', 'showCursor()', 'title(text)', 'bell()', 'size()'
                            ],
                            'std/api': [
                                'create_app(config?)', '.get(path, schema?, handler)', '.post(path, schema?, handler)', 
                                '.put(path, schema?, handler)', '.delete(path, schema?, handler)', '.use(middleware)', 
                                '.openapi()', '.routes()', '.listen(port, options?)'
                            ],
                            'std/mpc': [
                                'create(config?)', 'project(config?)', 'sequence(name, bars?, bpm?, timeSig?)',
                                'drum_kit(nameOrPreset?)', 'program(name, type?, pads?)', 'pad(padNumber, sound?, options?)',
                                'sixteen_levels(pad, mode?, options?)', 'note_repeat(pad, rate?, bars?, options?)',
                                'swing(events, percent?, grid?)', 'chop(sample, slices?, options?)', 'slice(sample, slices?, options?)',
                                'vintage(mode, sample)', 'effect(type, params)', 'fx(type, params)', 'sample(type_or_path, options?)',
                                'song(steps, name?)', 'render_wav(target, path, options?)', 'render_midi(target, path)', 'play(target, options?)'
                            ]
                        };

                        const exportsList = builtinExports[moduleInfo.specifier];
                        if (moduleInfo.specifier === 'std/base64') {
                            markdown.appendMarkdown('**Description:** Base64 encoding/decoding for UTF-8 text and raw bytes (`mode = "text" | "bytes"`).\n\n');
                        }
                        if (moduleInfo.specifier === 'std/mpc') {
                            markdown.appendMarkdown('**Description:** Akai MPC track sequencing, Roger Linn swing, 16 Levels, Note Repeat, Choke Groups, AIR FX, and Vintage Mode audio/MIDI rendering.\n\n');
                        }
                        if (moduleInfo.specifier === 'std/api') {
                            markdown.appendMarkdown('**Description:** FastAPI-style HTTP API framework with auto-generated Swagger UI docs at `/docs` and OpenAPI spec at `/openapi.json`.\n\n**Returns** an app object with methods:\n* `app.get(path, schema, handler)` — register a GET route\n* `app.post(path, schema, handler)` — register a POST route\n* `app.put / patch / delete` — register other HTTP methods\n* `app.use(middleware)` — add a request middleware\n* `app.openapi()` — return the OpenAPI spec as an object\n* `app.routes()` — list registered routes\n* `app.listen(port, options?)` — start server, returns server object\n\n**Schema fields:** `summary`, `description`, `tags`, `query`, `body`, `response`, `deprecated`\n\n**listen options:** `docs_path` (default `/docs`), `openapi_path` (default `/openapi.json`), `cors` (default true), `cors_origin`\n');
                        }
                        if (moduleInfo.specifier === 'std/game') {
                            markdown.appendMarkdown('**Description:** Optional Babylon.js/Electron imperative 3D desktop engine. Install `@misterscan/sesi-game` and run with `sesi -l`.\n\n');
                        }
                        if (exportsList) {
                            markdown.appendMarkdown(`**Exports:**\n`);
                            for (const item of exportsList) {
                                markdown.appendMarkdown(`* \`${item}\`\n`);
                            }
                        }
                    } else {
                        appendLocalModuleHover(markdown, moduleInfo.specifier, resolved);
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

            const makeMember = resolveMakeMemberAtPosition(document, position, workspaceRoot);
            if (makeMember) {
                const details = makeMember.definition.details;
                const markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;
                markdown.appendCodeblock(details.signature, 'sesi');
                if (details.documentation) markdown.appendMarkdown(`${details.documentation}\n\n`);
                markdown.appendMarkdown(`*Member of:* **${makeMember.makeName}**  \n`);
                if (makeMember.specifier) markdown.appendMarkdown(`*Imported from:* **${makeMember.specifier}**  \n`);
                markdown.appendMarkdown(`*Declared on line ${details.line}*`);
                return new vscode.Hover(markdown, range);
            }

            const scopeAnalysis = getDocumentScopeAnalysis(document);
            const identifierToken = getIdentifierTokenAtPosition(scopeAnalysis.tokens, position);
            const namespaceImport = getNamespaceImportAtToken(
                scopeAnalysis.tokens,
                scopeAnalysis.tokenScopes,
                identifierToken
            );
            if (namespaceImport) {
                const resolvedModule = resolveSesiModule(namespaceImport.specifier, document.uri.fsPath, workspaceRoot);
                if (resolvedModule && resolvedModule.type === 'local') {
                    const markdown = new vscode.MarkdownString();
                    markdown.isTrusted = true;
                    markdown.supportHtml = true;
                    appendLocalModuleHover(markdown, namespaceImport.specifier, resolvedModule);
                    return new vscode.Hover(markdown, range);
                }
            }

            const importedSymbol = resolveImportedSymbolAtPosition(document, position, workspaceRoot);
            if (importedSymbol && importedSymbol.kind === 'local-export') {
                const details = importedSymbol.exportDefinition.details;
                const markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;
                markdown.appendCodeblock(details.signature, 'sesi');
                if (details.documentation) {
                    markdown.appendMarkdown(`${details.documentation}\n\n`);
                }
                markdown.appendMarkdown(`*Imported from:* **${importedSymbol.specifier}**  \n`);
                markdown.appendMarkdown(`*Declared on line ${details.line}*`);
                return new vscode.Hover(markdown, range);
            }
            if (importedSymbol && importedSymbol.kind === 'missing-export') {
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(`(unresolved export) ${importedSymbol.exportName}`, 'sesi');
                markdown.appendMarkdown(`No exported declaration named **${importedSymbol.exportName}** was found in **${importedSymbol.specifier}**.`);
                return new vscode.Hover(markdown, range);
            }

            // Local symbols take precedence over built-ins so user declarations can
            // intentionally shadow a built-in and still receive the correct hover.
            const cache = getDocumentScopeAnalysis(document);
            const localToken = getIdentifierTokenAtPosition(cache.tokens, position);
            if (localToken && (!importedSymbol || importedSymbol.kind !== 'builtin')) {
                const scope = cache.tokenScopes.get(localToken);
                const declaration = scope && scope.resolve(localToken.lexeme);
                if (declaration) {
                    const details = getDeclarationDetails(document.getText(), cache.tokens, declaration);
                    if (details) {
                        const markdown = new vscode.MarkdownString();
                        markdown.isTrusted = true;
                        markdown.appendCodeblock(details.signature, 'sesi');
                        if (details.documentation) {
                            markdown.appendMarkdown(`${details.documentation}\n\n`);
                        }
                        markdown.appendMarkdown(`*Declared on line ${details.line}*`);
                        return new vscode.Hover(markdown, range);
                    }
                }
            }

            const item = docs[importedSymbol && importedSymbol.kind === 'builtin' ? importedSymbol.exportName : word];
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

    const definitionProvider = vscode.languages.registerDefinitionProvider('sesi', {
        provideDefinition(document, position, token) {
            if (isPositionInComment(document, position)) return null;
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

            const fileInfo = getFileSpecifierAtPosition(document, position, workspaceRoot);
            if (fileInfo) {
                return new vscode.Location(
                    vscode.Uri.file(fileInfo.path),
                    new vscode.Position(0, 0)
                );
            }

            const importedSymbol = resolveImportedSymbolAtPosition(document, position, workspaceRoot);
            if (importedSymbol && importedSymbol.kind === 'local-export') {
                const definitionToken = importedSymbol.exportDefinition.token;
                return new vscode.Location(
                    vscode.Uri.file(importedSymbol.resolvedModule.path),
                    new vscode.Range(
                        new vscode.Position(definitionToken.line, definitionToken.col),
                        new vscode.Position(definitionToken.line, definitionToken.col + definitionToken.length)
                    )
                );
            }

            const makeMember = resolveMakeMemberAtPosition(document, position, workspaceRoot);
            if (makeMember) {
                const definitionToken = makeMember.definition.token;
                const definitionUri = makeMember.kind === 'imported-member'
                    ? vscode.Uri.file(makeMember.resolvedModule.path)
                    : document.uri;
                return new vscode.Location(
                    definitionUri,
                    new vscode.Range(
                        new vscode.Position(definitionToken.line, definitionToken.col),
                        new vscode.Position(definitionToken.line, definitionToken.col + definitionToken.length)
                    )
                );
            }

            // Check local declarations for Go to Definition
            const cache = getDocumentScopeAnalysis(document);
            if (cache) {
                const { tokens, tokenScopes } = cache;
                const tok = getIdentifierTokenAtPosition(tokens, position);
                if (tok) {
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

    const documentLinkProvider = vscode.languages.registerDocumentLinkProvider('sesi', {
        provideDocumentLinks(document) {
            const links = [];
            const commentStrippedLines = stripComments(document.getText()).split('\n');

            for (let lineIdx = 0; lineIdx < document.lineCount; lineIdx++) {
                const lineText = commentStrippedLines[lineIdx] || '';
                const stringRegex = /(["'])(.*?)\1/g;
                let match;

                while ((match = stringRegex.exec(lineText)) !== null) {
                    const specifier = match[2];
                    const start = match.index;
                    const end = match.index + match[0].length;
                    const linkRange = new vscode.Range(
                        new vscode.Position(lineIdx, start + 1),
                        new vscode.Position(lineIdx, end - 1)
                    );

                    const beforeString = lineText.substring(0, start).trim();
                    const afterString = lineText.substring(end).trim();
                    const isAllow = /\ballow\s*$/i.test(beforeString) || (beforeString.includes('allow') && afterString.startsWith('in'));
                    const isImport = /\bfrom\s*$/i.test(beforeString);

                    if (isAllow || isImport) {
                        const resolvedModule = resolveSesiModule(specifier, document.uri.fsPath, workspaceRoot);
                        if (resolvedModule && resolvedModule.type === 'local') {
                            const link = new vscode.DocumentLink(linkRange, vscode.Uri.file(resolvedModule.path));
                            link.tooltip = `Open module: ${specifier}`;
                            links.push(link);
                        }
                        continue;
                    }

                    const resolvedPath = resolveExistingPath(specifier, document.uri.fsPath, workspaceRoot);
                    if (resolvedPath) {
                        const link = new vscode.DocumentLink(linkRange, vscode.Uri.file(resolvedPath));
                        link.tooltip = `Open file: ${specifier}`;
                        links.push(link);
                    }
                }
            }

            return links;
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
            const scopeDiagnostics = getDocumentScopeAnalysis(document).diagnostics;
            
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
            
            // Parse each diagnostic line emitted by `sesi -c`.
            // Format: `error [code] at line N, column M: message`
            //      or `warning [code] at line N, column M: message`
            const diagLineRe = /^(error|warning)\s+\[([^\]]+)\]\s+at line (\d+), column (-?\d+):\s+(.+)$/gm;
            let anyMatched = false;
            let match;
            while ((match = diagLineRe.exec(cleanedOutput)) !== null) {
                anyMatched = true;
                const severity = match[1] === 'error'
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
                const lineNum = parseInt(match[3], 10) - 1; // 0-indexed
                let colNum = parseInt(match[4], 10);
                if (colNum < 1) colNum = 1;
                const message = match[5];
                const code = match[2];

                if (lineNum >= 0 && lineNum < document.lineCount) {
                    const lineText = document.lineAt(lineNum).text;
                    const range = new vscode.Range(
                        new vscode.Position(lineNum, Math.max(0, colNum - 1)),
                        new vscode.Position(lineNum, lineText.length)
                    );
                    const diag = new vscode.Diagnostic(range, message, severity);
                    diag.code = code;
                    diagnostics.push(diag);
                }
            }

            if (!anyMatched && code !== 0 && cleanedOutput) {
                // Fallback for general execution errors with no structured lines
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
    context.subscriptions.push(documentLinkProvider);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('sesi', {
        provideCompletionItems(document, position) {
            const prefix = document.lineAt(position.line).text.slice(0, position.character);
            if (/\bMath\.$/.test(prefix)) {
                return [
                    ...SESI_MATH_CONSTANTS.map(name => {
                        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Constant);
                        item.detail = 'std/math constant';
                        return item;
                    }),
                    ...SESI_MATH_FUNCTIONS.map(name => {
                        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
                        item.detail = SESI_MATH_FUNCTION_SIGNATURES[name];
                        return item;
                    })
                ];
            }
            if (/Game\.$/.test(prefix)) {
                return ['VERSION', 'create', 'vec2', 'vec3', 'quat', 'color'].map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
                    item.detail = 'std/game module export';
                    return item;
                });
            }
            if (/\bgame\.$/.test(prefix)) {
                return ['assets', 'input', 'storage', 'active_scene', 'paused', 'create_scene', 'scene', 'activate_scene', 'on_start', 'on_update', 'on_fixed_update', 'on_stop', 'run', 'build'].map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
                    item.detail = 'std/game game member';
                    return item;
                });
            }
            if (/\bscene\.$/.test(prefix)) {
                return ['box', 'sphere', 'plane', 'ground', 'cylinder', 'load_model', 'free_camera', 'orbit_camera', 'follow_camera', 'hemispheric_light', 'directional_light', 'point_light', 'spot_light', 'standard_material', 'pbr_material', 'raycast', 'intersects', 'get', 'remove', 'enable_physics', 'add_body', 'animate', 'play_sound', 'gui_text', 'gui_image', 'gui_button', 'gui_panel', 'gui_stack'].map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
                    item.detail = 'std/game scene member';
                    return item;
                });
            }
            return undefined;
        }
    }, '.'));

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
    deactivate,
    _test: {
        stripComments,
        isPositionInComment,
        getModuleSpecifierAtPosition,
        resolveSesiModule,
        validateImports,
        tokenize,
        findEmbeddedCodeRanges,
        tokenizeEmbeddedCode,
        splitEmbeddedTokenAcrossLines,
        embeddedSemanticTokenType,
        getModuleDocumentation,
        appendLocalModuleHover,
        getLeadingDocumentation,
        getDeclarationDetails,
        findExportDefinitionInText,
        getImportBindingInfo,
        getImportTargetAtToken,
        getNamespaceImportAtToken,
        getMakeMemberTargetAtToken,
        findMakeMemberDefinitionInText,
        resolveMakeMemberAtPosition,
        findDeclarationsAndReferences,
        analyzeScope,
        mathConstants: SESI_MATH_CONSTANTS,
        mathFunctions: SESI_MATH_FUNCTIONS,
        mathFunctionSignatures: SESI_MATH_FUNCTION_SIGNATURES
    }
};
