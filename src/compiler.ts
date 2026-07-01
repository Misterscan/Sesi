// AST-to-bytecode compiler for Sesi
import {
  type Program,
  type Statement,
  type Expression,
  type FunctionStatement,
  type LetStatement,
  type ConstStatement,
  type IfStatement,
  type WhileStatement,
  type ForStatement,
  type ReturnStatement,
  type TryStatement,
  type BlockStatement,
  type ExpressionStatement,
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
  type BreakStatement,
  type ContinueStatement,
  type ImportStatement,
  type AllowStatement,
  type MemoryStatement,
  type ImageCallExpression,
  type ConvertExpression,
} from './types';

import {
  OpCode,
  type Chunk,
  type FunctionProto,
  makeChunk,
  addConstant,
  emitByte,
  emitBytes,
  emit16,
  emitJump,
  patchJump,
  emitLoop,
} from './chunk';

// ---------------------------------------------------------------------------
// Scope tracking for locals and loops
// ---------------------------------------------------------------------------
interface Local {
  name: string;
  depth: number;
  isCaptured: boolean;
}

interface LoopInfo {
  continueTarget: number;
  continueJumps: number[];
  breakJumps: number[];
  scopeDepth: number;
}

// Known Sesi built-in names — compiled to CALL_BUILTIN for a speed win
const BUILTINS = new Set([
  'print','len','range','type','str','num','bool',
  'keys','values','push','pop','join','split',
  'to_upper','to_lower','trim','slice','swap','contains','locate',
  'map','filter','reduce','find','retry',
  'read_file','write_file','write_image','list_dir','make_dir','rename','archive','trash',
  'spawn','exec','time','random',
  'to_json','from_json',
  'input','debug',
]);

// ---------------------------------------------------------------------------
// Compiler class
// ---------------------------------------------------------------------------
export class Compiler {
  private chunk: Chunk;
  private locals: Local[] = [];
  private scopeDepth = 0;
  public errors: string[] = [];
  private enclosing: Compiler | null = null;
  private upvalues: Array<{ index: number; isLocal: boolean }> = [];
  private loops: LoopInfo[] = [];

  constructor(existingChunk?: Chunk) {
    this.chunk = existingChunk ?? makeChunk();
  }

  // -------------------------------------------------------------------------
  // Public entry points
  // -------------------------------------------------------------------------

  compileProgram(program: Program): Chunk {
    for (const stmt of program.statements) {
      this.compileStatement(stmt);
    }
    this.emitOp(OpCode.RETURN_VOID, 0);
    return this.chunk;
  }

  private compileFunctionBody(stmt: FunctionStatement): FunctionProto {
    const inner = new Compiler();
    inner.enclosing = this;
    inner.scopeDepth = 1;

    // Bind params as locals in slot order
    for (const p of stmt.parameters) {
      inner.locals.push({ name: p.name, depth: 1, isCaptured: false });
    }

    // Emit default parameter value checks
    for (let i = 0; i < stmt.parameters.length; i++) {
      const p = stmt.parameters[i];
      if (p.defaultValue) {
        const line = stmt.line;
        // Check if param is null
        emitBytes(inner.chunk, OpCode.GET_LOCAL, i, line);
        inner.emitOp(OpCode.NIL, line);
        inner.emitOp(OpCode.EQUAL, line);
        
        const thenJump = emitJump(inner.chunk, OpCode.JUMP_IF_FALSE, line);
        inner.emitOp(OpCode.POP, line); // pop true
        
        inner.compileExpression(p.defaultValue);
        emitBytes(inner.chunk, OpCode.SET_LOCAL, i, line);
        inner.emitOp(OpCode.POP, line);
        
        const elseJump = emitJump(inner.chunk, OpCode.JUMP, line);
        patchJump(inner.chunk, thenJump);
        inner.emitOp(OpCode.POP, line); // pop false
        patchJump(inner.chunk, elseJump);
      }
    }

    for (const s of stmt.body.statements) {
      inner.compileStatement(s);
    }
    inner.emitOp(OpCode.RETURN_VOID, stmt.line);

    return {
      kind: 'FunctionProto',
      name: stmt.name,
      arity: stmt.parameters.filter(p => !p.defaultValue).length,
      params: stmt.parameters.map(p => ({ name: p.name, hasDefault: !!p.defaultValue })),
      chunk: inner.chunk,
      isAsync: !!stmt.isAsync,
      upvalues: inner.upvalues,
    };
  }

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------

