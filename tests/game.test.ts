/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { Interpreter, type BundledBytecodeModule } from '../src/interpreter';
import { VM } from '../src/vm';
import { runSesiBytecodeBundle } from '../src/index';
import type { RuntimeFunction } from '../src/types';

const root = path.resolve(__dirname, '..');

function compile(source: string) {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.equal(parser.errors.length, 0, 'source should parse');
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert.deepEqual(compiler.errors, []);
  return chunk;
}

async function runVm(source: string, safeMode = false): Promise<VM> {
  const vm = new VM(root, { safeMode, allowLocalFs: !safeMode, allowedPaths: [root] });
  await vm.run(compile(source));
  return vm;
}

async function runTree(source: string, safeMode = false): Promise<Interpreter> {
  const interpreter = new Interpreter(root, { safeMode, allowLocalFs: !safeMode, allowedPaths: [root] });
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.equal(parser.errors.length, 0);
  await interpreter.interpret(program);
  return interpreter;
}

async function testVmNamespaceAndNativeObjects() {
  const vm = await runVm(`
    allow "std/game" in as Game
    let version = Game.VERSION
    let value = Game.vec3(1, 2, 3)
    value.x = 7
    let nested = value.x
    let bound_one = value.clone
    let bound_two = value.clone
    let stable_binding = bound_one == bound_two
    let same_identity = value == value
    let native_type = type(value)
    let native_keys = keys(value)
    let game = Game.create({"title": "Orbit Camera Test"})
    let scene = game.create_scene("main")
    let camera = scene.orbit_camera("camera", {"alpha": -1.2, "beta": 0.9, "radius": 14})
    let camera_radius = camera.radius
    camera.radius = 16
    let updated_camera_radius = camera.radius
    let default_camera = scene.orbit_camera("default_camera")
    let default_camera_alpha = default_camera.alpha
    let hud = scene.gui_text("hud", {
      "text": "SCORE 0",
      "width": "220px",
      "height": "52px",
      "left": "24px",
      "top": "20px",
      "horizontal_alignment": "left",
      "vertical_alignment": "top"
    })
    let hud_left = hud.left
    let hud_vertical_alignment = hud.vertical_alignment
    hud.left = "8%"
    let updated_hud_left = hud.left
    let invalid_gui_alignment_blocked = false
    try { hud.horizontal_alignment = "up" } catch (error) { invalid_gui_alignment_blocked = true }
    game.dispose()
  `);
  assert.equal(vm.getGlobal('version'), '2.0.1');
  assert.equal(vm.getGlobal('nested'), 7);
  assert.equal(vm.getGlobal('stable_binding'), true);
  assert.equal(vm.getGlobal('same_identity'), true);
  assert.equal(vm.getGlobal('native_type'), 'vec3');
  assert.ok((vm.getGlobal('native_keys') as unknown[]).includes('clone'));
  assert.equal(vm.getGlobal('camera_radius'), 14);
  assert.equal(vm.getGlobal('updated_camera_radius'), 16);
  assert.ok(Math.abs((vm.getGlobal('default_camera_alpha') as number) + Math.PI / 2) < 0.000001);
  assert.equal(vm.getGlobal('hud_left'), '24px');
  assert.equal(vm.getGlobal('hud_vertical_alignment'), 'top');
  assert.equal(vm.getGlobal('updated_hud_left'), '8%');
  assert.equal(vm.getGlobal('invalid_gui_alignment_blocked'), true);

  const namedVm = await runVm('import { VERSION, vec2 } from "std/game"\nlet named_version = VERSION\nlet point = vec2(3, 4)');
  assert.equal(namedVm.getGlobal('named_version'), '2.0.1');
  assert.equal((namedVm.getGlobal('point') as any).getProperty('y'), 4);
}

