// "გზა ხელფასამდე": one payday-to-payday cycle built only from the persona's own numbers.
// Own PyRandom stream (the shared engine's random state is never touched); the engine is read for
// its cushion, its next-payday median (calibration target) and weatherOf().
import { PyRandom } from '../engine/pyrandom'
import { Persona, FixedStream } from '../engine/personas'
import { getEngine, weatherOf, WeatherKind, KA_MONTHS_FULL } from '../engine/engine'

export type Cat = 'food' | 'transport' | 'clothes' | 'fun' | 'meet' | 'gift'
export const CAT_LABEL: Record<Cat, string> = { food: 'კვება', transport: 'ტრანსპორტი', clothes: 'ტანსაცმელი', fun: 'გართობა', meet: 'შეხვედრები', gift: 'საჩუქრები' }

interface ItemDef { label: string; icon: string; mult: number; cat: Cat }
// prices are multiples of the persona's own day mean (weekday items × weekdayMean, weekend items × weekendMean)
const WEEKDAY_ITEMS: ItemDef[] = [
  { label: 'ყავა', icon: '☕', mult: 0.25, cat: 'food' },
  { label: 'ნამცხვარი', icon: '🥐', mult: 0.3, cat: 'food' },
  { label: 'შაურმა', icon: '🌯', mult: 0.45, cat: 'food' },
  { label: 'ტაქსი', icon: '🚕', mult: 0.6, cat: 'transport' },
  { label: 'საჭმლის მიტანა', icon: '🛵', mult: 1.1, cat: 'food' },
  { label: 'ნაყინი', icon: '🍦', mult: 0.2, cat: 'food' },
]
const WEEKEND_ITEMS: ItemDef[] = [
  { label: 'კინო', icon: '🎬', mult: 0.8, cat: 'fun' },
  { label: 'ხინკალი', icon: '🥟', mult: 1.0, cat: 'food' },
  { label: 'ახალი მაისური', icon: '👕', mult: 1.8, cat: 'clothes' },
  { label: 'ბოულინგი', icon: '🎳', mult: 1.0, cat: 'fun' },
]
const JOYS = [
  { label: 'გასეირნება პარკში', icon: '🌳' },
  { label: 'მზის ჩასვლა', icon: '🌅' },
  { label: 'მეგობრები სახლში', icon: '🏠' },
  { label: 'დედასთან ზარი', icon: '📞' },
  { label: 'ფეხბურთი ეზოში', icon: '⚽' },
  { label: 'წიგნი ბიბლიოთეკიდან', icon: '📚' },
]
const ONEOFFS = [
  { label: 'კბილის ექიმი', icon: '🦷' },
  { label: 'ტელეფონის ეკრანი', icon: '📱' },
  { label: 'წამლები', icon: '💊' },
  { label: 'ფეხსაცმლის შეკეთება', icon: '👟' },
  { label: 'ონკანის შეკეთება', icon: '🔧' },
]
interface DilemmaDef { title: string; icon: string; cat: Cat; options: { label: string; icon: string; mult: number }[] }
// option costs are multiples of weekendMean; the middle option is the "typical" one used for calibration
const DILEMMAS: DilemmaDef[] = [
  { title: 'მეგობრის დაბადების დღე', icon: '🎂', cat: 'meet', options: [{ label: 'რესტორანში', icon: '🍽️', mult: 2 }, { label: 'სახლში ერთად', icon: '🏠', mult: 0.6 }, { label: 'არ წავალ, დავურეკავ', icon: '📞', mult: 0 }] },
  { title: 'შაბათ-კვირის გასვლა', icon: '🏔️', cat: 'fun', options: [{ label: 'ყაზბეგში მეგობრებთან', icon: '🚗', mult: 3 }, { label: 'მცხეთამდე მარშრუტკით', icon: '🚌', mult: 0.6 }, { label: 'სახლში დავისვენებ', icon: '🛋️', mult: 0 }] },
  { title: 'საჩუქარი ახლობელს', icon: '🎁', cat: 'gift', options: [{ label: 'ნაყიდი საჩუქარი', icon: '🛍️', mult: 1.6 }, { label: 'ხელნაკეთი', icon: '✂️', mult: 0.3 }, { label: 'ბარათი და ზარი', icon: '💌', mult: 0 }] },
]
export const BILL_ICON: Record<FixedStream['kind'], string> = { rent: '🏠', utility: '💡', telecom: '📶', subscription: '🎵', installment: '💳', sport: '🏋️' }

