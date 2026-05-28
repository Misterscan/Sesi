// Sesi multi-step reasoning workflow builtin tests
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import { aiRuntime } from '../src/ai-runtime';

declare var process: any;

async function run(source: string, interpreter = new Interpreter()): Promise<Interpreter> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  await interpreter.interpret(program);
  return interpreter;
}

async function main() {
  console.log('=== Sesi Multi-step Workflow Tests ===\n');

  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  const captured: Array<Record<string, any>> = [];

  (aiRuntime as any).callModel = async (request: Record<string, any>) => {
    captured.push(request);
    return { text: `OUT:${request.prompt}` };
  };

  try {
    const interpreter = new Interpreter();

    await run(
      `
      let steps = [
        {"prompt": "Summarize:", "from": "input"},
        {"prompt": "Critique:", "from": "previous"},
        {"prompt": "Rewrite:", "from": "step1"}
      ]

      let result = workflow(steps, "alpha")
      `,
      interpreter,
    );

    const result = (interpreter as any).currentEnv.get('result');

    if (!result || typeof result !== 'object') {
      throw new Error('result should be an object');
    }

    if (!Array.isArray(result.steps) || result.steps.length !== 3) {
      throw new Error('result.steps should contain three outputs');
    }

    if (result.steps[0] !== 'OUT:Summarize: alpha') {
      throw new Error(`unexpected first step output: ${result.steps[0]}`);
    }

    if (result.steps[1] !== 'OUT:Critique: OUT:Summarize: alpha') {
      throw new Error(`unexpected second step output: ${result.steps[1]}`);
    }

    if (result.final !== 'OUT:Rewrite: OUT:Summarize: alpha') {
      throw new Error(`unexpected final output: ${result.final}`);
    }

    if (captured.length !== 3) {
      throw new Error(`expected 3 model calls, got ${captured.length}`);
    }

    captured.length = 0;

    await run(
      `
      let tuned = [
        {"model": "custom-model", "prompt": "one", "temperature": 0.4, "max_tokens": 12},
        {"prompt": "two", "cache": false, "search": true}
      ]

      let cfg = workflow(tuned, "seed")
      `,
      new Interpreter(),
    );

    if (captured[0].model !== 'custom-model') {
      throw new Error('step model override was not forwarded');
    }

    if (captured[1].model !== 'gemini-3.1-flash-lite') {
      throw new Error('default workflow model should be gemini-3.1-flash-lite');
    }

    if (captured[0].temperature !== 0.4 || captured[0].maxTokens !== 12) {
      throw new Error('temperature/max_tokens forwarding failed');
    }

    if (captured[1].cache !== false || captured[1].search !== true) {
      throw new Error('cache/search forwarding failed');
    }

    captured.length = 0;

    await run(
      `
      set_alias("fast", "gemini-3.1-flash-lite")
      set_alias("fast-img", "gemini-3.1-flash-image-preview")

      let a = model("fast") {"hello"}
      let b = image("fast-img") {"render this"}

      let steps = [
        {"model": "fast", "prompt": "summarize", "from": "input"}
      ]
      let c = workflow(steps, "topic")
      `,
      new Interpreter(),
    );

    if (captured.length !== 3) {
      throw new Error(`expected 3 alias-resolved calls, got ${captured.length}`);
    }

    if (captured[0].model !== 'gemini-3.1-flash-lite') {
      throw new Error(`model() did not resolve alias; models=${captured.map((c) => c.model).join(',')}`);
    }

    if (captured[1].model !== 'gemini-3.1-flash-image-preview') {
      throw new Error(`image() did not resolve alias; models=${captured.map((c) => c.model).join(',')}`);
    }

    if (captured[2].model !== 'gemini-3.1-flash-lite') {
      throw new Error(`workflow() did not resolve alias; models=${captured.map((c) => c.model).join(',')}`);
    }

    captured.length = 0;

    await run(
      `
      let steps = [
        {"prompt": "Summarize:"},
        {"prompt": "Refine:"},
        {"prompt": "Finalize:"}
      ]

      let out = workflow(steps, "alpha")
      `,
      new Interpreter(),
    );

    if (captured.length !== 3) {
      throw new Error(`expected 3 implicit-context calls, got ${captured.length}`);
    }

    if (captured[0].prompt !== 'Summarize: alpha') {
      throw new Error(`unexpected implicit step1 prompt: ${captured[0].prompt}`);
    }

    if (captured[1].prompt !== 'Refine: OUT:Summarize: alpha') {
      throw new Error(`unexpected implicit step2 prompt: ${captured[1].prompt}`);
    }

    if (captured[2].prompt !== 'Finalize: OUT:Refine: OUT:Summarize: alpha') {
      throw new Error(`unexpected implicit step3 prompt: ${captured[2].prompt}`);
    }

    console.log('✓ workflow defaults to intuitive context when no references are provided');
    console.log('✓ workflow forwards per-step model config');
    console.log('✓ set_alias custom names resolve across model/image/workflow');
    console.log('\nAll workflow tests passed!');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
