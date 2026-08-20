import { aiRuntime } from '../src/ai-runtime';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';
import {type AIRequest, type AIResponse, type Program} from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function parse(source: string): Program {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert(parser.errors.length === 0, `parse failed: ${parser.errors.join(', ')}`);
  return program;
}

const programSource = `
fn add(a: number, b: number) -> number { return a + b }
define_tool("addNumbers", add, "Add two numbers")
let answer = model("gemini-test") {tools: list_tools(), cache: false} {"Add two and three."}
`;

async function runAutomaticCall(useVM: boolean): Promise<{ answer: unknown; requests: AIRequest[] }> {
  const requests: AIRequest[] = [];
  const responses: AIResponse[] = [
    {
      text: JSON.stringify({ name: 'addNumbers', args: { b: 3, a: 2 }, call_id: 'call-1' }),
      finishReason: 'TOOL_CALL',
      usage: { inputTokens: 3, outputTokens: 1 },
    },
    {
      text: 'The answer is 5.',
      finishReason: 'STOP',
      usage: { inputTokens: 4, outputTokens: 2, thinkingTokens: 1 },
    },
  ];
  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  (aiRuntime as any).callModel = async (request: AIRequest): Promise<AIResponse> => {
    requests.push(request);
    const response = responses.shift();
    if (!response) throw new Error('unexpected extra model call');
    return response;
  };

  try {
    if (useVM) {
      const compiler = new Compiler();
      const chunk = compiler.compileProgram(parse(programSource));
      assert(compiler.errors.length === 0, `compile failed: ${compiler.errors.join(', ')}`);
      const vm = new VM();
      await vm.run(chunk);
      const usage = (vm as any).interpreter.getLastModelUsage();
      assert(usage.input_tokens === 7 && usage.output_tokens === 3, 'VM records aggregate orchestration usage');
      assert(usage.thinking_tokens === 1, 'VM records aggregate thinking usage');
      return { answer: (vm as any).globals.get('answer'), requests };
    }

    const interpreter = new Interpreter();
    await interpreter.interpret(parse(programSource));
    const usage = interpreter.getLastModelUsage() as any;
    assert(usage.input_tokens === 7 && usage.output_tokens === 3, 'tree walker records aggregate orchestration usage');
    assert(usage.thinking_tokens === 1, 'tree walker records aggregate thinking usage');
    return { answer: (interpreter as any).currentEnv.get('answer'), requests };
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }
}

async function main() {
  for (const useVM of [false, true]) {
    const label = useVM ? 'VM' : 'tree walker';
    const { answer, requests } = await runAutomaticCall(useVM);
    assert(answer === 'The answer is 5.', `${label} returns the final model response`);
    assert(requests.length === 2, `${label} resumes the model after executing a tool`);
    const declaration = requests[0].tools?.[0] as any;
    assert(declaration.name === 'addNumbers', `${label} derives the registered tool name`);
    assert(declaration.description === 'Add two numbers', `${label} forwards the registered description`);
    assert(declaration.parameters?.properties?.a?.type === 'number', `${label} derives number parameter schemas`);
    assert(declaration.parameters?.required?.join(',') === 'a,b', `${label} marks required parameters`);
    assert(requests[1].prompt.includes('call-1'), `${label} preserves the provider call id in the transcript`);
    assert(requests[1].prompt.includes('5'), `${label} sends the tool result back to the model`);
  }

  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  (aiRuntime as any).callModel = async (): Promise<AIResponse> => ({
    text: JSON.stringify({ name: 'shell', args: { command: 'echo unsafe' } }),
    finishReason: 'TOOL_CALL',
  });
  try {
    const interpreter = new Interpreter(undefined, { safeMode: false });
    let blocked = false;
    try {
      await interpreter.interpret(parse(`
        define_tool("shell", exec, "Run a shell command")
        let answer = model("gemini-test") {tools: list_tools(), cache: false} {"Run it."}
      `));
    } catch (error: any) {
      blocked = /Automated execution of sensitive tool "exec" is forbidden/.test(error.message);
    }
    assert(blocked, 'automatic orchestration preserves sensitive-tool safeguards');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  const loopResponses: AIResponse[] = [
    { text: JSON.stringify({ name: 'ping', args: { value: 'one' } }), finishReason: 'TOOL_CALL' },
    { text: JSON.stringify({ name: 'ping', args: { value: 'two' } }), finishReason: 'TOOL_CALL' },
  ];
  (aiRuntime as any).callModel = async (): Promise<AIResponse> => loopResponses.shift()!;
  try {
    const interpreter = new Interpreter();
    let bounded = false;
    try {
      await interpreter.interpret(parse(`
        fn ping(value) { return value }
        define_tool("ping", ping)
        let answer = model("gemini-test") {tools: list_tools(), max_tool_calls: 1, cache: false} {"Loop."}
      `));
    } catch (error: any) {
      bounded = /exceeded the limit of 1 tool calls/.test(error.message);
    }
    assert(bounded, 'automatic orchestration enforces the configured tool-call limit');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  console.log('✓ automatic function calling orchestrates registered tools in the tree walker and VM');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
