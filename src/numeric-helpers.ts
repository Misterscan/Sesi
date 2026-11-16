/** Self-contained factory, also embedded into browser builds. */
export function createNumericHelpers() {
  function finite(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${name} expects finite numbers`);
    }
    return value;
  }

  function clamp(value: number, min = 0, max = 1): number {
    finite(value, 'clamp'); finite(min, 'clamp'); finite(max, 'clamp');
    if (min > max) throw new Error('clamp expects min <= max');
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a: number, b: number, t: number): number {
    finite(a, 'lerp'); finite(b, 'lerp'); finite(t, 'lerp');
    return (1 - t) * a + t * b;
  }

  /** FNV-1a over UTF-16 code units, normalized to [0, 1). Not cryptographic. */
  function hash(value: number | string, seed = 0): number {
    if (typeof value !== 'string') finite(value, 'hash');
    finite(seed, 'hash');
    let result = (2166136261 ^ seed) >>> 0;
    const text = String(value);
    for (let i = 0; i < text.length; i++) {
      result = Math.imul(result ^ text.charCodeAt(i), 16777619);
    }
    // Avalanche nearby inputs before normalization.
    result ^= result >>> 16;
    result = Math.imul(result, 0x7feb352d);
    result ^= result >>> 15;
    result = Math.imul(result, 0x846ca68b);
    return ((result ^ (result >>> 16)) >>> 0) / 4294967296;
  }

  /** Seeded two-dimensional value noise with smooth interpolation. */
  function noise(x: number, y = 0, seed = 0): number {
    finite(x, 'noise'); finite(y, 'noise'); finite(seed, 'noise');
    const ix = Math.floor(x), iy = Math.floor(y);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const sx = smooth(x - ix), sy = smooth(y - iy);
    const sample = (dx: number, dy: number) => hash(`${ix + dx},${iy + dy}`, seed);
    return lerp(lerp(sample(0, 0), sample(1, 0), sx), lerp(sample(0, 1), sample(1, 1), sx), sy);
  }

  function fractal(x: number, y = 0, octaves = 4, persistence = 0.5, lacunarity = 2, seed = 0): number {
    finite(x, 'fractal'); finite(y, 'fractal'); finite(octaves, 'fractal');
    finite(persistence, 'fractal'); finite(lacunarity, 'fractal'); finite(seed, 'fractal');
    if (!Number.isInteger(octaves) || octaves < 1 || octaves > 32) throw new Error('fractal expects 1 to 32 integer octaves');
    if (persistence < 0 || persistence > 1 || lacunarity <= 0) throw new Error('fractal expects persistence in [0, 1] and positive lacunarity');
    let total = 0, weight = 0, amplitude = 1;
    for (let i = 0; i < octaves; i++) {
      total += noise(x, y, seed + i) * amplitude;
      weight += amplitude;
      if (i + 1 < octaves && persistence !== 0) { x *= lacunarity; y *= lacunarity; }
      else break;
      amplitude *= persistence;
    }
    return total / weight;
  }
  return { finite, clamp, lerp, hash, noise, fractal };
}
