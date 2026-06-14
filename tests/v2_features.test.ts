// Sesi V2.0 features integration tests
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
  console.log('=== Sesi V2.0 Features Tests ===\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  // 1. Tool piping test
  console.log('1. Testing tool piping (|) composition...');
  try {
    const interpreter = new Interpreter();
    await run(
      `
      fn add(a, b) {
        return a + b
      }
      fn mul(a, b) {
        return a * b
      }
      let val = 10 | add(5) | mul(2)
      `,
      interpreter
    );
    const val = (interpreter as any).currentEnv.get('val');
    assert('10 | add(5) | mul(2) results in 30', val === 30, `got ${val}`);
  } catch (e: any) {
    assert('Tool piping failed to execute', false, e.message);
  }

  // 2. Piping to function references directly
  console.log('\n2. Testing piping to direct function references...');
  try {
    const interpreter = new Interpreter();
    await run(
      `
      fn double(x) {
        return x * 2
      }
      let val2 = 5 | double
      `,
      interpreter
    );
    const val2 = (interpreter as any).currentEnv.get('val2');
    assert('5 | double results in 10', val2 === 10, `got ${val2}`);
  } catch (e: any) {
    assert('Direct piping failed to execute', false, e.message);
  }

  // 3. Error recovery (retry builtin) test
  console.log('\n3. Testing retry builtin with exponential backoff...');
  try {
    const interpreter = new Interpreter();
    
    // Test successful case
    await run(
      `
      let count = 0
      fn action() {
        count = count + 1
        return count
      }
      let res1 = retry(action, {"max_retries": 2, "initial_delay": 1, "backoff_factor": 2})
      `,
      interpreter
    );
    const res1 = (interpreter as any).currentEnv.get('res1');
    const count1 = (interpreter as any).currentEnv.get('count');
    assert('retry returns result immediately on first success', res1 === 1 && count1 === 1, `res1=${res1}, count1=${count1}`);

    // Test retry on failure then success
    const interpreter2 = new Interpreter();
    await run(
      `
      let count = 0
      fn action() {
        count = count + 1
        if count < 3 {
          raise_error("TemporaryError", "Resource temporarily busy")
        }
        return count
      }
      let res2 = retry(action, {"max_retries": 3, "initial_delay": 1, "backoff_factor": 1})
      `,
      interpreter2
    );
    const res2 = (interpreter2 as any).currentEnv.get('res2');
    const count2 = (interpreter2 as any).currentEnv.get('count');
    assert('retry retries and eventually succeeds', res2 === 3 && count2 === 3, `res2=${res2}, count2=${count2}`);

    // Test retry exceeding max retries
    const interpreter3 = new Interpreter();
    let threw = false;
    try {
      await run(
        `
        fn action() {
          raise_error("FatalError", "Always fails")
        }
        retry(action, {"max_retries": 2, "initial_delay": 1, "backoff_factor": 1})
        `,
        interpreter3
      );
    } catch (e: any) {
      threw = true;
      assert('retry propagates last error when max retries exceeded', e.message.includes('Always fails'));
    }
    if (!threw) {
      assert('retry propagates last error when max retries exceeded', false, 'did not throw');
    }

  } catch (e: any) {
    assert('Retry builtin tests failed', false, e.message);
  }

  // 4. Streaming AI response test
  console.log('\n4. Testing streaming AI responses...');
  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  const capturedRequests: any[] = [];
  (aiRuntime as any).callModel = async (request: any) => {
    capturedRequests.push(request);
    if (request.stream) {
      if (typeof request.stream === 'function') {
        await request.stream('Hello ');
        await request.stream('from ');
        await request.stream('streaming ');
        await request.stream('AI!');
      }
    }
    return { text: 'Hello from streaming AI!' };
  };

  try {
    const interpreter = new Interpreter();
    let chunkCount = 0;
    const streamChunks: string[] = [];
    (interpreter as any).currentEnv.define('onChunk', {
      type: 'function',
      name: 'onChunk',
      params: [{ name: 'chunk' }],
      body: {} as any,
      closure: {} as any,
      isBuiltin: true,
      builtin: (chunk: string) => {
        chunkCount++;
        streamChunks.push(chunk);
        return null;
      }
    });

    await run(
      `
      let res = model("gemini-3-flash-preview") {stream: onChunk} {"Hello model"}
      `,
      interpreter
    );

    assert('Model call with stream config is routed to callModel', capturedRequests.length === 1);
    assert('stream callback was called multiple times', chunkCount === 4, `chunkCount=${chunkCount}`);
    assert('stream callback accumulated correct text', streamChunks.join('') === 'Hello from streaming AI!', `got ${streamChunks.join('')}`);
    
    const resVal = (interpreter as any).currentEnv.get('res');
    assert('model call returns final accumulated text', resVal === 'Hello from streaming AI!');

  } catch (e: any) {
    assert('Streaming AI test failed', false, e.message);
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  // 5. Array functions test (map, filter, reduce, find)
  console.log('\n5. Testing array functions (map, filter, reduce, find)...');
  try {
    const interpreter = new Interpreter();
    await run(
      `
      let numbers = [1, 2, 3, 4, 5]

      fn double(x) { return x * 2 }
      let squares = map(numbers, double)

      fn isOdd(x) { return x % 2 != 0 }
      let odds = filter(numbers, isOdd)

      fn add(acc, x) { return acc + x }
      let total = reduce(numbers, add)
      let totalWithInitial = reduce(numbers, add, 10)

      fn isGreaterThanThree(x) { return x > 3 }
      let found = find(numbers, isGreaterThanThree)

      fn isGreaterThanTen(x) { return x > 10 }
      let notFound = find(numbers, isGreaterThanTen)
      `,
      interpreter
    );

    const squares = (interpreter as any).currentEnv.get('squares');
    const odds = (interpreter as any).currentEnv.get('odds');
    const total = (interpreter as any).currentEnv.get('total');
    const totalWithInitial = (interpreter as any).currentEnv.get('totalWithInitial');
    const found = (interpreter as any).currentEnv.get('found');
    const notFound = (interpreter as any).currentEnv.get('notFound');

    assert('map transforms elements', JSON.stringify(squares) === '[2,4,6,8,10]', `got ${JSON.stringify(squares)}`);
    assert('filter filters elements', JSON.stringify(odds) === '[1,3,5]', `got ${JSON.stringify(odds)}`);
    assert('reduce accumulates values without initial', total === 15, `got ${total}`);
    assert('reduce accumulates values with initial', totalWithInitial === 25, `got ${totalWithInitial}`);
    assert('find finds matching element', found === 4, `got ${found}`);
    assert('find returns null if no match', notFound === null, `got ${notFound}`);
  } catch (e: any) {
    assert('Array functions test failed', false, e.message);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
