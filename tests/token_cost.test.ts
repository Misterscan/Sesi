import { aiRuntime } from '../src/ai-runtime';
import { AIRuntime } from '../src/ai-runtime';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { estimateTokenCost } from '../src/token-pricing';
import { VM } from '../src/vm';

function parse(source: string) {
  return new Parser(new Lexer(source).scanTokens()).parse();
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('=== Token Counting & Cost Estimation Tests ===\n');

  const standard = estimateTokenCost('gemini-3.6-flash', 1_000_000, 1_000_000);
  assert(standard !== null, 'Gemini 3.6 pricing should resolve');
  assert(standard?.inputCostUsd === 1.5, 'Gemini input cost should use the standard rate');
  assert(standard?.outputCostUsd === 7.5, 'Gemini output cost should use the standard rate');
  assert(standard?.totalCostUsd === 9, 'Gemini total cost should sum input and output');
  console.log('✓ resolves standard model pricing');

  const tiered = estimateTokenCost('models/gemini-3.1-pro-preview', 200_001, 10);
  assert(tiered?.inputPerMillion === 4, 'long Gemini Pro prompts should use the >200k input tier');
  assert(tiered?.outputPerMillion === 18, 'long Gemini Pro prompts should use the >200k output tier');
  console.log('✓ applies long-context pricing tiers');

  const currentGPT = estimateTokenCost('gpt-5.6-sol', 1_000_000, 1_000_000);
  assert(currentGPT?.totalCostUsd === 55, 'GPT-5.6 Sol long-context pricing should total $55');
  assert(estimateTokenCost('gpt-5.6-mars', 1000, 1000) === null, 'unknown GPT-5.6 tiers must not inherit alias pricing');
  assert(estimateTokenCost('gpt-5.6-sol-2026-07-01', 1000, 1000) !== null, 'dated model snapshots should inherit base pricing');
  console.log('✓ distinguishes model families from dated snapshots');

  const nativeRuntime = new AIRuntime() as any;
  let nativeRequest: any = null;
  nativeRuntime._client = {
    models: {
      countTokens: async (request: any) => {
        nativeRequest = request;
        return { totalTokens: 7 };
      },
    },
  };
  assert(await nativeRuntime.countTokens('gemini-3.6-flash', 'hello') === 7, 'Gemini native count should return totalTokens');
  assert(nativeRequest.model === 'models/gemini-3.6-flash', 'Gemini native count should normalize the model resource name');
  console.log('✓ uses the Gemini native countTokens endpoint');

  const openAIRuntime = new AIRuntime() as any;
  let openAIPath = '';
  let openAIBody: any = null;
  openAIRuntime.postOpenAIJson = async (apiPath: string, body: any) => {
    openAIPath = apiPath;
    openAIBody = body;
    return { input_tokens: 11 };
  };
  assert(await openAIRuntime.countTokens('gpt-5.6-sol', 'hello') === 11, 'OpenAI native count should return input_tokens');
  assert(openAIPath === '/v1/responses/input_tokens', 'OpenAI native count should use the input-token endpoint');
  assert(openAIBody.model === 'gpt-5.6-sol' && openAIBody.input === 'hello', 'OpenAI native count should preserve model and text');
  console.log('✓ uses the OpenAI native input-token endpoint');

  const originalCountTokens = aiRuntime.countTokens.bind(aiRuntime);
  const countRequests: Array<[string, string]> = [];
  (aiRuntime as any).countTokens = async (model: string, text: string) => {
    countRequests.push([model, text]);
    return model === 'gpt-5.6-sol' ? 5 : 7;
  };
  try {
    const interpreter = new Interpreter();
    await interpreter.interpret(parse(`
      let token_ids = tokenize("Token counting works.", "gpt-5.6-sol")
      let counted = count_tokens("Token counting works.", "gpt-5.6-sol")
      let gemini_counted = count_tokens("Count this with Gemini.", "gemini-3.6-flash")
      let gemini_estimated = estimate_tokens("Count this with Gemini.", "gemini-3.6-flash")
      let gemini_token_ids = tokenize("Count this with Gemini.", "gemini-3.6-flash")
      let priced = estimate_cost("gpt-5.6-sol", 100000, 100000)
      let custom = estimate_cost("private-model", 500000, 250000, {
        "input_per_million": 2,
        "output_per_million": 4
      })
    `));
    const env = (interpreter as any).currentEnv;
    assert(Array.isArray(env.get('token_ids')) && env.get('token_ids').length > 0, 'tokenize should support GPT-5.6 token IDs locally');
    assert(env.get('counted') === 5, 'count_tokens should use OpenAI native counting');
    assert(env.get('gemini_counted') === 7, 'count_tokens should use Gemini native counting');
    assert(countRequests.length === 2, 'count_tokens should make one native request per provider count');
    assert(countRequests[0][0] === 'gpt-5.6-sol', 'count_tokens should forward the current GPT model');
    assert(countRequests[1][0] === 'gemini-3.6-flash', 'count_tokens should forward the Gemini model');
    assert(typeof env.get('gemini_estimated') === 'number', 'estimate_tokens should provide an offline Gemini estimate');
    assert(env.get('gemini_token_ids') === null, 'tokenize must not silently tokenize Gemini with an OpenAI encoding');
    assert(env.get('priced').total_cost_usd === 3.5, 'GPT-5.6 Sol short-context estimate should total $3.50');
    assert(env.get('custom').total_cost_usd === 2, 'custom rates should work for private models');
    console.log('✓ separates tokenize, count_tokens, and estimate_tokens semantics');
  } finally {
    (aiRuntime as any).countTokens = originalCountTokens;
  }

  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  (aiRuntime as any).callModel = async () => ({
    text: 'mocked',
    finishReason: 'STOP',
    usage: { inputTokens: 100, outputTokens: 25, thinkingTokens: 5 },
  });

  try {
    const treeInterpreter = new Interpreter();
    await treeInterpreter.interpret(parse(`
      let answer = model("gemini-3.6-flash") {"hello"}
      let usage = model_usage()
    `));
    const treeUsage = (treeInterpreter as any).currentEnv.get('usage');
    assert(treeUsage.input_tokens === 100 && treeUsage.output_tokens === 25, 'tree walker should expose provider usage');
    assert(treeUsage.thinking_tokens === 5 && treeUsage.billable_output_tokens === 30, 'tree walker should include thinking usage');
    assert(treeUsage.total_cost_usd === 0.000375, 'tree walker should bill thinking tokens at the output rate');

    const compiler = new Compiler();
    const chunk = compiler.compileProgram(parse(`
      let answer = model("gemini-3.6-flash") {"hello"}
      let usage = model_usage()
    `));
    assert(compiler.errors.length === 0, `VM test failed to compile: ${compiler.errors.join(', ')}`);
    const vm = new VM();
    await vm.run(chunk);
    const vmUsage = (vm as any).globals.get('usage');
    assert(vmUsage.input_tokens === 100 && vmUsage.output_tokens === 25, 'VM should expose provider usage');
    assert(vmUsage.thinking_tokens === 5 && vmUsage.billable_output_tokens === 30, 'VM should include thinking usage');
    assert(vmUsage.total_cost_usd === 0.000375, 'VM should bill thinking tokens at the output rate');
    console.log('✓ exposes actual usage and cost in tree-walker and VM execution');

    treeInterpreter.recordModelUsage('gpt-5.6-sol', { inputTokens: 0, outputTokens: 0 }, true);
    const cachedUsage = treeInterpreter.getLastModelUsage() as any;
    assert(cachedUsage.cached === true, 'cache hits should be identified');
    assert(cachedUsage.total_tokens === 0 && cachedUsage.total_cost_usd === 0, 'cache hits should add no provider cost');
    console.log('✓ reports local cache hits as zero-cost usage');
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  console.log('\nAll token-cost tests passed!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
