import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { Interpreter } from './interpreter';
import { RuntimeFunction, RuntimeValue } from './types';
import { bindNativeMethod } from './native-object';
import { ensureSafePath, stringify } from './builtins';

export const MPC_VERSION = '1.0.0';
const SAMPLE_RATE = 44100;

export interface AudioSample {
  type: 'audio_sample';
  samples: number[] | Float32Array;
  sampleRate: number;
  channels?: number;
  samplesR?: number[] | Float32Array;
}

export interface MPCPadConfig {
  pad: number; // 1 to 16 (or up to 128)
  name?: string;
  sound?: string | AudioSample;
  tune?: number; // Semitones (-36 to +36)
  fine?: number; // Cents (-100 to +100)
  level?: number; // 0.0 to 1.0 (or 0-127)
  pan?: number; // -1.0 (Left) to +1.0 (Right)
  mute_group?: number; // 0 = off, 1-32
  play_mode?: 'one_shot' | 'note_on' | 'loop';
  attack?: number; // ms
  hold?: number; // ms
  decay?: number; // ms
  release?: number; // ms
  filter_type?: 'lowpass' | 'highpass' | 'bandpass' | 'none';
  filter_cutoff?: number; // Hz (20 - 20000)
  filter_resonance?: number; // 0.0 - 1.0
  link?: number[]; // pads triggered simultaneously
}

export interface MPCEffect {
  type: string; // 'filter' | 'delay' | 'reverb' | 'compressor' | 'lofi' | 'vintage' | 'eq' | 'chorus'
  params: Record<string, any>;
}

export interface MPCEvent {
  pad: number;
  step?: number;
  time_ms?: number;
  duration_ms?: number;
  velocity?: number; // 0 to 127
  tune?: number;
  pan?: number;
  note?: string | number;
}

// -------------------------------------------------------------------------
// DSP & Synthesis Functions
// -------------------------------------------------------------------------

export function createAudioSample(samplesL: Float32Array, samplesR?: Float32Array, sampleRate = SAMPLE_RATE): AudioSample {
  return {
    type: 'audio_sample',
    samples: samplesL,
    samplesR: samplesR ?? samplesL,
    channels: samplesR ? 2 : 1,
    sampleRate,
  };
}

export function synthesizeDrum(soundType: string, options: Record<string, any> = {}): AudioSample {
  const type = soundType.toLowerCase();
  const durMs = typeof options.ms === 'number' ? options.ms : getDefaultDrumDuration(type);
  const totalSamples = Math.floor(SAMPLE_RATE * (durMs / 1000));
  const buf = new Float32Array(totalSamples);
  const vol = typeof options.vol === 'number' ? options.vol : (typeof options.level === 'number' ? options.level : 1.0);
  const tuneSemitones = typeof options.tune === 'number' ? options.tune : 0;
  const pitchMult = Math.pow(2, tuneSemitones / 12);

  if (type === 'kick' || type === 'boom_bap_kick') {
    const startFreq = (options.start_freq || 160) * pitchMult;
    const endFreq = (options.end_freq || 45) * pitchMult;
    const decayFactor = options.decay_factor || 18.0;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const pitchEnv = Math.exp(-decayFactor * t);
      const freq = endFreq + (startFreq - endFreq) * pitchEnv;
      const phase = 2 * Math.PI * (endFreq * t + ((startFreq - endFreq) / -decayFactor) * (pitchEnv - 1));
      let s = Math.sin(phase) * Math.exp(-6.0 * t);
      // Punch click in first 3-5ms
      if (i < 220) {
        s += (Math.random() * 2 - 1) * Math.exp(-i / 50) * 0.45;
      }
      // Warm analog saturation
      s = Math.tanh(s * 1.4);
      buf[i] = s * vol;
    }
  } else if (type === '808' || type === 'sub') {
    const f0 = (options.freq || 48) * pitchMult;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const pitchDrop = Math.exp(-12.0 * t);
      const curFreq = f0 * (1 + 0.6 * pitchDrop);
      let s = Math.sin(2 * Math.PI * curFreq * t) * Math.exp(-1.5 * t);
      if (i < 150) s += (Math.random() * 2 - 1) * Math.exp(-i / 30) * 0.2;
      s = Math.tanh(s * 1.3);
      buf[i] = s * vol;
    }
  } else if (type === 'snare' || type === 'rimshot') {
    const isRim = type === 'rimshot';
    const bodyFreq = (isRim ? 800 : 190) * pitchMult;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const body = Math.sin(2 * Math.PI * bodyFreq * t * Math.exp(-15.0 * t)) * Math.exp(-14.0 * t);
      const noise = (Math.random() * 2 - 1) * Math.exp(- (isRim ? 40.0 : 15.0) * t);
      let s = isRim ? (body * 0.7 + noise * 0.5) : (body * 0.5 + noise * 0.65);
      if (i < 120) s += (Math.random() * 2 - 1) * 0.3;
      buf[i] = Math.tanh(s * 1.2) * vol;
    }
  } else if (type === 'hat' || type === 'closed_hat') {
    // 6 inharmonic frequencies + highpass
    const ratios = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
    let prev = 0;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      let s = 0;
      for (const f of ratios) {
        s += (Math.sin(2 * Math.PI * f * pitchMult * t) > 0 ? 0.2 : -0.2);
      }
      s += (Math.random() * 2 - 1) * 0.4;
      // Highpass filtering
      const hp = s - prev;
      prev = s * 0.85;
      buf[i] = hp * Math.exp(-55.0 * t) * vol * 1.5;
    }
  } else if (type === 'open_hat') {
    const ratios = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
    let prev = 0;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      let s = 0;
      for (const f of ratios) {
        s += (Math.sin(2 * Math.PI * f * pitchMult * t) > 0 ? 0.18 : -0.18);
      }
      s += (Math.random() * 2 - 1) * 0.35;
      const hp = s - prev;
      prev = s * 0.88;
      buf[i] = hp * Math.exp(-6.0 * t) * vol * 1.2;
    }
  } else if (type === 'clap') {
    for (let i = 0; i < totalSamples; i++) {
      let s = 0;
      const offsets = [0, 485, 970, 1455]; // ~11ms bursts
      for (const off of offsets) {
        if (i >= off) {
          const lt = (i - off) / SAMPLE_RATE;
          s += (Math.random() * 2 - 1) * Math.exp(-60.0 * lt) * 0.45;
        }
      }
      const t = i / SAMPLE_RATE;
      s += (Math.random() * 2 - 1) * Math.exp(-18.0 * t) * 0.35;
      buf[i] = Math.tanh(s * 1.3) * vol;
    }
  } else if (type === 'tom') {
    const f0 = (options.freq || 120) * pitchMult;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const curF = f0 * Math.exp(-8.0 * t) + 40;
      let s = Math.sin(2 * Math.PI * curF * t) * Math.exp(-8.0 * t);
      if (i < 100) s += (Math.random() * 2 - 1) * 0.2;
      buf[i] = s * vol;
    }
  } else if (type === 'perc' || type === 'shaker') {
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const noise = (Math.random() * 2 - 1) * Math.exp(-35.0 * t);
      buf[i] = noise * vol * 0.9;
    }
  } else if (type === 'crash' || type === 'ride') {
    const isRide = type === 'ride';
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const decay = isRide ? -4.0 : -2.5;
      let s = (Math.random() * 2 - 1) * Math.exp(decay * t) * 0.5;
      if (isRide) {
        s += Math.sin(2 * Math.PI * 580 * pitchMult * t) * Math.exp(-6.0 * t) * 0.3;
      }
      buf[i] = s * vol;
    }
  } else {
    // Default tone / synth hit
    const freq = (typeof options.freq === 'number' ? options.freq : 220) * pitchMult;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      buf[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-6.0 * t) * vol;
    }
  }

  return createAudioSample(buf);
}

function getDefaultDrumDuration(type: string): number {
  switch (type) {
    case 'kick':
    case 'boom_bap_kick': return 400;
    case '808':
    case 'sub': return 1200;
    case 'snare': return 280;
    case 'rimshot': return 120;
    case 'hat':
    case 'closed_hat': return 65;
    case 'open_hat': return 650;
    case 'clap': return 240;
    case 'tom': return 350;
    case 'perc':
    case 'shaker': return 150;
    case 'crash': return 1500;
    case 'ride': return 1200;
    default: return 300;
  }
}

// Resample audio for tuning (pitch shift)
export function resampleAudio(sample: AudioSample, semitones: number, cents = 0): AudioSample {
  if (semitones === 0 && cents === 0) return sample;
  const ratio = Math.pow(2, (semitones + cents / 100) / 12);
  const srcL = sample.samples;
  const srcR = sample.samplesR ?? sample.samples;
  const oldLen = srcL.length;
  const newLen = Math.max(1, Math.floor(oldLen / ratio));
  const dstL = new Float32Array(newLen);
  const dstR = new Float32Array(newLen);

  for (let i = 0; i < newLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    if (idx + 1 < oldLen) {
      dstL[i] = (1 - frac) * srcL[idx] + frac * srcL[idx + 1];
      dstR[i] = (1 - frac) * srcR[idx] + frac * srcR[idx + 1];
    } else if (idx < oldLen) {
      dstL[i] = srcL[idx];
      dstR[i] = srcR[idx];
    }
  }

  return createAudioSample(dstL, dstR, sample.sampleRate);
}

// -------------------------------------------------------------------------
// Akai MPC Roger Linn Swing & Timing Engine
// -------------------------------------------------------------------------

