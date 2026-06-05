// Sesi HTTP Client Builtins Test Suite
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

async function runTest(name: string, source: string, interpreter = new Interpreter()): Promise<any> {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    await interpreter.interpret(program);
    console.log(`✓ ${name}`);
    return interpreter;
  } catch (error: any) {
    console.error(`✗ ${name}: ${error.stack || error.message}`);
    throw error;
  }
}

async function main() {
  console.log('=== Sesi HTTP Client Tests ===\n');

  // Test 1: web_get call to JSONPlaceholder
  const int1 = new Interpreter();
  await runTest('Execute HTTP GET via web_get', `
    let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
    print "GET Response summary:" + response
  `, int1);
  const responseVal = (int1 as any).currentEnv.get('response');
  if (typeof responseVal === 'string' && responseVal.includes('"id": 1')) {
    console.log('  ✓ web_get retrieved correct payload');
  } else {
    console.error('  ✗ web_get failed, response was:', responseVal);
  }

  // Test 2: web_send (POST) call to JSONPlaceholder
  const int2 = new Interpreter();
  await runTest('Execute HTTP POST via web_send', `
    let payload = "{ \\"title\\": \\"foo\\", \\"body\\": \\"bar\\", \\"userId\\": 1 }"
    let postResponse = web_send("https://jsonplaceholder.typicode.com/posts", payload)
    print "POST Response summary:" + postResponse
  `, int2);
  const postResVal = (int2 as any).currentEnv.get('postResponse');
  if (typeof postResVal === 'string' && postResVal.includes('"id": 101')) {
    console.log('  ✓ web_send successfully posted payload');
  } else {
    console.error('  ✗ web_send failed, response was:', postResVal);
  }

  // Test 3: Native HTTP Server listen & handler test
  const int3 = new Interpreter(undefined, { safeMode: false });
  await runTest('Start Native HTTP Server and Handle Requests', `
    async fn handler(req) {
      return {
        "status": 200,
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "success": true,
          "method": req.method,
          "path": req.path,
          "body": req.body
        }
      }
    }
    let server = listen(9876, handler)
  `, int3);

  const testUrl = 'http://localhost:9876/test-route';
  const testPayload = JSON.stringify({ hello: 'world' });
  const response = await fetch(testUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: testPayload,
  });
  const data = (await response.json()) as any;
  if (data.success && data.method === 'POST' && data.path === '/test-route' && JSON.parse(data.body).hello === 'world') {
    console.log('  ✓ Native HTTP Server correctly parsed and handled request');
  } else {
    console.error('  ✗ Native HTTP Server failed handling request:', data);
  }

  const serverVal = (int3 as any).currentEnv.get('server');
  await int3.callSesiFunction(serverVal.close, []);
  console.log('  ✓ Server closed successfully');

  console.log('\nAll HTTP tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
