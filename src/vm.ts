// Stack-based virtual machine for Sesi bytecode
import {
  OpCode,
  type Chunk,
  type FunctionProto,
  read16,
} from './chunk';

import {
  Environment,
  type RuntimeValue,
  type RuntimeFunction,
  ReturnValue,
  SesiRuntimeError,
} from './types';

import { getBuiltins, isTruthy, isEqual, stringify, compareValues } from './builtins';
import { aiRuntime } from './ai-runtime';

// ---------------------------------------------------------------------------
// Upvalue representation
// ---------------------------------------------------------------------------
class VMUpvalue {
  public value: RuntimeValue;
  public location: number; // stack index, or -1 if closed
  
  constructor(location: number, val: RuntimeValue) {
    this.location = location;
    this.value = val;
  }
}

// ---------------------------------------------------------------------------
// Exception handler representation
// ---------------------------------------------------------------------------
interface ExceptionHandler {
  catchIp: number;
  finallyIp: number;
  stackDepth: number;
  frameIndex: number;
}

// ---------------------------------------------------------------------------
// Call frame
// ---------------------------------------------------------------------------
interface CallFrame {
  proto: FunctionProto | null; // null = top-level script
  chunk: Chunk;
  ip: number;
  base: number; // stack index where this frame's locals start
  upvalues: VMUpvalue[];
}

// ---------------------------------------------------------------------------
// VM
// ---------------------------------------------------------------------------
export class VM {
  private stack: RuntimeValue[] = [];
  private frames: CallFrame[] = [];
  private globals: Map<string, RuntimeValue> = new Map();
  private prompts: Map<string, string> = new Map();
  private interpreter: any;
  private memory: Map<string, string> = new Map();
  private openUpvalues: VMUpvalue[] = [];
  private handlers: ExceptionHandler[] = [];
  private pendingError: any = null;

  constructor(
    private scriptDir?: string,
    private options?: { safeMode?: boolean; allowLocalFs?: boolean; allowedPaths?: string[]; args?: string[] },
  ) {
    // Bootstrap: create a temporary Interpreter just to get the builtins map,
    // then extract every function into our global table.
    // We reuse the exact same builtin implementations — no duplication.
    const { Interpreter } = require('./interpreter');
    const tempInterp = new Interpreter(scriptDir, options);
    this.interpreter = tempInterp;

    // Walk the global environment the Interpreter set up
    for (const [name, val] of tempInterp.globalEnv.getValues()) {
      this.globals.set(name, val);
    }

    // args
    this.globals.set('args', options?.args ?? []);

    // Internal builtins that the compiler emits as CALL_BUILTIN names
    this.globals.set('__structured_output__', {
      type: 'function',
      name: '__structured_output__',
      params: [],
      body: {} as any,
      closure: {} as any,
      isBuiltin: true,
      builtin: async (schema: RuntimeValue, input: RuntimeValue): Promise<RuntimeValue> => {
        if (typeof input !== 'string') return input;
        const schemaObj: Record<string, string> = {};
        if (typeof schema === 'object' && schema !== null) {
          for (const [k, v] of Object.entries(schema as any)) {
            schemaObj[k] = typeof v === 'string' ? v : 'string';
          }
        }
        return await aiRuntime.parseStructuredOutput(input as string, schemaObj);
      },
    } as RuntimeFunction);

    this.globals.set('__tool_call__', {
      type: 'function',
      name: '__tool_call__',
      params: [],
      body: {} as any,
      closure: {} as any,
      isBuiltin: true,
      builtin: async (nameVal: RuntimeValue, ...args: RuntimeValue[]): Promise<RuntimeValue> => {
        if (typeof nameVal !== 'string') {
          throw new Error('Tool name must be a string');
        }

        const sensitiveBuiltins = ['exec', 'spawn', 'python', 'js'];
        if (sensitiveBuiltins.includes(nameVal)) {
          throw new Error(`Security Violation: Automated execution of sensitive tool "${nameVal}" is forbidden.`);
        }

        const fn = this.globals.get(nameVal) ?? (this.interpreter?.getCustomTool?.(nameVal));
        if (!fn || typeof fn !== 'object' || (fn as any).type !== 'function') {
          throw new Error(`Tool or built-in not found: ${nameVal}`);
        }

        const fnName = (fn as any).name;
        if (sensitiveBuiltins.includes(fnName) || ((fn as any).isBuiltin && sensitiveBuiltins.includes(fnName))) {
          throw new Error(`Security Violation: Automated execution of sensitive tool "${fnName || nameVal}" is forbidden.`);
        }

        this.stack.push(fn as RuntimeFunction, ...args);
        await this.performCall(fn as RuntimeFunction, args.length);
        return this.pop();
      },
    } as RuntimeFunction);
  }

