// "გზის გასაყარი" — the simulation core (no React, no DOM): Nino's month as a road of forks, scams and joys.
// Money: salary on day 0, bills on their real days, everyday spending drawn per day, choices at the forks.
// The payday forecast is a Monte Carlo over the rest of the month with common random numbers: the random part
// (everyday spending + unexpected costs) is drawn once per month, summed per day and sorted, so any forecast is
// a shift of the same sorted sample — instant, and two forecasts differ only by the choices.
import { PyRandom } from '../engine/pyrandom'
import { NINO, Persona } from '../engine/personas'
import { getEngine, weatherOf, WeatherKind, KA_MONTHS_FULL } from '../engine/engine'
import { FORKS, CURATED, CURATED_GAPS, CURATED_SURPRISES, SCAMS, JOYS, DECEMBER_JOYS, FATIGUE, SURPRISES, forkById, ForkCard, Opt, ScamDef, JoyDef } from './deck'

// ---------------- tuning ----------------
export const SPEED = 215 // px/s at normal speed
export const CLIMB_SLOW = 0.86 // speed factor on the rent mountain
export const INTRO = 250
export const FORK_LEN = 330
export const SPLIT = 100
export const MERGE = 100
export const LANE_DY = 112
export const GAP_LEN: Record<string, number> = { s: 330, j: 230, '-': 170 }
export const ITEM_AT: Record<string, number> = { s: 150, j: 112 }
export const SUMMIT = 340
export const FINAL = 460
export const CLIMB = 1150
export const DESCENT = 700
export const HILL_H = 140
export const RENT_DAY = 21
export const E_MAX = 10
export const E_START = 6
export const E_RESET = 4
export const FATIGUE_PAUSE = 1.3 // s Jikho sits when ⚡ runs out
export const K_PATHS = 400
/** target share of forecast paths below the cushion on day 0 (forks at their average): a cloudy start */
export const P0_TARGET = 0.2
export const DEFAULT_SEED = 20261110

const N_DAYS = 30

export interface DayInfo { label: string; weekday: number; weekend: boolean; dec: boolean }
export interface OptInst extends Opt { net: number; laterDay: number; backDay: number }
export interface ForkInst { i: number; id: string; card: ForkCard; x: number; day: number; opts: [OptInst, OptInst]; mean: number }
export type Item = { kind: 'scam'; x: number; def: ScamDef } | { kind: 'joy'; x: number; def: JoyDef }
export interface Bill { day: number; label: string; icon: string; amount: number; nominal: number; rent: boolean }
export interface Surprise { day: number; e: string; t: string; p: number }

export interface Month {
  seed: number
  calm: boolean
  p: Persona
  days: DayInfo[]
  salary: number
  startMoney: number
  cushion: number
  forks: ForkInst[]
  items: Item[]
  bills: Bill[]
  surprises: Surprise[]
  /** actual everyday spending per day 0..29 */
  bg: number[]
  /** ⚡ −1 on these days (a working day, or a weekend of chores) */
  drain: boolean[]
  /** x of each day boundary 0..30 (30 = payday arch) */
  dayX: number[]
  length: number
  rentX: number
  climbFrom: number
  descendTo: number
  /** S[i] = sorted random spending of days i..29 over K paths; S[30] = zeros */
  S: Float64Array[]
  kScale: number
}

