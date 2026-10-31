import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage, COSMETIC_POOL } from '../state/store'
import { usePersona } from '../engine/view'
import { Jikho } from '../components/Jikho'
import { Sheet, InfoTip } from '../components/ui'
import { RED_LINES, RED_LINES_SHOWN, StreakSheet } from './Home'
import type { PlaceId } from '../components/village/Places'
import { VillageScene } from '../components/village/VillageScene'
import { PlaceSheet, YearMap, Wardrobe, jikhoTips } from '../components/village/VillageSections'

const enter = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 + i * 0.07, duration: 0.35, ease: 'easeOut' as const },
})

/** said once, on the fair-play card */
const FAIR_LINE = 'სოფელს ზრდის ქცევა — არა ხარჯი, სესხი ან ბალანსი.'

export function Village() {
  const game = useStore(s => s.games[s.personaId])
  const gameOff = useStore(s => s.gameOff)
  const setGameOff = useStore(s => s.setGameOff)
  const toggleEquip = useStore(s => s.toggleEquip)
  const p = usePersona()
  const [place, setPlace] = useState<PlaceId | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [allRules, setAllRules] = useState(false)
  const [freezeInfo, setFreezeInfo] = useState(false)

  const stage = evolutionStage(game)

  if (gameOff) {
    return (
      <div className="screen pad" style={{ background: 'var(--paper)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 300 }}>
          <Jikho size={120} mood="resting" stage={stage} />
          <div className="h2" style={{ marginTop: 8 }}>თამაში გამორთულია</div>
          <div className="small muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
            სოფელი შენახულია. დანარჩენი ყველაფერი ჩვეულებრივ მუშაობს.
          </div>
          <button className="pill-btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setGameOff(false)}>თამაშის ჩართვა</button>
        </div>
      </div>
    )
  }

  const hardship = p.id === 'tamar'
  const cycles = Math.min(12, game.cycles)
  const lockedCount = COSMETIC_POOL.filter(c => !game.cosmetics.includes(c.id)).length

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      {/* support mode: one calm banner, no countdowns anywhere */}
      {hardship && (
        <motion.div className="pad" style={{ paddingTop: 14 }} {...enter(0)}>
          <div style={{ background: '#eef2f7', borderRadius: 14, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>
            ❄️ სოფელი ისვენებს — ყველაფერი შენახულია.
          </div>
        </motion.div>
      )}

      {/* header */}
      <motion.div className="pad" style={{ paddingTop: hardship ? 12 : 18 }} {...enter(0)}>
        <div className="between">
          <div className="h2" style={{ fontSize: 22 }}>ჯიხოს სოფელი</div>
          {!hardship && (
            <button className="chip" style={{ background: '#fff4dc', color: '#7a4f00' }} onClick={() => setFreezeInfo(true)} aria-label="სერია">
              🏮 {game.streak} დღე
            </button>
          )}
        </div>
        <StreakSheet open={freezeInfo} onClose={() => setFreezeInfo(false)} />
      </motion.div>

      {/* the village */}
      <motion.div style={{ marginTop: 12 }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.1 }}>
        <VillageScene game={game} stage={stage} hardship={hardship} tips={jikhoTips(game, hardship)} onOpen={setPlace} />
      </motion.div>
      <div className="tiny muted" style={{ textAlign: 'center', marginTop: 6 }}>შეეხე ადგილს ან ჯიხოს</div>

      {/* year map */}
      <motion.div className="pad" style={{ marginTop: 16 }} {...enter(2)}>
        <div className="card" data-info-root style={{ position: 'relative' }}>
          <div className="between" style={{ marginBottom: 14 }}>
            <div className="h3">წლის რუკა</div>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="tag">{cycles}/12</span>
              <InfoTip>ყოველი გავლილი თვე რუკაზე ახალ ადგილს ხსნის.</InfoTip>
            </div>
          </div>
          <YearMap cycles={game.cycles} />
        </div>
      </motion.div>

      {/* wardrobe */}
      <motion.div className="pad" style={{ marginTop: 12 }} {...enter(3)}>
        <div className="card" data-info-root style={{ position: 'relative' }}>
          <div className="between">
            <div className="h3">ჯიხოს ნივთები</div>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="tag">აცვია {game.equipped.length}/2</span>
              {lockedCount > 0 && (
                <InfoTip label="როგორ მივიღო ახალი ნივთი?">
                  <span>ახალი ნივთი — უსაფრთხო ხელფასის დღისთვის და გაკვეთილებისთვის.</span>
                  <b style={{ color: 'var(--ink)' }}>ფულით არაფერი იყიდება.</b>
                </InfoTip>
              )}
            </div>
          </div>
          <div className="small muted" style={{ marginTop: 4, marginBottom: 12 }}>შეეხე — ჩააცვი ან გახადე.</div>
          <Wardrobe game={game} stage={stage} onToggle={toggleEquip} />
        </div>
      </motion.div>

      {/* fair play */}
      <motion.div className="pad" style={{ margin: '12px 0 24px' }} {...enter(4)}>
        <motion.button whileTap={{ scale: 0.98 }} className="card" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }} onClick={() => setRulesOpen(true)}>
          <div style={{ fontSize: 28 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <div className="h3">სამართლიანი თამაში</div>
            <div className="small muted">{FAIR_LINE}</div>
          </div>
          <div className="muted">›</div>
        </motion.button>
      </motion.div>

      <PlaceSheet place={place} game={game} calm={hardship} onClose={() => setPlace(null)} />
      <Sheet open={rulesOpen} onClose={() => { setRulesOpen(false); setAllRules(false) }}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 220 }} style={{ textAlign: 'center', fontSize: 44 }}>🛡️</motion.div>
        <div className="h2" style={{ textAlign: 'center', marginTop: 4 }}>სამართლიანი თამაში</div>
        <div className="card" style={{ marginTop: 12 }}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.55 }}>
            {(allRules ? RED_LINES : RED_LINES.slice(0, RED_LINES_SHOWN)).map((l, i) => (
              <motion.li key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }} style={{ marginBottom: 4 }}>{l}</motion.li>
            ))}
          </ol>
          <button className="small" style={{ marginTop: 6, color: 'var(--sky)', fontWeight: 800 }} onClick={() => setAllRules(v => !v)} aria-expanded={allRules}>
            {allRules ? 'ნაკლები ‹' : `ყველა წესი (${RED_LINES.length}) ›`}
          </button>
        </div>
        <button className="pill-btn btn-ghost" style={{ marginTop: 12 }} onClick={() => { setRulesOpen(false); setAllRules(false) }}>გასაგებია</button>
      </Sheet>
    </div>
  )
}