export type GameEvent =
  | { kind: 'bill'; at: number; label: string; icon: string; amount: number; nominal: number; range?: [number, number] }
  | { kind: 'temptation'; at: number; label: string; icon: string; price: number; cat: Cat }
  | { kind: 'joy'; at: number; label: string; icon: string }
  | { kind: 'oneoff'; at: number; label: string; icon: string; amount: number }
  | { kind: 'dilemma'; at: number; title: string; icon: string; cat: Cat; options: { label: string; icon: string; cost: number }[] }

export interface DayInfo { label: string; weekend: boolean }
export interface Cycle {
  p: Persona
  seed: number
  nDays: number
  days: DayInfo[]
  paydayLabel: string
  /** balance on payday morning before the salary (engine median landing) */
  carried: number
  startBalance: number
  cushion: number
  /** engine median for the next payday: what "about half the temptations" should land near */
  engineMedian: number
  /** ordinary daily spending in the background, one value per day */
  daily: number[]
  dailyCum: number[]
  /** mean of the lognormal background day spend (k × persona day mean), used by the forecast */
  dailyBase: number[]
  /** the persona's seasonal uplift for this cycle, spread evenly over the days */
  upliftPerDay: number
  events: GameEvent[]
  qvevriOptions: number[]
  secPerDay: number
}

const r5 = (v: number) => Math.round(v / 5) * 5
const r10 = (v: number) => Math.round(v / 10) * 10
const shortMonth = (m: number) => KA_MONTHS_FULL[m].slice(0, 3)

