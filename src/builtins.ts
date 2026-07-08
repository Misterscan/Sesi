// Built-in functions for Sesi
import { RuntimeValue, RuntimeFunction, SesiRuntimeError } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { aiRuntime } from './ai-runtime';
import * as http from 'http';

// Browser Hot Reloading State
let isLiveReloadEnabled = false;
const liveReloadClients: any[] = [];
let liveReloadWatcher: any = null;

function shouldTriggerReload(filename: string): boolean {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, '/');
  
  if (normalized.includes('node_modules') || 
      normalized.includes('.git') || 
      normalized.includes('.gemini') ||
      normalized.includes('logs/')) {
    return false;
  }
  
  const basename = path.basename(normalized);
  if (basename.startsWith('.') || 
      basename.endsWith('.db') ||
      basename.endsWith('.log') ||
      basename.endsWith('.sqlite') ||
      basename.endsWith('.tmp') ||
      basename === '.sesi_cache.json' || 
      basename === '.sesi_chat_history.json') {
    return false;
  }
  
  const allowedExtensions = ['.sesi', '.html', '.css', '.js', '.json', '.svg', '.md', '.png', '.jpg', '.jpeg', '.gif'];
  const ext = path.extname(normalized).toLowerCase();
  return allowedExtensions.includes(ext);
}

function ensureWatcher(dirToWatch: string) {
  if (liveReloadWatcher) return;
  try {
    const fs = require('fs');
    liveReloadWatcher = fs.watch(dirToWatch, { recursive: true }, (eventType: string, filename: string) => {
      if (shouldTriggerReload(filename)) {
        broadcastReload();
      }
    });
    if (liveReloadWatcher && typeof liveReloadWatcher.unref === 'function') {
      liveReloadWatcher.unref();
    }
  } catch (e) {
    try {
      const fs = require('fs');
      liveReloadWatcher = fs.watch(dirToWatch, (eventType: string, filename: string) => {
        if (shouldTriggerReload(filename)) {
          broadcastReload();
        }
      });
      if (liveReloadWatcher && typeof liveReloadWatcher.unref === 'function') {
        liveReloadWatcher.unref();
      }
    } catch (err) {}
  }
}

let reloadTimeout: any = null;
function broadcastReload() {
  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(() => {
    for (const res of liveReloadClients) {
      try {
        res.write('data: reload\n\n');
      } catch (err) {}
    }
  }, 100);
}


