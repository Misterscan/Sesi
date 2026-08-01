import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-conversion-'));
  const inputPath = path.join(tempDir, 'logo.svg');
  const outputPath = path.join(tempDir, 'logo.png');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>';
  fs.writeFileSync(inputPath, svg, 'utf8');

  try {
    const source = 'let png = convert(media) {output_type: "png"} {"logo.svg"}';
    const parser = new Parser(new Lexer(source).scanTokens());
    const program = parser.parse();
    const interpreter = new Interpreter(tempDir, {
      safeMode: false,
      allowLocalFs: true,
      allowedPaths: [tempDir],
    });

    await interpreter.interpret(program);

    assert(fs.existsSync(outputPath), 'SVG conversion creates a PNG file');
    const signature = fs.readFileSync(outputPath).subarray(0, 8);
    assert(
      signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'SVG conversion output has a PNG signature'
    );
    console.log('✓ native SVG-to-PNG conversion');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
