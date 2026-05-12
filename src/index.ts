
// Main entry point for Sesi
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import * as fs from 'fs';
import * as path from 'path';

export async function runSesi(source: string): Promise<void> {
  try {
    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();

    // Parse
    const parser = new Parser(tokens);
    const program = parser.parse();

    // Interpret
    const interpreter = new Interpreter();
    await interpreter.interpret(program);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

export async function runSesiFile(filePath: string): Promise<void> {
  try {
    const filepath = path.resolve(filePath);
    const source = fs.readFileSync(filepath, 'utf-8');
    await runSesi(source);
  } catch (error: any) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}
