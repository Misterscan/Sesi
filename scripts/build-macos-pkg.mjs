import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const releasesDir = path.join(repoRoot, 'releases');

if (process.platform !== 'darwin') {
  console.error('build:mac:pkg must be run on macOS (pkgbuild is only available there).');
  process.exit(1);
}

const binaryCandidates = [
  { arch: 'arm64', file: 'sesi.bundled-arm64' },
  { arch: 'arm64', file: 'sesi.bundled-macos-arm64' },
  { arch: 'x64', file: 'sesi.bundled-x64' },
  { arch: 'x64', file: 'sesi.bundled-macos-x64' },
  { arch: 'x64', file: 'sesi.bundled-macos' }
];

const binaries = binaryCandidates
  .map((candidate) => ({ ...candidate, absPath: path.join(releasesDir, candidate.file) }))
  .filter((candidate) => fs.existsSync(candidate.absPath))
  .filter((candidate, index, arr) => arr.findIndex((c) => c.arch === candidate.arch) === index);

if (binaries.length === 0) {
  console.error('No macOS binary found in releases/. Run npm run build:exe first.');
  process.exit(1);
}

try {
  execFileSync('which', ['pkgbuild'], { stdio: 'ignore' });
} catch {
  console.error('pkgbuild was not found. Install Xcode Command Line Tools and try again.');
  process.exit(1);
}

for (const binary of binaries) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-pkg-'));
  const installBinDir = path.join(stageRoot, 'usr', 'local', 'bin');
  const stagedBinary = path.join(installBinDir, 'sesi');
  const outputPkg = path.join(releasesDir, `sesi-${version}-macos-${binary.arch}.pkg`);

  try {
    fs.mkdirSync(installBinDir, { recursive: true });
    fs.copyFileSync(binary.absPath, stagedBinary);
    fs.chmodSync(stagedBinary, 0o755);

    execFileSync(
      'pkgbuild',
      [
        '--root',
        stageRoot,
        '--identifier',
        `com.misterscan.sesi.${binary.arch}`,
        '--version',
        version,
        '--install-location',
        '/',
        outputPkg
      ],
      { stdio: 'inherit' }
    );

    console.log(`Created ${outputPkg}`);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}