function shuffle<T>(rng: PyRandom, xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** fixed seeds: Nino's is chosen for the pitch (one unexpected cost early that the qvevri catches, then the first dilemma) */
export const DEFAULT_SEED: Record<Persona['id'], number> = { nino: 20261102 + 184, luka: 20261103, tamar: 20261104 }
export const N_TEMPTATIONS: Record<Persona['id'], number> = { nino: 9, luka: 9, tamar: 7 }
const N_JOYS = 4

export function buildCycle(p: Persona, seed = DEFAULT_SEED[p.id]): Cycle {
  const e = getEngine(p)
  const rng = new PyRandom(seed)
  const sp = p.spend
  const year = 2026, month = 11 // the upcoming payday is in November 2026 for every persona
  const start = new Date(year, month - 1, p.paydayDay)
  const end = new Date(year, month, p.paydayDay)
  const nDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  const days: DayInfo[] = Array.from({ length: nDays }, (_, i) => {
    const d = new Date(year, month - 1, p.paydayDay + i)
    return { label: `${d.getDate()} ${shortMonth(d.getMonth() + 1)}`, weekend: d.getDay() === 0 || d.getDay() === 6 }
  })
  const paydayLabel = `${end.getDate()} ${shortMonth(end.getMonth() + 1)}`
  const ymKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
  const uplift = p.uplift[ymKey] ?? 0

  // ---- bills: the persona's fixed[] on their real day of the month ----
  const dayIndexOf = (dom: number) => (dom >= p.paydayDay ? dom - p.paydayDay : nDays - p.paydayDay + dom)
  const byDay = new Map<number, FixedStream[]>()
  for (const f of p.fixed) {
    const i = dayIndexOf(f.day)
    byDay.set(i, [...(byDay.get(i) ?? []), f])
  }
  const bills: GameEvent[] = []
  for (const [i, fs] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    fs.forEach((f, k) => {
      const amount = f.range ? rng.uniform(f.range[0], f.range[1]) : f.amount
      const at = i + (fs.length === 1 ? 0.5 : 0.2 + (0.6 * k) / (fs.length - 1))
      bills.push({ kind: 'bill', at, label: f.name, icon: BILL_ICON[f.kind], amount: Math.round(amount), nominal: f.amount, range: f.range })
    })
  }
  const billAts = bills.map(b => b.at)

  // ---- slots for everything else: two per day, never with a gate inside a decision window ----
  let slots: number[] = []
  for (let d = 0; d < nDays; d++) for (const off of [0.25, 0.75]) {
    const s = d + off
    if (s < 0.7) continue // payday morning: the qvevri card
    if (billAts.some(b => b >= s - 0.45 && b <= s + 0.3)) continue
    slots.push(s)
  }
  const take = (s: number) => { slots = slots.filter(x => x !== s) }
  const nearest = (target: number) => slots.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), slots[0])

  // ---- two dilemmas, about a third and two thirds into the cycle ----
  const pick = shuffle(rng, [0, 1, 2]).slice(0, 2).sort((a, b) => a - b)
  const dilemmas: GameEvent[] = pick.map((di, k) => {
    const at = nearest(((k + 1) * nDays) / 3 + 0.25)
    take(at)
    const def = DILEMMAS[di]
    return { kind: 'dilemma', at, title: def.title, icon: def.icon, cat: def.cat, options: def.options.map(o => ({ label: o.label, icon: o.icon, cost: r5(o.mult * sp.weekendMean) })) }
  })

  // ---- unexpected costs: same daily probability and size as the engine ----
  const oneoffs: GameEvent[] = []
  const ooBag = shuffle(rng, ONEOFFS)
  for (let d = 0; d < nDays; d++) {
    if (rng.random() >= sp.oneoffP) continue
    const amount = Math.round(rng.lognormvariate(Math.log(sp.oneoffMedian), sp.oneoffSigma))
    const free = slots.filter(s => Math.floor(s) === d)
    const at = free.length ? free[0] : d + 0.05
    if (free.length) take(at)
    const def = ooBag[oneoffs.length % ooBag.length]
    oneoffs.push({ kind: 'oneoff', at, label: def.label, icon: def.icon, amount })
  }

  // ---- temptations (weekday or weekend items) and free joys ----
  const free = shuffle(rng, slots.filter(s => s >= 1))
  const wdBag = shuffle(rng, WEEKDAY_ITEMS), weBag = shuffle(rng, WEEKEND_ITEMS)
  let wi = 0, wei = 0
  const tSlots = free.slice(0, N_TEMPTATIONS[p.id]).sort((a, b) => a - b)
  const temptations: GameEvent[] = tSlots.map(at => {
    const we = days[Math.floor(at)].weekend
    const def = we ? weBag[wei++ % weBag.length] : wdBag[wi++ % wdBag.length]
    const price = Math.max(2, Math.round(def.mult * (we ? sp.weekendMean : sp.weekdayMean)))
    return { kind: 'temptation', at, label: def.label, icon: def.icon, price, cat: def.cat }
  })
  const jBag = shuffle(rng, JOYS)
  const joys: GameEvent[] = free.slice(N_TEMPTATIONS[p.id], N_TEMPTATIONS[p.id] + N_JOYS).sort((a, b) => a - b).map((at, k) => ({ kind: 'joy', at, ...jBag[k % jBag.length] }))

  const events = [...bills, ...dilemmas, ...oneoffs, ...temptations, ...joys].sort((a, b) => a.at - b.at)

  // ---- background spending, calibrated so that "about half the temptations + the middle dilemma option"
  // spends what the engine expects for this cycle (engine: 22 weekdays + 8 weekend days + uplift) ----
  const engineVar = 22 * sp.weekdayMean + 8 * sp.weekendMean
  const tHalf = temptations.reduce((s, t) => s + (t.kind === 'temptation' ? t.price : 0), 0) / 2
  const dMid = dilemmas.reduce((s, d) => s + (d.kind === 'dilemma' ? d.options[1].cost : 0), 0)
  const calSum = days.reduce((s, d) => s + (d.weekend ? sp.weekendMean : sp.weekdayMean), 0)
  const k = Math.max(0.3, (engineVar - tHalf - dMid) / calSum)
  const upliftPerDay = uplift / nDays
  const dailyBase = days.map(d => k * (d.weekend ? sp.weekendMean : sp.weekdayMean))
  const daily = dailyBase.map(m => rng.lognormvariate(Math.log(m) - (sp.sigma * sp.sigma) / 2, sp.sigma) + upliftPerDay)
  const dailyCum = [0]
  for (const v of daily) dailyCum.push(dailyCum[dailyCum.length - 1] + v)

  const carried = e.landing.p50
  const qBase = sp.oneoffMedian
  return {
    p, seed, nDays, days, paydayLabel, carried, startBalance: carried + p.salary, cushion: e.cushion, engineMedian: e.baseline[0].p50,
    daily, dailyCum, dailyBase, upliftPerDay, events,
    qvevriOptions: [0, r10(qBase), r10(qBase * 2), r10(qBase * 3)],
    secPerDay: p.id === 'tamar' ? 1.2 : 1.1,
  }
}

// ======================= one run through the cycle =======================

export type Mark = 'paid' | 'taken' | 'passed' | 'hit' | 'chosen'
export interface Run {
  x: number
  qvevriStart: number
  qvevri: number
  /** discrete money out of the wallet (bills, choices, the part of unexpected costs the qvevri did not cover) */
  charges: number
  bills: number
  chosen: number
  oneoff: number
  oneoffFromQvevri: number
  joy: number
  joyFree: number
  marks: (Mark | null)[]
  choices: Record<number, number>
  /** unexpected cost index → the part the qvevri covered */
  hits: Record<number, number>
  taken: { idx: number; label: string; icon: string; cat: Cat; price: number }[]
}
export type Fired = { kind: 'bill' | 'oneoff' | 'pass' | 'dilemma' | 'arrive'; idx: number }

