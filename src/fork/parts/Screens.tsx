import { motion } from 'framer-motion'
import { fmt } from '../../engine/view'
import { Jikho, Accessory } from '../../components/Jikho'
import { Month, Run, Ending, keepTogether } from '../sim'
import { Best, SeedRec } from '../best'

const times = (n: number) => (n === 1 ? 'ერთხელ' : `${n}-ჯერ`)
const ICON: Record<Ending, string> = { sun: '☀️', cloud: '🌥️', storm: '🌧️' }

export function StartCard({ onStart, note, best, touch, calm, stage, accessories }: { onStart: () => void; note: string | null; best: Best; touch: boolean; calm: boolean; stage: 0 | 1 | 2 | 3; accessories: Accessory[] }) {
  const lines = [
    { i: '⇅', t: 'აირჩიე გზა', s: touch ? 'ქვედა ღილაკი: დააკავე და ნახე, აუშვი და წადი' : '↑ ↓ ან ქვედა ღილაკები' },
    calm ? { i: '👆', t: 'ახტი სიხარულებისკენ', s: touch ? 'შეეხე ეკრანს' : 'Space ან დააწკაპუნე' } : { i: '👆', t: 'ახტი თაღლითებს', s: touch ? 'შეეხე ეკრანს' : 'Space ან დააწკაპუნე' },
    { i: '🎯', t: 'ხელფასამდე ☀️-ით ჩადი', s: 'ფული ზღვარს ზემოთ, ⚡ არასდროს 0' },
  ]
  return (
    <motion.div className="f-over f-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={e => e.stopPropagation()}>
      <div className="f-start-hero">
        <Jikho size={132} mood="happy" stage={stage} accessories={accessories} walking />
      </div>
      <h1 className="f-title">გზის გასაყარი</h1>
      <div className="f-sub">ნინოს თვე: 10 ნოემბრიდან 10 დეკემბრამდე</div>
      {note && <div className="f-note">{note}</div>}
      <div className="f-lines">
        {lines.map(l => (
          <div key={l.t} className="f-line"><span className="i">{l.i}</span><span><b>{l.t}</b><small>{l.s}</small></span></div>
        ))}
      </div>
      <button className="f-go" onClick={onStart} autoFocus>დაწყება</button>
      {best.runs > 0 && <div className="f-best"><span>☀️-ით ჩასვლა: <b>{best.suns}</b> · ცდა: <b>{best.runs}</b></span></div>}
    </motion.div>
  )
}

interface EndProps {
  m: Month
  r: Run
  kind: Ending
  prev: SeedRec | null
  note: string | null
  stage: 0 | 1 | 2 | 3
  accessories: Accessory[]
  /** up to three true facts from this month (the ones met on the way first) */
  facts: string[]
  onReplay: () => void
  onNew: () => void
  onExit: () => void
}