/**
 * Calculates milliseconds offset for swing on 16th-note steps.
 * Roger Linn MPC swing ranges from 50% (straight) to 75% (extreme shuffle).
 * Even steps (0, 2, 4...) remain on grid; odd steps (1, 3, 5...) are delayed.
 */
export function calculateSwingOffsetMs(stepIndex: number, bpm: number, swingPercent: number, grid = '1/16'): number {
  if (swingPercent <= 50) return 0;
  const clampedSwing = Math.min(75, Math.max(50, swingPercent));
  const sixteenthMs = 60000 / (bpm * 4);

  if (grid === '1/16' || grid === '1/16T') {
    // Every odd 16th step receives swing delay
    if (stepIndex % 2 === 1) {
      return ((clampedSwing - 50) / 50) * (sixteenthMs / 2);
    }
  } else if (grid === '1/8' || grid === '1/8T') {
    // 8th-note swing
    const eighthIndex = Math.floor(stepIndex / 2);
    if (eighthIndex % 2 === 1) {
      const eighthMs = 60000 / (bpm * 2);
      return ((clampedSwing - 50) / 50) * (eighthMs / 2);
    }
  }
  return 0;
}

export function parseGridDivision(grid: string): { stepsPerBeat: number; isTriplet: boolean } {
  switch (grid) {
    case '1/4': return { stepsPerBeat: 1, isTriplet: false };
    case '1/8': return { stepsPerBeat: 2, isTriplet: false };
    case '1/8T': return { stepsPerBeat: 3, isTriplet: true };
    case '1/16': return { stepsPerBeat: 4, isTriplet: false };
    case '1/16T': return { stepsPerBeat: 6, isTriplet: true };
    case '1/32': return { stepsPerBeat: 8, isTriplet: false };
    case '1/32T': return { stepsPerBeat: 12, isTriplet: true };
    case '1/64': return { stepsPerBeat: 16, isTriplet: false };
    default: return { stepsPerBeat: 4, isTriplet: false };
  }
}

// -------------------------------------------------------------------------
// Akai MPC Effects & Vintage Emulation
// -------------------------------------------------------------------------

export function applyVintageMode(bufL: Float32Array, bufR: Float32Array, mode: string): void {
  const m = mode.toLowerCase();
  const len = bufL.length;

  if (m === 'mpc60') {
    // MPC60: 12-bit linear conversion + subtle companding + 16kHz lowpass
    const levels = 2048; // 12-bit bipolar
    let prevL = 0;
    let prevR = 0;
    const alpha = 0.88; // Rolloff around 16kHz
    for (let i = 0; i < len; i++) {
      // Companding punch
      let sL = Math.tanh(bufL[i] * 1.15);
      let sR = Math.tanh(bufR[i] * 1.15);
      // 12-bit quantization
      sL = Math.round(sL * levels) / levels;
      sR = Math.round(sR * levels) / levels;
      // 1-pole filter
      prevL = prevL + alpha * (sL - prevL);
      prevR = prevR + alpha * (sR - prevR);
      bufL[i] = prevL;
      bufR[i] = prevR;
    }
  } else if (m === 'mpc3000') {
    // MPC3000: 16-bit 44.1kHz warm converters + transformer low-end bump
    const levels = 32767;
    for (let i = 0; i < len; i++) {
      let sL = Math.round(bufL[i] * levels) / levels;
      let sR = Math.round(bufR[i] * levels) / levels;
      // Warm analog transformer curve
      bufL[i] = Math.tanh(sL * 1.05);
      bufR[i] = Math.tanh(sR * 1.05);
    }
  } else if (m === 'sp1200') {
    // SP-1200: 12-bit 26.04kHz ring and downsampling aliasing
    const levels = 2048;
    const downsampleStep = 44100 / 26040;
    let holdL = 0;
    let holdR = 0;
    for (let i = 0; i < len; i++) {
      if (Math.floor(i % downsampleStep) === 0) {
        holdL = Math.round(bufL[i] * levels) / levels;
        holdR = Math.round(bufR[i] * levels) / levels;
      }
      bufL[i] = Math.tanh(holdL * 1.3);
      bufR[i] = Math.tanh(holdR * 1.3);
    }
  }
}

export function applyFilter(bufL: Float32Array, bufR: Float32Array, type: string, cutoff: number, resonance = 0.1, drive = 1.0): void {
  if (type === 'none') return;
  const fc = Math.min(20000, Math.max(20, cutoff));
  const q = Math.min(10.0, Math.max(0.1, resonance * 8 + 0.707));
  const w0 = (2 * Math.PI * fc) / SAMPLE_RATE;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * q);

  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

  if (type === 'lowpass') {
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  }

  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;

  let x1L = 0, x2L = 0, y1L = 0, y2L = 0;
  let x1R = 0, x2R = 0, y1R = 0, y2R = 0;

  for (let i = 0; i < bufL.length; i++) {
    const inL = bufL[i] * drive;
    const inR = bufR[i] * drive;

    const outL = b0 * inL + b1 * x1L + b2 * x2L - a1 * y1L - a2 * y2L;
    x2L = x1L; x1L = inL; y2L = y1L; y1L = outL;

    const outR = b0 * inR + b1 * x1R + b2 * x2R - a1 * y1R - a2 * y2R;
    x2R = x1R; x1R = inR; y2R = y1R; y1R = outR;

    bufL[i] = Math.tanh(outL);
    bufR[i] = Math.tanh(outR);
  }
}

export function applyDelay(bufL: Float32Array, bufR: Float32Array, delayMs: number, feedback = 0.4, damp = 0.5, mix = 0.35, pingPong = false): void {
  if (mix <= 0 || delayMs <= 0) return;
  const delaySamples = Math.floor(SAMPLE_RATE * (delayMs / 1000));
  if (delaySamples <= 0 || delaySamples >= bufL.length) return;

  const wetL = new Float32Array(bufL.length);
  const wetR = new Float32Array(bufR.length);
  const dampFactor = Math.min(0.95, Math.max(0.05, 1 - damp));

  let prevL = 0;
  let prevR = 0;

  for (let i = delaySamples; i < bufL.length; i++) {
    const srcIndex = i - delaySamples;
    const inL = bufL[srcIndex] + (pingPong ? wetR[srcIndex] : wetL[srcIndex]) * feedback;
    const inR = bufR[srcIndex] + (pingPong ? wetL[srcIndex] : wetR[srcIndex]) * feedback;

    prevL = prevL + dampFactor * (inL - prevL);
    prevR = prevR + dampFactor * (inR - prevR);

    wetL[i] = prevL;
    wetR[i] = prevR;
  }

  for (let i = 0; i < bufL.length; i++) {
    bufL[i] = bufL[i] * (1 - mix) + wetL[i] * mix;
    bufR[i] = bufR[i] * (1 - mix) + wetR[i] * mix;
  }
}

export function applyReverb(bufL: Float32Array, bufR: Float32Array, decay = 1.8, mix = 0.25, damp = 0.5): void {
  const wetMix = Math.min(1, Math.max(0, mix));
  if (wetMix <= 0) return;
  const damping = Math.min(0.95, Math.max(0.05, damp));
  const combDelays = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const allpassDelays = [225, 341, 441, 556];
  const fb = Math.min(0.92, Math.max(0.1, 0.7 + decay * 0.03));
  const wetL = new Float32Array(bufL.length);
  const wetR = new Float32Array(bufR.length);

  for (let c = 0; c < combDelays.length; c++) {
    const d = combDelays[c];
    const delayL = Math.floor(d * 1.0);
    const delayR = Math.floor(d * 1.05);
    let filterL = 0;
    let filterR = 0;

    for (let i = delayL; i < bufL.length; i++) {
      const inL = bufL[i - delayL] + filterL * fb;
      filterL = filterL * (1 - damping) + inL * damping;
      wetL[i] += filterL * 0.125;
    }

    for (let i = delayR; i < bufR.length; i++) {
      const inR = bufR[i - delayR] + filterR * fb;
      filterR = filterR * (1 - damping) + inR * damping;
      wetR[i] += filterR * 0.125;
    }
  }

  // Stable Schroeder all-pass filters. The previous implementation reused the
  // output array as both input history and delay state, creating a pole at 1
  // and making long renders grow without bound.
  for (const d of allpassDelays) {
    const g = 0.5;
    const delayL = new Float32Array(d);
    const delayR = new Float32Array(d);
    let cursor = 0;
    for (let i = 0; i < bufL.length; i++) {
      const inputL = wetL[i];
      const inputR = wetR[i];
      const delayedL = delayL[cursor];
      const delayedR = delayR[cursor];

      wetL[i] = -g * inputL + delayedL;
      wetR[i] = -g * inputR + delayedR;
      delayL[cursor] = inputL + g * delayedL;
      delayR[cursor] = inputR + g * delayedR;
      cursor = (cursor + 1) % d;
    }
  }

  for (let i = 0; i < bufL.length; i++) {
    const outL = bufL[i] * (1 - wetMix) + wetL[i] * wetMix;
    const outR = bufR[i] * (1 - wetMix) + wetR[i] * wetMix;
    bufL[i] = Number.isFinite(outL) ? outL : 0;
    bufR[i] = Number.isFinite(outR) ? outR : 0;
  }
}

