import { motion } from 'framer-motion'
import { WEATHER_LABEL, weatherOf } from '../../engine/engine'
import { Jikho, Accessory } from '../../components/Jikho'
import { WEMOJI, WCOLOR, InfoTip, Disclaimer } from '../../components/ui'
import { gel, fmt } from '../../engine/view'
import { Cycle, Run, total, bgSpent, CAT_LABEL, Cat } from '../cycle'

interface Props {
  c: Cycle
  r: Run
  calm: boolean
  stage: 0 | 1 | 2 | 3
  accessories: Accessory[]
  onRestart: () => void
  onExit: () => void
  onCheck: () => void
  onTalk: () => void
}

/** payday: facts only — where you landed, where the money went, the qvevri, joy; no score, no verdict */
export function Finish({ c, r, calm, stage, accessories, onRestart, onExit, onCheck, onTalk }: Props) {
  const end = total(c, r)
  const w = weatherOf(end < c.cushion ? 1 : 0)
  const diff = Math.round(end - c.cushion)
  const daily = bgSpent(c, c.nDays)
  const parts = [
    { label: 'გადასახადები', v: r.bills, color: '#1f3b57' },
    { label: 'შენი არჩევანი', v: daily + r.chosen, color: '#5aa9e6' },
    { label: 'მოულოდნელი', v: r.oneoff, color: '#c98b5b' },
  ]
  const out = parts.reduce((s, p) => s + p.v, 0) || 1
  const byCat = new Map<Cat, number>()
  for (const t of r.taken) byCat.set(t.cat, (byCat.get(t.cat) ?? 0) + t.price)
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
  const temptations = r.taken.filter(t => c.events[t.idx].kind === 'temptation').sort((a, b) => b.price - a.price)
  const left = r.qvevri

  return (
    <motion.div className={'g-end' + (calm ? ' calm' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-info-root>
      <div style={{ textAlign: 'center' }}>
        <Jikho size={110} mood="celebrate" stage={stage} accessories={accessories} />
        <div className="display" style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>ხელფასის დღე! 🔔</div>
        <div className="muted small">{c.paydayLabel} · ჩავედით</div>
        <div className="big" style={{ marginTop: 10 }}>{gel(Math.round(end))}</div>
        <div className="chip" style={{ marginTop: 8, background: WCOLOR[w] + '22', color: WCOLOR[w], whiteSpace: 'normal' }}>
          {WEMOJI[w]} {WEATHER_LABEL[w]} · {diff >= 0 ? `ზღვარზე ${gel(diff)}-ით მეტი` : `ზღვარამდე ${gel(-diff)} აკლდა`}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, position: 'relative' }}>
        <div className="between">
          <div className="h3">სად წავიდა ფული</div>
          <InfoTip label={'რა შედის „შენს არჩევანში"?'}>
            <div>ყოველდღიური ხარჯი: {gel(Math.round(daily))}</div>
            <div>გზაზე აღებული: {gel(r.chosen)}</div>
          </InfoTip>
        </div>
        <div className="g-split">{parts.map(p => <div key={p.label} style={{ width: `${(p.v / out) * 100}%`, background: p.color }} />)}</div>
        <div style={{ display: 'grid', gap: 3 }}>
          {parts.map(p => (
            <div key={p.label} className="between small">
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: p.color, marginRight: 6 }} />{p.label}</span>
              <b>{gel(Math.round(p.v))}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 10, display: 'grid', gap: 9 }}>
        <div className="g-row"><span className="i">🧭</span><span>{top ? <>ყველაზე მეტი თავისუფალი ფული: <b>{CAT_LABEL[top[0]]} · {gel(top[1])}</b></> : 'გზაზე თავისუფალი ფული არ დაგიხარჯავს.'}</span></div>
        <div className="g-row"><span className="i">🏺</span><span>
          {r.qvevriStart === 0 ? 'ამჯერად ქვევრი ცარიელი იყო.'
            : r.oneoffFromQvevri > 0 ? <>ქვევრი გაიხსნა {gel(r.oneoffFromQvevri)}-ის ხარჯზე{left > 0 ? `, ${gel(left)} შენთან დარჩა` : ''}.</>
            : <>ქვევრი ხელუხლებელია, {gel(left)} შენთან დარჩა.</>}
        </span></div>
        <div className="g-row"><span className="i">🙂</span><span>სიხარული: <b>{r.joy}</b>{r.joy > 0 ? `, აქედან ${r.joyFree} უფასო` : ''}</span></div>
        {!calm && temptations.length > 0 && (
          <div className="g-row"><span className="i">💭</span><span>თუ ერთ-ერთ ცდუნებას ჩაუვლიდი, დაგრჩებოდა ~{fmt(Math.round(end + temptations[0].price))} ₾.</span></div>
        )}
      </div>

      {calm && (
        <button className="card" style={{ marginTop: 10, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }} onClick={onTalk}>
          <span style={{ fontSize: 22 }}>🤝</span>
          <span className="h3" style={{ flex: 1 }}>ერთად დავალაგოთ გადასახადები</span>
          <span className="muted">›</span>
        </button>
      )}

      <div className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>ეს 1 000 შესაძლო თვიდან ერთ-ერთია.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <button className="pill-btn btn-ghost" onClick={onRestart}>↺ თავიდან</button>
        <button className="pill-btn btn-ghost" onClick={onExit}>უკან გზაზე</button>
      </div>
      <button className="pill-btn btn-sun" style={{ marginTop: 8 }} onClick={onCheck}>ყიდვამდე შეამოწმე</button>
      <Disclaimer />
    </motion.div>
  )
}
