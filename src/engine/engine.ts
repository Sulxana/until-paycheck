// Engine v0 (TypeScript port of engine_v0.py). For Nino the call order replicates the Python script exactly,
// so every canonical number equals engine_v0_report.json. Interactive queries reuse stored generator states
// (common random numbers), so answers are deterministic and monotone in the amount asked.
import { PyRandom, PyRandomState, pyRound } from './pyrandom'
import { Persona } from './personas'

export const N_PATHS = 1000
const KA_MONTHS: Record<number, string> = { 1: 'იან', 2: 'თებ', 3: 'მარ', 4: 'აპრ', 5: 'მაი', 6: 'ივნ', 7: 'ივლ', 8: 'აგვ', 9: 'სექ', 10: 'ოქტ', 11: 'ნოე', 12: 'დეკ' }
export const KA_MONTHS_FULL: Record<number, string> = { 1: 'იანვარი', 2: 'თებერვალი', 3: 'მარტი', 4: 'აპრილი', 5: 'მაისი', 6: 'ივნისი', 7: 'ივლისი', 8: 'აგვისტო', 9: 'სექტემბერი', 10: 'ოქტომბერი', 11: 'ნოემბერი', 12: 'დეკემბერი' }

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'storm'
export const WEATHER_LABEL: Record<WeatherKind, string> = { sun: 'მზიანი', cloud: 'ღრუბლიანი', rain: 'წვიმიანი', storm: 'ქარიშხალი' }
export const WEATHER_ICON: Record<WeatherKind, string> = { sun: '☀', cloud: '🌥', rain: '🌧', storm: '⛈' }
export function weatherOf(p: number): WeatherKind { return p < 0.1 ? 'sun' : p < 0.3 ? 'cloud' : p < 0.6 ? 'rain' : 'storm' }

export function quantile(xs: number[], p: number, sorted = false): number {
  const s = sorted ? xs : [...xs].sort((a, b) => a - b)
  const k = (s.length - 1) * p, f = Math.floor(k), c = Math.ceil(k)
  return f === c ? s[f] : s[f] + (s[c] - s[f]) * (k - f)
}
function median(xs: number[]) { return quantile(xs, 0.5) }

export interface Dist { p10: number; p50: number; p90: number; pBelow: number; weather: WeatherKind; inTen: number }
export interface CycleRow { cycleEnd: string; label: string; y: number; m: number; uplift: number; laptop: number; payment: number; p10: number; p50: number; p90: number; pBelow: number }
export interface TenorResult {
  label: string; principal: number; months: number; ratePerMonth: number; monthly: number; total: number; cost: number; eirPct: number
  ptiNowPct: number; ptiAfterLaptopPct: number; surplusAfter: number; rows: CycleRow[]; window: CycleRow[]; shortLabels: string[]; nShort: number; maxPBelow: number; startLabel: string
}

export function annuity(P: number, r: number, n: number) { return r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) }
export function eirPct(r: number) { return pyRound((Math.pow(1 + r, 12) - 1) * 100, 1) }

function monthAdd(y: number, m: number, k: number): [number, number] { const m2 = m - 1 + k; return [y + Math.floor(m2 / 12), (m2 % 12) + 1] }
const CYCLE_DAYS = [...Array(22).fill(false), ...Array(8).fill(true)] as boolean[]
const ymLE = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])
const ymGE = (a: [number, number], b: [number, number]) => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1])

export interface InstallmentQuery { price: number; months: number; ratePerMonth: number; startOffset?: number; upfront?: number; pledge?: number; label?: string }

export class Engine {
  readonly p: Persona
  private rng: PyRandom
  readonly spendable: number
  readonly fixedTotal: number
  readonly laptop: number
  // computed
  baseLand: number[] = []
  baseSpend: number[] = []
  trajectories: number[][] = [] // per path: end-of-day balance for each day index
  avgDaily = 0
  medianDaily = 0
  cushion = 0
  landing!: Dist
  runwayDays = 0
  safeToday = 0
  monthlyVarMedian = 0
  medianSurplus = 0
  private stAfterBase!: PyRandomState
  private stBeforeCycles!: PyRandomState
  private canon = new Map<string, TenorResult>()
  baseline: CycleRow[] = []
  pledgeBaseShort: string[] = []
  purchase100!: { amount: number; p10: number; p50: number; p90: number; pBelow: number; weather: WeatherKind; inTen: number; daysLeft: number }

  constructor(p: Persona) {
    this.p = p
    this.rng = new PyRandom(p.seed)
    this.spendable = p.balances.reduce((s, b) => s + b.amount, 0)
    this.fixedTotal = p.fixed.reduce((s, f) => s + f.amount, 0)
    this.laptop = p.installment?.amount ?? 0
    this.run()
  }