const shortMonth = (m: number) => KA_MONTHS_FULL[m].slice(0, 3)
const ss = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u) }
function shuffle<T>(rng: PyRandom, xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ---------------- geometry ----------------
export function hillAt(m: Month, x: number): number {
  if (x <= m.climbFrom || x >= m.descendTo) return 0
  if (x <= m.rentX) return HILL_H * ss((x - m.climbFrom) / (m.rentX - m.climbFrom))
  return HILL_H * (1 - ss((x - m.rentX) / (m.descendTo - m.rentX)))
}
export const climbing = (m: Month, x: number) => x > m.climbFrom && x < m.rentX
/** 0 → 1 → 0 along a fork: how far apart the two lanes are at u px after the junction */
export function laneProfile(u: number): number {
  if (u <= 0 || u >= FORK_LEN) return 0
  if (u < SPLIT) return ss(u / SPLIT)
  if (u > FORK_LEN - MERGE) return 1 - ss((u - (FORK_LEN - MERGE)) / MERGE)
  return 1
}
/** lane sign: upper lane goes up the screen (−), lower lane down (+) */
export const laneSign = (side: 0 | 1) => (side === 0 ? -1 : 1)

export function dayAt(m: Month, x: number): number {
  const X = m.dayX
  if (x <= 0) return 0
  if (x >= m.length) return N_DAYS
  let j = 0
  while (j < N_DAYS && X[j + 1] <= x) j++
  return j + (x - X[j]) / Math.max(1, X[j + 1] - X[j])
}

// ---------------- month ----------------
function optInst(o: Opt, forkDay: number): OptInst {
  const d = Math.floor(forkDay)
  const laterDay = o.later ? d + o.later.in : 99
  const backDay = o.back ? Math.max(o.back.day, d + 4) : 99
  const net = o.p + (o.later && laterDay < N_DAYS ? o.later.p : 0) - (o.back && backDay < N_DAYS ? o.back.p : 0)
  return { ...o, net, laterDay, backDay }
}

function randomDeck(rng: PyRandom, days: DayInfo[]): { card: ForkCard; day: number }[] {
  const pick = (cat: ForkCard['cat'], n: number) => shuffle(rng, FORKS.filter(f => f.cat === cat)).slice(0, n)
  const cards = [...pick('conv', 8), ...pick('social', 7), ...pick('want', 4), ...pick('energy', 2), ...pick('chain', 3)]
  const n = cards.length
  const step = (27.6 - 0.2) / (n - 1)
  const slots = Array.from({ length: n }, (_, k) => {
    const s = 0.2 + k * step
    return s > 20.7 && s < 21.3 ? (s < 21 ? 20.6 : 21.4) : s
  })
  const out: ({ card: ForkCard; day: number } | null)[] = new Array(n).fill(null)
  const used = new Set<string>()
  const fits = (c: ForkCard, k: number): number | null => {
    const s = slots[k]
    const lo = Math.max(s - 0.45, s < RENT_DAY ? 0.1 : RENT_DAY + 0.1), hi = Math.min(s + 0.45, s < RENT_DAY ? RENT_DAY - 0.1 : 28.4)
    for (let D = Math.floor(lo); D <= Math.floor(hi); D++) {
      if (!c.when!(D, days[D].weekday)) continue
      const a = Math.max(lo, D + 0.05), b = Math.min(hi, D + 0.95)
      if (a <= b) return (a + b) / 2
    }
    return null
  }
  // tight constraints first (fixed days), then weekend ones, then ranges
  const constrained = shuffle(rng, cards.filter(c => c.when)).sort((a, b) => tight(a) - tight(b))
  for (const c of constrained) {
    const opts = shuffle(rng, slots.map((_, k) => k).filter(k => !out[k] && fits(c, k) !== null))
    if (opts.length) { const k = opts[0]; out[k] = { card: c, day: fits(c, k)! }; used.add(c.id) }
  }
  const spare = shuffle(rng, FORKS.filter(f => !f.when && !cards.includes(f)))
  const plain = shuffle(rng, cards.filter(c => !c.when))
  for (let k = 0; k < n; k++) {
    if (out[k]) continue
    const c = plain.shift() ?? spare.shift()!
    out[k] = { card: c, day: slots[k] }
  }
  return out as { card: ForkCard; day: number }[]
}
const tight = (c: ForkCard) => (['blackfriday', 'giorgoba'].includes(c.id) ? 0 : ['bar', 'trip', 'mom', 'cleaning', 'wedding'].includes(c.id) ? 1 : 2)

function randomGaps(rng: PyRandom, n: number, rentAfter: number): string[] {
  for (let tries = 0; tries < 200; tries++) {
    const g: string[] = new Array(n).fill('-')
    g[0] = 'j'; g[1] = 's'
    const rest = shuffle(rng, Array.from({ length: n - 2 }, (_, k) => k + 2))
    let s = 1, j = 1
    for (const k of rest) {
      if (k === rentAfter || k === rentAfter - 1) continue // the climb stays clear
      if (s < 8 && g[k - 1] !== 's' && g[k + 1] !== 's') { g[k] = 's'; s++ }
      else if (j < 10) { g[k] = 'j'; j++ }
    }
    if (s === 8) return g
  }
  return CURATED_GAPS.split('').slice(0, n)
}

export function buildMonth(seed = DEFAULT_SEED, calm = false): Month {
  const p = NINO
  const e = getEngine(p)
  const rng = new PyRandom(seed)
  const days: DayInfo[] = Array.from({ length: N_DAYS + 1 }, (_, i) => {
    const d = new Date(2026, 10, 10 + i)
    return { label: `${d.getDate()} ${shortMonth(d.getMonth() + 1)}`, weekday: d.getDay(), weekend: d.getDay() === 0 || d.getDay() === 6, dec: d.getMonth() === 11 }
  })

  // ---- the forks, their days and what waits between them ----
  const curated = seed === DEFAULT_SEED
  const deck = curated ? CURATED.map(c => ({ card: forkById(c.id), day: c.day })) : randomDeck(rng, days)
  const rentAfter = deck.findIndex(d => d.day > RENT_DAY) - 1
  let gaps = curated ? CURATED_GAPS.split('') : randomGaps(rng, deck.length, rentAfter)
  if (calm) gaps = gaps.map((g, k) => (g === 's' ? (k % 2 ? 'j' : '-') : g))
  const scamBag = curated ? SCAMS.slice() : shuffle(rng, SCAMS)
  const joyNov = (curated ? JOYS : shuffle(rng, JOYS)).filter(j => !DECEMBER_JOYS.has(j.e))
  const joyDec = [...JOYS.filter(j => DECEMBER_JOYS.has(j.e)), ...joyNov.slice().reverse()]
  let si = 0, jn = 0, jd = 0

  const forks: ForkInst[] = []
  const items: Item[] = []
  let x = INTRO
  let rentX = 0
  deck.forEach((d, k) => {
    if (!rentX && d.day > RENT_DAY) { rentX = x + SUMMIT / 2; x += SUMMIT }
    const upperIsA = rng.random() < 0.5
    const A = optInst(d.card.a, d.day), B = optInst(d.card.b, d.day)
    const opts: [OptInst, OptInst] = upperIsA ? [A, B] : [B, A]
    forks.push({ i: k, id: d.card.id, card: d.card, x, day: d.day, opts, mean: (A.net + B.net) / 2 })
    x += FORK_LEN
    const g = gaps[k] ?? '-'
    if (g === 's') items.push({ kind: 'scam', x: x + ITEM_AT.s, def: scamBag[si++ % scamBag.length] })
    if (g === 'j') items.push({ kind: 'joy', x: x + ITEM_AT.j, def: rentX ? joyDec[jd++ % joyDec.length] : joyNov[jn++ % joyNov.length] })
    x += GAP_LEN[g] ?? GAP_LEN['-']
  })
  if (!rentX) { rentX = x + SUMMIT / 2; x += SUMMIT }
  const length = x + FINAL

  // ---- day boundaries: piecewise linear through the forks' days, the rent summit and the payday arch ----
  const anchors = [{ x: 0, d: 0 }, ...forks.map(f => ({ x: f.x, d: f.day })), { x: rentX, d: RENT_DAY }, { x: length, d: N_DAYS }].sort((a, b) => a.x - b.x)
  const dayX: number[] = []
  for (let j = 0; j <= N_DAYS; j++) {
    let k = 0
    while (k < anchors.length - 2 && anchors[k + 1].d < j) k++
    const a = anchors[k], b = anchors[k + 1]
    dayX.push(j <= a.d ? a.x : a.x + ((j - a.d) / Math.max(1e-6, b.d - a.d)) * (b.x - a.x))
  }
  dayX[0] = 0
  dayX[N_DAYS] = length

  // ---- bills on their real days (Nino: payday the 10th; November has 30 days) ----
  const actual = new PyRandom(seed + 3)
  const dayOf = (dom: number) => (dom >= p.paydayDay ? dom - p.paydayDay : 30 - p.paydayDay + dom)
  const icon: Record<string, string> = { rent: '🏠', utility: '💡', telecom: '📶', subscription: '🎵', installment: '💳', sport: '🏋️' }
  const bills: Bill[] = p.fixed
    .map(f => ({ day: dayOf(f.day), label: f.name, icon: icon[f.kind], amount: Math.round(f.range ? actual.uniform(f.range[0], f.range[1]) : f.amount), nominal: f.amount, rent: f.day === 1 }))
    .sort((a, b) => a.day - b.day)

  // ---- the random part: everyday spending and unexpected costs ----
  const sp = p.spend
  const base = days.slice(0, N_DAYS).map(d => (d.weekend ? sp.weekendMean : sp.weekdayMean))
  const ym = '2026-12'
  const uplift = (p.uplift[ym] ?? 0) / N_DAYS
  const mu = -(sp.sigma * sp.sigma) / 2
  const fr = new PyRandom(seed + 7)
  const A = Array.from({ length: K_PATHS }, () => new Float64Array(N_DAYS + 1))
  const Bp = Array.from({ length: K_PATHS }, () => new Float64Array(N_DAYS + 1))
  for (let k = 0; k < K_PATHS; k++) {
    for (let j = N_DAYS - 1; j >= 0; j--) {
      const u = fr.lognormvariate(mu, sp.sigma)
      const oo = fr.random() < sp.oneoffP ? fr.lognormvariate(Math.log(sp.oneoffMedian), sp.oneoffSigma) : 0
      A[k][j] = A[k][j + 1] + base[j] * u
      Bp[k][j] = Bp[k][j + 1] + uplift * u + oo
    }
  }
  const startMoney = Math.round(e.landing.p50) + p.salary
  const cushion = e.cushion
  const det0 = bills.reduce((s, b) => s + b.nominal, 0) + forks.reduce((s, f) => s + f.mean, 0)
  const thr0 = startMoney - det0 - cushion
  const pBelow0 = (kk: number) => { let n = 0; for (let k = 0; k < K_PATHS; k++) if (kk * A[k][0] + Bp[k][0] > thr0) n++; return n / K_PATHS }
  let lo = 0.15, hi = 1.6
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (pBelow0(mid) < P0_TARGET) lo = mid; else hi = mid }
  const kScale = (lo + hi) / 2
  const S: Float64Array[] = []
  for (let i = 0; i <= N_DAYS; i++) {
    const col = new Float64Array(K_PATHS)
    for (let k = 0; k < K_PATHS; k++) col[k] = kScale * A[k][i] + Bp[k][i]
    col.sort()
    S.push(col)
  }

  // actual everyday spending and unexpected costs (same distribution, its own stream)
  const bg = base.map(b => Math.round((kScale * b + uplift) * actual.lognormvariate(mu, sp.sigma)))
  const sBag = shuffle(actual, SURPRISES)
  const surprises: Surprise[] = curated ? CURATED_SURPRISES.slice() : []
  for (let j = 1; j < N_DAYS && !curated; j++) {
    if (actual.random() >= sp.oneoffP) continue
    const amt = Math.round(actual.lognormvariate(Math.log(sp.oneoffMedian), sp.oneoffSigma))
    const s = sBag[surprises.length % sBag.length]
    surprises.push({ day: j, e: s.e, t: s.t, p: amt })
  }
  const drain = days.slice(0, N_DAYS).map((_, j) => j % 2 === 1)

  return {
    seed, calm, p, days, salary: p.salary, startMoney, cushion, forks, items, bills, surprises, bg, drain, dayX, length,
    rentX, climbFrom: rentX - CLIMB, descendTo: rentX + DESCENT, S, kScale,
  }
}

