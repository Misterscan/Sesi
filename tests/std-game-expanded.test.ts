/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createNativeObject, bindNativeMethod } from '../src/native-object';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';

const { createRuntime } = require('../packages/sesi-game');
const { driverFor } = require('../packages/sesi-game/runtime/internals.cjs');
const root = process.env.SESI_GAME_TEST_ROOT;
if (!root) throw new Error('Run through scripts/run-game-tests.cjs to isolate generated assets.');
const call = (value: any, name: string, ...args: any[]) => value.getProperty(name).builtin(...args);

async function parity() {
  const source = `
    allow "std/game" in as G
    let game = G.create()
    let scene = game.create_scene("fixture")
    let root = scene.transform("root", {position: G.vec3(3,0,0)})
    let cube = scene.box("cube", {parent: root, position: G.vec3(0,0,5)})
    let hit = scene.sweep_box(G.vec3(3,0,0), G.vec3(3,0,10), G.vec3(0.5,0.5,0.5), {targets:[cube]})
    let parent_ok = cube.parent == root
    let blocked = false
    try { root.parent = cube } catch (error) { blocked = true }
    let other = game.create_scene("other")
    let outsider = other.box("outsider")
    let cross_scene = false
    try { cube.parent = outsider } catch (error) { cross_scene = true }
    root.dispose()
    let child_disposed = false
    try { let value = cube.position } catch (error) { child_disposed = true }
    game.dispose()
  `;
  for (const vmMode of [false, true]) {
    const parser = new Parser(new Lexer(source).scanTokens());
    const program = parser.parse();
    assert.deepEqual(parser.errors, []);
    const runtime = vmMode ? new VM(process.cwd(), { safeMode: false }) : new Interpreter(process.cwd(), { safeMode: false });
    if (runtime instanceof VM) {
      const compiler = new Compiler();
      const chunk = compiler.compileProgram(program);
      assert.deepEqual(compiler.errors, []);
      await runtime.run(chunk);
    } else await runtime.interpret(program);
    const get = (name: string) => runtime instanceof VM ? runtime.getGlobal(name) : (runtime as any).currentEnv.get(name);
    for (const name of ['parent_ok', 'blocked', 'cross_scene', 'child_disposed']) assert.equal(get(name), true, name);
    const hit = get('hit');
    assert.equal(hit.hit, true);
    assert.ok(Math.abs(hit.fraction - 0.4) < 1e-6);
  }
}

