// Self-check for the forked-road runner "გზის გასაყარი": determinism, bots on the default month, run length (also
// with a human reading delay, through the same motion model the screen uses), forecast sanity (bills barely move the
// payday sky, a choice never raises it), the combo never landing Jikho on a scam, red-line words, the deck's own rules and
// text limits, how many facts a played month really shows, and every amount in a fact against the prices it comes from.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildMonth, playBot, playTimed, botCheap, botPaid, botBalanced, endingOf, runSeconds, forecast, newRun, advanceTo, chooseFork, locked, wRank,
  forkFact, endFacts, pricier, DEFAULT_SEED, COMBO_MOVE, FACT_GAP, Month, Run, Policy, SeenFact,
} from '../src/fork/sim'
import { FORKS, SCAMS, FATIGUE, SURPRISES, CURATED_SURPRISES, JOYS, ForkCard, forkById } from '../src/fork/deck'
import { NINO } from '../src/engine/personas'

let fails = 0
const check = (name: string, ok: boolean, info = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ': ' + info : ''}`) }
const fmt = (n: number) => Math.round(n).toString()
const EMO = { sun: '☀', cloud: '🌥', storm: '⛈' } as const

function describe(m: Month, r: Run) {
  const end = endingOf(m, r)
  const where = r.failed ? ` (stopped on day ${r.failed.day}: ${r.failed.label} ${r.failed.amount} ₾, account ${fmt(r.failed.money)} ₾)` : ''
  return `${EMO[end]} ${end} · payday ${fmt(r.money)} ₾ · ⚡ min ${r.minEnergy}, ran out ${r.zeroHits}× · forks ${fmt(r.spent.forks)} ₾, everyday ${fmt(r.spent.bg)} ₾, bills ${fmt(r.spent.bills)} ₾, chains ${fmt(r.spent.chains)} ₾, tired ${fmt(r.spent.fatigue)} ₾, surprises ${fmt(r.spent.surprises)} ₾ · ${runSeconds(m, r).toFixed(0)} s${where}`
}

// 1. the default month
const m = buildMonth(DEFAULT_SEED)
const fc0 = forecast(m, newRun(m))
console.log(`month: ${m.forks.length} forks, ${m.items.filter(i => i.kind === 'scam').length} scams, ${m.items.filter(i => i.kind === 'joy').length} joys, ${m.bills.length} bills, ${m.surprises.length} unexpected (${m.surprises.map(s => `${s.t} ${s.p} ₾ day ${s.day}`).join(', ') || 'none'})`)
console.log(`      start ${m.startMoney} ₾, cushion ${m.cushion} ₾, everyday scale ${m.kScale.toFixed(2)} (≈ ${fmt(m.bg.reduce((a, b) => a + b, 0))} ₾/month), day-0 forecast ≈ ${fmt(fc0.p50)} ₾ ${fc0.weather} (${(fc0.pBelow * 100).toFixed(0)}% below cushion), length ${m.length} px`)

const a = buildMonth(DEFAULT_SEED), b = buildMonth(DEFAULT_SEED)
check('same seed → same month', JSON.stringify([a.forks.map(f => [f.id, f.x, f.opts[0].t]), a.items, a.bg, a.surprises]) === JSON.stringify([b.forks.map(f => [f.id, f.x, f.opts[0].t]), b.items, b.bg, b.surprises]))
check('same seed → same finish', playBot(a, botBalanced).money === playBot(b, botBalanced).money)

const bots: [string, Policy][] = [['always-cheap', botCheap], ['always-paid', botPaid], ['balanced', botBalanced]]
const res: Record<string, Run> = {}
for (const [name, pol] of bots) { res[name] = playBot(m, pol); console.log(`     ${name.padEnd(12)} ${describe(m, res[name])}`) }
check('always-cheap does not reach ☀', endingOf(m, res['always-cheap']) !== 'sun')
check('always-paid does not reach ☀', endingOf(m, res['always-paid']) !== 'sun')
check('balanced reaches ☀', endingOf(m, res['balanced']) === 'sun')
const secs = runSeconds(m, res['balanced'])
check('a run takes 60–90 s at normal speed', secs >= 60 && secs <= 90, `${secs.toFixed(1)} s (no stops at forks)`)
{
  // the same month played frame by frame: each fork chosen 1.5 s after its pads show (a first-time reader)
  const t15 = playTimed(m, botBalanced, 1.5)
  check('with a 1.5 s reading delay the run still takes 60–90 s', t15.secs >= 60 && t15.secs <= 90, `${t15.secs.toFixed(1)} s, Jikho stopped at ${t15.stops} of ${m.forks.length} forks`)
  const slow = [2, 2.5, 3].map(R => { const t = playTimed(m, botBalanced, R); return `${R} s → ${t.secs.toFixed(0)} s (${t.stops} stops)` })
  console.log(`     slower readers: ${slow.join(', ')}`)
  // the combo celebration is a spin on the ground: with good jumps, no reaction time makes Jikho land on a scam
  let hits = 0, spins = 0
  const where: string[] = []
  for (const R of [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8]) for (const pol of [botBalanced, botCheap]) {
    const t = playTimed(m, pol, R)
    hits += t.r.scamsHit
    spins += t.spins + t.flips
    if (t.r.scamsHit) where.push(`${R} s: ${t.r.scamsHit}`)
  }
  check('combo celebrations never land Jikho on a scam', COMBO_MOVE === 'spin' && hits === 0, `${spins} celebrations, ${hits} scams hit${where.length ? ' (' + where.join(', ') + ')' : ''}`)
}
const cheapDays = new Set(m.forks.map(f => Math.floor(f.day)))
check('20–25 forks in the month', m.forks.length >= 20 && m.forks.length <= 25, `${m.forks.length} forks on ${cheapDays.size} different days`)

// 2. the lesson beat: paying a bill drops the account, the payday forecast barely moves
{
  // replay the balanced bot's choices up to the rent summit, then step over the rent day
  const bal = playBot(m, botBalanced)
  const r = newRun(m)
  for (const f of m.forks.filter(f => f.day < 21)) { advanceTo(m, r, f.x); chooseFork(m, r, f.i, bal.choice[f.i]!) }
  advanceTo(m, r, m.dayX[21] - 1)
  const before = forecast(m, r), money0 = r.money
  advanceTo(m, r, m.dayX[21] + 1)
  const after = forecast(m, r)
  const drop = money0 - r.money
  check('rent day: account drops, payday forecast barely moves', drop >= 660 && Math.abs(after.p50 - before.p50) < 40, `account −${fmt(drop)} ₾, payday ${fmt(before.p50)} → ${fmt(after.p50)} ₾ (${before.weather} → ${after.weather})`)
}

// 2b. a choice never raises the payday forecast; the cheaper option keeps it; lending is money gone this month
{
  let rises = 0, keeps = 0, diffSky = 0, n = 0
  let lend = ''
  for (const pol of [botBalanced, botCheap, botPaid]) {
    const r = newRun(m)
    for (const f of m.forks) {
      advanceTo(m, r, f.x)
      if (r.failed) break
      const now = forecast(m, r), a = forecast(m, r, { f: f.i, side: 0 }), b = forecast(m, r, { f: f.i, side: 1 })
      if (a.p50 > now.p50 + 0.5 || b.p50 > now.p50 + 0.5) rises++
      if (Math.abs(Math.max(a.p50, b.p50) - now.p50) < 0.5) keeps++
      if (a.weather !== b.weather) diffSky++
      n++
      if (f.id === 'friend' && !lend) {
        const s = f.opts[0].back ? 0 : 1
        lend = `lending ${Math.round(now.p50 - (s ? b : a).p50)} ₾, refusing ${Math.round(now.p50 - (s ? a : b).p50)} ₾`
      }
      let side = pol(m, r, f)
      if (locked(m, r, f.i, side)) side = (1 - side) as 0 | 1
      chooseFork(m, r, f.i, side)
    }
  }
  check('no fork option raises the payday forecast', rises === 0, `${rises} of ${n} forks`)
  check('the cheaper option keeps the payday forecast where it is', keeps === n, `${keeps}/${n}; previews show different skies at ${diffSky}/${n}`)
  check('lending to a friend lowers this month\'s payday forecast (it comes back after payday)', /^lending 50 ₾, refusing 0 ₾$/.test(lend), lend)
  // the combo never counts a choice that darkens the payday sky or leaves ⚡ below 3
  let bad = 0, counted = 0
  let sd = 4242
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff }
  for (let k = 0; k < 200; k++) {
    const r = newRun(m)
    for (const f of m.forks) {
      advanceTo(m, r, f.x)
      if (r.failed || r.arrived) break
      const before = forecast(m, r)
      let side: 0 | 1 = rnd() < 0.5 ? 0 : 1
      if (locked(m, r, f.i, side)) side = (1 - side) as 0 | 1
      const fx = chooseFork(m, r, f.i, side)
      const c = fx[0]
      if (c && c.k === 'choose' && c.balanced) { counted++; if (wRank(forecast(m, r).weather) > wRank(before.weather) || r.energy < 3) bad++ }
    }
  }
  check('the combo never counts a choice that darkens the sky or leaves ⚡ below 3', bad === 0, `${counted} balanced choices in 200 random months, ${bad} wrong`)
}

// 3. other months (information): how often each bot reaches ☀
{
  const N = 60
  const count: Record<string, number> = { 'always-cheap': 0, 'always-paid': 0, balanced: 0 }
  const lens: number[] = []
  for (let s = 1; s <= N; s++) {
    const mm = buildMonth(DEFAULT_SEED + s * 101)
    for (const [name, pol] of bots) if (endingOf(mm, playBot(mm, pol)) === 'sun') count[name]++
    lens.push(runSeconds(mm))
  }
  console.log(`     other months (${N}): ☀ always-cheap ${count['always-cheap']}, always-paid ${count['always-paid']}, balanced ${count.balanced}; run ${Math.min(...lens).toFixed(0)}–${Math.max(...lens).toFixed(0)} s`)
  check('balanced reaches ☀ in most other months', count.balanced >= N * 0.7, `${count.balanced}/${N}`)
  // calm variant (Tamar): no scams on the road
  const calm = buildMonth(DEFAULT_SEED, true)
  check('calm month has no scams', calm.items.every(i => i.kind !== 'scam'))
  console.log(`     calm balanced: ${describe(calm, playBot(calm, botBalanced))}`)
}

// 4. red lines: no advice words, scores, coins or "game over" in the runner's text
{
  const files: string[] = []
  const walk = (d: string) => { for (const f of readdirSync(d)) { const pth = join(d, f); if (statSync(pth).isDirectory()) walk(pth); else if (/\.tsx?$/.test(f)) files.push(pth) } }
  walk(new URL('../src/fork', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
  const banned = [/უნდა/, /შეცდომ/, /ჭკვიან/, /ქულ/, /მონეტ/, /ქეშბექ/, /game over/i, /წააგე/, /დამოკიდებულ/, /რეიტინგ/, /ბონუს/, /განვადებ/, /კრედიტ/, /გირჩევ/, /სჯობ/, /აჯობ/]
  const hits: string[] = []
  for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const text = (line.match(/'[^']*'|"[^"]*"|`[^`]*`|>[^<{]+</g) ?? []).join(' ')
    for (const bw of banned) if (bw.test(text)) hits.push(`${f.split(/[\\/]/).slice(-2).join('/')}:${i + 1} ${bw}`)
  })
  check('red-line words absent from runner text', hits.length === 0, hits.join('; '))
  // no fork option is a loan or an installment for the player
  const credit = FORKS.flatMap(f => [f.a, f.b]).filter(o => /სესხ|განვად|კრედიტ/.test(o.t) && !/ვასესხებ/.test(o.t))
  check('no credit option at any fork', credit.length === 0, credit.map(o => o.t).join(', '))
}

