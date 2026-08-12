export interface DryRunDiagnostic {
  severity: 'error' | 'warning';
  code: 'undefined-symbol' | 'unused-symbol';
  message: string;
  line: number;
  column: number;
}

interface ScopeToken {
  type: string;
  lexeme: string;
  line: number;
  col: number;
  length: number;
}

interface Declaration {
  name: string;
  token: ScopeToken;
  type: string;
  keywordToken?: ScopeToken;
}

interface Reference {
  name: string;
  token: ScopeToken;
}

interface Binding {
  token: ScopeToken;
  type: string;
  readCount: number;
  suppressUnused?: boolean;
}

class DryScope {
  readonly variables = new Map<string, Binding>();
  readonly children: DryScope[] = [];

  constructor(readonly parent: DryScope | null = null, readonly isMakeScope = false) {
    parent?.children.push(this);
  }

  declare(name: string, binding: Binding): void {
    this.variables.set(name, binding);
  }

  resolve(name: string): Binding | null {
    return this.variables.get(name) ?? this.parent?.resolve(name) ?? null;
  }
}

// Kept independent from the VS Code extension by design. These functions are
// a TypeScript implementation of the IDE scope checker's behavior.
function stripComments(text: string): string {
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
        } else i++;
      } else if (char === stringQuote) {
        inString = false;
        i++;
      } else i++;
    } else if (char === '"' || char === "'") {
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
        result += text[i] === '\n' || text[i] === '\r' ? text[i] : ' ';
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
  return result;
}

function tokenize(text: string): ScopeToken[] {
  const tokens: ScopeToken[] = [];
  const keywords = new Set([
    'let', 'fn', 'if', 'else', 'while', 'for', 'in', 'return',
    'break', 'continue', 'try', 'catch', 'finally', 'true', 'false', 'null',
    'show', 'prompt', 'model', 'image', 'make', 'async', 'await', 'import', 'from',
    'export', 'to', 'allow', 'as', 'with', 'convert', 'memory', 'structured_output', 'tool_call',
  ]);
  const stripped = stripComments(text);
  const tokenRegex = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b[a-zA-Z_][a-zA-Z0-9_]*\b|[{}[\](),;.:=+\-*/%&|!<>]/g;
  const lineOffsets: number[] = [];
  let currentOffset = 0;
  for (const line of text.split('\n')) {
    lineOffsets.push(currentOffset);
    currentOffset += line.length + 1;
  }

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(stripped)) !== null) {
    const lexeme = match[0];
    let low = 0;
    let high = lineOffsets.length - 1;
    let line = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] <= match.index) {
        line = mid;
        low = mid + 1;
      } else high = mid - 1;
    }
    let type = 'PUNCTUATION';
    if (lexeme.startsWith('"') || lexeme.startsWith("'")) type = 'STRING';
    else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lexeme)) type = keywords.has(lexeme) ? lexeme.toUpperCase() : 'IDENTIFIER';
    else if (/^[0-9]+(\.[0-9]+)?$/.test(lexeme)) type = 'NUMBER';
    tokens.push({ type, lexeme, line, col: match.index - lineOffsets[line], length: lexeme.length });
  }
  return tokens;
}

