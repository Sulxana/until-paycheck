import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { PERSONAS, Persona } from '../engine/personas'
import type { Accessory } from '../components/Jikho'
import type { TopicId } from '../content/lessons'
import { PARTNERS, type Interest } from '../content/partners'

export type Tab = 'road' | 'analytics' | 'chat' | 'village' | 'day'
export type PersonaId = Persona['id']

export interface Qvevri { name: string; target: number; filled: number; sealedAt?: string }
export interface Game {
  stones: number; cycles: number; planks: number; checksToday: number; books: number; topics: number
  station: number; stationXp: number; qvevri: Qvevri[]; streak: number; freezes: number; litToday: boolean
  morningDone: boolean; eveningDone: boolean; cosmetics: Accessory[]; equipped: Accessory[]; pendingChoice: Accessory[] | null
  confirmed: string[]; beatGuess: number | null; questsDone: string[]; lessonCursor: number; landmarksSeen: number
  /** topic mastery 0–100 */
  mastery: Record<TopicId, number>
  /** knowledge check history (score out of CHECK_MAX); first entry is the starting point */
  checks: { label: string; score: number }[]
  /** rules collected from micro-lessons ("ჩემი წესები") */
  rules: TopicId[]
  /** points earned only by good actions; spent on partner coupons */
  points: number
  pointsLog: { label: string; pts: number }[]
  coupons: { partnerId: string; code: string; at: string }[]
  interests: Interest[]
  checkupToday: boolean
  /** the payday savings decision was already made this cycle */
  pledged: boolean
}
export const CHECK_MAX = 6
/** streak milestone: every STREAK_GOAL days in a row of morning lessons earns STREAK_BONUS points */
export const STREAK_GOAL = 15
export const STREAK_BONUS = 20
const MASTERY: Record<PersonaId, Record<TopicId, number>> = {
  nino: { M1: 70, M2: 55, M3: 30, M4: 20, M5: 45, M6: 25, M7: 60, M8: 10, M9: 15 },
  luka: { M1: 35, M2: 25, M3: 15, M4: 10, M5: 30, M6: 10, M7: 40, M8: 5, M9: 5 },
  tamar: { M1: 65, M2: 40, M3: 35, M4: 30, M5: 20, M6: 35, M7: 55, M8: 15, M9: 25 },
}
const FIRST_CHECK: Record<PersonaId, { label: string; score: number }> = {
  nino: { label: '2 ოქტ', score: 3 },
  luka: { label: '15 ოქტ', score: 2 },
  tamar: { label: '5 ოქტ', score: 3 },
}
export interface Demo { day: number; extra: number; ceremony: null | { landing: number; safe: boolean; cushion: number; pts?: number }; finished: boolean }
export interface ChatCard { kind: 'purchase' | 'installment' | 'forecast' | 'concept' | 'safe' | 'compare'; data: any }
export interface ChatMsg { id: string; from: 'jikho' | 'user'; text: string; card?: ChatCard; chips?: string[] }
export interface Toast { id: number; icon: string; text: string }

export const LANDMARKS = [
  { name: 'მცხეთა', icon: '⛪' }, { name: 'უფლისციხე', icon: '🪨' }, { name: 'ანანური', icon: '🏰' }, { name: 'გერგეთი', icon: '🏔' },
  { name: 'ვარძია', icon: '🕳' }, { name: 'სიღნაღი', icon: '🍇' }, { name: 'უშგული', icon: '🗼' }, { name: 'ბათუმი', icon: '🌊' },
  { name: 'ოკაცე', icon: '🌉' }, { name: 'თუშეთი', icon: '🐑' }, { name: 'მარტვილი', icon: '💧' }, { name: 'გუდაური', icon: '❄' },
]
export const COSMETIC_POOL: { id: Accessory; name: string }[] = [
  { id: 'scarf', name: 'წითელი შარფი' }, { id: 'svanHat', name: 'სვანური ქუდი' }, { id: 'lantern', name: 'ფარანი' }, { id: 'nabadi', name: 'ნაბადი' },
  { id: 'flowers', name: 'ყვავილების გვირგვინი' }, { id: 'bell', name: 'ზანზალაკი' }, { id: 'umbrella', name: 'ქოლგა' }, { id: 'backpack', name: 'ზურგჩანთა' },
]

