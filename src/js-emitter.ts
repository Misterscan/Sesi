import { BUILTINS } from './compiler';
import { desugarMakeStatement } from './make';
import type { BlockStatement, Expression, FunctionStatement, Program, Statement } from './types';

const symbol = (name: string): string => `$sesi_${name}`;
const quote = (value: string): string => JSON.stringify(value);

function declarations(statements: Statement[]): Set<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    const node = statement.type === 'ExportStatement' ? statement.statement : statement;
    if (node.type === 'LetStatement' || node.type === 'FunctionStatement' || node.type === 'MakeStatement'
      || node.type === 'MemoryStatement') names.add(node.name);
    else if (node.type === 'ImportStatement') node.names.forEach(name => names.add(name));
    else if (node.type === 'AllowStatement') {
      if (typeof node.binding === 'string') names.add(node.binding);
      else node.binding.forEach(name => names.add(name));
    }
  }
  return names;
}

function promptNames(value: unknown, names = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return names;
  const node = value as { type?: string; name?: string; [key: string]: unknown };
  if (node.type === 'PromptExpression' && node.name) names.add(node.name);
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(item => promptNames(item, names));
    else if (child && typeof child === 'object') promptNames(child, names);
  }
  return names;
}

/** Emits JavaScript expressions and statements from the parsed Sesi AST. */
export class SesiJavaScriptEmitter {
  private scopes: Set<string>[] = [];
  private memoryNames = new Set<string>();
  private loopDepth = 0;
  private importIndex = 0;
  constructor(
    private readonly file: string,
    private readonly dependencies: Record<string, string>,
  ) {}

  emit(program: Program): string {
    this.memoryNames = new Set(program.statements.filter(statement => statement.type === 'MemoryStatement')
      .map(statement => (statement as Extract<Statement, { type: 'MemoryStatement' }>).name));
    const globals = declarations(program.statements);
    const prompts = promptNames(program);
    this.scopes.push(new Set([...globals, ...prompts]));
    const promptDeclarations = [...prompts].filter(name => !globals.has(name)).map(name => `let ${symbol(name)} = null;`);
    const code = [...promptDeclarations, ...program.statements.map(statement => this.statement(statement))].join('\n');
    const exports = program.statements.filter(statement => statement.type === 'ExportStatement')
      .map(statement => statement.statement.name);
    this.scopes.pop();
    return `${code}\nreturn {${exports.map(name => `${quote(name)}: ${symbol(name)}`).join(', ')}};`;
  }

  private known(name: string): boolean {
    return this.scopes.some(scope => scope.has(name));
  }

  private scoped(statements: Statement[]): string {
    this.scopes.push(declarations(statements));
    const code = statements.map(statement => this.statement(statement)).join('\n');
    this.scopes.pop();
    return code;
  }

  private block(block: BlockStatement): string { return `{\n${this.scoped(block.statements)}\n}`; }

  private function(statement: FunctionStatement): string {
    const params = statement.parameters.map(parameter => symbol(parameter.name));
    this.scopes.push(new Set(statement.parameters.map(parameter => parameter.name)));
    const enclosingLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    const defaults = statement.parameters.map(parameter => {
      const name = symbol(parameter.name);
      return `if (${name} === undefined) ${name} = ${parameter.defaultValue ? this.expression(parameter.defaultValue) : 'null'};`;
    }).join('\n');
    const body = this.scoped(statement.body.statements);
    this.loopDepth = enclosingLoopDepth;
    this.scopes.pop();
    return `async function ${symbol(statement.name)}(${params.join(', ')}) {\n${defaults}\n${body}\nreturn null;\n}`;
  }