// ---------------- one run ----------------
export interface Sched { day: number; p: number; e: string; t: string; en: number; kind: 'later' | 'back'; was?: string; done?: boolean }
export interface Run {
  x: number
  /** last day boundary processed (−1 before day 0) */
  day: number
  money: number
  energy: number
  minEnergy: number
  zeroHits: number
  combo: number
  bestCombo: number
  choice: (0 | 1 | undefined)[]
  item: ('hit' | 'dodged' | 'caught' | 'missed' | undefined)[]
  sched: Sched[]
  spent: { bills: number; bg: number; forks: number; scams: number; fatigue: number; surprises: number; chains: number }
  back: number
  picks: { i: number; e: string; t: string; p: number }[]
  failed: { day: number; label: string; icon: string; amount: number; money: number } | null
  arrived: boolean
  scamsHit: number
  scamsDodged: number
  joys: number
}

export type Fx =
  | { k: 'day'; day: number }
  | { k: 'bill'; bill: Bill; nth: number }
  | { k: 'fail'; bill: Bill; money: number }
  | { k: 'later'; s: Sched; paid: number }
  | { k: 'back'; s: Sched }
  | { k: 'surprise'; s: Surprise; paid: number }
  | { k: 'drain'; weekend: boolean; nth: number }
  | { k: 'fatigue'; e: string; t: string; p: number }
  | { k: 'arrive' }
  | { k: 'choose'; i: number; side: 0 | 1; combo: number; balanced: boolean; paid: number; en: number }
  | { k: 'scam'; i: number; paid: number }
  | { k: 'dodge'; i: number }
  | { k: 'joy'; i: number }