function initialGame(p: Persona): Game {
  const g = p.game
  return {
    stones: g.landings, cycles: g.cycles, planks: g.planks, checksToday: 0, books: g.topics * 6 + 3, topics: g.topics,
    station: g.station, stationXp: 1,
    qvevri: p.savings ? [{ name: p.savings.name, target: p.savings.target, filled: p.savings.amount }] : [],
    streak: g.streak, freezes: g.freezes, litToday: false, morningDone: false, eveningDone: false,
    cosmetics: p.id === 'nino' ? ['scarf', 'backpack', 'umbrella'] : ['backpack'], equipped: p.id === 'nino' ? ['scarf'] : [],
    pendingChoice: null, confirmed: [], beatGuess: null, questsDone: [], lessonCursor: 0, landmarksSeen: g.cycles,
    mastery: { ...MASTERY[p.id] }, checks: [FIRST_CHECK[p.id]], rules: p.id === 'nino' ? ['M1', 'M7'] : [],
    points: { nino: 24, luka: 18, tamar: 26 }[p.id], pointsLog: [], coupons: [],
    // interests start empty: only the user picks them, never inferred from spending
    interests: [], checkupToday: false, pledged: false,
  }
}
const initialDemo = (): Demo => ({ day: 0, extra: 0, ceremony: null, finished: false })

export function evolutionStage(g: Game): 0 | 1 | 2 | 3 {
  const sealed = g.qvevri.some(q => q.sealedAt)
  if (g.stones >= 12) return 3
  if (g.stones >= 6 && g.topics >= 3) return 2
  if (g.stones >= 3 || sealed) return 1
  return 0
}

interface Store {
  personaId: PersonaId
  tab: Tab
  analyticsSeg: 'payday' | 'spend' | 'points'
  setAnalyticsSeg: (s: 'payday' | 'spend' | 'points') => void
  games: Record<PersonaId, Game>
  demos: Record<PersonaId, Demo>
  chats: Record<PersonaId, ChatMsg[]>
  toasts: Toast[]
  gameOff: boolean
  setPersona: (id: PersonaId) => void
  setTab: (t: Tab) => void
  toast: (icon: string, text: string) => void
  dropToast: (id: number) => void
  reward: (kind: 'check' | 'lesson' | 'confirm' | 'save' | 'evening' | 'beat', payload?: any) => void
  advanceDay: (nDays: number, landingFn: (day: number, extra: number) => { landing: number; cushion: number }) => void
  buy: (amount: number) => void
  closeCeremony: () => void
  chooseCosmetic: (a: Accessory) => void
  toggleEquip: (a: Accessory) => void
  setBeatGuess: (v: number) => void
  pushChat: (m: ChatMsg) => void
  resetAll: () => void
  resetDemo: () => void
  setGameOff: (v: boolean) => void
  /** an answered lesson item: correct answers grow mastery more, wrong ones still teach a little */
  learn: (topic: TopicId, correct: boolean) => void
  /** a finished 30-second micro-lesson: adds its rule to "ჩემი წესები" */
  microDone: (topic: TopicId) => void
  /** a finished knowledge check */
  checkupDone: (score: number, label: string) => void
  /** exchange a partner's point price for its coupon */
  redeem: (partnerId: string, dateLabel: string) => string | null
  toggleInterest: (i: Interest) => void
}

