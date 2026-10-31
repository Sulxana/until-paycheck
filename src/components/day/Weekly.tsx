import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, evolutionStage } from '../../state/store'
import { useToday, gel } from '../../engine/view'
import { Jikho } from '../Jikho'
import { Progress, InfoTip } from '../ui'

/** ნინოს მედიანური დღე = 22,2 ₾ → კვირის საკვები: ჯიხო 62 ₾, ფაქტი 66 ₾. სხვებისთვის — პროპორციულად. */
const NINO_MEDIAN = 22.2
export function beatNumbers(medianDaily: number) {
  const k = medianDaily / NINO_MEDIAN
  return { engine: Math.round(62 * k), actual: Math.round(66 * k) }
}

export function BeatCard() {
  const v = useToday()
  const { e, p } = v
  const game = useStore(s => s.games[p.id])
  const gameOff = useStore(s => s.gameOff)
  const setBeatGuess = useStore(s => s.setBeatGuess)
  const reward = useStore(s => s.reward)
  const { engine, actual } = beatNumbers(e.medianDaily)
  const lo = Math.max(5, Math.round(engine * 0.4)), hi = Math.round(engine * 1.8)
  const [guess, setGuess] = useState<number>(game.beatGuess ?? Math.round(engine * 1.25))
  const revealed = game.beatGuess !== null
  const g = revealed ? game.beatGuess! : guess
  const dUser = Math.abs(g - actual), dEngine = Math.abs(engine - actual)
  const outcome: 'win' | 'tie' | 'lose' = dUser < dEngine ? 'win' : dUser === dEngine ? 'tie' : 'lose'
  const stage = evolutionStage(game)

  const resultText = (o: typeof outcome, du: number, de: number) =>
    o === 'win' ? `აჯობე პროგნოზს! შენი ვარაუდი ${du} ₾-ით ცდებოდა, ჯიხოსი — ${de} ₾-ით`
      : o === 'tie' ? `ფრე! ორივე ${du} ₾-ით ასცდა`
        : `ამჯერად ჯიხო უფრო ახლოს იყო: მისი ცდომილება ${de} ₾-ია, შენი — ${du} ₾`

  const check = () => {
    const du = Math.abs(guess - actual)
    const o = du < dEngine ? 'win' : du === dEngine ? 'tie' : 'lose'
    setBeatGuess(guess)
    reward('beat', resultText(o, du, dEngine))
  }

  const span = hi - lo
  const x = (n: number) => `${Math.min(100, Math.max(0, ((n - lo) / span) * 100))}%`

  return (
    <div className="card" data-info-root style={{ padding: 16, background: 'linear-gradient(150deg,#f1ecff,#ffffff 65%)', position: 'relative' }}>
      <div className="between">
        <span className="tag" style={{ background: '#fff', color: 'var(--violet)' }}>კვირის გამოწვევა</span>
        <span className="tiny muted">ერთხელ კვირაში</span>
      </div>
      <div className="between" style={{ marginTop: 8 }}>
        <div className="h2">აჯობე პროგნოზს</div>
        <InfoTip label="წესები">იგებს, ვისი ვარაუდიც უფრო ზუსტია. ნაკლები ხარჯვა აქ ქულას არ გაძლევს.</InfoTip>
      </div>
      <div className="small" style={{ marginTop: 4, lineHeight: 1.45 }}>
        რამდენს დახარჯავ ამ კვირაში <b>საკვებზე</b>? ჯიხოსაც აქვს ვარაუდი.
      </div>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <div className="tiny muted" style={{ fontWeight: 700 }}>შენი ვარაუდი</div>
        <motion.div key={g} initial={{ scale: 0.92 }} animate={{ scale: 1 }} style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, color: 'var(--violet)' }}>{gel(g)}</motion.div>
      </div>

      {!revealed ? (
        <>
          <input
            type="range"
            min={lo}
            max={hi}
            step={1}
            value={guess}
            onChange={ev => setGuess(Number(ev.target.value))}
            aria-label="შენი ვარაუდი ლარებში"
            style={{ width: '100%', accentColor: '#7a5af8', height: 28 }}
          />
          <div className="between tiny muted"><span>{gel(lo)}</span><span>ჯიხოს ვარაუდი დამალულია</span><span>{gel(hi)}</span></div>
          <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-primary" style={{ marginTop: 12, background: 'var(--violet)', boxShadow: '0 8px 18px rgba(122,90,248,0.3)' }} onClick={check}>
            შემოწმება
          </motion.button>
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 6 }}>დემო: კვირის რეალური ხარჯი ახლავე გამოჩნდება</div>
        </>
      ) : (
        <motion.div data-info-root initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative' }}>
          {/* სამი ზოლი საერთო ღერძზე: შენ · ჯიხო · ფაქტი */}
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {[
              { n: g, label: 'შენ', color: 'var(--violet)' },
              { n: engine, label: 'ჯიხო', color: 'var(--earth)' },
              { n: actual, label: 'ფაქტი', color: 'var(--good)' },
            ].map((m, i) => (
              <div key={m.label} className="row" style={{ gap: 8 }}>
                <span className="tiny" style={{ width: 40, fontWeight: 800, color: m.color }}>{m.label}</span>
                <div style={{ flex: 1, position: 'relative', height: 22 }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 2, borderRadius: 1, background: '#e6e0f5' }} />
                  <div style={{ position: 'absolute', left: x(actual), top: 0, bottom: 0, borderLeft: '2px dashed var(--good)', opacity: 0.45 }} />
                  <motion.div
                    initial={{ left: x(actual), opacity: 0 }}
                    animate={{ left: x(m.n), opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.2, type: 'spring', damping: 16 }}
                    style={{ position: 'absolute', top: 3, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: m.color, border: '3px solid #fff', boxShadow: 'var(--shadow-sm)' }}
                  />
                </div>
                <span className="tiny" style={{ width: 44, textAlign: 'right', fontWeight: 800 }}>{gel(m.n)}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10, background: outcome === 'win' ? '#e6f6ec' : '#f3f1fb', borderRadius: 14, padding: '10px 12px' }}>
            <Jikho size={48} mood={outcome === 'win' ? 'celebrate' : outcome === 'tie' ? 'happy' : 'calm'} stage={stage} accessories={gameOff ? [] : game.equipped} bob={false} />
            <div style={{ flex: 1 }}>
              <div className="h3" style={{ color: outcome === 'win' ? 'var(--good)' : 'var(--ink)' }}>{outcome === 'win' ? '🏆 შენ აჯობე!' : outcome === 'tie' ? '🤝 ფრე' : 'ამჯერად ჯიხომ აჯობა'}</div>
              <div className="small" style={{ lineHeight: 1.4 }}>
                შენ {gel(dUser)}-ით ასცდი, ჯიხო — {gel(dEngine)}-ით.
              </div>
            </div>
            <InfoTip>{outcome === 'win' ? 'შენ შენს კვირას უკეთ იცნობ — ესაა მიზანი.' : 'ყოველი ვარაუდი შენს „შინაგან პროგნოზს" ავარჯიშებს.'}</InfoTip>
          </div>
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>შემდეგი გამოწვევა — მომავალ კვირას</div>
        </motion.div>
      )}
    </div>
  )
}