export function ensureSafePath(filePath: string, interpreter?: any, baseDir: string = process.cwd()): string {
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

  builtins.set('debug', {
    type: 'function',
    name: 'debug',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (query: string): Promise<string> => {
        return new Promise((resolve) => rl.question(query, resolve));
      };

      console.log('\n=== 🛑 Sesi Debug Breakpoint Reached ===');
      console.log('Commands:');
      console.log('  env          - Show variables in current scope');
      console.log('  eval <code>  - Evaluate Sesi expression in current scope');
      console.log('  c, continue  - Resume execution');
      
      while (true) {
        const input = await question('sesi-debug> ');
        const trimmed = input.trim();
        if (trimmed === 'c' || trimmed === 'continue' || trimmed === 'exit') {
          break;
        } else if (trimmed === 'env') {
          if (interpreter) {
            let current = interpreter.currentEnv;
            console.log('\n--- Environment Scope Chain ---');
            let depth = 0;
            while (current) {
              console.log(`[Scope Level ${depth}]`);
              const vals = current.getValues();
              for (const [k, v] of vals.entries()) {
                console.log(`  ${k}: ${JSON.stringify(v)}`);
              }
              current = current.getParent();
              depth++;
            }
            console.log('-------------------------------\n');
          } else {
            console.log('No interpreter context available.');
          }
        } else if (trimmed.startsWith('eval ')) {
          const code = trimmed.substring(5);
          if (interpreter) {
            try {
              const { Lexer } = require('./lexer');
              const { Parser } = require('./parser');
              const lexer = new Lexer(code);
              const tokens = lexer.scanTokens();
              const parser = new Parser(tokens);
              const expr = parser.parseExpression();
              const val = await interpreter.evaluateExpression(expr);
              console.log(`=> ${JSON.stringify(val)}`);
            } catch (e: any) {
              console.log(`Error evaluating expression: ${e.message}`);
            }
          } else {
            console.log('No interpreter context available.');
          }
        } else if (trimmed) {
          console.log(`Unknown command: "${trimmed}". Type "c" to continue.`);
        }
      }
      rl.close();
      return null;
    }
  });

  builtins.set('input', {
    type: 'function',
    name: 'input',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const promptText = args[0] !== undefined ? stringify(args[0]) : '';
      
      if ((globalThis as any).sesiInputHandler) {
        return await (globalThis as any).sesiInputHandler(promptText);
      }
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise<RuntimeValue>((resolve, reject) => {
        rl.question(promptText, (answer: string) => {
          rl.close();
          resolve(answer);
        });
      });
    }
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
      if (typeof value === 'object') {
        if ((value as any).type === 'promise') return 'promise';
        return 'object';
      }
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

  builtins.set('to_upper', {
    type: 'function',
    name: 'to_upper',
    params: [{ name: 'string' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string') return null;
      return str.toUpperCase();
    },
  });

  builtins.set('to_lower', {
    type: 'function',
    name: 'to_lower',
    params: [{ name: 'string' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string') return null;
      return str.toLowerCase();
    },
  });

  builtins.set('trim', {
    type: 'function',
    name: 'trim',
    params: [{ name: 'string' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string') return null;
      return str.trim();
    },
  });

  builtins.set('slice', {
    type: 'function',
    name: 'slice',
    params: [
      { name: 'collection' },
      { name: 'start' },
      { name: 'end', defaultValue: null as any }
    ],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (...args: RuntimeValue[]): RuntimeValue => {
      const [collection, start, end] = args;
      if (typeof collection !== 'string' && !Array.isArray(collection)) return null;
      if (typeof start !== 'number') return null;
      const s = start;
      const e = (typeof end === 'number') ? end : undefined;
      return collection.slice(s, e);
    },
  });

  builtins.set('swap', {
    type: 'function',
    name: 'swap',
    params: [{ name: 'string' }, { name: 'target' }, { name: 'replacement' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue, target: RuntimeValue, replacement: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof target !== 'string' || typeof replacement !== 'string') return null;
      return str.split(target).join(replacement);
    },
  });

  builtins.set('contains', {
    type: 'function',
    name: 'contains',
    params: [{ name: 'string' }, { name: 'sub' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue, sub: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof sub !== 'string') return null;
      return str.includes(sub);
    },
  });

  builtins.set('locate', {
    type: 'function',
    name: 'locate',
    params: [{ name: 'string' }, { name: 'sub' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (str: RuntimeValue, sub: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof sub !== 'string') return null;
      return str.indexOf(sub);
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

  builtins.set('rename', {
    type: 'function',
    name: 'rename',
    params: [{ name: 'oldPath' }, { name: 'newPath' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (oldPathVal: RuntimeValue, newPathVal: RuntimeValue): RuntimeValue => {
      if (typeof oldPathVal !== 'string' || typeof newPathVal !== 'string') {
        throw new Error('rename expects string parameters: (oldPath, newPath)');
      }
      try {
        const oldAbsolutePath = ensureSafePath(oldPathVal, interpreter);
        const newAbsolutePath = ensureSafePath(newPathVal, interpreter);
        fs.renameSync(oldAbsolutePath, newAbsolutePath);
        return true;
      } catch (e: any) {
        throw new Error(`Failed to rename: from "${oldPathVal}" to "${newPathVal}". Reason: ${e.message}`);
      }
    },
  });

  builtins.set('archive', {
    type: 'function',
    name: 'archive',
    params: [{ name: 'sourcePath' }, { name: 'destPath', defaultValue: null as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (...args: RuntimeValue[]): RuntimeValue => {
      const [srcPathVal, destPathVal] = args;
      if (typeof srcPathVal !== 'string') {
        throw new Error('archive expects the sourcePath as a string parameter');
      }
      if (destPathVal !== undefined && destPathVal !== null && typeof destPathVal !== 'string') {
        throw new Error('archive expects the destPath to be a string parameter if provided');
      }
      try {
        const srcAbs = ensureSafePath(srcPathVal, interpreter);
        if (!fs.existsSync(srcAbs)) {
          throw new Error(`Source path does not exist: "${srcPathVal}"`);
        }
        
        let finalDestPathVal = destPathVal;
        if (finalDestPathVal === undefined || finalDestPathVal === null) {
          const baseName = path.basename(srcAbs);
          // Hidden cache folder: .archive in project root
          finalDestPathVal = path.join('.archive', baseName);
        }
        
        const destAbs = ensureSafePath(finalDestPathVal as string, interpreter);
        const destParent = path.dirname(destAbs);
        if (!fs.existsSync(destParent)) {
          fs.mkdirSync(destParent, { recursive: true });
        }

        fs.cpSync(srcAbs, destAbs, { recursive: true, force: true });
        return true;
      } catch (e: any) {
        throw new Error(`Failed to archive "${srcPathVal}": ${e.message}`);
      }
    },
  });

  builtins.set('trash', {
    type: 'function',
    name: 'trash',
    params: [{ name: 'path' }, { name: 'autoRemove', defaultValue: false as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: (...args: RuntimeValue[]): RuntimeValue => {
      const [filePathVal, autoRemoveVal] = args;
      if (typeof filePathVal !== 'string') {
        throw new Error('trash expects a string parameter: (path)');
      }
      try {
        const absolutePath = ensureSafePath(filePathVal, interpreter);
        if (!fs.existsSync(absolutePath)) {
          return false;
        }
        
        const autoRemove = isTruthy(autoRemoveVal);
        if (autoRemove) {
          fs.rmSync(absolutePath, { recursive: true, force: true });
          return true;
        }
        
        const trashDir = path.resolve(process.cwd(), '.trash');
        if (!fs.existsSync(trashDir)) {
          fs.mkdirSync(trashDir, { recursive: true });
        }
        
        const fileBasename = path.basename(absolutePath);
        const timestamp = Date.now();
        const ext = path.extname(fileBasename);
        const nameWithoutExt = path.basename(fileBasename, ext);
        
        const trashName = `${nameWithoutExt}_${timestamp}${ext}`;
        const trashPath = path.resolve(trashDir, trashName);
        const safeTrashPath = ensureSafePath(trashPath, interpreter);
        
        try {
          fs.renameSync(absolutePath, safeTrashPath);
        } catch (renameErr: any) {
          if (renameErr.code === 'EXDEV') {
            fs.cpSync(absolutePath, safeTrashPath, { recursive: true, force: true });
            fs.rmSync(absolutePath, { recursive: true, force: true });
          } else {
            throw renameErr;
          }
        }
        return true;
      } catch (e: any) {
        throw new Error(`Failed to trash "${filePathVal}": ${e.message}`);
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

  builtins.set('memory_search', {
    type: 'function',
    name: 'memory_search',
    params: [{ name: 'name' }, { name: 'query' }, { name: 'top_k' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [nameVal, queryVal, topKVal] = args;
      if (typeof nameVal !== 'string') {
        throw new Error('memory_search expects a string memory name as the first argument');
      }
      if (typeof queryVal !== 'string') {
        throw new Error('memory_search expects a string query as the second argument');
      }
      const topK = typeof topKVal === 'number' ? topKVal : 3;
      const results = await aiRuntime.searchMemory(nameVal, queryVal, topK);
      return results;
    },
  });

  builtins.set('memory_trim', {
    type: 'function',
    name: 'memory_trim',
    params: [{ name: 'name' }, { name: 'max_tokens' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [nameVal, maxTokensVal] = args;
      if (typeof nameVal !== 'string') {
        throw new Error('memory_trim expects a string memory name as the first argument');
      }
      const maxTokens = typeof maxTokensVal === 'number' ? maxTokensVal : 900000;
      const trimmed = await aiRuntime.trimMemory(nameVal, maxTokens);
      return trimmed;
    },
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
        const InterpreterClass = interpreter.constructor as any;
        const subInterpreter = new InterpreterClass(undefined, {
          safeMode: interpreter.safeMode,
          allowLocalFs: interpreter.allowLocalFs,
          raw: interpreter.raw,
          allowedPaths: interpreter.allowedPaths,
          args: interpreter.args
        });
        // Copy globals
        for (const [k, v] of (interpreter as any).globalEnv.getValues().entries()) {
          (subInterpreter as any).globalEnv.define(k, v);
        }
        // Copy model aliases
        for (const [k, v] of (interpreter as any).modelAliases.entries()) {
          (subInterpreter as any).setModelAlias(k, v);
        }
        (subInterpreter as any).prompts = new Map((interpreter as any).prompts);
        (subInterpreter as any).memory = new Map((interpreter as any).memory);

        let res = await subInterpreter.callSesiFunction(fn as any, []);
        if (typeof res === 'object' && res !== null && (res as any).type === 'promise') {
          res = await (res as any).promise;
        }
        return res;
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

  builtins.set('listen', {
    type: 'function',
    name: 'listen',
    params: [{ name: 'port' }, { name: 'handler' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [portVal, handlerVal] = args;
      if (typeof portVal !== 'number') {
        throw new Error('listen expects a numeric port number as the first argument');
      }
      if (typeof handlerVal !== 'object' || handlerVal === null || (handlerVal as any).type !== 'function') {
        throw new Error('listen expects a function handler as the second argument');
      }

      if (interpreter && interpreter.safeMode) {
        throw new Error('Security Violation: Native HTTP Server is disabled in safe mode.');
      }

      const server = http.createServer(async (req, res) => {
        if (req.url === '/__sesi_live') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          res.write('\n');
          liveReloadClients.push(res);
          req.on('close', () => {
            const index = liveReloadClients.indexOf(res);
            if (index !== -1) {
              liveReloadClients.splice(index, 1);
            }
          });
          return;
        }

        let body = '';
        try {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          body = Buffer.concat(buffers).toString('utf8');
        } catch (err) {
          // ignore
        }

        const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((val, key) => {
          query[key] = val;
        });

        const sesiReq: Record<string, any> = {
          method: req.method || 'GET',
          path: urlObj.pathname,
          headers: req.headers as any,
          body,
          query,
        };

        try {
          let result = await interpreter.callSesiFunction(handlerVal as any, [sesiReq]);
          if (typeof result === 'object' && result !== null && (result as any).type === 'promise') {
            result = await (result as any).promise;
          }

          if (result === null) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('');
          } else if (typeof result === 'object' && !Array.isArray(result)) {
            const status = typeof result.status === 'number' ? result.status : 200;
            const headers: Record<string, string> = { 'Content-Type': 'text/html' };
            if (result.headers && typeof result.headers === 'object' && !Array.isArray(result.headers)) {
              for (const [k, v] of Object.entries(result.headers)) {
                headers[k] = String(v);
              }
            }

            let responseBody: any = '';
            if (result.body !== undefined) {
              if (typeof result.body === 'object' && result.body !== null) {
                responseBody = JSON.stringify(result.body);
                if (!headers['Content-Type'] || headers['Content-Type'] === 'text/html') {
                  headers['Content-Type'] = 'application/json';
                }
              } else {
                const contentType = String(headers['Content-Type'] || '').toLowerCase();
                const isBinaryType = (contentType.startsWith('image/') && contentType !== 'image/svg+xml') || contentType.startsWith('audio/') || contentType.startsWith('video/') || contentType.startsWith('application/octet-stream');
                if (isBinaryType && typeof result.body === 'string') {
                  try {
                    responseBody = Buffer.from(result.body, 'base64');
                  } catch (err) {
                    responseBody = String(result.body);
                  }
                } else {
                  responseBody = String(result.body);
                }
              }
            } else {
              if (result.status === undefined && result.headers === undefined) {
                responseBody = JSON.stringify(result);
                headers['Content-Type'] = 'application/json';
              }
            }

            // Inject Sesi Live Reload script if enabled and response is HTML
            const responseContentType = String(headers['Content-Type'] || '').toLowerCase();
            if (isLiveReloadEnabled && responseContentType.includes('text/html') && typeof responseBody === 'string') {
              const liveReloadScript = `
<!-- Sesi Live Reload -->
<script>
  (function() {
    const source = new EventSource('/__sesi_live');
    source.onmessage = function(event) {
      if (event.data === 'reload') {
        window.location.reload();
      }
    };
  })();
</script>
`;
              if (responseBody.includes('</body>')) {
                responseBody = responseBody.replace('</body>', liveReloadScript + '</body>');
              } else {
                responseBody += liveReloadScript;
              }
            }

            res.writeHead(status, headers);
            res.end(responseBody);
          } else {
            let bodyStr = String(result);
            if (isLiveReloadEnabled) {
              const liveReloadScript = `
<!-- Sesi Live Reload -->
<script>
  (function() {
    const source = new EventSource('/__sesi_live');
    source.onmessage = function(event) {
      if (event.data === 'reload') {
        window.location.reload();
      }
    };
  })();
</script>
`;
              if (bodyStr.includes('</body>')) {
                bodyStr = bodyStr.replace('</body>', liveReloadScript + '</body>');
              } else {
                bodyStr += liveReloadScript;
              }
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(bodyStr);
          }
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Internal Server Error: ${err.message}`);
        }
      });

      return new Promise<RuntimeValue>((resolve, reject) => {
        server.listen(portVal, () => {
          const serverObj: Record<string, RuntimeValue> = Object.create(null);
          serverObj.close = {
            type: 'function',
            name: 'close',
            params: [],
            body: {} as any,
            closure: {} as any,
            isBuiltin: true,
            builtin: (): RuntimeValue => {
              server.close();
              return true;
            }
          };
          resolve(serverObj);
        });

        server.on('error', (err) => {
          reject(new Error(`Server failed to start: ${err.message}`));
        });
      });
    }
  });

  builtins.set('api', {
    type: 'function',
    name: 'api',
    params: [],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const portVal = args[0];
      const handlerVal = args[1];

      if (typeof portVal !== 'number') {
        throw new Error('api expects a numeric port number as the first argument');
      }
      if (!handlerVal || typeof handlerVal !== 'object' || (handlerVal as any).type !== 'function') {
        throw new Error('api expects a function handler as the second argument');
      }

      if (interpreter && interpreter.safeMode) {
        throw new Error('Security Violation: Native WebSocket Server is disabled in safe mode.');
      }

      const { WebSocketServer } = require('ws');
      const wss = new WebSocketServer({ port: portVal });

      wss.on('connection', (ws: any) => {
        const clientObj: Record<string, RuntimeValue> = Object.create(null);
        clientObj.send = {
          type: 'function',
          name: 'send',
          params: [],
          body: {} as any,
          closure: {} as any,
          isBuiltin: true,
          builtin: (...sendArgs: RuntimeValue[]): RuntimeValue => {
            const msg = stringify(sendArgs[0]);
            ws.send(msg);
            return null;
          }
        };
        clientObj.close = {
          type: 'function',
          name: 'close',
          params: [],
          body: {} as any,
          closure: {} as any,
          isBuiltin: true,
          builtin: (): RuntimeValue => {
            ws.close();
            return null;
          }
        };

        ws.on('message', async (messageData: any) => {
          const messageStr = messageData.toString();
          try {
            let result = await interpreter.callSesiFunction(handlerVal as any, [clientObj, messageStr]);
            if (typeof result === 'object' && result !== null && (result as any).type === 'promise') {
              await (result as any).promise;
            }
          } catch (err: any) {
            console.error(`Error executing Sesi WebSocket handler: ${err.message}`);
          }
        });
      });

      const serverObj: Record<string, RuntimeValue> = Object.create(null);
      serverObj.close = {
        type: 'function',
        name: 'close',
        params: [],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: (): RuntimeValue => {
          wss.close();
          return true;
        }
      };

      return serverObj;
    }
  });

  builtins.set('retry', {
    type: 'function',
    name: 'retry',
    params: [
      { name: 'action' },
      { name: 'options', defaultValue: null as any }
    ],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [actionVal, optionsVal] = args;
      if (typeof actionVal !== 'object' || actionVal === null || (actionVal as any).type !== 'function') {
        throw new Error('retry expects first argument to be a function');
      }
      if (!interpreter) {
        throw new Error('retry interpreter reference is missing');
      }

      let maxRetries = 3;
      let initialDelay = 1000;
      let backoffFactor = 2.0;

      if (optionsVal && typeof optionsVal === 'object' && !Array.isArray(optionsVal)) {
        const opts = optionsVal as Record<string, RuntimeValue>;
        if (typeof opts.max_retries === 'number') maxRetries = opts.max_retries;
        if (typeof opts.initial_delay === 'number') initialDelay = opts.initial_delay;
        if (typeof opts.backoff_factor === 'number') backoffFactor = opts.backoff_factor;
      } else if (typeof optionsVal === 'number') {
        maxRetries = optionsVal;
      }

      let lastError: any = null;
      let delay = initialDelay;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          let res = await interpreter.callSesiFunction(actionVal as RuntimeFunction, []);
          if (typeof res === 'object' && res !== null && (res as any).type === 'promise') {
            res = await (res as any).promise;
          }
          return res;
        } catch (e: any) {
          lastError = e;
          if (attempt > maxRetries) {
            break;
          }
          console.warn(`Attempt ${attempt} failed: ${e.message || e}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.round(delay * backoffFactor);
        }
      }

      throw lastError || new Error('retry failed');
    }
  });

  builtins.set('map', {
    type: 'function',
    name: 'map',
    params: [{ name: 'array' }, { name: 'callback' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (array: RuntimeValue, callback: RuntimeValue): Promise<RuntimeValue> => {
      if (!Array.isArray(array)) {
        throw new Error('map expects first argument to be an array');
      }
      if (typeof callback !== 'object' || callback === null || (callback as any).type !== 'function') {
        throw new Error('map expects second argument to be a function');
      }
      if (!interpreter) {
        throw new Error('map interpreter reference is missing');
      }

      const result: RuntimeValue[] = [];
      for (let i = 0; i < array.length; i++) {
        let val = await interpreter.callSesiFunction(callback as RuntimeFunction, [array[i], i, array]);
        if (typeof val === 'object' && val !== null && (val as any).type === 'promise') {
          val = await (val as any).promise;
        }
        result.push(val);
      }
      return result;
    }
  });

  builtins.set('filter', {
    type: 'function',
    name: 'filter',
    params: [{ name: 'array' }, { name: 'callback' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (array: RuntimeValue, callback: RuntimeValue): Promise<RuntimeValue> => {
      if (!Array.isArray(array)) {
        throw new Error('filter expects first argument to be an array');
      }
      if (typeof callback !== 'object' || callback === null || (callback as any).type !== 'function') {
        throw new Error('filter expects second argument to be a function');
      }
      if (!interpreter) {
        throw new Error('filter interpreter reference is missing');
      }

      const result: RuntimeValue[] = [];
      for (let i = 0; i < array.length; i++) {
        let val = await interpreter.callSesiFunction(callback as RuntimeFunction, [array[i], i, array]);
        if (typeof val === 'object' && val !== null && (val as any).type === 'promise') {
          val = await (val as any).promise;
        }
        if (isTruthy(val)) {
          result.push(array[i]);
        }
      }
      return result;
    }
  });

  builtins.set('reduce', {
    type: 'function',
    name: 'reduce',
    params: [
      { name: 'array' },
      { name: 'callback' },
      { name: 'initialValue', defaultValue: undefined as any }
    ],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [array, callback, initialValue] = args;
      if (!Array.isArray(array)) {
        throw new Error('reduce expects first argument to be an array');
      }
      if (typeof callback !== 'object' || callback === null || (callback as any).type !== 'function') {
        throw new Error('reduce expects second argument to be a function');
      }
      if (!interpreter) {
        throw new Error('reduce interpreter reference is missing');
      }

      let accumulator = initialValue;
      let startIndex = 0;

      if (args.length < 3) {
        if (array.length === 0) {
          throw new Error('reduce of empty array with no initial value');
        }
        accumulator = array[0];
        startIndex = 1;
      }

      for (let i = startIndex; i < array.length; i++) {
        let val = await interpreter.callSesiFunction(callback as RuntimeFunction, [accumulator, array[i], i, array]);
        if (typeof val === 'object' && val !== null && (val as any).type === 'promise') {
          val = await (val as any).promise;
        }
        accumulator = val;
      }
      return accumulator;
    }
  });

  builtins.set('find', {
    type: 'function',
    name: 'find',
    params: [{ name: 'array' }, { name: 'callback' }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (array: RuntimeValue, callback: RuntimeValue): Promise<RuntimeValue> => {
      if (!Array.isArray(array)) {
        throw new Error('find expects first argument to be an array');
      }
      if (typeof callback !== 'object' || callback === null || (callback as any).type !== 'function') {
        throw new Error('find expects second argument to be a function');
      }
      if (!interpreter) {
        throw new Error('find interpreter reference is missing');
      }

      for (let i = 0; i < array.length; i++) {
        let val = await interpreter.callSesiFunction(callback as RuntimeFunction, [array[i], i, array]);
        if (typeof val === 'object' && val !== null && (val as any).type === 'promise') {
          val = await (val as any).promise;
        }
        if (isTruthy(val)) {
          return array[i];
        }
      }
      return null;
    }
  });

  builtins.set('live', {
    type: 'function',
    name: 'live',
    params: [{ name: 'filePath' }, { name: 'exportName', defaultValue: 'handle' as any }],
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: async (...args: RuntimeValue[]): Promise<RuntimeValue> => {
      const [filePathVal, rawExportName] = args;
      if (typeof filePathVal !== 'string') {
        throw new Error('live expects the file path as the first argument');
      }
      const exportNameVal = typeof rawExportName === 'string' ? rawExportName : 'handle';

      if (!interpreter) {
        throw new Error('live interpreter reference is missing');
      }

      // Activate live reloading watcher
      isLiveReloadEnabled = true;
      ensureWatcher(process.cwd());

      const liveFn: RuntimeFunction = {
        type: 'function',
        name: `live_wrapper_${exportNameVal}`,
        params: [],
        body: {} as any,
        closure: {} as any,
        isBuiltin: true,
        builtin: async (...callArgs: RuntimeValue[]): Promise<RuntimeValue> => {
          const resolvedPath = ensureSafePath(filePathVal, interpreter);
          if (!fs.existsSync(resolvedPath)) {
            throw new Error(`live file not found: "${resolvedPath}"`);
          }

          if (!filePathVal.endsWith('.sesi')) {
            // Static webpage / file: hot reload content by reading dynamically
            return fs.readFileSync(resolvedPath, 'utf-8');
          }

          const content = fs.readFileSync(resolvedPath, 'utf-8');
          const { Lexer } = require('./lexer');
          const { Parser } = require('./parser');
          const { Interpreter } = require('./interpreter');

          const lexer = new Lexer(content);
          const parser = new Parser(lexer.scanTokens());
          const program = parser.parse();

          const subInterpreter = new Interpreter(path.dirname(resolvedPath), {
            safeMode: interpreter.safeMode,
            allowLocalFs: interpreter.allowLocalFs,
            allowedPaths: interpreter.allowedPaths,
            args: interpreter.args
          });
          await subInterpreter.interpret(program);

          const handler = subInterpreter.exports.get(exportNameVal);
          if (!handler) {
            throw new Error(`Module "${filePathVal}" does not export a function named "${exportNameVal}"`);
          }
          if (typeof handler !== 'object' || handler.type !== 'function') {
            throw new Error(`Export "${exportNameVal}" in module "${filePathVal}" is not a function`);
          }

          let res = await subInterpreter.callSesiFunction(handler as any, callArgs);
          if (typeof res === 'object' && res !== null && (res as any).type === 'promise') {
            res = await (res as any).promise;
          }
          return res;
        }
      };

      return liveFn;
    }
  });

  // Introspection
  builtins.set('name', {
    type: 'function', name: 'name', params: [{ name: 'func' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (func: RuntimeValue): RuntimeValue => {
      if (typeof func === 'object' && func !== null && (func as any).type === 'function') {
        return (func as any).name || '';
      }
      return null;
    }
  });

  builtins.set('arity', {
    type: 'function', name: 'arity', params: [{ name: 'func' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (func: RuntimeValue): RuntimeValue => {
      if (typeof func === 'object' && func !== null && (func as any).type === 'function') {
        return Array.isArray((func as any).params) ? (func as any).params.length : 0;
      }
      return null;
    }
  });

  builtins.set('is_function', {
    type: 'function', name: 'is_function', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => {
      return typeof value === 'object' && value !== null && (value as any).type === 'function';
    }
  });

  // Collection Checks
  builtins.set('is_array', {
    type: 'function', name: 'is_array', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => Array.isArray(value)
  });
  builtins.set('is_object', {
    type: 'function', name: 'is_object', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => typeof value === 'object' && value !== null && !Array.isArray(value) && (value as any).type !== 'function' && (value as any).type !== 'promise'
  });
  builtins.set('is_string', {
    type: 'function', name: 'is_string', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => typeof value === 'string'
  });
  builtins.set('is_number', {
    type: 'function', name: 'is_number', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => typeof value === 'number'
  });
  builtins.set('is_bool', {
    type: 'function', name: 'is_bool', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => typeof value === 'boolean'
  });
  builtins.set('is_null', {
    type: 'function', name: 'is_null', params: [{ name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (value: RuntimeValue): RuntimeValue => value === null
  });

  // String Functions
  builtins.set('length', builtins.get('len')!);

  builtins.set('starts_with', {
    type: 'function', name: 'starts_with', params: [{ name: 'string' }, { name: 'prefix' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (str: RuntimeValue, prefix: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof prefix !== 'string') return null;
      return str.startsWith(prefix);
    }
  });

  builtins.set('ends_with', {
    type: 'function', name: 'ends_with', params: [{ name: 'string' }, { name: 'suffix' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (str: RuntimeValue, suffix: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof suffix !== 'string') return null;
      return str.endsWith(suffix);
    }
  });

  builtins.set('index_of', {
    type: 'function', name: 'index_of', params: [{ name: 'collection' }, { name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (collection: RuntimeValue, value: RuntimeValue): RuntimeValue => {
      if (typeof collection === 'string' && typeof value === 'string') {
        return collection.indexOf(value);
      }
      if (Array.isArray(collection)) {
        return collection.indexOf(value);
      }
      return null;
    }
  });

  builtins.set('repeat', {
    type: 'function', name: 'repeat', params: [{ name: 'string' }, { name: 'count' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (str: RuntimeValue, count: RuntimeValue): RuntimeValue => {
      if (typeof str !== 'string' || typeof count !== 'number') return null;
      return str.repeat(Math.max(0, Math.floor(count)));
    }
  });


  builtins.set('includes', {
    type: 'function', name: 'includes', params: [{ name: 'collection' }, { name: 'value' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (collection: RuntimeValue, value: RuntimeValue): RuntimeValue => {
      if (typeof collection === 'string' && typeof value === 'string') {
        return collection.includes(value);
      }
      if (Array.isArray(collection)) {
        return collection.includes(value);
      }
      return false;
    }
  });

  builtins.set('reverse', {
    type: 'function', name: 'reverse', params: [{ name: 'array' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (array: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array)) return null;
      return [...array].reverse();
    }
  });

  builtins.set('sort', {
    type: 'function', name: 'sort', params: [{ name: 'array' }, { name: 'compareFn', defaultValue: null as any }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: async (array: RuntimeValue, compareFn: RuntimeValue): Promise<RuntimeValue> => {
      if (!Array.isArray(array)) return null;
      const copy = [...array];
      if (typeof compareFn === 'object' && compareFn !== null && (compareFn as any).type === 'function') {
        if (!interpreter) return null;
        for (let i = 0; i < copy.length; i++) {
          for (let j = 0; j < copy.length - 1 - i; j++) {
            const res = await interpreter.callSesiFunction(compareFn as any, [copy[j], copy[j+1]]);
            if (typeof res === 'number' && res > 0) {
              const temp = copy[j];
              copy[j] = copy[j+1];
              copy[j+1] = temp;
            }
          }
        }
        return copy;
      } else {
        copy.sort();
        return copy;
      }
    }
  });

  builtins.set('unique', {
    type: 'function', name: 'unique', params: [{ name: 'array' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (array: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array)) return null;
      return Array.from(new Set(array));
    }
  });

  builtins.set('flatten', {
    type: 'function', name: 'flatten', params: [{ name: 'array' }], body: {} as any, closure: {} as any, isBuiltin: true,
    builtin: (array: RuntimeValue): RuntimeValue => {
      if (!Array.isArray(array)) return null;
      return array.flat();
    }
  });

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
    if ((value as any).type === 'promise') return 'Promise { <pending> }';
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
