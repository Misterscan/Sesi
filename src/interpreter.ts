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
} from './types';

import { getBuiltins, isTruthy, isEqual, stringify, compareValues } from './builtins';
import { aiRuntime } from './ai-runtime';

export class Interpreter {
  private globalEnv: Environment;
  private currentEnv: Environment;
  private prompts: Map<string, string> = new Map();
  private memory: Map<string, string> = new Map();

  constructor() {
    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;

    // Add built-in functions
    const builtins = getBuiltins();
    for (const [name, fn] of builtins) {
      this.globalEnv.define(name, fn);
    }
  }

  async interpret(program: Program): Promise<void> {
    for (const statement of program.statements) {
      await this.executeStatement(statement);
    }
  }

  private async executeStatement(statement: Statement): Promise<void> {
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
        console.log('Import not yet implemented');
        break;
      case 'ExportStatement':
        console.log('Export not yet implemented');
        break;
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
      catchEnv.define(stmt.catchParameter, e instanceof Error ? e.message : String(e));
      await this.executeBlock(stmt.catchBlock, catchEnv);
    }
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

  private async evaluateExpression(expr: Expression): Promise<RuntimeValue> {
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

      case 'ModelCallExpression':
        return await this.evaluateModelCall(expr);

      case 'StructuredOutputExpression':
        return await this.evaluateStructuredOutput(expr);

      case 'ToolCallExpression':
        return await this.evaluateToolCall(expr);

      default:
        return null;
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
      throw new Error(`Not a function: ${expr.callee}`);
    }

    const fn = callee as RuntimeFunction;
    const args: RuntimeValue[] = [];

    for (const arg of expr.arguments) {
      args.push(await this.evaluateExpression(arg));
    }

    if (fn.isBuiltin && fn.builtin) {
      return fn.builtin(...args);
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
    const obj: any = {};
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

  private async evaluateModelCall(expr: ModelCallExpression): Promise<RuntimeValue> {
    let promptText = await this.evaluateExpression(expr.prompt) as string;
    if (typeof promptText !== 'string') {
      promptText = stringify(promptText);
    }

    const response = await aiRuntime.callModel({
      model: expr.modelName,
      prompt: promptText,
      temperature: expr.config?.temperature ? (await this.evaluateExpression(expr.config.temperature) as number) : undefined,
      maxTokens: expr.config?.max_tokens ? (await this.evaluateExpression(expr.config.max_tokens) as number) : undefined,
    });

    return response.text;
  }

  private async evaluateStructuredOutput(expr: StructuredOutputExpression): Promise<RuntimeValue> {
    const modelResponse = await this.evaluateModelCall(expr.modelCall);
    const schemaObj: any = {};

    for (const [key, typeAnnotation] of Object.entries(expr.schema)) {
      schemaObj[key] = (typeAnnotation as any).name || 'string';
    }

    const structured = await aiRuntime.parseStructuredOutput(modelResponse as string, schemaObj);
    return structured;
  }

  private async evaluateToolCall(expr: ToolCallExpression): Promise<RuntimeValue> {
    const fn = this.currentEnv.get(expr.functionName);

    if (typeof fn !== 'object' || !fn || (fn as any).type !== 'function') {
      throw new Error(`Tool not found: ${expr.functionName}`);
    }

    const args: RuntimeValue[] = [];
    for (const arg of expr.arguments) {
      args.push(await this.evaluateExpression(arg));
    }

    const runtimeFn = fn as RuntimeFunction;
    if (runtimeFn.isBuiltin && runtimeFn.builtin) {
      return runtimeFn.builtin(...args);
    }

    const callEnv = new Environment(runtimeFn.closure);
    for (let i = 0; i < runtimeFn.params.length; i++) {
      const param = runtimeFn.params[i];
      const value = i < args.length ? args[i] : (param.defaultValue ? await this.evaluateExpression(param.defaultValue) : null);
      callEnv.define(param.name, value);
    }

    const previous = this.currentEnv;
    this.currentEnv = callEnv;

    try {
      await this.executeBlock(runtimeFn.body, callEnv);
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
}
