
// Main entry point for Sesi
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
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
  args?: string[];
}

export async function runSesi(source: string, scriptDir?: string, options?: SesiOptions): Promise<void> {
  try {
    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();

    // Parse
    const parser = new Parser(tokens);
    const program = parser.parse();

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

    // Interpret
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
