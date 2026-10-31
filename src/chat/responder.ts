import { Engine, TenorResult, WEATHER_LABEL, WEATHER_ICON, weatherOf } from '../engine/engine'
import { Persona } from '../engine/personas'
import { ChatMsg, ChatCard } from '../state/store'
import { parse, Parsed, ConceptId } from './parser'
import { fmt, gel, rangeText } from '../engine/view'

export interface Ctx {
  kind: 'purchase' | 'installment' | 'loan' | null
  amount?: number
  months?: number
  ratePerMonth?: number
  /** the rate as the user wrote it, e.g. "18% წლიური" */
  rateText?: string
  startOffset?: number
  upfront?: number
  item?: string
}

const UNTIL: Record<number, string> = { 1: 'იანვრამდე', 2: 'თებერვლამდე', 3: 'მარტამდე', 4: 'აპრილამდე', 5: 'მაისამდე', 6: 'ივნისამდე', 7: 'ივლისამდე', 8: 'აგვისტომდე', 9: 'სექტემბრამდე', 10: 'ოქტომბრამდე', 11: 'ნოემბრამდე', 12: 'დეკემბრამდე' }

const FROM: Record<number, string> = { 1: 'იანვრიდან', 2: 'თებერვლიდან', 3: 'მარტიდან', 4: 'აპრილიდან', 5: 'მაისიდან', 6: 'ივნისიდან', 7: 'ივლისიდან', 8: 'აგვისტოდან', 9: 'სექტემბრიდან', 10: 'ოქტომბრიდან', 11: 'ნოემბრიდან', 12: 'დეკემბრიდან' }

/** a Jikho message can carry a secondary explanation, shown behind the ⓘ pop-up (older saved messages have none) */
export type JikhoMsg = ChatMsg & { info?: string }
const withInfo = (m: ChatMsg, info?: string): JikhoMsg => (info ? { ...m, info } : m)

let seq = 1
const id = () => `m${Date.now()}_${seq++}`
const r5 = (v: number) => Math.round(v / 5) * 5
const r10 = (v: number) => Math.round(v / 10) * 10

export const START_CHIPS = ['100 ₾-ის ფეხსაცმელი ვიყიდო?', '1 200 ₾-ის ტელეფონი განვადებით', '2 000 ₾ სესხი 24 თვით', 'დღეს რამდენი შემიძლია?']

export function greeting(p: Persona): ChatMsg {
  return {
    id: id(), from: 'jikho',
    text: `გამარჯობა, ${p.name}! ჯიხო ვარ 🐐\nმკითხე შესყიდვაზე, განვადებაზე ან სესხზე — გაჩვენებ ხელფასამდე „ამინდს".`,
    chips: START_CHIPS,
  }
}

/** months between first cycle (ending Dec 2026) and the cycle that contains the first payment */
function offsetForStartMonth(m: number): number {
  // purchase in month m (Nov 2026 = now) -> first payment cycle ends in m+1
  const monthsFromNov = (m - 11 + 12) % 12
  return monthsFromNov
}

function itemWord(item?: string) { return item ? item : 'შესყიდვა' }

function daysText(p50: number, avg: number) {
  if (p50 <= 0) return 'ანუ ფული ხელფასამდე სავარაუდოდ არ გეყოფა'
  const d = p50 / avg
  return d < 1.5 ? 'ეს დაახლოებით ერთი დღის ხარჯია' : `ეს დაახლოებით ${Math.round(d)} დღის ხარჯია`
}

