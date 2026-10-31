// "გზის გასაყარი": the content of Nino's month. Prices are on Nino's scale (1 800 ₾ salary, 70 ₾ cushion).
// Option `a` is always the pricier one, `b` the cheaper one; which of them is the upper lane is decided per month.
// Equal-joy rule: a free and a paid option for the same social or fun need give the same ⚡; only convenience can save ⚡.
// Text limits (checked by scripts/verify-fork.ts): question ≤ 36 characters, emoji + label ≤ 24, fact ≤ 70;
// the two signs of a fork show different emoji (the road signs show only the emoji and the price), and every amount
// in a fact is checked against the prices it comes from.
// A fact is a true statement, never advice: arithmetic from the month's own numbers or a well-known money rule.

export type ForkCat = 'conv' | 'social' | 'want' | 'energy' | 'chain'

export interface Opt {
  e: string
  t: string
  p: number
  en: number
  /** a later cost that this option brings (in days from the fork); `fact` sums it up for the end card */
  later?: { in: number; e: string; t: string; p: number; en: number; was: string; fact: string }
  /** money that comes back on a day of the month; day ≥ 30 = after payday (outside this month) */
  back?: { day: number; p: number; e: string; t: string }
}

export interface ForkCard {
  id: string
  /** context line shown above the pads while the fork approaches */
  q: string
  cat: ForkCat
  /** allowed day indices (0 = 10 ნოე … 29 = 9 დეკ); weekday 0 = Sunday */
  when?: (day: number, weekday: number) => boolean
  a: Opt
  b: Opt
  /** a short true fact shown for a moment after the choice (not after every fork: see FACT_GAP in sim.ts) */
  fact?: string
}

const weekend = (_d: number, w: number) => w === 0 || w === 6
const friSat = (_d: number, w: number) => w === 5 || w === 6

