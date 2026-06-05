// Tree-walking interpreter for Sesi
import {
  type Program,
  type Statement,
  type Expression,
  type RuntimeValue,
  Environment,
  type RuntimeFunction,
  ReturnValue,
  BreakException,
  ContinueException,
  type LetStatement,
  type ConstStatement,
  type FunctionStatement,
  type ExpressionStatement,
  type BlockStatement,
  type IfStatement,
  type WhileStatement,
  type ForStatement,
  type ReturnStatement,
  type TryStatement,
  type MemoryStatement,
  type Literal,
  type Identifier,
  type BinaryOp,
  type UnaryOp,
  type LogicalOp,
  type Assignment,
  type CallExpression,
  type MemberExpression,
  type IndexExpression,
  type ArrayLiteral,
  type ObjectLiteral,
  type PromptExpression,
  type ModelCallExpression,
  type StructuredOutputExpression,
  type ToolCallExpression,
  SesiRuntimeError,
} from './types';

import { getBuiltins, isTruthy, isEqual, stringify, compareValues, stripPrototypes, ensureSafePath } from './builtins';
import { aiRuntime } from './ai-runtime';
import * as fs from 'fs';

export class Interpreter {
  private globalEnv: Environment;
  private currentEnv: Environment;
  private prompts: Map<string, string> = new Map();
  private memory: Map<string, string> = new Map();
  private modelAliases: Map<string, string> = new Map();
  private customTools: Map<string, { fn: RuntimeFunction; description?: string }> = new Map();
  public exports: Map<string, RuntimeValue> = new Map();
  private scriptDir: string | undefined;

  public safeMode: boolean = true;
  public allowLocalFs: boolean = false;
  public allowedPaths: string[] = [];
  public encrypt: boolean = false;
  public decrypt: boolean = false;
  public password: string = '';
  public raw: boolean = false;
  public args: string[] = [];

  constructor(scriptDir?: string, options?: { safeMode?: boolean; allowLocalFs?: boolean; allowedPaths?: string[]; encrypt?: boolean; decrypt?: boolean; password?: string; raw?: boolean; args?: string[] }) {
    this.safeMode = options?.safeMode ?? (process.env.SESI_SAFE_MODE !== 'false');
    this.allowLocalFs = options?.allowLocalFs ?? (process.env.SESI_LOCAL_FS === 'true');
    this.raw = options?.raw ?? false;
    this.allowedPaths = options?.allowedPaths || [process.cwd()];
    this.encrypt = options?.encrypt ?? false;
    this.decrypt = options?.decrypt ?? false;
    this.password = options?.password ?? (process.env.SESI_PASSWORD ?? '');
    this.args = options?.args || [];
    if (scriptDir && !this.allowedPaths.includes(scriptDir)) {
      this.allowedPaths.push(scriptDir);
    }
    if (this.safeMode) {
      this.allowLocalFs = false;
    }

    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;
    this.scriptDir = scriptDir;

    // Add command-line arguments
    this.globalEnv.define('args', this.args);

    // Add built-in functions
    const builtins = getBuiltins(this);
    for (const [name, fn] of builtins) {
      this.globalEnv.define(name, fn);
    }
  }

  /**
   * Resolves a local module path by searching in priority order:
   *   1. Relative to the script's own directory (if known)
   *   2. Relative to the current working directory
   *   3. Each directory listed in the SESI_PATH environment variable (colon/semicolon separated)
   *   4. The global Sesi library directory: ~/.sesi/lib
   */
  private resolveModulePath(source: string): string | null {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    let filePath = source;
    if (!filePath.endsWith('.sesi')) filePath += '.sesi';

    const searchDirs: string[] = [];

    // 1. Script's own directory
    if (this.scriptDir) searchDirs.push(this.scriptDir);

    // 2. Current working directory
    searchDirs.push(process.cwd());

    // 3. SESI_PATH environment variable (semicolon or colon separated)
    if (this.safeMode !== true) {
      const sesiPath = process.env.SESI_PATH || '';
      if (sesiPath) {
        const sep = process.platform === 'win32' ? ';' : ':';
        sesiPath.split(sep).filter(Boolean).forEach(p => searchDirs.push(p));
      }
    }

    // 4. Global library: ~/.sesi/lib
    if (this.safeMode !== true) {
      searchDirs.push(path.join(os.homedir(), '.sesi', 'lib'));
    }

    for (const dir of searchDirs) {
      const resolved = path.resolve(dir, filePath);
      if (fs.existsSync(resolved)) return resolved;
    }

    return null;
  }

  async interpret(program: Program): Promise<void> {
    for (const statement of program.statements) {
      await this.executeStatement(statement);
    }
  }

  private rethrowWithContext(error: unknown, line?: number): never {
    if (error instanceof SesiRuntimeError) {
      if (line !== undefined && error.line === undefined) {
        error.line = line;
      }
      if (error.column === undefined) {
        error.column = 1;
      }
      if (line !== undefined) {
        error.stackTrace.push(`line ${line}`);
      }
      throw error;
    }

    if (error instanceof Error) {
      throw new SesiRuntimeError(
        'RuntimeError',
        error.message,
        null,
        line,
        1,
        undefined,
        line !== undefined ? [`line ${line}`] : [],
      );
    }

    throw new SesiRuntimeError(
      'RuntimeError',
      String(error),
      null,
      line,
      1,
      undefined,
      line !== undefined ? [`line ${line}`] : [],
    );
  }

  public setModelAlias(alias: string, modelName: string): void {
    const aliasKey = alias.trim();
    const modelValue = modelName.trim();
    if (!aliasKey) {
      throw new Error('Model alias cannot be empty');
    }
    if (!modelValue) {
      throw new Error('Model name cannot be empty');
    }
    this.modelAliases.set(aliasKey, modelValue);
  }

