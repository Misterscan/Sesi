#!/usr/bin/env node
require('@dotenvx/dotenvx').config();
const { runSesiFile } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Sesi Programming Language v1.2.2

Usage:
  sesi <file>          Run a Sesi program
  sesi -help <query>   Ask for help from our Sesi Co-Pilot
  sesi --help <query>  
  sesi -h <query>      

  Options:
  --version            Show version

Examples:
  sesi main/start.sesi
  sesi examples/01_hello.sesi
  sesi -help "how do I parse a json string?"
  `);
  process.exit(0);
}

if (args[0] === '--help' || args[0] === '-help' || args[0] === '-h') {
  let queryText = args.slice(1).join(' ').trim();
  if (!queryText) {
    queryText = "how do I parse a json string?";
  }
  fs.writeFileSync('query.txt', queryText, 'utf-8');

  const copilotPath = path.join(__dirname, '../main/sesi_db_chatbot.sesi');
  runSesiFile(copilotPath).catch((error) => {
    console.error('Fatal error in Sesi Co-Pilot:', error.message);
    process.exit(1);
  });
} else if (args[0] === '--version') {
  console.log('Sesi v1.2.2');
  process.exit(0);
} else {
  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  runSesiFile(filePath).catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}