export const FORKS: ForkCard[] = [
  // ---- convenience: paying saves ⚡ ----
  { id: 'bolt', q: '„კიდევ 5 წუთი" 40 წუთი გამოვიდა', cat: 'conv', fact: 'Bolt 9 ₾, მეტრო 1 ₾: 20 სამუშაო დღეზე ეს 160 ₾ სხვაობაა',
    a: { e: '🚕', t: 'Bolt-ით გავფრინდები', p: 9, en: 0 }, b: { e: '🚇', t: 'მეტროთი, სირბილით', p: 1, en: -1 } },
  { id: 'dinner', q: 'ღამის 1-ია, მაცივარში მარტო კეტჩუპია', cat: 'conv', fact: 'Glovo 22 ₾ ყოველ საღამოს = თვეში 660 ₾, ქირა კი 600 ₾-ია',
    a: { e: '🍕', t: 'Glovo-დან პიცა', p: 22, en: 0 }, b: { e: '🍝', t: 'მაკარონი კეტჩუპით', p: 6, en: -1 } },
  { id: 'cleaning', q: 'სკამზე ტანსაცმლის ევერესტია', cat: 'conv', when: weekend,
    a: { e: '🧹', t: 'დამლაგებელი მოვა', p: 35, en: 0 }, b: { e: '🎧', t: 'თავად, პლეილისტით', p: 0, en: -2 } },
  { id: 'lunch', q: 'შესვენებაა, მგელივით მშია', cat: 'conv', fact: 'ხინკალი 16 ₾, ერბოკვერცხი 3 ₾: 20 სამუშაო დღეზე სხვაობა 260 ₾',
    a: { e: '🥟', t: '10 ხინკალი კაფეში', p: 16, en: 0 }, b: { e: '🍳', t: 'ერბოკვერცხი, მე-3 დღე', p: 3, en: -1 } },
  { id: 'groceries', q: 'მაცივარში ექოა. კეტჩუპიც გათავდა', cat: 'conv', fact: 'მარკეტი 42 ₾, ბაზარი 26 ₾: 4 კვირაზე ეს 64 ₾ სხვაობაა',
    a: { e: '🛒', t: 'მარკეტი სახლთან', p: 42, en: 0 }, b: { e: '🧺', t: 'დეზერტირების ბაზარი', p: 26, en: -1 } },
  { id: 'night', q: 'ცვლა მორჩა, ბოლო ავტობუსი 5 წუთშია', cat: 'conv', fact: 'ტაქსი 12 ₾, ავტობუსი 1 ₾: ერთი ტაქსი 12 მგზავრობის ფასია',
    a: { e: '🚕', t: 'ტაქსი კარამდე', p: 12, en: 0 }, b: { e: '🏃', t: 'ბოლო ავტობუსს დავეწევი', p: 1, en: -1 } },
  { id: 'laundry', q: 'სარეცხმა მანქანამ ცეკვა დაიწყო', cat: 'conv', fact: '9 გადასახადიდან 6, ქირის ჩათვლით, 1–7 დეკემბერს მოდის',
    a: { e: '🔧', t: 'ხელოსანს დავურეკავ', p: 45, en: 0 }, b: { e: '📹', t: 'YouTube-ით შევაკეთებ', p: 4, en: -2 } },
  { id: 'nails', q: 'კორპორატივზე ბევრი ფოტო იქნება', cat: 'conv', fact: 'სალონი 35 ₾, სახლში 5 ₾: თვეში ორჯერ ეს 60 ₾ სხვაობაა',
    a: { e: '💅', t: 'მანიკური სალონში', p: 35, en: 0 }, b: { e: '🏠', t: 'სახლში, სერიალთან', p: 5, en: -1 } },
  { id: 'rain', q: 'თავსხმაა, Bolt-ის ფასი გაორმაგდა', cat: 'conv', fact: 'Bolt-ის ფასი მოთხოვნას მიჰყვება: 9 ₾-იანი გზა წვიმამ 18 ₾ გახადა',
    a: { e: '🚕', t: 'Bolt ×2, მაგრამ მშრალი', p: 18, en: 0 }, b: { e: '☔', t: 'მეტრო და სველი ფეხები', p: 1, en: -2 } },
  { id: 'marshrutka', q: 'მარშრუტკა სავსეა, ადგილი კართანაა', cat: 'conv', fact: 'ტაქსი 10 ₾, მარშრუტკა 1 ₾: კვირაში 5 მგზავრობაზე ეს 45 ₾ სხვაობაა',
    a: { e: '🚕', t: 'ტაქსით, კომფორტით', p: 10, en: 0 }, b: { e: '🚐', t: 'ერთ ფეხზე, კართან', p: 1, en: -1 } },
  { id: 'dryclean', q: 'აჭარულის კარაქი ქურთუკზე დამეწვეთა', cat: 'conv',
    a: { e: '🧥', t: 'ქიმწმენდაში', p: 25, en: 0 }, b: { e: '🧼', t: 'საპნით და იმედით', p: 1, en: -1 } },
  { id: 'dishes', q: 'ნიჟარაში ჭურჭლის პიზის კოშკია', cat: 'conv', fact: 'ერთჯერადი თეფშები ყოველ კვირას: 6 ₾ × 4 = 24 ₾, პირდაპირ ნაგავში',
    a: { e: '🍽️', t: 'ერთჯერადი თეფშები', p: 6, en: 0 }, b: { e: '🧽', t: 'ვრეცხავ, პოდკასტით', p: 0, en: -2 } },

  // ---- social and fun: the same ⚡ either way ----
  { id: 'bar', q: 'ჩატი: „ერთ ლუდზე და ადრე წავალთ"', cat: 'social', when: friSat, fact: 'ბარი 30 ₾ კვირაში ერთხელ — თვეში დაახლოებით 120 ₾',
    a: { e: '🍻', t: '„ერთი" ლუდი ბარში', p: 30, en: 1 }, b: { e: '🫖', t: 'ჩაი ჩემთან, აივანზე', p: 0, en: 1 } },
  { id: 'trip', q: 'თავისუფალი დღეა! ბუნება მეძახის', cat: 'social', when: weekend,
    a: { e: '🏔️', t: 'ყაზბეგი, სელფებით', p: 60, en: 2 }, b: { e: '🌳', t: 'ლისის ტბა, ფეხით', p: 0, en: 2 } },
  { id: 'cinema', q: 'ჩატში ახალი ფილმის სპოილერებია', cat: 'social', fact: 'კინო და პოპკორნი 14 ₾ კვირაში ერთხელ = თვეში 56 ₾',
    a: { e: '🎬', t: 'კინოში, პოპკორნით', p: 14, en: 1 }, b: { e: '🎞️', t: 'ძველი ფილმი დივანზე', p: 0, en: 1 } },
  { id: 'giorgoba', q: 'გიორგობაა — ყოველი მეორე გიორგია!', cat: 'social', when: d => d === 13,
    a: { e: '🍷', t: 'სუფრა რესტორანში', p: 35, en: 1 }, b: { e: '🥘', t: 'სუფრა ბებიასთან', p: 0, en: 1 } },
  { id: 'mom', q: 'დედა: „ცოცხალი ხარ? ჩამოდი!"', cat: 'social', when: weekend,
    a: { e: '🚌', t: 'სოფელში ჩავალ', p: 20, en: 2 }, b: { e: '📱', t: 'ვიდეოზარი, ეზოს ტურით', p: 0, en: 2 } },
  { id: 'bday', q: 'ანის დაბადების დღეა, ჩატში 200 🎉', cat: 'social',
    a: { e: '🍽️', t: 'რესტორანი, 12 კაცი', p: 40, en: 1 }, b: { e: '🎂', t: 'ტორტი და კარაოკე', p: 10, en: 1 } },
  { id: 'wedding', q: 'ბიძაშვილის ქორწილი: 400 სტუმარი', cat: 'social', when: weekend,
    a: { e: '💌', t: 'კონვერტში 100 ₾', p: 100, en: 1 }, b: { e: '💃', t: '50 ₾ და ბევრი ცეკვა', p: 50, en: 1 } },
  { id: 'xmas', q: 'ქალაქი ანათებს, ჩემთან ჯერ ნოემბერია', cat: 'social', when: d => d >= 21, fact: 'დეკემბერში ხარჯი ჩვეულებრივ იზრდება: საჩუქრები, სუფრები, ნაძვის ხე',
    a: { e: '🎄', t: 'დიდი ნაძვის ხე', p: 45, en: 1 }, b: { e: '🌲', t: 'ტოტი და გირლანდა', p: 8, en: 1 } },
  { id: 'nardi', q: 'მეგობრები მოვიდნენ: „რამე ვქნათ!"', cat: 'social',
    a: { e: '🎳', t: 'ბოულინგი', p: 24, en: 1 }, b: { e: '🎲', t: 'ნარდი ღირსებაზე', p: 0, en: 1 } },
  { id: 'gift', q: 'ჩემი და: „არაფერი მინდა" (ტყუის)', cat: 'social',
    a: { e: '🎁', t: 'ოქროს საყურე', p: 90, en: 1 }, b: { e: '🖼️', t: 'ბავშვობის ფოტოალბომი', p: 10, en: 1 } },
  { id: 'supra', q: 'მეზობელი: „შემოდი, ერთ ჭიქაზე!"', cat: 'social',
    a: { e: '🍰', t: 'ტორტით შევალ', p: 20, en: 1 }, b: { e: '🥂', t: 'სადღეგრძელოთი შევალ', p: 0, en: 1 } },
  { id: 'karaoke', q: 'ჩატი: „კარაოკე! უარი არ მიიღება"', cat: 'social', when: friSat, fact: 'კარაოკე-ბარი 35 ₾ კვირაში ერთხელ = თვეში 140 ₾',
    a: { e: '🎤', t: 'კარაოკე-ბარში', p: 35, en: 1 }, b: { e: '📺', t: 'YouTube-კარაოკე სახლში', p: 0, en: 1 } },

  // ---- wants: no ⚡ either way ----
  { id: 'blackfriday', q: 'შავი პარასკევი: −40% ყველაფერზე!', cat: 'want', when: d => d === 17, fact: '200 ₾-იანი ქურთუკი −40%-ით: „დანაზოგი" 80 ₾, ხარჯი 120 ₾',
    a: { e: '🛍️', t: 'მეოთხე ქურთუკი', p: 120, en: 0 }, b: { e: '👀', t: 'ვუყურებ და ვხურავ', p: 0, en: 0 } },
  { id: 'headphones', q: 'ყურსასმენები −30%, ტაიმერი ითვლის!', cat: 'want', fact: 'უკუთვლის ტაიმერი ყიდვის ასაჩქარებლადაა შექმნილი',
    a: { e: '🎧', t: 'ვიყიდი, სანამ „იწვის"', p: 69, en: 0 }, b: { e: '🎶', t: 'ძველი ჯერ უკრავს', p: 0, en: 0 } },
  { id: 'temu', q: 'Temu-ს კალათა: 12 „აუცილებელი" ნივთი', cat: 'want', fact: 'თითო ნივთი დაახლოებით 3 ₾-ია, 12 ერთად — 38 ₾',
    a: { e: '📦', t: 'ყველაფერს ვიყიდი', p: 38, en: 0 }, b: { e: '🗑️', t: 'კალათას გავასუფთავებ', p: 0, en: 0 } },
  { id: 'dress', q: 'წვეულებაა, ეს კაბა ყველას უნახავს', cat: 'want', when: d => d >= 21,
    a: { e: '👗', t: 'ახალი კაბა', p: 85, en: 0 }, b: { e: '👭', t: 'დის კაბა (ჯერ არ იცის)', p: 0, en: 0 } },
  { id: 'coffee', q: 'დილაა, ყავის გარეშე ადამიანი არ ვარ', cat: 'want', fact: 'ყავა 7 ₾ × 20 სამუშაო დღე = 140 ₾ თვეში',
    a: { e: '☕', t: 'ლატე კაფეში', p: 7, en: 0 }, b: { e: '🥄', t: 'სამსახურის ხსნადი', p: 0, en: 0 } },
  { id: 'trial', q: 'ხვალ „უფასო" თვე ფასიანი ხდება', cat: 'want', fact: 'უფასო ვადის მერე გამოწერა ჩვეულებრივ ავტომატურად ფასიანი ხდება',
    a: { e: '🎵', t: 'გავაგრძელებ', p: 15, en: 0 }, b: { e: '✂️', t: 'ახლავე გავაუქმებ', p: 0, en: 0 } },
  { id: 'screen', q: 'ტელეფონი ისევ ეკრანით დამივარდა', cat: 'want', fact: 'ახალი ეკრანი 110 ₾ = 7 დამცავი მინა და კიდევ 5 ₾',
    a: { e: '📱', t: 'ახალი ეკრანი', p: 110, en: 0 }, b: { e: '🩹', t: 'დამცავი მინა ბზარზე', p: 15, en: 0 } },
  { id: 'magicpan', q: 'რეკლამაში „ჯადოსნური" ტაფა ვნახე', cat: 'want', fact: 'სოცქსელის რეკლამა იმაზეა მორგებული, რასაც უყურებ და ეძებ',
    a: { e: '🍳', t: 'ვიყიდი, ხომ ჯადოსნურია', p: 49, en: 0 }, b: { e: '👵', t: 'ბებიის ტაფა, 30 წლის', p: 0, en: 0 } },
  { id: 'series', q: 'სერიალი ისევ სხვა სერვისზე გადავიდა', cat: 'want', fact: '3 გამოწერა × 18 ₾ = 54 ₾ თვეში, 648 ₾ წელიწადში',
    a: { e: '📺', t: 'კიდევ ერთი გამოწერა', p: 18, en: 0 }, b: { e: '🗣️', t: 'მეგობარი მომიყვება', p: 0, en: 0 } },
  { id: 'plant', q: 'მესამე ყვავილი გამიხმა. მეოთხე?', cat: 'want',
    a: { e: '🪴', t: 'ახალი ყვავილი', p: 25, en: 0 }, b: { e: '🌵', t: 'კაქტუსი მეზობლისგან', p: 0, en: 0 } },

  // ---- rest: free either way ----
  { id: 'sleep', q: 'სერია ახლა გახურდა, ხვალ 7-ზე ვდგები', cat: 'energy',
    a: { e: '📺', t: '„ბოლო" სერია', p: 0, en: -1 }, b: { e: '😴', t: 'დავიძინებ', p: 0, en: 2 } },
  { id: 'gym', q: 'დარბაზი გადახდილია, მე კი — დივანზე', cat: 'energy', fact: 'დარბაზი თვეში 60 ₾-ია: 1 ვარჯიში = 60 ₾, 8 ვარჯიში = 7,5 ₾ თითო',
    a: { e: '🍟', t: 'დივანი და ჩიფსები', p: 4, en: -1 }, b: { e: '🏋️', t: 'ვარჯიშზე, პირველად', p: 0, en: 1 } },
  { id: 'scroll', q: 'საწოლში ვარ, TikTok-ის მე-200 ვიდეოა', cat: 'energy',
    a: { e: '📱', t: 'კიდევ ერთი ვიდეო', p: 0, en: -1 }, b: { e: '😴', t: 'ტელეფონი შორს, ძილი', p: 0, en: 1 } },

  // ---- chains: the cheap sign now can cost more later ----
  { id: 'tooth', q: 'კბილი მტკივა, სტომატოლოგის მეშინია', cat: 'chain', when: d => d <= 14, fact: 'ზღვარი 70 ₾-ია: რამდენიმე დღის ხარჯი, მოულოდნელისთვის',
    a: { e: '🦷', t: 'ექიმთან ახლავე', p: 40, en: -1 },
    b: { e: '⏳', t: '„თავისით გაივლის"', p: 0, en: 0, later: { in: 12, e: '🦷', t: 'კბილმა „თავისით" არ გაიარა', p: 120, en: -2, was: 'ექიმთან მაშინ 40 ₾ დაჯდებოდა', fact: 'მოცდამ 40 ₾-იანი ვიზიტი 120 ₾-იან მკურნალობად აქცია' } } },
  { id: 'tap', q: 'ონკანი ღამით წვეთავს: წვეთ… წვეთ…', cat: 'chain', when: d => d <= 20,
    a: { e: '🔧', t: 'ხელოსანი ახლავე', p: 30, en: 0 },
    b: { e: '🪣', t: 'ქვაბი და ყურსაცობები', p: 0, en: 0, later: { in: 6, e: '💦', t: 'ქვედა მეზობელი დაიტბორა', p: 75, en: -1, was: 'ხელოსანი მაშინ 30 ₾ დაჯდებოდა', fact: '30 ₾-იანი ხელოსანი მეზობლის ჭერის 75 ₾-იან რემონტად იქცა' } } },
  { id: 'friend', q: 'ლევანი: „50 ₾ მასესხე, ხელფასზე!"', cat: 'chain', when: d => d <= 11, fact: 'გასესხებული ფული ამ თვეს აკლდება მაშინაც კი, თუ მერე დაბრუნდება',
    a: { e: '🤝', t: 'ვასესხებ', p: 50, en: 0, back: { day: 30, p: 50, e: '🤝', t: 'ლევანი 50 ₾-ს ხელფასის შემდეგ დაგიბრუნებს' } },
    b: { e: '🙅', t: '„მეც ხელფასს ველოდები"', p: 0, en: -1 } },
  { id: 'boots', q: 'ჩექმამ წყალი გაატარა, ზამთარი მოდის', cat: 'chain', when: d => d <= 17,
    a: { e: '👢', t: 'ახლავე შევაკეთებ', p: 20, en: 0 },
    b: { e: '🛍️', t: 'პარკი წინდაზე', p: 0, en: 0, later: { in: 9, e: '👢', t: 'ჩექმა საბოლოოდ დაიშალა', p: 90, en: -1, was: 'შეკეთება მაშინ 20 ₾ დაჯდებოდა', fact: '20 ₾-იანი შეკეთება 90 ₾-იან ახალ ჩექმად იქცა' } } },
]