export function EndCard({ m, r, kind, prev, note, stage, accessories, facts: known, onReplay, onNew, onExit }: EndProps) {
  const land = Math.round(r.failed ? r.failed.money : r.money)
  const nScams = m.items.filter(i => i.kind === 'scam').length
  const title = kind === 'sun' ? 'წონასწორობა' : kind === 'cloud' ? 'ჩავედით' : 'გზა შეწყდა'
  const lines: string[] = []
  if (kind === 'sun') lines.push('ხელფასამდე ჩახვედი: ფულიც გეყო და ენერგიაც.')
  if (kind === 'cloud') {
    if (land < m.cushion) lines.push(`ხელფასამდე მიაღწიე, ზღვარს ${fmt(m.cushion - land)} ₾ დააკლდა.`)
    if (r.zeroHits) lines.push(`⚡ გზაში ${times(r.zeroHits)} დაიცალა.`)
  }
  if (kind === 'storm' && r.failed) {
    lines.push(`${m.days[r.failed.day].label}: ${r.failed.icon} ${r.failed.label} ${fmt(r.failed.amount)} ₾ — ანგარიშზე ${fmt(r.failed.money)} ₾ იყო.`)
    lines.push('იგივე თვე სხვა გზითაც შეიძლება გაიარო.')
  }
  const loan = r.picks.find(p => p.back)
  const loanText = loan ? m.forks[loan.i].opts[r.choice[loan.i]!].back?.t : null
  if (loanText) lines.push(`🤝 ${loanText}.`)
  const choices = r.spent.forks + r.spent.chains - r.back
  const facts = [
    { i: '🧾', t: 'გადასახადები', v: `${fmt(r.spent.bills)} ₾` },
    { i: '🔀', t: 'გზის არჩევანი', v: `${fmt(choices)} ₾` },
    ...(r.lent ? [{ i: '🤝', t: 'ნასესხები', v: `${fmt(r.lent)} ₾ ↩` }] : []),
    { i: '🛒', t: 'ყოველდღიური ხარჯი', v: `${fmt(r.spent.bg)} ₾` },
    ...(nScams ? [{ i: '🎭', t: 'თაღლითები და ხაფანგები', v: r.spent.scams ? `${r.scamsDodged}/${nScams} აირიდე · −${fmt(r.spent.scams)} ₾` : `${r.scamsDodged}/${nScams} აირიდე` }] : []),
    ...(r.spent.surprises ? [{ i: '❓', t: 'მოულოდნელი', v: `${fmt(r.spent.surprises)} ₾` }] : []),
    ...(r.spent.fatigue ? [{ i: '🤒', t: 'დაღლა', v: `${fmt(r.spent.fatigue)} ₾` }] : []),
    { i: '⚡', t: 'ენერგია ბოლოს', v: `${r.energy}/10` },
  ]
  const top = r.picks.filter(p => p.p > 0).sort((a, b) => b.p - a.p).slice(0, 4)
  return (
    <motion.div className={'f-over f-end ' + kind} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} onPointerDown={e => e.stopPropagation()}>
      {kind === 'storm' && <div className="f-softrain" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 6) * 0.25}s` }} />)}</div>}
      <div className="f-end-hero">
        <span className="sky">{ICON[kind]}</span>
        <Jikho size={92} mood={kind === 'sun' ? 'celebrate' : kind === 'cloud' ? 'calm' : 'resting'} stage={stage} accessories={kind === 'storm' ? [...accessories.filter(a => a !== 'umbrella'), 'umbrella'] : accessories} />
      </div>
      <h2 className="f-title small">{title}</h2>
      <div className="f-land">
        <span>{r.failed ? `${m.days[r.failed.day].label}: ანგარიშზე` : 'ხელფასის დღეს ანგარიშზე'}</span>
        <b>{fmt(Math.max(0, land))} ₾</b>
        <small>ზღვარი {fmt(m.cushion)} ₾</small>
      </div>
      {prev && (
        <div className="f-prev">
          <span>წინა ცდა: <b>{ICON[prev.lastKind]} {fmt(Math.max(0, prev.last))} ₾</b></span>
          {prev.best !== null && <span>საუკეთესო ☀️: <b>{fmt(prev.best)} ₾</b></span>}
        </div>
      )}
      <div className="f-btns">
        <button className="f-go" onClick={onReplay} autoFocus>↻ იგივე თვე</button>
        <button className="f-go alt" onClick={onNew}>🗓️ ახალი თვე</button>
      </div>
      {lines.map(l => <p key={l} className="f-endline">{l}</p>)}
      {known.length > 0 && (
        <div className="f-know">
          <span className="lbl">📌 ამ თვის {known.length > 1 ? `${known.length} ფაქტი` : 'ფაქტი'}</span>
          {known.map(t => <p key={t}>{keepTogether(t)}</p>)}
        </div>
      )}
      <details className="f-more">
        <summary>თვის დეტალები</summary>
        <div className="f-facts">
          {facts.map(f => <div key={f.t}><span className="i">{f.i}</span><span className="t">{f.t}</span><b>{f.v}</b></div>)}
        </div>
        {top.length > 0 && (
          <div className="f-picks">
            <span className="lbl">გზაზე ყველაზე დიდი ხარჯები</span>
            <div>{top.map(p => <span key={p.i} className="chip">{p.e} {p.t} · {fmt(p.p)} ₾{p.back ? ' ↩' : ''}</span>)}</div>
          </div>
        )}
      </details>
      <button className="f-back" onClick={onExit}>უკან გზაზე</button>
      {note && <div className="f-note">{note}</div>}
      <div className="f-disc">ℹ️ ინფორმაციაა, არა რჩევა.</div>
    </motion.div>
  )
}
