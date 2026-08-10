import type { RuntimeValue } from './types';

export interface ProfileEntry {
  name: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}

export class SesiProfiler {
  private entries: Map<string, ProfileEntry> = new Map();
  private activeSections: Map<string, number[]> = new Map();

  constructor(public enabled: boolean = false) {}

  hasData(): boolean {
    return this.entries.size > 0;
  }

  time<T>(name: string, fn: () => T): T {
    if (!this.enabled) return fn();
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.record(name, performance.now() - start);
    }
  }

  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return await fn();
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.record(name, performance.now() - start);
    }
  }

  start(name: string): string {
    const key = normalizeProfileName(name);
    const starts = this.activeSections.get(key) ?? [];
    starts.push(performance.now());
    this.activeSections.set(key, starts);
    return key;
  }

  end(name: string): ProfileEntry {
    const key = normalizeProfileName(name);
    const starts = this.activeSections.get(key);
    if (!starts || starts.length === 0) {
      throw new Error(`profile_end("${key}") was called without a matching profile_start("${key}")`);
    }
    const start = starts.pop()!;
    if (starts.length === 0) this.activeSections.delete(key);
    return this.record(key, performance.now() - start);
  }

  record(name: string, durationMs: number): ProfileEntry {
    const key = normalizeProfileName(name);
    const ms = Math.max(0, durationMs);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { name: key, count: 0, totalMs: 0, minMs: ms, maxMs: ms, lastMs: ms };
      this.entries.set(key, entry);
    }
    entry.count++;
    entry.totalMs += ms;
    entry.minMs = Math.min(entry.minMs, ms);
    entry.maxMs = Math.max(entry.maxMs, ms);
    entry.lastMs = ms;
    return entry;
  }

  snapshot(): ProfileEntry[] {
    return Array.from(this.entries.values())
      .map(entry => ({ ...entry }))
      .sort((a, b) => b.totalMs - a.totalMs || a.name.localeCompare(b.name));
  }

  toRuntimeValue(): RuntimeValue {
    return this.snapshot().map(entry => ({
      name: entry.name,
      count: entry.count,
      total_ms: roundMs(entry.totalMs),
      avg_ms: roundMs(entry.totalMs / entry.count),
      min_ms: roundMs(entry.minMs),
      max_ms: roundMs(entry.maxMs),
      last_ms: roundMs(entry.lastMs),
    }));
  }
}

export function formatProfileReport(profiler: SesiProfiler): string {
  const entries = profiler.snapshot();
  if (entries.length === 0) return 'Profile: no measurements recorded';

  const rows = entries.map(entry => ({
    name: entry.name,
    count: String(entry.count),
    total: roundMs(entry.totalMs).toFixed(3),
    avg: roundMs(entry.totalMs / entry.count).toFixed(3),
    max: roundMs(entry.maxMs).toFixed(3),
  }));

  const nameWidth = Math.max('Name'.length, ...rows.map(row => row.name.length));
  const countWidth = Math.max('Count'.length, ...rows.map(row => row.count.length));
  const totalWidth = Math.max('Total ms'.length, ...rows.map(row => row.total.length));
  const avgWidth = Math.max('Avg ms'.length, ...rows.map(row => row.avg.length));
  const maxWidth = Math.max('Max ms'.length, ...rows.map(row => row.max.length));

  const header = [
    'Name'.padEnd(nameWidth),
    'Count'.padStart(countWidth),
    'Total ms'.padStart(totalWidth),
    'Avg ms'.padStart(avgWidth),
    'Max ms'.padStart(maxWidth),
  ].join('  ');
  const divider = [
    '-'.repeat(nameWidth),
    '-'.repeat(countWidth),
    '-'.repeat(totalWidth),
    '-'.repeat(avgWidth),
    '-'.repeat(maxWidth),
  ].join('  ');
  const body = rows.map(row => [
    row.name.padEnd(nameWidth),
    row.count.padStart(countWidth),
    row.total.padStart(totalWidth),
    row.avg.padStart(avgWidth),
    row.max.padStart(maxWidth),
  ].join('  '));

  return ['Profile:', header, divider, ...body].join('\n');
}

function normalizeProfileName(name: string): string {
  const normalized = String(name || '').trim();
  return normalized || '<anonymous>';
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}
