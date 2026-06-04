#!/usr/bin/env node
require('@dotenvx/dotenvx').config();
const { runSesiFile, runSesi } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const argsHeader = `
Sesi Programming Language v1.3.4

Usage:
  sesi <file> [options] <args>  Run a Sesi program
  sesi -e "code"         Evaluate Sesi code directly
  sesi -h <query>        Ask for help from our Sesi Co-Pilot
  sesi -v                Show version
  sesi -enc <file> -p <password>   Encrypt a file
  sesi -dec <file> -p <password>   Decrypt a file
  sesi -r <file>         Show the raw parser output

  Options:
  -l, --local            Disable safe mode (careful!)
  -a, --allowed-paths <p> Comma-separated list of allowed directories
  -e, --eval "<code_to_run>" Evaluate Sesi code directly
  -enc, --encrypt <file> Encrypt a file
  -dec, --decrypt <file> Decrypt a file
  -p, --password <pass>  Password for encryption/decryption
  -v, --version          Show version
  -h, --help             Show this help
  -r, --raw              Show the raw parser output

Examples:
  sesi examples/01_hello.sesi
  sesi main/test_args.sesi arg1 arg2
  sesi -e "print 'hello'"
  sesi -h "how do I use memory?"
  sesi -r examples/01_hello.sesi
  sesi -enc secret.sesi -p mypassword
  sesi -dec secret.sesi -p mypassword
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
      allowedPaths: [process.cwd()],
      raw: false,
      args: []
    }
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isHelpFlag = arg === '--help' || arg === '-help' || arg === '-h';

    if (arg === '-v' || arg === '--version') {
      console.log('Sesi v1.3.4');
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
    } else if (arg === '-enc' || arg === '--encrypt') {
      options.encryptFile = args[++i];
    } else if (arg === '-dec' || arg === '--decrypt') {
      options.decryptFile = args[++i];
    } else if (arg === '-p' || arg === '--password') {
      options.password = args[++i];
    } else if (arg === '-l' || arg === '--local') {
      options.sesiOptions.safeMode = false;
      options.sesiOptions.allowLocalFs = true;
    } else if (arg === '-a' || arg === '--allowed-paths') {
      const paths = args[++i].split(',');
      options.sesiOptions.allowedPaths.push(...paths.map(p => path.resolve(p)));
    } else if (!arg.startsWith('-') && !options.file && !options.eval && !options.encryptFile && !options.decryptFile) {
      options.file = arg;
    } else if (arg == '-r' || arg == '--raw') {
      options.sesiOptions.raw = true;
    }
  }

  if (options.file && !options.helpQuery) {
    const fileIndex = args.indexOf(options.file);
    if (fileIndex !== -1) {
      options.sesiOptions.args = args.slice(fileIndex + 1);
    }
  } else if (options.eval) {
    const evalIndex = args.findIndex(arg => arg === '-e' || arg === '--eval');
    if (evalIndex !== -1) {
      options.sesiOptions.args = args.slice(evalIndex + 2);
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
    const password = parsed.password || process.env.SESI_PASSWORD;
    if (!password) {
      console.error('Error: Password is required for encryption/decryption. Use -p <password> or set the SESI_PASSWORD environment variable.');
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
      const key = crypto.createHash('sha256').update(String(password)).digest();

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
    if (!fs.existsSync('.ai-ignore')) {
      fs.mkdirSync('.ai-ignore', { recursive: true });
    }
    fs.writeFileSync('.ai-ignore/query.txt', parsed.helpQuery, 'utf-8');
    if (parsed.helpFile) {
      const resolvedFile = path.resolve(parsed.helpFile);
      const fileContext = fs.readFileSync(resolvedFile, 'utf-8');
      fs.writeFileSync('.ai-ignore/help_context.txt', `File: ${resolvedFile}\n\n${fileContext}`, 'utf-8');
    } else if (fs.existsSync('.ai-ignore/help_context.txt')) {
      fs.unlinkSync('.ai-ignore/help_context.txt');
    }
    const copilotPath = path.join(__dirname, '../chatbot/sesi_db_chatbot.sesi');
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
  } else if (parsed.raw) {
    const content = fs.readFileSync(parsed.file, 'utf-8');
    await runSesi(content, process.cwd(), { ...parsed.sesiOptions, raw: true }).catch((error) => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
  }
}

main();