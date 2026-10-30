// Rule-based Georgian intent parser for Jikho. Works offline, deterministic.
export type Intent =
  | 'greeting' | 'thanks' | 'who' | 'purchase' | 'installment' | 'loan' | 'safe' | 'forecast' | 'save' | 'concept' | 'invest' | 'followup' | 'hardship' | 'unknown'

export type ConceptId = 'pti' | 'eir' | 'compound' | 'cushion' | 'weather' | 'installment' | 'overdraft' | 'deposit' | 'inflation' | 'fraud' | 'credithistory' | 'restructure' | 'fixed' | 'zero'

export interface Parsed {
  intent: Intent
  amount?: number
  months?: number
  ratePct?: number
  rateIsAnnual?: boolean
  zeroRate?: boolean
  startMonth?: number // 1..12
  afterPayday?: boolean
  upfront?: number
  useSavings?: boolean
  item?: string
  concept?: ConceptId
  raw: string
}

const MONTHS: [RegExp, number][] = [
  [/იანვ/, 1], [/თებერვ/, 2], [/მარტ/, 3], [/აპრილ/, 4], [/მაის/, 5], [/ივნის/, 6], [/ივლის/, 7], [/აგვისტ/, 8], [/სექტემბ/, 9], [/ოქტომბ/, 10], [/ნოემბ/, 11], [/დეკემბ/, 12],
]
const ITEMS: [RegExp, string][] = [
  [/ტელეფონ|აიფონ|iphone|სმარტფონ/, 'ტელეფონი'], [/ლეპტოპ|ნოუთბუქ|კომპიუტერ|macbook/, 'ლეპტოპი'], [/ფეხსაცმ|სპორტულ|კედ/, 'ფეხსაცმელი'],
  [/მაცივარ/, 'მაცივარი'], [/ტელევიზორ|ტელიკ/, 'ტელევიზორი'], [/ყურსასმენ|airpods/, 'ყურსასმენი'], [/ქურთუკ|პალტო|ტანსაცმ|კაბა/, 'ტანსაცმელი'],
  [/სარეცხ/, 'სარეცხი მანქანა'], [/ველოსიპედ/, 'ველოსიპედი'], [/მოგზაურ|ტური|ბილეთ/, 'მოგზაურობა'], [/საჩუქ/, 'საჩუქარი'], [/კონცერტ/, 'კონცერტის ბილეთი'],
  [/playstation|ps5|კონსოლ/, 'კონსოლი'], [/მანქან/, 'მანქანა'], [/ავეჯ|დივან/, 'ავეჯი'], [/საათ/, 'საათი'],
]

const CONCEPTS: [RegExp, ConceptId][] = [
  [/\bpti\b|პტი|შემოსავლის.*თანაფარდ|ვალი.*შემოსავალ.*%/, 'pti'],
  [/ეფექტურ|eir|წლიური განაკვეთ/, 'eir'],
  [/რთული პროცენტ|კომპაუნდ|compound|მარტივ.*პროცენტ/, 'compound'],
  [/ზღვარ|ბალიშ|cushion/, 'cushion'],
  [/ამინდ.*რას ნიშნავ|ამინდი რა|როგორ ითვლ|საიდან იცი|რა სიზუსტ/, 'weather'],
  [/0 ?%.*(რატომ|მართლა|უფასო)|უფასო განვადებ|ნულოვან/, 'zero'],
  [/განვადება რა|რა არის განვადებ|განვადება და სესხ.*განსხვავ/, 'installment'],
  [/ოვერდრაფტ/, 'overdraft'],
  [/ანაბარ|დეპოზიტ|შემნახველ/, 'deposit'],
  [/ინფლაცი/, 'inflation'],
  [/თაღლით|კოდი მთხოვ|sms.*კოდ|ყალბ|ფიშინგ|სიმ ბარათ|მოტყუ/, 'fraud'],
  [/საკრედიტო ისტორ|კრედიტინფო|creditinfo/, 'credithistory'],
  [/რესტრუქტ|ვერ ვიხდი|ვერ ვფარავ|ვადაგადაცილ|დავალიანებ/, 'restructure'],
  [/ფიქსირებულ|ცვლად.*ხარჯ/, 'fixed'],
]

function toNumber(s: string): number {
  return Number(s.replace(/[\s ]/g, '').replace(',', '.'))
}

