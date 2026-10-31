import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../state/store'
import { usePersona } from '../../engine/view'
import { Sheet } from '../ui'
import { PARTNERS, INTERESTS, EARN_RULES, Partner } from '../../content/partners'

const TERMS = 'ერთჯერადი · მოქმედებს 30 დღე · არ მოქმედებს სესხით, განვადებით, საკრედიტო ბარათით ან ოვერდრაფტით გადახდისას.'

/** points balance, interest-matched partner offers, coupons, how points are earned */
export function Points() {
  const p = usePersona()
  const g = useStore(s => s.games[p.id])
  const demo = useStore(s => s.demos[p.id])
  const toggleInterest = useStore(s => s.toggleInterest)
  const redeem = useStore(s => s.redeem)
  const [pick, setPick] = useState<Partner | null>(null)
  const [done, setDone] = useState<{ code: string; x: Partner } | null>(null)

  const points = g.points ?? 0
  const interests = g.interests ?? []
  // support mode: no pressure, only essentials and budget help
  const hardship = p.id === 'tamar'
  const list = hardship ? PARTNERS.filter(x => x.interest === 'health' || x.interest === 'save') : PARTNERS
  const sorted = [...list].sort((a, b) => Number(interests.includes(b.interest)) - Number(interests.includes(a.interest)) || a.cost - b.cost)
  const matched = sorted.filter(x => interests.includes(x.interest))
  const nextTarget = (matched.length ? matched : sorted).find(x => x.cost > points) ?? sorted.find(x => x.cost > points)
  const today = p.dayLabels[demo.day] ?? p.paydayLabel
  const iconOf = (x: Partner) => INTERESTS.find(i => i.id === x.interest)?.icon ?? '🎟️'
  const coupons = g.coupons ?? []

  return (
    <>
      {/* balance */}
      <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg,#1f3b57,#2c5478)', color: '#fff' }}>
        <div className="tiny" style={{ fontWeight: 800, color: '#ffd977', letterSpacing: 0.3 }}>შენი ქულები</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <motion.div key={points} initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{points}</motion.div>
          <div style={{ fontSize: 16, opacity: 0.85 }}>ქულა</div>
        </div>
        <div className="small" style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.45 }}>ქულებს იღებ კარგი ფინანსური ჩვევებისთვის და ცვლი ფასდაკლების კუპონზე.</div>
        {hardship ? (
          <div className="small" style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.45 }}>მხარდაჭერის რეჟიმში ქულები უბრალოდ ინახება და არ იწვება. გაჩვენებთ მხოლოდ აუცილებელ ხარჯს და ბიუჯეტის დახმარებას.</div>
        ) : nextTarget ? (
          <>
            <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>შემდეგი კუპონი: {nextTarget.name} ({nextTarget.badge}). აკლია <b style={{ color: '#ffd977' }}>{nextTarget.cost - points} ქულა</b></div>
            <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.2)', marginTop: 6, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (points / nextTarget.cost) * 100)}%` }} transition={{ duration: 0.8 }} style={{ height: '100%', background: '#ffd977', borderRadius: 6 }} />
            </div>
          </>
        ) : (
          <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>ყველა კუპონისთვის ქულა გყოფნის.</div>
        )}
        {!hardship && <div className="tiny" style={{ marginTop: 8, opacity: 0.8 }}>ქულებს ვადა არ აქვს.</div>}
      </div>

      {/* my coupons: right under the balance, so a new one is visible at once */}
      {coupons.length > 0 && (
        <div className="card">
          <div className="h3">ჩემი კუპონები</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {coupons.map(c => {
              const x = PARTNERS.find(pp => pp.id === c.partnerId)
              return (
                <motion.div key={c.code} initial={done?.code === c.code ? { scale: 0.8, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} className="between" style={{ padding: '10px 12px', borderRadius: 14, border: '2px dashed #e0c36a', background: '#fffaf0', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{x?.name} <span style={{ color: '#2f7a4c' }}>{x?.badge}</span></div>
                    <div className="tiny muted">აღებულია {c.at} · მოქმედებს 30 დღე</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, letterSpacing: 1, flexShrink: 0 }}>{c.code}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* interests */}
      <div className="card">
        <div className="h3">რა გაინტერესებს?</div>
        <div className="small muted" style={{ marginTop: 2, lineHeight: 1.45 }}>შეთავაზებებს ვალაგებთ მხოლოდ იმის მიხედვით, რასაც აქ მონიშნავ. შენს ხარჯებს ამისთვის არ ვუყურებთ.</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {INTERESTS.filter(i => !hardship || i.id === 'health' || i.id === 'save').map(i => {
            const on = interests.includes(i.id)
            return (
              <motion.button key={i.id} whileTap={{ scale: 0.94 }} onClick={() => toggleInterest(i.id)} aria-pressed={on} className="chip" style={{ background: on ? '#1f3b57' : '#f2ede4', color: on ? '#fff' : 'var(--ink)', padding: '8px 12px' }}>
                {on ? '✓ ' : ''}{i.icon} {i.label}
              </motion.button>
            )
          })}
        </div>
        {interests.length === 0 && <div className="small" style={{ marginTop: 8, color: 'var(--ink-2)', lineHeight: 1.45 }}>მონიშნე ერთი ან მეტი. მანამდე სია ფასით ლაგდება.</div>}
      </div>

      {/* offers */}
      <div className="card">
        <div className="between"><div className="h3">კუპონები</div><span className="tag">მაგალითი</span></div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {sorted.map(x => {
            const can = points >= x.cost
            const forYou = interests.includes(x.interest)
            return (
              <motion.div key={x.id} layout className="row" style={{ gap: 12, padding: 12, borderRadius: 16, background: forYou ? '#f4f9ff' : '#fbf8f2', border: forYou ? '1.5px solid #cfe3f6' : '1.5px solid transparent' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>{iconOf(x)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{x.name}</span>
                    <span className="chip" style={{ padding: '2px 8px', background: '#e3f4e8', color: '#2f7a4c', fontSize: 12 }}>{x.badge}</span>
                  </div>
                  <div className="small" style={{ marginTop: 2 }}>{x.offer}</div>
                  <div className="tiny muted">{x.cost} ქულა</div>
                </div>
                {can && (
                  <motion.button whileTap={{ scale: 0.94 }} onClick={() => setPick(x)} className="chip"
                    style={{ background: '#ffc94a', color: '#3b2a00', fontWeight: 800, padding: '8px 12px', flexShrink: 0 }}>აღება</motion.button>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* how to earn */}
      <div className="card">
        <div className="h3">რისთვის იღებ ქულას</div>
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {EARN_RULES.map(r => (
            <div key={r.label} className="between small" style={{ padding: '6px 0', borderBottom: '1px dashed #eee5d8', gap: 10 }}>
              <span>{r.label}</span><b style={{ color: 'var(--good)', flexShrink: 0 }}>{r.pts}</b>
            </div>
          ))}
        </div>
        <div className="small" style={{ marginTop: 12, background: '#fff7e0', borderRadius: 12, padding: '10px 12px', lineHeight: 1.5 }}>
          ქულას ვერ მიიღებ ხარჯვით, სესხით ან აპის გახსნით.
        </div>
        {(g.pointsLog ?? []).length > 0 && (
          <>
            <div className="tiny muted" style={{ marginTop: 12, fontWeight: 700 }}>ქულების ისტორია</div>
            {(g.pointsLog ?? []).slice(0, 5).map((l, i) => (
              <div key={i} className="between tiny" style={{ marginTop: 4, gap: 10 }}>
                <span>{l.label}</span><b style={{ color: l.pts > 0 ? 'var(--good)' : 'var(--ink-2)' }}>{l.pts > 0 ? '+' : ''}{l.pts}</b>
              </div>
            ))}
          </>
        )}
      </div>

      {/* confirm */}
      <Sheet open={pick !== null} onClose={() => setPick(null)}>
        {pick && (
          <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>{iconOf(pick)}</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>{pick.name}</div>
            <div style={{ fontSize: 16 }}>{pick.offer}</div>
            <div className="small muted">{pick.note}</div>
            <div className="card" style={{ background: '#f4f9ff', fontSize: 14, lineHeight: 1.5, textAlign: 'left' }}>
              ფასდაკლება ფულს მხოლოდ მაშინ გიზოგავს, თუ ამის ყიდვას ისედაც აპირებდი. თუ არა, ქულები შეინახე.
            </div>
            <div className="small">დაგრჩება <b>{points - pick.cost} ქულა</b></div>
            <div className="tiny muted" style={{ textAlign: 'left', lineHeight: 1.5 }}>პირობები: {TERMS}</div>
            <button className="pill-btn btn-sun" onClick={() => { const code = redeem(pick.id, today); if (code) setDone({ code, x: pick }); setPick(null) }}>კუპონის აღება · {pick.cost} ქულა</button>
            <button className="pill-btn btn-ghost" onClick={() => setPick(null)}>ჯერ არა</button>
          </div>
        )}
      </Sheet>

      {/* success: the code is shown right away, with how to use it */}
      <Sheet open={done !== null} onClose={() => setDone(null)}>
        {done && (
          <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>🎟️</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>კუპონი შენია!</div>
            <div>{done.x.name}: {done.x.offer}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 800, letterSpacing: 2, padding: 12, borderRadius: 14, border: '2px dashed #e0c36a', background: '#fffaf0' }}>{done.code}</div>
            <div className="small muted" style={{ lineHeight: 1.5 }}>გადახდისას კოდი პარტნიორს აჩვენე. მას „ჩემს კუპონებშიც“ იპოვი.</div>
            <button className="pill-btn btn-sun" onClick={() => setDone(null)}>კარგი</button>
          </div>
        )}
      </Sheet>
    </>
  )
}