/** decision window for temptations and joys: Jikho slows to WINDOW_SPEED inside it (≥ 1.5 s at any persona speed) */
export const WINDOW_BEFORE = 0.4
export const WINDOW_AFTER = 0.05
export const WINDOW_SPEED = 0.3

export function newRun(c: Cycle, qvevri: number): Run {
  return { x: 0, qvevriStart: qvevri, qvevri, charges: 0, bills: 0, chosen: 0, oneoff: 0, oneoffFromQvevri: 0, joy: 0, joyFree: 0, marks: c.events.map(() => null), choices: {}, hits: {}, taken: [] }
}

export function bgSpent(c: Cycle, x: number): number {
  if (x >= c.nDays) return c.dailyCum[c.nDays]
  const d = Math.max(0, Math.floor(x))
  return c.dailyCum[d] + (x - d) * c.daily[d]
}
export const wallet = (c: Cycle, r: Run) => c.startBalance - r.qvevriStart - bgSpent(c, r.x) - r.charges
export const total = (c: Cycle, r: Run) => wallet(c, r) + r.qvevri

const interactive = (ev: GameEvent) => ev.kind === 'temptation' || ev.kind === 'joy'

/** the open temptation/joy whose decision window Jikho is in, or -1 */
export function windowEvent(c: Cycle, r: Run): number {
  for (let i = 0; i < c.events.length; i++) {
    const ev = c.events[i]
    if (!interactive(ev) || r.marks[i]) continue
    if (r.x >= ev.at - WINDOW_BEFORE && r.x < ev.at + WINDOW_AFTER) return i
    if (ev.at - WINDOW_BEFORE > r.x) break
  }
  return -1
}

/** moves Jikho forward by dx days, firing everything passed on the way; stops at a dilemma or at payday */
export function advance(c: Cycle, r: Run, dx: number): Fired[] {
  const fired: Fired[] = []
  const before = r.x < c.nDays
  let target = Math.min(c.nDays, r.x + dx)
  for (let i = 0; i < c.events.length; i++) {
    const ev = c.events[i]
    if (r.marks[i]) continue
    const trigger = interactive(ev) ? ev.at + WINDOW_AFTER : ev.at
    if (trigger > target) continue
    if (ev.kind === 'dilemma') { target = ev.at; r.x = target; fired.push({ kind: 'dilemma', idx: i }); return fired }
    r.x = Math.max(r.x, trigger)
    if (ev.kind === 'bill') { r.charges += ev.amount; r.bills += ev.amount; r.marks[i] = 'paid'; fired.push({ kind: 'bill', idx: i }) }
    else if (ev.kind === 'oneoff') {
      const fromQ = Math.min(r.qvevri, ev.amount)
      r.qvevri -= fromQ; r.oneoffFromQvevri += fromQ
      r.charges += ev.amount - fromQ; r.oneoff += ev.amount
      r.hits[i] = fromQ; r.marks[i] = 'hit'; fired.push({ kind: 'oneoff', idx: i })
    } else { r.marks[i] = 'passed'; fired.push({ kind: 'pass', idx: i }) }
  }
  r.x = target
  if (before && r.x >= c.nDays) fired.push({ kind: 'arrive', idx: -1 })
  return fired
}

/** a tap inside a decision window */
export function takeEvent(c: Cycle, r: Run, i: number) {
  const ev = c.events[i]
  if (r.marks[i]) return
  if (ev.kind === 'temptation') {
    r.charges += ev.price; r.chosen += ev.price; r.joy += 1
    r.taken.push({ idx: i, label: ev.label, icon: ev.icon, cat: ev.cat, price: ev.price })
  } else if (ev.kind === 'joy') { r.joy += 1; r.joyFree += 1 }
  else return
  r.marks[i] = 'taken'
}

export function chooseOption(c: Cycle, r: Run, i: number, opt: number) {
  const ev = c.events[i]
  if (ev.kind !== 'dilemma' || r.marks[i]) return
  const cost = ev.options[opt].cost
  r.charges += cost; r.chosen += cost; r.choices[i] = opt; r.marks[i] = 'chosen'
  if (cost > 0) r.taken.push({ idx: i, label: ev.options[opt].label, icon: ev.options[opt].icon, cat: ev.cat, price: cost })
}

