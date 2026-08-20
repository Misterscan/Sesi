import assert from 'node:assert/strict';
import { Interpreter } from '../src/interpreter';

async function main(): Promise<void> {
  const interpreter = new Interpreter();
  const terminal = interpreter.loadStdModule('std/terminal');
  assert.ok(terminal, 'std/terminal should load');

  const call = (name: string, ...args: any[]): any => {
    const fn = terminal.get(name) as any;
    assert.ok(fn?.builtin, `${name} should be exported as a builtin`);
    return fn.builtin(...args);
  };

  const output: string[] = [];
  const originalWrite = process.stdout.write;
  (process.stdout.write as any) = (chunk: unknown) => {
    output.push(String(chunk));
    return true;
  };

  try {
    assert.equal(call('color', 'ready', 'brightGreen'), '\x1b[92mready\x1b[0m');
    assert.equal(call('style', 'ready', ['bold', 'underline', 'cyan']), '\x1b[1;4;36mready\x1b[0m');
    assert.equal(call('background', 'ready', 'blue'), '\x1b[44mready\x1b[0m');
    assert.equal(call('rgb', 'ready', 300, -5, 12.9), '\x1b[38;2;255;0;12mready\x1b[0m');
    assert.equal(call('rgbBackground', 'ready', 1, 2, 3), '\x1b[48;2;1;2;3mready\x1b[0m');

    call('clear', 'line');
    call('eraseScreen', 'scrollback');
    call('cursor', 3, 4);
    call('move', -2, 3);
    call('left', 2);
    call('saveCursor');
    call('restoreCursor');
    call('hideCursor');
    call('showCursor');
    call('write', 'a');
    call('line', 'b');
    call('title', 'Sesi');
    call('bell');

    assert.deepEqual(output, [
      '\x1b[2K\r', '\x1b[3J', '\x1b[4;3H', '\x1b[3B\x1b[2D', '\x1b[2D',
      '\x1b[s', '\x1b[u', '\x1b[?25l', '\x1b[?25h', 'a', 'b\n', '\x1b]0;Sesi\x07', '\x07'
    ]);

    const size = call('size');
    assert.equal(typeof size.columns, 'number');
    assert.equal(typeof size.rows, 'number');
  } finally {
    process.stdout.write = originalWrite;
  }

  console.log('✓ std/terminal controls and formatting');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