  private statement(statement: Statement): string {
    switch (statement.type) {
      case 'LetStatement': return `let ${symbol(statement.name)} = ${statement.value ? this.expression(statement.value) : 'null'};`;
      case 'FunctionStatement': return this.function(statement);
      case 'MakeStatement': return this.function(desugarMakeStatement(statement));
      case 'ExpressionStatement': return `${this.expression(statement.expression)};`;
      case 'BlockStatement': return this.block(statement);
      case 'IfStatement': return `if (__sesi.truthy(${this.expression(statement.condition)})) ${this.block(statement.thenBranch)}`
        + (statement.elseBranch ? ` else ${statement.elseBranch.type === 'BlockStatement'
          ? this.block(statement.elseBranch) : this.statement(statement.elseBranch)}` : '');
      case 'WhileStatement': {
        this.loopDepth++;
        const body = this.block(statement.body);
        this.loopDepth--;
        return `while (__sesi.truthy(${this.expression(statement.condition)})) ${body}`;
      }
      case 'ForStatement': {
        const iterable = statement.iterable ? this.expression(statement.iterable) : null;
        const start = statement.start ? this.expression(statement.start) : null;
        const end = statement.end ? this.expression(statement.end) : null;
        this.loopDepth++;
        this.scopes.push(new Set([statement.variable]));
        const body = this.block(statement.body);
        this.scopes.pop();
        this.loopDepth--;
        if (iterable) {
          const iterableName = `__sesiIterable${this.importIndex++}`;
          return `{\nconst ${iterableName} = ${iterable};\nif (Array.isArray(${iterableName})) `
            + `for (const ${symbol(statement.variable)} of ${iterableName}) ${body}\n}`;
        }
        if (start && end) {
          const serial = this.importIndex++;
          const startName = `__sesiForStart${serial}`, endName = `__sesiForEnd${serial}`;
          return `{\nconst ${startName} = ${start};\nconst ${endName} = ${end};\n`
            + `if (typeof ${startName} === 'number' && typeof ${endName} === 'number') `
            + `for (let ${symbol(statement.variable)} = ${startName}; ${symbol(statement.variable)} < ${endName}; `
            + `${symbol(statement.variable)} = __sesi.add(${symbol(statement.variable)}, 1)) ${body}\n}`;
        }
        return this.unsupported(statement);
      }
      case 'ReturnStatement': return `return ${statement.value ? this.expression(statement.value) : 'null'};`;
      case 'BreakStatement': if (!this.loopDepth) return this.unsupported(statement); return 'break;';
      case 'ContinueStatement': if (!this.loopDepth) return this.unsupported(statement); return 'continue;';
      case 'TryStatement': {
        const errorName = symbol(statement.catchParameter);
        this.scopes.push(new Set([statement.catchParameter]));
        const catchBody = this.scoped(statement.catchBlock.statements);
        this.scopes.pop();
        return `try ${this.block(statement.tryBlock)} catch (${errorName}) {\n`
          + `${errorName} = __sesi.runtimeError(${errorName}, ${statement.line});\n${catchBody}\n}`
          + (statement.finallyBlock ? ` finally ${this.block(statement.finallyBlock)}` : '');
      }
      case 'ImportStatement': {
        const temporary = `__sesiImport${this.importIndex++}`;
        const source = this.module(statement.source);
        return `const ${temporary} = ${source};\n${statement.names.map(name => `let ${symbol(name)} = ${temporary}[${quote(name)}];`).join('\n')}`;
      }
      case 'AllowStatement': {
        const source = this.module(statement.source);
        if (typeof statement.binding === 'string') return `let ${symbol(statement.binding)} = ${source};`;
        const temporary = `__sesiImport${this.importIndex++}`;
        return `const ${temporary} = ${source};\n${statement.binding.map(name => `let ${symbol(name)} = ${temporary}[${quote(name)}];`).join('\n')}`;
      }
      case 'ExportStatement': return this.statement(statement.statement);
      case 'MemoryStatement': return `let ${symbol(statement.name)} = await __sesi.host("memory", `
        + `[${quote(statement.name)}, ${statement.initialValue ? this.expression(statement.initialValue) : quote('')}]);`;
      default: return this.unsupported(statement);
    }
  }

  private module(source: string): string {
    if (source.startsWith('std/')) return `__sesi.standard(${quote(source)})`;
    const id = this.dependencies[source];
    if (!id) throw new Error(`${this.file}: Missing bundled module ${source}`);
    return `await __sesiLoad(${quote(id)})`;
  }