export function newRun(m: Month): Run {
  return {
    x: 0, day: -1, money: m.startMoney, energy: E_START, minEnergy: E_START, zeroHits: 0, combo: 0, bestCombo: 0,
    choice: m.forks.map(() => undefined), item: m.items.map(() => undefined), sched: [],
    spent: { bills: 0, bg: 0, forks: 0, scams: 0, fatigue: 0, surprises: 0, chains: 0 }, back: 0,
    picks: [], failed: null, arrived: false, scamsHit: 0, scamsDodged: 0, joys: 0,
  }
}

const over = (r: Run) => r.arrived || !!r.failed

function addEnergy(r: Run, delta: number, fx: Fx[]) {
  if (!delta) return
  r.energy = Math.max(0, Math.min(E_MAX, r.energy + delta))
  r.minEnergy = Math.min(r.minEnergy, r.energy)
  if (r.energy > 0) return
  const f = FATIGUE[r.zeroHits % FATIGUE.length]
  const paid = Math.min(f.p, r.money)
  r.money -= paid
  r.spent.fatigue += paid
  r.zeroHits++
  r.energy = E_RESET
  r.combo = 0
  fx.push({ k: 'fatigue', e: f.e, t: f.t, p: paid })
}

function processDay(m: Month, r: Run, d: number, fx: Fx[]) {
  r.day = d
  if (d >= N_DAYS) { r.arrived = true; fx.push({ k: 'arrive' }); return }
  fx.push({ k: 'day', day: d })
  for (const s of r.sched) if (!s.done && s.day === d && s.kind === 'back') { s.done = true; r.money -= s.p; r.back -= s.p; fx.push({ k: 'back', s }) }
  for (const b of m.bills) {
    if (b.day !== d) continue
    if (r.money + 1e-9 < b.amount) { r.failed = { day: d, label: b.label, icon: b.icon, amount: b.amount, money: r.money }; fx.push({ k: 'fail', bill: b, money: r.money }); return }
    r.money -= b.amount
    r.spent.bills += b.amount
    fx.push({ k: 'bill', bill: b, nth: m.bills.indexOf(b) })
  }
  for (const s of r.sched) {
    if (s.done || s.day !== d || s.kind !== 'later') continue
    s.done = true
    const paid = Math.min(s.p, r.money)
    r.money -= paid
    r.spent.chains += paid
    fx.push({ k: 'later', s, paid })
    addEnergy(r, s.en, fx)
  }
  const su = m.surprises.find(s => s.day === d)
  if (su) { const paid = Math.min(su.p, r.money); r.money -= paid; r.spent.surprises += paid; fx.push({ k: 'surprise', s: su, paid }) }
  const bg = Math.min(m.bg[d], r.money)
  r.money -= bg
  r.spent.bg += bg
  if (m.drain[d]) { fx.push({ k: 'drain', weekend: m.days[d].weekend, nth: m.drain.slice(0, d + 1).filter(Boolean).length }); addEnergy(r, -1, fx) }
}