async function testTreeNamedBindingsAndSceneFacade() {
  const interpreter = await runTree(`
    allow "std/game" in with { VERSION, create, vec3, color }
    let game = create({"title": "Facade Test", "width": 640, "height": 360})
    let first = game.create_scene("first")
    let second = game.create_scene("second")
    let lifecycle = []
    fn exited(scene_value) { push(lifecycle, "exit:first") }
    fn entered(scene_value) { push(lifecycle, "enter:second") }
    first.on_exit(exited)
    second.on_enter(entered)
    let material = first.pbr_material("metal", {"color": color("#ff8844"), "metallic": 0.8})
    let cube = first.box("cube", {"position": vec3(1, 2, 3)})
    cube.material = material
    cube.position.y = 9
    let looked_up = first.get("cube")
    let identity_ok = looked_up == cube
    let y = looked_up.position.y
    first.enable_physics({"gravity": vec3(0, -9.81, 0)})
    first.add_body(cube, {"type": "dynamic", "shape": "box", "mass": 2})
    cube.set_velocity(vec3(4, 0, 0))
    let velocity_x = cube.velocity().x
    let cross_scene_blocked = false
    let other_material = second.standard_material("other")
    let label = second.gui_text("label", {"top": 16, "horizontal_alignment": "right", "vertical_alignment": "bottom"})
    let label_top = label.top
    let label_horizontal_alignment = label.horizontal_alignment
    try { cube.material = other_material } catch (error) { cross_scene_blocked = true }
    let readonly_blocked = false
    try { cube.name = "changed" } catch (error) { readonly_blocked = true }
    cube.dispose()
    let disposed_blocked = false
    try { let missing = cube.position } catch (error) { disposed_blocked = true }
    let prototype_blocked = false
    try { material["__proto__"] = null } catch (error) { prototype_blocked = true }
    game.activate_scene("second")
    let lifecycle_order = join(lifecycle, ",")
    game.dispose()
  `);
  const env = (interpreter as any).currentEnv;
  assert.equal(env.get('identity_ok'), true);
  assert.equal(env.get('y'), 9);
  assert.equal(env.get('velocity_x'), 4);
  assert.equal(env.get('label_top'), 16);
  assert.equal(env.get('label_horizontal_alignment'), 'right');
  assert.equal(env.get('cross_scene_blocked'), true);
  assert.equal(env.get('readonly_blocked'), true);
  assert.equal(env.get('disposed_blocked'), true);
  assert.equal(env.get('prototype_blocked'), true);
  assert.equal(env.get('lifecycle_order'), 'exit:first,enter:second');

  const namespaceTree = await runTree('allow "std/game" in as Game\nlet point = Game.vec2(8, 9)');
  assert.equal((namespaceTree as any).currentEnv.get('point').getProperty('x'), 8);
}

async function testSafeMode() {
  await assert.rejects(
    () => runVm('allow "std/game" in as Game\nlet value = Game.vec3(1, 2, 3)', true),
    /requires local mode|sesi -l/,
  );
  await assert.rejects(
    () => runTree('allow "std/game" in with { create }\nlet game = create()', true),
    /requires local mode|sesi -l/,
  );
}

async function testPackagedGeneratedAssetsDoNotWrite() {
  const png = path.join(root, 'tests', '.packaged-generated-asset.png');
  const wav = path.join(root, 'tests', '.packaged-generated-asset.wav');
  fs.rmSync(png, { force: true });
  fs.rmSync(wav, { force: true });
  const previous = process.env.SESI_GAME_PACKAGED;
  process.env.SESI_GAME_PACKAGED = '1';
  try {
    const source = `
      allow "std/draw" in as Draw
      allow "std/audio" in as Audio
      Draw.pixel(0, 0, "#ffffff")
      Draw.save_png("tests/.packaged-generated-asset.png", 1, 1)
      Audio.save("tests/.packaged-generated-asset.wav", "A4", 20, "sine")
    `;
    await runVm(source);
    await runTree(source);
    assert.equal(fs.existsSync(png), false);
    assert.equal(fs.existsSync(wav), false);
  } finally {
    if (previous === undefined) delete process.env.SESI_GAME_PACKAGED;
    else process.env.SESI_GAME_PACKAGED = previous;
    fs.rmSync(png, { force: true });
    fs.rmSync(wav, { force: true });
  }
}

async function testGeneratedAssetUsesWorkingDirectoryRoot() {
  const asset = path.join(root, 'tests', '.generated-game-asset.txt');
  fs.rmSync(asset, { force: true });
  try {
    const interpreter = new Interpreter(path.join(root, 'tests', 'fixtures'), {
      safeMode: false,
      allowLocalFs: true,
      allowedPaths: [root],
    });
    const parser = new Parser(new Lexer(`
      allow "std/game" in as Game
      write_file("tests/.generated-game-asset.txt", "generated")
      let game = Game.create({"title": "Generated Asset Root"})
      game.assets.add("generated", "audio", "tests/.generated-game-asset.txt")
      let registered = game.assets.get("generated").source
      game.dispose()
    `).scanTokens());
    const program = parser.parse();
    assert.equal(parser.errors.length, 0);
    await interpreter.interpret(program);
    assert.equal((interpreter as any).currentEnv.get('registered'), 'tests/.generated-game-asset.txt');
    assert.equal(fs.readFileSync(asset, 'utf8'), 'generated');
  } finally {
    fs.rmSync(asset, { force: true });
  }
}