  public resolveModelName(name: string): string {
    let current = name;
    const seen = new Set<string>();

    while (this.modelAliases.has(current)) {
      if (seen.has(current)) {
        throw new Error(`Model alias cycle detected for "${name}"`);
      }
      seen.add(current);
      current = this.modelAliases.get(current)!;
    }

    return current;
  }

  public defineCustomTool(name: string, fn: RuntimeFunction, description?: string): void {
    const toolName = name.trim();
    if (!toolName) {
      throw new Error('Tool name cannot be empty');
    }
    this.customTools.set(toolName, { fn, description: description?.trim() || undefined });
  }

  public getCustomTool(name: string): RuntimeFunction | null {
    return this.customTools.get(name)?.fn || null;
  }

  public listCustomToolNames(): string[] {
    return Array.from(this.customTools.keys());
  }

  private async executeStatement(statement: Statement): Promise<void> {
    try {
      if (process.env.SESI_DEBUG === '1') {
        const lineInfo = (statement as any).line !== undefined ? ` line ${(statement as any).line}` : '';
        console.log(`[DEBUG] Executing ${statement.type}${lineInfo}`);
      }
      switch (statement.type) {
        case 'LetStatement':
          await this.executeLet(statement);
          break;
        case 'ConstStatement':
          await this.executeConst(statement);
          break;
        case 'FunctionStatement':
          await this.executeFunction(statement);
          break;
        case 'ExpressionStatement':
          await this.executeExpression(statement);
          break;
        case 'BlockStatement':
          await this.executeBlock(statement, new Environment(this.currentEnv));
          break;
        case 'IfStatement':
          await this.executeIf(statement);
          break;
        case 'WhileStatement':
          await this.executeWhile(statement);
          break;
        case 'ForStatement':
          await this.executeFor(statement);
          break;
        case 'ReturnStatement':
          throw new ReturnValue(
            (statement).value
              ? await this.evaluateExpression((statement).value)
              : null
          );
        case 'BreakStatement':
          throw new BreakException();
        case 'ContinueStatement':
          throw new ContinueException();
        case 'TryStatement':
          await this.executeTry(statement);
          break;
        case 'MemoryStatement':
          await this.executeMemory(statement);
          break;
        case 'ImportStatement':
          await this.executeImport(statement);
          break;
        case 'ExportStatement':
          await this.executeExport(statement);
          break;
      }
    } catch (error) {
      if (error instanceof ReturnValue || error instanceof BreakException || error instanceof ContinueException) {
        throw error;
      }
      this.rethrowWithContext(error, (statement as any).line);
    }
  }

  private async executeLet(stmt: LetStatement): Promise<void> {
    const value = stmt.value ? await this.evaluateExpression(stmt.value) : null;
    this.currentEnv.define(stmt.name, value);
  }

  private async executeConst(stmt: ConstStatement): Promise<void> {
    const value = await this.evaluateExpression(stmt.value);
    this.currentEnv.define(stmt.name, value);
  }

  private executeFunction(stmt: FunctionStatement): void {
    const fn: RuntimeFunction = {
      type: 'function',
      name: stmt.name,
      params: stmt.parameters,
      body: stmt.body,
      closure: this.currentEnv,
      isAsync: stmt.isAsync,
    };
    this.currentEnv.define(stmt.name, fn);
  }

  private async executeExpression(stmt: ExpressionStatement): Promise<void> {
    await this.evaluateExpression(stmt.expression);
  }

  private async executeBlock(block: BlockStatement, env: Environment): Promise<void> {
    const previous = this.currentEnv;
    this.currentEnv = env;

    try {
      for (const statement of block.statements) {
        await this.executeStatement(statement);
      }
    } finally {
      this.currentEnv = previous;
    }
  }

  private async executeTry(stmt: TryStatement): Promise<void> {
    try {
      await this.executeBlock(stmt.tryBlock, new Environment(this.currentEnv));
    } catch (e) {
      if (e instanceof BreakException || e instanceof ContinueException || e instanceof ReturnValue) {
        throw e;
      }
      const catchEnv = new Environment(this.currentEnv);
      catchEnv.define(stmt.catchParameter, this.normalizeCaughtError(e));
      await this.executeBlock(stmt.catchBlock, catchEnv);
    } finally {
      if (stmt.finallyBlock) {
        await this.executeBlock(stmt.finallyBlock, new Environment(this.currentEnv));
      }
    }
  }

