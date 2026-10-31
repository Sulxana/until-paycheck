import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage, COSMETIC_POOL } from '../../state/store'
import { useToday, fmt } from '../../engine/view'
import { Jikho, JikhoMood } from '../Jikho'
import { WeatherChip, WCOLOR } from '../ui'
import { morningSet, ActionKind, TOPICS, LessonCtx } from '../../content/lessons'
import { JikhoSays, Steps, QuizCard, Confetti } from './parts'
import { useDayLocal } from './local'
import { MicroLesson } from '../learn/MicroLesson'

const r10 = (v: number) => Math.round(v / 10) * 10

const ASK_LINES = ['მოდი, ვნახოთ…', 'ეს საინტერესოა — შენ რას ფიქრობ?', 'ბოლო კითხვა — შენი რიცხვებით!']
const OK_LINES = ['ზუსტად!', 'ყოჩაღ! ეს ცოდნა ფულს ზოგავს.', 'ბრავო — შენი რიცხვები შენზე კარგად არავინ იცის!']
const SOFT_LINES = ['არაუშავს — ახლა უკვე იცი.', 'კარგი მცდელობა! წესი ქვემოთაა.', 'ესეც სწავლაა — მთავარი ის არის, რომ დაითვალე.']

export function Morning({ onFocus, onAction, goEvening, localKey }: { onFocus: (f: boolean) => void; onAction: (k: ActionKind) => void; goEvening: () => void; localKey: string }) {
  const v = useToday()
  const { e, p } = v
  const game = useStore(s => s.games[p.id])
  const gameOff = useStore(s => s.gameOff)
  const reward = useStore(s => s.reward)
  const choose = useStore(s => s.chooseCosmetic)
  const score = useDayLocal(s => s.score[localKey])
  const setScore = useDayLocal(s => s.setScore)
  const stage = evolutionStage(game)
  const acc = gameOff ? [] : game.equipped

  // დღევანდელი ნაკრები: დასრულების შემდეგ cursor უკვე +3-ზეა, ამიტომ უკან ვითვლით
  const base = game.morningDone ? Math.max(0, game.lessonCursor - 3) : game.lessonCursor
  // topics შეგნებულად არ არის deps-ში: დასრულებისას თემის „ასვლამ" დღევანდელი ნაკრები არ უნდა შეცვალოს
  const slots = useMemo(() => {
    const ctx: LessonCtx = { e, p, landing: v.landing, daysLeft: v.daysLeft, nextBill: v.nextBill }
    return morningSet(ctx, base, game.topics, v.hardship)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, p.id, v.day, v.extra, v.hardship])

  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>(game.morningDone ? 'done' : 'intro')
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<(boolean | null)[]>([null, null, null])
  const current = results[idx]
  const mood: JikhoMood = current === null ? 'talking' : current ? 'celebrate' : 'calm'
  const line = current === null ? ASK_LINES[idx] : current ? OK_LINES[idx] : SOFT_LINES[idx]

  const start = () => { setPhase('quiz'); setIdx(0); setResults([null, null, null]); setTaught(null); onFocus(true) }
  const learn = useStore(s => s.learn)
  const [taught, setTaught] = useState<number | null>(null)
  const answer = (ok: boolean) => { setResults(r => r.map((x, i) => (i === idx ? ok : x))); learn(slots[idx].item.topic, ok) }
  const next = () => {
    if (idx < 2) { setIdx(idx + 1); return }
    const n = results.filter(Boolean).length
    setScore(localKey, n)
    if (!game.morningDone) reward('lesson')
    setPhase('done')
    onFocus(false)
  }

  // ---------------------------------------------------------------- intro: 10-წამიანი ამინდი
  if (phase === 'intro') {
    const w = v.weather
    return (
      <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={{ padding: 18, background: `linear-gradient(150deg, ${WCOLOR[w]}26, #ffffff 70%)`, position: 'relative', overflow: 'hidden' }}>
          <div className="between">
            <span className="tag" style={{ background: '#fff' }}>დილის ამინდი · 10 წამი</span>
            <span className="tiny muted">{p.dayLabels[v.day] ?? p.paydayLabel}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35, marginTop: 10 }}>
            {v.daysLeft > 0 ? (
              <>ხელფასამდე {v.daysLeft} დღეა · სავარაუდოდ ~{fmt(r10(v.landing.p50))} ₾ დაგრჩება</>
            ) : (
              <>დღეს ხელფასის დღეა 🎉</>
            )}
          </div>
          {v.daysLeft > 0 && <div style={{ marginTop: 10 }}><WeatherChip w={w} p={v.landing.pBelow} /></div>}
          <div style={{ marginTop: 14 }}>
            <JikhoSays
              mood={v.hardship ? 'calm' : 'talking'}
              stage={stage}
              accessories={acc}
              text={v.hardship ? 'რთული პერიოდია. დღეს სამ პატარა ნაბიჯს გადავდგამთ — ერთად და აუჩქარებლად.' : 'სამი მოკლე კითხვა — ერთი გამეორება, ერთი ახალი და ერთი შენი რიცხვებით.'}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <span className="h3">დღის 3 კითხვა</span>
            <span className="chip">~2 წუთი</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {slots.map((s, i) => (
              <div key={i} className="row" style={{ background: '#faf6ee', borderRadius: 14, padding: '10px 12px' }}>
                <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{TOPICS[s.item.topic].icon}</span>
                <div style={{ flex: 1 }}>
                  <div className="tiny muted" style={{ fontWeight: 700 }}>{s.label}</div>
                  <div className="small" style={{ fontWeight: 700 }}>{TOPICS[s.item.topic].name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-sun" style={{ fontSize: 17, padding: '16px 18px' }} onClick={start}>
          დავიწყოთ →
        </motion.button>
      </motion.div>
    )
  }

  // ---------------------------------------------------------------- quiz
  if (phase === 'quiz') {
    const s = slots[idx]
    return (
      <div>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--paper)', padding: '4px 0 8px' }}>
          <Steps n={3} at={idx} done={idx + (current !== null ? 1 : 0)} />
        </div>
        <div style={{ margin: '6px 0 10px' }}>
          <JikhoSays mood={mood} text={line} stage={stage} accessories={acc} />
        </div>
        <AnimatePresence mode="wait">
          {s.slot === 'new' && taught !== idx ? (
            <motion.div key={'teach' + idx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="card" style={{ padding: 16 }}>
              <MicroLesson topic={s.item.topic} kicker="ჯერ ისწავლე · 30 წამი" doneLabel="ახლა სცადე →" onDone={() => setTaught(idx)} />
            </motion.div>
          ) : (
            <motion.div key={s.item.id + idx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', damping: 24, stiffness: 260 }}>
              <QuizCard item={s.item} label={s.label} onAnswer={answer} onNext={next} nextLabel={idx < 2 ? 'შემდეგი →' : 'დასრულება'} onAction={onAction} />
            </motion.div>
          )}
        </AnimatePresence>
        <button className="small muted" style={{ display: 'block', margin: '14px auto 0', fontWeight: 600 }} onClick={() => { setPhase('intro'); onFocus(false) }}>
          ← უკან ამინდზე
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------- done
  const topicsToday = Array.from(new Set(slots.map(s => s.item.topic)))
  return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18 }} style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '22px 16px 18px', background: 'linear-gradient(180deg,#ffe9a8,#fff8e6 60%,#ffffff)' }}>
        {score !== undefined && <Confetti />}
        <motion.div initial={{ scale: 0.4, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 9 }}>
          <Jikho size={130} mood="celebrate" stage={stage} accessories={acc} />
        </motion.div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>დილის გაკვეთილი დასრულდა!</div>
        <div className="small muted" style={{ marginTop: 2 }}>
          {score !== undefined ? `3-დან ${score} სწორი პასუხი · ${score === 3 ? 'იდეალური დილა' : 'ყოველი პასუხი სწავლაა'}` : 'დღევანდელი გაკვეთილი შესრულებულია'}
        </div>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {!gameOff && <motion.span initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="chip" style={{ background: '#fff' }}>📗 +1 წიგნი · სულ {game.books}</motion.span>}
          {!gameOff && (v.hardship ? (
            <motion.span initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="chip" style={{ background: '#e8f2fc', color: '#2c6aa0' }}>❄ სერია გაყინულია — არაფერი იკარგება</motion.span>
          ) : (
            <motion.span initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="chip" style={{ background: '#fff' }}>🏮 სერია {game.streak} დღე</motion.span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="h3" style={{ marginBottom: 8 }}>დღეს გაიარე</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {topicsToday.map(t => (
            <div key={t} className="row small" style={{ fontWeight: 600 }}>
              <span style={{ width: 24, textAlign: 'center' }}>{TOPICS[t].icon}</span>{TOPICS[t].name}
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>ნასწავლს 1, 3 და 7 დღის შემდეგ გავიმეორებთ — ასე უკეთ დაგამახსოვრდება.</div>
      </div>

      {!gameOff && game.pendingChoice && (
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ padding: 14 }}>
          <div className="h3">აირჩიე საჩუქარი ჯიხოსთვის</div>
          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            {game.pendingChoice.map(a => (
              <motion.button whileTap={{ scale: 0.92 }} key={a} onClick={() => choose(a)} style={{ textAlign: 'center', flex: 1 }}>
                <Jikho size={66} stage={stage} accessories={[a]} bob={false} />
                <div className="tiny" style={{ fontWeight: 700 }}>{COSMETIC_POOL.find(x => x.id === a)?.name}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {!game.eveningDone && (
        <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-white" onClick={goEvening}>
          საღამოს: ერთი კითხვა ამ თემიდან · 40 წამი
        </motion.button>
      )}
    </motion.div>
  )
}