function purchaseAnswer(e: Engine, p: Persona, amount: number, item?: string, landingNow?: { p10: number; p50: number; p90: number; weather: any }, day0 = true, extraNow = 0, dayIdx = 0): ChatMsg[] {
  const r = day0 ? e.purchaseCheck(amount) : { ...e.forecastAtDay(dayIdx, e.demoPathIndex(), extraNow + amount).landing, amount, afterPayday: Math.round(e.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - amount) }
  const base = landingNow ?? e.landing
  let text = r.p50 > 0
    ? `თუ დღეს ${gel(amount)} დახარჯავ, ხელფასის დღეს სავარაუდოდ ~${fmt(r5(r.p50))} ₾ დაგრჩება — ${daysText(r.p50, e.avgDaily)}.`
    : `თუ დღეს ${gel(amount)} დახარჯავ, ფული ხელფასამდე სავარაუდოდ არ გეყოფა: დაგაკლდება ~${fmt(Math.max(5, r5(-r.p50)))} ₾.`
  const chips: string[] = []
  const more: ChatMsg[] = []
  if (r.weather === 'storm' || r.weather === 'rain') {
    chips.push('ხელფასის შემდეგ რომ ვიყიდო?')
    if (amount >= 300) chips.push('განვადებით რა იქნება?', 'რამდენ ხანში დავაგროვებ?')
    else chips.push('დღეს რამდენი შემიძლია?')
  } else {
    chips.push(`და ${r10(amount * 2)} ₾ რომ იყოს?`, 'დღეს რამდენი შემიძლია?')
  }
  if (amount > e.spendable) {
    text = `ამდენი ფული ახლა ანგარიშზე არ გაქვს (ხელმისაწვდომია ${gel(e.spendable)}).`
  }
  return [{ id: id(), from: 'jikho', text, card: { kind: 'purchase', data: { amount, item, r, base: { p10: base.p10, p50: base.p50, p90: base.p90, weather: base.weather }, cushion: e.cushion, afterPayday: r.afterPayday } }, chips }, ...more]
}

function tenorCard(e: Engine, rows: TenorResult[], title: string, note?: string): ChatCard {
  return { kind: 'installment', data: { title, cushion: e.cushion, salary: e.p.salary, laptop: e.p.installment, rows: rows.map(t => ({ label: t.label, monthly: t.monthly, total: t.total, cost: t.cost, eir: t.eirPct, pti: t.ptiNowPct, nShort: t.nShort, short: t.shortLabels, window: t.window.map(c => ({ label: c.label, p50: c.p50, p10: c.p10, pBelow: c.pBelow })), maxPBelow: t.maxPBelow, months: t.months, principal: t.principal, startLabel: t.startLabel })), note } }
}

/** "1,5%/თვე": one decimal unless a second one is needed */
function monthlyRateText(rate: number) {
  const pct = rate * 100
  const d = Math.abs(pct * 10 - Math.round(pct * 10)) > 1e-6 ? 2 : pct % 1 ? 1 : 0
  return `${fmt(pct, d)}%/თვე`
}

function shortText(t: TenorResult) {
  if (t.nShort === 0) return 'ყველა თვეში ხელფასამდე ზღვარს ზემოთ დარჩები'
  if (t.nShort >= Math.max(7, t.window.length - 2)) return 'თითქმის ყველა თვეში ხელფასამდე ზღვარს ქვემოთ ჩახვალ'
  const of = t.window.length < t.months ? `პირველი ${t.window.length} თვიდან ${t.nShort}-ში` : `${t.window.length}-დან ${t.nShort} თვეში`
  return `${of} ხელფასამდე ზღვარს ქვემოთ ჩახვალ`
}

