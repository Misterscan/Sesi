/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import HavokPhysics from '@babylonjs/havok';
import {
  ArcRotateCamera,
  HavokPlugin,
  Matrix,
  MeshBuilder,
  NullEngine,
  PhysicsAggregate,
  PhysicsShapeType,
  Ray,
  Scene,
  Vector3,
  Viewport,
} from '@babylonjs/core';

async function main() {
  const engine = new NullEngine({ renderWidth: 640, renderHeight: 360, deterministicLockstep: true, lockstepMaxSteps: 5 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = false;

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.08, 18, new Vector3(0, 1, 0), scene);
  scene.activeCamera = camera;
  scene.render();
  const transform = scene.getTransformMatrix();
  const viewport = new Viewport(0, 0, 640, 360);
  const project = (value: Vector3) => Vector3.Project(value, Matrix.Identity(), transform, viewport);
  const center = project(new Vector3(0, 0.8, 0));
  assert.ok(project(new Vector3(1, 0.8, 0)).x > center.x, 'world +X should appear right');
  assert.ok(project(new Vector3(0, 0.8, 1)).y < center.y, 'world +Z should appear forward/up');

  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  const box = MeshBuilder.CreateBox('box', { size: 1 }, scene);
  box.position.set(0, 3, 0);
  box.computeWorldMatrix(true);
  const pick = scene.pickWithRay(new Ray(new Vector3(0, 3, -5), new Vector3(0, 0, 1), 20));
  assert.equal(pick?.hit, true);
  assert.equal(pick?.pickedMesh, box);

  const wasmBinary = fs.readFileSync(path.join(process.cwd(), 'node_modules', '@babylonjs', 'havok', 'lib', 'umd', 'HavokPhysics.wasm'));
  const havok = await HavokPhysics({ wasmBinary });
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  const groundBody = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  const boxBody = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 1, restitution: 0.1 }, scene);
  boxBody.body.setLinearVelocity(new Vector3(1, 0, 0));
  const velocity = boxBody.body.getLinearVelocity();
  assert.ok(velocity);
  assert.equal(Math.round(velocity!.x), 1);
  (scene.getPhysicsEngine() as any)._step(1 / 60);
  assert.ok(box.position.y < 3);

  boxBody.dispose();
  groundBody.dispose();
  scene.dispose();
  engine.dispose();
  console.log('✓ Babylon NullEngine raycast and Havok fixed-step smoke test');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