const ids = PERSONAS.map(p => p.id)
const byId = <T,>(f: (p: Persona) => T) => Object.fromEntries(PERSONAS.map(p => [p.id, f(p)])) as Record<PersonaId, T>
let toastSeq = 1

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const patchGame = (fn: (g: Game) => Partial<Game>) => {
        const id = get().personaId
        const g = get().games[id]
        set({ games: { ...get().games, [id]: { ...g, ...fn(g) } } })
      }
      const earn = (pts: number, label: string) => {
        if (get().gameOff) return '' // game off: no points layer at all
        patchGame(gg => ({ points: (gg.points ?? 0) + pts, pointsLog: [{ label, pts }, ...(gg.pointsLog ?? [])].slice(0, 30) }))
        return ` · +${pts} ქულა`
      }
      const lightStreak = () => {
        const g = get().games[get().personaId]
        if (g.litToday) return null
        if (get().personaId === 'tamar') { patchGame(() => ({ litToday: true })); return null } // hardship: streak frozen, nothing lost
        patchGame(gg => ({ litToday: true, streak: gg.streak + 1 }))
        const n = g.streak + 1
        if (n % STREAK_GOAL === 0) {
          const pt = earn(STREAK_BONUS, `სერია: ${n} დღე ზედიზედ`)
          if (pt) setTimeout(() => get().toast('🏮', `${n} დღე ზედიზედ!${pt}`), 900)
        }
        return n
      }
      return {
        personaId: 'nino',
        tab: 'road',
        analyticsSeg: 'payday',
        setAnalyticsSeg: seg => set({ analyticsSeg: seg }),
        games: byId(initialGame),
        demos: byId(initialDemo),
        chats: byId(() => []),
        toasts: [],
        gameOff: false,
        setPersona: id => set({ personaId: id }),
        setTab: t => set({ tab: t }),
        toast: (icon, text) => {
          const id = toastSeq++
          set({ toasts: [...get().toasts, { id, icon, text }].slice(-3) })
          setTimeout(() => get().dropToast(id), 2600)
        },
        dropToast: id => set({ toasts: get().toasts.filter(t => t.id !== id) }),
        reward: (kind, payload) => {
          const g = get().games[get().personaId]
          const off = get().gameOff
          if (kind === 'check') {
            if (g.checksToday >= 3) { if (!off) get().toast('🪵', 'დღეს ხიდზე 3 ფიცარი უკვე დადე — ხვალ გააგრძელე'); return }
            patchGame(gg => ({ planks: gg.planks + 1, checksToday: gg.checksToday + 1 }))
            const pt = earn(3, 'შემოწმება ყიდვამდე')
            if (!off) get().toast('🪵', `+1 ფიცარი ხიდზე${pt}`)
            if (g.checksToday + 1 === 3 && !g.questsDone.includes('three-checks')) {
              patchGame(gg => ({ questsDone: [...gg.questsDone, 'three-checks'] }))
              setTimeout(() => get().toast('🏅', 'დავალება შესრულდა: „სამი შემოწმება შესყიდვამდე"'), 700)
            }
          } else if (kind === 'lesson') {
            const books = g.books + 1
            const topicUp = books % 6 === 0
            patchGame(gg => ({ books, topics: topicUp ? gg.topics + 1 : gg.topics, morningDone: true, lessonCursor: gg.lessonCursor + 3 }))
            const s = lightStreak()
            const pt = earn(10, 'დილის 3 კითხვა')
            if (!off) get().toast('📗', `+1 წიგნი სკოლაში${s ? ` · სერია ${s} დღე` : ''}${pt}`)
            if (topicUp && !off) setTimeout(() => get().toast('🏫', 'სკოლაში ახალი ოთახი: თემა ათვისებულია'), 800)
            if (!g.pendingChoice && !off) {
              const pool = COSMETIC_POOL.map(c => c.id).filter(c => !g.cosmetics.includes(c))
              if (pool.length) patchGame(() => ({ pendingChoice: pool.slice(0, 3) }))
            }
          } else if (kind === 'confirm') {
            if (g.confirmed.includes(payload)) return
            const xp = g.stationXp + 1
            const up = xp >= 3 && g.station < 5
            patchGame(gg => ({ confirmed: [...gg.confirmed, payload], stationXp: up ? 0 : xp, station: up ? gg.station + 1 : gg.station }))
            const pt = earn(2, `პროგნოზის დაზუსტება: ${payload}`)
            if (!off) get().toast('📡', up ? `ამინდის სადგური ${g.station + 1}/5 — პროგნოზი უფრო ზუსტი ხდება${pt}` : `დადასტურდა: ${payload}${pt}`)
          } else if (kind === 'save') {
            if (g.pledged) return
            const amount = payload as number
            patchGame(gg => {
              const q = gg.qvevri.map((x, i) => (i === 0 ? { ...x, filled: Math.min(x.target, x.filled + amount), sealedAt: x.filled + amount >= x.target ? 'ნოემბერი 2026' : x.sealedAt } : x))
              return { qvevri: q, pledged: true }
            })
            const q0 = get().games[get().personaId].qvevri[0]
            const pt = earn(10, 'დანაზოგის გადადება')
            if (!off && q0) get().toast('🏺', q0.sealedAt ? `ქვევრი „${q0.name}" დაილუქა!${pt}` : `+${amount} ₾ ქვევრში „${q0.name}"${pt}`)
          } else if (kind === 'evening') {
            patchGame(() => ({ eveningDone: true }))
            const pt = earn(5, 'დღის დახურვა')
            if (!off) get().toast('🌙', `დღე დაიხურა${pt}`)
          } else if (kind === 'beat') {
            const pt = earn(5, 'კვირის გამოწვევა')
            if (!off) get().toast('🎯', `${payload}${pt}`)
          }
        },
        advanceDay: (nDays, landingFn) => {
          const id = get().personaId
          const d = get().demos[id]
          if (d.finished || d.ceremony) return
          const day = Math.min(nDays, d.day + 1)
          if (day >= nDays) {
            const { landing, cushion } = landingFn(day, d.extra)
            const safe = landing >= cushion
            // +20 rewards following the plan this month (behaviour), never the balance itself
            const gNow = get().games[id]
            const base = initialGame(PERSONAS.find(x => x.id === id)!)
            const followed = gNow.planks > base.planks || gNow.confirmed.length > 0 || gNow.books > base.books || gNow.rules.length > base.rules.length
            const pts = followed && !get().gameOff ? 20 : 0
            if (pts) earn(pts, 'ხელფასამდე მიღწევა გეგმით')
            set({ demos: { ...get().demos, [id]: { ...d, day, ceremony: { landing, safe, cushion, pts } } } })
            patchGame(gg => ({ pledged: false, cycles: gg.cycles + 1, stones: safe ? gg.stones + 1 : gg.stones, pendingChoice: safe && !gg.pendingChoice ? COSMETIC_POOL.map(c => c.id).filter(c => !gg.cosmetics.includes(c)).slice(0, 3) : gg.pendingChoice }))
          } else {
            set({ demos: { ...get().demos, [id]: { ...d, day } }, games: { ...get().games, [id]: { ...get().games[id], checksToday: 0, litToday: false, morningDone: false, eveningDone: false, questsDone: [], checkupToday: false } } })
          }
        },
        buy: amount => {
          const id = get().personaId
          const d = get().demos[id]
          set({ demos: { ...get().demos, [id]: { ...d, extra: d.extra + amount } } })
        },
        closeCeremony: () => {
          const id = get().personaId
          const d = get().demos[id]
          set({ demos: { ...get().demos, [id]: { ...d, ceremony: null, finished: true } } })
        },
        chooseCosmetic: a => {
          patchGame(gg => ({ cosmetics: [...gg.cosmetics, a], equipped: [...gg.equipped.filter(x => x !== a), a].slice(-2), pendingChoice: null }))
          get().toast('🎁', `${COSMETIC_POOL.find(c => c.id === a)?.name} — ჯიხოს ახალი ნივთი`)
        },
        toggleEquip: a => {
          const g0 = get().games[get().personaId]
          if (!g0.equipped.includes(a) && g0.equipped.length >= 2) get().toast('🎒', 'ერთად მხოლოდ 2 ნივთი ეტევა — ძველი მოიხსნა')
          patchGame(gg => ({ equipped: gg.equipped.includes(a) ? gg.equipped.filter(x => x !== a) : [...gg.equipped, a].slice(-2) }))
        },
        setBeatGuess: v => patchGame(() => ({ beatGuess: v })),
        pushChat: m => {
          const id = get().personaId
          set({ chats: { ...get().chats, [id]: [...get().chats[id], m] } })
        },
        resetAll: () => set({ games: byId(initialGame), demos: byId(initialDemo), chats: byId(() => []), toasts: [] }),
        resetDemo: () => {
          const id = get().personaId
          set({ demos: { ...get().demos, [id]: initialDemo() }, games: { ...get().games, [id]: initialGame(PERSONAS.find(p => p.id === id)!) }, chats: { ...get().chats, [id]: [] } })
        },
        setGameOff: v => set({ gameOff: v }),
        learn: (topic, correct) => {
          const g = get().games[get().personaId]
          const before = g.mastery[topic] ?? 0
          const after = Math.min(100, before + (correct ? 15 : 6))
          patchGame(gg => ({ mastery: { ...gg.mastery, [topic]: after }, topics: before < 80 && after >= 80 ? gg.topics + 1 : gg.topics }))
          if (before < 80 && after >= 80 && !get().gameOff) setTimeout(() => get().toast('🏫', 'თემა ათვისებულია — სკოლას ახალი ოთახი დაემატა'), 600)
        },
        microDone: topic => {
          const g = get().games[get().personaId]
          const fresh = !g.rules.includes(topic)
          patchGame(gg => ({ rules: fresh ? [...gg.rules, topic] : gg.rules, mastery: { ...gg.mastery, [topic]: Math.min(100, (gg.mastery[topic] ?? 0) + 8) } }))
          if (fresh) { const pt = earn(5, '30-წამიანი გაკვეთილი'); get().toast('📗', `ახალი წესი დაემატა „ჩემს წესებში"${pt}`) }
        },
        checkupDone: (score, label) => {
          const g = get().games[get().personaId]
          const first = g.checks[0]?.score ?? 0
          patchGame(gg => ({ checks: [...gg.checks, { label, score }], checkupToday: true }))
          const pt = g.checkupToday ? '' : earn(15, 'ცოდნის შემოწმება')
          get().toast('🎓', (score > first ? `ცოდნა: ${first} → ${score} (${CHECK_MAX}-დან)` : `ცოდნა: ${score}/${CHECK_MAX}`) + pt)
        },
        redeem: (partnerId, dateLabel) => {
          const g = get().games[get().personaId]
          const partner = PARTNERS.find(x => x.id === partnerId)
          if (!partner || get().gameOff || (g.points ?? 0) < partner.cost) return null
          const n = (g.coupons?.length ?? 0) + 1
          const code = `KH-${partnerId.slice(0, 3).toUpperCase()}-${1000 + ((n * 7919 + partnerId.length * 131) % 9000)}`
          patchGame(gg => ({ points: gg.points - partner.cost, coupons: [{ partnerId, code, at: dateLabel }, ...(gg.coupons ?? [])], pointsLog: [{ label: `კუპონი: ${partner?.name ?? ''}`, pts: -partner.cost }, ...(gg.pointsLog ?? [])].slice(0, 30) }))
          return code
        },
        toggleInterest: i => patchGame(gg => { const cur = gg.interests ?? []; return { interests: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] } }),
      }
    },
    {
      name: 'khelpasamde-v1',
      storage: createJSONStorage(() => {
        try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage } catch { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) } }
      }),
      partialize: s => ({ personaId: s.personaId, games: s.games, demos: s.demos, chats: s.chats, gameOff: s.gameOff }),
      version: 4,
      // v1 saves lack the learning fields: keep progress, fill the gaps from the persona defaults
      // v3 saves: interests were pre-filled and could hold the removed bank offer; clean both
      migrate: (old: any, version: number) => {
        const games = Object.fromEntries(PERSONAS.map(p => {
          const g = { ...initialGame(p), ...(old?.games?.[p.id] ?? {}) }
          if (version < 4) g.interests = []
          g.coupons = (g.coupons ?? []).filter((c: any) => PARTNERS.some(x => x.id === c.partnerId))
          return [p.id, g]
        }))
        return { ...old, games } as any
      },
    },
  ),
)

export const PERSONA_IDS = ids
