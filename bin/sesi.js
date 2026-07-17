#!/usr/bin/env node
require('@dotenvx/dotenvx').config();
delete process.env.PKG_EXECPATH;

if (typeof globalThis.File === 'undefined') {
  const Blob = globalThis.Blob || require('buffer').Blob;
  globalThis.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || (options.lastModifiedDate ? options.lastModifiedDate.getTime() : Date.now());
    }
  };
}

const { runSesiFile, runSesi } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const argsHeader = `
Sesi Programming Language v1.6.4

Usage:
  sesi <file> [options] <args>  Run a Sesi program
  sesi -l                Run a Sesi program with local file access
  sesi -e "code"         Evaluate Sesi code directly
  sesi -h <query>        Ask for help from our Sesi Co-Pilot
  sesi -s                Launch Sesi Studio IDE
  sesi --repl            Start interactive Sesi REPL
  sesi -v                Show version
  sesi -enc <file>       Encrypt a file
  sesi -dec <file>       Decrypt a file
  sesi -r <file>         Show the raw parser output
  sesi -c <file>         Check syntax of a file
  sesi --ast <file>      Show the AST of a file
  sesi --tokens <file>   Show the tokens of a file
  sesi -t <file>         Run via legacy tree-walking interpreter
  sesi -bd <file>        Print disassembled bytecode
  sesi install           Install all dependencies listed in sesi.json
  sesi install <pkg>     Install a third-party package (e.g. github:owner/repo)

  Options:
  -v --version           Show version
  --repl                 Start interactive Sesi REPL
  -l, --local            Disable safe mode (careful!)
  -a, --allowed-paths    Comma-separated list of allowed directories
  -e, --eval             Evaluate Sesi code directly
  -enc, --encrypt        Encrypt a file
  -dec, --decrypt        Decrypt a file
  -p, --password         Password for encryption/decryption
  -v, --version          Show version
  -h, --help             Show this help
  -r, --raw              Show the raw parser output
  --cli                  Run script in standard CLI mode without the TUI dashboard
  -s, --studio           Launch Sesi Studio IDE
  -c, --check, --dry     Perform a dry-run syntax check without executing
  --ast                  Show the AST
  --tokens               Show the tokens
  -t, --tree-walker      Run via legacy tree-walking interpreter fallback
  -bd, --byte-dump       Print disassembled bytecode and exit
  -i, install            Install all dependencies listed in sesi.json

`;

