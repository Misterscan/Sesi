// Run any example Sesi file from the examples/ directory automatically using the CLI. This is useful for testing and debugging.
// Usage: node example.js 01_hello.sesi
// This will run the 01_hello.sesi example file. You can replace it with any other .sesi file in the examples/ directory.

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const exampleFile = args[0] || '01_hello.sesi';
const filePath = path.join(__dirname, 'examples', exampleFile);

console.log(`Running Sesi example: ${exampleFile}...`);

try {
  const output = execSync(`node bin/sesi.js ${filePath}`, { encoding: 'utf8' });
  console.log('--- Output ---');
  console.log(output);
} catch (error) {
  console.error('Execution failed:');
  console.error(error.stderr || error.message);
  process.exit(1);
}
process.exit(0);