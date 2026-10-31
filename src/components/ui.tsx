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
  // one simple picture: a blue band = where you may land, a dot = most likely, a red zone = below the safety cushion
  const lo = Math.min(min ?? Infinity, p10, compare?.p10 ?? Infinity, 0) - 20
  const hi = Math.max(max ?? -Infinity, p90, compare?.p90 ?? -Infinity, cushion) + 20
  const x = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
  const r10 = (v: number) => Math.round(v / 10) * 10
  const wide = x(p90) - x(p10) > 28
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: 'relative', height: 66 }}>
        {/* most likely value above the dot */}
        <motion.div initial={false} animate={{ left: x(p50) + '%' }} transition={{ type: 'spring', damping: 20 }} style={{ position: 'absolute', top: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: '#1f3b57', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
          ~{fmt(r10(p50))} ₾
        </motion.div>
        {/* track: red zone below the cushion, light zone above */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 28, height: 22, borderRadius: 11, overflow: 'hidden', background: '#eef2f6' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: x(cushion) + '%', background: '#fbe0dc' }} />
        </div>
        {compare && (
          <motion.div initial={false} animate={{ left: x(compare.p10) + '%', width: x(compare.p90) - x(compare.p10) + '%' }} style={{ position: 'absolute', top: 26, height: 26, borderRadius: 13, border: '2px dashed rgba(31,59,87,0.45)' }} />
        )}
        <motion.div initial={false} animate={{ left: x(p10) + '%', width: Math.max(3, x(p90) - x(p10)) + '%' }} transition={{ type: 'spring', damping: 20 }}
          style={{ position: 'absolute', top: 28, height: 22, borderRadius: 11, background: '#5aa9e6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', color: '#fff', fontSize: 11.5, fontWeight: 800, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {wide && <><span>{fmt(r10(p10))}</span><span>{fmt(r10(p90))}</span></>}
        </motion.div>
        <motion.div initial={false} animate={{ left: x(p50) + '%' }} transition={{ type: 'spring', damping: 20 }} style={{ position: 'absolute', top: 24, width: 14, height: 30, marginLeft: -7, borderRadius: 7, background: '#1f3b57', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }} />
        {/* cushion line */}
        <div style={{ position: 'absolute', left: x(cushion) + '%', top: 24, height: 32, borderLeft: '2px dashed #d9534f' }} />
        <div className="tiny" style={{ position: 'absolute', left: x(cushion) + '%', top: 54, transform: 'translateX(-50%)', color: '#d9534f', fontWeight: 800, whiteSpace: 'nowrap' }}>ზღვარი {fmt(cushion)} ₾</div>
      </div>
      <div className="tiny muted" style={{ marginTop: 2 }}>
        ლურჯი ზოლი — სად შეიძლება აღმოჩნდე ({fmt(r10(p10))}–{fmt(r10(p90))} ₾), მუქი ნიშანი — ყველაზე სავარაუდო{compare ? ', წყვეტილი — თუ არ იყიდი' : ''}.
      </div>
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