  private normalizeCaughtError(error: unknown): RuntimeValue {
    if (error instanceof SesiRuntimeError) {
      return error.toRuntimeObject();
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private async executeIf(stmt: IfStatement): Promise<void> {
    const condition = await this.evaluateExpression(stmt.condition);
    if (isTruthy(condition)) {
      await this.executeBlock(stmt.thenBranch, new Environment(this.currentEnv));
    } else if (stmt.elseBranch) {
      if (stmt.elseBranch.type === 'BlockStatement') {
        await this.executeBlock(stmt.elseBranch, new Environment(this.currentEnv));
      } else {
        await this.executeStatement(stmt.elseBranch);
      }
    }
  }

  private async executeWhile(stmt: WhileStatement): Promise<void> {
    while (isTruthy(await this.evaluateExpression(stmt.condition))) {
      try {
        await this.executeBlock(stmt.body, new Environment(this.currentEnv));
      } catch (e) {
        if (e instanceof BreakException) {
          break;
        }
        if (e instanceof ContinueException) {
          continue;
        }
        throw e;
      }
    }
  }

  private async executeFor(stmt: ForStatement): Promise<void> {
    const forEnv = new Environment(this.currentEnv);
    const previous = this.currentEnv;
    this.currentEnv = forEnv;

    try {
      if (stmt.iterable) {
        // for x in array
        const iterable = await this.evaluateExpression(stmt.iterable);
        if (Array.isArray(iterable)) {
          for (const item of iterable) {
            this.currentEnv.define(stmt.variable, item);
            try {
              await this.executeBlock(stmt.body, new Environment(this.currentEnv));
            } catch (e) {
              if (e instanceof BreakException) {
                break;
              }
              if (e instanceof ContinueException) {
                continue;
              }
              throw e;
            }
          }
        }
      } else if (stmt.start && stmt.end) {
        // for x = 0 to 10
        const start = await this.evaluateExpression(stmt.start);
        const end = await this.evaluateExpression(stmt.end);

        if (typeof start === 'number' && typeof end === 'number') {
          for (let i = start; i < end; i++) {
            this.currentEnv.define(stmt.variable, i);
            try {
              await this.executeBlock(stmt.body, new Environment(this.currentEnv));
            } catch (e) {
              if (e instanceof BreakException) {
                break;
              }
              if (e instanceof ContinueException) {
                continue;
              }
              throw e;
            }
          }
        }
      }
    } finally {
      this.currentEnv = previous;
    }
  }

  private async executeMemory(stmt: MemoryStatement): Promise<void> {
    const value = stmt.initialValue ? await this.evaluateExpression(stmt.initialValue) : '';
    const stringValue = stringify(value);
    this.memory.set(stmt.name, stringValue);
    aiRuntime.initializeMemory(stmt.name, stringValue);
    this.currentEnv.define(stmt.name, stringValue);
  }

  public async evaluateExpression(expr: Expression): Promise<RuntimeValue> {
    try {
      switch (expr.type) {
        case 'Literal':
          return (expr).value;

        case 'Identifier':
          return this.currentEnv.get((expr).name);

        case 'BinaryOp':
          return await this.evaluateBinaryOp(expr);

        case 'UnaryOp':
          return await this.evaluateUnaryOp(expr);

        case 'LogicalOp':
          return await this.evaluateLogicalOp(expr);

        case 'Assignment':
          return await this.evaluateAssignment(expr);

        case 'CallExpression':
          return await this.evaluateCall(expr);

        case 'MemberExpression':
          return await this.evaluateMember(expr);

        case 'IndexExpression':
          return await this.evaluateIndex(expr);

        case 'ArrayLiteral':
          return await this.evaluateArray(expr);

        case 'ObjectLiteral':
          return await this.evaluateObject(expr);

        case 'PromptExpression':
          return await this.evaluatePrompt(expr);

        case 'ImageCallExpression':
          return await this.evaluateImageCall(expr as import('./types').ImageCallExpression);

        case 'ModelCallExpression':
          return await this.evaluateModelCall(expr);

        case 'StructuredOutputExpression':
          return await this.evaluateStructuredOutput(expr);

        case 'ToolCallExpression':
          return await this.evaluateToolCall(expr);

        case 'ConvertExpression':
          return await this.evaluateConvert(expr as import('./types').ConvertExpression);

        case 'AwaitExpression':
          return await this.evaluateAwait(expr as import('./types').AwaitExpression);

        default:
          return null;
      }
    } catch (error) {
      this.rethrowWithContext(error, (expr as any).line);
    }
  }

  private async evaluateBinaryOp(expr: BinaryOp): Promise<RuntimeValue> {
    const left = await this.evaluateExpression(expr.left);
    const right = await this.evaluateExpression(expr.right);

    switch (expr.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return stringify(left) + stringify(right);
        }
        return (left as number) + (right as number);
      case '-':
        return (left as number) - (right as number);
      case '*':
        return (left as number) * (right as number);
      case '/':
        return (left as number) / (right as number);
      case '%':
        return (left as number) % (right as number);
      case '==':
        return isEqual(left, right);
      case '!=':
        return !isEqual(left, right);
      case '<':
        return compareValues(left, right) < 0;
      case '<=':
        return compareValues(left, right) <= 0;
      case '>':
        return compareValues(left, right) > 0;
      case '>=':
        return compareValues(left, right) >= 0;
      default:
        return null;
    }
  }

  private async evaluateUnaryOp(expr: UnaryOp): Promise<RuntimeValue> {
    const operand = await this.evaluateExpression(expr.operand);

    switch (expr.operator) {
      case '-':
        return -(operand as number);
      case '!':
        return !isTruthy(operand);
      default:
        return null;
    }
  }

  private async evaluateLogicalOp(expr: LogicalOp): Promise<RuntimeValue> {
    const left = await this.evaluateExpression(expr.left);

    if (expr.operator === '||') {
      if (isTruthy(left)) return left;
      return await this.evaluateExpression(expr.right);
    } else {
      // &&
      if (!isTruthy(left)) return left;
      return await this.evaluateExpression(expr.right);
    }
  }

  private async evaluateAssignment(expr: Assignment): Promise<RuntimeValue> {
    const value = await this.evaluateExpression(expr.right);

    const isDangerousKey = (key: string): boolean => {
      return key === '__proto__' || key === 'prototype' || key === 'constructor' ||
             key === '__defineGetter__' || key === '__defineSetter__' ||
             key === '__lookupGetter__' || key === '__lookupSetter__';
    };

    if (expr.left.type === 'Identifier') {
      const name = (expr.left).name;
      this.currentEnv.set(name, value);
      if (this.memory.has(name)) {
        const stringValue = stringify(value);
        this.memory.set(name, stringValue);
        aiRuntime.updateMemory(name, stringValue);
      }
      return value;
    }

    if (expr.left.type === 'IndexExpression') {
      const indexExpr = expr.left;
      const obj = await this.evaluateExpression(indexExpr.object);
      const index = await this.evaluateExpression(indexExpr.index);

      if (typeof index === 'string' && isDangerousKey(index)) {
        throw new Error(`Prototype pollution attempt blocked: Cannot set property "${index}"`);
      }

      if (Array.isArray(obj) && typeof index === 'number') {
        obj[index] = value;
      } else if (typeof obj === 'object' && obj !== null && typeof index === 'string') {
        (obj as Record<string, any>)[index] = value;
      }
      return value;
    }

    if (expr.left.type === 'MemberExpression') {
      const memberExpr = expr.left;
      const obj = await this.evaluateExpression(memberExpr.object);

      if (isDangerousKey(memberExpr.property)) {
        throw new Error(`Prototype pollution attempt blocked: Cannot set property "${memberExpr.property}"`);
      }

      if (typeof obj === 'object' && obj !== null) {
        (obj as any)[memberExpr.property] = value;
      }
      return value;
    }

    return value;
  }

  private async evaluateCall(expr: CallExpression): Promise<RuntimeValue> {
    const callee = await this.evaluateExpression(expr.callee);

    if (typeof callee !== 'object' || !callee || (callee as any).type !== 'function') {
      throw new Error(`Not a function: ${stringify(callee)}`);
    }

    const fn = callee as RuntimeFunction;
    const args: RuntimeValue[] = [];

    for (const arg of expr.arguments) {
      args.push(await this.evaluateExpression(arg));
    }

    return await this.callSesiFunction(fn, args);
  }

  private async evaluateMember(expr: MemberExpression): Promise<RuntimeValue> {
    const obj = await this.evaluateExpression(expr.object);

    if (typeof obj === 'object' && obj !== null) {
      return (obj as any)[expr.property] ?? null;
    }

    return null;
  }

  private async evaluateIndex(expr: IndexExpression): Promise<RuntimeValue> {
    const obj = await this.evaluateExpression(expr.object);
    const index = await this.evaluateExpression(expr.index);

    if (Array.isArray(obj) && typeof index === 'number') {
      return obj[index] ?? null;
    }

    if (typeof obj === 'object' && obj !== null && typeof index === 'string') {
      return (obj as any)[index] ?? null;
    }

    return null;
  }

  private async evaluateArray(expr: ArrayLiteral): Promise<RuntimeValue> {
    const elements: RuntimeValue[] = [];
    for (const elem of expr.elements) {
      elements.push(await this.evaluateExpression(elem));
    }
    return elements;
  }

  private async evaluateObject(expr: ObjectLiteral): Promise<RuntimeValue> {
    const obj: any = Object.create(null);
    for (const prop of expr.properties) {
      obj[prop.key] = await this.evaluateExpression(prop.value);
    }
    return obj;
  }

  private async evaluatePrompt(expr: PromptExpression): Promise<string> {
    const parts: string[] = [];
    for (const content of expr.content) {
      const value = await this.evaluateExpression(content);
      parts.push(stringify(value));
    }
    const prompt = parts.join('');
    this.prompts.set(expr.name, prompt);
    this.currentEnv.define(expr.name, prompt);
    return prompt;
  }

  private async evaluateImageCall(expr: import('./types').ImageCallExpression): Promise<RuntimeValue> {
    let promptText = await this.evaluateExpression(expr.prompt) as string;
    if (typeof promptText !== 'string') {
      promptText = stringify(promptText);
    }

    let imagePaths: string[] | undefined;
    if (expr.images) {
      const raw = await this.evaluateExpression(expr.images);
      if (Array.isArray(raw)) {
        imagePaths = (raw as any[]).map(v => stringify(v));
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        imagePaths = [raw];
      }
    }

    let thinkingLevel: any | undefined;
    if (expr.config?.thinkingLevel) {
      const raw = await this.evaluateExpression(expr.config.thinkingLevel);
      if (typeof raw === 'object' && raw !== null) {
        thinkingLevel = raw as any;
      } else if (typeof raw === 'string') {
        thinkingLevel = raw;
      }
    }

    let cache: boolean | undefined;
    if (expr.config?.cache) {
      const raw = await this.evaluateExpression(expr.config.cache);
      if (typeof raw === 'boolean') {
        cache = raw;
      }
    }

    const response = await aiRuntime.callModel({
      model: this.resolveModelName(expr.modelName),
      prompt: promptText,
      temperature: expr.config?.temperature ? (await this.evaluateExpression(expr.config.temperature) as number) : undefined,
      maxTokens: expr.config?.max_tokens ? (await this.evaluateExpression(expr.config.max_tokens) as number) : undefined,
      topK: expr.config?.top_k ? (await this.evaluateExpression(expr.config.top_k) as number) : undefined,
      topP: expr.config?.top_p ? (await this.evaluateExpression(expr.config.top_p) as number) : undefined,
      ratio: expr.config?.ratio ? (await this.evaluateExpression(expr.config.ratio) as string) : undefined,
      size: expr.config?.size ? (await this.evaluateExpression(expr.config.size) as string) : undefined,
      images: imagePaths,
      thinkingLevel,
      cache,
    });

    return response.text;
  }

  private async evaluateModelCall(expr: import('./types').ModelCallExpression): Promise<RuntimeValue> {
    let promptText = await this.evaluateExpression(expr.prompt) as string;
    if (typeof promptText !== 'string') {
      promptText = stringify(promptText);
    }

    let imagePaths: string[] | undefined;
    if (expr.images) {
      const raw = await this.evaluateExpression(expr.images);
      if (Array.isArray(raw)) {
        imagePaths = (raw as any[]).map(v => stringify(v));
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        imagePaths = [raw];
      }
    }

    let thinkingLevel: any | undefined;
    if (expr.config?.thinkingLevel) {
      const raw = await this.evaluateExpression(expr.config.thinkingLevel);
      if (typeof raw === 'object' && raw !== null) {
        thinkingLevel = raw as any;
      } else if (typeof raw === 'string') {
        thinkingLevel = raw;
      }
    }

    let cache: boolean | undefined;
    if (expr.config?.cache) {
      const raw = await this.evaluateExpression(expr.config.cache);
      if (typeof raw === 'boolean') {
        cache = raw;
      }
    }

    let search: boolean | undefined;
    if (expr.config?.search) {
      const raw = await this.evaluateExpression(expr.config.search);
      if (typeof raw === 'boolean') {
        search = raw;
      } else if (typeof raw === 'string') {
        // Backwards compatibility for truthy string values
        search = raw === 'google' || raw === 'true';
      }
    }

    const response = await aiRuntime.callModel({
      model: this.resolveModelName(expr.modelName),
      prompt: promptText,
      temperature: expr.config?.temperature ? (await this.evaluateExpression(expr.config.temperature) as number) : undefined,
      maxTokens: expr.config?.max_tokens ? (await this.evaluateExpression(expr.config.max_tokens) as number) : undefined,
      images: imagePaths,
      thinkingLevel,
      cache,
      search,
    });

    return response.text;
  }

  private async evaluateStructuredOutput(expr: StructuredOutputExpression): Promise<RuntimeValue> {
    const inputVal = await this.evaluateExpression(expr.modelCall);
    const schemaObj: any = {};

    for (const [key, typeAnnotation] of Object.entries(expr.schema)) {
      schemaObj[key] = (typeAnnotation as any).name || 'string';
    }

    if (typeof inputVal === 'string') {
      const structured = await aiRuntime.parseStructuredOutput(inputVal, schemaObj);
      return structured;
    }
    return inputVal;
  }

private async evaluateToolCall(expr: ToolCallExpression): Promise<RuntimeValue> {
    const sensitiveBuiltins = ['exec', 'spawn'];
    if (sensitiveBuiltins.includes(expr.functionName)) {
      throw new Error(`Security Violation: Automated execution of sensitive tool "${expr.functionName}" is forbidden.`);
    }

    let fn: RuntimeValue;
    if (this.currentEnv.exists(expr.functionName)) {
      fn = this.currentEnv.get(expr.functionName);
    } else {
      const custom = this.getCustomTool(expr.functionName);
      if (!custom) {
        throw new Error(`Tool not found: ${expr.functionName}`);
      }
      fn = custom;
    }

    if (typeof fn !== 'object' || !fn || (fn as any).type !== 'function') {
      throw new Error(`Tool not found: ${expr.functionName}`);
    }

    if ((fn as any).name === 'exec' || (fn as any).name === 'spawn' || ((fn as any).isBuiltin && sensitiveBuiltins.includes((fn as any).name))) {
      throw new Error(`Security Violation: Automated execution of sensitive tool "${(fn as any).name || expr.functionName}" is forbidden.`);
    }

    const args: RuntimeValue[] = [];
    for (const arg of expr.arguments) {
      args.push(await this.evaluateExpression(arg));
    }

    return await this.callSesiFunction(fn as RuntimeFunction, args);
  }

  public async callSesiFunction(fn: RuntimeFunction, args: RuntimeValue[]): Promise<RuntimeValue> {
    if (fn.isBuiltin && fn.builtin) {
      return await fn.builtin(...args);
    }

    if (fn.isAsync) {
      const InterpreterClass = this.constructor as any;
      const subInterpreter = new InterpreterClass(this.scriptDir, {
        safeMode: this.safeMode,
        allowLocalFs: this.allowLocalFs,
        raw: this.raw,
        allowedPaths: [...this.allowedPaths],
        args: [...this.args]
      });
      subInterpreter.prompts = new Map(this.prompts);
      subInterpreter.memory = new Map(this.memory);

      const promise = subInterpreter.callSesiFunction({
        ...fn,
        isAsync: false
      }, args);

      return {
        type: 'promise',
        promise
      } as any;
    }

    // User-defined function
    const callEnv = new Environment(fn.closure);

    // Bind parameters
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      const value = i < args.length ? args[i] : (param.defaultValue ? await this.evaluateExpression(param.defaultValue) : null);
      callEnv.define(param.name, value);
    }

    const previous = this.currentEnv;
    this.currentEnv = callEnv;

    try {
      await this.executeBlock(fn.body, callEnv);
      return null;
    } catch (e) {
      if (e instanceof ReturnValue) {
        return e.value;
      }
      throw e;
    } finally {
      this.currentEnv = previous;
    }
  }

