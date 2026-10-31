import { memo, RefObject } from 'react'
import { WeatherKind } from '../../engine/engine'

export const FAR_W = 480
export const MID_W = 420

export const SKY: Record<WeatherKind, [string, string]> = {
  sun: ['#6fc0ff', '#e6f6ff'],
  cloud: ['#9db6cd', '#e7eef5'],
  rain: ['#6d89a8', '#c6d3df'],
  storm: ['#3e4b63', '#8593aa'],
}
const FAR_FILL: Record<WeatherKind, string> = { sun: '#a8c3dc', cloud: '#a3b6c8', rain: '#8ea2b8', storm: '#5d6b82' }
const MID_FILL: Record<WeatherKind, string> = { sun: '#86c08f', cloud: '#86b48e', rain: '#6f9c7b', storm: '#4f6f5c' }
const TREE: Record<WeatherKind, string> = { sun: '#3f8a52', cloud: '#3f8250', rain: '#356e46', storm: '#2c4d39' }
const CLOUD: Record<WeatherKind, string> = { sun: '#ffffff', cloud: '#f4f7fa', rain: '#b3bfcc', storm: '#66728a' }

interface Props {
  weather: WeatherKind
  /** screen y where the meadow starts (hill 0) */
  horizon: number
  farRef: RefObject<HTMLDivElement>
  midRef: RefObject<HTMLDivElement>
  reduced: boolean
}

/** sky that cross-fades with the payday weather, the Caucasus far away and nearer hills (parallax tiles) */
export const Backdrop = memo(function Backdrop({ weather, horizon, farRef, midRef, reduced }: Props) {
  const tiles = [0, 1, 2]
  return (
    <>
      {(Object.keys(SKY) as WeatherKind[]).map(k => (
        <div key={k} className="f-sky" style={{ background: `linear-gradient(180deg, ${SKY[k][0]} 0%, ${SKY[k][1]} 70%)`, opacity: weather === k ? 1 : 0 }} />
      ))}
      <svg className="f-sun" viewBox="0 0 120 120" style={{ top: Math.max(150, horizon - 140), opacity: weather === 'sun' ? 1 : weather === 'cloud' ? 0.45 : 0 }} aria-hidden="true">
        <g className={reduced ? '' : 'f-spin'} style={{ transformOrigin: '60px 60px' }}>
          {Array.from({ length: 12 }).map((_, i) => <rect key={i} x="57.5" y="8" width="5" height="16" rx="2.5" fill="#ffd45c" transform={`rotate(${i * 30} 60 60)`} />)}
        </g>
        <circle cx="60" cy="60" r="27" fill="#ffd45c" />
        <circle cx="52" cy="52" r="9" fill="#ffe89a" />
      </svg>
      <div className="f-clouds" style={{ opacity: weather === 'sun' ? 0.75 : 1 }} aria-hidden="true">
        {[{ x: 4, y: 0, s: 1, d: 11 }, { x: 46, y: -24, s: 1.35, d: 14 }, { x: 74, y: 22, s: 0.85, d: 9 }].map((c, i) => (
          <svg key={i} className={reduced ? '' : 'f-drift'} viewBox="-50 -30 100 50" style={{ left: `${c.x}%`, top: 210 + c.y, width: 110 * c.s, animationDuration: `${c.d}s`, animationDelay: `${-i * 2}s` }}>
            <g fill={CLOUD[weather]} style={{ transition: 'fill 0.8s' }}>
              <ellipse cx="0" cy="6" rx="40" ry="14" /><ellipse cx="-16" cy="-2" rx="18" ry="15" /><ellipse cx="10" cy="-8" rx="21" ry="19" />
            </g>
          </svg>
        ))}
      </div>

      {/* far Caucasus range with snow caps */}
      <div ref={farRef} className="f-layer" style={{ top: horizon - 170, height: 200 }} aria-hidden="true">
        {tiles.map(i => (
          <svg key={i} viewBox="0 0 480 200" width={FAR_W} height="200" preserveAspectRatio="none">
            <path d="M0 170 L38 104 L62 128 L110 46 L150 112 L184 84 L232 140 L270 70 L300 96 L344 30 L392 118 L430 80 L480 170 L480 200 L0 200 Z" fill={FAR_FILL[weather]} style={{ transition: 'fill 0.8s' }} />
            <path d="M110 46 L96 70 L108 66 L116 74 L124 64 L130 70 Z M344 30 L328 58 L340 54 L348 64 L356 52 L364 58 Z M270 70 L260 86 L270 83 L278 90 L284 82 Z M38 104 L30 117 L40 114 L46 119 Z M430 80 L421 94 L431 91 L438 96 Z" fill="#fff" opacity={weather === 'storm' ? 0.55 : 0.95} />
          </svg>
        ))}
      </div>
      {/* nearer hills: trees, a Svan tower, a small church */}
      <div ref={midRef} className="f-layer" style={{ top: horizon - 92, height: 120 }} aria-hidden="true">
        {tiles.map(i => (
          <svg key={i} viewBox="0 0 420 120" width={MID_W} height="120" preserveAspectRatio="none">
            <path d="M0 76 Q60 30 120 58 T240 52 T360 46 T420 76 L420 120 L0 120 Z" fill={MID_FILL[weather]} style={{ transition: 'fill 0.8s' }} />
            {[30, 52, 168, 190, 300, 392].map((x, k) => (
              <g key={k} transform={`translate(${x} ${k % 2 ? 58 : 54})`} fill={TREE[weather]}>
                <path d="M0 -24 L9 0 L-9 0 Z" /><path d="M0 -32 L7 -13 L-7 -13 Z" />
              </g>
            ))}
            <g transform="translate(112 52)" fill="#cdbfa8">
              <rect x="-7" y="-46" width="14" height="46" /><path d="M-9 -46 L0 -56 L9 -46 Z" fill="#8a7a64" /><rect x="-3" y="-38" width="6" height="7" fill="#6b5d4a" />
            </g>
            <g transform="translate(262 48)" fill="#e2d6c2">
              <rect x="-14" y="-16" width="28" height="16" /><rect x="-5" y="-30" width="10" height="16" /><path d="M-7 -30 L0 -38 L7 -30 Z" fill="#8a6a48" />
            </g>
          </svg>
        ))}
      </div>
    </>
  )
})

/** rain over the whole scene (rain and storm) */
export const Rain = memo(function Rain({ weather, reduced }: { weather: WeatherKind; reduced: boolean }) {
  if (reduced || (weather !== 'rain' && weather !== 'storm')) return null
  const n = weather === 'storm' ? 44 : 26
  return (
    <div className="f-rain" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 100}s`, animationDuration: `${0.7 + (i % 5) * 0.08}s` }} />
      ))}
    </div>
  )
})
