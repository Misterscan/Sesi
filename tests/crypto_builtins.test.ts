import { runSesi } from '../src/index';

async function captureRun(source: string): Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: any[]) => { stdout.push(args.join(' ')); };
  console.error = (...args: any[]) => { stderr.push(args.join(' ')); };
  (process as any).exit = (code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  };

  try {
    await runSesi(source, process.cwd(), { safeMode: true });
  } catch (error: any) {
    if (/^process\.exit\(/.test(error?.message || '')) {
      throw new Error(`Sesi exited unexpectedly:\n${stderr.join('\n')}`);
    }
    throw error;
  } finally {
    console.log = originalLog;
    console.error = originalError;
    (process as any).exit = originalExit;
  }

  return stdout.join('\n');
}

async function main(): Promise<void> {
  await captureRun(`
let original = "secret: build notes"
let password = "correct horse battery staple"
let encrypted = encrypt(original, password)

if encrypted == original {
  raise_error("AssertionError", "encrypted content should differ from plain text")
}

let parts = split(encrypted, ":")
if len(parts) != 2 || len(parts[0]) != 32 {
  raise_error("AssertionError", "encrypted content should use iv:ciphertext format")
}

let decrypted = decrypt(encrypted, password)
if decrypted != original {
  raise_error("AssertionError", "decrypted content should match original")
}
`);

  console.log('✓ encrypt/decrypt builtins round trip');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
