import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const releasesDir = path.join(repoRoot, 'releases');

console.log('=== Step 1: Bundling Sesi with esbuild ===');
try {
  execSync(
    'npx esbuild bin/sesi.js --bundle --platform=node --alias:node:sqlite=./mock-sqlite.js --outfile=dist/sesi.bundled.js',
    { stdio: 'inherit', cwd: repoRoot }
  );
  
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
// Determine targets based on current host platform to avoid spawn UNKNOWN fabricator failures
let targets = '';
if (process.platform === 'win32') {
  targets = 'node18-win-x64';
} else if (process.platform === 'darwin') {
  targets = 'node18-macos-x64,node18-macos-arm64';
} else {
  targets = 'node18-linux-x64';
}

console.log(`Host platform is ${process.platform}. Selected pkg targets: ${targets}`);

// Windows specific pre-processing to set icon on base binary to avoid corruption
if (process.platform === 'win32') {
  const cacheDir = process.env.PKG_CACHE_PATH || path.join(
    process.env.USERPROFILE || process.env.HOMEPATH || '',
    '.pkg-cache',
    'v3.4'
  );

  console.log(`Checking pkg cache directory: ${cacheDir}`);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  let fetchedFile = fs.readdirSync(cacheDir).find(f => f.startsWith('fetched-v18.') && f.endsWith('-win-x64'));

  if (!fetchedFile) {
    console.log('Fetched Windows binary not found in cache. Pre-fetching using pkg-fetch...');
    try {
      execSync('npx pkg-fetch -t node18-win-x64', { stdio: 'inherit', cwd: repoRoot });
      fetchedFile = fs.readdirSync(cacheDir).find(f => f.startsWith('fetched-v18.') && f.endsWith('-win-x64'));
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
    `npx pkg dist/sesi.bundled.js --config pkg.json --targets ${targets} --out-path releases`,
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