  private expression(expression: Expression): string {
    switch (expression.type) {
      case 'Literal': return JSON.stringify(expression.value);
      case 'Identifier': return this.known(expression.name) ? symbol(expression.name) : `__sesi.global(${quote(expression.name)})`;
      case 'ArrayLiteral': return `[${expression.elements.map(item => this.expression(item)).join(', ')}]`;
      case 'ObjectLiteral': return `__sesi.object([${expression.properties.map(property =>
        `[${quote(property.key)}, ${this.expression(property.value)}]`).join(', ')}])`;
      case 'BinaryOp': {
        const left = this.expression(expression.left), right = this.expression(expression.right);
        switch (expression.operator) {
          case '+': return `__sesi.add(${left}, ${right})`;
          case '==': return `__sesi.equal(${left}, ${right})`;
          case '!=': return `!__sesi.equal(${left}, ${right})`;
          case '<': return `(__sesi.compare(${left}, ${right}) < 0)`;
          case '<=': return `(__sesi.compare(${left}, ${right}) <= 0)`;
          case '>': return `(__sesi.compare(${left}, ${right}) > 0)`;
          case '>=': return `(__sesi.compare(${left}, ${right}) >= 0)`;
          case '-': case '*': case '/': case '%': return `(${left} ${expression.operator} ${right})`;
          default: return this.unsupported(expression);
        }
      }
      case 'UnaryOp': return expression.operator === '!' ? `!__sesi.truthy(${this.expression(expression.operand)})`
        : expression.operator === '-' ? `(-${this.expression(expression.operand)})` : this.unsupported(expression);
      case 'LogicalOp': {
        const left = this.expression(expression.left), right = this.expression(expression.right);
        return `(await (async () => { const value = ${left}; return ${expression.operator === '&&'
          ? `__sesi.truthy(value) ? ${right} : value` : `__sesi.truthy(value) ? value : ${right}`}; })())`;
      }
      case 'ConditionalExpression': return `(__sesi.truthy(${this.expression(expression.condition)}) ? `
        + `${this.expression(expression.thenExpr)} : ${this.expression(expression.elseExpr)})`;
      case 'Assignment': {
        const right = this.expression(expression.right);
        if (expression.left.type === 'Identifier') {
          if (!this.known(expression.left.name)) throw new Error(`${this.file}:${expression.line}: Undefined variable ${expression.left.name}`);
          if (this.memoryNames.has(expression.left.name)) return `(${symbol(expression.left.name)} = await __sesi.host("memory_update", `
            + `[${quote(expression.left.name)}, ${right}]))`;
          return `(${symbol(expression.left.name)} = ${right})`;
        }
        if (expression.left.type === 'MemberExpression') return `__sesi.setProperty(${this.expression(expression.left.object)}, `
          + `${quote(expression.left.property)}, ${right})`;
        if (expression.left.type === 'IndexExpression') return `__sesi.setProperty(${this.expression(expression.left.object)}, `
          + `${this.expression(expression.left.index)}, ${right})`;
        return this.unsupported(expression);
      }
      case 'MemberExpression': {
        const object = this.expression(expression.object);
        if (expression.optional) return `(await (async () => { const value = ${object}; return value != null ? `
          + `__sesi.property(value, ${quote(expression.property)}) : null; })())`;
        return `__sesi.property(${object}, ${quote(expression.property)})`;
      }
      case 'IndexExpression': {
        const object = this.expression(expression.object);
        if (expression.optional) return `(await (async () => { const value = ${object}; return value != null ? `
          + `__sesi.property(value, ${this.expression(expression.index)}) : null; })())`;
        return `__sesi.property(${object}, ${this.expression(expression.index)})`;
      }
      case 'CallExpression': {
        const args = `[${expression.arguments.map(argument => this.expression(argument)).join(', ')}]`;
        if (expression.callee.type === 'Identifier' && BUILTINS.has(expression.callee.name)
          && !this.known(expression.callee.name)) {
          const name = expression.callee.name;
          return `(await __sesi.builtin(${quote(name)}, ${args}))`;
        }
        const callee = this.expression(expression.callee);
        return expression.optional ? `(await (async () => { const fn = ${callee}; return fn == null ? null : __sesi.call(fn, ${args}); })())`
          : `(await __sesi.call(${callee}, ${args}))`;
      }
      case 'PromptExpression': {
        const pieces = expression.content.map(piece => this.expression(piece));
        return `(${symbol(expression.name)} = __sesi.prompt([${pieces.join(', ')}]))`;
      }
      case 'AwaitExpression': return this.expression(expression.expression);
      case 'EnvLookupExpression': return `(await __sesi.host("env", [${quote(expression.variableName)}]))`;
      case 'ModelCallExpression': case 'ImageCallExpression': case 'VideoCallExpression': {
        const operation = expression.type === 'ModelCallExpression' ? 'model'
          : expression.type === 'ImageCallExpression' ? 'image' : 'video';
        const config = expression.config ? `__sesi.object([${Object.entries(expression.config)
          .map(([key, value]) => `[${quote(key)}, ${this.expression(value)}]`).join(', ')}])` : 'null';
        return `(await __sesi.host(${quote(operation)}, [${this.expression(expression.modelName)}, `
          + `${this.expression(expression.prompt)}, ${config}, ${expression.images ? this.expression(expression.images) : 'null'}]))`;
      }
      case 'StructuredOutputExpression': return `(await __sesi.host("structured_output", [`
        + `${this.expression(expression.modelCall)}, ${JSON.stringify(expression.schema)}]))`;
      case 'ToolCallExpression': {
        const callee = this.known(expression.functionName) ? symbol(expression.functionName)
          : `__sesi.global(${quote(expression.functionName)})`;
        return `(await __sesi.call(${callee}, [${expression.arguments.map(argument => this.expression(argument)).join(', ')}]))`;
      }
      case 'ConvertExpression': {
        const config = expression.config ? `__sesi.object([${Object.entries(expression.config)
          .map(([key, value]) => `[${quote(key)}, ${this.expression(value)}]`).join(', ')}])` : 'null';
        return `(await __sesi.host("convert", [${quote(expression.conversionType)}, ${this.expression(expression.file)}, ${config}]))`;
      }
      default: return this.unsupported(expression);
    }
  }

  private unsupported(node: { type: string; line?: number }): never {
    throw new Error(`${this.file}:${node.line ?? 1}: ${node.type} is not available in browser JavaScript output`);
  }
}
