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

// jury probes: trust, bank choice, safety and the hardship persona (each line starts a fresh conversation unless it is a follow-up)
const probes: [typeof NINO, string[]][] = [
  [NINO, ['ჩემს საბანკო ანგარიშთან ხარ დაკავშირებული ახლა?']], [NINO, ['რამდენად ზუსტია თქვენი პროგნოზი?']], [NINO, ['რომელი ბანკი გასცემს ყველაზე იაფ სესხს?']],
  [NINO, ['ეს 0%-იანი განვადება მართლა უფასოა?']], [NINO, ['ხელფასის რამდენი პროცენტი შეიძლება მიდიოდეს სესხებზე?']], [NINO, ['SMS მომივიდა: ამანათისთვის 2 ლარი გადაიხადეთო, ლინკით. გადავიხადო?']],
  [NINO, ['5000 ლარი სესხი 3 წლით, წლიური 22%', 'ავიღო თუ არა ეს სესხი? კი ან არა']], [NINO, ['კაზინოში 600 ლარი წავაგე, როგორ დავიბრუნო?', 'სესხი ავიღო და ვითამაშო?']],
  [NINO, ['მიკროსესხი 300 ლარი 30 დღით', '345 ლარი']], [NINO, ['აღარ მინდა ცხოვრება']], [NINO, ['გამარჯობა, 80 ლარის საჩუქარი ვიყიდო?']],
  [TAMAR, ['ვალები მაქვს და ვეღარ ვიხდი, რა ვქნა?']], [TAMAR, ['1000 ლარი სესხი 12 თვით']], [TAMAR, ['რა არის PTI?']],
  // follow-ups, numbers and plain-words answers (batches B, C, F)
  [NINO, ['5000 ლარი სესხი 3 წლით, წლიური 22%', 'ჯამში რამდენს გადავიხდი?', 'პროცენტი რამდენია', 'სესხი 24 თვით?', '1500 ლარი 24 თვით']],
  [NINO, ['1200 ლარის ტელეფონი განვადებით', 'და 1500?', 'სულ რამდენი დამიჯდება?']],
  [NINO, ['2000 ლარი სესხი 24 თვით', 'მარტივად ამიხსენი', 'რატომ?', 'მაგალითით ამიხსენი']],
  [NINO, ['1200 ლარიანი ტელეფონისთვის რამდენ ხანში დავაგროვებ?', 'თვეში 200-ს თუ გადავდებ?']],
  [NINO, ['დეპოზიტზე 1000 ლარი 10%-ით ერთ წელში რამდენი გახდება?', 'და 2 წლით?']],
  [NINO, ['1.200 ლარიანი ლეპტოპი']], [NINO, ['50/30/20 წესი რა არის?']], [NINO, ['ხელფასამდე 40 ლარი დამრჩა']], [NINO, ['ორასი ლარის ქურთუკი ვიყიდო?']],
  [NINO, ['300 ლარის ფეხსაცმელი ვიყიდო?', 'ხელფასის შემდეგ რომ ვიყიდო?']], [NINO, ['რა არის ინფლაცია?', 'უფრო მარტივად?', 'მაგალითით ამიხსენი']],
  [TAMAR, ['ორი შვილი მყავს და ხელფასამდე 40 ლარი დამრჩა']],
]
const engines = new Map<string, Engine>([['nino', e], ['tamar', t]])
for (const [p, turns] of probes) {
  let c: Ctx = { kind: null }
  for (const q of turns) {
    const r = respond(q, engines.get(p.id)!, p, c, { day: 0, extra: 0 })
    c = r.ctx
    console.log(`\n${p.id === 'tamar' ? 'TAMAR ' : ''}> ${q}   [${r.mood}]`)
    for (const m of r.msgs) console.log('  ' + m.text.slice(0, 260).replace(/\n/g, ' | ') + (m.card ? `  {card:${m.card.kind}${m.card.kind === 'concept' ? ' mine: ' + m.card.data.mine : ''}}` : ''))
  }
}
