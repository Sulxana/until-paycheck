import { useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Jikho, JikhoMood, Accessory } from '../Jikho'
import { LessonItem, ActionKind, TOPICS } from '../../content/lessons'

/** ჯიხო + სიტყვის ბუშტი */
export function JikhoSays({ mood, text, stage, accessories, size = 64 }: { mood: JikhoMood; text: ReactNode; stage: 0 | 1 | 2 | 3; accessories?: Accessory[]; size?: number }) {
  return (
    <div className="row" style={{ alignItems: 'flex-end', gap: 6 }}>
      <motion.div key={mood} initial={{ scale: 0.85, y: 4 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 9, stiffness: 260 }} style={{ flexShrink: 0 }}>
        <Jikho size={size} mood={mood} stage={stage} accessories={accessories} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          key={typeof text === 'string' ? text : mood}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ position: 'relative', background: '#fff', borderRadius: '16px 16px 16px 4px', padding: '9px 12px', fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-sm)', marginBottom: size * 0.35, lineHeight: 1.35 }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** 1/3 · 2/3 · 3/3 — სეგმენტური პროგრესი */
export function Steps({ n, at, done, color = 'var(--sun-2)' }: { n: number; at: number; done: number; color?: string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 5 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ height: 8, borderRadius: 6, background: '#ece5d8', overflow: 'hidden' }}>
            <motion.div initial={false} animate={{ width: i < done ? '100%' : i === at ? '35%' : '0%' }} transition={{ duration: 0.45 }} style={{ height: '100%', background: i < done ? color : 'rgba(255,176,32,0.45)', borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <span className="small" style={{ fontWeight: 800, color: 'var(--ink-2)', minWidth: 28, textAlign: 'right' }}>{Math.min(n, at + 1)}/{n}</span>
    </div>
  )
}

const LETTERS = ['ა', 'ბ', 'გ', 'დ']

/** ერთი კითხვა: დიდი ღილაკები → მყისიერი ფერი → ახსნა, წესი, „შენთვის", მოქმედება */
export function QuizCard({ item, label, onAnswer, onNext, nextLabel, onAction }: {
  item: LessonItem
  label: string
  onAnswer: (correct: boolean) => void
  onNext: () => void
  nextLabel: string
  onAction?: (k: ActionKind) => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [acted, setActed] = useState(false)
  const answered = picked !== null
  const ok = picked === item.correct
  const topic = TOPICS[item.topic]

  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    onAnswer(i === item.correct)
  }

  return (
    <div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="tag" style={{ background: '#fff3d6', color: '#8a5a00' }}>{label}</span>
        <span className="tag">{topic.icon} {topic.name}</span>
        {item.bigThree && <span className="tag" style={{ background: '#e9f3fc', color: '#2c6aa0' }}>OECD · დიდი სამეული</span>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35, marginBottom: 12 }}>{item.q}</div>

      <div style={{ display: 'grid', gap: 9 }}>
        {item.options.map((o, i) => {
          const isRight = answered && i === item.correct
          const isWrongPick = answered && i === picked && !ok
          const faded = answered && !isRight && !isWrongPick
          const bg = isRight ? '#e6f6ec' : isWrongPick ? '#fff1ea' : '#fff'
          const border = isRight ? 'var(--good)' : isWrongPick ? 'var(--coral)' : 'transparent'
          return (
            <motion.button
              key={i}
              whileTap={answered ? undefined : { scale: 0.97 }}
              animate={isRight ? { scale: [1, 1.03, 1] } : isWrongPick ? { x: [0, -5, 5, -3, 0] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              onClick={() => pick(i)}
              style={{
                width: '100%', minHeight: 56, textAlign: 'left', padding: '12px 14px', borderRadius: 16, background: bg,
                border: `2px solid ${border}`, boxShadow: answered ? 'none' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 12,
                fontSize: 15, fontWeight: 600, lineHeight: 1.3, opacity: faded ? 0.5 : 1, cursor: answered ? 'default' : 'pointer', transition: 'background .2s, opacity .2s',
              }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, background: isRight ? 'var(--good)' : isWrongPick ? 'var(--coral)' : '#f2ede4', color: isRight || isWrongPick ? '#fff' : 'var(--ink-2)' }}>
                {isRight ? '✓' : isWrongPick ? '•' : LETTERS[i]}
              </span>
              <span style={{ flex: 1 }}>{o}</span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring', damping: 20 }}>
            <div className="card" style={{ marginTop: 12, background: ok ? '#effaf2' : '#f3f6fa', boxShadow: 'none', border: `1.5px solid ${ok ? '#cdebd7' : '#dfe6ef'}` }}>
              <div className="h3" style={{ color: ok ? 'var(--good)' : 'var(--navy)' }}>
                {ok ? '✓ სწორია!' : '💡 კარგი მცდელობა — ახლა უკვე იცი'}
              </div>
              {!ok && <div className="small" style={{ marginTop: 4, fontWeight: 700 }}>სწორი პასუხი: {item.options[item.correct]}</div>}
              <div className="small" style={{ marginTop: 8, lineHeight: 1.5, color: 'var(--ink)' }}>{item.why}</div>
              <div style={{ marginTop: 10, background: '#fff6dc', borderRadius: 12, padding: '9px 11px', fontSize: 13, lineHeight: 1.45 }}>
                <b>წესი:</b> {item.rule}
              </div>
              <div style={{ marginTop: 8, background: '#e8f2fc', borderRadius: 12, padding: '9px 11px', fontSize: 13, lineHeight: 1.45 }}>
                <b>შენთვის:</b> {item.forYou}
              </div>
              {item.action && onAction && (
                <button
                  className="chip"
                  disabled={acted}
                  style={{ marginTop: 10, background: acted ? '#e6f6ec' : '#fff', boxShadow: acted ? 'none' : 'var(--shadow-sm)', padding: '8px 12px', color: acted ? 'var(--good)' : 'var(--navy)' }}
                  onClick={() => { setActed(true); onAction(item.action!.kind) }}
                >
                  {acted && item.action.kind === 'save' ? '✓ შენახულია' : item.action.label}
                </button>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-primary" style={{ marginTop: 12 }} onClick={onNext}>
              {nextLabel}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** ციცქნა კონფეტი დასრულების ბარათისთვის (გარე რესურსის გარეშე) */
export function Confetti({ n = 18 }: { n?: number }) {
  const colors = ['#ffc94a', '#6fbf73', '#5aa9e6', '#ff7a59', '#7a5af8']
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const left = (i * 53) % 100
        const delay = (i % 6) * 0.12
        const rot = (i * 47) % 360
        return (
          <motion.span
            key={i}
            initial={{ y: -20, opacity: 0, rotate: rot }}
            animate={{ y: 260, opacity: [0, 1, 1, 0], rotate: rot + 220 }}
            transition={{ duration: 2.2 + (i % 4) * 0.3, delay, ease: 'easeIn' }}
            style={{ position: 'absolute', top: 0, left: `${left}%`, width: 8, height: 12, borderRadius: 2, background: colors[i % colors.length] }}
          />
        )
      })}
    </div>
  )
}