async function gltfRoundTrip() {
  const B = await import('@babylonjs/core');
  const runtime = createRuntime({
    createNativeObject, bindMethod: bindNativeMethod, projectRoot: root, allowedRoots: [root],
    error: (type: string, message: string) => new Error(`${type}: ${message}`),
    invokeCallback: async (fn: any, args: any[]) => fn.builtin(...args),
  });
  const driver = driverFor(runtime);
  const gameHandle = runtime.create.builtin();
  const author = call(gameHandle, 'create_scene', 'author');
  const parent = call(author, 'transform', 'rig');
  const cube = call(author, 'box', 'painted', { parent });
  const paint = call(author, 'pbr_material', 'red', { color: runtime.color.builtin('#ff0000') });
  cube.setProperty('material', paint);
  call(author, 'animation_clip', 'rotate', [{ target: parent, property: 'rotation', frames: [
    { time: 0, value: runtime.vec3.builtin() }, { time: 1, value: runtime.vec3.builtin(0, Math.PI, 0) },
  ] }]);
  call(author, 'animation_clip', 'held_pose', [{ target: parent, property: 'rotation', frames: [
    { time: 0, value: runtime.vec3.builtin(0.2, 0, 0) }, { time: 1, value: runtime.vec3.builtin(0.2, 0, 0) },
  ] }]);
  await runtime.gltf.builtin(author, 'fixture.glb', { mode: 'export' });
  await runtime.gltf.builtin(author, 'fixture.gltf', { mode: 'export' });
  assert.equal(fs.readFileSync(path.join(root!, 'fixture.glb')).subarray(0, 4).toString(), 'glTF');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root!, 'fixture.gltf'), 'utf8')).asset.version, '2.0');
  call(author, 'dispose');
  for (const format of ['glb', 'gltf']) {
    const sceneHandle = call(gameHandle, 'create_scene', format);
    const model = runtime.gltf.builtin(sceneHandle, `fixture.${format}`, { name: `loaded-${format}` });
    const game = driver.activeGame();
    const scene = game.scenes.get(format);
    const engine = new B.NullEngine({ renderWidth: 320, renderHeight: 180, deterministicLockstep: true, lockstepMaxSteps: 5 });
    const desktop = { game, B, GUI: {}, engine, canvas: null, stopped: false, stop: () => engine.dispose() };
    game.desktop = desktop;
    try {
      await driver.materializeScene(desktop, scene);
      const record = scene.objects.get(`loaded-${format}`);
      const meshes = record.backend.getChildMeshes();
      assert.ok(meshes.length > 0);
      assert.ok(meshes.some((mesh: any) => mesh.material?.albedoColor?.r > 0.9 && mesh.material.albedoColor.g < 0.1));
      assert.ok(model.getProperty('animations').includes('rotate'));
      assert.ok(model.getProperty('animations').includes('held_pose'), 'constant authored poses must survive native glTF export/import');
      let clip = call(model, 'play_animation', 'rotate', { loop: true });
      call(clip, 'pause'); assert.equal(clip.getProperty('playing'), false);
      call(clip, 'resume'); assert.equal(clip.getProperty('playing'), true);
      clip.setProperty('speed', 2); assert.equal(clip.getProperty('speed'), 2);
      for (let i = 0; i < 30; i++) clip = call(model, 'play_animation', 'rotate', { loop: true });
      assert.ok(record.activeClip.group.animatables.every((item: any) => item.weight === 1), 'replaying the same clip remains fully weighted');
      call(model, 'play_animation', 'held_pose', { loop: true, crossfade: 0.2 });
      call(model, 'play_animation', 'rotate', { loop: true, crossfade: 0.2 });
      driver.updateAnimations(scene, 1);
      assert.equal(record.activeClip.disposed, false, 'interrupting a crossfade cannot dispose the new active clip');
      assert.ok(record.activeClip.group.animatables.every((item: any) => item.weight === 1));
      assert.ok(record.resources.cleanups.size <= 3, 'replaying clips must not accumulate observers');
      call(model, 'dispose');
      assert.equal(scene.backend.meshes.length, 0);
      assert.equal(scene.backend.animationGroups.length, 0);
    } finally {
      call(sceneHandle, 'dispose');
      engine.dispose();
      game.desktop = null;
    }
  }
  // An independent skinned triangle checks imported ownership beyond authored rigs.
  const bytes = Buffer.alloc(168);
  [0,0,0, 1,0,0, 0,1,0].forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  for (let i = 0; i < 3; i++) bytes.writeFloatLE(1, 48 + i * 16);
  [0,1,2].forEach((value, i) => bytes.writeUInt16LE(value, 96 + i * 2));
  for (let i = 0; i < 16; i++) bytes.writeFloatLE(i % 5 === 0 ? 1 : 0, 104 + i * 4);
  fs.writeFileSync(path.join(root!, 'skinned.gltf'), JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'root', children: [1,2] }, { name: 'skin', mesh: 0, skin: 0 }, { name: 'bone' }],
    skins: [{ joints: [2], skeleton: 2, inverseBindMatrices: 4 }],
    buffers: [{ uri: `data:application/octet-stream;base64,${bytes.toString('base64')}`, byteLength: bytes.length }],
    bufferViews: [{ buffer:0,byteOffset:0,byteLength:36 }, { buffer:0,byteOffset:36,byteLength:12 }, { buffer:0,byteOffset:48,byteLength:48 }, { buffer:0,byteOffset:96,byteLength:6 }, { buffer:0,byteOffset:104,byteLength:64 }],
    accessors: [{ bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0] }, { bufferView:1,componentType:5121,count:3,type:'VEC4' }, { bufferView:2,componentType:5126,count:3,type:'VEC4' }, { bufferView:3,componentType:5123,count:3,type:'SCALAR' }, { bufferView:4,componentType:5126,count:1,type:'MAT4' }],
    meshes: [{ primitives: [{ attributes: { POSITION:0,JOINTS_0:1,WEIGHTS_0:2 }, indices:3 }] }],
  }));
  const skinScene = call(gameHandle, 'create_scene', 'skeleton');
  const skinned = runtime.gltf.builtin(skinScene, 'skinned.gltf', { name: 'skinned' });
  const skinEngine = new B.NullEngine();
  const skinGame = driver.activeGame();
  const skinRecord = skinGame.scenes.get('skeleton');
  const skinDesktop = { game: skinGame, B, GUI: {}, engine: skinEngine, canvas: null, stopped: false };
  skinGame.desktop = skinDesktop;
  try {
    await driver.materializeScene(skinDesktop, skinRecord);
    assert.equal(skinRecord.backend.skeletons.length, 1, 'native glTF import preserves skeletons');
    assert.ok(skinRecord.backend.meshes.some((mesh: any) => mesh.skeleton));
    call(skinned, 'dispose');
    assert.equal(skinRecord.backend.skeletons.length, 0, 'disposing a model also owns its imported skeleton');
  } finally {
    call(skinScene, 'dispose'); skinEngine.dispose(); skinGame.desktop = null;
  }
  const scene = call(gameHandle, 'create_scene', 'interpolation');
  const GUI = await import('@babylonjs/gui');
  const button = call(scene, 'gui_button', 'label', { text: 'Initial' });
  const record = driver.activeGame().activeScene.controls.find((item: any) => item.name === 'label');
  record.backend = GUI.Button.CreateSimpleButton('label', 'Initial');
  button.setProperty('text', 'Updated menu');
  driver.syncScene(driver.activeGame().activeScene, B, GUI);
  assert.equal(record.backend.textBlock.text, 'Updated menu', 'button labels update with their native text property');
  const box = call(scene, 'box', 'moving');
  call(scene, 'animate', box, 'position', runtime.vec3.builtin(10, 2, 4), { duration: 2, easing: 'smoothstep' });
  driver.updateAnimations(driver.activeGame().activeScene, 1);
  assert.equal(box.getProperty('position').getProperty('x'), 5);
  call(gameHandle, 'dispose');
}

(async () => {
  await parity();
  await gltfRoundTrip();
  console.log('✓ native glTF/GLB round trips, materials, hierarchy, clips, swept collision, interpolation, and ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
