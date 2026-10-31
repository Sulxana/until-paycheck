import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '../ui'
import { MicroLesson } from './MicroLesson'
import type { TopicId } from '../../content/lessons'

/** "learn at the moment of decision": a small link that opens the topic's 30-second lesson.
 *  `compact` is a one-line link (used inside chat cards, where the full button weighs as much as the answer). */
export function LearnLink({ topic, text, compact }: { topic: TopicId; text: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {compact ? (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOpen(true)} className="small"
          style={{ display: 'block', marginTop: 8, padding: 0, background: 'none', color: '#1f6fb5', fontWeight: 700, textAlign: 'left' }}>
          ? {text} ›
        </motion.button>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOpen(true)} className="row"
          style={{ width: '100%', gap: 10, marginTop: 10, padding: '10px 12px', borderRadius: 14, background: '#eef6ff', color: '#1f3b57', textAlign: 'left' }}>
          <span style={{ width: 30, height: 30, borderRadius: 15, background: '#1f3b57', color: '#ffd977', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>?</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{text}</span>
            <span className="tiny muted">30-წამიანი გაკვეთილი შენივე რიცხვებით</span>
          </span>
          <span className="muted">›</span>
        </motion.button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        {open && <MicroLesson topic={topic} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}
