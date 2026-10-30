import { create } from 'zustand'

/**
 * Day ეკრანის სესიის მდგომარეობა (არ ინახება localStorage-ში).
 * გასაღები: `${personaId}:${demoDay}:${cycles}` — დემოს ყოველ დღეს თავისი ჩანაწერი აქვს.
 */
interface DayLocal {
  cash: Record<string, string>
  score: Record<string, number>
  bolt: Record<string, 'yes' | 'no'>
  setCash: (k: string, v: string) => void
  setScore: (k: string, n: number) => void
  setBolt: (k: string, v: 'yes' | 'no') => void
}

export const useDayLocal = create<DayLocal>()(set => ({
  cash: {},
  score: {},
  bolt: {},
  setCash: (k, v) => set(s => ({ cash: { ...s.cash, [k]: v } })),
  setScore: (k, n) => set(s => ({ score: { ...s.score, [k]: n } })),
  setBolt: (k, v) => set(s => ({ bolt: { ...s.bolt, [k]: v } })),
}))
