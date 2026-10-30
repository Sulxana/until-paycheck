export type BankId = 'TBC' | 'BOG' | 'Credo' | 'Liberty'

export interface DueItem { name: string; amount?: number; range?: [number, number]; dayIndex: number; date: string; bank: BankId }
export interface FixedStream { name: string; amount: number; day: number; range?: [number, number]; bank: BankId; kind: 'rent' | 'utility' | 'telecom' | 'subscription' | 'installment' | 'sport'; seen: number }

export interface Persona {
  id: 'nino' | 'luka' | 'tamar'
  name: string
  age: number
  job: string
  blurb: string
  seed: number
  salary: number
  incomeLabel: string
  paydayDay: number
  todayLabel: string
  paydayLabel: string
  /** days of spending between now and payday morning; true = weekend day */
  dayPattern: boolean[]
  dayLabels: string[]
  balances: { bank: BankId; amount: number }[]
  overdraft?: { bank: BankId; limit: number; used: number }
  savings: { bank: BankId; name: string; amount: number; target: number } | null
  fixed: FixedStream[]
  due: DueItem[]
  spend: { weekdayMean: number; weekendMean: number; sigma: number; oneoffP: number; oneoffMedian: number; oneoffSigma: number }
  installment: { name: string; amount: number; bank: BankId; left: number; lastCycle: [number, number] } | null
  uplift: Record<string, number>
  cushionDays: number
  firstCycle: [number, number]
  historyMonths: number
  confidence: number
  /** game state seed */
  game: { landings: number; cycles: number; streak: number; freezes: number; planks: number; topics: number; station: number }
}

export const NINO: Persona = {
  id: 'nino',
  name: 'ნინო',
  age: 26,
  job: 'ფარმაცევტი',
  blurb: '1 800 ₾ ხელფასი ყოველი თვის 10-ში, თიბისიში',
  seed: 20261102,
  salary: 1800,
  incomeLabel: 'ხელფასი',
  paydayDay: 10,
  todayLabel: 'ორშაბათი, 2 ნოემბერი',
  paydayLabel: 'სამშაბათი, 10 ნოემბერი',
  dayPattern: [false, false, false, false, false, true, true, false],
  dayLabels: ['2 ნოე', '3 ნოე', '4 ნოე', '5 ნოე', '6 ნოე', '7 ნოე', '8 ნოე', '9 ნოე'],
  balances: [{ bank: 'TBC', amount: 318 }, { bank: 'BOG', amount: 147 }],
  savings: { bank: 'Credo', name: 'ზამთრის კურსი', amount: 450, target: 600 },
  fixed: [
    { name: 'ქირა', amount: 600, day: 1, bank: 'TBC', kind: 'rent', seen: 6 },
    { name: 'სპორტდარბაზი', amount: 60, day: 1, bank: 'BOG', kind: 'sport', seen: 6 },
    { name: 'მაგთი', amount: 35, day: 3, bank: 'BOG', kind: 'telecom', seen: 6 },
    { name: 'თელასი', amount: 52, day: 5, range: [46, 60], bank: 'TBC', kind: 'utility', seen: 6 },
    { name: 'Spotify', amount: 12, day: 6, bank: 'BOG', kind: 'subscription', seen: 6 },
    { name: 'თბილისი ენერჯი', amount: 55, day: 7, range: [45, 70], bank: 'TBC', kind: 'utility', seen: 6 },
    { name: 'სილქნეტი', amount: 35, day: 12, bank: 'TBC', kind: 'telecom', seen: 6 },
    { name: 'ლეპტოპის განვადება', amount: 95, day: 15, bank: 'BOG', kind: 'installment', seen: 6 },
    { name: 'GWP', amount: 12, day: 20, bank: 'TBC', kind: 'utility', seen: 6 },
  ],
  // order matters: Python draws Telasi then Energy; fixed items summed first (35 + 12)
  due: [
    { name: 'მაგთი', amount: 35, dayIndex: 1, date: '3 ნოე', bank: 'BOG' },
    { name: 'Spotify', amount: 12, dayIndex: 4, date: '6 ნოე', bank: 'BOG' },
    { name: 'თელასი', range: [46, 60], dayIndex: 3, date: '5 ნოე', bank: 'TBC' },
    { name: 'თბილისი ენერჯი', range: [45, 70], dayIndex: 5, date: '7 ნოე', bank: 'TBC' },
  ],
  spend: { weekdayMean: 18, weekendMean: 25, sigma: 0.6, oneoffP: 0.06, oneoffMedian: 60, oneoffSigma: 0.5 },
  installment: { name: 'ლეპტოპის განვადება', amount: 95, bank: 'BOG', left: 5, lastCycle: [2027, 4] },
  uplift: { '2026-12': 40, '2027-01': 170, '2027-02': 80, '2027-03': 30, '2027-12': 40, '2028-01': 170, '2028-02': 80, '2028-03': 30 },
  cushionDays: 3,
  firstCycle: [2026, 12],
  historyMonths: 6,
  confidence: 4,
  game: { landings: 4, cycles: 6, streak: 12, freezes: 2, planks: 7, topics: 2, station: 4 },
}