  private compileStatement(stmt: Statement): void {
    try {
      switch (stmt.type) {
        case 'LetStatement':       return this.compileLet(stmt);
        case 'ConstStatement':     return this.compileConst(stmt);
        case 'FunctionStatement':  return this.compileFn(stmt);
        case 'ExpressionStatement':return this.compileExprStmt(stmt);
        case 'BlockStatement':     return this.compileBlock(stmt);
        case 'IfStatement':        return this.compileIf(stmt);
        case 'WhileStatement':     return this.compileWhile(stmt);
        case 'ForStatement':       return this.compileFor(stmt);
        case 'ReturnStatement':    return this.compileReturn(stmt);
        case 'BreakStatement':     return this.compileBreak(stmt);
        case 'ContinueStatement':  return this.compileContinue(stmt);
        case 'TryStatement':       return this.compileTry(stmt);
        case 'ImportStatement':    return this.compileImport(stmt);
        case 'AllowStatement':     return this.compileAllow(stmt);
        case 'MemoryStatement':    return this.compileMemory(stmt);
        case 'ExportStatement':    return this.compileStatement(stmt.statement);
        default:
          this.emitOp(OpCode.NIL, (stmt as any).line ?? 0);
          this.emitOp(OpCode.POP, (stmt as any).line ?? 0);
      }
    } catch (e: any) {
      this.errors.push(e.message);
    }
  }

  private compileLet(stmt: LetStatement): void {
    const line = stmt.line;
    if (stmt.value) {
      this.compileExpression(stmt.value);
    } else {
      this.emitOp(OpCode.NIL, line);
    }
    this.defineVariable(stmt.name, line);
  }

  private compileConst(stmt: ConstStatement): void {
    this.compileExpression(stmt.value);
    this.defineVariable(stmt.name, stmt.line);
  }

  private compileFn(stmt: FunctionStatement): void {
    const proto = this.compileFunctionBody(stmt);
    const idx = addConstant(this.chunk, proto);
    emitBytes(this.chunk, OpCode.CLOSURE, idx, stmt.line);
    this.defineVariable(stmt.name, stmt.line);
  }

  private compileExprStmt(stmt: ExpressionStatement): void {
    this.compileExpression(stmt.expression);
    // Discard result unless it was a print (which has no stack value)
    if (stmt.expression.type !== 'CallExpression' ||
        (stmt.expression as CallExpression).callee.type !== 'Identifier' ||
        !this.isPrintCall(stmt.expression as CallExpression)) {
      this.emitOp(OpCode.POP, stmt.line);
    }
  }

  private isPrintCall(expr: CallExpression): boolean {
    return expr.callee.type === 'Identifier' &&
           (expr.callee as Identifier).name === 'print';
  }

  private compileBlock(block: BlockStatement): void {
    this.beginScope();
    for (const s of block.statements) this.compileStatement(s);
    this.endScope(block.line);
  }

  private compileIf(stmt: IfStatement): void {
    const line = stmt.line;
    this.compileExpression(stmt.condition);

    const thenJump = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
    this.emitOp(OpCode.POP, line); // pop condition (truthy path)

    this.compileBlock(stmt.thenBranch);

    const elseJump = emitJump(this.chunk, OpCode.JUMP, line);
    patchJump(this.chunk, thenJump);
    this.emitOp(OpCode.POP, line); // pop condition (falsy path)

    if (stmt.elseBranch) {
      if (stmt.elseBranch.type === 'BlockStatement') {
        this.compileBlock(stmt.elseBranch as BlockStatement);
      } else {
        this.compileStatement(stmt.elseBranch);
      }
    }
    patchJump(this.chunk, elseJump);
  }

  private compileWhile(stmt: WhileStatement): void {
    const line = stmt.line;
    const loopStart = this.chunk.code.length;

    const loopInfo: LoopInfo = {
      continueTarget: loopStart,
      continueJumps: [],
      breakJumps: [],
      scopeDepth: this.scopeDepth
    };
    this.loops.push(loopInfo);

    this.compileExpression(stmt.condition);
    const exitJump = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
    this.emitOp(OpCode.POP, line);
    
    this.compileBlock(stmt.body);
    
    emitLoop(this.chunk, loopStart, line);
    patchJump(this.chunk, exitJump);
    this.emitOp(OpCode.POP, line);

    // Patch break jumps
    const loopEnd = this.chunk.code.length;
    for (const breakJump of loopInfo.breakJumps) {
      patchJump(this.chunk, breakJump);
    }
    this.loops.pop();
  }

