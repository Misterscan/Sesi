import { aiRuntime } from '../src/ai-runtime';
import { AIRuntime } from '../src/ai-runtime';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { estimateTokenCost } from '../src/token-pricing';
import { VM } from '../src/vm';
import * as fs from 'fs';
import * as path from 'path';

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

  for (const model of ['gemini-3.7-flash', 'gemini-3.8-flash']) {
    const flash = estimateTokenCost(`models/${model}-2026-09-01`, 1_000_000, 1_000_000);
    assert(flash?.inputCostUsd === 0.75, `${model} input cost should use the introductory rate`);
    assert(flash?.outputCostUsd === 3.75, `${model} output cost should use the introductory rate`);
    assert(flash?.totalCostUsd === 4.5, `${model} total cost should sum input and output`);
  }
  console.log('✓ resolves Gemini 3.7 and 3.8 Flash pricing');

  const flashImage = estimateTokenCost('gemini-3.1-flash-image', 1_000_000, 1_000_000);
  assert(flashImage?.inputPerMillion === 0.5, 'Gemini 3.1 Flash Image should use its text and image input rate');
  assert(flashImage?.outputPerMillion === 60, 'Gemini 3.1 Flash Image should use its generated-image output rate');
  const gptImage = estimateTokenCost('gpt-image-2', 1_000_000, 1_000_000);
  assert(gptImage?.inputPerMillion === 5, 'GPT Image 2 should use its text input rate');
  assert(gptImage?.outputPerMillion === 30, 'GPT Image 2 should use its generated-image output rate');
  console.log('✓ resolves image model token pricing');

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
  assert(await nativeRuntime.countImageTokens('gemini-3.1-flash-image', 'iVBORw0KGgo=', 'image/png') === 7, 'Gemini native image count should return totalTokens');
  assert(nativeRequest.contents[0].parts[0].inlineData.mimeType === 'image/png', 'Gemini native image count should send image inline data');
  console.log('✓ uses the Gemini native countTokens endpoint');

  const openAIRuntime = new AIRuntime() as any;
  let openAIBody: any = null;
  openAIRuntime._openAIClient = {
    responses: {
      inputTokens: {
        count: async (body: any) => {
          openAIBody = body;
          return { input_tokens: 11 };
        },
      },
    },
  };
  assert(await openAIRuntime.countTokens('gpt-5.6-sol', 'hello') === 11, 'OpenAI native count should return input_tokens');
  assert(openAIBody.model === 'gpt-5.6-sol' && openAIBody.input === 'hello', 'OpenAI native count should preserve model and text');
  console.log('✓ uses the OpenAI native input-token endpoint');

  const originalCountTokens = aiRuntime.countTokens.bind(aiRuntime);
  const originalCountImageTokens = aiRuntime.countImageTokens.bind(aiRuntime);
  const countRequests: Array<[string, string]> = [];
  (aiRuntime as any).countTokens = async (model: string, text: string) => {
    countRequests.push([model, text]);
    return model === 'gpt-5.6-sol' ? 5 : 7;
  };
  let imageCounted = false;
  (aiRuntime as any).countImageTokens = async () => {
    imageCounted = true;
    return 1120;
  };
  const imageFixture = path.join(process.cwd(), '.token-cost-image.png');
  fs.writeFileSync(imageFixture, Buffer.from('iVBORw0KGgo=', 'base64'));
  try {
    const interpreter = new Interpreter();
    await interpreter.interpret(parse(`
      let token_ids = tokenize("Token counting works.", "gpt-5.6-sol")
      let counted = count_tokens("Token counting works.", "gpt-5.6-sol")
      let gemini_counted = count_tokens("Count this with Gemini.", "gemini-3.6-flash")
      let gemini_estimated = estimate_tokens("Count this with Gemini.", "gemini-3.6-flash")
      let gemini_token_ids = tokenize("Count this with Gemini.", "gemini-3.6-flash")
      let priced = estimate_cost("gpt-5.6-sol", 100000, 100000)
      let image_priced = estimate_cost("gemini-3.1-flash-image", ".token-cost-image.png")
      let image_sized = estimate_cost("gemini-3.1-flash-image", ["Restyle this image.", ".token-cost-image.png"], "1K")
      let custom = estimate_cost("private-model", 500000, 250000, {
        "input_per_million": 2,
        "output_per_million": 4
      })
    `));
    const env = (interpreter as any).currentEnv;
    assert(Array.isArray(env.get('token_ids')) && env.get('token_ids').length > 0, 'tokenize should support GPT-5.6 token IDs locally');
    assert(env.get('counted') === 5, 'count_tokens should use OpenAI native counting');
    assert(env.get('gemini_counted') === 7, 'count_tokens should use Gemini native counting');
    assert(countRequests.length === 3, 'text inputs should make one native request per provider count');
    assert(countRequests[0][0] === 'gpt-5.6-sol', 'count_tokens should forward the current GPT model');
    assert(countRequests[1][0] === 'gemini-3.6-flash', 'count_tokens should forward the Gemini model');
    assert(typeof env.get('gemini_estimated') === 'number', 'estimate_tokens should provide an offline Gemini estimate');
    assert(env.get('gemini_token_ids') === null, 'tokenize must not silently tokenize Gemini with an OpenAI encoding');
    assert(env.get('priced').total_cost_usd === 3.5, 'GPT-5.6 Sol short-context estimate should total $3.50');
    assert(imageCounted && env.get('image_priced').input_tokens === 1120, 'estimate_cost should count local image input natively');
    assert(env.get('image_sized').output_tokens === 1120, 'estimate_cost should derive Gemini image output tokens from a 1K size');
    assert(env.get('custom').total_cost_usd === 2, 'custom rates should work for private models');
    console.log('✓ separates tokenize, count_tokens, and estimate_tokens semantics');
  } finally {
    fs.rmSync(imageFixture, { force: true });
    (aiRuntime as any).countTokens = originalCountTokens;
    (aiRuntime as any).countImageTokens = originalCountImageTokens;
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

    const detailedInterpreter = new Interpreter();
    await detailedInterpreter.interpret(parse(`
      let details = model("gemini-3.6-flash") {response: "full"} {"hello"}
    `));
    const details = (detailedInterpreter as any).currentEnv.get('details');
    assert(details.text === 'mocked' && details.finish_reason === 'STOP', 'full response should include text and finish reason');
    assert(details.input_tokens === 100 && details.billable_output_tokens === 30, 'full response should include billable usage');

    const compiler = new Compiler();
    const chunk = compiler.compileProgram(parse(`
      let details = model("gemini-3.6-flash") {response: "full"} {"hello"}
      let usage = model_usage()
    `));
    assert(compiler.errors.length === 0, `VM test failed to compile: ${compiler.errors.join(', ')}`);
    const vm = new VM();
    await vm.run(chunk);
    const vmDetails = (vm as any).globals.get('details');
    const vmUsage = (vm as any).globals.get('usage');
    assert(vmDetails.text === 'mocked' && vmDetails.finish_reason === 'STOP', 'VM full response should include text and finish reason');
    assert(vmDetails.input_tokens === 100 && vmDetails.billable_output_tokens === 30, 'VM full response should include billable usage');
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
