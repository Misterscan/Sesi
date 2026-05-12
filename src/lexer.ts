// Lexical analyzer (tokenizer) for Sesi
import { Token, TokenType } from './types';

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  private keywords: Map<string, TokenType> = new Map([
    ['let', 'LET'],
    ['const', 'CONST'],
    ['fn', 'FN'],
    ['if', 'IF'],
    ['else', 'ELSE'],
    ['while', 'WHILE'],
    ['for', 'FOR'],
    ['in', 'IN'],
    ['return', 'RETURN'],
    ['break', 'BREAK'],
    ['continue', 'CONTINUE'],
    ['try', 'TRY'],
    ['catch', 'CATCH'],
    ['true', 'TRUE'],
    ['false', 'FALSE'],
    ['null', 'NULL'],
    ['print', 'PRINT'],
    ['prompt', 'PROMPT'],
    ['model', 'MODEL'],
    ['structured_output', 'STRUCTURED_OUTPUT'],
    ['tool_call', 'TOOL_CALL'],
    ['memory', 'MEMORY'],
    ['import', 'IMPORT'],
    ['from', 'FROM'],
    ['export', 'EXPORT'],
    ['to', 'TO'], // Used in for loops
  ]);

  constructor(source: string) {
    this.source = source;
  }

  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;

      const start = this.position;
      this.scanToken();
    }

    this.tokens.push({
      type: 'EOF',
      lexeme: '',
      literal: null,
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      case '(':
        this.addToken('LEFT_PAREN');
        break;
      case ')':
        this.addToken('RIGHT_PAREN');
        break;
      case '{':
        this.addToken('LEFT_BRACE');
        break;
      case '}':
        this.addToken('RIGHT_BRACE');
        break;
      case '[':
        this.addToken('LEFT_BRACKET');
        break;
      case ']':
        this.addToken('RIGHT_BRACKET');
        break;
      case ',':
        this.addToken('COMMA');
        break;
      case ';':
        this.addToken('SEMICOLON');
        break;
      case ':':
        this.addToken('COLON');
        break;
      case '?':
        this.addToken('QUESTION');
        break;
      case '.':
        this.addToken('DOT');
        break;
      case '|':
        if (this.match('|')) {
          this.addToken('PIPE_PIPE');
        } else {
          this.addToken('PIPE');
        }
        break;
      case '&':
        if (this.match('&')) {
          this.addToken('AMPERSAND_AMPERSAND');
        }
        break;
      case '+':
        this.addToken('PLUS');
        break;
      case '-':
        if (this.match('>')) {
          this.addToken('ARROW');
        } else {
          this.addToken('MINUS');
        }
        break;
      case '*':
        this.addToken('STAR');
        break;
      case '/':
        this.addToken('SLASH');
        break;
      case '%':
        this.addToken('PERCENT');
        break;
      case '!':
        if (this.match('=')) {
          this.addToken('BANG_EQUAL', null, '!=');
        } else {
          this.addToken('BANG');
        }
        break;
      case '=':
        if (this.match('=')) {
          this.addToken('EQUAL_EQUAL', null, '==');
        } else {
          this.addToken('EQUAL');
        }
        break;
      case '<':
        if (this.match('=')) {
          this.addToken('LESS_EQUAL', null, '<=');
        } else if (this.match('>')) {
          this.addToken('LESS_GREATER', null, '<>');
        } else {
          this.addToken('LESS');
        }
        break;
      case '>':
        if (this.match('=')) {
          this.addToken('GREATER_EQUAL', null, '>=');
        } else {
          this.addToken('GREATER');
        }
        break;
      case '"':
      case "'":
        this.string(c);
        break;
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new Error(`Unexpected character: ${c} at line ${this.line}`);
        }
    }
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const c = this.peek();
      if (c === ' ' || c === '\r' || c === '\t') {
        this.advance();
      } else if (c === '\n') {
        this.line++;
        this.column = 0;
        this.advance();
      } else if (c === '/' && this.peekNext() === '/') {
        while (this.peek() !== '\n' && !this.isAtEnd()) {
          this.advance();
        }
      } else if (c === '/' && this.peekNext() === '*') {
        this.advance(); // /
        this.advance(); // *
        while (!(this.peek() === '*' && this.peekNext() === '/') && !this.isAtEnd()) {
          if (this.peek() === '\n') this.line++;
          this.advance();
        }
        if (!this.isAtEnd()) {
          this.advance(); // *
          this.advance(); // /
        }
      } else {
        break;
      }
    }
  }

  private string(quote: string): void {
    const startLine = this.line;
    const startPosition = this.position - 1;
    let value = '';

    while (this.peek() !== quote && !this.isAtEnd()) {
      if (this.peek() === '\n') this.line++;
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${startLine}`);
    }

    this.advance(); // closing quote
    const lexeme = this.source.substring(startPosition, this.position);
    this.addToken('STRING', value, lexeme);
  }

  private number(): void {
    const start = this.position - 1;
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume .
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const lexeme = this.source.substring(start, this.position);
    const value = parseFloat(lexeme);
    this.addToken('NUMBER', value, lexeme);
  }

  private identifier(): void {
    const start = this.position - 1;
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.substring(start, this.position);

    const type = this.keywords.get(lexeme) || 'IDENTIFIER';
    if (type === 'TRUE') {
      this.addToken(type, true, lexeme);
    } else if (type === 'FALSE') {
      this.addToken(type, false, lexeme);
    } else if (type === 'NULL') {
      this.addToken(type, null, lexeme);
    } else {
      this.addToken(type, null, lexeme);
    }
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.position) !== expected) return false;
    this.position++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.position);
  }

  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.position + 1);
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private advance(): string {
    const c = this.source.charAt(this.position);
    this.position++;
    this.column++;
    return c;
  }

  private addToken(type: TokenType, literal: any = null, customLexeme?: string): void {
    const lexeme = customLexeme !== undefined ? customLexeme : this.source.substring(this.position - 1, this.position);
    this.tokens.push({
      type,
      lexeme,
      literal,
      line: this.line,
      column: this.column - lexeme.length,
    });
  }
}