  private compileFor(stmt: ForStatement): void {
    const line = stmt.line;
    this.beginScope();

    if (stmt.iterable) {
      this.compileExpression(stmt.iterable);
      const zeroIdx = addConstant(this.chunk, 0);
      emitBytes(this.chunk, OpCode.CONSTANT, zeroIdx, line);

      this.locals.push({ name: '__for_arr__', depth: this.scopeDepth, isCaptured: false });
      this.locals.push({ name: '__for_idx__', depth: this.scopeDepth, isCaptured: false });

      const arrSlot = this.locals.length - 2;
      const idxSlot = this.locals.length - 1;

      const loopStart = this.chunk.code.length;

      const loopInfo: LoopInfo = {
        continueTarget: -1,
        continueJumps: [],
        breakJumps: [],
        scopeDepth: this.scopeDepth
      };
      this.loops.push(loopInfo);

      // condition: index < len(array)
      emitBytes(this.chunk, OpCode.GET_LOCAL, idxSlot, line);
      emitBytes(this.chunk, OpCode.GET_LOCAL, arrSlot, line);
      const lenIdx = addConstant(this.chunk, 'len');
      emitByte(this.chunk, OpCode.CALL_BUILTIN, line);
      emitByte(this.chunk, lenIdx, line);
      emitByte(this.chunk, 1, line);
      this.emitOp(OpCode.LESS, line);

      const exitJump = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
      this.emitOp(OpCode.POP, line);

      // body variable = array[index]
      this.beginScope();
      emitBytes(this.chunk, OpCode.GET_LOCAL, arrSlot, line);
      emitBytes(this.chunk, OpCode.GET_LOCAL, idxSlot, line);
      this.emitOp(OpCode.GET_INDEX, line);
      this.locals.push({ name: stmt.variable, depth: this.scopeDepth, isCaptured: false });

      for (const s of stmt.body.statements) this.compileStatement(s);

      this.endScope(line);

      // Update/continue target
      const updateStart = this.chunk.code.length;
      for (const continueJump of loopInfo.continueJumps) {
        patchJump(this.chunk, continueJump);
      }

      // index = index + 1
      emitBytes(this.chunk, OpCode.GET_LOCAL, idxSlot, line);
      const oneIdx = addConstant(this.chunk, 1);
      emitBytes(this.chunk, OpCode.CONSTANT, oneIdx, line);
      this.emitOp(OpCode.ADD, line);
      emitBytes(this.chunk, OpCode.SET_LOCAL, idxSlot, line);
      this.emitOp(OpCode.POP, line);

      emitLoop(this.chunk, loopStart, line);
      patchJump(this.chunk, exitJump);
      this.emitOp(OpCode.POP, line);

      // Patch breaks
      for (const breakJump of loopInfo.breakJumps) {
        patchJump(this.chunk, breakJump);
      }
      this.loops.pop();

    } else if (stmt.start && stmt.end) {
      this.compileExpression(stmt.start);
      this.locals.push({ name: stmt.variable, depth: this.scopeDepth, isCaptured: false });
      const varSlot = this.locals.length - 1;

      const loopStart = this.chunk.code.length;

      const loopInfo: LoopInfo = {
        continueTarget: -1,
        continueJumps: [],
        breakJumps: [],
        scopeDepth: this.scopeDepth
      };
      this.loops.push(loopInfo);

      emitBytes(this.chunk, OpCode.GET_LOCAL, varSlot, line);
      this.compileExpression(stmt.end);
      this.emitOp(OpCode.LESS, line);

      const exitJump = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
      this.emitOp(OpCode.POP, line);

      this.beginScope();
      for (const s of stmt.body.statements) this.compileStatement(s);
      this.endScope(line);

      // Update/continue target
      const updateStart = this.chunk.code.length;
      for (const continueJump of loopInfo.continueJumps) {
        patchJump(this.chunk, continueJump);
      }

      // i = i + 1
      emitBytes(this.chunk, OpCode.GET_LOCAL, varSlot, line);
      const oneIdx = addConstant(this.chunk, 1);
      emitBytes(this.chunk, OpCode.CONSTANT, oneIdx, line);
      this.emitOp(OpCode.ADD, line);
      emitBytes(this.chunk, OpCode.SET_LOCAL, varSlot, line);
      this.emitOp(OpCode.POP, line);

      emitLoop(this.chunk, loopStart, line);
      patchJump(this.chunk, exitJump);
      this.emitOp(OpCode.POP, line);

      // Patch breaks
      for (const breakJump of loopInfo.breakJumps) {
        patchJump(this.chunk, breakJump);
      }
      this.loops.pop();
    }

    this.endScope(line);
  }