function isConfigBlockKey(index: number, tokens: ScopeToken[]): boolean {
  let braceLevel = 0;
  let openBraceIdx = -1;
  for (let i = index - 1; i >= 0; i--) {
    if (tokens[i].lexeme === '}') braceLevel++;
    else if (tokens[i].lexeme === '{') {
      if (braceLevel === 0) {
        openBraceIdx = i;
        break;
      }
      braceLevel--;
    }
  }
  if (openBraceIdx === -1) return false;

  let isConfig = false;
  let scanLevel = 0;
  for (let i = openBraceIdx; i < tokens.length; i++) {
    const lexeme = tokens[i].lexeme;
    if (lexeme === '{' || lexeme === '[' || lexeme === '(') scanLevel++;
    else if (lexeme === '}' || lexeme === ']' || lexeme === ')') {
      scanLevel--;
      if (scanLevel === 0) break;
    } else if (scanLevel === 1 && (lexeme === ',' || lexeme === ':')) isConfig = true;
  }

  let closeBraceIdx = -1;
  let secondBraceLevel = 0;
  for (let i = openBraceIdx; i < tokens.length; i++) {
    if (tokens[i].lexeme === '{') secondBraceLevel++;
    else if (tokens[i].lexeme === '}') {
      secondBraceLevel--;
      if (secondBraceLevel === 0) {
        closeBraceIdx = i;
        break;
      }
    }
  }
  if (closeBraceIdx !== -1) {
    let next = closeBraceIdx + 1;
    while (next < tokens.length && (tokens[next].type === 'NEWLINE' || tokens[next].type === 'COMMENT')) next++;
    if (tokens[next]?.lexeme === '{') isConfig = true;
  }
  if (!isConfig) return false;

  for (let i = index - 1; i >= openBraceIdx; i--) {
    if (tokens[i].type === 'NEWLINE' || tokens[i].type === 'COMMENT') continue;
    return tokens[i].lexeme === '{' || tokens[i].lexeme === ',';
  }
  return false;
}

