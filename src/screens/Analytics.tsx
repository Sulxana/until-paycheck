import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../state/store'
import { useToday, gel, fmt } from '../engine/view'
import { FanChart } from '../components/FanChart'
import { WeatherChip, Disclaimer } from '../components/ui'
import { BANK_META } from '../engine/personas'
import { CycleRow, Engine } from '../engine/engine'

type Seg = 'payday' | 'year' | 'spend'

export function Analytics() {
  const [seg, setSeg] = useState<Seg>('payday')
  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <div className="pad" style={{ paddingTop: 18 }}>
        <div className="between"><h2 className="h2" style={{ fontSize: 24 }}>ანალიზი</h2><span className="tag">1 000 სცენარი</span></div>
        <div className="seg" style={{ marginTop: 12 }}>
          {([['payday', 'ხელფასამდე'], ['year', '12 თვე'], ['spend', 'ხარჯები']] as [Seg, string][]).map(([k, l]) => (
            <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>
          ))}
        </div>
      </div>
      <motion.div key={seg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pad" style={{ paddingTop: 12, paddingBottom: 20, display: 'grid', gap: 12 }}>
        {seg === 'payday' && <Payday />}
        {seg === 'year' && <Year />}
        {seg === 'spend' && <Spend />}
      </motion.div>
      <Disclaimer />
      <div style={{ height: 12 }} />
    </div>
  )
}

