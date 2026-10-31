import { memo, RefObject, useLayoutEffect, useRef } from 'react'
import { fmt } from '../../engine/view'
import { WEMOJI } from '../../components/ui'
import { WeatherKind } from '../../engine/engine'
import { Month, Fc, E_MAX } from '../sim'

const r5 = (v: number) => Math.round(v / 5) * 5

/** a number that rolls to its new value (writes text directly, no re-render per frame) */
export function Roll({ v, className }: { v: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const cur = useRef(v)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = cur.current, to = v
    if (Math.abs(from - to) < 0.5) { el.textContent = fmt(Math.round(to)); cur.current = to; return }
    const t0 = performance.now()
    let raf = 0
    const f = (t: number) => {
      const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3)
      const val = from + (to - from) * e
      cur.current = val
      el.textContent = fmt(Math.round(val))
      if (k < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [v])
  return <span ref={ref} className={className} />
}

interface Props {
  m: Month
  fc: Fc
  /** forecast if the previewed option is taken (with the open fork counted at its average in `fc`) */
  preview: Fc | null
  money: number
  energy: number
  day: number
  combo: number
  muted: boolean
  moneyRef: RefObject<HTMLDivElement>
  energyRef: RefObject<HTMLDivElement>
  onMute: () => void
  onPause: () => void
  onExit: () => void
}

export const Hud = memo(function Hud({ m, fc, preview, money, energy, day, combo, muted, moneyRef, energyRef, onMute, onPause, onExit }: Props) {
  const w: WeatherKind = preview ? preview.weather : fc.weather
  const d = Math.max(0, Math.min(30, day))
  const bills = m.bills.filter(b => b.day > day).slice(0, 4)
  const level = energy >= 5 ? 'hi' : energy >= 3 ? 'mid' : 'lo'
  const stop = (e: React.PointerEvent) => e.stopPropagation()
  return (
    <div className="f-hud" onPointerDown={stop}>
      <div className="f-hud-row">
        <button className="f-ic" onClick={onExit} aria-label="გასვლა">✕</button>
        <span className="f-day">{m.days[d].label} · {d}/30</span>
        {combo >= 2 && <span key={combo} className="f-combo-chip" title="წონასწორობა ზედიზედ">⚖️ ×{combo}</span>}
        <span style={{ flex: 1 }} />
        <button className="f-ic" onClick={onPause} aria-label="პაუზა">⏸</button>
        <button className="f-ic" onClick={onMute} aria-label={muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <div className={'f-hud-card w-' + w + (preview ? ' pv' : '')}>
        <div className="f-wx"><span key={w}>{WEMOJI[w]}</span></div>
        <div className="f-pay">
          <span className="lbl">ხელფასის დღეს</span>
          <span className="big">
            {preview ? (
              <><span className="from">{fmt(r5(fc.p50))}</span><span className="arrow">→</span><Roll v={r5(preview.p50)} /> ₾</>
            ) : (
              <>≈ <Roll v={r5(fc.p50)} /> ₾</>
            )}
          </span>
        </div>
        <div className="f-acc" ref={moneyRef}>
          <span className="lbl">ანგარიშზე</span>
          <b><Roll v={money} /> ₾</b>
          <span className="cush">ზღვარი {fmt(m.cushion)} ₾</span>
        </div>
      </div>
      <div className="f-hud-row low">
        <div className={'f-energy ' + level} ref={energyRef} aria-label={`ენერგია ${energy}`}>
          <span className="z">⚡</span>
          <span className="bar">{Array.from({ length: E_MAX }).map((_, i) => <i key={i} className={i < energy ? 'on' : ''} />)}</span>
          <b>{energy}</b>
        </div>
        <div className="f-bills">
          {bills.map(b => (
            <span key={b.label} className={'stone' + (b.rent ? ' rent' : '')} title={b.label}><i>{b.icon} {fmt(b.nominal)}</i><small>{m.days[b.day].label}</small></span>
          ))}
        </div>
      </div>
    </div>
  )
})
