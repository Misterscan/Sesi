
// Main entry point for Sesi
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { SesiRuntimeError } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface SesiOptions {
  safeMode?: boolean;
  allowLocalFs?: boolean;
  allowedPaths?: string[];
}

export async function runSesi(source: string, scriptDir?: string, options?: SesiOptions): Promise<void> {
  try {
    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();

    // Parse
    const parser = new Parser(tokens);
    const program = parser.parse();

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
    const source = fs.readFileSync(filepath, 'utf-8');
    await runSesi(source, scriptDir, options);
  } catch (error: any) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}
