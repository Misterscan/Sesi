import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import { aiRuntime } from '../src/ai-runtime';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(source: string, interpreter: Interpreter): Promise<void> {
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  if (parser.errors.length > 0) throw new Error(parser.errors.join('\n'));
  await interpreter.interpret(program);
}

function ppm(red: number, green: number, blue: number): string {
  const pixels = new Array(16 * 16).fill(`${red} ${green} ${blue}`).join(' ');
  return `P3\n16 16\n255\n${pixels}\n`;
}

async function main(): Promise<void> {
  console.log('=== Regex / GIF / Video / FFmpeg Builtin Tests ===\n');

  const originalCallVideo = aiRuntime.callVideo.bind(aiRuntime);
  const aiRequests: any[] = [];
  (aiRuntime as any).callVideo = async (request: any) => {
    aiRequests.push(request);
    return 'mock-video-base64';
  };
  try {
    const aiSource = `let generated = video("veo-3.1-generate-preview") {ratio: "16:9", duration: 8} {"A cinematic ocean shot"}`;
    const interpreter = new Interpreter();
    await run(aiSource, interpreter);
    assert((interpreter as any).currentEnv.get('generated') === 'mock-video-base64', 'AI video form should return generated Base64 data');

    const parser = new Parser(new Lexer(aiSource).scanTokens());
    const compiler = new Compiler();
    const chunk = compiler.compileProgram(parser.parse());
    assert(parser.errors.length === 0 && compiler.errors.length === 0, 'AI video form should compile');
    const vm = new VM();
    await vm.run(chunk);
    assert((vm as any).globals.get('generated') === 'mock-video-base64', 'VM should execute AI video generation');
    assert(aiRequests.length === 2 && aiRequests[0].duration === 8, 'AI video config should reach the runtime');
    console.log('✓ AI video generation syntax works in the interpreter and VM');
  } finally {
    (aiRuntime as any).callVideo = originalCallVideo;
  }

  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  if (probe.error || probe.status !== 0) {
    console.log('FFmpeg is unavailable; media rendering smoke tests skipped.');
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-media-test-'));
  const firstFrame = path.join(tempDir, 'frame-1.ppm');
  const secondFrame = path.join(tempDir, 'frame-2.ppm');
  const gifPath = path.join(tempDir, 'preview.gif');
  const videoPath = path.join(tempDir, 'preview.mp4');

  try {
    fs.writeFileSync(firstFrame, ppm(255, 0, 0), 'utf-8');
    fs.writeFileSync(secondFrame, ppm(0, 0, 255), 'utf-8');

    const interpreter = new Interpreter(tempDir, {
      safeMode: false,
      allowLocalFs: true,
      allowedPaths: [tempDir],
    });
    await run(`
      let ffmpeg_info = ffmpeg(["-version"])
      let gif_output = gif([
        ${JSON.stringify(firstFrame)},
        ${JSON.stringify(secondFrame)}
      ], ${JSON.stringify(gifPath)}, {"fps": 4, "width": 16})
      let video_output = video([
        ${JSON.stringify(firstFrame)},
        ${JSON.stringify(secondFrame)}
      ], ${JSON.stringify(videoPath)}, {"fps": 4, "width": 16, "height": 16, "preset": "ultrafast"})
    `, interpreter);

    const env = (interpreter as any).currentEnv;
    assert(env.get('ffmpeg_info').ok === true, 'ffmpeg() should report a successful process');
    assert(env.get('gif_output') === gifPath, 'gif() should return its output path');
    assert(env.get('video_output') === videoPath, 'video() should return its output path');
    assert(fs.existsSync(gifPath) && fs.statSync(gifPath).size > 0, 'gif() should write an animated GIF');
    assert(fs.readFileSync(gifPath).subarray(0, 3).toString('ascii') === 'GIF', 'gif() output should have a GIF header');
    assert(fs.existsSync(videoPath) && fs.statSync(videoPath).size > 0, 'video() should write a video file');
    console.log('✓ media builtins execute and write valid outputs');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
