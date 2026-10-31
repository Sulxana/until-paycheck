import { ReactNode, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../state/store'
import { useToday, gel, fmt, rangeText } from '../engine/view'
import { FanChart } from '../components/FanChart'
import { Disclaimer, InfoTip } from '../components/ui'
import { BANK_META } from '../engine/personas'
import { CycleRow, Engine, KA_MONTHS_FULL } from '../engine/engine'
import { Points } from '../components/points/Points'

type Seg = 'payday' | 'spend' | 'points'

export function Analytics() {
  const gameOff = useStore(st => st.gameOff)
  const raw = useStore(st => st.analyticsSeg) as Seg
  const seg: Seg = gameOff && raw === 'points' ? 'payday' : raw
  const setSeg = useStore(st => st.setAnalyticsSeg)
  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <div className="pad" style={{ paddingTop: 18 }}>
        <h2 className="h2" style={{ fontSize: 26 }}>ანალიზი</h2>
        <div className="small muted" style={{ marginTop: 2 }}>შენი ფული უბრალო სიტყვებით</div>
        <div className="seg" style={{ marginTop: 12 }}>
          {([['payday', 'ხელფასამდე'], ['spend', 'ხარჯები'], ['points', 'ქულები']] as [Seg, string][]).filter(([k]) => !(gameOff && k === 'points')).map(([k, l]) => (
            <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>
          ))}
        </div>
      </div>
      <motion.div key={seg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pad" style={{ paddingTop: 12, paddingBottom: 20, display: 'grid', gap: 12 }}>
        {seg === 'payday' && <Payday />}
        {seg === 'spend' && <Spend />}
        {seg === 'points' && <Points />}
      </motion.div>
      {seg === 'points' ? <Disclaimer /> : <Disclaimer>ინფორმაციაა, არა რჩევა. პროგნოზი შენი ხარჯების ისტორიიდან ითვლება.</Disclaimer>}
      <div style={{ height: 12 }} />
    </div>
  )
}

/** a card that leads with one plain sentence, then the picture, then a plain-words legend */
function Insight({ kicker, title, children, legend }: { kicker: string; title: ReactNode; children: ReactNode; legend?: ReactNode }) {
  return (
    <div className="card" data-info-root style={{ padding: 16, position: 'relative' }}>
      <div className="between" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="tiny" style={{ fontWeight: 800, color: 'var(--sky)', letterSpacing: 0.3 }}>{kicker}</div>
          <div className="display" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, margin: '4px 0 12px', textWrap: 'balance' as any }}>{title}</div>
        </div>
        {legend && <InfoTip>{legend}</InfoTip>}
      </div>
      {children}
    </div>
  )
}