function Payday() {
  const v = useToday()
  const { e, p } = v
  const reward = useStore(s => s.reward)
  const confirmed = useStore(s => s.games[p.id].confirmed)
  const fan = useMemo(() => e.fan(), [e])
  const bills = p.due.map(d => ({ idx: d.dayIndex, name: d.name, amount: d.amount ?? Math.round((d.range![0] + d.range![1]) / 2) }))
  const fixedShare = Math.round((e.fixedTotal / p.salary) * 100)
  const varShare = Math.round((e.monthlyVarMedian / p.salary) * 100)
  const left = 100 - fixedShare - varShare
  return (
    <>
      <div className="card">
        <div className="between"><div className="h3">ბალანსი ხელფასამდე</div><WeatherChip w={e.landing.weather} /></div>
        <div className="small muted" style={{ margin: '4px 0 6px' }}>დღეს {gel(e.spendable)} → ხელფასის დღეს ~{gel(Math.round(e.landing.p50 / 10) * 10)} ({fmt(Math.round(e.landing.p10 / 10) * 10)}–{fmt(Math.round(e.landing.p90 / 10) * 10)})</div>
        <FanChart data={fan} cushion={e.cushion} bills={bills} />
        <div className="row tiny muted" style={{ gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5aa9e6', opacity: 0.4, borderRadius: 3 }} /> 10 მსგავსი თვიდან 8</span>
          <span>━ ყველაზე სავარაუდო</span>
          <span style={{ color: '#ff7a59' }}>● გადასახადი</span>
        </div>
      </div>

      <div className="card">
        <div className="h3">შენი თვე ერთ ზოლში</div>
        <div style={{ display: 'flex', height: 26, borderRadius: 10, overflow: 'hidden', margin: '10px 0 8px' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${fixedShare}%` }} transition={{ duration: 0.8 }} style={{ background: '#1f3b57' }} />
          <motion.div initial={{ width: 0 }} animate={{ width: `${varShare}%` }} transition={{ duration: 0.8, delay: 0.2 }} style={{ background: '#5aa9e6' }} />
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, left)}%` }} transition={{ duration: 0.8, delay: 0.4 }} style={{ background: '#6fbf73' }} />
        </div>
        <div className="row tiny" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span>■ ფიქსირებული <b>{gel(e.fixedTotal)}</b> · {fixedShare}%</span>
          <span style={{ color: '#3d86c6' }}>■ ცვლადი ~<b>{gel(e.monthlyVarMedian)}</b> · {varShare}%</span>
          <span style={{ color: '#4e9d57' }}>■ რჩება ~<b>{gel(Math.round(e.medianSurplus))}</b></span>
        </div>
        <div className="small" style={{ marginTop: 10, background: '#fff7e0', borderRadius: 10, padding: '8px 10px' }}>📘 ხელფასის {fixedShare >= 50 ? 'ნახევარზე მეტი' : `${fixedShare}%`} დაპირებულია, სანამ პირველ ლარს დახარჯავ.</div>
      </div>

      <div className="card">
        <div className="between"><div className="h3">რა გელოდება ხელფასამდე</div><span className="tag">მტკიცებულებით</span></div>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {p.due.map(d => {
            const amt = d.amount ?? Math.round((d.range![0] + d.range![1]) / 2)
            const done = d.dayIndex < v.day
            return (
              <div key={d.name} className="between" style={{ padding: '8px 10px', borderRadius: 12, background: done ? '#f3f6f2' : '#fbf8f2', opacity: done ? 0.6 : 1 }}>
                <div>
                  <div className="small" style={{ fontWeight: 800 }}>{d.name} <span className="tiny muted">· {BANK_META[d.bank].label}</span></div>
                  <div className="tiny muted">{d.date} · {d.range ? `${d.range[0]}–${d.range[1]} ₾ · სეზონური` : `6-ჯერ ვნახეთ, ყოველ 29–31 დღეში`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800 }}>{d.range ? '~' : ''}{gel(amt)}</div>
                  {done ? <span className="tiny muted">გადახდილია ✓</span> : confirmed.includes(d.name) ? <span className="tiny" style={{ color: 'var(--good)', fontWeight: 700 }}>დადასტურდა ✓</span> : (
                    <button className="tiny" style={{ color: 'var(--sky)', fontWeight: 800 }} onClick={() => reward('confirm', d.name)}>სწორია?</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>ყოველი დადასტურება ამინდის სადგურს აუმჯობესებს და დიაპაზონს ავიწროებს.</div>
      </div>
    </>
  )
}

/** monthly net (what one pay cycle adds or eats), so winter deficits are visible instead of hidden by the running balance */
function YearBars({ rows, cushion, start }: { rows: CycleRow[]; cushion: number; start: number }) {
  const nets = rows.map((r, i) => r.p50 - (i ? rows[i - 1].p50 : start))
  const W = 340, H = 200, L = 34, B = 24, T = 18
  const lo = Math.min(0, ...nets) - 20, hi = Math.max(0, ...nets) + 25
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const bw = (W - L - 6) / rows.length
  const col = (v: number) => (v < 0 ? '#d9534f' : v < 60 ? '#f0b429' : '#58b368')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {[lo + 20, 0, hi - 25].map(t => Math.round(t / 50) * 50).filter((t, i, a) => a.indexOf(t) === i).map(t => (
        <g key={t}>
          <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9bfae' : '#efe8dc'} />
          <text x={L - 5} y={y(t) + 3} fontSize="9" textAnchor="end" fill="#8193a5">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const v = nets[i]
        const x = L + i * bw + 3
        const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)))
        const winter = r.uplift >= 80
        const short = r.p50 < cushion
        return (
          <g key={r.cycleEnd}>
            {winter && <rect x={x - 2} y={T - 6} width={bw - 2} height={H - T - B + 6} fill="#e8f1fb" rx="4" />}
            <motion.rect x={x} width={bw - 6} rx="3" fill={col(v)} initial={{ height: 0, y: y(0) }} animate={{ height: h, y: top }} transition={{ delay: i * 0.04, duration: 0.5 }} />
            <text x={x + bw / 2 - 3} y={v < 0 ? top + h + 10 : top - 4} fontSize="8" fontWeight="700" textAnchor="middle" fill={v < 0 ? '#b4413b' : '#4a5b6d'}>{Math.round(v)}</text>
            {short && <text x={x + bw / 2 - 3} y={T - 8 + 6} fontSize="9" textAnchor="middle">⚠️</text>}
            <text x={x + bw / 2 - 3} y={H - 8} fontSize="8.5" textAnchor="middle" fill="#8193a5">{r.label.split(' ')[1]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Year() {
  const v = useToday()
  const { e, p } = v
  const [pledge, setPledge] = useState(false)
  const [delivery, setDelivery] = useState(false)
  const delta = (pledge ? 100 : 0) - (delivery ? Math.round(e.monthlyVarMedian * 0.034) : 0)
  const rows = useMemo(() => (delta === 0 ? e.baseline : e.installment({ price: 0, months: 1, ratePerMonth: 0, pledge: delta }).rows.slice(0, 12)), [e, delta])
  const short = rows.filter(r => r.p50 < e.cushion)
  return (
    <>
      <div className="card">
        <div className="h3">რამდენი რჩება ყოველ თვეს</div>
        <div className="small muted" style={{ margin: '4px 0 8px' }}>ხელფასიდან ხელფასამდე, ყველაზე სავარაუდო. ცისფერი ფონი — ზამთარი, ⚠️ — ხელფასამდე ზღვარს ქვემოთ.</div>
        <YearBars rows={rows} cushion={e.cushion} start={e.landing.p50} />
        <div className="small" style={{ marginTop: 6, fontWeight: 700, color: short.length ? '#b4413b' : 'var(--good)' }}>
          {short.length ? `${short.length} თვე ზღვარს ქვემოთ: ${short.map(s => s.label.split(' ')[1]).join(', ')}` : 'ყველა თვე ზღვარს ზემოთ'}
        </div>
        <div className="tiny muted">ექსტრაპოლაციაა: ვვარაუდობ, რომ შენი ბოლო {p.historyMonths} თვე მეორდება, ზამთარში — შარშანდელი დანამატით.</div>
      </div>
      <div className="card">
        <div className="h3">რა მოხდება, თუ…</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <Toggle on={pledge} set={setPledge} title="100 ₾ ყოველ ხელფასზე ქვევრში" sub="დაპირება, რომელიც ხელფასის დღეს სრულდება" />
          <Toggle on={delivery} set={setDelivery} title="მიწოდება და კაფე −20%" sub={`~${gel(Math.round(e.monthlyVarMedian * 0.034))} თვეში`} />
        </div>
        {pledge && short.length > 0 && <div className="small" style={{ marginTop: 10, background: '#fff4dc', borderRadius: 10, padding: '8px 10px' }}>ℹ️ დაპირებით ზამთარში ზღვარს ქვემოთ ხვდები. ინფორმაციისთვის: ბევრი დეკემბერ-მარტში დაპირებას აჩერებს.</div>}
      </div>
    </>
  )
}

function Toggle({ on, set, title, sub }: { on: boolean; set: (v: boolean) => void; title: string; sub: string }) {
  return (
    <button onClick={() => set(!on)} className="between" style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 14, background: on ? '#eaf4fd' : '#fbf8f2' }}>
      <div><div className="small" style={{ fontWeight: 800 }}>{title}</div><div className="tiny muted">{sub}</div></div>
      <span style={{ width: 46, height: 26, borderRadius: 13, background: on ? '#1f3b57' : '#d9d0c2', position: 'relative', flexShrink: 0 }}>
        <motion.span animate={{ x: on ? 20 : 0 }} style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: '#fff' }} />
      </span>
    </button>
  )
}

const CATS: { name: string; icon: string; share: number; merchants: [string, number][] }[] = [
  { name: 'საკვები', icon: '🛒', share: 0.42, merchants: [['ნიკორა', 0.45], ['ორი ნაბიჯი', 0.3], ['ფრესკო', 0.25]] },
  { name: 'მიწოდება და კაფე', icon: '🍕', share: 0.17, merchants: [['Wolt', 0.55], ['Glovo', 0.3], ['კაფე', 0.15]] },
  { name: 'ტრანსპორტი', icon: '🚌', share: 0.13, merchants: [['Bolt', 0.6], ['მეტრო / ავტობუსი', 0.4]] },
  { name: 'აფთიაქი', icon: '💊', share: 0.06, merchants: [['PSP', 0.6], ['ავერსი', 0.4]] },
  { name: 'სხვა', icon: '🧺', share: 0.22, merchants: [['ტანსაცმელი', 0.4], ['საჩუქრები', 0.3], ['ნაღდი (ბანკომატი)', 0.3]] },
]

function weekdayProfile(e: Engine) {
  const sp = e.p.spend
  const oneoff = sp.oneoffP * sp.oneoffMedian * Math.exp(sp.oneoffSigma ** 2 / 2)
  const wd = sp.weekdayMean + oneoff, we = sp.weekendMean + oneoff
  return ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'].map((d, i) => ({ d, v: (i >= 5 ? we : wd) * (1 + ((i * 7) % 5 - 2) * 0.03) }))
}

function Spend() {
  const v = useToday()
  const { e, p } = v
  const total = e.monthlyVarMedian
  const wk = weekdayProfile(e)
  const maxWk = Math.max(...wk.map(x => x.v))
  return (
    <>
      <div className="card">
        <div className="between"><div className="h3">ცვლადი ხარჯი თვეში</div><b>~{gel(total)}</b></div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {CATS.map((c, i) => (
            <div key={c.name}>
              <div className="between small"><span>{c.icon} {c.name}</span><b>~{gel(Math.round((total * c.share) / 5) * 5)}</b></div>
              <div style={{ height: 8, borderRadius: 5, background: '#efe8dc', marginTop: 4, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${c.share * 100 / 0.42}%` }} transition={{ delay: i * 0.08 }} style={{ height: '100%', background: ['#1f3b57', '#5aa9e6', '#7a5af8', '#ff7a59', '#9fb4c7'][i], borderRadius: 5 }} />
              </div>
              <div className="tiny muted" style={{ marginTop: 3 }}>{c.merchants.map(([m, s]) => `${m} ${fmt(Math.round(total * c.share * s))} ₾`).join(' · ')}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="h3">კვირის დღეები</div>
        <div className="small muted">საშუალო ხარჯი დღეში</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, marginTop: 10 }}>
          {wk.map((x, i) => (
            <div key={x.d} style={{ flex: 1, textAlign: 'center' }}>
              <div className="tiny" style={{ fontWeight: 700 }}>{Math.round(x.v)}</div>
              <motion.div initial={{ height: 0 }} animate={{ height: (x.v / maxWk) * 80 }} transition={{ delay: i * 0.05 }} style={{ background: i >= 5 ? '#ff7a59' : '#5aa9e6', borderRadius: 6 }} />
              <div className="tiny muted">{x.d}</div>
            </div>
          ))}
        </div>
        <div className="small" style={{ marginTop: 10, background: '#fff7e0', borderRadius: 10, padding: '8px 10px' }}>📘 შაბათ-კვირას ~{Math.round((wk[5].v / wk[0].v - 1) * 100)}%-ით მეტს ხარჯავ. ამიტომ პროგნოზი კვირის დღეებს ცალ-ცალკე ითვლის.</div>
      </div>
      <div className="card">
        <div className="between"><div className="h3">ფიქსირებული ნაკადები</div><b>{gel(e.fixedTotal)}</b></div>
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {p.fixed.map(f => (
            <div key={f.name} className="between small" style={{ padding: '6px 0', borderBottom: '1px dashed #eee5d8' }}>
              <div><b>{f.name}</b><div className="tiny muted">ყოველი თვის {f.day} · {f.seen}-ჯერ ვნახეთ · {BANK_META[f.bank].label}</div></div>
              <b>{f.range ? '~' : ''}{gel(f.amount)}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
