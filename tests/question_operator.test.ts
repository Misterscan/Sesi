import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runSesi(source: string): Promise<Interpreter> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  const interpreter = new Interpreter();
  await interpreter.interpret(program);
  return interpreter;
}

async function main() {
  console.log('=== Sesi ? Operator Tests ===\n');

  // 1. Optional Chaining - Member Access
  let interpreter = await runSesi(`
    let user1 = {"name": "Ada", "profile": {"email": "ada@sesi.org"}}
    let user2 = null
    let email1 = user1?.profile?.email
    let email2 = user2?.profile?.email
  `);
  assert(interpreter.currentEnv.get('email1') === 'ada@sesi.org', 'Optional chaining retrieves property when object exists');
  assert(interpreter.currentEnv.get('email2') === null, 'Optional chaining returns null when object is null');
  console.log('✓ Optional chaining member access (obj?.prop)');

  // 3. Optional Chaining - Index Access
  interpreter = await runSesi(`
    let items = [10, 20, 30]
    let emptyList = null
    let first = items?.[0]
    let missing = emptyList?.[0]
  `);
  assert(interpreter.currentEnv.get('first') === 10, 'Optional chaining index retrieves value when array exists');
  assert(interpreter.currentEnv.get('missing') === null, 'Optional chaining index returns null when array is null');
  console.log('✓ Optional chaining index access (arr?.[index])');

  // 4. Optional Type Annotations
  interpreter = await runSesi(`
    fn find_user(id: number) -> object? {
      if id == 1 {
        return {"name": "Ada"}
      }
      return null
    }

    fn greet(name: string, title: string? = null) {
      if title {
        return title + " " + name
      }
      return name
    }

    let u1 = find_user(1)
    let u2 = find_user(99)
    let g1 = greet("Ada", "Dr.")
    let g2 = greet("Ada")
  `);
  assert((interpreter.currentEnv.get('u1') as any)?.name === 'Ada', 'Optional return type with non-null return');
  assert(interpreter.currentEnv.get('u2') === null, 'Optional return type with null return');
  assert(interpreter.currentEnv.get('g1') === 'Dr. Ada', 'Optional parameter with value passed');
  assert(interpreter.currentEnv.get('g2') === 'Ada', 'Optional parameter with default null');
  console.log('✓ Optional type annotations (T?)');

  console.log('\nAll ? operator tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