/** moves the run to x, processing every day boundary on the way (stops at a bill that cannot be paid) */
export function advanceTo(m: Month, r: Run, x: number): Fx[] {
  const fx: Fx[] = []
  if (over(r)) return fx
  r.x = Math.max(r.x, x)
  while (!over(r) && r.day < N_DAYS && m.dayX[r.day + 1] <= r.x + 1e-6) processDay(m, r, r.day + 1, fx)
  return fx
}

/** the pricier option is out of reach when the account cannot pay it (there is never a credit option) */
export function locked(m: Month, r: Run, i: number, side: 0 | 1): boolean {
  const f = m.forks[i]
  const o = f.opts[side], other = f.opts[1 - side]
  return o.p > r.money && o.p > other.p
}

export function chooseFork(m: Month, r: Run, i: number, side: 0 | 1): Fx[] {
  const fx: Fx[] = []
  if (over(r) || r.choice[i] !== undefined || locked(m, r, i, side)) return fx
  const f = m.forks[i]
  const o = f.opts[side]
  r.choice[i] = side
  const paid = Math.min(o.p, r.money)
  r.money -= paid
  r.spent.forks += paid
  r.picks.push({ i, e: o.e, t: o.t, p: paid })
  if (o.later && o.laterDay < N_DAYS) r.sched.push({ day: o.laterDay, p: o.later.p, e: o.later.e, t: o.later.t, en: o.later.en, kind: 'later', was: o.later.was })
  if (o.back && o.backDay < N_DAYS) r.sched.push({ day: o.backDay, p: -o.back.p, e: o.back.e, t: o.back.t, en: 0, kind: 'back' })
  const tail: Fx[] = []
  addEnergy(r, o.en, tail)
  const fc = forecast(m, r)
  // balance = the payday forecast stays at or above the cushion under a sunny or cloudy sky, and ⚡ stays at 3 or more
  // (it describes the state after the choice; spending never counts by itself)
  const balanced = !tail.length && fc.p50 >= m.cushion && fc.pBelow < 0.3 && r.energy >= 3
  r.combo = balanced ? r.combo + 1 : 0
  r.bestCombo = Math.max(r.bestCombo, r.combo)
  fx.push({ k: 'choose', i, side, combo: r.combo, balanced, paid, en: o.en }, ...tail)
  return fx
}

