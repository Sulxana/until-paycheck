import { RefObject } from 'react'
import { WeatherKind } from '../../engine/engine'
import { WEMOJI, InfoTip } from '../../components/ui'
import { fmt, gel } from '../../engine/view'
import { Cycle } from '../cycle'

/** header and the always-visible strip of the next six days: bills on their real day and each day's weather */
export function TopBar({ c, day, days, calm, onExit }: { c: Cycle; day: number; days: WeatherKind[]; calm: boolean; onExit: () => void }) {
  const from = Math.min(day, c.nDays - 5)
  const cells = Array.from({ length: 6 }, (_, k) => from + k)
  return (
    <div className="g-top">
      <div className="between">
        <button className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)' }} onClick={onExit}>‹ უკან გზაზე</button>
        <span className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)', fontWeight: 800 }}>
          {calm ? `დღე ${Math.min(c.nDays, day + 1)}` : `დღე ${Math.min(c.nDays, day + 1)} / ${c.nDays}`}
        </span>
      </div>
      <div className="g-strip" aria-label="მომავალი დღეები">
        {cells.map(d => {
          if (d >= c.nDays) {
            return (
              <div key={d} className="g-cell" style={{ background: '#fff6dd' }}>
                <span className="d">{c.paydayLabel}</span>
                <span className="w">🔔</span>
                <span className="b">ხელფასი</span>
              </div>
            )
          }
          const bills = c.events.filter(e => e.kind === 'bill' && Math.floor(e.at) === d)
          const sum = bills.reduce((s, b) => s + (b.kind === 'bill' ? (b.range ? b.nominal : b.amount) : 0), 0)
          const title = bills.map(b => (b.kind === 'bill' ? b.label : '')).join(', ')
          return (
            <div key={d} className={'g-cell' + (d === day ? ' today' : '')} title={title || undefined}>
              <span className="d">{c.days[d].label}</span>
              <span className="w">{WEMOJI[days[d] ?? 'sun']}</span>
              <span className="b">{bills.length ? `${bills[0].kind === 'bill' ? bills[0].icon : ''}${fmt(sum)}` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** money bar with the cushion line, the qvevri beside it and the joy counter */
export function BottomHud({ c, wallet, qvevri, joy, barRef, pulse, jarOpen }: { c: Cycle; wallet: number; qvevri: number; joy: number; barRef: RefObject<HTMLDivElement>; pulse: { kind: 'glow' | 'shake'; n: number } | null; jarOpen: number }) {
  const max = Math.max(c.startBalance, 1)
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const w = pct(wallet)
  const q = Math.min(100 - w, pct(qvevri))
  return (
    <div className="g-bottom" data-info-root>
      <div className="between">
        <div>
          <div className="tiny muted" style={{ fontWeight: 700 }}>ბალანსი</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{gel(Math.round(wallet))}</div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span key={jarOpen} className={'g-jar' + (jarOpen ? ' open' : '')} title="ქვევრი">
            🏺 {gel(Math.round(qvevri))}
            {jarOpen > 0 && <span className="g-dust">💨</span>}
          </span>
          <span className="g-jar" title="სიხარული">🙂 {joy}</span>
          <InfoTip label="რას ნიშნავს?">
            <div><b>ზოლი</b> — შენი ფული ხელფასამდე.</div>
            <div><b>წითელი ხაზი</b> — ზღვარი ({gel(c.cushion)}), 3 დღის ხარჯი.</div>
            <div><b>🏺 ქვევრი</b> — მოულოდნელ ხარჯს იჭერს. ფული შენი რჩება.</div>
            <div><b>🙂</b> — სიხარული, უფასოც და ფასიანიც ერთნაირად ითვლება.</div>
          </InfoTip>
        </div>
      </div>
      <div key={pulse?.n ?? 0} ref={barRef} className={'g-bar' + (pulse ? ' ' + pulse.kind : '')}>
        <div className="fill" style={{ width: `${w}%` }} />
        {q > 0 && <div className="q" style={{ left: `${w}%`, width: `${q}%` }} />}
        <div className="cush" style={{ left: `${pct(c.cushion)}%` }} />
      </div>
      <div className="between" style={{ marginTop: 4 }}>
        <span className="tiny" style={{ color: 'var(--bad)', fontWeight: 800 }}>ზღვარი {gel(c.cushion)}</span>
        <span className="tiny muted">შეხება — ავიღებ · არაფერი — ჩავუვლი</span>
      </div>
    </div>
  )
}