export function QuestsCard({ cashDone, goMorning, goEvening }: { cashDone: boolean; goMorning: () => void; goEvening: () => void }) {
  const v = useToday()
  const game = useStore(s => s.games[v.p.id])
  const setTab = useStore(s => s.setTab)
  const checks = Math.min(3, game.checksToday)
  const quests = [
    { id: 'checks', icon: '🪵', title: 'სამი შემოწმება შესყიდვამდე', sub: 'მთავარზე: „რამის ყიდვა გინდა?"', value: checks, max: 3, done: checks >= 3, go: () => setTab('road') },
    { id: 'morning', icon: '☀️', title: 'დილის გაკვეთილი', sub: '3 კითხვა · ~2 წუთი', value: game.morningDone ? 1 : 0, max: 1, done: game.morningDone, go: goMorning },
    { id: 'evening', icon: '🌙', title: 'დღის დახურვა', sub: '40 წამი', value: game.eveningDone ? 1 : 0, max: 1, done: game.eveningDone, go: goEvening },
    { id: 'cash', icon: '💵', title: 'ერთი ნაღდი ხარჯის ჩაწერა', sub: 'დღის დახურვისას', value: cashDone ? 1 : 0, max: 1, done: cashDone, go: goEvening },
  ]
  const n = quests.filter(q => q.done).length
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <span className="h3">დღის დავალებები</span>
        <span className="chip" style={{ background: n === 4 ? '#e6f6ec' : undefined, color: n === 4 ? 'var(--good)' : undefined }}>{n}/4</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {quests.map(q => (
          <motion.button key={q.id} whileTap={{ scale: 0.98 }} onClick={q.go} className="row" style={{ width: '100%', textAlign: 'left', background: q.done ? '#f1f8f2' : '#faf6ee', borderRadius: 14, padding: '10px 12px' }}>
            <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{q.done ? '✅' : q.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="between">
                <span className="small" style={{ fontWeight: 700, textDecoration: q.done ? 'line-through' : 'none', color: q.done ? 'var(--ink-3)' : 'var(--ink)' }}>{q.title}</span>
                {q.max > 1 && <span className="tiny muted" style={{ fontWeight: 700 }}>{q.value}/{q.max}</span>}
              </div>
              {q.max > 1 ? <div style={{ marginTop: 5 }}><Progress value={q.value} max={q.max} /></div> : <div className="tiny muted">{q.sub}</div>}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