  private async executeExport(stmt: import('./types').ExportStatement): Promise<void> {
    await this.executeStatement(stmt.statement);
    const name = stmt.statement.name;
    const val = this.currentEnv.get(name);
    this.exports.set(name, val);
  }

  private async executeImport(stmt: import('./types').ImportStatement): Promise<void> {
    const source = stmt.source;
    let moduleExports: Map<string, RuntimeValue> | null = null;

    if (source.startsWith('std/')) {
      moduleExports = this.loadStdModule(source);
    } else {
      const fs = require('fs');
      const resolvedPath = this.resolveModulePath(source);

      if (!resolvedPath) {
        const searchedDirs: string[] = [];
        const os = require('os');
        const path = require('path');
        if (this.scriptDir) searchedDirs.push(this.scriptDir);
        searchedDirs.push(process.cwd());
        if (this.safeMode !== true) {
          const sesiPath = process.env.SESI_PATH || '';
          if (sesiPath) {
            const sep = process.platform === 'win32' ? ';' : ':';
            sesiPath.split(sep).filter(Boolean).forEach(p => searchedDirs.push(p));
          }
          searchedDirs.push(path.join(os.homedir(), '.sesi', 'lib'));
        }
        throw new Error(
          `Module not found: "${source}"\nSearched in:\n  ${searchedDirs.join('\n  ')}\n` +
          `Tip: add a folder to SESI_PATH, or place shared modules in ~/.sesi/lib`
        );
      }

      if (this.safeMode === true) {
        const path = require('path');
        const isSafe = (dir: string) => {
          const relative = path.relative(dir, resolvedPath);
          return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
        };
        const allowed = [process.cwd()];
        if (this.scriptDir) allowed.push(this.scriptDir);
        if (!allowed.some(isSafe)) {
          throw new Error(`Security Violation: Import path "${resolvedPath}" lies outside allowed directories.`);
        }
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const path = require('path');
      const { Lexer } = require('./lexer');
      const { Parser } = require('./parser');
      const lexer = new Lexer(content);
      const parser = new Parser(lexer.scanTokens());
      const program = parser.parse();

      // Sub-interpreter inherits the resolved module's own directory so its imports also resolve correctly
      const subInterpreter = new Interpreter(path.dirname(resolvedPath), {
        safeMode: this.safeMode,
        allowLocalFs: this.allowLocalFs,
        allowedPaths: this.allowedPaths,
        args: this.args
      });
      await subInterpreter.interpret(program);
      moduleExports = subInterpreter.exports;
    }

    if (!moduleExports) {
      throw new Error(`Failed to load module: ${source}`);
    }

    if (stmt.names.length === 1 && stmt.names[0] === stmt.names[0].toLowerCase() && !moduleExports.has(stmt.names[0])) {
      const nsObj: any = {};
      for (const [key, val] of moduleExports.entries()) {
        nsObj[key] = val;
      }
      this.currentEnv.define(stmt.names[0], nsObj);
    } else {
      for (const name of stmt.names) {
        if (!moduleExports.has(name)) {
          throw new Error(`Module "${source}" does not export "${name}"`);
        }
        this.currentEnv.define(name, moduleExports.get(name)!);
      }
    }
  }

  private async evaluateConvert(expr: import('./types').ConvertExpression): Promise<RuntimeValue> {
    let fileInput = await this.evaluateExpression(expr.file);
    if (typeof fileInput !== 'string') {
      fileInput = stringify(fileInput);
    }

    const conversionType = expr.conversionType.toLowerCase();

    // Evaluate config
    let fileType: string | undefined;
    let outputType: string | undefined;

    if (expr.config) {
      if (expr.config.file_type) {
        const ft = await this.evaluateExpression(expr.config.file_type);
        if (typeof ft === 'string') fileType = ft.toLowerCase();
      }
      if (expr.config.output_type) {
        const ot = await this.evaluateExpression(expr.config.output_type);
        if (typeof ot === 'string') outputType = ot.toLowerCase();
      }
    }

    // Determine if fileInput is a valid local file path
    let isFilePath = false;
    let absoluteInputPath = '';
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    try {
      absoluteInputPath = ensureSafePath(fileInput, this);
      if (fs.existsSync(absoluteInputPath) && fs.statSync(absoluteInputPath).isFile()) {
        isFilePath = true;
      }
    } catch (e) {
      // Not a valid file path or path traversal block
    }

    if (isFilePath && !fileType) {
      fileType = path.extname(absoluteInputPath).slice(1).toLowerCase();
    }

    if (!fileType) {
      throw new Error(`Conversion file_type is missing or could not be determined.`);
    }
    if (!outputType) {
      throw new Error(`Conversion output_type is required.`);
    }

    // Determine output file path if input is a file path
    let absoluteOutputPath = '';
    let relativeOutputPath = '';
    if (isFilePath) {
      const dir = path.dirname(absoluteInputPath);
      const ext = path.extname(absoluteInputPath);
      const name = path.basename(absoluteInputPath, ext);
      absoluteOutputPath = path.join(dir, `${name}.${outputType}`);
      relativeOutputPath = path.join(path.dirname(fileInput), `${name}.${outputType}`);
    }

    const hasCommand = (cmd: string): boolean => {
      try {
        const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    };

    const isSafe = !this.safeMode;

    if (conversionType === 'doc') {
      // 1. Text/Document conversion
      let content = '';
      if (isFilePath) {
        content = fs.readFileSync(absoluteInputPath, 'utf8');
      } else {
        content = fileInput;
      }

      // Check for native CLI pandoc if allowed and available
      if (isSafe && hasCommand('pandoc') && isFilePath) {
        try {
          execSync(`pandoc "${absoluteInputPath}" -o "${absoluteOutputPath}"`);
          return relativeOutputPath;
        } catch (e: any) {
          // Fallback
        }
      }

      // Pure JS native fallback for common formats
      let converted: string | null = null;
      const fType = fileType.trim();
      const oType = outputType.trim();

      if (fType === 'md' && oType === 'html') {
        converted = simpleMdToHtml(content);
      } else if (fType === 'csv' && oType === 'json') {
        converted = csvToJson(content);
      } else if (fType === 'json' && oType === 'csv') {
        converted = jsonToCsv(content);
      }

      if (converted === null) {
        // Use Gemini AI for general doc conversions
        const promptText = `Convert the following document content from ${fType} format to ${oType} format. Return ONLY the raw converted content. Do NOT include markdown code blocks (e.g. \`\`\`xml or \`\`\`json) or any explanations or extra characters.\n\nContent:\n${content}`;
        try {
          const response = await aiRuntime.callModel({
            model: 'gemini-3.1-flash-lite',
            prompt: promptText
          });
          converted = response.text.trim();
          // Strip leading/trailing code block markers if Gemini returned them
          if (converted.startsWith('```')) {
            const lines = converted.split('\n');
            if (lines[0].startsWith('```') && lines[lines.length - 1] === '```') {
              converted = lines.slice(1, -1).join('\n');
            }
          }
        } catch (err: any) {
          throw new Error(`Document conversion failed: AI converter unavailable and no local converter found. ${err.message}`);
        }
      }

      if (isFilePath) {
        fs.writeFileSync(absoluteOutputPath, converted, 'utf8');
        return relativeOutputPath;
      } else {
        return converted;
      }
    }

    if (conversionType === 'media' || conversionType === 'audio') {
      if (!isFilePath) {
        throw new Error(`Media/Audio conversion requires a file path input.`);
      }

      if (!isSafe) {
        throw new Error(`Security Violation: Command line media conversion is disabled in safe mode.`);
      }

      if (conversionType === 'audio' || fileType === 'wav' || fileType === 'mp3' || fileType === 'ogg' || fileType === 'flac' || outputType === 'wav' || outputType === 'mp3' || outputType === 'ogg' || outputType === 'flac') {
        if (!hasCommand('ffmpeg')) {
          throw new Error(`ffmpeg CLI is required for audio/media conversion but was not found in PATH.`);
        }
        try {
          execSync(`ffmpeg -y -i "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'ignore' });
          return relativeOutputPath;
        } catch (e: any) {
          throw new Error(`ffmpeg conversion failed: ${e.message}`);
        }
      } else {
        // Image/Video media conversion
        let convertedWithImageMagick = false;
        if (hasCommand('magick')) {
          try {
            execSync(`magick "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'ignore' });
            convertedWithImageMagick = true;
          } catch {}
        } else if (hasCommand('convert')) {
          try {
            execSync(`convert "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'ignore' });
            convertedWithImageMagick = true;
          } catch {}
        }

        if (convertedWithImageMagick) {
          return relativeOutputPath;
        }

        // Check if ffmpeg can do it (e.g. for image sequences or videos)
        if (hasCommand('ffmpeg')) {
          try {
            execSync(`ffmpeg -y -i "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'ignore' });
            return relativeOutputPath;
          } catch {}
        }

        throw new Error(`No image/media conversion tool (magick/convert or ffmpeg) found or execution failed.`);
      }
    }

    throw new Error(`Unsupported conversion type: ${conversionType}`);
  }

  private async evaluateAwait(expr: import('./types').AwaitExpression): Promise<RuntimeValue> {
    const val = await this.evaluateExpression(expr.expression);
    if (typeof val === 'object' && val !== null && (val as any).type === 'promise') {
      return await (val as any).promise;
    }
    return val;
  }

  public loadStdModule(source: string): Map<string, RuntimeValue> | null {
    const exports = new Map<string, RuntimeValue>();
    if (source === 'std/math') {
      exports.set('PI', Math.PI);
      exports.set('E', Math.E);
      
      const mathFns = ['sin', 'cos', 'tan', 'sqrt', 'floor', 'ceil', 'abs', 'pow', 'log', 'exp'];
      for (const name of mathFns) {
        exports.set(name, {
          type: 'function',
          name,
          params: name === 'pow' ? [{ name: 'x' }, { name: 'y' }] : [{ name: 'x' }],
          body: {} as any,
          closure: {} as any,
          isBuiltin: true,
          builtin: (...args: RuntimeValue[]): RuntimeValue => {
            const x = typeof args[0] === 'number' ? args[0] : 0;
            if (name === 'pow') {
              const y = typeof args[1] === 'number' ? args[1] : 0;
              return Math.pow(x, y);
            }
            return (Math as any)[name](x);
          }
        });
      }
      return exports;
    } else if (source === 'std/time') {
      exports.set('now', {
        type: 'function',
        name: 'now',
        params: [],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => Date.now()
      });
      exports.set('sleep', {
        type: 'function',
        name: 'sleep',
        params: [{ name: 'ms' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
          const [ms] = args;
          const duration = typeof ms === 'number' ? ms : 0;
          await new Promise(resolve => setTimeout(resolve, duration));
          return null;
        }
      });
      exports.set('format', {
        type: 'function',
        name: 'format',
        params: [{ name: 'timestamp' }, { name: 'options' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const t = typeof args[0] === 'number' ? args[0] : Date.now();
          const opts = (args[1] && typeof args[1] === 'object' ? args[1] : {}) as any;
          
          const locale = opts.locale || 'en-US';
          const formatOptions: Intl.DateTimeFormatOptions = {};
          
          if (opts.timeZone) formatOptions.timeZone = opts.timeZone;
          if (opts.dateStyle) formatOptions.dateStyle = opts.dateStyle;
          if (opts.timeStyle) formatOptions.timeStyle = opts.timeStyle;
          if (opts.hour12 !== undefined) formatOptions.hour12 = opts.hour12;
          
          if (opts.year) formatOptions.year = opts.year;
          if (opts.month) formatOptions.month = opts.month;
          if (opts.day) formatOptions.day = opts.day;
          if (opts.hour) formatOptions.hour = opts.hour;
          if (opts.minute) formatOptions.minute = opts.minute;
          if (opts.second) formatOptions.second = opts.second;

          try {
            return new Date(t).toLocaleString(locale, formatOptions);
          } catch (e: any) {
            return new Date(t).toLocaleString();
          }
        }
      });
      return exports;
    } else if (source === 'std/json') {
      exports.set('stringify', {
        type: 'function',
        name: 'stringify',
        params: [{ name: 'val' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const [val] = args;
          return JSON.stringify(val);
        }
      });
      exports.set('parse', {
        type: 'function',
        name: 'parse',
        params: [{ name: 'str' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const [str] = args;
          if (typeof str !== 'string') return null;
          try {
            return stripPrototypes(JSON.parse(str));
          } catch (e) {
            return null;
          }
        }
      });
      return exports;
    } else if (source === 'std/db') {
      exports.set('db_open', {
        type: 'function',
        name: 'db_open',
        params: [{ name: 'filename' }, { name: 'password' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const [filenameVal, passwordVal] = args;
          if (typeof filenameVal !== 'string' || filenameVal.trim() === '') {
            throw new Error('db_open expects a non-empty string filename');
          }
          if (passwordVal !== undefined && typeof passwordVal !== 'string') {
            throw new Error('db_open expects a string as the second parameter (password)');
          }
          const password = (passwordVal !== undefined && typeof passwordVal === 'string') ? passwordVal : null;
          const resolvedPath = ensureSafePath(filenameVal, this);

          const dbObj: Record<string, RuntimeValue> = Object.create(null);
          
          dbObj.collection = {
            type: 'function',
            name: 'collection',
            params: [{ name: 'colName' }],
            body: {} as any,
            closure: {} as any,
            isBuiltin: true,
            builtin: (...colArgs: RuntimeValue[]): RuntimeValue => {
              const [colNameVal] = colArgs;
              if (typeof colNameVal !== 'string' || colNameVal.trim() === '') {
                throw new Error('collection expects a non-empty string collection name');
              }
              const colName = colNameVal.trim();

              const helperReadDb = (): Record<string, any[]> => {
                if (!fs.existsSync(resolvedPath)) {
                  return Object.create(null);
                }
                try {
                  let content = fs.readFileSync(resolvedPath, 'utf8');
                  if (password) {
                    const parts = content.split(':');
                    if (parts.length === 2) {
                      const crypto = require('crypto');
                      const iv = Buffer.from(parts[0], 'hex');
                      const key = crypto.createHash('sha256').update(String(password)).digest();
                      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                      let decrypted = decipher.update(parts[1], 'hex', 'utf8');
                      decrypted += decipher.final('utf8');
                      content = decrypted;
                    } else {
                      throw new Error('Database file is not in encrypted format');
                    }
                  }
                  const parsed = JSON.parse(content);
                  return stripPrototypes(parsed) || Object.create(null);
                } catch (e) {
                  return Object.create(null);
                }
              };

              const helperWriteDb = (data: Record<string, any[]>): void => {
                let content = JSON.stringify(data, null, 2);
                if (password) {
                  const crypto = require('crypto');
                  const key = crypto.createHash('sha256').update(String(password)).digest();
                  const iv = crypto.randomBytes(16);
                  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
                  let encrypted = cipher.update(content, 'utf8', 'hex');
                  encrypted += cipher.final('hex');
                  content = iv.toString('hex') + ':' + encrypted;
                }
                fs.writeFileSync(resolvedPath, content, 'utf8');
              };

              const colObj: Record<string, RuntimeValue> = Object.create(null);

              colObj.insert = {
                type: 'function',
                name: 'insert',
                params: [{ name: 'doc' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: (...insertArgs: RuntimeValue[]): RuntimeValue => {
                  const [docVal] = insertArgs;
                  if (typeof docVal !== 'object' || docVal === null || Array.isArray(docVal)) {
                    throw new Error('insert expects a document object');
                  }
                  
                  const doc = stripPrototypes(JSON.parse(JSON.stringify(docVal)));
                  if (!doc._id) {
                    doc._id = Math.random().toString(36).substring(2, 11);
                  }

                  const dbData = helperReadDb();
                  if (!dbData[colName]) {
                    dbData[colName] = [];
                  }
                  dbData[colName].push(doc);
                  helperWriteDb(dbData);
                  return doc;
                }
              };

              const matchesQuery = (doc: Record<string, any>, query: Record<string, any>): boolean => {
                for (const [k, v] of Object.entries(query)) {
                  if (doc[k] !== v) return false;
                }
                return true;
              };

              colObj.find = {
                type: 'function',
                name: 'find',
                params: [{ name: 'query', defaultValue: null as any }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: (...findArgs: RuntimeValue[]): RuntimeValue => {
                  const [queryVal] = findArgs;
                  const query = (queryVal && typeof queryVal === 'object' && !Array.isArray(queryVal)) 
                    ? queryVal as Record<string, any> 
                    : null;

                  const dbData = helperReadDb();
                  const docs = dbData[colName] || [];
                  if (!query) {
                    return docs;
                  }
                  return docs.filter(doc => matchesQuery(doc, query));
                }
              };

              colObj.update = {
                type: 'function',
                name: 'update',
                params: [{ name: 'query' }, { name: 'updateObj' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: (...updateArgs: RuntimeValue[]): RuntimeValue => {
                  const [queryVal, updateObjVal] = updateArgs;
                  if (typeof queryVal !== 'object' || queryVal === null || Array.isArray(queryVal)) {
                    throw new Error('update expects a query object as the first argument');
                  }
                  if (typeof updateObjVal !== 'object' || updateObjVal === null || Array.isArray(updateObjVal)) {
                    throw new Error('update expects an update object as the second argument');
                  }

                  const query = queryVal as Record<string, any>;
                  const updateObj = updateObjVal as Record<string, any>;

                  const dbData = helperReadDb();
                  const docs = dbData[colName] || [];
                  let updatedCount = 0;

                  for (const doc of docs) {
                    if (matchesQuery(doc, query)) {
                      for (const [k, v] of Object.entries(updateObj)) {
                        doc[k] = v;
                      }
                      updatedCount++;
                    }
                  }

                  if (updatedCount > 0) {
                    helperWriteDb(dbData);
                  }
                  return updatedCount;
                }
              };

              colObj.delete = {
                type: 'function',
                name: 'delete',
                params: [{ name: 'query' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: (...deleteArgs: RuntimeValue[]): RuntimeValue => {
                  const [queryVal] = deleteArgs;
                  if (typeof queryVal !== 'object' || queryVal === null || Array.isArray(queryVal)) {
                    throw new Error('delete expects a query object');
                  }

                  const query = queryVal as Record<string, any>;
                  const dbData = helperReadDb();
                  const docs = dbData[colName] || [];
                  
                  const remaining = docs.filter(doc => !matchesQuery(doc, query));
                  const deletedCount = docs.length - remaining.length;

                  if (deletedCount > 0) {
                    dbData[colName] = remaining;
                    helperWriteDb(dbData);
                  }
                  return deletedCount;
                }
              };

              return colObj;
            }
          };

          return dbObj;
        }
      });
      return exports;
    }
    return null;
  }
}

function simpleMdToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>")
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<a')) {
        return line;
      }
      return `<p>${line}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function csvToJson(csv: string): string {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '[]';
  const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const obj: any = {};
    const currentline = lines[i].split(',').map(v => v.replace(/^["']|["']$/g, '').trim());
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j] || '';
    }
    result.push(obj);
  }
  return JSON.stringify(result, null, 2);
}

function jsonToCsv(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === undefined || row[header] === null ? '' : String(row[header]);
        const escaped = val.replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  } catch {
    return '';
  }
}