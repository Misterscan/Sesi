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
import * as path from 'path';
import { execSync } from 'child_process';
import { deflateSync } from 'zlib';
import { convert as htmlToPlainText } from 'html-to-text';
import { imageSize } from 'image-size';
import yaml from 'js-yaml';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { estimateTokenCost } from './token-pricing';

export class Interpreter {
  private globalEnv: Environment;
  private currentEnv: Environment;
  private prompts: Map<string, string> = new Map();
  private memory: Map<string, string> = new Map();
  private modelAliases: Map<string, string> = new Map();
  private customTools: Map<string, { fn: RuntimeFunction; description?: string }> = new Map();
  private lastModelUsage: RuntimeValue = null;
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

  public recordModelUsage(
    model: string,
    usage?: { inputTokens?: number; outputTokens?: number; thinkingTokens?: number },
    cached: boolean = false,
  ): void {
    const inputTokens = Math.max(0, Math.floor(usage?.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.floor(usage?.outputTokens ?? 0));
    const thinkingTokens = Math.max(0, Math.floor(usage?.thinkingTokens ?? 0));
    const billableOutputTokens = outputTokens + thinkingTokens;
    const estimate = estimateTokenCost(model, inputTokens, billableOutputTokens);
    this.lastModelUsage = {
      model: String(model).replace(/^models\//, ''),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      billable_output_tokens: billableOutputTokens,
      total_tokens: inputTokens + billableOutputTokens,
      cached,
      input_rate_per_million: estimate?.inputPerMillion ?? null,
      output_rate_per_million: estimate?.outputPerMillion ?? null,
      input_cost_usd: estimate?.inputCostUsd ?? null,
      output_cost_usd: estimate?.outputCostUsd ?? null,
      total_cost_usd: estimate?.totalCostUsd ?? null,
      pricing_source: estimate?.source ?? null,
      pricing_as_of: estimate?.asOf ?? null,
    };
  }

  public getLastModelUsage(): RuntimeValue {
    return this.lastModelUsage;
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
    const hasExtension = filePath.endsWith('.sesi');
    if (!hasExtension) filePath += '.sesi';

    const searchDirs: string[] = [];

    // 1. Script's own directory
    if (this.scriptDir) searchDirs.push(this.scriptDir);

    // 2. Current working directory
    searchDirs.push(process.cwd());

    // 3. Local third-party modules: ./sesi_modules
    searchDirs.push(path.join(process.cwd(), 'sesi_modules'));

    // 4. SESI_PATH environment variable (semicolon or colon separated)
    if (this.safeMode !== true) {
      const sesiPath = process.env.SESI_PATH || '';
      if (sesiPath) {
        const sep = process.platform === 'win32' ? ';' : ':';
        sesiPath.split(sep).filter(Boolean).forEach(p => searchDirs.push(p));
      }
    }

    // 5. Global library: ~/.sesi/lib
    if (this.safeMode !== true) {
      searchDirs.push(path.join(os.homedir(), '.sesi', 'lib'));
    }

    for (const dir of searchDirs) {
      // 1. Try directly as file
      const resolvedFile = path.resolve(dir, filePath);
      if (fs.existsSync(resolvedFile) && !fs.statSync(resolvedFile).isDirectory()) {
        return resolvedFile;
      }

      // 2. If it did not have an extension, try resolving as a directory module
      if (!hasExtension) {
        const dirPath = path.resolve(dir, source);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          const indexSesi = path.join(dirPath, 'index.sesi');
          if (fs.existsSync(indexSesi) && !fs.statSync(indexSesi).isDirectory()) {
            return indexSesi;
          }
          const mainSesi = path.join(dirPath, 'main.sesi');
          if (fs.existsSync(mainSesi) && !fs.statSync(mainSesi).isDirectory()) {
            return mainSesi;
          }
        }
      }
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
        case 'AllowStatement':
          await this.executeAllow(statement);
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
    const rawModelName = await this.evaluateExpression(expr.modelName);
    if (typeof rawModelName !== 'string' || rawModelName.trim() === '') {
      throw new Error('image() expects a model name string or string variable');
    }

    let promptText = await this.evaluateExpression(expr.prompt) as string;
    if (typeof promptText !== 'string') {
      promptText = stringify(promptText);
    }

    const resolvedConfig: Record<string, RuntimeValue> = Object.create(null);
    if (expr.config) {
      for (const [key, configExpr] of Object.entries(expr.config)) {
        resolvedConfig[key] = await this.evaluateExpression(configExpr);
      }
    }

    const getConfig = (...keys: string[]): RuntimeValue => {
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(resolvedConfig, k)) {
          return resolvedConfig[k];
        }
      }
      return null;
    };

    let imagePaths: string[] | undefined;
    {
      const raw = getConfig('images');
      if (Array.isArray(raw)) {
        imagePaths = (raw as any[]).map(v => stringify(v));
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        imagePaths = [raw];
      }
    }

    let thinkingLevel: any | undefined;
    {
      const raw = getConfig('thinkingLevel', 'thinking', 'effort', 'reasoning');
      if (typeof raw === 'object' && raw !== null) {
        thinkingLevel = raw as any;
      } else if (typeof raw === 'string') {
        thinkingLevel = raw;
      }
    }

    let cache: boolean | undefined;
    {
      const raw = getConfig('cache', 'cached');
      if (typeof raw === 'boolean') {
        cache = raw;
      }
    }

    const temperatureRaw = getConfig('temperature', 'temp');
    const maxTokensRaw = getConfig('max_tokens', 'maxTokens', 'maxT');
    const topKRaw = getConfig('top_k', 'topK');
    const topPRaw = getConfig('top_p', 'topP');
    const ratioRaw = getConfig('ratio', 'imgRatio', 'imageRatio', 'aspectRatio');
    const sizeRaw = getConfig('size', 'imgSize', 'imageSize');

    const response = await aiRuntime.callModel({
      model: this.resolveModelName(rawModelName),
      prompt: promptText,
      temperature: typeof temperatureRaw === 'number' ? temperatureRaw : undefined,
      maxTokens: typeof maxTokensRaw === 'number' ? maxTokensRaw : undefined,
      topK: typeof topKRaw === 'number' ? topKRaw : undefined,
      topP: typeof topPRaw === 'number' ? topPRaw : undefined,
      ratio: typeof ratioRaw === 'string' ? ratioRaw : undefined,
      size: typeof sizeRaw === 'string' ? sizeRaw : undefined,
      images: imagePaths,
      thinkingLevel,
      cache,
    });

    return response.text;
  }