export function applyCompressor(bufL: Float32Array, bufR: Float32Array, thresholdDb = -12, ratio = 4, attackMs = 10, releaseMs = 100, makeupDb = 3): void {
  const threshold = Math.pow(10, thresholdDb / 20);
  const makeup = Math.pow(10, makeupDb / 20);
  const attackCoeff = Math.exp(-1 / (SAMPLE_RATE * (attackMs / 1000)));
  const releaseCoeff = Math.exp(-1 / (SAMPLE_RATE * (releaseMs / 1000)));

  let env = 0;

  for (let i = 0; i < bufL.length; i++) {
    const peak = Math.max(Math.abs(bufL[i]), Math.abs(bufR[i]));
    if (peak > env) {
      env = attackCoeff * env + (1 - attackCoeff) * peak;
    } else {
      env = releaseCoeff * env + (1 - releaseCoeff) * peak;
    }

    let gain = 1.0;
    if (env > threshold) {
      const envDb = 20 * Math.log10(env + 1e-6);
      const overDb = envDb - thresholdDb;
      const compDb = thresholdDb + overDb / ratio;
      gain = Math.pow(10, (compDb - envDb) / 20);
    }

    bufL[i] = Math.tanh(bufL[i] * gain * makeup);
    bufR[i] = Math.tanh(bufR[i] * gain * makeup);
  }
}

export function applyLoFi(bufL: Float32Array, bufR: Float32Array, bitDepth = 12, sampleRate = 22050, drive = 1.2, mix = 1.0): void {
  const steps = Math.pow(2, bitDepth - 1);
  const downstep = Math.max(1, Math.floor(SAMPLE_RATE / sampleRate));
  let holdL = 0;
  let holdR = 0;

  for (let i = 0; i < bufL.length; i++) {
    if (i % downstep === 0) {
      holdL = Math.round(Math.tanh(bufL[i] * drive) * steps) / steps;
      holdR = Math.round(Math.tanh(bufR[i] * drive) * steps) / steps;
    }
    bufL[i] = bufL[i] * (1 - mix) + holdL * mix;
    bufR[i] = bufR[i] * (1 - mix) + holdR * mix;
  }
}

export function applyEQ(bufL: Float32Array, bufR: Float32Array, lowDb = 0, midDb = 0, highDb = 0): void {
  if (lowDb === 0 && midDb === 0 && highDb === 0) return;
  const lowGain = Math.pow(10, lowDb / 40);
  const midGain = Math.pow(10, midDb / 40);
  const highGain = Math.pow(10, highDb / 40);

  let lpL = 0, lpR = 0;
  let hpL = 0, hpR = 0;
  const alphaLow = 0.05; // ~350Hz
  const alphaHigh = 0.55; // ~4000Hz

  for (let i = 0; i < bufL.length; i++) {
    // Low band
    lpL += alphaLow * (bufL[i] - lpL);
    lpR += alphaLow * (bufR[i] - lpR);
    // High band
    hpL += alphaHigh * (bufL[i] - hpL);
    hpR += alphaHigh * (bufR[i] - hpR);
    const hiL = bufL[i] - hpL;
    const hiR = bufR[i] - hpR;
    // Mid band
    const midL = hpL - lpL;
    const midR = hpR - lpR;

    bufL[i] = lpL * lowGain + midL * midGain + hiL * highGain;
    bufR[i] = lpR * lowGain + midR * midGain + hiR * highGain;
  }
}

export function processEffectsChain(bufL: Float32Array, bufR: Float32Array, effects: MPCEffect[], bpm = 120): void {
  for (const fx of effects) {
    const type = fx.type.toLowerCase();
    const p = fx.params || {};

    if (type === 'vintage') {
      applyVintageMode(bufL, bufR, p.mode || 'mpc60');
    } else if (type === 'filter') {
      applyFilter(bufL, bufR, p.type || 'lowpass', p.cutoff || 2000, p.resonance || 0.1, p.drive || 1.0);
    } else if (type === 'delay') {
      let delayMs = p.time_ms;
      if (!delayMs && p.sync) {
        const div = parseGridDivision(p.sync);
        delayMs = (60000 / (bpm * div.stepsPerBeat)) * (div.isTriplet ? 0.667 : 1.0);
      }
      applyDelay(bufL, bufR, delayMs || 350, p.feedback || 0.4, p.damp || 0.4, p.mix || 0.3, p.ping_pong || false);
    } else if (type === 'reverb') {
      const decay = typeof p.decay === 'number' ? p.decay : (typeof p.room === 'number' ? p.room : 2.0);
      const mix = typeof p.mix === 'number' ? p.mix : 0.25;
      const damp = typeof p.damp === 'number' ? p.damp : 0.5;
      applyReverb(bufL, bufR, decay, mix, damp);
    } else if (type === 'compressor') {
      applyCompressor(bufL, bufR, p.threshold || -12, p.ratio || 4, p.attack || 10, p.release || 100, p.makeup || 3);
    } else if (type === 'lofi' || type === 'bitcrush') {
      applyLoFi(bufL, bufR, p.bit_depth || 12, p.sample_rate || 22050, p.drive || 1.2, p.mix || 1.0);
    } else if (type === 'eq') {
      applyEQ(bufL, bufR, p.low || 0, p.mid || 0, p.high || 0);
    }
  }
}

// -------------------------------------------------------------------------
// Akai MPC Drum Program / Pad System
// -------------------------------------------------------------------------

export class MPCDrumKit {
  public name: string;
  public pads: Map<number, MPCPadConfig>;
  public sampleCache: Map<number, AudioSample>;

  constructor(name = 'Akai MPC Kit') {
    this.name = name;
    this.pads = new Map();
    this.sampleCache = new Map();
    this.initializeDefaultKit();
  }

  private initializeDefaultKit() {
    // Classic 16-pad layout (General MIDI & MPC layout)
    // Pad 1-4: Kick, Rimshot, Snare, Clap
    // Pad 5-8: Closed Hat, Low Tom, Open Hat, Mid Tom
    // Pad 9-12: High Tom, Crash, Ride, Shaker/Perc
    // Pad 13-16: 808 Sub, Perc 2, Open Hat 2, Special
    const defaultSounds: Array<{ pad: number; sound: string; name: string; mute_group?: number }> = [
      { pad: 1, sound: 'kick', name: 'Bass Drum 1' },
      { pad: 2, sound: 'rimshot', name: 'Side Stick' },
      { pad: 3, sound: 'snare', name: 'Acoustic Snare' },
      { pad: 4, sound: 'clap', name: 'Hand Clap' },
      { pad: 5, sound: 'hat', name: 'Closed Hi-Hat', mute_group: 1 },
      { pad: 6, sound: 'tom', name: 'Low Tom' },
      { pad: 7, sound: 'open_hat', name: 'Open Hi-Hat', mute_group: 1 }, // Choked by closed hat!
      { pad: 8, sound: 'tom', name: 'Mid Tom' },
      { pad: 9, sound: 'tom', name: 'High Tom' },
      { pad: 10, sound: 'crash', name: 'Crash Cymbal' },
      { pad: 11, sound: 'ride', name: 'Ride Cymbal' },
      { pad: 12, sound: 'perc', name: 'Shaker/Perc' },
      { pad: 13, sound: '808', name: '808 Sub Kick' },
      { pad: 14, sound: 'snare', name: 'Tight Snare' },
      { pad: 15, sound: 'hat', name: 'Pedal Hi-Hat', mute_group: 1 },
      { pad: 16, sound: 'perc', name: 'Cowbell/Perc' },
    ];

    for (const d of defaultSounds) {
      this.pads.set(d.pad, {
        pad: d.pad,
        name: d.name,
        sound: d.sound,
        tune: 0,
        fine: 0,
        level: 1.0,
        pan: 0.0,
        mute_group: d.mute_group || 0,
        play_mode: 'one_shot',
        attack: 0,
        decay: 300,
        release: 50,
      });
    }
  }

  public setPad(padNum: number, config: Partial<MPCPadConfig>): void {
    const existing = this.pads.get(padNum) || { pad: padNum, sound: 'kick' };
    this.pads.set(padNum, { ...existing, ...config, pad: padNum });
    this.sampleCache.delete(padNum);
  }

  public getPad(padNum: number): MPCPadConfig {
    return this.pads.get(padNum) || {
      pad: padNum,
      name: `Pad ${padNum}`,
      sound: 'kick',
      tune: 0,
      level: 1.0,
      pan: 0.0,
      mute_group: 0,
      play_mode: 'one_shot',
    };
  }

  public getAudioSample(padNum: number, interpreter?: Interpreter): AudioSample {
    if (this.sampleCache.has(padNum)) {
      return this.sampleCache.get(padNum)!;
    }
    const pad = this.getPad(padNum);
    let sample: AudioSample;

    if (typeof pad.sound === 'string') {
      if (pad.sound.endsWith('.wav') || pad.sound.includes('/') || pad.sound.includes('\\')) {
        sample = loadWavFile(pad.sound, interpreter);
      } else {
        sample = synthesizeDrum(pad.sound, { tune: pad.tune, fine: pad.fine, level: pad.level });
      }
    } else if (pad.sound && typeof pad.sound === 'object' && pad.sound.type === 'audio_sample') {
      sample = pad.sound;
    } else {
      sample = synthesizeDrum('kick');
    }

    if (pad.tune || pad.fine) {
      sample = resampleAudio(sample, pad.tune || 0, pad.fine || 0);
    }

    this.sampleCache.set(padNum, sample);
    return sample;
  }
}