export function parse(input: string): Parsed {
  const raw = input.trim()
  let s = ' ' + raw.toLowerCase().replace(/ /g, ' ') + ' '
  const out: Parsed = { intent: 'unknown', raw }

  // ---- numbers ----
  // percentages
  const pm = s.match(/(\d+(?:[.,]\d+)?)\s*(%|პროცენტ)/)
  if (pm) {
    out.ratePct = toNumber(pm[1])
    out.rateIsAnnual = /წლიურ|წელიწად|წელში|წლის/.test(s) || (!/თვეში|თვიურ|ყოველთვ/.test(s) && out.ratePct > 4)
    if (out.ratePct === 0) out.zeroRate = true
    s = s.replace(pm[0], ' ')
  }
  if (/უპროცენტო|პროცენტის გარეშე|ნულ პროცენტ|0%/.test(s)) out.zeroRate = true
  // months / years
  const mm = s.match(/(\d+)\s*-?\s*(თვ|თთ|month)/)
  if (mm) { out.months = Number(mm[1]); s = s.replace(mm[0], ' ') }
  const ym = s.match(/(\d+)\s*-?\s*(წლით|წელი|წლიან|წელიწად|year)/)
  if (!out.months && ym) { out.months = Number(ym[1]) * 12; s = s.replace(ym[0], ' ') }
  if (!out.months && /ერთი წლ|წლიანი|ერთ წელ/.test(s)) out.months = 12
  if (!out.months && /ორი წლ|ორ წელ/.test(s)) out.months = 24
  // upfront
  const up = s.match(/(\d[\d\s]*)\s*(ლარ|₾|ლ\b)?\s*(დანაზოგიდან|წინასწარ|პირველად შენატან)/)
  if (up) { out.upfront = toNumber(up[1]); s = s.replace(up[0], ' ') }
  if (/დანაზოგით|დანაზოგიდან|ანაბრიდან|ნაღდად ვიყიდ|შევაგროვებ/.test(s)) out.useSavings = true
  // amount: number with thousand words or currency, else first remaining number
  const th = s.match(/(\d+(?:[.,]\d+)?)\s*(ათას|k\b)/)
  if (th) { out.amount = toNumber(th[1]) * 1000; s = s.replace(th[0], ' ') }
  if (out.amount === undefined) {
    const am = s.match(/(\d{1,3}(?:[  ]\d{3})+|\d+(?:[.,]\d+)?)\s*-?\s*(ლარ|₾|ლ\b|gel|lari|იან)?/)
    if (am) out.amount = toNumber(am[1])
  }
  // month names
  for (const [re, n] of MONTHS) if (re.test(s)) { out.startMonth = n; break }
  if (/ხელფასის შემდეგ|ხელფასის მერე|ხელფასზე/.test(s)) out.afterPayday = true
  for (const [re, name] of ITEMS) if (re.test(s)) { out.item = name; break }

  // ---- intents ----
  const has = (re: RegExp) => re.test(s)
  if (has(/^\s*(გამარჯობ|სალამ|hi|hello|ჰეი|მოგესალმ|დილა მშვიდობ|საღამო მშვიდობ)/)) { out.intent = 'greeting'; return out }
  if (has(/მადლობ|გმადლობ|მერსი|thanks|დიდი მადლ/)) { out.intent = 'thanks'; return out }
  if (has(/ვინ ხარ|რა გქვია|ვინ არის ჯიხო|რა ხარ/)) { out.intent = 'who'; return out }
  if (has(/გაჭირვებ|ვერ ვიხდი|ვერ ვფარავ|სესხები მახრჩობ|ვალებში ვარ/)) { out.intent = 'hardship'; out.concept = 'restructure'; return out }
  if (has(/ინვესტ|აქცი|კრიპტო|ბიტკოინ|ფორექს|ბირჟ|ფონდ/)) { out.intent = 'invest'; return out }

  const askWhat = has(/რა არის|რას ნიშნავ|ახსენი|რატომ|როგორ მუშაობ|განმარტ|რა განსხვავ/)
  for (const [re, id] of CONCEPTS) {
    if (re.test(s) && (askWhat || out.amount === undefined)) {
      if (id === 'installment' && out.amount !== undefined) continue
      out.intent = 'concept'; out.concept = id; return out
    }
  }
  if (has(/განვადებ|ნაწილ-ნაწილ|pay later|ნაწილებად|თვეობრივ|ყოველთვიურად გადავიხდ/)) { out.intent = 'installment'; return out }
  if (has(/სესხ|კრედიტ|მიკრო|სწრაფი ფულ|ნისია/)) { out.intent = 'loan'; return out }
  if (has(/დღეს რამდენ|რამდენი შემიძლია|რამდენის დახარჯვა|რა ბიუჯეტ|რამდენი დავხარჯო|დღეს რა შემიძლ|დღიური ბიუჯეტ/)) { out.intent = 'safe'; return out }
  if (has(/დავზოგო|შევაგროვო|დავაგროვო|რამდენ ხანში|როდის შევძლებ|როდის ვიყიდი/)) { out.intent = 'save'; return out }
  if (has(/ხელფასამდე|რამდენი დამრჩება|გავძლებ|მეყოფა|ამინდ|პროგნოზ|როგორ ვარ|რა მდგომარეობ/) && out.amount === undefined) { out.intent = 'forecast'; return out }
  if (out.amount !== undefined && has(/ვიყიდ|ყიდვ|შევიძინ|დავხარჯ|ღირს|ავიღ|გადავიხად|მინდა|ვისესხ|ვაჩუქ|წავიდე|ვჭამ|რესტორ|ღირებულ/) ) { out.intent = 'purchase'; return out }
  if (out.amount !== undefined && out.item) { out.intent = 'purchase'; return out }
  // follow-ups: only modifiers
  if (out.months !== undefined || out.startMonth !== undefined || out.ratePct !== undefined || out.zeroRate || out.useSavings || out.upfront !== undefined || out.afterPayday || (out.amount !== undefined && has(/^\s*(და|ან|თუ)\b/)) || has(/^\s*(და|ან)\s*თუ/)) {
    out.intent = 'followup'; return out
  }
  if (out.amount !== undefined) { out.intent = 'purchase'; return out }
  return out
}