  // -------------------------------------------------------------------------
  // Public entry
  // -------------------------------------------------------------------------
  async run(chunk: Chunk): Promise<void> {
    this.frames.push({ proto: null, chunk, ip: 0, base: 0, upvalues: [] });
    await this.execute();
  }

  async callCompiledFunction(fn: RuntimeFunction, args: RuntimeValue[]): Promise<RuntimeValue> {
    const proto = (fn as any)._proto as FunctionProto;
    const upvalues = (fn as any)._upvalues as VMUpvalue[] ?? [];
    
    const frameBase = this.stack.length;
    for (let i = 0; i < proto.params.length; i++) {
      this.push(i < args.length ? args[i] : null);
    }
    
    this.frames.push({ proto, chunk: proto.chunk, ip: 0, base: frameBase, upvalues });
    await this.execute();
    return this.pop();
  }

  private closeUpvalues(lastSlot: number): void {
    for (let i = this.openUpvalues.length - 1; i >= 0; i--) {
      const uv = this.openUpvalues[i];
      if (uv.location >= lastSlot) {
        uv.value = this.stack[uv.location];
        uv.location = -1;
        this.openUpvalues.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Main dispatch loop
  // -------------------------------------------------------------------------
  private async execute(): Promise<void> {
    while (true) {
      const frame = this.currentFrame();
      const { chunk } = frame;
      const ipBefore = frame.ip;

      try {
        const op: OpCode = this.readByte(frame);

        switch (op) {
          // ---- Constants ----
          case OpCode.CONSTANT: {
            const idx = this.readByte(frame);
            this.push(chunk.constants[idx] as RuntimeValue);
            break;
          }
          case OpCode.NIL:   this.push(null); break;
          case OpCode.TRUE:  this.push(true); break;
          case OpCode.FALSE: this.push(false); break;
          case OpCode.POP:   this.pop(); break;

          // ---- Globals ----
          case OpCode.DEFINE_GLOBAL: {
            const name = chunk.constants[this.readByte(frame)] as string;
            const val = this.peek(0);
            this.globals.set(name, val);
            if (this.interpreter) {
              this.interpreter.globalEnv.define(name, val);
            }
            this.pop();
            break;
          }
          case OpCode.GET_GLOBAL: {
            const name = chunk.constants[this.readByte(frame)] as string;
            const val = this.globals.get(name);
            if (val === undefined) throw new Error(`Undefined variable: ${name}`);
            this.push(val);
            break;
          }
          case OpCode.SET_GLOBAL: {
            const name = chunk.constants[this.readByte(frame)] as string;
            if (!this.globals.has(name)) throw new Error(`Undefined variable: ${name}`);
            const val = this.peek(0);
            this.globals.set(name, val);
            if (this.interpreter) {
              this.interpreter.globalEnv.define(name, val);
            }
            if (this.memory.has(name)) {
              const stringVal = stringify(val);
              this.memory.set(name, stringVal);
              aiRuntime.updateMemory(name, stringVal);
            }
            break;
          }

          // ---- Locals ----
          case OpCode.GET_LOCAL: {
            const slot = this.readByte(frame);
            this.push(this.stack[frame.base + slot]);
            break;
          }
          case OpCode.SET_LOCAL: {
            const slot = this.readByte(frame);
            this.stack[frame.base + slot] = this.peek(0);
            break;
          }

          // ---- Arithmetic ----
          case OpCode.ADD: {
            const b = this.pop();
            const a = this.pop();
            if (typeof a === 'string' || typeof b === 'string') {
              this.push(stringify(a) + stringify(b));
            } else {
              this.push((a as number) + (b as number));
            }
            break;
          }
          case OpCode.SUBTRACT: { const b = this.pop(); this.push((this.pop() as number) - (b as number)); break; }
          case OpCode.MULTIPLY: { const b = this.pop(); this.push((this.pop() as number) * (b as number)); break; }
          case OpCode.DIVIDE:   { const b = this.pop(); this.push((this.pop() as number) / (b as number)); break; }
          case OpCode.MODULO:   { const b = this.pop(); this.push((this.pop() as number) % (b as number)); break; }
          case OpCode.NEGATE:   { this.push(-(this.pop() as number)); break; }

          // ---- Comparison ----
          case OpCode.EQUAL:         { const b = this.pop(); this.push(isEqual(this.pop(), b)); break; }
          case OpCode.NOT_EQUAL:     { const b = this.pop(); this.push(!isEqual(this.pop(), b)); break; }
          case OpCode.LESS:          { const b = this.pop(); this.push(compareValues(this.pop(), b) < 0); break; }
          case OpCode.LESS_EQUAL:    { const b = this.pop(); this.push(compareValues(this.pop(), b) <= 0); break; }
          case OpCode.GREATER:       { const b = this.pop(); this.push(compareValues(this.pop(), b) > 0); break; }
          case OpCode.GREATER_EQUAL: { const b = this.pop(); this.push(compareValues(this.pop(), b) >= 0); break; }
          case OpCode.NOT:           { this.push(!isTruthy(this.pop())); break; }

          // ---- Control Flow ----
          case OpCode.JUMP: {
            const offset = this.read16(frame);
            frame.ip += offset;
            break;
          }
          case OpCode.JUMP_IF_FALSE: {
            const offset = this.read16(frame);
            if (!isTruthy(this.peek(0))) frame.ip += offset;
            break;
          }
          case OpCode.LOOP: {
            const offset = this.read16(frame);
            frame.ip -= offset;
            break;
          }

          // ---- Collections ----
          case OpCode.BUILD_ARRAY: {
            const count = this.readByte(frame);
            const arr: RuntimeValue[] = new Array(count);
            for (let i = count - 1; i >= 0; i--) arr[i] = this.pop();
            this.push(arr);
            break;
          }
          case OpCode.BUILD_OBJECT: {
            const count = this.readByte(frame);
            const obj: Record<string, RuntimeValue> = Object.create(null);
            for (let i = 0; i < count; i++) {
              const val = this.pop();
              const key = this.pop() as string;
              obj[key] = val;
            }
            this.push(obj);
            break;
          }
          case OpCode.GET_INDEX: {
            const idx = this.pop();
            const obj = this.pop();
            if (Array.isArray(obj) && typeof idx === 'number') {
              this.push(obj[idx] ?? null);
            } else if (typeof obj === 'object' && obj !== null && typeof idx === 'string') {
              this.push((obj as any)[idx] ?? null);
            } else {
              this.push(null);
            }
            break;
          }
          case OpCode.SET_INDEX: {
            const val = this.pop();
            const idx = this.pop();
            const obj = this.peek(0); // leave obj on stack
            if (Array.isArray(obj) && typeof idx === 'number') {
              (obj as RuntimeValue[])[idx] = val;
            } else if (typeof obj === 'object' && obj !== null) {
              (obj as any)[idx as string] = val;
            }
            this.pop(); // remove obj
            this.push(val);
            break;
          }
          case OpCode.GET_PROPERTY: {
            const prop = chunk.constants[this.readByte(frame)] as string;
            const obj = this.pop();
            if (typeof obj === 'object' && obj !== null) {
              this.push((obj as any)[prop] ?? null);
            } else {
              this.push(null);
            }
            break;
          }
          case OpCode.SET_PROPERTY: {
            const prop = chunk.constants[this.readByte(frame)] as string;
            const val = this.pop();
            const obj = this.peek(0);
            if (typeof obj === 'object' && obj !== null) {
              (obj as any)[prop] = val;
            }
            this.pop();
            this.push(val);
            break;
          }

          // ---- Functions ----
          case OpCode.CLOSURE: {
            const proto = chunk.constants[this.readByte(frame)] as FunctionProto;
            const capturedUpvalues: VMUpvalue[] = [];
            for (const up of proto.upvalues) {
              if (up.isLocal) {
                const stackIndex = frame.base + up.index;
                let uv = this.openUpvalues.find(u => u.location === stackIndex);
                if (!uv) {
                  uv = new VMUpvalue(stackIndex, this.stack[stackIndex]);
                  this.openUpvalues.push(uv);
                }
                capturedUpvalues.push(uv);
              } else {
                capturedUpvalues.push(frame.upvalues[up.index]);
              }
            }
            const fn: RuntimeFunction = {
              type: 'function',
              name: proto.name,
              params: proto.params.map(p => ({ name: p.name })),
              body: {} as any,
              closure: {} as any,
              isAsync: proto.isAsync,
              isBuiltin: false,
              builtin: undefined,
            };
            (fn as any)._proto = proto;
            (fn as any)._upvalues = capturedUpvalues;
            this.push(fn);
            break;
          }

          case OpCode.CALL: {
            const argc = this.readByte(frame);
            const callee = this.stack[this.stack.length - 1 - argc];
            if (typeof callee !== 'object' || !callee || (callee as any).type !== 'function') {
              throw new Error(`Not a function: ${stringify(callee)}`);
            }
            await this.performCall(callee as RuntimeFunction, argc);
            break;
          }

          case OpCode.RETURN: {
            const result = this.pop();
            const done = this.frames.pop()!;
            this.closeUpvalues(done.base);

            const poppedFrameIndex = this.frames.length;
            while (this.handlers.length > 0 && this.handlers[this.handlers.length - 1].frameIndex >= poppedFrameIndex) {
              this.handlers.pop();
            }

            while (this.stack.length > done.base) this.pop();
            this.push(result);
            if (this.frames.length === 0) return;
            break;
          }

          case OpCode.RETURN_VOID: {
            const done = this.frames.pop()!;
            this.closeUpvalues(done.base);

            const poppedFrameIndex = this.frames.length;
            while (this.handlers.length > 0 && this.handlers[this.handlers.length - 1].frameIndex >= poppedFrameIndex) {
              this.handlers.pop();
            }

            while (this.stack.length > done.base) this.pop();
            this.push(null);
            if (this.frames.length === 0) return;
            break;
          }

          // ---- Built-ins fast path ----
          case OpCode.CALL_BUILTIN: {
            const nameIdx = this.readByte(frame);
            const argc    = this.readByte(frame);
            const name    = chunk.constants[nameIdx] as string;

            const fn = this.globals.get(name) ?? (this.interpreter?.getCustomTool?.(name));
            if (!fn || typeof fn !== 'object' || (fn as any).type !== 'function') {
              throw new Error(`Tool or built-in not found: ${name}`);
            }
            const insertIdx = this.stack.length - argc;
            this.stack.splice(insertIdx, 0, fn);
            await this.performCall(fn as RuntimeFunction, argc);
            break;
          }

          // ---- Model call ----
          case OpCode.CALL_MODEL: {
            this.readByte(frame);
            this.readByte(frame);

            const config    = this.pop() as Record<string, any> | null;
            const promptVal = this.pop();
            const modelName = this.pop() as string;
            const promptStr = typeof promptVal === 'string' ? promptVal : stringify(promptVal);

            const resolvedModel = this.interpreter && typeof this.interpreter.resolveModelName === 'function'
              ? this.interpreter.resolveModelName(modelName)
              : modelName;

            const response = await aiRuntime.callModel({
              model: resolvedModel,
              prompt: promptStr,
              temperature: config?.temperature as number | undefined,
              maxTokens: config?.max_tokens as number | undefined,
              thinkingLevel: config?.thinkingLevel as any,
              cache: config?.cache as boolean | undefined,
              search: config?.search as boolean | undefined,
              stream: config?.stream as any,
            });
            this.push(response.text);
            break;
          }

          case OpCode.CALL_IMAGE: {
            this.readByte(frame);
            this.readByte(frame);
            const config    = this.pop() as Record<string, any> | null;
            const promptVal = this.pop();
            const modelName = this.pop() as string;

            if (this.interpreter && typeof (this.interpreter as any).evaluateImageCall === 'function') {
              const syntheticExpr: any = {
                type: 'ImageCallExpression',
                modelName,
                config: config ? Object.fromEntries(Object.entries(config).map(([k, v]) => [k, { type: 'Literal', value: v }])) : undefined,
                prompt: { type: 'Literal', value: promptVal },
              };
              const result = await (this.interpreter as any).evaluateImageCall(syntheticExpr);
              this.push(result);
            } else {
              // Fallback if interpreter is not linked
              const resolvedModel = this.interpreter && typeof this.interpreter.resolveModelName === 'function'
                ? this.interpreter.resolveModelName(modelName)
                : modelName;
              const response = await aiRuntime.callModel({
                model: resolvedModel,
                prompt: typeof promptVal === 'string' ? promptVal : stringify(promptVal),
                ratio: config?.ratio as string | undefined,
                size:  config?.size  as string | undefined,
              });
              this.push(response.text);
            }
            break;
          }

          case OpCode.CONVERT: {
            this.readByte(frame);
            this.readByte(frame);
            const config = this.pop() as Record<string, any> | null;
            const file = this.pop();
            const conversionType = this.pop() as string;

            if (this.interpreter && typeof (this.interpreter as any).evaluateConvert === 'function') {
              const syntheticExpr: any = {
                type: 'ConvertExpression',
                conversionType,
                config: config ? Object.fromEntries(Object.entries(config).map(([k, v]) => [k, { type: 'Literal', value: v }])) : undefined,
                file: { type: 'Literal', value: file },
              };
              const result = await (this.interpreter as any).evaluateConvert(syntheticExpr);
              this.push(result);
            } else {
              this.push(null);
            }
            break;
          }

          // ---- Print ----
          case OpCode.PRINT: {
            const argc = this.readByte(frame);
            const parts: string[] = [];
            const vals = this.stack.splice(this.stack.length - argc, argc);
            for (const v of vals) parts.push(stringify(v));
            console.log(parts.join(' '));
            break;
          }

          // ---- Try/Catch/Finally ----
          case OpCode.TRY_START: {
            const catchOffset = this.read16(frame);
            const finallyOffset = this.read16(frame);
            const catchIp = catchOffset === 0xffff ? -1 : frame.ip + catchOffset;
            const finallyIp = finallyOffset === 0xffff ? -1 : frame.ip + finallyOffset;
            this.handlers.push({
              catchIp,
              finallyIp,
              stackDepth: this.stack.length,
              frameIndex: this.frames.length - 1
            });
            break;
          }

          case OpCode.TRY_END: {
            const handler = this.handlers.pop();
            if (handler && handler.finallyIp !== -1) {
              this.handlers.push({
                catchIp: -1,
                finallyIp: handler.finallyIp,
                stackDepth: handler.stackDepth,
                frameIndex: handler.frameIndex
              });
            }
            break;
          }

          case OpCode.FINALLY_START: {
            if (this.handlers.length > 0 && this.handlers[this.handlers.length - 1].catchIp === -1) {
              this.handlers.pop();
            }
            break;
          }

          case OpCode.FINALLY_END: {
            if (this.pendingError !== null) {
              const err = this.pendingError;
              this.pendingError = null;
              throw err;
            }
            break;
          }

          // ---- Imports / Modules ----
          case OpCode.IMPORT: {
            const source = chunk.constants[this.readByte(frame)] as string;
            const names = chunk.constants[this.readByte(frame)] as any as string[];
            const moduleExports = await this.interpreter.getModuleExports(source);
            if (names.length === 1 && names[0] === names[0].toLowerCase() && !moduleExports.has(names[0])) {
              const nsObj: any = Object.create(null);
              for (const [key, val] of moduleExports.entries()) {
                nsObj[key] = val;
              }
              this.globals.set(names[0], nsObj);
              if (this.interpreter) {
                this.interpreter.globalEnv.define(names[0], nsObj);
              }
            } else {
              for (const name of names) {
                if (!moduleExports.has(name)) {
                  throw new Error(`Module "${source}" does not export "${name}"`);
                }
                const val = moduleExports.get(name)!;
                this.globals.set(name, val);
                if (this.interpreter) {
                  this.interpreter.globalEnv.define(name, val);
                }
              }
            }
            break;
          }

          case OpCode.ALLOW: {
            const source = chunk.constants[this.readByte(frame)] as string;
            const binding = chunk.constants[this.readByte(frame)] as any as string | string[];
            const moduleExports = await this.interpreter.getModuleExports(source);
            if (typeof binding === 'string') {
              const nsObj: any = Object.create(null);
              for (const [key, val] of moduleExports.entries()) {
                nsObj[key] = val;
              }
              this.globals.set(binding, nsObj);
              if (this.interpreter) {
                this.interpreter.globalEnv.define(binding, nsObj);
              }
            } else {
              for (const name of binding) {
                if (!moduleExports.has(name)) {
                  throw new Error(`Module "${source}" does not export "${name}"`);
                }
                const val = moduleExports.get(name)!;
                this.globals.set(name, val);
                if (this.interpreter) {
                  this.interpreter.globalEnv.define(name, val);
                }
              }
            }
            break;
          }

          // ---- Memory ----
          case OpCode.INITIALIZE_MEMORY: {
            const name = chunk.constants[this.readByte(frame)] as string;
            const val = this.pop();
            const stringVal = stringify(val);
            this.memory.set(name, stringVal);
            aiRuntime.initializeMemory(name, stringVal);
            this.globals.set(name, stringVal);
            if (this.interpreter) {
              this.interpreter.globalEnv.define(name, stringVal);
            }
            break;
          }

          // ---- Upvalues ----
          case OpCode.GET_UPVALUE: {
            const slot = this.readByte(frame);
            const uv = frame.upvalues[slot];
            this.push(uv.location !== -1 ? this.stack[uv.location] : uv.value);
            break;
          }

          case OpCode.SET_UPVALUE: {
            const slot = this.readByte(frame);
            const val = this.peek(0);
            const uv = frame.upvalues[slot];
            if (uv.location !== -1) {
              this.stack[uv.location] = val;
            } else {
              uv.value = val;
            }
            break;
          }

          case OpCode.CLOSE_UPVALUE: {
            this.closeUpvalues(this.stack.length - 1);
            this.pop();
            break;
          }

          default:
            throw new Error(`Unknown opcode: ${op}`);
        }
      } catch (err: any) {
        const line = frame.chunk.lines[ipBefore] ?? 0;
        const sesiError = (err instanceof SesiRuntimeError)
          ? err
          : new SesiRuntimeError('RuntimeError', err.message);

        const handler = this.handlers.pop();
        if (handler) {
          // Unwind call frames
          while (this.frames.length - 1 > handler.frameIndex) {
            const popped = this.frames.pop()!;
            this.closeUpvalues(popped.base);
          }
          // Unwind stack
          while (this.stack.length > handler.stackDepth) {
            this.closeUpvalues(this.stack.length - 1);
            this.pop();
          }

          const targetFrame = this.currentFrame();
          if (handler.catchIp !== -1) {
            this.push(this.normalizeCaughtError(sesiError));
            targetFrame.ip = handler.catchIp;
            if (handler.finallyIp !== -1) {
              this.handlers.push({
                catchIp: -1,
                finallyIp: handler.finallyIp,
                stackDepth: handler.stackDepth,
                frameIndex: handler.frameIndex
              });
            }
          } else {
            this.pendingError = sesiError;
            targetFrame.ip = handler.finallyIp;
          }
        } else {
          throw sesiError;
        }
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

  private async performCall(fn: RuntimeFunction, argc: number): Promise<void> {
    if (fn.isBuiltin && fn.builtin) {
      const args = this.stack.splice(this.stack.length - argc, argc);
      this.pop(); // pop callee
      const result = await fn.builtin(...args);
      this.push(result ?? null);
      return;
    }

    const proto: FunctionProto | null = (fn as any)._proto ?? null;
    if (!proto) {
      // Fallback: user-defined function compiled by tree-walker — delegate to interpreter
      const { Interpreter } = require('./interpreter');
      const interp = new Interpreter(this.scriptDir, this.options);
      if (this.interpreter) {
        for (const [k, v] of (this.interpreter as any).modelAliases) {
          interp.setModelAlias(k, v);
        }
      }
      for (const [k, v] of this.globals) interp.globalEnv.define(k, v);
      const args = this.stack.splice(this.stack.length - argc, argc);
      this.pop(); // callee
      const result = await interp.callSesiFunction(fn, args);
      this.push(result ?? null);
      return;
    }

    // Push a new call frame
    const args = this.stack.splice(this.stack.length - argc, argc);
    this.pop(); // callee

    // Bind parameters
    const frameBase = this.stack.length;
    for (let i = 0; i < proto.params.length; i++) {
      this.push(i < args.length ? args[i] : null);
    }

    const upvalues: VMUpvalue[] = (fn as any)._upvalues ?? [];
    this.frames.push({ proto, chunk: proto.chunk, ip: 0, base: frameBase, upvalues });
  }

  // -------------------------------------------------------------------------
  // Stack helpers
  // -------------------------------------------------------------------------
  private push(val: RuntimeValue): void { this.stack.push(val); }
  private pop(): RuntimeValue { return this.stack.pop() ?? null; }
  private peek(distance: number): RuntimeValue { return this.stack[this.stack.length - 1 - distance]; }

  // -------------------------------------------------------------------------
  // Frame helpers
  // -------------------------------------------------------------------------
  private currentFrame(): CallFrame { return this.frames[this.frames.length - 1]; }

  private readByte(frame: CallFrame): number {
    return frame.chunk.code[frame.ip++];
  }

  private read16(frame: CallFrame): number {
    const val = read16(frame.chunk.code, frame.ip);
    frame.ip += 2;
    return val;
  }
}
