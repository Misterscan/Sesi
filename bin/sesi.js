#!/usr/bin/env node
require('@dotenvx/dotenvx').config();
const { runSesiFile, runSesi } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const argsHeader = `
Sesi Programming Language v1.3.0

Usage:
  sesi <file> [options]  Run a Sesi program
  sesi -e "code"         Evaluate Sesi code directly
  sesi -help <query>    Ask for help from our Sesi Co-Pilot

  Options:
  --local               Disable safe mode (careful!)
  --allowed-paths <p>    Comma-separated list of allowed directories
  -encrypt <file>        Encrypt a file
  -decrypt <file>        Decrypt a file
  -p, --password <pass>  Password for encryption/decryption
  --version              Show version
  --help, -h             Show this help

Examples:
  sesi main/start.sesi
  sesi -e "print 'hello'"
  sesi -help "how do I use memory?"
`;

function parseArgs(args) {
  const options = {
    file: null,
    eval: null,
    helpQuery: null,
    helpFile: null,
    encryptFile: null,
    decryptFile: null,
    password: null,
    sesiOptions: {
      safeMode: true,
      allowedPaths: [process.cwd()]
    }
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isHelpFlag = arg === '--help' || arg === '-help' || arg === '-h';

    if (arg === '--version') {
      console.log('Sesi v1.3.0');
      process.exit(0);
    } else if (isHelpFlag && i === 0 && !options.file && !options.eval) {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options.helpQuery = args.slice(i + 1).join(' ').trim();
        break;
      } else {
        console.log(argsHeader);
        process.exit(0);
      }
    } else if (isHelpFlag && options.file) {
      options.helpFile = options.file;
      options.helpQuery = args[i + 1] && !args[i + 1].startsWith('-')
        ? args.slice(i + 1).join(' ').trim()
        : 'Help me understand this file.';
      break;
    } else if (arg === '-e' || arg === '--eval') {
      options.eval = args[++i];
    } else if (arg === '-encrypt' || arg === '--encrypt') {
      options.encryptFile = args[++i];
    } else if (arg === '-decrypt' || arg === '--decrypt') {
      options.decryptFile = args[++i];
    } else if (arg === '-p' || arg === '--password') {
      options.password = args[++i];
    } else if (arg === '--local') {
      options.sesiOptions.safeMode = false;
      options.sesiOptions.allowLocalFs = true;
    } else if (arg === '--allowed-paths') {
      const paths = args[++i].split(',');
      options.sesiOptions.allowedPaths.push(...paths.map(p => path.resolve(p)));
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

const parsed = parseArgs(args);

async function main() {
  if (!parsed.file && !parsed.eval && !parsed.helpQuery && !parsed.encryptFile && !parsed.decryptFile) {
    console.log(argsHeader);
    process.exit(0);
  }

  if (parsed.encryptFile || parsed.decryptFile) {
    if (!parsed.password) {
      console.error('Error: Password is required for encryption/decryption. Use -p <password>.');
      process.exit(1);
    }
    const crypto = require('crypto');
    const targetFile = parsed.encryptFile || parsed.decryptFile;
    const isEncrypt = !!parsed.encryptFile;
    
    if (!fs.existsSync(targetFile)) {
      console.error(`Error: File not found: ${targetFile}`);
      process.exit(1);
    }
    
    const content = fs.readFileSync(targetFile, 'utf-8');
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.createHash('sha256').update(String(parsed.password)).digest();
      
      if (isEncrypt) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(content, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const finalOutput = iv.toString('hex') + ':' + encrypted;
        fs.writeFileSync(targetFile, finalOutput, 'utf-8');
        console.log(`Successfully encrypted ${targetFile}`);
      } else {
        const parts = content.split(':');
        if (parts.length !== 2) throw new Error('Invalid encrypted format');
        const iv = Buffer.from(parts[0], 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(parts[1], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        fs.writeFileSync(targetFile, decrypted, 'utf-8');
        console.log(`Successfully decrypted ${targetFile}`);
      }
    } catch (e) {
      console.error(`Error during ${isEncrypt ? 'encryption' : 'decryption'}:`, e.message);
      process.exit(1);
    }
    return;
  }

  if (parsed.helpQuery) {
    fs.writeFileSync('query.txt', parsed.helpQuery, 'utf-8');
    if (parsed.helpFile) {
      const resolvedFile = path.resolve(parsed.helpFile);
      const fileContext = fs.readFileSync(resolvedFile, 'utf-8');
      fs.writeFileSync('help_context.txt', `File: ${resolvedFile}\n\n${fileContext}`, 'utf-8');
    } else if (fs.existsSync('help_context.txt')) {
      fs.unlinkSync('help_context.txt');
    }
    const copilotPath = path.join(__dirname, '../main/sesi_db_chatbot.sesi');
    await runSesiFile(copilotPath).catch((error) => {
      console.error('Fatal error in Sesi Co-Pilot:', error.message);
      process.exit(1);
    });
  } else if (parsed.eval) {
    await runSesi(parsed.eval, process.cwd(), parsed.sesiOptions).catch((error) => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
  } else if (parsed.file === '-') {
    let input = '';
    process.stdin.on('data', data => { input += data; });
    process.stdin.on('end', async () => {
      await runSesi(input, process.cwd(), parsed.sesiOptions).catch((error) => {
        console.error('Fatal error:', error.message);
        process.exit(1);
      });
    });
  } else if (parsed.file) {
    if (!fs.existsSync(parsed.file)) {
      console.error(`Error: File not found: ${parsed.file}`);
      process.exit(1);
    }
    await runSesiFile(parsed.file, parsed.sesiOptions).catch((error) => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
  }
}

main();