  // ---------- model pieces (exact Python order) ----------
  private daySpend(isWeekend: boolean): number {
    const sp = this.p.spend
    const mean = isWeekend ? sp.weekendMean : sp.weekdayMean
    const mu = Math.log(mean) - sp.sigma * sp.sigma / 2
    let s = this.rng.lognormvariate(mu, sp.sigma)
    if (this.rng.random() < sp.oneoffP) s += this.rng.lognormvariate(Math.log(sp.oneoffMedian), sp.oneoffSigma)
    return s
  }

  private dueDraw(): { total: number; parts: { idx: number; amt: number }[] } {
    let total = 0
    const parts: { idx: number; amt: number }[] = []
    for (const d of this.p.due) if (d.amount !== undefined) { total += d.amount; parts.push({ idx: d.dayIndex, amt: d.amount }) }
    for (const d of this.p.due) if (d.range) { const u = this.rng.uniform(d.range[0], d.range[1]); total += u; parts.push({ idx: d.dayIndex, amt: u }) }
    return { total, parts }
  }

  private simulateUntilPayday(extra = 0, record = false) {
    const landings: number[] = [], spends: number[] = []
    for (let i = 0; i < N_PATHS; i++) {
      const days: number[] = []
      let spend = 0
      for (const w of this.p.dayPattern) { const s = this.daySpend(w); days.push(s); spend += s }
      const bills = this.dueDraw()
      landings.push(this.spendable - bills.total - spend - extra)
      spends.push(spend)
      if (record) {
        const traj: number[] = []
        let bal = this.spendable - extra
        for (let d = 0; d < days.length; d++) {
          bal -= days[d]
          for (const b of bills.parts) if (b.idx === d) bal -= b.amt
          traj.push(bal)
        }
        this.trajectories.push(traj)
      }
    }
    return { landings, spends }
  }

  private dist(xs: number[], cushion = this.cushion): Dist {
    const s = [...xs].sort((a, b) => a - b)
    const pBelow = xs.filter(b => b < cushion).length / xs.length
    return { p10: pyRound(quantile(s, 0.1, true)), p50: pyRound(quantile(s, 0.5, true)), p90: pyRound(quantile(s, 0.9, true)), pBelow: pyRound(pBelow, 2), weather: weatherOf(pBelow), inTen: pyRound(pBelow * 10) }
  }