/** the next event worth showing in the pitch ("N"): a temptation, joy, unexpected cost or dilemma */
export function nextEventAt(c: Cycle, r: Run): number | null {
  for (let i = 0; i < c.events.length; i++) {
    const ev = c.events[i]
    if (r.marks[i] || ev.kind === 'bill') continue
    const start = interactive(ev) ? ev.at - WINDOW_BEFORE : ev.at - 0.25
    if (start > r.x + 0.01) return start
  }
  return null
}

// ======================= forecast (small Monte Carlo, run on events only) =======================

export interface Forecast { pBelow: number; weather: WeatherKind; p50: number; days: WeatherKind[] }
const MC_PATHS = 300

/**
 * where the run lands on payday: remaining background spending and unexpected costs are drawn, known bills are
 * paid, open temptations count at half their price and open dilemmas at the middle option.
 * `exclude` + `extra`: the same forecast if event `exclude` is decided now with `extra` ₾.
 */
export function forecast(c: Cycle, r: Run, exclude = -1, extra = 0): Forecast {
  const rng = new PyRandom(c.seed + 99991) // common random numbers: forecasts differ only by the choices
  const sp = c.p.spend
  const now = total(c, r) - extra
  const d0 = Math.min(c.nDays, Math.floor(r.x))
  const frac = r.x - d0
  // deterministic remainder per day: bills, half temptations, middle dilemmas
  const fixedByDay = new Array(c.nDays).fill(0)
  const ranged: { day: number; lo: number; hi: number }[] = []
  c.events.forEach((ev, i) => {
    if (r.marks[i] || i === exclude) return
    const d = Math.min(c.nDays - 1, Math.max(d0, Math.floor(ev.at)))
    if (ev.kind === 'bill') { if (ev.range) ranged.push({ day: d, lo: ev.range[0], hi: ev.range[1] }); else fixedByDay[d] += ev.amount }
    else if (ev.kind === 'temptation') fixedByDay[d] += ev.price / 2
    else if (ev.kind === 'dilemma') fixedByDay[d] += ev.options[1].cost
  })
  const nRem = c.nDays - d0
  const ends: number[] = []
  const byDay: number[][] = Array.from({ length: nRem }, () => [])
  for (let k = 0; k < MC_PATHS; k++) {
    let bal = now
    for (let j = 0; j < nRem; j++) {
      const d = d0 + j
      const part = j === 0 ? 1 - frac : 1
      const mu = Math.log(c.dailyBase[d]) - (sp.sigma * sp.sigma) / 2
      let s = (rng.lognormvariate(mu, sp.sigma) + c.upliftPerDay) * part
      if (rng.random() < sp.oneoffP * part) s += rng.lognormvariate(Math.log(sp.oneoffMedian), sp.oneoffSigma)
      s += fixedByDay[d]
      for (const b of ranged) if (b.day === d) s += rng.uniform(b.lo, b.hi)
      bal -= s
      byDay[j].push(bal)
    }
    ends.push(nRem > 0 ? bal : now)
  }
  const below = (xs: number[]) => xs.filter(v => v < c.cushion).length / xs.length
  const pBelow = below(ends)
  const sorted = [...ends].sort((a, b) => a - b)
  const days: WeatherKind[] = new Array(c.nDays).fill('sun')
  for (let j = 0; j < nRem; j++) days[d0 + j] = weatherOf(below(byDay[j]))
  return { pBelow, weather: weatherOf(pBelow), p50: sorted[Math.floor(sorted.length / 2)], days }
}

// ======================= headless play (self-check, calibration) =======================

export type Policy = (ev: GameEvent, idx: number, nth: number) => boolean | number

/** plays the whole cycle without a screen: policy returns take/skip for temptations and joys, an option index for dilemmas */
export function playHeadless(c: Cycle, qvevri: number, policy: Policy): Run {
  const r = newRun(c, qvevri)
  const asked = new Set<number>()
  let nth = 0
  for (let guard = 0; guard < 10000 && r.x < c.nDays; guard++) {
    const w = windowEvent(c, r)
    if (w >= 0 && !asked.has(w)) {
      asked.add(w)
      const ev = c.events[w]
      if (ev.kind === 'temptation' ? policy(ev, w, nth++) : policy(ev, w, -1)) takeEvent(c, r, w)
    }
    const fired = advance(c, r, 0.05)
    for (const f of fired) if (f.kind === 'dilemma') chooseOption(c, r, f.idx, Number(policy(c.events[f.idx], f.idx, -1)))
  }
  return r
}
