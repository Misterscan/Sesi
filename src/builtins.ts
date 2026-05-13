// Built-in functions for Sesi
import { RuntimeValue, RuntimeFunction } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';

export function getBuiltins(): Map<string, RuntimeFunction> {
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
        const absolutePath = path.resolve(process.cwd(), filePath);
        return fs.readFileSync(absolutePath, 'utf-8');
      } catch (e) {
        throw new Error(`Failed to read file: ${filePath}`);
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
        const absolutePath = path.resolve(process.cwd(), filePath);
        fs.writeFileSync(absolutePath, content, 'utf-8');
        return true;
      } catch (e) {
        throw new Error(`Failed to write file: ${filePath}`);
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
        const absolutePath = path.resolve(process.cwd(), dirPath);
        if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
          return null;
        }
        return fs.readdirSync(absolutePath).filter(f => !f.startsWith('.'));
      } catch (e) {
        throw new Error(`Failed to list directory: ${dirPath}`);
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
        const absolutePath = path.resolve(process.cwd(), dirPath);
        if (!fs.existsSync(absolutePath)) {
          fs.mkdirSync(absolutePath, { recursive: true });
        }
        return true;
      } catch (e) {
        throw new Error(`Failed to create directory: ${dirPath}`);
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
      if (typeof filePath !== 'string') return null;
      try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        // Use 'node' to run the local sesi executable if it's in the bin folder
        const sesiBin = path.resolve(__dirname, '../bin/sesi.js');
        const child = spawn('node', [sesiBin, absolutePath], {
          detached: true,
          stdio: 'inherit',
          shell: true
        });
        child.unref();
        return child.pid || true;
      } catch (e) {
        throw new Error(`Failed to spawn process: ${filePath}`);
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
      if (typeof command !== 'string') return null;
      try {
        return execSync(command, { encoding: 'utf-8' });
      } catch (e) {
        throw new Error(`Failed to execute command: ${command}`);
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

  return builtins;
}

export function isTruthy(value: RuntimeValue): boolean {
  if (value === null || value === false) return false;
  if (value === 0 || value === '') return false;
  return true;
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
