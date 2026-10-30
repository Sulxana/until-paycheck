import { readFileSync } from 'node:fs'
import { Engine } from '../src/engine/engine'
import { NINO, LUKA, TAMAR } from '../src/engine/personas'

const rep = JSON.parse(readFileSync(new URL('../reference/engine_v0_report.json', import.meta.url), 'utf8'))
let fails = 0
const eq = (name: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ts=${JSON.stringify(a)} py=${JSON.stringify(b)}`)
}
const t0 = Date.now()
const e = new Engine(NINO)
console.log('engine ms', Date.now() - t0)
eq('avg_daily', e.avgDaily, rep.daily_spend.avg_per_day)
eq('median_daily', e.medianDaily, rep.daily_spend.median_per_day)
eq('cushion', e.cushion, rep.cushion.gel)
eq('landing', [e.landing.p10, e.landing.p50, e.landing.p90, e.landing.pBelow], [rep.landing_forecast.p10, rep.landing_forecast.p50, rep.landing_forecast.p90, rep.landing_forecast.p_below_cushion])
eq('safe_today', e.safeToday, rep.landing_forecast.safe_to_spend_today)
const b = e.purchase100
eq('buy100', [b.p10, b.p50, b.p90, b.pBelow], [rep.purchase_check_100.p10, rep.purchase_check_100.p50, rep.purchase_check_100.p90, rep.purchase_check_100.p_below_cushion])
eq('buy100 via API', [e.purchaseCheck(100).p50, e.purchaseCheck(100).afterPayday], [rep.purchase_check_100.p50, rep.purchase_check_100.same_purchase_after_payday_landing_p50])
eq('monthly_var_median', e.monthlyVarMedian, rep.daily_spend.monthly_variable_median)
const qs = [
  { price: 1200, months: 4, ratePerMonth: 0 },
  { price: 1200, months: 12, ratePerMonth: 0.015 },
  { price: 1200, months: 24, ratePerMonth: 0.015 },
]
qs.forEach((q, i) => {
  const r = e.installment(q)
  const pr = rep.installment.tenors_ordered_by_term[i]
  eq(`tenor ${q.months} money`, [r.monthly, r.total, r.cost, r.ptiNowPct], [pr.monthly_payment, pr.total_paid, pr.cost_of_credit, pr.pti_today_pct])
  eq(`tenor ${q.months} p50s`, r.rows.map(c => c.p50), pr.cycles.map((c: any) => c.p50))
  eq(`tenor ${q.months} short`, r.nShort, pr.n_short_of_12)
})
eq('baseline p50s', e.baseline.map(c => c.p50), rep.baseline_no_phone.map((c: any) => c.p50))
const apr = e.installment({ price: 1200, months: 12, ratePerMonth: 0.015, startOffset: 5 })
eq('april p50s', apr.rows.slice(5).map(c => c.p50), rep.whatif_start_april_12m.rows.map((c: any) => c.p50))
eq('april short', apr.nShort, rep.whatif_start_april_12m.n_short_at_median)
const w3 = e.installment({ price: 1200, upfront: 300, months: 12, ratePerMonth: 0.015 })
eq('300 upfront p50s', w3.rows.map(c => c.p50), rep.whatif_300_from_deposit_12m.rows.map((c: any) => c.p50))
eq('pledge baseline short', e.pledgeBaseShort.length, rep.with_pledge_100.baseline_short.length)

// interactive sanity
console.log('purchase 300:', e.purchaseCheck(300))
console.log('max comfortable today:', e.maxComfortablePurchase())
const x = e.installment({ price: 2000, months: 24, ratePerMonth: 0.18 / 12 })
console.log('loan 2000/24m @18%:', x.monthly, x.total, x.cost, x.eirPct, x.nShort, x.shortLabels)
console.log('demo path', e.demoPathIndex(), e.baseLand[e.demoPathIndex()])
for (let t = 0; t <= 8; t++) { const f = e.forecastAtDay(t, e.demoPathIndex()); console.log('day', t, Math.round(f.balance), f.landing.p50, f.landing.weather) }
for (const P of [LUKA, TAMAR]) { const t1 = Date.now(); const ee = new Engine(P); console.log(P.id, 'ms', Date.now() - t1, 'cushion', ee.cushion, 'landing', ee.landing, 'base', ee.baseline.slice(0, 3).map(c => c.p50)) }
console.log(fails === 0 ? '\nALL MATCH' : `\n${fails} MISMATCHES`)
process.exit(fails ? 1 : 0)