function parseArgs(args) {
  if (args[0] === 'install' || args[0] === 'i') {
    return {
      install: true,
      installPackage: args[1],
      sesiOptions: {
        safeMode: false,
        allowedPaths: [process.cwd()]
      }
    };
  }

  const options = {
    file: null,
    eval: null,
    helpQuery: null,
    helpFile: null,
    encryptFile: null,
    decryptFile: null,
    password: null,
    repl: false,
    studio: false,
    sesiOptions: {
      safeMode: process.env.SESI_SAFE_MODE !== 'false',
      allowedPaths: [process.cwd()],
      raw: false,
      cli: false,
      args: []
    }
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isHelpFlag = arg === '--help' || arg === '-help' || arg === '-h';

    if (arg === '-v' || arg === '--version') {
      console.log('Sesi v1.6.4');
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
    } else if ((!arg.startsWith('-') || arg === '-') && !options.file && !options.eval && !options.encryptFile && !options.decryptFile) {
      options.file = arg;
    } else if (arg == '-r' || arg == '--raw') {
      options.sesiOptions.raw = true;
    } else if (arg == '--cli') {
      options.sesiOptions.cli = true;
    } else if (arg == '--ast') {
      options.sesiOptions.ast = true;
    } else if (arg == '--tokens') {
      options.sesiOptions.tokens = true;
    } else if (arg === '-c' || arg === '--check' || arg === '--dry') {
      options.sesiOptions.dry = true;
    } else if (arg === '-bd' || arg === '--byte-dump') {
      options.sesiOptions.bytecodeDump = true;
    } else if (arg === '-t' || arg === '--tree-walker') {
      options.sesiOptions.treeWalker = true;
    } else if (arg === '--repl') {
      options.repl = true;
    } else if (arg === '--studio' || arg === '-s') {
      options.studio = true;
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

async function startRepl() {
  const blessed = require('blessed');
  const { Lexer, Parser, Interpreter } = require('../dist/index.js');
  
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Sesi',
    autoPadding: true,
    resizeTimeout: 100
  });

  const outputBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%-3',
    border: { type: 'line' },
    style: {
      fg: 'white',
      border: { fg: 'cyan' }
    },
    label: ' Sesi Interactive Terminal (v1.6.4) ',
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    tags: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'cyan' },
      style: { inverse: true }
    }
  });

  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: 'green',
      border: { fg: 'cyan' }
    },
    label: ' sesi> ',
    inputOnFocus: true,
    tags: true
  });

  screen.key(['escape', 'C-c'], () => {
    return process.exit(0);
  });

  screen.key(['pageup'], () => {
    outputBox.scroll(-10);
    screen.render();
  });

  screen.key(['pagedown'], () => {
    outputBox.scroll(10);
    screen.render();
  });

  screen.on('resize', () => {
    screen.render();
  });

  const interpreter = new Interpreter(process.cwd());

  // Intercept console.log to output to the blessed log box instead
  const originalLog = console.log;
  console.log = (...args) => {
    outputBox.log(args.join(' '));
    screen.render();
  };

  globalThis.sesiTerminalClearHandler = () => {
    outputBox.setContent('');
    screen.render();
  };

  globalThis.sesiTerminalCursorHandler = (x, y) => {
    // For TUI log box, cursor movement is ignored safely
  };

  inputBox.on('submit', async (text) => {
    const trimmed = text.trim();
    if (trimmed === '.exit') {
      return process.exit(0);
    }
    
    inputBox.clearValue();
    inputBox.focus();
    
    if (trimmed) {
      outputBox.log(`{cyan-fg}sesi>{/cyan-fg} ${trimmed}`);
      try {
        const lexer = new Lexer(trimmed);
        const tokens = lexer.scanTokens();
        const parser = new Parser(tokens);

        const program = parser.parse();

        for (const statement of program.statements) {
          if (statement.type === 'ExpressionStatement') {
            const val = await interpreter.evaluateExpression(statement.expression);
            if (val !== null && val !== undefined) {
              outputBox.log(`{green-fg}=> ${JSON.stringify(val)}{/green-fg}`);
            }
          } else {
            await interpreter.interpret({ type: 'Program', statements: [statement] });
          }
        }
      } catch (error) {
        outputBox.log(`{red-fg}Error: ${error.message}{/red-fg}`);
      }
    }
    screen.render();
  });

  outputBox.log('{bold}Welcome to Sesi!{/bold} Type code and press Enter.');
  outputBox.log('Type {cyan-fg}.exit{/cyan-fg} or press {cyan-fg}ESC{/cyan-fg} to quit.');
  
  inputBox.focus();
  screen.render();
}

const parsed = parseArgs(args);

