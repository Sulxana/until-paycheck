// Bit-exact port of CPython's `random` module pieces used by engine_v0.py:
// MT19937 seeded via init_by_array (int seed), random(), uniform(), normalvariate(), lognormvariate().
// Same seed + same call order => identical numbers to the Python engine.

const N = 624
const M = 397
const MATRIX_A = 0x9908b0df
const UPPER_MASK = 0x80000000
const LOWER_MASK = 0x7fffffff

export interface PyRandomState { mt: Uint32Array; mti: number }

export class PyRandom {
  private mt = new Uint32Array(N)
  private mti = N + 1

  constructor(seed: number) { this.seed(seed) }

  private initGenrand(s: number) {
    const mt = this.mt
    mt[0] = s >>> 0
    for (this.mti = 1; this.mti < N; this.mti++) {
      const prev = mt[this.mti - 1] ^ (mt[this.mti - 1] >>> 30)
      // 1812433253 * prev + mti, in uint32 arithmetic
      mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0
    }
  }

  seed(n: number) {
    // CPython: key = abs(n) split into 32-bit words (little endian); n == 0 -> [0]
    let x = Math.abs(Math.trunc(n))
    const key: number[] = []
    if (x === 0) key.push(0)
    while (x > 0) { key.push(x % 4294967296); x = Math.floor(x / 4294967296) }
    this.initGenrand(19650218)
    const mt = this.mt
    let i = 1, j = 0
    let k = N > key.length ? N : key.length
    for (; k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30)
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0
      i++; j++
      if (i >= N) { mt[0] = mt[N - 1]; i = 1 }
      if (j >= key.length) j = 0
    }
    for (k = N - 1; k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30)
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0
      i++
      if (i >= N) { mt[0] = mt[N - 1]; i = 1 }
    }
    mt[0] = 0x80000000
    this.mti = N
  }

  private genrand(): number {
    const mt = this.mt
    let y: number
    if (this.mti >= N) {
      let kk = 0
      for (; kk < N - M; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK)
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK)
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)
      }
      y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK)
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)
      this.mti = 0
    }
    y = mt[this.mti++]
    y ^= y >>> 11
    y ^= (y << 7) & 0x9d2c5680
    y ^= (y << 15) & 0xefc60000
    y ^= y >>> 18
    return y >>> 0
  }

  /** random.random(): 53-bit float in [0, 1) */
  random(): number {
    const a = this.genrand() >>> 5
    const b = this.genrand() >>> 6
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0)
  }

  uniform(a: number, b: number): number { return a + (b - a) * this.random() }

  normalvariate(mu: number, sigma: number): number {
    const NV_MAGICCONST = 4 * Math.exp(-0.5) / Math.sqrt(2.0)
    let z: number
    for (;;) {
      const u1 = this.random()
      const u2 = 1.0 - this.random()
      z = NV_MAGICCONST * (u1 - 0.5) / u2
      const zz = z * z / 4.0
      if (zz <= -Math.log(u2)) break
    }
    return mu + z * sigma
  }

  lognormvariate(mu: number, sigma: number): number { return Math.exp(this.normalvariate(mu, sigma)) }

  getState(): PyRandomState { return { mt: new Uint32Array(this.mt), mti: this.mti } }
  setState(s: PyRandomState) { this.mt = new Uint32Array(s.mt); this.mti = s.mti }
}

/** Python's round() for display: half-to-even at exact .5 */
export function pyRound(x: number, nd = 0): number {
  const f = Math.pow(10, nd)
  const v = x * f
  const r = Math.round(v)
  if (Math.abs(v % 1) === 0.5) return (2 * Math.round(v / 2)) / f
  return r / f
}
