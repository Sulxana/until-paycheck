import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { MICRO, Visual } from '../../content/learn'
import { TOPICS, TopicId } from '../../content/lessons'
import { useToday, gel, fmt } from '../../engine/view'
import { useStore } from '../../state/store'
import { annuity } from '../../engine/engine'
import { InfoTip } from '../ui'

/** visual's header line + the legend behind the info icon */
function Head({ children, legend }: { children: ReactNode; legend: ReactNode }) {
  return (
    <div className="between" style={{ alignItems: 'flex-start', gap: 8 }}>
      <div style={{ minWidth: 0 }}>{children}</div>
      <InfoTip>{legend}</InfoTip>
    </div>
  )
}

/** "ისწავლე" screen: one picture in the user's own numbers, 2–3 short points, one rule. */
export function MicroLesson({ topic, onDone, doneLabel = 'გასაგებია', kicker = '30-წამიანი გაკვეთილი' }: { topic: TopicId; onDone: () => void; doneLabel?: string; kicker?: string }) {
  const m = MICRO[topic]
  const microDone = useStore(s => s.microDone)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div className="tiny" style={{ fontWeight: 800, color: 'var(--sky)', letterSpacing: 0.3 }}>{kicker}</div>
        <div className="display" style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25, marginTop: 2 }}>{TOPICS[topic].icon} {m.title}</div>
      </div>
      <div data-info-root style={{ background: '#f6f9fc', borderRadius: 16, padding: 14, position: 'relative' }}>
        <LessonVisual v={m.visual} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {m.points.map((pt, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.25 }} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: '#1f3b57', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
            <span style={{ fontSize: 15, lineHeight: 1.5 }}>{pt}</span>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + m.points.length * 0.25 }} style={{ background: '#fff7e0', borderRadius: 14, padding: '10px 12px', fontSize: 15, lineHeight: 1.45 }}>
        <b>წესი:</b> {m.rule}
      </motion.div>
      <button className="pill-btn btn-primary" onClick={() => { microDone(topic); onDone() }}>{doneLabel}</button>
    </div>
  )
}

function Bar({ label, value, max, color, note, delay = 0 }: { label: string; value: number; max: number; color: string; note?: string; delay?: number }) {
  return (
    <div>
      <div className="between small"><span>{label}</span><b>{note ?? gel(value)}</b></div>
      <div style={{ height: 12, borderRadius: 7, background: '#e7edf3', marginTop: 4, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }} transition={{ duration: 0.8, delay }} style={{ height: '100%', background: color, borderRadius: 7 }} />
      </div>
    </div>
  )
}

