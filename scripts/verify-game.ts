// Self-check for the mini-game "გზა ხელფასამდე": determinism, calibration against the engine, pitch seed, red-line words.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PERSONAS, NINO } from '../src/engine/personas'
import { buildCycle, playHeadless, total, DEFAULT_SEED, WINDOW_BEFORE, WINDOW_AFTER, WINDOW_SPEED, Cycle, Policy } from '../src/game/cycle'

let fails = 0
const check = (name: string, ok: boolean, info = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ': ' + info : ''}`) }
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

const half: Policy = (ev, _i, nth) => (ev.kind === 'dilemma' ? 1 : ev.kind === 'joy' ? true : nth % 2 === 0)
const none: Policy = ev => (ev.kind === 'dilemma' ? 2 : ev.kind === 'joy')
const all: Policy = ev => (ev.kind === 'dilemma' ? 0 : true)

/** seconds for one run: constant speed, slower only inside decision windows (cards pause and are not counted) */
function duration(c: Cycle) {
  const slow = c.events.filter(e => e.kind === 'temptation' || e.kind === 'joy').length * (WINDOW_BEFORE + WINDOW_AFTER)
  return (c.nDays - slow) * c.secPerDay + (slow * c.secPerDay) / WINDOW_SPEED
}

// 1. same seed → same events and the same finish
for (const p of PERSONAS) {
  const a = buildCycle(p), b = buildCycle(p)
  check(`${p.id} same seed → same events`, JSON.stringify(a.events) === JSON.stringify(b.events) && JSON.stringify(a.daily) === JSON.stringify(b.daily))
  const fa = total(a, playHeadless(a, a.qvevriOptions[2], half)), fb = total(b, playHeadless(b, b.qvevriOptions[2], half))
  check(`${p.id} same seed → same finish`, fa === fb, `${fa.toFixed(2)} == ${fb.toFixed(2)}`)
  const w = a.events.filter(e => e.kind === 'temptation' || e.kind === 'joy').length
  console.log(`     ${p.id}: ${a.nDays} days, ${a.events.filter(e => e.kind === 'bill').length} bills, ${a.events.filter(e => e.kind === 'temptation').length} temptations, ${w - a.events.filter(e => e.kind === 'temptation').length} joys, ${a.events.filter(e => e.kind === 'oneoff').length} unexpected, ~${duration(a).toFixed(0)} s, window ${((WINDOW_BEFORE + WINDOW_AFTER) * a.secPerDay / WINDOW_SPEED).toFixed(2)} s`)
}

// 2. "about half the temptations" lands near the engine's median for the next payday (±15%)
for (const p of PERSONAS) {
  const ends = { half: [] as number[], none: [] as number[], all: [] as number[] }
  let zeroOneoff = 0, eng = 0
  for (let s = 0; s < 400; s++) {
    const c = buildCycle(p, DEFAULT_SEED[p.id] + s)
    eng = c.engineMedian
    if (!c.events.some(e => e.kind === 'oneoff')) zeroOneoff++
    ends.half.push(total(c, playHeadless(c, 0, half)))
    ends.none.push(total(c, playHeadless(c, 0, none)))
    ends.all.push(total(c, playHeadless(c, 0, all)))
  }
  const m = median(ends.half)
  const tol = Math.abs(eng) * 0.15
  check(`${p.id} half temptations ≈ engine median ±15%`, Math.abs(m - eng) <= tol, `game ${m.toFixed(0)} vs engine ${eng} (±${tol.toFixed(0)}); skip all ${median(ends.none).toFixed(0)}, take all ${median(ends.all).toFixed(0)}; no unexpected cost in ${((zeroOneoff / 400) * 100).toFixed(0)}% of months`)
  check(`${p.id} the qvevri amount does not change the finish`, (() => { const c = buildCycle(p); return Math.abs(total(c, playHeadless(c, 0, half)) - total(c, playHeadless(c, c.qvevriOptions[3], half))) < 1e-9 })())
}

// 3. the pitch seed (Nino): one unexpected cost, early, smaller than the first non-zero qvevri option, before the first dilemma
{
  const c = buildCycle(NINO)
  const oo = c.events.filter(e => e.kind === 'oneoff')
  const d1 = c.events.find(e => e.kind === 'dilemma')!
  const ok = oo.length === 1 && oo[0].amount <= c.qvevriOptions[1] && oo[0].at < d1.at && oo[0].at >= 2
  check('nino pitch seed', ok, oo.map(o => `${o.label} ${o.kind === 'oneoff' ? o.amount : ''} ₾ on day ${Math.floor(o.at) + 1}`).join(', ') + ` · qvevri options ${c.qvevriOptions.join('/')} · first dilemma day ${Math.floor(d1.at) + 1}`)
  if (!ok) {
    const good: number[] = []
    for (let s = 0; s < 400 && good.length < 8; s++) {
      const cc = buildCycle(NINO, NINO.seed + s)
      const o = cc.events.filter(e => e.kind === 'oneoff')
      const dd = cc.events.find(e => e.kind === 'dilemma')!
      if (o.length === 1 && o[0].kind === 'oneoff' && o[0].amount <= cc.qvevriOptions[1] && o[0].at >= 2 && o[0].at < Math.min(dd.at, 8)) good.push(s)
    }
    console.log('     candidate offsets from NINO.seed:', good.join(', '))
  }
}

// 4. red lines: no advice words, scores, coins or "game over" anywhere in the game's text
{
  const files: string[] = []
  const walk = (d: string) => { for (const f of readdirSync(d)) { const pth = join(d, f); if (statSync(pth).isDirectory()) walk(pth); else if (/\.tsx?$/.test(f)) files.push(pth) } }
  walk(new URL('../src/game', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
  const banned = [/უნდა/, /შეცდომ/, /ჭკვიან/, /ქულ/, /მონეტ/, /ქეშბექ/, /game over/i, /წააგე/, /დამოკიდებულ/, /რეიტინგ/, /ბონუს/]
  const hits: string[] = []
  for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const text = (line.match(/'[^']*'|"[^"]*"|`[^`]*`|>[^<{]+</g) ?? []).join(' ')
    for (const b of banned) if (b.test(text)) hits.push(`${f.split(/[\\/]/).slice(-2).join('/')}:${i + 1} ${b}`)
  })
  check('red-line words absent from game text', hits.length === 0, hits.join('; '))
}

console.log(fails === 0 ? '\nGAME OK' : `\n${fails} FAILED`)
process.exit(fails ? 1 : 0)