function Payday() {
  const v = useToday()
  const { e, p } = v
  const reward = useStore(s => s.reward)
  const confirmed = useStore(s => s.games[p.id].confirmed)
  const fan = useMemo(() => e.fan(), [e])
  const due = [...p.due].sort((a, b) => a.dayIndex - b.dayIndex)
  const bills = due.map(d => ({ idx: d.dayIndex, name: d.name, amount: d.amount ?? Math.round((d.range![0] + d.range![1]) / 2) }))
  const fixedShare = Math.round((e.fixedTotal / p.salary) * 100)
  const varShare = Math.round((e.monthlyVarMedian / p.salary) * 100)
  const left = Math.max(0, 100 - fixedShare - varShare)
  const r10 = (n: number) => Math.round(n / 10) * 10
  return (
    <>
      <Insight
        kicker="ხელფასამდე"
        title={<>ხელფასის დღეს სავარაუდოდ <span style={{ color: 'var(--navy)' }}>~{fmt(r10(e.landing.p50))} ₾</span> დაგრჩება</>}
        legend={<>ცისფერი ზოლი — სად შეიძლება აღმოჩნდე ({rangeText(r10(e.landing.p10), r10(e.landing.p90))}). მუქი ხაზი — ყველაზე სავარაუდო გზა. ნარინჯისფერი წერტილები — გადასახადები.</>}
      >
        <FanChart data={fan} cushion={e.cushion} bills={bills} />
      </Insight>

      <Insight
        kicker="შენი თვე"
        title={<>ხელფასის <span style={{ color: '#1f3b57' }}>{fixedShare}%</span> თავიდანვე დაკავებულია</>}
        legend="ფიქსირებული ხარჯი ყოველთვე მეორდება: ქირა, კომუნალური, განვადება. ის ხელფასიდან პირველივე დღეებში მიდის."
      >
        <div style={{ display: 'flex', height: 40, borderRadius: 12, overflow: 'hidden' }}>
          {[
            { w: fixedShare, c: '#1f3b57', t: 'ფიქსირებული' },
            { w: varShare, c: '#5aa9e6', t: 'ყოველდღიური' },
            { w: left, c: '#6fbf73', t: 'რჩება' },
          ].map((s, i) => (
            <motion.div key={s.t} initial={{ width: 0 }} animate={{ width: `${s.w}%` }} transition={{ duration: 0.8, delay: i * 0.2 }} style={{ background: s.c, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {s.w >= 10 ? `${s.w}%` : ''}
            </motion.div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
          {[
            { c: '#1f3b57', t: 'ფიქსირებული', v: gel(e.fixedTotal) },
            { c: '#5aa9e6', t: 'ყოველდღიური', v: `~${gel(e.monthlyVarMedian)}` },
            { c: '#6fbf73', t: 'რჩება', v: `~${gel(Math.round(e.medianSurplus))}` },
          ].map(s => (
            <div key={s.t}>
              <div className="tiny muted" style={{ fontWeight: 700 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: s.c, marginRight: 5 }} />{s.t}</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Insight>

      <Year />

      <Insight kicker="გადასახადები" title="ხელფასამდე ეს გადასახადები გელის" legend={<>
        <div>ყოველი დადასტურება პროგნოზს აზუსტებს.</div>
        {due.filter(d => d.range).map(d => <div key={d.name}><b>{d.name}</b>: თანხა იცვლება, {d.range![0]}–{d.range![1]} ₾.</div>)}
        {due.some(d => !d.range) && <div><b>{due.filter(d => !d.range).map(d => d.name).join(', ')}</b>: ყოველთვე, ბოლო 6 თვე.</div>}
      </>}>
        <div style={{ display: 'grid', gap: 8 }}>
          {due.map(d => {
            const amt = d.amount ?? Math.round((d.range![0] + d.range![1]) / 2)
            const done = d.dayIndex < v.day
            return (
              <div key={d.name} className="between" style={{ padding: '10px 12px', borderRadius: 14, background: done ? '#f3f6f2' : '#fbf8f2', opacity: done ? 0.6 : 1 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{d.name}</div>
                  <div className="tiny muted">{d.date} · {BANK_META[d.bank].label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{d.range ? '~' : ''}{gel(amt)}</div>
                  {done ? <span className="tiny muted">გადახდილია</span> : confirmed.includes(d.name) ? <span className="tiny" style={{ color: 'var(--good)', fontWeight: 700 }}>დადასტურდა ✓</span> : (
                    <button className="tiny" style={{ color: 'var(--sky)', fontWeight: 800 }} onClick={() => reward('confirm', d.name)}>სწორია? დაადასტურე</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Insight>
    </>
  )
}

/** monthly net (what one pay cycle adds or eats), so winter deficits are visible instead of hidden by the running balance */
function YearBars({ rows, start }: { rows: CycleRow[]; start: number }) {
  const nets = rows.map((r, i) => r.p50 - (i ? rows[i - 1].p50 : start))
  const W = 340, H = 210, L = 6, B = 26, T = 28
  const lo = Math.min(0, ...nets) - 25, hi = Math.max(0, ...nets) + 30
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const bw = (W - L * 2) / rows.length
  const col = (v: number) => (v < 0 ? '#d9534f' : v < 60 ? '#f0b429' : '#58b368')
  const winterIdx = rows.map((r, i) => (r.uplift >= 80 ? i : -1)).filter(i => i >= 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      {winterIdx.length > 0 && (
        <g>
          <rect x={L + winterIdx[0] * bw} y={6} width={bw * winterIdx.length} height={H - B - 2} fill="#e8f1fb" rx="8" />
          <text x={L + winterIdx[0] * bw + (bw * winterIdx.length) / 2} y={19} fontSize="10" fontWeight="800" textAnchor="middle" fill="#3d86c6">ზამთარი</text>
        </g>
      )}
      <line x1={L} x2={W - L} y1={y(0)} y2={y(0)} stroke="#b9ad99" strokeWidth="1.2" />
      {rows.map((r, i) => {
        const v = nets[i]
        const x = L + i * bw + 4
        const top = Math.min(y(v), y(0)), h = Math.max(2, Math.abs(y(v) - y(0)))
        return (
          <g key={r.cycleEnd}>
            <motion.rect x={x} width={bw - 8} rx="5" fill={col(v)} initial={{ height: 0, y: y(0) }} animate={{ height: h, y: top }} transition={{ delay: i * 0.04, duration: 0.5 }} />
            <text x={x + (bw - 8) / 2} y={v < 0 ? top + h + 12 : top - 5} fontSize="9.5" fontWeight="800" textAnchor="middle" fill={v < 0 ? '#b4413b' : '#4a5b6d'}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(Math.round(v))}</text>
            <text x={x + (bw - 8) / 2} y={H - 8} fontSize="10" textAnchor="middle" fill="#6b7d8f">{r.label.split(' ')[1]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Year() {
  const v = useToday()
  const { e } = v
  const rows = e.baseline
  const nets = rows.map((r, i) => r.p50 - (i ? rows[i - 1].p50 : e.landing.p50))
  const worstI = nets.reduce((bi, n, i) => (n < nets[bi] ? i : bi), 0)
  const worst = Math.round(nets[worstI])
  const short = rows.filter(r => r.p50 < e.cushion)
  const worstMonth = KA_MONTHS_FULL[rows[worstI].m] // same month as the bar label
  const stem = worstMonth.endsWith('ი') ? worstMonth.slice(0, -1) : worstMonth
  return (
    <Insight
      kicker="წინ რთული თვეები"
      title={worst < 0 ? <>ყველაზე რთული თვე <span style={{ color: '#b4413b' }}>{worstMonth}ა: {fmt(worst)} ₾</span></> : <>ყოველ თვეს რაღაც რჩება. ყველაზე ცოტა — {stem}ში</>}
      legend={<>სვეტი აჩვენებს, რამდენი რჩება ერთი ხელფასიდან მეორემდე. მწვანე — კარგად რჩება, ყვითელი — ცოტა, წითელი — თვე მინუსშია.{short.length ? ` ზღვარს ქვემოთ ჩადიხარ: ${short.map(s => s.label.split(' ')[1]).join(', ')}.` : ''}</>}
    >
      <YearBars rows={rows} start={e.landing.p50} />
    </Insight>
  )
}

const CATS: { name: string; icon: string; share: number; color: string; merchants: [string, number][] }[] = [
  { name: 'საკვები', icon: '🛒', share: 0.42, color: '#1f3b57', merchants: [['ნიკორა', 0.45], ['ორი ნაბიჯი', 0.3], ['ფრესკო', 0.25]] },
  { name: 'მიწოდება და კაფე', icon: '🍕', share: 0.17, color: '#5aa9e6', merchants: [['Wolt', 0.55], ['Glovo', 0.3], ['კაფე', 0.15]] },
  { name: 'ტრანსპორტი', icon: '🚌', share: 0.13, color: '#7a5af8', merchants: [['Bolt', 0.6], ['მეტრო და ავტობუსი', 0.4]] },
  { name: 'აფთიაქი', icon: '💊', share: 0.06, color: '#ff7a59', merchants: [['PSP', 0.6], ['ავერსი', 0.4]] },
  { name: 'სხვა', icon: '🧺', share: 0.22, color: '#9fb4c7', merchants: [['ტანსაცმელი', 0.4], ['საჩუქრები', 0.3], ['ნაღდი ფული', 0.3]] },
]

function weekdayProfile(e: Engine) {
  const sp = e.p.spend
  const oneoff = sp.oneoffP * sp.oneoffMedian * Math.exp(sp.oneoffSigma ** 2 / 2)
  const wd = sp.weekdayMean + oneoff, we = sp.weekendMean + oneoff
  return ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'].map((d, i) => ({ d, v: (i >= 5 ? we : wd) * (1 + ((i * 7) % 5 - 2) * 0.03) }))
}

function Spend() {
  const v = useToday()
  const { e, p } = v
  const total = e.monthlyVarMedian
  const wk = weekdayProfile(e)
  const maxWk = Math.max(...wk.map(x => x.v))
  const weekendMore = Math.round(((wk[5].v + wk[6].v) / 2 / ((wk[0].v + wk[1].v + wk[2].v + wk[3].v + wk[4].v) / 5) - 1) * 100)
  const top = CATS[0]
  return (
    <>
      <Insight kicker="ყოველდღიური ხარჯი" title={<>ყველაზე მეტს <span style={{ color: 'var(--navy)' }}>{top.name.endsWith('ი') ? top.name.slice(0, -1) : top.name}ზე</span> ხარჯავ: ~{gel(Math.round((total * top.share) / 5) * 5)} თვეში</>} legend={<>
        <div>სულ ყოველდღიურ ხარჯზე თვეში დაახლოებით {gel(total)} მიდის.</div>
        {CATS.map(c => <div key={c.name}><b>{c.icon} {c.name}:</b> {c.merchants.map(([m, s]) => `${m} ${fmt(Math.round(total * c.share * s))} ₾`).join(' · ')}</div>)}
      </>}>
        <div style={{ display: 'grid', gap: 12 }}>
          {CATS.map((c, i) => (
            <div key={c.name}>
              <div className="between small"><span style={{ fontWeight: 700 }}>{c.icon} {c.name}</span><b>~{gel(Math.round((total * c.share) / 5) * 5)}</b></div>
              <div style={{ height: 10, borderRadius: 6, background: '#efe8dc', marginTop: 5, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(c.share / CATS[0].share) * 100}%` }} transition={{ delay: i * 0.08 }} style={{ height: '100%', background: c.color, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </Insight>
      <Insight kicker="კვირის დღეები" title={<>შაბათ-კვირას <span style={{ color: '#d9603f' }}>{weekendMore}%-ით მეტს</span> ხარჯავ</>} legend="ამიტომ პროგნოზი ყოველ დღეს ცალ-ცალკე ითვლის: შაბათი ოთხშაბათს არ ჰგავს.">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {wk.map((x, i) => (
            <div key={x.d} style={{ flex: 1, textAlign: 'center' }}>
              <div className="tiny" style={{ fontWeight: 800 }}>{Math.round(x.v)} ₾</div>
              <motion.div initial={{ height: 0 }} animate={{ height: (x.v / maxWk) * 82 }} transition={{ delay: i * 0.05 }} style={{ background: i >= 5 ? '#ff7a59' : '#5aa9e6', borderRadius: 8, marginTop: 3 }} />
              <div className="tiny muted" style={{ marginTop: 4 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </Insight>
      <Insight kicker="ფიქსირებული ხარჯი" title={<>ყოველთვე {gel(e.fixedTotal)} ავტომატურად მიდის</>} legend="ამ ჩამონათვალს ჯიხო შენი ამონაწერებიდან თავად პოულობს.">
        <div style={{ display: 'grid', gap: 2 }}>
          {p.fixed.map(f => (
            <div key={f.name} className="between" style={{ padding: '8px 0', borderBottom: '1px dashed #eee5d8' }}>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div><div className="tiny muted">ყოველი თვის {f.day} რიცხვში · {BANK_META[f.bank].label}</div></div>
              <b>{f.range ? '~' : ''}{gel(f.amount)}</b>
            </div>
          ))}
        </div>
      </Insight>
    </>
  )
}
