// Core type definitions and AST nodes for Sesi

export type TokenType =
  // Literals
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  // Keywords
  | 'LET'
  | 'CONST'
  | 'FN'
  | 'IF'
  | 'ELSE'
  | 'WHILE'
  | 'FOR'
  | 'IN'
  | 'RETURN'
  | 'BREAK'
  | 'CONTINUE'
  | 'TRY'
  | 'CATCH'
  | 'FINALLY'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  | 'PRINT'
  | 'PROMPT'
  | 'MODEL'
  | 'IMAGE'
  | 'STRUCTURED_OUTPUT'
  | 'TOOL_CALL'
  | 'MEMORY'
  | 'IMPORT'
  | 'FROM'
  | 'EXPORT'
  | 'TO'
  | 'CONVERT'
  | 'ASYNC'
  | 'AWAIT'
  | 'ALLOW'
  | 'WITH'
  // Operators
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'EQUAL'
  | 'EQUAL_EQUAL'
  | 'BANG'
  | 'BANG_EQUAL'
  | 'LESS'
  | 'LESS_EQUAL'
  | 'GREATER'
  | 'GREATER_EQUAL'
  | 'AMPERSAND_AMPERSAND'
  | 'PIPE_PIPE'
  | 'PIPE'
  | 'DOT'
  | 'COMMA'
  | 'SEMICOLON'
  | 'COLON'
  | 'ARROW'
  | 'QUESTION'
  // Delimiters
  | 'LEFT_PAREN'
  | 'RIGHT_PAREN'
  | 'LEFT_BRACE'
  | 'RIGHT_BRACE'
  | 'LEFT_BRACKET'
  | 'RIGHT_BRACKET'
  | 'LESS_GREATER'
  // Special
  | 'EOF'
  | 'NEWLINE';

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: string | number | boolean | null;
  line: number;
  column: number;
}

// AST Node types
export type ASTNode = 
  | Program
  | Statement
  | Expression;

export interface Program {
  type: 'Program';
  statements: Statement[];
}

export type Statement =
  | LetStatement
  | ConstStatement
  | FunctionStatement
  | ExpressionStatement
  | BlockStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | TryStatement
  | ImportStatement
  | AllowStatement
  | ExportStatement
  | MemoryStatement;

export interface LetStatement {
  type: 'LetStatement';
  name: string;
  typeAnnotation?: TypeAnnotation;
  value?: Expression;
  line: number;
}

export interface ConstStatement {
  type: 'ConstStatement';
  name: string;
  typeAnnotation?: TypeAnnotation;
  value: Expression;
  line: number;
}

export interface FunctionStatement {
  type: 'FunctionStatement';
  name: string;
  parameters: Parameter[];
  returnType?: TypeAnnotation;
  body: BlockStatement;
  line: number;
  isAsync?: boolean;
}

export interface Parameter {
  name: string;
  type?: TypeAnnotation;
  defaultValue?: Expression;
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
  line: number;
}

export interface BlockStatement {
  type: 'BlockStatement';
  statements: Statement[];
  line: number;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  thenBranch: BlockStatement;
  elseBranch?: Statement;
  line: number;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: Expression;
  body: BlockStatement;
  line: number;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: string;
  iterable?: Expression; // for x in array
  start?: Expression;    // for x = 0
  end?: Expression;      // to 10
  body: BlockStatement;
  line: number;
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  value?: Expression;
  line: number;
}

export interface BreakStatement {
  type: 'BreakStatement';
  line: number;
}

export interface ContinueStatement {
  type: 'ContinueStatement';
  line: number;
}

export interface TryStatement {
  type: 'TryStatement';
  tryBlock: BlockStatement;
  catchParameter: string;
  catchBlock: BlockStatement;
  finallyBlock?: BlockStatement;
  line: number;
}

export interface ImportStatement {
  type: 'ImportStatement';
  names: string[];
  source: string;
  line: number;
}

export interface AllowStatement {
  type: 'AllowStatement';
  source: string;
  binding: string | string[]; // string for namespace, string[] for list of functions
  line: number;
}

export interface ExportStatement {
  type: 'ExportStatement';
  statement: FunctionStatement | LetStatement | ConstStatement;
  line: number;
}

export interface MemoryStatement {
  type: 'MemoryStatement';
  name: string;
  initialValue?: Expression;
  line: number;
}

export type Expression =
  | Literal
  | Identifier
  | BinaryOp
  | UnaryOp
  | LogicalOp
  | Assignment
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ArrayLiteral
  | ObjectLiteral
  | PromptExpression
  | ModelCallExpression
  | ImageCallExpression
  | StructuredOutputExpression
  | ToolCallExpression
  | ConditionalExpression
  | ConvertExpression
  | AwaitExpression;

export interface Literal {
  type: 'Literal';
  value: string | number | boolean | null;
  rawType: 'number' | 'string' | 'bool' | 'null';
  line: number;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
  line: number;
}

export interface BinaryOp {
  type: 'BinaryOp';
  left: Expression;
  operator: string;
  right: Expression;
  line: number;
}

export interface UnaryOp {
  type: 'UnaryOp';
  operator: string;
  operand: Expression;
  line: number;
}

export interface LogicalOp {
  type: 'LogicalOp';
  left: Expression;
  operator: '&&' | '||';
  right: Expression;
  line: number;
}

export interface Assignment {
  type: 'Assignment';
  left: Expression;
  right: Expression;
  line: number;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
  line: number;
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: string;
  line: number;
}

