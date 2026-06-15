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
// Call frame
// ---------------------------------------------------------------------------
interface CallFrame {
  proto: FunctionProto | null; // null = top-level script
  chunk: Chunk;
  ip: number;
  base: number; // stack index where this frame's locals start
}

// ---------------------------------------------------------------------------
// VM
// ---------------------------------------------------------------------------
export class VM {
  private stack: RuntimeValue[] = [];
  private frames: CallFrame[] = [];
  private globals: Map<string, RuntimeValue> = new Map();
  private prompts: Map<string, string> = new Map();

  constructor(
    private scriptDir?: string,
    private options?: { safeMode?: boolean; allowLocalFs?: boolean; allowedPaths?: string[]; args?: string[] },
  ) {
    // Bootstrap: create a temporary Interpreter just to get the builtins map,
    // then extract every function into our global table.
    // We reuse the exact same builtin implementations — no duplication.
    const { Interpreter } = require('./interpreter');
    const tempInterp = new Interpreter(scriptDir, options);

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
  }

  // -------------------------------------------------------------------------
  // Public entry
  // -------------------------------------------------------------------------
  async run(chunk: Chunk): Promise<void> {
    this.frames.push({ proto: null, chunk, ip: 0, base: 0 });
    await this.execute();
  }

  // -------------------------------------------------------------------------
  // Main dispatch loop
  // -------------------------------------------------------------------------
  private async execute(): Promise<void> {
    while (true) {
      const frame = this.currentFrame();
      const { chunk } = frame;
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
          this.globals.set(name, this.peek(0));
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
          this.globals.set(name, this.peek(0));
          // leave value on stack (assignment is an expression)
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
          // leave value on stack
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

        // ---- Jumps ----
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
          // Wrap proto as a RuntimeFunction so callers see a uniform value
          const fn: RuntimeFunction = {
            type: 'function',
            name: proto.name,
            params: proto.params.map(p => ({ name: p.name })),
            body: {} as any,       // not used by VM
            closure: {} as any,    // not used by VM (VM uses stack frames)
            isAsync: proto.isAsync,
            isBuiltin: false,
            // Stash proto so the VM can find it at call time
            builtin: undefined,
            // Custom field — VM checks for this
            ...(({ _proto: proto }) as any),
          };
          // Attach proto directly for VM lookup
          (fn as any)._proto = proto;
          this.push(fn);
          break;
        }

        case OpCode.CALL: {
          const argc = this.readByte(frame);
          const callee = this.stack[this.stack.length - 1 - argc];
          if (typeof callee !== 'object' || !callee || (callee as any).type !== 'function') {
            throw new Error(`Not a function: ${stringify(callee)}`);
          }
          const fn = callee as RuntimeFunction;

          if (fn.isBuiltin && fn.builtin) {
            const args = this.stack.splice(this.stack.length - argc, argc);
            this.pop(); // pop callee
            const result = await fn.builtin(...args);
            this.push(result ?? null);
            break;
          }

          const proto: FunctionProto | null = (fn as any)._proto ?? null;
          if (!proto) {
            // Fallback: user-defined function compiled by tree-walker — delegate to interpreter
            const { Interpreter } = require('./interpreter');
            const interp = new Interpreter(this.scriptDir, this.options);
            // Copy globals back in
            for (const [k, v] of this.globals) interp.globalEnv.define(k, v);
            const args = this.stack.splice(this.stack.length - argc, argc);
            this.pop(); // callee
            const result = await interp.callSesiFunction(fn, args);
            this.push(result ?? null);
            break;
          }

          // Push a new call frame
          const args = this.stack.splice(this.stack.length - argc, argc);
          this.pop(); // callee

          // Bind parameters (fill defaults with null)
          const frameBase = this.stack.length;
          for (let i = 0; i < proto.params.length; i++) {
            this.push(i < args.length ? args[i] : null);
          }

          this.frames.push({ proto, chunk: proto.chunk, ip: 0, base: frameBase });
          break;
        }

        case OpCode.RETURN: {
          const result = this.pop();
          const done = this.frames.pop()!;
          // Pop locals off stack
          while (this.stack.length > done.base) this.pop();
          if (this.frames.length === 0) return; // top-level script done
          this.push(result);
          break;
        }

        case OpCode.RETURN_VOID: {
          const done = this.frames.pop()!;
          while (this.stack.length > done.base) this.pop();
          if (this.frames.length === 0) return;
          this.push(null);
          break;
        }

        // ---- Built-ins fast path ----
        case OpCode.CALL_BUILTIN: {
          const nameIdx = this.readByte(frame);
          const argc    = this.readByte(frame);
          const name    = chunk.constants[nameIdx] as string;
          const args    = this.stack.splice(this.stack.length - argc, argc);

          const fn = this.globals.get(name);
          if (!fn || typeof fn !== 'object' || (fn as any).type !== 'function') {
            throw new Error(`Built-in not found: ${name}`);
          }
          const bfn = fn as RuntimeFunction;
          const result = bfn.builtin
            ? await bfn.builtin(...args)
            : null;
          this.push(result ?? null);
          break;
        }

        // ---- Model call ----
        case OpCode.CALL_MODEL: {
          this.readByte(frame); // nameIdx (already embedded in the CONSTANT before)
          this.readByte(frame); // argc (always 3: modelName, prompt, config)

          const config    = this.pop() as Record<string, any> | null;
          const promptVal = this.pop();
          const modelName = this.pop() as string;
          const promptStr = typeof promptVal === 'string' ? promptVal : stringify(promptVal);

          const response = await aiRuntime.callModel({
            model: modelName,
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
          const response  = await aiRuntime.callModel({
            model: modelName,
            prompt: typeof promptVal === 'string' ? promptVal : stringify(promptVal),
            ratio: config?.ratio as string | undefined,
            size:  config?.size  as string | undefined,
          });
          this.push(response.text);
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

        default:
          throw new Error(`Unknown opcode: ${op}`);
      }
    }
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
