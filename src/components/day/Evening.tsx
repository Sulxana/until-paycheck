import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage } from '../../state/store'
import { useToday, fmt, gel } from '../../engine/view'
import { Jikho, JikhoMood } from '../Jikho'
import { eveningRecall, LessonCtx } from '../../content/lessons'
import { JikhoSays, Steps, QuizCard, OnLessonAction } from './parts'
import { useDayLocal } from './local'

/** დეტერმინისტული „დღევანდელი ხარჯი": მედიანური დღე × დღის კოეფიციენტი */
const DAY_FACTORS = [0.82, 1.18, 0.64, 1.07, 1.31, 0.93, 1.45]
export function todaySpend(medianDaily: number, day: number, seed: number) {
  return Math.round(medianDaily * DAY_FACTORS[(day + seed) % DAY_FACTORS.length])
}

const CASH_TAGS = [
  { id: 'food', label: '🛒 საკვები' },
  { id: 'transport', label: '🚌 ტრანსპორტი' },
  { id: 'other', label: '📦 სხვა' },
  { id: 'none', label: '💳 ნაღდი არ დამიხარჯავს' },
]

export function Evening({ onFocus, onAction, localKey }: { onFocus: (f: boolean) => void; onAction: OnLessonAction; localKey: string }) {
  const v = useToday()
  const { e, p } = v
  const game = useStore(s => s.games[p.id])
  const gameOff = useStore(s => s.gameOff)
  const reward = useStore(s => s.reward)
  const cash = useDayLocal(s => s.cash[localKey])
  const setCash = useDayLocal(s => s.setCash)
  const bolt = useDayLocal(s => s.bolt[localKey])
  const setBolt = useDayLocal(s => s.setBolt)
  const stage = evolutionStage(game)
  const acc = gameOff ? [] : game.equipped

  const spent = todaySpend(e.medianDaily, v.day, p.seed % 7)
  const usual = Math.round(e.avgDaily)
  const diff = spent - usual

  const recall = useMemo(() => {
    const ctx: LessonCtx = { e, p, landing: v.landing, daysLeft: v.daysLeft, nextBill: v.nextBill }
    return eveningRecall(ctx, game.lessonCursor, game.topics, v.hardship, game.morningDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, v.day, game.morningDone, game.lessonCursor, v.hardship])

  const [phase, setPhase] = useState<'steps' | 'done'>(game.eveningDone ? 'done' : 'steps')
  const [step, setStep] = useState(cash ? 1 : 0)
  const [recallOk, setRecallOk] = useState<boolean | null>(null)
  const boltConfirmed = game.confirmed.includes('Bolt')

  const mood: JikhoMood = step === 1 ? (recallOk === null ? 'thinking' : recallOk ? 'celebrate' : 'calm') : 'talking'
  const line =
    step === 0 ? 'ჩაწერე ერთი ნაღდი ხარჯი — პროგნოზი უფრო ზუსტი გახდება.'
      : step === 1 ? (recallOk === null ? (game.morningDone ? 'დილით ეს ვისწავლეთ. გახსოვს?' : 'ერთი გამეორება ადრე ნასწავლიდან.') : recallOk ? 'ყოჩაღ! 🎉' : 'ხვალ ისევ შეგახსენებ.')
        : 'ბოლო კითხვა: ახალი განმეორებადი ხარჯი შევნიშნე.'

  const tag = (id: string) => {
    setCash(localKey, id)
    onFocus(true)
    setTimeout(() => setStep(1), 450)
  }
  const confirmBolt = (yes: boolean) => {
    setBolt(localKey, yes ? 'yes' : 'no')
    reward('confirm', 'Bolt') // both answers sharpen the forecast, so both earn the same
  }
  const close = () => {
    if (!game.eveningDone) reward('evening')
    setPhase('done')
    onFocus(false)
  }

  // ---------------------------------------------------------------- done
  if (phase === 'done') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18 }} style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={{ textAlign: 'center', padding: '22px 16px 18px', background: 'linear-gradient(180deg,#26385a,#3d5680 55%,#5f7aa6)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {[...Array(12)].map((_, i) => (
            <span key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 23) % 45}%`, width: 3, height: 3, borderRadius: 2, background: '#fff', opacity: 0.7, animation: `glow ${2 + (i % 3)}s ease-in-out infinite` }} />
          ))}
          <div style={{ position: 'absolute', right: 22, top: 16, fontSize: 30 }}>🌙</div>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 12 }}>
            <Jikho size={120} mood="resting" stage={stage} accessories={acc} />
          </motion.div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>დღე დაიხურა</div>
          <div className="small" style={{ opacity: 0.85, marginTop: 4 }}>
            დღეს დახარჯე {gel(spent)} · ჩვეულებრივ ~{gel(usual)}{cash && cash !== 'none' ? ' · +1 ნაღდი ჩანაწერი' : ''}
          </div>
          <div className="small" style={{ opacity: 0.85, marginTop: 2 }}>ჯიხო ისვენებს. ხვალ დილით — ახალი ამინდი.</div>
        </div>
      </motion.div>
    )
  }

  // ---------------------------------------------------------------- steps
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 14, background: 'linear-gradient(150deg,#e7ecf6,#ffffff 70%)' }}>
        <div className="between">
          <span className="tag" style={{ background: '#fff' }}>დღის დახურვა · 40 წამი</span>
          <span className="tiny muted">არასავალდებულო · გამოგადგება, თუ ნაღდით იხდი</span>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>დღეს დახარჯე:</span>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>{gel(spent)}</span>
          <span className="small muted">· ჩვეულებრივ ~{gel(usual)}</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 2 }}>
          {diff === 0 ? 'ზუსტად ჩვეული დღე' : diff < 0 ? `ჩვეულზე ${fmt(-diff)} ₾-ით ნაკლები` : `ჩვეულზე ${fmt(diff)} ₾-ით მეტი`} · ბარათით გადახდებიდან
        </div>
      </div>

      <Steps n={3} at={step} done={step + (step === 1 && recallOk !== null ? 1 : step === 2 && (bolt || boltConfirmed) ? 1 : 0)} color="#5f7aa6" />
      <JikhoSays mood={mood} text={line} stage={stage} accessories={acc} size={56} />

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="cash" className="card" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <div className="tag" style={{ display: 'inline-block', marginBottom: 8 }}>ნაღდი ფული</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>ბანკომატიდან 50 ₾ გამოიტანე — რაზე დახარჯე?</div>
            <div className="small muted" style={{ marginTop: 2 }}>ნაღდ ხარჯს ბანკი ვერ ხედავს — ერთი შეხება საკმარისია.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {CASH_TAGS.map(t => {
                const on = cash === t.id
                return (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => tag(t.id)}
                    style={{ minHeight: 54, borderRadius: 16, fontWeight: 700, fontSize: 14, background: on ? '#e6f6ec' : '#fff', border: `2px solid ${on ? 'var(--good)' : 'transparent'}`, boxShadow: on ? 'none' : 'var(--shadow-sm)' }}
                  >
                    {on ? '✓ ' : ''}{t.label}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="recall" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <QuizCard
              item={recall}
              label={game.morningDone ? 'დილის კითხვა — გაიხსენე' : 'გამეორება'}
              onAnswer={ok => setRecallOk(ok)}
              onNext={() => setStep(2)}
              nextLabel="შემდეგი →"
              onAction={onAction}
            />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="bolt" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} style={{ display: 'grid', gap: 12 }}>
            <div className="card">
              <div className="tag" style={{ display: 'inline-block', marginBottom: 8, background: '#e9f3fc', color: '#2c6aa0' }}>ადრეული შემჩნევა</div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>ამ თვეში Bolt-ში 2-ჯერ გადაიხადე ~8 ₾. ეს ხარჯი ყოველთვე გექნება?</div>
              <div className="small muted" style={{ marginTop: 4 }}>შენი პასუხით პროგნოზი უფრო ზუსტი გახდება.</div>
              {boltConfirmed || bolt ? (
                <div className="small" style={{ marginTop: 12, fontWeight: 700, color: 'var(--good)' }}>
                  {bolt === 'no' ? '✓ ჩაიწერა: ერთჯერადი ხარჯია, პროგნოზს არ დაემატება.' : '✓ დადასტურდა: Bolt პროგნოზს ყოველთვიურ ხარჯად დაემატა.'}
                </div>
              ) : (
                <div className="row" style={{ marginTop: 12 }}>
                  <motion.button whileTap={{ scale: 0.95 }} className="pill-btn btn-primary" onClick={() => confirmBolt(true)}>კი</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} className="pill-btn btn-ghost" onClick={() => confirmBolt(false)}>არა</motion.button>
                </div>
              )}
            </div>
            {(boltConfirmed || bolt) && (
              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.97 }} className="pill-btn btn-primary" style={{ background: '#26385a' }} onClick={close}>
                დღის დახურვა
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
