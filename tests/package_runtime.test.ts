import * as fs from 'fs';
import * as path from 'path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const repoRoot = process.cwd();
const pkgConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'pkg.json'), 'utf8'));
const buildScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'build-binaries.mjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
const aiRuntimeSource = fs.readFileSync(path.join(repoRoot, 'src', 'ai-runtime.ts'), 'utf8');

const targets: string[] = pkgConfig.pkg?.targets ?? [];
const assets: string[] = pkgConfig.pkg?.assets ?? [];
assert(targets.length > 0, 'packaged executable targets are configured');
assert(
  targets.every((target) => /^node(?:2[2-9]|[3-9]\d)-/.test(target)),
  'packaged executables use Node 22 or newer'
);
assert(
  buildScript.includes("const packagedNodeRange = 'node22';"),
  'binary build script uses the supported packaged Node runtime'
);
assert(
  assets.includes('node_modules/onnxruntime-node/bin/**/*'),
  'packaged executables include ONNX Runtime native bindings and shared libraries'
);
assert(
  assets.includes('node_modules/@img/**/*'),
  'packaged executables include Sharp native bindings and shared libraries'
);
assert(
  buildScript.includes('@yao-pkg/pkg@'),
  'binary build uses the maintained pkg fork'
);
assert(
  aiRuntimeSource.includes("import('@huggingface/transformers')"),
  'local models use a statically discoverable Transformers.js import'
);
assert(
  !aiRuntimeSource.includes("new Function('specifier', 'return import(specifier)')"),
  'local models do not use a VM-host-dependent dynamic import'
);
assert(
  Number(String(packageJson.engines?.node ?? '').match(/\d+/)?.[0] ?? 0) >= 20,
  'npm package declares the ONNX Runtime minimum Node version'
);
assert(
  packageLock.packages?.['']?.engines?.node === packageJson.engines.node,
  'package metadata and lockfile declare the same Node version'
);

console.log('✓ packaged runtime supports local ONNX models');
