#!/usr/bin/env node

// CLI executable for Sesi
require('@dotenvx/dotenvx').config();
const { runSesiFile } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Sesi Programming Language v1.0.0

Usage:
  sesi <file>          Run a Sesi program
  sesi --help          Show this help

Examples:
  sesi hello.sesi
  sesi examples/ai-code-gen.sesi
  `);
  process.exit(0);
}

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
Sesi Programming Language v1.0.0

Usage:
  sesi <file>          Run a Sesi program
  sesi --help          Show this help
  
Options:
  --version            Show version
  
Examples:
  sesi hello.sesi
  sesi examples/ai-code-gen.sesi
  `);
  process.exit(0);
}

if (args[0] === '--version') {
  console.log('Sesi v1.0.0');
  process.exit(0);
}

const filePath = args[0];

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

runSesiFile(filePath).catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
