import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    function get(targetUrl: string) {
      const options = {
        headers: {
          'User-Agent': 'Sesi-PackageManager/1.6.0'
        }
      };
      
      https.get(targetUrl, options, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          if (response.headers.location) {
            get(response.headers.location);
          } else {
            reject(new Error(`Redirect location header missing from ${targetUrl}`));
          }
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Server returned HTTP ${response.statusCode} for ${targetUrl}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }
    
    get(url);
  });
}

function extractZip(zipPath: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    // Windows: Use PowerShell Expand-Archive (built-in) or tar
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'ignore' });
    } catch (e) {
      // Fallback to tar
      execSync(`tar -xf "${zipPath}" -C "${destDir}"`, { stdio: 'ignore' });
    }
  } else {
    // macOS / Linux: Use unzip
    try {
      execSync(`unzip -q "${zipPath}" -d "${destDir}"`, { stdio: 'ignore' });
    } catch (e) {
      // Fallback to tar
      execSync(`tar -xf "${zipPath}" -C "${destDir}"`, { stdio: 'ignore' });
    }
  }
}

function parseSpec(spec: string) {
  let clean = spec;
  if (clean.startsWith('https://github.com/')) {
    clean = clean.substring('https://github.com/'.length);
  } else if (clean.startsWith('github:')) {
    clean = clean.substring('github:'.length);
  }
  
  const parts = clean.split('#');
  const pathParts = parts[0].split('/');
  if (pathParts.length !== 2) {
    throw new Error(`Invalid package specification: ${spec}. Expected format: owner/repo#ref or github:owner/repo#ref`);
  }
  
  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.endsWith('.git')) {
    repo = repo.substring(0, repo.length - 4);
  }
  const ref = parts[1] || 'main';
  
  return { owner, repo, ref };
}

async function installPackage(owner: string, repo: string, ref: string, spec: string, packageName: string) {
  const modulesDir = path.join(process.cwd(), 'sesi_modules');
  if (!fs.existsSync(modulesDir)) {
    fs.mkdirSync(modulesDir, { recursive: true });
  }
  
  const tempDir = path.join(modulesDir, `.temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const zipPath = path.join(tempDir, 'archive.zip');
  const url = `https://github.com/${owner}/${repo}/zipball/${ref}`;
  
  try {
    await downloadFile(url, zipPath);
    extractZip(zipPath, tempDir);
    
    // Find the single extracted folder inside tempDir (excluding the zip file itself)
    const files = fs.readdirSync(tempDir).filter((f: string) => f !== 'archive.zip' && f !== '__MACOSX');
    if (files.length === 0) {
      throw new Error('Extracted archive is empty.');
    }
    
    const extractedFolder = path.join(tempDir, files[0]);
    const targetDir = path.join(modulesDir, packageName);
    
    // If targetDir already exists, clear it first
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    // Move directory contents to targetDir
    fs.renameSync(extractedFolder, targetDir);
    console.log(`✓ Installed ${packageName} to sesi_modules/${packageName}`);
  } catch (err: any) {
    console.error(`Failed to install ${packageName}:`, err.message);
    throw err;
  } finally {
    // Clean up tempDir
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  }
}

export async function runInstall(spec?: string) {
  const manifestPath = path.join(process.cwd(), 'sesi.json');
  
  if (spec) {
    console.log(`Installing package: ${spec}...`);
    const { owner, repo, ref } = parseSpec(spec);
    const packageName = repo; // use repo name as the folder name
    
    await installPackage(owner, repo, ref, spec, packageName);
    
    // Update sesi.json
    let manifest: any = { name: path.basename(process.cwd()), version: '1.0.0', dependencies: {} };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) {
        // ignore
      }
    }
    if (!manifest.dependencies) manifest.dependencies = {};
    manifest.dependencies[packageName] = spec;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Added ${packageName} to sesi.json`);
  } else {
    // Install all from sesi.json
    if (!fs.existsSync(manifestPath)) {
      console.log('No dependencies found. Create a sesi.json file or run `sesi install <package>`');
      return;
    }
    let manifest: any;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e: any) {
      console.error('Error reading sesi.json:', e.message);
      return;
    }
    
    const deps = manifest.dependencies || {};
    const depNames = Object.keys(deps);
    if (depNames.length === 0) {
      console.log('No dependencies listed in sesi.json');
      return;
    }
    
    console.log(`Installing ${depNames.length} dependencies...`);
    for (const name of depNames) {
      const depSpec = deps[name];
      console.log(`Installing ${name} (${depSpec})...`);
      const { owner, repo, ref } = parseSpec(depSpec);
      await installPackage(owner, repo, ref, depSpec, name);
    }
  }
}
