import { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function PhonePortal({ children }: { children: ReactNode }) {
  const host = typeof document !== 'undefined' ? document.querySelector('.phone') : null
  return host ? createPortal(children, host) : <>{children}</>
}
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store'
import { WeatherKind, WEATHER_LABEL } from '../engine/engine'
import { fmt } from '../engine/view'

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <PhonePortal>
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
            <div className="grab" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </PhonePortal>
  )
}

export function Toasts() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className="toast" initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', damping: 18 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export const WCOLOR: Record<WeatherKind, string> = { sun: '#f4a300', cloud: '#7d93a8', rain: '#3f6f9e', storm: '#3a4558' }
export const WEMOJI: Record<WeatherKind, string> = { sun: '☀️', cloud: '🌥️', rain: '🌧️', storm: '⛈️' }

export function WeatherChip({ w, p }: { w: WeatherKind; p?: number }) {
  return (
    <span className="chip" style={{ background: WCOLOR[w] + '22', color: WCOLOR[w], whiteSpace: 'normal', flexWrap: 'wrap', rowGap: 2 }}>
      {WEMOJI[w]} {WEATHER_LABEL[w]}
      {p !== undefined && <span style={{ opacity: 0.85, fontWeight: 600 }}>· 10 თვიდან {Math.round(p * 10)}-ში ზღვარს ქვემოთ</span>}
    </span>
  )
}

/** horizontal range bar: p10..p90 band, p50 dot, cushion line */
export function RangeBar({ p10, p50, p90, cushion, min, max, compare }: { p10: number; p50: number; p90: number; cushion: number; min?: number; max?: number; compare?: { p10: number; p50: number; p90: number } }) {
  const lo = Math.min(min ?? Infinity, p10, compare?.p10 ?? Infinity, 0) - 15
  const hi = Math.max(max ?? -Infinity, p90, compare?.p90 ?? -Infinity, cushion) + 15
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  return (
    <div style={{ position: 'relative', height: compare ? 64 : 46, marginTop: 6 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 18, height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#f7d4cf 0%,#fbe8bf ' + x(cushion) + '%,#d7f0da ' + Math.min(100, x(cushion) + 12) + '%,#d7f0da 100%)' }} />
      {compare && (
        <motion.div initial={false} animate={{ left: x(compare.p10) + '%', width: x(compare.p90) - x(compare.p10) + '%' }} style={{ position: 'absolute', top: 16, height: 14, borderRadius: 8, background: 'rgba(31,59,87,0.15)', border: '1.5px dashed rgba(31,59,87,0.35)' }} />
      )}
      <motion.div initial={false} animate={{ left: x(p10) + '%', width: Math.max(2, x(p90) - x(p10)) + '%' }} transition={{ type: 'spring', damping: 20 }} style={{ position: 'absolute', top: 15, height: 16, borderRadius: 8, background: 'rgba(31,59,87,0.55)' }} />
      <motion.div initial={false} animate={{ left: x(p50) + '%' }} transition={{ type: 'spring', damping: 20 }} style={{ position: 'absolute', top: 11, width: 24, height: 24, marginLeft: -12, borderRadius: '50%', background: '#1f3b57', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }} />
      <div style={{ position: 'absolute', left: x(cushion) + '%', top: 8, bottom: compare ? 22 : 4, width: 0, borderLeft: '2px dashed #d9534f' }} />
      <div className="tiny" style={{ position: 'absolute', left: x(cushion) + '%', top: compare ? 44 : 34, transform: 'translateX(-50%)', color: '#d9534f', fontWeight: 700, whiteSpace: 'nowrap' }}>ზღვარი {fmt(cushion)} ₾</div>
      <div className="tiny muted" style={{ position: 'absolute', left: 0, top: -6 }}>{fmt(p10)} ₾</div>
      <div className="tiny muted" style={{ position: 'absolute', right: 0, top: -6 }}>{fmt(p90)} ₾</div>
    </div>
  )
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return <div className="disclaimer">ℹ️ {children ?? 'ეს ინფორმაციაა და არა რჩევა. პროგნოზი შენი ხარჯების ისტორიიდან ითვლება.'}</div>
}

export function BankChip({ label, amount, color, muted }: { label: string; amount: number; color: string; muted?: boolean }) {
  return (
    <span className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)', opacity: muted ? 0.8 : 1 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {label} <b>{fmt(amount)} ₾</b>
    </span>
  )
}

export function Progress({ value, max, color = 'var(--grass-2)' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ height: 8, borderRadius: 6, background: '#ece5d8', overflow: 'hidden' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} transition={{ duration: 0.8 }} style={{ height: '100%', background: color, borderRadius: 6 }} />
    </div>
  )
}
