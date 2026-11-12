import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const releasesDir = path.join(repoRoot, 'releases');
const packagedNodeRange = 'node22';
const pkgVersion = '6.21.0';
const pkgFetchVersion = '3.6.4';

function stageNativeRuntime(targets) {
  const sharp = JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules/sharp/package.json'), 'utf8'));
  const esbuild = JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules/esbuild/package.json'), 'utf8'));
  for (const target of targets.split(',')) {
    const [, platform, arch] = target.split('-');
    const runtime = `${platform === 'macos' ? 'darwin' : platform === 'win' ? 'win32' : platform}-${arch}`;
    for (const name of [`@img/sharp-${runtime}`, `@img/sharp-libvips-${runtime}`, `@esbuild/${runtime}`]) {
      const version = sharp.optionalDependencies?.[name] ?? esbuild.optionalDependencies?.[name];
      if (!version) continue; // Windows Sharp packages carry their own libvips.
      const destination = path.join(repoRoot, 'node_modules', name);
      const manifest = path.join(destination, 'package.json');
      if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).version === version) continue;
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-native-'));
      try {
        console.log(`Staging ${name}@${version} for ${target}`);
        const packed = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['pack', `${name}@${version}`, '--ignore-scripts', '--json', '--pack-destination', temporary],
          { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' }));
        const archive = path.join(temporary, path.basename(packed[0].filename));
        const extracted = path.join(temporary, 'extracted');
        fs.mkdirSync(extracted);
        execFileSync('tar', ['-xzf', archive, '-C', extracted, '--strip-components=1']);
        const staged = JSON.parse(fs.readFileSync(path.join(extracted, 'package.json'), 'utf8'));
        if (staged.name !== name || staged.version !== version) throw new Error(`Unexpected native package: ${name}`);
        fs.mkdirSync(destination, { recursive: true });
        fs.cpSync(extracted, destination, { recursive: true });
      } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
      }
    }
  }
}

function stageStudioRuntime() {
  const runtimeDir = path.join(releasesDir, 'studio-runtime');
  const copyItems = [
    'ai_agent.sesi',
    'README.md',
    'docs',
    'getting-started',
    'helpers',
    'sesi-studio/agent',
    'sesi-studio/build',
    'sesi-studio/extensions',
    'sesi-studio/img',
    'sesi-studio/studio.sesi',
  ];

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  for (const item of copyItems) {
    const source = path.join(repoRoot, item);
    const destination = path.join(runtimeDir, item);
    fs.cpSync(source, destination, { recursive: true });
  }
  console.log(`Staged Sesi Studio runtime: ${runtimeDir}`);
}