// -------------------------------------------------------------------------
// Akai MPC Performance Controls: 16 Levels, Note Repeat & Chops
// -------------------------------------------------------------------------

/**
 * Official Akai MPC "16 Levels" function.
 * Spreads a pad's sound across all 16 pads by Velocity, Tune, Filter, or Decay.
 */
export function sixteenLevels(padConfig: MPCPadConfig, mode = 'velocity', options: Record<string, any> = {}): MPCPadConfig[] {
  const result: MPCPadConfig[] = [];
  const m = mode.toLowerCase();

  for (let i = 1; i <= 16; i++) {
    const idx = i - 1;
    const padCopy: MPCPadConfig = { ...padConfig, pad: i, name: `${padConfig.name || 'Pad'} [16L:${m} ${i}]` };

    if (m === 'velocity' || m === 'vel') {
      // 16 linear velocity steps from 8 to 127
      const vel = Math.round(8 + (119 / 15) * idx);
      padCopy.level = vel / 127;
    } else if (m === 'tune' || m === 'pitch') {
      // Chromatic tuning across 16 pads (-12 to +3 semitones by default or custom base)
      const baseTune = typeof options.base_tune === 'number' ? options.base_tune : -12;
      padCopy.tune = baseTune + idx;
    } else if (m === 'filter' || m === 'cutoff') {
      // Exponential filter cutoff from 200 Hz to 18000 Hz
      padCopy.filter_type = 'lowpass';
      padCopy.filter_cutoff = Math.round(200 * Math.pow(18000 / 200, idx / 15));
    } else if (m === 'decay') {
      // Decay from 30ms to 1200ms
      padCopy.decay = Math.round(30 + (1170 / 15) * idx);
    } else if (m === 'attack') {
      // Attack from 0ms to 500ms
      padCopy.attack = Math.round((500 / 15) * idx);
    }

    result.push(padCopy);
  }
  return result;
}

/**
 * Official Akai MPC "Note Repeat" function.
 * Generates rhythmic repeats with swing and velocity curves.
 */
export function noteRepeat(
  padNumber: number,
  rate = '1/16',
  barsOrLength = 1,
  options: Record<string, any> = {},
): MPCEvent[] {
  const div = parseGridDivision(rate);
  const beatsPerBar = 4;
  const totalBeats = barsOrLength * beatsPerBar;
  const totalSteps = Math.floor(totalBeats * div.stepsPerBeat);
  const events: MPCEvent[] = [];
  const baseVel = typeof options.velocity === 'number' ? options.velocity : 100;
  const ramp = typeof options.ramp === 'string' ? options.ramp : 'none'; // 'crescendo' | 'decrescendo'
  const accentEvery = typeof options.accent === 'number' ? options.accent : 0;

  for (let s = 0; s < totalSteps; s++) {
    let vel = baseVel;
    if (ramp === 'crescendo') {
      vel = Math.round(40 + (baseVel - 40) * (s / Math.max(1, totalSteps - 1)));
    } else if (ramp === 'decrescendo') {
      vel = Math.round(baseVel - (baseVel - 40) * (s / Math.max(1, totalSteps - 1)));
    }
    if (accentEvery > 0 && s % accentEvery === 0) {
      vel = Math.min(127, vel + 25);
    }
    events.push({
      pad: padNumber,
      step: s,
      velocity: vel,
      duration_ms: options.gate_ms || 100,
    });
  }
  return events;
}

/**
 * Official Akai MPC "Chop Shop" / Sample Slicer.
 * Slices an audio sample into regions and maps them to Pads 1-16 with mute groups set.
 */
export function chopSample(
  sample: AudioSample,
  slices = 16,
  options: Record<string, any> = {},
): MPCDrumKit {
  const kit = new MPCDrumKit(options.name || 'MPC Chops');
  const numSlices = Math.min(128, Math.max(1, slices));
  const srcL = sample.samples;
  const srcR = sample.samplesR ?? sample.samples;
  const totalLen = srcL.length;
  const sliceLen = Math.floor(totalLen / numSlices);

  for (let i = 0; i < numSlices; i++) {
    const padNum = i + 1;
    const start = i * sliceLen;
    const end = Math.min(totalLen, start + sliceLen);
    const subL = srcL.slice(start, end);
    const subR = srcR.slice(start, end);
    const sliceAudio = createAudioSample(subL as Float32Array, subR as Float32Array, sample.sampleRate);

    kit.setPad(padNum, {
      pad: padNum,
      name: `Chop ${padNum}`,
      sound: sliceAudio,
      mute_group: 1, // Choke group 1: chops cut each other off!
      play_mode: 'one_shot',
      level: 1.0,
      pan: 0.0,
    });
  }

  return kit;
}

// -------------------------------------------------------------------------
// Akai MPC Track & Sequencer Engine
// -------------------------------------------------------------------------

export class MPCTrack {
  public name: string;
  public type: 'drum' | 'keygroup' | 'midi';
  public kit: MPCDrumKit;
  public events: MPCEvent[];
  public muted: boolean;
  public solo: boolean;
  public volume: number;
  public pan: number;
  public effects: MPCEffect[];

  constructor(name: string, type: 'drum' | 'keygroup' | 'midi' = 'drum', kit?: MPCDrumKit) {
    this.name = name;
    this.type = type;
    this.kit = kit || new MPCDrumKit(`${name} Kit`);
    this.events = [];
    this.muted = false;
    this.solo = false;
    this.volume = 1.0;
    this.pan = 0.0;
    this.effects = [];
  }

  public addEvent(event: MPCEvent): void {
    this.events.push(event);
  }

  /**
   * Helper to set events using step patterns (e.g. "x...x...x...x...")
   */
  public pattern(padNumber: number, patternString: string, options: Record<string, any> = {}): void {
    const baseVel = typeof options.velocity === 'number' ? options.velocity : 100;
    const explicitStartStep = typeof options.start_step === 'number'
      ? Math.max(0, Math.floor(options.start_step))
      : null;
    const startBar = typeof options.start_bar === 'number'
      ? Math.max(1, Math.floor(options.start_bar))
      : 1;
    const startStep = explicitStartStep ?? (startBar - 1) * 16;
    const repetitions = typeof options.repeat === 'number'
      ? Math.max(1, Math.floor(options.repeat))
      : 1;
    const resolution = typeof options.resolution === 'string' ? options.resolution : '1/16';
    const stepStride = resolution === '1/4' ? 4
      : resolution === '1/8' ? 2
        : resolution === '1/8T' ? 4 / 3
          : resolution === '1/16T' ? 2 / 3
            : resolution === '1/32' ? 0.5
              : 1;
    const bracketedSteps = Array.from(patternString.matchAll(/\[\s*([xX\-1-9]?)\s*\]/g), match => match[1] || '.');
    const steps = bracketedSteps.length > 0 ? bracketedSteps : Array.from(patternString);
    const patternLength = Math.max(1, Math.round(steps.length * stepStride));

    for (let repetition = 0; repetition < repetitions; repetition++) {
      for (let i = 0; i < steps.length; i++) {
        const char = steps[i];
        const step = startStep + repetition * patternLength + i * stepStride;
        if (char === 'x') {
          this.events.push({ pad: padNumber, step, velocity: baseVel });
        } else if (char === 'X') {
          // Full level accent
          this.events.push({ pad: padNumber, step, velocity: 127 });
        } else if (char === '-') {
          // Ghost note
          this.events.push({ pad: padNumber, step, velocity: 45 });
        } else if (char >= '1' && char <= '9') {
          // Numeric velocity 10% - 90%
          const vel = Math.round((parseInt(char) / 9) * 127);
          this.events.push({ pad: padNumber, step, velocity: vel });
        }
      }
    }
  }

  public addEffect(type: string, params: Record<string, any> = {}): void {
    this.effects.push({ type, params });
  }
}

export class MPCSequence {
  public name: string;
  public bars: number;
  public bpm: number;
  public timeSignature: [number, number];
  public swing: number; // 50 - 75%
  public timeCorrect: string; // '1/16', '1/8', etc.
  public loop: boolean;
  public tracks: MPCTrack[];
  public fullLevel: boolean;
  public halfLevel: boolean;
  public masterEffects: MPCEffect[];

  constructor(name = 'Sequence 01', bars = 2, bpm = 90, timeSig = '4/4') {
    this.name = name;
    this.bars = bars;
    this.bpm = bpm;
    this.timeSignature = parseTimeSig(timeSig);
    this.swing = 50; // Default straight
    this.timeCorrect = '1/16';
    this.loop = true;
    this.tracks = [];
    this.fullLevel = false;
    this.halfLevel = false;
    this.masterEffects = [];
  }

  public addTrack(name: string, type: 'drum' | 'keygroup' | 'midi' = 'drum', kit?: MPCDrumKit): MPCTrack {
    const track = new MPCTrack(name, type, kit);
    this.tracks.push(track);
    return track;
  }

  public getTrack(nameOrIndex: string | number): MPCTrack | null {
    if (typeof nameOrIndex === 'number') {
      return this.tracks[nameOrIndex] || null;
    }
    return this.tracks.find(t => t.name.toLowerCase() === String(nameOrIndex).toLowerCase()) || null;
  }

  public addMasterEffect(type: string, params: Record<string, any> = {}): void {
    this.masterEffects.push({ type, params });
  }

  public getTotalDurationMs(): number {
    const beatsPerBar = this.timeSignature[0];
    const totalBeats = this.bars * beatsPerBar;
    return (totalBeats * 60000) / this.bpm;
  }
}

