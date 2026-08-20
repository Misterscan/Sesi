import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { Interpreter } from '../src/interpreter';
import { runSesi } from '../src/index';

async function main(): Promise<void> {
  const fixture = path.join(process.cwd(), 'tests', '.game_fixture.html');
  const asset = path.join(process.cwd(), 'tests', '.game_asset.png');
  fs.writeFileSync(asset, Buffer.from([137, 80, 78, 71]));
  try {
    const interpreter = new Interpreter(process.cwd(), { safeMode: false, allowLocalFs: true });
    const module = interpreter.loadStdModule('std/game');
    assert.ok(module, 'std/game should load');
    const create = module.get('create') as any;
    const game = create.builtin({ width: 320, height: 180, title: 'Test Game', input: { left: ['ArrowLeft'] }, scores: { score: 0 } }) as any;
    game.add.builtin({ id: 'player', shape: 'rect', x: 4, y: 4, width: 16, height: 16, color: '#f0f', collider: true, bounds: 'clamp', control: { left: 'left', speed: 90 } });
    game.add.builtin({ id: 'enemy', shape: 'sprite', x: 40, y: 4, width: 16, height: 16, asset, tags: ['hazard'], collider: true });
    game.rule.builtin({ event: 'collision', source: 'player', targetRef: 'hazard', action: 'addScore', score: 'score', value: 5 });
    game.rule.builtin({ event: 'key', source: 'player', targetRef: ' ', action: 'set', property: 'color', value: '#fff' });
    const built = game.build.builtin(fixture);
    assert.equal(built, fixture);
    const html = fs.readFileSync(fixture, 'utf8');
    assert.match(html, /requestAnimationFrame/);
    assert.match(html, /data:image\/png;base64/);
    assert.match(html, /collision/);
    assert.match(html, /ArrowLeft/);

    assert.throws(() => game.add.builtin({ id: 'player', shape: 'rect', width: 1, height: 1 }), /Duplicate/);
    const invalid = create.builtin({ width: 20, height: 20 }) as any;
    invalid.rule.builtin({ event: 'collision', source: 'missing', action: 'destroy' });
    assert.throws(() => invalid.build.builtin(fixture), /does not match/);

    const preview = await game.run.builtin({ port: 0, open: false });
    const url = preview.url.builtin();
    const page = await new Promise<string>((resolve, reject) => http.get(url, response => { let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => resolve(body)); }).on('error', reject));
    assert.match(page, /Test Game/);
    preview.stop.builtin();

    const safe = new Interpreter();
    const safeGame = (safe.loadStdModule('std/game')!.get('create') as any).builtin({ width: 8, height: 8 });
    await assert.rejects(() => safeGame.run.builtin({ open: false }), /disabled in Sesi safe mode/);

    await runSesi('allow "std/game" in as Game\nlet game = Game.create({"width": 32, "height": 32})\ngame.add({"id": "box", "shape": "rect", "width": 8, "height": 8})\ngame.build("tests/.game_vm.html")', process.cwd(), { safeMode: false, allowLocalFs: true });
    assert.ok(fs.existsSync(path.join(process.cwd(), 'tests', '.game_vm.html')), 'VM should resolve std/game');
    console.log('✓ std/game module and browser export');
  } finally {
    for (const file of [fixture, asset, path.join(process.cwd(), 'tests', '.game_vm.html')]) if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