function installmentAnswer(e: Engine, p: Persona, c: Ctx, kind: 'installment' | 'loan'): ChatMsg[] {
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
  if (c.months) rows = [tenor(c.months, rate, `${c.months} თვე · ${rateTxt}`)]
  else if (kind === 'loan') rows = [12, 24, 36].map(m => tenor(m, rate, `${m} თვე · ${rateTxt}`))
  else rows = [tenor(4, 0, '4 თვე · 0%'), tenor(12, rate, `12 თვე · ${rateTxt}`), tenor(24, rate, `24 თვე · ${rateTxt}`)]

  // whole percent, except right at the 25% limit (24,7% must not read as 25%)
  const pct = (v: number) => (Math.round(v) === 25 ? fmt(v, 1) : fmt(Math.round(v)))
  const ptis = rows.map(t => t.ptiNowPct)
  const lo = pct(Math.min(...ptis)), hi = pct(Math.max(...ptis))
  const ptiLine = `ბანკი PTI-ს უყურებს: შემოსავლის ${lo === hi ? lo : `${lo}–${hi}`}% სესხებზე წავა. შენს ყოველდღიურ ხარჯს კი ვერ ხედავს — ფერადი თვეები სწორედ ამას აჩვენებს.`
  const ptiInfo = '2027-დან PTI-ის ლიმიტი 25% იქნება.'
  const save = e.monthsToSave(price - upfront)
  const cashLine = Number.isFinite(save) && save <= 24 ? `სესხის გარეშე: თუ თვეში დარჩენილ ~${gel(Math.round(e.medianSurplus))}-ს გადადებ, ${gel(price - upfront)} ~${save} თვეში დაგროვდება.` : ''
  const chips: string[] = []
  if (p.installment && start === 0) chips.push(`და თუ ${UNTIL[p.installment.lastCycle[1]]} დავიცადო?`)
  if (!c.months) chips.push(kind === 'loan' ? '48 თვეზე?' : '6 თვეზე?')
  if (p.savings && !upfront) chips.push(`${Math.min(300, Math.round(p.savings.amount / 100) * 100 - 100)} ₾ დანაზოგიდან წინასწარ`)
  chips.push('რა არის PTI?', 'რა არის ეფექტური განაკვეთი?')

  let compare: any = null
  if (start > 0 && rows.length === 1) {
    const t = rows[0]
    const now = e.installment({ price, months: t.months, ratePerMonth: rate, upfront })
    const now24 = e.installment({ price, months: 24, ratePerMonth: rate, upfront })
    // each box shows the worst month's weather of that option
    compare = { from: FROM[startMonth], months: t.months, nowShort: now.nShort, nowWeather: weatherOf(now.maxPBelow), short: t.nShort, weather: weatherOf(t.maxPBelow), cost: t.cost, cost24: now24.cost }
  }

  const card = tenorCard(e, rows, title, isExampleRate ? `განაკვეთი სამაგალითოა (${rateTxt}). მომწერე შენი — გადავითვლი.` : undefined)
  card.data.compare = compare
  const t0 = rows[0]
  const first = compare
    ? `თუ ${compare.from} დაიწყებ (${t0.months} თვით) 👇`
    : rows.length > 1
      ? `აი, ${rows.length} ვარიანტი შენს თვეებზე 👇`
      : `${what}, ${t0.months} თვით: თვეში ~${gel(Math.round(t0.monthly))}. ${shortText(t0)} 👇`
  const second = compare && compare.short === 0 && compare.nowShort > 0 && compare.cost24 > compare.cost
    ? { text: 'ასეთ შედარებას განვადების გაფორმებისას იშვიათად ნახავ 🐐', chips: ['24 თვეზე?', 'რა არის PTI?', 'დღეს რამდენი შემიძლია?'] }
    : { text: [ptiLine, cashLine].filter(Boolean).join('\n'), chips, info: ptiInfo }
  return [
    { id: id(), from: 'jikho', text: first, card },
    withInfo({ id: id(), from: 'jikho', text: second.text, chips: second.chips }, 'info' in second ? second.info : undefined),
  ]
}

