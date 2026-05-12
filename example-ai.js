// Run any Sesi AI example file from the examples/ directory automatically using the CLI. This is useful for testing and debugging AI-related features.
// Usage: node example-ai.js 08_model_call.sesi
// This will run the 08_model_call.sesi example file. You can replace it with any other .sesi file in the examples/ directory that demonstrates AI features.

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const exampleFile = args[0] || '08_model_call.sesi';
const filePath = path.join(__dirname, 'examples', exampleFile);

console.log(`Running Sesi AI example: ${exampleFile}...`);

try {
  const output = execSync(`dotenvx run -- node bin/sesi.js ${filePath}`, { encoding: 'utf8' });
  console.log('--- Output ---');
  console.log(output);
} catch (error) {
  console.error('Execution failed:');
  console.error(error.stderr || error.message);
  process.exit(1);
}
process.exit(0);