export const LUKA: Persona = {
  id: 'luka',
  name: 'ლუკა',
  age: 20,
  job: 'სტუდენტი, ნახევარ განაკვეთზე ბარისტა',
  blurb: '300 ₾ სტიპენდია + 450 ₾ ხელფასი, 15-ში',
  seed: 20261103,
  salary: 750,
  incomeLabel: 'სტიპენდია + ხელფასი',
  paydayDay: 15,
  todayLabel: 'ორშაბათი, 2 ნოემბერი',
  paydayLabel: 'კვირა, 15 ნოემბერი',
  dayPattern: [false, false, false, false, false, true, true, false, false, false, false, false, true],
  dayLabels: ['2 ნოე', '3 ნოე', '4 ნოე', '5 ნოე', '6 ნოე', '7 ნოე', '8 ნოე', '9 ნოე', '10 ნოე', '11 ნოე', '12 ნოე', '13 ნოე', '14 ნოე'],
  balances: [{ bank: 'TBC', amount: 268 }, { bank: 'Liberty', amount: 38 }],
  savings: null,
  fixed: [
    { name: 'საერთო საცხოვრებელი', amount: 200, day: 1, bank: 'TBC', kind: 'rent', seen: 4 },
    { name: 'მაგთი', amount: 15, day: 4, bank: 'TBC', kind: 'telecom', seen: 4 },
    { name: 'Netflix', amount: 10, day: 9, bank: 'TBC', kind: 'subscription', seen: 4 },
    { name: 'ტელეფონის განვადება', amount: 60, day: 12, bank: 'TBC', kind: 'installment', seen: 4 },
  ],
  due: [
    { name: 'მაგთი', amount: 15, dayIndex: 2, date: '4 ნოე', bank: 'TBC' },
    { name: 'Netflix', amount: 10, dayIndex: 7, date: '9 ნოე', bank: 'TBC' },
    { name: 'ტელეფონის განვადება', amount: 60, dayIndex: 10, date: '12 ნოე', bank: 'TBC' },
  ],
  spend: { weekdayMean: 9, weekendMean: 16, sigma: 0.65, oneoffP: 0.05, oneoffMedian: 35, oneoffSigma: 0.5 },
  installment: { name: 'ტელეფონის განვადება', amount: 60, bank: 'TBC', left: 8, lastCycle: [2027, 7] },
  uplift: { '2026-12': 30, '2027-01': 60 },
  cushionDays: 3,
  firstCycle: [2026, 12],
  historyMonths: 4,
  confidence: 3,
  game: { landings: 1, cycles: 3, streak: 4, freezes: 1, planks: 2, topics: 1, station: 3 },
}

export const TAMAR: Persona = {
  id: 'tamar',
  name: 'თამარი',
  age: 34,
  job: 'გაყიდვების მენეჯერი',
  blurb: '1 400 ₾ ხელფასი 5-ში, ოვერდრაფტით ცხოვრობს',
  seed: 20261104,
  salary: 1400,
  incomeLabel: 'ხელფასი',
  paydayDay: 5,
  todayLabel: 'ორშაბათი, 2 ნოემბერი',
  paydayLabel: 'ხუთშაბათი, 5 ნოემბერი',
  dayPattern: [false, false, false],
  dayLabels: ['2 ნოე', '3 ნოე', '4 ნოე'],
  balances: [{ bank: 'BOG', amount: 0 }, { bank: 'TBC', amount: 64 }],
  overdraft: { bank: 'BOG', limit: 500, used: 310 },
  savings: null,
  fixed: [
    { name: 'ქირა', amount: 550, day: 1, bank: 'BOG', kind: 'rent', seen: 12 },
    { name: 'მაცივრის განვადება', amount: 120, day: 8, bank: 'BOG', kind: 'installment', seen: 12 },
    { name: 'სამომხმარებლო სესხი', amount: 210, day: 18, bank: 'TBC', kind: 'installment', seen: 12 },
    { name: 'კომუნალური', amount: 110, day: 14, range: [90, 140], bank: 'BOG', kind: 'utility', seen: 12 },
  ],
  due: [{ name: 'მაგთი', amount: 25, dayIndex: 1, date: '3 ნოე', bank: 'BOG' }],
  spend: { weekdayMean: 11, weekendMean: 16, sigma: 0.6, oneoffP: 0.05, oneoffMedian: 45, oneoffSigma: 0.5 },
  installment: null,
  uplift: { '2026-12': 60, '2027-01': 120 },
  cushionDays: 3,
  firstCycle: [2026, 12],
  historyMonths: 12,
  confidence: 5,
  game: { landings: 2, cycles: 12, streak: 0, freezes: 2, planks: 5, topics: 3, station: 5 },
}

export const PERSONAS: Persona[] = [NINO, LUKA, TAMAR]

export const BANK_META: Record<BankId, { label: string; color: string; short: string }> = {
  TBC: { label: 'თიბისი', color: '#00AEEF', short: 'TBC' },
  BOG: { label: 'საქართველოს ბანკი', color: '#FF6A13', short: 'BOG' },
  Credo: { label: 'კრედო', color: '#7A3E9D', short: 'Credo' },
  Liberty: { label: 'ლიბერთი', color: '#E4002B', short: 'LB' },
}