const CONCEPT_TEXT: Record<ConceptId, (e: Engine, p: Persona) => { title: string; body: string; more?: string; mine: string; rule: string }> = {
  pti: (e, p) => ({
    title: 'PTI — შემოსავლის რა წილი მიდის სესხებზე',
    body: 'PTI = ყველა სესხისა და განვადების თვიური შენატანი, გაყოფილი ხელზე ასაღებ შემოსავალზე.',
    more: 'ბანკი მას ერთხელ ითვლის — სესხის გაცემისას. ეროვნული ბანკის კომიტეტის 2026 წლის 30 სექტემბრის გადაწყვეტილებით, 2027 წლის 1 თებერვლიდან 2 000 ₾-მდე შემოსავალზე PTI-ის ლიმიტი 25% იქნება.',
    mine: `შენი შენატანები ახლა: ${gel(e.laptop)} თვეში → PTI ${fmt(e.laptop / p.salary * 100, 1)}%. ლიმიტი შენთვის: ${gel(p.salary * 0.25)} თვეში.`,
    rule: 'თუ PTI-ის ლიმიტში ჯდები, ეს არ ნიშნავს, რომ თვეს გაუძლებ — PTI შენს ხარჯებს და გადახდის თარიღებს ვერ ხედავს.',
  }),
  eir: () => ({
    title: 'ეფექტური წლიური განაკვეთი',
    body: 'ეფექტური განაკვეთი გიჩვენებს სესხის რეალურ ფასს წელიწადში — საკომისიოებისა და რთული პროცენტის ჩათვლით.',
    more: '1,5% თვეში პატარა ჩანს, მაგრამ წელიწადში ~19,6%-ია: ყოველ თვეს პროცენტი წინა თვეების პროცენტსაც ერიცხება.',
    mine: '1 200 ₾ 12 თვით, 1,5%-ით: თვეში 110 ₾, ჯამში 1 320 ₾. აქედან 120 ₾ სესხის ფასია.',
    rule: 'შეადარე ეფექტური განაკვეთი და ჯამური ფასი, არა მხოლოდ თვიური შენატანი.',
  }),
  compound: () => ({
    title: 'რთული პროცენტი',
    body: 'მარტივი პროცენტი მხოლოდ საწყის თანხას ერიცხება, რთული — უკვე დარიცხულ პროცენტსაც.',
    more: '1 000 ₾ წლიური 10%-ით, 20 წელიწადში: მარტივით 3 000 ₾ დაგროვდება, რთულით — 6 727 ₾. სხვაობა 3 727 ₾-ია.',
    mine: 'იგივე წესი სესხზეც მუშაობს — შენს საწინააღმდეგოდ. ამიტომ გრძელი ვადა ძვირია.',
    rule: 'დრო ზრდის დანაზოგსაც და ვალსაც: რაც ადრე იწყება დაზოგვა და რაც ადრე იფარება ვალი, მით უკეთესია შენთვის.',
  }),
  cushion: (e, p) => ({
    title: 'უსაფრთხო ზღვარი (ბალიში)',
    body: 'უსაფრთხო ზღვარი არის თანხა, რომელზე ნაკლები ხელფასამდე არ გინდა დაგრჩეს.',
    more: 'თავიდან ის შენი 3 დღის ჩვეული ხარჯია — დაახლოებით ერთი შაბათ-კვირა და კიდევ ერთი დღე. შეგიძლია 2-დან 7 დღემდე შეცვალო.',
    mine: `შენი ზღვარი: ${gel(e.cushion)} (3 დღე × ~${gel(Math.round(e.avgDaily))}).`,
    rule: 'ამინდი გიჩვენებს, რა შანსია, რომ ზღვარს ქვემოთ ჩახვალ: მზე — 10%-ზე ნაკლები, ღრუბელი — 10–30%, წვიმა — 30–60%, ქარიშხალი — 60%-ზე მეტი.',
  }),
  weather: e => ({
    title: 'როგორ ვითვლი ამინდს',
    body: 'ხელფასამდე დარჩენილ დღეებს 1 000 შესაძლო სცენარით ვითვლი, ამიტომ გაჩვენებ შუალედს და არა ერთ რიცხვს.',
    more: 'სცენარები შენს ბოლო 6 თვის ხარჯებს ეყრდნობა: ვპოულობ განმეორებად გადასახადებს და ვნახულობ, კვირის რომელ დღეს რამდენს ხარჯავ. ხელოვნური ინტელექტი არცერთ რიცხვს არ იგონებს.',
    mine: `ახლა: ${rangeText(r10(e.landing.p10), r10(e.landing.p90))}, ყველაზე სავარაუდოდ ~${fmt(r10(e.landing.p50))} ₾. ამინდი — ${WEATHER_LABEL[e.landing.weather]}.`,
    rule: 'შემდეგი ხელფასის მიღმა პროგნოზი მიახლოებითია: ვვარაუდობ, რომ შენი ბოლო თვეები განმეორდება.',
  }),
  zero: () => ({
    title: '0%-იანი განვადება',
    body: '0%-იან განვადებაზე პროცენტს არ იხდი, მაგრამ ვადა მოკლეა და თვიური შენატანი — დიდი.',
    more: 'ზოგჯერ ფასი ნივთის ღირებულებაში ან საკომისიოშია დამალული, ამიტომ ნახე ჯამური თანხა.',
    mine: '1 200 ₾ 4 თვით, 0%-ით = 300 ₾ თვეში. იაფია, მაგრამ შენს თვიურ ბიუჯეტში შეიძლება ვერ ჩაეტიოს.',
    rule: '„იაფი" და „ჩემს თვეში ჯდება" სხვადასხვა კითხვაა.',
  }),
  installment: () => ({
    title: 'განვადება და სესხი',
    body: 'განვადება კონკრეტული ნივთის საყიდლად აღებული სესხია, ხშირად მაღაზიაშივე.',
    more: 'ჩვეულებრივ სესხს კი ფულად იღებ. ორივეზე თვიურ შენატანს იხდი და ორივე PTI-ში ითვლება.',
    mine: 'სანამ ხელს მოაწერ, მკითხე — ყველა ვადას შენს თვეებზე გაჩვენებ.',
    rule: 'შეადარე ჯამური ფასი, ეფექტური განაკვეთი და ის თვეები, როცა შეიძლება ფული არ გეყოს.',
  }),
  overdraft: () => ({
    title: 'ოვერდრაფტი',
    body: 'ოვერდრაფტი ბანკის ფულია, რომლითაც ანგარიშზე ნულს ქვემოთ შეგიძლია ჩახვიდე.',
    more: 'პროცენტი დღიურად ერიცხება და ხშირად მაღალია. მას შენს ფულად არ ვთვლი — ცალკე გაჩვენებ.',
    mine: 'თუ ყოველთვე ოვერდრაფტით გადიხარ, კარგი თვე ასე გამოიყურება: ხელფასამდე გამოყენებული ოვერდრაფტი წინა თვეზე ნაკლებია.',
    rule: 'ოვერდრაფტი გადაუდებელი დახმარებაა და არა ხელფასის ნაწილი.',
  }),
  deposit: (e, p) => ({
    title: 'ანაბარი და გადაუდებელი ფონდი',
    body: 'გადაუდებელი ფონდი 3–6 თვის აუცილებელი ხარჯის ოდენობის მარაგია: ის მოულოდნელ ხარჯს სესხის გარეშე ფარავს.',
    more: 'მიზნობრივ ანაბარზე ფული ცალკე ინახება და პროცენტიც ერიცხება.',
    mine: p.savings ? `შენი ქვევრი „${p.savings.name}": ${gel(p.savings.amount)} / ${gel(p.savings.target)}.` : 'ყოველ ხელფასზე პატარა თანხის გადადებაც — თუნდაც 20–50 ₾ — ჩვევას ქმნის.',
    rule: 'ჯერ საკუთარ თავს გადაუხადე: დანაზოგი ხელფასის დღეს გადადე, არა თვის ბოლოს.',
  }),
  inflation: () => ({
    title: 'ინფლაცია',
    body: 'ინფლაცია ფასების ზრდაა.',
    more: 'თუ ფასები წელიწადში 5%-ით იზრდება, შენი ფული კი — არა, წლის ბოლოს იგივე თანხით ნაკლებს იყიდი.',
    mine: 'სახლში შენახული 100 ₾ 5%-იანი ინფლაციისას წლის ბოლოს დღევანდელ ~95 ₾-ს უდრის.',
    rule: 'ფული, რომელიც არ იზრდება, ფასს კარგავს.',
  }),
  fraud: () => ({
    title: 'თაღლითობა',
    body: 'ბანკი ტელეფონით არასდროს გთხოვს SMS-კოდს, ბარათის PIN-ს ან პაროლს.',
    more: 'არსებობს ყალბი აპები და ბმულები, მათ შორის „ხელფასამდეს" მსგავსიც — აპი მხოლოდ ოფიციალური მაღაზიიდან ჩამოტვირთე.',
    mine: 'თუ ვინმე ბანკის სახელით გირეკავს და კოდს გთხოვს — გათიშე და ბანკის ოფიციალურ ნომერზე თავად დარეკე.',
    rule: 'კოდი = ფული. კოდს არავის ეუბნებიან.',
  }),
  credithistory: () => ({
    title: 'საკრედიტო ისტორია',
    body: 'კრედიტინფოში (საკრედიტო ბიუროში) ჩანს შენი ყველა სესხი, საკრედიტო ბარათი და დაგვიანებული გადახდა.',
    more: 'ბანკი ამას სესხის გაცემამდე ამოწმებს. საკუთარი ისტორიის ნახვა შენი უფლებაა.',
    mine: 'დროული გადახდა ისტორიას აუმჯობესებს; ერთი დაგვიანებაც კი წლების განმავლობაში ჩანს.',
    rule: 'ვერ იხდი? ვადამდე დაელაპარაკე ბანკს — არა ვადის შემდეგ.',
  }),
  restructure: () => ({
    title: 'როცა ვერ იხდი',
    body: 'ბანკს შეგიძლია ვადამდე სთხოვო რესტრუქტურიზაცია: ვადის გაგრძელება ან დროებითი შეღავათი. დახმარებას გაგიწევს ეროვნული ბანკის მომხმარებელთა უფლებების სერვისი და finedu.gov.ge.',
    more: 'ჩვეულებრივ, ჯერ ქირას, კომუნალურს და საკვებს იხდიან, მერე — გირაოიან სესხებს (მაგ., სახლზე ან მანქანაზე), ბოლოს — დანარჩენს.',
    mine: 'მოდი, გადასახადები ერთად დავალაგოთ.',
    rule: 'ძველი ვალის დასაფარად აღებული ახალი სესხი ხშირად ვალს უფრო ზრდის.',
  }),
  fixed: e => ({
    title: 'ფიქსირებული და ცვალებადი ხარჯი',
    body: 'ფიქსირებული ხარჯი ყოველთვე მეორდება (ქირა, კომუნალური, განვადება). ცვალებადი დღიდან დღემდე იცვლება (საკვები, ტრანსპორტი, კაფე).',
    mine: `შენი ფიქსირებული ხარჯი: ${gel(e.fixedTotal)} — ხელფასის ${Math.round(e.fixedTotal / e.p.salary * 100)}%. ეს ფული უკვე „დაკავებულია", სანამ პირველ ლარს დახარჯავ.`,
    rule: 'ჯერ ფიქსირებული ხარჯი გამოაკელი, მერე ცვალებადი — ასე გაიგებ, რეალურად რამდენი გაქვს.',
  }),
}

