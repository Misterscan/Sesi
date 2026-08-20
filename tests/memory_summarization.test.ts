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

const oldHistory = Array.from(
  { length: 18 },
  (_, index) => `OLD_FACT_${index}: Project Atlas constraint ${index}.`,
).join(' ');
const recentHistory = 'RECENT_DECISION_KEEP: cancelled invoices stay visible but inactive.';

async function runAutomaticSummary(useVM: boolean): Promise<{ compacted: string; requests: AIRequest[] }> {
  const memoryName = useVM ? 'vmAutoMemory' : 'treeAutoMemory';
  const requests: AIRequest[] = [];
  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  (aiRuntime as any).callModel = async (request: AIRequest): Promise<AIResponse> => {
    requests.push(request);
    return {
      text: 'Project Atlas has durable invoice constraints and earlier implementation decisions.',
      finishReason: 'STOP',
      usage: { inputTokens: 20, outputTokens: 6 },
    };
  };

  const source = `
    memory ${memoryName} {"System: retain project decisions."}
    memory_config("${memoryName}", {"max_tokens": 80, "target_tokens": 52, "summary_model": "summary-test"})
    ${memoryName} = ${memoryName} + " ${oldHistory} ${recentHistory}"
    let compacted = ${memoryName}
    let usage = model_usage()
  `;

  try {
    if (useVM) {
      const compiler = new Compiler();
      const chunk = compiler.compileProgram(parse(source));
      assert(compiler.errors.length === 0, `compile failed: ${compiler.errors.join(', ')}`);
      const vm = new VM();
      await vm.run(chunk);
      const usage = (vm as any).globals.get('usage');
      assert(usage.model === 'summary-test', 'VM records automatic summarization model usage');
      assert(usage.input_tokens === 20 && usage.output_tokens === 6, 'VM records summarization tokens');
      return { compacted: (vm as any).globals.get('compacted'), requests };
    }

    const interpreter = new Interpreter();
    await interpreter.interpret(parse(source));
    const usage = (interpreter as any).currentEnv.get('usage');
    assert(usage.model === 'summary-test', 'tree walker records automatic summarization model usage');
    assert(usage.input_tokens === 20 && usage.output_tokens === 6, 'tree walker records summarization tokens');
    return { compacted: (interpreter as any).currentEnv.get('compacted'), requests };
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }
}

async function main() {
  for (const useVM of [false, true]) {
    const label = useVM ? 'VM' : 'tree walker';
    const { compacted, requests } = await runAutomaticSummary(useVM);
    assert(requests.length === 1, `${label} summarizes exactly once after crossing the budget`);
    assert(requests[0].model === 'summary-test', `${label} uses the configured summary model`);
    assert(requests[0].prompt.includes('OLD_FACT_0'), `${label} sends older memory to the summarizer`);
    assert(compacted.includes('[Memory Summary]'), `${label} stores a labeled summary`);
    assert(compacted.includes('Project Atlas'), `${label} stores the returned summary`);
    assert(compacted.includes('[Recent Memory]'), `${label} labels the verbatim recent tail`);
    assert(compacted.includes('RECENT_DECISION_KEEP'), `${label} preserves recent memory verbatim`);
    assert(aiRuntime.estimateTokens(compacted) <= 80, `${label} respects the hard memory budget`);
  }

  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  let disabledCalls = 0;
  (aiRuntime as any).callModel = async (): Promise<AIResponse> => {
    disabledCalls++;
    return { text: 'should not run' };
  };
  try {
    const interpreter = new Interpreter();
    await interpreter.interpret(parse(`
      memory disabledMemory {"seed"}
      memory_config("disabledMemory", {"enabled": false, "max_tokens": 20})
      disabledMemory = disabledMemory + " ${oldHistory} ${recentHistory}"
      let untouched = disabledMemory
    `));
    const untouched = (interpreter as any).currentEnv.get('untouched');
    assert(disabledCalls === 0, 'disabled automatic summarization does not call a model');
    assert(untouched.includes('OLD_FACT_0') && untouched.includes('RECENT_DECISION_KEEP'), 'disabled summarization preserves full memory');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  (aiRuntime as any).callModel = async () => {
    throw new Error('summary provider unavailable');
  };
  try {
    const interpreter = new Interpreter();
    await interpreter.interpret(parse(`
      memory failureMemory {"seed"}
      memory_config("failureMemory", {"max_tokens": 20, "target_tokens": 12})
      failureMemory = failureMemory + " ${oldHistory} ${recentHistory}"
      let preserved = failureMemory
    `));
    const preserved = (interpreter as any).currentEnv.get('preserved');
    assert(preserved.includes('OLD_FACT_0'), 'summarization failure preserves older memory');
    assert(!preserved.includes('[Memory Summary]'), 'summarization failure does not install a placeholder summary');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  let concurrentCalls = 0;
  (aiRuntime as any).callModel = async (): Promise<AIResponse> => {
    concurrentCalls++;
    await Promise.resolve();
    return { text: 'Concurrent memory summary.' };
  };
  try {
    aiRuntime.initializeMemory('concurrentMemory', `${oldHistory} ${recentHistory}`);
    aiRuntime.configureMemorySummary('concurrentMemory', {
      enabled: true,
      maxTokens: 40,
      targetTokens: 28,
      summaryModel: 'summary-test',
    });
    const [first, second] = await Promise.all([
      aiRuntime.autoTrimMemory('concurrentMemory'),
      aiRuntime.autoTrimMemory('concurrentMemory'),
    ]);
    assert(concurrentCalls === 1, 'concurrent compaction requests share one summarization call');
    assert(first.summarized, 'the first concurrent request performs compaction');
    assert(!second.summarized, 'the queued request observes already-compacted memory');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  console.log('✓ automatic memory summarization compacts safely in the tree walker and VM');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
