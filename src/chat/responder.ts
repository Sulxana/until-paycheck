import { Engine, TenorResult, KA_MONTHS_FULL, WEATHER_LABEL } from '../engine/engine'
import { Persona } from '../engine/personas'
import { ChatMsg, ChatCard } from '../state/store'
import { parse, Parsed, ConceptId } from './parser'
import { fmt, gel } from '../engine/view'

export interface Ctx {
  kind: 'purchase' | 'installment' | 'loan' | null
  amount?: number
  months?: number
  ratePerMonth?: number
  startOffset?: number
  upfront?: number
  item?: string
}

const UNTIL: Record<number, string> = { 1: 'იანვრამდე', 2: 'თებერვლამდე', 3: 'მარტამდე', 4: 'აპრილამდე', 5: 'მაისამდე', 6: 'ივნისამდე', 7: 'ივლისამდე', 8: 'აგვისტომდე', 9: 'სექტემბრამდე', 10: 'ოქტომბრამდე', 11: 'ნოემბრამდე', 12: 'დეკემბრამდე' }

const FROM: Record<number, string> = { 1: 'იანვრიდან', 2: 'თებერვლიდან', 3: 'მარტიდან', 4: 'აპრილიდან', 5: 'მაისიდან', 6: 'ივნისიდან', 7: 'ივლისიდან', 8: 'აგვისტოდან', 9: 'სექტემბრიდან', 10: 'ოქტომბრიდან', 11: 'ნოემბრიდან', 12: 'დეკემბრიდან' }

let seq = 1
const id = () => `m${Date.now()}_${seq++}`
const r5 = (v: number) => Math.round(v / 5) * 5
const r10 = (v: number) => Math.round(v / 10) * 10

export const START_CHIPS = ['100 ₾-ის ფეხსაცმელი ვიყიდო?', '1 200 ₾-ის ტელეფონი განვადებით', '2 000 ₾ სესხი 24 თვით 18%-ით', 'დღეს რამდენი შემიძლია?', 'რა არის PTI?']

export function greeting(p: Persona): ChatMsg {
  return {
    id: id(), from: 'jikho',
    text: `გამარჯობა, ${p.name}! ჯიხო ვარ 🐐 მკითხე ნებისმიერ შესყიდვაზე, განვადებაზე ან სესხზე — შენი ბანკების ისტორიით დაგითვლი, რა მოხდება ხელფასამდე და მომდევნო თვეებში. გადაწყვეტილება შენია, მე ამინდს გაჩვენებ.`,
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
  if (p50 <= 0) return 'ხარჯისთვის აღარაფერი რჩება'
  const d = p50 / avg
  return d < 1.5 ? 'დაახლოებით ერთი დღის ხარჯი' : `დაახლოებით ${Math.round(d)} დღის ხარჯი`
}

function purchaseAnswer(e: Engine, p: Persona, amount: number, item?: string, landingNow?: { p10: number; p50: number; p90: number; weather: any }, day0 = true, extraNow = 0, dayIdx = 0): ChatMsg[] {
  const r = day0 ? e.purchaseCheck(amount) : { ...e.forecastAtDay(dayIdx, e.demoPathIndex(), extraNow + amount).landing, amount, afterPayday: Math.round(e.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - amount) }
  const base = landingNow ?? e.landing
  const daysLeft = p.dayPattern.length - dayIdx
  const sign = (v: number) => (v < 0 ? '−' : '+') + fmt(Math.abs(r5(v)))
  let text = `თუ დღეს ${gel(amount)} დახარჯავ, ხელფასის დღეს სავარაუდოდ ~${fmt(r5(r.p50))} ₾ დაგრჩება (${sign(r.p10)}…${sign(r.p90)}) — ${daysText(r.p50, e.avgDaily)}. 10 მსგავსი თვიდან ${r.inTen}-ში ${fmt(e.cushion)}-ლარიან ზღვარს ქვემოთ ჩახვიდოდი. ხელფასი ${daysLeft} დღეშია.`
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
    text = `${gel(amount)} ახლა ხელმისაწვდომ ${gel(e.spendable)}-ზე მეტია — ხელფასამდე ამ თანხას ანგარიშები ვერ გასწვდება. ` + text
  }
  return [{ id: id(), from: 'jikho', text, card: { kind: 'purchase', data: { amount, item, r, base: { p10: base.p10, p50: base.p50, p90: base.p90, weather: base.weather }, cushion: e.cushion, afterPayday: r.afterPayday } }, chips }, ...more]
}

