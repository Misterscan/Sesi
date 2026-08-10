import assert from 'node:assert/strict';
import { runDryRunSemanticChecks } from '../src/dry-checker';

const source = `
fn demo(used, ignored) {
  let local = used
  print missing_name
}

demo(1, 2)
`;

const diagnostics = runDryRunSemanticChecks(source);

assert.deepEqual(
  diagnostics.map(({ severity, code, line }) => ({ severity, code, line })),
  [
    { severity: 'error', code: 'undefined-symbol', line: 4 },
    { severity: 'warning', code: 'unused-symbol', line: 2 },
    { severity: 'warning', code: 'unused-symbol', line: 3 },
  ]
);

const cleanSource = `
fn double(value) {
  return value * 2
}
print double(4)
`;

assert.deepEqual(
  runDryRunSemanticChecks(cleanSource),
  []
);

const makeSource = `
make Person {
  let kind = "person"
  fn greet(self) {
    return "hello"
  }
}
let person = Person()
print person.greet()
`;

assert.deepEqual(
  runDryRunSemanticChecks(makeSource),
  []
);

const declarationFormsSource = `
// allow "missing/single-line-module" in with Missing
/*
allow "missing/block-module" in with {Thing}
print missing_from_comment
*/

allow "petLogic" in with {
  feed_pet,
  wash_pet
}

fn validate(value) {
  return value != null
}

define_tool("url_validator", validate, "Validates a value")
prompt request {"check this"}
let valid = tool_call(url_validator)(request)
if valid {
  print feed_pet wash_pet
}
`;

assert.deepEqual(
  runDryRunSemanticChecks(declarationFormsSource),
  []
);

console.log('Dry-run semantic checker tests passed.');
