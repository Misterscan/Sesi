/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as B from '@babylonjs/core';
import { createNativeObject, bindNativeMethod } from '../src/native-object';

const loaded = require('../packages/sesi-game');
const { driverFor } = require('../packages/sesi-game/runtime/internals.cjs');

const call = (handle: any, name: string, ...args: any[]) => handle.getProperty(name).builtin(...args);

async function main() {
  const runtime = loaded.createRuntime({
    createNativeObject, bindMethod: bindNativeMethod,
    projectRoot: process.cwd(), allowedRoots: [process.cwd()],
    error: (type: string, message: string) => new Error(`${type}: ${message}`),
    invokeCallback: async (fn: any, args: any[]) => fn.builtin(...args),
  });
  runtime.test = driverFor(runtime);
  const engine = new B.NullEngine({ renderWidth: 640, renderHeight: 360, deterministicLockstep: true, lockstepMaxSteps: 5 });
  const gameHandle = runtime.create.builtin();
  const sceneHandle = call(gameHandle, 'create_scene', 'main');
  const falling = call(sceneHandle, 'box', 'falling', { position: runtime.vec3.builtin(0, 3, 0) });
  const sensor = call(sceneHandle, 'box', 'sensor', { width: 4, height: 1, depth: 4 });
  call(sceneHandle, 'orbit_camera', 'camera', { radius: 10 });
  call(sceneHandle, 'enable_physics');
  call(sceneHandle, 'add_body', falling, { type: 'dynamic' });
  call(sceneHandle, 'add_body', sensor, { type: 'trigger', mass: 0 });
  let overlaps = 0;
  call(sensor, 'on_collision', bindNativeMethod('overlap', ['other'], other => {
    assert.equal(other, falling);
    overlaps++;
    return null;
  }));
  const game = runtime.test.activeGame();
  const scene = game.activeScene;
  const desktop = { game, B, GUI: {}, canvas: null, engine, stop: () => engine.dispose() };
  game.desktop = desktop;
  try {
    await runtime.test.materializeScene(desktop, scene);
    const fallingRecord = scene.objects.get('falling');
    const sensorRecord = scene.objects.get('sensor');
    assert.equal(sensorRecord.body.backend.shape.isTrigger, true);
    for (let i = 0; i < 10; i++) await runtime.test.fixedTick(game, 1 / 60);
    assert.ok(call(falling, 'velocity').getProperty('y') < -1);
    assert.equal(call(falling, 'velocity').getProperty('y'), fallingRecord.body.backend.body.getLinearVelocity().y);
    call(falling, 'apply_impulse', runtime.vec3.builtin(2, 0, 0));
    assert.ok(call(falling, 'velocity').getProperty('x') > 1.9);
    // Remove horizontal movement so the box falls through the sensor's center.
    call(falling, 'set_velocity', runtime.vec3.builtin(0, call(falling, 'velocity').getProperty('y'), 0));
    for (let i = 0; i < 65; i++) await runtime.test.fixedTick(game, 1 / 60);
    assert.equal(overlaps, 1, 'entering a trigger must dispatch one overlap callback');
    assert.ok(fallingRecord.backend.position.y < -1, 'a trigger must not stop the falling body');

    const late = call(sceneHandle, 'pbr_material', 'late', { metallic: 0.8 });
    falling.setProperty('material', late);
    runtime.test.syncScene(scene, B, {});
    assert.ok(scene.materials.get('late').backend instanceof B.PBRMaterial);
    assert.equal(fallingRecord.backend.material, scene.materials.get('late').backend);
    late.setProperty('roughness', 0.25);
    runtime.test.syncScene(scene, B, {});
    assert.equal(fallingRecord.backend.material.roughness, 0.25);

    const camera = scene.objects.get('camera');
    const cameraHandle = call(sceneHandle, 'get', 'camera');
    const interactiveAlpha = camera.backend.alpha + 0.5;
    const interactiveRadius = camera.backend.radius + 2;
    camera.backend.alpha = interactiveAlpha;
    camera.backend.radius = interactiveRadius;
    runtime.test.syncScene(scene, B, {});
    assert.equal(camera.backend.alpha, interactiveAlpha);
    assert.equal(cameraHandle.getProperty('alpha'), interactiveAlpha);
    assert.equal(cameraHandle.getProperty('radius'), interactiveRadius);
    cameraHandle.setProperty('alpha', 0.3);
    cameraHandle.setProperty('radius', 16);
    runtime.test.syncScene(scene, B, {});
    assert.equal(camera.backend.alpha, 0.3);
    assert.equal(camera.backend.radius, 16);

    let presses = 0;
    call(gameHandle.getProperty('input'), 'on', 'KeyA', bindNativeMethod('press', ['action'], () => { presses++; return null; }));
    game.inputState.pressed.add('KeyA');
    await runtime.test.fixedTick(game, 1 / 60);
    await runtime.test.fixedTick(game, 1 / 60);
    await runtime.test.dispatchInput(game);
    assert.equal(presses, 1, 'catch-up steps must not duplicate an input event');
    game.inputState.pressed.clear();
    await runtime.test.dispatchInput(game);
    assert.equal(presses, 1);
    game.inputState.pressed.add('KeyA');
    await runtime.test.dispatchInput(game);
    assert.equal(presses, 2, 'a frame without a physics step must still dispatch input');

    const cachedVelocity = falling.getProperty('velocity');
    call(gameHandle, 'dispose');
    assert.equal(scene.backend.isDisposed, true);
    assert.equal(scene.objects.size, 0);
    assert.equal(scene.materials.size, 0);
    assert.throws(() => falling.getProperty('position'), /disposed/);
    assert.throws(() => cachedVelocity.builtin(), /disposed/);
  } finally {
    if (!game.disposed) call(gameHandle, 'dispose');
    engine.dispose();
  }
  console.log('✓ std/game live materials, camera input, scheduler, trigger events, velocity, and disposal');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
