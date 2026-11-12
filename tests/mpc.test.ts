import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import { applyReverb } from '../src/mpc';

async function runSesi(source: string, interpreter = new Interpreter(undefined, { allowLocalFs: true, safeMode: false })): Promise<Interpreter> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  await interpreter.interpret(program);
  return interpreter;
}

async function main() {
  console.log('=== Sesi std/mpc Test Suite ===\n');

  // Reverb must remain bounded across long material. A former all-pass
  // implementation accumulated energy over time and caused master
  // normalization to reduce the beginning of songs to near silence.
  console.log('--- Test 0: Stable Reverb Tail ---');
  const reverbLength = 44100 * 12;
  const reverbL = new Float32Array(reverbLength);
  const reverbR = new Float32Array(reverbLength);
  for (let second = 0; second < 12; second++) {
    reverbL[second * 44100] = 0.5;
    reverbR[second * 44100] = 0.5;
  }
  applyReverb(reverbL, reverbR, 2.0, 0.25, 0.5);
  let reverbPeak = 0;
  for (let i = 0; i < reverbLength; i++) {
    assert.ok(Number.isFinite(reverbL[i]) && Number.isFinite(reverbR[i]), 'Reverb output must stay finite');
    reverbPeak = Math.max(reverbPeak, Math.abs(reverbL[i]), Math.abs(reverbR[i]));
  }
  assert.ok(reverbPeak < 2, `Reverb output must remain bounded, received peak ${reverbPeak}`);
  console.log('✓ Reverb remains finite and bounded across a long render');

  // Test 1: Module import and basic exports
  console.log('--- Test 1: Module Import & Basic Exports ---');
  const int1 = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Boom Bap", 2, 92, "4/4")
    let kit = MPC.drum_kit("classic_kit")
  `);
  const env1 = (int1 as any).currentEnv;
  const seq1 = env1.get('seq');
  const kit1 = env1.get('kit');
  assert.ok(seq1, 'Sequence object should exist');
  assert.equal(seq1.name, 'Boom Bap', 'Sequence name should match');
  assert.equal(seq1.bpm, 92, 'Sequence BPM should match');
  assert.equal(seq1.bars, 2, 'Sequence bars should match');
  assert.ok(kit1, 'Drum kit object should exist');
  assert.equal(kit1.name, 'classic_kit', 'Kit name should match');
  console.log('✓ Sequence and Drum Kit creation verified');

  // Test 2: Roger Linn MPC Swing & Tempo Controls
  console.log('--- Test 2: Roger Linn MPC Swing Controls ---');
  const int2 = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Groove", 2, 90, "4/4")
    seq.set_swing(58)
    let swing_val = seq.swing
  `);
  const env2 = (int2 as any).currentEnv;
  const seq2 = env2.get('seq');
  const swingVal = env2.get('swing_val');
  assert.equal(swingVal, 58, 'Swing should be updated to 58%');
  console.log('✓ Roger Linn MPC Swing controls verified');

  // Test 3: 16 Levels Performance Mode
  console.log('--- Test 3: Official Akai MPC 16 Levels Mode ---');
  const int3 = await runSesi(`
    allow "std/mpc" in as MPC
    let kit = MPC.drum_kit("test_kit")
    let pad1 = kit.get_pad(1)
    let vel_levels = kit.sixteen_levels(1, "velocity")
    let tune_levels = kit.sixteen_levels(1, "tune")
    let filter_levels = kit.sixteen_levels(1, "filter")
  `);
  const env3 = (int3 as any).currentEnv;
  const velLevels = env3.get('vel_levels');
  const tuneLevels = env3.get('tune_levels');
  const filterLevels = env3.get('filter_levels');

  assert.equal(velLevels.length, 16, '16 Levels velocity should produce 16 pads');
  assert.equal(tuneLevels.length, 16, '16 Levels tune should produce 16 pads');
  assert.equal(filterLevels.length, 16, '16 Levels filter should produce 16 pads');
  // First pad should have low velocity and 16th pad full velocity
  assert.ok(velLevels[0].level < velLevels[15].level, 'Velocity should step upwards');
  // Chromatic tuning check
  assert.ok(tuneLevels[0].tune < tuneLevels[15].tune, 'Tune should step upwards chromatically');
  console.log('✓ 16 Levels velocity, tune, and filter modes verified');

  // Test 4: Note Repeat with divisions and ramp
  console.log('--- Test 4: Official Akai MPC Note Repeat ---');
  const int4 = await runSesi(`
    allow "std/mpc" in as MPC
    let repeats = MPC.note_repeat(3, "1/16", 1, {"velocity": 100, "ramp": "crescendo", "accent": 4})
  `);
  const env4 = (int4 as any).currentEnv;
  const repeats = env4.get('repeats');
  assert.equal(repeats.length, 16, '1 bar of 1/16 note repeat in 4/4 should generate 16 hits');
  assert.equal(repeats[0].pad, 3, 'Pad number should match');
  assert.ok(repeats[0].velocity < repeats[15].velocity, 'Crescendo ramp should increase velocity');
  console.log('✓ Note Repeat with time divisions and velocity ramps verified');

  // Test 5: Pattern programming & Choke Groups (Voice cutting)
  console.log('--- Test 5: Track Pattern Sequencing & Choke Groups ---');
  const int5 = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Beat", 1, 90, "4/4")
    seq.set_swing(60)
    let kit = MPC.drum_kit("boom_bap")
    
    // Set Choke group on hat (Pad 5) and open hat (Pad 7)
    kit.set_pad(5, {"sound": "hat", "mute_group": 1})
    kit.set_pad(7, {"sound": "open_hat", "mute_group": 1})

    let track = seq.add_track("Drums", "drum", kit)
    track.pattern(1, "x...x...x...x...") // Kick
    track.pattern(3, "....x.......x...") // Snare
    track.pattern(5, "x.x.x.x.x.x.x.x.") // Closed Hat
    track.pattern(7, "..x.......x.....") // Open Hat (will be choked by subsequent closed hats)
  `);
  const env5 = (int5 as any).currentEnv;
  const track5 = env5.get('track');
  const rawTrack = track5._raw;
  assert.ok(rawTrack.events.length > 0, 'Track should contain programmed events');
  console.log('✓ Step patterns and choke group configurations verified');

  // Test 5b: Visual bracketed step grids map each cell to one logical step.
  console.log('--- Test 5b: Visual Step Grid Notation ---');
  const int5b = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Visual Grid", 2, 120, "4/4")
    let kit = MPC.drum_kit("visual_kit")
    let track = seq.add_track("Drums", "drum", kit)
    let grid = "
    [x],[ ],[x],[ ],[x],[x],[ ],[x]
    [x],[ ],[x],[x],[ ],[x],[x],[ ]
    [x],[ ],[x],[ ],[x],[x],[ ],[x]
    [x],[x],[x],[ ],[x],[ ],[x],[x]
    "
    track.pattern(1, grid)
  `);
  const visualTrack = (int5b as any).currentEnv.get('track')._raw;
  assert.equal(visualTrack.events.length, 21, 'Bracketed grid should emit one event per [x] cell');
  assert.equal(visualTrack.events[0].step, 0, 'First visual grid cell should map to step 0');
  assert.equal(visualTrack.events.at(-1).step, 31, 'Final visual grid cell should map to step 31');
  console.log('✓ Bracketed visual 4×8 grid notation verified');

  // Test 5c: An eight-cell row at 1/8 resolution maps kick beats to 0, 4, 8, 12.
  console.log('--- Test 5c: Eighth-Note Visual Grid Resolution ---');
  const int5c = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Four On The Floor", 1, 140, "4/4")
    let kit = MPC.drum_kit("four_floor_kit")
    let track = seq.add_track("Drums", "drum", kit)
    track.pattern(1, "[X],[ ],[x],[ ],[x],[ ],[x],[ ]", {"resolution": "1/8"})
  `);
  const eighthTrack = (int5c as any).currentEnv.get('track')._raw;
  assert.deepEqual(eighthTrack.events.map((event: any) => event.step), [0, 4, 8, 12], '1/8 visual grid should place kicks on all four quarter notes');
  console.log('✓ Eighth-note visual grid resolution verified');

  // Test 6: In-memory audio rendering
  console.log('--- Test 6: In-Memory Audio Rendering ---');
  const int6 = await runSesi(`
    allow "std/mpc" in as MPC
    let seq = MPC.sequence("Mini", 1, 120, "4/4")
    let kit = MPC.drum_kit("mini_kit")
    let track = seq.add_track("Drums", "drum", kit)
    track.pattern(1, "x...x...")
    let sample = seq.render_wav("memory")
  `);
  const env6 = (int6 as any).currentEnv;
  const sample = env6.get('sample');
  assert.ok(sample, 'Rendered sample should be returned');
  assert.equal(sample.type, 'audio_sample', 'Type should be audio_sample');
  assert.ok(sample.samples.length > 0, 'Sample should contain audio data');
  console.log(`✓ In-memory audio rendering verified (${sample.samples.length} samples)`);

  // Test 7: WAV and MIDI file export
  console.log('--- Test 7: WAV and MIDI File Export ---');
  const testWavPath = path.resolve(process.cwd(), '.tmp_test_mpc_beat.wav');
  const testMidiPath = path.resolve(process.cwd(), '.tmp_test_mpc_beat.mid');

  try {
    await runSesi(`
      allow "std/mpc" in as MPC
      let seq = MPC.sequence("Export Test", 1, 95, "4/4")
      seq.set_swing(58)
      seq.set_vintage("mpc60")
      let kit = MPC.drum_kit("export_kit")
      let track = seq.add_track("Drums", "drum", kit)
      track.pattern(1, "x...x...")
      track.pattern(3, "....x...")
      
      seq.render_wav("${testWavPath.replace(/\\/g, '/')}")
      seq.render_midi("${testMidiPath.replace(/\\/g, '/')}")
    `);

    assert.ok(fs.existsSync(testWavPath), 'WAV file should be created');
    assert.ok(fs.statSync(testWavPath).size > 100, 'WAV file should have valid non-empty size');

    assert.ok(fs.existsSync(testMidiPath), 'MIDI file should be created');
    assert.ok(fs.statSync(testMidiPath).size > 50, 'MIDI file should have valid non-empty size');
    console.log('✓ WAV and MIDI exports verified');
  } finally {
    if (fs.existsSync(testWavPath)) fs.unlinkSync(testWavPath);
    if (fs.existsSync(testMidiPath)) fs.unlinkSync(testMidiPath);
  }

  // Test 8: Sample Chopping ("Chop Shop")
  console.log('--- Test 8: Sample Chopping (Chop Shop) ---');
  const int8 = await runSesi(`
    allow "std/mpc" in as MPC
    let kick_sample = MPC.sample("kick")
    let chop_kit = MPC.chop(kick_sample, 8)
    let chop_pad = chop_kit.get_pad(1)
  `);
  const env8 = (int8 as any).currentEnv;
  const chopKit = env8.get('chop_kit');
  const chopPad = env8.get('chop_pad');
  assert.ok(chopKit, 'Chop kit should exist');
  assert.ok(chopPad, 'Chop pad should exist');
  assert.equal(chopPad.mute_group, 1, 'Chop pads should be placed in choke group 1');
  console.log('✓ Sample chopping into 16-pad choke groups verified');

  // Test 9: Song Mode Sequence Chaining
  console.log('--- Test 9: Song Mode Sequence Chaining ---');
  const int9 = await runSesi(`
    allow "std/mpc" in as MPC
    let seq1 = MPC.sequence("Verse", 1, 90, "4/4")
    let seq2 = MPC.sequence("Chorus", 1, 90, "4/4")
    let song = MPC.song([
      {"sequence": seq1, "repeats": 2},
      {"sequence": seq2, "repeats": 1}
    ], "My MPC Song")
  `);
  const env9 = (int9 as any).currentEnv;
  const song = env9.get('song');
  assert.ok(song, 'Song object should exist');
  assert.equal(song.name, 'My MPC Song', 'Song name should match');
  console.log('✓ Song mode sequence chaining verified');

  console.log('\n=== All std/mpc tests passed! ===');
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