export interface IndexExpression {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
  line: number;
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: Expression[];
  line: number;
}

export interface ObjectLiteral {
  type: 'ObjectLiteral';
  properties: Array<{ key: string; value: Expression }>;
  line: number;
}

export interface PromptExpression {
  type: 'PromptExpression';
  name: string;
  content: Expression[];
  line: number;
}

export interface ModelCallExpression {
  type: 'ModelCallExpression';
  modelName: string;
  config?: Record<string, Expression>;
  prompt: Expression;
  images?: Expression; // string path or array of string paths
  line: number;
}

export interface ImageCallExpression {
  type: 'ImageCallExpression';
  modelName: string;
  config?: Record<string, Expression>;
  prompt: Expression;
  images?: Expression; // string path or array of string paths
  line: number;
}

export interface StructuredOutputExpression {
  type: 'StructuredOutputExpression';
  schema: Record<string, TypeAnnotation>;
  modelCall: Expression;
  line: number;
}

export interface ToolCallExpression {
  type: 'ToolCallExpression';
  functionName: string;
  arguments: Expression[];
  line: number;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  condition: Expression;
  thenExpr: Expression;
  elseExpr: Expression;
  line: number;
}

export interface ConvertExpression {
  type: 'ConvertExpression';
  conversionType: string;
  config?: Record<string, Expression>;
  file: Expression;
  line: number;
}

export interface AwaitExpression {
  type: 'AwaitExpression';
  expression: Expression;
  line: number;
}

export type TypeAnnotation =
  | PrimitiveType
  | ArrayType
  | ObjectType
  | UnionType
  | OptionalType;

export interface PrimitiveType {
  type: 'PrimitiveType';
  name: 'number' | 'string' | 'bool' | 'null' | 'any';
}

export interface ArrayType {
  type: 'ArrayType';
  elementType: TypeAnnotation;
}

export interface ObjectType {
  type: 'ObjectType';
  valueType: TypeAnnotation;
}

export interface UnionType {
  type: 'UnionType';
  types: TypeAnnotation[];
}

export interface OptionalType {
  type: 'OptionalType';
  baseType: TypeAnnotation;
}

// Runtime values
export type RuntimeValue = 
  | number
  | string
  | boolean
  | null
  | RuntimeArray
  | RuntimeObject
  | RuntimeFunction
  | RuntimeModule
  | RuntimePromise;

export interface RuntimeArray extends Array<RuntimeValue> {}

export interface RuntimeObject {
  [key: string]: RuntimeValue;
}

export interface RuntimeFunction {
  type: 'function';
  name: string;
  params: Parameter[];
  body: BlockStatement;
  closure: Environment;
  isBuiltin?: boolean;
  isAsync?: boolean;
  builtin?: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>;
}

export interface RuntimeModule {
  type: 'module';
  exports: Map<string, RuntimeValue>;
}

export interface RuntimePromise {
  type: 'promise';
  promise: Promise<RuntimeValue>;
}

// Environment for variable scoping
export class Environment {
  private vars: Map<string, RuntimeValue> = new Map();
  private parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  getValues(): Map<string, RuntimeValue> {
    return this.vars;
  }

  getParent(): Environment | null {
    return this.parent;
  }

  define(name: string, value: RuntimeValue): void {
    this.vars.set(name, value);
  }

  get(name: string): RuntimeValue {
    if (this.vars.has(name)) {
      return this.vars.get(name)!;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  set(name: string, value: RuntimeValue): void {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  exists(name: string): boolean {
    if (this.vars.has(name)) return true;
    if (this.parent) return this.parent.exists(name);
    return false;
  }
}

// AI request/response types
export interface AIRequest {
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  ratio?: string;
  size?: string;
  tools?: any[];
  images?: string[]; // base64-encoded image data URIs or file paths resolved at runtime
  thinkingLevel?: { thinking?: string; level?: string };
  cache?: boolean;
  search?: boolean;
  stream?: boolean | ((chunk: string) => void | Promise<void>);
}

export interface AIResponse {
  text: string;
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StructuredOutput {
  [key: string]: RuntimeValue;
}

// Control flow exceptions
export class ReturnValue extends Error {
  constructor(public value: RuntimeValue) {
    super();
  }
}

export class BreakException extends Error {
  constructor() {
    super();
  }
}

export class ContinueException extends Error {
  constructor() {
    super();
  }
}

export class SesiRuntimeError extends Error {
  public errorType: string;
  public data: RuntimeValue;
  public line?: number;
  public column?: number;
  public output?: string;
  public stackTrace: string[];

  constructor(
    errorType: string,
    message: string,
    data: RuntimeValue = null,
    line?: number,
    column?: number,
    output?: string,
    stackTrace: string[] = [],
  ) {
    super(message);
    this.name = 'SesiRuntimeError';
    this.errorType = errorType;
    this.data = data;
    this.line = line;
    this.column = column;
    this.output = output;
    this.stackTrace = stackTrace;
  }

  toRuntimeObject(): RuntimeObject {
    const obj: RuntimeObject = Object.create(null);
    obj.type = this.errorType;
    obj.message = this.message;
    obj.data = this.data;
    if (this.line !== undefined) {
      obj.line = this.line;
    }
    if (this.column !== undefined) {
      obj.column = this.column;
    }
    if (this.output !== undefined) {
      obj.output = this.output;
    }
    if (this.stackTrace.length > 0) {
      obj.stack_trace = this.stackTrace;
    }
    return obj;
  }
}

export type InterpreterError = {
  message: string;
  line?: number;
  column?: number;
};
