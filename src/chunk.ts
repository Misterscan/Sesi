// Bytecode data structures for the Sesi VM
// A Chunk is a compiled unit of code: a flat array of opcodes + operands,
// a constant pool, and a line-number table for error reporting.

export const enum OpCode {
  // Stack / constants
  CONSTANT,      // operand: constant pool index
  NIL,           // push null
  TRUE,          // push true
  FALSE,         // push false
  POP,           // discard top of stack

  // Global variables
  DEFINE_GLOBAL, // operand: name index in constants
  GET_GLOBAL,    // operand: name index
  SET_GLOBAL,    // operand: name index

  // Local variables (slot-based, faster than name lookup)
  GET_LOCAL,     // operand: stack slot offset
  SET_LOCAL,     // operand: stack slot offset

  // Arithmetic / string
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE,
  MODULO,
  NEGATE,        // unary minus

  // Comparison
  EQUAL,
  NOT_EQUAL,
  LESS,
  LESS_EQUAL,
  GREATER,
  GREATER_EQUAL,

  // Logical
  NOT,           // unary !

  // Control flow
  JUMP,          // operand: unsigned 16-bit forward offset
  JUMP_IF_FALSE, // operand: unsigned 16-bit forward offset, pops condition
  LOOP,          // operand: unsigned 16-bit backward offset

  // Collections
  BUILD_ARRAY,   // operand: element count (reads that many from stack)
  BUILD_OBJECT,  // operand: pair count  (reads key+value pairs from stack)
  GET_INDEX,     // obj[index]
  SET_INDEX,     // obj[index] = value
  GET_PROPERTY,  // operand: name index  obj.prop
  SET_PROPERTY,  // operand: name index  obj.prop = value

  // Functions
  CLOSURE,       // operand: constant index (points to a FunctionProto)
  CALL,          // operand: arg count
  RETURN,        // pop return value, restore frame
  RETURN_VOID,   // return null implicitly

  // Built-ins (fast path — skips function object lookup)
  CALL_BUILTIN,  // operand: name index, second operand: arg count

  // AI primitives (delegate straight to ai-runtime, args already on stack)
  CALL_MODEL,    // operand: name index (model name), second operand: arg count
  CALL_IMAGE,    // same shape

  // Output
  PRINT,         // operand: arg count (pops N values, prints space-joined)
}

// ---------------------------------------------------------------------------
// Constant pool values
// ---------------------------------------------------------------------------
export type ConstantValue = string | number | boolean | null | FunctionProto;

// A compiled function (used as a constant in the parent chunk)
export interface FunctionProto {
  kind: 'FunctionProto';
  name: string;
  arity: number;          // required params (params without defaults)
  params: Array<{ name: string; hasDefault: boolean }>;
  chunk: Chunk;
  isAsync: boolean;
}

// ---------------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------------
export interface Chunk {
  code: number[];           // flat array of OpCode values + operand bytes
  constants: ConstantValue[];
  lines: number[];          // parallel to code[], source line for each byte
}

export function makeChunk(): Chunk {
  return { code: [], constants: [], lines: [] };
}

// Add a constant to the pool and return its index
export function addConstant(chunk: Chunk, value: ConstantValue): number {
  chunk.constants.push(value);
  return chunk.constants.length - 1;
}

// Emit a single byte (opcode or operand) with its source line
export function emitByte(chunk: Chunk, byte: number, line: number): void {
  chunk.code.push(byte);
  chunk.lines.push(line);
}

// Emit an opcode + one byte operand
export function emitBytes(chunk: Chunk, byte1: number, byte2: number, line: number): void {
  emitByte(chunk, byte1, line);
  emitByte(chunk, byte2, line);
}

// Emit a 16-bit operand (big-endian) after an opcode
export function emit16(chunk: Chunk, opcode: number, operand: number, line: number): void {
  emitByte(chunk, opcode, line);
  emitByte(chunk, (operand >> 8) & 0xff, line);
  emitByte(chunk, operand & 0xff, line);
}

// Emit a JUMP_IF_FALSE / JUMP with a placeholder offset; return patch location
export function emitJump(chunk: Chunk, opcode: OpCode, line: number): number {
  emitByte(chunk, opcode, line);
  emitByte(chunk, 0xff, line); // high byte placeholder
  emitByte(chunk, 0xff, line); // low byte placeholder
  return chunk.code.length - 2; // index of high byte
}

// Back-patch a previously emitted jump with the real offset
export function patchJump(chunk: Chunk, offset: number): void {
  const jump = chunk.code.length - offset - 2;
  if (jump > 0xffff) throw new Error('Jump target out of range (> 65535 bytes)');
  chunk.code[offset]     = (jump >> 8) & 0xff;
  chunk.code[offset + 1] = jump & 0xff;
}

// Emit a LOOP instruction that jumps *back* to loopStart
export function emitLoop(chunk: Chunk, loopStart: number, line: number): void {
  emitByte(chunk, OpCode.LOOP, line);
  const offset = chunk.code.length - loopStart + 2;
  if (offset > 0xffff) throw new Error('Loop body too large');
  emitByte(chunk, (offset >> 8) & 0xff, line);
  emitByte(chunk, offset & 0xff, line);
}

