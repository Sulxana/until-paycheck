import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store'
import { useToday } from '../engine/view'
import { Disclaimer } from '../components/ui'
import { Morning } from '../components/day/Morning'
import { Evening } from '../components/day/Evening'
import { BeatCard, QuestsCard } from '../components/day/Weekly'
import { useDayLocal } from '../components/day/local'
import type { ActionKind } from '../content/lessons'

type Seg = 'morning' | 'evening' | 'week'

export function Day() {
  const v = useToday()
  const { p } = v
  const game = useStore(s => s.games[p.id])
  const demo = useStore(s => s.demos[p.id])
  const gameOff = useStore(s => s.gameOff)
  const setTab = useStore(s => s.setTab)
  const toast = useStore(s => s.toast)
  const localKey = `${p.id}:${demo.day}:${game.cycles}`
  const cash = useDayLocal(s => s.cash[localKey])

  const [seg, setSeg] = useState<Seg>(!game.morningDone ? 'morning' : !game.eveningDone ? 'evening' : 'week')
  const [focus, setFocus] = useState(false)

  const onAction = (k: ActionKind) => {
    if (k === 'chat') setTab('chat')
    else if (k === 'road') setTab('road')
    else if (k === 'analytics') setTab('analytics')
    else toast('📌', 'შენახულია ჯიხოს წიგნაკში')
  }
  const go = (s: Seg) => { setFocus(false); setSeg(s) }

  const SEGS: { id: Seg; label: string; done: boolean }[] = [
    { id: 'morning', label: 'დილა', done: game.morningDone },
    { id: 'evening', label: 'საღამო', done: game.eveningDone },
    { id: 'week', label: 'კვირა', done: game.beatGuess !== null },
  ]

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <div className="pad" style={{ paddingTop: 16 }}>
        {/* header */}
        <div className="between">
          <div>
            <div className="h2" style={{ fontSize: 22 }}>დღის რიტმი</div>
            <div className="tiny muted" style={{ fontWeight: 600 }}>{p.dayLabels[demo.day] ?? p.paydayLabel} · {p.name}</div>
          </div>
          {!gameOff && (v.hardship ? (
            <span className="chip" style={{ background: '#e8f2fc', color: '#2c6aa0' }}>❄ სერია გაყინულია</span>
          ) : (
            <motion.span key={game.streak} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="chip" style={{ background: game.litToday ? '#fff1cc' : '#f2ede4' }}>
              🏮 {game.streak}{game.litToday ? ' · ანთია' : ''}
            </motion.span>
          ))}
        </div>

        {v.hardship && (
          <div style={{ background: '#eef2f7', borderRadius: 14, padding: '10px 12px', marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
            <b>მხარდაჭერის რეჟიმი.</b> სერია გაყინულია — არაფერი იკარგება. დილით პატარა ნაბიჯებს გავივლით: რომელი გადასახადია პირველი რიგის და როგორ დაველაპარაკოთ ბანკს.
          </div>
        )}

        {/* segmented control */}
        <div className="seg" style={{ marginTop: 12 }}>
          {SEGS.map(s => (
            <button key={s.id} className={seg === s.id ? 'on' : ''} onClick={() => go(s.id)} style={{ position: 'relative' }}>
              {s.label}
              {s.done && <span style={{ marginLeft: 4, color: 'var(--good)' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <AnimatePresence mode="wait">
          <motion.div key={seg + localKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {seg === 'morning' && <Morning localKey={localKey} onFocus={setFocus} onAction={onAction} goEvening={() => go('evening')} />}
            {seg === 'evening' && <Evening localKey={localKey} onFocus={setFocus} onAction={onAction} />}
            {seg === 'week' && <BeatCard />}
          </motion.div>
        </AnimatePresence>
      </div>

      {!gameOff && !focus && (
        <div className="pad" style={{ marginTop: 14 }}>
          <QuestsCard cashDone={!!cash || game.eveningDone} goMorning={() => go('morning')} goEvening={() => go('evening')} />
        </div>
      )}

      <div className="pad" style={{ marginTop: 10 }}>
        <Disclaimer>ინფორმაციაა, არა რჩევა. რიცხვები შენი ისტორიიდან ითვლება.</Disclaimer>
      </div>
      <div style={{ height: 18 }} />
    </div>
  )
}
