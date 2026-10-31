import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHECKUP } from '../../content/learn'
import { useStore, CHECK_MAX } from '../../state/store'
import { usePersona } from '../../engine/view'
import { Jikho } from '../Jikho'

const LETTERS = ['ა', 'ბ', 'გ', 'დ']

/** 2-minute knowledge check. Order of options is shuffled deterministically per question. */
export function Checkup({ onClose, todayLabel }: { onClose: () => void; todayLabel: string }) {
  const p = usePersona()
  const done = useStore(s => s.checkupDone)
  const first = useStore(s => s.games[p.id].checks[0])
  const items = useMemo(() => CHECKUP.map((c, k) => {
    const idx = c.options.map((_, i) => i)
    const rot = (k * 2 + 1) % idx.length
    const order = [...idx.slice(rot), ...idx.slice(0, rot)]
    return { ...c, options: order.map(i => c.options[i]), correct: order.indexOf(c.correct) }
  }), [])
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const it = items[i]

  const choose = (k: number) => {
    if (pick !== null) return
    setPick(k)
    if (k === it.correct) setScore(s => s + 1)
  }
  const next = () => {
    if (i < items.length - 1) { setI(i + 1); setPick(null); return }
    setFinished(true)
    done(score, todayLabel)
  }

  if (finished) {
    const up = score - first.score
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
        <Jikho size={110} mood={up > 0 ? 'celebrate' : 'happy'} />
        <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>{up > 0 ? 'ცოდნა გაიზარდა!' : 'შემოწმება დასრულდა'}</div>
        <div className="row" style={{ gap: 18, justifyContent: 'center', alignItems: 'flex-end' }}>
          <ScoreBar label={first.label} score={first.score} color="#9fb4c7" />
          <div style={{ fontSize: 26, paddingBottom: 30 }}>→</div>
          <ScoreBar label="დღეს" score={score} color="#58b368" />
        </div>
        <div className="small muted" style={{ maxWidth: 300 }}>ეს იგივე კითხვებია, რითაც დაიწყე.</div>
        <button className="pill-btn btn-primary" onClick={onClose}>დახურვა</button>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="between">
        <div className="tiny" style={{ fontWeight: 800, color: 'var(--sky)' }}>ცოდნის შემოწმება · {i + 1}/{items.length}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {items.map((_, k) => <span key={k} style={{ width: 18, height: 6, borderRadius: 3, background: k < i ? '#1f3b57' : k === i ? '#5aa9e6' : '#dfe6ee' }} />)}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={it.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: 'grid', gap: 10 }}>
          <div className="display" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>{it.q}</div>
          {it.options.map((o, k) => {
            const state = pick === null ? 'idle' : k === it.correct ? 'right' : k === pick ? 'wrong' : 'dim'
            return (
              <motion.button key={k} whileTap={{ scale: 0.98 }} onClick={() => choose(k)} className="row"
                style={{ textAlign: 'left', gap: 10, padding: '12px 14px', borderRadius: 14, fontSize: 15, fontWeight: 600,
                  background: state === 'right' ? '#e3f4e8' : state === 'wrong' ? '#fdecea' : '#fff', boxShadow: 'var(--shadow-sm)',
                  border: state === 'right' ? '2px solid #58b368' : state === 'wrong' ? '2px solid #e07a70' : '2px solid transparent', opacity: state === 'dim' ? 0.55 : 1 }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, background: state === 'right' ? '#58b368' : '#eef2f6', color: state === 'right' ? '#fff' : 'var(--ink-2)' }}>{state === 'right' ? '✓' : LETTERS[k]}</span>
                {o}
              </motion.button>
            )
          })}
          {pick !== null && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gap: 10 }}>
              <div className="small" style={{ background: pick === it.correct ? '#eef8f0' : '#fff7e0', borderRadius: 12, padding: '10px 12px' }}>
                <b>{pick === it.correct ? 'სწორია. ' : 'სწორი პასუხი მწვანედაა მონიშნული. '}</b>{it.why}
              </div>
              <button className="pill-btn btn-primary" onClick={next}>{i < items.length - 1 ? 'შემდეგი' : 'შედეგის ნახვა'}</button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', width: 70 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{score}/{CHECK_MAX}</div>
      <div style={{ height: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <motion.div initial={{ height: 0 }} animate={{ height: (score / CHECK_MAX) * 100 }} transition={{ duration: 0.8 }} style={{ width: 40, background: color, borderRadius: 10 }} />
      </div>
      <div className="tiny muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
  )
}