function findDeclarationsAndReferences(tokens: ScopeToken[]): { decls: Declaration[]; refs: Reference[] } {
  const decls: Declaration[] = [];
  const refs: Reference[] = [];
  const declared = new Set<ScopeToken>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'LET') {
      const next = tokens[i + 1];
      if (next?.type === 'IDENTIFIER') {
        decls.push({ name: next.lexeme, token: next, type: 'variable' });
        declared.add(next);
      }
    } else if (token.type === 'FN' || token.type === 'MAKE') {
      const next = tokens[i + 1];
      if (next?.type === 'IDENTIFIER') {
        decls.push({ name: next.lexeme, token: next, type: 'function' });
        declared.add(next);
      }
      let cursor = i + 2;
      while (cursor < tokens.length && tokens[cursor].lexeme !== '(' && tokens[cursor].lexeme !== '{') cursor++;
      if (tokens[cursor]?.lexeme === '(') {
        cursor++;
        while (cursor < tokens.length && tokens[cursor].lexeme !== ')') {
          const candidate = tokens[cursor];
          const previous = tokens[cursor - 1];
          if (candidate.type === 'IDENTIFIER' && (previous?.lexeme === '(' || previous?.lexeme === ',')) {
            decls.push({ name: candidate.lexeme, token: candidate, type: 'parameter' });
            declared.add(candidate);
          }
          cursor++;
        }
      }
    } else if (token.type === 'ALLOW') {
      let cursor = i + 1;
      while (cursor < tokens.length && tokens[cursor].type !== 'WITH' && tokens[cursor].type !== 'AS') cursor++;
      cursor++;
      while (tokens[cursor]?.type === 'NEWLINE') cursor++;
      if (tokens[cursor]?.type === 'IDENTIFIER') {
        decls.push({ name: tokens[cursor].lexeme, token: tokens[cursor], type: 'import', keywordToken: token });
        declared.add(tokens[cursor]);
      } else if (tokens[cursor]?.lexeme === '{') {
        cursor++;
        while (cursor < tokens.length && tokens[cursor].lexeme !== '}') {
          if (tokens[cursor].type === 'IDENTIFIER') {
            decls.push({ name: tokens[cursor].lexeme, token: tokens[cursor], type: 'import', keywordToken: token });
            declared.add(tokens[cursor]);
          }
          cursor++;
        }
      }
    } else if (token.type === 'IMPORT') {
      let cursor = i + 1;
      while (tokens[cursor]?.type === 'NEWLINE') cursor++;
      if (tokens[cursor]?.lexeme === '{') {
        cursor++;
        while (cursor < tokens.length && tokens[cursor].lexeme !== '}') {
          if (tokens[cursor].type === 'IDENTIFIER') {
            decls.push({ name: tokens[cursor].lexeme, token: tokens[cursor], type: 'import', keywordToken: token });
            declared.add(tokens[cursor]);
          }
          cursor++;
        }
      } else if (tokens[cursor]?.type === 'IDENTIFIER') {
        decls.push({ name: tokens[cursor].lexeme, token: tokens[cursor], type: 'import', keywordToken: token });
        declared.add(tokens[cursor]);
      }
    } else if (token.type === 'FOR') {
      const next = tokens[i + 1];
      if (next?.type === 'IDENTIFIER') {
        decls.push({ name: next.lexeme, token: next, type: 'loop_variable' });
        declared.add(next);
      }
    } else if (token.type === 'TRY') {
      let cursor = i + 1;
      while (cursor < tokens.length && tokens[cursor].type !== 'CATCH') cursor++;
      if (tokens[cursor + 1]?.lexeme === '(' && tokens[cursor + 2]?.type === 'IDENTIFIER') {
        const catchVariable = tokens[cursor + 2];
        decls.push({ name: catchVariable.lexeme, token: catchVariable, type: 'catch_variable' });
        declared.add(catchVariable);
      }
    } else if (token.type === 'PROMPT' || token.type === 'MEMORY' || token.type === 'STRUCTURED_OUTPUT') {
      const next = tokens[i + 1];
      if (next?.type === 'IDENTIFIER') {
        decls.push({ name: next.lexeme, token: next, type: 'variable' });
        declared.add(next);
      }
    } else if (token.type === 'IDENTIFIER' && token.lexeme === 'define_tool' && tokens[i + 1]?.lexeme === '(') {
      const nameToken = tokens[i + 2];
      const name = nameToken?.type === 'STRING' ? nameToken.lexeme.replace(/['"]/g, '') : nameToken?.type === 'IDENTIFIER' ? nameToken.lexeme : '';
      if (name) {
        decls.push({ name, token: nameToken, type: 'tool' });
        declared.add(nameToken);
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'IDENTIFIER' || declared.has(token)) continue;
    const previous = tokens[i - 1];
    if (previous?.lexeme === '.') continue;
    if (tokens[i + 1]?.lexeme === ':' && previous && (previous.lexeme === '{' || previous.lexeme === ',')) continue;
    if (isConfigBlockKey(i, tokens)) continue;
    refs.push({ name: token.lexeme, token });
  }
  return { decls, refs };
}

function shouldPushScope(index: number, tokens: ScopeToken[]): boolean {
  let previousIndex = index - 1;
  while (previousIndex >= 0 && (tokens[previousIndex].type === 'NEWLINE' || tokens[previousIndex].type === 'COMMENT')) previousIndex--;
  if (previousIndex < 0) return true;
  const previous = tokens[previousIndex];
  if (previous.type === 'WITH' || previous.type === 'IMPORT') return false;
  if (['=', ':', ',', '(', '[', '|'].includes(previous.lexeme)) return false;

  if (previous.lexeme === ')') {
    let level = 0;
    let open = -1;
    for (let i = previousIndex; i >= 0; i--) {
      if (tokens[i].lexeme === ')') level++;
      else if (tokens[i].lexeme === '(') {
        level--;
        if (level === 0) { open = i; break; }
      }
    }
    if (open > 0) {
      let functionIndex = open - 1;
      while (functionIndex >= 0 && (tokens[functionIndex].type === 'NEWLINE' || tokens[functionIndex].type === 'COMMENT')) functionIndex--;
      const functionToken = tokens[functionIndex];
      if (functionToken?.type === 'IDENTIFIER' && ['model', 'structured_output', 'image_model'].includes(functionToken.lexeme)) return false;
    }
  }

  if (previous.lexeme === '}') {
    let level = 0;
    let openBrace = -1;
    for (let i = previousIndex; i >= 0; i--) {
      if (tokens[i].lexeme === '}') level++;
      else if (tokens[i].lexeme === '{') {
        level--;
        if (level === 0) { openBrace = i; break; }
      }
    }
    if (openBrace > 0) {
      let before = openBrace - 1;
      while (before >= 0 && (tokens[before].type === 'NEWLINE' || tokens[before].type === 'COMMENT')) before--;
      if (tokens[before]?.lexeme === ')') {
        let parenLevel = 0;
        let openParen = -1;
        for (let i = before; i >= 0; i--) {
          if (tokens[i].lexeme === ')') parenLevel++;
          else if (tokens[i].lexeme === '(') {
            parenLevel--;
            if (parenLevel === 0) { openParen = i; break; }
          }
        }
        if (openParen > 0) {
          let functionIndex = openParen - 1;
          while (functionIndex >= 0 && (tokens[functionIndex].type === 'NEWLINE' || tokens[functionIndex].type === 'COMMENT')) functionIndex--;
          const functionToken = tokens[functionIndex];
          if (functionToken?.type === 'IDENTIFIER' && ['model', 'image_model'].includes(functionToken.lexeme)) return false;
        }
      }
    }
  }
  return true;
}

const BUILTINS = new Set([
  'show', 'str', 'type', 'num', 'float', 'bool', 'from_json', 'to_json', 'encrypt', 'decrypt', 'speech', 'from_speech', 'translate', 'len',
  'read_file', 'write_file', 'append_file', 'write_image', 'open', 'open_file', 'list_dir', 'make_dir', 'rename', 'archive', 'zip', 'exists', 'get_ext', 'trash', 'exp', 'trunc',
  'random', 'sleep', 'now', 'model', 'image', 'js', 'html', 'structured_output', 'tool_call', 'spawn', 'exec', 'run', 'sesi', 'python', 'time', 'env',
  'range', 'push', 'append', 'pop', 'join', 'split', 'keys', 'values', 'array', 'PI', 'E', 'sin', 'cos', 'tan', 'sqrt', 'floor', 'ceil', 'abs',
  'pow', 'log', 'workflow', 'set_alias', 'define_tool', 'list_tools', 'error_type', 'raise_error', 'multi_req', 'web_get',
  'web_send', 'listen', 'live', 'convert', 'api', 'prompt', 'debug', 'to_upper', 'to_lower', 'trim', 'slice', 'swap', 'retry', 'map', 'filter',
  'reduce', 'find', 'format', 'db_open', 'args', 'input', 'contains', 'locate', 'doc', 'media', 'audio', 'launch', 'memory_search', 'memory_trim',
  'lazy', 'force', 'timeout', 'profile', 'profile_start', 'profile_end', 'profile_report',
  'string', 'number', 'object', 'null', 'any', 'name', 'arity', 'is_function', 'is_array', 'is_object', 'is_string', 'is_number', 'is_bool', 'is_null',
  'length', 'starts_with', 'ends_with', 'index_of', 'repeat', 'includes', 'reverse', 'sort', 'unique', 'flatten', 'play', 'beep', 'synth', 'save',
  'sequence', 'mix', 'comp', 'render', 'sf2', 'chord', 'scale', 'transpose', 'duration', 'bar', 'midi', 'clear', 'circle', 'rect', 'line', 'text',
  'save_svg', 'ellipse', 'polygon', 'path', 'gradient', 'style', 'raw', 'regex', 'tokenize', 'count_tokens', 'estimate_tokens', 'estimate_cost',
  'model_usage', 'gif', 'video', 'ffmpeg', 'matrix_dot', 'matrix_transpose', 'matrix_add', 'matrix_sub', 'matrix_mul_elements', 'matrix_scale',
  'matrix_sigmoid', 'matrix_dsigmoid', 'matrix_sum_rows', 'matrix_mse',
]);

export function runDryRunSemanticChecks(source: string): DryRunDiagnostic[] {
  const tokens = tokenize(source);
  const { decls, refs } = findDeclarationsAndReferences(tokens);
  const root = new DryScope();
  let current = root;
  let skipNextBraceScope = false;
  const pushedScopes: boolean[] = [];
  const tokenScopes = new Map<ScopeToken, DryScope>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.lexeme === '}') {
      if (pushedScopes.pop() && current.parent) current = current.parent;
    }
    tokenScopes.set(token, current);

    if (token.type === 'FN' || token.type === 'MAKE') {
      const isMakeMethod = token.type === 'FN' && current.isMakeScope;
      const name = tokens[i + 1];
      if (name?.type === 'IDENTIFIER') current.declare(name.lexeme, { token: name, type: 'function', readCount: 0 });
      current = new DryScope(current, token.type === 'MAKE');
      skipNextBraceScope = true;
      let cursor = i + 2;
      while (cursor < tokens.length && tokens[cursor].lexeme !== '(' && tokens[cursor].lexeme !== '{') cursor++;
      if (tokens[cursor]?.lexeme === '(') {
        cursor++;
        while (cursor < tokens.length && tokens[cursor].lexeme !== ')') {
          const candidate = tokens[cursor];
          const previous = tokens[cursor - 1];
          if (candidate.type === 'IDENTIFIER' && (previous?.lexeme === '(' || previous?.lexeme === ',')) {
            current.declare(candidate.lexeme, {
              token: candidate, type: 'parameter', readCount: 0,
              suppressUnused: isMakeMethod && candidate.lexeme === 'self',
            });
          }
          cursor++;
        }
      }
    } else if (token.type === 'FOR') {
      current = new DryScope(current);
      skipNextBraceScope = true;
      const variable = tokens[i + 1];
      if (variable?.type === 'IDENTIFIER') current.declare(variable.lexeme, { token: variable, type: 'loop_variable', readCount: 0, suppressUnused: true });
    } else if (token.type === 'CATCH') {
      current = new DryScope(current);
      skipNextBraceScope = true;
      const variable = tokens[i + 2];
      if (tokens[i + 1]?.lexeme === '(' && variable?.type === 'IDENTIFIER') current.declare(variable.lexeme, { token: variable, type: 'catch_variable', readCount: 0 });
    } else if (token.lexeme === '{') {
      if (skipNextBraceScope) {
        skipNextBraceScope = false;
        pushedScopes.push(true);
      } else if (shouldPushScope(i, tokens)) {
        current = new DryScope(current);
        pushedScopes.push(true);
      } else pushedScopes.push(false);
    } else if (token.type === 'LET') {
      const name = tokens[i + 1];
      if (name?.type === 'IDENTIFIER') current.declare(name.lexeme, { token: name, type: 'variable', readCount: 0 });
    } else if (token.type === 'ALLOW' || token.type === 'IMPORT') {
      for (const declaration of decls.filter(item => item.keywordToken === token)) {
        current.declare(declaration.name, { token: declaration.token, type: 'import', readCount: 0 });
      }
    } else if (token.type === 'PROMPT' || token.type === 'MEMORY') {
      const name = tokens[i + 1];
      if (name?.type === 'IDENTIFIER') current.declare(name.lexeme, { token: name, type: 'variable', readCount: 0 });
    } else if (token.type === 'IDENTIFIER' && token.lexeme === 'define_tool' && tokens[i + 1]?.lexeme === '(') {
      const nameToken = tokens[i + 2];
      const name = nameToken?.type === 'STRING' ? nameToken.lexeme.replace(/['"]/g, '') : nameToken?.type === 'IDENTIFIER' ? nameToken.lexeme : '';
      if (name) current.declare(name, { token: nameToken, type: 'tool', readCount: 0 });
    }
  }

  const diagnostics: DryRunDiagnostic[] = [];
  for (const reference of refs) {
    const binding = tokenScopes.get(reference.token)?.resolve(reference.name);
    if (binding) binding.readCount++;
    else if (!BUILTINS.has(reference.name)) {
      diagnostics.push({
        severity: 'error', code: 'undefined-symbol',
        line: reference.token.line + 1, column: reference.token.col + 1,
        message: `Undefined symbol: "${reference.name}". Referenced but not declared in this scope.`,
      });
    }
  }

  const collectUnused = (scope: DryScope): void => {
    if (scope !== root && !scope.isMakeScope) {
      for (const [name, binding] of scope.variables) {
        if (binding.readCount === 0 && !binding.suppressUnused && binding.type !== 'catch_variable' && name !== 'req' && !name.startsWith('_')) {
          diagnostics.push({
            severity: 'warning', code: 'unused-symbol',
            line: binding.token.line + 1, column: binding.token.col + 1,
            message: `Unused symbol: "${name}". Declared but never read.`,
          });
        }
      }
    }
    scope.children.forEach(collectUnused);
  };
  collectUnused(root);
  return diagnostics;
}