export function hitScam(m: Month, r: Run, i: number): Fx[] {
  const it = m.items[i]
  if (over(r) || r.item[i] || it.kind !== 'scam') return []
  const paid = Math.min(it.def.p, r.money)
  r.money -= paid
  r.spent.scams += paid
  r.scamsHit++
  r.item[i] = 'hit'
  return [{ k: 'scam', i, paid }]
}
export function dodgeScam(m: Month, r: Run, i: number): Fx[] {
  if (r.item[i]) return []
  r.item[i] = 'dodged'
  r.scamsDodged++
  return [{ k: 'dodge', i }]
}
export function catchJoy(m: Month, r: Run, i: number): Fx[] {
  if (over(r) || r.item[i] || m.items[i].kind !== 'joy') return []
  r.item[i] = 'caught'
  r.joys++
  const fx: Fx[] = [{ k: 'joy', i }]
  addEnergy(r, 1, fx)
  return fx
}
export function missJoy(r: Run, i: number) { if (!r.item[i]) r.item[i] = 'missed' }

// ---------------- forecast ----------------
export interface Fc { p50: number; pBelow: number; weather: WeatherKind }

/** payday landing: remaining bills and known later costs/returns, open forks at their average, the random rest from S */
export function forecast(m: Month, r: Run, pend?: { f: number; side: 0 | 1 }): Fc {
  if (over(r)) {
    const v = r.failed ? r.failed.money : r.money
    const pb = v < m.cushion || r.failed ? 1 : 0
    return { p50: v, pBelow: pb, weather: weatherOf(pb) }
  }
  const d = r.day
  let det = 0
  for (const b of m.bills) if (b.day > d) det += b.nominal
  for (const s of r.sched) if (!s.done && s.day > d && s.day < N_DAYS) det += s.p
  for (const f of m.forks) {
    if (r.choice[f.i] !== undefined) continue
    det += pend && pend.f === f.i ? f.opts[pend.side].net : f.mean
  }
  const base = r.money - det
  const S = m.S[Math.max(0, d + 1)]
  const K = S.length
  const thr = base - m.cushion
  let lo = 0, hi = K
  while (lo < hi) { const mid = (lo + hi) >> 1; if (S[mid] > thr) hi = mid; else lo = mid + 1 }
  const pBelow = (K - lo) / K
  return { p50: base - S[K >> 1], pBelow, weather: weatherOf(pBelow) }
}