function tenorCard(e: Engine, rows: TenorResult[], title: string, note?: string): ChatCard {
  return { kind: 'installment', data: { title, cushion: e.cushion, salary: e.p.salary, laptop: e.p.installment, rows: rows.map(t => ({ label: t.label, monthly: t.monthly, total: t.total, cost: t.cost, eir: t.eirPct, pti: t.ptiNowPct, nShort: t.nShort, short: t.shortLabels, window: t.window.map(c => ({ label: c.label, p50: c.p50, p10: c.p10, pBelow: c.pBelow })), maxPBelow: t.maxPBelow, months: t.months, principal: t.principal, startLabel: t.startLabel })), note } }
}

function shortText(t: TenorResult, cushion: number) {
  if (t.nShort === 0) return `არცერთ თვეში არ აკლდება (ზღვარს ქვემოთ ჩასვლის შანსი ≤${Math.round(t.maxPBelow * 100)}%)`
  if (t.nShort >= Math.max(7, t.window.length - 2)) return `თითქმის ყველა თვეში ხელფასამდე ${fmt(cushion)}-ლარიან ზღვარს ქვემოთაა`
  const months = t.shortLabels.map(l => l.split(' ')[1]).join(', ')
  return `${t.window.length}-დან ${t.nShort} თვეში ხელფასამდე ${fmt(cushion)}-ლარიან ზღვარს ქვემოთაა (${months})`
}

