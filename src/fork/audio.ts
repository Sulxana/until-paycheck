// Synthesized sound for the runner: Karplus–Strong plucks (a pandur-like string), a light loop, small effects.
// The AudioContext is created on the first tap (browsers block sound before a gesture). Nothing here is required:
// if Web Audio is missing or fails, every call is a no-op.

const MUTE_KEY = 'fork-muted-v1'
const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// loop: 4 bars × 8 eighth-notes in A minor / dorian; 0 = rest
const MELODY = [
  69, 0, 72, 0, 76, 74, 72, 0,
  71, 0, 74, 0, 67, 0, 71, 0,
  72, 0, 76, 0, 81, 79, 76, 0,
  74, 72, 71, 0, 69, 0, 0, 0,
]
const CHORDS = [[57, 60, 64], [55, 59, 62], [57, 60, 64], [52, 55, 59]]
const BASS = [45, 43, 45, 40]
// the rent mountain: same pulse, lower and plainer (D minor ↔ E)
const T_MELODY = [
  62, 0, 0, 65, 0, 0, 64, 0,
  64, 0, 0, 68, 0, 0, 71, 0,
  62, 0, 0, 65, 0, 69, 0, 0,
  68, 0, 64, 0, 0, 0, 0, 0,
]
const T_CHORDS = [[50, 53, 57], [52, 56, 59], [50, 53, 57], [52, 56, 59]]
const T_BASS = [38, 40, 38, 40]