  private compileReturn(stmt: ReturnStatement): void {
    const line = stmt.line;
    if (stmt.value) {
      this.compileExpression(stmt.value);
      this.emitOp(OpCode.RETURN, line);
    } else {
      this.emitOp(OpCode.RETURN_VOID, line);
    }
  }

  private compileBreak(stmt: BreakStatement): void {
    const line = stmt.line;
    if (this.loops.length === 0) {
      throw new Error('Break statement outside of loop');
    }
    const loop = this.loops[this.loops.length - 1];

    // Pop/close local variables inside loop block
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i].depth > loop.scopeDepth) {
        if (this.locals[i].isCaptured) {
          this.emitOp(OpCode.CLOSE_UPVALUE, line);
        } else {
          this.emitOp(OpCode.POP, line);
        }
      }
    }

    const jump = emitJump(this.chunk, OpCode.JUMP, line);
    loop.breakJumps.push(jump);
  }

  private compileContinue(stmt: ContinueStatement): void {
    const line = stmt.line;
    if (this.loops.length === 0) {
      throw new Error('Continue statement outside of loop');
    }
    const loop = this.loops[this.loops.length - 1];

    // Pop/close local variables inside loop block
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i].depth > loop.scopeDepth) {
        if (this.locals[i].isCaptured) {
          this.emitOp(OpCode.CLOSE_UPVALUE, line);
        } else {
          this.emitOp(OpCode.POP, line);
        }
      }
    }

    if (loop.continueTarget !== -1) {
      emitLoop(this.chunk, loop.continueTarget, line);
    } else {
      const jump = emitJump(this.chunk, OpCode.JUMP, line);
      loop.continueJumps.push(jump);
    }
  }

  private compileTry(stmt: TryStatement): void {
    const line = stmt.line;

    // TRY_START
    emitByte(this.chunk, OpCode.TRY_START, line);
    const catchOffsetOffset = this.chunk.code.length;
    emitByte(this.chunk, 0xff, line);
    emitByte(this.chunk, 0xff, line);
    const finallyOffsetOffset = this.chunk.code.length;
    emitByte(this.chunk, 0xff, line);
    emitByte(this.chunk, 0xff, line);

    const tryStartIp = this.chunk.code.length;

    // Try block
    this.compileBlock(stmt.tryBlock);
    this.emitOp(OpCode.TRY_END, line);

    // Jump past catch block to finally block
    const jumpToFinally = emitJump(this.chunk, OpCode.JUMP, line);

    // Catch block start
    const catchStartIp = this.chunk.code.length;
    const catchOffset = catchStartIp - tryStartIp;
    this.chunk.code[catchOffsetOffset] = (catchOffset >> 8) & 0xff;
    this.chunk.code[catchOffsetOffset + 1] = catchOffset & 0xff;

    // Compile catch block (the error value is pushed onto the stack by the VM)
    this.beginScope();
    this.locals.push({ name: stmt.catchParameter, depth: this.scopeDepth, isCaptured: false });
    for (const s of stmt.catchBlock.statements) {
      this.compileStatement(s);
    }
    this.endScope(line);

    // Jump past finally block setup to actual finally execution
    const jumpFromCatchToFinally = emitJump(this.chunk, OpCode.JUMP, line);

    // Finally block start
    const finallyStartIp = this.chunk.code.length;
    const finallyOffset = finallyStartIp - tryStartIp;
    this.chunk.code[finallyOffsetOffset] = (finallyOffset >> 8) & 0xff;
    this.chunk.code[finallyOffsetOffset + 1] = finallyOffset & 0xff;

    patchJump(this.chunk, jumpToFinally);
    patchJump(this.chunk, jumpFromCatchToFinally);

    // Finally body
    this.emitOp(OpCode.FINALLY_START, line);
    if (stmt.finallyBlock) {
      this.compileBlock(stmt.finallyBlock);
    }
    this.emitOp(OpCode.FINALLY_END, line);
  }

  private compileImport(stmt: ImportStatement): void {
    const line = stmt.line;
    const sourceIdx = addConstant(this.chunk, stmt.source);
    const namesIdx = addConstant(this.chunk, stmt.names);
    emitByte(this.chunk, OpCode.IMPORT, line);
    emitByte(this.chunk, sourceIdx, line);
    emitByte(this.chunk, namesIdx, line);
  }

  private compileAllow(stmt: AllowStatement): void {
    const line = stmt.line;
    const sourceIdx = addConstant(this.chunk, stmt.source);
    const bindingIdx = addConstant(this.chunk, stmt.binding);
    emitByte(this.chunk, OpCode.ALLOW, line);
    emitByte(this.chunk, sourceIdx, line);
    emitByte(this.chunk, bindingIdx, line);
  }

  private compileMemory(stmt: MemoryStatement): void {
    const line = stmt.line;
    if (stmt.initialValue) {
      this.compileExpression(stmt.initialValue);
    } else {
      const emptyIdx = addConstant(this.chunk, '');
      emitBytes(this.chunk, OpCode.CONSTANT, emptyIdx, line);
    }
    const nameIdx = addConstant(this.chunk, stmt.name);
    emitBytes(this.chunk, OpCode.INITIALIZE_MEMORY, nameIdx, line);
  }

  // -------------------------------------------------------------------------
  // Expressions
  // -------------------------------------------------------------------------

  private compileExpression(expr: Expression): void {
    switch (expr.type) {
      case 'Literal':                return this.compileLiteral(expr as Literal);
      case 'Identifier':             return this.compileIdentifier(expr as Identifier);
      case 'BinaryOp':               return this.compileBinaryOp(expr as BinaryOp);
      case 'UnaryOp':                return this.compileUnaryOp(expr as UnaryOp);
      case 'LogicalOp':              return this.compileLogicalOp(expr as LogicalOp);
      case 'Assignment':             return this.compileAssignment(expr as Assignment);
      case 'CallExpression':         return this.compileCall(expr as CallExpression);
      case 'MemberExpression':       return this.compileMember(expr as MemberExpression);
      case 'IndexExpression':        return this.compileIndex(expr as IndexExpression);
      case 'ArrayLiteral':           return this.compileArray(expr as ArrayLiteral);
      case 'ObjectLiteral':          return this.compileObject(expr as ObjectLiteral);
      case 'PromptExpression':       return this.compilePrompt(expr as PromptExpression);
      case 'ModelCallExpression':    return this.compileModelCall(expr as ModelCallExpression);
      case 'ImageCallExpression':    return this.compileImageCall(expr as ImageCallExpression);
      case 'StructuredOutputExpression': return this.compileStructuredOutput(expr as StructuredOutputExpression);
      case 'ToolCallExpression':     return this.compileToolCall(expr as ToolCallExpression);
      case 'ConvertExpression':      return this.compileConvert(expr as ConvertExpression);
      case 'ConditionalExpression': {
        const ce = expr as any;
        this.compileExpression(ce.condition);
        const thenJump = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, ce.line);
        this.emitOp(OpCode.POP, ce.line);
        this.compileExpression(ce.thenExpr);
        const elseJump = emitJump(this.chunk, OpCode.JUMP, ce.line);
        patchJump(this.chunk, thenJump);
        this.emitOp(OpCode.POP, ce.line);
        this.compileExpression(ce.elseExpr);
        patchJump(this.chunk, elseJump);
        return;
      }
      case 'AwaitExpression': {
        // Await just evaluates the inner expression; async resolution is handled by the VM
        this.compileExpression((expr as any).expression);
        return;
      }
      default:
        // Unknown expression — push null as a safe fallback
        this.emitOp(OpCode.NIL, (expr as any).line ?? 0);
    }
  }

  private compileLiteral(expr: Literal): void {
    const line = expr.line;
    if (expr.value === null) { this.emitOp(OpCode.NIL, line); return; }
    if (expr.value === true) { this.emitOp(OpCode.TRUE, line); return; }
    if (expr.value === false) { this.emitOp(OpCode.FALSE, line); return; }
    const idx = addConstant(this.chunk, expr.value as string | number);
    emitBytes(this.chunk, OpCode.CONSTANT, idx, line);
  }

  private compileIdentifier(expr: Identifier): void {
    const slot = this.resolveLocal(expr.name);
    if (slot !== -1) {
      emitBytes(this.chunk, OpCode.GET_LOCAL, slot, expr.line);
    } else {
      const upvalueSlot = this.resolveUpvalue(expr.name);
      if (upvalueSlot !== -1) {
        emitBytes(this.chunk, OpCode.GET_UPVALUE, upvalueSlot, expr.line);
      } else {
        const idx = addConstant(this.chunk, expr.name);
        emitBytes(this.chunk, OpCode.GET_GLOBAL, idx, expr.line);
      }
    }
  }

  private compileBinaryOp(expr: BinaryOp): void {
    this.compileExpression(expr.left);
    this.compileExpression(expr.right);
    const line = expr.line;
    switch (expr.operator) {
      case '+':  this.emitOp(OpCode.ADD, line); break;
      case '-':  this.emitOp(OpCode.SUBTRACT, line); break;
      case '*':  this.emitOp(OpCode.MULTIPLY, line); break;
      case '/':  this.emitOp(OpCode.DIVIDE, line); break;
      case '%':  this.emitOp(OpCode.MODULO, line); break;
      case '==': this.emitOp(OpCode.EQUAL, line); break;
      case '!=': this.emitOp(OpCode.NOT_EQUAL, line); break;
      case '<':  this.emitOp(OpCode.LESS, line); break;
      case '<=': this.emitOp(OpCode.LESS_EQUAL, line); break;
      case '>':  this.emitOp(OpCode.GREATER, line); break;
      case '>=': this.emitOp(OpCode.GREATER_EQUAL, line); break;
    }
  }

  private compileUnaryOp(expr: UnaryOp): void {
    this.compileExpression(expr.operand);
    if (expr.operator === '-') this.emitOp(OpCode.NEGATE, expr.line);
    else if (expr.operator === '!') this.emitOp(OpCode.NOT, expr.line);
  }

  private compileLogicalOp(expr: LogicalOp): void {
    const line = expr.line;
    this.compileExpression(expr.left);
    if (expr.operator === '||') {
      // short-circuit: if truthy, skip right side
      const skipRight = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
      const endJump = emitJump(this.chunk, OpCode.JUMP, line);
      patchJump(this.chunk, skipRight);
      this.emitOp(OpCode.POP, line);
      this.compileExpression(expr.right);
      patchJump(this.chunk, endJump);
    } else {
      // &&: if falsy, skip right side
      const skipRight = emitJump(this.chunk, OpCode.JUMP_IF_FALSE, line);
      this.emitOp(OpCode.POP, line);
      this.compileExpression(expr.right);
      patchJump(this.chunk, skipRight);
    }
  }

  private compileAssignment(expr: Assignment): void {
    const line = expr.line;
    const left = expr.left;

    if (left.type === 'Identifier') {
      this.compileExpression(expr.right);
      const name = (left as Identifier).name;
      const slot = this.resolveLocal(name);
      if (slot !== -1) {
        emitBytes(this.chunk, OpCode.SET_LOCAL, slot, line);
      } else {
        const upvalueSlot = this.resolveUpvalue(name);
        if (upvalueSlot !== -1) {
          emitBytes(this.chunk, OpCode.SET_UPVALUE, upvalueSlot, line);
        } else {
          const idx = addConstant(this.chunk, name);
          emitBytes(this.chunk, OpCode.SET_GLOBAL, idx, line);
        }
      }
    } else if (left.type === 'IndexExpression') {
      const ie = left as IndexExpression;
      this.compileExpression(ie.object);
      this.compileExpression(ie.index);
      this.compileExpression(expr.right);
      this.emitOp(OpCode.SET_INDEX, line);
    } else if (left.type === 'MemberExpression') {
      const me = left as MemberExpression;
      this.compileExpression(me.object);
      this.compileExpression(expr.right);
      const idx = addConstant(this.chunk, me.property);
      emitBytes(this.chunk, OpCode.SET_PROPERTY, idx, line);
    } else {
      this.compileExpression(expr.right);
    }
  }

  private compileCall(expr: CallExpression): void {
    const line = expr.line;
    const callee = expr.callee;

    // print(...) — special PRINT opcode
    if (callee.type === 'Identifier' && (callee as Identifier).name === 'print') {
      for (const arg of expr.arguments) this.compileExpression(arg);
      emitBytes(this.chunk, OpCode.PRINT, expr.arguments.length, line);
      return;
    }

    // known built-in — emit CALL_BUILTIN name argc
    if (callee.type === 'Identifier' && BUILTINS.has((callee as Identifier).name)) {
      const name = (callee as Identifier).name;
      for (const arg of expr.arguments) this.compileExpression(arg);
      const nameIdx = addConstant(this.chunk, name);
      emitByte(this.chunk, OpCode.CALL_BUILTIN, line);
      emitByte(this.chunk, nameIdx, line);
      emitByte(this.chunk, expr.arguments.length, line);
      return;
    }

    // regular call: push callee then args
    this.compileExpression(callee);
    for (const arg of expr.arguments) this.compileExpression(arg);
    emitBytes(this.chunk, OpCode.CALL, expr.arguments.length, line);
  }

  private compileMember(expr: MemberExpression): void {
    this.compileExpression(expr.object);
    const idx = addConstant(this.chunk, expr.property);
    emitBytes(this.chunk, OpCode.GET_PROPERTY, idx, expr.line);
  }

  private compileIndex(expr: IndexExpression): void {
    this.compileExpression(expr.object);
    this.compileExpression(expr.index);
    this.emitOp(OpCode.GET_INDEX, expr.line);
  }

  private compileArray(expr: ArrayLiteral): void {
    for (const el of expr.elements) this.compileExpression(el);
    emitBytes(this.chunk, OpCode.BUILD_ARRAY, expr.elements.length, expr.line);
  }

  private compileObject(expr: ObjectLiteral): void {
    for (const prop of expr.properties) {
      const keyIdx = addConstant(this.chunk, prop.key);
      emitBytes(this.chunk, OpCode.CONSTANT, keyIdx, expr.line);
      this.compileExpression(prop.value);
    }
    emitBytes(this.chunk, OpCode.BUILD_OBJECT, expr.properties.length, expr.line);
  }

  private compilePrompt(expr: PromptExpression): void {
    // Compile as a concatenation of the parts, then a CALL_BUILTIN to a
    // synthetic '__prompt_register__' that the VM resolves
    for (const part of expr.content) this.compileExpression(part);
    const nameIdx = addConstant(this.chunk, 'str');
    // join all parts with empty string: reduce via ADD
    if (expr.content.length > 1) {
      for (let i = 1; i < expr.content.length; i++) this.emitOp(OpCode.ADD, expr.line);
    } else if (expr.content.length === 0) {
      this.emitOp(OpCode.NIL, expr.line);
      return;
    }
    // Store into global with prompt name
    const promptNameIdx = addConstant(this.chunk, expr.name);
    emitBytes(this.chunk, OpCode.DEFINE_GLOBAL, promptNameIdx, expr.line);
    emitBytes(this.chunk, OpCode.GET_GLOBAL, promptNameIdx, expr.line);
  }

  private compileModelCall(expr: ModelCallExpression): void {
    // Push model name, then prompt, then arg count → CALL_MODEL
    const line = expr.line;
    const modelNameIdx = addConstant(this.chunk, expr.modelName);
    emitBytes(this.chunk, OpCode.CONSTANT, modelNameIdx, line);
    this.compileExpression(expr.prompt);
    // Config is passed as an object literal if present
    if (expr.config) {
      const props = Object.entries(expr.config);
      for (const [k, v] of props) {
        const kidx = addConstant(this.chunk, k);
        emitBytes(this.chunk, OpCode.CONSTANT, kidx, line);
        this.compileExpression(v);
      }
      emitBytes(this.chunk, OpCode.BUILD_OBJECT, props.length, line);
    } else {
      this.emitOp(OpCode.NIL, line);
    }
    emitByte(this.chunk, OpCode.CALL_MODEL, line);
    emitByte(this.chunk, modelNameIdx, line);
    emitByte(this.chunk, 3, line); // model, prompt, config
  }

  private compileStructuredOutput(expr: StructuredOutputExpression): void {
    // Delegate to the interpreter by pushing a __structured_output__ builtin call
    const line = expr.line;
    // Build schema object
    const schemaPairs = Object.entries(expr.schema);
    for (const [k, typeAnn] of schemaPairs) {
      const kidx = addConstant(this.chunk, k);
      emitBytes(this.chunk, OpCode.CONSTANT, kidx, line);
      const typeName = (typeAnn as any).name ?? 'string';
      const tidx = addConstant(this.chunk, typeName);
      emitBytes(this.chunk, OpCode.CONSTANT, tidx, line);
    }
    emitBytes(this.chunk, OpCode.BUILD_OBJECT, schemaPairs.length, line);
    // Push the model call result
    this.compileExpression(expr.modelCall);
    const nameIdx = addConstant(this.chunk, '__structured_output__');
    emitByte(this.chunk, OpCode.CALL_BUILTIN, line);
    emitByte(this.chunk, nameIdx, line);
    emitByte(this.chunk, 2, line);
  }

  private compileToolCall(expr: ToolCallExpression): void {
    const line = expr.line;
    for (const arg of expr.arguments) this.compileExpression(arg);
    const nameIdx = addConstant(this.chunk, expr.functionName);
    emitByte(this.chunk, OpCode.CALL_BUILTIN, line);
    emitByte(this.chunk, nameIdx, line);
    emitByte(this.chunk, expr.arguments.length, line);
  }

  private compileImageCall(expr: ImageCallExpression): void {
    const line = expr.line;
    const modelNameIdx = addConstant(this.chunk, expr.modelName);
    emitBytes(this.chunk, OpCode.CONSTANT, modelNameIdx, line);
    this.compileExpression(expr.prompt);
    if (expr.config) {
      const props = Object.entries(expr.config);
      for (const [k, v] of props) {
        const kidx = addConstant(this.chunk, k);
        emitBytes(this.chunk, OpCode.CONSTANT, kidx, line);
        this.compileExpression(v);
      }
      emitBytes(this.chunk, OpCode.BUILD_OBJECT, props.length, line);
    } else {
      this.emitOp(OpCode.NIL, line);
    }
    emitByte(this.chunk, OpCode.CALL_IMAGE, line);
    emitByte(this.chunk, modelNameIdx, line);
    emitByte(this.chunk, 3, line); // model, prompt, config
  }

  private compileConvert(expr: ConvertExpression): void {
    const line = expr.line;
    const typeIdx = addConstant(this.chunk, expr.conversionType);
    emitBytes(this.chunk, OpCode.CONSTANT, typeIdx, line);
    this.compileExpression(expr.file);
    if (expr.config) {
      const props = Object.entries(expr.config);
      for (const [k, v] of props) {
        const kidx = addConstant(this.chunk, k);
        emitBytes(this.chunk, OpCode.CONSTANT, kidx, line);
        this.compileExpression(v);
      }
      emitBytes(this.chunk, OpCode.BUILD_OBJECT, props.length, line);
    } else {
      this.emitOp(OpCode.NIL, line);
    }
    emitByte(this.chunk, OpCode.CONVERT, line);
    emitByte(this.chunk, typeIdx, line);
    emitByte(this.chunk, 3, line); // type, file, config
  }

  // -------------------------------------------------------------------------
  // Scope / locals helpers
  // -------------------------------------------------------------------------

  private beginScope(): void {
    this.scopeDepth++;
  }

  private endScope(line: number): void {
    this.scopeDepth--;
    while (this.locals.length > 0 && this.locals[this.locals.length - 1].depth > this.scopeDepth) {
      const local = this.locals[this.locals.length - 1];
      if (local.isCaptured) {
        this.emitOp(OpCode.CLOSE_UPVALUE, line);
      } else {
        this.emitOp(OpCode.POP, line);
      }
      this.locals.pop();
    }
  }

  private defineVariable(name: string, line: number): void {
    if (this.scopeDepth > 0) {
      // local
      this.locals.push({ name, depth: this.scopeDepth, isCaptured: false });
      // value is already on the stack — no extra opcode needed
    } else {
      // global
      const idx = addConstant(this.chunk, name);
      emitBytes(this.chunk, OpCode.DEFINE_GLOBAL, idx, line);
    }
  }

  private resolveLocal(name: string): number {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i].name === name) return i;
    }
    return -1;
  }

  private resolveUpvalue(name: string): number {
    if (this.enclosing === null) return -1;

    // 1. Resolve in direct enclosing scope's locals
    const local = this.enclosing.resolveLocal(name);
    if (local !== -1) {
      this.enclosing.locals[local].isCaptured = true;
      return this.addUpvalue(local, true);
    }

    // 2. Resolve recursively in enclosing scope's upvalues
    const upvalue = this.enclosing.resolveUpvalue(name);
    if (upvalue !== -1) {
      return this.addUpvalue(upvalue, false);
    }

    return -1;
  }

  private addUpvalue(index: number, isLocal: boolean): number {
    for (let i = 0; i < this.upvalues.length; i++) {
      const up = this.upvalues[i];
      if (up.index === index && up.isLocal === isLocal) {
        return i;
      }
    }
    this.upvalues.push({ index, isLocal });
    return this.upvalues.length - 1;
  }

  private emitOp(op: OpCode, line: number): void {
    emitByte(this.chunk, op, line);
  }
}
