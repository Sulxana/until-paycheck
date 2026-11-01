import { Engine, TenorResult, CycleRow, WEATHER_LABEL, WEATHER_ICON, KA_MONTHS_FULL, weatherOf, eirPct, annuity } from '../engine/engine'
import { Persona, FixedStream } from '../engine/personas'
import { ChatMsg, ChatCard } from '../state/store'
import { parse, Parsed, ConceptId, FRAUD_LINK, FRAUD_PRIZE, FRAUD_PIN, FRAUD_PROMISE, FRAUD_ASK, REFINANCE, DEFER, COLLECTORS, ENFORCE, COURT, OD_STUCK } from './parser'
import { fmt, gel, rangeText } from '../engine/view'

// Every answer has the same shape: one short visible line (about 160 characters, at most two sentences),
// then a card when numbers or options are compared, details behind the ⓘ, and two or three follow-up chips.

export interface Ctx {
  kind: 'purchase' | 'installment' | 'loan' | 'micro' | 'save' | 'deposit' | null
  amount?: number
  months?: number
  ratePerMonth?: number
  /** the rate as the user wrote it, e.g. "18% წლიური" */
  rateText?: string
  startOffset?: number
  upfront?: number
  item?: string
  /** microloan term in days */
  days?: number
  /** microloan: the sum to pay back */
  repay?: number
  /** saving: the monthly sum put aside */
  perMonth?: number
  /** deposit: the yearly rate as a fraction */
  rateYear?: number
  /** the last topic shown, so a bare "რა ვქნა?", "მარტივად" or "მაგალითით" stays on it */
  topic?: ConceptId | 'distress' | 'selfharm' | 'forecast' | 'safe'
  /** the question that opened the topic (some concept answers depend on its wording) */
  topicQ?: string
  /** a spend repeated every day ("დღეში 10 ლარი"), so "2 დღეში ერთხელ რომ ვიყიდო?" can follow */
  daily?: number
  /** money the person said they have now: later answers count from it */
  onHand?: number
  /** the purchase answer was about spending after payday */
  afterPayday?: boolean
  /** the last explain mode, so a second "უფრო მარტივად" does not repeat the first */
  lastExplain?: Explain
  /** several terms to compare on one card ("12 თვე ჯობია თუ 24?") */
  tenors?: number[]
  /** the visible texts of the last answers: a repeated question or "ვერ გავიგე" never gets the same words again */
  said?: string[]
  /** the daily spend is a habit already in the person's spending */
  dailyHabit?: boolean
  /** the last two answers as a whole, to notice the same answer given again right away */
  sigs?: string[]
  /** saving towards the person's own saving goal (the "ქვევრი"): later sums are monthly sums */
  goal?: boolean
  /** spends named earlier in this conversation that are certain (already made, or "უნდა ვიყიდო"): later answers count them too */
  spends?: { amount: number; label: string }[]
  /** the money named was cash ("ხელზე 60 ლარი"), separate from the card balance in the data */
  cash?: boolean
  /** the purchase on the table is certain ("უნდა ვიყიდო", already spent), so a next spend counts it too */
  certain?: boolean
  /** the person calls the income "სტიპენდია" */
  stipend?: boolean
  /** the spend on the table is money lent to someone */
  lend?: boolean
  /** the cash price of the item, next to its installment */
  cashPrice?: number
  /** the person's own installment was just shown */
  myDebt?: boolean
}

/** a bill named in a question ("კომუნალურები?") and the kinds of the person's monthly bills it means */
const BILL_KINDS: [RegExp, FixedStream['kind'][]][] = [
  [/კომუნალ|(?:^|[^ა-ჰ])(?:დენ|გაზ|წყალ|წყლ)(?:ი|ის|ზე)?(?![ა-ჰ])|თელას|ენერჯ/, ['utility']], [/ქირ|საცხოვრებ/, ['rent']], [/ინტერნეტ|მობილურ|მაგთ|სილქნეტ/, ['telecom']],
  [/სესხ|განვადებ/, ['installment']], [/გამოწერ|spotify|netflix|სპოტიფ|ნეტფლიქს/, ['subscription']], [/სპორტ|დარბაზ/, ['sport']],
]

type Mood = 'happy' | 'calm' | 'worried' | 'thinking'
type Reply = { msgs: ChatMsg[]; ctx: Ctx; mood: Mood }
/** how a follow-up is answered: plainer words, an example with the person's numbers, why, more detail, or the options as steps */
type Explain = NonNullable<Parsed['explain']> | 'steps'
/** each request climbs its own ladder, skipping what was already said: simpler words → an example with the person's numbers → the options */
const LADDER: Record<Explain, Explain[]> = {
  simple: ['simple', 'example', 'steps', 'why', 'more'],
  example: ['example', 'simple', 'steps', 'why', 'more'],
  why: ['why', 'example', 'simple', 'steps', 'more'],
  more: ['more', 'why', 'example', 'steps', 'simple'],
  steps: ['steps', 'example', 'simple', 'why', 'more'],
}
/** answers that get another angle when they come out word for word as before: the ones about the person's numbers or a topic they opened
 * (a greeting, "ok", the help menu, an unclear message or a plain refusal stay as they are) */
const VARY_ON_REPEAT = ['purchase', 'concept', 'hardship', 'forecast', 'safe', 'save', 'budget', 'installment', 'loan', 'followup', 'decide', 'total', 'explain', 'deposit', 'gambling']

const UNTIL: Record<number, string> = { 1: 'იანვრამდე', 2: 'თებერვლამდე', 3: 'მარტამდე', 4: 'აპრილამდე', 5: 'მაისამდე', 6: 'ივნისამდე', 7: 'ივლისამდე', 8: 'აგვისტომდე', 9: 'სექტემბრამდე', 10: 'ოქტომბრამდე', 11: 'ნოემბრამდე', 12: 'დეკემბრამდე' }

const FROM: Record<number, string> = { 1: 'იანვრიდან', 2: 'თებერვლიდან', 3: 'მარტიდან', 4: 'აპრილიდან', 5: 'მაისიდან', 6: 'ივნისიდან', 7: 'ივლისიდან', 8: 'აგვისტოდან', 9: 'სექტემბრიდან', 10: 'ოქტომბრიდან', 11: 'ნოემბრიდან', 12: 'დეკემბრიდან' }

const GEN: Record<number, string> = { 1: 'იანვრის', 2: 'თებერვლის', 3: 'მარტის', 4: 'აპრილის', 5: 'მაისის', 6: 'ივნისის', 7: 'ივლისის', 8: 'აგვისტოს', 9: 'სექტემბრის', 10: 'ოქტომბრის', 11: 'ნოემბრის', 12: 'დეკემბრის' }
/** "სამშაბათი, 10 ნოემბერი" → "სამშაბათს, 10 ნოემბერს" */
const dative = (label: string) => label.replace(/([ა-ჰ]+)ი(?=$|,)/g, '$1ს').replace(/([ა-ჰ]+ა)(?=$|,)/g, '$1ს')
/** "10 იანვრისთვის": the payday that ends a cycle */
const byPayday = (c: CycleRow) => `${c.label.split(' ')[0]} ${GEN[c.m]}თვის`

/** a Jikho message can carry a secondary explanation, shown behind the ⓘ pop-up (older saved messages have none) */
export type JikhoMsg = ChatMsg & { info?: string }
const withInfo = (m: ChatMsg, info?: string): JikhoMsg => (info ? { ...m, info } : m)

let seq = 1
const id = () => `m${Date.now()}_${seq++}`
const r5 = (v: number) => Math.round(v / 5) * 5
const r10 = (v: number) => Math.round(v / 10) * 10
/** small sums to 5 ₾, larger ones to 10 ₾ (so 6 ₾ is not shown as ~10 ₾) */
const rs = (v: number) => (Math.abs(v) < 50 ? r5(v) : r10(v))
/** "~130 ₾ დაგრჩება", or "~40 ₾ დაგაკლდება" below zero (never "~−40 ₾ დაგრჩება") */
const leftOrShort = (v: number) => (v >= 0 ? `~${gel(rs(v))} დაგრჩება` : `~${gel(Math.max(5, rs(-v)))} დაგაკლდება`)

/** the visible line keeps whole sentences up to `max` characters; the rest goes behind the ⓘ */
function fit(text: string, max = 160): [string, string | undefined] {
  if (text.length <= max) return [text, undefined]
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text]
  let head = '', i = 0
  while (i < parts.length && (head + parts[i]).trim().length <= max) head += parts[i++]
  if (!head) return [text, undefined]
  return [head.trim(), parts.slice(i).join('').trim() || undefined]
}
const joinInfo = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(' ') || undefined

export const START_CHIPS = ['100 ₾-ის ფეხსაცმელი ვიყიდო?', '1 200 ₾-ის ტელეფონი განვადებით', '2 000 ₾ სესხი 24 თვით', 'დღეს რამდენი შემიძლია?']
/** three chips for answers (the greeting keeps the full start menu) */
const MENU = ['100 ₾-ის ფეხსაცმელი ვიყიდო?', '1 200 ₾-ის ტელეფონი განვადებით', 'დღეს რამდენი შემიძლია?']
/** chips under a finance question Jikho has no card for: concepts, not shopping */
const LEARN_MENU = ['რა არის ეფექტური განაკვეთი?', 'რა არის PTI?', 'დღეს რამდენი შემიძლია?']
/** the chip that opens the weather explanation (the user's words, so "ითვლი", not "ვითვლი") */
const WEATHER_CHIP = 'როგორ ითვლი ამინდს?'
/** chips after hardship and debt answers, for every persona */
const CARE_CHIPS = ['ჩემი გადასახადები მაჩვენე', 'გადახდა თუ დამიგვიანდა?', 'რა არის საკრედიტო ისტორია?']

// ---------- support mode (the hardship persona): calm, no shopping or new-loan chips ----------
export const isSupport = (p: Persona) => p.id === 'tamar'
const SUPPORT_CHIPS = ['როცა ვალს ვერ ვიხდი', 'ხელფასამდე მეყოფა?', 'რა არის საკრედიტო ისტორია?', 'დღეს რამდენი შემიძლია?']
/** support mode, under the forecast and the safe-to-spend card: her bills first */
const SUPPORT_MONEY_CHIPS = ['ჩემი გადასახადები მაჩვენე', 'დღეს რამდენი შემიძლია?', 'როცა ვალს ვერ ვიხდი', 'ხელფასამდე მეყოფა?']
/** topics after which the next short reply stays calm, with no shopping or loan chips */
const CARE_TOPICS = ['selfharm', 'distress', 'restructure', 'gambling', 'late']
const SHOP_CHIP = /ვიყიდ|განვადებ|₾ სესხი|სესხი \d|სესხი მინდა|თვეზე\?|თვით|დანაზოგიდან|დავიცადო|რომ იყოს\?/
export const startChips = (p: Persona) => (isSupport(p) ? SUPPORT_CHIPS.slice(0, 3) : START_CHIPS)
function supportChips(chips: string[], asked: string): string[] {
  const keep = chips.filter(c => !SHOP_CHIP.test(c))
  for (const c of SUPPORT_CHIPS) { if (keep.length >= 3) break; if (!keep.includes(c) && c !== asked.trim()) keep.push(c) }
  return keep
}

/** monthly loan and installment payments the person already has: every installment-type bill, not only the one the engine tracks */
const debtNow = (p: Persona) => p.fixed.filter(f => f.kind === 'installment').reduce((s, f) => s + f.amount, 0)
const ptiNowText = (p: Persona) => `ახლა სესხებსა და განვადებაზე თვეში ${gel(debtNow(p))} მიდის — შემოსავლის ${fmt(debtNow(p) / p.salary * 100, 1)}%.`

/** the person's monthly bills from their own data: the three largest, the rest summed */
function billsLine(e: Engine, p: Persona) {
  const inst = p.fixed.filter(f => f.kind === 'installment')
  const groups = p.fixed.filter(f => f.kind !== 'installment').map(f => ({ name: f.name, amount: f.amount, approx: !!f.range }))
  if (inst.length) groups.push({ name: inst.length === 1 ? inst[0].name : 'სესხები და განვადება', amount: debtNow(p), approx: false })
  groups.sort((a, b) => b.amount - a.amount)
  const rest = groups.slice(3).reduce((s, g) => s + g.amount, 0)
  const parts = groups.slice(0, 3).map(g => `${g.name} ${g.approx ? '~' : ''}${gel(g.amount)}`).concat(rest ? [`სხვა ${gel(rest)}`] : [])
  return `ყოველთვე: ${parts.join(', ')} — ჯამში ${gel(e.fixedTotal)}, ხელფასი ${gel(p.salary)}-ია.` + (p.overdraft ? ` ოვერდრაფტი: გამოყენებულია ${gel(p.overdraft.used)} (ლიმიტი ${gel(p.overdraft.limit)}).` : '')
}

/** the person's debts (loans, installments, an overdraft in use), not the fixed bills */
function debtsLine(p: Persona) {
  const parts = p.fixed.filter(f => f.kind === 'installment').map(f => `${f.name} ${gel(f.amount)}/თვე`)
  if (p.overdraft) parts.push(`ოვერდრაფტი ${gel(p.overdraft.used)} (ლიმიტი ${gel(p.overdraft.limit)})`)
  if (!parts.length) return 'შენს მონაცემებში სესხი ან განვადება არ ჩანს.'
  return `შენი ვალები: ${parts.join(', ')}. სესხების შენატანები თვეში ${gel(debtNow(p))}-ია — შემოსავლის ${fmt(debtNow(p) / p.salary * 100, 1)}%.`
}

/** the National Bank's PTI limit for the person's income band (committee decision of 30 September 2026) */
function ptiLimit(p: Persona): { now: number; later?: number; from?: string } {
  if (p.salary < 1500) return { now: 25 }
  if (p.salary < 2000) return { now: 50, later: 25, from: '2027 წლის 1 თებერვლიდან' }
  if (p.salary < 2500) return { now: 50, later: 25, from: '2027 წლის 1 სექტემბრიდან' }
  return { now: 50 }
}
function ptiLimitText(p: Persona) {
  const l = ptiLimit(p)
  return l.later ? `${l.from} შენს შემოსავალზე PTI-ის ლიმიტი ${l.later}% იქნება (ახლა ${l.now}%).` : p.salary < 1500 ? `შენს შემოსავალზე PTI-ის ლიმიტი უკვე ${l.now}%-ია.` : 'PTI-ის ლიმიტი შემოსავალზეა დამოკიდებული — ზღვრები ეროვნული ბანკის საიტზეა.'
}
/** a short limit clause for a visible line: "ლიმიტი 2027-დან 25% იქნება" / "შენთვის ლიმიტი უკვე 25%-ია" */
function ptiLimitShort(p: Persona) {
  const l = ptiLimit(p)
  return l.later ? `ლიმიტი ${l.from === '2027 წლის 1 თებერვლიდან' ? '2027 წლის თებერვლიდან' : '2027 წლის სექტემბრიდან'} ${l.later}% იქნება` : `შენთვის ლიმიტი უკვე ${l.now}%-ია`
}
/** the limit that applies to a loan issued `start` months from now (November 2026 = 0): from 1 Feb 2027 (offset 3) or 1 Sep 2027 (offset 10) the lower one */
function ptiLimitAt(p: Persona, start: number): number {
  const l = ptiLimit(p)
  if (!l.later) return l.now
  const from = l.from === '2027 წლის 1 თებერვლიდან' ? 3 : 10
  return start >= from ? l.later : l.now
}
/** the limit line for the card: today's limit and, when a lower one comes, its date */
function ptiLimitMine(p: Persona) {
  const l = ptiLimit(p)
  const sum = (pct: number) => gel(Math.round(p.salary * pct / 100))
  return l.later ? `ლიმიტი ახლა ${l.now}%-ია (${sum(l.now)}/თვე); ${l.from} ახალ სესხებზე — ${l.later}% (${sum(l.later)}/თვე).` : `შენს შემოსავალზე ლიმიტი ${l.now}%-ია: ${sum(l.now)} თვეში.`
}
/** when a PTI goes over today's limit: the clause for the visible PTI line, or undefined
 * (the lender checks PTI when the loan is issued, so a loan taken now faces today's limit, never a 2027 one) */
function ptiOver(p: Persona, lo: number, hi: number, limit = ptiLimit(p).now): string | undefined {
  if (hi > limit) return lo > limit ? `ეს ${limit}%-იან ლიმიტზე მეტია.` : `მოკლე ვადით ${limit}%-იან ლიმიტზე მეტია.`
  return undefined
}
/** a lower limit coming later: said as a fact about new loans from that date (NBG Financial Stability Committee, 30 Sep 2026) */
function ptiLater(p: Persona, hi: number): string | undefined {
  const l = ptiLimit(p)
  if (!l.later || hi <= l.later) return undefined
  return `ახლანდელ ${l.now}%-იან ლიმიტში ჯდება; ${l.from} ახალ სესხებზე ლიმიტი ${l.later}% იქნება.`
}

/** bills still due before payday, from the person's data */
function dueLine(p: Persona, day: number) {
  return p.due.filter(d => d.dayIndex >= day).map(d => `${d.name} ${d.amount !== undefined ? gel(d.amount) : `~${gel(Math.round((d.range![0] + d.range![1]) / 2))}`} (${d.date})`).join(', ')
}

/** "ზღვარი" explained in plain words, for the ⓘ */
const cushionInfo = (e: Engine, p: Persona) => `ზღვარი — ${gel(e.cushion)}: შენი ${p.cushionDays} დღის ჩვეული ხარჯი. ამინდი აჩვენებს, რა შანსია, რომ ხელფასამდე ამაზე ნაკლები დაგრჩება.`

export function greeting(p: Persona): ChatMsg {
  return {
    id: id(), from: 'jikho',
    // support mode: a calm hello, no exclamation mark and no goat
    text: isSupport(p)
      ? `გამარჯობა, ${p.name}. ჯიხო ვარ.\nმკითხე ხელფასამდე ბიუჯეტზე, გადასახადებზე ან სესხის დაფარვაზე — ციფრებს ერთად დავალაგებთ.`
      : `გამარჯობა, ${p.name}! ჯიხო ვარ 🐐\nმკითხე შესყიდვაზე, განვადებაზე ან სესხზე — გაჩვენებ ხელფასამდე „ამინდს".`,
    chips: startChips(p),
  }
}

/** months between first cycle (ending Dec 2026) and the cycle that contains the first payment */
function offsetForStartMonth(m: number): number {
  // purchase in month m (Nov 2026 = now) -> first payment cycle ends in m+1
  const monthsFromNov = (m - 11 + 12) % 12
  return monthsFromNov
}

function itemWord(item?: string) { return item ? item : 'შესყიდვა' }

function daysText(p50: number, avg: number, cushion?: number) {
  if (p50 <= 0) return 'ანუ ფული ხელფასამდე სავარაუდოდ არ გეყოფა'
  const d = p50 / avg
  // under three quarters of a day is not "one day" (~10 ₾ at ~24 ₾ a day); Nino's ~30 ₾ (≈1,3 days) stays "one day"
  if (d < 0.75) return 'ეს ერთი დღის ჩვეულ ხარჯზე ნაკლებია'
  if (d < 1.5) return 'ეს დაახლოებით ერთი დღის ხარჯია'
  // below the cushion the days are never rounded up to its size (~63 ₾ is not "3 days" when 3 days are 70 ₾)
  if (cushion !== undefined && p50 < cushion) return `ეს ~${Math.floor(d)} დღის ხარჯია, ზღვარზე (${gel(cushion)}) ნაკლები`
  return `ეს დაახლოებით ${Math.round(d)} დღის ხარჯია`
}
/** "30.10" → "30 ოქტომბერი" */
const dateText = (dm: string) => { const [d, m] = dm.split('.').map(Number); return m >= 1 && m <= 12 ? `${d} ${KA_MONTHS_FULL[m]}` : dm }

type Landing = { p10: number; p50: number; p90: number; weather: any; pBelow?: number; inTen?: number }

function purchaseResult(e: Engine, p: Persona, amount: number, day0: boolean, extraNow: number, dayIdx: number) {
  return day0 ? e.purchaseCheck(amount) : { ...e.forecastAtDay(dayIdx, e.demoPathIndex(), extraNow + amount).landing, amount, afterPayday: Math.round(e.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - amount) }
}

/** extras for a purchase answer: the day the spend happens, today's balance, several summed parts, spends named without a sum */
interface BuyOpts { when?: string; bal?: number; parts?: number[]; uncounted?: string[]; info?: string; prior?: { sum: number; label: string } }

function purchaseAnswer(e: Engine, p: Persona, amount: number, item?: string, landingNow?: Landing, day0 = true, extraNow = 0, dayIdx = 0, kind: 'buy' | 'bill' | 'spent' | 'lend' | 'lent' = 'buy', o: BuyOpts = {}): ChatMsg[] {
  // spends already certain in this conversation ("ხვალ 45 ლარის წიგნები უნდა ვიყიდო") are counted together with this one
  const prior = o.prior && o.prior.sum > 0 ? o.prior : undefined
  const r = purchaseResult(e, p, amount + (prior?.sum ?? 0), day0, extraNow, dayIdx)
  const base = landingNow ?? e.landing
  const a = gel(amount, amount % 1 ? 2 : 0)
  const when = o.when ?? 'დღეს'
  // several sums: "ჯამში 100 ₾ (80 + 20)"
  const what = o.parts ? `ჯამში ${a} (${o.parts.map(x => fmt(x, x % 1 ? 2 : 0)).join(' + ')})` : a
  const lead = kind === 'spent' ? `${a}-ის ხარჯის შემდეგ` : kind === 'lend' ? `თუ ${when} ${a}-ს ასესხებ და ხელფასამდე არ დაგიბრუნდება,` : kind === 'lent' ? `${a}-ს სესხად მიცემის შემდეგ, თუ ხელფასამდე არ დაგიბრუნდება,`
    // a bill is paid, not bought: "ხვალ 500 ₾-ის გადახდის შემდეგ"
    : kind === 'bill' ? `${when === 'დღეს' ? '' : `${when} `}${a}-ის გადახდის შემდეგ`
      : `თუ ${when} ${what} დახარჯავ,`
  const withPrior = prior ? ` უკვე დასახელებული ${gel(prior.sum)}-ის ჩათვლით` : ''
  let text = r.p50 > 0
    ? `${lead}${withPrior} ხელფასის დღეს სავარაუდოდ ~${fmt(r5(r.p50))} ₾ დაგრჩება — ${daysText(r.p50, e.avgDaily, e.cushion)}.`
    : `${lead}${withPrior} ფული ხელფასამდე სავარაუდოდ არ გეყოფა: დაგაკლდება ~${fmt(Math.max(5, r5(-r.p50)))} ₾.`
  // spends named without a sum stay visible as not counted (a "probably yes" never silently covers them)
  if (o.uncounted?.length && `${text} ${o.uncounted.join(' და ')} ამაში არ შედის.`.length <= 160) text = `${text} ${o.uncounted.join(' და ')} ამაში არ შედის.`
  const chips: string[] = []
  if (kind === 'bill') {
    chips.push('ჩემი გადასახადები მაჩვენე', 'გადახდა თუ დამიგვიანდა?', 'ხელფასამდე მეყოფა?')
  } else if (kind !== 'buy') {
    chips.push('ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?')
  } else if (r.weather === 'storm' || r.weather === 'rain') {
    chips.push('ხელფასის შემდეგ რომ ვიყიდო?')
    if (amount >= 300) chips.push('განვადებით რა იქნება?', 'რამდენ ხანში დავაგროვებ?')
    else chips.push('დღეს რამდენი შემიძლია?')
  } else {
    if (r10(amount * 2) > amount) chips.push(`და ${r10(amount * 2)} ₾ რომ იყოს?`)
    chips.push('დღეს რამდენი შემიძლია?')
  }
  if (chips.length < 3) chips.push('მარტივად ამიხსენი')
  // the balance today: the day-0 balance, or the demo day's balance when the time machine has moved on
  const bal = o.bal ?? e.spendable
  if (amount > bal && kind !== 'spent') {
    // the balance comes from the person's data (synthetic in the demo, an uploaded statement later), never a live bank link
    text = kind === 'bill'
      ? `${when === 'დღეს' ? 'დღეს ' : `${when} `}გადასახდელი ${a} ნაშთს (${gel(bal)}) ~${gel(Math.ceil(amount - bal))}-ით აჭარბებს — ამდენი აკლია.`
      : `${a}-ს ნაშთი ვერ ფარავს: შენს მონაცემებში ხელმისაწვდომია ${gel(bal)}.${p.dayPattern.length - dayIdx === 1 ? ' ხელფასი ხვალ ჩაირიცხება.' : (() => { const n = e.monthsToSave(amount); return Number.isFinite(n) && n <= 36 ? ` დაზოგვით ~${n} თვეში დაგროვდება.` : '' })()}`
  }
  const counted = o.uncounted?.length ? `დავთვალე მხოლოდ ${a}: ${o.uncounted.join(' და ')} ამ თანხაში არ შედის — მათი ფასიც რომ მომწერო, ერთად დავითვლი.` : undefined
  // a bill larger than the balance: what people often do about it (a fact, not an instruction)
  const billOpts = kind === 'bill' && amount > bal
    ? (/(?:^|[^ა-ჰ])ქირ|საცხოვრებ/.test(item ?? '') || o.info === 'rent' ? 'რას აკეთებენ ხშირად: მესაკუთრეს თარიღამდე ეკითხებიან, შეიძლება თუ არა ნაწილის ახლა და დანარჩენის ხელფასის შემდეგ გადახდა.' : 'რას აკეთებენ ხშირად: კომპანიას თარიღამდე ეკითხებიან ნაწილ-ნაწილ ან მოგვიანებით გადახდაზე.')
    : undefined
  const info = joinInfo(o.info === 'rent' ? undefined : o.info, prior ? `ჩათვლილია უკვე დასახელებული: ${prior.label}.` : undefined, counted, kind === 'spent' ? 'ეს ხარჯი დემოს მონაცემებში არ არის, ამიტომ პროგნოზს ვაკლებ.' : undefined,
    kind === 'lend' || kind === 'lent' ? 'ვთვლი, რომ ეს თანხა ხელფასამდე არ დაგიბრუნდება.' : undefined,
    kind === 'bill' && amount > bal ? `ხელფასი (${gel(p.salary)}) ${dative(p.paydayLabel)} ჩაირიცხება.${p.due.length ? ` ხელფასამდე სხვა გადასახდელიც გაქვს: ${dueLine(p, dayIdx) || 'არაფერი'}.` : ''}` : undefined,
    billOpts, cushionInfo(e, p))
  const cardAmount = amount + (prior?.sum ?? 0)
  const cardItem = prior ? `${item ?? 'ხარჯი'} + ${prior.label}` : item
  // a bill the balance cannot cover gets no weather card: the gap in the line is the answer, a payday figure next to it only confuses
  const card: ChatCard | undefined = kind === 'bill' && amount > bal ? undefined : { kind: 'purchase', data: { amount: cardAmount, item: cardItem, r, base: { p10: base.p10, p50: base.p50, p90: base.p90, weather: base.weather }, cushion: e.cushion, afterPayday: r.afterPayday } }
  return [withInfo({ id: id(), from: 'jikho', text, card, chips }, info)]
}

/** the card's "სულ" is everything paid, the down payment included */
function tenorCard(e: Engine, rows: TenorResult[], title: string, note?: string, ptiExtra = 0, upfront = 0): ChatCard {
  return { kind: 'installment', data: { title, cushion: e.cushion, salary: e.p.salary, laptop: e.p.installment, rows: rows.map(t => ({ label: t.label, monthly: t.monthly, total: t.total + upfront, cost: t.cost, eir: t.eirPct, pti: t.ptiNowPct + ptiExtra, nShort: t.nShort, short: t.shortLabels, window: t.window.map(c => ({ label: c.label, p50: c.p50, p10: c.p10, pBelow: c.pBelow })), maxPBelow: t.maxPBelow, months: t.months, principal: t.principal, startLabel: t.startLabel })), note } }
}

/** the effective yearly rate of an annuity loan with a fee paid up front: the monthly rate at which the payments equal the money received */
function eirWithFee(principal: number, ratePerMonth: number, months: number, fee: number) {
  const pay = annuity(principal, ratePerMonth, months)
  const net = principal * (1 - fee)
  const pv = (i: number) => (i === 0 ? pay * months : pay * (1 - Math.pow(1 + i, -months)) / i)
  let lo = 0, hi = 1
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid }
  return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100
}

/** "1,5%/თვე": one decimal unless a second one is needed */
function monthlyRateText(rate: number) {
  const pct = rate * 100
  const d = Math.abs(pct * 10 - Math.round(pct * 10)) > 1e-6 ? 2 : pct % 1 ? 1 : 0
  return `${fmt(pct, d)}%/თვე`
}

function shortText(t: TenorResult) {
  const w = t.window.length
  if (t.nShort === 0) return 'ყველა თვეში ხელფასამდე ზღვარს ზემოთ დარჩები'
  // a short installment is shown on the next 12 months, not only on its own months
  if (w > t.months) return t.nShort === w ? `მომდევნო ${w} თვეში ყოველთვე ხელფასამდე ზღვარს ქვემოთ ჩახვალ` : `მომდევნო ${w} თვიდან ${t.nShort}-ში ხელფასამდე ზღვარს ქვემოთ ჩახვალ`
  if (t.nShort === w) return w < t.months ? `პირველ ${w} თვეში ყოველთვე ხელფასამდე ზღვარს ქვემოთ ჩახვალ` : `ყველა ${w} თვეში ხელფასამდე ზღვარს ქვემოთ ჩახვალ`
  if (t.nShort >= Math.max(7, w - 2)) return 'თითქმის ყველა თვეში ხელფასამდე ზღვარს ქვემოთ ჩახვალ'
  const of = w < t.months ? `პირველი ${w} თვიდან ${t.nShort}-ში` : `${w}-დან ${t.nShort} თვეში`
  return `${of} ხელფასამდე ზღვარს ქვემოთ ჩახვალ`
}
/** the same months as shortText, as a short card-style phrase */
function monthsPhrase(t: { nShort: number; months: number; window: unknown[] }) {
  const w = t.window.length
  if (t.nShort === 0) return 'ყველა თვე ზღვარს ზემოთ'
  if (w > t.months) return t.nShort === w ? `მომდევნო ${w} თვე ზღვარს ქვემოთ` : `მომდევნო ${w} თვიდან ${t.nShort} ზღვარს ქვემოთ`
  if (t.nShort === w) return w < t.months ? `პირველი ${w} თვე ზღვარს ქვემოთ` : `ყველა ${w} თვე ზღვარს ქვემოთ`
  return w < t.months ? `პირველი ${w} თვიდან ${t.nShort} ზღვარს ქვემოთ` : `${w}-დან ${t.nShort} თვე ზღვარს ქვემოთ`
}

/** an installment or loan priced on the person's months: the same numbers for every answer about it */
interface Deal { rows: TenorResult[]; price: number; start: number; upfront: number; rate: number; rateTxt: string; isExampleRate: boolean; what: string; title: string; startMonth: number; ptiExtra: number; kind: 'installment' | 'loan' }
function buildDeal(e: Engine, p: Persona, c: Ctx, kind: 'installment' | 'loan'): Deal {
  const price = c.amount ?? 1200
  const start = c.startOffset ?? 0
  const upfront = c.upfront ?? 0
  const isExampleRate = c.ratePerMonth === undefined
  const rate = c.ratePerMonth ?? (kind === 'loan' ? 0.18 / 12 : 0.015)
  const rateTxt = rate === 0 ? '0%' : c.rateText ?? (kind === 'loan' && isExampleRate ? '18% წლიური' : monthlyRateText(rate))
  const startMonth = ((10 + start) % 12) + 1
  const what = kind === 'loan' ? `${gel(price)} სესხი` : `${itemWord(c.item)} ${gel(price)} განვადებით`
  const title = what + (upfront ? ` · ${gel(upfront)} წინასწარ` : '') + (start > 0 ? ` · ${FROM[startMonth]}` : '')
  // the label is set here: the engine's cached results can carry another one
  const tenor = (months: number, r: number, label: string): TenorResult => ({ ...e.installment({ price, months, ratePerMonth: r, startOffset: start, upfront }), label })
  let rows: TenorResult[]
  if (c.tenors?.length) rows = c.tenors.map(m => tenor(m, rate, `${m} თვე · ${rateTxt}`))
  else if (c.months) rows = [tenor(c.months, rate, `${c.months} თვე · ${rateTxt}`)]
  else if (kind === 'loan') rows = [12, 24, 36].map(m => tenor(m, rate, `${m} თვე · ${rateTxt}`))
  else rows = [tenor(4, 0, '4 თვე · 0%'), tenor(12, rate, `12 თვე · ${rateTxt}`), tenor(24, rate, `24 თვე · ${rateTxt}`)]
  // the engine's PTI counts the one installment it tracks; other loans in the person's bills are added here (0 for Nino and Luka)
  const ptiExtra = (debtNow(p) - e.laptop) / p.salary * 100
  return { rows, price, start, upfront, rate, rateTxt, isExampleRate, what, title, startMonth, ptiExtra, kind }
}
const isDeal = (c: Ctx): c is Ctx & { kind: 'installment' | 'loan'; amount: number } => (c.kind === 'installment' || c.kind === 'loan') && c.amount !== undefined
/** whole percent, except right at the 25% limit: 24,97% reads 24,9%, never 25% or 25,0% */
const pctText = (v: number) => (Math.round(v) === 25 ? fmt(v < 25 ? Math.floor(v * 10) / 10 : Math.ceil(v * 10 - 1e-9) / 10, 1) : fmt(Math.round(v)))
function ptiRange(d: Deal) {
  const ptis = d.rows.map(t => t.ptiNowPct + d.ptiExtra)
  const lo = pctText(Math.min(...ptis)), hi = pctText(Math.max(...ptis))
  return lo === hi ? lo : `${lo}–${hi}`
}

/** "თვეში 1%-ით", "წლიური 18%-ით", "0%-ით": a rate as an instrumental phrase */
function rateInstr(txt: string) {
  const m = txt.match(/^([\d.,]+%)\/თვე$/)
  if (m) return `თვეში ${m[1]}-ით`
  const y = txt.match(/^([\d.,]+%) წლიური$/)
  if (y) return `წლიური ${y[1]}-ით`
  return `${txt}-ით`
}
/** " — ზღვარს ქვემოთ 0 თვე (ახლა 6)": the months below the cushion with the start moved, against starting now */
const monthsShort = (c: { short: number; nowShort: number }) => ` — ზღვარს ქვემოთ ${c.short} თვე (ახლა ${c.nowShort})`
type InstOpts = { followup?: boolean; ask?: Parsed['ask']; startChanged?: boolean; limitQ?: boolean; priceChanged?: boolean; prevRate?: { txt: string; rows: TenorResult[] } }
function installmentAnswer(e: Engine, p: Persona, c: Ctx, kind: 'installment' | 'loan', opts: InstOpts = {}): ChatMsg[] {
  const d = buildDeal(e, p, c, kind)
  const { rows, price, start, upfront, rate, rateTxt, isExampleRate, what, title, startMonth, ptiExtra } = d
  const ptis = rows.map(t => t.ptiNowPct + ptiExtra)
  // the limit that applies when the loan is issued: a deal starting after 1 Feb 2027 faces the lower one
  const limNow = ptiLimitAt(p, start)
  const laterStart = limNow !== ptiLimit(p).now
  // above the National Bank's limit, that fact is the visible line; otherwise the line says what PTI misses
  const over0 = ptiOver(p, Math.min(...ptis), Math.max(...ptis), limNow)
  const over = over0 && laterStart ? over0.replace(`${limNow}%-იან`, `${GEN[startMonth]}თვის მოქმედ ${limNow}%-იან`) : over0
  const ptiSees = 'შენს ყოველდღიურ ხარჯს ბანკი ვერ ხედავს — ფერადი თვეები სწორედ ამას აჩვენებს.'
  const lim = { ...ptiLimit(p), now: limNow, later: laterStart ? undefined : ptiLimit(p).later }
  const limWhen = laterStart ? `${GEN[startMonth]}თვის მოქმედ ` : lim.from === '2027 წლის 1 თებერვლიდან' ? '2027 წლის თებერვლიდან მოქმედ ' : lim.from ? '2027 წლის სექტემბრიდან მოქმედ ' : ''
  // 24,97% at a 25% limit rounds to the limit: it reaches it, never "under" it; within half a point it is close to it
  const loPti = Math.min(...ptis), hiPti = Math.max(...ptis)
  const atLimit = !over && hiPti >= lim.now - 0.05
  // a deal that starts when the lower limit already applies: within two points of it is "close" (it is checked when the loan is issued)
  const nearLimit = !over && !atLimit && (hiPti > lim.now - 0.5 || (laterStart && hiPti > lim.now - 2))
  const loAt = loPti >= lim.now - 0.05
  const ptiShown = atLimit ? (loAt ? `~${lim.now}` : `${pctText(loPti)}–${lim.now}`) : ptiRange(d)
  const atWhen = laterStart ? limWhen : ''
  const atLimitText = atLimit ? `${loAt ? 'ეს' : 'მოკლე ვადით'} ${atWhen}${lim.now}%-იან ლიმიტს აღწევს.` : `${loPti > lim.now - (laterStart ? 2 : 0.5) ? 'ეს' : 'მოკლე ვადით'} ${atWhen}${lim.now}%-იან ლიმიტთან ${laterStart && hiPti <= lim.now - 0.5 ? '' : 'ძალიან '}ახლოსაა.`
  // a lower limit from 2027 (for new loans) is a fact about that date, never a breach by a loan taken now
  const later = over || laterStart ? undefined : ptiLater(p, hiPti)
  const ptiLine = over ? `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა — ${over}`
    : atLimit ? `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა — ${atLimitText}`
    : later ? `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა — ${later}`
    : atLimit || nearLimit ? `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა — ${atLimitText}`
    : opts.limitQ ? `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა — ეს ${limWhen}${lim.later ?? lim.now}%-იან ლიმიტში ჯდება.`
    : `ბანკი PTI-ს უყურებს: შემოსავლის ${ptiShown}% სესხებზე წავა. შენს ყოველდღიურ ხარჯს კი ვერ ხედავს — ფერადი თვეები სწორედ ამას აჩვენებს.`
  // an effective rate above the legal 50% cap is said in the visible line, not only behind the ⓘ
  const maxEir = Math.max(...rows.map(t => t.eirPct))
  const capVisible = maxEir > 50 ? `ეფექტური წლიური ${maxEir > 1000 ? '1 000%-ზე მეტია' : `~${fmt(Math.round(maxEir))}%-ია`} — კანონით დაშვებულ 50%-ზე ${maxEir > 100 ? 'ბევრად ' : ''}მეტი.` : undefined
  const save = e.monthsToSave(price - upfront)
  const cashLine = Number.isFinite(save) && save <= 24 ? `სესხის გარეშე: თუ თვეში დარჩენილ ~${gel(Math.round(e.medianSurplus))}-ს გადადებ, ${gel(price - upfront)} ~${save} თვეში დაგროვდება.` : ''
  const capEir = Math.max(...rows.map(t => t.eirPct))
  const capLine = capEir > 50 ? `ეფექტური წლიური განაკვეთი აქ ${capEir > 1000 ? '1 000%-ზე მეტია' : `${fmt(capEir, 0)}%-ია`} — საქართველოში კანონით ის 50%-ს ვერ გადააჭარბებს.` : undefined
  const limitLine = joinInfo(ptiLimitText(p), over && Math.max(...ptis) > limNow ? 'ლიმიტზე მეტი PTI-ით ბანკი სესხს ჩვეულებრივ ვერ გასცემს.' : undefined)
  const cushionLine = `ზღვარი — ${gel(e.cushion)}: შენი ${p.cushionDays} დღის ჩვეული ხარჯი.`
  const ptiInfo = joinInfo(over || later ? ptiSees : undefined, capLine, later ? 'PTI-ს ბანკი სესხის გაცემისას ამოწმებს: დღეს აღებულ სესხს დღევანდელი ლიმიტი ეხება.' : limitLine, cashLine, cushionLine)

  const april = p.installment && start === 0 ? `და თუ ${UNTIL[p.installment.lastCycle[1]]} დავიცადო?` : undefined
  const tenorChip = !c.months && !c.tenors ? (kind === 'loan' ? '48 თვეზე?' : '6 თვეზე?') : undefined
  // a down payment applies to an item bought in installments, not to cash borrowed
  const upChip = kind === 'installment' && p.savings && !upfront ? `${Math.min(300, Math.round(p.savings.amount / 100) * 100 - 100)} ₾ დანაზოგიდან წინასწარ` : undefined
  const chips = (opts.followup
    ? [april, upChip, tenorChip, 'რატომ?', 'ჯამში რამდენს გადავიხდი?', 'დღეს რამდენი შემიძლია?']
    : [april, tenorChip, 'რა არის PTI?', upChip, 'რა არის ეფექტური განაკვეთი?', 'ჯამში რამდენს გადავიხდი?']).filter((x): x is string => !!x).slice(0, 3)

  let compare: any = null
  if (start > 0 && rows.length === 1) {
    const t = rows[0]
    const now = e.installment({ price, months: t.months, ratePerMonth: rate, upfront })
    const now24 = e.installment({ price, months: 24, ratePerMonth: rate, upfront })
    // each box shows the worst month's weather of that option
    // the saving bar compares with the 24-month option only for a term between 12 and 24 months (a 6-month deal costs no more by waiting)
    compare = { from: FROM[startMonth], months: t.months, nowShort: now.nShort, nowWeather: weatherOf(now.maxPBelow), short: t.nShort, weather: weatherOf(t.maxPBelow), cost: t.cost, cost24: t.months >= 12 && t.months < 24 ? now24.cost : undefined }
  }

  const card = tenorCard(e, rows, title, isExampleRate ? `განაკვეთი სამაგალითოა (${rateTxt}). მომწერე შენი — გადავითვლი.` : undefined, ptiExtra, upfront)
  card.data.compare = compare
  const t0 = rows[0]
  // a one-month loan is one repayment, not "a month's payment"
  const monthly = t0.months === 1 ? `ერთი გადახდით ~${gel(Math.round(t0.monthly))}` : `თვეში ~${gel(Math.round(t0.monthly))}`
  // the pitch's memorable moment (waiting until the old installment ends): its two bubbles stay exactly as they are
  const aprilMoment = !!compare && compare.short === 0 && compare.nowShort > 0 && compare.cost24 > compare.cost && (opts.startChanged ?? !opts.followup)
  // every option keeps every month below the cushion: said plainly (and whether it is so even without the deal)
  const allBelow = rows.every(t => t.nShort > 0 && t.nShort === t.window.length)
  const baseBelow = e.baseline.slice(0, 12).every(cy => cy.p50 < e.cushion)
  const ms = Math.round(e.medianSurplus)
  const allBelowText = baseBelow ? `ყველა ვარიანტით ყველა თვე ზღვარს ქვემოთაა — ${kind === 'loan' ? 'სესხის' : 'განვადების'} გარეშეც: ${ms < 0 ? `თვის ხარჯი ხელფასს ~${gel(-ms)}-ით აჭარბებს` : 'თვის ხარჯი ხელფასს თითქმის მთლიანად ფარავს'} 👇` : 'ყველა ვარიანტით ყველა თვე ზღვარს ქვემოთაა 👇'
  let first = compare
    ? aprilMoment ? `თუ ${compare.from} დაიწყებ (${t0.months} თვით) 👇`
      // a new price on the delayed deal names the item and the price, so the answer says what changed
      : opts.priceChanged ? `${what}, ${compare.from} (${t0.months} თვით${upfront ? `, ${gel(upfront)} წინასწარ` : ''}): ${monthly}${monthsShort(compare)} 👇`
      : `თუ ${compare.from} დაიწყებ (${t0.months} თვით${upfront ? `, ${gel(upfront)} წინასწარ` : ''}): ${monthly}${opts.startChanged ? monthsShort(compare) : ''} 👇`
    : rows.length > 1
      ? (opts.followup
        ? `${what}${upfront ? `, ${gel(upfront)} წინასწარ` : ''}: თვეში ~${fmt(Math.round(Math.min(...rows.map(t => t.monthly))))}–${gel(Math.round(Math.max(...rows.map(t => t.monthly))))}, ${rows.length} ვარიანტი 👇`
        : `აი, ${rows.length} ვარიანტი შენს თვეებზე 👇`)
      : opts.ask === 'total'
        ? `${what}, ${t0.months} თვით: ${monthly}, ჯამში ${gel(t0.total + upfront)}${upfront ? ` (${gel(upfront)} წინასწარის ჩათვლით)` : ''}. ${shortText(t0)} 👇`
        : `${what}, ${t0.months} თვით: ${monthly}. ${shortText(t0)} 👇`
  if (!compare && capVisible) {
    // above the legal cap: that fact leads, the payment follows
    first = rows.length > 1 ? `${capVisible} აი, ${rows.length} ვარიანტი შენს თვეებზე 👇` : `${what}, ${t0.months} თვით: ${capVisible} ${monthly} 👇`
  } else if (!compare && rows.length > 1 && allBelow) first = allBelowText
  else if (!compare && rows.length > 1 && !opts.followup && isSupport(p)) first = `აი, როგორ აისახება ${rows.length} ვარიანტი შენს თვეებზე 👇`
  if (aprilMoment) {
    return [
      { id: id(), from: 'jikho', text: first, card },
      { id: id(), from: 'jikho', text: 'ასეთ შედარებას განვადების გაფორმებისას იშვიათად ნახავ 🐐', chips: ['24 თვეზე?', 'რატომ?', 'ჯამში რამდენს გადავიხდი?'] },
    ]
  }
  // a new rate on the deal on the table: the new and the old numbers side by side
  if (opts.prevRate && !compare && !capVisible) {
    const old = opts.prevRate.rows
    const m = (rs0: TenorResult[]) => rs0.length === 1 ? `~${gel(Math.round(rs0[0].monthly))}` : `~${fmt(Math.round(Math.min(...rs0.map(t => t.monthly))))}–${gel(Math.round(Math.max(...rs0.map(t => t.monthly))))}`
    first = rows.length === 1
      ? `${rateInstr(rateTxt)} შენატანი ${m(rows)}-ია, სესხის ფასი — ${gel(t0.cost)} (${rateInstr(opts.prevRate.txt)}: ${m(old)} და ${gel(old[0].cost)}) 👇`
      : `${rateInstr(rateTxt)} თვეში ${m(rows)} (${rateInstr(opts.prevRate.txt)}: ${m(old)}) 👇`
  }
  // a first answer explains PTI in a second bubble; a follow-up on the same deal keeps a short PTI line behind the ⓘ
  if (!opts.followup) {
    // "… ან 1100 ლარად ნაღდად": the gap between the cash price and the installment total is the installment's cost, said first
    const cashLine2 = c.cashPrice && c.cashPrice < t0.total + upfront && rows.length === 1
      ? `ნაღდად ${gel(c.cashPrice)}-ია: განვადებით ჯამში ${gel(t0.total + upfront - c.cashPrice)}-ით მეტს იხდი (~${Math.round((t0.total + upfront - c.cashPrice) / c.cashPrice * 100)}%) — ეს განვადების ფასია.` : undefined
    return [
      { id: id(), from: 'jikho', text: first, card },
      withInfo({ id: id(), from: 'jikho', text: cashLine2 ?? ptiLine, chips }, cashLine2 ? joinInfo(ptiLine, ptiInfo) : ptiInfo),
    ]
  }
  // a PTI above (or at) the limit that applies is said in the visible line of a follow-up too
  const ptiFlag = over ? over : atLimit || nearLimit ? atLimitText : undefined
  let shownShort = true
  if (ptiFlag) {
    // one bubble, at most two sentences: the payment, then the PTI fact (the months below the cushion move behind the ⓘ)
    const clause = ` PTI ${ptiShown}% — ${ptiFlag.replace(/^ეს /, '').replace(/\.$/, '')}`
    if (rows.length === 1 && !compare && `${what}, ${t0.months} თვით: ${monthly}.${clause} 👇`.length <= 160) { first = `${what}, ${t0.months} თვით: ${monthly}.${clause} 👇`; shownShort = false }
    else {
      const base = first.replace(/ 👇$/, '').replace(/[.!]$/, '')
      const noShort = compare ? base.replace(monthsShort(compare), '') : base
      if (/[.!?]/.test(base.replace(/\d[.,]\d/g, '0')) === false && `${base}.${clause} 👇`.length <= 160) first = `${base}.${clause} 👇`
      else if (compare && `${noShort}.${clause} 👇`.length <= 160) { first = `${noShort}.${clause} 👇`; shownShort = false }
    }
  }
  const followInfo = joinInfo(`PTI: ${ptiShown}%${over ? ` — ${over}` : later ? ` — ${later}` : atLimit || nearLimit ? ` — ${atLimitText}` : '.'}`, capVisible ? undefined : capLine, (capVisible || !shownShort || opts.prevRate) && rows.length === 1 && t0.months > 1 ? (compare ? `ზღვარს ქვემოთ ${compare.short} თვე (ახლა რომ დაიწყო — ${compare.nowShort}).` : shortText(t0) + '.') : undefined, ptiLimitText(p), cushionLine)
  return [withInfo({ id: id(), from: 'jikho', text: first, card, chips }, followInfo)]
}

const MICRO_INFO = 'საქართველოში კანონით ეფექტური წლიური განაკვეთი 50%-ს ვერ გადააჭარბებს და ის ხელშეკრულებაში უნდა ეწეროს. სესხის ფასს დასაბრუნებელი ჯამური თანხა აჩვენებს.'

/** refinancing: the old loan is closed by the new one; the total cost, term and fees decide whether it costs less */
const REFI_DEF = 'რეფინანსირება ძველი სესხის ახალი სესხით დაფარვაა: ძველი სესხი იხურება. ხარჯს მაშინ ამცირებს, თუ ახლის ჯამური ფასი — პროცენტი, საკომისიოები და ვადა — ნაკლებია.'
/** which debt first: two common methods, as facts (the choice is the person's) */
const DEBT_ORDER_TEXT = 'ორი გავრცელებული მიდგომაა: ჯერ ყველაზე მაღალი განაკვეთის ვალი — ჯამში ნაკლები პროცენტი; ან ჯერ ყველაზე პატარა — ვალების რიცხვი უფრო მალე მცირდება.'
const METHODS_TEXT = '„ზვავი" — ჯერ ყველაზე მაღალი განაკვეთის ვალს ფარავენ, ჯამში ნაკლები პროცენტისთვის; „თოვლის გუნდა" — ჯერ ყველაზე პატარას, რომ ვალების რიცხვი მალე შემცირდეს.'

interface Concept {
  title: string; body: string; more?: string; mine: string; rule: string
  /** the visible answer when it differs from the definition */ answer?: string
  /** text behind the answer's ⓘ */ info?: string
  chips?: string[]
  /** follow-ups: plain words, an example with the person's own numbers, why it matters */
  simple?: string; example?: string; why?: string
  /** "რა ვქნა?": the options as short neutral steps (information, never an instruction) */
  steps?: string
}

/** concept cards that teach a notion get a "with an example" chip */
const TEACH = new Set<ConceptId>(['pti', 'eir', 'compound', 'cushion', 'weather', 'installment', 'overdraft', 'deposit', 'inflation', 'credithistory', 'fixed', 'zero', 'late', 'risk', 'emergency', 'budget', 'debts'])

const CONCEPT_TEXT: Record<ConceptId, (e: Engine, p: Persona, q: Parsed, ctx: Ctx) => Concept> = {
  pti: (e, p, q, ctx) => {
    const debt = debtNow(p), now = fmt(debt / p.salary * 100, 1)
    const formula = 'PTI = ყველა სესხისა და განვადების თვიური შენატანი, გაყოფილი ხელზე ასაღებ შემოსავალზე.'
    const body = 'PTI გიჩვენებს, ხელზე ასაღები ხელფასის რა ნაწილი მიდის ყველა სესხისა და განვადების თვიურ შენატანზე.'
    const lim = ptiLimit(p)
    const limitCap = lim.later ?? lim.now
    const raw = q.raw.toLowerCase()
    // "PTI რამდენი იქნება?" right after a loan: that loan's PTI
    const deal = isDeal(ctx) && /რამდენი? (იქნება|გამოვა|გახდება|მექნება)|რამდენია|ამ (სესხ|განვადებ)|ეს (სესხ|განვადებ)|ამით|ჩავჯდები|ჩავეტევი|ლიმიტში/.test(raw) ? buildDeal(e, p, ctx, ctx.kind) : undefined
    // any deal on the table, for a plain "what is PTI?" right after it
    const ctxDeal = !deal && isDeal(ctx) ? buildDeal(e, p, ctx, ctx.kind) : undefined
    const dealPti = deal ? deal.rows.map(t => t.ptiNowPct + deal.ptiExtra) : []
    const dealOver = deal ? ptiOver(p, Math.min(...dealPti), Math.max(...dealPti), ptiLimitAt(p, deal.start)) ?? (deal.start > 0 && ptiLimitAt(p, deal.start) !== lim.now ? undefined : ptiLater(p, Math.max(...dealPti))) : undefined
    // "PTI-ში ჩავჯდები?": both limits said plainly, today's and the 2027 one
    const fitsQ = /ჩავჯდები|ჩავეტევი|ლიმიტში|ეტევა|ჯდება/.test(raw)
    const hiDeal = dealPti.length ? Math.max(...dealPti) : 0
    const limAt = deal ? ptiLimitAt(p, deal.start) : lim.now
    const fitsText = deal ? (hiDeal > limAt ? `ეს ${limAt}%-იან ლიმიტზე მეტია.`
      : lim.later && limAt === lim.now ? (hiDeal > lim.later ? `ეს დღევანდელ ${lim.now}%-იან ლიმიტში ჯდება, ${lim.from} ახალ სესხებზე მოქმედ ${lim.later}%-ზე კი მეტია.` : `ეს დღევანდელ ${lim.now}%-იან ლიმიტშიც ჯდება და ${lim.from} მოქმედ ${lim.later}%-შიც.`)
        : `ეს ${limAt}%-იან ლიმიტში ჯდება.`) : ''
    return {
      title: 'PTI — შემოსავლის რა წილი მიდის სესხებზე',
      body,
      // NBG Financial Stability Committee decision of 30 Sep 2026 (georgiatoday.ge, civil.ge/archives/753059): the limit is checked when a loan is issued
      more: `${formula} ბანკი მას სესხის გაცემისას ამოწმებს: დღეს აღებულ სესხს დღევანდელი ლიმიტი ეხება. ეროვნული ბანკის კომიტეტის 2026 წლის 30 სექტემბრის გადაწყვეტილებით, 1 500 ₾-მდე შემოსავალზე ლიმიტი უკვე 25%-ია; 1 500–1 999 ₾-ზე ახლა 50%-ია, 2027 წლის 1 თებერვლიდან ახალ სესხებზე — 25%; 2 000–2 499 ₾-ზე 25% 2027 წლის 1 სექტემბრიდან იქნება.`,
      // today's limit and the date of the lower one on the visible card line (never a 2027 limit shown as if it applied now)
      mine: `შენი შენატანები ახლა: ${gel(debt)} თვეში → PTI ${now}%. ${ptiLimitMine(p)}`,
      rule: 'თუ PTI-ის ლიმიტში ჯდები, ეს არ ნიშნავს, რომ თვეს გაუძლებ — PTI შენს ხარჯებს და გადახდის თარიღებს ვერ ხედავს.',
      answer: /ჩემი|ჩემს|ახლა რამდენ|რამდენი მაქვს/.test(raw) && !deal ? `შენი PTI ახლა ${now}%-ია: სესხებზე თვეში ${gel(debt)} მიდის ${gel(p.salary)}-დან.`
        : deal && fitsQ ? `ამ ${deal.kind === 'loan' ? 'სესხით' : 'განვადებით'} PTI ~${ptiRange(deal)}% იქნება (ახლა ${now}%): ${fitsText}`
        : deal ? `ამ ${deal.kind === 'loan' ? 'სესხით' : 'განვადებით'} PTI ${ptiRange(deal)}% იქნება — ახლა ${now}%-ია. ${dealOver ?? `${ptiLimitShort(p)}.`}`
          // "PTI 25% ყველა სესხზე ვრცელდება?": PTI counts every loan together; the limit depends on income and date
          : /ყველა სესხ|ყველაზე ვრცელდ|ყველას ეხება|ვრცელდება/.test(raw) ? `PTI ერთ სესხს კი არა, ყველა სესხისა და განვადების შენატანს ერთად ითვლის. ${ptiLimitText(p)}`
          : /ლიმიტ|ეროვნულ|წეს/.test(raw) ? `PTI სესხების თვიური შენატანია შემოსავლის წილად. ${ptiLimitText(p)}`
            : /ხელფას|შემოსავ|ნორმალურ|რამდენი პროცენტ|რა წილ|რა ნაწილ/.test(raw) ? `ამას PTI ზომავს: სესხების თვიური შენატანი შემოსავლის წილად. ${ptiLimitShort(p)} — შენი ახლა ${now}%-ია.`
              // right after a deal: its PTI too
              : ctxDeal && `${body} ამ ${ctxDeal.kind === 'loan' ? 'სესხით' : 'განვადებით'} შენი PTI ~${ptiRange(ctxDeal)}% იქნება.`.length <= 160 ? `${body} ამ ${ctxDeal.kind === 'loan' ? 'სესხით' : 'განვადებით'} შენი PTI ~${ptiRange(ctxDeal)}% იქნება.` : undefined,
      info: formula,
      simple: `მარტივად: ხელფასის რა ნაწილი მიდის სესხების შენატანზე. შენთან ახლა ${gel(debt)} ${gel(p.salary)}-დან — ${now}%.`,
      example: `მაგალითად: ${gel(p.salary)} ხელფასზე ${limitCap}%-იანი ლიმიტი${lim.later ? ` (${lim.from})` : ''} ნიშნავს, რომ ყველა სესხის შენატანი ჯამში თვეში ${gel(p.salary * limitCap / 100)}-ს ვერ გადააჭარბებს.`,
      why: 'რატომ: ამით ბანკი ამოწმებს, დაფარავ თუ არა სესხს. შენს ყოველდღიურ ხარჯს ის ვერ ხედავს — ამას ფერადი თვეები აჩვენებს.',
    }
  },
  eir: (e, p, q, ctx) => {
    const raw = q.raw.toLowerCase()
    const d = isDeal(ctx) ? buildDeal(e, p, ctx, ctx.kind) : undefined
    const t = d?.rows.find(r => r.ratePerMonth > 0)
    // "რეკლამაში 14%, ხელშეკრულებაში 21%": the user's own two numbers. A yearly rate paid monthly is (1 + r/12)^12 − 1 as an effective rate;
    // what is left of the gap comes from fees or mandatory insurance (NBG order 194/04 annex 1: the EIR counts every required cost)
    const pcts = (q.raw.match(/\d+(?:[.,]\d+)?\s*%/g) ?? []).map(x => Number(x.replace(/\s*%/, '').replace(',', '.')))
    const adGap = /რეკლამ|ხელშეკრულებ|წერს|წერია|ეწერა/.test(raw) && pcts.length >= 2 && pcts[1] > pcts[0] ? (() => {
      const [a, b] = pcts
      const monthly = a <= 4 && /თვე|თვიურ/.test(raw)
      const eff = (monthly ? Math.pow(1 + a / 100, 12) - 1 : Math.pow(1 + a / 1200, 12) - 1) * 100
      const gap = b - eff
      return `${fmt(a, a % 1 ? 1 : 0)}% ${monthly ? 'თვეში' : 'წლიური, თვიური გადახდით,'} ეფექტურად ~${fmt(eff, 1)}%-ია — ${gap > 0.3 ? `${fmt(b, b % 1 ? 1 : 0)}%-მდე დარჩენილი ~${fmt(gap, 1)} პუნქტი საკომისიოებიდან ან სავალდებულო დაზღვევიდან მოდის.` : 'სხვაობას თითქმის მთლიანად თვიური გადახდის წესი ხსნის.'}`
    })() : undefined
    // NBG consumer-protection rule 32/04 art. 3(15) and 7(2)(კ) (matsne.gov.ge/ka/document/download/5117792/10/ge/pdf): an ad that names a price must show the EIR too, in the same font
    const adRule = 'ეროვნული ბანკის წესით, რეკლამაში თვიური ან სხვა განაკვეთის გვერდით ეფექტური განაკვეთიც იწერება, იმავე ზომის შრიფტით.'
    // nominal against effective, with the deal on the table or the 1,5%-a-month example; a 2% up-front fee shows how a fee raises the effective rate
    const exRate = t ? t.ratePerMonth : 0.015, exPrice = d && t ? d.price - d.upfront : 1200, exMonths = t ? t.months : 12
    const nominal = exRate * 12 * 100, effective = (Math.pow(1 + exRate, 12) - 1) * 100
    const withFee = eirWithFee(exPrice, exRate, exMonths, 0.02)
    const pct1 = (v: number) => fmt(Math.round(v * 10) / 10, Math.round(v * 10) % 10 ? 1 : 0)
    const whyHigher = /რატომ/.test(raw) && /ნომინალ|მაღალ|მეტია|მეტი/.test(raw)
    const contract = 'ხელშეკრულებაში ეფექტური განაკვეთი წერია: მასში შედის პროცენტი, საკომისიოები და სავალდებულო დაზღვევა, დაგვიანების ჯარიმა კი — არა.'
    return {
      title: 'ეფექტური წლიური განაკვეთი',
      // the EIR is the yearly rate at which all payments (fees included) equal the money received, never "interest on interest" (NBG order 194/04)
      body: 'ეფექტური განაკვეთი სესხის სრული წლიური ფასია: ერთ რიცხვში ითვლის პროცენტს, საკომისიოებს და სავალდებულო დაზღვევას, გადახდების დროის გათვალისწინებით.',
      more: '1,5% თვეში წლიურად 18% ჩანს, ეფექტურად კი ~19,6%-ია (1,015¹² ≈ 1,196): თვიური ფასი წლიურზე ასე გადაიყვანება, რომ სხვადასხვა სესხი ერთ საზომზე შედარდეს.',
      mine: d && t ? `${d.what}, ${t.months} თვით (${d.rateTxt}): თვეში ${gel(Math.round(t.monthly))}, ჯამში ${gel(t.total + d.upfront)}${d.upfront ? ` (${gel(d.upfront)} წინასწარის ჩათვლით)` : ''}. აქედან ${gel(t.cost)} სესხის ფასია.`
        : '1 200 ₾ 12 თვით, 1,5%-ით: თვეში 110 ₾, ჯამში 1 320 ₾. აქედან 120 ₾ სესხის ფასია.',
      rule: 'სესხის ფასს ეფექტური განაკვეთი და ჯამური თანხა აჩვენებს — თვიური შენატანი მარტო არა.',
      // Civil Code art. 625(2) and (3¹), consolidated 25/06/2026: the 50% cap applies to every kind of loan
      answer: /50\s?%/.test(raw) && /მეტი|აჭარბ|შეიძლება|ზღვარ|ლიმიტ|მაქსიმ|კანონ/.test(raw) ? 'არა: საქართველოში კანონით ნებისმიერი სესხის წლიური ეფექტური განაკვეთი 50%-ს ვერ გადააჭარბებს — ბანკის, მიკროსაფინანსოს, ლომბარდისა თუ კერძო სესხის.'
        : /კანონ|ლეგალ|დაშვებ/.test(raw) && q.ratePct !== undefined && q.ratePct !== 50 ? (() => {
          const eff = (q.rateIsAnnual ? Math.pow(1 + q.ratePct! / 1200, 12) - 1 : Math.pow(1 + q.ratePct! / 100, 12) - 1) * 100
          const r = `${fmt(q.ratePct!, q.ratePct! % 1 ? 1 : 0)}%${q.rateIsAnnual ? ' წლიური, თვიური გადახდით,' : ' თვეში'}`
          return eff > 50 ? `არა: ${r} ეფექტურად ~${eff > 1000 ? '1 000%-ზე მეტია' : `${fmt(Math.round(eff))}%-ია`}, კანონით კი ნებისმიერი სესხის წლიური ეფექტური განაკვეთი 50%-ს ვერ გადააჭარბებს.`
            : `${r} ეფექტურად ~${fmt(eff, 1)}%-ია — კანონით დაშვებულ 50%-იან ზღვარში ჯდება, თუ საკომისიოები ეფექტურ განაკვეთს 50%-ზე მაღლა არ წევს.`
        })()
        : /კანონ|ლეგალ|დაშვებულ/.test(raw) ? 'საქართველოში კანონით ნებისმიერი სესხის წლიური ეფექტური განაკვეთი 50%-ს ვერ გადააჭარბებს — ბანკის, მიკროსაფინანსოს, ლომბარდისა თუ კერძო სესხის.'
        : whyHigher ? `რადგან ეფექტური ითვალისწინებს, რომ პროცენტს ყოველთვე იხდი, და უმატებს საკომისიოებს და დაზღვევას: ${pct1(nominal)}% წლიური ეფექტურად ~${pct1(effective)}%-ია.`
        : d && t && /რამდენ|გამოდის|ამ |ეს |ამის/.test(raw) ? `ამ ${d.kind === 'loan' ? 'სესხის' : 'განვადების'} ეფექტური წლიური განაკვეთი ~${fmt(t.eirPct, 1)}%-ია: ${t.months} თვეში სესხის ფასი ${gel(t.cost)}-ია.`
        : adGap ?? (/რეკლამ|ხელშეკრულებ/.test(raw) ? adRule
          : /ნომინალ/.test(raw) ? 'ნომინალური განაკვეთი მხოლოდ პროცენტია. ეფექტური — სესხის სრული წლიური ფასი: პროცენტი, საკომისიოები და სავალდებულო დაზღვევა, გადახდების დროის გათვალისწინებით.'
            : !/ეფექტურ|eir/.test(raw) && /განაკვეთ/.test(raw) ? 'საპროცენტო განაკვეთი სესხის ფასია: ნასესხები თანხის რა პროცენტს იხდი წელიწადში. ეფექტური განაკვეთი ამას საკომისიოებსაც უმატებს.' : undefined),
      info: /რეკლამ|ხელშეკრულებ/.test(raw) ? joinInfo(adGap ? adRule : undefined, contract) : undefined,
      chips: ['რა არის რთული პროცენტი?', '2 000 ₾ სესხი 24 თვით 18%-ით'],
      simple: 'მარტივად: ეს სესხის ნამდვილი ფასია წელიწადში — ყველა პროცენტისა და საკომისიოს ჩათვლით.',
      // the contrast the question is about: nominal against effective, and what a fee adds
      example: `მაგალითად: ${d && / წლიური$/.test(d.rateTxt) ? `${pct1(nominal)}% წლიური ნომინალურია, თვიური გადახდით ეფექტურად — ~${pct1(effective)}%` : `${pct1(exRate * 100)}% თვეში ნომინალურად წლიური ${pct1(nominal)}%-ია, ეფექტურად — ~${pct1(effective)}%`}. 2%-იანი საკომისიოთი ${gel(exPrice)}-ზე ${exMonths} თვით ეფექტური ~${pct1(withFee)}%-მდე იზრდება.`,
      why: 'რატომ: თვიური შენატანი ან თვიური განაკვეთი სესხის ფასს ბოლომდე არ აჩვენებს. ეფექტური განაკვეთით სხვადასხვა სესხის ფასი ერთ საზომზე ჩანს.',
    }
  },
  compound: () => ({
    title: 'რთული პროცენტი',
    body: 'მარტივი პროცენტი მხოლოდ საწყის თანხას ერიცხება, რთული — უკვე დარიცხულ პროცენტსაც.',
    more: '1 000 ₾ წლიური 10%-ით, 20 წელიწადში: მარტივით 3 000 ₾ დაგროვდება, რთულით — 6 727 ₾. სხვაობა 3 727 ₾-ია.',
    // an amortising loan charges interest on the remaining principal only (no interest on interest): a long term costs more because interest runs for more months
    mine: 'სესხზე პროცენტი დარჩენილ ვალს ერიცხება: რაც უფრო გრძელია ვადა, მით მეტ თვეს იხდი პროცენტს — ამიტომ გრძელი ვადა ჯამში ძვირია.',
    rule: 'დრო დანაზოგს ზრდის, სესხს კი აძვირებს: რაც უფრო გრძელია ვადა, მით დიდია სხვაობა.',
    chips: ['რა არის ეფექტური განაკვეთი?', 'რა არის ანაბარი?'],
    simple: 'მარტივად: პროცენტს პროცენტიც ერიცხება, ამიტომ თანხა დროთა განმავლობაში სულ უფრო სწრაფად იზრდება.',
    example: 'მაგალითად: 1 000 ₾ 10%-ით — 1 წლის შემდეგ 1 100 ₾, 2 წლის შემდეგ 1 210 ₾. მეორე წელს 100-ის ნაცვლად 110 ₾ დაემატა.',
    why: 'რატომ: დრო დანაზოგს სულ უფრო სწრაფად ზრდის — რაც ადრე იწყება დაზოგვა, მით მეტი გროვდება.',
  }),
  cushion: (e, p) => ({
    title: 'უსაფრთხო ზღვარი (ბალიში)',
    body: 'უსაფრთხო ზღვარი არის თანხა, რომელზე ნაკლები ხელფასამდე არ გინდა დაგრჩეს.',
    more: 'თავიდან ის შენი 3 დღის ჩვეული ხარჯია — დაახლოებით ერთი შაბათ-კვირა და კიდევ ერთი დღე. შეგიძლია 2-დან 7 დღემდე შეცვალო.',
    mine: `შენი ზღვარი: ${gel(e.cushion)} (3 დღე × ~${gel(Math.round(e.avgDaily))}).`,
    rule: 'ამინდი გიჩვენებს, რა შანსია, რომ ზღვარს ქვემოთ ჩახვალ: მზე — 10%-ზე ნაკლები, ღრუბელი — 10–30%, წვიმა — 30–60%, ქარიშხალი — 60%-ზე მეტი.',
    chips: ['ხელფასამდე მეყოფა?', WEATHER_CHIP],
    simple: `მარტივად: ზღვარი ის თანხაა, რომელიც ხელფასის დღეს მაინც გინდა გქონდეს. შენი ზღვარი ${gel(e.cushion)}-ია.`,
    example: `მაგალითად: დღეში ჩვეულებრივ ~${gel(Math.round(e.avgDaily))}-ს ხარჯავ, 3 დღეში — ~${gel(e.cushion)}. ესაა შენი ზღვარი.`,
    why: 'რატომ: მოულოდნელ ხარჯს ან ხელფასის დაგვიანებას ეს ფული ფარავს — სესხის გარეშე.',
  }),
  weather: (e, p, q) => {
    const raw = q.raw.toLowerCase()
    return {
      title: 'როგორ ვითვლი ამინდს',
      body: 'ხელფასამდე დარჩენილ დღეებს 1 000 შესაძლო სცენარით ვითვლი, ამიტომ გაჩვენებ შუალედს და არა ერთ რიცხვს.',
      more: `სცენარები შენს ბოლო ${p.historyMonths} თვის ხარჯებს ეყრდნობა: ვპოულობ განმეორებად გადასახადებს და ვნახულობ, კვირის რომელ დღეს რამდენს ხარჯავ. ხელოვნური ინტელექტი არცერთ რიცხვს არ იგონებს.`,
      mine: `ახლა: ${rangeText(r10(e.landing.p10), r10(e.landing.p90))}, ყველაზე სავარაუდოდ ~${fmt(r10(e.landing.p50))} ₾. ამინდი — ${WEATHER_LABEL[e.landing.weather]}.`,
      rule: 'შემდეგი ხელფასის მიღმა პროგნოზი მიახლოებითია: ვვარაუდობ, რომ შენი ბოლო თვეები განმეორდება.',
      answer: /ზუსტ|სიზუსტ|სანდო|ცდები|შეცდ|დაგიჯერ|accura/.test(raw) ? `ზუსტ რიცხვს არ გპირდები: 1 000 სცენარს ვითვლი. ხელფასამდე სავარაუდოდ ${rangeText(r10(e.landing.p10), r10(e.landing.p90))} დაგრჩება — სცენარების 80% ამ შუალედშია.`
        : /ღრუბ|მზე|მზიან|წვიმ|ქარიშხ|ხატულ|იკონ|ამინდ\S* რას ნიშნავ/.test(raw) ? 'ამინდი გიჩვენებს, რა შანსია, რომ ხელფასამდე ზღვარს ქვემოთ ჩახვალ: ☀ — 10%-მდე, 🌥 — 10–30%, 🌧 — 30–60%, ⛈ — 60%-ზე მეტი.' : undefined,
      info: /ზუსტ|სიზუსტ|სანდო|ცდები|შეცდ|დაგიჯერ|accura/.test(raw) ? `ვეყრდნობი შენი ბოლო ${p.historyMonths} თვის ხარჯებს და ყველა რიცხვს ფორმულით ვითვლი. მოულოდნელ დიდ ხარჯს წინასწარ ვერ დავინახავ — ამიტომ გაჩვენებ შუალედს.` : undefined,
      chips: ['ხელფასამდე მეყოფა?', 'ჩემს ტრანზაქციებს საიდან იღებ?'],
      simple: 'მარტივად: ☀ — ხელფასამდე ფული თითქმის ნამდვილად გეყოფა, ⛈ — დიდი შანსია, რომ ზღვარზე ნაკლები დაგრჩება.',
      example: `მაგალითად: ახლა ამინდი ${WEATHER_LABEL[e.landing.weather]}ა — 10 მსგავსი თვიდან ${e.landing.inTen}-ში ხელფასამდე ზღვარზე ნაკლები გრჩება.`,
      why: 'რატომ შუალედი: ყოველდღიური ხარჯი იცვლება. ერთი რიცხვი ზედმეტ სიზუსტეს დაგპირდებოდა.',
    }
  },
  zero: (e, p, q, ctx) => {
    // the deal on the table keeps its term: 0% against its rate, and the monthly sum against the usual month-end surplus
    const dl = isDeal(ctx) ? buildDeal(e, p, ctx, ctx.kind) : undefined
    const paid = dl?.rows.find(r => r.ratePerMonth > 0)
    const a = dl ? dl.price - dl.upfront : 1200
    const m = paid ? paid.months : ctx.months ?? 4
    const ms = Math.round(e.medianSurplus)
    const per0 = Math.round(a / m)
    const mine = `${gel(a)} ${m} თვით 0%-ით ≈ ${gel(per0)}/თვე${paid ? ` (${rateInstr(dl!.rateTxt)} ~${gel(Math.round(paid.monthly))})` : ''}. შენთან თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} რჩება${per0 > ms ? ` — შენატანი ამას ~${gel(per0 - Math.max(0, ms))}-ით აჭარბებს` : ''}.`
    return {
      title: '0%-იანი განვადება',
      // the term depends on the offer (often 6–24 months), so "short term, big payment" is not a general rule
      body: '0%-იან განვადებაზე პროცენტს არ იხდი — ფასს ნაწილ-ნაწილ იხდი. ვადა შეთავაზებაზეა დამოკიდებული: რაც მოკლეა, მით დიდია თვიური შენატანი.',
      more: 'თუ ნივთის ნაღდი ფასი განვადების ჯამზე ნაკლებია, სხვაობა განვადების ფარული ფასია — ის ნივთის ფასში ან საკომისიოშია.',
      mine,
      rule: '„იაფი" და „ჩემს თვეში ჯდება" სხვადასხვა კითხვაა.',
      answer: /მართლა|უფასო|დამალ|ფარულ|რატომ/.test(q.raw.toLowerCase()) ? 'პროცენტს არ იხდი, მაგრამ ხარჯი შეიძლება ნივთის ფასში ან საკომისიოში იყოს — ამას ნაღდი ფასისა და განვადების ჯამის შედარება აჩვენებს.' : undefined,
      // NBG rule 32/04 art. 7(2)(კ): the contract states the EIR, fees included
      info: 'ხელშეკრულებაში ეფექტური განაკვეთი წერია: თუ ის 0%-ზე მეტია, განვადებას საკომისიო ან სხვა ხარჯი აქვს. ვადა შეთავაზებაზეა დამოკიდებული, მაგალითად 6 ან 12 თვე.',
      chips: ['რა არის ეფექტური განაკვეთი?', 'დღეს რამდენი შემიძლია?'],
      simple: 'მარტივად: პროცენტი არ ემატება; რაც მოკლეა ვადა, მით დიდია თვიური შენატანი.',
      example: `მაგალითად: ${mine}`,
      why: 'რატომ შედარება: თუ ნაღდი ფასი განვადების ჯამზე ნაკლებია, სხვაობა სწორედ განვადების ფასია.',
    }
  },
  installment: (e, p, q) => ({
    answer: /ახლა იყიდე|მერე გადაიხადე|bnpl|buy now/.test(q.raw.toLowerCase()) ? '„ახლა იყიდე, მერე გადაიხადე" განვადების ერთ-ერთი სახეა: ნივთს ახლა იღებ, ფასს ნაწილ-ნაწილ იხდი. ესეც ვალია და PTI-ში ითვლება.'
      : /ჯობ|სჯობ|განსხვავ|უკეთეს|рассрочк|кредит/.test(q.raw.toLowerCase()) ? 'განვადებით ნივთს ყიდულობ, სესხით — ფულს იღებ. ორივე ვალია: რომელი უფრო იაფია, ჯამური თანხა და ეფექტური განაკვეთი აჩვენებს.'
        : /(?:^|[^ა-ჰ])სესხი? (?:რა არის|რას ნიშნავს|რაა)|რა არის სესხი(?![ა-ჰ])/.test(q.raw.toLowerCase()) ? 'სესხი ნასესხები ფულია, რომელსაც ყოველთვე ნაწილ-ნაწილ და პროცენტით აბრუნებ. განვადებაც სესხია — ოღონდ კონკრეტული ნივთის საყიდლად.' : undefined,
    chips: ['რა არის ეფექტური განაკვეთი?', 'რა არის PTI?'],
    title: 'განვადება და სესხი',
    body: 'განვადება კონკრეტული ნივთის საყიდლად აღებული სესხია, ხშირად მაღაზიაშივე.',
    more: 'ჩვეულებრივ სესხს კი ფულად იღებ. ორივეზე თვიურ შენატანს იხდი და ორივე PTI-ში ითვლება.',
    mine: 'სანამ ხელს მოაწერ, მკითხე — ყველა ვადას შენს თვეებზე გაჩვენებ.',
    rule: 'ვარიანტებს ერთმანეთს ჯამური ფასი, ეფექტური განაკვეთი და ის თვეები ადარებს, როცა ფული შეიძლება არ გეყოს.',
    simple: 'მარტივად: განვადებით ნივთს ახლა იღებ და ფასს ნაწილ-ნაწილ იხდი, სესხით კი ფულს იღებ. ორივე ვალია.',
    example: 'მაგალითად: 1 200 ₾-ის ტელეფონი 12 თვით, 1,5%-ით — თვეში 110 ₾, ჯამში 1 320 ₾.',
    why: 'რატომ: ორივე PTI-ში ითვლება და ყოველთვიურ ბიუჯეტს ერთნაირად ამცირებს.',
  }),
  overdraft: (e, p, q) => ({
    // a small example with an example rate (no real overdraft rate is claimed); the 50% cap and "no early-repayment fee on an overdraft" are law
    // (Civil Code art. 625(2); NBG rule 32/04 art. 11)
    ...(() => {
      const s = q.raw.toLowerCase()
      const used = p.overdraft ? p.overdraft.used : 300
      const ex = `${p.overdraft ? `შენი ${gel(used)}` : `${gel(used)}`} სამაგალითო 24%-იანი წლიური განაკვეთით თვეში ~${gel(Math.round(used * 0.02))}-ია, წელიწადში — ~${gel(Math.round(used * 0.24))}`
      const why = /რატომ\S*.*ძვირ|ძვირი? რატომ/.test(s)
      const cost = /რამდენი? ჯდება|რა ღირს|რა ფასი|ძვირ|ღირებულ/.test(s)
      const facts = 'ზუსტ განაკვეთს და საკომისიოს ხელშეკრულება აჩვენებს; ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს. გამოუყენებელ ლიმიტზე პროცენტი ჩვეულებრივ არ ერიცხება, ვადამდე დაფარვის საკომისიო კი ოვერდრაფტზე არ ეკისრება.'
      // "ოვერდრაფტი გავხსნა / ავიღო?": the person's own data first, then what it costs (the choice stays theirs)
      const take = !why && !cost && /გავხსნა|ავიღო|ვისარგებლო|გამოვიყენო|ჩავრთო|გავაკეთო|გავიხსნა/.test(s)
      // "ოვერდრაფტი როგორ დავფარო?": step by step, with the person's own overdraft
      const payOff = /დავფარო|დაფარვ|გამოვიდე|მოვიშორო|დავხურო|გავისტუმრო/.test(s)
      if (payOff) return {
        answer: p.overdraft
          ? `ოვერდრაფტი ჩვეულებრივ ეტაპობრივად იფარება: შენთან ${gel(p.overdraft.used)}-ია გამოყენებული. თვეში 50 ₾-ით ~${Math.ceil(p.overdraft.used / 50)} თვე დასჭირდება, პროცენტის გამო ცოტა მეტი.`
          : 'შენს მონაცემებში ოვერდრაფტი არ ჩანს. ზოგადად ის ეტაპობრივად იფარება: ყოველ ხელფასზე ნაწილის დაფარვით ვალი თვიდან თვემდე მცირდება.',
        info: `${facts} ყოველ ხელფასზე ერთი და იგივე თანხის დაფარვა ვალს თანდათან ამცირებს; ახალი ხარჯი ოვერდრაფტიდან ამ პროცესს აჩერებს.`,
      }
      if (take) return {
        answer: p.overdraft
          ? `ოვერდრაფტი უკვე გაქვს: გამოყენებულია ${gel(p.overdraft.used)} ${gel(p.overdraft.limit)}-დან, დარჩენილია ~${gel(p.overdraft.limit - p.overdraft.used)}. ის ბანკის ფულია და პროცენტი ხშირად დღიურად ერიცხება.`
          : `შენს მონაცემებში ოვერდრაფტი არ ჩანს: ხელფასამდე სავარაუდოდ ${leftOrShort(e.landing.p50)} — საკუთარი ფულით. ოვერდრაფტი ვალია და პროცენტი ხშირად დღიურად ერიცხება.`,
        info: `მაგალითად, ${ex}. ${facts}`,
      }
      return {
        answer: why ? 'ოვერდრაფტი ბანკის ფულია, რომლითაც ნულს ქვემოთ ჩადიხარ. ძვირი ხშირად იმიტომ ჯდება, რომ პროცენტი დღიურად ერიცხება და ვალი თვიდან თვემდე რჩება.'
          : cost ? `პროცენტი გამოყენებულ თანხას ერიცხება, ხშირად დღიურად: მაგალითად, ${ex}.` : undefined,
        info: why ? `მაგალითად, ${ex}. ${facts}` : cost ? facts : undefined,
      }
    })(),
    title: 'ოვერდრაფტი',
    body: 'ოვერდრაფტი ბანკის ფულია, რომლითაც ანგარიშზე ნულს ქვემოთ შეგიძლია ჩახვიდე.',
    more: 'პროცენტი დღიურად ერიცხება და ხშირად მაღალია. მას შენს ფულად არ ვთვლი — ცალკე გაჩვენებ.',
    // the person's own data: an overdraft in use, or none at all (then nothing assumes one)
    mine: p.overdraft ? `ახლა იყენებ ${gel(p.overdraft.used)}-ს ${gel(p.overdraft.limit)}-იანი ლიმიტიდან. კარგი თვე ასე გამოიყურება: ხელფასამდე გამოყენებული ოვერდრაფტი წინა თვეზე ნაკლებია.` : `შენს მონაცემებში ოვერდრაფტი არ ჩანს: ხელფასამდე სავარაუდოდ ${leftOrShort(e.landing.p50)} — საკუთარი ფულით.`,
    rule: 'ოვერდრაფტი გადაუდებელი დახმარებაა და არა ხელფასის ნაწილი.',
    chips: p.overdraft ? ['ოვერდრაფტი რა ღირს?', 'როგორ გავთიშო?'] : ['ოვერდრაფტი რა ღირს?', 'რა არის გადაუდებელი ფონდი?'],
    steps: p.overdraft ? `ვარიანტები: ყოველ ხელფასზე გამოყენებული ${gel(p.overdraft.used)}-ის ნაწილის დაფარვა; ლიმიტის შემცირება ბანკთან; ხარჯის ნახვა — სად მიდის ფული.` : 'ოვერდრაფტის გახსნამდე მნიშვნელოვანია: მისი განაკვეთი და საკომისიო, ლიმიტი და რამდენ ხანში დაიფარება გამოყენებული თანხა.',
    simple: 'მარტივად: ბანკის ფულია, რომლითაც ანგარიშზე ნულს ქვემოთ ჩადიხარ — და მას პროცენტი ემატება.',
    example: p.overdraft ? `მაგალითად: ახლა ${gel(p.overdraft.used)} გაქვს გამოყენებული ${gel(p.overdraft.limit)}-დან — ეს ბანკის ფულია და მას პროცენტი ერიცხება.` : 'მაგალითად: ანგარიშზე 0 ₾ გაქვს და 50 ₾-ს იხდი — ბანკი ამ 50 ₾-ს გასესხებს და პროცენტს დაარიცხავს.',
    why: 'რატომ: ოვერდრაფტი ხშირად ხელფასის ნაწილი ჰგონიათ, თუმცა ის ვალია.',
  }),
  deposit: (e, p, q) => {
    const s = q.raw.toLowerCase()
    const ins = /გაკოტრ|დაზღვ|დაიკარგ/.test(s)
    const tax = /გადასახად|იჭრება|ჭრიან|იბეგრ|ბეგრ|საშემოსავლო|აკავებ/.test(s)
    const worth = /რამდენად ღირს|ღირს თუ არა|ღირს\?|რა სარგებ|რამდენს მოიტანს|რას მოიტანს|მომიტანს|რა მოგება|რამდენი მოგება|მომგებიან|მოვიგებ|რამდენს მივიღებ|რამდენი დამერიცხება/.test(s)
    const sample = p.savings?.amount ?? 1000
    // Deposit insurance: 50 000 ₾ per depositor per bank or microbank from 1 Apr 2026, interest included
    // (deposit insurance law art. 17, matsne.gov.ge/ka/document/view/3679200; agency order 32/ნ, matsne.gov.ge/ka/document/view/6629746; parliament.ge news 27 Apr 2026)
    const insured = 'ბანკში ან მიკრობანკში ანაბარი 2026 წლის 1 აპრილიდან 50 000 ₾-მდეა დაზღვეული: თითო ბანკში, თითო მეანაბრეზე, დარიცხული პროცენტის ჩათვლით.'
    // the sum named in the question ("450 ლარის ანაბარი მაქვს"), else the person's own saving pot; the bank is never named
    const insAmt = q.amount ?? p.savings?.amount
    const mineInsured = insAmt !== undefined && insAmt <= 50000 ? `შენი ${gel(insAmt)}-იანი ანაბარი 50 000 ₾-იან ზღვარზე ${insAmt < 25000 ? 'ბევრად ' : ''}ნაკლებია, ანუ სრულად დაზღვეულია.` : undefined
    // Tax Code art. 131(5), consolidated 15/10/2026 (matsne.gov.ge/ka/document/download/1043717/247/ge/pdf): interest from a licensed bank or microbank is not taxed for individuals
    const untaxed = 'ბანკსა ან მიკრობანკში ანაბრის სარგებელი ფიზიკური პირისთვის გადასახადით არ იბეგრება: სარგებელი სრულად შენ გრჩება.'
    return {
      title: 'ანაბარი',
      body: 'ანაბარი ბანკში შენახული ფულია, რომელსაც პროცენტი ერიცხება.',
      more: 'ვადიან ანაბარზე განაკვეთი ჩვეულებრივ უფრო მაღალია, მაგრამ ფულის ვადამდე გატანისას პროცენტის ნაწილი შეიძლება დაიკარგოს.',
      mine: ins && mineInsured ? mineInsured : p.savings ? `შენი ქვევრი „${p.savings.name}": ${gel(p.savings.amount)} / ${gel(p.savings.target)}.` : 'ყოველ ხელფასზე პატარა თანხის გადადებაც — თუნდაც 20–50 ₾ — ჩვევას ქმნის.',
      rule: ins ? 'დაზღვევა თითო ბანკში ცალ-ცალკე ითვლება: ორ ბანკში — თითოეულში 50 000 ₾-მდე.' : 'ხელფასის დღეს გადადებული თანხა ხშირად მეტია, ვიდრე თვის ბოლოს დარჩენილი.',
      answer: ins ? (q.amount !== undefined && q.amount <= 50000 ? `კი: ბანკში ან მიკრობანკში ანაბარი 50 000 ₾-მდეა დაზღვეული, დარიცხული პროცენტის ჩათვლით — შენი ${gel(q.amount)} სრულად დაზღვეულია.` : insured)
        : tax ? untaxed
        : worth ? `სარგებელი განაკვეთზეა დამოკიდებული: მაგალითად, ${p.savings ? `შენი ${gel(sample)}` : gel(sample)} წლიური 10%-ით (სამაგალითო) წელიწადში ~${gel(Math.round(sample * 0.1))}-ს მოიტანს.`
        : /ინფლაცი/.test(s) ? 'ანაბარი ინფლაციისგან მაშინ იცავს, როცა მისი წლიური განაკვეთი ინფლაციაზე მაღალია: 10%-იანი ანაბარი და 5%-იანი ინფლაცია ≈ 5% რეალური ზრდა.' : undefined,
      info: ins ? joinInfo(q.amount !== undefined ? insured : mineInsured, 'მანამდე ზღვარი 30 000 ₾ იყო.')
        : tax ? `მაგალითად: ${gel(sample)} სამაგალითო 10%-ით წელიწადში ~${gel(Math.round(sample * 0.1))}-ს მოიტანს — მთლიანად შენ.`
        : worth ? `${untaxed} ანაბარი 50 000 ₾-მდეა დაზღვეული. რეალური ზრდა ინფლაციაზეც არის დამოკიდებული: 10%-იანი ანაბარი და 5%-იანი ინფლაცია ≈ 5%.` : undefined,
      chips: ['რა არის გადაუდებელი ფონდი?', 'რა არის ინფლაცია?'],
      simple: 'მარტივად: ფულს ბანკში ტოვებ და ბანკი ამისთვის პროცენტს გიხდის.',
      example: 'მაგალითად: 1 000 ₾ წლიური 10%-ით წლის ბოლოს ~1 100 ₾ გახდება — ბანკში სარგებელი არ იბეგრება.',
      why: 'რატომ: ანაბარზე შემოსავალი წინასწარ ცნობილია და 50 000 ₾-მდეა დაზღვეული; ფული ინფლაციისგან ნაწილობრივ დაცულია.',
    }
  },
  emergency: (e, p, q) => {
    const monthly = p.salary - e.medianSurplus // fixed bills + the usual variable spending
    const cash = e.spendable + (p.savings?.amount ?? 0)
    const days = Math.floor(cash / (monthly / 30))
    const have = `ანგარიშზე არსებული ${gel(e.spendable)}${p.savings ? ` და დანაზოგი ${gel(p.savings.amount)}` : ''}`
    const runway = /სამსახურ|უმუშევარ|ხელფასის გარეშე|ხელფასი რომ|შემოსავლის გარეშე|გამათავისუფლ|გავძლებ/.test(q.raw.toLowerCase())
    // the label and the number match: essential = the monthly bills, the upper figure = all usual spending (bills + everyday spending)
    const bills3 = r10(e.fixedTotal * 3), all3 = r10(monthly * 3)
    const howMuch = !runway && /რამდენი|რა ოდენობ|რამდენ თვ|რამხელა/.test(q.raw.toLowerCase())
    // a job just lost: a short acknowledgement, the money there is (and a bill named with it), then neutral options
    if (q.jobLoss) {
      const total = Math.round(cash)
      const dm = q.raw.match(/(\d{1,2})\s*-?\s*ში/)
      const bill = q.amount !== undefined && q.amount < total * 4 ? q.amount : undefined
      const billWord = /ქირ/.test(q.raw) ? 'ქირის' : 'გადასახადის'
      const answer = bill !== undefined
        ? (total >= bill ? `მესმის, რომ მძიმეა. ${have} — ჯამში ${gel(total)}; ${dm ? `${dm[1]}-ში ` : ''}${billWord} (${gel(bill)}) შემდეგ ~${gel(total - bill)} რჩება სხვა ხარჯისთვის.`
          : `მესმის, რომ მძიმეა. ${have} — ჯამში ${gel(total)}: ${billWord} (${gel(bill)}) დასაფარად ~${gel(bill - total)} აკლია.`)
        : `მესმის, რომ მძიმეა. ${have} ჩვეული ხარჯით დაახლოებით ${days} დღეს გეყოფა.`
      return {
        title: 'სამსახურის დაკარგვისას',
        body: answer,
        answer: answer.length <= 160 ? answer : `მესმის, რომ მძიმეა. ${have} ჩვეული ხარჯით დაახლოებით ${days} დღეს გეყოფა.`,
        more: 'ფონდის გარეშე მოულოდნელი ხარჯი ხშირად სესხით ან ოვერდრაფტით იფარება — და მას პროცენტი ემატება.',
        mine: `ჩვეული ხარჯით (თვეში ~${gel(r10(monthly))}) ${gel(total)} დაახლოებით ${days} დღეს ჰყოფნის.`,
        rule: 'სესხის შენატანზე საუბარი ბანკთან ვადის გადაცილებამდე მეტ არჩევანს ტოვებს, ვიდრე მის შემდეგ.',
        info: `ეს ითვლის, რომ ახალი შემოსავალი არ შემოდის: თუ ${dative(p.paydayLabel).split(', ')[1] ?? ''} ბოლო ხელფასი მაინც ჩაირიცხება, ის ამ თანხას დაემატება. რას აკეთებენ ხშირად: ხარჯის სიას ადგენენ და არააუცილებელს აჩერებენ; სესხის შენატანზე ბანკს თარიღამდე ესაუბრებიან; ქირაზე — მესაკუთრეს.`,
        chips: ['ჩემი გადასახადები მაჩვენე', 'სესხის გადავადებას როგორ ვითხოვ?', 'უმუშევრობის დახმარება არსებობს?'],
        steps: 'ვარიანტები: 1) ხარჯის სია — რა არის აუცილებელი; 2) სესხის შენატანზე საუბარი ბანკთან თარიღამდე; 3) სოციალური მომსახურების სააგენტოს პროგრამების ნახვა.',
        simple: `მარტივად: ახლა ${gel(total)} გაქვს და ჩვეული ხარჯით ეს ~${days} დღეს ეყოფა.`,
        example: `მაგალითად: ${gel(total)} ÷ ~${gel(Math.round(monthly / 30))} დღეში ≈ ${days} დღე; ხარჯი თუ ~20%-ით შემცირდება — ~${Math.floor(cash / (monthly * 0.8 / 30))} დღე.`,
        why: 'რატომ ეს ციფრი: ვითვლი შენს ფიქსირებულ გადასახადებსაც და ყოველდღიურ ხარჯსაც — ორივე გრძელდება, სანამ ახალი შემოსავალი არ გაჩნდება.',
      }
    }
    return {
      title: 'გადაუდებელი ფონდი',
      body: 'გადაუდებელი ფონდი მოულოდნელი ხარჯისთვის გადადებული ფულია. ჩვეულებრივ, 3–6 თვის აუცილებელ ხარჯს ასახელებენ.',
      more: 'ფონდის გარეშე მოულოდნელი ხარჯი ხშირად სესხით ან ოვერდრაფტით იფარება — და მას პროცენტი ემატება.',
      mine: `3 თვის გადასახადები ≈ ${gel(bills3)}; 3 თვის მთელი ჩვეული ხარჯი ≈ ${gel(all3)}.${p.savings ? ` ქვევრში ახლა ${gel(p.savings.amount)}-ია.` : ''}`,
      rule: 'ფონდი სესხის ფასს ზოგავს: მოულოდნელი ხარჯი საკუთარი ფულით იფარება.',
      answer: runway ? (days >= 1 ? `ხელფასი რომ შეწყდეს, ${have} ჩვეული ხარჯით დაახლოებით ${days} დღეს გეყოფა.` : `ხელფასი რომ შეწყდეს, ${have} ჩვეული ხარჯით ერთ დღესაც ვერ გეყოფა.`)
        : howMuch ? `ჩვეულებრივ 3–6 თვის აუცილებელ ხარჯს ასახელებენ: შენთან 3 თვის გადასახადები ~${gel(bills3)}-ია, მთელი ჩვეული ხარჯი კი ~${gel(all3)}.` : undefined,
      info: runway ? `ჩვეული ხარჯი ~${gel(r10(monthly))} თვეში: ფიქსირებული გადასახადები და ყოველდღიური ხარჯი.` : undefined,
      chips: ['რამდენ ხანში დავაგროვებ 1000 ლარს?', 'რა არის ანაბარი?'],
      steps: e.medianSurplus > 0 ? `ვარიანტები: ყოველ ხელფასზე თუნდაც 20–50 ₾-ის გადადება; ან თვის ბოლოს დარჩენილი ~${gel(Math.round(e.medianSurplus))} — ერთი თვის ხარჯი ~${Math.ceil(monthly / e.medianSurplus)} თვეში დაგროვდება.` : 'ახლა თვის ბოლოს არაფერი რჩება, ამიტომ ფონდის პირველი ნაბიჯი ხარჯის ნახვაა — სად მიდის ყოველი ლარი.',
      simple: 'მარტივად: ფული „შავი დღისთვის" — მოულოდნელ ხარჯზე, რომ სესხი არ დაგჭირდეს.',
      // "how long would I last?": the example is the sum itself, so a second asking shows how the days come out
      example: runway ? `ანუ: ${gel(e.spendable)}${p.savings ? ` + ${gel(p.savings.amount)}` : ''} = ${gel(Math.round(cash))}; ჩვეული ხარჯი დღეში ~${gel(Math.round(monthly / 30))} (გადასახადების ჩათვლით) — ${gel(Math.round(cash))} ÷ ${gel(Math.round(monthly / 30))} ≈ ${days} დღე.` : `მაგალითად: შენი გადასახადები თვეში ${gel(e.fixedTotal)}-ია, მთელი ჩვეული ხარჯი ~${gel(r10(monthly))} — 3 თვე ≈ ${gel(bills3)}–${gel(all3)}.`,
      why: 'რატომ: ფონდის გარეშე მოულოდნელი ხარჯი ხშირად სესხით იფარება და მას პროცენტი ემატება.',
    }
  },
  inflation: (e, p, q, ctx) => {
    const sv = p.savings?.amount
    // "ინფლაცია 4% რომ იყოს, რეალურად რამდენს მოვიგებ?": the deposit rate on the table (or an example 10%) against that inflation
    const inf = q.ratePct !== undefined && /ინფლაცი/.test(q.raw.toLowerCase()) ? q.ratePct : undefined
    let realAns: string | undefined, realInfo: string | undefined
    if (inf !== undefined) {
      const rate = ctx.rateYear ?? 0.1
      const real = ((1 + rate) / (1 + inf / 100) - 1) * 100
      const r1 = (v: number) => fmt(Math.round(v * 10) / 10, Math.round(v * 10) % 10 ? 1 : 0)
      realAns = `${r1(rate * 100)}%-იანი ანაბარი ${r1(inf)}%-იანი ინფლაციისას რეალურად წელიწადში ~${r1(real)}%-ით იზრდება${ctx.rateYear === undefined ? ' (10% სამაგალითოა)' : ''}.`
      const per = ctx.perMonth, n = ctx.months ?? 12
      if (per && per > 0) {
        // each monthly deposit in today's money: the year-end sum deflated, minus the deposits deflated to the month they were made
        const interest = per * rate / 12 * n * (n - 1) / 2
        const finalReal = (per * n + interest) / Math.pow(1 + inf / 100, n / 12)
        let paidReal = 0
        for (let k = 0; k < n; k++) paidReal += per / Math.pow(1 + inf / 100, k / 12)
        const gain = finalReal - paidReal
        const add = ` ~${gel(Math.round(interest))} სარგებლიდან დღევანდელ ფასებში ${gain >= 0.5 ? `~${gel(Math.round(gain))} რჩება` : 'თითქმის არაფერი რჩება'}.`
        if (`${realAns}${add}`.length <= 160) realAns += add
        realInfo = `ვთვლი ასე: თვეში ${gel(per)}, ${n} თვე, წლიური ${r1(rate * 100)}% — ბოლოს ~${gel(Math.round(per * n + interest))}, აქედან ~${gel(Math.round(interest))} სარგებელია. ყოველ შენატანს მისი თვის ფასებით ვადარებ: ${r1(inf)}%-იანი ინფლაცია ამ სარგებლიდან ~${gel(Math.round(interest - Math.max(0, gain)))}-ს „ჭამს".`
      } else realInfo = 'რეალური ზრდა = (1 + ანაბრის განაკვეთი) ÷ (1 + ინფლაცია) − 1.'
    }
    return {
      title: 'ინფლაცია',
      body: 'ინფლაცია ფასების ზრდაა.',
      more: 'თუ ფასები წელიწადში 5%-ით იზრდება, შენი ფული კი — არა, წლის ბოლოს იგივე თანხით ნაკლებს იყიდი.',
      mine: 'სახლში შენახული 100 ₾ 5%-იანი ინფლაციისას წლის ბოლოს დღევანდელ ~95 ₾-ს უდრის.',
      rule: 'ფული, რომელიც არ იზრდება, ფასს კარგავს.',
      chips: ['რა არის ანაბარი?', 'რა არის რთული პროცენტი?'],
      info: realInfo,
      answer: realAns ?? (sv && /ჩემ|დანაზოგ|ქვევრ/.test(q.raw.toLowerCase()) ? `შენი დანაზოგი (${gel(sv)}) 5%-იანი ინფლაციისას წლის ბოლოს დღევანდელ ~${gel(Math.round(sv / 1.05))}-ს უდრის, თუ თვითონ არ იზრდება.` : undefined),
      simple: 'მარტივად: ფასები იზრდება, ამიტომ იმავე ფულით დროთა განმავლობაში ნაკლებს ყიდულობ.',
      example: sv ? `მაგალითად: ქვევრის ${gel(sv)} 5%-იანი ინფლაციისას წლის ბოლოს დღევანდელ ~${gel(Math.round(sv / 1.05))}-ს უდრის.` : 'მაგალითად: 5%-იანი ინფლაციისას 100 ₾-ით წლის ბოლოს დღევანდელი ~95 ₾-ის ნივთებს იყიდი.',
      why: 'რატომ: თუ დანაზოგი ინფლაციაზე ნელა იზრდება, ის ფასს კარგავს.',
    }
  },
  risk: (e, p, q) => {
    const risk = 'რისკი ნიშნავს, რომ შედეგი წინასწარ უცნობია: ფული შეიძლება გაიზარდოს ან შემცირდეს.'
    const div = 'დივერსიფიკაცია ფულის რამდენიმე სხვადასხვა ადგილას განაწილებაა, რომ ერთის წარუმატებლობამ ყველაფერი არ წაიღოს.'
    const s = q.raw.toLowerCase()
    const isDiv = /დივერსიფიკ/.test(s)
    const isFx = /დოლარ|ვალუტ|ევრო|usd|გაუფასურ|კურს/.test(s)
    // a worked example with round example rates (dollar 2,70 → 3,00 ₾, euro 3,10 → 3,40 ₾), never a forecast of the rate
    const eur = /ევრო|eur/.test(s)
    const sym = eur ? '€' : '$'
    const [r1, r2] = eur ? [3.1, 3.4] : [2.7, 3]
    const rt = (r: number) => fmt(r, 2)
    const pay = (rate: number) => Math.round(100 * rate)
    const share = (rate: number) => fmt(pay(rate) / p.salary * 100, 0)
    const fx = isFx && !(/რა არის|რას ნიშნავ/.test(s) && !/სესხ|კრედიტ|ვიყიდ|ბინ|გაუფასურ/.test(s))
      ? (/სესხ|კრედიტ/.test(s) ? `ეს სავალუტო რისკია: კურსი ${rt(r1)}-დან ${rt(r2)} ₾-მდე თუ გაიზრდება, 100 ${sym}-იანი შენატანი ${pay(r1)} ₾-დან ${pay(r2)} ₾-მდე გაძვირდება, ლარის ხელფასი კი იგივე დარჩება.`
        : /ვიყიდ|ბინ/.test(s) ? `ეს სავალუტო რისკია: ფასი უცხო ვალუტაშია, ხელფასი — ლარში. 50 000 ${sym}-იანი ბინა ${rt(r1)} ₾ კურსით ${fmt(50000 * r1)} ₾-ია, ${rt(r2)} ₾ კურსით — ${fmt(50000 * r2)} ₾.`
        : debtNow(p) > 0 ? 'შენს მონაცემებში სესხები ლარშია, ამიტომ შენატანები არ შეიცვლება. ძვირდება იმპორტული ნივთები: 400 $-იანი ტელეფონი 2,70 ₾ კურსით 1 080 ₾-ია, 3,00-ით — 1 200 ₾.'
        : 'ლარი რომ გაუფასურდეს, ძვირდება იმპორტული ნივთები: 400 $-იანი ტელეფონი 2,70 ₾ კურსით 1 080 ₾-ია, 3,00-ით — 1 200 ₾. ლარში აღებულ სესხს ეს არ ეხება.')
      : undefined
    if (isFx && !isDiv) return {
      title: 'სავალუტო რისკი',
      answer: fx,
      body: 'სავალუტო რისკი ისაა, როცა შემოსავალი ერთ ვალუტაშია, ვალი ან ფასი კი — მეორეში: კურსის ცვლილება ლარში თანხას ცვლის.',
      more: `მაგალითად: 100 ${sym}-იანი შენატანი ${rt(r1)} ₾ კურსით ${pay(r1)} ₾-ია, ${rt(r2)} ₾ კურსით — ${pay(r2)} ₾.`,
      mine: `შენი შემოსავალი ${gel(p.salary)} ლარშია: 100 ${sym}-იანი შენატანი მისი ${share(r1)}% იქნებოდა ${rt(r1)} ₾ კურსით და ${share(r2)}% — ${rt(r2)} ₾ კურსით.`,
      rule: 'როცა სესხი და შემოსავალი ერთ ვალუტაშია, კურსი შენატანს არ ცვლის.',
      info: `კურსის პროგნოზს არ ვაკეთებ: ${rt(r1)} და ${rt(r2)} მხოლოდ სამაგალითო კურსებია.`,
      chips: ['რა არის ინფლაცია?', 'რა არის რისკი?'],
      simple: `მარტივად: ხელფასი ლარშია, ვალი ${eur ? 'ევროში' : 'დოლარში'} — ${eur ? 'ევრო' : 'დოლარი'} თუ ძვირდება, ვალიც ლარში ძვირდება.`,
      example: `მაგალითად: შენი ${gel(p.salary)} ხელფასიდან 100 ${sym}-იანი შენატანი ${share(r1)}%-ია ${rt(r1)} ₾ კურსით და ${share(r2)}% — ${rt(r2)} ₾ კურსით.`,
      why: `რატომ: კურსი წინასწარ არავინ იცის, ამიტომ ${eur ? 'ევროს' : 'დოლარის'} შენატანი ლარში წინასწარ უცნობია.`,
    }
    return {
      title: 'რისკი და დივერსიფიკაცია',
      answer: fx,
      body: isDiv ? div : risk,
      more: isDiv ? risk : div,
      mine: 'ანაბარზე შემოსავალი წინასწარ ცნობილია; აქციებსა და კრიპტოვალუტაში — არა.',
      rule: 'რაც უფრო მაღალ შემოსავალს გპირდებიან, მით მეტია რისკი.',
      chips: isDiv ? ['რა არის რისკი?', 'რა არის ინფლაცია?'] : ['რა არის დივერსიფიკაცია?', 'რა არის ინფლაცია?'],
      simple: isDiv ? 'მარტივად: ყველა კვერცხს ერთ კალათაში არ დებენ — ფულს რამდენიმე ადგილას ანაწილებენ.' : 'მარტივად: რისკი ისაა, როცა შედეგი წინასწარ არ იცი — შეიძლება მოიგო, შეიძლება წააგო.',
      example: 'მაგალითად: ანაბარზე სარგებელი წინასწარაა ცნობილი; აქციამ კი წელიწადში შეიძლება +20% ან −20% მოიტანოს.',
      why: 'რატომ: რაც უფრო მაღალ შემოსავალს გპირდებიან, მით მეტია დაკარგვის შანსიც.',
    }
  },
  fraud: (e, p, q, ctx) => {
    const s = q.raw.toLowerCase()
    const base = {
      // the demo is in no app store, so nothing here claims a published app
      title: 'თაღლითობა', more: 'ყალბი ბმულები და გვერდები ხშირად ნამდვილს ჰგავს. ბანკის ოფიციალური ნომერი ბარათის უკანა მხარეს და ბანკის საიტზე წერია.', rule: 'კოდი = ფული. კოდს არავის ეუბნებიან.', chips: ['მაგალითით ამიხსენი', 'კოდი უკვე ვუთხარი', 'დღეს რამდენი შემიძლია?'],
      steps: q.given || /უკვე (ვუთხარი|ვთქვი|გავეცი|მივეცი|შევიყვანე)/.test(s)
        ? 'ასეთ დროს: ბანკის ოფიციალურ ნომერზე დარეკვა და ბარათის დაბლოკვა — რაც უფრო ადრე, მით უკეთესი; შემდეგ — ბანკის აპის პაროლის შეცვლა.'
        : FRAUD_PROMISE.test(s) ? 'ასეთ დროს: ფულის გადარიცხვამდე პაუზა; კომპანიის ლიცენზიის შემოწმება ეროვნული ბანკის საიტზე; ახლობელთან ან ბანკთან გასაუბრება.'
          : 'ასეთ დროს: ზარის ან ჩატის შეწყვეტა; ბანკის ოფიციალურ ნომერზე თავად დარეკვა; კოდის, PIN-ის და ბარათის მონაცემების არავისთვის თქმა.',
      simple: 'მარტივად: კოდს, PIN-ს და ბარათის მონაცემებს არავინ ითხოვს — ბანკიც კი. ვინც ითხოვს, სავარაუდოდ თაღლითია.',
      example: 'მაგალითად: „ბანკიდან გირეკავთ, ბარათი დაგებლოკათ, გვითხარით SMS-კოდი" — ტიპური თაღლითური ზარია.',
      why: 'რატომ: კოდით თაღლითი შენს ანგარიშზე შედის და ფულს რიცხავს, დაბრუნება კი რთულია.',
    }
    // a personal number (not a card) typed into a fake page
    if ((q.given || /უკვე (ვუთხარი|ვთქვი|გავეცი|მივეცი|შევიყვანე)/.test(s)) && /პირად\S* ნომ/.test(ctx.topicQ ?? '') && !/ბარათ|კოდ|პინ|cvv/.test(s)) {
      return { ...base, body: 'თუ ყალბ გვერდზე ბარათის მონაცემები ან კოდიც შეიყვანე, ბარათს ბანკი ბლოკავს — ოფიციალურ ნომერზე დარეკვით, რაც უფრო ადრე. პირადი ნომრის გაცემაზეც ბანკისთვის შეტყობინება შეიძლება.', mine: 'ბანკის ოფიციალური ნომერი ბარათის უკანა მხარეს და ბანკის საიტზე წერია.', chips: ['მაგალითით ამიხსენი', 'დღეს რამდენი შემიძლია?'] }
    }
    // the code or card details already given: what happens next comes first
    if (q.given || /უკვე (ვუთხარი|ვთქვი|გავეცი|მივეცი|შევიყვანე)/.test(s)) {
      return { ...base, body: 'თუ კოდი ან ბარათის მონაცემები უკვე გაცემულია, ბარათს ბანკი ბლოკავს — ბანკის ოფიციალურ ნომერზე დარეკვით. რაც უფრო ადრე, მით ნაკლებია დანაკარგის შანსი.', mine: 'ბანკის ოფიციალური ნომერი ბარათის უკანა მხარეს და ბანკის საიტზე წერია.', rule: 'კოდი = ფული. კოდს არავის ეუბნებიან.', chips: ['მაგალითით ამიხსენი', 'დღეს რამდენი შემიძლია?'] }
    }
    // the chat history is kept in this browser, so Jikho never says it does not keep what is typed
    if (q.cardNumber) {
      return { ...base, body: 'ბარათის ნომერი ჩემთვის საჭირო არ არის: ჯიხო ბარათს ვერ ამოწმებს. ჩატში ნომერი დავფარე — ჩანს მხოლოდ ბოლო 4 ციფრი.', mine: 'ბარათის ნაშთს და ტრანზაქციებს ბანკის ოფიციალური აპი აჩვენებს.', chips: ['ჩემი მონაცემები დაცულია?', 'დღეს რამდენი შემიძლია?'] }
    }
    // a buyer on a marketplace asking for the CVV "to send the money"
    if (/olx|მყიდველ|ვყიდი|გავყიდ|ჩაგირიცხ|გადმოგირიცხ|მაღაზიაზე ვყიდი/.test(s) && /cvv|cvc|კოდ|ბარათ|პინ/.test(s)) {
      return { ...base, body: 'ფულის მისაღებად CVV-კოდი და SMS-კოდი საჭირო არ არის — მათ ბარათით გადახდისას იყენებენ. მყიდველის მიერ მათი თხოვნა თაღლითობის ცნობილი ნიშანია.', mine: 'CVV, PIN და SMS-კოდი მხოლოდ ბარათის მფლობელმა იცის — ფულის მიღებისას ისინი არავის სჭირდება.' }
    }
    // "state help, enter your personal number at the link"
    if (FRAUD_LINK.test(s) && /სახელმწიფო|დახმარებ|კომპენსაც|გრანტ|ვაუჩერ|მეკუთვნ|პენსი/.test(s)) {
      return { ...base, body: '„სახელმწიფო დახმარება ბმულით" თაღლითობის გავრცელებული ხერხია: ბმული ყალბ გვერდს ხსნის და პირად ნომერს, ბარათის მონაცემებს ან კოდს ითხოვს.', mine: 'დახმარების ნამდვილობა უწყების ოფიციალურ საიტზე ან ცხელ ხაზზე მოწმდება — შეტყობინების ბმულით არა.' }
    }
    // a seller or a photographer asking for money up front on social media: not always a scam, but money sent this way rarely comes back
    if (/წინასწარ|ავანს|ჯავშან/.test(s) && /ინსტაგრამ|instagram|ფეისბუქ|facebook|სოციალურ|ფოტოგრაფ|ონლაინ მაღაზი|გამყიდველ|ტიკტოკ|tiktok|ჯგუფ/.test(s)) {
      return { ...base, chips: ['მაგალითით ამიხსენი', 'რა არის რისკი?', 'დღეს რამდენი შემიძლია?'], body: 'წინასწარი გადახდა მომსახურებაზე ზოგჯერ ჩვეულებრივია, მაგრამ სოციალურ ქსელში უცნობ ანგარიშზე გადარიცხული ფულის დაბრუნება რთულია.', mine: 'რისკს ამცირებს: პროფილის ისტორია და შეფასებები, ნამდვილი ნამუშევრები, წერილობითი შეთანხმება და მცირე ავანსი.' }
    }
    if (FRAUD_PROMISE.test(s)) {
      const m = q.ratePct
      const per = /დღეში/.test(s) ? { w: 'დღეში', n: 365 } : /კვირაში/.test(s) ? { w: 'კვირაში', n: 52 } : { w: 'თვეში', n: 12 }
      const grow = m ? Math.pow(1 + m / 100, per.n) : 0
      const promised = /გარანტ/.test(s) ? '„გარანტირებული"' : 'დაპირებული'
      return { ...base, body: `${promised} მაღალი მოგება${m ? ` (${per.w} ${fmt(m)}%)` : ''} ფინანსური პირამიდის ან თაღლითობის ცნობილი ნიშანია. ნამდვილ ინვესტიციაში მოგება გარანტირებული არ არის.`, mine: m && m < 100 ? `${per.w} ${fmt(m)}% წელიწადში ფულს ${grow > 1000 ? 'ათასჯერ მეტად' : `~${fmt(grow, 0)}-ჯერ`} გაზრდიდა — ასეთ შემოსავალს ნამდვილი ბიზნესი არ გპირდება.` : 'რაც უფრო მაღალ შემოსავალს გპირდებიან, მით მეტია რისკი.', rule: 'მოგების გარანტია + სიჩქარე + „ახლავე ჩადე" = თაღლითობის ნიშნები.', chips: ['რა არის რისკი?', 'მაგალითით ამიხსენი', 'დღეს რამდენი შემიძლია?'] }
    }
    if (FRAUD_ASK.test(s) && !FRAUD_LINK.test(s)) {
      const chips = ['მაგალითით ამიხსენი', 'დღეს რამდენი შემიძლია?']
      if (/პოლიციიდან|პროკურატურიდან/.test(s)) return { ...base, chips, body: 'პოლიცია ან პროკურატურა ტელეფონით ან შეტყობინებით ფულის გადარიცხვას არ ითხოვს — ეს თაღლითობის ცნობილი ხერხია.', mine: 'ზარის ნამდვილობა უწყების ოფიციალურ ნომერზე თავად დარეკვით მოწმდება.' }
      return { ...base, chips, body: 'ნაცნობის სახელით ფულის სასწრაფო თხოვნა შეტყობინებით გატეხილი ანგარიშით თაღლითობის ცნობილი ხერხია — ნამდვილობა მისთვის პირდაპირ დარეკვით მოწმდება.', mine: 'ნომრის „შეცვლა" და „სასწრაფოდ" თაღლითის ტიპური სიტყვებია.' }
    }
    // "ბარათი დაიბლოკა, დარეკეთ ამ ნომერზე": the number in the message is the scammer's
    if (/დარეკეთ|ამ ნომერზე|ნომერზე დარეკ/.test(s) && /დაიბლოკა|დაბლოკილია|გაიყინა/.test(s) && !FRAUD_LINK.test(s)) return { ...base, body: '„ბარათი დაიბლოკა, დარეკეთ ამ ნომერზე" თაღლითობის ცნობილი ხერხია: შეტყობინების ნომერი ხშირად თაღლითებს ეკუთვნის.', mine: 'ნამდვილობა ბარათის უკანა მხარეს მითითებულ ბანკის ნომერზე თავად დარეკვით მოწმდება.' }
    // a message "from the bank" with a link: the check is the bank's official number, not a courier site
    if (FRAUD_LINK.test(s) && /ბანკ|ანგარიშ|ბარათ/.test(s) && !/ამანათ|კურიერ|courier/.test(s)) return { ...base, body: '„ანგარიში დაბლოკილია, ბმულზე გადადით" თაღლითობის გავრცელებული ხერხია: ბმული ყალბ გვერდს ხსნის და ბარათის მონაცემებს ან კოდს ითხოვს.', mine: 'შეტყობინების ნამდვილობა ბანკის ოფიციალურ ნომერზე თავად დარეკვით მოწმდება — ის ბარათის უკანა მხარესაა.' }
    if (FRAUD_LINK.test(s)) return { ...base, body: 'ამანათის ან „დაბლოკილი ბარათის" SMS ბმულით თაღლითობის გავრცელებული ხერხია: ბმული ყალბ გვერდს ხსნის და ბარათის მონაცემებს ითხოვს.', mine: 'ამანათის ნამდვილ სტატუსს კურიერის ოფიციალური საიტი ან აპი აჩვენებს, SMS-ის ბმული — არა.' }
    if (FRAUD_PRIZE.test(s)) return { ...base, body: 'მოგების სანაცვლოდ ბარათის მონაცემების ან კოდის თხოვნა თაღლითობის ტიპური ნიშანია — ნამდვილი გათამაშება ამას არ ითხოვს.', mine: 'თუ მონაცემები უკვე გაცემულია, ბარათს ბანკი ბლოკავს — ბანკის ოფიციალურ ნომერზე დარეკვით.' }
    if (FRAUD_PIN.test(s)) return { ...base, body: 'PIN-კოდი ბარათის გასაღებია: მისი მცოდნე ბარათით ფულს განაღდებს, დაკარგული თანხის დაბრუნება კი რთულია.', mine: 'PIN, CVV და SMS-კოდი მხოლოდ ბარათის მფლობელმა იცის — ბანკიც კი არ ითხოვს მათ.' }
    return { ...base, body: 'ბანკი ტელეფონით არასდროს გთხოვს SMS-კოდს, ბარათის PIN-ს ან პაროლს.', mine: 'ბანკის სახელით მოსული ზარის შემოწმება ბანკის ოფიციალურ ნომერზე თავად დარეკვით შეიძლება.' }
  },
  // NBG credit-bureau rule 195/04 art. 8(1) and 4(11) (matsne.gov.ge/ka/document/download/4312592/8/ge/pdf); the personal portal is MyCreditinfo (mycreditinfo.ge, web and app)
  // NBG rule 195/04 art. 7(1) (every lender reporting to the bureau has access), art. 4(13) (a closed loan stays visible to lenders 5 years), art. 8(1) (free on request at any time; at least 3 instant reports a year free)
  credithistory: (e, p, q) => ({
    answer: /ვინ ხედავს|ვინ ნახულობს|ვინ ნახავს|ვის შეუძლია (?:ნახვა|ნახოს)|ვინ იყურება|ვინ ამოწმებს|რამდენ ხანს|რამდენი ხანი|როდემდე|ინახება|იშლება|წაიშლება/.test(q.raw.toLowerCase()) ? 'ისტორიას ხედავენ სესხის გამცემი ორგანიზაციები, რომლებიც ბიუროს ინფორმაციას აწვდიან; დაფარული სესხი და მისი დაგვიანებები მათთვის დაფარვიდან 5 წელი ჩანს.'
      // "how do I see it and what does it show?": both halves
      : /როგორ ვნახო|სად ვნახო|სად ჩანს|როგორ გავიგო/.test(q.raw.toLowerCase()) && /რას აჩვენებს|რა ჩანს|რა წერია|რას მაჩვენებს/.test(q.raw.toLowerCase()) ? 'ისტორია აჩვენებს შენს სესხებს, საკრედიტო ბარათებს და დაგვიანებებს; საკუთარი ისტორია mycreditinfo.ge-ზე ჩანს, წელიწადში მინიმუმ 3-ჯერ უფასოდ.'
      : /ფასიან|უფასო|რა ღირს|ფული უნდა/.test(q.raw.toLowerCase()) ? 'საკუთარი საკრედიტო ისტორიის ნახვა mycreditinfo.ge-ზე (საიტი და აპი) წელიწადში მინიმუმ 3-ჯერ უფასოა; საკუთარი ისტორიის ნახვა რეიტინგზე არ მოქმედებს.'
      : /როგორ ვნახო|სად ვნახო|სად ჩანს|როგორ გავიგო/.test(q.raw.toLowerCase()) ? 'საკუთარი საკრედიტო ისტორია ჩანს mycreditinfo.ge-ზე (საიტი და აპი), წელიწადში მინიმუმ 3-ჯერ უფასოდ; საკუთარი ისტორიის ნახვა რეიტინგზე არ მოქმედებს.'
      : /გამიფუჭდ|გაფუჭდ|დავაგვიან|იმოქმედებს|ცუდი|მომცემენ/.test(q.raw.toLowerCase()) ? 'დაგვიანებული გადახდა საკრედიტო ისტორიაში აისახება. ცუდი ისტორიისას ბანკმა შეიძლება სესხზე უარი თქვას ან მაღალი განაკვეთი შემოგთავაზოს.' : undefined,
    info: /ფასიან|უფასო|რა ღირს|ფული უნდა|როგორ ვნახო|სად ვნახო|სად ჩანს|როგორ გავიგო/.test(q.raw.toLowerCase()) ? 'მონაცემების მოთხოვნა ნებისმიერ დროს უფასოა, ქაღალდზე ან ელექტრონულად; პორტალზე ან აპში მყისიერი ანგარიში შეიძლება ფასიანი იყოს, თუმცა წელიწადში მინიმუმ 3 — უფასოა. საჭიროა პირადობის გადამოწმება.' : undefined,
    title: 'საკრედიტო ისტორია',
    body: 'საკრედიტო ბიუროში (კრედიტინფოში) ჩანს შენი სესხები, საკრედიტო ბარათები და დაგვიანებული გადახდები.',
    more: 'ბანკი ამას სესხის გაცემამდე ამოწმებს. საკუთარი ისტორია mycreditinfo.ge-ზე ჩანს, წელიწადში მინიმუმ 3-ჯერ უფასოდ.',
    mine: 'დაფარული სესხი და მისი დაგვიანებები ისტორიაში შენი სახელით ჩანს დაფარვიდან 5 წლის განმავლობაში.',
    // the card never repeats the answer's last clause
    rule: /ფასიან|უფასო|რა ღირს|ფული უნდა|როგორ ვნახო|სად ვნახო|სად ჩანს|როგორ გავიგო/.test(q.raw.toLowerCase()) && !/რას აჩვენებს|რა ჩანს|რა წერია|რას მაჩვენებს/.test(q.raw.toLowerCase()) ? 'ბანკი ისტორიას სესხის გაცემამდე ამოწმებს.' : 'საკუთარი ისტორიის ნახვა რეიტინგზე არ მოქმედებს.',
    chips: ['საკრედიტო ისტორია სად ვნახო?', 'გადახდა თუ დამიგვიანდა?'],
    steps: 'ნაბიჯები: საკუთარი ისტორიის ნახვა mycreditinfo.ge-ზე; შენატანების დროზე გადახდა — ახალი დაგვიანება ისტორიას აღარ ემატება.',
    simple: 'მარტივად: ესაა შენი „სესხების დღიური" — რა აიღე და დროზე გადაიხადე თუ არა.',
    example: 'მაგალითად: 2026 წელს დაფარული სესხის დაგვიანება ისტორიაში 2031 წლამდე ჩანს — დაფარვიდან 5 წელი.',
    why: 'რატომ: ამით წყვეტს ბანკი, მოგცეს თუ არა სესხი და რა განაკვეთით.',
  }),
  restructure: (e, p, q) => {
    const s = q.raw.toLowerCase()
    // already behind on payments: never "ask before the due date"
    const behind = !!q.overdue || /არაფერს (?:ვე?რ |არ )?ვიხდი|დროზე (?:ვერ|ვეღარ|არ)|(?:ვერ|ვეღარ|არ) (?:ვიხდი|ვფარავ)\S* დროზე|უკვე (?:ვერ|ვეღარ|არ |ვაგვიანებ)|დავაგვიანე|ვადაგადაცილ|(?:ვერ|ვეღარ) (?:დავფარე|გადავიხადე)|(?:თვეა|კვირაა)\s+(?:\S+\s+)?(?:ვერ|ვეღარ|არ)\s|(?:ვერ|ვეღარ|არ) (?:ვიხდი|ვფარავ)\S*.*(?:თვეა|კვირაა)/.test(s)
    // daily calls from a lender or a collector (a scam call asking for a code is the fraud card)
    const calls = COLLECTORS.test(s) && !ENFORCE.test(s) && !COURT.test(s)
    // "how do I ask for it?": the steps, not the definition
    const how = /როგორ (?:ვთხოვო|ვითხოვო|მოვითხოვო|მივმართო|შევთანხმდე|მოვაგვარო)|რა (?:უნდა )?ვუთხრა|სად მივმართო|რა საბუთ|რა დოკუმენტ/.test(s)
    // a new loan to pay the old one: the old loan is closed and the debt moves to the new one
    const refi = REFINANCE.test(s) && !q.essential
    const order = /რომელი (?:ვალი |სესხი )?(?:დავფარო|გადავიხადო|დავხურო)|რიგით|პირველ(?:ად|ი)? (?:დავფარო|გადავიხადო)/.test(s)
    const ask = /რა ვქნა|რა გავაკეთო|რა გზა მაქვს|რა გამოსავალ/.test(s)
    // "I can no longer pay" is acknowledged first, whatever the question
    const cantPay = /ვე(?:რ|ღარ) ?(?:ვიხდი|ვფარავ|ვაბრუნებ|ვახერხებ)|არ მყოფნის|ვერ გამოვდივარ/.test(s)
    // the person's overdraft, when the question is about getting out of it
    const od = OD_STUCK.test(s) && p.overdraft ? p.overdraft : undefined
    const odSteps = Math.ceil((od?.used ?? 0) / 50)
    const rent = /(?:^|[^ა-ჰ])ქირ/.test(s) && !/სესხ|ვალ/.test(s)
    const bills = /გადასახად|კომუნალ/.test(s) && !/სესხ|ვალ/.test(s)
    // NBG debt-collection ethics code 14/04 art. 4(1), 7, 8 and 3(9) (matsne.gov.ge, consolidated with the 2023 amendment); complaint answer within 1 month: NBG rule 32/04 art. 13(3)(ე)
    const CALLS = 'ეროვნული ბანკის წესით ვალზე დარეკვა მხოლოდ 09:00–20:00-ზე შეიძლება, მუქარა და ზეწოლა კი აკრძალულია.'
    const COMPLAINT = 'ასეთ ზარებზე საჩივრის შეტანა შეიძლება გამსესხებელთან (პასუხის ვადა — 1 თვე) და ეროვნულ ბანკში.'
    const PROOF = 'თუ საჩივარი ზარიდან 2 თვეში შედის, მტკიცების ტვირთი გამსესხებელს ეკისრება.'
    const NO_THREATS = 'ვალის ამომღებს ეკრძალება თქმა, რომ ვალის გამო დაგაპატიმრებენ, ან აღსრულების ბიუროს სახელით წარდგენა.'
    // Civil Code art. 625(5), consolidated 25/06/2026: charges up to 0,27% of the remaining principal a day, all charges until a delinquency is cleared up to 1,5 times the principal
    const PENALTY = 'ვადაგადაცილებისას ჯარიმა და საკომისიოები კანონით დღეში დარჩენილი ძირის 0,27%-ს ვერ გადააჭარბებს, ჯარიმები და პროცენტი ჯამში კი — ძირის 1,5-ჯერადს.'
    // NBG rule 32/04 art. 11(1¹) (contracts from 1 May 2025) and 11: refinancing at the same lender carries no early-repayment fee
    const REFI_FEE = 'სხვა ორგანიზაციის სესხით რეფინანსირებისას ვადამდე დაფარვის საკომისიო დარჩენილი ძირის 0,5%-ს ვერ გადააჭარბებს (2025 წლის 1 მაისიდან); იმავე ორგანიზაციაში — არ ეკისრება.'
    // UNVERIFIED how a restructured loan is labelled: only the safe fact (earlier delays stay; paying the new schedule on time adds none)
    const HISTORY = 'რესტრუქტურიზაციამდე მომხდარი დაგვიანებები ისტორიაში რჩება; ახალ გრაფიკს თუ დროზე იხდი, ახალი დაგვიანება აღარ ემატება.'
    const OVERDUE_ANS = 'ვადის გადაცილების შემდეგაც შეიძლება გამსესხებელთან შეთანხმება — რესტრუქტურიზაცია: გადახდის ახალი გრაფიკი, რომელიც შენს შემოსავალში ჯდება.'
    const docs = /საბუთ|დოკუმენტ|წავიღო/.test(s)
    const DOCS_TEXT = 'ხშირად ითხოვენ: პირადობის მოწმობას, შემოსავლის საბუთს (ხელფასის ცნობას ან ამონაწერს) და მიზეზის დამადასტურებელს — მაგ. ცნობას სამსახურიდან ან ექიმისგან.'
    // calls at work or to family: NBG debt-collection code 14/04 art. 5(2) (a third party is told only that the lender wants to reach you; the credit is never named) and art. 6 (they stop when asked)
    const third = calls && /სამსახურ|სამუშაო|კოლეგ|ოჯახ|ნათესავ|მეზობ|მშობლ|ცოლ|ქმარ|მეგობარ|უფროს|დედა|მამა|ძმა|(?:^|[^ა-ჰ])დას(?![ა-ჰ])|შვილ|ბებია|ბაბუა/.test(s)
    // a call at night, a threat of arrest: said plainly as against the rule (NBG code 14/04 art. 4(1) and 8(გ))
    const nightCall = calls && /ღამ|(?:^|[^\d])(?:2[1-4]|[1-8])\s*საათ|დილის (?:[5-8])|შუაღამ/.test(s)
    const threat = calls && /დამემუქრ|მემუქრებ|დამაპატიმრ|დაპატიმრ|ციხე/.test(s)
    const CALLS_3P = 'ეროვნული ბანკის წესით ვალზე დარეკვა მხოლოდ 09:00–20:00-ზე შეიძლება; კოლეგას ან სხვა პირს ვალს და მის თანხას ვერ უმხელენ — მხოლოდ შენთან დაკავშირებას ითხოვენ.'
    // "ბანკი მთავაზობს რესტრუქტურიზაციას, ღირს?": what changes, the comparison that decides (the choice is the person's)
    const offered = /რესტრუქტ/.test(s) && /მთავაზობ|შემომთავაზ|ღირს|სჯობს|დავთანხმდე|ავიღო|რა შეიცვლება/.test(s)
    const answer = offered ? 'გადაწყვეტილება შენია: ახალი გრაფიკით შენატანი ხშირად მცირდება, მაგრამ ვადა იზრდება და ჯამში მეტს იხდი — ამას ძველი და ახალი გრაფიკის ჯამის შედარება აჩვენებს.'
      : threat ? 'ვალის გამო დაპატიმრებით მუქარა ეროვნული ბანკის წესით აკრძალულია — ეს საჩივრის საფუძველია გამსესხებელთან და ეროვნულ ბანკში.'
      : nightCall ? 'ღამით ზარი წესის დარღვევაა: ვალზე დარეკვა მხოლოდ 09:00–20:00-ზე შეიძლება, ასეთ ზარზე კი საჩივრის შეტანა შეიძლება.'
      : third ? CALLS_3P : calls ? CALLS
      : docs ? DOCS_TEXT
      : how && /მესაკუთრ|მეპატრონ|ქირ/.test(s) ? 'როგორ ითხოვენ: 1) მესაკუთრესთან საუბარი გადახდის თარიღამდე; 2) რამდენს და როდის გადაიხდი; 3) შეთანხმება წერილობით, მაგ. შეტყობინებით.'
      : how ? `როგორ ითხოვენ: 1) გამსესხებელთან დაკავშირება ${behind ? '— ვადის გადაცილების შემდეგაც' : 'გადახდის თარიღამდე'}; 2) მიზეზის ახსნა (შემოსავლის შემცირება, ავადმყოფობა); 3) შემოსავლის საბუთი.`
      : order ? DEBT_ORDER_TEXT
      : /რესტრუქტ\S* (რა|რას)|რა არის რესტრუქტ/.test(s) ? 'რესტრუქტურიზაცია სესხის პირობების შეცვლაა: ვადის გაგრძელება, შენატანის შემცირება ან დროებითი შეღავათი. გადაწყვეტილებას გამსესხებელი იღებს.'
      : /რეფინანს\S* (რა|რას)|რა არის რეფინანს/.test(s) ? REFI_DEF
      : behind ? OVERDUE_ANS
      : refi ? 'ახალი სესხით ძველი იხურება, ვალი კი ახალ სესხზე გადადის: შენატანი შეიძლება შემცირდეს, მაგრამ გრძელი ვადითა და საკომისიოებით ჯამში ხშირად მეტი გამოდის.'
      : q.essential ? 'ქირის, საკვების ან გადასახადების სესხით დაფარვა მომდევნო თვეებს ამძიმებს: ეს ხარჯი ისევ დარჩება და ზემოდან სესხის შენატანი დაემატება.'
      : ENFORCE.test(s) ? 'აღსრულების ეტაპზე ვალს აღსრულების ბიურო იღებს და ანგარიშზე ყადაღაც შეიძლება დაედოს. გადახდის გრაფიკზე შეთანხმება ამ ეტაპზეც შეიძლება.'
      : COURT.test(s) ? 'სასამართლოში საქმე არ ნიშნავს, რომ შეთანხმება აღარ შეიძლება: გადახდის გრაფიკზე ბანკთან მოლაპარაკება ამ ეტაპზეც ხდება.'
      : od ? `ოვერდრაფტიდან გამოსვლა ეტაპობრივია: შენთან ${gel(od.used)}-ია გამოყენებული და ყოველ ხელფასზე ნაწილის დაფარვით ვალი თვიდან თვემდე მცირდება.`
      : OD_STUCK.test(s) ? 'ოვერდრაფტიდან გამოსვლა ჩვეულებრივ ეტაპობრივია: თუ ყოველ ხელფასამდე გამოყენებული თანხა წინაზე ნაკლებია, ვალი მცირდება.'
      : rent ? 'ქირის გადავადება ან ნაწილ-ნაწილ გადახდა მესაკუთრესთან შეთანხმების საკითხია: რა ხდება დაგვიანებისას, ქირის ხელშეკრულებაში წერია.'
      : bills ? 'კომუნალურის ან სხვა გადასახადის დავალიანებაზე კომპანიასთან გადახდის გრაფიკზე შეთანხმება ხშირად შეიძლება — ჯერ თარიღამდე, მერეც.'
      : DEFER.test(s) ? 'გადავადება ან ვადის გაგრძელება გამსესხებელს შეგიძლია სთხოვო — ამას რესტრუქტურიზაცია ჰქვია, გადაწყვეტილებას კი ის იღებს.'
      : 'ბანკს შეგიძლია ვადამდე სთხოვო რესტრუქტურიზაცია: ვადის გაგრძელება ან დროებითი შეღავათი.'
    // "what do I do?" inside the question: the options are the answer
    const special = calls || how || order || refi || q.essential || rent || bills || ENFORCE.test(s) || COURT.test(s) || OD_STUCK.test(s)
    const stepsShort = `ვარიანტები: 1) გამსესხებელთან საუბარი ახალ გრაფიკზე${behind ? ' — ვადის გადაცილების შემდეგაც' : ''}; 2) ხელფასამდე გადასახდელის სია; 3) მიმართვა ეროვნულ ბანკს.`
    const lead = ask && !special ? stepsShort : answer
    // a short acknowledgement first, when it fits with the answer in one bubble
    const ackFull = calls ? (/ყოველდღე|ყოველ დღე|დღეში რამდენჯერ|ხშირად|გაუთავებლად/.test(s) ? 'ყოველდღიური ზარები დამღლელია.' : 'ასეთი ზარები დამღლელია.') : q.distress ? 'მესმის, რომ ახლა მძიმეა — ეს ბევრს ემართება.' : behind ? 'გასაგებია, რომ ახლა მძიმეა.' : (ask && !special) || (cantPay && !how) ? 'მესმის, რომ მძიმეა.' : ''
    const withAck = (t: string) => !ackFull ? t : `${ackFull} ${t}`.length <= 160 ? `${ackFull} ${t}` : `მესმის, რომ მძიმეა. ${t}`.length <= 160 ? `მესმის, რომ მძიმეა. ${t}` : t
    const visible = ackFull || lead !== answer ? withAck(lead) : undefined
    const a12 = Math.round(annuity(1000, 0.015, 12)), a24 = Math.round(annuity(1000, 0.015, 24))
    const help = 'ეროვნულ ბანკს მომხმარებლის უფლებების საკითხებზე მიმართვა და გამსესხებელზე საჩივრის შეტანა შეიძლება; ფინანსური განათლების მასალები — finedu.gov.ge.'
    return {
      title: calls ? 'ზარები ვალის გამო' : refi ? 'სესხით სესხის დაფარვა' : order ? 'ვალების დაფარვის რიგი' : 'როცა ვერ იხდი',
      body: answer,
      more: calls ? COMPLAINT : refi ? REFI_FEE : behind ? PENALTY : how ? HISTORY : 'ახალი გრაფიკით თვიური შენატანი ხშირად მცირდება, მაგრამ ვადა იზრდება და ჯამში მეტს იხდი.',
      // the person's debts first (not only the fixed bills), with the month's bills against the salary
      mine: rent || bills ? billsLine(e, p) : `${debtsLine(p)} ყველა თვიური გადასახადი ${gel(e.fixedTotal)}-ია, ხელფასი — ${gel(p.salary)}.`,
      rule: calls ? PROOF : DEFER.test(s) && !how && !behind ? 'როგორ ითხოვენ: გადახდის თარიღამდე დაკავშირება, მიზეზის ახსნა და შემოსავლის საბუთი.' : od ? 'ოვერდრაფტზე პროცენტი ყოველდღე ერიცხება: რაც უფრო ადრე მცირდება ვალი, მით ნაკლებ პროცენტს იხდი.' : refi ? 'ორ სესხს ერთმანეთს ჯამური ფასი, ვადა და საკომისიოები ადარებს — თვიური შენატანი მარტო არა.' : order ? 'ვალებს შორის ყველაზე ძვირი ისაა, რომლის ეფექტური განაკვეთიც ყველაზე მაღალია.' : 'ძველი ვალის დასაფარად აღებული ახალი სესხი ხშირად ვალს უფრო ზრდის.',
      answer: visible,
      info: joinInfo(
        third ? 'თუ მესამე პირი სთხოვს, რომ აღარ დაუკავშირდნენ, ორგანიზაციამ ეს უნდა დაიცვას. მუქარა, ზეწოლა და რეპუტაციის შელახვა აკრძალულია.' : undefined,
        calls ? `${PROOF} ${NO_THREATS} ახალ გრაფიკზე (რესტრუქტურიზაციაზე) საუბარიც შეიძლება.` : undefined,
        how ? `კითხვები, რასაც ხშირად სვამენ: ახალი გრაფიკით ჯამში რამდენი დაჯდება და იცვლება თუ არა განაკვეთი. ${HISTORY}` : undefined,
        behind && !how ? PENALTY : undefined,
        lead !== answer ? answer : undefined,
        help,
        COURT.test(s) || ENFORCE.test(s) ? 'უფასო იურიდიულ კონსულტაციას იურიდიული დახმარების სამსახური უწევს.' : undefined,
        q.distress ? 'თუ თავს საფრთხეში გრძნობ, დარეკე 112-ზე.' : undefined),
      chips: calls ? ['როგორ ვთხოვო გადავადება?', 'ჩემი გადასახადები მაჩვენე', 'გადახდა თუ დამიგვიანდა?']
        : how ? ['კრედიტ ისტორიაზე იმოქმედებს?', 'ჩემი გადასახადები მაჩვენე', 'გადახდა თუ დამიგვიანდა?']
        : behind ? ['როგორ ვთხოვო გადავადება?', 'ჩემი გადასახადები მაჩვენე', 'რა არის საკრედიტო ისტორია?']
        : refi ? ['რა არის ეფექტური განაკვეთი?', 'ჩემი გადასახადები მაჩვენე', 'როცა ვალს ვერ ვიხდი']
        : CARE_CHIPS,
      // the options as steps; when the question already asked "what do I do?", they were the answer, so a follow-up climbs to the next angle
      steps: ask && !special ? undefined
        : od ? 'ვარიანტები: 1) ყოველ ხელფასზე ერთი და იგივე თანხით დაფარვა; 2) ბანკთან საუბარი ლიმიტის შემცირებაზე ან დაფარვის გრაფიკზე; 3) ხარჯის სია — სად მიდის ფული.'
        : calls ? 'ვარიანტები: 1) ზარების დროისა და სიტყვების ჩანიშვნა; 2) საჩივარი გამსესხებელთან ან ეროვნულ ბანკში; 3) საუბარი რესტრუქტურიზაციაზე — ახალ გრაფიკზე.'
        : how ? 'ნაბიჯები: 1) დაკავშირება გამსესხებელთან; 2) მიზეზი და შემოსავლის საბუთი; 3) კითხვები — ახალი გრაფიკით ჯამში რამდენი და როგორ აისახება ისტორიაში.'
        : refi ? 'შედარება: ძველი სესხის დარჩენილი ჯამი და ახლის ჯამი — პროცენტით, საკომისიოებით და ვადით; ვადამდე დაფარვის საკომისიო: იმავე ორგანიზაციაში 0, სხვაში 0,5%-მდე.'
        : behind ? 'ვარიანტები: 1) ბანკთან საუბარი რესტრუქტურიზაციაზე — ვადის გადაცილების შემდეგაც; 2) ხელფასამდე გადასახდელის სია; 3) ეროვნული ბანკის მომხმარებელთა სერვისი.'
        : 'ვარიანტები: 1) ბანკთან საუბარი რესტრუქტურიზაციაზე — ახალ გრაფიკზე ან შეღავათზე; 2) ხელფასამდე გადასახდელის სია; 3) ეროვნული ბანკის მომხმარებელთა სერვისი.',
      simple: od ? `მარტივად: ოვერდრაფტი ვალია — ${gel(od.used)}. ყოველ ხელფასზე მისი ნაწილის დაფარვით ის თანდათან მცირდება.`
        : calls ? 'მარტივად: ვალზე დარეკვა მხოლოდ დილის 9-დან საღამოს 8-მდე შეიძლება და მუქარის გარეშე. სხვაგვარ ზარზე საჩივარი შეიძლება.'
        : refi ? 'მარტივად: ახალი სესხით ძველს ხურავ. სარგებელი მხოლოდ მაშინაა, თუ ახალი ჯამში იაფია.'
        : how ? 'მარტივად: გამსესხებელს უკავშირდები, მიზეზს უხსნი და შემოსავლის საბუთს აჩვენებ — გადაწყვეტილებას ის იღებს.'
        : 'მარტივად: ბანკს სთხოვ, სესხის პირობები შეგიცვალოს — მაგალითად, ვადა გაგიგრძელოს, რომ თვიური შენატანი შემცირდეს.',
      example: od ? `მაგალითად: ყოველ ხელფასზე 50 ₾-ით ${gel(od.used)} დაახლოებით ${odSteps} თვეში დაიფარება — პროცენტის გამო ცოტა მეტში.`
        : calls ? 'მაგალითად: ზარი ღამის 10 საათზე ან სიტყვები „დაგაპატიმრებენ" — ორივე წესის დარღვევაა და საჩივრის საფუძველია.'
        : refi ? `მაგალითად: დარჩენილი 1 000 ₾ 12 თვით, 1,5%-ით — ჯამში ~${gel(Math.round(annuity(1000, 0.015, 12) * 12))}; 24 თვით, 1,2%-ით — თვეში ნაკლები, მაგრამ ჯამში ~${gel(r10(annuity(1000, 0.012, 24) * 24))}.`
        : how ? 'მაგალითად: „შემოსავალი შემიმცირდა — შეიძლება 6 თვით შენატანის შემცირება?" ასეთ თხოვნაზე გამსესხებელი ახალ გრაფიკს გთავაზობს ან უარს ამბობს.'
        : `მაგალითად: 1 000 ₾ 12 თვით — თვეში ~${a12} ₾; იგივე 24 თვით — ~${a24} ₾, თუმცა ჯამში მეტს გადაიხდი.`,
      why: od ? 'რატომ ეტაპობრივად: ოვერდრაფტზე პროცენტი ყოველდღე ერიცხება, ამიტომ რაც უფრო ადრე მცირდება ვალი, მით ნაკლებ პროცენტს იხდი.'
        : calls ? `რატომ ჩანიშვნა: ${PROOF}`
        : refi ? 'რატომ ჯამი: დაბალი შენატანი ხშირად გრძელი ვადის ბრალია — პროცენტს მეტ თვეს იხდი.'
        : how ? 'რატომ საბუთი: გამსესხებელი გადაწყვეტილებას შენი შემოსავლის მიხედვით იღებს — საბუთი აჩვენებს, რა შენატანი გამოგივა.'
        : behind ? 'რატომ ახლა: ყოველ დაგვიანებულ დღეს ჯარიმა ემატება — კანონით დღეში დარჩენილი ძირის 0,27%-მდე, ჯამში კი ძირის 1,5-ჯერადამდე.'
        : 'რატომ თარიღამდე: ვადის გადაცილების შემდეგ ჯარიმა ერიცხება (დღეში დარჩენილი ძირის 0,27%-მდე) და დაგვიანება ისტორიაში ჩანს.',
    }
  },
  /** neutral debt questions: which debt first, snowball or avalanche, what refinancing is (no hardship template) */
  debts: (e, p, q) => {
    const s = q.raw.toLowerCase()
    const refi = /რეფინანს/.test(s)
    const methods = /თოვლის გუნდ|ზვავ|snowball|avalanche/.test(s)
    if (refi) return {
      title: 'რეფინანსირება',
      body: REFI_DEF,
      more: 'სხვა ორგანიზაციის სესხით რეფინანსირებისას ვადამდე დაფარვის საკომისიო დარჩენილი ძირის 0,5%-ს ვერ გადააჭარბებს (2025 წლის 1 მაისიდან); იმავე ორგანიზაციაში — არ ეკისრება.',
      mine: debtsLine(p),
      rule: 'ორ სესხს ერთმანეთს ჯამური ფასი, ვადა და საკომისიოები ადარებს — თვიური შენატანი მარტო არა.',
      chips: ['რა არის ეფექტური განაკვეთი?', 'ვადამდე დაფარვის საკომისიო რამდენია?'],
      steps: 'შედარება: ძველი სესხის დარჩენილი ჯამი და ახლის ჯამი — პროცენტით, საკომისიოებით და ვადით; ვადამდე დაფარვის საკომისიო: იმავე ორგანიზაციაში 0, სხვაში 0,5%-მდე.',
      simple: 'მარტივად: ახალი სესხით ძველს ხურავ. სარგებელი მხოლოდ მაშინაა, თუ ახალი ჯამში იაფია.',
      example: `მაგალითად: დარჩენილი 1 000 ₾ 12 თვით, 1,5%-ით — ჯამში ~${gel(Math.round(annuity(1000, 0.015, 12) * 12))}; 24 თვით, 1,2%-ით — თვეში ნაკლები, მაგრამ ჯამში ~${gel(r10(annuity(1000, 0.012, 24) * 24))}.`,
      why: 'რატომ ჯამი: დაბალი შენატანი ხშირად გრძელი ვადის ბრალია — პროცენტს მეტ თვეს იხდი.',
    }
    return {
      title: 'ვალების დაფარვის რიგი',
      body: methods ? METHODS_TEXT : DEBT_ORDER_TEXT,
      more: 'ორივე მიდგომით დანარჩენ ვალებზე მინიმალური შენატანი დროზე იხდება: დაგვიანებას ჯარიმა ემატება — კანონით დღეში დარჩენილი ძირის 0,27%-მდე.',
      mine: `${debtsLine(p)} თითოეულის განაკვეთი ხელშეკრულებაშია.`,
      rule: 'ვალებს შორის ყველაზე ძვირი ისაა, რომლის ეფექტური განაკვეთიც ყველაზე მაღალია.',
      chips: ['რა არის ეფექტური განაკვეთი?', 'გადახდა თუ დამიგვიანდა?', 'რეფინანსირება რას ნიშნავს?'],
      steps: 'ვარიანტები: 1) ყველა ვალის სია — თანხა, განაკვეთი, თარიღი; 2) მინიმალური შენატანები დროზე; 3) დამატებითი თანხა ერთ ვალზე — ძვირზე ან პატარაზე.',
      simple: 'მარტივად: ან ჯერ ყველაზე ძვირი ვალი (ნაკლებ პროცენტს იხდი), ან ჯერ ყველაზე პატარა (ვალები უფრო მალე იკლებს).',
      example: 'მაგალითად: ვალი ა — 300 ₾, 10%-ით; ვალი ბ — 1 000 ₾, 30%-ით. „ზვავი" ჯერ ბ-ს ფარავს (მაღალი განაკვეთი), „თოვლის გუნდა" — ა-ს (პატარა თანხა).',
      why: 'რატომ განაკვეთი: ყოველ თვეს თითოეული ვალის დარჩენილ თანხას საკუთარი პროცენტი ერიცხება — ძვირი ვალის ადრე დაფარვა ამ პროცენტს ამცირებს.',
    }
  },
  fixed: e => ({
    title: 'ფიქსირებული და ცვალებადი ხარჯი',
    body: 'ფიქსირებული ხარჯი ყოველთვე მეორდება (ქირა, კომუნალური, განვადება). ცვალებადი დღიდან დღემდე იცვლება (საკვები, ტრანსპორტი, კაფე).',
    mine: `შენი ფიქსირებული ხარჯი: ${gel(e.fixedTotal)} — ხელფასის ${Math.round(e.fixedTotal / e.p.salary * 100)}%. ეს ფული უკვე „დაკავებულია", სანამ პირველ ლარს დახარჯავ.`,
    rule: 'ხელფასს ჯერ ფიქსირებული ხარჯი აკლდება — ყოველდღიური ხარჯისთვის დარჩენილი თანხა რჩება.',
    chips: ['რა არის 50/30/20 წესი?', 'დღეს რამდენი შემიძლია?'],
    simple: 'მარტივად: ფიქსირებული ყოველთვე ერთი და იგივეა (ქირა), ცვალებადი — დღიდან დღემდე განსხვავებული (საკვები).',
    example: `მაგალითად: შენი ფიქსირებული ხარჯი თვეში ${gel(e.fixedTotal)}-ია — ის ხელფასს ხარჯვის დაწყებამდე აკლდება.`,
    why: 'რატომ: სახარჯად რეალურად მხოლოდ ის გაქვს, რაც ფიქსირებული ხარჯის შემდეგ რჩება.',
  }),
  budget: (e, p, q) => {
    const fixedPct = Math.round(e.fixedTotal / p.salary * 100)
    const ms = Math.round(e.medianSurplus)
    // "საიდან დავიწყო?": where to start (seeing where every lari goes, with the person's numbers), 50/30/20 only as one guide
    const start = /საიდან|როგორ დავიწყო|პირველი ნაბიჯ|დასაწყის|როგორ შევადგინო|როგორ დავგეგმო|შევამცირო|შემცირებ|შევკვეცო|დავწიო/.test(q.raw.toLowerCase())
    return {
      answer: start ? `ბიუჯეტი ხარჯის ნახვით იწყება — სად მიდის ყოველი ლარი: შენთან თვეში ${gel(e.fixedTotal)} გადასახადებზე მიდის, ~${gel(r10(e.monthlyVarMedian))} — ყოველდღიურ ხარჯზე.` : undefined,
      info: start ? `შემდეგ ფიქსირებული გადასახადები გამოიყოფა და დარჩენილი ნაწილდება — მაგალითად, 50/30/20 ორიენტირით. თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} გრჩება.` : undefined,
      title: start ? 'ბიუჯეტი: საიდან დავიწყო' : 'ბიუჯეტის 50/30/20 წესი',
      body: '50/30/20 ბიუჯეტის გავრცელებული ორიენტირია: ხელფასის ~50% აუცილებელ ხარჯზე, ~30% სურვილებზე და ~20% დანაზოგზე.',
      more: 'ეს მიახლოებითი ორიენტირია და არა ვალდებულება: მაღალი ქირისას აუცილებელი ხარჯი ხშირად 50%-ს აჭარბებს.',
      mine: `შენთან ფიქსირებული ხარჯი ${gel(e.fixedTotal)}-ია — ხელფასის ${fixedPct}%. თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} (${Math.max(0, Math.round(ms / p.salary * 100))}%) გრჩება.`,
      rule: 'ბიუჯეტი იწყება იქიდან, რომ ჩანს, სად მიდის ყოველი ლარი.',
      chips: start ? ['ჩემი გადასახადები მაჩვენე', 'რამდენს ვხარჯავ თვეში?', 'რა არის 50/30/20 წესი?'] : ['რა არის ფიქსირებული ხარჯი?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'],
      steps: `დაწყება ასე შეიძლება: 1) ერთი თვის ხარჯის ნახვა — სად მიდის ყოველი ლარი; 2) ფიქსირებული გადასახადების (${gel(e.fixedTotal)}) გამოყოფა; 3) დარჩენილის განაწილება.`,
      simple: 'მარტივად: ხელფასი სამ ნაწილად იყოფა — აუცილებელი, სურვილები და დანაზოგი.',
      example: `მაგალითად: ${gel(p.salary)} ხელფასზე ეს იქნებოდა ${gel(p.salary * 0.5)} აუცილებელზე, ${gel(p.salary * 0.3)} სურვილებზე და ${gel(p.salary * 0.2)} დანაზოგზე.`,
      why: 'რატომ: ასე წინასწარ ჩანს, რამდენი რჩება დანაზოგისთვის — და არა მხოლოდ თვის ბოლოს.',
    }
  },
  // Civil Code art. 625(5) (consolidated 25/06/2026, matsne.gov.ge/ka/document/download/31702/140/ge/pdf): penalties and fees up to 0,27% of the remaining
  // principal a day, plus a one-off late fee up to 20 ₾; until a delinquency is cleared, all charges with interest up to 1,5 times the principal
  late: (e, p, q, ctx) => {
    const inst = p.fixed.filter(f => f.kind === 'installment')
    const s = q.raw.toLowerCase()
    const howMuch = /რამდენ|რა ოდენობ|რა ფას|რამხელა|პირგასამტეხლო/.test(s)
    // "პირგასამტეხლო რას ნიშნავს?": the word first, the caps after it
    const define = /პირგასამტეხლო/.test(s) && /რას ნიშნავ|რა არის|რაა|რას ჰქვია|ნიშნავს/.test(s)
    const cap = 'კანონით ჯარიმა და საკომისიოები დღეში დარჩენილი ძირის 0,27%-ს ვერ გადააჭარბებს, ერთჯერადად კი შეიძლება 20 ₾-მდე დაემატოს. 1 000 ₾-ზე ეს დღეში მაქსიმუმ 2,7 ₾-ია.'
    // a loan just discussed: the caps on that loan (a new loan's remaining principal is its amount)
    const la = (ctx.kind === 'micro' || ctx.kind === 'loan' || ctx.kind === 'installment') && ctx.amount ? ctx.amount - (ctx.upfront ?? 0) : undefined
    const perDay = la ? Math.round(la * 0.0027 * 100) / 100 : 0
    const onLoan = la ? `${gel(la)}-იან სესხზე დაგვიანების ჯარიმა და საკომისიოები კანონით დღეში ~${fmt(perDay, perDay % 1 ? 2 : 0)} ₾-ს ვერ გადააჭარბებს, ერთჯერადად კი 20 ₾-მდე შეიძლება დაემატოს.` : undefined
    return {
      title: 'დაგვიანებული გადახდა',
      body: 'დაგვიანებისას ჯარიმა ერიცხება — კანონით დღეში დარჩენილი ძირის 0,27%-მდე — და დაგვიანება საკრედიტო ისტორიაში აისახება.',
      answer: define ? 'პირგასამტეხლო ხელშეკრულების დარღვევის ჯარიმაა — მაგალითად, გადახდის დაგვიანებისას. კანონით ის დღეში დარჩენილი ძირის 0,27%-ს ვერ გადააჭარბებს.'
        : onLoan ?? (howMuch ? cap : undefined),
      info: define ? `${cap} ერთი ვადაგადაცილებისას ჯარიმები, საკომისიოები და პროცენტი ჯამში დარჩენილი ძირის 1,5-ჯერადს ვერ გადააჭარბებს.`
        : la ? `ერთი ვადაგადაცილებისას ჯარიმები, საკომისიოები და პროცენტი ჯამში ძირის 1,5-ჯერადს — ${gel(Math.round(la * 1.5))}-ს — ვერ გადააჭარბებს. დაგვიანება საკრედიტო ისტორიაშიც აისახება; ზუსტ ჯარიმას ხელშეკრულება აჩვენებს.`
        : howMuch ? 'ერთი ვადაგადაცილებისას ჯარიმები, საკომისიოები და პროცენტი ჯამში დარჩენილი ძირის 1,5-ჯერადს ვერ გადააჭარბებს. ზუსტ ჯარიმას ხელშეკრულება აჩვენებს — კანონი ზედა ზღვარს ადგენს.' : 'ზედა ზღვარი: დღეში დარჩენილი ძირის 0,27% და ერთჯერადად 20 ₾-მდე; ზუსტ ჯარიმას ხელშეკრულება აჩვენებს.',
      more: 'ერთი ვადაგადაცილებისას ჯარიმები, საკომისიოები და პროცენტი ჯამში დარჩენილი ძირის 1,5-ჯერადს ვერ გადააჭარბებს.',
      mine: la ? `${gel(la)}-იან სესხზე: დღეში მაქსიმუმ ~${fmt(perDay, perDay % 1 ? 2 : 0)} ₾, 10 დღეში ~${fmt(Math.round(perDay * 10 * 10) / 10, 1)} ₾ (+ ერთჯერადად 20 ₾-მდე).`
        : inst.length ? `შენი შენატანები: ${inst.map(f => `${f.name} ${gel(f.amount)} — თვის ${f.day}-ში`).join(', ')}.` : 'ახლა სესხის შენატანი არ გაქვს.',
      rule: 'ზუსტ ჯარიმას ხელშეკრულება აჩვენებს — კანონი მხოლოდ ზედა ზღვარს ადგენს.',
      chips: ['რა არის საკრედიტო ისტორია?', 'როცა ვალს ვერ ვიხდი'],
      steps: 'ვარიანტები: გამსესხებელთან საუბარი თარიღამდე — შეღავათზე ან გადახდის თარიღის შეცვლაზე; ხელშეკრულებაში ჯარიმის პუნქტი; ხელფასამდე გადასახდელის სია.',
      simple: 'მარტივად: დაგვიანებისას ჯარიმა გემატება (კანონით დღეში დარჩენილი ძირის 0,27%-მდე) და ეს საკრედიტო ისტორიაში ჩანს.',
      example: 'მაგალითად: 1 000 ₾ დარჩენილ ძირზე ჯარიმა დღეში მაქსიმუმ 2,7 ₾-ია, 10 დღეში — მაქსიმუმ 27 ₾.',
      why: 'რატომ მნიშვნელოვანია: ჯარიმა ყოველ დაგვიანებულ დღეს ემატება, დაგვიანება კი ისტორიაში დაფარვიდან 5 წელი ჩანს.',
    }
  },
  data: (e, p, q) => {
    const s = q.raw.toLowerCase()
    const safety = /დაცულ|უსაფრთხო|კონფიდენც|privacy|safe/.test(s)
    const answer = /გადარიცხე|გადაიტანე|ჩარიცხე|გადაურიცხე|გადამირიცხე|transfer/.test(s) ? 'ფულს ვერ გადავრიცხავ: ჯიხო შენს ანგარიშებს ვერ მართავს და ბანკთან დაკავშირებული არ არის — მხოლოდ ციფრებს გაჩვენებს.'
      // "are these numbers real or made up?"
      : /(?:რიცხვ|ციფრ|მონაცემ)\S*\s.*(?:რეალურ|ნამდვილ|გამოგონილ)|(?:რეალურია|ნამდვილია) თუ|გამოგონილია|სინთეზურ/.test(s) ? `ხარჯები გამოგონილია: დემოში ${p.name}ს ${p.historyMonths} თვის ხარჯები სინთეზურია, მაგრამ ყველა რიცხვი მათზე ზუსტი ფორმულით ითვლება.`
      // "what do you know about me?": the data points themselves
      : /რა იცი ჩემზე|რა იცით ჩემზე/.test(s) ? `დემოში ვიცი: ხელფასი ${gel(p.salary)} (${p.paydayDay}-ში), თვის გადასახადები ${gel(e.fixedTotal)}, ანგარიშებზე ${gel(e.spendable)}${p.savings ? `, ქვევრში ${gel(p.savings.amount)}` : ''}. ყველაფერი სინთეზურია.`
      : /დაკავშირებულ|ხედავ|connected|ანგარიშიდან|იღებ ინფორმაციას|ინფორმაციას იღებ/.test(s) ? 'არა. ახლა დემო რეჟიმში ვარ: ვმუშაობ სინთეზურ (გამოგონილ) ტრანზაქციებზე და შენს ბანკთან დაკავშირებული არ ვარ.'
      : /საიდან|ტრანზაქცი|ამონაწერ/.test(s) ? 'დემოში ტრანზაქციები სინთეზურია (გამოგონილი). რეალურ ვერსიაში მათ ბანკის ამონაწერიდან ვითვლი, რომელსაც შენ ტვირთავ.'
        // not "never shares": the planned bank version gets data with the person's consent
        : /უზიარ|გადასცემ|ვის აძლევ|ყიდი/.test(s) ? 'დემოში მონაცემები არავის გადაეცემა: ხარჯები გამოგონილია, ჩატი ამ მოწყობილობაზე რჩება. რეალურ ვერსიაში ბანკი მათ მხოლოდ შენი თანხმობით მიიღებს.'
        // honest about the demo and the planned path (a statement the user uploads, a partner bank later); no security feature that is not built
        : /ინახ|შენახ|სერვერ|სად მიდის ჩემი მონაცემ/.test(s) ? 'დემოში რიცხვებს შენს მოწყობილობაზე ვითვლი და რეალური მონაცემები არ გამოიყენება — ტრანზაქციები სინთეზურია.'
        // the protective facts lead; the upload path is behind the ⓘ
        : safety ? 'დემოში რეალური მონაცემები საერთოდ არ გამოიყენება, ჯიხოს კი არასდროს სჭირდება შენი პაროლი, PIN ან SMS-კოდი.'
          : /ბანკის აპ|სხვა აპ/.test(s) ? 'ბანკის აპი გიჩვენებს, რა მოხდა. მე გაჩვენებ, რა შეიძლება მოხდეს ხელფასამდე — შენი ყველა ბანკის ამონაწერით ერთად.'
            : `ვიცი მხოლოდ ის, რაც დემოშია: ${p.name}ს ${p.historyMonths} თვის სინთეზური ხარჯები. შენს ბანკთან დაკავშირებული არ ვარ.`
    return {
      title: 'რა მონაცემებით ვმუშაობ',
      body: answer,
      more: 'რეალურ ვერსიაში ხარჯებს ბანკის ამონაწერით ვითვლი, რომელსაც შენ ტვირთავ. პარტნიორ ბანკთან კავშირი შემდეგი ეტაპია — მხოლოდ შენი თანხმობით.',
      // what is stored where (the chat history stays in this browser; nothing is sent anywhere)
      mine: safety || /ინახ|შენახ|სერვერ/.test(s) ? 'ჩატის ისტორია მხოლოდ ამ მოწყობილობაზე, ბრაუზერში ინახება; დემოს ხარჯები სინთეზურია.' : `${p.name}ს ${p.historyMonths} თვის სინთეზური (გამოგონილი) ისტორია, ${p.balances.length} ბანკის ანგარიში — დემო რეჟიმი.`,
      rule: safety ? 'ჯიხო ფულს ვერ გადარიცხავს და ანგარიშებს ვერ მართავს — მხოლოდ ციფრებს გაჩვენებს.' : 'ჯიხოს არასდროს სჭირდება შენი პაროლი, PIN ან SMS-კოდი.',
      info: safety ? 'რეალურ ვერსიაში ხარჯს იმ ამონაწერით ვითვლი, რომელსაც შენ ატვირთავ. პარტნიორ ბანკთან კავშირი შემდეგი ეტაპია — მხოლოდ შენი თანხმობით.'
        : /ინახ|შენახ|სერვერ/.test(s) ? 'ჯიხოს არასდროს სჭირდება პაროლი, PIN ან SMS-კოდი. პარტნიორ ბანკთან კავშირი შემდეგი ეტაპია — მხოლოდ შენი თანხმობით.'
        : /უზიარ|გადასცემ|ვის აძლევ|ყიდი/.test(s) ? 'დემოში რეალური მონაცემები საერთოდ არ გამოიყენება — ტრანზაქციები სინთეზურია.' : undefined,
      chips: ['რამდენად ზუსტია პროგნოზი?', WEATHER_CHIP],
      simple: 'მარტივად: დემოში გამოგონილ ხარჯებზე ვითვლი. შენს ბანკს არ ვუკავშირდები.',
      example: `მაგალითად: ${p.name}ს ${p.historyMonths} თვის გამოგონილი ხარჯები მაქვს — ყველა პროგნოზს მათზე ვითვლი.`,
      why: 'რატომ დემო: რეალურ ვერსიაში ხარჯებს ბანკის ამონაწერიდან ვითვლი, რომელსაც შენ ტვირთავ.',
    }
  },
  nobank: (e, p, q) => {
    const s = q.raw.toLowerCase()
    const named = /თიბისი|tbc|საქართველოს ბანკ|bog|ლიბერთი|liberty|ტერაბანკ|ბაზისბანკ|პროკრედიტ|კრედო|ქრედო|credo/.test(s)
    // a category question ("MFO or bank?"): a category fact, no name; Civil Code art. 625(2): the 50% cap covers every kind of loan
    const mfo = /მიკრო|მფო/.test(s) && !named
    // support mode: no invitation to price a new loan; her PTI against her own limit instead
    const sup = isSupport(p)
    const lim = ptiLimit(p).now
    const cap = Math.round(p.salary * lim / 100), room = Math.round(cap - debtNow(p))
    const roomTxt = room > 0 ? `თვეში ~${gel(room)} რჩება` : 'აღარაფერი რჩება'
    return {
      title: 'შეთავაზებების შედარება',
      body: 'კონკრეტულ ბანკს ან კომპანიას ვერ დაგისახელებ და მათ ერთმანეთს არ ვადარებ. მომწერე შეთავაზების თანხა, ვადა და განაკვეთი — შენს თვეებზე გაჩვენებ.',
      answer: sup ? `კონკრეტულ გამსესხებელს ვერ დაგისახელებ. სესხებზე უკვე შემოსავლის ${fmt(debtNow(p) / p.salary * 100, 1)}% მიდის: შენი ${lim}%-იანი ლიმიტამდე ${roomTxt}.`
        : mfo ? 'კონკრეტულ კომპანიას ვერ დაგისახელებ. მიკროსაფინანსოს სესხი ხშირად ბანკისაზე ძვირია, თუმცა ორივეზე ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს.' : undefined,
      info: sup ? 'ბანკი სესხის გაცემისას PTI-ს ამოწმებს: ახალი შენატანი ამ თანხაზე მეტი თუ იქნება, PTI ლიმიტს გადააჭარბებს. სწრაფი სესხი ხშირად ძვირია; ნებისმიერ სესხზე ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს. არსებული სესხის ახალ გრაფიკზე საუბარიც ერთ-ერთი ვარიანტია.'
        : mfo ? 'სესხებს ერთმანეთთან ეფექტური განაკვეთი და დასაბრუნებელი ჯამური თანხა ადარებს. მომწერე შეთავაზების თანხა, ვადა და განაკვეთი — შენს თვეებზე გაჩვენებ.' : undefined,
      more: 'სესხებს ერთმანეთთან ეფექტური განაკვეთი და დასაბრუნებელი ჯამური თანხა ადარებს. ლიცენზირებული ბანკებისა და მიკროსაფინანსო ორგანიზაციების სია ეროვნული ბანკის საიტზეა.',
      mine: sup ? debtsLine(p) : ptiNowText(p),
      rule: 'თვიური შენატანი სესხის ფასს არ აჩვენებს — ფასს ჯამური თანხა და ეფექტური განაკვეთი აჩვენებს.',
      chips: sup ? ['როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე', 'რა არის PTI?'] : ['2 000 ₾ სესხი 24 თვით 18%-ით', 'რა არის ეფექტური განაკვეთი?'],
      steps: sup ? 'ვარიანტები: 1) არსებული სესხის ახალ გრაფიკზე საუბარი გამსესხებელთან; 2) ხელფასამდე გადასახდელის სია; 3) ეროვნული ბანკის მომხმარებელთა სერვისი.'
        : 'შედარება ასე გამოდის: 1) ყველა შეთავაზების ეფექტური განაკვეთი და ჯამური თანხა; 2) თითოეულის აქ ჩაწერა — შენს თვეებზე გაჩვენებ.',
      simple: sup ? `მარტივად: სესხების შენატანზე უკვე ${gel(debtNow(p))} მიდის ${gel(p.salary)}-დან — ლიმიტამდე ${roomTxt}.`
        : 'მარტივად: ბანკებს არ ვადარებ. მომწერე შეთავაზება — თანხა, ვადა, განაკვეთი — და შენს თვეებზე გაჩვენებ.',
      // asked again in other words, the refusal stays visible, with what Jikho does instead
      example: sup ? `მაგალითად: ${gel(p.salary)}-ის ${lim}% თვეში ${gel(cap)}-ია; აქედან ${gel(debtNow(p))} უკვე სესხებზე მიდის — რჩება ~${gel(Math.max(0, room))}.`
        : 'ბანკებს ერთმანეთს არ ვადარებ. სამაგიეროდ, შეთავაზებას — მაგ., „2 000 ლარი 24 თვით 18%-ით" — შენს თვეებზე გაჩვენებ: შენატანს, ჯამს და „მძიმე" თვეებს.',
      why: sup ? 'რატომ: PTI-ის ლიმიტს ბანკი სესხის გაცემისას ამოწმებს — ასე ზომავს, რამდენი შენატანი ეტევა შემოსავალში.'
        : 'რატომ: სესხის ფასს ეფექტური განაკვეთი და ჯამური თანხა აჩვენებს — არა ბანკის სახელი.',
    }
  },
  gambling: (e, p, q) => {
    const s = q.raw.toLowerCase()
    const loan = /სესხ|ვისესხ|კრედიტ|(?:^|[^ა-ჰ])ვალ|loan|кредит|займ/.test(s)
    // win-back wording ("როგორ დავიბრუნო?") is chasing; a loss told plainly is not assumed to be
    const chase = /დავიბრუნ|უკან (?:დავიბრუნ|მოვიგ)|ამოვიღო|ამოვიგო|win it back|отыгр/.test(s)
    const lost = /წავაგე|წაგებ|проигр|lost/.test(s)
    const won = /მოვიგე|მოგება|გაორმაგ|გავაორმაგე/.test(s) && !lost && !chase
    const again = !won && /კიდევ|ერთხელ|ხელახლა|ისევ|again/.test(s)
    const limit = /შევიზღუდ|შეზღუდვ|ავიკრძალ|აკრძალვ|თვითშეზღუდ|შევწყვიტო|დავბლოკ|დაბლოკვ|ამიკრძალ|ვიკრძალ|ჩავიკეტო|თავს? (?:როგორ )?(?:შევაჩერო|გავაჩერო)/.test(s)
    // "ყოველ საღამოს 20-30 ლარზე": the month's stakes from the person's own numbers
    const freq = /ყოველ (?:საღამოს|დღე)|ყოველდღე|დღეში|ყოველ ღამე/.test(s) ? 30 : /კვირაში|ყოველ კვირა/.test(s) ? 4 : 0
    const [lo, hi] = q.range ?? (q.amount !== undefined ? [q.amount, q.amount] : [0, 0])
    const stakes = freq && hi ? { lo: lo * freq, hi: hi * freq } : undefined
    const stakeTxt = stakes ? (stakes.lo === stakes.hi ? gel(stakes.lo) : `${fmt(stakes.lo)}–${gel(stakes.hi)}`) : ''
    const shareTxt = stakes ? (stakes.lo === stakes.hi ? `${Math.round(stakes.lo / p.salary * 100)}%` : `${Math.round(stakes.lo / p.salary * 100)}–${Math.round(stakes.hi / p.salary * 100)}%`) : ''
    const SIGNS = 'ყოველდღიური თამაში, წაგებულის დაბრუნების მცდელობა და ახლობლებისთვის დამალვა აზარტულ თამაშზე დამოკიდებულების ცნობილი ნიშნებია.'
    const ms = e.medianSurplus
    // "ბოლო თვეში 300 ლარი წავაგე": the sum can come in as a monthly one
    const a = q.amount ?? q.perMonth
    // to the half month: 200 ₾ at ~131 ₾ a month is "~1,5", not "~2"
    const half = a && ms > 0 && a >= ms * 0.75 ? Math.max(1, a / ms < 10 ? Math.round(a / ms * 10) / 10 : Math.round(a / ms)) : undefined
    const months = half ? fmt(half, half % 1 ? 1 : 0) : undefined
    // the self-restriction list: rs.ge (Revenue Service), online, ID verified, 5 years (fact-check line S11; identomat.com case study, service live since 6 May 2025)
    const SELF = 'საქართველოში შესაძლებელია საკუთარი თავის შეყვანა აზარტული თამაშების შეზღუდვის სიაში rs.ge-ზე, ონლაინ, პირადობის გადამოწმებით — 5 წლით.'
    // European roulette: one zero in 37 numbers, an edge of 1/37 ≈ 2,7% a bet; 30 bets of 100 ₾ lose ~81 ₾ on average (repeated play is not "a few lari")
    // roulette's 1/37 for roulette or casino words; for sports bets and slots the edge is built into the odds or the game, often higher, so no roulette figure is used
    const REPEAT = /რულეტ|კაზინო|casino/.test(s) || !/ტოტალიზატორ|სპორტ|ფეხბურთ|ბეთ|სლოტ|ფსონ|bet/.test(s)
      ? 'რულეტკაზე ორგანიზატორის უპირატესობა ~2,7%-ია: 100 ₾-იან ფსონზე საშუალოდ ~2,7 ₾, მაგრამ 30 ასეთ ფსონზე — უკვე ~80 ₾.'
      : 'ორგანიზატორის უპირატესობა ყოველ ფსონშია ჩადებული — სპორტულ ფსონებში კოეფიციენტებში, სლოტებში თამაშის წესებში: რაც მეტჯერ თამაშობ, მით მეტი ჯამდება.'
    return {
      title: limit ? 'თამაშის შეზღუდვა' : 'აზარტული თამაში და ვალი',
      // "ეს ბევრია?" right after the stakes were shown: the stakes against the usual month-end surplus (a fact, the judgement stays the person's)
      answer: q.costly && stakes ? `ფსონებზე თვეში ${stakeTxt} მიდის — ${stakes.hi > ms ? `ეს შენს ჩვეულ თვიურ ნაშთზე (~${gel(Math.max(0, Math.round(ms)))}) მეტია` : `ეს შენი ჩვეული თვიური ნაშთის (~${gel(Math.round(ms))}) ~${Math.round(stakes.hi / ms * 100)}%-ია`}: ანუ ის, რაც სხვაგვარად დაგრჩებოდა.` : undefined,
      body: loan ? 'წაგების დასაფარად ან სათამაშოდ აღებულ სესხს არ დავითვლი: ვალი რჩება, მოგება კი გარანტირებული არ არის.'
        : limit ? SELF
        : chase ? 'წაგებულის დაბრუნების მცდელობა ჩვეულებრივ დანაკარგს ზრდის: აზარტული თამაში ისეა აწყობილი, რომ დროთა განმავლობაში მოგება ორგანიზატორს რჩება.'
        : lost ? `${a ? `${gel(a)}-ის წაგება` : 'წაგება'} მძიმეა${months ? ` — ეს შენი ~${months} თვის ჩვეული ნაშთია` : ' — ეს ბევრს ემართება'}. თამაშის შეზღუდვა შეიძლება rs.ge-ზე: საკუთარი თავის შეყვანით შეზღუდვის სიაში.`
        : won ? 'მოგების შემდეგ შანსი ყოველ ახალ ფსონზე იგივე რჩება: აზარტული თამაში ისეა აწყობილი, რომ დროთა განმავლობაში მოგება ორგანიზატორს რჩება.'
        : again ? 'ახალი ფსონი წინა წაგებას არ აბრუნებს: ყოველ ფსონზე შანსი იგივეა და წინა წაგება მომდევნო მოგებას არ აახლოებს.'
        : stakes ? `${freq === 30 ? 'ყოველდღე' : 'ყოველ კვირა'} ${lo === hi ? gel(lo) : `${fmt(lo)}–${gel(hi)}`} თვეში ${stakeTxt}-ის ფსონია — შენი ხელფასის ${shareTxt}. დროთა განმავლობაში მოგება ორგანიზატორს რჩება.`
        : 'აზარტული თამაში ისეა აწყობილი, რომ დროთა განმავლობაში მოგება ორგანიზატორს რჩება: ერთ ფსონზე დანაკარგი მცირე ჩანს, მაგრამ ყოველი ახალი ფსონით ჯამდება.',
      info: limit ? undefined : stakes ? `${SIGNS} ${SELF}` : lost && !chase ? `სიაში ყოფნა 5 წელი გრძელდება; რეგისტრაცია ონლაინაა, პირადობის გადამოწმებით.${/ქმარ|ცოლ|ოჯახ|მშობ|ვერ ვეუბნები|ვუმალავ/.test(s) ? ' ბევრს უჭირს ამაზე ახლობლისთვის თქმა — ეს ხშირია.' : ''} ${REPEAT}` : chase || loan ? SELF : REPEAT,
      more: 'ეს მათემატიკაა და არა იღბალი: ყოველ ფსონზე ორგანიზატორს მცირე უპირატესობა აქვს, და რაც მეტჯერ თამაშობ, მით მეტი ჯამდება.',
      mine: stakes ? `ფსონებზე თვეში ${stakeTxt}, შენი ჩვეული თვიური ნაშთი კი ~${gel(Math.max(0, Math.round(ms)))}-ია.` : months ? `${gel(a!)} ≈ შენი ~${months} თვის ჩვეული ნაშთი (თვეში ~${gel(Math.round(ms))}).` : 'ფსონზე დახარჯული ყოველი ლარი ხელფასამდე ბიუჯეტს აკლდება — ჯიხო „სათამაშო თანხას" არ ითვლის.',
      rule: 'წაგების დასაფარად აღებული სესხი ვალს ზრდის და დანაკარგს არ აბრუნებს.',
      // no "how much can I spend today?" after a bet question: it could read as money to bet
      chips: limit ? ['ჩემი გადასახადები მაჩვენე', 'როცა ვალს ვერ ვიხდი', 'ხელფასამდე მეყოფა?'] : ['აზარტული თამაში როგორ შევიზღუდო?', 'ჩემი გადასახადები მაჩვენე', 'როცა ვალს ვერ ვიხდი'],
      steps: 'ვარიანტები: 1) თამაშის შეზღუდვა rs.ge-ზე — სიაში 5 წლით; 2) წაგებულის ჩაწერა — თვეში რამდენი მიდის; 3) ახლობელთან საუბარი.',
      simple: 'მარტივად: აზარტულ თამაშში დროთა განმავლობაში ორგანიზატორი იგებს, ამიტომ წაგებულის დაბრუნება იშვიათად გამოდის.',
      example: 'მაგალითად: რულეტკაზე 100 ₾-იან ფსონზე საშუალოდ ~2,7 ₾ ორგანიზატორს რჩება, 30 ფსონზე — ~80 ₾. რაც მეტს თამაშობ, მით მეტი.',
      why: 'რატომ: ყოველ ფსონზე ორგანიზატორს მცირე უპირატესობა აქვს, რომელიც დროთა განმავლობაში ჯამდება.',
    }
  },
}

/** plain facts with no card: [question, visible answer, ⓘ, chips] */
const FACTS: [RegExp, string, string?, string[]?][] = [
  [/იპოთეკ/, 'იპოთეკა ბინის ან სახლის გირაოთი აღებული სესხია, ხშირად 10–20 წლით. თუ ვალს ვერ ფარავ, ბანკს ქონების გაყიდვა შეუძლია.', 'გრძელი ვადის გამო ჯამური პროცენტი დიდია — ამას ეფექტური განაკვეთი და ჯამური თანხა აჩვენებს.'],
  [/თავდებ/, 'თავდები პირობას დებს, რომ თუ მსესხებელი ვერ გადაიხდის, ვალს ის დაფარავს. ეს ვალდებულება შენს საკრედიტო ისტორიაშიც შეიძლება გამოჩნდეს.', 'თავდებობისას მსესხებლის ვალი შენი ვალიც ხდება: ბანკს მისი შენგან მოთხოვნა შეუძლია.'],
  [/უზრუნველყოფ|გირაო/, 'უზრუნველყოფა (გირაო) ქონებაა — ბინა, მანქანა ან ოქრო — რომელიც სესხის დაფარვის გარანტიაა. თუ ვალს ვერ ფარავ, ბანკს მისი გაყიდვა შეუძლია.'],
  [/საშეღავათო/, 'საშეღავათო პერიოდში საკრედიტო ბარათით დახარჯულ თანხაზე პროცენტი არ ერიცხება, თუ მას ვადაში სრულად დაფარავ. ვადა ხელშეკრულებაშია.'],
  [/საკრედიტო ლიმიტ|ლიმიტი რა/, 'საკრედიტო ლიმიტი მაქსიმალური თანხაა, რომლის გამოყენებაც ბარათით ან ოვერდრაფტით შეგიძლია. პროცენტი მხოლოდ გამოყენებულ თანხას ერიცხება.'],
  [/დებეტურ|სადებეტო/, 'დებეტური ბარათით საკუთარ ფულს ხარჯავ, საკრედიტოთი — ბანკის ფულს, რომელსაც მერე აბრუნებ: ვადაში დაუფარავ თანხას პროცენტი ერიცხება.'],
  [/საკრედიტო ბარათ/, 'საკრედიტო ბარათით ბანკის ფულს ხარჯავ ლიმიტის ფარგლებში. საშეღავათო პერიოდში დაფარულ თანხას პროცენტი არ ემატება, მის შემდეგ — ემატება.'],
  // "ლომბარდი უფრო იაფია, ვიდრე მიკროსესხი?": no category ranking Jikho cannot back; the two facts that compare them
  [/ლომბარდ\S*.*(?:იაფ|ძვირ|ჯობ|სჯობ|ვიდრე|შედარ|განსხვავ).*(?:მიკრო|ბანკ|სესხ)|(?:მიკრო|ბანკ)\S*.*(?:იაფ|ძვირ|ჯობ|სჯობ|ვიდრე|განსხვავ).*ლომბარდ/, 'ზოგადად ვერ ვიტყვი, რომელი იაფია: ორივეზე ფასს ეფექტური განაკვეთი და ჯამური თანხა აჩვენებს და ორივეზე ის კანონით 50%-ს ვერ გადააჭარბებს.', 'განსხვავება: ლომბარდი ნივთის (ხშირად ოქროს) გირაოს ითხოვს — ვადაში დაუფარავობისას ნივთი შეიძლება გაიყიდოს. ორივე შეთავაზების თანხა, ვადა და დასაბრუნებელი თანხა თუ მომწერე, შენს თვეებზე ორივეს გაჩვენებ.', ['რა არის ეფექტური განაკვეთი?', 'მიკროსესხი 300 ლარი 30 დღით', 'რა არის საკრედიტო ისტორია?']],
  [/ლომბარდ/, 'ლომბარდი ოქროს ან ნივთის გირაოთი გასცემს სესხს, ხშირად მოკლე ვადით. პროცენტს ლომბარდი ადგენს — ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს.', 'თუ სესხს ვადაში ვერ დაფარავ, ლომბარდს ნივთის გაყიდვა შეუძლია. თანხა და ვადა მომწერე — ჯამს დაგითვლი.'],
  [/ქეშბექ|cashback/, 'ქეშბექი დახარჯული თანხის მცირე ნაწილის (ხშირად 1–5%) დაბრუნებაა. ფულს ზოგავს მხოლოდ მაშინ, თუ იმას ყიდულობ, რასაც ისედაც იყიდდი.', undefined, ['დღეს რამდენი შემიძლია?', 'რა არის 50/30/20 წესი?']],
  [/ლიზინგ/, 'ლიზინგი ნივთის (ხშირად მანქანის) გამოყენებაა ყოველთვიური გადასახადით: ნივთი ლიზინგის კომპანიისაა, სანამ ბოლომდე არ გადაიხდი.'],
  // the state Universal Healthcare Programme (fact-check line S12): one plain line; whether a private policy is needed stays the person's decision
  [/ჯანმრთელობ\S* დაზღვ|სამედიცინო დაზღვ|ჯანდაცვ|საყოველთაო/, 'სახელმწიფოს საყოველთაო ჯანდაცვის პროგრამა 2013 წლიდან მოქმედებს და მკურნალობის ნაწილს აფინანსებს; წილი მომსახურებასა და ჯგუფზეა დამოკიდებული.', 'კერძო დაზღვევა თვიური შენატანით დამატებით ხარჯს ფარავს — რას ფარავს და რას არა, პოლისის პირობებშია. ჯიხო პოლისებს არ ადარებს: მის შენატანს შენს თვეებზე გაჩვენებ, როგორც ნებისმიერ ფიქსირებულ ხარჯს.', ['რა არის გადაუდებელი ფონდი?', 'რა არის ფიქსირებული ხარჯი?']],
  [/დაზღვევ/, 'დაზღვევა თვიური შენატანით დიდი, მოულოდნელი ხარჯის რისკს ამცირებს — მაგალითად, მკურნალობის. რას ფარავს და რას არა, პოლისის პირობებშია.', 'ჯიხო დაზღვევის პროდუქტებს ერთმანეთს არ ადარებს. პოლისის თვიურ შენატანს შენს თვეებზე გაჩვენებ, როგორც ნებისმიერ ფიქსირებულ ხარჯს.', ['რა არის გადაუდებელი ფონდი?', 'რა არის ფიქსირებული ხარჯი?']],
]

const DEFAULT_CONCEPT_CHIPS: Partial<Record<ConceptId, string[]>> = {
  pti: ['1 200 ₾-ის ტელეფონი განვადებით', 'რა არის ეფექტური განაკვეთი?'],
}

/** one answer as a whole (all bubbles and what its card is about), to notice the same answer given twice */
const signature = (msgs: ChatMsg[]) => msgs.map(m => m.text).join('\n') + '§' + msgs.map(m => (m.card ? JSON.stringify([m.card.kind, m.card.data.title ?? m.card.data.amount ?? '']) : '')).join('')

export function respond(input: string, e: Engine, p: Persona, ctx: Ctx, demo: { day: number; extra: number }): Reply {
  let r = respondCore(input, e, p, ctx, demo)
  const q = parse(input)
  const said = ctx.said ?? []
  // the same answer twice in a row of questions: give another angle (an example with the person's numbers, the options, why) instead of the same words
  // (a follow-up such as "რა ვქნა?" or "ვერ გავიგე" never repeats anything said in this stretch of the conversation)
  if (VARY_ON_REPEAT.includes(q.intent) && !q.salaryQ && r.msgs.length && ((ctx.sigs ?? []).includes(signature(r.msgs)) || ((q.intent === 'decide' || q.intent === 'explain') && said.includes(r.msgs[0].text)))) {
    const mode: Explain = q.intent === 'explain' ? q.explain ?? 'more' : q.intent === 'decide' ? 'steps' : 'example'
    const r2 = respondCore(input, e, p, { ...r.ctx, lastExplain: undefined, said: [...said, ...r.msgs.map(m => m.text)] }, demo, mode)
    // only a real other angle replaces the answer (a plain fact with nothing more to add stays as it is)
    if (r2.ctx.lastExplain !== undefined && r2.msgs.length && !said.includes(r2.msgs[0].text) && r2.msgs[0].text !== r.msgs[0].text) {
      // the visual stays: the card of the repeated answer goes with the new words
      const card = r.msgs.find(m => m.card)?.card
      let msgs = card && !r2.msgs.some(m => m.card) ? [{ ...r2.msgs[0], card }, ...r2.msgs.slice(1)] : r2.msgs
      // the same price said again ("ქურთუკი 300 ლარი ღირს"): confirmed as counted, then the new angle (not "for example")
      if (q.intent === 'purchase' && q.amount !== undefined && q.amount === ctx.amount && /^მაგალითად: /.test(msgs[0].text)) msgs = [{ ...msgs[0], text: msgs[0].text.replace(/^მაგალითად: /, `კი, ${gel(q.amount)}-ით დავთვალე: `) }, ...msgs.slice(1)]
      r = { ...r2, msgs, ctx: { ...r.ctx, lastExplain: r2.ctx.lastExplain } }
    }
  }
  // "ხელფასი ჩამერიცხა" on a day the data has the salary still to come: say which date the numbers use
  const left = p.dayPattern.length - Math.min(Math.max(0, demo.day), p.dayPattern.length)
  if (q.salaryIn && !q.salaryQ && left > 0 && r.msgs.length) {
    const note = `შენს მონაცემებში ${/სტიპენდ/.test(p.incomeLabel) ? 'სტიპენდია' : 'ხელფასი'} ${dative(p.paydayLabel)} ჩაირიცხება — ვითვლი ამ თარიღით.`
    const m0 = r.msgs[0] as JikhoMsg
    r = { ...r, msgs: [withInfo(m0, joinInfo(note, m0.info)), ...r.msgs.slice(1)] }
  }
  // the person said "სტიპენდია" and the income is a stipend: the answers use that word too (and keep it for the rest of the conversation)
  const stip = /სტიპენდ/.test(p.incomeLabel) && (/სტიპენდ/.test(input.toLowerCase()) || !!ctx.stipend)
  if (stip) {
    const sw = (t: string) => t.replace(/ხელფასამდე/g, 'სტიპენდიამდე').replace(/ხელფასის დღეს/g, 'სტიპენდიის დღეს').replace(/ხელფასის შემდეგ/g, 'სტიპენდიის შემდეგ')
    r = { ...r, msgs: r.msgs.map(m => withInfo({ ...m, text: sw(m.text) }, (m as JikhoMsg).info ? sw((m as JikhoMsg).info!) : undefined)) }
  }
  // the words of the last answers (so follow-ups climb to something new) and the last two answers as a whole (a question asked again right away)
  const remember = (c: Ctx, msgs: ChatMsg[]): Ctx => ({ ...c, said: [...said, ...msgs.map(m => m.text)].slice(-16), sigs: [...(ctx.sigs ?? []), signature(msgs)].slice(-2), stipend: stip || undefined })
  if (!isSupport(p)) return { ...r, ctx: remember(r.ctx, r.msgs) }
  // support mode: calm, never a shopping or new-loan chip; under the forecast and the safe card, her bills come first
  const money = r.msgs[0]?.card && (r.msgs[0].card.kind === 'forecast' || r.msgs[0].card.kind === 'safe')
  const msgs = r.msgs.map(m => (m.chips ? { ...m, chips: money ? SUPPORT_MONEY_CHIPS.filter(c => c !== input.trim()).slice(0, 3) : supportChips(m.chips, input) } : m))
  if (!msgs.some(m => m.chips?.length)) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], chips: supportChips([], input) }
  return { ...r, msgs, ctx: remember(r.ctx, msgs), mood: 'calm' }
}

function respondCore(input: string, e: Engine, p: Persona, ctx: Ctx, demo: { day: number; extra: number }, force?: Explain): Reply {
  const q: Parsed = parse(input)
  const dayIdx = Math.min(Math.max(0, demo.day), p.dayPattern.length)
  const day0 = dayIdx === 0 && demo.extra === 0
  const daysLeft = p.dayPattern.length - dayIdx
  const landingNow = () => (day0 ? e.landing : e.forecastAtDay(dayIdx, e.demoPathIndex(), demo.extra).landing)
  const rateTxt = (pp: Parsed): string | undefined => (pp.zeroRate ? '0%' : pp.ratePct === undefined ? undefined : `${fmt(pp.ratePct, pp.ratePct % 1 ? 1 : 0)}%${pp.rateIsAnnual ? ' წლიური' : '/თვე'}`)
  const rateFrom = (pp: Parsed): number | undefined => (pp.zeroRate ? 0 : pp.ratePct === undefined ? undefined : pp.rateIsAnnual ? pp.ratePct / 100 / 12 : pp.ratePct / 100)
  const startFrom = (pp: Parsed) => (pp.startMonth ? offsetForStartMonth(pp.startMonth) : pp.afterPayday ? 0 : undefined)

  const lower = q.raw.toLowerCase()
  const jk = (text: string, chips?: string[], card?: ChatCard, info?: string): ChatMsg => withInfo({ id: id(), from: 'jikho', text, chips, card }, info)
  /** a long text keeps its first sentences visible and moves the rest behind the ⓘ */
  const jkFit = (text: string, chips?: string[], card?: ChatCard, info?: string): ChatMsg => { const [head, rest] = fit(text); return jk(head, chips, card, joinInfo(rest, info)) }

  const conceptReply = (cid: ConceptId, c0: Ctx = ctx, qq: Parsed = q) => {
    const c = CONCEPT_TEXT[cid](e, p, qq, c0)
    const { answer, info, chips, simple, example, why, steps, ...card } = c
    void why; void steps
    const base = chips ?? DEFAULT_CONCEPT_CHIPS[cid] ?? ['დღეს რამდენი შემიძლია?', 'რა არის PTI?']
    const asked = answer ?? (/მარტივ|გამიმარტივე/.test(lower) && simple ? simple : /მაგალით/.test(lower) && example ? example : c.body)
    return jkFit(asked, (TEACH.has(cid) ? ['მაგალითით ამიხსენი', ...base.filter(x => x !== 'მაგალითით ამიხსენი')] : base).slice(0, 3), { kind: 'concept', data: card }, info)
  }
  /** the calm replies to distress and self-harm wording; said again, they change their words (112 stays visible after self-harm wording) */
  const distressReply = (selfHarm: boolean) => {
    const said = ctx.said ?? []
    const harm: [string, string][] = [
      ['ძალიან ვწუხვარ, რომ ასე გიჭირს. თუ საფრთხე გემუქრება, ახლავე დარეკე 112-ზე — იქ 24 საათი გპასუხობენ და დაგეხმარებიან.', 'შეგიძლია ახლობელსაც დაურეკო და უთხრა, როგორ ხარ. ფულის სირთულე გამოსავალს ექვემდებარება — როცა მზად იქნები, ერთად დავალაგებთ.'],
      ['აქ ვარ და გისმენ. შენი უსაფრთხოება ყველაზე მნიშვნელოვანია: 112 ყოველთვის გპასუხობს, დღე და ღამე.', 'ფულის საკითხებს მერე, შენს ტემპში დავალაგებთ — ერთ ნაბიჯად.'],
      ['მნიშვნელოვანია, რომ ახლა მარტო არ იყო: 112-ზე ან ახლობელთან დარეკვა ახლავე შეიძლება.', 'როცა მზად იქნები, ფულის ციფრებს ერთად გადავხედავთ.'],
    ]
    const calm: [string, string][] = [
      [/მრცხვენია|სირცხვილ/.test(lower) ? 'მესმის, რომ ახლა მძიმეა. ფულის სირთულე ბევრს ემართება და ამაში სამარცხვინო არაფერია — შეგვიძლია ერთად დავალაგოთ შენი გადასახადები.' : 'მესმის, რომ ახლა მძიმეა. ფულის სირთულე ბევრს ემართება — შეგვიძლია ერთად დავალაგოთ შენი გადასახადები.', 'თუ თავს საფრთხეში გრძნობ, დარეკე 112-ზე.'],
      ['ეს გრძნობა გასაგებია — ვალი ან ფულის ნაკლებობა ადამიანს არ აფასებს. შეგვიძლია პატარა ნაბიჯით დავიწყოთ: ჯერ ხელფასამდე გადასახდელს გადავხედოთ.', 'თუ თავს საფრთხეში გრძნობ, დარეკე 112-ზე.'],
      ['აქ ვარ. როცა მოგინდება, ერთად ვნახავთ, რა გაქვს გადასახდელი და რა რჩება ხელფასამდე — ნაბიჯ-ნაბიჯ.', 'თუ თავს საფრთხეში გრძნობ, დარეკე 112-ზე.'],
    ]
    const list = selfHarm ? harm : calm
    const [text, info] = list.find(([t]) => !said.includes(t)) ?? list[0]
    return selfHarm ? jk(text, ['როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე'], undefined, info) : jk(text, ['კი, დავალაგოთ', 'როცა ვალს ვერ ვიხდი', 'ხელფასამდე მეყოფა?'], undefined, info)
  }
  /** distress wording with "what do I do?": a calm acknowledgement and neutral steps; strong wording ("აღარ შემიძლია") also gets a gentle visible 112 line */
  const distressMsgs = (selfHarm: boolean): ChatMsg[] => {
    const ask = /რა ვქნა|რა გავაკეთო|რა გზა|გამოსავალ/.test(lower)
    const strong = /აღარ შემიძლია|ვეღარ ვუძლებ|სასოწარკვეთ|გამოსავალს ვერ ვხედავ|გამოსავალი არ მაქვს|სხვა გზა არ მაქვს/.test(lower)
    if (selfHarm || !ask) return [distressReply(selfHarm)]
    const steps = 'მესმის, რომ ახლა მძიმეა. ნაბიჯ-ნაბიჯ: 1) ხელფასამდე გადასახდელის სია; 2) გამსესხებელთან საუბარი თარიღამდე; 3) ეროვნული ბანკის მომხმარებელთა სერვისი.'
    const info = `${debtsLine(p)} ეროვნულ ბანკს მომხმარებლის უფლებების საკითხებზე მიმართვა და გამსესხებელზე საჩივრის შეტანა შეიძლება.`
    const first = jk(steps, strong ? undefined : ['ჩემი გადასახადები მაჩვენე', 'როგორ ვთხოვო გადავადება?', 'როცა ვალს ვერ ვიხდი'], undefined, info)
    return strong ? [first, jk('თუ თავს საფრთხეში გრძნობ, 112 ყოველთვის გპასუხობს — დღე და ღამე.', ['ჩემი გადასახადები მაჩვენე', 'როგორ ვთხოვო გადავადება?', 'როცა ვალს ვერ ვიხდი'])] : [first]
  }
  /** right after a self-harm, distress, gambling or debt answer: a short reply stays calm, with no shopping or loan chips */
  const careReply = (): Reply => ({
    msgs: [jk(ctx.topic === 'selfharm' ? 'აქ ვარ, როცა დაგჭირდები. თუ საფრთხე გემუქრება, 112 ყოველთვის გპასუხობს.' : 'კარგი. როცა მზად იქნები, ციფრებს ერთად დავალაგებთ.', ctx.topic === 'selfharm' ? ['როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე'] : CARE_CHIPS)],
    ctx, mood: 'calm',
  })
  const care = CARE_TOPICS.includes(ctx.topic as string)

  // ---- payday and the day of a spend ----
  /** the salary lands today (the demo time machine at payday): money questions are about the next payday */
  const payday = daysLeft <= 0
  /** today's balance: the day-0 balance, or the balance on the demo day */
  const balNow = () => (day0 ? e.spendable : e.forecastAtDay(dayIdx, e.demoPathIndex(), demo.extra).balance)
  /** money left at the next payday, counted from the coming payday: + salary − monthly bills − usual month's spending − the spend */
  const nextPay = (spend = 0) => Math.round(landingNow().p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - spend)
  /** "10 დეკემბრამდე": the payday after the coming one */
  const nextPaydayWord = `${p.paydayDay} ${UNTIL[p.firstCycle[1]]}`
  /** the formula behind a next-payday number, for the ⓘ */
  const nextPayInfo = (spend: number, onHand?: number) => {
    const v = onHand === undefined ? nextPay(spend) : Math.round(onHand + p.salary - e.fixedTotal - e.monthlyVarMedian - spend)
    return `ვითვლი ასე: ${onHand === undefined ? 'ნაშთი' : 'შენი'} ~${gel(Math.round(onHand ?? landingNow().p50))} + ხელფასი ${gel(p.salary)} − თვის გადასახადები ${gel(e.fixedTotal)} − ჩვეული თვიური ხარჯი ~${gel(Math.round(e.monthlyVarMedian))}${spend ? ` − ${gel(spend, spend % 1 ? 2 : 0)}` : ''} ≈ ${v >= 0 ? `~${gel(v)}` : `~${gel(-v)}-ით მინუსი`}.`
  }
  const WEEK = ['ორშაბათ', 'სამშაბათ', 'ოთხშაბათ', 'ხუთშაბათ', 'პარასკევ', 'შაბათ', 'კვირა']
  const todayW = (Math.max(0, WEEK.findIndex(w => p.todayLabel.startsWith(w))) + dayIdx) % 7
  /** days from today to the spend ("ხვალ" 1, "შაბათს" from today's weekday), or undefined when no day is named */
  const offsetOf = (pp: Parsed) => pp.dayOffset ?? (pp.weekday !== undefined ? (pp.weekday - todayW + 7) % 7 : undefined)
  /** the day word for the answer, unless it is today */
  const whenOf = (pp: Parsed) => (offsetOf(pp) ? pp.dayWord : undefined)
  /** bills still due before payday, from the person's data */
  const duesNow = () => p.due.filter(d => d.dayIndex >= dayIdx)
  const dueSum = () => Math.round(duesNow().reduce((s, d) => s + (d.amount ?? (d.range![0] + d.range![1]) / 2), 0))
  /** a spend just discussed (and the certain ones before it) that later money questions count: none after payday talk, money named or payday itself */
  const pending = (): { sum: number; label: string } | undefined => {
    if (ctx.kind !== 'purchase' || !ctx.amount || ctx.afterPayday || ctx.onHand !== undefined || payday) return undefined
    const sum = ctx.amount + (ctx.spends ?? []).reduce((a, x) => a + x.amount, 0)
    return { sum, label: [ctx.item ?? 'ეს ხარჯი', ...(ctx.spends ?? []).map(x => x.label)].join(' + ') }
  }
  /** daily free money and the largest single purchase, from a landing */
  const safeOf = (f: { p10: number; p50: number }) => ({ safe: daysLeft > 0 ? Math.max(0, Math.round((f.p50 - e.cushion) / daysLeft)) : 0, max: Math.max(0, Math.floor((f.p10 + (f.p50 - f.p10) * 0.6 - e.cushion) / 5) * 5) })

  // a repeated answer or a follow-up asked for another angle
  if (force) return explainReply(force)

  // a microloan conversation: the next amount is what has to be paid back
  if (ctx.kind === 'micro' && ctx.amount && q.amount !== undefined && q.amount > ctx.amount && q.amount <= ctx.amount * 2 && !q.item && q.months === undefined && q.ratePct === undefined && ['purchase', 'followup', 'unknown'].includes(q.intent)) {
    return microRepay(ctx.amount, q.amount, q.days ?? ctx.days)
  }
  // "yes, let's sort them out" after Jikho offered to go through the bills
  if (q.amount === undefined && ((ctx.topic === 'distress' && /^\s*(კი|ჰო|ხო|დიახ|კარგი|მოდი|ok|ოკ)(?![ა-ჰa-z])/.test(lower)) || ((ctx.topic === 'distress' || ctx.topic === 'restructure') && /დავალაგოთ|გადასახადები (მაქვს|მაჩვენე)/.test(lower)))) {
    const due = dueLine(p, 0)
    return { msgs: [jk(billsLine(e, p), ['როცა ვალს ვერ ვიხდი', 'დღეს რამდენი შემიძლია?'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: landingNow() } }, `ხელფასამდე გადასახდელი: ${due || 'არაფერი'}. ${debtsLine(p)}`)], ctx, mood: 'calm' }
  }
  // "კარგი", "მადლობა", "არა" right after a self-harm, distress, gambling or debt answer
  if (care && (q.intent === 'ack' || q.intent === 'thanks')) return careReply()
  // "როგორ გავთიშო?" right after the overdraft card
  if (ctx.topic === 'overdraft' && q.amount === undefined && /გავთიშო|გათიშვ|დავხურო|გავაუქმო|გავაუქმებ/.test(lower)) {
    return { msgs: [jk('ოვერდრაფტს ბანკი თიშავს — აპით ან ფილიალში მოთხოვნით. ჩვეულებრივ, ჯერ გამოყენებული თანხა იფარება.', ['რა არის ოვერდრაფტი?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
  }
  // after a scam card: "კოდი უკვე ვუთხარი" / "უკვე ვუთხარი", and a bare "ეს თაღლითობაა?" about the message just described
  if (ctx.topic === 'fraud' && /უკვე (?:ვუთხარი|ვთქვი|გავეცი|მივეცი|შევიყვანე|გავუგზავნე)/.test(lower)) {
    return { msgs: [conceptReply('fraud')], ctx: { ...ctx, topicQ: q.raw }, mood: 'calm' }
  }
  if (ctx.topic === 'fraud' && ctx.topicQ && q.concept === 'fraud' && /თაღლით/.test(lower) && lower.replace(/[^ა-ჰa-z]/g, '').length < 30) {
    const prev = CONCEPT_TEXT.fraud(e, p, parse(ctx.topicQ), ctx)
    const prepay = /წინასწარ|ავანს/.test(ctx.topicQ.toLowerCase())
    // the confirmation adds something new: what is done in such a case (the description stays behind the ⓘ)
    const text = prepay ? `შეიძლება იყოს: წინასწარ გადარიცხული ფული ხშირად აღარ ბრუნდება. ${prev.mine}` : `დიდი ალბათობით, კი. ${prev.steps ?? prev.mine}`
    const { answer, info, chips, simple, example, why, steps, ...card } = prev
    void answer; void simple; void example; void why; void steps
    return { msgs: [jkFit(text, chips, { kind: 'concept', data: card }, joinInfo(prev.body, info))], ctx, mood: 'calm' }
  }
  // after a "guaranteed profit" offer, "ჩავდო 1000 ლარი?" is about that offer: its warning signs again, with the person's sum
  if (ctx.topic === 'fraud' && ctx.topicQ && FRAUD_PROMISE.test(ctx.topicQ.toLowerCase()) && !q.concept && !q.selfHarm
    && (q.intent === 'invest' || q.intent === 'decide' || /ჩავდო|ჩავრიცხო|გადავრიცხო|გადავურიცხო|ვენდო|მივცე|გავუგზავნო|ჩავდებ/.test(lower))) {
    const s0 = ctx.topicQ.toLowerCase()
    const prev = parse(ctx.topicQ)
    const per = /დღეში/.test(s0) ? 'დღეში' : /კვირაში/.test(s0) ? 'კვირაში' : 'თვეში'
    const offer = prev.ratePct ? `${per} ${fmt(prev.ratePct)}%` : 'მაღალი მოგება'
    const bal = balNow()
    const sum = q.amount === undefined ? '' : q.amount > bal ? ` — ${gel(q.amount)} კი შენს ხელმისაწვდომ ${gel(bal)}-ზე მეტიცაა` : ` — ${gel(q.amount)} შენი ხელმისაწვდომი თანხის ~${Math.round(q.amount / bal * 100)}%-ია`
    const c = CONCEPT_TEXT.fraud(e, p, prev, ctx)
    const { answer, info, chips, simple, example, why, steps, ...card } = c
    void answer; void info; void chips; void simple; void example; void why; void steps
    return { msgs: [jk(`თუ ეს იმ შეთავაზებაზეა, სადაც ${offer} „გარანტირებულია": ასეთი დაპირება თაღლითობის ცნობილი ნიშანია${sum}.`, ['მაგალითით ამიხსენი', 'რა არის რისკი?', 'დღეს რამდენი შემიძლია?'], { kind: 'concept', data: card }, 'ნამდვილ ინვესტიციაში მოგება გარანტირებული არ არის: ფასი შეიძლება გაიზარდოს ან დაეცეს.')], ctx, mood: 'calm' }
  }
  // "ხელფასამდე მეყოფა?" right after a spend: answered with that spend counted (and without it, for comparison)
  // (only right after the spend: once another question came in between, "ხელფასამდე მეყოფა?" is the plain forecast again)
  if (q.intent === 'forecast' && !q.when && !q.sky && !q.short && !q.afterPayday && ctx.kind === 'purchase' && ctx.amount && !ctx.afterPayday && !payday && (!ctx.topic || ctx.topic === 'safe')) return forecastWithSpend(pending()?.sum ?? ctx.amount, ctx.item)
  // "დეპოზიტზე რომ დავდო?" while saving up: the same goal and plan, on a deposit
  if (ctx.kind === 'save' && ctx.amount && (((q.intent === 'concept' && q.concept === 'deposit') || (['unknown', 'save'].includes(q.intent) && /ბანკში|ანაბარ|ანაბრ|დეპოზიტ/.test(lower))) && q.amount === undefined && q.perMonth === undefined
    || (ctx.amount !== undefined && ctx.rateYear !== undefined && q.intent === 'followup' && q.ratePct !== undefined && q.amount === undefined))) {
    return depositPlan(ctx.amount, ctx.perMonth, q.ratePct !== undefined ? (q.rateIsAnnual || !/თვეში|თვიურ/.test(lower) ? q.ratePct / 100 : q.ratePct / 100 * 12) : ctx.rateYear)
  }
  // "საკრედიტო ისტორიაზე იმოქმედებს?" right after a restructuring question: about the restructuring
  if ((q.concept === 'credithistory' || /(?:^|[^ა-ჰ])ისტორი/.test(lower)) && ctx.topic === 'restructure' && /იმოქმედ|აისახ|გამოჩნდ|ჩანს|გამიფუჭ|გაფუჭ|დააზიან|ცუდად/.test(lower) && lower.length < 80) {
    const c = CONCEPT_TEXT.credithistory(e, p, q, ctx)
    const { answer, info, chips, simple, example, why, steps, ...card } = c
    void answer; void info; void chips; void simple; void example; void why; void steps
    return { msgs: [jk('რესტრუქტურიზაციამდე მომხდარი დაგვიანებები ისტორიაში რჩება; ახალ გრაფიკს თუ დროზე იხდი, ახალი დაგვიანება აღარ ემატება.', ['საკრედიტო ისტორია სად ვნახო?', 'როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე'], { kind: 'concept', data: card }, 'ახალი პირობები ისტორიაში როგორ აისახება, ამას გამსესხებელს ეკითხებიან ხელშეკრულების გაფორმებამდე. დაფარული სესხი და მისი დაგვიანებები ისტორიაში დაფარვიდან 5 წელი ჩანს.')], ctx: { ...ctx, topic: 'credithistory', topicQ: q.raw }, mood: 'calm' }
  }
  // "0 თვით": no loan has a zero term, so ask instead of quietly picking one
  if (q.zeroTerm && ['loan', 'installment', 'followup', 'purchase'].includes(q.intent)) {
    const a = q.amount ?? (isDeal(ctx) ? ctx.amount : undefined)
    return { msgs: [jk(`0 თვით ${q.intent === 'installment' ? 'განვადება' : 'სესხი'} არ არსებობს: ვადა თვეებში ან დღეებში ითვლება. რამდენი თვით გაინტერესებს?`, a ? [`${fmt(a)} ლარი 12 თვით`, `${fmt(a)} ლარი 24 თვით`] : ['1000 ლარი 12 თვით', '1000 ლარი 24 თვით'])], ctx: a ? { ...ctx, kind: q.intent === 'installment' ? 'installment' : isDeal(ctx) ? ctx.kind : 'loan', amount: a } : ctx, mood: 'thinking' }
  }
  // "ეს ჩემთვის ძვირია?", "ღირს?" about the deal or purchase on the table: what the choice rests on
  if (q.costly && q.amount === undefined && q.daily === undefined && (isDeal(ctx) || (ctx.kind === 'purchase' && ctx.amount)) && ['unknown', 'decide', 'concept', 'forecast'].includes(q.intent) && !q.concept) return decide()
  // "მაშინ 2 დღეში ერთხელ რომ ვიყიდო?" after a daily spend
  if (q.everyN && ctx.daily && q.amount === undefined) return budgetReply(ctx.daily / q.everyN)
  // a new target in a saving conversation ("ათას ორასი ლარის ტელეფონზე კი?") stays a saving question
  if (ctx.kind === 'save' && q.intent === 'purchase' && q.amount !== undefined && !q.spent && (q.whatIf || /(?:ზე|სთვის|ის) კი\s*[?!.]*\s*$/.test(lower))) q.intent = 'followup'
  // "კარგი, ხოლო 2 200 რომ იყოს?" inside an installment or loan: the same deal with a new price, not a cash purchase
  if ((isDeal(ctx) || ctx.kind === 'save' || ctx.kind === 'deposit') && q.intent === 'purchase' && q.amount !== undefined && q.whatIf && !q.spent && !q.lend) q.intent = 'followup'
  // "ჰო მაგრამ კონკრეტულად ამ სესხზე რამდენი გამოდის?" right after the effective-rate or PTI card: that number for the deal on the table
  if ((ctx.topic === 'eir' || ctx.topic === 'pti') && isDeal(ctx) && q.amount === undefined && q.months === undefined && q.ratePct === undefined
    && /რამდენ|გამოდის|რაა|რა არის/.test(lower) && /(?:ამ|ეს|ჩემს?|ამის)\s*(?:სესხ|განვადებ)|კონკრეტულად|ჩემთვის/.test(lower)) {
    return { msgs: [conceptReply(ctx.topic, ctx, parse(ctx.topic === 'eir' ? 'ეფექტური რამდენი გამოდის ამ სესხზე' : 'PTI რამდენი იქნება ამ სესხით'))], ctx, mood: 'calm' }
  }
  // follow-ups that stay on the topic just answered, in words the parser alone cannot place
  if (q.amount === undefined && (q.intent === 'unknown' || q.intent === 'ack' || q.intent === 'forecast' || q.intent === 'concept')) {
    // "ღამის 11 საათზე დამირეკეს", "დამემუქრნენ" after a collector answer
    if (ctx.topic === 'restructure' && q.intent !== 'concept' && /დამირეკ|დარეკეს|რეკავენ|ზარ|დამემუქრ|მემუქრ|დამაპატიმრ/.test(lower)) {
      const qq = parse(`${q.raw} — მევალე მირეკავს`)
      return { msgs: [conceptReply('restructure', ctx, qq)], ctx: { ...ctx, topicQ: qq.raw }, mood: 'calm' }
    }
    // "ვინ ნახულობს ჩემს ისტორიას?" after a credit-history or debt answer
    if ((ctx.topic === 'credithistory' || ctx.topic === 'late' || ctx.topic === 'restructure') && q.intent === 'unknown' && /(?:^|[^ა-ჰ])ისტორი/.test(lower)) {
      return { msgs: [conceptReply('credithistory', ctx, q)], ctx: { ...ctx, topic: 'credithistory', topicQ: q.raw }, mood: 'calm' }
    }
    // "რამდენ ხანს გავძლებ?" after a job loss or the emergency fund: how the days come out
    if (ctx.topic === 'emergency' && q.intent !== 'concept' && /გავძლებ|რამდენ ხანს|რამდენ დღეს|მეყოფა|ვიცოცხლებ|გამიძლებს/.test(lower)) return explainReply('example')
    // "ეს ბევრია?", "როგორ ავიკრძალო?" after a gambling answer
    if (ctx.topic === 'gambling' && ctx.topicQ && (q.costly || /ავიკრძალ|შევიზღუდ|დავბლოკ|შევწყვიტ/.test(lower))) {
      const qq: Parsed = q.costly ? { ...parse(ctx.topicQ), costly: true } : parse('აზარტული თამაში როგორ შევიზღუდო?')
      return { msgs: [conceptReply('gambling', ctx, qq)], ctx: { ...ctx, topicQ: q.costly ? ctx.topicQ : qq.raw }, mood: 'calm' }
    }
  }
  // a short follow-up on a concept just explained ("მე მაქვს?", "რა ღირს?", "რით განსხვავდება სესხისგან?", "ჩემს დანაზოგზე როგორ მოქმედებს?"):
  // read together with the question that opened the topic; a new answer is given, never the same one again
  const nWords = lower.split(/[^ა-ჰa-z]+/).filter(Boolean).length
  if (ctx.topic && ctx.topicQ && ctx.topic in CONCEPT_TEXT && q.amount === undefined && nWords <= 6
    && (q.intent === 'unknown' || (q.intent === 'loan' && /განსხვავ|სხვაობ|(?:^|[^ა-ჰ])რით(?![ა-ჰ])/.test(lower))) && !q.offTopic && !q.welfare && !q.docs && !q.fact) {
    const cid = ctx.topic as ConceptId
    const qq = parse(`${ctx.topicQ} ${q.raw}`)
    const now = CONCEPT_TEXT[cid](e, p, qq, ctx), before = CONCEPT_TEXT[cid](e, p, parse(ctx.topicQ), ctx)
    const said0 = ctx.said ?? []
    if (now.answer && now.answer !== before.answer && !said0.includes(now.answer)) return { msgs: [conceptReply(cid, ctx, qq)], ctx: { ...ctx, topicQ: qq.raw, lastExplain: undefined }, mood: 'calm' }
    // "მე მაქვს?", "ჩემთან?": the person's own line from the card
    if (/(?:^|[^ა-ჰ])(?:მე|ჩემ\S*|მაქვს)(?![ა-ჰ])/.test(lower) && !said0.includes(now.mine)) return { msgs: [jk(now.mine, (now.chips ?? ['დღეს რამდენი შემიძლია?', 'რა არის PTI?']).slice(0, 3))], ctx, mood: 'calm' }
  }
  // "50 ლარით თვეში რამდენ ხანში?" right after the overdraft answer: the months to pay it off
  if (ctx.topic === 'overdraft' && p.overdraft && (q.perMonth !== undefined || q.amount !== undefined) && /რამდენ ხანში|რამდენ თვეში|როდის|რამდენი თვე/.test(lower)) {
    const per = q.perMonth ?? q.amount!, n = Math.ceil(p.overdraft.used / per)
    return { msgs: [jk(`თვეში ${gel(per)}-ით ${gel(p.overdraft.used)} დაახლოებით ${n} თვეში დაიფარება — პროცენტის გამო ცოტა მეტში.`, ['ჩემი გადასახადები მაჩვენე', 'ოვერდრაფტი რა ღირს?', 'როცა ვალს ვერ ვიხდი'], undefined, `${gel(p.overdraft.used)} ÷ ${gel(per)} ≈ ${n}; ზუსტ ვადას ოვერდრაფტის განაკვეთი ცვლის — ის ხელშეკრულებაშია.`)], ctx, mood: 'calm' }
  }
  // "მერე რამდენი დამრჩება თვეში?" after the person's installment end date
  if (ctx.myDebt && p.installment && /მერე|შემდეგ|მის მერე|დასრულების/.test(lower) && /რამდენ|დამრჩება|დარჩება/.test(lower)) {
    const ms = Math.max(0, Math.round(e.medianSurplus)), inst = p.installment
    return { msgs: [jk(`${GEN[inst.lastCycle[1]]} შემდეგ ${inst.name} აღარ იქნება: თვის ბოლოს ჩვეულებრივ ~${gel(ms + inst.amount)} დაგრჩება (ახლა ~${gel(ms)}).`, ['რამდენ ხანში დავაგროვებ 1000 ლარს?', 'დღეს რამდენი შემიძლია?', 'რა არის PTI?'], undefined, 'ვთვლი, რომ დანარჩენი ხარჯი იგივე რჩება.')], ctx: { ...ctx, myDebt: undefined }, mood: 'happy' }
  }
  // "ეს შესაძლებელია?", "გამოვა?" about a saving plan: the monthly sum against the usual month-end surplus
  if (ctx.kind === 'save' && q.costly && q.amount === undefined && (ctx.perMonth !== undefined || ctx.amount !== undefined) && !(ctx.goal && /დანარჩენ|დარჩენილით/.test(lower))) {
    const ms = Math.round(e.medianSurplus), per = ctx.perMonth ?? (ms > 0 ? ms : 0)
    const text = per <= 0 ? 'ჩვეული ხარჯით — ძნელად: თვის ბოლოს ახლა ჩვეულებრივ არაფერი რჩება.'
      : per <= ms ? `ჩვეული ხარჯით — კი: თვეში ${gel(per)} შენს ჩვეულ თვიურ ნაშთში (~${gel(ms)}) ეტევა.`
        : `ჩვეული ხარჯით — ძნელად: თვეში ${gel(per)} შენს ჩვეულ თვიურ ნაშთზე (~${gel(ms)}) ~${gel(r5(per - ms))}-ით მეტია.`
    return { msgs: [jk(text, ctx.amount ? [`და თვეში ${r10(Math.max(per * 0.7, 20))} ₾?`, 'რა არის ანაბარი?', 'დღეს რამდენი შემიძლია?'] : ['რა არის ანაბარი?', 'დღეს რამდენი შემიძლია?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'], undefined, ms > 0 ? `თვის ბოლოს ჩვეულებრივ ~${gel(ms)} გრჩება: ${gel(p.salary)} − გადასახადები ${gel(e.fixedTotal)} − ჩვეული ხარჯი ~${gel(Math.round(e.monthlyVarMedian))}.` : billsLine(e, p))], ctx, mood: 'calm' }
  }
  // "თვეში რამდენია?", "წელიწადში?" after a daily spend
  if (ctx.daily !== undefined && q.amount === undefined && q.daily === undefined && /თვეში|თვიურად|ერთ თვეში|წელიწადში|წელში|წლიურად|წლის განმავლობაში/.test(lower) && nWords <= 4) {
    const d = ctx.daily, year = /წელ|წლი/.test(lower)
    const v = Math.round(d * (year ? 365 : 30))
    return { msgs: [jk(`დღეში ${gel(d, d % 1 ? 1 : 0)} ${year ? 'წელიწადში' : 'თვეში'} ~${gel(v)}-ია — შემოსავლის (${gel(p.salary)}) ~${Math.round(v / (p.salary * (year ? 12 : 1)) * 100)}%.`, ['2 დღეში ერთხელ რომ იყოს?', 'რამდენს ვხარჯავ თვეში?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'], undefined, `დღეში ${gel(d, d % 1 ? 1 : 0)} × ${year ? 365 : 30} დღე.`)], ctx, mood: 'calm' }
  }
  // "თუ არ დამიბრუნა?" after lending money: exactly the case counted, said with both paydays
  if (ctx.lend && ctx.amount && /არ დამიბრუნ|ვერ დამიბრუნ|არ დააბრუნ|არ დაბრუნ|ვერ დააბრუნ/.test(lower)) {
    const r = purchaseResult(e, p, ctx.amount, day0, demo.extra, dayIdx), after = nextPay(ctx.amount)
    const text = `ზუსტად ეს დავთვალე: ${gel(ctx.amount)} თუ არ დაგიბრუნდა, ხელფასის დღეს ${leftOrShort(r.p50)}, მომდევნო ხელფასამდე კი ${leftOrShort(after)}.`
    return { msgs: [jk(text, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი'], undefined, nextPayInfo(ctx.amount))], ctx, mood: 'calm' }
  }
  // "10 დღე უნდა ვიცხოვრო" after "50 ლარი მაქვს": that money over those days
  const dayCount = q.raw.match(/(\d{1,3})\s*-?\s*დღ/)
  if (ctx.onHand !== undefined && q.amount === undefined && dayCount && !q.daily && Number(dayCount[1]) > 0) {
    const n = Number(dayCount[1]), have = ctx.onHand, due = ctx.cash ? 0 : dueSum()
    const per = Math.round(Math.max(0, have - due) / n), avg = Math.round(e.avgDaily)
    const text = have - due > 0 ? `${gel(have)}${due ? `-დან გადასახადების (~${gel(due)}) შემდეგ` : ''} ${n} დღეზე დღეში ~${gel(per)} გამოდის — ჩვეულებრივ კი ~${gel(avg)}-ს ხარჯავ.` : `${n} დღეზე ${gel(have)} გადასახდელსაც (~${gel(due)}) ვერ ფარავს — ~${gel(Math.max(5, r5(due - have)))} აკლია.`
    return { msgs: [jk(text, ['ჩემი გადასახადები მაჩვენე', 'ხელფასამდე მეყოფა?', 'რა ვქნა?'], undefined, due ? `გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined)], ctx, mood: 'calm' }
  }
  // "დანარჩენით თვე გამიძლებს?" after setting money aside for the saving goal
  if (ctx.kind === 'save' && ctx.goal && ctx.perMonth && /გამიძლებს|მეყოფა|გავძლებ|დანარჩენ|დარჩენილით/.test(lower)) {
    const avail = payday ? nextPay() : Math.round(e.medianSurplus)
    const left = avail - ctx.perMonth
    const text = `${gel(ctx.perMonth)}-ის გადადების შემდეგ ${payday ? 'მომდევნო ხელფასამდე' : 'თვის ბოლოს'} ჩვეული ხარჯით ${leftOrShort(left)}${left >= 0 && left < e.cushion ? ` — ზღვარზე (${gel(e.cushion)}) ნაკლები` : ''}.`
    return { msgs: [jk(text, ['დღეს რამდენი შემიძლია?', 'ჩემი გადასახადები მაჩვენე', 'რა არის ანაბარი?'], undefined, payday ? nextPayInfo(ctx.perMonth) : `თვის ბოლოს ჩვეულებრივ ~${gel(Math.round(e.medianSurplus))} გრჩება.`)], ctx, mood: 'calm' }
  }
  // "ხელფასამდე ვიცოცხლებ?" right after "30 ლარი დამრჩა": answered from that money, not the demo balance
  if (q.intent === 'forecast' && !q.when && !q.sky && !q.short && !q.afterPayday && ctx.onHand !== undefined && ctx.kind !== 'purchase' && !payday) return budgetReply(undefined, ctx.onHand, ctx.cash)
  // "ბანკში რა საბუთები წავიღო?" right after a debt answer: the documents for that request
  if (q.docs && (ctx.topic === 'restructure' || ctx.topic === 'late' || ctx.topic === 'distress')) {
    return { msgs: [conceptReply('restructure', ctx, parse('გადავადებისთვის რა საბუთები წავიღო ბანკში'))], ctx: { ...ctx, topic: 'restructure', topicQ: 'გადავადებისთვის რა საბუთები წავიღო ბანკში' }, mood: 'calm' }
  }
  // "და 24 თვეზე?" with no deal yet: the term is kept in the question back
  if (q.intent === 'followup' && q.months !== undefined && q.amount === undefined && !isDeal(ctx) && ctx.kind !== 'purchase' && ctx.kind !== 'save' && ctx.kind !== 'deposit') {
    return { msgs: [jk(`რა თანხაზე, ${q.months} თვით? მომწერე, მაგალითად: „1 200 ლარი ${q.months} თვით".`, [`1 200 ₾ სესხი ${q.months} თვით`, `1 200 ₾-ის ტელეფონი ${q.months} თვით`])], ctx: { ...ctx, months: q.months }, mood: 'thinking' }
  }

  switch (q.intent) {
    case 'greeting':
      // support mode: calm, no exclamation mark, no goat and no storm headline
      if (isSupport(p)) return { msgs: [jk(`გამარჯობა. ${daysLeft > 0 ? `ხელფასამდე ${daysLeft} დღეა` : 'ხელფასი დღესაა'} — შეგვიძლია ერთად გადავხედოთ შენს გადასახადებს ან ${daysLeft > 0 ? 'ხელფასამდე' : 'ახალი თვის'} ბიუჯეტს.`, startChips(p))], ctx, mood: 'calm' }
      return { msgs: [jk(`გამარჯობა! 🐐 ${daysLeft > 0 ? `ხელფასამდე ${daysLeft} დღეა` : 'ხელფასი დღესაა'} და ამინდი ${WEATHER_LABEL[e.landing.weather]}ა. რა შევამოწმოთ?`, START_CHIPS)], ctx, mood: 'happy' }
    case 'thanks':
      if (isSupport(p)) return { msgs: [jk('არაფრის. როცა დაგჭირდები, აქ ვარ — ციფრებს ერთად დავალაგებთ.', ['ჩემი გადასახადები მაჩვენე', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
      return { msgs: [jk('არაფრის! ამ ბილიკს ერთად გავდივართ ⛰️ სხვა რამეც შევამოწმოთ?', ['დღეს რამდენი შემიძლია?', WEATHER_CHIP])], ctx, mood: 'happy' }
    case 'ack': {
      const chips = isDeal(ctx) ? ['ჯამში რამდენს გადავიხდი?', 'მარტივად ამიხსენი', 'დღეს რამდენი შემიძლია?'] : MENU
      if (isSupport(p)) return { msgs: [jk('კარგი. სხვა რამე შევამოწმოთ?', chips)], ctx, mood: 'calm' }
      return { msgs: [jk('კარგი 🙂 სხვა რამე შევამოწმოთ?', chips)], ctx, mood: 'happy' }
    }
    case 'who':
      // "is this an app to sell loans?": no, and why; the business model as locked in the concept (the bank pays, the user never does, no fee tied to loans)
      if (q.loanSales) return { msgs: [jk('არა: სესხის გაცემაზე ან მოცულობაზე საკომისიო არ არის, ამიტომ სესხის „გაყიდვა" ჩვენი ინტერესი არ არის. ციფრებს გაჩვენებ, გადაწყვეტილება შენია.', ['ჩემი მონაცემები დაცულია?', 'რამდენად ზუსტია პროგნოზი?'], undefined, 'საფასურს იხდის ბანკი, რომელიც ჯიხოს თავის აპში ჩართავს; შენ არაფერს იხდი. ახლა დემო რეჟიმში ვარ — სინთეზურ მონაცემებზე.')], ctx, mood: 'calm' }
      if (q.biz) return { msgs: [jk('შენ არაფერს იხდი: საფასურს იხდის ბანკი, რომელიც ჯიხოს თავის აპში ჩართავს. სესხის გაცემაზე ან მოცულობაზე საკომისიო არ არის.', ['ჩემი მონაცემები დაცულია?', 'რამდენად ზუსტია პროგნოზი?'], undefined, 'ამიტომ სესხის „გაყიდვა" ჩვენი ინტერესი არ არის. ახლა დემო რეჟიმში ვარ — სინთეზურ მონაცემებზე.')], ctx, mood: 'calm' }
      // "is this app addictive?": what Jikho is for, in neutral words
      if (q.habit) return { msgs: [jk('ჯიხოს მიზანი ისაა, რომ ხელფასამდე მშვიდად მიხვიდე და არა ის, რომ აპში მეტი დრო გაატარო. ხარჯვისკენ არ გიბიძგებს — ციფრებს გაჩვენებს, როცა მკითხავ.', ['ჩემი მონაცემები დაცულია?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
      // "is this AI / ChatGPT?": no language model; fixed rules read the question, formulas compute every number
      if (q.ai) return { msgs: [jk('ChatGPT-ის მსგავსი ენის მოდელი არ ვარ: კითხვას წესებით ვკითხულობ, რიცხვებს კი ზუსტი ფორმულები ითვლის შენი ხარჯებიდან.', [WEATHER_CHIP, 'ჩემი მონაცემები დაცულია?', 'რამდენად ზუსტია პროგნოზი?'], undefined, 'ინტერნეტი არ მჭირდება და რიცხვს არ ვიგონებ: ერთსა და იმავე კითხვაზე ყოველთვის ერთსა და იმავე პასუხს მიიღებ.')], ctx, mood: 'calm' }
      // "how do you tell information from advice?" (a jury question): the rule in one line
      if (q.meta === 'advice') return { msgs: [jk('კი/არა-ს არ ვამბობ: „ავიღო თუ არა?"-ზე ვაჩვენებ შენატანს, ჯამურ ფასს, PTI-ს და თვეებს, როცა ფული შეიძლება არ ეყოს — გადაწყვეტილება მომხმარებლისაა.', ['ავიღო თუ არა 2 000 ₾ სესხი 24 თვით?', 'რა არის PTI?', 'ჩემი მონაცემები დაცულია?'], undefined, 'ბანკს, პროდუქტს ან ვადას არ ვარჩევ და არ ვასახელებ. ყველა რიცხვს ფორმულა ითვლის შენი ხარჯების ისტორიიდან; ჯიხო ენის მოდელი არ არის.')], ctx, mood: 'calm' }
      // who regulates it: the honest state of the demo and the planned path (no licence claimed)
      if (q.meta === 'regulated') return { msgs: [jk('ჯიხო ახლა საგანმანათლებლო დემოა: ფულს არ გასცემს, არ ინახავს და არ გადარიცხავს — ლიცენზირებული ფინანსური ორგანიზაცია არ არის.', ['ჩემი მონაცემები დაცულია?', 'რამდენად ზუსტია პროგნოზი?', 'ვინ იხდის ჯიხოში?'], undefined, 'რეალურ ვერსიაში ჯიხო პარტნიორი ბანკის აპში იქნება; ბანკებს ეროვნული ბანკი ზედამხედველობს.')], ctx, mood: 'calm' }
      // a wrong forecast: information, not a guarantee; the money and the choice stay with the person
      if (q.meta === 'liability') return { msgs: [jk('ჯიხოს პასუხი ინფორმაციაა და არა გარანტია ან რჩევა: პროგნოზი შუალედია და ცუდ შემთხვევასაც აჩვენებს. ფულს ვერ ვმართავ — გადაწყვეტილება შენია.', ['რამდენად ზუსტია პროგნოზი?', WEATHER_CHIP, 'დღეს რამდენი შემიძლია?'], undefined, 'ყველა რიცხვი შენი ხარჯების ისტორიიდან ფორმულით ითვლება; მოულოდნელ დიდ ხარჯს წინასწარ ვერ დავინახავ.')], ctx, mood: 'calm' }
      // "why would I use you?": what Jikho shows that a bank app does not (no promise beyond what is built)
      if (q.meta === 'purpose') return { msgs: [jk('ბანკის აპი აჩვენებს, რა მოხდა; ჯიხო — რა შეიძლება მოხდეს ხელფასამდე: შესყიდვას, განვადებას ან სესხს შენს თვეებზე გაჩვენებს, სანამ გადაწყვეტ.', ['100 ₾-ის ფეხსაცმელი ვიყიდო?', 'ხელფასამდე მეყოფა?', 'ჩემი მონაცემები დაცულია?'], undefined, 'გადაწყვეტილება შენია: ჯიხო რჩევას არ იძლევა და ბანკებს არ ადარებს. ახლა დემო რეჟიმშია — სინთეზურ მონაცემებზე.')], ctx, mood: 'calm' }
      // "developer mode", "forget the rules": the rules stay
      if (q.jailbreak) return { msgs: [jk('ჩემი წესები არ იცვლება: რჩევას არ ვიძლევი და ბანკებს არ ვასახელებ. ციფრებს გაჩვენებ — გადაწყვეტილება შენია.', MENU, undefined, 'ენის მოდელი არ ვარ: კითხვას წესებით ვკითხულობ, ამიტომ ინსტრუქციის შეცვლა ვერ მოხერხდება.')], ctx, mood: 'calm' }
      // help asked again: another angle (the three most common questions), never the same text twice
      if (q.help) {
        const helpText = 'მკითხე შესყიდვაზე, განვადებაზე, სესხზე ან დღის ბიუჯეტზე — გაჩვენებ, როგორ აისახება შენს თვეებზე. ფინანსურ ცნებებსაც აგიხსნი.'
        if ((ctx.said ?? []).includes(helpText)) {
          const alt = 'ხშირად ამას მეკითხებიან 👇 ან მკითხე საკუთარი კითხვა, მაგალითად: „300 ლარის ქურთუკი ვიყიდო?"'
          return { msgs: [jk((ctx.said ?? []).includes(alt) ? 'აქ ვარ 🙂 მკითხე ფულის ნებისმიერი კითხვა — თანხით, თუ გაქვს.' : alt, ['ხელფასამდე მეყოფა?', 'რა არის PTI?', '2 000 ₾ სესხი 24 თვით 18%-ით'])], ctx, mood: 'happy' }
        }
        return { msgs: [jk(helpText, MENU, undefined, 'მაგ.: „100 ლარის ფეხსაცმელი ვიყიდო?", „2 000 ლარი სესხი 24 თვით 18%-ით", „რა არის PTI?"')], ctx, mood: 'happy' }
      }
      return { msgs: [jk('მე ჯიხო ვარ — კავკასიური ჯიხვი. მთის ბილიკზე წონასწორობას ვინარჩუნებ, შენ კი თვის ბოლომდე მისვლაში გეხმარები.', MENU, undefined, 'ყველა რიცხვი შენი ხარჯების ისტორიიდან ზუსტი ფორმულებით ითვლება — მე მხოლოდ გიხსნი.')], ctx, mood: 'happy' }
    case 'invest':
      if (/კურს/.test(lower)) return { msgs: [jk('ვალუტის კურსის პროგნოზს არ ვაკეთებ: მას ბევრი ფაქტორი ცვლის და ზუსტად წინასწარ ვერავინ იტყვის.', ['რა არის სავალუტო რისკი?', 'რა არის ინფლაცია?', 'დღეს რამდენი შემიძლია?'], undefined, 'შემიძლია გაჩვენო, როგორ იმოქმედებს კურსის ცვლილება უცხო ვალუტაში აღებულ სესხზე.')], ctx, mood: 'calm' }
      // "აქციები თუ დეპოზიტი?": no advice, but the neutral facts side by side (deposit insurance 50 000 ₾ from 1 Apr 2026; bank interest untaxed for individuals, Tax Code art. 131(5))
      if (/ანაბარ|ანაბრ|დეპოზიტ/.test(lower)) {
        const a = q.amount ?? q.onHand ?? 1000
        const card: ChatCard = { kind: 'concept', data: {
          title: 'ანაბარი და აქციები',
          body: 'ანაბარზე სარგებელს განაკვეთი წინასწარ განსაზღვრავს, აქციაზე — კომპანიის ფასი, რომელიც იცვლება.',
          more: 'ბანკსა და მიკრობანკში ანაბრის სარგებელი ფიზიკური პირისთვის არ იბეგრება. დეპოზიტების დაზღვევა მხოლოდ ანაბარს ეხება.',
          mine: `${gel(a)}: ანაბარზე სამაგალითო 10%-ით წელიწადში → ~${gel(Math.round(a * 1.1))}; აქციით +20% → ${gel(Math.round(a * 1.2))}, −20% → ${gel(Math.round(a * 0.8))}.`,
          rule: 'რაც უფრო მაღალ შემოსავალს გპირდებიან, მით მეტია რისკი.' } }
        return { msgs: [jk('რჩევას ვერ მოგცემ, მაგრამ ფაქტები ასეთია: ანაბარზე სარგებელი წინასწარაა ცნობილი და 50 000 ₾-მდეა დაზღვეული; აქციის ფასი შეიძლება გაიზარდოს ან დაეცეს.', ['რა არის რისკი?', 'რა არის ინფლაცია?', 'რა არის ანაბარი?'], card, 'გადაწყვეტილება შენია: ლიცენზირებული საინვესტიციო მრჩეველი არ ვარ. 10% და ±20% მხოლოდ სამაგალითო რიცხვებია.')], ctx: { ...ctx, topic: 'risk', topicQ: 'რა არის რისკი?' }, mood: 'calm' }
      }
      {
        // no advice, ever; one neutral fact that fits the asset, and the person's own numbers behind the ⓘ
        const crypto = /კრიპტო|ბიტკოინ|ეთერიუმ|crypto|bitcoin/.test(lower)
        const won = /გაორმაგ|მოვიგე|გაიზარდა|ავიდა|მოგებაში ვარ/.test(lower)
        const gold = /ოქრო/.test(lower)
        const fx = /დოლარ|ევრო|ვალუტ/.test(lower)
        const shares = /აქცი|stock/.test(lower)
        const facts: string[] = crypto && won ? ['რჩევას ვერ მოგცემ. წარსული ზრდა შემდეგ მოძრაობას ვერ წინასწარმეტყველებს: კრიპტოვალუტის ფასი ისევე სწრაფად შეიძლება დაეცეს.', 'რჩევას ვერ მოგცემ. კრიპტოვალუტა ანაბარი არ არის: დეპოზიტების დაზღვევა მას არ ეხება, ფასი კი მოკლე დროში ბევრით შეიძლება დაეცეს.']
          : crypto ? ['რჩევას ვერ მოგცემ. ფაქტი: კრიპტოვალუტის ფასი მოკლე დროში შეიძლება მკვეთრად გაიზარდოს ან დაეცეს; ის ანაბარი არ არის და დეპოზიტების დაზღვევა მას არ ეხება.', 'რჩევას ვერ მოგცემ. კრიპტოვალუტაზე შემოსავალი წინასწარ უცნობია — ანაბრისგან განსხვავებით, თანხის ნაწილი შეიძლება დაიკარგოს.']
          : fx ? ['რჩევას ვერ მოგცემ. ფაქტი: კურსი იცვლება — უცხო ვალუტაში შენახული თანხა ლარში შეიძლება გაიზარდოს ან შემცირდეს; ყიდვისა და გაყიდვის კურსიც განსხვავდება.', 'რჩევას ვერ მოგცემ. კურსის ზუსტ პროგნოზს ვერავინ იძლევა: ვალუტის ლარზე უკან გადაცვლა ყიდვა-გაყიდვის კურსის სხვაობასაც ნიშნავს.']
          : gold ? ['რჩევას ვერ მოგცემ. ოქროს ფასი იცვლება — შეიძლება გაიზარდოს ან დაეცეს; ანაბრისგან განსხვავებით, სარგებელი წინასწარ უცნობია და დეპოზიტების დაზღვევა მას არ ეხება.', 'რჩევას ვერ მოგცემ. ოქრო პროცენტს არ იხდის: შემოსავალი მხოლოდ ფასის ცვლილებიდან მოდის, ფასი კი შეიძლება დაეცეს.']
          : shares ? ['რჩევას ვერ მოგცემ. ფაქტი: აქციის ფასი შეიძლება დაეცეს და თანხის ნაწილი დაიკარგოს; ანაბარზე კი სარგებელი წინასწარაა ცნობილი.', 'რჩევას ვერ მოგცემ. აქციაზე შემოსავალი კომპანიის საქმიანობაზეა დამოკიდებული და წინასწარ უცნობია; დეპოზიტების დაზღვევა აქციებს არ ეხება.']
          : ['ინვესტიციებზე რჩევას ვერ მოგცემ — ლიცენზირებული მრჩეველი არ ვარ. ფაქტი: რაც მაღალია შესაძლო მოგება, მით მეტია დაკარგვის რისკიც.', 'რჩევას ვერ მოგცემ. ინვესტიციაზე შემოსავალი წინასწარ უცნობია, ანაბარზე კი — ცნობილი და 50 000 ₾-მდე დაზღვეული.']
        const text = facts.find(t => !(ctx.said ?? []).includes(t)) ?? facts[0]
        const ms = Math.round(e.medianSurplus), bal = balNow()
        const a = q.amount
        const mineNums = `შენთან თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} რჩება${a ? `; ${gel(a)} ${a > bal ? `შენს ხელმისაწვდომ ${gel(Math.round(bal))}-ზე მეტია` : ms > 0 ? `ამ ნაშთის ~${fmt(Math.round(a / ms * 10) / 10, 1)} თვეა` : 'შენი ხელმისაწვდომი თანხის ნაწილია'}` : ''}.`
        return { msgs: [jk(text, ['რა არის რისკი?', 'რა არის ინფლაცია?', 'რა არის ანაბარი?'], undefined, `${mineNums} გადაწყვეტილება შენია: ლიცენზირებული საინვესტიციო მრჩეველი არ ვარ.`)], ctx, mood: 'calm' }
      }
    case 'distress':
      // "სხვა გზა არ მაქვს" right after a microloan question: acknowledged, and the microloan thread kept (the legal maximum cost, what to check)
      if (!q.selfHarm && ctx.kind === 'micro') {
        const a = ctx.amount ?? 300, d = ctx.days ?? 30
        const cap = a * (Math.pow(1.5, d / 365) - 1)
        const cx = cap < 10 ? Math.round(cap * 10) / 10 : Math.round(cap)
        // the legal maximum was already said with the microloan question: this time what a contract is read for
        const text = `გასაგებია, როცა სხვა გზა არ ჩანს. ხელშეკრულებაში ორ რიცხვს უყურებენ: დასაბრუნებელ ჯამს და თარიღს — ${d} დღეზე ~${fmt(cx, cx % 1 ? 1 : 0)} ₾-ზე მეტი ხარჯი კანონის ზღვარს სცდება.`
        const info = joinInfo(isSupport(p) ? ptiNowText(p) : undefined, 'ეფექტური წლიური განაკვეთი ხელშეკრულებაში წერია და კანონით 50%-ს ვერ გადააჭარბებს. არსებული სესხის ახალ გრაფიკზე საუბარიც ერთ-ერთი ვარიანტია.', 'თუ თავს საფრთხეში გრძნობ, დარეკე 112-ზე.')
        return { msgs: [jk(text, ['როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე', 'რა არის ეფექტური განაკვეთი?'], undefined, info)], ctx: { ...ctx, topic: 'distress' }, mood: 'calm' }
      }
      return { msgs: distressMsgs(!!q.selfHarm), ctx: { kind: null, topic: q.selfHarm ? 'selfharm' : 'distress' }, mood: 'calm' }
    case 'gambling':
      // no loan is ever priced here, and the conversation does not continue a loan quote
      return { msgs: [conceptReply('gambling')], ctx: { kind: null, topic: 'gambling', topicQ: q.raw }, mood: 'calm' }
    case 'hardship':
      return { msgs: [conceptReply('restructure')], ctx: { kind: null, topic: 'restructure', topicQ: q.raw }, mood: 'calm' }
    case 'concept':
      return { msgs: [conceptReply(q.concept!)], ctx: { ...ctx, topic: q.concept, topicQ: q.raw, lastExplain: undefined }, mood: 'calm' }
    case 'decide':
      return decide()
    case 'total':
      return totalReply(q.ask ?? 'total')
    case 'explain':
      return explainReply(q.explain ?? 'more')
    case 'deposit': {
      const r = rateFrom(q)
      // "ყოველ თვე 50 ლარს გადავდებ, წელიწადში რამდენი იქნება 8%-იან ანაბარზე?": a monthly deposit over the months asked (a year by default)
      if (q.perMonth !== undefined && q.amount === undefined) {
        const rateY = r === undefined ? undefined : q.rateIsAnnual || !/თვეში|თვიურ/.test(lower) ? q.ratePct! / 100 : r * 12
        return depositSeries(q.perMonth, rateY, q.months ?? 12)
      }
      return depositReply({ kind: 'deposit', amount: q.amount, months: q.months, rateYear: r === undefined ? undefined : q.rateIsAnnual || !/თვეში|თვიურ/.test(lower) ? q.ratePct! / 100 : r * 12 })
    }
    case 'budget':
      return budgetReply()
    case 'safe': {
      const f = landingNow()
      // payday: the salary lands today, so "how much today" is about the new month: balance + salary − bills − usual spending − the cushion, over 30 days
      if (payday) {
        const month = nextPay() - e.cushion
        const perDay = Math.max(0, Math.round(month / 30))
        const text = perDay > 0 ? `ხელფასი დღესაა: ახალ თვეში გადასახადებისა და ჩვეული ხარჯის გარდა დღეში ~${gel(perDay)} თავისუფალია.` : 'ხელფასი დღესაა, მაგრამ ახალ თვეში გადასახადებისა და ჩვეული ხარჯის შემდეგ თავისუფალი თანხა თითქმის არ რჩება.'
        const info = `${nextPayInfo(0)} აქედან ${gel(e.cushion)} ზღვარია, დანარჩენი 30 დღეზე იყოფა. ჩვეული ხარჯი — დღეში ~${gel(Math.round(e.avgDaily))}.`
        const chips = perDay > 0 ? [`${r10(Math.max(20, month / 2))} ₾-ის რამე ვიყიდო?`, 'მარტივად ამიხსენი', 'ჩემი გადასახადები მაჩვენე'] : ['ჩემი გადასახადები მაჩვენე', 'მარტივად ამიხსენი', 'ხელფასამდე მეყოფა?']
        return { msgs: [jk(text, chips, undefined, info)], ctx: { ...ctx, topic: 'safe', topicQ: undefined, lastExplain: undefined }, mood: perDay > 0 ? 'happy' : 'calm' }
      }
      const safe = daysLeft > 0 ? Math.max(0, Math.round((f.p50 - e.cushion) / daysLeft)) : 0
      const max = day0 ? e.maxComfortablePurchase() : Math.max(0, Math.floor((f.p10 + (f.p50 - f.p10) * 0.6 - e.cushion) / 5) * 5)
      const avgD = Math.round(e.avgDaily)
      // money the person named ("ბარათზე 40 ლარი მაქვს"): the whole day's budget comes from it, not from the demo balance
      if (ctx.onHand !== undefined && daysLeft > 0) {
        const due = dueSum(), rest = Math.round(ctx.onHand - due), per = Math.round(Math.max(0, rest) / daysLeft)
        const text = rest <= 0
          ? `შენი ${gel(ctx.onHand)} ხელფასამდე გადასახდელსაც (~${gel(due)}) ვერ ფარავს — თავისუფალი თანხა არ რჩება.`
          : `შენი ${gel(ctx.onHand)}-დან გადასახადების შემდეგ ${q.perWeek ? `კვირაში ~${gel(per * 7)} (დღეში ~${gel(per)})` : `დღეში ~${gel(per)}`} რჩება — ეს მთელი ბიუჯეტია, ჩვეულებრივ კი დღეში ~${gel(avgD)}-ს ხარჯავ.`
        return { msgs: [jk(text, ['ჩემი გადასახადები მაჩვენე', 'ხელფასამდე მეყოფა?', 'მარტივად ამიხსენი'], undefined, joinInfo(due ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined, `ვითვლი შენ მიერ დასახელებული ${gel(ctx.onHand)}-ით.`))], ctx: { ...ctx, topic: undefined, lastExplain: undefined }, mood: 'calm' }
      }
      // a spend just discussed ("80 ლარი საჩუქარზე"): the free money with it and without it
      const pend = pending()
      if (pend && daysLeft > 0) {
        const fw = purchaseResult(e, p, pend.sum, day0, demo.extra, dayIdx)
        const w = safeOf(fw)
        const text = `${gel(pend.sum)}-ის ხარჯით ${w.safe > 0 ? `დღეს ჩვეულის გარდა ~${gel(w.safe)} რჩება` : 'ჩვეული ხარჯის გარდა თავისუფალი თანხა აღარ რჩება'}; მის გარეშე — დღეში ~${gel(safe)} 👇`
        return { msgs: [jk(text, ['ხელფასის შემდეგ რომ ვიყიდო?', 'მარტივად ამიხსენი', WEATHER_CHIP], { kind: 'safe', data: { safe: w.safe, max: w.max, avg: e.avgDaily, landing: fw, cushion: e.cushion, daysLeft } }, `ჩათვლილია: ${pend.label} (${gel(pend.sum)}). ჩვეული ხარჯი — დღეში ~${gel(avgD)}; ზღვარი (${gel(e.cushion)}) უკვე გამოკლებულია.`)], ctx: { ...ctx, topic: 'safe', topicQ: undefined, lastExplain: undefined }, mood: w.safe > 0 ? 'happy' : 'calm' }
      }
      // on payday itself the question is about the new month: the salary arrives today
      const text = daysLeft <= 0
        ? `ხელფასი დღესაა: ჩარიცხვამდე ნაშთი ${f.p50 >= 0 ? `~${gel(rs(f.p50))}-ია` : `~${gel(Math.max(5, rs(-f.p50)))}-ით მინუსშია`}. ახალი თვის ბიუჯეტს ხელფასის ჩარიცხვის შემდეგ ვითვლი.`
        : safe > 0
          ? (q.perWeek && daysLeft >= 7 ? `კვირაში ჩვეული ხარჯის გარდა ~${gel(safe * 7)} თავისუფალია (დღეში ~${gel(safe)}) 👇` : `დღეს ჩვეული ხარჯის გარდა ~${gel(safe)} თავისუფალია 👇`)
          : 'ხელფასამდე ჩვეული ხარჯის გარდა თავისუფალი თანხა თითქმის არ რჩება. აუცილებელი ხარჯი, რა თქმა უნდა, მაინც აუცილებელია.'
      const info = joinInfo(safe <= 0 && daysLeft > 0 ? 'პროგნოზი უსაფრთხო ზღვართან ახლოსაა.' : undefined, `ჩვეული ხარჯი — დღეში ~${gel(Math.round(e.avgDaily))}. ${daysLeft > 0 ? `ხელფასამდე ${daysLeft} დღეა; ` : ''}ზღვარი (${gel(e.cushion)}) უკვე გამოკლებულია.`)
      return { msgs: [jk(text, [`${max || 20} ₾-ის რამე ვიყიდო?`, 'მარტივად ამიხსენი', WEATHER_CHIP], { kind: 'safe', data: { safe, max, avg: e.avgDaily, landing: f, cushion: e.cushion, daysLeft } }, info)], ctx: { ...ctx, topic: 'safe', topicQ: undefined, lastExplain: undefined }, mood: safe > 0 ? 'happy' : 'calm' }
    }
    case 'forecast': {
      const f = landingNow()
      // "ფული აღარ მაქვს / არ მყოფნის, რა ვქნა?": acknowledged first, then what is due before payday and what is left; the options behind the ⓘ
      if (q.short && !q.sky) {
        const due = dueSum()
        const opts = `რას აკეთებენ ხშირად: ${payday ? 'თვის' : 'ხელფასამდე'} გადასახდელის სიას ადგენენ${duesNow().length ? ` (${dueLine(p, dayIdx)})` : ''}; აუცილებელ ხარჯს (საკვები, წამალი) გამოყოფენ; გადასახადის თარიღზე კომპანიას ან ბანკს თარიღამდე ესაუბრებიან.`
        const quick = 'სწრაფი სესხი ამ ხარჯს არ აქრობს — მომდევნო თვეზე გადააქვს, პროცენტით.'
        const sctx: Ctx = { ...ctx, topic: 'forecast', topicQ: undefined, lastExplain: undefined }
        if (payday) {
          const nx = nextPay()
          const text = `გასაგებია, რომ ახლა მძიმეა. ხელფასი დღესაა (${gel(p.salary)}), ${nx >= 0 ? `და ჩვეული ხარჯით მომდევნო ხელფასამდე (${nextPaydayWord}) ~${gel(rs(nx))} დაგრჩება` : `მაგრამ ჩვეული ხარჯით მომდევნო ხელფასამდე (${nextPaydayWord}) ~${gel(Math.max(5, rs(-nx)))} დაგაკლდება`}.`
          // the options are visible on a card, not only behind the ⓘ
          const card: ChatCard = { kind: 'concept', data: { title: 'როცა თვე მჭიდროა', more: quick, mine: billsLine(e, p), rule: 'რას აკეთებენ ხშირად: თვის გადასახდელის სიას ადგენენ, აუცილებელს (საკვები, წამალი) გამოყოფენ და ბანკს ან კომპანიას თარიღამდე ესაუბრებიან.' } }
          return { msgs: [jkFit(text, ['ჩემი გადასახადები მაჩვენე', 'როგორ ვთხოვო გადავადება?', 'როცა ვალს ვერ ვიხდი'], card, joinInfo(nextPayInfo(0), opts))], ctx: sctx, mood: 'calm' }
        }
        const left = f.p50 > 0 ? `სავარაუდოდ ~${gel(rs(f.p50))} დაგრჩება` : `სავარაუდოდ ~${gel(Math.max(5, rs(-f.p50)))} დაგაკლდება`
        const text = `გასაგებია, რომ ახლა მძიმეა. ხელფასამდე ${daysLeft} დღეა: ${due ? `გადასახდელი ~${gel(due)} გაქვს და ` : ''}ჩვეული ხარჯით ${left}.`
        return { msgs: [jkFit(text, ['ჩემი გადასახადები მაჩვენე', 'როცა ვალს ვერ ვიხდი', 'დღეს რამდენი შემიძლია?'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: f } }, joinInfo(opts, quick, cushionInfo(e, p)))], ctx: sctx, mood: 'calm' }
      }
      // "ხელფასი დღეს ჩამერიცხა?": the payday in the person's data (never a live bank read)
      if (q.salaryQ && !q.sky) {
        const word = /სტიპენდ/.test(lower) && /სტიპენდ/.test(p.incomeLabel) ? 'სტიპენდია' : 'ხელფასი'
        const nx = nextPay()
        const text = payday
          ? `კი — შენს მონაცემებში ${word} დღეს ჩაირიცხება: ნაშთს (~${gel(rs(f.p50))}) ${gel(p.salary)} ემატება. მომდევნო ხელფასამდე ჩვეული ხარჯით სავარაუდოდ ${leftOrShort(nx)}.`
          : `ჯერ არა: შენს მონაცემებში ${word} ${dative(p.paydayLabel)} ჩაირიცხება — ${daysLeft} დღეში. მანამდე სავარაუდოდ ${leftOrShort(f.p50)}.`
        return { msgs: [jkFit(text, payday ? ['დღეს რამდენი შემიძლია?', 'ჩემი გადასახადები მაჩვენე', 'მარტივად ამიხსენი'] : ['დღეს რამდენი შემიძლია?', 'ხელფასამდე მეყოფა?', WEATHER_CHIP], undefined, joinInfo(payday ? nextPayInfo(0) : undefined, 'ჯიხო ბანკს არ უკავშირდება: თარიღი შენი ხარჯების ისტორიიდანაა (დემოში — სინთეზური).'))], ctx: { ...ctx, topic: 'forecast', topicQ: undefined, lastExplain: undefined }, mood: 'calm' }
      }
      // "ხელფასის მერე თვის ბოლომდე რამდენი დამრჩება?": the next payday, counted from the coming one
      if (q.afterPayday && !payday && !q.sky && !q.short) {
        const nx = nextPay()
        const text = `ხელფასის (${dative(p.paydayLabel).split(', ')[1] ?? ''}) შემდეგ მომდევნო ხელფასამდე (${nextPaydayWord}) ჩვეული ხარჯით სავარაუდოდ ${leftOrShort(nx)}${nx >= 0 ? ` — ${nx >= e.cushion ? 'ზღვარს ზემოთ' : `ზღვარზე (${gel(e.cushion)}) ნაკლები`}` : ''}.`
        return { msgs: [jkFit(text, ['დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'], undefined, joinInfo(nextPayInfo(0), cushionInfo(e, p)))], ctx: { ...ctx, kind: null, afterPayday: true, topic: 'forecast', topicQ: undefined, lastExplain: undefined }, mood: nx >= e.cushion ? 'happy' : 'calm' }
      }
      // payday: the weather until payday is over; the question is the next payday, with today's salary counted
      if (payday && !q.sky) {
        const nx = nextPay()
        const text = `ხელფასი დღესაა: ნაშთს (~${gel(rs(f.p50))}) დღეს ${gel(p.salary)} ემატება. მომდევნო ხელფასამდე (${nextPaydayWord}) ჩვეული ხარჯით სავარაუდოდ ${leftOrShort(nx)}.`
        const chips = nx >= e.cushion ? ['დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'] : ['ჩემი გადასახადები მაჩვენე', 'მარტივად ამიხსენი', 'როცა ვალს ვერ ვიხდი']
        return { msgs: [jkFit(text, chips, undefined, joinInfo(nextPayInfo(0), cushionInfo(e, p)))], ctx: { ...ctx, topic: 'forecast', topicQ: undefined, lastExplain: undefined }, mood: nx >= e.cushion ? 'happy' : 'calm' }
      }
      // "რა ამინდია ხვალ თბილისში?": say what Jikho's weather is, then show it
      const head = q.sky ? 'ნამდვილ ამინდს ვერ გეტყვი 🙂 ჩემი „ამინდი" ხელფასამდე ფულის პროგნოზია:' : daysLeft <= 0 ? 'ხელფასი დღესაა:'
        : q.when ? `${/სტიპენდ/.test(lower) && /სტიპენდ/.test(p.incomeLabel) ? 'სტიპენდია' : 'ხელფასი'} ${dative(p.paydayLabel)} ჩაგერიცხება — ${daysLeft} დღეში.` : `ხელფასამდე ${daysLeft} დღეა.`
      const left = daysLeft <= 0 ? (f.p50 >= 0 ? `ჩარიცხვამდე ნაშთი ~${fmt(rs(f.p50))} ₾-ია` : `ჩარიცხვამდე ნაშთი ~${fmt(Math.max(5, rs(-f.p50)))} ₾-ით მინუსშია`)
        : f.p50 > 0 ? `სავარაუდოდ ~${fmt(rs(f.p50))} ₾ დაგრჩება` : `სავარაუდოდ ~${fmt(Math.max(5, rs(-f.p50)))} ₾ დაგაკლდება`
      const info = joinInfo(rs(f.p10) !== rs(f.p90) ? `სავარაუდო შუალედი: ${rangeText(rs(f.p10), rs(f.p90))}.` : undefined, cushionInfo(e, p))
      return { msgs: [jk(`${head} ${left} — ამინდი ${WEATHER_LABEL[f.weather]}ა ${WEATHER_ICON[f.weather]}`, ['დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი', WEATHER_CHIP], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: f } }, info)], ctx: { ...ctx, topic: 'forecast', topicQ: undefined, lastExplain: undefined }, mood: f.weather === 'sun' || f.weather === 'cloud' ? 'happy' : 'worried' }
    }
    case 'save': {
      // the person's own saving goal ("ზამთრის კურსი"), named in the question or asked about ("კურსის თანხას როდის შევავსებ?")
      if (p.savings && p.savings.amount < p.savings.target && (q.amount === undefined || savingsNamed()) && (savingsNamed() || (q.goalQ && (ctx.goal || /ქვევრ|მიზან/.test(lower))))) {
        const setAside = q.amount !== undefined && q.amount < p.savings.target && !/რამდენ ხანში|როდის|რამდენი ხანი|მჭირდება|სჭირდება|ღირს/.test(lower) ? q.amount : undefined
        return goalReply(q.perMonth ?? setAside)
      }
      const goalCtx = ctx.kind === 'save' || ctx.kind === 'purchase' || ctx.kind === 'installment' || ctx.kind === 'loan' ? ctx.amount : undefined
      let per = q.perMonth
      let goal = q.amount ?? goalCtx
      // "200 ლარი რომ გადავდო?" while saving up for 1 200 ₾: 200 is the monthly sum
      if (per === undefined && q.amount !== undefined && ctx.kind === 'save' && ctx.amount && q.amount < ctx.amount && /გადავდ|დავზოგ|შევინახ|ვდებ/.test(lower)) { per = q.amount; goal = ctx.amount }
      // "რამდენი უნდა დავზოგო თვეში, რომ 6 თვეში 1200 ლარი მქონდეს?": the monthly sum the date needs
      if (per === undefined && goal && q.months) return saveByDate(goal, q.months, q.item ?? ctx.item)
      return saveReply(goal, per, q.item ?? ctx.item)
    }
    case 'purchase': {
      const amount = q.amount!
      const onHand = q.onHand ?? ctx.onHand
      // spends already certain in this conversation ("ხვალ 45 ლარის წიგნები უნდა ვიყიდო", "დღეს უკვე 30 დავხარჯე") are counted with this one;
      // the same sum named again is the same spend, not a second one
      const sameAgain = ctx.kind === 'purchase' && ctx.amount === amount && !q.spent
      // "ხვალ კიდევ 30?": "კიდევ" adds to the spend just discussed
      const more = /კიდევ|კიდე |დამატებით|ზემოდან|ამის გარდა|ამას გარდა|პლუს/.test(lower) && !q.whatIf
      const priorList = ctx.kind === 'purchase' && ctx.amount && !ctx.afterPayday && ctx.onHand === undefined && !sameAgain
        ? [...(ctx.spends ?? []), ...(ctx.certain || more ? [{ amount: ctx.amount, label: ctx.item ?? 'ხარჯი' }] : [])] : sameAgain ? ctx.spends ?? [] : []
      const prior = priorList.length ? { sum: priorList.reduce((a, x) => a + x.amount, 0), label: priorList.map(x => `${x.label} ${gel(x.amount)}`).join(', ') } : undefined
      const certain = !!q.spent || !!q.bill || /უნდა (?:ვიყიდო|გადავიხადო|დავხარჯო|ვიყიდი|ვიყიდოთ)|სჭირდება|მჭირდება|აუცილებლად|მომიწევს/.test(lower)
      const nctx: Ctx = { kind: 'purchase', amount, item: q.item, onHand, spends: priorList.length ? priorList : undefined, certain, cash: q.cash ?? (q.onHand === undefined ? ctx.cash : undefined) }
      const priced = !!q.months || q.ratePct !== undefined || q.zeroRate
      const kind = q.spent ? 'spent' : q.lend ? (q.lend === 'past' ? 'lent' : 'lend') : q.bill ? 'bill' : 'buy'
      const when = whenOf(q), off = offsetOf(q)
      // "-200 ლარი რომ დავხარჯო?": the minus is not dropped quietly
      if (q.negative) return { msgs: [jk(`„−${fmt(amount)} ₾" ხარჯად ვერ წავიკითხე: ხარჯი დადებითი თანხაა. ${fmt(amount)} ₾-ის ხარჯს გულისხმობ თუ ${fmt(amount)} ₾-ის შემოსავალს?`, [`${fmt(amount)} ლარი რომ დავხარჯო?`, 'ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'thinking' }
      if (amount === 0) return { msgs: [jk(`0 ₾-ის ხარჯი პროგნოზს არ ცვლის: ${payday ? `მომდევნო ხელფასამდე სავარაუდოდ ${leftOrShort(nextPay())}` : `ხელფასამდე სავარაუდოდ ${leftOrShort(landingNow().p50)}`}.`, MENU)], ctx, mood: 'calm' }
      // a pasted bank SMS that shows its own balance: counted from that balance, next to the demo data
      if (q.spent && q.smsBalance !== undefined) return smsReply(q.smsBalance, amount, q.smsDate)
      // support mode: food, school or a child's clothes are basic needs, never framed as a purchase to think over
      if (isSupport(p) && q.needed && (kind === 'buy' || kind === 'bill') && !priced) return neededReply(amount, q.item, onHand, off !== undefined && off >= daysLeft && daysLeft > 0 ? when : undefined)
      // the salary lands today: the spend is counted against the next payday
      if (payday && !priced) return paydayPurchase(amount, q.item, kind)
      // a sum far beyond any month's budget: say so, with fitting next steps
      if (amount > p.salary * 24 && !priced) return hugeReply(amount)
      // lending to someone: money that leaves until it comes back, priced like a spend
      if (q.lend) {
        const msgs = purchaseAnswer(e, p, amount, undefined, day0 ? undefined : landingNow(), day0, demo.extra, dayIdx, q.lend === 'past' ? 'lent' : 'lend', { when, bal: balNow() })
        const w = msgs[0].card!.data.r.weather
        return { msgs, ctx: { ...nctx, lend: true, certain: q.lend === 'past' }, mood: w === 'sun' || w === 'cloud' ? 'happy' : 'calm' }
      }
      if (q.afterPayday) return afterPaydayReply(amount, q.item)
      // "შაბათს" when payday comes before Saturday: the spend falls after the salary
      if (off !== undefined && off >= daysLeft && kind !== 'spent' && !priced) return afterPaydayReply(amount, q.item, when)
      // "500 ლარი მაქვს და 300-იანი ქურთუკი ვიყიდო?": counted from the money the person says they have
      if (onHand !== undefined && !q.months && q.ratePct === undefined && !q.zeroRate) return onHandPurchase(onHand, amount, q.item, nctx.cash)
      if (q.months || q.ratePct !== undefined || q.zeroRate) {
        // a term or a rate makes it an installment (an item to buy) or a loan (money for a term)
        const kind = q.item || /ვიყიდ|ყიდვ|შევიძინ/.test(lower) ? 'installment' : 'loan'
        return respondInstallment({ ...nctx, kind, months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q), startOffset: startFrom(q), upfront: q.upfront, cashPrice: q.cashPrice }, kind)
      }
      const msgs = purchaseAnswer(e, p, amount, q.item, day0 ? undefined : landingNow(), day0, demo.extra, dayIdx, kind === 'bill' ? 'bill' : kind === 'spent' ? 'spent' : 'buy',
        { when, bal: balNow(), parts: q.parts, uncounted: q.uncounted, info: q.spent && q.smsDate ? smsDateNote(q.smsDate) : kind === 'bill' && /(?:^|[^ა-ჰ])ქირ|საცხოვრებ/.test(lower) ? 'rent' : undefined, prior })
      const r0 = msgs[0].card?.data.r
      // "250 ლარიანი ყურსასმენი ვიყიდო თუ დავიცადო?": today against after payday, both in the visible line
      if (q.waitQ && kind === 'buy' && r0) {
        const after = nextPay(amount)
        const now = r0.p50 > 0 ? `ხელფასის დღეს ~${gel(r5(r0.p50))} დაგრჩება` : `ხელფასამდე ~${gel(Math.max(5, r5(-r0.p50)))} დაგაკლდება`
        const later = after >= 0 ? `მომდევნო ხელფასამდე ~${gel(r10(after))} დაგრჩება${after < e.cushion ? ` — ზღვარზე (${gel(e.cushion)}) ნაკლები` : ''}` : `მომდევნო ხელფასამდე ~${gel(Math.max(5, rs(-after)))} დაგაკლდება`
        msgs[0] = withInfo({ ...msgs[0], text: `დღეს: ${now}. ხელფასის შემდეგ: ${later}.`, chips: ['რატომ?', 'რამდენ ხანში დავაგროვებ?', 'დღეს რამდენი შემიძლია?'] }, joinInfo(nextPayInfo(amount), cushionInfo(e, p)))
        return { msgs, ctx: { ...nctx, afterPayday: undefined }, mood: 'calm' }
      }
      // "ავიღო თუ არა …?" with the sum named: the numbers, and the decision left to the person
      if (q.yesNo && msgs[0].text.length + 36 <= 160) msgs[0] = { ...msgs[0], text: `გადაწყვეტილება შენია — აი, ციფრები: ${msgs[0].text}` }
      // "…ხელფასამდე მეყოფა თუ არა?" inside a long message: the plain answer first
      if (/მეყოფა|გეყოფა|გავძლებ|ვიცოცხლებ/.test(lower) && kind === 'buy' && amount <= balNow()) {
        const r = msgs[0].card!.data.r
        const verdict = r.p50 >= e.cushion ? 'სავარაუდოდ კი' : r.p50 > 0 ? 'სავარაუდოდ კი, მაგრამ მჭიდროდ' : 'სავარაუდოდ არა'
        msgs[0] = { ...msgs[0], text: `${verdict}: ${msgs[0].text}` }
        if (msgs[0].text.length > 160) {
          const short = `${verdict}: ${when ?? 'დღეს'} ${gel(amount, amount % 1 ? 2 : 0)}-ის შემდეგ ${r.p50 > 0 ? `ხელფასის დღეს ~${fmt(r5(r.p50))} ₾ დაგრჩება` : `ხელფასამდე ~${fmt(Math.max(5, r5(-r.p50)))} ₾ დაგაკლდება`}${r.p50 > 0 && r.p50 < e.cushion ? ` — ზღვარზე (${gel(e.cushion)}) ნაკლები` : ''}.`
          // spends named without a sum stay visible: "probably yes" never silently covers them
          const unc = q.uncounted?.length ? ` ${q.uncounted.join(' და ')} ამაში არ შედის.` : ''
          msgs[0] = { ...msgs[0], text: `${short}${unc}`.length <= 160 ? `${short}${unc}` : short }
        }
      }
      // "ტელეფონი გამიფუჭდა… რა გზა მაქვს?": the options in words with the person's numbers, not only as chips (an installment is not offered in support mode)
      if (kind === 'buy' && /რა გზა|რა ვარიანტ|რა გამოსავალ|რა ვქნა|რა გავაკეთო/.test(lower)) {
        const after = nextPay(amount), save = e.monthsToSave(amount)
        const parts = [`ხელფასის შემდეგ — მომდევნო ხელფასამდე ${after >= 0 ? `~${gel(r10(after))} დაგრჩება` : `~${gel(Math.max(5, rs(-after)))}-ით მინუსი`}`]
        if (Number.isFinite(save) && save <= 36) parts.push(`დაზოგვით — ~${save} თვეში`)
        if (!isSupport(p) && amount >= 200) parts.push(`განვადებით 12 თვით — ~${gel(Math.round(annuity(amount, 0.015, 12)))}/თვე (სამაგალითო 1,5%)`)
        // something broken: a repair is an option too (dropped first when the bubble is full)
        if (/გამიფუჭდ|გაფუჭდ|გამიტყდ|გატყდ|დაზიანდ/.test(lower)) parts.push('შეკეთება — ფასს თუ მომწერ, დაგითვლი')
        let line = `ვარიანტები: ${parts.join('; ')}.`
        while (line.length > 160 && parts.length > 1) { parts.pop(); line = `ვარიანტები: ${parts.join('; ')}.` }
        const first = { ...msgs[0], chips: undefined }
        return { msgs: [first, withInfo({ id: id(), from: 'jikho', text: line, chips: msgs[0].chips }, nextPayInfo(amount))], ctx: nctx, mood: 'calm' }
      }
      const w = r0?.weather
      return { msgs, ctx: nctx, mood: w === 'sun' || w === 'cloud' ? 'happy' : kind === 'bill' ? 'calm' : 'worried' }
    }
    case 'installment':
    case 'loan': {
      // right after a gambling loss: no loan is priced (it would be a win-back loan)
      if (q.intent === 'loan' && ctx.topic === 'gambling') return { msgs: [conceptReply('gambling')], ctx, mood: 'calm' }
      // microloans and loans counted in days: the bank example rate would make them look cheap, so ask for the real repayment
      if (q.intent === 'loan' && (q.micro || (q.days !== undefined && q.days <= 92)) && rateFrom(q) === undefined) {
        const amount = q.amount ?? (ctx.kind === 'micro' ? ctx.amount : undefined)
        const days = q.days ?? (ctx.kind === 'micro' ? ctx.days : undefined)
        // the legal maximum for this sum and term: a 50% effective yearly rate (Civil Code art. 625(2)) over the days, amount × (1,5^(days/365) − 1)
        const capCost = (a: number, d: number) => a * (Math.pow(1.5, d / 365) - 1)
        const capTxt = (v: number) => { const x = v < 10 ? Math.round(v * 10) / 10 : Math.round(v); return fmt(x, x % 1 ? 1 : 0) }
        const lead = amount && days ? `კანონით ${gel(amount)}-იან სესხზე ${days} დღით პროცენტი და საკომისიოები ჯამში ~${capTxt(capCost(amount, days))} ₾-ს ვერ გადააჭარბებს.`
          : amount ? `კანონით ${gel(amount)}-იან სესხზე, მაგალითად 30 დღით, პროცენტი და საკომისიოები ~${capTxt(capCost(amount, 30))} ₾-ს ვერ გადააჭარბებს.`
          : 'მიკროსესხზე ბანკის სამაგალითო განაკვეთს არ ვიყენებ — მისი ფასი ხშირად გაცილებით მაღალია.'
        const ask = amount ? days ? ' რამდენი უნდა დააბრუნო ხელშეკრულებით?' : ' რამდენი უნდა დააბრუნო და როდის?' : ' რა თანხას იღებ და რამდენი უნდა დააბრუნო?'
        const d0 = days ?? 30
        const capInfo = amount ? `ზღვარი ასე ითვლება: ${fmt(amount)} × (1,5^(${d0}/365) − 1) ≈ ${fmt(capCost(amount, d0), 2)} ₾ — ეს 50%-იანი ეფექტური წლიური განაკვეთია ${d0} დღეზე.` : undefined
        // the card: paying back up to the legal maximum in one payment, on the person's months (like every other loan answer)
        let card: ChatCard | undefined
        if (amount && d0 <= 45 && !isSupport(p)) {
          const t = { ...e.installment({ price: amount, months: 1, ratePerMonth: capCost(amount, d0) / amount }), label: `${d0} დღე · კანონის ზღვრით` }
          card = tenorCard(e, [t], `${gel(amount)} მიკროსესხი: დაბრუნება ~${gel(Math.round(amount + capCost(amount, d0)))}-მდე`, 'ეს კანონის ზღვარია. ხელშეკრულების თანხას თუ მომწერ, ზუსტად დაგითვლი.', (debtNow(p) - e.laptop) / p.salary * 100)
        }
        // support mode: the salary date first; her room under the PTI limit behind the ⓘ
        const lim = ptiLimit(p).now, room = Math.round(p.salary * lim / 100 - debtNow(p))
        const payWhen = isSupport(p) && daysLeft > 0 ? `ხელფასი ${daysLeft} დღეში, ${dative(p.paydayLabel).split(', ')[1] ?? ''} ჩაირიცხება. ` : ''
        const text = payWhen && `${payWhen}${lead}`.length <= 160 ? `${payWhen}${lead}` : lead + ask
        const supInfo = isSupport(p) ? `სესხებზე უკვე შემოსავლის ${fmt(debtNow(p) / p.salary * 100, 1)}% მიდის: ${lim}%-იან ლიმიტამდე თვეში ${room > 0 ? `~${gel(room)} რჩება` : 'აღარაფერი რჩება'}.` : undefined
        return { msgs: [jk(text, ['რა არის ეფექტური განაკვეთი?', 'გადახდა თუ დამიგვიანდა?', ...(isSupport(p) ? ['როცა ვალს ვერ ვიხდი'] : [])], card, joinInfo(supInfo, text === lead + ask ? undefined : ask.trim(), capInfo, MICRO_INFO))], ctx: { kind: 'micro', amount, days }, mood: 'calm' }
      }
      // the same kind of deal is already on the table: keep the user's rate, start and down payment (and the term, for "და 3 000?" or "ეს სესხი")
      const cont = ctx.kind === q.intent && ctx.amount !== undefined && (q.amount === undefined || !!q.whatIf || !!q.sameDeal)
      const keepTerm = cont && (!!q.whatIf || !!q.sameDeal)
      const r = rateFrom(q), st = startFrom(q)
      // "კიდევ ერთი სესხი ავიღო?": another loan, not the sum of the last purchase
      const another = /კიდევ ერთი|კიდე ერთი|კიდევ (?:ერთ|სხვა) სესხ|ახალი სესხი/.test(lower)
      // support mode, a new loan with no sum: her debts against her limit, and calm options (no loan priced on a guess)
      if (q.intent === 'loan' && isSupport(p) && q.amount === undefined && !(cont && isDeal(ctx))) {
        const lim = ptiLimit(p).now, room = Math.round(p.salary * lim / 100 - debtNow(p))
        const text = `ახალი სესხი არსებულს ემატება: სესხებზე უკვე შემოსავლის ${fmt(debtNow(p) / p.salary * 100, 1)}% მიდის, ${lim}%-იან ლიმიტამდე თვეში ${room > 0 ? `~${gel(room)} რჩება` : 'აღარაფერი რჩება'}.`
        const info = `${debtsLine(p)} სხვა ვარიანტები, რასაც ხშირად განიხილავენ: არსებული სესხის ახალ გრაფიკზე საუბარი გამსესხებელთან; ხელფასამდე გადასახდელის სია. ნებისმიერ სესხზე ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს.`
        return { msgs: [jk(text, ['როცა ვალს ვერ ვიხდი', 'ჩემი გადასახადები მაჩვენე', 'რა არის PTI?'], undefined, info)], ctx: { kind: null, topic: 'restructure', topicQ: 'ვალები მაქვს, რა ვქნა?' }, mood: 'calm' }
      }
      const nctx: Ctx = {
        kind: q.intent,
        amount: q.amount ?? (ctx.kind && !(another && ctx.kind === 'purchase') ? ctx.amount : undefined),
        item: q.item ?? ctx.item,
        months: q.months ?? (keepTerm ? ctx.months : undefined),
        ratePerMonth: r ?? (cont ? ctx.ratePerMonth : undefined),
        rateText: r !== undefined ? rateTxt(q) : cont ? ctx.rateText : undefined,
        startOffset: st ?? (cont ? ctx.startOffset : undefined),
        upfront: q.upfront ?? (cont ? ctx.upfront : undefined),
        cashPrice: q.cashPrice ?? (cont ? ctx.cashPrice : undefined),
      }
      if (nctx.amount === undefined) {
        if (isSupport(p)) return { msgs: [jk('რა თანხაზე და რა ვადით ფიქრობ? გაჩვენებ, როგორ აისახება შენს თვეებზე.', [], undefined, ptiNowText(p))], ctx: nctx, mood: 'calm' }
        return { msgs: [jk(q.intent === 'loan' ? 'რა თანხის სესხზე ფიქრობ და რამდენი თვით? მაგალითად: „2 000 ლარი 24 თვით 18%-ით".' : 'რა ღირს ნივთი? მაგალითად: „1 200 ლარის ტელეფონი 12 თვით".', q.intent === 'loan' ? ['2 000 ₾ სესხი 24 თვით 18%-ით', '1 000 ₾ სესხი 12 თვით'] : ['1 200 ₾-ის ტელეფონი განვადებით', '800 ₾ მაცივარი 0%-ით 6 თვით'])], ctx: nctx, mood: 'thinking' }
      }
      // a tweak of the deal on the table ("სესხი 24 თვით?", "და 3 000 ლარი სესხი?") is a follow-up: one bubble; a bare "სესხი მინდა" is a new view
      const tweak = cont && (q.months !== undefined || r !== undefined || st !== undefined || q.upfront !== undefined || !!q.whatIf)
      const res = respondInstallment(nctx, q.intent, { ask: q.ask, limitQ: /ლიმიტ|ჩავჯდები|ჩავეტევი/.test(lower), followup: tweak, startChanged: tweak ? (nctx.startOffset ?? 0) !== (ctx.startOffset ?? 0) : undefined })
      // "ავიღო თუ არა 2 000 ლარიანი სესხი …?": the numbers, with the decision left to the person
      if (q.yesNo && `გადაწყვეტილება შენია — აი, ციფრები: ${res.msgs[0].text}`.length <= 160) res.msgs[0] = { ...res.msgs[0], text: `გადაწყვეტილება შენია — აი, ციფრები: ${res.msgs[0].text}` }
      // a new loan right after "I can't pay my debts": the numbers, with the fact that it adds to the debts, and calm chips
      if (q.intent === 'loan' && (ctx.topic === 'restructure' || ctx.topic === 'distress' || ctx.topic === 'late')) {
        res.msgs[0] = { ...res.msgs[0], text: 'ახალი სესხი არსებულ ვალებს ემატება — აი, მისი ციფრები შენს თვეებზე 👇' }
        const last = res.msgs.length - 1
        res.msgs[last] = { ...res.msgs[last], chips: ['ჩემი გადასახადები მაჩვენე', 'როცა ვალს ვერ ვიხდი', 'რა არის PTI?'] }
        return { ...res, mood: 'calm' }
      }
      return res
    }
    case 'followup': {
      if (ctx.kind === 'installment' || ctx.kind === 'loan') {
        const nctx: Ctx = { ...ctx }
        if (q.months) nctx.months = q.months
        const r = rateFrom(q); if (r !== undefined) { nctx.ratePerMonth = r; nctx.rateText = rateTxt(q) }
        const st = startFrom(q); if (st !== undefined) nctx.startOffset = st
        if (q.upfront !== undefined) nctx.upfront = q.upfront
        else if (q.useSavings && p.savings) nctx.upfront = Math.min(300, p.savings.amount)
        // a new price ("და 1500?", "1500 ლარი 24 თვით"): the term, rate and start stay
        if (q.amount !== undefined) nctx.amount = q.amount
        if (q.item) nctx.item = q.item
        // the April question keeps the 12-month tenor (the memorable moment)
        if (q.startMonth && !q.months && !ctx.months) nctx.months = 12
        // only the rate changed ("მე თვეში 1%-ს მთავაზობენ", "და თუ 12%-ით?"): the old numbers stay next to the new ones
        const old = buildDeal(e, p, ctx, ctx.kind)
        const prevRate = r !== undefined && Math.abs(r - old.rate) > 1e-9 && q.months === undefined && q.amount === undefined && st === undefined && q.upfront === undefined ? { txt: old.rateTxt, rows: old.rows } : undefined
        return respondInstallment(nctx, ctx.kind, { followup: true, priceChanged: nctx.amount !== ctx.amount, startChanged: (nctx.startOffset ?? 0) !== (ctx.startOffset ?? 0), prevRate })
      }
      if (ctx.kind === 'save') {
        // "და 12 თვეში?" on a saving goal: the monthly sum for that date
        if (q.months && q.amount === undefined && ctx.amount && ctx.rateYear === undefined) return saveByDate(ctx.amount, q.months, ctx.item)
        // saving towards the person's own pot: a new sum is a new monthly sum ("და 400?")
        if (ctx.goal && q.amount !== undefined && !q.item && p.savings) return goalReply(q.amount)
        // a monthly deposit plan: a new rate, term or monthly sum on the same plan
        if (ctx.amount === undefined && ctx.perMonth && ctx.rateYear !== undefined && (q.ratePct !== undefined || q.months !== undefined || q.amount !== undefined)) {
          const rr = rateFrom(q)
          return depositSeries(q.amount ?? ctx.perMonth, rr === undefined ? ctx.rateYear : q.rateIsAnnual || !/თვეში|თვიურ/.test(lower) ? q.ratePct! / 100 : rr * 12, q.months ?? ctx.months ?? 12)
        }
        // "ხოლო 300-ს?": a new monthly sum when one was given; "ათას ორასი ლარის ტელეფონზე კი?": a new goal at the same monthly sum
        if (ctx.perMonth !== undefined && q.amount !== undefined) {
          const newGoal = !!q.item || /(?:ზე|სთვის) კი/.test(lower) || (ctx.amount !== undefined && q.amount >= ctx.amount) || q.amount > ctx.perMonth * 4
          return newGoal ? saveReply(q.amount, ctx.perMonth, q.item ?? ctx.item) : saveReply(ctx.amount, q.amount, ctx.item)
        }
        if (q.amount !== undefined) return saveReply(q.amount, undefined, ctx.item)
      }
      if (ctx.kind === 'deposit') {
        const r = rateFrom(q)
        return depositReply({ ...ctx, amount: q.amount ?? ctx.amount, months: q.months ?? ctx.months, rateYear: r === undefined ? ctx.rateYear : q.rateIsAnnual || !/თვეში|თვიურ/.test(lower) ? q.ratePct! / 100 : r * 12 })
      }
      if (ctx.kind === 'purchase' && ctx.amount) {
        if (q.months || q.ratePct !== undefined || q.zeroRate) return respondInstallment({ kind: 'installment', amount: q.amount ?? ctx.amount, item: q.item ?? ctx.item, months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q), startOffset: startFrom(q), upfront: q.upfront }, 'installment')
        if (q.amount !== undefined) return respondCore(`${q.amount} ლარი ვიყიდო`, e, p, ctx, demo)
        if (q.afterPayday) return afterPaydayReply(ctx.amount, ctx.item)
        // "დეკემბერში რომ დავხარჯო?": a later month falls after the coming payday
        if (q.startMonth && q.startMonth !== 11) return afterPaydayReply(ctx.amount, ctx.item, `${KA_MONTHS_FULL[q.startMonth].replace(/ი$/, '')}ში`)
      }
      // no deal on the table: a term or a rate means an installment (an item) or a loan, never a cash purchase
      if (q.amount !== undefined && (q.months !== undefined || q.ratePct !== undefined || q.zeroRate)) {
        const kind = q.item ? 'installment' : 'loan'
        return respondInstallment({ kind, amount: q.amount, item: q.item, months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q), startOffset: startFrom(q), upfront: q.upfront }, kind)
      }
      if (q.amount !== undefined) return respondCore(`${q.amount} ლარი ვიყიდო`, e, p, ctx, demo)
      return { msgs: [jk('რა თანხაზე ფიქრობ? მომწერე, მაგალითად: „300 ლარი" ან „1 200 ლარი 12 თვით".', MENU)], ctx, mood: 'thinking' }
    }
    default: {
      // mortgage, guarantor, collateral, credit limit, grace period, cashback, leasing, cards: one plain fact each
      const fact = FACTS.find(([re]) => re.test(lower))
      // a credit line offered with a sum: what the limit means, and what using part of it would cost (an example rate)
      if (fact && /საკრედიტო ლიმიტ|ლიმიტი შემომთავაზ/.test(lower) && q.amount) {
        const used = Math.round(q.amount / 2)
        return { msgs: [jk(`${gel(q.amount)}-იანი ლიმიტი ვალი არ არის, სანამ არ გამოიყენებ: პროცენტი მხოლოდ გამოყენებულ თანხას ერიცხება.`, ['რა არის ეფექტური განაკვეთი?', 'რა არის საკრედიტო ისტორია?', 'დღეს რამდენი შემიძლია?'], undefined, `მაგალითად, ${gel(used)} გამოყენებაზე სამაგალითო 24%-იანი წლიური განაკვეთით თვეში ~${gel(Math.round(used * 0.02))} ერიცხება. ზუსტ განაკვეთს და საკომისიოს ხელშეკრულება აჩვენებს; ეფექტური წლიური განაკვეთი კანონით 50%-ს ვერ გადააჭარბებს.`)], ctx: { ...ctx, topic: undefined, lastExplain: undefined }, mood: 'calm' }
      }
      if (fact) return { msgs: [jk(fact[1], fact[3] ?? ['რა არის ეფექტური განაკვეთი?', 'რა არის საკრედიტო ისტორია?'], undefined, fact[2])], ctx: { ...ctx, topic: undefined, lastExplain: undefined }, mood: 'calm' }
      // the balance or the usual spending, from the person's data (synthetic in the demo), never a live bank read
      if (q.balance === 'spend') {
        const top = [...p.fixed].sort((a, b) => b.amount - a.amount)[0]
        const monthly = Math.round(e.fixedTotal + e.monthlyVarMedian)
        return { msgs: [jk(`თვეში ჩვეულებრივ ~${gel(r10(monthly))} გადის: ფიქსირებულ გადასახადებზე ${gel(e.fixedTotal)} (ყველაზე დიდი — ${top.name} ${gel(top.amount)}) და ყოველდღიურ ხარჯზე ~${gel(r10(e.monthlyVarMedian))}.`, ['ჩემი გადასახადები მაჩვენე', 'დღეს რამდენი შემიძლია?', 'რა არის 50/30/20 წესი?'], undefined, `დღეში ჩვეულებრივ ~${gel(Math.round(e.avgDaily))}-ს ხარჯავ. ვითვლი შენი ბოლო ${p.historyMonths} თვის მონაცემებით (დემოში — სინთეზური).`)], ctx, mood: 'calm' }
      }
      if (q.balance === 'now') {
        const f = landingNow()
        return day0
          ? { msgs: [jk(`შენს მონაცემებში ახლა ხელმისაწვდომია ${gel(e.spendable)}. ხელფასამდე სავარაუდოდ ${leftOrShort(f.p50)}.`, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'], undefined, 'დემოში ეს სინთეზური (გამოგონილი) ციფრია — შენს ბანკთან დაკავშირებული არ ვარ.' + (p.overdraft ? ` ოვერდრაფტი ამ თანხაში არ ითვლება.` : ''))], ctx, mood: 'calm' }
          : { msgs: [jk(`ზუსტ ნაშთს ბანკის აპი აჩვენებს — შენს ბანკთან დაკავშირებული არ ვარ. ხელფასამდე სავარაუდოდ ${leftOrShort(f.p50)}.`, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
      }
      // lending with no sum yet: the sum just named, if there is one
      if (q.lend && ctx.lend && ctx.amount) {
        const r = respondCore(`${ctx.amount} ლარი ვასესხო`, e, p, { ...ctx, kind: null }, demo)
        const t0 = `გადაწყვეტილება შენია — აი, ციფრები: ${r.msgs[0].text}`
        r.msgs[0] = withInfo({ ...r.msgs[0], text: t0.length <= 160 ? t0 : r.msgs[0].text.replace(/^თუ დღეს /, 'თუ ') }, joinInfo('რჩევას არ ვიძლევი: ვაჩვენებ, როგორ აისახება შენს თვეებზე, თუ თანხა დროზე არ დაგიბრუნდება.', (r.msgs[0] as JikhoMsg).info))
        return r
      }
      if (q.lend) return { msgs: [jk('რა თანხის სესხებაზე ფიქრობ? მომწერე — გაჩვენებ, როგორ აისახება ხელფასამდე, თუ ის დროზე არ დაგიბრუნდება.', ['მეგობარს 100 ლარი ვასესხო?', 'ხელფასამდე მეყოფა?'])], ctx, mood: 'calm' }
      // a salary raise: the usual month-end surplus grows by it (no new spending assumed)
      if (q.raise) {
        const ms = Math.round(e.medianSurplus)
        const x = q.amount
        // the sum is taken as take-home pay, and the ⓘ shows the same raise as gross (2% pension, then 20% income tax: × 0,784)
        const net = Math.round((x ?? 0) * 0.784)
        return x
          ? { msgs: [jk(`თუ ${gel(x)} ხელზე ასაღებს დაემატება და ხარჯი იგივე დარჩება, თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms) + x)} დაგრჩება (ახლა ~${gel(Math.max(0, ms))}).`, ['რამდენ ხანში დავაგროვებ 1000 ლარს?', 'რა არის 50/30/20 წესი?', 'დღეს რამდენი შემიძლია?'], undefined, /სტიპენდ|ფრილანს|ვშოულობ|გამოვიმუშავ|დამატებით|გვერდით/.test(lower) ? 'ვთვლი, რომ ეს თანხა ხელზე მოგივა და ხარჯი იგივე რჩება.' : `თუ ${gel(x)} დარიცხულ ხელფასს ემატება, ხელზე ~${gel(net)} მოვა (2% საპენსიო და 20% საშემოსავლო აკლდება) — თვის ბოლოს მაშინ ~${gel(Math.max(0, ms) + net)} დაგრჩება.`)], ctx: { kind: null }, mood: 'happy' }
          : { msgs: [jk(`მომწერე, რამდენით — გაჩვენებ, რამდენი დაგრჩება თვის ბოლოს. ახლა ჩვეულებრივ ~${gel(Math.max(0, ms))} გრჩება.`, ['ხელფასი 200 ლარით რომ გამეზარდოს?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
      }
      if (/საშემოსავლო|დარიცხულ|დარიცხვამდე|ბინძურ\S* ხელფას/.test(lower)) {
        // Georgian payroll: 2% pension, then 20% income tax on the rest, so take-home = 0.784 × gross
        const net = q.amount ?? p.salary, gross = net / 0.784
        return { msgs: [jk(`ხელზე ${gel(net)} ≈ დარიცხული ~${gel(Math.round(gross))}: აქედან 2% (${gel(Math.round(gross * 0.02))}) საპენსიოა, 20% (${gel(Math.round(gross * 0.98 * 0.2))}) — საშემოსავლო.`, ['ხელფასიდან 2% საპენსიოში სად მიდის?', 'დღეს რამდენი შემიძლია?'], undefined, `საშემოსავლო 20%-ია და საპენსიო შენატანის გამოკლების შემდეგ ითვლება. საპენსიოს გარეშე დარიცხული ~${gel(Math.round(net / 0.8))} იქნებოდა.`)], ctx, mood: 'calm' }
      }
      if (/საპენსიო|(?:^|[^ა-ჰ])პენსი/.test(lower)) {
        return { msgs: [jk('ეს დაგროვებითი პენსიაა: ხელფასის 2%-ს შენ იხდი, 2%-ს — დამსაქმებელი, სახელმწიფოც ამატებს. ფული შენს საპენსიო ანგარიშზე გროვდება.', ['რა არის ინფლაცია?', 'დღეს რამდენი შემიძლია?'], undefined, 'საპენსიო ანგარიშის ნაშთი საპენსიო სააგენტოს საიტზე ჩანს.')], ctx, mood: 'calm' }
      }
      if (/ვადაზე ადრე|ვადამდე (დაფარ|დავფარ)|წინსწრებ/.test(lower)) {
        // Civil Code art. 625(8) (2% cap) and NBG rule 32/04 art. 11 (in force since 1 Apr 2021; refinancing elsewhere 0,5% for contracts from 1 May 2025): matsne.gov.ge, nbg.gov.ge/en/faq/102
        return { msgs: [jk('ვადამდე დაფარვისას საკომისიო შეიძლება დაგეკისროს, მაგრამ კანონით ის დარჩენილი ძირის 2%-ს ვერ გადააჭარბებს; ხელშეკრულების ბოლო 6 თვეში კი არ ეკისრება.', ['რეფინანსირება რას ნიშნავს?', 'რა არის ეფექტური განაკვეთი?', 'გადახდა თუ დამიგვიანდა?'], undefined,
          'ბანკსა და მიკროსაფინანსოში ზღვარი დარჩენილ ვადაზეა დამოკიდებული: ფიქსირებულ განაკვეთზე 6–12 თვე — 0,5%, 12–24 თვე — 1%, 24 თვეზე მეტი — 2%. მაგალითად: 1 000 ₾ დარჩენილ ძირზე — მაქსიმუმ 20 ₾. იმავე ორგანიზაციაში რეფინანსირებისას საკომისიო არ ეკისრება, სხვაში — 0,5%-მდე (2025 წლის 1 მაისიდან). სამაგიეროდ, დარჩენილ თვეებზე პროცენტს აღარ იხდი.')], ctx, mood: 'calm' }
      }
      if (/ზედმეტს (ვყიდულობ|ვხარჯავ)|ემოციურ\S* (შოპინგ|ხარჯ|ყიდვ)|იმპულს/.test(lower)) {
        // the person's own number for today on the safe card, and one neutral fact
        const f = landingNow()
        const sf = safeOf(f), max = day0 ? e.maxComfortablePurchase() : sf.max
        const text = 'ეს ბევრს ემართება: ხელფასის დღეს ფული ბევრი ჩანს. ხშირად ასე იქცევიან: გადასახადსა და დანაზოგს ხელფასის დღესვე გადადებენ, შესყიდვამდე ერთ დღეს იცდიან.'
        return { msgs: [jkFit(text, ['დღეს რამდენი შემიძლია?', 'რა არის 50/30/20 წესი?', 'რა არის ანაბარი?'], daysLeft > 0 ? { kind: 'safe', data: { safe: sf.safe, max, avg: e.avgDaily, landing: f, cushion: e.cushion, daysLeft } } : undefined, `${daysLeft > 0 ? `დღეს ჩვეული ხარჯის გარდა ~${gel(sf.safe)} თავისუფალია. ` : ''}შესყიდვამდე „X ლარის რამე ვიყიდო?" შეკითხვა გაჩვენებს, როგორ შეიცვლება ხელფასამდე ამინდი.`)], ctx: { ...ctx, topic: 'safe', topicQ: undefined }, mood: 'calm' }
      }
      // "ბანკში რა საბუთები წავიღო?" with no debt answer before it: what lenders usually ask for
      if (q.docs) return { msgs: [jk('სესხის ან ახალი გრაფიკის მოთხოვნისას ხშირად ითხოვენ პირადობის მოწმობას და შემოსავლის საბუთს — ხელფასის ცნობას ან ანგარიშის ამონაწერს.', ['როგორ ვთხოვო გადავადება?', 'რა არის PTI?', 'რა არის საკრედიტო ისტორია?'], undefined, 'ზუსტ სიას გამსესხებელი ადგენს. შეღავათის თხოვნისას ხშირად მიზეზის დამადასტურებელსაც ითხოვენ — მაგ. ცნობას სამსახურიდან ან ექიმისგან.')], ctx, mood: 'calm' }
      // state help when out of work: said with care, without a claim Jikho cannot check
      if (q.welfare) return { msgs: [jk('სოციალურ პროგრამებს ვერ ვამოწმებ. ოჯახის სარეიტინგო ქულაზე დამოკიდებულ საარსებო შემწეობას სოციალური მომსახურების სააგენტო განიხილავს.', ['რა მოხდება სამსახური რომ დავკარგო?', 'ჩემი გადასახადები მაჩვენე', 'როგორ ვთხოვო გადავადება?'], undefined, 'შემიძლია გაჩვენო, ანგარიშზე არსებული თანხა და დანაზოგი ჩვეული ხარჯით რამდენ დღეს გეყოფა.')], ctx, mood: 'calm' }
      // a clear off-topic request: said honestly ("I cannot help with that"), never "I did not understand"; asked again, other words
      if (q.offTopic) {
        const said = ctx.said ?? []
        const lines: Record<NonNullable<Parsed['offTopic']>, string[]> = {
          food: ['რეცეპტებში ვერ დაგეხმარები 🐐 — ფულის კითხვებზე ვპასუხობ: მაგალითად, რამდენი შემიძლია დღეს დავხარჯო.', 'სამზარეულოში ვერ გამოგადგები 🐐, ბიუჯეტში კი — კი: პროდუქტების ხარჯსაც დაგითვლი.'],
          sport: ['სპორტის შედეგებს ვერ ვხედავ 🐐 — მე ფულის კითხვებში გეხმარები: შესყიდვა, განვადება, სესხი, დღის ბიუჯეტი.', 'მატჩებს ვერ ვადევნებ თვალს 🐐 — ბილეთის ან ფორმის ფასს კი შენს თვეებზე დაგითვლი.'],
          joke: ['ერთი ფულის ხუმრობა: ჯიხვმა ხელფასამდე ბიუჯეტი დაგეგმა და მთის წვერზე ზღვარით ავიდა 🐐 შენი ბიუჯეტიც შევამოწმოთ?', 'ანეკდოტებში სუსტი ვარ 🐐, ციფრებში — ძლიერი. რამე შევამოწმოთ?'],
          rude: ['გასაგებია 🙂 როცა მოგინდება, ფულის კითხვებზე აქ ვარ.', 'კარგი 🙂 ფულის კითხვა თუ გაგიჩნდება, აქ ვარ.'],
          other: ['ამაში ვერ დაგეხმარები 🐐 — ფულის კითხვებზე ვპასუხობ: შესყიდვა, განვადება, სესხი, დღის ბიუჯეტი.', 'ეს ჩემი თემა არ არის 🐐 — ფულზე კი ნებისმიერი კითხვა დამიწერე.'],
        }
        const list = lines[q.offTopic]
        const text = list.find(t => !said.includes(t)) ?? list[0]
        return { msgs: [jk(isSupport(p) ? text.replace(/ 🐐|🙂 ?/g, '').replace(/\s+—/, ' —').trim() : text, isSupport(p) ? SUPPORT_CHIPS.slice(0, 3) : MENU)], ctx, mood: isSupport(p) ? 'calm' : 'happy' }
      }
      // right after self-harm or distress wording, anything unclear gets the same calm reply, never the cheerful fallback
      if (ctx.topic === 'selfharm' || ctx.topic === 'distress') return { msgs: [distressReply(ctx.topic === 'selfharm')], ctx, mood: 'calm' }
      // a money question, or any "what is X?", without a card yet: say so honestly, instead of "I did not understand"
      if (/ბანკ|ფულ|ლარ|სესხ|(?:^|[^ა-ჰ])ვალ|დაზღვ|გადასახად|ხელფას|ბარათ|პროცენტ|ბიუჯეტ|დაზოგ|ანაბ|პენსი|იპოთეკ|ლომბარდ|ქეშბექ|cashback|კრედიტ|ფონდ|ვალუტ|დოლარ|ფინანს|სტიპენდ/.test(lower) || /რა არის|რას ნიშნავს|რა განსხვავებაა|რით განსხვავდება/.test(lower)) {
        const said = ctx.said ?? []
        const lines = ['ამ კითხვაზე ზუსტი პასუხი ჯერ არ მაქვს. შემიძლია გაჩვენო, როგორ იმოქმედებს ხარჯი, განვადება ან სესხი შენს თვეებზე.', 'ამაზე ზუსტ პასუხს ვერ გეტყვი. სამაგიეროდ, შენი ციფრებით ვაჩვენებ, რა დაგრჩება ხელფასამდე ან რა დაჯდება სესხი.']
        return { msgs: [jk(lines.find(t => !said.includes(t)) ?? lines[0], isSupport(p) ? SUPPORT_CHIPS.slice(0, 3) : LEARN_MENU, undefined, 'ფინანსურ თემებზე მეტი: finedu.gov.ge')], ctx, mood: isSupport(p) ? 'calm' : 'thinking' }
      }
      if (isSupport(p) || care) return { msgs: [jk('ეგ ჯერ ვერ გავიგე. მკითხე ხელფასამდე ბიუჯეტზე, გადასახადებზე ან სესხის დაფარვაზე.', care ? CARE_CHIPS : [])], ctx, mood: 'calm' }
      // asked again, the fallback changes its words
      const fallbacks = ['ეგ ჯერ ვერ გავიგე 🐐 ფინანსებზე მკითხე — შესყიდვაზე, განვადებაზე, სესხზე ან დღის ბიუჯეტზე.', 'ამ კითხვას ვერ ვკითხულობ 🐐 თანხით უკეთ გავიგებ, მაგალითად: „200 ლარის ქურთუკი ვიყიდო?"', 'ვერ მივხვდი 🐐 ქვემოთ რამდენიმე კითხვაა, რაზეც ზუსტად გიპასუხებ.']
      return { msgs: [jk(fallbacks.find(t => !(ctx.said ?? []).includes(t)) ?? fallbacks[0], MENU)], ctx, mood: 'thinking' }
    }
  }

  function respondInstallment(c: Ctx, kind: 'installment' | 'loan', opts: InstOpts = {}): Reply {
    const msgs = installmentAnswer(e, p, c, kind, opts)
    const rows = msgs[0].card!.data.rows as { nShort: number }[]
    const allShort = rows.every(r => r.nShort > 0)
    return { msgs, ctx: { ...c, kind, topic: undefined, topicQ: undefined, lastExplain: undefined }, mood: allShort ? 'worried' : 'happy' }
  }

  function afterPaydayReply(amount: number, item?: string, when?: string): Reply {
    if (payday) return paydayPurchase(amount, item)
    const after = nextPay(amount)
    const left = after >= 0
      ? `შემდეგ ხელფასამდე სავარაუდოდ ~${gel(r10(after))} დაგრჩება — ${after >= e.cushion ? 'ზღვარს ზემოთ' : 'მაინც მჭიდროდ'}`
      : `შემდეგ ხელფასამდე სავარაუდოდ ~${gel(Math.max(5, rs(-after)))} დაგაკლდება`
    const info = `ვითვლი ასე: ხელფასის დღის ნაშთი + ხელფასი − ფიქსირებული გადასახადები (${gel(e.fixedTotal)}) − ჩვეული თვიური ხარჯი − ${gel(amount)}. ${cushionInfo(e, p)}`
    // a named day after payday ("შაბათს", payday is on Thursday): the salary has landed by then
    const lead = when ? `${when} ხელფასი უკვე ჩარიცხული იქნება: თუ ${gel(amount)}-ს მაშინ დახარჯავ,` : `თუ ${gel(amount)}-ს ხელფასის აღების შემდეგ დახარჯავ,`
    return { msgs: [jk(`${lead} მომდევნო ${left.replace(/^შემდეგ /, '')}.`, ['მარტივად ამიხსენი', 'დღეს რამდენი შემიძლია?', 'ხელფასამდე მეყოფა?'], undefined, info)], ctx: { kind: 'purchase', amount, item, afterPayday: true }, mood: after >= e.cushion ? 'happy' : 'calm' }
  }

  /** payday: the salary lands today, so a spend is counted against the next payday (the after-payday branch, from today's balance) */
  function paydayPurchase(amount: number, item?: string, kind: 'buy' | 'bill' | 'spent' | 'lend' | 'lent' = 'buy'): Reply {
    const after = nextPay(amount)
    const a = gel(amount, amount % 1 ? 2 : 0)
    const verb = kind === 'bill' ? `${a}-ის გადახდის შემდეგ` : kind === 'spent' ? `${a}-ის ხარჯის შემდეგ` : kind === 'lend' || kind === 'lent' ? `თუ ${a} არ დაგიბრუნდება,` : `თუ დღეს ${a}-ს დახარჯავ,`
    const left = after >= 0 ? `~${gel(rs(after))} დაგრჩება — ${after >= e.cushion ? 'ზღვარს ზემოთ' : `ზღვარზე (${gel(e.cushion)}) ნაკლები`}` : `~${gel(Math.max(5, rs(-after)))} დაგაკლდება`
    const text = `ხელფასი დღესაა: ${verb} მომდევნო ხელფასამდე (${nextPaydayWord}) სავარაუდოდ ${left}.`
    return { msgs: [jkFit(text, ['მარტივად ამიხსენი', 'დღეს რამდენი შემიძლია?', 'ჩემი გადასახადები მაჩვენე'], undefined, joinInfo(nextPayInfo(amount), cushionInfo(e, p)))], ctx: { kind: 'purchase', amount, item, afterPayday: true }, mood: after >= e.cushion ? 'happy' : 'calm' }
  }

  /** "ხელფასამდე მეყოფა?" right after a spend: the forecast with that spend, and without it for comparison */
  function forecastWithSpend(amount: number, item?: string): Reply {
    const days = Math.max(1, daysLeft)
    const a = gel(amount, amount % 1 ? 2 : 0)
    // a cash spend leaves the card forecast as it is; the cash left is said next to it
    if (ctx.onHand !== undefined && ctx.cash) {
      const f = landingNow()
      const text = `ბარათზე ხელფასამდე სავარაუდოდ ${leftOrShort(f.p50)} — ამინდი ${WEATHER_LABEL[f.weather as keyof typeof WEATHER_LABEL]}ა ${WEATHER_ICON[f.weather as keyof typeof WEATHER_ICON]}. ხელზე ${a}-ის შემდეგ ${gel(Math.max(0, Math.round(ctx.onHand - amount)))} რჩება.`
      return { msgs: [jk(text, ['დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი', 'ჩემი გადასახადები მაჩვენე'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: f } }, cushionInfo(e, p))], ctx, mood: f.weather === 'sun' || f.weather === 'cloud' ? 'happy' : 'calm' }
    }
    if (ctx.onHand !== undefined) {
      // counted from the money the person named
      const avg = Math.round(e.avgDaily), need = Math.round(e.avgDaily * days)
      const rest = Math.round(ctx.onHand - amount - dueSum())
      const text = rest <= 0
        ? `${gel(ctx.onHand)}-დან ${a}-ის${dueSum() ? ' და გადასახადების' : ''} შემდეგ ხელფასამდე ფული აღარ რჩება: ~${gel(Math.max(5, r5(-rest)))} აკლია, ყოველდღიური ხარჯის გარეშეც.`
        : `ჩვეული ხარჯით ${days} დღეს ~${gel(need)} სჭირდება, ${a}-ის შემდეგ კი ~${gel(rest)} რჩება — ${rest >= need ? 'სავარაუდოდ გეყოფა' : `~${gel(need - rest)} აკლია`}.`
      return { msgs: [jk(text, ['დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი', 'ჩემი გადასახადები მაჩვენე'], undefined, `შენი ჩვეული დღიური ხარჯი ~${gel(avg)}-ია. ვითვლი შენ მიერ დასახელებული ${gel(ctx.onHand)}-ით.`)], ctx, mood: 'calm' }
    }
    const msgs = purchaseAnswer(e, p, amount, item, day0 ? undefined : landingNow(), day0, demo.extra, dayIdx, 'buy', { bal: balNow() })
    const r = msgs[0].card!.data.r, base = landingNow()
    const withIt = r.p50 > 0 ? `სავარაუდოდ ~${fmt(r5(r.p50))} ₾ დაგრჩება` : `სავარაუდოდ ~${fmt(Math.max(5, r5(-r.p50)))} ₾ დაგაკლდება`
    const text = `${a}-ის ხარჯით ხელფასამდე (${days} დღე) ${withIt} — ამინდი ${WEATHER_LABEL[r.weather as keyof typeof WEATHER_LABEL]}ა ${WEATHER_ICON[r.weather as keyof typeof WEATHER_ICON]}. მის გარეშე — ~${fmt(rs(base.p50))} ₾.`
    msgs[0] = { ...msgs[0], text, chips: ['ხელფასის შემდეგ რომ ვიყიდო?', 'დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი'] }
    return { msgs, ctx, mood: r.weather === 'sun' || r.weather === 'cloud' ? 'happy' : 'worried' }
  }

  /** saving up on a deposit: the goal and the monthly sum already on the table, with an example yearly rate unless one is named */
  function depositPlan(goal: number, per0?: number, rateYear?: number): Reply {
    const ms = Math.round(e.medianSurplus)
    const per = per0 ?? ms
    const cc = CONCEPT_TEXT.deposit(e, p, q, ctx)
    const card = (mine: string): ChatCard => ({ kind: 'concept', data: { title: cc.title, body: cc.body, more: cc.more, mine, rule: cc.rule } })
    if (per <= 0) return { msgs: [jk(`ანაბარი სარგებელს მაშინ მოიტანს, როცა ფული ყოველთვე იდება — ახლა კი თვის ბოლოს ჩვეულებრივ არაფერი გრჩება.`, ['ჩემი გადასახადები მაჩვენე', 'რა არის ანაბარი?'], card(billsLine(e, p)))], ctx, mood: 'calm' }
    const n = Math.ceil(goal / per)
    const rate = rateYear ?? 0.1
    // each monthly deposit earns interest for the months it stays: per × rate/12 × (n−1 + … + 1 + 0)
    const interest = per * rate / 12 * n * (n - 1) / 2
    const rateShown = `${fmt(rate * 100, (rate * 100) % 1 ? 1 : 0)}%`
    const gain = interest >= 1 ? `${rateYear === undefined ? 'სამაგალითო ' : ''}წლიური ${rateShown}-ით ზემოდან ~${gel(Math.round(interest))} სარგებელიც დაემატება` : 'ვადა მოკლეა, ამიტომ სარგებელი 1 ₾-ზე ნაკლები იქნება'
    const text = `თვეში ${gel(per)}-ის ანაბარზე გადადებით ${gel(goal)} ${n} თვეში დაგროვდება — ${gain}.`
    const info = joinInfo(rateYear === undefined ? 'განაკვეთი სამაგალითოა: მომწერე ბანკის შეთავაზებული წლიური განაკვეთი, მაგ. „12%-ით?" — გადავითვლი.' : undefined, 'ვთვლი, რომ ყოველ შენატანს პროცენტი იმ თვეებზე ერიცხება, რამდენიც ანაბარზე რჩება. ბანკსა და მიკრობანკში სარგებელი ფიზიკური პირისთვის არ იბეგრება.')
    return { msgs: [jk(text, ['და 12%-ით?', 'რა არის ინფლაცია?', 'რა არის გადაუდებელი ფონდი?'], card(`${gel(per)} × ${n} თვე → ${gel(per * n)}; სარგებელი ~${gel(Math.round(interest))} (${rateShown}).`), info)], ctx: { kind: 'save', amount: goal, perMonth: per0, item: ctx.item, rateYear: rate, topic: undefined }, mood: 'calm' }
  }

  /** a monthly sum put on a deposit for n months: what is paid in, the interest (each deposit earns for the months it stays), and the total */
  function depositSeries(per: number, rateYear: number | undefined, n: number): Reply {
    const rate = rateYear ?? 0.1
    const interest = per * rate / 12 * n * (n - 1) / 2
    const rateShown = `${fmt(rate * 100, (rate * 100) % 1 ? 1 : 0)}%`
    const span = n % 12 === 0 ? `${n / 12 === 1 ? 'წელიწადში' : `${n / 12} წელიწადში`}` : `${n} თვეში`
    const ms = Math.round(e.medianSurplus)
    const text = `თვეში ${gel(per)} ${rateYear === undefined ? 'სამაგალითო ' : ''}წლიური ${rateShown}-ით: ${span} ${gel(per * n)} შენატანი + ~${gel(Math.round(interest))} სარგებელი ≈ ~${gel(Math.round(per * n + interest))}.`
    const info = joinInfo(rateYear === undefined ? 'განაკვეთი სამაგალითოა: მომწერე ბანკის შეთავაზებული წლიური განაკვეთი — გადავითვლი.' : undefined, 'ვთვლი, რომ ყოველ შენატანს პროცენტი იმ თვეებზე ერიცხება, რამდენიც ანაბარზე რჩება. ბანკსა და მიკრობანკში სარგებელი ფიზიკური პირისთვის არ იბეგრება.', ms > 0 ? `შენთან თვის ბოლოს ჩვეულებრივ ~${gel(ms)} რჩება${per > ms ? ` — ${gel(per)} ამაზე მეტია` : ` — ${gel(per)} ამაში ეტევა`}.` : undefined)
    const cc = CONCEPT_TEXT.deposit(e, p, q, ctx)
    const card: ChatCard = { kind: 'concept', data: { title: cc.title, body: cc.body, more: cc.more, mine: `${gel(per)} × ${n} თვე → ${gel(per * n)}; სარგებელი ~${gel(Math.round(interest))} (${rateShown}).`, rule: cc.rule } }
    return { msgs: [jkFit(text, ['ინფლაცია 4% რომ იყოს?', 'რა არის რთული პროცენტი?', 'რა არის ინფლაცია?'], card, info)], ctx: { kind: 'save', perMonth: per, rateYear: rate, months: n, topic: undefined }, mood: 'calm' }
  }

  /** "30 ოქტომბერი": an SMS dated before the demo's today is noted (the demo data start on its own date) */
  function smsDateNote(dm: string): string | undefined {
    const [d, m] = dm.split('.').map(Number)
    const today = Number((p.todayLabel.match(/\d+/) ?? ['2'])[0]) + dayIdx
    const before = m < 11 || (m === 11 && d < today)
    return before ? `SMS-ზე თარიღია ${dateText(dm)}, დემოს „დღეს" კი ${today} ნოემბერია — დემოს მონაცემები სინთეზურია.` : undefined
  }

  /** a pasted bank SMS with its own balance: Jikho counts from the numbers pasted, it never reads the bank */
  function smsReply(have: number, amount: number, date?: string): Reply {
    const days = Math.max(1, daysLeft)
    const avg = Math.round(e.avgDaily)
    const due = dueSum()
    const rest = Math.round(have - due)
    const per = Math.round(Math.max(0, rest) / days)
    const h = gel(have, have % 1 ? 2 : 0)
    const text = rest > 0
      ? `SMS-ის ნაშთით (${h}) გადასახადების (~${gel(due)}) შემდეგ ~${gel(rest)} რჩება: ${days} დღეზე დღეში ~${gel(per)}, ჩვეულებრივ კი ~${gel(avg)}-ს ხარჯავ.`
      : `SMS-ის ნაშთი (${h}) ხელფასამდე გადასახდელს (~${gel(due)}) ვერ ფარავს: ~${gel(Math.max(5, r5(-rest)))} აკლია.`
    const info = joinInfo(`ჯიხო ბანკის SMS-ებს თავად ვერ ხედავს — ვითვლი მხოლოდ იმას, რაც აქ ჩასვი (ხარჯი ${gel(amount, amount % 1 ? 2 : 0)}, ნაშთი ${h}). დემოს მონაცემებში ნაშთი ${gel(e.spendable)}-ია.`, date ? smsDateNote(date) : undefined, due ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined)
    return { msgs: [jkFit(text, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი'], undefined, info)], ctx: { kind: null, onHand: have }, mood: 'calm' }
  }

  /** support mode: food, school, a child's clothes are basic needs; the answer shows what covers them and when the salary lands */
  function neededReply(amount: number, item: string | undefined, onHand?: number, afterWhen?: string): Reply {
    const a = gel(amount, amount % 1 ? 2 : 0)
    const avg = Math.round(e.avgDaily)
    const chips = ['ჩემი გადასახადები მაჩვენე', 'ხელფასამდე მეყოფა?', 'როცა ვალს ვერ ვიხდი']
    const nctx: Ctx = { kind: 'purchase', amount, item, onHand }
    // a day named after payday ("შაბათს", payday is Thursday): the salary has landed by then
    if (afterWhen) return { msgs: [jk(`${afterWhen} ხელფასი (${gel(p.salary)}) უკვე ჩარიცხული იქნება — ${a} ხელფასიდან დაიფარება.`, chips, undefined, nextPayInfo(amount))], ctx: { ...nctx, afterPayday: true }, mood: 'calm' }
    const food = /პურ|რძე|რძის|საკვებ|საჭმელ|პროდუქტ|კვერცხ/.test(lower)
    // groceries the size of a usual day are already in the forecast
    if (food && amount <= avg * 2 && !/არ მყოფნის|ვერ მყოფნის|არ მაქვს|აღარ მაქვს|ვერ ვყიდულობ|მჭიდრო|არ მეყოფა/.test(lower)) {
      // groceries are already part of the usual spending (never "15 ₾ is part of 13 ₾")
      const text = payday ? `ხელფასი დღესაა: საკვები შენი ჩვეული ხარჯის ნაწილია და ${a} დღევანდელი ხელფასიდან იფარება.` : `საკვები შენი ჩვეული ხარჯის ნაწილია: დღეში ჩვეულებრივ ~${gel(avg)}-ს ხარჯავ და ის პროგნოზში უკვე ითვლება.`
      return { msgs: [jk(text, chips, undefined, payday ? `ჩვეული დღიური ხარჯი ~${gel(avg)}-ია — საკვები მასში უკვე ითვლება. ${nextPay() < 0 ? `ამ თვის სრულ სურათს „ჩემი გადასახადები" აჩვენებს.` : ''}`.trim() : cushionInfo(e, p))], ctx: nctx, mood: 'calm' }
    }
    // payday: covered by today's salary, and the month's picture with it and without it
    if (payday) {
      const nx = nextPay(amount), nx0 = nextPay()
      const tail = nx < 0 ? ` გადასახადებისა და ჩვეული ხარჯის შემდეგ თვე ~${gel(Math.max(5, rs(-nx)))}-ით მჭიდროა${nx0 < 0 ? `, ${a}-ის გარეშეც ~${gel(Math.max(5, rs(-nx0)))}-ით` : ''}.` : ` გადასახადებისა და ჩვეული ხარჯის შემდეგ მომდევნო ხელფასამდე ~${gel(rs(nx))} დარჩება.`
      const t0 = `ხელფასი დღესაა — ${a} ხელფასიდან (${gel(p.salary)}) იფარება.`
      return { msgs: [jk(`${t0}${tail}`.length <= 160 ? `${t0}${tail}` : t0, chips, undefined, nextPayInfo(amount))], ctx: nctx, mood: 'calm' }
    }
    const have = onHand ?? balNow()
    // the bills still due before payday come out of the money there is (the named sum or today's balance)
    const due = dueSum()
    const free = Math.round(have - due)
    const when = `ხელფასი ${daysLeft} დღეში, ${dative(p.paydayLabel).split(', ')[1] ?? ''} ჩაირიცხება`
    const text = free >= amount
      ? `ეს აუცილებელი ხარჯია: ${gel(have)}-დან${due ? ` გადასახადების (~${gel(due)}) და` : ''} მის შემდეგ ~${gel(free - amount)} დარჩება. ${when}.`
      : `ეს აუცილებელი ხარჯია. ახლა ${due ? `გადასახადების შემდეგ ~${gel(Math.max(0, free))}` : gel(have)} გაქვს — ~${gel(Math.ceil(amount - Math.max(0, free)))} აკლია; ${when}.`
    const info = joinInfo(due ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined, free < amount ? `ხელფასის დღიდან ${a} ხელფასიდან დაიფარება.` : undefined, 'თვის სრულ სურათს „ჩემი გადასახადები" აჩვენებს.')
    return { msgs: [jkFit(text, chips, undefined, info)], ctx: nctx, mood: 'calm' }
  }

  /** a sum far beyond any month's budget ("99 999 999 ლარის სახლი"): its scale, and fitting next steps */
  function hugeReply(amount: number): Reply {
    const years = amount / (p.salary * 12)
    const y = years >= 10 ? fmt(Math.round(years)) : fmt(years, 1)
    const home = /სახლ|ბინ(?:ა|ის|ას)|იპოთეკ|მიწ|აგარაკ/.test(lower)
    const text = `${gel(amount)} შენი ~${y} წლის ხელფასია — ასეთ თანხას ხელფასამდე ბიუჯეტით ვერ შევაფასებ.`
    const info = home ? 'ბინის ან სახლის ყიდვა ჩვეულებრივ იპოთეკით ხდება: გრძელვადიანი სესხით, ქონების გირაოთი.' : 'დიდი შესყიდვისთვის მნიშვნელოვანია, რამდენ ხანში დაგროვდება თანხა და რა დაჯდება სესხით.'
    return { msgs: [jk(text, home ? ['რა არის იპოთეკა?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?', 'დღეს რამდენი შემიძლია?'] : ['რამდენ ხანში დავაგროვებ 1000 ლარს?', 'რა არის ანაბარი?', 'დღეს რამდენი შემიძლია?'], undefined, info)], ctx: { kind: null }, mood: 'calm' }
  }

  /** "should I?": Jikho gives no yes or no; it shows what the choice rests on, with the numbers already on the table */
  function decide(): Reply {
    const lead = 'გადაწყვეტილება შენია — აი, ციფრები'
    const info = 'რჩევას არ ვიძლევი: ვაჩვენებ, როგორ აისახება არჩევანი შენს თვეებზე.'
    // "12 თვე ჯობია თუ 24?": both terms on one card, for the deal on the table or the sum just named
    if (q.compareMonths && (isDeal(ctx) || q.amount !== undefined)) {
      const kind: 'installment' | 'loan' = isDeal(ctx) && q.amount === undefined ? ctx.kind : q.item || /განვადებ|ვიყიდ/.test(lower) ? 'installment' : /სესხ|კრედიტ/.test(lower) ? 'loan' : isDeal(ctx) ? ctx.kind : 'installment'
      const base: Ctx = isDeal(ctx) && q.amount === undefined ? ctx : { kind, amount: q.amount, item: q.item, ratePerMonth: rateFrom(q), rateText: rateTxt(q) }
      const c: Ctx = { ...base, kind, months: undefined, tenors: q.compareMonths }
      const r = respondInstallment(c, kind, { followup: true })
      const rows = r.msgs[0].card!.data.rows as { monthly: number; total: number; months: number }[]
      const text = `${lead}: ${rows.map(x => `${x.months} თვით ~${gel(Math.round(x.monthly))}/თვე, ჯამში ${gel(x.total)}`).join('; ')} 👇`
      const [head, rest] = fit(text)
      r.msgs[0] = withInfo({ ...r.msgs[0], text: head, chips: ['რატომ?', 'რა არის ეფექტური განაკვეთი?', 'დღეს რამდენი შემიძლია?'] }, joinInfo(rest, info))
      return { ...r, ctx: { ...base, kind, tenors: undefined }, mood: 'calm' }
    }
    if (isDeal(ctx)) {
      const r = respondInstallment(ctx, ctx.kind, { followup: true })
      // "რომელი ჯობია?" with a cash price named: both ways of paying side by side
      if (ctx.cashPrice && !q.costly) {
        const d = buildDeal(e, p, ctx, ctx.kind), t1 = d.rows[0], bal = Math.round(balNow())
        const text = `${lead}: ნაღდად ${gel(ctx.cashPrice)} ერთბაშად${bal < ctx.cashPrice ? ` (ნაშთი ${gel(bal)}-ია)` : ''}; განვადებით ჯამში ${gel(t1.total + d.upfront)} — თვეში ~${gel(Math.round(t1.monthly))}, ${t1.months} თვე.`
        r.msgs[0] = withInfo({ ...r.msgs[0], text: fit(text)[0] }, joinInfo(fit(text)[1], `სხვაობა ${gel(t1.total + d.upfront - ctx.cashPrice)} განვადების ფასია. ${(() => { const n = e.monthsToSave(ctx.cashPrice!); return Number.isFinite(n) && n <= 36 ? `ნაღდი ფასი დაზოგვით ~${n} თვეში დაგროვდება.` : '' })()}`, info))
        return r
      }
      const rows = r.msgs[0].card!.data.rows as { monthly: number; total: number; nShort: number; window: unknown[]; months: number; cost: number; eir: number; pti: number }[]
      const t = rows[0]
      // "ეს ჩემთვის ძვირია?" after the numbers were shown: other views of "expensive" (its share of the sum, the rate against the legal cap, PTI against the limit)
      if (q.costly && rows.length === 1 && /ხელფას|შემოსავ/.test(lower)) {
        const ms = Math.round(e.medianSurplus), m = Math.round(t.monthly)
        const text = `${lead}: თვეში ~${gel(m)} ხელფასის ~${Math.round(m / p.salary * 100)}%-ია${ms > 0 ? ` და ჩვეული თვიური ნაშთის (~${gel(ms)}) ~${Math.round(m / ms * 100)}%` : ''}; ${monthsPhrase(t)}.`
        r.msgs[0] = withInfo({ ...r.msgs[0], text: fit(text)[0] }, joinInfo(fit(text)[1], `ჯამში ${gel(t.total)}, სესხის ფასი ${gel(t.cost)}.`, info))
        return r
      }
      if (q.costly && rows.length === 1 && t.cost === 0) {
        const d = buildDeal(e, p, ctx, ctx.kind)
        const text = `${lead}: პროცენტი არ ემატება — ჯამში ${gel(t.total + d.upfront)}${d.upfront ? ` (${gel(d.upfront)} წინასწარის ჩათვლით)` : ''}. თუ ნაღდი ფასი ნაკლებია, სხვაობა განვადების ფარული ფასია.`
        r.msgs[0] = withInfo({ ...r.msgs[0], text: fit(text)[0] }, joinInfo(fit(text)[1], `თვეში ~${gel(Math.round(t.monthly))}, ${monthsPhrase(t)}. ${info}`))
        return r
      }
      if (q.costly && rows.length === 1 && t.cost > 0) {
        const d = buildDeal(e, p, ctx, ctx.kind)
        const share = Math.round(t.cost / (d.price - d.upfront) * 100)
        const lim = ptiLimitAt(p, d.start)
        const text = `${lead}: ჯამში ${gel(t.total)}, აქედან სესხის ფასი ${gel(t.cost)} — თანხის ~${share}%. ეფექტური ~${fmt(t.eir, 1)}% (ზღვარი 50%), PTI ${pctText(t.pti)}% (ლიმიტი ${lim}%).`
        const alt = t.months >= 24 ? buildDeal(e, p, { ...ctx, months: t.months - 12 }, ctx.kind).rows[0] : undefined
        r.msgs[0] = withInfo({ ...r.msgs[0], text: fit(text)[0] }, joinInfo(fit(text)[1], alt ? `${alt.months} თვით სესხის ფასი ${gel(alt.cost)} იქნებოდა, თვეში ~${gel(Math.round(alt.monthly))}.` : undefined, info))
        return r
      }
      const text = rows.length === 1 ? `${lead}: თვეში ~${gel(Math.round(t.monthly))}, ჯამში ${gel(t.total)}, ${monthsPhrase(t)} 👇` : `${lead}: ${rows.length} ვარიანტი შენს თვეებზე 👇`
      r.msgs[0] = withInfo({ ...r.msgs[0], text }, info)
      return r
    }
    // not "interest is always added": a 0% installment exists (its cost can sit in the price)
    if (/თუ (?:დავზოგო|დავაგროვო|დავიცადო)/.test(lower)) return { msgs: [jk('განვადებით ნივთს ახლავე იღებ, მაგრამ ხშირად პროცენტი ან საკომისიო ემატება (0%-იანზე ხარჯი შეიძლება ფასში იყოს); დაზოგვით — მოგვიანებით, ზედმეტი ფასის გარეშე.', ['1 200 ₾-ის ტელეფონი განვადებით', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'], undefined, `მომწერე ფასი — ორივეს შენს თვეებზე გაჩვენებ. ${info}`)], ctx, mood: 'calm' }
    // "რა ვქნა?" on a spend counted from named money, or after payday: the options with those numbers
    if (ctx.kind === 'purchase' && ctx.amount && (ctx.onHand !== undefined || ctx.afterPayday || payday)) return explainReply('steps')
    // "რა ვქნა?" after "30 ლარი დამრჩა": the options with that money
    if (ctx.onHand !== undefined && ctx.kind !== 'purchase' && !ctx.topic) return explainReply('steps')
    if (ctx.kind === 'purchase' && ctx.amount) {
      const msgs = purchaseAnswer(e, p, ctx.amount, ctx.item, day0 ? undefined : landingNow(), day0, demo.extra, dayIdx, 'buy', { bal: balNow() })
      const pr = msgs[0].card!.data.r
      const left = pr.p50 > 0 ? `ხელფასის დღეს ~${fmt(r5(pr.p50))} ₾ დაგრჩება` : `ხელფასამდე ~${fmt(Math.max(5, r5(-pr.p50)))} ₾ დაგაკლდება`
      msgs[0] = withInfo({ ...msgs[0], text: `${lead}: ${gel(ctx.amount)}-ის შემდეგ ${left} 👇` }, info)
      return { msgs, ctx, mood: 'calm' }
    }
    if (ctx.topic === 'distress' || ctx.topic === 'selfharm') return { msgs: [distressReply(ctx.topic === 'selfharm')], ctx, mood: 'calm' }
    // a bare "რა ვქნა?" after a topic (debts, a late payment, a scam, the forecast): the options as steps, never the same answer again
    if (ctx.topic && /^\s*(ახლა |მერე |და |მაშ |აბა )?რა (ვქნა|ვაკეთო|გავაკეთო)[\s?!.]*$|რა გზა მაქვს|რა გამოსავალი/.test(lower)) return explainReply('steps')
    // otherwise it stays on the question that opened the topic (calls from collectors, a court case, ...)
    const topicQ = ctx.topicQ ? parse(ctx.topicQ) : q
    if (ctx.topic === 'restructure') return { msgs: [conceptReply('restructure', ctx, topicQ)], ctx, mood: 'calm' }
    if (ctx.topic === 'gambling') return { msgs: [conceptReply('gambling', ctx, topicQ)], ctx, mood: 'calm' }
    return { msgs: [jk('გადაწყვეტილება შენია — მე ციფრებს გაჩვენებ. მომწერე თანხა და ვადა, მაგ.: „1 200 ლარის ტელეფონი 12 თვით".', MENU, undefined, info)], ctx, mood: 'calm' }
  }

  /** "ჯამში რამდენს გადავიხდი?", "თვეში რამდენი გამოვა?", "პროცენტი რამდენია?": answered from the deal on the table, with its card */
  function totalReply(ask: NonNullable<Parsed['ask']>): Reply {
    if (isDeal(ctx)) {
      const d = buildDeal(e, p, ctx, ctx.kind)
      const r = respondInstallment(ctx, ctx.kind, { followup: true })
      const rows = d.rows
      const t = rows[0]
      let text: string, info: string | undefined
      if (ask === 'monthly') {
        text = rows.length === 1 ? `${d.what}: თვეში ~${gel(Math.round(t.monthly))}, ${t.months} თვე 👇` : `თვეში: ${rows.map(x => `${x.months} თვით ~${gel(Math.round(x.monthly))}`).join(', ')} 👇`
      } else if (ask === 'rate') {
        const paid = rows.find(x => x.ratePerMonth > 0)
        if (!paid) text = `ეს 0%-იანი განვადებაა: პროცენტი არ ემატება, ჯამი ${gel(t.total)}-ია 👇`
        else if (rows.length === 1) text = `განაკვეთი ${d.rateTxt}${d.isExampleRate ? ' (სამაგალითო)' : ''} — ეფექტური წლიური ~${fmt(paid.eirPct, 1)}%. ${t.months} თვეში პროცენტში ${gel(t.cost)}-ს გადაიხდი 👇`
        else text = `განაკვეთი ${d.rateTxt}${d.isExampleRate ? ' (სამაგალითო)' : ''}, ეფექტური ~${fmt(paid.eirPct, 1)}%. პროცენტში: ${rows.map(x => `${x.months} თვით ${gel(x.cost)}`).join(', ')} 👇`
        info = d.isExampleRate ? 'ეს სამაგალითო განაკვეთია. მომწერე შეთავაზების განაკვეთი — გადავითვლი.' : 'ეფექტური განაკვეთი სესხის სრული წლიური ფასია — პროცენტი და საკომისიოები ერთ რიცხვში.'
      } else {
        // a down payment is part of what the item costs: "ჯამში 1 378 ₾ (300 ₾ წინასწარ + 1 078 ₾ შენატანებით)"
        const up = d.upfront
        text = rows.length === 1
          ? (t.cost > 0
            ? (up ? `${d.what}, ${t.months} თვით: ჯამში ${gel(t.total + up)} (${gel(up)} წინასწარ + ${gel(t.total)} შენატანებით) — აქედან ${gel(t.cost)} სესხის ფასია 👇` : `${d.what}, ${t.months} თვით: ჯამში ${gel(t.total)} გადაიხდი — აქედან ${gel(t.cost)} სესხის ფასია 👇`)
            : `${d.what}, ${t.months} თვით: ჯამში ${gel(t.total + up)} — ზედმეტი 0 ₾ 👇`)
          : `ჯამში${up ? ` (${gel(up)} წინასწარის ჩათვლით)` : ''}: ${rows.map(x => `${x.months} თვით ${gel(x.total + up)}`).join(', ')} 👇`
        info = `სესხის ფასი = ჯამი − ${d.kind === 'loan' ? 'აღებული თანხა' : 'ნივთის ფასი'}. ეს ის პროცენტია, რასაც ბანკს უხდი.`
      }
      const [head, rest] = fit(text)
      // the total is now on the screen, so its chip gives way to the next questions
      const chips = (r.msgs[0].chips ?? []).filter(c => !(ask === 'total' && c === 'ჯამში რამდენს გადავიხდი?'))
      for (const c of ['რატომ?', 'დღეს რამდენი შემიძლია?', 'რა არის ეფექტური განაკვეთი?']) if (chips.length < 3 && !chips.includes(c)) chips.push(c)
      r.msgs[0] = withInfo({ ...r.msgs[0], text: head, chips }, joinInfo(rest, info, (r.msgs[0] as JikhoMsg).info))
      return r
    }
    if (ctx.kind === 'micro' && ctx.amount) {
      if (ctx.repay) return { msgs: [jk(`${gel(ctx.amount)}-ის ნაცვლად ჯამში ${gel(ctx.repay)} უნდა დააბრუნო: სესხის ფასი ${gel(ctx.repay - ctx.amount)}-ია.`, ['გადახდა თუ დამიგვიანდა?', 'რა არის ეფექტური განაკვეთი?'], undefined, MICRO_INFO)], ctx, mood: 'calm' }
      return { msgs: [jk(`${gel(ctx.amount)}-ის ნაცვლად რამდენი უნდა დააბრუნო? მომწერე — ჯამს და წლიურ ფასს დაგითვლი.`, ['რა არის ეფექტური განაკვეთი?', 'გადახდა თუ დამიგვიანდა?'], undefined, MICRO_INFO)], ctx, mood: 'calm' }
    }
    if (ctx.kind === 'purchase' && ctx.amount) {
      return { msgs: [jk(`ნაღდად ${gel(ctx.amount)} გადაიხდი — სესხის ფასი არ ემატება.`, [`${gel(ctx.amount)} განვადებით რა იქნება?`, 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
    }
    if (ctx.kind === 'deposit' && ctx.amount) return depositReply(ctx)
    if (ask === 'rate') return { msgs: [jk('განაკვეთს გამსესხებელი ადგენს და ის ხელშეკრულებაში ეფექტური წლიური განაკვეთით უნდა ეწეროს. მომწერე თანხა, ვადა და განაკვეთი — დაგითვლი.', ['2 000 ₾ სესხი 24 თვით 18%-ით', 'რა არის ეფექტური განაკვეთი?'], undefined, q.micro ? MICRO_INFO : undefined)], ctx, mood: 'calm' }
    return { msgs: [jk('რომელ სესხზე ან განვადებაზე? მომწერე თანხა და ვადა, მაგ.: „2 000 ლარი 24 თვით 18%-ით" — ჯამს დაგითვლი.', ['2 000 ₾ სესხი 24 თვით 18%-ით', '1 200 ₾-ის ტელეფონი განვადებით'])], ctx, mood: 'thinking' }
  }

  /** "მარტივად", "მაგალითით", "რატომ?", "ვერ გავიგე": a follow-up on the last answer, in plainer words or with the person's own numbers */
  function explainReply(mode0: Explain): Reply {
    const t = ctx.topic
    const said = ctx.said ?? []
    if (t === 'distress' || t === 'selfharm') return { msgs: [distressReply(t === 'selfharm')], ctx, mood: 'calm' }
    // climb the request's ladder and skip what was already said: plainer words → an example with the person's numbers → the options as steps
    let any = false
    for (const mode of LADDER[mode0]) {
      const m = explainMsg(mode)
      if (!m) continue
      any = true
      if (!said.includes(m.text)) return { msgs: [m], ctx: { ...ctx, lastExplain: mode }, mood: 'calm' }
    }
    if (any) {
      // everything has been said once: say so, and offer the next questions instead of repeating
      const chips = t ? ['დღეს რამდენი შემიძლია?', 'ხელფასამდე მეყოფა?', 'რა არის PTI?'] : isDeal(ctx) ? ['ჯამში რამდენს გადავიხდი?', 'დღეს რამდენი შემიძლია?', 'რა არის PTI?'] : ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', 'ჩემი გადასახადები მაჩვენე']
      const text = 'ამაზე ყველა კუთხით გიჩვენე, რაც ვიცი. თუ რომელიმე ციფრი ან სიტყვა გაუგებარია, დამიწერე — ზუსტად იმას აგიხსნი.'
      return { msgs: [jk(said.includes(text) ? 'ამ თემაზე ახალს ვეღარაფერს დავამატებ. შეგვიძლია სხვა კითხვაზე გადავიდეთ — ქვემოთ რამდენიმე ვარიანტია.' : text, chips)], ctx: { ...ctx, lastExplain: mode0 }, mood: 'calm' }
    }
    return { msgs: [jk('რა აგიხსნა? მკითხე, მაგალითად: „რა არის PTI?" ან „რა არის ეფექტური განაკვეთი?"', ['რა არის PTI?', 'რა არის ეფექტური განაკვეთი?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'thinking' }
  }

  /** one follow-up answer about what is on the table, in the given mode; undefined when that mode has nothing to say */
  function explainMsg(mode: Explain): ChatMsg | undefined {
    const t = ctx.topic
    if (t === 'forecast' || t === 'safe') return weatherExplain(t, mode)
    if (t && t !== 'distress' && t !== 'selfharm') {
      const c = CONCEPT_TEXT[t](e, p, parse(ctx.topicQ ?? ''), ctx)
      const text = mode === 'example' ? c.example ?? `მაგალითად: ${c.mine}` : mode === 'why' ? c.why ?? c.more ?? c.rule : mode === 'simple' ? c.simple ?? c.body : mode === 'steps' ? c.steps : c.more ?? c.mine
      if (!text) return undefined
      const base = (c.chips ?? DEFAULT_CONCEPT_CHIPS[t] ?? ['დღეს რამდენი შემიძლია?', 'რა არის PTI?']).filter(x => x !== 'მაგალითით ამიხსენი')
      const chips = [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', ...base].slice(0, 3)
      return jkFit(text, chips, undefined, mode === 'example' || mode === 'steps' ? undefined : `შენთვის: ${c.mine}`)
    }
    if (isDeal(ctx)) return dealExplain(mode)
    if (ctx.kind === 'purchase' && ctx.amount !== undefined) return ctx.onHand !== undefined && !ctx.afterPayday && !ctx.cash ? onHandExplain(mode, ctx.amount) : purchaseExplain(ctx.amount, mode)
    if (ctx.onHand !== undefined) return onHandExplain(mode, 0)
    if (ctx.kind === 'save') return saveExplain(mode)
    if (ctx.kind === 'deposit') {
      const c = CONCEPT_TEXT.deposit(e, p, q, ctx)
      const text = mode === 'example' ? c.example : mode === 'why' ? c.why : mode === 'simple' ? c.simple : mode === 'more' ? c.more : undefined
      return text ? jkFit(text, ['რა არის ინფლაცია?', 'რა არის რთული პროცენტი?']) : undefined
    }
    if (ctx.kind === 'micro') {
      const text = mode === 'simple' ? 'მარტივად: სესხის ფასი ისაა, რასაც აღებულ თანხაზე მეტს აბრუნებ. წლიურად გადათვლილი, ის სხვა სესხებთან შედარებას გიადვილებს.'
        : mode === 'why' ? 'რატომ წლიურად: ერთი თვის ფასი პატარა ჩანს, მაგრამ წელიწადზე გადათვლილი ის ბევრად მეტია — ასე ჩანს, რომელი სესხია ძვირი.' : undefined
      return text ? jk(text, ['რა არის ეფექტური განაკვეთი?', 'გადახდა თუ დამიგვიანდა?'], undefined, MICRO_INFO) : undefined
    }
    return undefined
  }

  /** follow-ups on money the person named ("40 ლარი დამრჩა", "500 ლარი მაქვს და 300-იანი ქურთუკი"): the same numbers, another angle */
  function onHandExplain(mode: Explain, amount: number): ChatMsg | undefined {
    const have = ctx.onHand!
    const days = Math.max(1, daysLeft)
    const avg = Math.round(e.avgDaily), need = Math.round(e.avgDaily * days)
    const due = dueSum()
    const rest = Math.round(have - amount - due)
    const per = Math.round(Math.max(0, rest) / days)
    const a = amount ? ` − ${gel(amount, amount % 1 ? 2 : 0)}` : ''
    let text: string | undefined
    // "ეს რას ნიშნავს ჩემთვის?" asks for the plain meaning
    if (mode === 'more') mode = 'simple'
    // the consequence in plain words: at the usual pace the money runs out before payday by this much
    if (mode === 'simple') text = rest > 0 ? (per < avg ? `მარტივად: ჩვეული ტემპით (დღეში ~${gel(avg)}) ხელფასამდე ~${gel(Math.max(5, r5(need - rest)))} დაგაკლდება; ~${gel(rest)} ${days} დღეს დღეში ~${gel(per)}-ით ჰყოფნის.` : `მარტივად: ჩვეული ტემპით (დღეში ~${gel(avg)}) ${days} დღეს ~${gel(need)} სჭირდება — ~${gel(rest)} ამას ფარავს.`) : `მარტივად: ეს თანხა ხელფასამდე გადასახდელსაც ვერ ფარავს — ~${gel(Math.max(5, r5(-rest)))} აკლია.`
    else if (mode === 'example') text = rest > 0 ? `მაგალითად: ჩვეული ხარჯით ${days} დღეს ~${gel(need)} სჭირდება — ~${gel(rest)} ამას ${rest < need ? `~${gel(need - rest)}-ით ნაკლებია` : `~${gel(rest - need)}-ით აჭარბებს`}.` : undefined
    else if (mode === 'why') text = `რატომ: ${gel(have, have % 1 ? 2 : 0)}${a}${due ? ` − ხელფასამდე გადასახდელი ~${gel(due)}` : ''} = ~${rest >= 0 ? gel(rest) : `${gel(-rest)}-ით მინუსი`}, ${days} დღეზე.`
    else if (mode === 'steps') text = `ვარიანტები: ${amount ? `${gel(amount)}-ის ხარჯი ხელფასის შემდეგ — მაშინ ${gel(p.salary)} ჩაირიცხება; ` : ''}${rest > 0 ? `ხელფასამდე (${days} დღე) დღეში ~${gel(per)}` : have - due < 0 ? `ახლა გადასახდელსაც ~${gel(Math.max(5, r5(due - have)))} აკლია` : `ახლა ${gel(amount)} ~${gel(Math.max(5, r5(-rest)))}-ით ვერ ეტევა`}; გადასახდელის სია — „ჩემი გადასახადები".`
    if (!text) return undefined
    return jk(text, [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', 'ჩემი გადასახადები მაჩვენე', 'ხელფასამდე მეყოფა?'], undefined, due ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined)
  }

  /** follow-ups on a saving plan: plainer words, the months worked out, why this monthly sum, the options */
  function saveExplain(mode: Explain): ChatMsg | undefined {
    const ms = Math.round(e.medianSurplus)
    const goal = ctx.amount, per = ctx.perMonth ?? ms
    if (per <= 0) return mode === 'why' || mode === 'simple' ? jk(`ახლა თვის ბოლოს ჩვეულებრივ არაფერი რჩება: ხელფასს (${gel(p.salary)}) გადასახადები (${gel(e.fixedTotal)}) და ჩვეული ხარჯი (~${gel(Math.round(e.monthlyVarMedian))}) მთლიანად ფარავს.`, ['ჩემი გადასახადები მაჩვენე', 'რა არის 50/30/20 წესი?']) : undefined
    const chips = [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', 'რა არის ანაბარი?', 'რა არის გადაუდებელი ფონდი?']
    if (!goal) return mode === 'simple' ? jk(`მარტივად: თვის ბოლოს ჩვეულებრივ ~${gel(per)} გრჩება — ამდენის გადადება ჩვეული ხარჯის შეცვლის გარეშე გამოდის.`, chips) : mode === 'example' ? jk(`მაგალითად: თვეში ~${gel(per)} წელიწადში ~${gel(per * 12)}-ია.`, chips) : undefined
    const n = Math.ceil(goal / per)
    const sav = p.savings ? Math.ceil(Math.max(0, goal - p.savings.amount) / per) : undefined
    let text: string | undefined
    if (mode === 'simple') text = `მარტივად: თვეში ~${gel(per)}-ის გადადებით ${gel(goal)} ${n} თვეში შეგროვდება.`
    else if (mode === 'example') text = `მაგალითად: ${n} თვე × ~${gel(per)} ≈ ${gel(n * per)}${sav !== undefined && p.savings ? `; ქვევრის ${gel(p.savings.amount)}-ით — ${sav} თვეში` : ''}.`
    else if (mode === 'why') text = ctx.perMonth === undefined ? `რატომ ~${gel(ms)}: ხელფასს (${gel(p.salary)}) აკლდება გადასახადები (${gel(e.fixedTotal)}) და ჩვეული ხარჯი (~${gel(Math.round(e.monthlyVarMedian))}).` : `რატომ ${n} თვე: ${gel(goal)} ÷ ${gel(per)} ≈ ${fmt(goal / per, 1)} — ანუ ${n} სრული თვე.`
    else if (mode === 'steps') {
      const up = r10(Math.max(per * 1.5, per + 20))
      text = `ვარიანტები: თვეში ~${gel(per)} — ${n} თვე; თვეში ${gel(up)} — ${Math.ceil(goal / up)} თვე${sav !== undefined ? `; ქვევრის დანაზოგით — ${sav} თვე` : ''}.`
    }
    return text ? jk(text, chips) : undefined
  }

  function dealExplain(mode: Explain): ChatMsg {
    const d = buildDeal(e, p, ctx, (ctx.kind as 'installment' | 'loan'))
    const rows = d.rows
    // the hardest option of the card is the one worth explaining
    const t = rows.length === 1 ? rows[0] : rows.reduce((a, b) => (b.nShort > a.nShort ? b : a))
    const S = t.window.filter(c => c.p50 < e.cushion)
    const ms = Math.round(e.medianSurplus)
    const info = `ზღვარი — ${gel(e.cushion)}: შენი ${p.cushionDays} დღის ჩვეული ხარჯი. ფერადი ზოლი თითოეულ თვეს აჩვენებს: მწვანე — ფული სავარაუდოდ გეყოფა, წითელი — დიდი შანსია, რომ ზღვარზე ნაკლები დაგრჩება.`
    let text: string
    if (mode === 'example') {
      const c = S[0] ?? t.window[0]
      text = `მაგალითად: ${byPayday(c)} სავარაუდოდ ${leftOrShort(c.p50)} — ${c.p50 < e.cushion ? `ზღვარი კი ${gel(e.cushion)}-ია` : `ზღვარზე (${gel(e.cushion)}) მეტი`}.`
    } else if (mode === 'why') {
      const inst = p.installment
      if (S.length) {
        const why: string[] = []
        if (t.monthly > ms) why.push(`შენატანი (~${gel(Math.round(t.monthly))}) შენს ჩვეულ თვიურ ნაშთზე (~${gel(Math.max(0, ms))}) მეტია`)
        if (inst && S.some(c => c.laptop > 0)) why.push(`${inst.name} (${gel(inst.amount)}) ${UNTIL[inst.lastCycle[1]]} გრძელდება`)
        if (S.some(c => c.uplift > 0)) why.push(S.filter(c => c.uplift > 0).every(c => [12, 1, 2, 3].includes(c.m)) ? 'ზამთარში ხარჯი ჩვეულებრივ იზრდება' : 'ზოგ თვეში ხარჯი ჩვეულებრივ იზრდება')
        // one bubble: the reasons that fit in 160 characters, the first (the payment against the usual surplus) always kept
        const line = () => `${S.length} თვეში ზღვარს ქვემოთ ჩადიხარ, რადგან ${why.length ? why.join(' და ') : 'შენატანი და ჩვეული ხარჯი ერთად ხელფასს თითქმის მთლიანად ფარავს'}.`
        while (why.length > 1 && line().length > 160) why.pop()
        text = line()
      } else if (d.start > 0 && inst) {
        text = `აქ ყველა თვე ზღვარს ზემოთაა: ${inst.name} ${UNTIL[inst.lastCycle[1]]} სრულდება, ამიტომ ორი შენატანი ერთად აღარ ხვდება.`
      } else {
        text = `ყველა თვე ზღვარს ზემოთაა: შენატანი (~${gel(Math.round(t.monthly))}) შენს ჩვეულ თვიურ ნაშთში (~${gel(Math.max(0, ms))}) ეტევა.`
      }
    } else if (mode === 'steps') {
      // the options side by side, with saving up as one of them; the longest list that fits one bubble
      const save = e.monthsToSave(d.price - d.upfront)
      const opts = rows.map(x => `${x.months} თვით — ~${gel(Math.round(x.monthly))}/თვე, ჯამში ${gel(x.total + d.upfront)}`)
      let saveOpt = Number.isFinite(save) && save <= 36 ? [`დაზოგვით — ~${save} თვეში, სესხის ფასის გარეშე`] : []
      const line = () => `ვარიანტები: ${[...opts, ...saveOpt].join('; ')}.`
      while (opts.length > 1 && line().length > 160) opts.splice(Math.floor(opts.length / 2), 1)
      if (line().length > 160) saveOpt = []
      text = line()
    } else if (rows.length > 1) {
      text = `მარტივად: რაც გრძელია ვადა, მით ნაკლებია შენატანი და მეტია ჯამი: ${rows.map(x => `${x.months} თვე — ~${gel(Math.round(x.monthly))}, სულ ${gel(x.total)}`).join('; ')}.`
    } else {
      const plain = t.nShort === 0 ? 'ყველა თვეში ხელფასამდე ზღვარზე მეტი დაგრჩება.' : `${t.nShort} თვეში ხელფასამდე სავარაუდოდ ზღვარზე (${gel(e.cushion)}) ნაკლები დაგრჩება.`
      text = `მარტივად: ${t.months} თვე იხდი ~${gel(Math.round(t.monthly))}-ს, ჯამში — ${gel(t.total)}. ${plain}`
    }
    const chips = mode === 'example' ? ['რატომ?', 'ჯამში რამდენს გადავიხდი?', 'დღეს რამდენი შემიძლია?'] : mode === 'why' ? ['მაგალითით ამიხსენი', 'ჯამში რამდენს გადავიხდი?', 'დღეს რამდენი შემიძლია?'] : ['მაგალითით ამიხსენი', 'რატომ?', 'ჯამში რამდენს გადავიხდი?']
    return jkFit(text, chips, undefined, info)
  }

  function purchaseExplain(amount: number, mode: Explain): ChatMsg {
    const r = purchaseResult(e, p, amount, day0, demo.extra, dayIdx)
    let text: string
    // the answer on the table was about spending after payday: explain that one
    if (ctx.afterPayday || payday) {
      const after = nextPay(amount)
      const res = after >= 0 ? `~${gel(r10(after))}` : `~${gel(Math.max(5, rs(-after)))}-ით მინუსი`
      const land = landingNow().p50
      if (mode === 'steps') {
        const save = e.monthsToSave(amount)
        text = `ვარიანტები: ${payday ? 'დღეს' : 'ხელფასის შემდეგ'} — მომდევნო ხელფასამდე ${res}${Number.isFinite(save) && save > 1 ? `; დაზოგვით — ~${save} თვეში` : ''}; უფრო მცირე თანხა — ზღვარს (${gel(e.cushion)}) ზემოთ მეტი რჩება.`
      } else text = mode === 'why' || mode === 'example'
        ? `${mode === 'why' ? 'რატომ' : 'მაგალითად'}: ~${gel(r10(land))} ნაშთს და ${gel(p.salary)} ხელფასს აკლდება ${gel(e.fixedTotal)} გადასახადები, ~${gel(r10(e.monthlyVarMedian))} ჩვეული ხარჯი და ${gel(amount)} — რჩება ${res}.`
        // plain words, no formula: what comes in, what goes out, what is left
        : `მარტივად: ${payday ? 'დღეს ხელფასი შემოდის' : 'ხელფასის შემდეგ'} — ${gel(amount)}-ის, გადასახადებისა და ჩვეული ხარჯის შემდეგ ${nextPaydayWord} ${after >= 0 ? `~${gel(r10(after))} დაგრჩება${after > 0 ? ` (${daysText(after, e.avgDaily).replace(/^ეს /, '')})` : ''}` : `~${gel(Math.max(5, rs(-after)))} დაგაკლდება`}.`
      return jk(text, [mode === 'why' ? 'მაგალითით ამიხსენი' : 'რატომ?', 'დღეს რამდენი შემიძლია?', 'ხელფასამდე მეყოფა?'], undefined, cushionInfo(e, p))
    }
    // the balance, the bills still due before payday and the usual spending: the numbers add up to the answer
    const bal = Math.round(balNow()), due = dueSum(), land = Math.round(landingNow().p50)
    const usual = Math.max(0, bal - due - land)
    // an example in the person's own numbers: a usual day's spending against what is left
    const avgD = Math.round(e.avgDaily)
    if (mode === 'example') text = r.p50 > 0
      ? `მაგალითად: დღეში ჩვეულებრივ ~${gel(avgD)}-ს ხარჯავ. ${gel(amount, amount % 1 ? 2 : 0)}-ის შემდეგ ხელფასის დღეს ~${gel(r5(r.p50))} რჩება — ${daysText(r.p50, e.avgDaily)}, ზღვარი კი ${gel(e.cushion)}-ია.`
      : `მაგალითად: დღეში ჩვეულებრივ ~${gel(avgD)}-ს ხარჯავ — ${gel(amount, amount % 1 ? 2 : 0)}-ის შემდეგ ხელფასამდე ბოლო ~${Math.max(1, Math.ceil(-r.p50 / e.avgDaily))} დღისთვის ფული აღარ დარჩება.`
    // "მერე?": what comes after payday with this spend
    else if (mode === 'more') {
      const after = nextPay(amount)
      text = `მერე: ${dative(p.paydayLabel).split(', ')[1] ?? ''} ხელფასი (${gel(p.salary)}) ჩაირიცხება — ${gel(amount, amount % 1 ? 2 : 0)}-ის ხარჯით მომდევნო ხელფასამდე ${after >= 0 ? `~${gel(r10(after))} დაგრჩება` : `~${gel(Math.max(5, rs(-after)))} დაგაკლდება`}.`
    }
    // the shown terms add up to the shown result: the usual-spending term is what is left over (balance − bills − spend − result)
    else if (mode === 'why') {
      const shown = r.p50 >= 0 ? r5(r.p50) : -Math.max(5, r5(-r.p50))
      const usualShown = Math.max(0, Math.round(bal - due - amount - shown))
      text = `რატომ: ხელფასამდე ${daysLeft} დღეა — ${gel(bal)}-ს აკლდება გადასახდელი ~${gel(due)}, ჩვეული ხარჯი ~${gel(usualShown)} და ${gel(amount, amount % 1 ? 2 : 0)}: რჩება ${shown >= 0 ? `~${gel(shown)}` : `~${gel(-shown)}-ით მინუსი`}.`
    }
    else if (mode === 'steps') {
      const after = nextPay(amount), save = e.monthsToSave(amount)
      const now = r.p50 > 0 ? `დღეს — ხელფასამდე ~${gel(r5(r.p50))} დაგრჩება` : `დღეს — ხელფასამდე ~${gel(Math.max(5, r5(-r.p50)))} დაგაკლდება`
      text = `ვარიანტები: ${now}; ხელფასის შემდეგ — მომდევნო ხელფასამდე ${after >= 0 ? `~${gel(r10(after))}` : `~${gel(Math.max(5, rs(-after)))}-ით მინუსი`}${Number.isFinite(save) && save > 1 ? `; დაზოგვით — ~${save} თვეში` : ''}.`
    }
    // plain words with an everyday image: the spend in days of usual spending, against the days left (no jargon)
    else {
      const dAmt = Math.max(1, Math.round(amount / e.avgDaily))
      text = r.p50 > 0
        ? `მარტივად: ${gel(amount)} შენი ~${dAmt} დღის ჩვეული ხარჯია. მის შემდეგ ხელფასის დღეს ~${gel(r5(r.p50))} დაგრჩება — ${daysText(r.p50, e.avgDaily).replace(/^ეს /, '')}.`
        : `მარტივად: ${gel(amount)} შენი ~${dAmt} დღის ჩვეული ხარჯია, ხელფასამდე კი ${daysLeft} დღეა — ფული ~${gel(Math.max(5, r5(-r.p50)))}-ით არ გეყოფა.`
    }
    const chips = [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', 'ხელფასის შემდეგ რომ ვიყიდო?', 'დღეს რამდენი შემიძლია?']
    return jk(text, chips, undefined, joinInfo(mode === 'example' ? `10 მსგავსი თვიდან ${r.inTen}-ში ხელფასამდე ზღვარზე (${gel(e.cushion)}) ნაკლები დაგრჩებოდა.` : undefined, cushionInfo(e, p)))
  }

  function weatherExplain(t: 'forecast' | 'safe', mode: Explain): ChatMsg {
    // the spend just discussed stays counted, as in the answer being explained
    const pend = t === 'safe' ? pending() : undefined
    const f = pend ? purchaseResult(e, p, pend.sum, day0, demo.extra, dayIdx) : landingNow()
    const safe = daysLeft > 0 ? Math.max(0, Math.round((f.p50 - e.cushion) / daysLeft)) : 0
    let text: string
    const atEnd = (v: number) => (v >= 0 ? `~${gel(rs(v))}` : `~${gel(Math.max(5, rs(-v)))}-ით მინუსში`)
    const chips = [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', WEATHER_CHIP, 'დღეს რამდენი შემიძლია?']
    // the answer was about the month after the coming payday: explained with those numbers
    if (!payday && ctx.afterPayday && t === 'forecast') {
      const nx = nextPay()
      text = mode === 'why' || mode === 'example' ? `${mode === 'why' ? 'რატომ' : 'მაგალითად'}: ${nextPayInfo(0).replace(/^ვითვლი ასე: /, '')}`
        : mode === 'steps' ? `ვარიანტები: ჩვეული ხარჯით მომდევნო ხელფასამდე ${leftOrShort(nx)}; დიდი ხარჯი ხელფასის შემდეგ ამ თანხიდან მოდის; გადასახდელის სია — „ჩემი გადასახადები".`
          : `მარტივად: ხელფასის შემდეგ ${gel(p.salary)}-ს აკლდება გადასახადები (${gel(e.fixedTotal)}) და ჩვეული ხარჯი (~${gel(r10(e.monthlyVarMedian))}) — მომდევნო ხელფასამდე ${leftOrShort(nx)}.`
      return jk(text, chips, undefined, cushionInfo(e, p))
    }
    // payday: the explanation is about the new month (the salary lands today)
    if (payday) {
      const nx = nextPay(), perDay = Math.max(0, Math.round((nx - e.cushion) / 30))
      text = mode === 'example' ? (perDay > 0 ? `მაგალითად: დღეში ~${gel(perDay)} — ერთი ყავა ან სნექი — ჩვეულ ხარჯს ემატება და მომდევნო ხელფასამდე ზღვარს (${gel(e.cushion)}) ზემოთ დაგტოვებს.` : `მაგალითად: ${gel(p.salary)} ხელფასიდან ${gel(e.fixedTotal)} გადასახადებზე მიდის, ~${gel(Math.round(e.monthlyVarMedian))} — ჩვეულ ხარჯზე.`)
        : mode === 'why' ? `რატომ: ${nextPayInfo(0).replace(/^ვითვლი ასე: /, '')}`
          : mode === 'steps' ? (nx > e.cushion ? `ვარიანტები: ჩვეული ხარჯის გარდა დღეში ~${gel(perDay)}; ან ერთი დიდი ხარჯი მომდევნო ხელფასამდე დარჩენილი ~${gel(rs(nx))}-დან; გადასახდელის სია — „ჩემი გადასახადები".` : `ახალი თვე მჭიდროა: გადასახადებისა და ჩვეული ხარჯის შემდეგ თავისუფალი თანხა არ რჩება. გადასახდელის სიას „ჩემი გადასახადები" აჩვენებს.`)
            : `მარტივად: დღეს ხელფასი ჩაირიცხება. გადასახადებისა და ჩვეული ხარჯის შემდეგ მომდევნო ხელფასამდე ${leftOrShort(nx)}.`
      return jk(text, chips, undefined, cushionInfo(e, p))
    }
    if (mode === 'steps') {
      text = safe > 0
        ? `ვარიანტები: ჩვეული ხარჯის გარდა დღეში ~${gel(safe)} — ხელფასამდე ზღვარს ზემოთ; დიდი ხარჯი ხელფასის შემდეგ, როცა ${gel(p.salary)} ჩაირიცხება.`
        : `ვარიანტები: ხელფასამდე (${daysLeft} დღე) აუცილებელი ხარჯი; დიდი ხარჯი ხელფასის შემდეგ, როცა ${gel(p.salary)} ჩაირიცხება; გადასახდელის სია — „ჩემი გადასახადები".`
      return jk(text, ['მაგალითით ამიხსენი', 'ჩემი გადასახადები მაჩვენე', 'დღეს რამდენი შემიძლია?'], undefined, cushionInfo(e, p))
    }
    if (t === 'safe' && safe > 0) {
      text = mode === 'example' ? `მაგალითად: დღეს ~${gel(safe)}-ის ყავა ან სნექი ჩვეულ ხარჯს ემატება და ხელფასამდე ზღვარს მაინც ზემოთ დაგტოვებს.`
        : mode === 'why' ? `რატომ: ხელფასამდე სავარაუდოდ ${leftOrShort(f.p50)}, აქედან ${gel(e.cushion)} ზღვარია — დანარჩენი ${daysLeft} დღეზე იყოფა.`
          : `მარტივად: ჩვეული ხარჯის გარდა დღეში ~${gel(safe)} შეგიძლია დახარჯო და ხელფასამდე ზღვარს (${gel(e.cushion)}) ზემოთ დარჩე.`
    } else if (t === 'safe') {
      text = mode === 'example' ? `მაგალითად: 10 მსგავსი თვიდან ${f.inTen}-ში ხელფასამდე ზღვარზე (${gel(e.cushion)}) ნაკლები გრჩება.`
        : mode === 'why' ? `რატომ: ხელფასამდე სავარაუდოდ ${leftOrShort(f.p50)}, ზღვარი კი ${gel(e.cushion)}-ია — ზედმეტი თანხა არ რჩება.`
          : `მარტივად: ხელფასამდე ჩვეული ხარჯის გარდა თავისუფალი თანხა თითქმის არ რჩება — პროგნოზი ზღვართან (${gel(e.cushion)}) ახლოსაა.`
    } else {
      text = mode === 'example' ? `მაგალითად: 10 მსგავსი თვიდან ${f.inTen}-ში ხელფასამდე ზღვარზე (${gel(e.cushion)}) ნაკლები გრჩება.`
        : mode === 'why' ? 'რატომ შუალედი: ყოველდღიური ხარჯი იცვლება, ამიტომ 1 000 სცენარს ვითვლი და მათ 80%-ს გაჩვენებ.'
          : f.p50 > 0 ? `მარტივად: ხელფასამდე სავარაუდოდ ~${gel(rs(f.p50))} დაგრჩება. ცუდ შემთხვევაში — ${atEnd(f.p10)}, კარგში — ${atEnd(f.p90)}.`
            : `მარტივად: ხელფასამდე ფული სავარაუდოდ არ გეყოფა — ~${gel(Math.max(5, rs(-f.p50)))} დაგაკლდება.`
    }
    return jk(text, [mode === 'example' ? 'რატომ?' : 'მაგალითით ამიხსენი', WEATHER_CHIP, 'დღეს რამდენი შემიძლია?'], undefined, cushionInfo(e, p))
  }

  /** the question names the person's saving pot ("ზამთრის კურსისთვის") */
  function savingsNamed() {
    if (!p.savings) return false
    return p.savings.name.split(/\s+/).filter(w => w.length >= 4).some(w => lower.includes(w.slice(0, Math.min(5, w.length - 1))))
  }
  /** saving towards the person's own pot: what is missing, the months at the monthly sum named (or the usual surplus), and whether it fits this month */
  function goalReply(per0?: number): Reply {
    const sv = p.savings!
    const rem = Math.max(0, sv.target - sv.amount)
    const ms = Math.round(e.medianSurplus)
    const per = per0 ?? ctx.perMonth ?? (ms > 0 ? ms : undefined)
    const name = `„${sv.name}"`
    const head = `${name}-ს ${gel(rem)} აკლია (${gel(sv.amount)} / ${gel(sv.target)})`
    let text: string
    if (!per) text = `${head}. ახლა თვის ბოლოს ჩვეულებრივ არაფერი რჩება, ამიტომ ამ ტემპით ის ვერ შეივსება.`
    else {
      const n = Math.ceil(rem / per)
      // this month's room: on payday the coming month's leftover, otherwise the usual month-end surplus
      const avail = payday ? Math.max(0, nextPay()) : Math.max(0, ms)
      const fitWord = payday ? 'ამ თვეში ჩვეული ხარჯის შემდეგ' : 'თვის ბოლოს ჩვეულებრივ'
      void fitWord
      // "300 ლარი რომ გადავდო, თვეში მეყოფა?": the month's room against the sum named, and against what the pot still needs
      const room = `${payday ? 'ამ თვეში' : 'თვეში ჩვეულებრივ'} ~${gel(rs(avail))} რჩება`
      const withPer = per > avail ? `${gel(per)}-ით ~${gel(Math.max(5, r5(per - avail)))} დაგაკლდება` : `${gel(per)}-ით ~${gel(rs(avail - per))} დაგრჩება`
      const withRem = per > rem ? `, ${gel(rem)}-ით — ${rem > avail ? `~${gel(Math.max(5, r5(rem - avail)))} დაგაკლდება` : `~${gel(rs(avail - rem))} დაგრჩება`}` : `; ქვევრი ${n === 1 ? 'ერთ თვეში' : `${n} თვეში`} შეივსება`
      text = per0 !== undefined
        ? `${head}. ${room}: ${withPer}${withRem}.`
        : `${head}: თვეში ${gel(per)}-ით ${n === 1 ? 'ერთ თვეში' : `${n} თვეში`} შეივსება.${ctx.perMonth !== undefined && ms > 0 && ms !== per ? ` ჩვეული ნაშთით (~${gel(ms)}) — ~${Math.ceil(rem / ms)} თვეში.` : ''}`
    }
    const info = per ? `ქვევრი შენს მონაცემებშია: ${gel(sv.amount)} ${gel(sv.target)}-დან. ${payday ? nextPayInfo(0) : `თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} გრჩება.`}` : billsLine(e, p)
    return { msgs: [jkFit(text, ['რა არის ანაბარი?', 'დღეს რამდენი შემიძლია?', 'რა არის გადაუდებელი ფონდი?'], undefined, info)], ctx: { kind: 'save', amount: rem, perMonth: per0 ?? ctx.perMonth, item: sv.name, goal: true }, mood: 'happy' }
  }

  /** a goal by a date: the monthly sum it needs, against the usual month-end surplus */
  function saveByDate(goal: number, months: number, item?: string): Reply {
    const ms = Math.round(e.medianSurplus)
    const per = Math.ceil(goal / months)
    const vs = ms <= 0 ? 'თვის ბოლოს კი ახლა ჩვეულებრივ არაფერი რჩება' : per <= ms ? `ეს შენს ჩვეულ თვიურ ნაშთში (~${gel(ms)}) ეტევა` : `ეს შენს ჩვეულ თვიურ ნაშთზე (~${gel(ms)}) ~${gel(r5(per - ms))}-ით მეტია`
    const text = `${months} თვეში ${gel(goal)}-ისთვის თვეში ~${gel(per)} სჭირდება — ${vs}.`
    const n = e.monthsToSave(goal)
    return { msgs: [jk(text, ['ეს შესაძლებელია?', `და ${months + 6} თვეში?`, 'ანაბარზე რომ დავდო?'], undefined, Number.isFinite(n) ? `ჩვეული ნაშთით (~${gel(ms)}) ${gel(goal)} ~${n} თვეში დაგროვდება.` : billsLine(e, p))], ctx: { kind: 'save', amount: goal, perMonth: per, item }, mood: per <= ms ? 'happy' : 'calm' }
  }

  /** saving up: with the usual month-end surplus, or with a monthly sum the person names */
  function saveReply(goal: number | undefined, per: number | undefined, item?: string): Reply {
    const ms = Math.round(e.medianSurplus)
    const vsUsual = (x: number) => (ms <= 0 ? ' თვის ბოლოს ახლა ჩვეულებრივ არაფერი გრჩება.' : x > ms ? ` ეს შენს ჩვეულ თვიურ ნაშთზე (~${gel(ms)}) ~${gel(r5(x - ms))}-ით მეტია.` : ` ეს შენს ჩვეულ თვიურ ნაშთში (~${gel(ms)}) ეტევა.`)
    const kvevri = (n: (rest: number) => number) => (p.savings && goal ? `ქვევრში არსებული ${gel(p.savings.amount)}-ის ჩათვლით — ${Math.max(0, n(goal - p.savings.amount))} თვეში.` : undefined)
    const chipPer = `თვეში ${Math.max(50, r10(Math.max(ms, 0) * 1.5))} ₾ რომ გადავდო?`
    let text: string, info: string | undefined, chips: string[]
    if (per !== undefined && per > 0) {
      if (goal) {
        text = `თვეში ${gel(per)}-ით ${gel(goal)} ${Math.ceil(goal / per)} თვეში დაგროვდება.${vsUsual(per)}`
        info = kvevri(rest => Math.ceil(rest / per))
        chips = [`და თვეში ${r10(per * 1.5)} ₾?`, `${gel(goal)} განვადებით რა იქნება?`, 'რა არის გადაუდებელი ფონდი?']
      } else {
        text = `თვეში ${gel(per)}-ით წელიწადში ${gel(per * 12)} დაგროვდება.${vsUsual(per)}`
        chips = ['რამდენ ხანში დავაგროვებ 1000 ლარს?', 'რა არის ანაბარი?', 'რა არის გადაუდებელი ფონდი?']
      }
    } else if (goal) {
      const n = e.monthsToSave(goal)
      text = Number.isFinite(n)
        ? `${gel(goal)} დაახლოებით ${n} თვეში დაგროვდება, თუ თვის ბოლოს დარჩენილ ~${gel(Math.round(e.medianSurplus))}-ს გადადებ.`
        : 'ახლა თვის ბოლოს ჩვეულებრივ არაფერი გრჩება, ამიტომ ამ ტემპით დაგროვება ვერ გამოვა.'
      info = Number.isFinite(n) ? joinInfo(kvevri(rest => Math.ceil(rest / e.medianSurplus)), 'ზამთრის თვეებში ნაკლები გრჩება.') : billsLine(e, p)
      chips = [chipPer, `${gel(goal)} განვადებით რა იქნება?`, 'რა არის გადაუდებელი ფონდი?']
    } else {
      // "ფულს ვერ ვაგროვებ, როგორ დავიწყო?": a short acknowledgement, the usual surplus, and the how (on payday) in the visible line
      const hard = /ვერ ვაგროვებ|ვერ ვზოგავ|ვერაფერს ვზოგავ|არ გამომდის|ვერასდროს|საერთოდ ვერ|ვერ ვინახავ/.test(lower)
      text = ms > 0 ? `${hard ? 'ეს ბევრს უჭირს. ' : ''}თვის ბოლოს ჩვეულებრივ ~${gel(ms)} გრჩება: ხელფასის დღეს გადადებული თანხა ხშირად მეტია, ვიდრე თვის ბოლოს დარჩენილი.` : 'ახლა თვის ბოლოს ჩვეულებრივ არაფერი გრჩება — ხელფასს ფიქსირებული და ყოველდღიური ხარჯი მთლიანად ფარავს.'
      info = joinInfo(ms > 0 ? `ამდენის გადადება ჩვეული ხარჯის შეცვლის გარეშე გამოდის; პატარა, მაგრამ ყოველთვიური თანხაც — 20–50 ₾ — ჩვევას ქმნის.` : billsLine(e, p), p.savings ? `ქვევრში ახლა ${gel(p.savings.amount)}-ია.` : undefined)
      chips = ['რამდენ ხანში დავაგროვებ 1000 ლარს?', chipPer, 'რა არის გადაუდებელი ფონდი?']
      if (ms > 0) {
        const card: ChatCard = { kind: 'concept', data: { title: 'დაზოგვა ხელფასის დღეს', more: 'ზამთრის თვეებში ჩვეულებრივ ნაკლები რჩება.', mine: `~${gel(ms)} თვეში → 1 000 ₾ ~${Math.ceil(1000 / ms)} თვეში, 500 ₾ ~${Math.ceil(500 / ms)} თვეში.`, rule: 'თანხა, რომელიც ხელფასის დღესვე გადაიდება, ყოველდღიურ ხარჯში აღარ ერევა.' } }
        return { msgs: [jkFit(text, chips, card, info)], ctx: { kind: 'save', amount: goal, perMonth: per, item }, mood: 'happy' }
      }
    }
    return { msgs: [jkFit(text, chips, undefined, info)], ctx: { kind: 'save', amount: goal, perMonth: per, item }, mood: 'happy' }
  }

  /** a deposit's growth: simple interest within a year, yearly compounding beyond it */
  function depositReply(c: Ctx): Reply {
    const cc = CONCEPT_TEXT.deposit(e, p, q, c)
    const card = (mine: string): ChatCard => ({ kind: 'concept', data: { title: cc.title, body: cc.body, more: cc.more, mine, rule: cc.rule } })
    const chips = ['რა არის ინფლაცია?', 'რა არის რთული პროცენტი?']
    const nctx: Ctx = { ...c, kind: 'deposit' }
    if (c.amount === undefined) return { msgs: [jk('რა თანხას დებ ანაბარზე და რა წლიური განაკვეთით? მაგ.: „1 000 ლარი 10%-ით 1 წელი" — დაგითვლი.', ['რა არის ანაბარი?', ...chips])], ctx: nctx, mood: 'thinking' }
    if (c.rateYear === undefined) return { msgs: [jk(`${gel(c.amount)}-ის ანაბარზე სარგებელი განაკვეთზეა დამოკიდებული. მომწერე ბანკის შეთავაზებული წლიური განაკვეთი — დაგითვლი.`, chips, card(cc.mine))], ctx: nctx, mood: 'thinking' }
    const m = c.months ?? 12
    const y = Math.floor(m / 12), rest = m % 12
    const total = c.amount * Math.pow(1 + c.rateYear, y) * (1 + c.rateYear * rest / 12)
    const span = rest === 0 ? `${y} წელიწადში` : `${m} თვეში`
    const rateShown = `${fmt(c.rateYear * 100, (c.rateYear * 100) % 1 ? 1 : 0)}%`
    const text = `${gel(c.amount)} წლიური ${rateShown}-ით ${span} ~${gel(Math.round(total))} გახდება: სარგებელი ~${gel(Math.round(total - c.amount))}.`
    const info = m > 12 ? 'ვთვლი, რომ სარგებელი ანაბარზე რჩება და წელიწადში ერთხელ ემატება. ზუსტ პირობებს ხელშეკრულება აჩვენებს.' : 'ზუსტ პირობებს — სარგებლის გადახდის წესს და ვადამდე გატანას — ხელშეკრულება აჩვენებს. ბანკსა და მიკრობანკში სარგებელი ფიზიკური პირისთვის არ იბეგრება.'
    return { msgs: [jk(text, [m === 24 ? 'და 3 წლით?' : 'და 2 წლით?', ...chips], card(`${gel(c.amount)} → ~${gel(Math.round(total))} ${span}, წლიური ${rateShown}-ით.`), info)], ctx: { ...nctx, months: m }, mood: 'calm' }
  }

  /** money on hand ("40 ლარი დამრჩა") or a spend repeated every day ("დღეში 40 ლარი") */
  function budgetReply(dailyOverride?: number, haveOverride?: number, cashOverride?: boolean): Reply {
    const days = Math.max(1, daysLeft)
    const avg = Math.round(e.avgDaily)
    // "ლეპტოპის განვადება როდის მთავრდება?": the end month and the payments left, from the data
    if (q.myDebt && haveOverride === undefined) {
      const inst = p.installment
      if (!inst) return { msgs: [jk(debtsLine(p), ['ჩემი გადასახადები მაჩვენე', 'რა არის PTI?', 'დღეს რამდენი შემიძლია?'])], ctx, mood: 'calm' }
      const ms = Math.round(e.medianSurplus)
      const text = `${inst.name} (${gel(inst.amount)}/თვე) ${GEN[inst.lastCycle[1]]} შენატანით სრულდება — ${inst.left} შენატანი დარჩა. მის შემდეგ თვეში ~${gel(inst.amount)}-ით მეტი დაგრჩება.`
      return { msgs: [jkFit(text, ['მერე რამდენი დამრჩება თვეში?', 'დღეს რამდენი შემიძლია?', 'რა არის PTI?'], undefined, `ახლა თვის ბოლოს ჩვეულებრივ ~${gel(Math.max(0, ms))} რჩება; მისი დასრულების შემდეგ — ~${gel(Math.max(0, ms) + inst.amount)}.`)], ctx: { ...ctx, kind: null, myDebt: true, topic: undefined }, mood: 'calm' }
    }
    // "ხელფასი ჩამერიცხა, პირველ რიგში რა გადავიხადო?": the month's bills in the order they fall due after payday, and the facts about paying late (the order is the person's choice)
    if (q.billsOrder && haveOverride === undefined) {
      const after = (d: number) => (d - p.paydayDay + 31) % 31
      const list = [...p.fixed].sort((a, b) => after(a.day) - after(b.day)).map(f => `${f.name} ${f.range ? '~' : ''}${gel(f.amount)} — ${f.day}-ში`)
      const head = `${payday ? `ხელფასი დღესაა (${gel(p.salary)}). ` : ''}თვის გადასახდელი ${gel(e.fixedTotal)}-ია, თარიღებით: `
      const big = [...p.fixed].sort((a, b) => b.amount - a.amount)[0]
      const text = `${head}${list.join(', ')}.`.length <= 160 ? `${head}${list.join(', ')}.`
        : `${payday ? `ხელფასი დღესაა (${gel(p.salary)}). ` : ''}თვის გადასახდელი ${gel(e.fixedTotal)}-ია — ${list.length} გადასახადი, ყველაზე დიდი: ${big.name} (${gel(big.amount)}, ${big.day}-ში) — სია თარიღებით 👇`
      const nx = payday ? nextPay() : undefined
      const info = joinInfo('რომელი პირველად, შენი გადაწყვეტილებაა. ფაქტები: სესხის შენატანის დაგვიანებას ჯარიმა (დღეში დარჩენილი ძირის 0,27%-მდე) და საკრედიტო ისტორიაში ჩანაწერი მოსდევს; ქირისა და კომუნალურის დაგვიანების შედეგს ხელშეკრულება ან კომპანიის წესი ადგენს.',
        nx !== undefined ? `ჩვეული ხარჯით მომდევნო ხელფასამდე ${leftOrShort(nx)}.` : undefined)
      const card: ChatCard = { kind: 'concept', data: { title: 'თვის გადასახდელი', more: billsLine(e, p), mine: list.join('; ') + '.', rule: 'სესხის შენატანის დაგვიანება საკრედიტო ისტორიაში ჩანს და ჯარიმა ემატება.' } }
      return { msgs: [jk(text, ['როგორ ვთხოვო გადავადება?', 'გადახდა თუ დამიგვიანდა?', 'დღეს რამდენი შემიძლია?'], card, info)], ctx: { ...ctx, topic: undefined }, mood: 'calm' }
    }
    if (q.bills && haveOverride === undefined) {
      const due = dueLine(p, dayIdx)
      // a bill named ("კომუნალურები?"): its date, before or after payday, and what the money named earlier covers
      const named = BILL_KINDS.filter(([re]) => re.test(lower)).flatMap(([, k]) => k)
      const items = p.fixed.filter(f => named.includes(f.kind))
      if (items.length) {
        const payDate = p.paydayLabel.split(', ')[1] ?? p.paydayLabel
        const parts = items.map(f => {
          const d = p.due.find(x => x.name === f.name && x.dayIndex >= dayIdx)
          return `${f.name} ${f.range ? '~' : ''}${gel(f.amount)} — ${d ? `${d.date}, ხელფასამდე` : `თვის ${f.day}-ში, ხელფასის (${payDate}) შემდეგ`}`
        })
        const have = ctx.onHand
        const tail = have !== undefined ? ` ხელფასამდე შენი ${gel(have)}-დან ${due ? `მხოლოდ ${due} იხდება` : 'გადასახადი არ იხდება'}.` : ` ხელფასამდე გადასახდელი: ${due || 'არაფერი'}.`
        return { msgs: [jkFit(`${parts.join('; ')}.${tail}`, ['ჩემი გადასახადები მაჩვენე', 'ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'], undefined, billsLine(e, p))], ctx, mood: 'calm' }
      }
      return { msgs: [jkFit(billsLine(e, p), ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: landingNow() } }, `ხელფასამდე გადასახდელი: ${due || 'არაფერი'}.`)], ctx, mood: 'calm' }
    }
    const daily = haveOverride !== undefined ? undefined : dailyOverride ?? q.daily
    // a habit already in the spending ("ყოველდღე 10 ლარს ყავაში ვხარჯავ"), or a daily spend asked on payday: the month's total and its share of income
    const habit = (q.dailyHabit || (dailyOverride !== undefined && !!ctx.dailyHabit)) && daily !== undefined && (dailyOverride !== undefined ? (ctx.daily ?? daily) : daily) <= e.avgDaily
    if (daily !== undefined && (habit || payday)) {
      const dTxt = gel(daily, daily % 1 ? 1 : 0)
      const month = Math.round(daily * 30)
      const share = Math.round(month / p.salary * 100)
      const now = ctx.daily !== undefined ? Math.round(ctx.daily * 30) : undefined
      const text = dailyOverride !== undefined && q.everyN && now !== undefined
        ? `${q.everyN} დღეში ერთხელ — თვეში ~${gel(month)}, ანუ ~${gel(now - month)}-ით ნაკლები, ვიდრე ახლა (~${gel(now)}).`
        : `დღეში ${dTxt} თვეში ~${gel(month)}-ია — შემოსავლის (${gel(p.salary)}) ~${share}%.${habit ? ` ეს შენს ჩვეულ დღიურ ხარჯში (~${gel(avg)}) უკვე ითვლება.` : ` თუ ეს ჩვეული ხარჯის გარდაა, მომდევნო ხელფასამდე ${leftOrShort(nextPay(month))}.`}`
      const info = habit ? `ჩვეული დღიური ხარჯი ~${gel(avg)}-ია: ის ყველაფერს მოიცავს, რასაც ყოველდღე ხარჯავ. ${dTxt} მისი ~${Math.round(daily / e.avgDaily * 100)}%-ია.` : nextPayInfo(month)
      const chips = dailyOverride !== undefined ? ['რამდენს ვხარჯავ თვეში?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?', 'დღეს რამდენი შემიძლია?'] : ['2 დღეში ერთხელ რომ იყოს?', 'რამდენს ვხარჯავ თვეში?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?']
      return { msgs: [jkFit(text, chips, undefined, info)], ctx: { kind: null, daily: dailyOverride !== undefined ? ctx.daily : daily, dailyHabit: habit }, mood: 'calm' }
    }
    if (daily !== undefined) {
      const total = Math.round(daily * days)
      const dTxt = gel(daily, daily % 1 ? 1 : 0)
      const msgs = purchaseAnswer(e, p, total, `დღეში ${dTxt} × ${days}`, day0 ? undefined : landingNow(), day0, demo.extra, dayIdx)
      const r = msgs[0].card!.data.r
      const left = r.p50 > 0 ? `~${fmt(r5(r.p50))} ₾ დაგრჩება` : `~${fmt(Math.max(5, r5(-r.p50)))} ₾ დაგაკლდება`
      const head = dailyOverride !== undefined && q.everyN ? `${q.everyN} დღეში ერთხელ — ესაა დღეში ~${dTxt}: ხელფასამდე (${days} დღე) ~${gel(total)}.` : `დღეში ${dTxt} ხელფასამდე (${days} დღე) ${gel(total)}-ია.`
      msgs[0] = withInfo({ ...msgs[0], text: `${head} თუ ეს ჩვეული ხარჯის გარდაა, ${left} 👇`, chips: (dailyOverride !== undefined ? ['მარტივად ამიხსენი', 'ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?'] : ['2 დღეში ერთხელ რომ იყოს?', 'ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?']) }, `შენი ჩვეული ხარჯი დღეში ~${gel(avg)}-ია და პროგნოზში უკვე ითვლება. ${cushionInfo(e, p)}`)
      return { msgs, ctx: { kind: 'purchase', amount: total, daily: dailyOverride !== undefined ? ctx.daily : daily }, mood: 'calm' }
    }
    const have = haveOverride ?? q.onHand!
    // payday: the salary lands on top of the money named; the month's bills come out of it
    if (payday) {
      const left = Math.round(have + p.salary - e.fixedTotal)
      const per = Math.round(Math.max(0, left) / 30)
      const text = `ხელფასი დღესაა: ${gel(have)}-ს დღეს ${gel(p.salary)} ემატება. თვის გადასახადების (${gel(e.fixedTotal)}) შემდეგ ~${gel(left)} რჩება — ${perDayText(per, 30, avg)}.`
      return { msgs: [jkFit(text, ['ჩემი გადასახადები მაჩვენე', 'დღეს რამდენი შემიძლია?', 'რამდენ ხანში დავაგროვებ 1000 ლარს?'], undefined, `ვითვლი შენ მიერ დასახელებული ${gel(have)}-ით. ${billsLine(e, p)}`)], ctx: { kind: null, onHand: have }, mood: 'calm' }
    }
    // bills still due before payday come out of the money on hand first (cash in hand: bills usually go from the card, which is said)
    const cash = haveOverride !== undefined ? !!cashOverride : !!q.cash
    const dues = duesNow()
    const dueTotal = dueSum()
    const dueUsed = cash ? 0 : dueTotal
    const per = Math.round(Math.max(0, have - dueUsed) / days)
    // "…ხელფასამდე ვიცოცხლებ?": a plain verdict first
    const ask = haveOverride !== undefined || /მეყოფა|ვიცოცხლებ|გავძლებ|გავწვდები|ვივლი|გავალ|ვიარსებებ/.test(lower)
    const verdict = ask ? (per >= avg ? 'სავარაუდოდ კი' : per >= avg * 0.6 ? 'მჭიდროდ' : 'ჩვეული ტემპით — არა') : undefined
    // children named, or the support persona: a short calm acknowledgement and the salary date
    const careAck = isSupport(p) || /შვილ|ბავშვ/.test(lower)
    const lead = careAck ? 'გასაგებია, რომ მჭიდროა. ' : verdict ? `${verdict}: ` : ''
    const dayWord = days <= 1 ? 'ხელფასამდე 1 დღეა' : `${days} დღეზე`
    // the key comparison is visible: a day's money now against the usual day
    // cash with bills due: both readings, the cash alone and the cash as all the money there is
    const perAll = Math.round(Math.max(0, have - dueTotal) / days)
    const cashBoth = cash && dues.length && days > 1 ? (dueTotal < have ? `${lead}${gel(have)} ${days} დღეზე დღეში ~${gel(per)}-ია; თუ ეს მთელი ფულია, გადასახადების (~${gel(dueTotal)}) შემდეგ — ~${gel(perAll)} (ჩვეულებრივ ~${gel(avg)}).` : `${lead}${gel(have)} ${days} დღეზე დღეში ~${gel(per)}-ია; თუ ეს მთელი ფულია, ხელფასამდე გადასახდელი (~${gel(dueTotal)}) მასზე მეტია.`) : undefined
    let text = cashBoth && cashBoth.length <= 160 ? cashBoth : cash || !dues.length ? `${lead}${gel(have)} ${dayWord}${days <= 1 ? ` — ჩვეულებრივ დღეში ~${gel(avg)}-ს ხარჯავ.` : ` დღეში ~${gel(per)}-ია — ჩვეულებრივ კი ~${gel(avg)}-ს ხარჯავ.`}`
      : dueTotal < have ? (careAck && daysLeft > 0 ? `${lead}${gel(have)}-დან გადასახადების (~${gel(dueTotal)}) შემდეგ ~${gel(have - dueTotal)} დარჩება — ხელფასი ${days} დღეში, ${dative(p.paydayLabel).split(', ')[1] ?? ''} ჩაირიცხება.` : `${lead}${gel(have)}-დან გადასახადების (~${gel(dueTotal)}) შემდეგ ~${gel(have - dueTotal)} დარჩება: ${perDayText(per, days, avg)}.`)
        : `${lead}ხელფასამდე გადასახდელი (~${gel(dueTotal)}) ${gel(have)}-ზე მეტია: ~${gel(Math.max(5, r5(dueTotal - have)))} დაგაკლდება, ყოველდღიური ხარჯის გარეშეც.`
    const payWhen = ` ხელფასი ${days} დღეში, ${dative(p.paydayLabel).split(', ')[1] ?? ''} ჩაირიცხება.`
    if (careAck && daysLeft > 0 && !/ჩაირიცხება/.test(text) && `${text}${payWhen}`.length <= 160 && !/[.!?].+[.!?]/.test(text)) text += payWhen
    const info = joinInfo(!cash && dues.length ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined, careAck && !cash && dues.length && dueTotal < have ? `${perDayText(per, days, avg)}.` : undefined,
      cash ? `ვითვლი შენ მიერ დასახელებული ${gel(have)}-ით; ბარათებზე შენს მონაცემებში ${gel(Math.round(balNow()))}-ია — ის აქ არ შედის.${dues.length ? ` ხელფასამდე გადასახდელი (ჩვეულებრივ ბარათიდან): ${dueLine(p, dayIdx)}.` : ''}` : 'ვითვლი შენ მიერ დასახელებული თანხით.')
    return { msgs: [jkFit(text, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', dues.length ? 'ჩემი გადასახადები მაჩვენე' : 'მარტივად ამიხსენი'], undefined, info)], ctx: { kind: null, onHand: have, cash: cash || undefined }, mood: 'calm' }
  }

  /** "13 დღეზე დღეში ~9 ₾, ჩვეულებრივ კი ~13 ₾-ს ხარჯავ": a day's money against the usual day */
  function perDayText(per: number, days: number, avg: number) {
    if (days <= 1) return `ხელფასამდე 1 დღეა — ჩვეულებრივ დღეში ~${gel(avg)}-ს ხარჯავ`
    return per < avg ? `${days} დღეზე დღეში ~${gel(per)}, ჩვეულებრივ კი ~${gel(avg)}-ს ხარჯავ` : `${days} დღეზე დღეში ~${gel(per)} — ჩვეულ ~${gel(avg)}-ზე მეტი`
  }

  /** a purchase counted from the money the person says they have ("500 ლარი მაქვს და 300-იანი ქურთუკი ვიყიდო?") */
  function onHandPurchase(have: number, amount: number, item?: string, cash?: boolean): Reply {
    const days = Math.max(1, daysLeft)
    const avg = Math.round(e.avgDaily)
    const dues = duesNow()
    const dueTotal = dueSum()
    const rest = have - amount - dueTotal
    const a = gel(amount, amount % 1 ? 2 : 0)
    // cash in hand ("ხელზე 60 ლარი"): the cash question first; the card balance in the data is separate and said so
    if (cash) {
      const bal = Math.round(balNow())
      const left = landingNow().p50
      const t1 = have >= amount ? `ხელზე ${gel(have)}-დან ${a}-ის შემდეგ ${gel(Math.round((have - amount) * 100) / 100)} დაგრჩება.` : `ხელზე ${gel(have)} ${a}-ს ვერ ფარავს — ~${gel(Math.ceil(amount - have))} აკლია.`
      const t2 = ` ნაღდს შენს მონაცემებში ვერ ვხედავ: ბარათებზე ${gel(bal)}-ია და ხელფასამდე სავარაუდოდ ${leftOrShort(left)}.`
      const text = `${t1}${t2}`.length <= 160 ? `${t1}${t2}` : t1
      const info = joinInfo(text === t1 ? t2.trim() : undefined, dues.length ? `ხელფასამდე გადასახდელი (ჩვეულებრივ ბარათიდან): ${dueLine(p, dayIdx)}.` : undefined, 'თუ ხელზე არსებული ფული შენი მთელი თანხაა, მომწერე — მაშინ გადასახადებსაც მისგან დავთვლი.')
      return { msgs: [jk(text, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი'], undefined, info)], ctx: { kind: 'purchase', amount, item, onHand: have, cash: true }, mood: 'calm' }
    }
    const text = rest > 0
      ? `${gel(have)}-დან ${a}-ის${dueTotal ? ` და გადასახადების (~${gel(dueTotal)})` : ''} შემდეგ ~${gel(rest)} დარჩება: ${perDayText(Math.round(rest / days), days, avg)}.`
      : `${gel(have)}-დან ${a}-ის${dueTotal ? ` და გადასახადების (~${gel(dueTotal)})` : ''} შემდეგ ხელფასამდე ~${gel(Math.max(5, r5(-rest)))} დაგაკლდება, ყოველდღიური ხარჯის გარეშეც.`
    const info = joinInfo(dues.length ? `ხელფასამდე გადასახდელი: ${dueLine(p, dayIdx)}.` : undefined, 'ვითვლი შენ მიერ დასახელებული თანხით.')
    return { msgs: [jkFit(text, ['ხელფასამდე მეყოფა?', 'დღეს რამდენი შემიძლია?', 'მარტივად ამიხსენი'], undefined, info)], ctx: { kind: 'purchase', amount, item, onHand: have }, mood: rest > avg * days ? 'happy' : 'calm' }
  }

  /** a microloan priced with the user's own numbers: borrow `principal`, pay back `repay` */
  function microRepay(principal: number, repay: number, days?: number): Reply {
    const cost = repay - principal
    const share = cost / principal * 100
    const shareTxt = `${fmt(share, share % 1 ? 1 : 0)}%`
    const msgs: ChatMsg[] = []
    let yearly: number | undefined
    let card: ChatCard | undefined
    if (days === undefined || days <= 45) {
      // one repayment inside the next pay cycle: the engine prices it as a one-month loan
      const rate = cost / principal
      const t = { ...e.installment({ price: principal, months: 1, ratePerMonth: rate }), label: `${days ?? 30} დღე · ${shareTxt}` }
      yearly = eirPct(rate)
      card = tenorCard(e, [t], `${gel(principal)} მიკროსესხი`, undefined, (debtNow(p) - e.laptop) / p.salary * 100)
    } else {
      yearly = (Math.pow(repay / principal, 365 / days) - 1) * 100
    }
    const yearTxt = yearly > 1000 ? '1 000%-ზე მეტი' : `~${fmt(Math.round(yearly))}%`
    // above the legal 50% the fact is in the visible line (the explanation stays behind the ⓘ)
    const text = `${gel(principal)}-ზე ${gel(repay)}-ს დააბრუნებ${days ? ` ${days} დღეში` : ''}: სესხის ფასი ${gel(cost)}, ანუ ${shareTxt}. წლიურად ეს ${yearly > 1000 ? '1 000%-ზე მეტია' : `${yearTxt}-ია`}${yearly > 50 ? ' — კანონით დაშვებულ 50%-ზე მეტი' : ''}${card ? ' 👇' : '.'}`
    msgs.push(jk(text, ['გადახდა თუ დამიგვიანდა?', 'რა არის ეფექტური განაკვეთი?'], card, `${MICRO_INFO}${yearly > 50 ? ` შენი ციფრებით გამოდის ${yearTxt} — კანონით დაშვებულ 50%-ზე მეტი.` : ''}`))
    return { msgs, ctx: { kind: 'micro', amount: principal, days, repay }, mood: 'calm' }
  }
}
