import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, CHECK_MAX } from '../state/store'
import { useToday } from '../engine/view'
import { Disclaimer, Sheet } from '../components/ui'
import { Morning } from '../components/day/Morning'
import { Evening } from '../components/day/Evening'
import { BeatCard, QuestsCard, beatNumbers } from '../components/day/Weekly'
import { useDayLocal } from '../components/day/local'
import { MicroLesson } from '../components/learn/MicroLesson'
import { Checkup, ScoreBar } from '../components/learn/Checkup'
import { MICRO } from '../content/learn'
import { TOPICS, TopicId } from '../content/lessons'
import type { ActionKind } from '../content/lessons'

type Seg = 'morning' | 'evening' | 'week'

const SHORT: Record<TopicId, string> = {
  M1: 'ხარჯის სახეები', M2: 'დღეები და ზღვარი', M3: 'სესხის ფასი', M4: 'განვადება და PTI', M5: 'დანაზოგი',
  M6: 'ზამთარი', M7: 'თაღლითობა', M8: 'ვალუტა', M9: 'შენი უფლებები',
}
const ORDER: TopicId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']

export function Day() {
  const v = useToday()
  const { p } = v
  const game = useStore(s => s.games[p.id])
  const demo = useStore(s => s.demos[p.id])
  const gameOff = useStore(s => s.gameOff)
  const setTab = useStore(s => s.setTab)
  const toast = useStore(s => s.toast)
  const localKey = `${p.id}:${demo.day}:${game.cycles}`
  const cash = useDayLocal(s => s.cash[localKey])

  const [seg, setSeg] = useState<Seg>(!game.morningDone ? 'morning' : !game.eveningDone ? 'evening' : 'week')
  const [focus, setFocus] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [topic, setTopic] = useState<TopicId | null>(null)

  const onAction = (k: ActionKind) => {
    if (k === 'chat') setTab('chat')
    else if (k === 'road') setTab('road')
    else if (k === 'analytics') setTab('analytics')
    else toast('📌', 'შენახულია ჯიხოს წიგნაკში')
  }
  const go = (s: Seg) => { setFocus(false); setSeg(s) }

  const SEGS: { id: Seg; label: string; done: boolean }[] = [
    { id: 'morning', label: 'დილის 3 კითხვა', done: game.morningDone },
    { id: 'evening', label: 'საღამო', done: game.eveningDone },
    { id: 'week', label: 'კვირის გამოწვევა', done: game.beatGuess !== null },
  ]
  const first = game.checks[0]
  const latest = game.checks.length > 1 ? game.checks[game.checks.length - 1] : null
  const mastered = ORDER.filter(t => (game.mastery[t] ?? 0) >= 80).length
  const todayLabel = p.dayLabels[demo.day] ?? p.paydayLabel

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="between">
          <div>
            <div className="h2" style={{ fontSize: 26 }}>სწავლა</div>
            <div className="small muted">დღეში 2 წუთი, შენივე რიცხვებით</div>
          </div>
          {!gameOff && (v.hardship ? (
            <span className="chip" style={{ background: '#e8f2fc', color: '#2c6aa0' }}>❄ სერია გაყინულია</span>
          ) : (
            <motion.span key={game.streak} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="chip" style={{ background: game.litToday ? '#fff1cc' : '#f2ede4' }}>
              🏮 {game.streak}{game.litToday ? ' · ანთია' : ''}
            </motion.span>
          ))}
        </div>

        {v.hardship && (
          <div style={{ background: '#eef2f7', borderRadius: 14, padding: '10px 12px', marginTop: 10, fontSize: 13.5, lineHeight: 1.45 }}>
            <b>მხარდაჭერის რეჟიმი.</b> სერია გაყინულია, ამიტომ არაფერს კარგავ. დილით პატარა ნაბიჯებით გავარკვევთ, რომელი გადასახადია პირველი და როგორ დაველაპარაკოთ ბანკს.
          </div>
        )}

        {/* knowledge score */}
        <div className="card" style={{ marginTop: 12, padding: 16, background: 'linear-gradient(135deg,#ffffff,#eef6ff)' }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="tiny" style={{ fontWeight: 800, color: 'var(--sky)' }}>ცოდნის ქულა</div>
              {latest ? (
                <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginTop: 2 }}>
                  {latest.score > first.score ? <>გაიზარდა: {first.score} → <span style={{ color: 'var(--good)' }}>{latest.score}</span> ({CHECK_MAX}-დან)</> : <>{latest.score}/{CHECK_MAX}</>}
                </div>
              ) : (
                <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginTop: 2 }}>პირველი შედეგი: {first.score}/{CHECK_MAX}. ახლა რამდენი იქნება?</div>
              )}
              <div className="small muted" style={{ marginTop: 4 }}>6 კითხვა: პროცენტი, ინფლაცია, რისკი, სესხის ფასი, PTI, თაღლითობა.</div>
            </div>
            <div className="row" style={{ gap: 6, alignItems: 'flex-end' }}>
              <MiniBar score={first.score} color="#9fb4c7" />
              {latest && <MiniBar score={latest.score} color="#58b368" />}
            </div>
          </div>
          <button className="pill-btn btn-sun" style={{ marginTop: 12 }} onClick={() => setCheckOpen(true)}>{latest ? 'ხელახლა შემოწმება · 2 წთ' : 'შეამოწმე ცოდნა · 2 წთ'}</button>
        </div>

        {/* today's lesson */}
        <div className="h3" style={{ marginTop: 18 }}>დღის გაკვეთილი</div>
        <div className="seg" style={{ marginTop: 8 }}>
          {SEGS.map(s => (
            <button key={s.id} className={seg === s.id ? 'on' : ''} onClick={() => go(s.id)} style={{ position: 'relative', fontSize: 12.5 }}>
              {s.label}
              {s.done && <span style={{ marginLeft: 4, color: 'var(--good)' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 12 }}>
        <AnimatePresence mode="wait">
          <motion.div key={seg + localKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {seg === 'morning' && <Morning localKey={localKey} onFocus={setFocus} onAction={onAction} goEvening={() => go('evening')} />}
            {seg === 'evening' && <Evening localKey={localKey} onFocus={setFocus} onAction={onAction} />}
            {seg === 'week' && <BeatCard />}
          </motion.div>
        </AnimatePresence>
      </div>

      {!focus && (
        <>
          {/* knowledge map */}
          <div className="pad" style={{ marginTop: 18 }}>
            <div className="between">
              <div className="h3">ცოდნის რუკა</div>
              <span className="tag">{mastered}/9 ათვისებული</span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>შეეხე თემას და გაიარე 30-წამიანი გაკვეთილი შენივე რიცხვებით.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
              {ORDER.map((t, i) => {
                const m = game.mastery[t] ?? 0
                return (
                  <motion.button key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.96 }} onClick={() => setTopic(t)}
                    className="card" style={{ padding: '12px 8px', textAlign: 'center', display: 'grid', gap: 6, justifyItems: 'center' }}>
                    <Ring value={m} icon={TOPICS[t].icon} />
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>{SHORT[t]}</div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* my rules */}
          <div className="pad" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="between"><div className="h3">ჩემი წესები</div><span className="tag">{game.rules.length}/9</span></div>
              {game.rules.length === 0 ? (
                <div className="small muted" style={{ marginTop: 6 }}>ყოველი 30-წამიანი გაკვეთილის შემდეგ აქ ერთი წესი გამოჩნდება.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {game.rules.map(t => (
                    <div key={t} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{TOPICS[t].icon}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.45 }}>{MICRO[t].rule}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* what we measure */}
          <div className="pad" style={{ marginTop: 12 }}>
            <div className="card" style={{ background: '#1f3b57', color: '#fff' }}>
              <div className="h3" style={{ color: '#fff' }}>რას ვზომავთ</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <Measure label="ცოდნა" value={latest ? `${first.score} → ${latest.score} / ${CHECK_MAX}` : `${first.score} / ${CHECK_MAX}`} note="ერთი და იგივე კითხვები — დასაწყისში და მოგვიანებით" />
                <Measure label="საკუთარი ხარჯის შეფასება" value={game.beatGuess !== null ? `${Math.abs(game.beatGuess - beatNumbers(v.e.medianDaily).actual)} ₾-ით ასცდი` : 'კვირის გამოწვევის შემდეგ'} note="რამდენად ზუსტად ხვდები, რამდენს დახარჯავ" />
                <Measure label="კარგი ჩასვლები" value={`${game.stones} / ${game.cycles} თვე`} note="თვეები, როცა ხელფასის დღეს უსაფრთხო ზღვარზე მეტი დაგრჩა" />
              </div>
              <div className="small" style={{ marginTop: 12, opacity: 0.85 }}>დასრულებულ გაკვეთილებს არ ვითვლით. ვითვლით, რა შეიცვალა.</div>
            </div>
          </div>
        </>
      )}

      {!gameOff && !focus && (
        <div className="pad" style={{ marginTop: 12 }}>
          <QuestsCard cashDone={!!cash || game.eveningDone} goMorning={() => go('morning')} goEvening={() => go('evening')} />
        </div>
      )}

      <div className="pad" style={{ marginTop: 10 }}>
        <Disclaimer>ეს ინფორმაციაა და არა რჩევა. რიცხვები შენი ისტორიიდან ითვლება.</Disclaimer>
      </div>
      <div style={{ height: 18 }} />

      <Sheet open={checkOpen} onClose={() => setCheckOpen(false)}>
        {checkOpen && <Checkup onClose={() => setCheckOpen(false)} todayLabel={todayLabel} />}
      </Sheet>
      <Sheet open={topic !== null} onClose={() => setTopic(null)}>
        {topic && (
          <>
            <div className="small muted" style={{ marginBottom: 8 }}>ათვისება: <b>{game.mastery[topic] ?? 0}%</b></div>
            <MicroLesson topic={topic} onDone={() => setTopic(null)} />
          </>
        )}
      </Sheet>
    </div>
  )
}

function MiniBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ width: 16, height: 56, background: '#e3ebf3', borderRadius: 6, display: 'flex', alignItems: 'flex-end' }}>
      <motion.div initial={{ height: 0 }} animate={{ height: `${(score / CHECK_MAX) * 100}%` }} transition={{ duration: 0.8 }} style={{ width: '100%', background: color, borderRadius: 6 }} />
    </div>
  )
}

function Ring({ value, icon }: { value: number; icon: string }) {
  const r = 22, c = 2 * Math.PI * r
  const col = value >= 80 ? '#58b368' : value >= 40 ? '#5aa9e6' : '#f0b429'
  return (
    <div style={{ position: 'relative', width: 54, height: 54 }}>
      <svg width="54" height="54" viewBox="0 0 54 54">
        <circle cx="27" cy="27" r={r} fill="none" stroke="#edf1f5" strokeWidth="5" />
        <motion.circle cx="27" cy="27" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" transform="rotate(-90 27 27)"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 0.9 }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20 }}>{value >= 80 ? '✓' : icon}</div>
    </div>
  )
}

function Measure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
      <div><div style={{ fontWeight: 800, fontSize: 14 }}>{label}</div><div className="tiny" style={{ opacity: 0.75 }}>{note}</div></div>
      <div style={{ fontWeight: 800, color: '#ffd977', whiteSpace: 'nowrap', fontSize: 14 }}>{value}</div>
    </div>
  )
}

export { ScoreBar }
