import assert from 'node:assert/strict';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';

const source = `
make Counter {
  let count = 0
  fn start(self, initial = 0) {
    self.count = initial
  }
  fn increment(self, amount = 1) {
    self.count = self.count + amount
    return self.count
  }
}

let first = Counter(10)
let second = Counter()
let first_result = first.increment(2)
let second_result = second.increment()
`;

function parse() {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.deepEqual(parser.errors, []);
  assert.equal(program.statements[0]?.type, 'MakeStatement');
  return program;
}

async function main(): Promise<void> {
  const interpretedProgram = parse();
  const interpreter = new Interpreter();
  await interpreter.interpret(interpretedProgram);
  assert.equal(interpreter.globalEnv.get('first_result'), 12);
  assert.equal(interpreter.globalEnv.get('second_result'), 1);

  const compiledProgram = parse();
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(compiledProgram);
  assert.deepEqual(compiler.errors, []);

  const vm = new VM();
  await vm.run(chunk);
  assert.equal(vm.getGlobal('first_result'), 12);
  assert.equal(vm.getGlobal('second_result'), 1);
  assert.equal((vm.getGlobal('first') as any).count, 12);
  assert.equal((vm.getGlobal('second') as any).count, 1);

  console.log('Make template interpreter/VM parity tests passed.');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
