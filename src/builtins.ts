// Built-in functions for Sesi
import { RuntimeValue, RuntimeFunction, SesiRuntimeError } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { aiRuntime } from './ai-runtime';

function ensureSafePath(filePath: string, interpreter?: any, baseDir: string = process.cwd()): string {
  const resolved = path.resolve(baseDir, filePath);
  const allowLocalFs = interpreter?.allowLocalFs ?? (process.env.SESI_LOCAL_FS === 'true');
  const safeMode = interpreter?.safeMode ?? (process.env.SESI_SAFE_MODE !== 'false');

  // If in safe mode, allowLocalFs is strictly disabled.
  if (allowLocalFs && !safeMode) {
    return resolved;
  }

  const allowedDirs = [...(interpreter?.allowedPaths || [process.cwd()])];
  if (interpreter?.scriptDir && !allowedDirs.includes(interpreter.scriptDir)) {
    allowedDirs.push(interpreter.scriptDir);
  }

  const isSafe = allowedDirs.some((dir: string) => {
    const resolvedDir = path.resolve(dir);
    const relative = path.relative(resolvedDir, resolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });

  if (!isSafe) {
    throw new Error(`Security Violation: Path traversal detected. Access to "${filePath}" outside of allowed directories is forbidden.`);
  }
  return resolved;
}

export function getBuiltins(interpreter?: any): Map<string, RuntimeFunction> {
  const builtins = new Map<string, RuntimeFunction>();

  builtins.set('print', {
    type: 'function',
    name: 'print',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (...args: RuntimeValue[]): RuntimeValue => {
      const output = args.map((arg) => stringify(arg)).join(' ');
      console.log(output);
      return null;
    },
  });

  builtins.set('len', {
    type: 'function',
    name: 'len',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => {
      if (typeof value === 'string') return value.length;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length;
      }
      return null;
    },
  });

  builtins.set('type', {
    type: 'function',
    name: 'type',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => {
      if (value === null) return 'null';
      if (typeof value === 'boolean') return 'bool';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'string') return 'string';
      if (Array.isArray(value)) return 'array';
      if (typeof value === 'object') return 'object';
      return 'unknown';
    },
  });

  builtins.set('str', {
    type: 'function',
    name: 'str',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => stringify(value),
  });

  builtins.set('to_json', {
    type: 'function',
    name: 'to_json',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return null;
      }
    },
  });

  builtins.set('from_json', {
    type: 'function',
    name: 'from_json',
    params: [{ name: 'string' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string') return null;
      try {
        return stripPrototypes(JSON.parse(str));
      } catch (e) {
        return null;
      }
    },
  });

  builtins.set('exp', {
    type: 'function',
    name: 'exp',
    params: [{ name: 'x' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (x: RuntimeValue): RuntimeValue => {
      if (typeof x !== 'number') return null;
      return Math.exp(x);
    },
  });

  builtins.set('num', {
    type: 'function',
    name: 'num',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      }
      if (typeof value === 'boolean') return value ? 1 : 0;
      return null;
    },
  });

  builtins.set('bool', {
    type: 'function',
    name: 'bool',
    params: [{ name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => isTruthy(value),
  });

  builtins.set('range', {
    type: 'function',
    name: 'range',
    params: [{ name: 'n' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (n: RuntimeValue): RuntimeValue => {
      if (typeof n !== 'number') return null;
      const arr: number[] = [];
      for (let i = 0; i < n; i++) {
        arr.push(i);
      }
      return arr;
    },
  });

  builtins.set('push', {
    type: 'function',
    name: 'push',
    params: [{ name: 'array' }, { name: 'value' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (array: RuntimeValue, value: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array)) return null;
      array.push(value);
      return array;
    },
  });

  builtins.set('pop', {
    type: 'function',
    name: 'pop',
    params: [{ name: 'array' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (array: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array)) return null;
      return array.pop() ?? null;
    },
  });

  builtins.set('keys', {
    type: 'function',
    name: 'keys',
    params: [{ name: 'object' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (obj: RuntimeValue): RuntimeValue => {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
      return Object.keys(obj);
    },
  });

  builtins.set('values', {
    type: 'function',
    name: 'values',
    params: [{ name: 'object' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (obj: RuntimeValue): RuntimeValue => {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
      return Object.values(obj);
    },
  });

  builtins.set('join', {
    type: 'function',
    name: 'join',
    params: [{ name: 'array' }, { name: 'sep' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (array: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array) || typeof sep !== 'string') return null;
      return array.map((item) => stringify(item)).join(sep);
    },
  });

  builtins.set('split', {
    type: 'function',
    name: 'split',
    params: [{ name: 'string' }, { name: 'sep' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof sep !== 'string') return null;
      return str.split(sep);
    },
  });

  builtins.set('read_file', {
    type: 'function',
    name: 'read_file',
    params: [{ name: 'path' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (filePath: RuntimeValue): RuntimeValue => {
      if (typeof filePath !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(filePath, interpreter);
        return fs.readFileSync(absolutePath, 'utf-8');
      } catch (e: any) {
        throw new Error(`Failed to read file: ${filePath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('write_file', {
    type: 'function',
    name: 'write_file',
    params: [{ name: 'path' }, { name: 'content' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (filePath: RuntimeValue, content: RuntimeValue): RuntimeValue => {
      if (typeof filePath !== 'string' || typeof content !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(filePath, interpreter);
        fs.writeFileSync(absolutePath, content, 'utf-8');
        return true;
      } catch (e: any) {
        throw new Error(`Failed to write file: ${filePath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('write_image', {
    type: 'function',
    name: 'write_image',
    params: [{ name: 'path' }, { name: 'base64_content' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (filePath: RuntimeValue, content: RuntimeValue): RuntimeValue => {
      if (typeof filePath !== 'string' || typeof content !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(filePath, interpreter);
        const buffer = Buffer.from(content, 'base64');
        fs.writeFileSync(absolutePath, buffer);
        return true;
      } catch (e: any) {
        throw new Error(`Failed to write image: ${filePath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('list_dir', {
    type: 'function',
    name: 'list_dir',
    params: [{ name: 'path' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (dirPath: RuntimeValue): RuntimeValue => {
      if (typeof dirPath !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(dirPath, interpreter);
        if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
          return null;
        }
        return fs.readdirSync(absolutePath).filter(f => !f.startsWith('.'));
      } catch (e: any) {
        throw new Error(`Failed to list directory: ${dirPath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('make_dir', {
    type: 'function',
    name: 'make_dir',
    params: [{ name: 'path' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (dirPath: RuntimeValue): RuntimeValue => {
      if (typeof dirPath !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(dirPath, interpreter);
        if (!fs.existsSync(absolutePath)) {
          fs.mkdirSync(absolutePath, { recursive: true });
        }
        return true;
      } catch (e: any) {
        throw new Error(`Failed to create directory: ${dirPath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('spawn', {
    type: 'function',
    name: 'spawn',
    params: [{ name: 'filePath' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (filePath: RuntimeValue): RuntimeValue => {
      const safeMode = interpreter?.safeMode ?? (process.env.SESI_SAFE_MODE !== 'false');
      if (safeMode) {
        throw new Error('Security Violation: spawn is disabled in Sesi safe mode.');
      }
      if (typeof filePath !== 'string') return null;
      try {
        const absolutePath = ensureSafePath(filePath, interpreter);
        // Use 'node' to run the local sesi executable if it's in the bin folder
        const sesiBin = path.resolve(__dirname, '../bin/sesi.js');
        const child = spawn('node', [sesiBin, absolutePath], {
          detached: true,
          stdio: 'inherit',
          shell: true
        });
        child.unref();
        return child.pid || true;
      } catch (e: any) {
        throw new Error(`Failed to spawn process: ${filePath}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('exec', {
    type: 'function',
    name: 'exec',
    params: [{ name: 'command' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (command: RuntimeValue): RuntimeValue => {
      const safeMode = interpreter?.safeMode ?? (process.env.SESI_SAFE_MODE !== 'false');
      if (safeMode) {
        throw new Error('Security Violation: exec is disabled in Sesi safe mode.');
      }
      if (typeof command !== 'string') return null;
      try {
        return execSync(command, { encoding: 'utf-8' });
      } catch (e: any) {
        throw new Error(`Failed to execute command: ${command}. Reason: ${e.message}`);
      }
    },
  });

  builtins.set('time', {
    type: 'function',
    name: 'time',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (): RuntimeValue => Date.now(),
  });

  builtins.set('random', {
    type: 'function',
    name: 'random',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (): RuntimeValue => Math.random(),
  });

  builtins.set('set_alias', {
    type: 'function',
    name: 'set_alias',
    params: [{ name: 'alias' }, { name: 'model' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (alias: RuntimeValue, model: RuntimeValue): RuntimeValue => {
      if (typeof alias !== 'string' || typeof model !== 'string') {
        throw new Error('set_alias expects (string alias, string model)');
      }
      if (!interpreter || typeof (interpreter as any).setModelAlias !== 'function') {
        throw new Error('set_alias interpreter reference is missing');
      }
      (interpreter as any).setModelAlias(alias, model);
      return true;
    },
  });

  builtins.set('error_type', {
    type: 'function',
    name: 'error_type',
    params: [{ name: 'type' }, { name: 'message' }, { name: 'data', defaultValue: null as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (typeVal: RuntimeValue, messageVal: RuntimeValue, dataVal: RuntimeValue = null): RuntimeValue => {
      if (typeof typeVal !== 'string' || typeVal.trim() === '') {
        throw new Error('error_type expects a non-empty string type');
      }
      if (typeof messageVal !== 'string') {
        throw new Error('error_type expects a string message');
      }
      const obj: Record<string, RuntimeValue> = Object.create(null);
      obj.type = typeVal;
      obj.message = messageVal;
      obj.data = dataVal;
      return obj;
    },
  });

  builtins.set('raise_error', {
    type: 'function',
    name: 'raise_error',
    params: [
      { name: 'type_or_error' },
      { name: 'message', defaultValue: '' as any },
      { name: 'data', defaultValue: null as any },
    ],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (typeOrError: RuntimeValue, messageVal: RuntimeValue = '', dataVal: RuntimeValue = null): RuntimeValue => {
      if (typeof typeOrError === 'object' && typeOrError !== null && !Array.isArray(typeOrError)) {
        const type = (typeOrError as any).type;
        const message = (typeOrError as any).message;
        const data = (typeOrError as any).data ?? null;
        if (typeof type !== 'string' || type.trim() === '' || typeof message !== 'string') {
          throw new Error('raise_error expects error object with string type and message');
        }
        throw new SesiRuntimeError(type, message, data as RuntimeValue);
      }

      if (typeof typeOrError !== 'string' || typeOrError.trim() === '') {
        throw new Error('raise_error expects first argument to be error object or non-empty string type');
      }

      if (typeof messageVal !== 'string' || messageVal.trim() === '') {
        throw new Error('raise_error expects a non-empty string message');
      }

      throw new SesiRuntimeError(typeOrError, messageVal, dataVal);
    },
  });

    builtins.set('define_tool', {
      type: 'function',
      name: 'define_tool',
      params: [{ name: 'name' }, { name: 'fn' }, { name: 'description', defaultValue: '' as any }],
      body: {} as any,
      closure: {} as any,
      isBuiltin: true,
      builtin: (name: RuntimeValue, fn: RuntimeValue, description: RuntimeValue = ''): RuntimeValue => {
        if (typeof name !== 'string') {
          throw new Error('define_tool expects first argument to be a string name');
        }
        if (typeof fn !== 'object' || !fn || (fn as any).type !== 'function') {
          throw new Error('define_tool expects second argument to be a function');
        }
        if (description !== null && typeof description !== 'string') {
          throw new Error('define_tool description must be a string');
        }
        if (!interpreter || typeof (interpreter as any).defineCustomTool !== 'function') {
          throw new Error('define_tool interpreter reference is missing');
        }

        (interpreter as any).defineCustomTool(name, fn as RuntimeFunction, typeof description === 'string' ? description : '');
        return true;
      },
    });

    builtins.set('list_tools', {
      type: 'function',
      name: 'list_tools',
      params: [],
      body: {} as any,
      closure: {} as any,
      isBuiltin: true,
      builtin: (): RuntimeValue => {
        if (!interpreter || typeof (interpreter as any).listCustomToolNames !== 'function') {
          throw new Error('list_tools interpreter reference is missing');
        }
        return (interpreter as any).listCustomToolNames();
      },
    });

  builtins.set('web_get', {
    type: 'function',
    name: 'web_get',
    params: [{ name: 'url' }, { name: 'headers', defaultValue: {} as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [urlVal, headersVal] = args;
      const url = typeof urlVal === 'string' ? urlVal : '';
      const headersObj: Record<string, string> = {};
      if (headersVal && typeof headersVal === 'object' && !Array.isArray(headersVal)) {
        for (const [k, v] of Object.entries(headersVal)) {
          headersObj[k] = String(v);
        }
      }
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: headersObj,
        });
        return await response.text();
      } catch (e: any) {
        throw new Error(`web_get failed: ${e.message}`);
      }
    }
  });

  builtins.set('web_send', {
    type: 'function',
    name: 'web_send',
    params: [{ name: 'url' }, { name: 'body' }, { name: 'headers', defaultValue: {} as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [urlVal, bodyVal, headersVal] = args;
      const url = typeof urlVal === 'string' ? urlVal : '';
      const body = typeof bodyVal === 'string' ? bodyVal : JSON.stringify(bodyVal);
      const headersObj: Record<string, string> = { 'Content-Type': 'application/json' };
      if (headersVal && typeof headersVal === 'object' && !Array.isArray(headersVal)) {
        for (const [k, v] of Object.entries(headersVal)) {
          headersObj[k] = String(v);
        }
      }
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: headersObj,
          body,
        });
        return await response.text();
      } catch (e: any) {
        throw new Error(`web_send failed: ${e.message}`);
      }
    }
  });

  builtins.set('multi_req', {
    type: 'function',
    name: 'multi_req',
    params: [{ name: 'fns' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [fnsVal] = args;
      if (!Array.isArray(fnsVal)) {
        throw new Error('multi_req expects an array of functions');
      }
      if (!interpreter) {
        throw new Error('multi_req interpreter reference is missing');
      }
      const promises = fnsVal.map(async (fn) => {
        if (typeof fn !== 'object' || fn === null || (fn as any).type !== 'function') {
          throw new Error('multi_req elements must be functions');
        }
        // Create an isolated sub-interpreter to prevent lexical scope and currentEnv corruption
        const InterpreterClass = interpreter.constructor;
        const subInterpreter = new InterpreterClass(undefined, {
          safeMode: interpreter.safeMode,
          allowLocalFs: interpreter.allowLocalFs,
          allowedPaths: interpreter.allowedPaths
        });
        (subInterpreter as any).prompts = new Map((interpreter as any).prompts);
        (subInterpreter as any).memory = new Map((interpreter as any).memory);

        return await subInterpreter.callSesiFunction(fn as any, []);
      });
      return await Promise.all(promises);
    }
  });

  const workflowBuiltin: RuntimeFunction = {
    type: 'function',
    name: 'workflow',
    params: [{ name: 'steps' }, { name: 'input', defaultValue: '' as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [stepsVal, inputVal] = args;
      if (!Array.isArray(stepsVal)) {
        throw new Error('workflow expects steps to be an array of objects');
      }

      const initialInput = stringify(inputVal ?? '');
      let previous = initialInput;
      const outputs: string[] = [];

      for (let i = 0; i < stepsVal.length; i++) {
        const step = stepsVal[i];
        if (typeof step !== 'object' || step === null || Array.isArray(step)) {
          throw new Error(`workflow step ${i + 1} must be an object`);
        }

        const stepObj = step as Record<string, RuntimeValue>;
        const rawPrompt = stepObj.prompt;
        if (typeof rawPrompt !== 'string' || rawPrompt.trim() === '') {
          throw new Error(`workflow step ${i + 1} requires a non-empty string prompt`);
        }

        let prompt = rawPrompt;
        const fromRef = typeof stepObj.from === 'string' ? stepObj.from.trim() : '';
        if (fromRef !== '') {
          const context = resolveWorkflowReference(fromRef, initialInput, previous, outputs);
          prompt = context === '' ? rawPrompt : `${rawPrompt} ${context}`;
        } else {
          // Intuitive default wiring: first step uses input, later steps use previous output.
          const defaultRef = i === 0 ? 'input' : 'previous';
          const context = resolveWorkflowReference(defaultRef, initialInput, previous, outputs);
          prompt = context === '' ? rawPrompt : `${rawPrompt} ${context}`;
        }

        const modelName = typeof stepObj.model === 'string' && stepObj.model.trim() !== ''
          ? stepObj.model
          : 'gemini-3.1-flash-lite';
        const model = interpreter && typeof (interpreter as any).resolveModelName === 'function'
          ? (interpreter as any).resolveModelName(modelName)
          : modelName;

        const response = await aiRuntime.callModel({
          model,
          prompt,
          temperature: typeof stepObj.temperature === 'number' ? stepObj.temperature : undefined,
          maxTokens: typeof stepObj.max_tokens === 'number' ? stepObj.max_tokens : undefined,
          topK: typeof stepObj.top_k === 'number' ? stepObj.top_k : undefined,
          topP: typeof stepObj.top_p === 'number' ? stepObj.top_p : undefined,
          thinkingLevel:
            typeof stepObj.thinkingLevel === 'object' || typeof stepObj.thinkingLevel === 'string'
              ? (stepObj.thinkingLevel as any)
              : undefined,
          cache: typeof stepObj.cache === 'boolean' ? stepObj.cache : undefined,
          search: typeof stepObj.search === 'boolean' ? stepObj.search : undefined,
        });

        previous = response.text;
        outputs.push(response.text);
      }

      const result: Record<string, RuntimeValue> = Object.create(null);
      result.input = initialInput;
      result.steps = outputs;
      result.final = previous;
      return result;
    },
  };

  builtins.set('workflow', workflowBuiltin);

  return builtins;
}

function resolveWorkflowReference(
  key: string,
  input: string,
  previous: string,
  outputs: string[],
): string {
  if (key === 'input') return input;
  if (key === 'previous') return previous;
  const stepMatch = /^step(\d+)$/.exec(key);
  if (stepMatch) {
    const index = Number(stepMatch[1]) - 1;
    if (index >= 0 && index < outputs.length) {
      return outputs[index];
    }
    throw new Error(`workflow reference ${key} is out of range`);
  }
  throw new Error(`workflow reference ${key} is invalid`);
}

export function isTruthy(value: RuntimeValue): boolean {
  if (value === null || value === false) return false;
  if (value === 0 || value === '') return false;
  return true;
}

export function stripPrototypes(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(stripPrototypes);
  }
  const cleanObj = Object.create(null);
  for (const key of Object.keys(val)) {
    cleanObj[key] = stripPrototypes(val[key]);
  }
  return cleanObj;
}

export function isEqual(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a === null && b === null) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  return a === b;
}

export function stringify(value: RuntimeValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    // Format numbers nicely
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const items = value.map((item) => stringify(item)).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object') {
    const items = Object.entries(value)
      .map(([key, val]) => `${key}: ${stringify(val)}`)
      .join(', ');
    return `{${items}}`;
  }
  return 'unknown';
}

export function compareValues(a: RuntimeValue, b: RuntimeValue): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  return 0;
}