export const forkById = (id: string) => FORKS.find(f => f.id === id)!

/** Nino's default month, in road order, with the day each fork stands on (dinner, a strong fact, sits at fork 2: the
 * first fork whose fact may show, sim.ts FACT_FROM) */
export const CURATED: { id: string; day: number }[] = [
  { id: 'bolt', day: 0.2 }, { id: 'friend', day: 1.3 }, { id: 'dinner', day: 2.3 }, { id: 'bar', day: 3.4 },
  { id: 'cleaning', day: 4.4 }, { id: 'trip', day: 5.3 }, { id: 'tooth', day: 6.4 }, { id: 'lunch', day: 7.5 },
  { id: 'magicpan', day: 8.6 }, { id: 'sleep', day: 9.6 }, { id: 'groceries', day: 11.2 }, { id: 'supra', day: 12.3 },
  { id: 'giorgoba', day: 13.3 }, { id: 'tap', day: 14.4 }, { id: 'rain', day: 15.5 }, { id: 'temu', day: 16.4 },
  { id: 'blackfriday', day: 17.3 }, { id: 'mom', day: 18.4 }, { id: 'laundry', day: 19.5 }, { id: 'bday', day: 20.4 },
  { id: 'gym', day: 21.5 }, { id: 'dryclean', day: 22.6 }, { id: 'coffee', day: 24.3 }, { id: 'xmas', day: 26.3 }, { id: 'trial', day: 27.5 },
]
/** what waits on the road after each curated fork (index = fork index): s = scam, j = joy, - = nothing */
export const CURATED_GAPS = 'jsj-sjsj-sj-jsj-sj-' + '-sjsjj'

