import assert from 'node:assert/strict';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import { aiRuntime } from '../src/ai-runtime';
import { SesiJavaScriptEmitter } from '../src/js-emitter';
import { browserJsRuntime } from '../src/browser-js-runtime';
import { runDryRunSemanticChecks } from '../src/dry-checker';
import { structuredResponseSchema } from '../src/builtins';
import type { AIRequest } from '../src/types';

async function execute(source: string, engine: string): Promise<any> {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.deepEqual(parser.errors, []);
  if (engine === 'browser') {
    const code = new SesiJavaScriptEmitter('structured-output-test', {}).emit(program);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    return (await new AsyncFunction('__sesi', code)(browserJsRuntime())).result;
  }
  if (engine === 'interpreter') {
    const interpreter = new Interpreter();
    await interpreter.interpret(program);
    return interpreter.globalEnv.get('result');
  }
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert.deepEqual(compiler.errors, []);
  const vm = new VM();
  await vm.run(chunk);
  return vm.getGlobal('result');
}

async function main(): Promise<void> {
  assert.deepEqual(structuredResponseSchema({ values: 'array', metadata: 'object', extra: 'any' }).properties, {
    values: { type: 'array', items: {} }, metadata: { type: 'object' }, extra: {},
  });
  const raw = JSON.stringify(JSON.stringify({ title: 'Task', priority: 2, complete: true }));
  const source = `
let schema = {title: "string", priority: "number", complete: "bool"}
let calls = 0
fn getSchema() { calls = calls + 1; return schema }
fn parseLocal(raw) {
  let local = {selected: schema}
  let values = [structured_output(getSchema())(raw), structured_output(local.selected)(raw)]
  return values[0].title + values[1].title
}
let text = parseLocal(${raw})
let inline = structured_output({title: string, priority: number, complete: bool})(${raw})
export let result = [text, calls, inline.priority, structured_output(schema)(${raw}).complete]
`;
  assert.deepEqual(runDryRunSemanticChecks(source).filter(d => d.severity === 'error'), []);
  for (const engine of ['interpreter', 'vm', 'browser']) {
    assert.deepEqual(await execute(source, engine), ['TaskTask', 1, 2, true], engine);
    assert.deepEqual(await execute(`let schema = {}; export let result = structured_output(schema)("{}")`, engine), Object.create(null));
    assert.deepEqual(await execute(`
let calls = 0
fn nextSchema() { calls = calls + 1; return {value: "string"} }
fn parse(depth) {
  if depth == 0 { return "{\\"value\\":\\"done\\"}" }
  let schema = {value: "string"}
  let parsed = structured_output(schema)(parse(depth - 1))
  return to_json(parsed)
}
let parsed = structured_output(nextSchema())(parse(3))
export let result = [parsed.value, calls]
`, engine), ['done', 1]);
    for (const schema of ['null', '[]', '"string"', '{title: 42}', '{title: "unknown"}']) {
      await assert.rejects(execute(`let schema = ${schema}
export let result = structured_output(schema)(model("unused") {"must not run"})`, engine), /structured_output schema/);
    }
    console.log(`✓ structured output schema expressions: ${engine}`);
  }

  const originalCallModel = aiRuntime.callModel;
  const requests: AIRequest[] = [];
  aiRuntime.callModel = async request => {
    requests.push(request);
    return { text: '{"title":"Task","priority":2,"complete":true}' };
  };
  try {
    for (const engine of ['interpreter', 'vm']) {
      const result = await execute(`
let schema = {title: "string", priority: "number", complete: "bool"}
export let result = structured_output(schema)(model("mock") {temperature: 0} {"test"})
`, engine);
      assert.equal(result.title, 'Task');
      const request = requests.at(-1)!;
      assert.equal(request.temperature, 0);
      assert.deepEqual(request.responseSchema, {
        type: 'object', properties: { title: { type: 'string' }, priority: { type: 'number' }, complete: { type: 'boolean' } },
        required: ['title', 'priority', 'complete'], additionalProperties: false,
      });
    }
    assert.equal(requests.length, 2);
  } finally {
    aiRuntime.callModel = originalCallModel;
  }
  console.log('✓ resolved schemas reach direct model calls in both engines');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