async function testCallbackVmOwnership() {
  const vm = await runVm(`
    let callback_count = 0
    fn callback(dt) { callback_count = callback_count + 1 }
  `);
  const callback = vm.getGlobal('callback') as RuntimeFunction;
  assert.equal(callback.ownerVm, vm);
  await vm.invokeNativeCallback(callback, [1 / 60], true);
  await vm.invokeNativeCallback(callback, [1 / 60], true);
  assert.equal(vm.getGlobal('callback_count'), 2);
}

async function testBytecodeOnlyModuleGraph() {
  const dependencySource = 'export fn answer() { return 42 }';
  const entrySource = 'import { answer } from "./dependency"\nlet result = answer()';
  const dependencyParser = new Parser(new Lexer(dependencySource).scanTokens());
  const dependencyProgram = dependencyParser.parse();
  const dependencyCompiler = new Compiler();
  const dependencyChunk = dependencyCompiler.compileProgram(dependencyProgram);
  const modules: BundledBytecodeModule[] = [
    { id: 'entry.sesi', chunk: compile(entrySource), exports: [] },
    { id: 'dependency.sesi', chunk: dependencyChunk, exports: ['answer'] },
  ];
  await runSesiBytecodeBundle(
    { format: 'sesi-bytecode-bundle-v1', entry: 'entry.sesi', modules },
    root,
    { safeMode: false, allowLocalFs: true, allowedPaths: [root], gameHost: true },
  );
}

async function testBuildOnlyStageAndAssets() {
  const output = path.join(root, 'tests', '.game-build-fixture');
  fs.rmSync(output, { recursive: true, force: true });
  try {
    await runTree(`
      allow "std/game" in as Game
      let game = Game.create({"title": "Build Fixture"})
      game.assets.add("triangle", "model", "examples/main/assets/triangle.gltf")
      let scene = game.create_scene("main")
      let camera = scene.orbit_camera("camera")
      let light = scene.hemispheric_light("light")
      let triangle = scene.load_model("triangle", "triangle")
      game.build("tests/.game-build-fixture", {"overwrite": true, "stage_only": true})
      game.dispose()
    `);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'game.manifest.json'), 'utf8'));
    assert.equal(manifest.sourceIncluded, false);
    assert.equal(manifest.assets[0].name, 'triangle');
    assert.match(manifest.assets[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(path.join(output, 'game.bytecode.json')), true);
    assert.equal(fs.existsSync(path.join(output, 'node_modules', '@misterscan', 'sesi-game', 'index.cjs')), true);
    assert.equal(fs.existsSync(path.join(output, 'node_modules', 'html-to-text', 'package.json')), true);
    assert.equal(fs.existsSync(path.join(output, 'node_modules', 'sharp', 'package.json')), true);
    const stagedCore = require(path.join(output, 'node_modules', '@misterscan', 'sesi'));
    assert.equal(typeof stagedCore.runSesiBytecodeBundle, 'function');
    const packagedFiles = fs.readdirSync(output, { recursive: true }) as string[];
    assert.equal(packagedFiles.some(file => file.endsWith('.sesi')), false);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
}

