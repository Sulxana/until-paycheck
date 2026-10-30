import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, evolutionStage, COSMETIC_POOL } from '../state/store'
import { usePersona } from '../engine/view'
import { Jikho, STAGE_NAMES } from '../components/Jikho'
import { Sheet, Progress } from '../components/ui'
import { RED_LINES } from './Home'
import type { PlaceId } from '../components/village/Places'
import { VillageScene } from '../components/village/VillageScene'
import { PlaceSheet, YearMap, Wardrobe, stageProgress, jikhoTips } from '../components/village/VillageSections'

const enter = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 + i * 0.07, duration: 0.35, ease: 'easeOut' as const },
})

export function Village() {
  const game = useStore(s => s.games[s.personaId])
  const gameOff = useStore(s => s.gameOff)
  const setGameOff = useStore(s => s.setGameOff)
  const toggleEquip = useStore(s => s.toggleEquip)
  const p = usePersona()
  const [place, setPlace] = useState<PlaceId | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  const stage = evolutionStage(game)

  if (gameOff) {
    return (
      <div className="screen pad" style={{ background: 'var(--paper)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 300 }}>
          <Jikho size={120} mood="resting" stage={stage} />
          <div className="h2" style={{ marginTop: 8 }}>თამაში გამორთულია</div>
          <div className="small muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
            სოფელი შენახულია და არაფერი იკარგება. პროგნოზი, შემოწმება და გაკვეთილები ჩვეულებრივ მუშაობს.
          </div>
          <button className="pill-btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setGameOff(false)}>თამაშის ჩართვა</button>
        </div>
      </div>
    )
  }

  const hardship = p.id === 'tamar'
  const sp = stageProgress(game)
  const cycles = Math.min(12, game.cycles)
  const ownedCount = game.cosmetics.length
  const lockedCount = COSMETIC_POOL.filter(c => !game.cosmetics.includes(c.id)).length

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      {/* hardship banner */}
      {hardship && (
        <motion.div className="pad" style={{ paddingTop: 14 }} {...enter(0)}>
          <div style={{ background: '#eef2f7', borderRadius: 14, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>
            ❄️ <b style={{ color: 'var(--ink)' }}>გაჭირვების რეჟიმი:</b> სოფელი გაყინულია — არაფერი ინგრევა, არაფერი იკარგება.
          </div>
        </motion.div>
      )}

      {/* header */}
      <motion.div className="pad" style={{ paddingTop: hardship ? 12 : 18 }} {...enter(0)}>
        <div className="between">
          <div className="h2" style={{ fontSize: 22 }}>ჯიხოს სოფელი</div>
          <span className="chip" style={{ background: '#fff4dc', color: '#7a4f00' }} title="სერია და გაყინვები">{hardship ? '❄ სერია გაყინულია' : `🏮 ${game.streak} დღე · ❄ ${game.freezes}`}</span>
        </div>
        <div className="card" style={{ marginTop: 10, padding: '10px 12px' }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="chip" style={{ background: 'var(--navy)', color: '#fff', padding: '3px 10px 3px 3px' }}>
              <span style={{ width: 26, height: 26, borderRadius: 13, background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                <Jikho size={26} stage={stage} bob={false} />
              </span>
              {STAGE_NAMES[stage]}
            </span>
            <span className="small muted" style={{ flex: 1, lineHeight: 1.3, fontWeight: 600 }}>{sp.text}</span>
          </div>
          <div style={{ marginTop: 9 }}><Progress value={sp.value} max={sp.max} color="var(--sun-2)" /></div>
        </div>
      </motion.div>

      {/* the village */}
      <motion.div style={{ marginTop: 12 }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.1 }}>
        <VillageScene game={game} stage={stage} hardship={hardship} tips={jikhoTips(game, hardship)} onOpen={setPlace} />
      </motion.div>
      <div className="tiny muted" style={{ textAlign: 'center', marginTop: 6 }}>👆 შეეხე ადგილს — გაიგებ, რა ზრდის მას</div>

      {/* year map */}
      <motion.div className="pad" style={{ marginTop: 16 }} {...enter(2)}>
        <div className="card">
          <div className="between">
            <div className="h3">🗺️ წლის რუკა</div>
            <span className="tag">{cycles}/12</span>
          </div>
          <div className="small muted" style={{ marginTop: 4, marginBottom: 14, lineHeight: 1.45 }}>
            ყოველი დასრულებული ხელფასის ციკლი საქართველოს რუკაზე ერთ ადგილს ხსნის.
          </div>
          <YearMap cycles={game.cycles} />
        </div>
      </motion.div>

      {/* wardrobe */}
      <motion.div className="pad" style={{ marginTop: 12 }} {...enter(3)}>
        <div className="card">
          <div className="between">
            <div className="h3">🎒 ჯიხოს ნივთები</div>
            <span className="tag">აცვია {game.equipped.length}/2</span>
          </div>
          <div className="small muted" style={{ marginTop: 4, marginBottom: 12 }}>
            შეეხე — ჩააცვი ან გახადე. ერთად მაქსიმუმ 2 ნივთი. გაქვს {ownedCount}/{COSMETIC_POOL.length}.
          </div>
          <Wardrobe game={game} stage={stage} onToggle={toggleEquip} />
          {lockedCount > 0 && (
            <div className="small" style={{ marginTop: 12, background: '#f7f3ec', borderRadius: 12, padding: '8px 10px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
              🔒 დახურულ ნივთებს იღებ კვესტით ან კვირის დასკვნით. <b>ფულით არაფერი იყიდება.</b>
            </div>
          )}
        </div>
      </motion.div>

      {/* fair play */}
      <motion.div className="pad" style={{ margin: '12px 0 24px' }} {...enter(4)}>
        <motion.button whileTap={{ scale: 0.98 }} className="card" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }} onClick={() => setRulesOpen(true)}>
          <div style={{ fontSize: 28 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <div className="h3">სამართლიანი თამაში</div>
            <div className="small muted">სოფლის {RED_LINES.length} წესი — რას არასდროს ვაკეთებთ</div>
          </div>
          <div className="muted">›</div>
        </motion.button>
      </motion.div>

      <PlaceSheet place={place} game={game} onClose={() => setPlace(null)} />
      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 220 }} style={{ textAlign: 'center', fontSize: 44 }}>🛡️</motion.div>
        <div className="h2" style={{ textAlign: 'center', marginTop: 4 }}>სამართლიანი თამაშის {RED_LINES.length} წესი</div>
        <div className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>სოფელი მხოლოდ კარგი ფინანსური ქცევით იზრდება.</div>
        <div className="card" style={{ marginTop: 12 }}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.55 }}>
            {RED_LINES.map((l, i) => (
              <motion.li key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }} style={{ marginBottom: 4 }}>{l}</motion.li>
            ))}
          </ol>
        </div>
        <button className="pill-btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setRulesOpen(false)}>გასაგებია</button>
      </Sheet>
    </div>
  )
}
