import assert from 'node:assert/strict';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import type { Program } from '../src/types';
import { VM } from '../src/vm';

const source = `
allow "std/api" in as API

/*
  Get current weather.
  Returns current conditions for the requested city.
*/
fn get_weather(req) {
  return {"status": 200, "body": "sunny"}
}

/// Comment-derived text that should be overridden.
fn create_user(req) {
  return {"status": 201, "body": "created"}
}

let app = API.create_app()
app.get("/weather", get_weather)
app.post("/users", {
  "summary": "Create a user",
  "description": "Explicit route documentation.",
  "tags": ["Users"]
}, create_user)
let spec = app.openapi()
`;

function parse(text: string): Program {
  const parser = new Parser(new Lexer(text).scanTokens());
  const program = parser.parse();
  assert.deepEqual(parser.errors, []);
  return program;
}

function verify(spec: any, label: string): void {
  const inferred = spec.paths['/weather'].get;
  assert.equal(inferred.summary, 'Get current weather.', `${label} infers the first documentation line as summary`);
  assert.equal(
    inferred.description,
    'Get current weather.\nReturns current conditions for the requested city.',
    `${label} preserves the complete handler documentation`,
  );

  const explicit = spec.paths['/users'].post;
  assert.equal(explicit.summary, 'Create a user', `${label} prefers an explicit summary`);
  assert.equal(explicit.description, 'Explicit route documentation.', `${label} prefers an explicit description`);
  assert.deepEqual(explicit.tags, ['Users'], `${label} preserves other route schema fields`);
}

async function main(): Promise<void> {
  const program = parse(source);

  const interpreter = new Interpreter(undefined, { safeMode: false });
  await interpreter.interpret(program);
  verify((interpreter as any).currentEnv.get('spec'), 'tree walker');

  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert.deepEqual(compiler.errors, []);
  const vm = new VM(undefined, { safeMode: false });
  await vm.run(chunk);
  verify(vm.getGlobal('spec'), 'VM');

  const exportedProgram = parse(`/** Exported handler documentation. */\nexport fn handler(req) { return null }`);
  const exportedInterpreter = new Interpreter();
  await exportedInterpreter.interpret(exportedProgram);
  assert.equal((exportedInterpreter.exports.get('handler') as any).documentation, 'Exported handler documentation.');

  const exportedCompiler = new Compiler();
  const exportedChunk = exportedCompiler.compileProgram(exportedProgram);
  const exportedVm = new VM();
  await exportedVm.run(exportedChunk);
  assert.equal((exportedVm.getGlobal('handler') as any).documentation, 'Exported handler documentation.');

  console.log('std/api handler documentation tests passed.');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