  private simulateCycles(start: number[], nCycles: number, schedule: (k: number, ym: [number, number]) => number, pledge = 0): CycleRow[] {
    const p = this.p
    const rangeItems = p.fixed.filter(f => f.range)
    const nonRangeNoLaptop = p.fixed.filter(f => !f.range && f.kind !== 'installment').reduce((s, f) => s + f.amount, 0)
    const otherInstallments = p.fixed.filter(f => f.kind === 'installment' && f.name !== p.installment?.name).reduce((s, f) => s + f.amount, 0)
    // Python: fixed_wo_laptop - 52 - 55 + U + U   (fixed_wo_laptop - range amounts == non-range non-laptop)
    const fixedWoLaptop = this.fixedTotal - this.laptop
    const rangeNominal = rangeItems.reduce((s, f) => s + f.amount, 0)
    const out: CycleRow[] = []
    let paths = start.slice()
    let [y, m] = p.firstCycle
    for (let k = 0; k < nCycles; k++) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const uplift = p.uplift[key] ?? 0
      const laptop = p.installment && ymLE([y, m], p.installment.lastCycle) ? this.laptop : 0
      const pay = schedule(k, [y, m])
      const next: number[] = new Array(paths.length)
      for (let i = 0; i < paths.length; i++) {
        let spend = 0
        for (const w of CYCLE_DAYS) spend += this.daySpend(w)
        spend += uplift
        let bills: number
        if (p.id === 'nino') {
          bills = fixedWoLaptop - 52 - 55
          bills += this.rng.uniform(46, 60)
          bills += this.rng.uniform(45, 70)
        } else {
          bills = nonRangeNoLaptop + otherInstallments
          for (const f of rangeItems) bills += this.rng.uniform(f.range![0], f.range![1])
          void rangeNominal
        }
        next[i] = paths[i] + p.salary - bills - laptop - spend - pay - pledge
      }
      paths = next
      const d = this.dist(paths)
      out.push({ cycleEnd: key, label: `${p.paydayDay} ${KA_MONTHS[m]} ${y}`, y, m, uplift, laptop, payment: pyRound(pay, 1), p10: d.p10, p50: d.p50, p90: d.p90, pBelow: d.pBelow })
      ;[y, m] = monthAdd(y, m, 1)
    }
    return out
  }

  private tenorResult(q: InstallmentQuery, rows: CycleRow[], startOffset: number): TenorResult {
    const principal = q.price - (q.upfront ?? 0)
    const pay = annuity(principal, q.ratePerMonth, q.months)
    const total = pay * q.months
    const window = rows.slice(startOffset, startOffset + Math.max(q.months, 12))
    const short = window.filter(c => c.p50 < this.cushion)
    const startRow = rows[startOffset]
    return {
      label: q.label ?? `${q.months} თვე, ${q.ratePerMonth === 0 ? '0%' : pyRound(q.ratePerMonth * 100, 2) + '%/თვე'}`,
      principal, months: q.months, ratePerMonth: q.ratePerMonth,
      monthly: pyRound(pay, 1), total: pyRound(total), cost: pyRound(total - principal), eirPct: q.ratePerMonth === 0 ? 0 : eirPct(q.ratePerMonth),
      ptiNowPct: pyRound((this.laptop + pay) / this.p.salary * 100, 1), ptiAfterLaptopPct: pyRound(pay / this.p.salary * 100, 1),
      surplusAfter: pyRound(this.medianSurplus - pay), rows, window, shortLabels: short.map(c => c.label), nShort: short.length,
      maxPBelow: window.reduce((mx, c) => Math.max(mx, c.pBelow), 0), startLabel: startRow ? `${KA_MONTHS_FULL[startRow.m]} ${startRow.y}` : '',
    }
  }

  private run() {
    const p = this.p
    // 1. base (recorded trajectories use the very same draws)
    const base = this.simulateUntilPayday(0, true)
    this.baseLand = base.landings; this.baseSpend = base.spends
    const nDays = p.dayPattern.length
    this.medianDaily = pyRound(median(base.spends.map(s => s / nDays)), 1)
    this.avgDaily = pyRound(base.spends.reduce((a, b) => a + b, 0) / base.spends.length / nDays, 1)
    this.cushion = pyRound(p.cushionDays * this.avgDaily / 5) * 5
    this.landing = this.dist(base.landings)
    this.runwayDays = pyRound(this.landing.p50 / this.avgDaily)
    this.safeToday = pyRound(Math.max(0, (this.landing.p50 - this.cushion) / nDays))
    this.stAfterBase = this.rng.getState()
    // 2. purchase 100 (Python order)
    this.purchase100 = this.purchaseCheckFromState(100)
    // 3. monthly variable median
    const mv: number[] = []
    for (let i = 0; i < N_PATHS; i++) { let s = 0; for (const w of CYCLE_DAYS) s += this.daySpend(w); mv.push(s) }
    this.monthlyVarMedian = pyRound(median(mv))
    this.medianSurplus = p.salary - this.fixedTotal - this.monthlyVarMedian
    this.stBeforeCycles = this.rng.getState()
    if (p.id === 'nino') this.runNinoCanon()
    else {
      this.baseline = this.simulateCycles(this.baseLand, 12, () => 0)
    }
  }

  private runNinoCanon() {
    const PRICE = 1200, RATE = 0.015
    const tenors: InstallmentQuery[] = [
      { price: PRICE, months: 4, ratePerMonth: 0, label: '4 თვე, 0%' },
      { price: PRICE, months: 12, ratePerMonth: RATE, label: '12 თვე, 1.5%/თვე' },
      { price: PRICE, months: 24, ratePerMonth: RATE, label: '24 თვე, 1.5%/თვე' },
    ]
    for (const t of tenors) {
      const pay = annuity(t.price, t.ratePerMonth, t.months)
      const rows = this.simulateCycles(this.baseLand, 12, k => (k < t.months ? pay : 0))
      this.canon.set(this.key(t, 0), this.tenorResult(t, rows, 0))
    }
    this.baseline = this.simulateCycles(this.baseLand, 12, () => 0)
    const pay24 = annuity(PRICE, RATE, 24)
    this.simulateCycles(this.baseLand, 12, () => pay24, 100) // pledge_24 (consumes draws, as in Python)
    const pledgeBase = this.simulateCycles(this.baseLand, 12, () => 0, 100)
    this.pledgeBaseShort = pledgeBase.filter(c => c.p50 < this.cushion).map(c => c.label)
    const pay12 = annuity(PRICE, RATE, 12)
    const april = this.simulateCycles(this.baseLand, 18, (k, ym) => (ymGE(ym, [2027, 5]) && ymLE(ym, [2028, 4]) ? pay12 : 0))
    this.canon.set(this.key({ price: PRICE, months: 12, ratePerMonth: RATE }, 5), this.tenorResult({ price: PRICE, months: 12, ratePerMonth: RATE, label: '12 თვე აპრილიდან' }, april, 5))
    const pay900 = annuity(900, RATE, 12)
    const w300 = this.simulateCycles(this.baseLand, 12, () => pay900)
    this.canon.set(this.key({ price: 900, months: 12, ratePerMonth: RATE }, 0), this.tenorResult({ price: 900, months: 12, ratePerMonth: RATE, label: '900 ₾ × 12 თვე' }, w300, 0))
  }

  private key(q: InstallmentQuery, start: number) { return `${q.price - (q.upfront ?? 0)}|${q.months}|${pyRound(q.ratePerMonth, 5)}|${start}|${q.pledge ?? 0}` }

  // ---------- interactive API ----------
  private purchaseCheckFromState(amount: number) {
    const sim = this.simulateUntilPayday(amount)
    const d = this.dist(sim.landings)
    return { amount, ...d, daysLeft: pyRound(d.p50 / this.avgDaily, 1) }
  }

  purchaseCheck(amount: number) {
    const saved = this.rng.getState()
    this.rng.setState(this.stAfterBase)
    const r = this.purchaseCheckFromState(amount)
    this.rng.setState(saved)
    const afterPayday = pyRound(this.landing.p50 + this.p.salary - this.fixedTotal - this.monthlyVarMedian - amount)
    return { ...r, afterPayday }
  }

  /** largest purchase today that keeps P(below cushion) under 30% */
  maxComfortablePurchase(): number {
    const v = quantile(this.baseLand, 0.3) - this.cushion
    return Math.max(0, Math.floor(v / 5) * 5)
  }

  installment(q: InstallmentQuery): TenorResult {
    const start = q.startOffset ?? 0
    const k = this.key(q, start)
    const c = this.canon.get(k)
    if (c) return c
    const principal = q.price - (q.upfront ?? 0)
    const pay = annuity(principal, q.ratePerMonth, q.months)
    const horizon = Math.min(30, Math.max(12, start + Math.max(q.months, 12)))
    const saved = this.rng.getState()
    this.rng.setState(this.stBeforeCycles)
    const rows = this.simulateCycles(this.baseLand, horizon, kk => (kk >= start && kk < start + q.months ? pay : 0), q.pledge ?? 0)
    this.rng.setState(saved)
    const r = this.tenorResult(q, rows, start)
    this.canon.set(k, r)
    return r
  }

  /** months of surplus needed to buy with cash */
  monthsToSave(price: number) { return this.medianSurplus > 0 ? Math.ceil(price / this.medianSurplus) : Infinity }

  /** per-day percentile bands of balance until payday (fan chart) */
  fan(): { day: string; p10: number; p50: number; p90: number }[] {
    const n = this.p.dayPattern.length
    const out = [{ day: 'დღეს', p10: this.spendable, p50: this.spendable, p90: this.spendable }]
    for (let d = 0; d < n; d++) {
      const col = this.trajectories.map(t => t[d]).sort((a, b) => a - b)
      out.push({ day: d + 1 < n ? this.p.dayLabels[d + 1] : 'ხელფასი', p10: quantile(col, 0.1, true), p50: quantile(col, 0.5, true), p90: quantile(col, 0.9, true) })
    }
    return out
  }

  /** index of the path used as the "lived" month in the demo time machine (lands near the 60th percentile) */
  demoPathIndex(): number {
    const target = quantile(this.baseLand, 0.6)
    let best = 0, bd = Infinity
    this.baseLand.forEach((v, i) => { const dd = Math.abs(v - target); if (dd < bd) { bd = dd; best = i } })
    return best
  }

  /** forecast standing on day t (0..n) of the lived path, with `extra` already spent, using common random numbers for the rest */
  forecastAtDay(t: number, livedIdx: number, extra = 0): { balance: number; landing: Dist } {
    const n = this.p.dayPattern.length
    const lived = this.trajectories[livedIdx]
    const balance = (t === 0 ? this.spendable : lived[t - 1]) - extra
    if (t >= n) return { balance, landing: this.dist([balance]) }
    const lands = this.trajectories.map(tr => {
      const spentSoFar = (t === 0 ? this.spendable : tr[t - 1])
      return balance - (spentSoFar - tr[n - 1])
    })
    return { balance, landing: this.dist(lands) }
  }
}

const cache = new Map<string, Engine>()
export function getEngine(p: Persona): Engine {
  let e = cache.get(p.id)
  if (!e) { e = new Engine(p); cache.set(p.id, e) }
  return e
}
