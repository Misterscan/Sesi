import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getBuiltins } from '../src/builtins';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(source: string, interpreter: Interpreter): Promise<void> {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  if (parser.errors.length > 0) throw new Error(parser.errors.join('\n'));
  await interpreter.interpret(program);
}

async function main(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-filesystem-builtins-'));
  const sourceDir = path.join(tempDir, 'source');
  const archivePath = path.join(tempDir, 'bundle.zip');
  const extractedDir = path.join(tempDir, 'extracted');

  try {
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'hello.txt'), 'hello archive', 'utf-8');

    const interpreter = new Interpreter(tempDir, {
      safeMode: true,
      allowedPaths: [tempDir],
    });
    await run(`
      let simpleExt = get_ext("PHOTO.JPG")
      let compoundExt = get_ext("backup.tar.gz")
      let present = exists(${JSON.stringify(path.join(sourceDir, 'hello.txt'))})
      let missing = exists(${JSON.stringify(path.join(sourceDir, 'missing.txt'))})
      let created = zip(${JSON.stringify(sourceDir)}, ${JSON.stringify(archivePath)})
      let entries = zip(${JSON.stringify(archivePath)})
      let extracted = zip(${JSON.stringify(archivePath)}, ${JSON.stringify(extractedDir)})
    `, interpreter);

    const env = (interpreter as any).currentEnv;
    assert(env.get('simpleExt') === 'jpg', 'get_ext should normalize a simple extension');
    assert(env.get('compoundExt') === 'tar.gz', 'get_ext should preserve compound archive extensions');
    assert(env.get('present') === true && env.get('missing') === false, 'exists should report filesystem state');
    assert(env.get('created') === archivePath, 'zip create should return its destination');
    assert(env.get('extracted') === extractedDir, 'zip extract should return its destination');
    assert(env.get('entries').includes('source/hello.txt'), 'zip list should include archived files');
    assert(fs.readFileSync(path.join(extractedDir, 'source', 'hello.txt'), 'utf-8') === 'hello archive', 'zip should extract file contents');

    const builtins = getBuiltins(interpreter);
    assert(builtins.get('run') === builtins.get('exec'), 'run must be an exact alias of exec');

    const vmParser = new Parser(new Lexer(`
      let vmExt = get_ext("data.tar.gz")
      let vmExists = exists(${JSON.stringify(archivePath)})
    `).scanTokens());
    const compiler = new Compiler();
    const chunk = compiler.compileProgram(vmParser.parse());
    assert(vmParser.errors.length === 0 && compiler.errors.length === 0, 'new filesystem builtins should compile');
    const vm = new VM(tempDir, { safeMode: true, allowedPaths: [tempDir] });
    await vm.run(chunk);
    assert((vm as any).globals.get('vmExt') === 'tar.gz', 'VM should execute get_ext');
    assert((vm as any).globals.get('vmExists') === true, 'VM should execute exists');
    console.log('✓ get_ext, exists, zip, and run builtins');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
