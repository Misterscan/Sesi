// Static type checker for Sesi
// Walks the AST and validates type annotations without executing the program.
// Plugs into the --check / --dry pipeline alongside dry-checker.ts.

import { type Program, type Statement, type Expression, type TypeAnnotation, type BlockStatement } from './types';

export interface TypeDiagnostic {
  severity: 'error' | 'warning';
  code: 'type-mismatch' | 'return-type-mismatch' | 'argument-type-mismatch';
  message: string;
  line: number;
}

// Lightweight scoped map of name → declared TypeAnnotation
class TypeEnv {
  private bindings = new Map<string, TypeAnnotation>();
  private parent: TypeEnv | null;

  constructor(parent: TypeEnv | null = null) {
    this.parent = parent;
  }

  define(name: string, annotation: TypeAnnotation): void {
    this.bindings.set(name, annotation);
  }

  get(name: string): TypeAnnotation | null {
    return this.bindings.get(name) ?? this.parent?.get(name) ?? null;
  }

  child(): TypeEnv {
    return new TypeEnv(this);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANY: TypeAnnotation = { type: 'PrimitiveType', name: 'any' };

function isAny(ann: TypeAnnotation): boolean {
  return ann.type === 'PrimitiveType' && ann.name === 'any';
}

function annotationLabel(ann: TypeAnnotation): string {
  switch (ann.type) {
    case 'PrimitiveType': return ann.name;
    case 'ArrayType':     return `${annotationLabel(ann.elementType)}[]`;
    case 'ObjectType':    return `object<${annotationLabel(ann.valueType)}>`;
    case 'UnionType':     return ann.types.map(annotationLabel).join(' | ');
    case 'OptionalType':  return `${annotationLabel(ann.baseType)}?`;
  }
}

function inferType(expr: Expression, env: TypeEnv): TypeAnnotation {
  switch (expr.type) {
    case 'Literal': {
      const name = expr.rawType as 'number' | 'string' | 'bool' | 'null';
      return { type: 'PrimitiveType', name };
    }
    case 'ArrayLiteral':
      return { type: 'ArrayType', elementType: ANY };
    case 'ObjectLiteral':
      return { type: 'ObjectType', valueType: ANY };
    case 'Identifier': {
      const ann = env.get(expr.name);
      return ann ?? ANY;
    }
    case 'UnaryOp':
      if (expr.operator === '-') return inferType(expr.operand, env);
      break;
    case 'BinaryOp': {
      const l = inferType(expr.left, env);
      const r = inferType(expr.right, env);
      if (
        (l.type === 'PrimitiveType' && l.name === 'string') ||
        (r.type === 'PrimitiveType' && r.name === 'string')
      ) {
        return { type: 'PrimitiveType', name: 'string' };
      }
      if (['+', '-', '*', '/', '%'].includes(expr.operator)) {
        return { type: 'PrimitiveType', name: 'number' };
      }
      break;
    }
    case 'LogicalOp':
      return { type: 'PrimitiveType', name: 'bool' };
    case 'ConditionalExpression':
      return inferType(expr.thenExpr, env);
  }
  return ANY;
}

function isCompatible(expected: TypeAnnotation, actual: TypeAnnotation): boolean {
  if (isAny(expected) || isAny(actual)) return true;

  if (expected.type === 'OptionalType') {
    if (actual.type === 'PrimitiveType' && actual.name === 'null') return true;
    return isCompatible(expected.baseType, actual);
  }

  if (expected.type === 'UnionType') {
    return expected.types.some(t => isCompatible(t, actual));
  }

  if (actual.type === 'UnionType') {
    return actual.types.every(t => isCompatible(expected, t));
  }

  if (expected.type !== actual.type) return false;

  switch (expected.type) {
    case 'PrimitiveType':
      return expected.name === (actual as typeof expected).name;
    case 'ArrayType':
      return isCompatible(expected.elementType, (actual as typeof expected).elementType);
    case 'ObjectType':
      return isCompatible(expected.valueType, (actual as typeof expected).valueType);
  }
  return false;
}

// ── Walker ───────────────────────────────────────────────────────────────────

class TypeChecker {
  private diagnostics: TypeDiagnostic[] = [];

  check(program: Program): TypeDiagnostic[] {
    const env = new TypeEnv();
    this.checkStatements(program.statements, env, undefined);
    return this.diagnostics;
  }

  private checkStatements(
    statements: Statement[],
    env: TypeEnv,
    expectedReturn: TypeAnnotation | undefined,
  ): void {
    for (const stmt of statements) {
      this.checkStatement(stmt, env, expectedReturn);
    }
  }

  private checkStatement(
    stmt: Statement,
    env: TypeEnv,
    expectedReturn: TypeAnnotation | undefined,
  ): void {
    switch (stmt.type) {
      case 'LetStatement': {
        if (stmt.typeAnnotation && stmt.value) {
          const actual = inferType(stmt.value, env);
          if (!isCompatible(stmt.typeAnnotation, actual)) {
            this.diagnostics.push({
              severity: 'error',
              code: 'type-mismatch',
              message: `Type mismatch: "${stmt.name}" is annotated as "${annotationLabel(stmt.typeAnnotation)}" but initialised with "${annotationLabel(actual)}"`,
              line: stmt.line,
            });
          }
        }
        env.define(stmt.name, stmt.typeAnnotation ?? ANY);
        break;
      }

      case 'FunctionStatement': {
        env.define(stmt.name, ANY);
        const fnEnv = env.child();
        for (const param of stmt.parameters) {
          fnEnv.define(param.name, param.type ?? ANY);
        }
        this.checkBlock(stmt.body, fnEnv, stmt.returnType);
        break;
      }

      case 'IfStatement': {
        this.checkBlock(stmt.thenBranch, env.child(), expectedReturn);
        if (stmt.elseBranch) this.checkStatement(stmt.elseBranch, env, expectedReturn);
        break;
      }

      case 'WhileStatement': {
        this.checkBlock(stmt.body, env.child(), expectedReturn);
        break;
      }

      case 'ForStatement': {
        const loopEnv = env.child();
        loopEnv.define(stmt.variable, ANY);
        this.checkBlock(stmt.body, loopEnv, expectedReturn);
        break;
      }

      case 'TryStatement': {
        this.checkBlock(stmt.tryBlock, env.child(), expectedReturn);
        const catchEnv = env.child();
        catchEnv.define(stmt.catchParameter, ANY);
        this.checkBlock(stmt.catchBlock, catchEnv, expectedReturn);
        if (stmt.finallyBlock) this.checkBlock(stmt.finallyBlock, env.child(), expectedReturn);
        break;
      }

      case 'ReturnStatement': {
        if (expectedReturn && stmt.value) {
          const actual = inferType(stmt.value, env);
          if (!isCompatible(expectedReturn, actual)) {
            this.diagnostics.push({
              severity: 'error',
              code: 'return-type-mismatch',
              message: `Return type mismatch: expected "${annotationLabel(expectedReturn)}" but returning "${annotationLabel(actual)}"`,
              line: stmt.line,
            });
          }
        }
        break;
      }

      case 'ExportStatement': {
        this.checkStatement(stmt.statement, env, expectedReturn);
        break;
      }

      case 'ExpressionStatement': {
        this.checkExpression(stmt.expression, env);
        break;
      }

      case 'BlockStatement': {
        this.checkStatements(stmt.statements, env.child(), expectedReturn);
        break;
      }

      default:
        break;
    }
  }

  private checkBlock(
    block: BlockStatement,
    env: TypeEnv,
    expectedReturn: TypeAnnotation | undefined,
  ): void {
    this.checkStatements(block.statements, env, expectedReturn);
  }

  private checkExpression(expr: Expression, env: TypeEnv): void {
    switch (expr.type) {
      case 'Assignment': {
        if (expr.left.type === 'Identifier') {
          const ann = env.get(expr.left.name);
          if (ann && !isAny(ann)) {
            const actual = inferType(expr.right, env);
            if (!isCompatible(ann, actual)) {
              this.diagnostics.push({
                severity: 'error',
                code: 'type-mismatch',
                message: `Type mismatch: cannot assign "${annotationLabel(actual)}" to "${expr.left.name}" (declared "${annotationLabel(ann)}")`,
                line: expr.line,
              });
            }
          }
        }
        this.checkExpression(expr.right, env);
        break;
      }
      case 'CallExpression': {
        for (const arg of expr.arguments) this.checkExpression(arg, env);
        break;
      }
      case 'BinaryOp': {
        this.checkExpression(expr.left, env);
        this.checkExpression(expr.right, env);
        break;
      }
      case 'UnaryOp': {
        this.checkExpression(expr.operand, env);
        break;
      }
      case 'LogicalOp': {
        this.checkExpression(expr.left, env);
        this.checkExpression(expr.right, env);
        break;
      }
      case 'ConditionalExpression': {
        this.checkExpression(expr.condition, env);
        this.checkExpression(expr.thenExpr, env);
        this.checkExpression(expr.elseExpr, env);
        break;
      }
      case 'MemberExpression': {
        this.checkExpression(expr.object, env);
        break;
      }
      case 'IndexExpression': {
        this.checkExpression(expr.object, env);
        this.checkExpression(expr.index, env);
        break;
      }
      case 'ArrayLiteral': {
        for (const el of expr.elements) this.checkExpression(el, env);
        break;
      }
      case 'ObjectLiteral': {
        for (const prop of expr.properties) this.checkExpression(prop.value, env);
        break;
      }
      case 'AwaitExpression': {
        this.checkExpression(expr.expression, env);
        break;
      }
      default:
        break;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function runTypeChecks(program: Program): TypeDiagnostic[] {
  return new TypeChecker().check(program);
}
