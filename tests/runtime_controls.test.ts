import { runSesi } from '../src/index';

async function captureRun(source: string, options: Record<string, any> = {}): Promise<{ stdout: string; stderr: string }> {
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalExit = process.exit;

  console.log = (...args: any[]) => { stdout.push(args.join(' ')); };
  console.error = (...args: any[]) => { stderr.push(args.join(' ')); };
  (process as any).exit = (code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  };

  try {
    await runSesi(source, process.cwd(), options);
    return { stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } catch (error: any) {
    if (/^process\.exit\(/.test(error?.message || '')) {
      return { stdout: stdout.join('\n'), stderr: stderr.join('\n') };
    }
    throw error;
  } finally {
    console.log = originalLog;
    console.error = originalError;
    (process as any).exit = originalExit;
  }
}

async function expectRuntimeFailure(source: string, expectedMessage: RegExp, options: Record<string, any> = {}): Promise<void> {
  const { stderr } = await captureRun(source, options);
  if (!expectedMessage.test(stderr)) {
    throw new Error(`Expected stderr to match ${expectedMessage}, got:\n${stderr}`);
  }
}

async function main(): Promise<void> {
  await captureRun(`
fn expensive() {
  return 42
}

let delayed = lazy(expensive)
if type(delayed) != "lazy" {
  raise_error("AssertionError", "lazy() should return a lazy value")
}

let first = force(delayed)
let second = force(delayed)
if first != 42 || second != 42 {
  raise_error("AssertionError", "force() should resolve lazy values")
}
`);
  console.log('✓ lazy/force delayed computation');

  await captureRun(`
fn slow() {
  sleep(50)
  return "late"
}

let value = timeout(slow, 5, "fallback")
if value != "fallback" {
  raise_error("AssertionError", "timeout() should return fallback when action is too slow")
}
`);
  console.log('✓ timeout fallback');

  await expectRuntimeFailure(`
while true {
}
`, /Execution timed out after 5ms/, { timeoutMs: 5 });
  console.log('✓ execution deadline timeout');

  const profile = await captureRun(`
fn work() {
  let total = 0
  for i = 0 to 5 {
    total = total + i
  }
  return total
}

let result = profile("work-loop", work)
if result != 10 {
  raise_error("AssertionError", "profile() should return the wrapped function result")
}
let report = profile_report()
if len(report) < 1 {
  raise_error("AssertionError", "profile_report() should include measurements")
}
`, { profile: true });

  if (!profile.stdout.includes('work-loop') || !profile.stdout.includes('Profile:')) {
    throw new Error(`Expected profile output to include the measured section, got:\n${profile.stdout}`);
  }
  console.log('✓ profiler measurements');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
