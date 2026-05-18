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

try {
  execSync(
    `npx pkg dist/sesi.bundled.js --targets ${targets} --out-path releases`,
    { stdio: 'inherit', cwd: repoRoot }
  );
} catch (e) {
  console.error('pkg packaging failed:', e.message);
  process.exit(1);
}

// Perform post-processing for Windows (rename & rcedit icon injection)
if (process.platform === 'win32') {
  console.log('\n=== Step 3: Windows Post-Processing (rcedit) ===');
  const sourceExe = path.join(releasesDir, 'sesi.bundled-win-x64.exe');
  const targetExe = path.join(releasesDir, 'sesi.bundled-win.exe');

  if (fs.existsSync(sourceExe)) {
    console.log(`Renaming ${sourceExe} -> ${targetExe}`);
    fs.copyFileSync(sourceExe, targetExe);
  }

  if (fs.existsSync(targetExe)) {
    try {
      console.log('Applying icon to target executable via rcedit...');
      // Dynamic import/require of rcedit to handle Windows icon editing
      const { rcedit } = await import('rcedit');
      await rcedit(targetExe, { icon: path.join(repoRoot, 'favicon.ico') });
      console.log('Successfully applied favicon.ico to Sesi executable!');
    } catch (e) {
      console.warn('rcedit warning (non-fatal, building installer can still continue):', e.message);
    }
  } else {
    console.error('Error: target executable not found for rcedit processing.');
  }
}

console.log('\n=== Sesi Build Process Complete! ===');