function installmentAnswer(e: Engine, p: Persona, c: Ctx, kind: 'installment' | 'loan'): ChatMsg[] {
  const price = c.amount ?? 1200
  const start = c.startOffset ?? 0
  const upfront = c.upfront ?? 0
  const isExampleRate = c.ratePerMonth === undefined
  const rate = c.ratePerMonth ?? (kind === 'loan' ? 0.18 / 12 : 0.015)
  const what = kind === 'loan' ? `${gel(price)} სესხი` : `${itemWord(c.item)} ${gel(price)} განვადებით`
  const startTxt = start > 0 ? ` (დაწყება: ${KA_MONTHS_FULL[((10 + start) % 12) + 1]})` : ''
  let rows: TenorResult[]
  if (c.months) {
    rows = [e.installment({ price, months: c.months, ratePerMonth: rate, startOffset: start, upfront, label: `${c.months} თვე, ${rate === 0 ? '0%' : fmt(rate * 100, rate * 100 % 1 ? 2 : 1) + '%/თვე'}` })]
  } else if (kind === 'loan') {
    rows = [12, 24, 36].map(m => e.installment({ price, months: m, ratePerMonth: rate, startOffset: start, upfront, label: `${m} თვე` }))
  } else {
    rows = [
      e.installment({ price, months: 4, ratePerMonth: 0, startOffset: start, upfront, label: '4 თვე, 0%' }),
      e.installment({ price, months: 12, ratePerMonth: rate, startOffset: start, upfront, label: `12 თვე, ${fmt(rate * 100, 1)}%/თვე` }),
      e.installment({ price, months: 24, ratePerMonth: rate, startOffset: start, upfront, label: `24 თვე, ${fmt(rate * 100, 1)}%/თვე` }),
    ]
  }
  const lines = rows.map(t => `• ${t.label}: ${fmt(t.monthly, t.monthly % 1 ? 1 : 0)} ₾ თვეში, ჯამში ${gel(t.total)}, კრედიტის ღირებულება ${gel(t.cost)}${t.eirPct ? ` (ეფექტური ~${fmt(t.eirPct, 1)}%)` : ''} — ${shortText(t, e.cushion)}.`)
  const best = [...rows].sort((a, b) => a.nShort - b.nShort || a.cost - b.cost)[0]
  const pti = rows[0].ptiNowPct
  const ptiLine = `PTI-ის შეფასებით (შენი ახლანდელი განვადებით ერთად) ${fmt(pti, 1)}%${rows.length > 1 ? '–' + fmt(rows[rows.length - 1].ptiNowPct, 1) + '%' : ''}. 25%-იანი ზღვარი (${gel(p.salary * 0.25)}) შენს შემოსავალზე 2027 წლის 1 თებერვლიდან ვრცელდება. PTI შენს სესხებს ერთხელ ითვლის — შენს თვეს ვერ ხედავს; ზემოთ სწორედ თვეა.`
  const save = e.monthsToSave(price - upfront)
  const cashLine = Number.isFinite(save) && save <= 24 ? `უკრედიტო ვარიანტი: შენი ჩვეული თვიური ნაშთით (~${gel(Math.round(e.medianSurplus))}) ${gel(price - upfront)} დაახლოებით ${save} თვეში გროვდება, კრედიტის ღირებულება 0 ₾.` : ''
  const chips: string[] = []
  if (p.installment && start === 0) chips.push(`და თუ ${UNTIL[p.installment.lastCycle[1]]} დავიცადო?`)
  if (!c.months) chips.push(kind === 'loan' ? '48 თვეზე?' : '6 თვეზე?')
  if (p.savings && !upfront) chips.push(`${Math.min(300, Math.round(p.savings.amount / 100) * 100 - 100)} ₾ დანაზოგიდან წინასწარ`)
  chips.push('რა არის ეფექტური განაკვეთი?')
  let compareLine = ''
  let compare: any = null
  if (start > 0 && rows.length === 1) {
    const now = e.installment({ price, months: rows[0].months, ratePerMonth: rate, upfront })
    const now24 = e.installment({ price, months: 24, ratePerMonth: rate, upfront })
    const t = rows[0]
    compare = { nowShort: now.nShort, nowWindow: now.window.length, nowCost: now.cost, cost: t.cost, cost24: now24.cost, short: t.nShort }
    compareLine = `ახლა რომ აიღო, ${now.window.length}-დან ${now.nShort} თვეში აკლდება. ${FROM[((10 + start) % 12) + 1]} ${t.months} თვით — ${t.nShort === 0 ? 'არცერთ თვეში' : `${t.nShort} თვეში`}, ფასი ${gel(t.cost)}${now24.cost > t.cost ? ` — 24-თვიანთან (${gel(now24.cost)}) შედარებით ${gel(now24.cost - t.cost)}-ით ნაკლები` : ''}.`
  }
  const card = tenorCard(e, rows, what + startTxt, isExampleRate ? `განაკვეთი მაგალითია (${kind === 'loan' ? '18% წლიური' : '1,5% თვეში'}) — ჩამიწერე შენი შეთავაზების განაკვეთი და გადავითვლი.` : undefined)
  card.data.compare = compare
  const msgs: ChatMsg[] = [
    { id: id(), from: 'jikho', text: compareLine || (rows.length > 1 ? `${what}${startTxt} — ${rows.length} ვადა შენს თვეებზე. ვადის მიხედვით დავალაგე, არცერთი არ არის „რეკომენდებული". ფერადი ზოლი = ხელფასამდე ამინდი ყოველ თვეს.` : lines[0].replace('• ', '')), card },
    compare && compare.short === 0 && compare.nowShort > 0 && compare.cost24 > compare.cost
      ? { id: id(), from: 'jikho', text: 'ეს ის სტრიქონია, რომელსაც არცერთი ბანკის checkout არ გაჩვენებს 🐐 ინფორმაციაა, არა რჩევა — არჩევანი შენია.', chips: ['24 თვეზე?', 'რა არის ეფექტური განაკვეთი?', 'დღეს რამდენი შემიძლია?'] }
      : rows.length > 1
        ? { id: id(), from: 'jikho', text: [ptiLine, cashLine].filter(Boolean).join(' '), chips }
        : { id: id(), from: 'jikho', text: `PTI-ის შეფასებით ${fmt(pti, 1)}%. ${cashLine}`, chips },
  ]
  if (rows.length > 1 && best.nShort === 0) msgs[1].text += ` ${best.label} ყველა თვეში ზღვარს ზემოთ რჩება — ეს ინფორმაციაა, არჩევანი შენია.`
  return msgs
}