async function testRemoteAssetPackagingGuards() {
  const dependency = Buffer.from([0, 1, 2, 3, 4, 5]);
  const gltf = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    buffers: [{ uri: 'buffer.bin', byteLength: dependency.length }],
    scenes: [{ nodes: [] }],
    scene: 0,
  }));
  const sourceHash = cryptoHash(gltf);
  const server = http.createServer((request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { location: '/scene.gltf' }); response.end(); return; }
    if (request.url === '/scene.gltf') { response.writeHead(200, { 'content-type': 'model/gltf+json' }); response.end(gltf); return; }
    if (request.url === '/buffer.bin') { response.writeHead(200); response.end(dependency); return; }
    if (request.url === '/slow') { setTimeout(() => { response.writeHead(200); response.end('slow'); }, 100); return; }
    response.writeHead(200); response.end(Buffer.alloc(32));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const output = path.join(root, 'tests', '.game-remote-build-fixture');
  fs.rmSync(output, { recursive: true, force: true });
  try {
    await runTree(`
      allow "std/game" in as Game
      let game = Game.create({"title": "Remote Fixture"})
      game.assets.add("remote_scene", "model", "${origin}/redirect", {"extension": ".gltf", "checksum": "sha256:${sourceHash}"})
      let scene = game.create_scene("main")
      let camera = scene.orbit_camera("camera")
      let light = scene.hemispheric_light("light")
      game.build("tests/.game-remote-build-fixture", {"overwrite": true, "stage_only": true})
      game.dispose()
    `);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'game.manifest.json'), 'utf8'));
    assert.equal(manifest.assets[0].source_sha256, sourceHash);
    assert.equal(manifest.assets[0].dependencies.length, 1);

    const failed = await runTree(`
      allow "std/game" in as Game
      let game = Game.create({"title": "Guard Fixture"})
      game.assets.add("large", "audio", "${origin}/large")
      let rejected = false
      try { game.build("tests/.game-remote-failure", {"overwrite": true, "stage_only": true, "max_asset_bytes": 8}) } catch (error) { rejected = true }
      game.dispose()
    `);
    assert.equal((failed as any).currentEnv.get('rejected'), true);
  } finally {
    server.close();
    fs.rmSync(output, { recursive: true, force: true });
    fs.rmSync(path.join(root, 'tests', '.game-remote-failure'), { recursive: true, force: true });
  }
}

function cryptoHash(value: Buffer): string {
  return require('node:crypto').createHash('sha256').update(value).digest('hex');
}

function testMissingAddonDiagnostic() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-game-missing-addon-'));
  try {
    fs.cpSync(path.join(root, 'dist'), path.join(temporary, 'dist'), { recursive: true });
    const script = `const {Interpreter,Lexer,Parser}=require('./dist');(async()=>{const i=new Interpreter(process.cwd(),{safeMode:false,allowLocalFs:true,allowedPaths:[process.cwd()]});const p=new Parser(new Lexer('allow "std/game" in as Game\\nlet v=Game.vec3(1,2,3)').scanTokens()).parse();await i.interpret(p)})().catch(e=>{console.error(e.message);process.exitCode=7})`;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: temporary,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), SESI_GAME_DISABLE_ADDON: '1' },
    });
    assert.equal(result.status, 7);
    assert.match(result.stderr, /npm install @misterscan\/sesi-game/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function testIncompatibleAddonDiagnostic() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-game-incompatible-addon-'));
  try {
    const addon = path.join(temporary, 'addon.cjs');
    fs.writeFileSync(addon, 'module.exports={SESI_GAME_API_VERSION:999,createRuntime(){return {}}}');
    const script = `const {Interpreter,Lexer,Parser}=require('${path.join(root, 'dist').replace(/\\/g, '\\\\')}');(async()=>{const i=new Interpreter(process.cwd(),{safeMode:false,allowLocalFs:true,allowedPaths:[process.cwd()]});const p=new Parser(new Lexer('allow "std/game" in as Game\\nlet v=Game.vec3(1,2,3)').scanTokens()).parse();await i.interpret(p)})().catch(e=>{console.error(e.message);process.exitCode=9})`;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: temporary,
      encoding: 'utf8',
      env: { ...process.env, SESI_GAME_ADDON_PATH: addon },
    });
    assert.equal(result.status, 9);
    assert.match(result.stderr, /incompatible API/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

async function main() {
  await testVmNamespaceAndNativeObjects();
  await testTreeNamedBindingsAndSceneFacade();
  await testSafeMode();
  await testPackagedGeneratedAssetsDoNotWrite();
  await testGeneratedAssetUsesWorkingDirectoryRoot();
  await testCallbackVmOwnership();
  await testBytecodeOnlyModuleGraph();
  await testBuildOnlyStageAndAssets();
  await testRemoteAssetPackagingGuards();
  testMissingAddonDiagnostic();
  testIncompatibleAddonDiagnostic();
  console.log('✓ std/game native objects, modules, callbacks, security, and bytecode bundle tests');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