export function respond(input: string, e: Engine, p: Persona, ctx: Ctx, demo: { day: number; extra: number }): { msgs: ChatMsg[]; ctx: Ctx; mood: 'happy' | 'calm' | 'worried' | 'thinking' } {
  const q: Parsed = parse(input)
  const day0 = demo.day === 0 && demo.extra === 0
  const rateTxt = (pp: Parsed): string | undefined => (pp.zeroRate ? '0%' : pp.ratePct === undefined ? undefined : `${fmt(pp.ratePct, pp.ratePct % 1 ? 1 : 0)}%${pp.rateIsAnnual ? ' წლიური' : '/თვე'}`)
  const rateFrom = (pp: Parsed): number | undefined => (pp.zeroRate ? 0 : pp.ratePct === undefined ? undefined : pp.rateIsAnnual ? pp.ratePct / 100 / 12 : pp.ratePct / 100)
  const startFrom = (pp: Parsed) => (pp.startMonth ? offsetForStartMonth(pp.startMonth) : pp.afterPayday ? 0 : undefined)

  const jk = (text: string, chips?: string[], card?: ChatCard, info?: string): ChatMsg => withInfo({ id: id(), from: 'jikho', text, chips, card }, info)

  switch (q.intent) {
    case 'greeting':
      return { msgs: [jk(`გამარჯობა! 🐐 ხელფასამდე ${p.dayPattern.length - demo.day} დღეა და ამინდი ${WEATHER_LABEL[e.landing.weather]}ა. რა შევამოწმოთ?`, START_CHIPS)], ctx, mood: 'happy' }
    case 'thanks':
      return { msgs: [jk('არაფრის! ამ ბილიკს ერთად გავდივართ ⛰️ სხვა რამეც შევამოწმოთ?', ['დღეს რამდენი შემიძლია?', 'როგორ ვითვლი ამინდს?'])], ctx, mood: 'happy' }
    case 'who':
      return { msgs: [jk('მე ჯიხო ვარ — კავკასიური ჯიხვი. მთის ბილიკზე წონასწორობას ვინარჩუნებ, შენ კი თვის ბოლომდე მისვლაში გეხმარები.', START_CHIPS, undefined, 'ყველა რიცხვი შენი ხარჯების ისტორიიდან ზუსტი ფორმულებით ითვლება — მე მხოლოდ გიხსნი.')], ctx, mood: 'happy' }
    case 'invest':
      return { msgs: [jk('ინვესტიციებზე რჩევას ვერ მოგცემ — ლიცენზირებული მრჩეველი არ ვარ.', ['რა არის ინფლაცია?', 'რა არის რთული პროცენტი?', 'რამდენ ხანში დავაგროვებ?'], undefined, 'შემიძლია აგიხსნა, რა არის რისკი, დივერსიფიკაცია (რისკის გადანაწილება) და ინფლაცია. ისიც შემიძლია გაჩვენო, რამდენი გრჩება თვეში დასაზოგად.')], ctx, mood: 'calm' }
    case 'hardship':
    case 'concept': {
      const c = CONCEPT_TEXT[q.concept!](e, p)
      return { msgs: [{ id: id(), from: 'jikho', text: c.body, card: { kind: 'concept', data: c }, chips: q.concept === 'pti' ? ['1 200 ₾-ის ტელეფონი განვადებით', 'რა არის ეფექტური განაკვეთი?'] : q.concept === 'restructure' ? ['რა არის საკრედიტო ისტორია?', 'დღეს რამდენი შემიძლია?'] : ['დღეს რამდენი შემიძლია?', 'რა არის PTI?'] }], ctx, mood: 'calm' }
    }
    case 'safe': {
      const f = day0 ? e.landing : e.forecastAtDay(demo.day, e.demoPathIndex(), demo.extra).landing
      const daysLeft = p.dayPattern.length - demo.day
      const safe = daysLeft > 0 ? Math.max(0, Math.round((f.p50 - e.cushion) / daysLeft)) : 0
      const max = day0 ? e.maxComfortablePurchase() : Math.max(0, Math.floor((f.p10 + (f.p50 - f.p10) * 0.6 - e.cushion) / 5) * 5)
      const text = safe > 0
        ? `დღეს ჩვეული ხარჯის გარდა ~${gel(safe)} თავისუფალია 👇`
        : `ხელფასამდე ჩვეული ხარჯის გარდა თავისუფალი თანხა თითქმის არ რჩება — პროგნოზი უსაფრთხო ზღვართან ახლოსაა. აუცილებელი ხარჯი, რა თქმა უნდა, მაინც აუცილებელია.`
      return { msgs: [jk(text, [`${max || 20} ₾-ის რამე ვიყიდო?`, 'როგორ ვითვლი ამინდს?'], { kind: 'safe', data: { safe, max, avg: e.avgDaily, landing: f, cushion: e.cushion, daysLeft } })], ctx, mood: safe > 0 ? 'happy' : 'calm' }
    }
    case 'forecast': {
      const f = day0 ? e.landing : e.forecastAtDay(demo.day, e.demoPathIndex(), demo.extra).landing
      const daysLeft = p.dayPattern.length - demo.day
      return { msgs: [jk(`ხელფასამდე ${daysLeft} დღეა. ${f.p50 > 0 ? `სავარაუდოდ ~${fmt(r10(f.p50))} ₾ დაგრჩება` : 'ფული სავარაუდოდ ვერ გეყოფა'} — ამინდი ${WEATHER_LABEL[f.weather]}ა ${WEATHER_ICON[f.weather]}`, ['დღეს რამდენი შემიძლია?', 'როგორ ვითვლი ამინდს?'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: f } })], ctx, mood: f.weather === 'sun' || f.weather === 'cloud' ? 'happy' : 'worried' }
    }
    case 'save': {
      const amount = q.amount ?? ctx.amount ?? 1200
      const n = e.monthsToSave(amount)
      const text = Number.isFinite(n)
        ? `თვის ბოლოს ჩვეულებრივ ~${gel(Math.round(e.medianSurplus))} გრჩება. ასე ${gel(amount)} დაახლოებით ${n} თვეში დაგროვდება. სესხის ფასი — 0 ₾.`
        : 'ახლა თვის ბოლოს არაფერი გრჩება, ამიტომ დაგროვება ჯერ ვერ გამოვა. მოდი, ჯერ ფიქსირებულ ხარჯებს გადავხედოთ.'
      const info = Number.isFinite(n)
        ? `${p.savings ? `ქვევრში არსებული ${gel(p.savings.amount)}-ის ჩათვლით — ${Math.max(0, Math.ceil((amount - p.savings.amount) / e.medianSurplus))} თვეში. ` : ''}ზამთრის თვეებში ნაკლები გრჩება.`
        : undefined
      return { msgs: [jk(text, [`${gel(amount)} განვადებით რა იქნება?`, 'რა არის გადაუდებელი ანაბარი?'], undefined, info)], ctx: { ...ctx, amount }, mood: 'happy' }
    }
    case 'purchase': {
      const amount = q.amount!
      const nctx: Ctx = { kind: 'purchase', amount, item: q.item }
      if (q.afterPayday) {
        const after = Math.round(e.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - amount)
        return { msgs: [jk(`თუ ${gel(amount)}-ს ხელფასის შემდეგ დახარჯავ, შემდეგ ხელფასამდე სავარაუდოდ ~${gel(r10(after))} დაგრჩება — ${after >= e.cushion ? 'ზღვარს ზემოთ' : 'მაინც მჭიდროდ'}.`, ['დღეს რამდენი შემიძლია?'])], ctx: nctx, mood: after >= e.cushion ? 'happy' : 'calm' }
      }
      if (q.months || q.ratePct !== undefined || q.zeroRate) return respondInstallment({ ...nctx, kind: 'installment', months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q), startOffset: startFrom(q), upfront: q.upfront }, 'installment')
      const msgs = purchaseAnswer(e, p, amount, q.item, undefined, day0, demo.extra, demo.day)
      const w = msgs[0].card!.data.r.weather
      return { msgs, ctx: nctx, mood: w === 'sun' || w === 'cloud' ? 'happy' : 'worried' }
    }
    case 'installment':
    case 'loan': {
      const nctx: Ctx = { kind: q.intent, amount: q.amount ?? (ctx.kind ? ctx.amount : undefined), item: q.item ?? ctx.item, months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q), startOffset: startFrom(q), upfront: q.upfront }
      if (nctx.amount === undefined) {
        return { msgs: [jk(q.intent === 'loan' ? 'რა თანხის სესხზე ფიქრობ და რამდენი თვით? მაგალითად: „2 000 ლარი 24 თვით 18%-ით".' : 'რა ღირს ნივთი? მაგალითად: „1 200 ლარის ტელეფონი 12 თვით".', q.intent === 'loan' ? ['2 000 ₾ სესხი 24 თვით 18%-ით', '1 000 ₾ სესხი 12 თვით'] : ['1 200 ₾-ის ტელეფონი განვადებით', '800 ₾ მაცივარი 0%-ით 6 თვით'])], ctx: nctx, mood: 'thinking' }
      }
      return respondInstallment(nctx, q.intent)
    }
    case 'followup': {
      if (ctx.kind === 'installment' || ctx.kind === 'loan') {
        const nctx: Ctx = { ...ctx }
        if (q.months) nctx.months = q.months
        const r = rateFrom(q); if (r !== undefined) { nctx.ratePerMonth = r; nctx.rateText = rateTxt(q) }
        const st = startFrom(q); if (st !== undefined) nctx.startOffset = st
        if (q.upfront !== undefined) nctx.upfront = q.upfront
        else if (q.useSavings && p.savings) nctx.upfront = Math.min(300, p.savings.amount)
        if (q.amount !== undefined && !q.months && q.upfront === undefined && q.ratePct === undefined) nctx.amount = q.amount
        // the April question keeps the 12-month tenor (the memorable moment)
        if (q.startMonth && !q.months && !ctx.months) nctx.months = 12
        return respondInstallment(nctx, ctx.kind)
      }
      if (ctx.kind === 'purchase' && ctx.amount) {
        if (q.amount !== undefined) return respond(`${q.amount} ლარი ვიყიდო`, e, p, ctx, demo)
        if (q.afterPayday) return respond(`${ctx.amount} ლარი ხელფასის შემდეგ ვიყიდო`, e, p, ctx, demo)
        if (q.months || q.ratePct !== undefined) return respondInstallment({ kind: 'installment', amount: ctx.amount, item: ctx.item, months: q.months, ratePerMonth: rateFrom(q), rateText: rateTxt(q) }, 'installment')
      }
      if (q.amount !== undefined) return respond(`${q.amount} ლარი ვიყიდო`, e, p, ctx, demo)
      return { msgs: [jk('რა თანხაზე ფიქრობ? მომწერე, მაგალითად: „300 ლარი" ან „1 200 ლარი 12 თვით".', START_CHIPS)], ctx, mood: 'thinking' }
    }
    default:
      return { msgs: [jk('ეგ ჯერ ვერ გავიგე 🐐 ფინანსებზე მკითხე — შესყიდვაზე, განვადებაზე, სესხზე ან დღის ბიუჯეტზე.', START_CHIPS)], ctx, mood: 'thinking' }
  }

  function respondInstallment(c: Ctx, kind: 'installment' | 'loan') {
    const msgs = installmentAnswer(e, p, c, kind)
    const rows = msgs[0].card!.data.rows as { nShort: number }[]
    const allShort = rows.every(r => r.nShort > 0)
    return { msgs, ctx: { ...c, kind }, mood: (allShort ? 'worried' : 'happy') as 'worried' | 'happy' }
  }
}