console.log('=== Step 1: Bundling Sesi with esbuild ===');
try {
  // require.resolve() worker paths remain relative to the bundled entry point.
  // Bundle each worker beside it so pkg can include executable worker sources.
  await build({
    absWorkingDir: repoRoot,
    entryPoints: {
      'sesi.bundled': 'bin/sesi.js',
      'decryptor-worker': 'node_modules/@dotenvx/dotenvx/src/lib/decryptors/decryptor-worker.js',
      armorWorker: 'node_modules/@dotenvx/providers/src/armorWorker.js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    alias: { 'node:sqlite': './mock-sqlite.js' },
    external: ['blessed', 'playwright', 'playwright-core', 'chromium-bidi', 'term.js',
      'pty.js', 'onnxruntime-node', 'sharp', 'esbuild', 'electron', '@electron/packager',
      './armorWorker.js', './decryptor-worker.js'],
    outdir: 'dist',
    logLevel: 'info',
  });
  
  // Prepend File polyfill to ensure it is defined at the very top of the bundled file, 
  // before any bundled module executes (like undici).
  const bundlePath = path.join(repoRoot, 'dist/sesi.bundled.js');
  if (fs.existsSync(bundlePath)) {
    const originalContent = fs.readFileSync(bundlePath, 'utf8');
    const polyfill = `if (typeof globalThis.File === 'undefined') {
  const Blob = globalThis.Blob || require('buffer').Blob;
  globalThis.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || (options.lastModifiedDate ? options.lastModifiedDate.getTime() : Date.now());
    }
  };
}\n`;
    if (originalContent.startsWith('#!')) {
      const shebangEnd = originalContent.indexOf('\n') + 1;
      const shebang = originalContent.slice(0, shebangEnd);
      const rest = originalContent.slice(shebangEnd);
      fs.writeFileSync(bundlePath, shebang + polyfill + rest, 'utf8');
    } else {
      fs.writeFileSync(bundlePath, polyfill + originalContent, 'utf8');
    }
    console.log('Prepended File polyfill to dist/sesi.bundled.js successfully.');
  }
} catch (e) {
  console.error('esbuild bundling failed:', e.message);
  process.exit(1);
}

console.log('\n=== Step 2: Packaging Sesi with pkg ===');
// pkg 6.21 matches noDictionary entries against filenames (e.g. sharp.js).
// Modern Sharp uses @img assets; Electron is project-installed; open falls
// back to the system xdg-open when its private launcher is absent.
// Determine targets based on current host platform to avoid spawn UNKNOWN fabricator failures
let targets = '';
if (process.platform === 'win32') {
  targets = `${packagedNodeRange}-win-x64`;
} else if (process.platform === 'darwin') {
  targets = `${packagedNodeRange}-macos-x64,${packagedNodeRange}-macos-arm64`;
} else {
  targets = `${packagedNodeRange}-linux-x64`;
}

console.log(`Host platform is ${process.platform}. Selected pkg targets: ${targets}`);
stageNativeRuntime(targets);

// Windows specific pre-processing to set icon on base binary to avoid corruption
if (process.platform === 'win32') {
  const cacheDir = process.env.PKG_CACHE_PATH || path.join(
    process.env.USERPROFILE || process.env.HOMEPATH || '',
    '.pkg-cache',
    'v3.6'
  );

  console.log(`Checking pkg cache directory: ${cacheDir}`);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  let fetchedFile = fs.readdirSync(cacheDir).find(
    f => f.startsWith(`fetched-v${packagedNodeRange.slice(4)}.`) && f.endsWith('-win-x64')
  );

  if (!fetchedFile) {
    console.log('Fetched Windows binary not found in cache. Pre-fetching using pkg-fetch...');
    try {
      execSync(
        `npx --yes @yao-pkg/pkg-fetch@${pkgFetchVersion} -t ${packagedNodeRange}-win-x64`,
        { stdio: 'inherit', cwd: repoRoot }
      );
      fetchedFile = fs.readdirSync(cacheDir).find(
        f => f.startsWith(`fetched-v${packagedNodeRange.slice(4)}.`) && f.endsWith('-win-x64')
      );
    } catch (e) {
      console.warn('pkg-fetch failed, pkg will try to fetch automatically:', e.message);
    }
  }

  if (fetchedFile) {
    const fetchedBin = path.join(cacheDir, fetchedFile);
    const builtBin = path.join(cacheDir, fetchedFile.replace('fetched-', 'built-'));

    console.log(`Preparing custom base binary: ${builtBin}`);
    fs.copyFileSync(fetchedBin, builtBin);

    try {
      console.log('Applying icon to custom base binary via rcedit...');
      const { rcedit } = await import('rcedit');
      await rcedit(builtBin, { icon: path.join(repoRoot, 'favicon.ico') });
      console.log('Successfully applied favicon.ico to custom base binary!');
    } catch (e) {
      console.warn('rcedit warning on base binary (non-fatal):', e.message);
    }
  } else {
    console.warn('Warning: Could not locate fetched base binary to apply icon.');
  }
}

try {
  execSync(
    `npx --yes --prefer-offline @yao-pkg/pkg@${pkgVersion} dist/sesi.bundled.js --config pkg.json --targets ${targets} --out-path releases`,
    { stdio: 'inherit', cwd: repoRoot }
  );
} catch (e) {
  console.error('pkg packaging failed:', e.message);
  process.exit(1);
}

// Perform post-processing for Windows (rename only)
if (process.platform === 'win32') {
  console.log('\n=== Step 3: Windows Post-Processing (rename) ===');
  const sourceExe1 = path.join(releasesDir, 'sesi.bundled.exe');
  const sourceExe2 = path.join(releasesDir, 'sesi.bundled-win-x64.exe');
  const targetExe = path.join(releasesDir, 'sesi.bundled-win.exe');

  let renamed = false;
  if (fs.existsSync(sourceExe1)) {
    console.log(`Renaming ${sourceExe1} -> ${targetExe}`);
    fs.copyFileSync(sourceExe1, targetExe);
    fs.unlinkSync(sourceExe1);
    renamed = true;
  } else if (fs.existsSync(sourceExe2)) {
    console.log(`Renaming ${sourceExe2} -> ${targetExe}`);
    fs.copyFileSync(sourceExe2, targetExe);
    fs.unlinkSync(sourceExe2);
    renamed = true;
  }

  if (renamed) {
    console.log('Successfully prepared target executable: sesi.bundled-win.exe');
    try {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
      const version = pkgJson.version;
      const versionedExe = path.join(releasesDir, `sesi-${version}.bundled-win.exe`);
      console.log(`Creating versioned release binary: ${versionedExe}`);
      fs.copyFileSync(targetExe, versionedExe);
    } catch (e) {
      console.error('Failed to create versioned executable:', e.message);
    }
  } else {
    console.error('Error: target executable not found for renaming.');
  }
}

console.log('\n=== Sesi Build Process Complete! ===');
stageStudioRuntime();
