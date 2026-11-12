import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = `
  allow "std/math" in as Math
  let floored = floor(3.9)
  let constants = [Math.E, Math.LN10, Math.LN2, Math.LOG10E, Math.LOG2E, Math.PI, Math.SQRT1_2, Math.SQRT2]
  let unary = [
    Math.abs(-2), Math.acos(1), Math.acosh(1), Math.asin(0), Math.asinh(0), Math.atan(0), Math.atanh(0),
    Math.cbrt(8), Math.ceil(1.2), Math.clz32(1), Math.cos(0), Math.cosh(0), Math.exp(0), Math.expm1(0),
    Math.floor(1.8), Math.fround(1.5), Math.log(1), Math.log1p(0), Math.log2(8), Math.log10(100),
    Math.round(1.5), Math.sign(-2), Math.sin(0), Math.sinh(0), Math.sqrt(9), Math.tan(0), Math.tanh(0), Math.trunc(-1.8)
  ]
  let angle = Math.atan2(1, 0)
  let integer_product = Math.imul(3, 4)
  let power = Math.pow(2, 3)
  let distance = Math.hypot(3, 4)
  let lower = Math.min(7, 3, -4)
  let upper = Math.max(7, 3, 12)
  let random_value = Math.random()
`;

function assertResults(get: (name: string) => unknown, engine: string): void {
  assert(get('floored') === 3, `${engine}: global floor() should round down`);
  const constants = get('constants') as number[];
  const expectedConstants = [Math.E, Math.LN10, Math.LN2, Math.LOG10E, Math.LOG2E, Math.PI, Math.SQRT1_2, Math.SQRT2];
  assert(Array.isArray(constants) && constants.every((value, index) => value === expectedConstants[index]), `${engine}: math constants should be available`);
  const unary = get('unary') as number[];
  const expectedUnary = [2, 0, 0, 0, 0, 0, 0, 2, 2, 31, 1, 1, 1, 0, 1, 1.5, 0, 0, 3, 2, 2, -1, 0, 0, 3, 0, 0, -1];
  assert(Array.isArray(unary) && unary.every((value, index) => Math.abs(value - expectedUnary[index]) < 0.000001), `${engine}: unary math functions should be available`);
  assert(Math.abs(Number(get('angle')) - Math.PI / 2) < 0.000001, `${engine}: Math.atan2() should be available`);
  assert(get('integer_product') === 12, `${engine}: Math.imul() should be available`);
  assert(get('power') === 8, `${engine}: Math.pow() should be available`);
  assert(get('distance') === 5, `${engine}: Math.hypot() should be available`);
  assert(get('lower') === -4, `${engine}: variadic Math.min() should be available`);
  assert(get('upper') === 12, `${engine}: variadic Math.max() should be available`);
  const randomValue = Number(get('random_value'));
  assert(randomValue >= 0 && randomValue < 1, `${engine}: Math.random() should return a value in [0, 1)`);
}

async function main(): Promise<void> {
  const interpreterParser = new Parser(new Lexer(source).scanTokens());
  const interpreterProgram = interpreterParser.parse();
  assert(interpreterParser.errors.length === 0, 'Math source should parse for the interpreter');
  const interpreter = new Interpreter();
  await interpreter.interpret(interpreterProgram);
  const env = (interpreter as any).currentEnv;
  assertResults(name => env.get(name), 'interpreter');

  const vmParser = new Parser(new Lexer(source).scanTokens());
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(vmParser.parse());
  assert(vmParser.errors.length === 0 && compiler.errors.length === 0, 'Math source should compile for the VM');
  const vm = new VM();
  await vm.run(chunk);
  assertResults(name => (vm as any).globals.get(name), 'VM');

  console.log('✓ global floor and complete stable std/math surface');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