  private async evaluateModelCall(expr: import('./types').ModelCallExpression): Promise<RuntimeValue> {
    const rawModelName = await this.evaluateExpression(expr.modelName);
    if (typeof rawModelName !== 'string' || rawModelName.trim() === '') {
      throw new Error('model() expects a model name string or string variable');
    }

    let promptText = await this.evaluateExpression(expr.prompt) as string;
    if (typeof promptText !== 'string') {
      promptText = stringify(promptText);
    }

    const resolvedConfig: Record<string, RuntimeValue> = Object.create(null);
    if (expr.config) {
      for (const [key, configExpr] of Object.entries(expr.config)) {
        resolvedConfig[key] = await this.evaluateExpression(configExpr);
      }
    }

    const getConfig = (...keys: string[]): RuntimeValue => {
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(resolvedConfig, k)) {
          return resolvedConfig[k];
        }
      }
      return null;
    };

    let imagePaths: string[] | undefined;
    const imageConfig = getConfig('images');
    if (imageConfig !== null) {
      const raw = imageConfig;
      if (Array.isArray(raw)) {
        imagePaths = (raw as any[]).map(v => stringify(v));
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        imagePaths = [raw];
      }
    }

    let thinkingLevel: any | undefined;
    {
      const raw = getConfig('thinkingLevel', 'thinking', 'effort', 'reasoning');
      if (typeof raw === 'object' && raw !== null) {
        thinkingLevel = raw as any;
      } else if (typeof raw === 'string') {
        thinkingLevel = raw;
      }
    }

    let cache: boolean | undefined;
    {
      const raw = getConfig('cache', 'cached');
      if (typeof raw === 'boolean') {
        cache = raw;
      }
    }

    let search: boolean | undefined;
    {
      const raw = getConfig('search', 'grounding');
      if (typeof raw === 'boolean') {
        search = raw;
      } else if (typeof raw === 'string') {
        // Backwards compatibility for truthy string values
        search = raw === 'google' || raw === 'true';
      }
    }

    let stream: any | undefined;
    {
      const raw = getConfig('stream', 'onChunk', 'on_chunk');
      if (typeof raw === 'boolean') {
        stream = raw;
      } else if (typeof raw === 'function') {
        stream = raw;
      } else if (typeof raw === 'object' && raw !== null && (raw as any).type === 'function') {
        const sesiFn = raw as RuntimeFunction;
        stream = async (chunk: string) => {
          await this.callSesiFunction(sesiFn, [chunk]);
        };
      }
    }

    let tools: any[] | undefined;
    {
      const raw = getConfig('tools', 'toolSchemas', 'tool_schemas');
      if (Array.isArray(raw)) {
        tools = raw as any[];
      }
    }

    const temperatureRaw = getConfig('temperature', 'temp');
    const maxTokensRaw = getConfig('max_tokens', 'maxTokens', 'maxT');
    const topKRaw = getConfig('top_k', 'topK');
    const topPRaw = getConfig('top_p', 'topP');
    const systemPromptRaw = getConfig('system', 'system_prompt', 'systemPrompt');

    const resolvedModelName = this.resolveModelName(rawModelName);
    const response = await aiRuntime.callModel({
      model: resolvedModelName,
      prompt: promptText,
      temperature: typeof temperatureRaw === 'number' ? temperatureRaw : undefined,
      maxTokens: typeof maxTokensRaw === 'number' ? maxTokensRaw : undefined,
      topK: typeof topKRaw === 'number' ? topKRaw : undefined,
      topP: typeof topPRaw === 'number' ? topPRaw : undefined,
      systemPrompt: typeof systemPromptRaw === 'string' ? systemPromptRaw : undefined,
      images: imagePaths,
      thinkingLevel,
      cache,
      search,
      stream,
      tools,
    });

    this.recordModelUsage(resolvedModelName, response.usage, response.cached === true);
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
    const sensitiveBuiltins = ['exec', 'spawn', 'python', 'js'];
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

    if ((fn as any).name === 'exec' || (fn as any).name === 'spawn' || (fn as any).name === 'python' || (fn as any).name === 'js' || ((fn as any).isBuiltin && sensitiveBuiltins.includes((fn as any).name))) {
      throw new Error(`Security Violation: Automated execution of sensitive tool "${(fn as any).name || expr.functionName}" is forbidden.`);
    }

    const args: RuntimeValue[] = [];
    for (const arg of expr.arguments) {
      args.push(await this.evaluateExpression(arg));
    }

    return await this.callSesiFunction(fn as RuntimeFunction, args);
  }

  public async callSesiFunction(fn: RuntimeFunction, args: RuntimeValue[]): Promise<RuntimeValue> {
    if ((fn as any)._proto) {
      const { VM } = require('./vm');
      const vm = new VM(this.scriptDir, {
        safeMode: this.safeMode,
        allowLocalFs: this.allowLocalFs,
        allowedPaths: this.allowedPaths,
        args: this.args
      });
      if ((vm as any).interpreter) {
        for (const [k, v] of this.modelAliases.entries()) {
          (vm as any).interpreter.setModelAlias(k, v);
        }
      }
      for (const [k, v] of this.globalEnv.getValues().entries()) {
        (vm as any).globals.set(k, v);
      }
      (vm as any).prompts = new Map(this.prompts);
      (vm as any).memory = new Map(this.memory);

      const res = await vm.callCompiledFunction(fn, args);

      for (const [k, v] of (vm as any).memory.entries()) {
        this.memory.set(k, v);
      }
      for (const [k, v] of (vm as any).globals.entries()) {
        this.globalEnv.define(k, v);
      }
      return res;
    }

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
      for (const [k, v] of this.globalEnv.getValues().entries()) {
        subInterpreter.globalEnv.define(k, v);
      }
      for (const [k, v] of this.modelAliases.entries()) {
        subInterpreter.setModelAlias(k, v);
      }
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

  private async getModuleExports(source: string): Promise<Map<string, RuntimeValue>> {
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

      const subInterpreter = new Interpreter(path.dirname(resolvedPath), {
        safeMode: this.safeMode,
        allowLocalFs: this.allowLocalFs,
        allowedPaths: this.allowedPaths,
        args: this.args
      });
      for (const [k, v] of this.modelAliases.entries()) {
        subInterpreter.setModelAlias(k, v);
      }
      await subInterpreter.interpret(program);
      moduleExports = subInterpreter.exports;
    }

    if (!moduleExports) {
      throw new Error(`Failed to load module: ${source}`);
    }

    return moduleExports;
  }

  private async executeImport(stmt: import('./types').ImportStatement): Promise<void> {
    const moduleExports = await this.getModuleExports(stmt.source);

    if (stmt.names.length === 1 && stmt.names[0] === stmt.names[0].toLowerCase() && !moduleExports.has(stmt.names[0])) {
      const nsObj: any = {};
      for (const [key, val] of moduleExports.entries()) {
        nsObj[key] = val;
      }
      this.currentEnv.define(stmt.names[0], nsObj);
    } else {
      for (const name of stmt.names) {
        if (!moduleExports.has(name)) {
          throw new Error(`Module "${stmt.source}" does not export "${name}"`);
        }
        this.currentEnv.define(name, moduleExports.get(name)!);
      }
    }
  }

  private async executeAllow(stmt: import('./types').AllowStatement): Promise<void> {
    const moduleExports = await this.getModuleExports(stmt.source);

    if (typeof stmt.binding === 'string') {
      const nsObj: any = {};
      for (const [key, val] of moduleExports.entries()) {
        nsObj[key] = val;
      }
      this.currentEnv.define(stmt.binding, nsObj);
    } else {
      for (const name of stmt.binding) {
        if (!moduleExports.has(name)) {
          throw new Error(`Module "${stmt.source}" does not export "${name}"`);
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

    try {
      absoluteInputPath = ensureSafePath(fileInput, this);
      if (fs.existsSync(absoluteInputPath) && fs.statSync(absoluteInputPath).isFile()) {
        isFilePath = true;
      }
    } catch (e: any) {
      // Re-throw security violations with a clear message
      if (e.message && e.message.includes('Security Violation')) {
        throw new Error(`${e.message}\n\nHint: Run with -l flag and -a <directory> to allow access to paths outside the workspace.\nExample: sesi ${process.argv[2] || 'script.sesi'} -l -a ${require('path').dirname(require('path').resolve(fileInput))}`);
      }
      // Otherwise the input is just raw text content, not a file path — that's fine
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

    const getCommandPath = (cmd: string): string => {
      if (process.platform === 'win32') {
        try {
          const res = execSync(`where ${cmd}`, { encoding: 'utf8' }).split('\n')[0].trim();
          if (res) return res;
        } catch {}
      } else {
        try {
          const res = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
          if (res) return res;
        } catch {}
        if (process.platform === 'darwin') {
          const fs = require('fs');
          if (fs.existsSync(`/opt/homebrew/bin/${cmd}`)) return `/opt/homebrew/bin/${cmd}`;
          if (fs.existsSync(`/usr/local/bin/${cmd}`)) return `/usr/local/bin/${cmd}`;
        }
      }
      return cmd; // fallback
    };

    const hasCommand = (cmd: string): boolean => {
      const p = getCommandPath(cmd);
      if (p !== cmd) return true;
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
          const pandocPath = getCommandPath('pandoc');
          execSync(`"${pandocPath}" "${absoluteInputPath}" -o "${absoluteOutputPath}"`);
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
        converted = markdownToHtml(content);
      } else if (fType === 'html' && oType === 'md') {
        converted = htmlToMarkdown(content);
      } else if (fType === 'html' && oType === 'txt') {
        converted = htmlToText(content);
      } else if (fType === 'svg' && oType === 'html') {
        converted = svgToHtml(content);
      } else if (fType === 'html' && oType === 'svg') {
        converted = htmlToSvg(content);
      } else if (fType === 'svg' && oType === 'txt') {
        converted = xmlLikeToText(content);
      } else if (fType === 'csv' && oType === 'json') {
        converted = delimitedToJson(content, ',');
      } else if (fType === 'tsv' && oType === 'json') {
        converted = delimitedToJson(content, '\t');
      } else if (fType === 'json' && oType === 'csv') {
        converted = jsonToDelimited(content, ',');
      } else if (fType === 'json' && oType === 'tsv') {
        converted = jsonToDelimited(content, '\t');
      } else if (fType === 'json' && (oType === 'yaml' || oType === 'yml')) {
        converted = jsonToYaml(content);
      } else if ((fType === 'yaml' || fType === 'yml') && oType === 'json') {
        converted = yamlToJson(content);
      }

      if (converted === null) {
        // Use Gemini for general doc conversions
        const promptText = `Convert the following document content from ${fType} format to ${oType} format. Return ONLY the raw converted content. Do NOT include markdown code blocks (e.g. \`\`\`xml or \`\`\`json) or any explanations or extra characters.\n\nContent:\n${content}`;
        try {
          const response = await aiRuntime.callModel({
            model: 'gemini-3.6-flash',
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
          const ffmpegPath = getCommandPath('ffmpeg');
          execSync(`"${ffmpegPath}" -y -i "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'ignore' });
          return relativeOutputPath;
        } catch (e: any) {
          throw new Error(`ffmpeg conversion failed: ${e.message}`);
        }
      } else {
        // Image/Video media conversion
        let convertedWithImageMagick = false;
        let lastError = '';

        if (outputType === 'svg') {
          try {
            const svgContent = rasterImageFileToSvg(absoluteInputPath, fileType);
            fs.writeFileSync(absoluteOutputPath, svgContent, 'utf8');
            return relativeOutputPath;
          } catch (e: any) {
            lastError = e?.message || String(e);
          }
        }

        if (hasCommand('magick')) {
          try {
            const magickPath = getCommandPath('magick');
            execSync(`"${magickPath}" "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'pipe' });
            convertedWithImageMagick = true;
          } catch (e: any) { lastError = e.stderr?.toString()?.trim() || e.message; }
        } else if (hasCommand('convert')) {
          try {
            const convertPath = getCommandPath('convert');
            execSync(`"${convertPath}" "${absoluteInputPath}" "${absoluteOutputPath}"`, { stdio: 'pipe' });
            convertedWithImageMagick = true;
          } catch (e: any) { lastError = e.stderr?.toString()?.trim() || e.message; }
        }

        if (convertedWithImageMagick) {
          return relativeOutputPath;
        }

        if (fileType === 'svg' && (outputType === 'png' || outputType === 'jpg' || outputType === 'jpeg')) {
          try {
            await rasterizeSvgWithPlaywright(absoluteInputPath, absoluteOutputPath, outputType);
            return relativeOutputPath;
          } catch (e: any) {
            lastError = e?.message || String(e);
          }
        }

        // Check if ffmpeg can do it (e.g. for image sequences or videos)
        if (hasCommand('ffmpeg')) {
          try {
            const ffmpegPath = getCommandPath('ffmpeg');
            // Static image output types need special flags when source is animated/multi-frame
            const staticImageTypes = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'avif']);
            const extraFlags = staticImageTypes.has(outputType ?? '') ? '-frames:v 1 -update 1' : '';
            execSync(`"${ffmpegPath}" -y -i "${absoluteInputPath}" ${extraFlags} "${absoluteOutputPath}"`.trim(), { stdio: 'pipe' });
            return relativeOutputPath;
          } catch (e: any) { lastError = e.stderr?.toString()?.trim() || e.message; }
        }

        const hint = lastError ? `\nReason: ${lastError}` : '';
        throw new Error(`No image/media conversion tool (magick/convert or ffmpeg) found or execution failed.${hint}`);
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
    } else if (source === 'std/base64') {
      const toByteArray = (value: RuntimeValue): number[] | null => {
        if (!Array.isArray(value)) return null;
        const bytes: number[] = [];
        for (const item of value) {
          if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 255) {
            return null;
          }
          bytes.push(item);
        }
        return bytes;
      };

      exports.set('encode', {
        type: 'function',
        name: 'encode',
        params: [{ name: 'value' }, { name: 'mode', defaultValue: 'text' as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const [value, modeVal] = args;
          const mode = typeof modeVal === 'string' ? modeVal.toLowerCase() : 'text';

          if (mode === 'bytes') {
            const bytes = toByteArray(value);
            if (!bytes) return null;
            return Buffer.from(bytes).toString('base64');
          }

          if (mode === 'text') {
            if (typeof value !== 'string') return null;
            return Buffer.from(value, 'utf8').toString('base64');
          }

          return null;
        }
      });
      exports.set('decode', {
        type: 'function',
        name: 'decode',
        params: [{ name: 'base64_text' }, { name: 'mode', defaultValue: 'text' as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const [base64Text, modeVal] = args;
          if (typeof base64Text !== 'string') return null;
          const mode = typeof modeVal === 'string' ? modeVal.toLowerCase() : 'text';

          const compact = base64Text.replace(/\s+/g, '');
          if (compact === '') {
            if (mode === 'bytes') return [];
            if (mode === 'text') return '';
            return null;
          }

          // Accept standard and URL-safe Base64.
          const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
          const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded)) {
            return null;
          }

          try {
            const buffer = Buffer.from(padded, 'base64');
            const canonical = buffer.toString('base64').replace(/=+$/g, '');
            const incoming = padded.replace(/=+$/g, '');
            if (canonical !== incoming) {
              return null;
            }

            if (mode === 'bytes') {
              return Array.from(buffer.values());
            }
            if (mode === 'text') {
              return buffer.toString('utf8');
            }
            return null;
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
    } else if (source === 'std/theory') {
      const CHORD_MAP: Record<string, number[]> = {
        'M': [0, 4, 7], 'maj': [0, 4, 7],
        'm': [0, 3, 7], 'min': [0, 3, 7],
        'dim': [0, 3, 6], 'aug': [0, 4, 8],
        '7': [0, 4, 7, 10], 'M7': [0, 4, 7, 11], 'maj7': [0, 4, 7, 11],
        'm7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7]
      };
      const SCALE_MAP: Record<string, number[]> = {
        'major': [0, 2, 4, 5, 7, 9, 11],
        'minor': [0, 2, 3, 5, 7, 8, 10],
        'dorian': [0, 2, 3, 5, 7, 9, 10],
        'phrygian': [0, 1, 3, 5, 7, 8, 10],
        'lydian': [0, 2, 4, 6, 7, 9, 11],
        'mixolydian': [0, 2, 4, 5, 7, 9, 10],
        'locrian': [0, 1, 3, 5, 6, 8, 10]
      };
      const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      exports.set('chord', {
        type: 'function',
        name: 'chord',
        params: [{ name: 'root' }, { name: 'type', defaultValue: 'M' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const root = args[0];
          const type = args[1];
          const rootNote = stringify(root);
          const chordType = stringify(type);
          const intervals = CHORD_MAP[chordType] || [0];
          
          const match = rootNote.match(/^([A-G]#?)(\d)$/);
          if (!match) return [rootNote];
          const name = match[1];
          const octave = parseInt(match[2]);
          const baseIdx = NOTE_NAMES.indexOf(name);

          return intervals.map(interval => {
            let idx = baseIdx + interval;
            let oct = octave + Math.floor(idx / 12);
            return NOTE_NAMES[idx % 12] + oct;
          });
        }
      } as any);

      exports.set('scale', {
        type: 'function',
        name: 'scale',
        params: [{ name: 'root' }, { name: 'type', defaultValue: 'major' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const root = args[0];
          const type = args[1];
          const rootNote = stringify(root);
          const scaleType = stringify(type);
          const intervals = SCALE_MAP[scaleType] || [0];
          
          const match = rootNote.match(/^([A-G]#?)(\d)$/);
          if (!match) return [rootNote];
          const name = match[1];
          const octave = parseInt(match[2]);
          const baseIdx = NOTE_NAMES.indexOf(name);

          return intervals.map(interval => {
            let idx = baseIdx + interval;
            let oct = octave + Math.floor(idx / 12);
            return NOTE_NAMES[idx % 12] + oct;
          });
        }
      } as any);

      exports.set('transpose', {
        type: 'function',
        name: 'transpose',
        params: [{ name: 'notes' }, { name: 'steps' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const notes = args[0];
          const steps = args[1];
          const s = typeof steps === 'number' ? steps : 0;
          const noteList = Array.isArray(notes) ? notes : [notes];

          return noteList.map(n => {
            const noteStr = stringify(n);
            const match = noteStr.match(/^([A-G]#?)(\d)$/);
            if (!match) return noteStr;
            const name = match[1];
            const octave = parseInt(match[2]);
            const idx = NOTE_NAMES.indexOf(name) + s;
            const newName = NOTE_NAMES[((idx % 12) + 12) % 12];
            const newOctave = octave + Math.floor(idx / 12);
            return newName + newOctave;
          });
        }
      } as any);

      exports.set('duration', {
        type: 'function',
        name: 'duration',
        params: [{ name: 'minutes' }, { name: 'seconds' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const min = typeof args[0] === 'number' ? args[0] : 0;
          const sec = typeof args[1] === 'number' ? args[1] : 0;
          return (min * 60 + sec) * 1000;
        }
      } as any);

      exports.set('bar', {
        type: 'function',
        name: 'bar',
        params: [{ name: 'bars' }, { name: 'bpm' }, { name: 'beatsPerBar', defaultValue: 4 }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const bars = typeof args[0] === 'number' ? args[0] : 0;
          const bpm = (args.length > 1 && typeof args[1] === 'number') ? args[1] : 120;
          const beatsPerBar = (args.length > 2 && typeof args[2] === 'number') ? args[2] : 4;
          return bars * beatsPerBar * (60000 / bpm);
        }
      } as any);

      return exports;
    } else if (source === 'std/audio') {
      exports.set('beep', {
        type: 'function',
        name: 'beep',
        params: [{ name: 'freq' }, { name: 'ms' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
          const freq = typeof args[0] === 'number' ? args[0] : 440;
          const ms = typeof args[1] === 'number' ? args[1] : 200;
          const wav = generateWav(freq, ms, 'sine', { attack: 10, release: 10 });
          const tmp = path.join(process.cwd(), `.tmp_beep_${Date.now()}.wav`);
          fs.writeFileSync(tmp, wav);
          try {
            if (process.platform === 'darwin') execSync(`afplay "${tmp}"`);
            else if (process.platform === 'win32') execSync(`powershell -c "(New-Object Media.SoundPlayer '${tmp}').PlaySync()"`);
          } catch {} finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
          return null;
        }
      });
      exports.set('play', {
        type: 'function',
        name: 'play',
        params: [{ name: 'note' }, { name: 'ms' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
          const note = typeof args[0] === 'string' ? args[0] : 'C4';
          const ms = typeof args[1] === 'number' ? args[1] : 500;
          const opts = (args[2] && typeof args[2] === 'object' ? args[2] : {}) as any;
          const freq = getFrequency(note);
          const wav = generateWav(freq, ms, opts.type || 'sine', opts);
          const tmp = path.join(process.cwd(), `.tmp_play_${Date.now()}.wav`);
          fs.writeFileSync(tmp, wav);
          try {
            if (process.platform === 'darwin') execSync(`afplay "${tmp}"`);
            else if (process.platform === 'win32') execSync(`powershell -c "(New-Object Media.SoundPlayer '${tmp}').PlaySync()"`);
          } catch {} finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
          return null;
        }
      });
      exports.set('synth', {
        type: 'function',
        name: 'synth',
        params: [{ name: 'freq' }, { name: 'ms' }, { name: 'type' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (freq, ms, type, options): RuntimeValue => {
          const f = typeof freq === 'number' ? freq : (typeof freq === 'string' ? getFrequency(freq) : 440);
          const m = typeof ms === 'number' ? ms : 500;
          const t = typeof type === 'string' ? type : 'sine';
          const opts = (options && typeof options === 'object' ? options : {}) as any;
          return generateWav(f, m, t, opts).toString('base64');
        }
      });
      exports.set('save', {
        type: 'function',
        name: 'save',
        params: [{ name: 'path' }, { name: 'freq' }, { name: 'ms' }, { name: 'type' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath, freq, ms, type, options): RuntimeValue => {
          const f = typeof freq === 'number' ? freq : (typeof freq === 'string' ? getFrequency(freq) : 440);
          const m = typeof ms === 'number' ? ms : 500;
          const t = typeof type === 'string' ? type : 'sine';
          const opts = (options && typeof options === 'object' ? options : {}) as any;
          const wav = generateWav(f, m, t, opts);
          const absPath = ensureSafePath(stringify(filePath), this);
          fs.writeFileSync(absPath, wav);
          return true;
        }
      });
      exports.set('load', {
        type: 'function',
        name: 'load',
        params: [{ name: 'path' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath): RuntimeValue => {
          const absPath = ensureSafePath(stringify(filePath), this);
          if (!fs.existsSync(absPath)) throw new Error(`Audio file not found: ${filePath}`);
          const buffer = fs.readFileSync(absPath);
          // Very simple WAV parser (skips header to find data)
          const dataOffset = buffer.indexOf('data') + 4;
          if (dataOffset < 4) throw new Error('Invalid WAV file: data chunk not found');
          const dataSize = buffer.readUInt32LE(dataOffset);
          const samples = new Int16Array(buffer.buffer, buffer.byteOffset + dataOffset + 4, dataSize / 2);
          
          return {
            type: 'audio_sample',
            samples: Array.from(samples).map(s => s / 32767),
            sampleRate: 44100 // Assume 44.1k for now
          } as any;
        }
      });
      exports.set('kick', {
        type: 'function',
        name: 'kick',
        params: [{ name: 'ms', defaultValue: 300 }, { name: 'vol', defaultValue: 1.0 }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
            const ms = typeof args[0] === 'number' ? args[0] : 300;
            const vol = typeof args[1] === 'number' ? args[1] : 1.0;
            return generateWav(60, ms, 'kick', { vol }).toString('base64');
        }
      } as any);

      exports.set('snare', {
        type: 'function',
        name: 'snare',
        params: [{ name: 'ms', defaultValue: 200 }, { name: 'vol', defaultValue: 1.0 }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
            const ms = typeof args[0] === 'number' ? args[0] : 200;
            const vol = typeof args[1] === 'number' ? args[1] : 1.0;
            return generateWav(440, ms, 'snare', { vol }).toString('base64');
        }
      } as any);

      exports.set('hat', {
        type: 'function',
        name: 'hat',
        params: [{ name: 'ms', defaultValue: 50 }, { name: 'vol', defaultValue: 1.0 }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
            const ms = typeof args[0] === 'number' ? args[0] : 50;
            const vol = typeof args[1] === 'number' ? args[1] : 1.0;
            return generateWav(10000, ms, 'hat', { vol }).toString('base64');
        }
      } as any);

      exports.set('sf2', {
        type: 'function',
        name: 'sf2',
        params: [{ name: 'path' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
            const sf2Path = ensureSafePath(stringify(args[0]), this);
            const opts = (args[1] && typeof args[1] === 'object' ? args[1] : {}) as any;
            
            const inst = typeof opts.instrument === 'number' ? opts.instrument : 0;
            const chan = typeof opts.channel === 'number' ? opts.channel : 0;
            const gain = typeof opts.gain === 'number' ? opts.gain : 1.5;

            return {
                type: 'function',
                name: 'sf2_instrument',
                params: [{ name: 'note' }, { name: 'ms' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: (...innerArgs: RuntimeValue[]): RuntimeValue => {
                    return {
                        note: innerArgs[0],
                        ms: typeof innerArgs[1] === 'number' ? innerArgs[1] : 500,
                        is_sf2: true,
                        sf2_path: sf2Path,
                        instrument: inst,
                        channel: chan,
                        gain: gain
                    } as any;
                }
            } as any;
        }
      } as any);

      exports.set('sequence', {
        type: 'function',
        name: 'sequence',
        params: [{ name: 'path' }, { name: 'notes' }, { name: 'type' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (...args: RuntimeValue[]): RuntimeValue => {
          const filePath = args[0];
          const notesVal = args[1];
          const type = args[2];
          const options = args[3];
          if (!Array.isArray(notesVal)) throw new Error('sequence expects an array of notes');
          const t = typeof type === 'string' ? type : 'sine';
          const globalOpts = (options && typeof options === 'object' ? options : {}) as any;
          const sampleRate = 44100;
          
          let totalSamples = 0;
          const noteData = notesVal.map(val => {
            const n = val as any;

            if (n && typeof n === 'object' && n.type === 'audio_sample') {
                const samples = n.samples;
                const len = samples.length;
                totalSamples += len;
                return { isSample: true, samples: samples, opts: {} };
            }

            const rawNote = (typeof n === 'object' && n !== null && !Array.isArray(n)) ? (n.note || 'C4') : n;

            if (rawNote && typeof rawNote === 'object' && rawNote.type === 'audio_sample') {
                const samples = rawNote.samples;
                const len = samples.length;
                totalSamples += len;
                return { isSample: true, samples: samples, opts: n };
            }

            const ms = (typeof n === 'object' && n !== null && !Array.isArray(n) && typeof n.ms === 'number') ? n.ms : 500;
            const opts = (typeof n === 'object' && n !== null && !Array.isArray(n)) ? n : {};
            
            const notes = Array.isArray(rawNote) ? rawNote : [rawNote];
            const freqs = notes.map(note => (typeof note === 'number' ? note : getFrequency(stringify(note))));
            
            const samples = Math.floor(sampleRate * (ms / 1000));
            totalSamples += samples;
            return { freqs, samples, opts: { ...globalOpts, ...opts } };
          });

          const masterBufferL = new Float32Array(totalSamples);
          const masterBufferR = new Float32Array(totalSamples);
          let masterOffset = 0;

          for (const nd of noteData) {
            if (nd.isSample) {
                const vol = nd.opts.vol !== undefined ? nd.opts.vol : 1.0;
                const pan = nd.opts.pan !== undefined ? nd.opts.pan : 0.0;
                for (let i = 0; i < nd.samples.length; i++) {
                    const s = nd.samples[i] * vol;
                    masterBufferL[masterOffset + i] = s * (1.0 - Math.max(0, pan));
                    masterBufferR[masterOffset + i] = s * (1.0 - Math.max(0, -pan));
                }
                masterOffset += nd.samples.length;
                continue;
            }

            const attack = nd.opts.attack || 10;
            const release = nd.opts.release || 50;
            const attackSamples = Math.floor(sampleRate * (attack / 1000));
            const releaseSamples = Math.floor(sampleRate * (release / 1000));
            const vol = nd.opts.vol !== undefined ? nd.opts.vol : 1.0;
            const pan = nd.opts.pan !== undefined ? nd.opts.pan : 0.0;
            const cutoff = nd.opts.cutoff !== undefined ? nd.opts.cutoff : 20000;

            let lp_last = 0;
            const alpha = Math.min(1.0, (2 * Math.PI * cutoff) / sampleRate);

            for (let i = 0; i < nd.samples; i++) {
              let combinedSample = 0;
              const time = i / sampleRate;
              
              const freqs = nd.freqs || [];
              for (const freq of freqs) {
                let s = 0;
                const waveType = nd.opts.type || t;
                if (waveType === 'kick') {
                  const pitchEnv = Math.exp(-15.0 * time);
                  const f = 40 + 150 * pitchEnv;
                  s = Math.sin(2 * Math.PI * f * time);
                  if (i < 500) s += (Math.random() * 2 - 1) * Math.exp(-i / 100) * 0.5;
                } else if (waveType === 'snare') {
                  const body = Math.sin(2 * Math.PI * 180 * time) * Math.exp(-10.0 * time);
                  const noise = (Math.random() * 2 - 1) * Math.exp(-15.0 * time) * 0.6;
                  s = body + noise;
                } else if (waveType === 'hat') {
                  s = (Math.random() * 2 - 1) * Math.exp(-40.0 * time) * 0.5;
                } else if (waveType === 'clap') {
                  if (i < 4000) {
                    const offsets = [0, 441, 882, 1323];
                    for (const off of offsets) {
                      if (i >= off) {
                        const local_t = (i - off) / sampleRate;
                        s += (Math.random() * 2 - 1) * Math.exp(-50.0 * local_t) * 0.4;
                      }
                    }
                  }
                } else if (waveType === 'sine') s = Math.sin(2 * Math.PI * freq * time);
                else if (waveType === 'square') s = Math.sin(2 * Math.PI * freq * time) >= 0 ? 0.3 : -0.3;
                else if (waveType === 'saw') s = 0.6 * (2 * (time * freq - Math.floor(time * freq + 0.5)));
                else if (waveType === 'triangle') s = 0.6 * (2 * Math.abs(2 * (time * freq - Math.floor(time * freq + 0.5))) - 1);
                else if (waveType === 'noise') s = (Math.random() * 2 - 1) * 0.4;
                combinedSample += s;
              }
              
              if (freqs.length > 1) combinedSample = combinedSample / Math.sqrt(freqs.length);

              lp_last = lp_last + alpha * (combinedSample - lp_last);
              combinedSample = (cutoff < 19000) ? lp_last : combinedSample;

              let envelope = 1.0;
              if (i < attackSamples) envelope = i / attackSamples;
              else if (i > nd.samples - releaseSamples) envelope = (nd.samples - i) / releaseSamples;
              
              combinedSample = combinedSample * envelope * vol;

              masterBufferL[masterOffset + i] = combinedSample * (1.0 - Math.max(0, pan));
              masterBufferR[masterOffset + i] = combinedSample * (1.0 - Math.max(0, -pan));
            }
            masterOffset += nd.samples;
          }

          let peak = 0;
          for (let i = 0; i < totalSamples; i++) {
              peak = Math.max(peak, Math.abs(masterBufferL[i]), Math.abs(masterBufferR[i]));
          }
          const scale = peak > 0 ? (0.95 / peak) : 1.0;

          const buffer = Buffer.alloc(44 + totalSamples * 4);
          buffer.write('RIFF', 0);
          buffer.writeUInt32LE(36 + totalSamples * 4, 4);
          buffer.write('WAVE', 8);
          buffer.write('fmt ', 12);
          buffer.writeUInt32LE(16, 16);
          buffer.writeUInt16LE(1, 20);
          buffer.writeUInt16LE(2, 22);
          buffer.writeUInt32LE(sampleRate, 24);
          buffer.writeUInt32LE(sampleRate * 4, 28);
          buffer.writeUInt16LE(4, 32);
          buffer.writeUInt16LE(16, 34);
          buffer.write('data', 36);
          buffer.writeUInt32LE(totalSamples * 4, 40);

          for (let i = 0; i < totalSamples; i++) {
            const L = Math.max(-1, Math.min(1, masterBufferL[i] * scale));
            const R = Math.max(-1, Math.min(1, masterBufferR[i] * scale));
            buffer.writeInt16LE(Math.floor(L * 32767), 44 + i * 4);
            buffer.writeInt16LE(Math.floor(R * 32767), 44 + i * 4 + 2);
          }

          const absPath = ensureSafePath(stringify(filePath), this);
          fs.writeFileSync(absPath, buffer);
          return true;
        }
      } as any);
      exports.set('midi', {
        type: 'function',
        name: 'midi',
        params: [{ name: 'path' }, { name: 'tracks' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath: any, tracksVal: any): RuntimeValue => {
          const outPath = stringify(filePath);
          const absPath = ensureSafePath(outPath, this);
          if (!Array.isArray(tracksVal)) {
            throw new Error('midi expects an array of notes (track) or an array of tracks');
          }
          let tracksArray: any[];
          if (tracksVal.length > 0 && Array.isArray(tracksVal[0])) {
            tracksArray = tracksVal;
          } else {
            tracksArray = [tracksVal];
          }
          const midiBuffer = buildFullMidi(tracksArray);
          fs.writeFileSync(absPath, midiBuffer);
          return true;
        }
      } as any);
      exports.set('render', {
        type: 'function',
        name: 'render',
        params: [{ name: 'sf2_path' }, { name: 'tracks' }, { name: 'output_path' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
            const sf2Path = ensureSafePath(stringify(args[0]), this);
            const tracksVal = args[1];
            const outPath = stringify(args[2]);
            const opts = (args[3] && typeof args[3] === 'object' ? args[3] : {}) as any;

            if (!Array.isArray(tracksVal)) throw new Error('render expects an array of tracks');
            
            // 1. Build a full MIDI file from tracks
            const midiBuffer = buildFullMidi(tracksVal as any[]);
            const tmpMidi = path.join(process.cwd(), `.tmp_full_${Date.now()}.mid`);
            fs.writeFileSync(tmpMidi, midiBuffer);

            // 2. Render once
            let fluidsynthPath = 'fluidsynth';
            // ... (path detection logic from before, using a helper function for reuse would be better but keeping it here for simplicity)
            const commonPaths = process.platform === 'win32' ? [
                'C:\\Program Files\\fluidsynth\\bin\\fluidsynth.exe',
                'C:\\Program Files (x86)\\fluidsynth\\bin\\fluidsynth.exe'
            ] : ['/usr/local/bin/fluidsynth', '/usr/bin/fluidsynth', '/opt/homebrew/bin/fluidsynth'];
            const found = commonPaths.find(p => fs.existsSync(p));
            if (found) fluidsynthPath = `"${found}"`;
            
            const gain = typeof opts.gain === 'number' ? opts.gain : 1.2;
            const absOutPath = ensureSafePath(outPath, this);

            try {
                execSync(`${fluidsynthPath} -ni -g ${gain} -F "${absOutPath}" -q "${sf2Path}" "${tmpMidi}"`, { stdio: 'inherit' });
                
                // If path is "memory", return the sample instead of writing a file
                if (outPath === 'memory') {
                    const wavBuffer = fs.readFileSync(absOutPath);
                    const dataOffset = wavBuffer.indexOf('data') + 4;
                    const dataSize = wavBuffer.readUInt32LE(dataOffset);
                    const samples = new Int16Array(wavBuffer.buffer, wavBuffer.byteOffset + dataOffset + 4, dataSize / 2);
                    if (fs.existsSync(absOutPath)) fs.unlinkSync(absOutPath);
                    return {
                        type: 'audio_sample',
                        samples: Array.from(samples).map(s => s / 32767),
                        sampleRate: 44100
                    } as any;
                }
                return true;
            } finally {
                if (fs.existsSync(tmpMidi)) fs.unlinkSync(tmpMidi);
            }
        }
      } as any);

      exports.set('comp', {
        type: 'function',
        name: 'comp',
        params: [{ name: 'sf2_path' }, { name: 'track' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
            const sf2Path = ensureSafePath(stringify(args[0]), this);
            const track = args[1];
            const opts = (args[2] && typeof args[2] === 'object' ? args[2] : {}) as any;

            if (!Array.isArray(track)) throw new Error('comp expects an array of notes');
            
            const midiBuffer = buildFullMidi([track]);
            const tmpMidi = path.join(process.cwd(), `.tmp_comp_${Date.now()}.mid`);
            const tmpWav = path.join(process.cwd(), `.tmp_comp_${Date.now()}.wav`);
            fs.writeFileSync(tmpMidi, midiBuffer);

            let fluidsynthPath = 'fluidsynth';
            const commonPaths = process.platform === 'win32' ? [
                'C:\\Program Files\\fluidsynth\\bin\\fluidsynth.exe',
                'C:\\Program Files (x86)\\fluidsynth\\bin\\fluidsynth.exe'
            ] : ['/usr/local/bin/fluidsynth', '/usr/bin/fluidsynth', '/opt/homebrew/bin/fluidsynth'];
            const found = commonPaths.find(p => fs.existsSync(p));
            if (found) fluidsynthPath = `"${found}"`;
            
            const gain = typeof opts.gain === 'number' ? opts.gain : 2.0;

            try {
                execSync(`${fluidsynthPath} -ni -g ${gain} -F "${tmpWav}" -q "${sf2Path}" "${tmpMidi}"`, { stdio: 'ignore' });
                const wavBuffer = fs.readFileSync(tmpWav);
                const dataOffset = wavBuffer.indexOf('data') + 4;
                const dataSize = wavBuffer.readUInt32LE(dataOffset);
                const samples = new Int16Array(wavBuffer.buffer, wavBuffer.byteOffset + dataOffset + 4, dataSize / 2);
                
                return {
                    type: 'audio_sample',
                    samples: Array.from(samples).map(s => s / 32767),
                    sampleRate: 44100
                } as any;
            } finally {
                if (fs.existsSync(tmpMidi)) fs.unlinkSync(tmpMidi);
                if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
            }
        }
      } as any);

      exports.set('mix', {
        type: 'function',
        name: 'mix',
        params: [{ name: 'path' }, { name: 'tracks' }, { name: 'type' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath, tracksVal, type, options): RuntimeValue => {
          if (!Array.isArray(tracksVal)) throw new Error('mix expects an array of tracks');
          const t = typeof type === 'string' ? type : 'sine';
          const globalOpts = (options && typeof options === 'object' ? options : {}) as any;
          const sampleRate = 44100;

          // Process all tracks
          const allTracksData = tracksVal.map(track => {
            // Track can be a single pre-rendered sample or an array of notes
            const isSingleSample = (track && typeof track === 'object' && !Array.isArray(track) && track.type === 'audio_sample');
            const trackNotes = isSingleSample ? [track] : track;
            
            if (!Array.isArray(trackNotes)) throw new Error('Each track in mix must be an array of notes or a sample object');
            
            let trackSamples = 0;
            const notes = (trackNotes as any[]).map(val => {
              const n = val as any;
              
              // Support for pre-rendered audio samples
              if (n && typeof n === 'object' && n.type === 'audio_sample') {
                const samples = n.samples;
                const len = samples.length;
                const musicalLen = n.musicalDurationSamples || len;
                trackSamples += musicalLen;
                return { isSample: true, samples: samples, totalSamples: len, musicalDuration: musicalLen, opts: {} };
              }

              const rawNote = (typeof n === 'object' && n !== null && !Array.isArray(n)) ? (n.note || 'C4') : n;
              
              // Nested support for audio samples inside note objects
              if (rawNote && typeof rawNote === 'object' && rawNote.type === 'audio_sample') {
                  const samples = rawNote.samples;
                  const len = samples.length;
                  const musicalLen = rawNote.musicalDurationSamples || len;
                  trackSamples += musicalLen;
                  return { isSample: true, samples: samples, totalSamples: len, musicalDuration: musicalLen, opts: n };
              }

              const ms = (typeof n === 'object' && n !== null && !Array.isArray(n) && typeof n.ms === 'number') ? n.ms : 500;
              const opts = (typeof n === 'object' && n !== null && !Array.isArray(n)) ? n : {};

              const noteList = Array.isArray(rawNote) ? rawNote : [rawNote];
              const freqs = noteList.map(note => (typeof note === 'number' ? note : getFrequency(stringify(note))));

              const samples = Math.floor(sampleRate * (ms / 1000));
              trackSamples += samples;
              return { freqs, samples, opts: { ...globalOpts, ...opts } };
            });
            return { notes, totalSamples: trackSamples };
          });

          const maxSamples = Math.max(...allTracksData.map(d => d.totalSamples));
          const mixBufferL = new Float32Array(maxSamples);
          const mixBufferR = new Float32Array(maxSamples);

          for (const track of allTracksData) {
            let sampleOffset = 0;
            for (const nd of track.notes) {
              if (nd.isSample) {
                  const vol = nd.opts.vol !== undefined ? nd.opts.vol : 1.0;
                  const pan = nd.opts.pan !== undefined ? nd.opts.pan : 0.0;
                  for (let i = 0; i < nd.samples.length; i++) {
                      if (sampleOffset + i >= maxSamples) break;
                      const s = nd.samples[i] * vol;
                      mixBufferL[sampleOffset + i] += s * (1.0 - Math.max(0, pan));
                      mixBufferR[sampleOffset + i] += s * (1.0 - Math.max(0, -pan));
                  }
                  // Advance by musical duration, NOT audio data length (allows overlap)
                  sampleOffset += nd.musicalDuration;
                  continue;
              }

              const attack = nd.opts.attack !== undefined ? Math.max(1, nd.opts.attack) : 10;
              const release = nd.opts.release !== undefined ? Math.max(1, nd.opts.release) : 50;
              const attackSamples = Math.floor(sampleRate * (attack / 1000));
              const releaseSamples = Math.floor(sampleRate * (release / 1000));
              const vol = nd.opts.vol !== undefined ? nd.opts.vol : 1.0;
              const pan = nd.opts.pan !== undefined ? nd.opts.pan : 0.0;
              const cutoff = nd.opts.cutoff !== undefined ? nd.opts.cutoff : 20000;

              let lp_last = 0;
              const alpha = Math.min(1.0, (2 * Math.PI * cutoff) / sampleRate);

              for (let i = 0; i < nd.samples; i++) {
                if (sampleOffset + i >= maxSamples) break;
                if (nd.isSample) break;
                let combinedSample = 0;
                const time = i / sampleRate;

                const freqs = nd.freqs || [];
                for (const freq of freqs) {
                  let s = 0;
                  const waveType = nd.opts.type || t;
                  if (waveType === 'kick') {
                    const pitchEnv = Math.exp(-15.0 * time);
                    const f = 40 + 150 * pitchEnv;
                    s = Math.sin(2 * Math.PI * f * time);
                    if (i < 500) s += (Math.random() * 2 - 1) * Math.exp(-i / 100) * 0.5;
                  } else if (waveType === 'snare') {
                    const body = Math.sin(2 * Math.PI * 180 * time) * Math.exp(-10.0 * time);
                    const noise = (Math.random() * 2 - 1) * Math.exp(-15.0 * time) * 0.6;
                    s = body + noise;
                  } else if (waveType === 'hat') {
                    s = (Math.random() * 2 - 1) * Math.exp(-40.0 * time) * 0.5;
                  } else if (waveType === 'clap') {
                    if (i < 4000) {
                      const offsets = [0, 441, 882, 1323];
                      for (const off of offsets) {
                        if (i >= off) {
                          const local_t = (i - off) / sampleRate;
                          s += (Math.random() * 2 - 1) * Math.exp(-50.0 * local_t) * 0.4;
                        }
                      }
                    }
                  } else if (waveType === 'sine') s = Math.sin(2 * Math.PI * freq * time);
                  else if (waveType === 'square') s = Math.sin(2 * Math.PI * freq * time) >= 0 ? 0.3 : -0.3;
                  else if (waveType === 'saw') s = 0.6 * (2 * (time * freq - Math.floor(time * freq + 0.5)));
                  else if (waveType === 'triangle') s = 0.6 * (2 * Math.abs(2 * (time * freq - Math.floor(time * freq + 0.5))) - 1);
                  else if (waveType === 'noise') s = (Math.random() * 2 - 1) * 0.4;
                  combinedSample += s;
                }

                if (freqs.length > 1) combinedSample = combinedSample / Math.sqrt(freqs.length);

                // Filter
                lp_last = lp_last + alpha * (combinedSample - lp_last);
                combinedSample = (cutoff < 19000) ? lp_last : combinedSample;

                // Linear Envelope (Stable)
                let envelope = 1.0;
                if (i < attackSamples) {
                  envelope = i / attackSamples;
                } else if (i > nd.samples - releaseSamples) {
                  envelope = (nd.samples - i) / releaseSamples;
                }

                combinedSample = combinedSample * envelope * vol;
                
                mixBufferL[sampleOffset + i] += combinedSample * (1.0 - Math.max(0, pan));
                mixBufferR[sampleOffset + i] += combinedSample * (1.0 - Math.max(0, -pan));
              }
              sampleOffset += nd.samples;
            }
          }

          // Normalize and write to Stereo WAV with Hard Clamping
          const buffer = Buffer.alloc(44 + maxSamples * 4);
          buffer.write('RIFF', 0);
          buffer.writeUInt32LE(36 + maxSamples * 4, 4);
          buffer.write('WAVE', 8);
          buffer.write('fmt ', 12);
          buffer.writeUInt32LE(16, 16);
          buffer.writeUInt16LE(1, 20);
          buffer.writeUInt16LE(2, 22);
          buffer.writeUInt32LE(sampleRate, 24);
          buffer.writeUInt32LE(sampleRate * 4, 28);
          buffer.writeUInt16LE(4, 32);
          buffer.writeUInt16LE(16, 34);
          buffer.write('data', 36);
          buffer.writeUInt32LE(maxSamples * 4, 40);

          let peak = 0;
          for (let i = 0; i < maxSamples; i++) {
            peak = Math.max(peak, Math.abs(mixBufferL[i]), Math.abs(mixBufferR[i]));
          }
          const scale = peak > 0 ? (0.95 / peak) : 1.0;

          for (let i = 0; i < maxSamples; i++) {
            let L = mixBufferL[i] * scale;
            let R = mixBufferR[i] * scale;
            
            // Soft-Saturator (tanh approximation for "Hot" sound)
            if (globalOpts.saturate) {
                const s = typeof globalOpts.saturate === 'number' ? globalOpts.saturate : 1.5;
                L = Math.tanh(L * s);
                R = Math.tanh(R * s);
            }

            L = Math.max(-1, Math.min(1, L));
            R = Math.max(-1, Math.min(1, R));
            
            buffer.writeInt16LE(Math.floor(L * 32767), 44 + i * 4);
            buffer.writeInt16LE(Math.floor(R * 32767), 44 + i * 4 + 2);
          }

          const absPath = ensureSafePath(stringify(filePath), this);
          fs.writeFileSync(absPath, buffer);
          return true;
        }
      });
      return exports;
    } else if (source === 'std/draw') {
      let elements: string[] = [];
      let defs: string[] = [];
      let pixels = new Map<string, [number, number, number, number]>();

      const parsePixelColor = (value: RuntimeValue): [number, number, number, number] => {
        const color = stringify(value).trim().toLowerCase();
        const named: Record<string, [number, number, number, number]> = {
          transparent: [0, 0, 0, 0], black: [0, 0, 0, 255], white: [255, 255, 255, 255],
          red: [255, 0, 0, 255], green: [0, 128, 0, 255], blue: [0, 0, 255, 255],
          yellow: [255, 255, 0, 255], cyan: [0, 255, 255, 255], magenta: [255, 0, 255, 255],
          gray: [128, 128, 128, 255], grey: [128, 128, 128, 255], orange: [255, 165, 0, 255],
          purple: [128, 0, 128, 255],
        };
        if (named[color]) return named[color];

        const hex = color.match(/^#([0-9a-f]{3,8})$/i)?.[1];
        if (hex && [3, 4, 6, 8].includes(hex.length)) {
          const expanded = hex.length <= 4 ? hex.split('').map(char => char + char).join('') : hex;
          return [
            parseInt(expanded.slice(0, 2), 16),
            parseInt(expanded.slice(2, 4), 16),
            parseInt(expanded.slice(4, 6), 16),
            expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) : 255,
          ];
        }

        const rgb = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?%?))?\s*\)$/);
        if (rgb) {
          const byte = (component: string) => Math.max(0, Math.min(255, Math.round(Number(component))));
          const alpha = rgb[4] === undefined
            ? 255
            : rgb[4].endsWith('%')
              ? Math.max(0, Math.min(255, Math.round(Number(rgb[4].slice(0, -1)) * 2.55)))
              : Math.max(0, Math.min(255, Math.round(Number(rgb[4]) * 255)));
          return [byte(rgb[1]), byte(rgb[2]), byte(rgb[3]), alpha];
        }

        throw new Error(`Unsupported pixel color: ${color}`);
      };

      const pngChunk = (type: string, data: Buffer): Buffer => {
        const typeBuffer = Buffer.from(type, 'ascii');
        const crcInput = Buffer.concat([typeBuffer, data]);
        let crc = 0xffffffff;
        for (const byte of crcInput) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
          }
        }
        const chunk = Buffer.alloc(12 + data.length);
        chunk.writeUInt32BE(data.length, 0);
        typeBuffer.copy(chunk, 4);
        data.copy(chunk, 8);
        chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
        return chunk;
      };

      const renderPng = (widthValue: RuntimeValue, heightValue: RuntimeValue, backgroundValue: RuntimeValue): Buffer => {
        const width = Math.floor(Number(widthValue));
        const height = Math.floor(Number(heightValue));
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          throw new Error('save_png expects positive numeric width and height');
        }

        const background = parsePixelColor(backgroundValue ?? 'transparent');
        const scanlines = Buffer.alloc((width * 4 + 1) * height);
        for (let y = 0; y < height; y++) {
          const rowStart = y * (width * 4 + 1);
          scanlines[rowStart] = 0;
          for (let x = 0; x < width; x++) {
            const rgba = pixels.get(`${x},${y}`) ?? background;
            const offset = rowStart + 1 + x * 4;
            scanlines[offset] = rgba[0];
            scanlines[offset + 1] = rgba[1];
            scanlines[offset + 2] = rgba[2];
            scanlines[offset + 3] = rgba[3];
          }
        }

        const header = Buffer.alloc(13);
        header.writeUInt32BE(width, 0);
        header.writeUInt32BE(height, 4);
        header[8] = 8;
        header[9] = 6;
        return Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          pngChunk('IHDR', header),
          pngChunk('IDAT', deflateSync(scanlines)),
          pngChunk('IEND', Buffer.alloc(0)),
        ]);
      };

      const formatOptions = (opts: any): string => {
        if (!opts || typeof opts !== 'object') return '';
        return Object.entries(opts)
          .map(([k, v]) => ` ${k}="${stringify(v as any)}"`)
          .join('');
      };

      exports.set('clear', {
        type: 'function',
        name: 'clear',
        params: [],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (): RuntimeValue => {
          elements = [];
          defs = [];
          pixels = new Map();
          return null;
        }
      });
      exports.set('circle', {
        type: 'function',
        name: 'circle',
        params: [{ name: 'x' }, { name: 'y' }, { name: 'r' }, { name: 'fill' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (x, y, r, fill, opts): RuntimeValue => {
          elements.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${stringify(fill) || 'black'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('rect', {
        type: 'function',
        name: 'rect',
        params: [{ name: 'x' }, { name: 'y' }, { name: 'w' }, { name: 'h' }, { name: 'fill' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (x, y, w, h, fill, opts): RuntimeValue => {
          elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${stringify(fill) || 'black'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('pixel', {
        type: 'function',
        name: 'pixel',
        params: [{ name: 'x' }, { name: 'y' }, { name: 'color' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (x, y, color): RuntimeValue => {
          const pixelX = Math.floor(Number(x));
          const pixelY = Math.floor(Number(y));
          if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY)) {
            throw new Error('pixel expects numeric x and y coordinates');
          }
          pixels.set(`${pixelX},${pixelY}`, parsePixelColor(color));
          return null;
        }
      });
      exports.set('pixel_grid', {
        type: 'function',
        name: 'pixel_grid',
        params: [
          { name: 'grid' },
          { name: 'palette' },
          { name: 'scale', defaultValue: 1 as any },
          { name: 'x', defaultValue: 0 as any },
          { name: 'y', defaultValue: 0 as any },
        ],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (grid, palette, scaleValue, xValue, yValue): RuntimeValue => {
          if (!Array.isArray(grid)) throw new Error('pixel_grid expects grid to be an array of rows');
          if (!Array.isArray(palette) && (typeof palette !== 'object' || palette === null)) {
            throw new Error('pixel_grid expects palette to be an array or object');
          }

          const scale = Math.floor(Number(scaleValue ?? 1));
          const offsetX = Math.floor(Number(xValue ?? 0));
          const offsetY = Math.floor(Number(yValue ?? 0));
          if (!Number.isFinite(scale) || scale <= 0) throw new Error('pixel_grid expects scale to be a positive number');
          if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new Error('pixel_grid expects numeric x and y offsets');

          for (let gridY = 0; gridY < grid.length; gridY++) {
            const row = grid[gridY];
            if (!Array.isArray(row) && typeof row !== 'string') {
              throw new Error(`pixel_grid row ${gridY} is not an array or string`);
            }
            for (let gridX = 0; gridX < row.length; gridX++) {
              const paletteKey = row[gridX];
              const colorValue = Array.isArray(palette)
                ? palette[Number(paletteKey)]
                : (palette as Record<string, RuntimeValue>)[stringify(paletteKey)];
              if (colorValue === undefined || colorValue === null) {
                throw new Error(`pixel_grid palette has no color for ${stringify(paletteKey)}`);
              }
              const rgba = parsePixelColor(colorValue);
              const startX = offsetX + gridX * scale;
              const startY = offsetY + gridY * scale;
              for (let pixelY = 0; pixelY < scale; pixelY++) {
                for (let pixelX = 0; pixelX < scale; pixelX++) {
                  pixels.set(`${startX + pixelX},${startY + pixelY}`, rgba);
                }
              }
            }
          }
          return null;
        }
      });
      exports.set('line', {
        type: 'function',
        name: 'line',
        params: [{ name: 'x1' }, { name: 'y1' }, { name: 'x2' }, { name: 'y2' }, { name: 'color' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (x1, y1, x2, y2, color, opts): RuntimeValue => {
          elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stringify(color) || 'black'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('text', {
        type: 'function',
        name: 'text',
        params: [{ name: 'x' }, { name: 'y' }, { name: 'text' }, { name: 'size' }, { name: 'color' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (x, y, txt, size, color, opts): RuntimeValue => {
          elements.push(`<text x="${x}" y="${y}" font-size="${size || 16}" fill="${stringify(color) || 'black'}"${formatOptions(opts)}>${stringify(txt)}</text>`);
          return null;
        }
      });
      exports.set('ellipse', {
        type: 'function',
        name: 'ellipse',
        params: [{ name: 'cx' }, { name: 'cy' }, { name: 'rx' }, { name: 'ry' }, { name: 'fill' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (cx, cy, rx, ry, fill, opts): RuntimeValue => {
          elements.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${stringify(fill) || 'black'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('polygon', {
        type: 'function',
        name: 'polygon',
        params: [{ name: 'points' }, { name: 'fill' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (points, fill, opts): RuntimeValue => {
          elements.push(`<polygon points="${stringify(points)}" fill="${stringify(fill) || 'black'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('path', {
        type: 'function',
        name: 'path',
        params: [{ name: 'd' }, { name: 'fill' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (d, fill, opts): RuntimeValue => {
          elements.push(`<path d="${stringify(d)}" fill="${stringify(fill) || 'none'}"${formatOptions(opts)} />`);
          return null;
        }
      });
      exports.set('gradient', {
        type: 'function',
        name: 'gradient',
        params: [{ name: 'type' }, { name: 'id' }, { name: 'stops' }, { name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (type, id, stops, opts): RuntimeValue => {
          const t = stringify(type) === 'radial' ? 'radialGradient' : 'linearGradient';
          const stopsArr = Array.isArray(stops) ? stops : [];
          const stopsSvg = stopsArr.map((stop: any) => {
            const offset = stop && typeof stop === 'object' && stop.offset !== undefined ? stringify(stop.offset) : '0%';
            const color = stop && typeof stop === 'object' && stop.color !== undefined ? stringify(stop.color) : 'black';
            const opacity = stop && typeof stop === 'object' && stop.opacity !== undefined ? ` stop-opacity="${stringify(stop.opacity)}"` : '';
            return `    <stop offset="${offset}" stop-color="${color}"${opacity} />`;
          }).join('\n');

          const gradSvg = `  <${t} id="${stringify(id)}"${formatOptions(opts)}>\n${stopsSvg}\n  </${t}>`;
          defs.push(gradSvg);
          return null;
        }
      });
      exports.set('style', {
        type: 'function',
        name: 'style',
        params: [{ name: 'cssText' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (cssText): RuntimeValue => {
          defs.push(`  <style>\n    ${stringify(cssText)}\n  </style>`);
          return null;
        }
      });
      exports.set('raw', {
        type: 'function',
        name: 'raw',
        params: [{ name: 'svgCode' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (svgCode): RuntimeValue => {
          elements.push(stringify(svgCode));
          return null;
        }
      });
      exports.set('render', {
        type: 'function',
        name: 'render',
        params: [{ name: 'width' }, { name: 'height' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (w, h): RuntimeValue => {
          const defsStr = defs.length > 0 ? `  <defs>\n  ${defs.join('\n  ')}\n  </defs>\n` : '';
          return `<svg width="${w || 500}" height="${h || 500}" xmlns="http://www.w3.org/2000/svg">\n${defsStr}${elements.map(e => '  ' + e).join('\n')}\n</svg>`;
        }
      });
      exports.set('save_svg', {
        type: 'function',
        name: 'save_svg',
        params: [{ name: 'path' }, { name: 'width' }, { name: 'height' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath, w, h): RuntimeValue => {
          const defsStr = defs.length > 0 ? `  <defs>\n  ${defs.join('\n  ')}\n  </defs>\n` : '';
          const svg = `<svg width="${w || 500}" height="${h || 500}" xmlns="http://www.w3.org/2000/svg">\n${defsStr}${elements.map(e => '  ' + e).join('\n')}\n</svg>`;
          const absPath = ensureSafePath(stringify(filePath), this);
          fs.writeFileSync(absPath, svg);
          return true;
        }
      });
      exports.set('save_png', {
        type: 'function',
        name: 'save_png',
        params: [{ name: 'path' }, { name: 'width' }, { name: 'height' }, { name: 'background', defaultValue: 'transparent' as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (filePath, w, h, background): RuntimeValue => {
          const absPath = ensureSafePath(stringify(filePath), this);
          fs.writeFileSync(absPath, renderPng(w, h, background ?? 'transparent'));
          return true;
        }
      });
      return exports;
    } else if (source === 'std/terminal') {
      exports.set('clear', {
        type: 'function',
        name: 'clear',
        params: [],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (): RuntimeValue => {
          if ((globalThis as any).sesiTerminalClearHandler) {
            (globalThis as any).sesiTerminalClearHandler();
          } else {
            process.stdout.write('\x1b[2J\x1b[0f');
          }
          return null;
        }
      });
      exports.set('color', {
        type: 'function',
        name: 'color',
        params: [{ name: 'text' }, { name: 'colorName' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (textVal: RuntimeValue, colorNameVal: RuntimeValue): RuntimeValue => {
          const text = String(textVal);
          const colorName = typeof colorNameVal === 'string' ? colorNameVal : '';
          let ansiCode = '\x1b[0m';
          switch(colorName.toLowerCase()) {
            case 'red': ansiCode = '\x1b[31m'; break;
            case 'green': ansiCode = '\x1b[32m'; break;
            case 'yellow': ansiCode = '\x1b[33m'; break;
            case 'blue': ansiCode = '\x1b[34m'; break;
            case 'magenta': ansiCode = '\x1b[35m'; break;
            case 'cyan': ansiCode = '\x1b[36m'; break;
            case 'white': ansiCode = '\x1b[37m'; break;
            case 'bold': ansiCode = '\x1b[1m'; break;
          }
          return `${ansiCode}${text}\x1b[0m`;
        }
      });
      exports.set('cursor', {
        type: 'function',
        name: 'cursor',
        params: [{ name: 'x' }, { name: 'y' }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (xVal: RuntimeValue, yVal: RuntimeValue): RuntimeValue => {
          const x = typeof xVal === 'number' ? Math.floor(xVal) : 1;
          const y = typeof yVal === 'number' ? Math.floor(yVal) : 1;
          if ((globalThis as any).sesiTerminalCursorHandler) {
            (globalThis as any).sesiTerminalCursorHandler(x, y);
          } else {
            process.stdout.write(`\x1b[${y};${x}H`);
          }
          return null;
        }
      });
      return exports;
    } else if (source === 'std/browser') {
      if (this.safeMode) {
        throw new Error('Security Violation: std/browser is disabled in Sesi safe mode.');
      }
      
      exports.set('launch', {
        type: 'function',
        name: 'launch',
        params: [{ name: 'options', defaultValue: {} as any }],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
          const rawOpts = args[0] as any;
          const launchOptions: any = {};
          if (rawOpts && typeof rawOpts === 'object' && !Array.isArray(rawOpts)) {
            if (rawOpts.headless !== undefined) {
              launchOptions.headless = isTruthy(rawOpts.headless);
            }
          }
          const { chromium } = require('playwright');
          const browser = await chromium.launch(launchOptions);
          const browserObj: Record<string, RuntimeValue> = Object.create(null);
          
          browserObj.newPage = {
            type: 'function',
            name: 'newPage',
            params: [],
            body: {} as any,
            closure: {} as any,
            isBuiltin: true,
            builtin: async (): Promise<RuntimeValue> => {
              const page = await browser.newPage();
              const pageObj: Record<string, RuntimeValue> = Object.create(null);
              
              pageObj.goto = {
                type: 'function',
                name: 'goto',
                params: [{ name: 'url' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const url = stringify(pageArgs[0]);
                  await page.goto(url);
                  return null;
                }
              };
              
              pageObj.content = {
                type: 'function',
                name: 'content',
                params: [],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (): Promise<RuntimeValue> => {
                  return await page.content();
                }
              };

              pageObj.screenshot = {
                type: 'function',
                name: 'screenshot',
                params: [{ name: 'options', defaultValue: {} as any }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const opts = pageArgs[0] as any;
                  const screenshotOptions: any = {};
                  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
                    if (opts.path) {
                      screenshotOptions.path = ensureSafePath(stringify(opts.path), this);
                    }
                    if (opts.fullPage !== undefined) {
                      screenshotOptions.fullPage = isTruthy(opts.fullPage);
                    }
                  }
                  const buffer = await page.screenshot(screenshotOptions);
                  return buffer.toString('base64');
                }
              };

              pageObj.click = {
                type: 'function',
                name: 'click',
                params: [{ name: 'selector' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  await page.click(selector);
                  return null;
                }
              };

              pageObj.fill = {
                type: 'function',
                name: 'fill',
                params: [{ name: 'selector' }, { name: 'value' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  const val = stringify(pageArgs[1]);
                  await page.fill(selector, val);
                  return null;
                }
              };

              pageObj.type = {
                type: 'function',
                name: 'type',
                params: [{ name: 'selector' }, { name: 'value' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  const val = stringify(pageArgs[1]);
                  await page.type(selector, val);
                  return null;
                }
              };

              pageObj.press = {
                type: 'function',
                name: 'press',
                params: [{ name: 'selector' }, { name: 'key' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  const key = stringify(pageArgs[1]);
                  await page.press(selector, key);
                  return null;
                }
              };

              pageObj.inner_text = {
                type: 'function',
                name: 'inner_text',
                params: [{ name: 'selector' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  return await page.innerText(selector);
                }
              };

              pageObj.attribute = {
                type: 'function',
                name: 'attribute',
                params: [{ name: 'selector' }, { name: 'name' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  const name = stringify(pageArgs[1]);
                  return await page.getAttribute(selector, name);
                }
              };

              pageObj.evaluate = {
                type: 'function',
                name: 'evaluate',
                params: [{ name: 'script' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const script = stringify(pageArgs[0]);
                  const result = await page.evaluate(script);
                  return stripPrototypes(result);
                }
              };

              pageObj.title = {
                type: 'function',
                name: 'title',
                params: [],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (): Promise<RuntimeValue> => {
                  return await page.title();
                }
              };

              pageObj.close = {
                type: 'function',
                name: 'close',
                params: [],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (): Promise<RuntimeValue> => {
                  await page.close();
                  return null;
                }
              };

              pageObj.pdf = {
                type: 'function',
                name: 'pdf',
                params: [{ name: 'options', defaultValue: {} as any }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const opts = pageArgs[0] as any;
                  const pdfOptions: any = {};
                  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
                    if (opts.path) {
                      pdfOptions.path = ensureSafePath(stringify(opts.path), this);
                    }
                    if (opts.format) {
                      pdfOptions.format = stringify(opts.format);
                    }
                  }
                  const buffer = await page.pdf(pdfOptions);
                  return buffer.toString('base64');
                }
              };

              pageObj.wait_for_selector = {
                type: 'function',
                name: 'wait_for_selector',
                params: [{ name: 'selector' }, { name: 'options', defaultValue: {} as any }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const selector = stringify(pageArgs[0]);
                  const opts = pageArgs[1] as any;
                  const waitOptions: any = {};
                  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
                    if (opts.state) waitOptions.state = stringify(opts.state);
                    if (opts.timeout) waitOptions.timeout = Number(opts.timeout);
                  }
                  await page.waitForSelector(selector, waitOptions);
                  return null;
                }
              };

              pageObj.wait_for_timeout = {
                type: 'function',
                name: 'wait_for_timeout',
                params: [{ name: 'ms' }],
                body: {} as any,
                closure: {} as any,
                isBuiltin: true,
                builtin: async (...pageArgs: RuntimeValue[]): Promise<RuntimeValue> => {
                  const ms = Number(pageArgs[0]) || 0;
                  await page.waitForTimeout(ms);
                  return null;
                }
              };

              return pageObj;
            }
          };

          browserObj.close = {
            type: 'function',
            name: 'close',
            params: [],
            body: {} as any,
            closure: {} as any,
            isBuiltin: true,
            builtin: async (): Promise<RuntimeValue> => {
              await browser.close();
              return null;
            }
          };

          return browserObj;
        }
      });
      return exports;
    } else if (source === 'std/api') {
      if (this.safeMode) {
        throw new Error('Security Violation: std/api is disabled in Sesi safe mode.');
      }

      const interp = this;

      function makeBuiltinFn(name: string, paramNames: string[], fn: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>): RuntimeFunction {
        return {
          type: 'function',
          name,
          params: paramNames.map(p => ({ name: p })),
          body: {} as any,
          closure: {} as any,
          isBuiltin: true,
          builtin: fn as any,
        } as RuntimeFunction;
      }

      function typeToOpenAPI(t: string): string {
        if (t === 'number' || t === 'int' || t === 'float') return 'number';
        if (t === 'bool') return 'boolean';
        if (t === 'array') return 'array';
        if (t === 'object') return 'object';
        return 'string';
      }

      const createAppFn = makeBuiltinFn('create_app', ['config'], (...args: RuntimeValue[]): RuntimeValue => {
        const config = (args[0] as any) || Object.create(null);
        const title: string = config?.title || 'Sesi API';
        const apiVersion: string = config?.version || '1.0.0';
        const description: string = config?.description || '';
        const basePath: string = config?.base_path || '';

        interface RouteEntry {
          method: string;
          path: string;
          schema: any;
          handler: RuntimeFunction;
          pathParams: string[];
        }

        const routes: RouteEntry[] = [];
        const middlewares: RuntimeFunction[] = [];

        function extractPathParams(routePath: string): string[] {
          const matches = routePath.match(/\{([^}]+)\}/g) || [];
          return matches.map((m: string) => m.slice(1, -1));
        }

        function matchRoute(method: string, urlPath: string): { route: RouteEntry; params: Record<string, string> } | null {
          for (const route of routes) {
            if (route.method !== method && route.method !== '*') continue;
            const paramNames: string[] = [];
            const regexStr = route.path
              .replace(/[.+?^$|[\]\\]/g, (c: string) => '\\' + c)
              .replace(/\{([^}]+)\}/g, (_: string, name: string) => { paramNames.push(name); return '([^/]+)'; });
            const regex = new RegExp('^' + regexStr + '$');
            const match = urlPath.match(regex);
            if (match) {
              const params: Record<string, string> = Object.create(null);
              paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
              return { route, params };
            }
          }
          return null;
        }

        function registerRoute(method: string, routePath: string, schema: any, handler: RuntimeFunction): void {
          const fullPath = basePath + routePath;
          routes.push({ method: method.toUpperCase(), path: fullPath, schema: schema || Object.create(null), handler, pathParams: extractPathParams(fullPath) });
        }

        function buildOpenAPI(): Record<string, any> {
          const paths: Record<string, any> = Object.create(null);
          for (const route of routes) {
            if (!paths[route.path]) paths[route.path] = Object.create(null);
            const methodKey = route.method.toLowerCase();
            const schema = route.schema || {};
            const operation: any = Object.create(null);
            if (schema.summary) operation.summary = schema.summary;
            if (schema.description) operation.description = schema.description;
            if (schema.tags) operation.tags = schema.tags;
            if (schema.deprecated) operation.deprecated = true;
            operation.operationId = `${methodKey}${route.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;

            const parameters: any[] = [];
            for (const param of route.pathParams) {
              parameters.push({ name: param, in: 'path', required: true, schema: { type: 'string' } });
            }
            if (schema.query && typeof schema.query === 'object') {
              for (const [name, def] of Object.entries(schema.query)) {
                const p: any = { name, in: 'query' };
                if (typeof def === 'string') {
                  p.schema = { type: typeToOpenAPI(def) };
                  p.required = false;
                } else if (typeof def === 'object' && def !== null) {
                  const d = def as any;
                  p.required = d.required === true;
                  p.schema = { type: typeToOpenAPI(d.type || 'string') };
                  if (d.description) p.description = d.description;
                  if (d.example !== undefined) p.example = d.example;
                }
                parameters.push(p);
              }
            }
            if (parameters.length > 0) operation.parameters = parameters;

            if (schema.body && typeof schema.body === 'object' && ['POST', 'PUT', 'PATCH'].includes(route.method)) {
              const props: Record<string, any> = Object.create(null);
              const req: string[] = [];
              for (const [name, def] of Object.entries(schema.body)) {
                if (typeof def === 'string') {
                  props[name] = { type: typeToOpenAPI(def) };
                  req.push(name);
                } else if (typeof def === 'object' && def !== null) {
                  const d = def as any;
                  props[name] = { type: typeToOpenAPI(d.type || 'string') };
                  if (d.description) props[name].description = d.description;
                  if (d.example !== undefined) props[name].example = d.example;
                  if (d.required !== false) req.push(name);
                }
              }
              operation.requestBody = {
                required: true,
                content: { 'application/json': { schema: { type: 'object', properties: props, ...(req.length ? { required: req } : {}) } } }
              };
            }

            const responses: any = Object.create(null);
            const successCode = route.method === 'POST' ? '201' : '200';
            if (schema.response && typeof schema.response === 'object') {
              const props: Record<string, any> = Object.create(null);
              for (const [name, t] of Object.entries(schema.response)) {
                props[name] = { type: typeToOpenAPI(typeof t === 'string' ? t : 'string') };
              }
              responses[successCode] = { description: 'Successful response', content: { 'application/json': { schema: { type: 'object', properties: props } } } };
            } else {
              responses[successCode] = { description: 'Successful response' };
            }
            responses['422'] = { description: 'Validation error' };
            responses['500'] = { description: 'Internal server error' };
            operation.responses = responses;
            paths[route.path][methodKey] = operation;
          }
          return { openapi: '3.1.0', info: { title, version: apiVersion, description }, paths };
        }

        function swaggerUiHtml(specUrl: string): string {
          return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body{margin:0}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`;
        }

        const appObj: Record<string, RuntimeValue> = Object.create(null);

        for (const httpMethod of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
          const m = httpMethod;
          appObj[m] = makeBuiltinFn(m, ['path', 'schema', 'handler'], (...routeArgs: RuntimeValue[]): RuntimeValue => {
            const [routePath, routeSchema, routeHandler] = routeArgs;
            if (typeof routePath !== 'string') throw new Error(`app.${m}() expects a path string`);
            if (typeof routeHandler !== 'object' || !routeHandler || (routeHandler as any).type !== 'function') {
              throw new Error(`app.${m}() expects a handler function as third argument`);
            }
            registerRoute(m, routePath, routeSchema, routeHandler as RuntimeFunction);
            return appObj;
          });
        }

        appObj.use = makeBuiltinFn('use', ['middleware'], (...mwArgs: RuntimeValue[]): RuntimeValue => {
          const fn = mwArgs[0];
          if (typeof fn === 'object' && fn && (fn as any).type === 'function') middlewares.push(fn as RuntimeFunction);
          return appObj;
        });

        appObj.openapi = makeBuiltinFn('openapi', [], (): RuntimeValue => buildOpenAPI() as any);

        appObj.routes = makeBuiltinFn('routes', [], (): RuntimeValue => {
          return routes.map(r => {
            const o: Record<string, any> = Object.create(null);
            o.method = r.method;
            o.path = r.path;
            if (r.schema?.summary) o.summary = r.schema.summary;
            return o;
          }) as any;
        });

        appObj.listen = makeBuiltinFn('listen', ['port', 'options'], async (...listenArgs: RuntimeValue[]): Promise<RuntimeValue> => {
          const port = listenArgs[0] as number;
          const opts = (listenArgs[1] as any) || Object.create(null);
          if (typeof port !== 'number') throw new Error('app.listen() expects a port number');

          const docsPath: string = opts?.docs_path || '/docs';
          const openapiPath: string = opts?.openapi_path || '/openapi.json';
          const cors: boolean = opts?.cors !== false;
          const corsOrigin: string = opts?.cors_origin || '*';

          const corsHeaders: Record<string, string> = cors ? {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          } : {};

          const nodeHttp = require('http');
          const server = nodeHttp.createServer(async (req: any, res: any) => {
            const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
            const urlPath = urlObj.pathname;
            const query: Record<string, string> = Object.create(null);
            urlObj.searchParams.forEach((val: string, key: string) => { query[key] = val; });

            if (req.method === 'OPTIONS') {
              res.writeHead(204, corsHeaders);
              res.end();
              return;
            }

            if (urlPath === openapiPath) {
              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify(buildOpenAPI(), null, 2));
              return;
            }

            if (urlPath === docsPath || urlPath === docsPath + '/') {
              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' });
              res.end(swaggerUiHtml(openapiPath));
              return;
            }

            let rawBody = '';
            try {
              const buffers: Buffer[] = [];
              for await (const chunk of req) buffers.push(chunk as Buffer);
              rawBody = Buffer.concat(buffers).toString('utf8');
            } catch (_) { /* ignore */ }

            const matched = matchRoute(req.method || 'GET', urlPath);
            if (!matched) {
              res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: `Not found: ${req.method} ${urlPath}` }));
              return;
            }

            const { route, params } = matched;
            const schema = route.schema || {};

            // Validate query params
            const validationErrors: string[] = [];
            if (schema.query && typeof schema.query === 'object') {
              for (const [name, def] of Object.entries(schema.query)) {
                const required = typeof def === 'object' && (def as any)?.required === true;
                if (required && !Object.prototype.hasOwnProperty.call(query, name)) {
                  validationErrors.push(`Query parameter '${name}' is required`);
                }
              }
            }

            // Parse and validate body
            let parsedBody: any = null;
            if (['POST', 'PUT', 'PATCH'].includes(req.method || '') && schema.body && typeof schema.body === 'object') {
              if (rawBody.trim()) {
                try {
                  parsedBody = JSON.parse(rawBody);
                } catch (_) {
                  res.writeHead(422, { ...corsHeaders, 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ detail: [{ msg: 'Invalid JSON body' }] }));
                  return;
                }
              } else {
                parsedBody = Object.create(null);
              }
              for (const [name, def] of Object.entries(schema.body)) {
                const isRequired = typeof def === 'string' || (typeof def === 'object' && (def as any)?.required !== false);
                if (isRequired && (parsedBody === null || !Object.prototype.hasOwnProperty.call(parsedBody, name))) {
                  validationErrors.push(`Body field '${name}' is required`);
                }
              }
            }

            if (validationErrors.length > 0) {
              res.writeHead(422, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: validationErrors.map((msg: string) => ({ msg })) }));
              return;
            }

            const sesiReq: Record<string, any> = Object.create(null);
            sesiReq.method = req.method || 'GET';
            sesiReq.path = urlPath;
            sesiReq.headers = req.headers;
            sesiReq.body = rawBody;
            sesiReq.json = parsedBody;
            sesiReq.query = query;
            sesiReq.params = params;

            // Run middlewares
            for (const mw of middlewares) {
              try {
                let mwResult = await interp.callSesiFunction(mw, [sesiReq]);
                if (typeof mwResult === 'object' && mwResult !== null && (mwResult as any).type === 'promise') {
                  mwResult = await (mwResult as any).promise;
                }
                if (typeof mwResult === 'object' && mwResult !== null && typeof (mwResult as any).status === 'number') {
                  const mwBody = (mwResult as any).body;
                  res.writeHead((mwResult as any).status, { ...corsHeaders, 'Content-Type': 'application/json' });
                  res.end(typeof mwBody === 'object' ? JSON.stringify(mwBody) : String(mwBody ?? ''));
                  return;
                }
              } catch (mwErr: any) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ detail: mwErr.message }));
                return;
              }
            }

            try {
              let result = await interp.callSesiFunction(route.handler, [sesiReq]);
              if (typeof result === 'object' && result !== null && (result as any).type === 'promise') {
                result = await (result as any).promise;
              }

              if (result === null || result === undefined) {
                res.writeHead(204, corsHeaders);
                res.end();
              } else if (typeof result === 'object' && !Array.isArray(result) && typeof (result as any).status === 'number') {
                const status = (result as any).status as number;
                const resHeaders: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
                if (typeof (result as any).headers === 'object' && (result as any).headers !== null) {
                  for (const [k, v] of Object.entries((result as any).headers as Record<string, any>)) {
                    resHeaders[k] = String(v);
                  }
                }
                const body = (result as any).body;
                const bodyStr = body === undefined ? '' : (typeof body === 'object' ? JSON.stringify(body) : String(body));
                res.writeHead(status, resHeaders);
                res.end(bodyStr);
              } else {
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(typeof result === 'object' ? JSON.stringify(result) : String(result));
              }
            } catch (handlerErr: any) {
              res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: handlerErr.message || 'Internal server error' }));
            }
          });

          return new Promise<RuntimeValue>((resolve, reject) => {
            server.listen(port, () => {
              const host = `http://localhost:${port}`;
              console.log(`\nSesiAPI  →  ${host}`);
              console.log(`Docs     →  ${host}${docsPath}`);
              console.log(`OpenAPI  →  ${host}${openapiPath}\n`);
              const serverObj: Record<string, RuntimeValue> = Object.create(null);
              serverObj.close = makeBuiltinFn('close', [], (): RuntimeValue => { server.close(); return true; });
              serverObj.url = host;
              serverObj.docs_url = `${host}${docsPath}`;
              serverObj.openapi_url = `${host}${openapiPath}`;
              resolve(serverObj);
            });
            server.on('error', (err: any) => reject(new Error(`SesiAPI server failed: ${err.message}`)));
          });
        });

        return appObj;
      });

      exports.set('create_app', createAppFn);
      return exports;
    }
    return null;
  }
}

const NOTES: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

function getFrequency(note: string): number {
  if (note === 'null' || note === 'rest') return 0;
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 440;
  const name = match[1];
  const octave = parseInt(match[2]);
  const base = NOTES[name];
  return base * Math.pow(2, octave - 4);
}

function noteToMidi(note: any): number {
    if (typeof note === 'number') return note;
    const noteStr = stringify(note);
    const match = noteStr.match(/^([A-G]#?)(\d)$/);
    if (!match) return 60;
    const name = match[1];
    const octave = parseInt(match[2]);
    const map: Record<string, number> = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    return (octave + 1) * 12 + map[name];
}

function buildFullMidi(tracks: any[]): Buffer {
    const header = Buffer.from([
        0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
        0x00, 0x01, // Type 1 (Multiple tracks)
        0x00, Math.max(1, tracks.length), // Number of tracks
        0x01, 0xE0  // 480 PPQ
    ]);

    const trackBuffers: Buffer[] = [];

    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
        const events: number[] = [];
        const trackNotes = tracks[trackIdx];
        if (!Array.isArray(trackNotes)) continue;

        let pendingTicks = 0;
        let firstEvent = true;

        for (const n of trackNotes) {
            const rawNote = (typeof n === 'object' && n !== null) ? (n.note || 'C4') : n;
            const ms = (typeof n === 'object' && n !== null && typeof n.ms === 'number') ? n.ms : 500;
            const inst = (typeof n === 'object' && n !== null && typeof n.instrument === 'number') ? n.instrument : 0;
            const chan = (typeof n === 'object' && n !== null && typeof n.channel === 'number') ? n.channel : 0;
            
            const ticks = Math.floor((ms / 1000) * 480);

            if (rawNote === 'null' || rawNote === 'rest') {
                pendingTicks += ticks;
                continue;
            }

            const notes = Array.isArray(rawNote) ? rawNote : [rawNote];
            const midiNotes = notes.map(noteToMidi);
            
            // Program Change (if needed, but usually once per track)
            if (firstEvent) {
                events.push(0x00, 0xC0 | (chan & 0x0F), inst);
                firstEvent = false;
            }

            // Note On
            for (let i = 0; i < midiNotes.length; i++) {
                // First note in a chord takes the accumulated rest time
                const dt = (i === 0) ? pendingTicks : 0;
                writeVarLen(events, dt);
                events.push(0x90 | (chan & 0x0F), midiNotes[i], 0x64);
                pendingTicks = 0; // Reset after use
            }

            // Delta time wait for the duration of the note(s)
            pendingTicks = ticks;

            // Note Off
            for (let i = 0; i < midiNotes.length; i++) {
                const dt = (i === 0) ? pendingTicks : 0;
                writeVarLen(events, dt);
                events.push(0x80 | (chan & 0x0F), midiNotes[i], 0x00);
                pendingTicks = 0; // Reset after use
            }
        }

        events.push(0x00, 0xFF, 0x2F, 0x00); // End
        
        const trackData = Buffer.from(events);
        const trackHead = Buffer.from([0x4D, 0x54, 0x72, 0x6B]);
        const trackSize = Buffer.alloc(4);
        trackSize.writeUInt32BE(trackData.length, 0);
        trackBuffers.push(Buffer.concat([trackHead, trackSize, trackData]));
    }

    return Buffer.concat([header, ...trackBuffers]);
}

function writeVarLen(arr: number[], value: number) {
    let buffer = value & 0x7F;
    while ((value >>= 7) > 0) {
        buffer <<= 8;
        buffer |= 0x80;
        buffer |= (value & 0x7F);
    }
    while (true) {
        arr.push(buffer & 0xFF);
        if (buffer & 0x80) buffer >>= 8;
        else break;
    }
}

function generateWav(frequency: number, durationMs: number, type: string = 'sine', options: any = {}): Buffer {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  
  const attack = options.attack !== undefined ? Math.max(1, options.attack) : 10;
  const release = options.release !== undefined ? Math.max(1, options.release) : 50;
  const attackSamples = Math.floor(sampleRate * (attack / 1000));
  const releaseSamples = Math.floor(sampleRate * (release / 1000));
  
  const vol = options.vol !== undefined ? options.vol : 1.0;
  const pan = options.pan !== undefined ? options.pan : 0.0;
  const cutoff = options.cutoff !== undefined ? options.cutoff : 20000;
  
  let lp_last = 0;
  const alpha = Math.min(1.0, (2 * Math.PI * cutoff) / sampleRate);

  const buffer = Buffer.alloc(44 + numSamples * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 4, 40);

  for (let i = 0; i < numSamples; i++) {
    let sample = 0;
    const t = i / sampleRate;

    if (type === 'kick') {
      // 808-style Kick: Pitch envelope + Sine
      const pitchEnv = Math.exp(-15.0 * t);
      const freq = 40 + 150 * pitchEnv;
      sample = Math.sin(2 * Math.PI * freq * t);
      // Add transient click
      if (i < 500) sample += (Math.random() * 2 - 1) * Math.exp(-i / 100) * 0.5;
    } else if (type === 'snare') {
      // Snare: 180Hz body + High-passed noise
      const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-10.0 * t);
      const noise = (Math.random() * 2 - 1) * Math.exp(-15.0 * t) * 0.6;
      sample = body + noise;
    } else if (type === 'hat') {
      // Hi-Hat: Short burst of high-frequency noise
      sample = (Math.random() * 2 - 1) * Math.exp(-40.0 * t) * 0.5;
      // Simple high-pass (static for hats)
      lp_last = lp_last + 0.8 * (sample - lp_last);
      sample = sample - lp_last;
    } else if (type === 'clap') {
      // Clap: Multiple offset noise bursts
      let clap_noise = 0;
      if (i < 4000) {
          const offsets = [0, 441, 882, 1323]; // 10ms offsets
          for (const off of offsets) {
              if (i >= off) {
                  const local_t = (i - off) / sampleRate;
                  clap_noise += (Math.random() * 2 - 1) * Math.exp(-50.0 * local_t) * 0.4;
              }
          }
      }
      sample = clap_noise;
    } else if (type === 'sine') sample = Math.sin(2 * Math.PI * frequency * t);
    else if (type === 'square') sample = Math.sin(2 * Math.PI * frequency * t) >= 0 ? 0.3 : -0.3;
    else if (type === 'saw') sample = 0.6 * (2 * (t * frequency - Math.floor(t * frequency + 0.5)));
    else if (type === 'triangle') sample = 0.6 * (2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1);
    else if (type === 'noise') sample = (Math.random() * 2 - 1) * 0.4;
    
    // Filter (standard)
    if (type !== 'hat' && type !== 'kick') {
        lp_last = lp_last + alpha * (sample - lp_last);
        sample = (cutoff < 19000) ? lp_last : sample;
    }

    // Envelope
    let envelope = 1.0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i > numSamples - releaseSamples) {
      envelope = (numSamples - i) / releaseSamples;
    }
    
    sample = Math.max(-1, Math.min(1, sample * envelope * vol));

    const left = sample * (1.0 - Math.max(0, pan));
    const right = sample * (1.0 - Math.max(0, -pan));

    buffer.writeInt16LE(Math.floor(left * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.floor(right * 32767), 44 + i * 4 + 2);
  }
  return buffer;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

function markdownToHtml(md: string): string {
  return marked.parse(md, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;
}

function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html).trim();
}

function htmlToText(html: string): string {
  return htmlToPlainText(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
    ],
  }).trim();
}

function svgToHtml(svg: string): string {
  const trimmed = svg.trim();
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Converted SVG</title>',
    '  <style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fff;}svg{max-width:100%;height:auto;}</style>',
    '</head>',
    '<body>',
    trimmed,
    '</body>',
    '</html>'
  ].join('\n');
}

function htmlToSvg(html: string): string {
  const match = html.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  if (!match) {
    throw new Error('HTML to SVG conversion requires an <svg> element in the input.');
  }
  return match[0].trim();
}

function xmlLikeToText(content: string): string {
  return content
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function delimitedToJson(content: string, delimiter: ',' | '\t'): string {
  const rows = parseDelimitedText(content, delimiter);
  return JSON.stringify(rows, null, 2);
}

function jsonToYaml(jsonStr: string): string {
  const parsed = JSON.parse(jsonStr);
  return yaml.dump(parsed, {
    noRefs: true,
    lineWidth: -1,
    sortKeys: false,
  }).trim();
}

function yamlToJson(yamlStr: string): string {
  const parsed = yaml.load(yamlStr);
  return JSON.stringify(parsed ?? null, null, 2);
}

function parseDelimitedText(content: string, delimiter: ',' | '\t'): Array<Record<string, string>> {
  const rows = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => parseDelimitedLine(line, delimiter));

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map((row) => {
    const entry: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      entry[headers[i]] = row[i] ?? '';
    }
    return entry;
  });
}

function parseDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map(value => value.trim());
}

function jsonToDelimited(jsonStr: string, delimiter: ',' | '\t'): string {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = [headers.map(header => serializeDelimitedValue(header, delimiter)).join(delimiter)];
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === undefined || row[header] === null ? '' : String(row[header]);
        return serializeDelimitedValue(val, delimiter);
      });
      rows.push(values.join(delimiter));
    }
    return rows.join('\n');
  } catch {
    return '';
  }
}

function serializeDelimitedValue(value: string, delimiter: ',' | '\t'): string {
  const needsQuotes = value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

async function rasterizeSvgWithPlaywright(inputPath: string, outputPath: string, outputType: string): Promise<void> {
  const { chromium } = await import('playwright');
  const svg = fs.readFileSync(inputPath, 'utf8');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent;display:inline-block">${svg}</body></html>`, {
      waitUntil: 'load'
    });
    const locator = page.locator('svg').first();
    await locator.waitFor();
    await locator.screenshot({
      path: outputPath,
      type: outputType === 'png' ? 'png' : 'jpeg',
      omitBackground: outputType === 'png',
    });
  } finally {
    await browser.close();
  }
}

function rasterImageFileToSvg(inputPath: string, fileType: string): string {
  const mimeType = getImageMimeType(fileType);
  if (!mimeType) {
    throw new Error(`SVG image conversion does not support .${fileType} input.`);
  }

  const buffer = fs.readFileSync(inputPath);
  const dimensions = imageSize(buffer);
  const width = dimensions.width ?? 512;
  const height = dimensions.height ?? 512;
  const base64 = buffer.toString('base64');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image width="${width}" height="${height}" href="data:${mimeType};base64,${base64}" xlink:href="data:${mimeType};base64,${base64}" preserveAspectRatio="none" />`,
    '</svg>'
  ].join('\n');
}

function getImageMimeType(fileType: string): string | null {
  switch (fileType.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'avif':
      return 'image/avif';
    default:
      return null;
  }
}