const CONCEPT_TEXT: Record<ConceptId, (e: Engine, p: Persona) => { title: string; body: string; mine: string; rule: string }> = {
  pti: (e, p) => ({
    title: 'PTI — სესხის შენატანი შემოსავალთან',
    body: 'PTI არის ყველა სესხისა და განვადების ყოველთვიური შენატანი, გაყოფილი წმინდა შემოსავალზე. ბანკი მას სესხის გაცემისას ერთხელ ითვლის. ეროვნული ბანკის 2026 წლის 30 სექტემბრის გადაწყვეტილებით, 25%-იანი ზღვარი 2 000 ₾-მდე შემოსავლებზე 2027 წლის 1 თებერვლიდან ვრცელდება.',
    mine: `შენი შენატანები ახლა: ${gel(e.laptop)} → PTI ${fmt(e.laptop / p.salary * 100, 1)}%. ზღვარი შენთვის: ${gel(p.salary * 0.25)} თვეში.`,
    rule: 'PTI ზღვარში ჯდომა არ ნიშნავს, რომ თვე გაძლებს — PTI ხარჯს და თარიღებს ვერ ხედავს.',
  }),
  eir: () => ({
    title: 'ეფექტური წლიური განაკვეთი',
    body: 'ეფექტური განაკვეთი გიჩვენებს სესხის რეალურ ფასს წელიწადში, საკომისიოებისა და რთული პროცენტის ჩათვლით. 1,5% თვეში ერთი შეხედვით პატარაა, მაგრამ წელიწადში ~19,6%-ია, რადგან ყოველი თვის პროცენტი შემდეგზე იზრდება.',
    mine: '1 200 ₾ 12 თვით 1,5%-ით: 110 ₾ თვეში, ჯამში 1 320 ₾ — 120 ₾ კრედიტის ფასია.',
    rule: 'ადარე ეფექტური განაკვეთი და ჯამური ფასი, არა მხოლოდ თვიური შენატანი.',
  }),
  compound: () => ({
    title: 'რთული პროცენტი',
    body: 'მარტივი პროცენტი მხოლოდ საწყის თანხაზე ერიცხება. რთული — უკვე დარიცხულ პროცენტზეც. 1 000 ₾ 10%-ით 20 წელიწადში: მარტივით 3 000 ₾, რთულით 6 727 ₾ — სხვაობა 3 727 ₾.',
    mine: 'იგივე წესი სესხზეც მუშაობს — შენს საწინააღმდეგოდ. ამიტომ გრძელი ვადა ძვირია.',
    rule: 'დრო ზრდის დანაზოგსაც და ვალსაც. დაზოგვა ადრე დაიწყე, ვალი ადრე დაასრულე.',
  }),
  cushion: (e, p) => ({
    title: 'ზღვარი (უსაფრთხოების ბალიში)',
    body: 'ზღვარი არის თანხა, რომლის ქვემოთ ჩასვლა ხელფასამდე არ გინდა — ნაგულისხმევად შენი 3 დღის ჩვეული ხარჯი, ანუ დაახლოებით ერთი შაბათ-კვირა და ერთი დღე რეაგირებისთვის. შეგიძლია 2-დან 7 დღემდე შეცვალო.',
    mine: `შენი ზღვარი: ${gel(e.cushion)} (3 × ~${gel(Math.round(e.avgDaily))} დღეში).`,
    rule: 'ამინდის ფერი = ზღვარს ქვემოთ ჩასვლის ალბათობა: მზე <10%, ღრუბელი 10–30%, წვიმა 30–60%, ქარიშხალი >60%.',
  }),
  weather: e => ({
    title: 'როგორ ვითვლი ამინდს',
    body: 'შენი ბოლო 6 თვიდან ვპოულობ განმეორებად გადასახადებს და დღიურ ხარჯს კვირის დღეების მიხედვით. მერე ხელფასამდე დარჩენილ დღეებს 1 000-ჯერ ვათამაშებ — ამიტომ გაჩვენებ დიაპაზონს და არა ერთ რიცხვს. ხელოვნური ინტელექტი არცერთ რიცხვს არ იგონებს.',
    mine: `ახლა: ${fmt(r10(e.landing.p10))}–${fmt(r10(e.landing.p90))} ₾, ყველაზე სავარაუდოდ ~${fmt(r10(e.landing.p50))} ₾, ${WEATHER_LABEL[e.landing.weather]}.`,
    rule: 'ერთ ხელფასზე შორს ეს ექსტრაპოლაციაა: ვვარაუდობ, რომ შენი ბოლო თვეები მეორდება.',
  }),
  zero: () => ({
    title: '0%-იანი განვადება',
    body: '0%-ით პროცენტს არ იხდი, მაგრამ შენატანი დიდია, რადგან ვადა მოკლეა. ხშირად ფასში ან საკომისიოში იმალება ღირებულება — ნახე ჯამური თანხა.',
    mine: '1 200 ₾ 4 თვით 0%-ით = 300 ₾ თვეში. იაფია, მაგრამ შენს თვეს შეიძლება ვერ გაუძლოს.',
    rule: '„იაფი" და „ჩემს თვეში ჯდება" სხვადასხვა კითხვაა.',
  }),
  installment: () => ({
    title: 'განვადება და სესხი',
    body: 'განვადება კონკრეტული ნივთის შეძენის სესხია, ხშირად მაღაზიაში. სესხი ნაღდი ფულია. ორივეში იხდი თვიურ შენატანს და ორივე PTI-ში ითვლება.',
    mine: 'სანამ ხელს მოაწერ, მკითხე — ყველა ვადას შენს თვეებზე გაჩვენებ.',
    rule: 'ადარე ჯამური ფასი, ეფექტური განაკვეთი და ის თვეები, როცა ვერ გაუძლებ.',
  }),
  overdraft: () => ({
    title: 'ოვერდრაფტი',
    body: 'ოვერდრაფტი ბანკის ფულია, რომელიც ბალანსის ნულის ქვემოთ გაძლევს. პროცენტი დღიურად ერიცხება და ხშირად მაღალია. ჩვენ მას შენს ფულად არ ვთვლით — ცალკე ვაჩვენებთ.',
    mine: 'თუ ოვერდრაფტში ცხოვრობ, „უსაფრთხო ჩასვლა" ნიშნავს: ხელფასამდე ოვერდრაფტი წინა თვეზე პატარაა.',
    rule: 'ოვერდრაფტი გადაუდებელი დახმარებაა და არა ხელფასის ნაწილი.',
  }),
  deposit: (e, p) => ({
    title: 'ანაბარი და საგანგებო ფონდი',
    body: 'საგანგებო ფონდი 3–6 თვის აუცილებელი ხარჯია, რომელიც მოულოდნელობას ფარავს სესხის გარეშე. მიზნობრივი ანაბარი ფულს ცალკე ინახავს და პროცენტსაც გიხდის.',
    mine: p.savings ? `შენი ქვევრი „${p.savings.name}": ${gel(p.savings.amount)} / ${gel(p.savings.target)}.` : 'დაიწყე პატარა თანხით ყოველ ხელფასზე — 20–50 ₾-იც კი ჩვევას ქმნის.',
    rule: 'ჯერ საკუთარ თავს გადაუხადე: დანაზოგი ხელფასის დღეს გადადე, არა თვის ბოლოს.',
  }),
  inflation: () => ({
    title: 'ინფლაცია',
    body: 'ინფლაცია ფასების ზრდაა. თუ ფასები 5%-ით იზრდება და შენი ფული 0%-ით, წლის ბოლოს იგივე თანხით ნაკლებს იყიდი.',
    mine: '100 ₾ სახლში, 5%-იანი ინფლაციით, წელიწადში ~95 ₾-ის ღირებულებას ინარჩუნებს.',
    rule: 'ფული, რომელიც არ იზრდება, ფასს კარგავს.',
  }),
  fraud: () => ({
    title: 'თაღლითობა',
    body: 'ბანკი არასდროს გთხოვს SMS კოდს, ბარათის PIN-ს ან პაროლს ტელეფონით. ყალბი „ხელფასამდე"-ს მსგავსი აპები და ბმულები არსებობს — აპი მხოლოდ ოფიციალური მაღაზიიდან ჩამოტვირთე.',
    mine: 'თუ ვინმე ბანკის სახელით გირეკავს და კოდს გთხოვს — გათიშე და ბანკის ოფიციალურ ნომერზე თავად დარეკე.',
    rule: 'კოდი = ფული. კოდს არავის ეუბნები.',
  }),
  credithistory: () => ({
    title: 'საკრედიტო ისტორია',
    body: 'კრედიტინფოში ჩანს შენი ყველა სესხი, ბარათი და ვადაგადაცილება. ბანკი ამას სესხის გაცემისას ხედავს. საკუთარი ანგარიშის ნახვა უფლებაა.',
    mine: 'დროული გადახდა ისტორიას აუმჯობესებს; ერთი ვადაგადაცილებაც კი წლობით ჩანს.',
    rule: 'ვერ იხდი? ვადამდე დაელაპარაკე ბანკს — არა ვადის შემდეგ.',
  }),
  restructure: () => ({
    title: 'როცა ვერ იხდი',
    body: 'ჯერ ქირა, კომუნალური და საკვები, შემდეგ უზრუნველყოფილი სესხები, ბოლოს — არაუზრუნველყოფილი. ბანკს შეგიძლია სთხოვო რესტრუქტურიზაცია: ვადის გაგრძელება ან შეღავათიანი პერიოდი. ეროვნული ბანკის მომხმარებელთა უფლებების სერვისი და finedu.gov.ge დაგეხმარება.',
    mine: 'გაჭირვების რეჟიმში სერია გაყინულია და არაფერი იკარგება. ერთად დავალაგოთ გადასახადები.',
    rule: 'ახალი სესხი ძველის დასაფარად ხშირად ორმოს აღრმავებს.',
  }),
  fixed: e => ({
    title: 'ფიქსირებული და ცვლადი ხარჯი',
    body: 'ფიქსირებული ხარჯი ყოველთვე მეორდება (ქირა, კომუნალური, განვადება). ცვლადი ყოველდღიურად იცვლება (საკვები, ტრანსპორტი, კაფე).',
    mine: `შენი ფიქსირებული: ${gel(e.fixedTotal)} = ხელფასის ${Math.round(e.fixedTotal / e.p.salary * 100)}%. ნახევარზე მეტი დახარჯულია, სანამ პირველ ლარს დახარჯავ.`,
    rule: 'ჯერ ფიქსირებული, მერე ცვლადი — ასე იცი, რეალურად რამდენი გაქვს.',
  }),
}

