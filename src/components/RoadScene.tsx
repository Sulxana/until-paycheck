import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WeatherKind } from '../engine/engine'
import { Jikho, JikhoMood, Accessory } from './Jikho'

const SKY: Record<WeatherKind, [string, string]> = {
  sun: ['#7cc7ff', '#e4f5ff'],
  cloud: ['#9fb8cf', '#e6eef5'],
  rain: ['#6a87a6', '#c3d1de'],
  storm: ['#36435a', '#7f8ea6'],
}

interface Props {
  weather: WeatherKind
  nDays: number
  day: number
  labels: string[]
  paydayLabel: string
  mood: JikhoMood
  stage: 0 | 1 | 2 | 3
  accessories: Accessory[]
  height?: number
  walking?: boolean
  bubble?: string | null
  onJikhoTap?: () => void
  hop?: number
}

/** tile positions along a winding mountain road, left (today) to right (payday camp) */
function pointAt(t: number) {
  return { x: 34 + t * 300, y: 236 - t * 70 + Math.sin(t * Math.PI * 2.2) * 16 }
}
function tilePoints(n: number) {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) pts.push(pointAt(i / n))
  return pts
}
const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / 390) * 100}%`, top: `${(p.y / 290) * 100}%` })

export function RoadScene({ weather, nDays, day, labels, paydayLabel, mood, stage, accessories, height = 290, walking, bubble, onJikhoTap, hop = 0 }: Props) {
  const pts = tilePoints(nDays)
  const here = pts[Math.min(day, nDays)]
  // walk along the curve from the previous tile to the new one
  const prev = useRef(day)
  const [walk, setWalk] = useState<{ left: string[]; top: string[] } | null>(null)
  useEffect(() => {
    const a = prev.current, b = Math.min(day, nDays)
    prev.current = b
    if (b <= a) { setWalk(null); return }
    const steps = 16
    const frames = Array.from({ length: steps + 1 }, (_, k) => pct(pointAt((a + ((b - a) * k) / steps) / nDays)))
    setWalk({ left: frames.map(f => f.left), top: frames.map(f => f.top) })
    const t = setTimeout(() => setWalk(null), 1350)
    return () => clearTimeout(t)
  }, [day, nDays])
  const moving = walk !== null
  const [top, bottom] = SKY[weather]
  const dark = weather === 'storm'
  const roadPath = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const acc: Accessory[] = [...accessories]
  if ((weather === 'rain' || weather === 'storm') && !acc.includes('umbrella')) acc.push('umbrella')

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }}>
      <svg viewBox="0 0 390 290" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <motion.stop offset="0%" animate={{ stopColor: top }} transition={{ duration: 0.9 }} />
            <motion.stop offset="100%" animate={{ stopColor: bottom }} transition={{ duration: 0.9 }} />
          </linearGradient>
          <linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={dark ? '#5d6c84' : '#a9c4dc'} /><stop offset="100%" stopColor={dark ? '#4b586d' : '#c8dae9'} /></linearGradient>
          <linearGradient id="mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={dark ? '#4c6a58' : '#8fc49a'} /><stop offset="100%" stopColor={dark ? '#3d5849' : '#75b07f'} /></linearGradient>
          <linearGradient id="near" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={dark ? '#47664f' : '#9fd39c'} /><stop offset="100%" stopColor={dark ? '#3a5442' : '#7fc07f'} /></linearGradient>
        </defs>
        <rect width="390" height="290" fill="url(#sky)" />

        {/* sun */}
        <AnimatePresence>
          {(weather === 'sun' || weather === 'cloud') && (
            <motion.g key="sun" initial={{ opacity: 0, y: 20 }} animate={{ opacity: weather === 'sun' ? 1 : 0.55, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.8 }}>
              <g style={{ animation: 'spin 40s linear infinite', transformOrigin: '318px 58px' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <rect key={i} x="316" y="18" width="4" height="12" rx="2" fill="#ffd45c" transform={`rotate(${i * 30} 318 58)`} />
                ))}
              </g>
              <circle cx="318" cy="58" r="24" fill="#ffd45c" />
              <circle cx="318" cy="58" r="34" fill="#ffd45c" opacity="0.18" />
            </motion.g>
          )}
        </AnimatePresence>

        {/* snowy far mountains */}
        <path d="M0 170 L48 108 L82 140 L130 84 L176 136 L214 100 L262 150 L304 96 L350 140 L390 112 L390 290 L0 290 Z" fill="url(#far)" />
        <path d="M130 84 L118 100 L128 98 L136 104 L142 96 Z M304 96 L292 112 L302 110 L310 116 L316 108 Z M48 108 L40 118 L50 116 L56 120 Z" fill="#fff" opacity={dark ? 0.6 : 0.95} />

        {/* clouds */}
        <AnimatePresence>
          {weather !== 'sun' && (
            <motion.g key="clouds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
              {[
                { x: 70, y: 46, s: 1.1, d: 9 },
                { x: 200, y: 30, s: 1.4, d: 12 },
                { x: 300, y: 66, s: 0.9, d: 10 },
              ].map((c, i) => (
                <g key={i} style={{ animation: `drift ${c.d}s ease-in-out ${i}s infinite alternate` }}>
                  <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`} fill={dark ? '#5a667c' : weather === 'rain' ? '#a9b6c4' : '#ffffff'} opacity={0.95}>
                    <ellipse cx="0" cy="0" rx="34" ry="14" />
                    <ellipse cx="-14" cy="-8" rx="16" ry="13" />
                    <ellipse cx="10" cy="-12" rx="18" ry="16" />
                  </g>
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* mid hills */}
        <path d="M0 210 Q60 160 120 190 T250 180 T390 170 L390 290 L0 290 Z" fill="url(#mid)" />
        {/* trees */}
        {[[20, 196], [44, 190], [262, 178], [280, 182], [372, 168]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 -22 L9 0 L-9 0 Z" fill={dark ? '#2f4a3a' : '#3f8a52'} />
            <path d="M0 -30 L7 -12 L-7 -12 Z" fill={dark ? '#355341' : '#4d9a5f'} />
            <rect x="-1.5" y="0" width="3" height="5" fill="#7a5230" />
          </g>
        ))}
        {/* near meadow */}
        <path d="M0 250 Q100 220 200 240 T390 230 L390 290 L0 290 Z" fill="url(#near)" />

        {/* road */}
        <path d={roadPath} stroke={dark ? '#8e8170' : '#e7d3b0'} strokeWidth="26" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={roadPath} stroke={dark ? '#a39581' : '#f3e4c8'} strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* tiles */}
        {pts.slice(0, nDays).map((p, i) => {
          const past = i < day
          const today = i === day
          return (
            <g key={i}>
              <ellipse cx={p.x} cy={p.y + 2} rx="13" ry="7" fill="rgba(0,0,0,0.12)" />
              <ellipse cx={p.x} cy={p.y} rx="13" ry="7" fill={today ? '#ffd977' : past ? '#d8c6a6' : '#fff6e6'} stroke={today ? '#e6a400' : '#cdb48d'} strokeWidth="1.5" />
              <text x={p.x} y={p.y + 22} fontSize="8.5" fontWeight="700" textAnchor="middle" fill={dark ? '#e6ecf3' : '#3d4f63'} opacity={past ? 0.5 : 0.9}>
                {labels[i]?.split(' ')[0]}
              </text>
              {!past && !today && (
                <MiniWeather x={p.x} y={p.y - 17} w={weather} />
              )}
            </g>
          )
        })}

        {/* payday camp */}
        {(() => {
          const c = pts[nDays]
          return (
            <g transform={`translate(${c.x} ${c.y})`}>
              <ellipse cx="0" cy="4" rx="26" ry="8" fill="rgba(0,0,0,0.12)" />
              <path d="M-20 2 L0 -28 L20 2 Z" fill="#e2683c" />
              <path d="M0 -28 L6 2 L-6 2 Z" fill="#b84a26" />
              <path d="M0 -28 V-44" stroke="#5b4636" strokeWidth="2" />
              <motion.path d="M0 -44 L16 -39 L0 -34 Z" fill="#ffc94a" animate={{ rotate: [0, 6, 0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} style={{ originX: '0px', originY: '-39px' }} />
              <rect x="-26" y="10" width="52" height="16" rx="8" fill="#1f3b57" />
              <text x="0" y="21.5" fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle">{paydayLabel}</text>
            </g>
          )
        })()}

        {/* rain */}
        {(weather === 'rain' || weather === 'storm') && (
          <g stroke={dark ? '#c9d6e6' : '#e8f1fa'} strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
            {Array.from({ length: weather === 'storm' ? 46 : 28 }).map((_, i) => {
              const x = (i * 53) % 390
              const delay = ((i * 37) % 100) / 100
              return <line key={i} x1={x} y1={0} x2={x - 5} y2={14} style={{ animation: `fall ${0.7 + (i % 5) * 0.08}s linear ${delay}s infinite` }} />
            })}
          </g>
        )}
        {weather === 'storm' && (
          <>
            <path d="M210 40 L196 82 L210 80 L198 120 L226 70 L212 72 L222 40 Z" fill="#ffe27a" style={{ animation: 'flash 3.2s infinite' }} />
            <rect width="390" height="290" fill="#fff" style={{ animation: 'flash 3.2s infinite', mixBlendMode: 'overlay' }} opacity="0" />
          </>
        )}
      </svg>

      {/* Jikho */}
      <motion.div
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        initial={false}
      >
        <motion.div
          initial={false}
          animate={walk ?? pct(here)}
          transition={walk ? { duration: 1.25, ease: 'linear' } : { duration: 0 }}
          style={{ position: 'absolute', transform: 'translate(-50%, -88%)' }}
        >
          <AnimatePresence>
            {bubble && (
              <motion.div
                key={bubble}
                initial={{ opacity: 0, y: 8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.9 }}
                transition={{ type: 'spring', damping: 16, stiffness: 260 }}
                style={{
                  position: 'absolute', bottom: '92%', left: day > nDays / 2 ? 'auto' : 18, right: day > nDays / 2 ? 18 : 'auto', width: 190,
                  background: '#fff', borderRadius: 16, padding: '8px 11px', fontSize: 12.5, lineHeight: 1.4, fontWeight: 600,
                  color: 'var(--ink)', boxShadow: '0 8px 22px rgba(31,59,87,0.22)', pointerEvents: 'none',
                }}
              >
                {bubble}
                <span style={{ position: 'absolute', bottom: -6, [day > nDays / 2 ? 'right' : 'left']: 22, width: 12, height: 12, background: '#fff', transform: 'rotate(45deg)' }} />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div key={hop} animate={hop ? { y: [0, -18, 0] } : undefined} transition={{ duration: 0.45 }} onClick={onJikhoTap} style={{ pointerEvents: onJikhoTap ? 'auto' : 'none', cursor: onJikhoTap ? 'pointer' : 'default' }}>
            <Jikho size={92} mood={mood} stage={stage} accessories={acc} walking={walking && moving} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function MiniWeather({ x, y, w }: { x: number; y: number; w: WeatherKind }) {
  const cloud = (fillC: string) => (
    <g fill={fillC}>
      <ellipse cx="0" cy="1" rx="7" ry="3.6" />
      <circle cx="-2.6" cy="-1" r="3.2" />
      <circle cx="2.2" cy="-2" r="3.8" />
    </g>
  )
  return (
    <g transform={`translate(${x} ${y})`}>
      {w === 'sun' && (
        <g>
          <circle r="4.2" fill="#ffc94a" />
          {[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x="-0.8" y="-7.6" width="1.6" height="2.4" rx="0.8" fill="#ffc94a" transform={`rotate(${a})`} />)}
        </g>
      )}
      {w === 'cloud' && (
        <g>
          <circle cx="3.5" cy="-3.5" r="3.4" fill="#ffc94a" />
          {cloud('#ffffff')}
        </g>
      )}
      {w === 'rain' && (
        <g>
          {cloud('#c5d2df')}
          <path d="M-3 5 l-1 3 M1 5 l-1 3 M5 5 l-1 3" stroke="#4f7cff" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
      {w === 'storm' && (
        <g>
          {cloud('#7f8ea6')}
          <path d="M0.5 3 l-2.6 4 h2.2 l-1.4 3.6 l4 -5 h-2.2 l1.4 -2.6 z" fill="#ffd166" />
        </g>
      )}
    </g>
  )
}