export type Ending = 'sun' | 'cloud' | 'storm'
export function endingOf(m: Month, r: Run): Ending {
  if (r.failed) return 'storm'
  return r.money >= m.cushion && r.zeroHits === 0 ? 'sun' : 'cloud'
}

/** seconds of running at normal speed (instant decisions), plus the pauses when ⚡ runs out */
export function runSeconds(m: Month, r?: Run): number {
  let t = 0
  const to = r?.failed ? m.dayX[r.failed.day] : m.length
  for (let x = 0; x < to; x += 10) t += 10 / (SPEED * (climbing(m, x) ? CLIMB_SLOW : 1))
  return t + (r ? r.zeroHits * FATIGUE_PAUSE : 0)
}

// ---------------- headless play (self-check, tuning) ----------------
export type Policy = (m: Month, r: Run, f: ForkInst) => 0 | 1

/** plays the month without a screen; perfect = every scam jumped, every joy caught */
export function playBot(m: Month, policy: Policy, perfect = true): Run {
  const r = newRun(m)
  type Ev = { x: number; o: number; run: () => void }
  const evs: Ev[] = []
  m.forks.forEach(f => evs.push({ x: f.x, o: 1, run: () => {
    let side = policy(m, r, f)
    if (locked(m, r, f.i, side)) side = (1 - side) as 0 | 1
    chooseFork(m, r, f.i, side)
  } }))
  m.items.forEach((it, i) => evs.push({ x: it.x, o: 2, run: () => {
    if (it.kind === 'scam') { if (perfect) dodgeScam(m, r, i); else hitScam(m, r, i) }
    else if (perfect) catchJoy(m, r, i); else missJoy(r, i)
  } }))
  evs.sort((a, b) => a.x - b.x || a.o - b.o)
  for (const ev of evs) {
    advanceTo(m, r, ev.x)
    if (over(r)) break
    ev.run()
  }
  advanceTo(m, r, m.length)
  return r
}

const cheaperSide = (f: ForkInst): 0 | 1 => (f.opts[0].p === f.opts[1].p ? (f.opts[0].en >= f.opts[1].en ? 0 : 1) : f.opts[0].p < f.opts[1].p ? 0 : 1)
/** always the cheaper sign (ties: more ⚡) */
export const botCheap: Policy = (_m, _r, f) => cheaperSide(f)
/** always the pricier sign (ties: more ⚡) */
export const botPaid: Policy = (_m, _r, f) => (f.opts[0].p === f.opts[1].p ? cheaperSide(f) : f.opts[0].p > f.opts[1].p ? 0 : 1)
/** looks at both previews: keeps the payday forecast above the cushion and ⚡ at 4 or more, then the better forecast */
export const botBalanced: Policy = (m, r, f) => {
  const o = ([0, 1] as const).map(side => ({ side, p50: forecast(m, r, { f: f.i, side }).p50, e: Math.max(0, Math.min(E_MAX, r.energy + f.opts[side].en)) }))
  const ok = o.filter(v => v.p50 >= m.cushion + 30 && v.e >= 4)
  if (ok.length) return ok.sort((a, b) => b.p50 - a.p50)[0].side
  return o.sort((a, b) => b.e - a.e || b.p50 - a.p50)[0].side
}
