import { motion } from 'framer-motion'
import { WeatherKind } from '../../engine/engine'
import { WEMOJI, InfoTip } from '../../components/ui'
import { gel } from '../../engine/view'
import { Cycle, GameEvent } from '../cycle'

const rise = { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', damping: 28, stiffness: 260 } } as const

/** payday morning: how much goes into the qvevri ("pay yourself first"); Tamar starts at 0, without a reminder */
export function QvevriCard({ c, calm, onPick }: { c: Cycle; calm: boolean; onPick: (amount: number) => void }) {
  return (
    <motion.div className="g-card" data-info-root {...rise}>
      <div className="between">
        <div className="h3">💰 ხელფასი: +{gel(c.p.salary)}</div>
        <span className="tiny muted">{c.days[0].label}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <div className="h2" style={{ fontSize: 19 }}>რამდენი ჩავდოთ ქვევრში?</div>
        <InfoTip label="რა არის ქვევრი?">
          <div>ქვევრი მოულოდნელ ხარჯს დაიჭერს.</div>
          <div>ფული შენი რჩება: რაც არ დაიხარჯება, ხელფასის დღეს შენთანაა.</div>
        </InfoTip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {c.qvevriOptions.map(a => (
          <button key={a} className={'g-opt' + (calm && a === 0 ? ' sel' : '')} style={{ justifyContent: 'center' }} onClick={() => onPick(a)}>
            {a === 0 ? 'ამჯერად 0' : `🏺 ${gel(a)}`}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

/** a dilemma: three options, only ₾ and the payday weather shown for each; no right answer, no timer */
export function DilemmaCard({ ev, now, weathers, onPick }: { ev: Extract<GameEvent, { kind: 'dilemma' }>; now: WeatherKind; weathers: WeatherKind[]; onPick: (opt: number) => void }) {
  return (
    <motion.div className="g-card" {...rise}>
      <div className="h2" style={{ fontSize: 19 }}>{ev.icon} {ev.title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {ev.options.map((o, k) => (
          <button key={k} className="g-opt" onClick={() => onPick(k)}>
            <span style={{ fontSize: 20 }}>{o.icon}</span>
            <span>{o.label}</span>
            <span className="r">
              <span>{gel(o.cost)}</span>
              <span className="tiny" style={{ fontWeight: 700 }}>{WEMOJI[now]}{weathers[k] !== now ? ` → ${WEMOJI[weathers[k]]}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="tiny muted" style={{ textAlign: 'center' }}>აქ სწორი პასუხი არ არის.</div>
    </motion.div>
  )
}