/** the default month's unexpected costs (other months draw them with the engine's own odds) */
export const CURATED_SURPRISES = [
  { day: 9, e: '🎧', t: 'ყურსასმენი სარეცხში გაირეცხა', p: 45 },
  { day: 24, e: '🤧', t: 'სურდო: წამლები', p: 34 },
]

export interface ScamDef { e: string; sign: string; short: string; hit: string; rule: string; p: number }
/** scams and traps on the road; `short` sits on the road, the full `sign` in the banner above; `rule` is the true fact
 * shown after a hit. The default month meets the first eight in this order; other months shuffle all of them. */
export const SCAMS: ScamDef[] = [
  { e: '📩', sign: 'ბარათი დაიბლოკა — გადადი ლინკზე', short: 'ბარათი დაიბლოკა?', hit: 'ლინკზე ბარათის მონაცემები შევიყვანე', rule: 'ბანკი ბარათს ლინკით არ განბლოკავს', p: 70 },
  { e: '🎰', sign: 'რეგისტრაციაზე 100 ₾ საჩუქრად!', short: '100 ₾ საჩუქრად?', hit: '„საჩუქრის" ასაღებად ჯერ ჩემი ფული დავდე', rule: '„საჩუქარს" იმისთვის გაძლევენ, რომ მეტი დადო', p: 50 },
  { e: '📞', sign: '„ბანკიდან ვრეკავთ, კოდი გვითხარით"', short: '„კოდი გვითხარით"', hit: 'SMS-კოდი ვუთხარი', rule: 'ბანკი კოდს არასდროს გთხოვს', p: 80 },
  { e: '💘', sign: 'ონლაინ ნაცნობი: „ბილეთი მიყიდე!"', short: '„ბილეთი მიყიდე"?', hit: 'ონლაინ ნაცნობს ბილეთი ვუყიდე. არ ჩამოვიდა', rule: 'ონლაინ ნაცნობის ფულის თხოვნა თაღლითობის ცნობილი ნიშანია', p: 60 },
  { e: '📦', sign: 'ამანათი გაჩერდა — გადაიხადე 2 ₾', short: 'ამანათი გაჩერდა?', hit: '„ბაჟი" თაღლითებს გადავუხადე', rule: 'პატარა თანხის SMS-ლინკი ბარათის მონაცემების მოპარვის ცნობილი ხერხია', p: 50 },
  { e: '💸', sign: 'სწრაფი სესხი 5 წუთში!', short: 'სესხი 5 წუთში!', hit: 'სესხის პროცენტი და საკომისიო', rule: 'სწრაფ სესხს ეფექტური პროცენტი ხშირად ბანკის სესხზე ბევრად მაღალი აქვს', p: 55 },
  { e: '👵', sign: '„შვილო, ახალი ნომერია, გადმირიცხე"', short: '„ახალი ნომერია"', hit: 'ფული უცნობს გადავურიცხე', rule: 'ასეთ თხოვნას ძველ ნომერზე დარეკვით ამოწმებენ', p: 60 },
  { e: '🪙', sign: 'ფული გააორმაგე ერთ კვირაში', short: 'ფული გაორმაგდება?', hit: '„ინვესტიცია" გაქრა', rule: 'გარანტირებული ორმაგი მოგება თაღლითობის ნიშანია', p: 75 },
  { e: '🎁', sign: 'მოიგე iPhone — გადაიხადე 1 ₾', short: 'iPhone 1 ₾-ად?', hit: '„1 ₾" ყოველთვიურ გამოწერად იქცა', rule: 'ნამდვილი პრიზისთვის ფულს არ ითხოვენ', p: 45 },
  { e: '💼', sign: 'სახლიდან მუშაობა, დღეში 300 ₾!', short: 'დღეში 300 ₾?', hit: '„რეგისტრაციის" საფასური გადავიხადე', rule: 'ნამდვილი სამსახური წინასწარ ფულს არ ითხოვს', p: 40 },
]

