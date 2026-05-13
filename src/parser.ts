// Recursive descent parser for Sesi
import {
  type Token,
  type TokenType,
  type Program,
  type Statement,
  type Expression,
  type FunctionStatement,
  type Parameter,
  type TypeAnnotation,
  type LetStatement,
  type ConstStatement,
  type ExpressionStatement,
  type BlockStatement,
  type IfStatement,
  type WhileStatement,
  type ForStatement,
  type ReturnStatement,
  type BreakStatement,
  type ContinueStatement,
  type TryStatement,
  type ImportStatement,
  type ExportStatement,
  type MemoryStatement,
  type Literal,
  type Identifier,
  type BinaryOp,
  type UnaryOp,
  type LogicalOp,
  type Assignment,
  type CallExpression,
  type MemberExpression,
  type IndexExpression,
  type ArrayLiteral,
  type ObjectLiteral,
  type PromptExpression,
  type ModelCallExpression,
  type StructuredOutputExpression,
  type ToolCallExpression,
  type ConditionalExpression,
  type PrimitiveType,
  type ArrayType,
  type ObjectType,
  type UnionType,
  type OptionalType,
} from './types';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const statements: Statement[] = [];

    while (!this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) statements.push(stmt);
    }

    return {
      type: 'Program',
      statements,
    };
  }

  private statement(): Statement | null {
    this.skipNewlines();
    if (this.isAtEnd()) return null;
    try {
      if (this.match('LET')) return this.letStatement();
      if (this.match('CONST')) return this.constStatement();
      if (this.match('FN')) return this.functionStatement();
      if (this.match('IF')) return this.ifStatement();
      if (this.match('WHILE')) return this.whileStatement();
      if (this.match('FOR')) return this.forStatement();
      if (this.match('RETURN')) return this.returnStatement();
      if (this.match('BREAK')) return this.breakStatement();
      if (this.match('CONTINUE')) return this.continueStatement();
      if (this.match('TRY')) return this.tryStatement();
      if (this.match('IMPORT')) return this.importStatement();
      if (this.match('EXPORT')) return this.exportStatement();
      if (this.match('MEMORY')) return this.memoryStatement();
      if (this.check('LEFT_BRACE')) return this.blockStatement();
      return this.expressionStatement();
    } catch (error: any) {
      console.error(error.message);
      this.synchronize();
      return null;
    }
  }

  private letStatement(): LetStatement {
    const line = this.previous().line;
    const name = this.consume('IDENTIFIER', 'Expected variable name').lexeme;
    let typeAnnotation: TypeAnnotation | undefined;

    if (this.match('COLON')) {
      typeAnnotation = this.typeAnnotation();
    }

    let value: Expression | undefined;
    if (this.match('EQUAL')) {
      value = this.expression();
    }

    this.consumeStatementEnd();
    return {
      type: 'LetStatement',
      name,
      typeAnnotation,
      value,
      line,
    };
  }

  private constStatement(): ConstStatement {
    const line = this.previous().line;
    const name = this.consume('IDENTIFIER', 'Expected variable name').lexeme;
    let typeAnnotation: TypeAnnotation | undefined;

    if (this.match('COLON')) {
      typeAnnotation = this.typeAnnotation();
    }

    this.consume('EQUAL', 'Expected = in const declaration');
    const value = this.expression();
    this.consumeStatementEnd();

    return {
      type: 'ConstStatement',
      name,
      typeAnnotation,
      value,
      line,
    };
  }

  private functionStatement(): FunctionStatement {
    const line = this.previous().line;
    const name = this.consume('IDENTIFIER', 'Expected function name').lexeme;
    this.consume('LEFT_PAREN', 'Expected ( after function name');

    const parameters: Parameter[] = [];
    if (!this.check('RIGHT_PAREN')) {
      do {
        const paramName = this.consume('IDENTIFIER', 'Expected parameter name').lexeme;
        let paramType: TypeAnnotation | undefined;

        if (this.match('COLON')) {
          paramType = this.typeAnnotation();
        }

        let defaultValue: Expression | undefined;
        if (this.match('EQUAL')) {
          defaultValue = this.assignment();
        }

        parameters.push({ name: paramName, type: paramType, defaultValue });
      } while (this.match('COMMA'));
    }

    this.consume('RIGHT_PAREN', 'Expected ) after parameters');

    let returnType: TypeAnnotation | undefined;
    if (this.match('ARROW')) {
      returnType = this.typeAnnotation();
    }

    this.skipNewlines();
    const body = this.blockStatement();

    return {
      type: 'FunctionStatement',
      name,
      parameters,
      returnType,
      body,
      line,
    };
  }

  private ifStatement(): IfStatement {
    const line = this.previous().line;
    const condition = this.expression();
    this.skipNewlines();
    const thenBranch = this.blockStatement();
    let elseBranch: Statement | undefined;

    if (this.match('ELSE')) {
      if (this.match('IF')) {
        elseBranch = this.ifStatement();
      } else {
        this.skipNewlines();
        elseBranch = this.blockStatement();
      }
    }

    return {
      type: 'IfStatement',
      condition,
      thenBranch,
      elseBranch,
      line,
    };
  }

  private whileStatement(): WhileStatement {
    const line = this.previous().line;
    const condition = this.expression();
    this.skipNewlines();
    const body = this.blockStatement();

    return {
      type: 'WhileStatement',
      condition,
      body,
      line,
    };
  }

  private forStatement(): ForStatement {
    const line = this.previous().line;
    const variable = this.consume('IDENTIFIER', 'Expected variable in for loop').lexeme;

    let iterable: Expression | undefined;
    let start: Expression | undefined;
    let end: Expression | undefined;

    if (this.match('IN')) {
      iterable = this.expression();
    } else if (this.match('EQUAL')) {
      start = this.expression();
      this.consume('TO', 'Expected "to" in for loop (use: for i = 0 to 10)');
      end = this.expression();
    }

    this.skipNewlines();
    const body = this.blockStatement();

    return {
      type: 'ForStatement',
      variable,
      iterable,
      start,
      end,
      body,
      line,
    };
  }

  private returnStatement(): ReturnStatement {
    const line = this.previous().line;
    let value: Expression | undefined;

    if (!this.check('SEMICOLON') && !this.check('NEWLINE') && !this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      value = this.expression();
    }

    this.consumeStatementEnd();
    return {
      type: 'ReturnStatement',
      value,
      line,
    };
  }

  private breakStatement(): BreakStatement {
    const line = this.previous().line;
    this.consumeStatementEnd();
    return {
      type: 'BreakStatement',
      line,
    };
  }

  private continueStatement(): ContinueStatement {
    const line = this.previous().line;
    this.consumeStatementEnd();
    return {
      type: 'ContinueStatement',
      line,
    };
  }

  private tryStatement(): TryStatement {
    const line = this.previous().line;
    this.skipNewlines();
    const tryBlock = this.blockStatement();
    
    this.skipNewlines();
    this.consume('CATCH', 'Expected "catch" after try block');
    this.skipNewlines();
    let catchParameter = 'e';
    if (this.match('LEFT_PAREN')) {
      catchParameter = this.consume('IDENTIFIER', 'Expected error variable name').lexeme;
      this.consume('RIGHT_PAREN', 'Expected ")" after catch parameter');
    }
    this.skipNewlines();
    const catchBlock = this.blockStatement();

    return {
      type: 'TryStatement',
      tryBlock,
      catchParameter,
      catchBlock,
      line,
    };
  }

  private importStatement(): ImportStatement {
    const line = this.previous().line;
    const names: string[] = [];

    if (this.match('LEFT_BRACE')) {
      do {
        names.push(this.consume('IDENTIFIER', 'Expected import name').lexeme);
      } while (this.match('COMMA'));
      this.consume('RIGHT_BRACE', 'Expected } after imports');
    } else {
      names.push(this.consume('IDENTIFIER', 'Expected import name').lexeme);
    }

    this.consume('FROM', 'Expected "from" in import statement');
    const source = this.consume('STRING', 'Expected module path').literal;

    this.consumeStatementEnd();
    return {
      type: 'ImportStatement',
      names,
      source: source as string,
      line,
    };
  }

  private exportStatement(): ExportStatement {
    const line = this.previous().line;
    let statement: FunctionStatement | LetStatement | ConstStatement;

    if (this.match('FN')) {
      statement = this.functionStatement();
    } else if (this.match('LET')) {
      statement = this.letStatement();
    } else if (this.match('CONST')) {
      statement = this.constStatement();
    } else {
      throw new Error('Expected function or variable declaration after export');
    }

    return {
      type: 'ExportStatement',
      statement,
      line,
    };
  }

  private memoryStatement(): MemoryStatement {
    const line = this.previous().line;
    const name = this.consume('IDENTIFIER', 'Expected memory name').lexeme;
    let initialValue: Expression | undefined;

    if (this.match('LEFT_BRACE')) {
      const content: Expression[] = [];
      while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
        content.push(this.expression());
      }
      this.consume('RIGHT_BRACE', 'Expected }');

      if (content.length === 1) {
        initialValue = content[0];
      } else if (content.length > 1) {
        // Concatenate strings
        let result = content[0];
        for (let i = 1; i < content.length; i++) {
          result = {
            type: 'BinaryOp',
            left: result,
            operator: '+',
            right: content[i],
            line,
          };
        }
        initialValue = result;
      }
    }

    this.consumeStatementEnd();
    return {
      type: 'MemoryStatement',
      name,
      initialValue,
      line,
    };
  }

  private blockStatement(): BlockStatement {
    this.consume('LEFT_BRACE', 'Expected { to start block');
    const line = this.previous().line;

    const statements: Statement[] = [];
    this.skipNewlines();
    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) statements.push(stmt);
      this.skipNewlines();
    }

    this.consume('RIGHT_BRACE', 'Expected } to end block');

    return {
      type: 'BlockStatement',
      statements,
      line,
    };
  }

  private expressionStatement(): ExpressionStatement {
    const line = this.peek().line;
    const expr = this.expression();
    this.consumeStatementEnd();

    return {
      type: 'ExpressionStatement',
      expression: expr,
      line,
    };
  }

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    const expr = this.logicalOr();

    if (this.match('EQUAL')) {
      const value = this.assignment();
      return {
        type: 'Assignment',
        left: expr,
        right: value,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private logicalOr(): Expression {
    let expr = this.logicalAnd();

    while (this.match('PIPE_PIPE')) {
      const operator = this.previous().lexeme;
      const right = this.logicalAnd();
      expr = {
        type: 'LogicalOp',
        left: expr,
        operator: '||',
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private logicalAnd(): Expression {
    let expr = this.equality();

    while (this.match('AMPERSAND_AMPERSAND')) {
      const right = this.equality();
      expr = {
        type: 'LogicalOp',
        left: expr,
        operator: '&&',
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private equality(): Expression {
    let expr = this.comparison();

    while (this.match('BANG_EQUAL', 'EQUAL_EQUAL')) {
      const operator = this.previous().lexeme;
      const right = this.comparison();
      expr = {
        type: 'BinaryOp',
        left: expr,
        operator,
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private comparison(): Expression {
    let expr = this.addition();

    while (this.match('GREATER', 'GREATER_EQUAL', 'LESS', 'LESS_EQUAL')) {
      const operator = this.previous().lexeme;
      const right = this.addition();
      expr = {
        type: 'BinaryOp',
        left: expr,
        operator,
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private addition(): Expression {
    let expr = this.multiplication();

    while (this.match('MINUS', 'PLUS')) {
      const operator = this.previous().lexeme;
      const right = this.multiplication();
      expr = {
        type: 'BinaryOp',
        left: expr,
        operator,
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private multiplication(): Expression {
    let expr = this.unary();

    while (this.match('SLASH', 'STAR', 'PERCENT')) {
      const operator = this.previous().lexeme;
      const right = this.unary();
      expr = {
        type: 'BinaryOp',
        left: expr,
        operator,
        right,
        line: this.previous().line,
      };
    }

    return expr;
  }

  private unary(): Expression {
    if (this.match('BANG', 'MINUS')) {
      const operator = this.previous().lexeme;
      const operand = this.unary();
      return {
        type: 'UnaryOp',
        operator,
        operand,
        line: this.previous().line,
      };
    }

    return this.postfix();
  }

  private postfix(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match('LEFT_PAREN')) {
        expr = this.finishCall(expr);
      } else if (this.match('LEFT_BRACKET')) {
        const index = this.expression();
        this.consume('RIGHT_BRACKET', 'Expected ] after index');
        expr = {
          type: 'IndexExpression',
          object: expr,
          index,
          line: this.previous().line,
        };
      } else if (this.match('DOT')) {
        const property = this.consume('IDENTIFIER', 'Expected property name').lexeme;
        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          line: this.previous().line,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    const args: Expression[] = [];

    if (!this.check('RIGHT_PAREN')) {
      do {
        this.skipNewlines();
        args.push(this.assignment());
        this.skipNewlines();
        this.match('COMMA');
        this.skipNewlines();
      } while (!this.check('RIGHT_PAREN') && !this.isAtEnd());
    }

    this.consume('RIGHT_PAREN', 'Expected ) after arguments');

    return {
      type: 'CallExpression',
      callee,
      arguments: args,
      line: this.previous().line,
    };
  }

  private primary(): Expression {
    if (this.match('TRUE')) {
      return {
        type: 'Literal',
        value: true,
        rawType: 'bool',
        line: this.previous().line,
      };
    }

    if (this.match('FALSE')) {
      return {
        type: 'Literal',
        value: false,
        rawType: 'bool',
        line: this.previous().line,
      };
    }

    if (this.match('NULL')) {
      return {
        type: 'Literal',
        value: null,
        rawType: 'null',
        line: this.previous().line,
      };
    }

    if (this.match('NUMBER')) {
      return {
        type: 'Literal',
        value: this.previous().literal,
        rawType: 'number',
        line: this.previous().line,
      };
    }

    if (this.match('STRING')) {
      return {
        type: 'Literal',
        value: this.previous().literal,
        rawType: 'string',
        line: this.previous().line,
      };
    }

    if (this.match('LEFT_BRACKET')) {
      return this.arrayLiteral();
    }

    if (this.match('LEFT_BRACE')) {
      return this.objectLiteral();
    }

    if (this.match('PRINT')) {
      const args: Expression[] = [];
      let hasParens = false;
      
      if (this.match('LEFT_PAREN')) {
        hasParens = true;
      }
      
      if (hasParens) {
        if (!this.check('RIGHT_PAREN')) {
          do {
            args.push(this.assignment());
          } while (this.match('COMMA'));
        }
        this.consume('RIGHT_PAREN', 'Expected ) after print arguments');
      } else {
        // Without parens, allow multiple expressions separated by commas or spaces (on the same line)
        do {
          args.push(this.assignment());
          // Optional comma
          this.match('COMMA');
        } while (!this.check('SEMICOLON') && !this.check('NEWLINE') && !this.check('RIGHT_BRACE') && !this.isAtEnd());
      }

      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'print',
          line: this.previous().line,
        },
        arguments: args,
        line: this.previous().line,
      };
    }

    if (this.match('PROMPT')) {
      return this.promptExpression();
    }

    if (this.match('MODEL')) {
      return this.modelCall();
    }

    if (this.match('STRUCTURED_OUTPUT')) {
      return this.structuredOutput();
    }

    if (this.match('TOOL_CALL')) {
      return this.toolCall();
    }

    if (this.match('IDENTIFIER')) {
      return {
        type: 'Identifier',
        name: this.previous().lexeme,
        line: this.previous().line,
      };
    }

    if (this.match('LEFT_PAREN')) {
      const expr = this.expression();
      this.consume('RIGHT_PAREN', 'Expected ) after expression');
      return expr;
    }

    throw new Error(`Unexpected token: ${this.peek().lexeme} at line ${this.peek().line}`);
  }

  private arrayLiteral(): ArrayLiteral {
    const line = this.previous().line;
    const elements: Expression[] = [];

    if (!this.check('RIGHT_BRACKET')) {
      do {
        elements.push(this.assignment());
      } while (this.match('COMMA'));
    }

    this.consume('RIGHT_BRACKET', 'Expected ] after array elements');

    return {
      type: 'ArrayLiteral',
      elements,
      line,
    };
  }

  private objectLiteral(): ObjectLiteral {
    const line = this.previous().line;
    const properties: Array<{ key: string; value: Expression }> = [];

    if (!this.check('RIGHT_BRACE')) {
      do {
        const key = this.consume('STRING', 'Expected string key').literal;
        this.consume('COLON', 'Expected : after object key');
        const value = this.assignment();
        properties.push({ key: key as string, value });
      } while (this.match('COMMA'));
    }

    this.consume('RIGHT_BRACE', 'Expected } after object properties');

    return {
      type: 'ObjectLiteral',
      properties,
      line,
    };
  }

  private promptExpression(): PromptExpression {
    const line = this.previous().line;
    const name = this.consume('IDENTIFIER', 'Expected prompt name').lexeme;
    this.consume('LEFT_BRACE', 'Expected { after prompt name');

    const content: Expression[] = [];
    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      if (this.check('STRING')) {
        this.advance();
        content.push({
          type: 'Literal',
          value: this.previous().literal,
          rawType: 'string',
          line: this.previous().line,
        });
      } else {
        content.push(this.expression());
      }
    }

    this.consume('RIGHT_BRACE', 'Expected } after prompt content');

    return {
      type: 'PromptExpression',
      name,
      content,
      line,
    };
  }

  private modelCall(): ModelCallExpression {
    const line = this.previous().line;
    this.consume('LEFT_PAREN', 'Expected ( after model');
    const modelName = this.consume('STRING', 'Expected model name').literal;
    this.consume('RIGHT_PAREN', 'Expected ) after model name');

    let config: Record<string, Expression> | undefined;
    
    this.skipNewlines();
    let hasConfig = false;
    if (this.check('LEFT_BRACE')) {
      const insideToken = this.tokens[this.current + 1];
      if (insideToken.type === 'RIGHT_BRACE' && this.current + 2 < this.tokens.length && this.tokens[this.current + 2].type === 'LEFT_BRACE') {
        hasConfig = true;
      } else if (insideToken.type === 'STRING' || insideToken.type === 'IDENTIFIER') {
        if (this.current + 2 < this.tokens.length && this.tokens[this.current + 2].type === 'COLON') {
          hasConfig = true;
        }
      }
    }

    if (hasConfig) {
      this.advance(); // consume LEFT_BRACE
      config = {};
      if (!this.check('RIGHT_BRACE')) {
        do {
          let key: string;
          if (this.check('STRING')) {
            key = this.consume('STRING', '').literal as string;
          } else {
            key = this.consume('IDENTIFIER', 'Expected config key').lexeme;
          }
          this.consume('COLON', 'Expected : after config key');
          config[key] = this.assignment();
        } while (this.match('COMMA'));
      }
      this.consume('RIGHT_BRACE', 'Expected } after config');
    }

    this.skipNewlines();
    // Prompt or block
    let prompt: Expression;
    this.skipNewlines();
    if (this.check('LEFT_BRACE')) {
      this.advance();
      const content: Expression[] = [];
      while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
        if (this.check('STRING')) {
          this.advance();
          content.push({
            type: 'Literal',
            value: this.previous().literal,
            rawType: 'string',
            line: this.previous().line,
          });
        } else {
          content.push(this.expression());
        }
      }
      this.consume('RIGHT_BRACE', 'Expected }');

      if (content.length === 1) {
        prompt = content[0];
      } else {
        let result = content[0];
        for (let i = 1; i < content.length; i++) {
          result = {
            type: 'BinaryOp',
            left: result,
            operator: '+',
            right: content[i],
            line,
          };
        }
        prompt = result;
      }
    } else {
      throw new Error('Expected prompt block after model call');
    }

    return {
      type: 'ModelCallExpression',
      modelName: modelName as string,
      config,
      prompt,
      line,
    };
  }

  private structuredOutput(): StructuredOutputExpression {
    const line = this.previous().line;
    this.consume('LEFT_PAREN', 'Expected ( after structured_output');
    this.consume('LEFT_BRACE', 'Expected { for schema');

    const schema: Record<string, TypeAnnotation> = {};
    if (!this.check('RIGHT_BRACE')) {
      do {
        const key = this.consume('IDENTIFIER', 'Expected field name').lexeme;
        this.consume('COLON', 'Expected : after field name');
        schema[key] = this.typeAnnotation();
      } while (this.match('COMMA'));
    }

    this.consume('RIGHT_BRACE', 'Expected } after schema');
    this.consume('RIGHT_PAREN', 'Expected ) after schema');

    this.skipNewlines();
    this.consume('LEFT_PAREN', 'Expected ( for model call');
    this.skipNewlines();
    this.consume('MODEL', 'Expected model expression in structured_output');
    const modelCall = this.modelCall();
    this.consume('RIGHT_PAREN', 'Expected ) after model call');

    return {
      type: 'StructuredOutputExpression',
      schema,
      modelCall,
      line,
    };
  }

  private toolCall(): ToolCallExpression {
    const line = this.previous().line;
    this.consume('LEFT_PAREN', 'Expected ( after tool_call');
    const functionName = this.consume('IDENTIFIER', 'Expected function name').lexeme;
    this.consume('RIGHT_PAREN', 'Expected ) after function name');

    this.consume('LEFT_PAREN', 'Expected ( for arguments');
    const args: Expression[] = [];
    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(this.assignment());
      } while (this.match('COMMA'));
    }
    this.consume('RIGHT_PAREN', 'Expected ) after arguments');

    return {
      type: 'ToolCallExpression',
      functionName,
      arguments: args,
      line,
    };
  }

  private typeAnnotation(): TypeAnnotation {
    if (this.check('IDENTIFIER')) {
      const name = this.advance().lexeme;
      switch (name) {
        case 'number':
        case 'string':
        case 'bool':
        case 'null': {
          let type: TypeAnnotation = {
            type: 'PrimitiveType',
            name: name,
          };

          if (this.match('QUESTION')) {
            type = {
              type: 'OptionalType',
              baseType: type,
            };
          }

          return type;
        }

        case 'array':
          if (this.match('LESS')) {
            const elementType = this.typeAnnotation();
            this.consume('GREATER', 'Expected > in array type');
            return {
              type: 'ArrayType',
              elementType,
            };
          }
          return { type: 'PrimitiveType', name: 'any' };

        case 'object':
          if (this.match('LESS')) {
            const valueType = this.typeAnnotation();
            this.consume('GREATER', 'Expected > in object type');
            return {
              type: 'ObjectType',
              valueType,
            };
          }
          return { type: 'PrimitiveType', name: 'any' };

        default:
          throw new Error(`Unknown type: ${name}`);
      }
    }

    throw new Error('Expected type annotation');
  }

  private skipNewlines(): void {
    while (this.match('NEWLINE'));
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.peek().line}, got ${this.peek().type}`);
  }

  private consumeStatementEnd(): void {
    if (this.match('SEMICOLON') || this.match('NEWLINE')) return;
    if (this.check('RIGHT_BRACE') || this.isAtEnd()) return;
    
    // Allow implicit end of statement after a block-ending expression
    if (this.previous().type === 'RIGHT_BRACE') return;
    
    throw new Error(`Expected end of statement, got ${this.peek().lexeme}`);
  }

  private synchronize(): void {
    this.advance();

    const syncTokens: TokenType[] = ['FN', 'LET', 'CONST', 'FOR', 'IF', 'WHILE', 'RETURN'];

    while (!this.isAtEnd()) {
      if (syncTokens.includes(this.peek().type)) {
        return;
      }
      this.advance();
    }
  }
}
