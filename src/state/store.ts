import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { PERSONAS, Persona } from '../engine/personas'
import type { Accessory } from '../components/Jikho'

export type Tab = 'road' | 'analytics' | 'chat' | 'village' | 'day'
export type PersonaId = Persona['id']

export interface Qvevri { name: string; target: number; filled: number; sealedAt?: string }
export interface Game {
  stones: number; cycles: number; planks: number; checksToday: number; books: number; topics: number
  station: number; stationXp: number; qvevri: Qvevri[]; streak: number; freezes: number; litToday: boolean
  morningDone: boolean; eveningDone: boolean; cosmetics: Accessory[]; equipped: Accessory[]; pendingChoice: Accessory[] | null
  confirmed: string[]; beatGuess: number | null; questsDone: string[]; lessonCursor: number; landmarksSeen: number
}
export interface Demo { day: number; extra: number; ceremony: null | { landing: number; safe: boolean; cushion: number }; finished: boolean }
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
      const lightStreak = () => {
        const g = get().games[get().personaId]
        if (g.litToday) return null
        if (get().personaId === 'tamar') { patchGame(() => ({ litToday: true })); return null } // hardship: streak frozen, nothing lost
        patchGame(gg => ({ litToday: true, streak: gg.streak + 1 }))
        return g.streak + 1
      }
      return {
        personaId: 'nino',
        tab: 'road',
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
            if (!off) get().toast('🪵', `+1 ფიცარი ხიდზე — ყიდვამდე შემოწმებისთვის`)
            if (g.checksToday + 1 === 3 && !g.questsDone.includes('three-checks')) {
              patchGame(gg => ({ questsDone: [...gg.questsDone, 'three-checks'] }))
              setTimeout(() => get().toast('🏅', 'დავალება შესრულდა: „სამი შემოწმება შესყიდვამდე"'), 700)
            }
          } else if (kind === 'lesson') {
            const books = g.books + 1
            const topicUp = books % 6 === 0
            patchGame(gg => ({ books, topics: topicUp ? gg.topics + 1 : gg.topics, morningDone: true, lessonCursor: gg.lessonCursor + 3 }))
            const s = lightStreak()
            if (!off) get().toast('📗', `+1 წიგნი სკოლაში${s ? ` · სერია ${s} დღე` : ''}`)
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
            if (!off) get().toast('📡', up ? `ამინდის სადგური ${g.station + 1}/5 — პროგნოზი უფრო ზუსტი ხდება` : `დადასტურდა: ${payload} · სადგური ${xp}/3`)
          } else if (kind === 'save') {
            const amount = payload as number
            patchGame(gg => {
              const q = gg.qvevri.map((x, i) => (i === 0 ? { ...x, filled: Math.min(x.target, x.filled + amount), sealedAt: x.filled + amount >= x.target ? 'ნოემბერი 2026' : x.sealedAt } : x))
              return { qvevri: q }
            })
            const q0 = get().games[get().personaId].qvevri[0]
            if (!off && q0) get().toast('🏺', q0.sealedAt ? `ქვევრი „${q0.name}" დაილუქა!` : `+${amount} ₾ ქვევრში „${q0.name}" · ${q0.filled}/${q0.target}`)
          } else if (kind === 'evening') {
            patchGame(() => ({ eveningDone: true }))
            if (!off) get().toast('🌙', 'დღე დაიხურა · ხვალ დილით — ახალი ამინდი')
          } else if (kind === 'beat') {
            if (!off) get().toast('🎯', payload)
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
            set({ demos: { ...get().demos, [id]: { ...d, day, ceremony: { landing, safe, cushion } } } })
            patchGame(gg => ({ cycles: gg.cycles + 1, stones: safe ? gg.stones + 1 : gg.stones, pendingChoice: safe && !gg.pendingChoice ? COSMETIC_POOL.map(c => c.id).filter(c => !gg.cosmetics.includes(c)).slice(0, 3) : gg.pendingChoice }))
          } else {
            set({ demos: { ...get().demos, [id]: { ...d, day } }, games: { ...get().games, [id]: { ...get().games[id], checksToday: 0, litToday: false, morningDone: false, eveningDone: false, questsDone: [] } } })
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
      }
    },
    {
      name: 'khelpasamde-v1',
      storage: createJSONStorage(() => {
        try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage } catch { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) } }
      }),
      partialize: s => ({ personaId: s.personaId, games: s.games, demos: s.demos, chats: s.chats, gameOff: s.gameOff }),
      version: 1,
    },
  ),
)

export const PERSONA_IDS = ids