async function main() {
  if (parsed.install) {
    const { runInstall } = require('../dist/index.js');
    await runInstall(parsed.installPackage).catch((error) => {
      console.error('Package installation failed:', error.message);
      process.exit(1);
    });
    return;
  }

  if (parsed.studio) {
    const studioServerPath = path.join(__dirname, '..', 'sesi-studio', 'studio.sesi');
    if (fs.existsSync(studioServerPath)) {
      console.log('Launching Sesi Studio...');
      const studioOptions = {
        ...parsed.sesiOptions,
        safeMode: false,
        allowLocalFs: true,
        treeWalker: true
      };
      await runSesiFile(studioServerPath, studioOptions).catch((error) => {
        console.error('Fatal error in Sesi Studio:', error.message);
        process.exit(1);
      });
    } else {
      console.error('Error: Sesi Studio backend not found at ' + studioServerPath);
      process.exit(1);
    }
    return;
  }

  if (parsed.repl || (!parsed.file && !parsed.eval && !parsed.helpQuery && !parsed.encryptFile && !parsed.decryptFile)) {
    if (parsed.repl || process.stdin.isTTY) {
      await startRepl();
      return;
    } else {
      console.log(argsHeader);
      process.exit(0);
    }
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
    parsed.sesiOptions.args = [parsed.helpQuery];
    if (parsed.helpFile) {
      parsed.sesiOptions.args.push(path.resolve(parsed.helpFile));
    }
    const copilotPath = path.join(__dirname, '../chatbot/sesi_db_chatbot.sesi');
    await runSesiFile(copilotPath, parsed.sesiOptions).catch((error) => {
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
    if (parsed.sesiOptions.cli || parsed.sesiOptions.dry) {
      // Execute without blessed TUI (raw terminal CLI mode)
      await runSesiFile(parsed.file, parsed.sesiOptions).catch((error) => {
        console.error('Fatal error:', error.message);
        process.exit(1);
      });
      return;
    }
    
    // START CUSTOM TERMINAL INTERFACE FOR SCRIPT EXECUTION
    const blessed = require('blessed');
    const screen = blessed.screen({
      smartCSR: true,
      title: `Sesi Execution: ${parsed.file}`,
      autoPadding: true,
      resizeTimeout: 100
    });

    const outputBox = blessed.log({
      parent: screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      border: { type: 'line' },
      style: { fg: 'white', border: { fg: 'cyan' } },
      label: ` ⚡ Sesi Script Terminal: ${parsed.file} `,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      tags: true,
      scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } }
    });

    const statusBox = blessed.box({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: { fg: 'green', border: { fg: 'cyan' } },
      content: ' Status: Running... | Press ESC to exit ',
      tags: true
    });

    const inputBox = blessed.textbox({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: { fg: 'yellow', border: { fg: 'cyan' } },
      hidden: true,
      inputOnFocus: true,
      tags: true
    });

    screen.key(['escape', 'C-c', 'q'], () => process.exit(0));

    screen.key(['pageup'], () => {
      outputBox.scroll(-10);
      screen.render();
    });

    screen.key(['pagedown'], () => {
      outputBox.scroll(10);
      screen.render();
    });

    screen.on('resize', () => {
      screen.render();
    });

    // Handle input() requests from the Sesi script natively
    globalThis.sesiInputHandler = (promptText) => {
      return new Promise((resolve) => {
        statusBox.hide();
        inputBox.setLabel(` ${promptText} `);
        inputBox.show();
        inputBox.focus();
        screen.render();
        
        inputBox.once('submit', (text) => {
          const val = text.trim();
          inputBox.clearValue();
          inputBox.hide();
          statusBox.show();
          screen.render();
          outputBox.log(`{cyan-fg}${promptText}{/cyan-fg} ${val}`);
          resolve(val);
        });
      });
    };

    // Intercept Sesi's print output natively
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
      outputBox.log(args.join(' '));
      screen.render();
    };
    console.error = (...args) => {
      outputBox.log(`{red-fg}${args.join(' ')}{/red-fg}`);
      screen.render();
    };

    globalThis.sesiTerminalClearHandler = () => {
      outputBox.setContent('');
      screen.render();
    };

    globalThis.sesiTerminalCursorHandler = (x, y) => {
      // For TUI log box, cursor movement is ignored safely
    };

    screen.render();

    await runSesiFile(parsed.file, parsed.sesiOptions).then(() => {
      statusBox.setContent(' Status: Script Completed Successfully | Press ESC to exit ');
      statusBox.style.fg = 'blue';
      screen.render();
    }).catch((error) => {
      statusBox.setContent(' Status: Script Failed | Press ESC to exit ');
      statusBox.style.fg = 'red';
      console.error('Fatal error:', error.message);
      screen.render();
    });
    // END CUSTOM TERMINAL INTERFACE
  } else if (parsed.raw) {
    const content = fs.readFileSync(parsed.file, 'utf-8');
    await runSesi(content, process.cwd(), { ...parsed.sesiOptions, raw: true }).catch((error) => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
  }
}

main();