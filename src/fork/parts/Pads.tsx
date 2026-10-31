import { useRef } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../engine/view'
import { ForkInst, OptInst } from '../sim'

/** height the pads take at the bottom of the screen (the road is laid out above them) */
export const PADS_H = 168

interface Props {
  f: ForkInst
  preview: 0 | 1 | null
  lock: [boolean, boolean]
  lowEnergy: boolean
  /** a short help line under the question (first forks, waiting) */
  hint: string | null
  onPreview: (side: 0 | 1 | null) => void
  onCommit: (side: 0 | 1) => void
  onLocked: () => void
}

/** the two roads of the coming fork as big buttons where the thumb is: press = preview, release = go, slide off = cancel */
export function Pads({ f, preview, lock, lowEnergy, hint, onPreview, onCommit, onLocked }: Props) {
  return (
    <motion.div className="f-pads" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }} onPointerDown={e => e.stopPropagation()}>
      <div className="q">{f.card.q}</div>
      <div className="hint">{hint && <span key={hint}>{hint}</span>}</div>
      {([0, 1] as const).map(side => (
        <Pad key={side} side={side} o={f.opts[side]} on={preview === side} lock={lock[side]} low={lowEnergy}
          onPreview={onPreview} onCommit={onCommit} onLocked={onLocked} />
      ))}
    </motion.div>
  )
}

function Pad({ side, o, on, lock, low, onPreview, onCommit, onLocked }: {
  side: 0 | 1; o: OptInst; on: boolean; lock: boolean; low: boolean
  onPreview: (side: 0 | 1 | null) => void; onCommit: (side: 0 | 1) => void; onLocked: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const press = useRef<{ id: number; inside: boolean } | null>(null)
  const inside = (e: React.PointerEvent) => {
    const b = ref.current?.getBoundingClientRect()
    return !!b && e.clientX >= b.left - 8 && e.clientX <= b.right + 8 && e.clientY >= b.top - 10 && e.clientY <= b.bottom + 10
  }
  const en = o.en > 0 ? <span className="en pos">⚡+{o.en}</span> : o.en < 0 ? <span className={'en neg' + (low ? ' warn' : '')}>⚡−{-o.en}</span> : null
  const lent = !!o.back && o.backDay >= 30
  return (
    <button ref={ref} type="button" className={'f-pad' + (on ? ' pv' : '') + (lock ? ' lock' : '')} data-pad={side}
      aria-label={`${side ? 'ქვედა' : 'ზედა'} გზა: ${o.t}, ${fmt(o.p)} ₾`}
      onPointerDown={e => {
        e.preventDefault()
        if (lock) { onLocked(); return }
        press.current = { id: e.pointerId, inside: true }
        try { ref.current?.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        onPreview(side)
      }}
      onPointerMove={e => {
        const p = press.current
        if (!p || p.id !== e.pointerId) return
        const ins = inside(e)
        if (ins !== p.inside) { p.inside = ins; onPreview(ins ? side : null) }
      }}
      onPointerUp={e => {
        const p = press.current
        if (!p || p.id !== e.pointerId) return
        press.current = null
        if (inside(e)) onCommit(side)
        else onPreview(null)
      }}
      onPointerCancel={() => { press.current = null; onPreview(null) }}
      onPointerEnter={e => { if (e.pointerType === 'mouse' && !press.current && !lock) onPreview(side) }}
      onPointerLeave={e => { if (e.pointerType === 'mouse' && !press.current) onPreview(null) }}
      onClick={e => { if (e.detail === 0 && !lock) onCommit(side) }}>
      <span className="ar">{side ? '↓' : '↑'}</span>
      <span className="ic">{o.e}</span>
      <span className="tx">
        <b>{o.t}</b>
        {lock ? <small>🔒 თანხა არ ჰყოფნის</small> : lent ? <small>↩ დაბრუნდება ხელფასის შემდეგ</small> : null}
      </span>
      <span className="pr">{fmt(o.p)} ₾</span>
      {en}
    </button>
  )
}