class ForkAudio {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private sfx: GainNode | null = null
  private noise: AudioBuffer | null = null
  private strings = new Map<number, AudioBuffer>()
  private timer = 0
  private nextT = 0
  private stepN = 0
  private tension = false
  private calm = false
  muted = false

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* storage blocked */ }
  }

  /** call from a user gesture */
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        this.ctx = ctx
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = -18
        comp.ratio.value = 4
        comp.connect(ctx.destination)
        this.master = ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 0.9
        this.master.connect(comp)
        this.music = ctx.createGain()
        this.music.gain.value = 0.32
        this.music.connect(this.master)
        this.sfx = ctx.createGain()
        this.sfx.gain.value = 0.6
        this.sfx.connect(this.master)
        const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const d = n.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        this.noise = n
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch { this.ctx = null }
  }

  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* ignore */ }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05)
  }
  suspend() { try { void this.ctx?.suspend() } catch { /* ignore */ } }
  resume() { try { if (this.ctx?.state === 'suspended') void this.ctx.resume() } catch { /* ignore */ } }

  // ---------------- music ----------------
  startMusic(calm: boolean) {
    if (!this.ctx || this.timer) return
    this.calm = calm
    this.nextT = this.ctx.currentTime + 0.08
    this.stepN = 0
    this.timer = window.setInterval(() => this.schedule(), 30)
  }
  stopMusic() { if (this.timer) { clearInterval(this.timer); this.timer = 0 } }
  setTension(on: boolean) { this.tension = on && !this.calm }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const eighth = 60 / 118 / 2
    while (this.nextT < ctx.currentTime + 0.14) {
      const i = this.stepN % 32
      const bar = Math.floor(i / 8), s = i % 8
      const t = this.nextT
      const mel = this.tension ? T_MELODY : MELODY
      const ch = this.tension ? T_CHORDS : CHORDS
      const bs = this.tension ? T_BASS : BASS
      if (s === 0 || s === 4) {
        this.pluck(bs[bar], t, 0.34, this.music!, 0.9)
        ch[bar].forEach((n, k) => this.pluck(n, t + 0.018 * k, 0.12, this.music!, 0.55))
      }
      if (s === 2 || s === 6) ch[bar].forEach((n, k) => this.pluck(n + 12, t + 0.012 * k, 0.05, this.music!, 0.5))
      if (mel[i]) this.pluck(mel[i], t, this.tension ? 0.16 : 0.2, this.music!, 0.7)
      // doli-like pulse: soft low thump on beats, a tick on off-beats
      if (s % 2 === 0) this.thump(t, this.tension ? 0.22 : 0.15)
      else this.tick(t, 0.035)
      this.nextT += eighth
      this.stepN++
    }
  }

  private string(midi: number): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    let b = this.strings.get(midi)
    if (b) return b
    const sr = ctx.sampleRate
    const f = midiHz(midi)
    const len = Math.floor(sr * 1.4)
    b = ctx.createBuffer(1, len, sr)
    const out = b.getChannelData(0)
    const N = Math.max(2, Math.round(sr / f))
    const ring = new Float32Array(N)
    let prev = 0
    for (let i = 0; i < N; i++) { prev += 0.55 * (Math.random() * 2 - 1 - prev); ring[i] = prev }
    let idx = 0
    const decay = midi > 76 ? 0.990 : 0.996
    for (let i = 0; i < len; i++) {
      const a = ring[idx], c = ring[(idx + 1) % N]
      out[i] = a
      ring[idx] = decay * 0.5 * (a + c)
      idx = (idx + 1) % N
    }
    let peak = 0
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]))
    const g = peak > 0 ? 0.9 / peak : 1
    for (let i = 0; i < len; i++) out[i] *= g * (i > len - 2000 ? (len - i) / 2000 : 1)
    this.strings.set(midi, b)
    return b
  }

  private pluck(midi: number, t: number, vol: number, dest: AudioNode, bright = 0.7) {
    const ctx = this.ctx
    const buf = this.string(midi)
    if (!ctx || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200 + bright * 4200
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(lp).connect(g).connect(dest)
    src.start(t)
    src.stop(t + 1.4)
  }

  private thump(t: number, vol: number) {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    o.connect(g).connect(this.music)
    o.start(t)
    o.stop(t + 0.18)
  }

  private tick(t: number, vol: number) { this.noiseHit(t, vol, 'highpass', 5200, 0.04, this.music) }

  private noiseHit(t: number, vol: number, type: BiquadFilterType, freq: number, dur: number, dest: AudioNode | null, to?: number) {
    const ctx = this.ctx
    if (!ctx || !this.noise || !dest) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
    f.Q.value = type === 'bandpass' ? 1.2 : 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(dest)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx
    if (!ctx || !this.sfx) return
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  private notes(ns: number[], gap: number, vol = 0.5) {
    const ctx = this.ctx
    if (!ctx || !this.sfx) return
    ns.forEach((n, k) => this.pluck(n, ctx.currentTime + 0.01 + k * gap, vol, this.sfx!, 0.9))
  }

  // ---------------- effects ----------------
  whoosh() { if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.5, 'bandpass', 500, 0.28, this.sfx, 2600) }
  jump() { this.tone('sine', 330, 700, 0.14, 0.22) }
  land() { this.tone('sine', 140, 60, 0.09, 0.18) }
  hover() { this.tone('triangle', 900, 1000, 0.04, 0.06) }
  joy() { this.notes([81, 88], 0.07, 0.55) }
  dodge() { if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.18, 'highpass', 3000, 0.12, this.sfx); this.notes([84], 0, 0.3) }
  scam() { this.tone('triangle', 220, 120, 0.22, 0.28); this.tone('sine', 110, 70, 0.25, 0.2, 0.02) }
  stamp() { if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.35, 'lowpass', 420, 0.12, this.sfx); this.tone('square', 1800, 1600, 0.03, 0.05, 0.02) }
  combo() { this.notes([69, 72, 76, 81], 0.06, 0.55) }
  tired() { this.notes([64, 62, 57], 0.16, 0.4) }
  salary() { this.notes([76, 81, 85, 88], 0.08, 0.5) }
  bell() { this.notes([88, 93, 88, 93], 0.18, 0.5) }
  endSun() { this.notes([69, 73, 76, 81, 85], 0.1, 0.55) }
  endCloud() { this.notes([69, 72, 76], 0.18, 0.45) }
  endStorm() { this.notes([57, 60, 64], 0.28, 0.35) }
}

export const audio = new ForkAudio()