function parseTimeSig(sig: string): [number, number] {
  const parts = String(sig).split('/');
  if (parts.length === 2) {
    const num = parseInt(parts[0]) || 4;
    const den = parseInt(parts[1]) || 4;
    return [num, den];
  }
  return [4, 4];
}

// -------------------------------------------------------------------------
// Akai MPC Song Mode (Sequence Chaining)
// -------------------------------------------------------------------------

export interface MPCSongStep {
  sequence: MPCSequence;
  repeats: number;
  mutes?: string[]; // Names of tracks to mute in this step
}

export class MPCSong {
  public name: string;
  public steps: MPCSongStep[];

  constructor(name = 'MPC Song') {
    this.name = name;
    this.steps = [];
  }

  public addStep(sequence: MPCSequence, repeats = 1, mutes: string[] = []): void {
    this.steps.push({ sequence, repeats, mutes });
  }
}

// -------------------------------------------------------------------------
// Audio Rendering Engine (Stereo Mixing & Choke Groups)
// -------------------------------------------------------------------------

export function renderSequenceAudio(sequence: MPCSequence, interpreter?: Interpreter): AudioSample {
  const totalMs = sequence.getTotalDurationMs();
  const totalSamples = Math.floor(SAMPLE_RATE * (totalMs / 1000));
  const masterL = new Float32Array(totalSamples);
  const masterR = new Float32Array(totalSamples);

  const beatsPerBar = sequence.timeSignature[0];
  const sixteenthMs = 60000 / (sequence.bpm * 4);

  // Check if any track is soloed
  const hasSolo = sequence.tracks.some(t => t.solo);

  for (const track of sequence.tracks) {
    if (track.muted) continue;
    if (hasSolo && !track.solo) continue;

    const trackL = new Float32Array(totalSamples);
    const trackR = new Float32Array(totalSamples);

    // Track active mute groups to implement authentic MPC choke groups!
    // Key: mute_group ID (1-32), Value: array of sample offset references to choke
    const activeVoicesByMuteGroup = new Map<number, Array<{ startOffset: number; samplesL: Float32Array; samplesR: Float32Array }>>();

    // Sort events by time
    const resolvedEvents = track.events.map(ev => {
      let timeMs = ev.time_ms;
      if (typeof timeMs !== 'number') {
        const step = ev.step || 0;
        const swingOffset = calculateSwingOffsetMs(step, sequence.bpm, sequence.swing, sequence.timeCorrect);
        timeMs = step * sixteenthMs + swingOffset;
      }
      return { ...ev, resolvedTimeMs: timeMs };
    }).sort((a, b) => a.resolvedTimeMs - b.resolvedTimeMs);

    for (const ev of resolvedEvents) {
      const padConfig = track.kit.getPad(ev.pad);
      const sample = track.kit.getAudioSample(ev.pad, interpreter);
      const muteGroup = padConfig.mute_group || 0;

      let vel = ev.velocity !== undefined ? ev.velocity : 100;
      if (sequence.fullLevel) vel = 127;
      else if (sequence.halfLevel) vel = 64;
      const velScale = vel / 127;

      const pan = ev.pan !== undefined ? ev.pan : (padConfig.pan || 0.0);
      const panL = 1.0 - Math.max(0, pan);
      const panR = 1.0 - Math.max(0, -pan);

      const triggerSampleOffset = Math.floor((ev.resolvedTimeMs / 1000) * SAMPLE_RATE);
      if (triggerSampleOffset >= totalSamples) continue;

      // CHOKE GROUP HANDLING:
      // If this pad belongs to a mute group, fade out any playing voices in this group over 5ms
      if (muteGroup > 0 && activeVoicesByMuteGroup.has(muteGroup)) {
        const chokeFadeSamples = Math.floor(SAMPLE_RATE * 0.005); // 5ms fade
        const voices = activeVoicesByMuteGroup.get(muteGroup)!;
        for (const v of voices) {
          const overlapStart = triggerSampleOffset;
          const voiceEnd = v.startOffset + v.samplesL.length;
          if (overlapStart < voiceEnd) {
            for (let i = 0; i < chokeFadeSamples; i++) {
              const bufIdx = overlapStart + i;
              if (bufIdx < totalSamples) {
                const fade = 1.0 - (i / chokeFadeSamples);
                trackL[bufIdx] *= fade;
                trackR[bufIdx] *= fade;
              }
            }
            // Silence everything after the fade
            for (let bufIdx = overlapStart + chokeFadeSamples; bufIdx < Math.min(totalSamples, voiceEnd); bufIdx++) {
              trackL[bufIdx] = 0;
              trackR[bufIdx] = 0;
            }
          }
        }
        voices.length = 0; // Clear choked voices
      }

      // Mix this sample into the track buffer
      const srcL = sample.samples;
      const srcR = sample.samplesR ?? sample.samples;
      const voiceSamplesL = new Float32Array(srcL.length);
      const voiceSamplesR = new Float32Array(srcR.length);

      for (let i = 0; i < srcL.length; i++) {
        const outIdx = triggerSampleOffset + i;
        if (outIdx >= totalSamples) break;
        const sL = srcL[i] * velScale * padConfig.level! * panL;
        const sR = srcR[i] * velScale * padConfig.level! * panR;
        voiceSamplesL[i] = sL;
        voiceSamplesR[i] = sR;
        trackL[outIdx] += sL;
        trackR[outIdx] += sR;
      }

      if (muteGroup > 0) {
        if (!activeVoicesByMuteGroup.has(muteGroup)) activeVoicesByMuteGroup.set(muteGroup, []);
        activeVoicesByMuteGroup.get(muteGroup)!.push({
          startOffset: triggerSampleOffset,
          samplesL: voiceSamplesL,
          samplesR: voiceSamplesR,
        });
      }
    }

    // Apply track insert effects
    if (track.effects.length > 0) {
      processEffectsChain(trackL, trackR, track.effects, sequence.bpm);
    }

    // Apply track pan and volume
    const tPanL = 1.0 - Math.max(0, track.pan);
    const tPanR = 1.0 - Math.max(0, -track.pan);
    const tVol = track.volume;

    for (let i = 0; i < totalSamples; i++) {
      masterL[i] += trackL[i] * tVol * tPanL;
      masterR[i] += trackR[i] * tVol * tPanR;
    }
  }

  // Apply master bus effects (e.g. vintage mode, compressor, limiter)
  if (sequence.masterEffects.length > 0) {
    processEffectsChain(masterL, masterR, sequence.masterEffects, sequence.bpm);
  }

  // Master brickwall limiter & peak normalize
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    peak = Math.max(peak, Math.abs(masterL[i]), Math.abs(masterR[i]));
  }
  const scale = peak > 1.0 ? (0.98 / peak) : 1.0;
  for (let i = 0; i < totalSamples; i++) {
    masterL[i] = Math.tanh(masterL[i] * scale);
    masterR[i] = Math.tanh(masterR[i] * scale);
  }

  return createAudioSample(masterL, masterR, SAMPLE_RATE);
}

export function renderSongAudio(song: MPCSong, interpreter?: Interpreter): AudioSample {
  const renderedSteps: AudioSample[] = [];
  let totalLength = 0;

  for (const step of song.steps) {
    const seqAudio = renderSequenceAudio(step.sequence, interpreter);
    const stepLen = seqAudio.samples.length;
    for (let r = 0; r < step.repeats; r++) {
      renderedSteps.push(seqAudio);
      totalLength += stepLen;
    }
  }

  const outL = new Float32Array(totalLength);
  const outR = new Float32Array(totalLength);
  let offset = 0;

  for (const stepAudio of renderedSteps) {
    const sL = stepAudio.samples;
    const sR = stepAudio.samplesR ?? stepAudio.samples;
    outL.set(sL, offset);
    outR.set(sR, offset);
    offset += sL.length;
  }

  return createAudioSample(outL, outR, SAMPLE_RATE);
}

// -------------------------------------------------------------------------
// WAV & MIDI File Generation
// -------------------------------------------------------------------------

