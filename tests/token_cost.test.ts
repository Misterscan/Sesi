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
  assert(standard?.inputCostUsd === 0.75, 'Gemini input cost should use the current introductory rate');
  assert(standard?.outputCostUsd === 3.75, 'Gemini output cost should use the current introductory rate');
  assert(standard?.totalCostUsd === 4.5, 'Gemini total cost should sum input and output');
  console.log('✓ resolves standard model pricing');

  const flash = estimateTokenCost('models/gemini-3.8-flash', 1_000_000, 1_000_000);
  assert(flash?.inputCostUsd === 0.75 && flash?.outputCostUsd === 3.75, 'Gemini 3.8 Flash should use the introductory rate');
  assert(estimateTokenCost('gemini-3.7-flash', 1000, 1000) === null, 'deprecated Gemini 3.7 Flash should not have a current rate');
  assert(estimateTokenCost('gemini-3.5-flash', 1000, 1000) === null, 'deprecated Gemini 3.5 Flash should not have a current rate');
  console.log('✓ prices current Gemini Flash and excludes deprecated model IDs');

  for (const [model, input, output] of [
    ['gemini-3-flash-preview', 0.5, 3],
    ['gemini-3.1-flash-lite', 0.25, 1.5],
    ['gemini-2.5-flash-image', 0.3, 30],
    ['gemini-omni-1.1-flash', 1.5, 17.5],
    ['gemini-3.8-flash-tts', 0.5, 9],
    ['gemini-3.8-flash-lite-tts', 0.5, 6],
    ['gemini-3.5-transcribe', 2, 12],
    ['gemini-3.5-transcribe-live', 3.5, 21],
    ['gemini-robotics-er-2-preview', 1, 5],
    ['gpt-5.5', 5, 30],
    ['gpt-5.5-pro', 30, 180],
    ['gpt-5.4', 2.5, 15],
    ['gpt-5.4-mini', 0.75, 4.5],
    ['gpt-5.2', 1.75, 14],
  ] as const) {
    const rate = estimateTokenCost(model, 1, 1);
    assert(rate?.inputPerMillion === input && rate?.outputPerMillion === output, `${model} should use its published Standard rates`);
  }
  assert(estimateTokenCost('gemini-2.5-flash-image-preview', 1, 1) === null, 'shutdown Gemini image preview should not inherit stable-model pricing');
  assert(estimateTokenCost('gemini-3.1-flash-lite-preview', 1, 1) === null, 'shutdown Gemini Flash-Lite preview should not inherit stable-model pricing');
  assert(estimateTokenCost('gpt-image-1.5', 1, 1) === null, 'deprecated GPT image model should not have a current rate');
  console.log('✓ covers active text, image, video, and speech model pricing');

  const flashImage = estimateTokenCost('gemini-3.1-flash-image', 1_000_000, 1_000_000);
  assert(flashImage?.inputPerMillion === 0.5, 'Gemini 3.1 Flash Image should use its text and image input rate');
  assert(flashImage?.outputPerMillion === 60, 'Gemini 3.1 Flash Image should use its generated-image output rate');
  const gptImage = estimateTokenCost('gpt-image-2', 1_000_000, 1_000_000);
  assert(gptImage?.inputPerMillion === 5, 'GPT Image 2 should use its text input rate');
  assert(gptImage?.imageInputPerMillion === 8, 'GPT Image 2 should use its reference-image input rate');
  assert(gptImage?.outputPerMillion === 30, 'GPT Image 2 should use its generated-image output rate');
  const editedGptImage = estimateTokenCost('gpt-image-2.5-flare', 100, 200, undefined, 40);
  assert(editedGptImage?.inputCostUsd === 0.00062, 'GPT Image mixed input should price text and image tokens separately');
  console.log('✓ resolves image model token pricing');

  const tiered = estimateTokenCost('models/gemini-3.1-pro-preview', 200_001, 10);
  assert(tiered?.inputPerMillion === 4, 'long Gemini Pro prompts should use the >200k input tier');
  assert(tiered?.outputPerMillion === 18, 'long Gemini Pro prompts should use the >200k output tier');
  console.log('✓ applies long-context pricing tiers');

  const currentGPT = estimateTokenCost('gpt-5.6-sol', 1_000_000, 1_000_000);
  assert(currentGPT?.totalCostUsd === 38, 'GPT-5.6 Sol long-context pricing should total $38');
  assert(estimateTokenCost('gpt-5.6-mars', 1000, 1000) === null, 'unknown GPT-5.6 tiers must not inherit alias pricing');
  assert(estimateTokenCost('gpt-5.6-sol-2026-07-01', 1000, 1000) !== null, 'dated model snapshots should inherit base pricing');
  assert(estimateTokenCost('gemini-3.1-flash-image-preview', 1000, 1000) === null, 'shutdown preview snapshots must not inherit current pricing');
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
      let gpt_edited = estimate_cost("gpt-image-2", ["Restyle this image.", ".token-cost-image.png"], 100)
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
    assert(env.get('priced').total_cost_usd === 2.4, 'GPT-5.6 Sol short-context estimate should total $2.40');
    assert(imageCounted && env.get('image_priced').input_tokens === 1120, 'estimate_cost should count local image input natively');
    assert(env.get('image_sized').output_tokens === 1120, 'estimate_cost should derive Gemini image output tokens from a 1K size');
    assert(env.get('gpt_edited').image_input_tokens === 1120, 'estimate_cost should separate reference image input tokens');
    assert(env.get('gpt_edited').image_input_rate_per_million === 8, 'estimate_cost should expose the image input rate');
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
    assert(treeUsage.total_cost_usd === 0.0001875, 'tree walker should bill thinking tokens at the output rate');

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
    assert(vmUsage.total_cost_usd === 0.0001875, 'VM should bill thinking tokens at the output rate');
    console.log('✓ exposes actual usage and cost in tree-walker and VM execution');

    const imageProgram = parse(`let picture = image("gpt-image-2") {response: "full"} {"draw"}`);
    const imageInterpreter = new Interpreter();
    await imageInterpreter.interpret(imageProgram);
    const treeImage = (imageInterpreter as any).currentEnv.get('picture');
    assert(treeImage.text === 'mocked' && treeImage.finish_reason === 'STOP', 'image full response should include data and finish reason');
    assert(treeImage.media_type === 'image' && treeImage.generated_images === 1, 'image full response should identify the generated image');
    assert(treeImage.input_tokens === 100 && treeImage.output_tokens === 25, 'image full response should include token usage');

    const imageCompiler = new Compiler();
    const imageChunk = imageCompiler.compileProgram(imageProgram);
    assert(imageCompiler.errors.length === 0, 'VM image full response should compile');
    const imageVm = new VM();
    await imageVm.run(imageChunk);
    const vmImage = (imageVm as any).globals.get('picture');
    assert(vmImage.text === 'mocked' && vmImage.media_type === 'image', 'VM image full response should include image data and media type');
    assert(vmImage.total_cost_usd === treeImage.total_cost_usd, 'VM image full response should include estimated cost');

    const fallbackVm = new VM();
    (fallbackVm as any).interpreter.evaluateImageCall = undefined;
    await fallbackVm.run(imageChunk);
    const fallbackImage = (fallbackVm as any).globals.get('picture');
    assert(fallbackImage.text === 'mocked' && fallbackImage.media_type === 'image', 'VM image fallback should honor response: full');
    console.log('✓ returns full image responses in tree-walker and VM execution');

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
