import { Compiler } from '../src/compiler';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main(): Promise<void> {
  const source = 'let record = {"var1": "Value", "var2": "Value2", "var3": "Value3"}';
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert(parser.errors.length === 0, `parse failed: ${parser.errors.join(', ')}`);

  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert(compiler.errors.length === 0, `compile failed: ${compiler.errors.join(', ')}`);

  const vm = new VM();
  await vm.run(chunk);
  const record = (vm as any).globals.get('record');
  assert(JSON.stringify(record) === '{"var1":"Value","var2":"Value2","var3":"Value3"}', 'VM must preserve object literal field order');
  console.log('✓ VM preserves object literal field order');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