export function respond(input: string, e: Engine, p: Persona, ctx: Ctx, demo: { day: number; extra: number }): { msgs: ChatMsg[]; ctx: Ctx; mood: 'happy' | 'calm' | 'worried' | 'thinking' } {
  const q: Parsed = parse(input)
  const day0 = demo.day === 0 && demo.extra === 0
  const rateFrom = (pp: Parsed): number | undefined => (pp.zeroRate ? 0 : pp.ratePct === undefined ? undefined : pp.rateIsAnnual ? pp.ratePct / 100 / 12 : pp.ratePct / 100)
  const startFrom = (pp: Parsed) => (pp.startMonth ? offsetForStartMonth(pp.startMonth) : pp.afterPayday ? 0 : undefined)

  const jk = (text: string, chips?: string[], card?: ChatCard): ChatMsg => ({ id: id(), from: 'jikho', text, chips, card })

  switch (q.intent) {
    case 'greeting':
      return { msgs: [jk(`გამარჯობა! 🐐 ხელფასამდე ${p.dayPattern.length - demo.day} დღეა და ამინდი ${WEATHER_LABEL[e.landing.weather]}ა. რას ვამოწმებთ?`, START_CHIPS)], ctx, mood: 'happy' }
    case 'thanks':
      return { msgs: [jk('არაფრის! მთებში ერთად ვართ ⛰️ სხვა რამე შევამოწმოთ?', ['დღეს რამდენი შემიძლია?', 'როგორ ვითვლი ამინდს?'])], ctx, mood: 'happy' }
    case 'who':
      return { msgs: [jk('მე ჯიხო ვარ — კავკასიური ჯიხვი. მთის ბილიკზე წონასწორობას ვინარჩუნებ, შენ კი თვის ბოლომდე გეხმარები. ყველა რიცხვს ძრავა ითვლის შენი ისტორიიდან; მე მხოლოდ გიხსნი. ინფორმაციას გაძლევ, არა რჩევას.', START_CHIPS)], ctx, mood: 'happy' }
    case 'invest':
      return { msgs: [jk('ინვესტიციებზე რჩევას ვერ მოგცემ — ლიცენზირებული მრჩეველი არ ვარ. შემიძლია აგიხსნა, რა არის რისკი, დივერსიფიკაცია და ინფლაცია, და გაჩვენო, რამდენი გრჩება თვეში დასაზოგად.', ['რა არის ინფლაცია?', 'რა არის რთული პროცენტი?', 'რამდენი გრჩება თვეში?'])], ctx, mood: 'calm' }
    case 'hardship':
    case 'concept': {
      const c = CONCEPT_TEXT[q.concept!](e, p)
      return { msgs: [{ id: id(), from: 'jikho', text: c.body, card: { kind: 'concept', data: c }, chips: q.concept === 'pti' ? ['1 200 ₾-ის ტელეფონი განვადებით', 'რა არის ეფექტური განაკვეთი?'] : ['დღეს რამდენი შემიძლია?', 'რა არის PTI?'] }], ctx, mood: 'calm' }
    }
    case 'safe': {
      const f = day0 ? e.landing : e.forecastAtDay(demo.day, e.demoPathIndex(), demo.extra).landing
      const daysLeft = p.dayPattern.length - demo.day
      const safe = daysLeft > 0 ? Math.max(0, Math.round((f.p50 - e.cushion) / daysLeft)) : 0
      const max = day0 ? e.maxComfortablePurchase() : Math.max(0, Math.floor((f.p10 + (f.p50 - f.p10) * 0.6 - e.cushion) / 5) * 5)
      const text = safe > 0
        ? `შენი ჩვეული ხარჯის (~${gel(Math.round(e.avgDaily))} დღეში) ზემოთ დღეს დაახლოებით ${gel(safe)} გაქვს თავისუფლად. ერთჯერადი შესყიდვა ~${gel(max)}-მდე ამინდს ღრუბლიანზე უარესს არ ხდის.`
        : `ამ კვირაში ჩვეული ხარჯის ზემოთ თავისუფალი თანხა თითქმის არ რჩება — პროგნოზი ზღვართან ახლოსაა. აუცილებელი ხარჯი, რა თქმა უნდა, აუცილებელია.`
      return { msgs: [jk(text, [`${max || 20} ₾-ის რამე ვიყიდო?`, 'როგორ ვითვლი ამინდს?'], { kind: 'safe', data: { safe, max, avg: e.avgDaily, landing: f, cushion: e.cushion, daysLeft } })], ctx, mood: safe > 0 ? 'happy' : 'calm' }
    }
    case 'forecast': {
      const f = day0 ? e.landing : e.forecastAtDay(demo.day, e.demoPathIndex(), demo.extra).landing
      const daysLeft = p.dayPattern.length - demo.day
      return { msgs: [jk(`ხელფასამდე ${daysLeft} დღეა. სავარაუდოდ ~${fmt(r10(f.p50))} ₾ დაგრჩება (${fmt(r10(f.p10))}–${fmt(r10(f.p90))}), ${WEATHER_LABEL[f.weather]} — 10-დან ${f.inTen}-ში ზღვარს ქვემოთ. ${daysText(f.p50, e.avgDaily)}.`, ['დღეს რამდენი შემიძლია?', 'როგორ ვითვლი ამინდს?'], { kind: 'forecast', data: { fan: e.fan(), cushion: e.cushion, landing: f } })], ctx, mood: f.weather === 'sun' || f.weather === 'cloud' ? 'happy' : 'worried' }
    }
    case 'save': {
      const amount = q.amount ?? ctx.amount ?? 1200
      const n = e.monthsToSave(amount)
      const text = Number.isFinite(n)
        ? `შენი ჩვეული თვიური ნაშთი ~${gel(Math.round(e.medianSurplus))}-ია. ${gel(amount)} დაახლოებით ${n} თვეში გროვდება${p.savings ? `, ან უფრო სწრაფად, თუ ქვევრში უკვე არსებულ ${gel(p.savings.amount)}-საც ჩავთვლით (${Math.max(0, Math.ceil((amount - p.savings.amount) / e.medianSurplus))} თვე)` : ''}. კრედიტის ღირებულება — 0 ₾. ზამთრის თვეებში ნაშთი ნაკლებია.`
        : 'ამჟამად თვის ბოლოს ნაშთი არ რჩება, ამიტომ დაგროვება ჯერ შეუძლებელია. ჯერ ფიქსირებული ხარჯები გადავხედოთ.'
      return { msgs: [jk(text, [`${gel(amount)} განვადებით რა იქნება?`, 'რა არის საგანგებო ფონდი?'])], ctx: { ...ctx, amount }, mood: 'happy' }
    }
    case 'purchase': {
      const amount = q.amount!
      const nctx: Ctx = { kind: 'purchase', amount, item: q.item }
      if (q.afterPayday) {
        const after = Math.round(e.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - amount)
        return { msgs: [jk(`ხელფასის შემდეგ ${gel(amount)} ${after >= e.cushion ? `ზღვარს ზემოთ გტოვებს: შემდეგ ხელფასამდე სავარაუდოდ ~${gel(r10(after))} დაგრჩება` : `მაინც მჭიდროა: შემდეგ ხელფასამდე ~${gel(r10(after))}`}. ეს ექსტრაპოლაციაა — ვვარაუდობ, რომ შენი ბოლო თვეები მეორდება.`, ['დღეს რამდენი შემიძლია?'])], ctx: nctx, mood: after >= e.cushion ? 'happy' : 'calm' }
      }
      if (q.months || q.ratePct !== undefined || q.zeroRate) return respondInstallment({ ...nctx, kind: 'installment', months: q.months, ratePerMonth: rateFrom(q), startOffset: startFrom(q), upfront: q.upfront }, 'installment')
      const msgs = purchaseAnswer(e, p, amount, q.item, undefined, day0, demo.extra, demo.day)
      const w = msgs[0].card!.data.r.weather
      return { msgs, ctx: nctx, mood: w === 'sun' || w === 'cloud' ? 'happy' : 'worried' }
    }
    case 'installment':
    case 'loan': {
      const nctx: Ctx = { kind: q.intent, amount: q.amount ?? (ctx.kind ? ctx.amount : undefined), item: q.item ?? ctx.item, months: q.months, ratePerMonth: rateFrom(q), startOffset: startFrom(q), upfront: q.upfront }
      if (nctx.amount === undefined) {
        return { msgs: [jk(q.intent === 'loan' ? 'რა თანხის სესხზე ფიქრობ და რამდენი თვით? მაგალითად: „2 000 ლარი 24 თვით 18%-ით".' : 'რა ღირს ნივთი? მაგალითად: „1 200 ლარის ტელეფონი 12 თვით".', q.intent === 'loan' ? ['2 000 ₾ სესხი 24 თვით 18%-ით', '1 000 ₾ სესხი 12 თვით'] : ['1 200 ₾-ის ტელეფონი განვადებით', '800 ₾ მაცივარი 0%-ით 6 თვით'])], ctx: nctx, mood: 'thinking' }
      }
      return respondInstallment(nctx, q.intent)
    }
    case 'followup': {
      if (ctx.kind === 'installment' || ctx.kind === 'loan') {
        const nctx: Ctx = { ...ctx }
        if (q.months) nctx.months = q.months
        const r = rateFrom(q); if (r !== undefined) nctx.ratePerMonth = r
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
        if (q.months || q.ratePct !== undefined) return respondInstallment({ kind: 'installment', amount: ctx.amount, item: ctx.item, months: q.months, ratePerMonth: rateFrom(q) }, 'installment')
      }
      if (q.amount !== undefined) return respond(`${q.amount} ლარი ვიყიდო`, e, p, ctx, demo)
      return { msgs: [jk('რომელ თანხაზე? დამიწერე, მაგალითად: „300 ლარი" ან „1 200 ლარი 12 თვით".', START_CHIPS)], ctx, mood: 'thinking' }
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