// 5. the deck's own rules and text limits (pads, road signs and the fact bubble must not cut the text)
{
  const len = (t: string) => [...t].length
  const over: string[] = []
  const lim = (what: string, t: string | undefined, max: number) => { if (t !== undefined && len(t) > max) over.push(`${what} (${len(t)}>${max}): ${t}`) }
  for (const f of FORKS) {
    lim(`${f.id}.q`, f.q, 36)
    for (const o of [f.a, f.b]) {
      lim(`${f.id} label`, `${o.e} ${o.t}`, 24)
      lim(`${f.id} later`, o.later?.t, 32)
      lim(`${f.id} later fact`, o.later?.fact, 70)
      lim(`${f.id} back`, o.back?.t, 50)
    }
    lim(`${f.id}.fact`, f.fact, 70)
  }
  for (const sc of SCAMS) { lim('scam sign', sc.sign, 36); lim('scam road', sc.short, 18); lim('scam hit', sc.hit, 44); lim('scam rule', sc.rule, 70) }
  for (const x of [...FATIGUE, ...SURPRISES, ...CURATED_SURPRISES]) lim('fatigue/surprise', x.t, 34)
  for (const j of JOYS) lim('joy', j.t, 22)
  check('every question, label, fact and road text stays within its length limit', over.length === 0, over.join('; '))
  const ids = FORKS.map(f => f.id)
  check('fork ids are unique', new Set(ids).size === ids.length)
  const sameIcon = FORKS.filter(f => f.a.e === f.b.e).map(f => f.id)
  check('the two signs of a fork show different emoji (a road sign shows only the emoji and the price)', sameIcon.length === 0, sameIcon.join(', '))
  const order = FORKS.filter(f => f.a.p < f.b.p || (f.cat !== 'energy' && f.a.p === f.b.p)).map(f => f.id)
  check('option a is the pricier sign at every fork', order.length === 0, order.join(', '))
  const joy = FORKS.filter(f => (f.cat === 'social' || f.cat === 'want') && f.a.en !== f.b.en).map(f => f.id)
  const wants = FORKS.filter(f => f.cat === 'want' && (f.a.en || f.b.en)).map(f => f.id)
  check('equal-joy rule: paid and free fun give the same ⚡, wants give none', joy.length + wants.length === 0, [...joy, ...wants].join(', '))
  const chains = FORKS.filter(f => f.cat === 'chain' && !f.a.back && !(f.b.later && f.b.later.p > f.a.p)).map(f => f.id)
  check('a chain\'s cheap sign costs more later than the paid one now', chains.length === 0, chains.join(', '))
  check('every scam carries its rule (the fact shown after a hit)', SCAMS.every(sc => !!sc.rule))

  // facts: about every 2nd–3rd fork (when every eligible fact shows), and up to three facts on the end card
  const shown = (mm: Month) => { let last = -99, n = 0; for (const f of mm.forks) if (forkFact(mm, f.i, last)) { last = f.i; n++ } return n }
  const n0 = shown(m)
  check('facts show after about every 2nd–3rd fork of the default month', n0 >= Math.floor(m.forks.length / 3) && n0 <= Math.ceil(m.forks.length / FACT_GAP), `${n0} facts for ${m.forks.length} forks (at most one per ${FACT_GAP} forks)`)
  const counts: number[] = []
  for (let s = 1; s <= 40; s++) counts.push(shown(buildMonth(DEFAULT_SEED + s * 101)))
  console.log(`     facts in other months: ${Math.min(...counts)}–${Math.max(...counts)} per month`)
  let badEnd = ''
  for (const [name, pol] of bots) {
    const r = playBot(m, pol)
    let last = -99
    const seen: SeenFact[] = []
    for (const f of m.forks) { const t = forkFact(m, f.i, last); if (t && r.choice[f.i] !== undefined) { last = f.i; seen.push({ t, w: pricier(f, r.choice[f.i]!) ? 2 : 1, p: pricier(f, r.choice[f.i]!) ? f.opts[r.choice[f.i]!].p : 0 }) } }
    for (const sc of r.sched) if (sc.done && sc.fact) seen.push({ t: sc.fact, w: 3, p: sc.p })
    const ef = endFacts(m, r, seen)
    if (ef.length < 1 || ef.length > 3 || new Set(ef).size !== ef.length) badEnd += `${name}: ${ef.length}; `
    console.log(`     end-card facts (${name}): ${ef.join(' | ')}`)
  }
  check('the end card shows one to three different facts', badEnd === '', badEnd)

  // facts as a played month shows them: notices, scam banners and scam rules hold them back (sim.ts: factMayShow)
  const factId = (t: string) => FORKS.find(f => f.fact === t)?.id ?? '?'
  const tf = playTimed(m, botBalanced, 1.0)
  check('facts that actually show in a played default month: about every 2nd–3rd fork', tf.facts.shown.length >= 7,
    `${tf.facts.shown.length} of ${n0} eligible (${tf.facts.shown.map(factId).join(', ')}), ${tf.facts.dropped} dropped, ${tf.facts.cut} cut short, ${tf.facts.bannerS.toFixed(1)} s next to a scam banner`)
  // a small phone (e.g. 375×667, 320×640): no room for a scam banner and a fact together, so fewer facts show
  const tsm = playTimed(m, botBalanced, 1.0, 0, 1, false)
  check('on a small phone a fact never shares the screen with a scam banner, and facts still show', tsm.facts.bannerS === 0 && tsm.facts.shown.length >= 5,
    `${tsm.facts.shown.length} shown (${tsm.facts.shown.map(factId).join(', ')}), ${tsm.facts.dropped} dropped, ${tsm.facts.cut} cut short`)
  let ruleS = 0, cutH = 0, shownH = 0
  for (let s = 1; s <= 6; s++) { const th = playTimed(m, botBalanced, 1.0, 0.3, s); ruleS += th.facts.ruleS; cutH += th.facts.cut; shownH += th.facts.shown.length }
  check('with a third of the scams hit, a fact never shares the screen with a scam rule', ruleS === 0, `6 runs: ${shownH} facts shown, ${cutH} cut short, ${ruleS.toFixed(1)} s next to a rule`)
  const played: number[] = []
  for (let s = 1; s <= 30; s++) played.push(playTimed(buildMonth(DEFAULT_SEED + s * 101), botBalanced, 1.0, 0.2, s).facts.shown.length)
  console.log(`     facts shown in played other months: ${Math.min(...played)}–${Math.max(...played)} (avg ${(played.reduce((a, b) => a + b, 0) / played.length).toFixed(1)})`)
  check('other played months show facts too', Math.min(...played) >= 4, `fewest ${Math.min(...played)}`)

  // every amount in a fact comes from the prices it talks about, so a retune cannot quietly make a fact false
  const nums = (t: string) => (t.match(/\d+(?:,\d+)?/g) ?? []).map(v => Number(v.replace(',', '.'))).sort((x, y) => x - y)
  const rent = NINO.fixed.find(f => f.kind === 'rent')!.amount
  const gymBill = NINO.fixed.find(f => f.kind === 'sport')!.amount
  const decWeek = m.bills.filter(b => b.day >= 21 && b.day <= 27)
  const src: Record<string, (f: ForkCard) => number[]> = {
    bolt: f => [f.a.p, f.b.p, 20, (f.a.p - f.b.p) * 20],
    dinner: f => [f.a.p, f.a.p * 30, rent],
    lunch: f => [f.a.p, f.b.p, 20, (f.a.p - f.b.p) * 20],
    groceries: f => [f.a.p, f.b.p, 4, (f.a.p - f.b.p) * 4],
    night: f => [f.a.p, f.b.p, f.a.p / f.b.p],
    marshrutka: f => [f.a.p, f.b.p, 5, (f.a.p - f.b.p) * 5],
    nails: f => [f.a.p, f.b.p, (f.a.p - f.b.p) * 2],
    dishes: f => [f.a.p, 4, f.a.p * 4],
    cinema: f => [f.a.p, f.a.p * 4],
    karaoke: f => [f.a.p, f.a.p * 4],
    screen: f => [f.a.p, Math.floor(f.a.p / f.b.p), f.a.p - Math.floor(f.a.p / f.b.p) * f.b.p],
    rain: f => [forkById('bolt').a.p, f.a.p],
    bar: f => [f.a.p, f.a.p * 4],
    blackfriday: f => [(f.a.p * 5) / 3, 40, (f.a.p * 5) / 3 - f.a.p, f.a.p],
    temu: f => [Math.round(f.a.p / 12), 12, f.a.p],
    coffee: f => [f.a.p, 20, f.a.p * 20],
    series: f => [3, f.a.p, 3 * f.a.p, 36 * f.a.p],
    gym: () => [gymBill, 1, gymBill, 8, gymBill / 8],
    tooth: () => [m.cushion],
    laundry: () => [m.bills.length, decWeek.length, 1, 7],
  }
  const same = (x: number[], y: number[]) => x.length === y.length && x.every((v, k) => Math.abs(v - y[k]) < 1e-9)
  const wrong: string[] = []
  const want = (what: string, t: string | undefined, exp: number[] | null) => {
    if (!t) return
    const got = nums(t), e = (exp ?? []).slice().sort((x, y) => x - y)
    if (!same(got, e)) wrong.push(`${what}: ${got.join('/')} ≠ ${exp ? e.join('/') : 'no source'}`)
  }
  for (const f of FORKS) {
    want(`${f.id}.fact`, f.fact, src[f.id] ? src[f.id](f) : null)
    for (const o of [f.a, f.b]) if (o.later) {
      const other = o === f.a ? f.b : f.a
      want(`${f.id} later fact`, o.later.fact, [other.p, o.later.p])
      want(`${f.id} was`, o.later.was, [other.p])
    }
    if (f.a.back) want(`${f.id} back`, f.a.back.t, [f.a.back.p])
  }
  const blackQ = forkById('blackfriday').q.includes('−40%'), rainQ = forkById('rain').a.p === 2 * forkById('bolt').a.p
  const rentIn = decWeek.some(b => b.label === NINO.fixed.find(f => f.kind === 'rent')!.name)
  const temuQ = forkById('temu').q.includes('12')
  const daysOfCushion = m.cushion / (m.bg.reduce((x, y) => x + y, 0) / 30)
  check('every amount in a fact matches the prices and bills it comes from', wrong.length === 0 && blackQ && rainQ && rentIn && temuQ && daysOfCushion >= 2 && daysOfCushion <= 9,
    [...wrong, blackQ ? '' : 'black friday is not −40%', rainQ ? '' : 'rain is not Bolt ×2', rentIn ? '' : 'rent is not on 1–7 Dec', temuQ ? '' : 'temu question lost its 12', `cushion = ${daysOfCushion.toFixed(1)} days of everyday spending`].filter(Boolean).join('; '))
}

console.log(fails === 0 ? '\nFORK OK' : `\n${fails} FAILED`)
process.exit(fails ? 1 : 0)