export function LessonVisual({ v }: { v: Visual }) {
  const t = useToday()
  const { e, p } = t
  if (v === 'fixed') {
    const f = Math.round((e.fixedTotal / p.salary) * 100)
    const va = Math.round((e.monthlyVarMedian / p.salary) * 100)
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <Head legend={<>მუქი — ფიქსირებული ხარჯი ({gel(e.fixedTotal)}) · ცისფერი — ყოველდღიური ხარჯი · მწვანე — რჩება</>}>
          <div className="small" style={{ fontWeight: 800 }}>{p.name}ს ხელფასი: {gel(p.salary)}</div>
        </Head>
        <div style={{ display: 'flex', height: 34, borderRadius: 10, overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${f}%` }} transition={{ duration: 0.8 }} style={{ background: '#1f3b57', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{f}%</motion.div>
          <motion.div initial={{ width: 0 }} animate={{ width: `${va}%` }} transition={{ duration: 0.8, delay: 0.3 }} style={{ background: '#5aa9e6', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{va}%</motion.div>
          <div style={{ flex: 1, background: '#6fbf73' }} />
        </div>
      </div>
    )
  }
  if (v === 'runway') {
    const days = Math.max(0, Math.round(t.landing.p50 / e.avgDaily))
    const left = t.daysLeft
    const n = Math.max(days, left)
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <Head legend={<>ცისფერი — დღეები ხელფასამდე ({left}). ხელფასის დღისთვის დარჩება ~{gel(Math.round(t.landing.p50 / 10) * 10)}, ანუ დაახლოებით {days} დღის ხარჯი. უსაფრთხო ზღვარი: {gel(e.cushion)}.</>}>
          <div className="small"><b>~{gel(Math.round(t.balance))}</b> ÷ <b>~{gel(Math.round(e.avgDaily))}</b> დღეში = <b>{Math.round(t.balance / e.avgDaily)} დღის ხარჯი</b></div>
        </Head>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: Math.min(n, 16) }).map((_, i) => (
            <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }} style={{ width: 18, height: 18, borderRadius: 6, background: i < left ? '#5aa9e6' : '#d7e3ee', border: i === left - 1 ? '2px solid #1f3b57' : 'none' }} />
          ))}
        </div>
      </div>
    )
  }
  if (v === 'compound') {
    const rows = [
      { l: '4 თვე, 0%', c: 0 },
      { l: '12 თვე, 1,5%', c: Math.round(annuity(1200, 0.015, 12) * 12 - 1200) },
      { l: '24 თვე, 1,5%', c: Math.round(annuity(1200, 0.015, 24) * 24 - 1200) },
    ]
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <Head legend="თვიური შენატანი: 300 / 110 / 60 ₾.">
          <div className="small" style={{ fontWeight: 800 }}>1 200 ₾-ის ტელეფონი — რამდენს გადაიხდი ზედმეტად</div>
        </Head>
        {rows.map((r, i) => <Bar key={r.l} label={r.l} value={r.c} max={260} color={i === 2 ? '#d9534f' : i === 1 ? '#f0a03c' : '#58b368'} note={`+${gel(r.c)}`} delay={i * 0.25} />)}
        <div className="tiny muted">ყველაზე პატარა შენატანი ჯამში ყველაზე ძვირი ჯდება.</div>
      </div>
    )
  }
  if (v === 'pti') {
    const debt = e.laptop
    const cap = Math.round(p.salary * 0.25)
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <Head legend={<>წითელი ხაზი — 25%-იანი ზღვარი ({gel(cap)}). ზოლი შემოსავლის 0–50%-ს აჩვენებს.</>}>
          <div className="small">სესხების შენატანი <b>{gel(debt)}</b> ÷ ხელფასი <b>{gel(p.salary)}</b> = PTI <b>{fmt((debt / p.salary) * 100, 1)}%</b></div>
        </Head>
        <div style={{ position: 'relative', height: 22, borderRadius: 8, background: '#e7edf3' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${(debt / p.salary) * 100 * 2}%` }} transition={{ duration: 0.8 }} style={{ position: 'absolute', inset: 0, right: 'auto', background: '#1f3b57', borderRadius: 8 }} />
          <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, borderLeft: '2px dashed #d9534f' }} />
        </div>
      </div>
    )
  }
  if (v === 'savings') {
    const s = p.savings
    const target = s?.target ?? 600, have = s?.amount ?? 0
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="small"><b>{s ? `„${s.name}"` : 'გადაუდებელი ანაბარი'}</b>: {gel(have)} / {gel(target)}</div>
        <Bar label="დაგროვდა" value={have} max={target} color="#e9a23b" note={`${Math.round((have / target) * 100)}%`} />
        <div className="tiny muted">თუ ყოველ ხელფასზე 50 ₾-ს გადადებ, მიზანს {Math.max(1, Math.ceil((target - have) / 50))} თვეში მიაღწევ.</div>
      </div>
    )
  }
  if (v === 'winter') {
    const months = ['ოქტ', 'ნოე', 'დეკ', 'იან', 'თებ', 'მარ']
    const extra = [0, 0, 40, 170, 80, 30]
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="small" style={{ fontWeight: 800 }}>შარშანდელი ზამთრის დამატებითი ხარჯი</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
          {months.map((mo, i) => (
            <div key={mo} style={{ flex: 1, textAlign: 'center' }}>
              <div className="tiny" style={{ fontWeight: 800 }}>{extra[i] ? `+${extra[i]}` : ''}</div>
              <motion.div initial={{ height: 0 }} animate={{ height: 6 + extra[i] * 0.4 }} transition={{ delay: i * 0.08 }} style={{ background: extra[i] >= 80 ? '#d9534f' : extra[i] ? '#f0b429' : '#c9d6e3', borderRadius: 6 }} />
              <div className="tiny muted">{mo}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (v === 'fraud') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '10px 12px', boxShadow: 'var(--shadow-sm)', fontSize: 14 }}>
          <div className="tiny muted">SMS · ბანკი</div>
          შენი კოდია <b>4821</b>. <b style={{ color: '#d9534f' }}>არავის უთხრა — არც ბანკის თანამშრომელს.</b>
        </div>
        <div style={{ background: '#fdecea', borderRadius: 14, padding: '10px 12px', fontSize: 14 }}>
          📞 „გამარჯობა, ბანკიდან გირეკავთ. კოდს ხომ ვერ მიკარნახებთ?"
        </div>
        <div className="tiny muted">ასეთ ზარს ვთიშავთ და ბანკის ოფიციალურ ნომერზე თავად ვრეკავთ.</div>
      </div>
    )
  }
  if (v === 'fx') {
    const rate = 2.72
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <Bar label={`ქირა 220 $ × ${fmt(rate, 2)}`} value={Math.round(220 * rate)} max={700} color="#5aa9e6" />
        <Bar label={`კურსი +5% (${fmt(rate * 1.05, 2)})`} value={Math.round(220 * rate * 1.05)} max={700} color="#f0a03c" delay={0.3} />
        <div className="tiny muted">იგივე ქირა თვეში ~{gel(Math.round(220 * rate * 0.05))}-ით ძვირდება.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {['დაურეკე ბანკს გადახდის დღემდე', 'სთხოვე პირობების შეცვლა', 'დახმარება: ეროვნული ბანკი და finedu.gov.ge'].map((s, i) => (
        <motion.div key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="row" style={{ gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 13, background: '#6fbf73', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{i + 1}</span>
          <span className="small" style={{ fontWeight: 700 }}>{s}</span>
        </motion.div>
      ))}
    </div>
  )
}