export function exportWavFile(audio: AudioSample, filePath: string, interpreter?: Interpreter): boolean {
  const absPath = ensureSafePath(filePath, interpreter);
  const len = audio.samples.length;
  const sL = audio.samples;
  const sR = audio.samplesR ?? audio.samples;

  const buffer = Buffer.alloc(44 + len * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + len * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // Stereo
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(len * 4, 40);

  for (let i = 0; i < len; i++) {
    const left = Math.max(-1, Math.min(1, sL[i]));
    const right = Math.max(-1, Math.min(1, sR[i]));
    buffer.writeInt16LE(Math.floor(left * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.floor(right * 32767), 44 + i * 4 + 2);
  }

  fs.writeFileSync(absPath, buffer);
  return true;
}

export function loadWavFile(filePath: string, interpreter?: Interpreter): AudioSample {
  const absPath = ensureSafePath(filePath, interpreter);
  if (!fs.existsSync(absPath)) throw new Error(`Audio sample not found: ${filePath}`);
  const buf = fs.readFileSync(absPath);
  const dataOffset = buf.indexOf('data') + 4;
  if (dataOffset < 4) throw new Error(`Invalid WAV file (no data chunk): ${filePath}`);
  const dataSize = buf.readUInt32LE(dataOffset);
  const numChannels = buf.readUInt16LE(22);
  const bitDepth = buf.readUInt16LE(34);
  const sampleRate = buf.readUInt32LE(24);

  if (bitDepth !== 16) {
    // Fallback simple read
    const samples16 = new Int16Array(buf.buffer, buf.byteOffset + dataOffset + 4, Math.floor(dataSize / 2));
    const flt = Array.from(samples16).map(s => s / 32767);
    return createAudioSample(new Float32Array(flt), undefined, sampleRate);
  }

  const totalNumSamples = Math.floor(dataSize / 2);
  if (numChannels === 2) {
    const numFrames = Math.floor(totalNumSamples / 2);
    const left = new Float32Array(numFrames);
    const right = new Float32Array(numFrames);
    let bytePtr = dataOffset + 4;
    for (let i = 0; i < numFrames; i++) {
      left[i] = buf.readInt16LE(bytePtr) / 32767;
      right[i] = buf.readInt16LE(bytePtr + 2) / 32767;
      bytePtr += 4;
    }
    return createAudioSample(left, right, sampleRate);
  } else {
    const mono = new Float32Array(totalNumSamples);
    let bytePtr = dataOffset + 4;
    for (let i = 0; i < totalNumSamples; i++) {
      mono[i] = buf.readInt16LE(bytePtr) / 32767;
      bytePtr += 2;
    }
    return createAudioSample(mono, mono, sampleRate);
  }
}

/**
 * Exports sequence to a multi-track Type 1 Standard MIDI File with exact MPC swing timing preserved!
 */
export function exportMidiFile(sequence: MPCSequence, filePath: string, interpreter?: Interpreter): boolean {
  const absPath = ensureSafePath(filePath, interpreter);
  const ppq = 480;
  const tracks: Buffer[] = [];

  // Track 0: Tempo and Time Signature
  const tempoEvents: number[] = [];
  const microsPerQuarter = Math.round(60000000 / sequence.bpm);
  // Time Signature meta-event: 00 FF 58 04 nn dd cc bb
  tempoEvents.push(0x00, 0xFF, 0x58, 0x04, sequence.timeSignature[0], Math.log2(sequence.timeSignature[1]), 24, 8);
  // Set Tempo meta-event: 00 FF 51 03 tt tt tt
  tempoEvents.push(0x00, 0xFF, 0x51, 0x03, (microsPerQuarter >> 16) & 0xFF, (microsPerQuarter >> 8) & 0xFF, microsPerQuarter & 0xFF);
  // End of track: 00 FF 2F 00
  tempoEvents.push(0x00, 0xFF, 0x2F, 0x00);
  tracks.push(createMidiTrackBuffer(Buffer.from(tempoEvents)));

  // Music Tracks
  const sixteenthTicks = ppq / 4; // 120 ticks per 16th note

  for (let tIdx = 0; tIdx < sequence.tracks.length; tIdx++) {
    const track = sequence.tracks[tIdx];
    const events: number[] = [];
    const channel = track.type === 'drum' ? 9 : (tIdx % 16); // MIDI Channel 10 (0-indexed 9) for drums

    // Track Name meta-event
    const nameBytes = Buffer.from(track.name);
    events.push(0x00, 0xFF, 0x03);
    writeVarLen(events, nameBytes.length);
    for (let b = 0; b < nameBytes.length; b++) events.push(nameBytes[b]);

    // Build list of MIDI note-on and note-off events with absolute ticks
    interface TimedMidiEvent {
      tick: number;
      isNoteOn: boolean;
      midiNote: number;
      vel: number;
    }
    const midiEventList: TimedMidiEvent[] = [];

    for (const ev of track.events) {
      let tick = 0;
      if (typeof ev.time_ms === 'number') {
        const msPerTick = (60000 / sequence.bpm) / ppq;
        tick = Math.round(ev.time_ms / msPerTick);
      } else {
        const step = ev.step || 0;
        let stepTicks = step * sixteenthTicks;
        // Apply Roger Linn MPC swing to odd 16th notes
        if (sequence.swing > 50 && step % 2 === 1) {
          const swingOffsetTicks = Math.round(((sequence.swing - 50) / 50) * (sixteenthTicks / 2));
          stepTicks += swingOffsetTicks;
        }
        tick = stepTicks;
      }

      // Map Pad 1..16 to General MIDI Drum notes: C1 (36), C#1 (37), D1 (38), etc.
      const midiNote = typeof ev.note === 'number' ? ev.note : (35 + ev.pad);
      const vel = sequence.fullLevel ? 127 : (sequence.halfLevel ? 64 : (ev.velocity || 100));
      const durTicks = ev.duration_ms ? Math.round((ev.duration_ms / (60000 / sequence.bpm)) * ppq) : sixteenthTicks;

      midiEventList.push({ tick, isNoteOn: true, midiNote, vel });
      midiEventList.push({ tick: tick + durTicks, isNoteOn: false, midiNote, vel: 0 });
    }

    // Sort by tick
    midiEventList.sort((a, b) => a.tick - b.tick);

    let lastTick = 0;
    for (const me of midiEventList) {
      const delta = Math.max(0, me.tick - lastTick);
      writeVarLen(events, delta);
      if (me.isNoteOn) {
        events.push(0x90 | (channel & 0x0F), me.midiNote, me.vel);
      } else {
        events.push(0x80 | (channel & 0x0F), me.midiNote, 0x00);
      }
      lastTick = me.tick;
    }

    // End of track
    events.push(0x00, 0xFF, 0x2F, 0x00);
    tracks.push(createMidiTrackBuffer(Buffer.from(events)));
  }

  // Header: MThd, 6 bytes, format 1, num tracks, division
  const header = Buffer.from([
    0x4D, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01, // Type 1
    (tracks.length >> 8) & 0xFF, tracks.length & 0xFF,
    (ppq >> 8) & 0xFF, ppq & 0xFF,
  ]);

  const fullMidi = Buffer.concat([header, ...tracks]);
  fs.writeFileSync(absPath, fullMidi);
  return true;
}

function createMidiTrackBuffer(trackData: Buffer): Buffer {
  const head = Buffer.from([0x4D, 0x54, 0x72, 0x6B]); // MTrk
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(trackData.length, 0);
  return Buffer.concat([head, lenBuf, trackData]);
}

function writeVarLen(arr: number[], value: number): void {
  let buffer = value & 0x7F;
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= 0x80;
    buffer |= (value & 0x7F);
  }
  while (true) {
    arr.push(buffer & 0xFF);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
}

// -------------------------------------------------------------------------
// Sesi Module Bridge (createMpcModule)
// -------------------------------------------------------------------------

export function createMpcModule(interpreter: Interpreter): Map<string, RuntimeValue> {
  const exports = new Map<string, RuntimeValue>();

  // 1. MPC.create / MPC.project
  exports.set('create', bindNativeMethod('create', ['config'], (configVal?: RuntimeValue): RuntimeValue => {
    const config = (typeof configVal === 'object' && configVal !== null ? configVal : {}) as any;
    const bpm = typeof config.bpm === 'number' ? config.bpm : 90;
    const swing = typeof config.swing === 'number' ? config.swing : 50;
    const seq = new MPCSequence(config.name || 'MPC Project', config.bars || 2, bpm, config.time_signature || '4/4');
    seq.swing = swing;
    if (config.vintage) seq.addMasterEffect('vintage', { mode: config.vintage });
    return createSequenceRuntimeObject(seq, interpreter);
  }));

  exports.set('project', exports.get('create')!);

  // 2. MPC.sequence(name, bars, bpm, timeSig)
  exports.set('sequence', bindNativeMethod('sequence', ['name', 'bars', 'bpm', 'time_sig'], (...args: RuntimeValue[]): RuntimeValue => {
    let name = 'Sequence 01';
    let bars = 2;
    let bpm = 90;
    let timeSig = '4/4';

    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const cfg = args[0] as any;
      name = cfg.name || name;
      bars = typeof cfg.bars === 'number' ? cfg.bars : bars;
      bpm = typeof cfg.bpm === 'number' ? cfg.bpm : bpm;
      timeSig = cfg.time_sig || cfg.time_signature || timeSig;
    } else {
      if (typeof args[0] === 'string') name = args[0];
      if (typeof args[1] === 'number') bars = args[1];
      if (typeof args[2] === 'number') bpm = args[2];
      if (typeof args[3] === 'string') timeSig = args[3];
    }

    const seq = new MPCSequence(name, bars, bpm, timeSig);
    return createSequenceRuntimeObject(seq, interpreter);
  }));

  // 3. MPC.drum_kit(nameOrPreset)
  exports.set('drum_kit', bindNativeMethod('drum_kit', ['name_or_preset'], (arg?: RuntimeValue): RuntimeValue => {
    const name = typeof arg === 'string' ? arg : 'Akai MPC Kit';
    const kit = new MPCDrumKit(name);
    return createDrumKitRuntimeObject(kit, interpreter);
  }));

  exports.set('program', exports.get('drum_kit')!);

  // 4. MPC.pad(padNumber, sound, options)
  exports.set('pad', bindNativeMethod('pad', ['pad_number', 'sound', 'options'], (padNumVal, soundVal, optsVal): RuntimeValue => {
    const pad = typeof padNumVal === 'number' ? padNumVal : 1;
    const sound = typeof soundVal === 'string' ? soundVal : 'kick';
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    const padCfg: MPCPadConfig = {
      pad,
      sound,
      name: opts.name || `Pad ${pad}`,
      tune: typeof opts.tune === 'number' ? opts.tune : 0,
      fine: typeof opts.fine === 'number' ? opts.fine : 0,
      level: typeof opts.level === 'number' ? opts.level : (typeof opts.vol === 'number' ? opts.vol : 1.0),
      pan: typeof opts.pan === 'number' ? opts.pan : 0.0,
      mute_group: typeof opts.mute_group === 'number' ? opts.mute_group : (typeof opts.choke === 'number' ? opts.choke : 0),
      play_mode: opts.play_mode || 'one_shot',
      attack: typeof opts.attack === 'number' ? opts.attack : 0,
      decay: typeof opts.decay === 'number' ? opts.decay : 300,
      release: typeof opts.release === 'number' ? opts.release : 50,
      filter_type: opts.filter_type || 'none',
      filter_cutoff: typeof opts.filter_cutoff === 'number' ? opts.filter_cutoff : 20000,
      filter_resonance: typeof opts.filter_resonance === 'number' ? opts.filter_resonance : 0.1,
    };
    return padCfg as any;
  }));

  // 5. MPC.sixteen_levels(pad, mode, options)
  exports.set('sixteen_levels', bindNativeMethod('sixteen_levels', ['pad', 'mode', 'options'], (padVal, modeVal, optsVal): RuntimeValue => {
    const padCfg: MPCPadConfig = (typeof padVal === 'object' && padVal !== null ? padVal : { pad: 1, sound: 'kick' }) as any;
    const mode = typeof modeVal === 'string' ? modeVal : 'velocity';
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    return sixteenLevels(padCfg, mode, opts) as any;
  }));

  // 6. MPC.note_repeat(pad, rate, bars, options)
  exports.set('note_repeat', bindNativeMethod('note_repeat', ['pad', 'rate', 'bars', 'options'], (padVal, rateVal, barsVal, optsVal): RuntimeValue => {
    const pad = typeof padVal === 'number' ? padVal : 1;
    const rate = typeof rateVal === 'string' ? rateVal : '1/16';
    const bars = typeof barsVal === 'number' ? barsVal : 1;
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    return noteRepeat(pad, rate, bars, opts) as any;
  }));

  // 7. MPC.swing(events, percent, grid)
  exports.set('swing', bindNativeMethod('swing', ['events', 'percent', 'grid'], (eventsVal, percentVal, gridVal): RuntimeValue => {
    const events = Array.isArray(eventsVal) ? (eventsVal as any[]) : [];
    const percent = typeof percentVal === 'number' ? percentVal : 58;
    const grid = typeof gridVal === 'string' ? gridVal : '1/16';
    return events.map(ev => {
      const step = (ev && typeof ev === 'object' && typeof ev.step === 'number') ? ev.step : 0;
      const offsetMs = calculateSwingOffsetMs(step, 90, percent, grid);
      return typeof ev === 'object' && ev !== null ? { ...ev, swing_offset_ms: offsetMs } : { swing_offset_ms: offsetMs };
    });
  }));

  // 8. MPC.chop / MPC.slice(sample, slices, options)
  exports.set('chop', bindNativeMethod('chop', ['sample', 'slices', 'options'], (sampleVal, slicesVal, optsVal): RuntimeValue => {
    let audio: AudioSample;
    if (typeof sampleVal === 'string') {
      audio = loadWavFile(sampleVal, interpreter);
    } else if (sampleVal && typeof sampleVal === 'object' && (sampleVal as any).type === 'audio_sample') {
      audio = sampleVal as any as AudioSample;
    } else {
      throw new Error('MPC.chop expects an audio sample or a path to a WAV file.');
    }
    const slices = typeof slicesVal === 'number' ? slicesVal : 16;
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    const kit = chopSample(audio, slices, opts);
    return createDrumKitRuntimeObject(kit, interpreter);
  }));

  exports.set('slice', exports.get('chop')!);

  // 9. MPC.sample(type, options)
  exports.set('sample', bindNativeMethod('sample', ['type_or_path', 'options'], (typeVal, optsVal): RuntimeValue => {
    const sound = typeof typeVal === 'string' ? typeVal : 'kick';
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    if (sound.endsWith('.wav') || sound.includes('/') || sound.includes('\\')) {
      return loadWavFile(sound, interpreter) as any;
    }
    return synthesizeDrum(sound, opts) as any;
  }));

  // 10. MPC.vintage(mode, sample)
  exports.set('vintage', bindNativeMethod('vintage', ['mode', 'sample'], (modeVal, sampleVal): RuntimeValue => {
    const mode = typeof modeVal === 'string' ? modeVal : 'mpc60';
    if (!sampleVal || typeof sampleVal !== 'object' || (sampleVal as any).type !== 'audio_sample') {
      throw new Error('MPC.vintage expects an audio_sample as second argument.');
    }
    const sample = sampleVal as any as AudioSample;
    const copyL = new Float32Array(sample.samples);
    const copyR = new Float32Array(sample.samplesR ?? sample.samples);
    applyVintageMode(copyL, copyR, mode);
    return createAudioSample(copyL, copyR, sample.sampleRate) as any;
  }));

  // 11. MPC.effect / MPC.fx(type, params)
  exports.set('effect', bindNativeMethod('effect', ['type', 'params'], (typeVal, paramsVal): RuntimeValue => {
    const type = typeof typeVal === 'string' ? typeVal : 'filter';
    const params = (typeof paramsVal === 'object' && paramsVal !== null ? paramsVal : {}) as any;
    return { type: 'mpc_effect', effect_type: type, params } as any;
  }));

  exports.set('fx', exports.get('effect')!);

  // 12. MPC.song(steps)
  exports.set('song', bindNativeMethod('song', ['steps', 'name'], (stepsVal, nameVal): RuntimeValue => {
    const song = new MPCSong(typeof nameVal === 'string' ? nameVal : 'MPC Song');
    if (Array.isArray(stepsVal)) {
      for (const item of (stepsVal as any[])) {
        if (item && item.sequence) {
          const rawSeq = item.sequence._raw || item.sequence;
          song.addStep(rawSeq, item.repeats || 1, item.mutes || []);
        } else if (item && item._raw) {
          song.addStep(item._raw, 1);
        }
      }
    }
    return createSongRuntimeObject(song, interpreter);
  }));

  // 13. MPC.render_wav(target, filePath, options)
  exports.set('render_wav', bindNativeMethod('render_wav', ['target', 'path', 'options'], (targetVal, pathVal): RuntimeValue => {
    const filePath = typeof pathVal === 'string' ? pathVal : (typeof targetVal === 'string' ? targetVal : 'mpc_render.wav');
    const target = (typeof targetVal === 'object' && targetVal !== null) ? targetVal : null;
    let audio: AudioSample;

    if (target && (target as any)._raw instanceof MPCSequence) {
      audio = renderSequenceAudio((target as any)._raw, interpreter);
    } else if (target && (target as any)._raw instanceof MPCSong) {
      audio = renderSongAudio((target as any)._raw, interpreter);
    } else if (target && (target as any).type === 'audio_sample') {
      audio = target as any as AudioSample;
    } else {
      throw new Error('MPC.render_wav expects an MPC sequence, song, or sample as target.');
    }

    if (filePath === 'memory') {
      return audio as any;
    }
    exportWavFile(audio, filePath, interpreter);
    return true;
  }));

  // 14. MPC.render_midi(target, filePath)
  exports.set('render_midi', bindNativeMethod('render_midi', ['target', 'path'], (targetVal, pathVal): RuntimeValue => {
    const filePath = typeof pathVal === 'string' ? pathVal : 'mpc_sequence.mid';
    const target = (typeof targetVal === 'object' && targetVal !== null) ? targetVal : null;

    if (target && (target as any)._raw instanceof MPCSequence) {
      exportMidiFile((target as any)._raw, filePath, interpreter);
      return true;
    }
    throw new Error('MPC.render_midi expects an MPC sequence as target.');
  }));

  // 15. MPC.play(target, options)
  exports.set('play', bindNativeMethod('play', ['target', 'options'], async (targetVal): Promise<RuntimeValue> => {
    let audio: AudioSample;
    const target = (typeof targetVal === 'object' && targetVal !== null) ? targetVal : null;

    if (target && (target as any)._raw instanceof MPCSequence) {
      audio = renderSequenceAudio((target as any)._raw, interpreter);
    } else if (target && (target as any)._raw instanceof MPCSong) {
      audio = renderSongAudio((target as any)._raw, interpreter);
    } else if (target && (target as any).type === 'audio_sample') {
      audio = target as any as AudioSample;
    } else {
      throw new Error('MPC.play expects an MPC sequence, song, or sample.');
    }

    const tmp = path.join(process.cwd(), `.tmp_mpc_play_${Date.now()}.wav`);
    exportWavFile(audio, tmp, interpreter);
    try {
      if (process.platform === 'darwin') {
        execSync(`afplay "${tmp}"`);
      } else if (process.platform === 'win32') {
        execSync(`powershell -c "(New-Object Media.SoundPlayer '${tmp}').PlaySync()"`);
      }
    } catch {} finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
    return null;
  }));

  return exports;
}

// -------------------------------------------------------------------------
// Runtime Object Wrappers (for fluent method calls in Sesi)
// -------------------------------------------------------------------------

function createSequenceRuntimeObject(seq: MPCSequence, interpreter: Interpreter): Record<string, RuntimeValue> {
  const obj: Record<string, RuntimeValue> = Object.create(null);
  obj._raw = seq as any;
  Object.defineProperty(obj, 'name', { get: () => seq.name, set: (v) => { seq.name = v; }, enumerable: true, configurable: true });
  Object.defineProperty(obj, 'bars', { get: () => seq.bars, set: (v) => { seq.bars = v; }, enumerable: true, configurable: true });
  Object.defineProperty(obj, 'bpm', { get: () => seq.bpm, set: (v) => { seq.bpm = v; }, enumerable: true, configurable: true });
  Object.defineProperty(obj, 'swing', { get: () => seq.swing, set: (v) => { seq.swing = v; }, enumerable: true, configurable: true });

  obj.add_track = bindNativeMethod('add_track', ['name', 'type', 'kit'], (nameVal, typeVal, kitVal): RuntimeValue => {
    const name = typeof nameVal === 'string' ? nameVal : `Track ${seq.tracks.length + 1}`;
    const type = (typeof typeVal === 'string' ? typeVal : 'drum') as any;
    const rawKit = kitVal && (kitVal as any)._raw ? (kitVal as any)._raw : undefined;
    const track = seq.addTrack(name, type, rawKit);
    return createTrackRuntimeObject(track, seq, interpreter);
  });

  obj.get_track = bindNativeMethod('get_track', ['name_or_index'], (nameOrIdx): RuntimeValue => {
    const track = seq.getTrack(nameOrIdx as any);
    if (!track) return null;
    return createTrackRuntimeObject(track, seq, interpreter);
  });

  obj.set_bpm = bindNativeMethod('set_bpm', ['bpm'], (bpmVal): RuntimeValue => {
    if (typeof bpmVal === 'number') seq.bpm = bpmVal;
    return obj;
  });

  obj.set_swing = bindNativeMethod('set_swing', ['swing'], (swingVal): RuntimeValue => {
    if (typeof swingVal === 'number') seq.swing = Math.min(75, Math.max(50, swingVal));
    return obj;
  });

  obj.set_vintage = bindNativeMethod('set_vintage', ['mode'], (modeVal): RuntimeValue => {
    const mode = typeof modeVal === 'string' ? modeVal : 'mpc60';
    seq.addMasterEffect('vintage', { mode });
    return obj;
  });

  obj.add_effect = bindNativeMethod('add_effect', ['type', 'params'], (typeVal, paramsVal): RuntimeValue => {
    const type = typeof typeVal === 'string' ? typeVal : 'filter';
    const params = (typeof paramsVal === 'object' && paramsVal !== null ? paramsVal : {}) as any;
    seq.addMasterEffect(type, params);
    return obj;
  });

  obj.set_full_level = bindNativeMethod('set_full_level', ['enabled'], (val): RuntimeValue => {
    seq.fullLevel = val !== false;
    return obj;
  });

  obj.set_half_level = bindNativeMethod('set_half_level', ['enabled'], (val): RuntimeValue => {
    seq.halfLevel = val !== false;
    return obj;
  });

  obj.render_wav = bindNativeMethod('render_wav', ['path'], (pathVal): RuntimeValue => {
    const filePath = typeof pathVal === 'string' ? pathVal : `${seq.name.replace(/\s+/g, '_')}.wav`;
    const audio = renderSequenceAudio(seq, interpreter);
    if (filePath === 'memory') return audio as any;
    exportWavFile(audio, filePath, interpreter);
    return true;
  });

  obj.render_midi = bindNativeMethod('render_midi', ['path'], (pathVal): RuntimeValue => {
    const filePath = typeof pathVal === 'string' ? pathVal : `${seq.name.replace(/\s+/g, '_')}.mid`;
    exportMidiFile(seq, filePath, interpreter);
    return true;
  });

  obj.play = bindNativeMethod('play', [], async (): Promise<RuntimeValue> => {
    const audio = renderSequenceAudio(seq, interpreter);
    const tmp = path.join(process.cwd(), `.tmp_mpc_play_${Date.now()}.wav`);
    exportWavFile(audio, tmp, interpreter);
    try {
      if (process.platform === 'darwin') execSync(`afplay "${tmp}"`);
      else if (process.platform === 'win32') execSync(`powershell -c "(New-Object Media.SoundPlayer '${tmp}').PlaySync()"`);
    } catch {} finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
    return null;
  });

  return obj;
}

function createTrackRuntimeObject(track: MPCTrack, seq: MPCSequence, interpreter: Interpreter): Record<string, RuntimeValue> {
  const obj: Record<string, RuntimeValue> = Object.create(null);
  obj._raw = track as any;
  obj.name = track.name;
  obj.type = track.type;

  obj.pattern = bindNativeMethod('pattern', ['pad', 'pattern_string', 'options'], (padVal, patVal, optsVal): RuntimeValue => {
    const pad = typeof padVal === 'number' ? padVal : 1;
    const pat = typeof patVal === 'string' ? patVal : '';
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    track.pattern(pad, pat, opts);
    return obj;
  });

  obj.step = bindNativeMethod('step', ['step_num', 'pad', 'velocity', 'options'], (stepVal, padVal, velVal, optsVal): RuntimeValue => {
    const step = typeof stepVal === 'number' ? stepVal : 0;
    const pad = typeof padVal === 'number' ? padVal : 1;
    const vel = typeof velVal === 'number' ? velVal : 100;
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    track.addEvent({ pad, step, velocity: vel, ...opts });
    return obj;
  });

  obj.repeat = bindNativeMethod('repeat', ['pad', 'rate', 'bars', 'options'], (padVal, rateVal, barsVal, optsVal): RuntimeValue => {
    const pad = typeof padVal === 'number' ? padVal : 1;
    const rate = typeof rateVal === 'string' ? rateVal : '1/16';
    const bars = typeof barsVal === 'number' ? barsVal : 1;
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    const repeats = noteRepeat(pad, rate, bars, opts);
    for (const r of repeats) track.addEvent(r);
    return obj;
  });

  obj.add_effect = bindNativeMethod('add_effect', ['type', 'params'], (typeVal, paramsVal): RuntimeValue => {
    const type = typeof typeVal === 'string' ? typeVal : 'filter';
    const params = (typeof paramsVal === 'object' && paramsVal !== null ? paramsVal : {}) as any;
    track.addEffect(type, params);
    return obj;
  });

  obj.mute = bindNativeMethod('mute', ['state'], (stateVal): RuntimeValue => {
    track.muted = stateVal !== false;
    return obj;
  });

  obj.solo = bindNativeMethod('solo', ['state'], (stateVal): RuntimeValue => {
    track.solo = stateVal !== false;
    return obj;
  });

  obj.set_volume = bindNativeMethod('set_volume', ['vol'], (volVal): RuntimeValue => {
    if (typeof volVal === 'number') track.volume = Math.max(0, volVal);
    return obj;
  });

  obj.set_pan = bindNativeMethod('set_pan', ['pan'], (panVal): RuntimeValue => {
    if (typeof panVal === 'number') track.pan = Math.max(-1, Math.min(1, panVal));
    return obj;
  });

  return obj;
}

function createDrumKitRuntimeObject(kit: MPCDrumKit, interpreter: Interpreter): Record<string, RuntimeValue> {
  const obj: Record<string, RuntimeValue> = Object.create(null);
  obj._raw = kit as any;
  obj.name = kit.name;

  obj.set_pad = bindNativeMethod('set_pad', ['pad_num', 'config'], (padVal, cfgVal): RuntimeValue => {
    const padNum = typeof padVal === 'number' ? padVal : 1;
    const cfg = (typeof cfgVal === 'object' && cfgVal !== null ? cfgVal : {}) as any;
    kit.setPad(padNum, cfg);
    return obj;
  });

  obj.get_pad = bindNativeMethod('get_pad', ['pad_num'], (padVal): RuntimeValue => {
    const padNum = typeof padVal === 'number' ? padVal : 1;
    return kit.getPad(padNum) as any;
  });

  obj.sixteen_levels = bindNativeMethod('sixteen_levels', ['pad_num', 'mode', 'options'], (padVal, modeVal, optsVal): RuntimeValue => {
    const padNum = typeof padVal === 'number' ? padVal : 1;
    const mode = typeof modeVal === 'string' ? modeVal : 'velocity';
    const opts = (typeof optsVal === 'object' && optsVal !== null ? optsVal : {}) as any;
    const pad = kit.getPad(padNum);
    return sixteenLevels(pad, mode, opts) as any;
  });

  return obj;
}

function createSongRuntimeObject(song: MPCSong, interpreter: Interpreter): Record<string, RuntimeValue> {
  const obj: Record<string, RuntimeValue> = Object.create(null);
  obj._raw = song as any;
  obj.name = song.name;

  obj.add_step = bindNativeMethod('add_step', ['sequence', 'repeats', 'mutes'], (seqVal, repVal, mutesVal): RuntimeValue => {
    const rawSeq = seqVal && (seqVal as any)._raw ? (seqVal as any)._raw : seqVal;
    const repeats = typeof repVal === 'number' ? repVal : 1;
    const mutes = Array.isArray(mutesVal) ? mutesVal.map(String) : [];
    song.addStep(rawSeq, repeats, mutes);
    return obj;
  });

  obj.render_wav = bindNativeMethod('render_wav', ['path'], (pathVal): RuntimeValue => {
    const filePath = typeof pathVal === 'string' ? pathVal : `${song.name.replace(/\s+/g, '_')}.wav`;
    const audio = renderSongAudio(song, interpreter);
    if (filePath === 'memory') return audio as any;
    exportWavFile(audio, filePath, interpreter);
    return true;
  });

  return obj;
}
