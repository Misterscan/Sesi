import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { VM } from '../src/vm';

async function pixels(filename: string) {
  return sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function bounds(filename: string) {
  const { data, info } = await pixels(filename);
  let left = info.width, right = -1, top = info.height, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-text-'));
  const cases: Array<[string, string, number, string]> = [
    ['small', 'MMMM', 1, 'mono'], ['fractional', 'MMMM', 1.8, 'mono'],
    ['fourteen', 'MMMM', 2, 'mono'], ['sixteen', 'MMMM', 16 / 7, 'mono'],
    ['plain', 'Code', 2, 'mono'], ['indented', '    Code', 2, 'mono'],
    ['singleSpace', 'A A', 2, 'mono'], ['doubleSpace', 'A  A', 2, 'mono'],
    ['capital', 'H', 2, 'mono'], ['comma', ',', 2, 'mono'], ['descender', 'g', 2, 'mono'],
    ['multiline', 'H\n\nH', 2, 'mono'], ['windowsLines', 'H\r\n\r\nH', 2, 'mono'],
    ['bitmap', 'A', 1, 'classic'], ['bitmapFraction', 'A', 1.8, 'classic'],
    ['blank', '   ', 2, 'mono'],
  ];
  try {
    for (const engine of ['interpreter', 'vm']) {
      const output = (id: string) => path.join(directory, `${engine}-${id}.png`);
      const source = 'allow "std/draw" in as Draw\n' + cases.map(([id, text, scale, font]) => `
Draw.clear()
Draw.pixel_text(20, 20, ${JSON.stringify(text)}, "#ffffff", ${scale}, ${JSON.stringify(font)})
Draw.save_png(${JSON.stringify(output(id))}, 400, 160)
`).join('') + `
let rejected = false
try { Draw.pixel_text(0, 0, "bad scale", "#ffffff", "invalid", "mono") } catch (err) { rejected = true }
if !rejected { raise_error("TestFailure", "Invalid scale was accepted") }
`;
      const parser = new Parser(new Lexer(source).scanTokens());
      const program = parser.parse();
      assert.deepEqual(parser.errors, []);
      if (engine === 'interpreter') await new Interpreter(directory, { allowedPaths: [directory] }).interpret(program);
      else {
        const compiler = new Compiler();
        const chunk = compiler.compileProgram(program);
        assert.deepEqual(compiler.errors, []);
        await new VM(directory, { allowedPaths: [directory] }).run(chunk);
      }
      const small = await bounds(output('small'));
      const fractional = await bounds(output('fractional'));
      assert.ok(fractional.width > small.width, `${engine}: smooth fractional scales are not floored`);
      assert.ok(fractional.height > small.height);
      assert.ok((await bounds(output('sixteen'))).width > (await bounds(output('fourteen'))).width);

      const plain = await bounds(output('plain'));
      const indented = await bounds(output('indented'));
      assert.ok(indented.left - plain.left >= 28, `${engine}: leading indentation survives rasterization`);
      assert.equal(indented.top, plain.top);
      assert.equal(indented.height, plain.height);
      assert.ok((await bounds(output('doubleSpace'))).width > (await bounds(output('singleSpace'))).width,
        `${engine}: repeated spaces are preserved`);

      const capital = await bounds(output('capital'));
      const comma = await bounds(output('comma'));
      const descender = await bounds(output('descender'));
      assert.ok(comma.top > capital.top + capital.height / 2, `${engine}: punctuation stays on its baseline`);
      assert.ok(descender.bottom > capital.bottom, `${engine}: descenders extend below capitals`);
      assert.ok((await bounds(output('multiline'))).height >= capital.height + 38,
        `${engine}: explicit newlines and blank lines retain line spacing`);
      assert.deepEqual((await pixels(output('multiline'))).data, (await pixels(output('windowsLines'))).data);
      assert.deepEqual((await pixels(output('bitmap'))).data, (await pixels(output('bitmapFraction'))).data,
        `${engine}: classic bitmap cell scaling is unchanged`);
      assert.equal((await bounds(output('blank'))).width <= 0, true);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  console.log('Pixel text tests passed: fractional sizing, pixel-size conversion, whitespace, baselines, descenders, newlines and bitmap compatibility in interpreter and VM.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
