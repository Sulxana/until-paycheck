import { Engine } from '../src/engine/engine'
import { NINO, TAMAR, LUKA } from '../src/engine/personas'
import { respond, Ctx } from '../src/chat/responder'
const e = new Engine(NINO)
let ctx: Ctx = { kind: null }
const qs = [
  'გამარჯობა', '300 ლარის ფეხსაცმელი ვიყიდო?', 'და 50?', 'ხელფასის შემდეგ რომ ვიყიდო?', '1200 ლარის ტელეფონი განვადებით', 'და თუ აპრილამდე დავიცადო?', '24 თვეზე?',
  '300 ₾ დანაზოგიდან წინასწარ', '2 000 ₾ სესხი 24 თვით 18%-ით', '48 თვეზე?', 'სესხი მინდა', '800 ₾ მაცივარი 0%-ით 6 თვით', 'დღეს რამდენი შემიძლია?', 'ხელფასამდე მეყოფა?',
  'რა არის PTI?', 'რა არის რთული პროცენტი', 'ბიტკოინში ჩავდო?', 'ბანკიდან დამირეკეს და კოდი მთხოვეს', 'ვერ ვიხდი სესხს', 'ლეპტოპი 2500 ლარი 12 თვე 2% თვეში', 'რამდენ ხანში დავაგროვებ 1000 ლარს?', 'ვინ ხარ?', 'მადლობა', 'რა ამინდია დღეს?', 'კატა ძაღლი', '5 ათასი ლარის სესხი 3 წლით 20% წლიური',
]
for (const q of qs) {
  const r = respond(q, e, NINO, ctx, { day: 0, extra: 0 })
  ctx = r.ctx
  console.log('\n> ' + q + '   [' + r.mood + ']')
  for (const m of r.msgs) console.log('  ' + m.text.slice(0, 260).replace(/\n/g, ' | ') + (m.card ? `  {card:${m.card.kind}${m.card.kind === 'installment' ? ' ' + m.card.data.rows.map((x: any) => x.label + ' ' + x.monthly + '/' + x.cost + ' short' + x.nShort).join('; ') : ''}}` : ''))
}
const t = new Engine(TAMAR); console.log('\nTAMAR', respond('დღეს რამდენი შემიძლია?', t, TAMAR, { kind: null }, { day: 0, extra: 0 }).msgs[0].text)
const l = new Engine(LUKA); console.log('LUKA', respond('500 ლარის ტელეფონი განვადებით', l, LUKA, { kind: null }, { day: 0, extra: 0 }).msgs.map(m => m.text).join(' || '))