export interface JoyDef { e: string; t: string }
export const JOYS: JoyDef[] = [
  { e: '🐦', t: 'ჩიტი ფანჯარაზე' }, { e: '☀️', t: 'მზის სხივი' }, { e: '🥖', t: 'თბილი შოთი' }, { e: '🐈', t: 'ეზოს კატა' },
  { e: '🎶', t: 'ქუჩის მუსიკოსი' }, { e: '📞', t: 'დედასთან ზარი' }, { e: '🍂', t: 'ფოთოლცვენა' }, { e: '🌅', t: 'მზის ჩასვლა' },
  { e: '🐕', t: 'მეზობლის ძაღლი' }, { e: '❄️', t: 'პირველი თოვლი' }, { e: '✨', t: 'საახალწლო განათება' },
]
/** joys that only make sense in December */
export const DECEMBER_JOYS = new Set(['❄️', '✨'])

export const FATIGUE = [
  { e: '🤒', t: 'გავცივდი: წამლები ჩემსავე აფთიაქში', p: 35 },
  { e: '🥱', t: 'ფეხზე მძინავს: ტაქსით შინ', p: 35 },
  { e: '🪫', t: 'ბატარეა 1%: ვიტამინები', p: 35 },
]

export const SURPRISES = [
  { e: '🎧', t: 'ყურსასმენი სარეცხში გაირეცხა' }, { e: '🔌', t: 'დამტენი დაიწვა' }, { e: '🤧', t: 'სურდო: წამლები' },
  { e: '🎒', t: 'ჩანთის ელვა „დანებდა"' }, { e: '👓', t: 'სათვალეზე დავჯექი' },
]