// Read a 16-bit operand at position ip in the code array
export function read16(code: number[], ip: number): number {
  return ((code[ip] << 8) | code[ip + 1]) >>> 0;
}

// ---------------------------------------------------------------------------
// Disassembler (for --bytecode-debug flag)
// ---------------------------------------------------------------------------
export function disassemble(chunk: Chunk, name: string): string {
  const lines: string[] = [`=== ${name} ===`];
  let ip = 0;
  while (ip < chunk.code.length) {
    const [str, advance] = disassembleInstruction(chunk, ip);
    lines.push(str);
    ip += advance;
  }
  return lines.join('\n');
}

function disassembleInstruction(chunk: Chunk, ip: number): [string, number] {
  const op: OpCode = chunk.code[ip];
  const line = chunk.lines[ip];
  const lineStr = String(line).padStart(4, ' ');
  const addr = String(ip).padStart(4, '0');
  const prefix = `${addr} [L${lineStr}] `;

  const constantInstr = (name: string): [string, number] => {
    const idx = chunk.code[ip + 1];
    const val = JSON.stringify(chunk.constants[idx]);
    return [`${prefix}${name.padEnd(20)} ${idx} (${val})`, 2];
  };

  const jump16Instr = (name: string, sign: number): [string, number] => {
    const offset = read16(chunk.code, ip + 1);
    const target = ip + 3 + sign * offset;
    return [`${prefix}${name.padEnd(20)} → ${target}`, 3];
  };

  const byteInstr = (name: string): [string, number] => {
    return [`${prefix}${name.padEnd(20)} ${chunk.code[ip + 1]}`, 2];
  };

  const simpleInstr = (name: string): [string, number] => {
    return [`${prefix}${name}`, 1];
  };

  const twoByteInstr = (name: string): [string, number] => {
    return [`${prefix}${name.padEnd(20)} ${chunk.code[ip + 1]} ${chunk.code[ip + 2]}`, 3];
  };

  switch (op) {
    case OpCode.CONSTANT:       return constantInstr('CONSTANT');
    case OpCode.NIL:            return simpleInstr('NIL');
    case OpCode.TRUE:           return simpleInstr('TRUE');
    case OpCode.FALSE:          return simpleInstr('FALSE');
    case OpCode.POP:            return simpleInstr('POP');
    case OpCode.DEFINE_GLOBAL:  return constantInstr('DEFINE_GLOBAL');
    case OpCode.GET_GLOBAL:     return constantInstr('GET_GLOBAL');
    case OpCode.SET_GLOBAL:     return constantInstr('SET_GLOBAL');
    case OpCode.GET_LOCAL:      return byteInstr('GET_LOCAL');
    case OpCode.SET_LOCAL:      return byteInstr('SET_LOCAL');
    case OpCode.ADD:            return simpleInstr('ADD');
    case OpCode.SUBTRACT:       return simpleInstr('SUBTRACT');
    case OpCode.MULTIPLY:       return simpleInstr('MULTIPLY');
    case OpCode.DIVIDE:         return simpleInstr('DIVIDE');
    case OpCode.MODULO:         return simpleInstr('MODULO');
    case OpCode.NEGATE:         return simpleInstr('NEGATE');
    case OpCode.EQUAL:          return simpleInstr('EQUAL');
    case OpCode.NOT_EQUAL:      return simpleInstr('NOT_EQUAL');
    case OpCode.LESS:           return simpleInstr('LESS');
    case OpCode.LESS_EQUAL:     return simpleInstr('LESS_EQUAL');
    case OpCode.GREATER:        return simpleInstr('GREATER');
    case OpCode.GREATER_EQUAL:  return simpleInstr('GREATER_EQUAL');
    case OpCode.NOT:            return simpleInstr('NOT');
    case OpCode.JUMP:           return jump16Instr('JUMP', 1);
    case OpCode.JUMP_IF_FALSE:  return jump16Instr('JUMP_IF_FALSE', 1);
    case OpCode.LOOP:           return jump16Instr('LOOP', -1);
    case OpCode.BUILD_ARRAY:    return byteInstr('BUILD_ARRAY');
    case OpCode.BUILD_OBJECT:   return byteInstr('BUILD_OBJECT');
    case OpCode.GET_INDEX:      return simpleInstr('GET_INDEX');
    case OpCode.SET_INDEX:      return simpleInstr('SET_INDEX');
    case OpCode.GET_PROPERTY:   return constantInstr('GET_PROPERTY');
    case OpCode.SET_PROPERTY:   return constantInstr('SET_PROPERTY');
    case OpCode.CLOSURE:        return constantInstr('CLOSURE');
    case OpCode.CALL:           return byteInstr('CALL');
    case OpCode.RETURN:         return simpleInstr('RETURN');
    case OpCode.RETURN_VOID:    return simpleInstr('RETURN_VOID');
    case OpCode.CALL_BUILTIN:   return twoByteInstr('CALL_BUILTIN');
    case OpCode.CALL_MODEL:     return twoByteInstr('CALL_MODEL');
    case OpCode.CALL_IMAGE:     return twoByteInstr('CALL_IMAGE');
    case OpCode.PRINT:          return byteInstr('PRINT');
    default:
      return [`${prefix}UNKNOWN(${op})`, 1];
  }
}
