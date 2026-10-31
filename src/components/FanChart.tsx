import { motion } from 'framer-motion'
import { fmt } from '../engine/view'

interface Pt { day: string; p10: number; p50: number; p90: number }

/** Balance until payday: shaded band = likely range, line = most likely, dashed red = safety cushion. */
export function FanChart({ data, cushion, height = 200, bills }: { data: Pt[]; cushion: number; height?: number; bills?: { idx: number; name: string; amount: number }[] }) {
  const W = 340, H = height, L = 20, R = 26, T = 30, B = 26
  const vals = data.flatMap(d => [d.p10, d.p90]).concat([cushion, 0])
  const lo = Math.min(...vals) - 10, hi = Math.max(...vals) + 10
  const x = (i: number) => L + (i / (data.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const band = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.p90)}`).join(' ') + ' ' + data.slice().reverse().map((d, j) => `L${x(data.length - 1 - j)} ${y(d.p10)}`).join(' ') + ' Z'
  const mid = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.p50)}`).join(' ')
  const last = data[data.length - 1]
  const endLabel = `~${fmt(Math.round(last.p50 / 10) * 10)} ₾`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="fanband" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5aa9e6" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#5aa9e6" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      {lo < 0 && <rect x={L} y={y(0)} width={W - L - R} height={H - B - y(0)} fill="#fbe3df" opacity="0.7" rx="6" />}
      <line x1={L} x2={W - R} y1={y(cushion)} y2={y(cushion)} stroke="#d9534f" strokeDasharray="5 4" strokeWidth="1.6" />
      <text x={L + 2} y={y(cushion) + 13} fontSize="10" fill="#d9534f" fontWeight="700">უსაფრთხო ზღვარი {fmt(cushion)} ₾</text>
      <motion.path d={band} fill="url(#fanband)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path d={mid} fill="none" stroke="#1f3b57" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
      {/* bills */}
      {bills?.map((b, k) => {
        const i = b.idx + 1
        const px = x(i), py = y(data[i]?.p50 ?? 0)
        const up = k % 2 === 0
        return (
          <g key={b.name + b.idx}>
            <line x1={px} x2={px} y1={py} y2={up ? py - 16 : py + 16} stroke="#ff7a59" strokeWidth="1" />
            <circle cx={px} cy={py} r="4.5" fill="#ff7a59" stroke="#fff" strokeWidth="1.6" />
            <text x={px} y={up ? py - 20 : py + 26} fontSize="9.5" fontWeight="700" textAnchor="middle" fill="#c4532f">{b.name} {fmt(b.amount)}</text>
          </g>
        )
      })}
      {/* start */}
      <circle cx={x(0)} cy={y(data[0].p50)} r="4.5" fill="#1f3b57" />
      <text x={x(0) + 6} y={y(data[0].p50) - 8} fontSize="10.5" fontWeight="800" fill="#1f3b57">დღეს {fmt(Math.round(data[0].p50))} ₾</text>
      {/* end */}
      <circle cx={x(data.length - 1)} cy={y(last.p50)} r="6" fill="#1f3b57" stroke="#fff" strokeWidth="2.5" />
      <g transform={`translate(${x(data.length - 1) - 4} ${y(last.p50) - 30})`}>
        <rect x={-46} y={0} width={50} height={20} rx="10" fill="#1f3b57" />
        <text x={-21} y={14} fontSize="11" fontWeight="800" textAnchor="middle" fill="#fff">{endLabel}</text>
      </g>
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill={i === data.length - 1 ? '#1f3b57' : '#8193a5'} fontWeight={i === data.length - 1 ? 800 : 400}>
          {i === 0 ? 'დღეს' : i === data.length - 1 ? 'ხელფასი' : d.day.split(' ')[0]}
        </text>
      ))}
    </svg>
  )
}

/** 12-month strip of p50 landings, coloured by the probability of landing under the cushion */
export function MonthStrip({ rows, cushion, compact }: { rows: { label: string; p50: number; pBelow: number }[]; cushion: number; compact?: boolean }) {
  const col = (p: number) => (p < 0.1 ? '#58b368' : p < 0.3 ? '#f0c419' : p < 0.6 ? '#f08a3c' : '#d9534f')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 3 }}>
      {rows.map((r, i) => (
        <motion.div key={r.label} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }} title={`${r.label}: ~${Math.round(r.p50)} ₾`} style={{ textAlign: 'center' }}>
          <div style={{ height: compact ? 14 : 22, borderRadius: 5, background: col(r.pBelow), opacity: r.p50 < cushion ? 1 : 0.85, boxShadow: r.p50 < cushion ? 'inset 0 0 0 2px rgba(0,0,0,0.15)' : undefined }} />
          <div style={{ fontSize: 9.5, color: '#8193a5', marginTop: 2 }}>{r.label.split(' ')[1]}</div>
        </motion.div>
      ))}
    </div>
  )
}
