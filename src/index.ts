
// Main entry point for Sesi
delete process.env.PKG_EXECPATH;
export { Lexer } from './lexer';
export { Parser } from './parser';
export { Interpreter } from './interpreter';
export { Environment } from './types';
export { Compiler } from './compiler';
export { VM } from './vm';
export { disassemble } from './chunk';
export { runInstall } from './pm';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { Compiler } from './compiler';
import { VM } from './vm';
import { disassemble } from './chunk';
import { SesiRuntimeError } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

async function encrypt(content: string, password: string): Promise<string> {
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update(String(password)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function decrypt(content: string, password: string): Promise<string> {
  const parts = content.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update(String(password)).digest();
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface SesiOptions {
  safeMode?: boolean;
  allowLocalFs?: boolean;
  allowedPaths?: string[];
  encrypt?: boolean;
  decrypt?: boolean;
  password?: string;
  raw?: boolean;
  ast?: boolean;
  tokens?: boolean;
  args?: string[];
  dry?: boolean;
  bytecode?: boolean;      // run via bytecode VM (default: true unless treeWalker is specified)
  bytecodeDump?: boolean;  // print disassembled bytecode then exit
  treeWalker?: boolean;    // run via tree-walking interpreter fallback
}

function printTokensTable(tokens: any[]): void {
  console.log('Line | Col  | Type                 | Lexeme');
  console.log('-----+------+----------------------+----------------');
  for (const token of tokens) {
    const line = String(token.line).padStart(4, ' ');
    const col = String(token.column).padStart(4, ' ');
    const type = token.type.padEnd(20, ' ');
    const lexeme = JSON.stringify(token.lexeme);
    console.log(`${line} | ${col} | ${type} | ${lexeme}`);
  }
}

function printAstTree(node: any, indent: string = ''): string {
  if (!node) return 'null';
  if (Array.isArray(node)) {
    return node.map(item => printAstTree(item, indent)).join('\n');
  }
  if (typeof node !== 'object') {
    return String(node);
  }
  const type = node.type || 'Object';
  let result = `${indent}└─ ${type}`;
  
  if (node.type === 'LetStatement') {
    result += ` (name: "${node.name.lexeme}")`;
  } else if (node.type === 'ConstStatement') {
    result += ` (name: "${node.name.lexeme}")`;
  } else if (node.type === 'Identifier') {
    result += ` (name: "${node.lexeme || node.name}")`;
  } else if (node.type === 'Literal') {
    result += ` (value: ${JSON.stringify(node.value)})`;
  } else if (node.type === 'BinaryExpression') {
    result += ` (operator: "${node.operator}")`;
  } else if (node.type === 'FunctionStatement') {
    result += ` (name: "${node.name.lexeme}")`;
  }
  
  const childrenKeys = Object.keys(node).filter(k => k !== 'type' && k !== 'line' && k !== 'column' && k !== 'lexeme');
  for (const key of childrenKeys) {
    const val = node[key];
    if (val && (typeof val === 'object' || Array.isArray(val))) {
      result += `\n${indent}   ├─ ${key}:`;
      if (Array.isArray(val)) {
        if (val.length === 0) {
          result += ' []';
        } else {
          result += '\n' + val.map(item => printAstTree(item, indent + '   │  ')).join('\n');
        }
      } else {
        result += '\n' + printAstTree(val, indent + '   │  ');
      }
    }
  }
  return result;
}

export async function runSesi(source: string, scriptDir?: string, options?: SesiOptions): Promise<void> {
  try {
    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();

    if (options?.tokens) {
      printTokensTable(tokens);
      return;
    }

    // Parse
    const parser = new Parser(tokens);
    const program = parser.parse();

    if (parser.errors.length > 0) {
      process.exit(1);
    }

    if (options?.encrypt) {
      if (!options.password) {
        console.error('Error: Password is required for encryption.');
        process.exit(1);
      }
      source = await encrypt(source, options.password);
      return;
    }

    if (options?.decrypt) {
      if (!options.password) {
        console.error('Error: Password is required for decryption.');
        process.exit(1);
      }
      source = await decrypt(source, options.password);
      return;
    }

    if (options?.raw) {
      console.log(JSON.stringify(program, null, 2));
      return;
    }

    if (options?.ast) {
      console.log(printAstTree(program));
      return;
    }

    if (options?.dry) {
      console.log('✓ Syntax is valid');
      return;
    }

    // Bytecode path (default)
    if (!options?.treeWalker && (options?.bytecode !== false || options?.bytecodeDump)) {
      const compiler = new Compiler();
      const chunk = compiler.compileProgram(program);

      if (compiler.errors.length > 0) {
        for (const e of compiler.errors) console.error('Compile error:', e);
        process.exit(1);
      }

      if (options?.bytecodeDump) {
        console.log(disassemble(chunk, scriptDir ? path.basename(scriptDir) : '<script>'));
        return;
      }

      const vm = new VM(scriptDir, options);
      await vm.run(chunk);
      return;
    }

    // Tree-walking interpreter fallback
    const interpreter = new Interpreter(scriptDir, options);
    await interpreter.interpret(program);
  } catch (error: any) {
    if (error instanceof SesiRuntimeError) {
      const lineInfo = error.column !== undefined
        ? ` at line ${error.line}, column ${error.column}`
        : (error.line !== undefined ? ` at line ${error.line}` : '');
      console.error(`Error${lineInfo}: ${error.message}`);
      if (error.output) {
        console.error(error.output);
      }
      if (error.stackTrace.length > 0) {
        console.error('Stack trace:');
        for (const frame of error.stackTrace) {
          console.error(`  at ${frame}`);
        }
      }
    } else {
      console.error('Error:', error?.message ?? String(error));
    }
    process.exit(1);
  }
}

export async function runSesiFile(filePath: string, options?: SesiOptions): Promise<void> {
  try {
    const filepath = path.resolve(filePath);
    const scriptDir = path.dirname(filepath);
    let source = fs.readFileSync(filepath, 'utf-8');

    // If the file matches the exact signature of our AES-256-CBC encryption (32-char hex IV : hex payload)
    if (/^[a-fA-F0-9]{32}:[a-fA-F0-9]+$/.test(source.trim()) && !options?.decrypt) {
      console.error(`Error: The file '${path.basename(filePath)}' is encrypted.`);
      console.error(`Please decrypt it first before running:`);
      console.error(`  sesi -decrypt ${path.basename(filePath)} -p <password>`);
      process.exit(1);
    }

    if (options?.encrypt || options?.decrypt) {
      if (!options.password) {
        console.error(`Error: Password is required for ${options.encrypt ? 'encryption' : 'decryption'}.`);
        process.exit(1);
      }
      if (options.encrypt) {
        const encrypted = await encrypt(source, options.password);
        fs.writeFileSync(filepath, encrypted, 'utf-8');
        console.log(`Successfully encrypted ${filePath}`);
      } else {
        const decrypted = await decrypt(source, options.password);
        fs.writeFileSync(filepath, decrypted, 'utf-8');
        console.log(`Successfully decrypted ${filePath}`);
      }
      return;
    }

    await runSesi(source, scriptDir, options);
  } catch (error: any) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}
