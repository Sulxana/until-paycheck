// "გზის გასაყარი": the content of Nino's month. Prices are on Nino's scale (1 800 ₾ salary, 70 ₾ cushion).
// Option `a` is always the pricier one, `b` the cheaper one; which of them is the upper lane is decided per month.
// Equal-joy rule: a free and a paid option for the same social or fun need give the same ⚡; only convenience can save ⚡.

export type ForkCat = 'conv' | 'social' | 'want' | 'energy' | 'chain'

export interface Opt {
  e: string
  t: string
  p: number
  en: number
  /** a later cost that this option brings (in days from the fork) */
  later?: { in: number; e: string; t: string; p: number; en: number; was: string }
  /** money that comes back on a day of the month; day ≥ 30 = after payday (outside this month) */
  back?: { day: number; p: number; e: string; t: string }
}

export interface ForkCard {
  id: string
  /** context line shown above the road while the fork approaches */
  q: string
  cat: ForkCat
  /** allowed day indices (0 = 10 ნოე … 29 = 9 დეკ); weekday 0 = Sunday */
  when?: (day: number, weekday: number) => boolean
  a: Opt
  b: Opt
}

const weekend = (_d: number, w: number) => w === 0 || w === 6
const friSat = (_d: number, w: number) => w === 5 || w === 6

export const FORKS: ForkCard[] = [
  // ---- convenience: paying saves ⚡ ----
  { id: 'bolt', q: 'სამსახურში მაგვიანდება', cat: 'conv', a: { e: '🚕', t: 'Bolt', p: 9, en: 0 }, b: { e: '🚇', t: 'მეტრო', p: 1, en: -1 } },
  { id: 'dinner', q: 'სახლში მშიერი დავბრუნდი', cat: 'conv', a: { e: '🍕', t: 'Glovo', p: 22, en: 0 }, b: { e: '🍳', t: 'მოვამზადებ', p: 6, en: -1 } },
  { id: 'cleaning', q: 'სახლი აირია', cat: 'conv', when: weekend, a: { e: '🧹', t: 'დამლაგებელი', p: 35, en: 0 }, b: { e: '🧽', t: 'თავად დავალაგებ', p: 0, en: -2 } },
  { id: 'lunch', q: 'შესვენებაა, მშია', cat: 'conv', a: { e: '🥟', t: 'ხინკალი კაფეში', p: 16, en: 0 }, b: { e: '🥪', t: 'სახლიდან წავიღებ', p: 3, en: -1 } },
  { id: 'groceries', q: 'მაცივარი ცარიელია', cat: 'conv', a: { e: '🛒', t: 'მარკეტი სახლთან', p: 42, en: 0 }, b: { e: '🧺', t: 'დეზერტირებზე', p: 26, en: -1 } },
  { id: 'night', q: 'ცვლაზე გვიანობამდე დავრჩი', cat: 'conv', a: { e: '🚕', t: 'ტაქსით შინ', p: 12, en: 0 }, b: { e: '🚌', t: 'ბოლო ავტობუსით', p: 1, en: -1 } },
  { id: 'laundry', q: 'სარეცხი მანქანა გაჩერდა', cat: 'conv', a: { e: '🔧', t: 'ხელოსანი', p: 45, en: 0 }, b: { e: '📹', t: 'YouTube-ით შევაკეთებ', p: 4, en: -2 } },
  { id: 'nails', q: 'პარასკევს კორპორატივი მაქვს', cat: 'conv', a: { e: '💅', t: 'მანიკური სალონში', p: 35, en: 0 }, b: { e: '💅', t: 'სახლში გავიკეთებ', p: 5, en: -1 } },

  // ---- social and fun: the same ⚡ either way ----
  { id: 'bar', q: 'მეგობრები ბარში მეძახიან', cat: 'social', when: friSat, a: { e: '🍻', t: 'ბარში', p: 30, en: 1 }, b: { e: '🫖', t: 'სახლში ჩაიზე', p: 0, en: 1 } },
  { id: 'trip', q: 'შაბათ-კვირა თავისუფალი მაქვს', cat: 'social', when: weekend, a: { e: '🏔️', t: 'ყაზბეგში', p: 60, en: 2 }, b: { e: '🌳', t: 'ლისის ტბაზე', p: 0, en: 2 } },
  { id: 'cinema', q: 'ახალი ფილმი გამოვიდა', cat: 'social', a: { e: '🎬', t: 'კინოში', p: 14, en: 1 }, b: { e: '🎞️', t: 'ფილმი სახლში', p: 0, en: 1 } },
  { id: 'giorgoba', q: 'გიორგობაა!', cat: 'social', when: d => d === 13, a: { e: '🍷', t: 'სუფრა რესტორანში', p: 35, en: 1 }, b: { e: '🥘', t: 'სუფრა ბებიასთან', p: 0, en: 1 } },
  { id: 'mom', q: 'დედამ დარეკა: „ჩამოდი!"', cat: 'social', when: weekend, a: { e: '🚌', t: 'სოფელში ჩავალ', p: 20, en: 2 }, b: { e: '📱', t: 'ვიდეოზარი', p: 0, en: 2 } },
  { id: 'bday', q: 'ანის დაბადების დღეა', cat: 'social', a: { e: '🍽️', t: 'რესტორანში', p: 40, en: 1 }, b: { e: '🎂', t: 'ტორტი ჩემთან', p: 10, en: 1 } },
  { id: 'wedding', q: 'ბიძაშვილის ქორწილია', cat: 'social', when: weekend, a: { e: '💌', t: 'კონვერტში 100 ₾', p: 100, en: 1 }, b: { e: '💌', t: 'კონვერტში 50 ₾', p: 50, en: 1 } },
  { id: 'xmas', q: 'ახალი წელი ახლოვდება', cat: 'social', when: d => d >= 21, a: { e: '🎄', t: 'ნაძვის ხე', p: 45, en: 1 }, b: { e: '🌲', t: 'ნაძვის ტოტი', p: 8, en: 1 } },
  { id: 'nardi', q: 'საღამოს მეგობრები მოვიდნენ', cat: 'social', a: { e: '🎳', t: 'ბოულინგი', p: 24, en: 1 }, b: { e: '🎲', t: 'ნარდი ეზოში', p: 0, en: 1 } },
  { id: 'gift', q: 'დას დაბადების დღე აქვს', cat: 'social', a: { e: '🎁', t: 'ოქროს საყურე', p: 90, en: 1 }, b: { e: '🖼️', t: 'ხელნაკეთი ალბომი', p: 10, en: 1 } },

  // ---- wants: no ⚡ either way ----
  { id: 'blackfriday', q: 'შავი პარასკევი! −40%', cat: 'want', when: d => d === 17, a: { e: '🛍️', t: 'ქურთუკი', p: 120, en: 0 }, b: { e: '📝', t: 'სურვილების სიაში', p: 0, en: 0 } },
  { id: 'headphones', q: 'ყურსასმენები −30%', cat: 'want', a: { e: '🎧', t: 'ახლებს ვიყიდი', p: 69, en: 0 }, b: { e: '🎧', t: 'ძველი ჯერ მუშაობს', p: 0, en: 0 } },
  { id: 'temu', q: 'კალათაში 12 ნივთი მელოდება', cat: 'want', a: { e: '📦', t: 'ვიყიდი', p: 38, en: 0 }, b: { e: '🗑️', t: 'კალათას გავასუფთავებ', p: 0, en: 0 } },
  { id: 'dress', q: 'საახალწლო წვეულება ახლოვდება', cat: 'want', when: d => d >= 21, a: { e: '👗', t: 'ახალი კაბა', p: 85, en: 0 }, b: { e: '👗', t: 'დის კაბა', p: 0, en: 0 } },
  { id: 'coffee', q: 'დილის ყავა', cat: 'want', a: { e: '☕', t: 'ყავა კაფეში', p: 7, en: 0 }, b: { e: '☕', t: 'სამსახურის ყავა', p: 0, en: 0 } },
  { id: 'trial', q: 'უფასო საცდელი ვადა მთავრდება', cat: 'want', a: { e: '🎵', t: 'გავაგრძელებ', p: 15, en: 0 }, b: { e: '✂️', t: 'გავაუქმებ', p: 0, en: 0 } },
  { id: 'screen', q: 'ტელეფონის ეკრანი გაიბზარა', cat: 'want', a: { e: '📱', t: 'ახალი ეკრანი', p: 110, en: 0 }, b: { e: '🩹', t: 'დამცავი მინა', p: 15, en: 0 } },

  // ---- rest: free either way ----
  { id: 'sleep', q: 'ღამის 12 საათია', cat: 'energy', a: { e: '📺', t: 'კიდევ ერთი სერია', p: 0, en: -1 }, b: { e: '😴', t: 'დავიძინებ', p: 0, en: 2 } },
  { id: 'gym', q: 'დარბაზი უკვე გადახდილია', cat: 'energy', a: { e: '🍟', t: 'დივანი და ჩიფსები', p: 4, en: -1 }, b: { e: '🏋️', t: 'ვარჯიშზე', p: 0, en: 1 } },

  // ---- chains: the cheap sign now can cost more later ----
  { id: 'tooth', q: 'კბილი მტკივა', cat: 'chain', when: d => d <= 14, a: { e: '🦷', t: 'ექიმთან ახლავე', p: 40, en: -1 }, b: { e: '⏳', t: 'მოიცდის', p: 0, en: 0, later: { in: 12, e: '🦷', t: 'კბილმა ვეღარ მოიცადა', p: 120, en: -2, was: 'ექიმთან მაშინ 40 ₾ დაჯდებოდა' } } },
  { id: 'tap', q: 'ონკანი წვეთავს', cat: 'chain', when: d => d <= 20, a: { e: '🔧', t: 'ხელოსანი ახლავე', p: 30, en: 0 }, b: { e: '🪣', t: 'ქვაბს დავუდგამ', p: 0, en: 0, later: { in: 6, e: '💦', t: 'ქვედა მეზობელი დაიტბორა', p: 75, en: -1, was: 'ხელოსანი მაშინ 30 ₾ დაჯდებოდა' } } },
  { id: 'friend', q: 'ლევანს 50 ₾ სჭირდება', cat: 'chain', when: d => d <= 11, a: { e: '🤝', t: 'ვასესხებ', p: 50, en: 0, back: { day: 30, p: 50, e: '🤝', t: 'ლევანი 50 ₾-ს ხელფასის შემდეგ დაგიბრუნებს' } }, b: { e: '🙅', t: 'უარს ვეტყვი', p: 0, en: -1 } },
]

export const forkById = (id: string) => FORKS.find(f => f.id === id)!

/** Nino's default month, in road order, with the day each fork stands on */
export const CURATED: { id: string; day: number }[] = [
  { id: 'bolt', day: 0.2 }, { id: 'dinner', day: 1.3 }, { id: 'friend', day: 2.3 }, { id: 'bar', day: 3.4 },
  { id: 'cleaning', day: 4.4 }, { id: 'trip', day: 5.3 }, { id: 'tooth', day: 6.4 }, { id: 'lunch', day: 7.5 },
  { id: 'headphones', day: 8.6 }, { id: 'sleep', day: 9.6 }, { id: 'groceries', day: 11.2 }, { id: 'cinema', day: 12.3 },
  { id: 'giorgoba', day: 13.3 }, { id: 'tap', day: 14.4 }, { id: 'night', day: 15.5 }, { id: 'temu', day: 16.4 },
  { id: 'blackfriday', day: 17.3 }, { id: 'mom', day: 18.4 }, { id: 'laundry', day: 19.5 }, { id: 'bday', day: 20.4 },
  { id: 'gym', day: 21.5 }, { id: 'nails', day: 22.6 }, { id: 'coffee', day: 24.3 }, { id: 'xmas', day: 26.3 }, { id: 'trial', day: 27.5 },
]
/** what waits on the road after each curated fork (index = fork index): s = scam, j = joy, - = nothing */
export const CURATED_GAPS = 'jsj-sjsj-sj-jsj-sj-' + '-sjsjj'

/** the default month's unexpected costs (other months draw them with the engine's own odds) */
export const CURATED_SURPRISES = [
  { day: 9, e: '👟', t: 'ფეხსაცმლის შეკეთება', p: 45 },
  { day: 24, e: '💊', t: 'წამლები', p: 34 },
]

export interface ScamDef { e: string; sign: string; short: string; hit: string; rule: string; p: number }
/** scams and traps on the road; `short` sits on the road, the full `sign` in the banner above */
export const SCAMS: ScamDef[] = [
  { e: '📩', sign: 'ბარათი დაიბლოკა — გადადი ლინკზე', short: 'ბარათი დაიბლოკა?', hit: 'ლინკზე ბარათის მონაცემები შევიყვანე', rule: 'ბანკი ბარათს ლინკით არ განბლოკავს', p: 70 },
  { e: '🎁', sign: 'მოიგე iPhone — გადაიხადე 1 ₾', short: 'iPhone 1 ₾-ად?', hit: '„1 ₾" ყოველთვიურ გამოწერად იქცა', rule: 'ნამდვილი პრიზისთვის ფულს არ ითხოვენ', p: 45 },
  { e: '📞', sign: '„ბანკიდან ვრეკავთ, კოდი გვითხარით"', short: '„კოდი გვითხარით"', hit: 'SMS-კოდი ვუთხარი', rule: 'ბანკი კოდს არასდროს გთხოვს', p: 80 },
  { e: '💸', sign: 'სწრაფი სესხი 5 წუთში!', short: 'სესხი 5 წუთში!', hit: 'სესხის პროცენტი და საკომისიო', rule: 'სწრაფ სესხს ეფექტური პროცენტი ხშირად ბანკის სესხზე ბევრად მაღალი აქვს', p: 55 },
  { e: '📦', sign: 'ამანათი გაჩერდა — გადაიხადე 2 ₾', short: 'ამანათი გაჩერდა?', hit: '„ბაჟი" თაღლითებს გადავუხადე', rule: 'ფოსტა ბაჟს SMS-ის ლინკით არ ითხოვს', p: 50 },
  { e: '👵', sign: '„შვილო, ახალი ნომერია, გადმირიცხე"', short: '„ახალი ნომერია"', hit: 'ფული უცნობს გადავურიცხე', rule: 'ასეთ თხოვნას ძველ ნომერზე დარეკვით ამოწმებენ', p: 60 },
  { e: '💼', sign: 'სახლიდან მუშაობა, დღეში 300 ₾!', short: 'დღეში 300 ₾?', hit: '„რეგისტრაციის" საფასური გადავიხადე', rule: 'ნამდვილი სამსახური წინასწარ ფულს არ ითხოვს', p: 40 },
  { e: '🪙', sign: 'ფული გააორმაგე ერთ კვირაში', short: 'ფული გაორმაგდება?', hit: '„ინვესტიცია" გაქრა', rule: 'გარანტირებული ორმაგი მოგება თაღლითობის ნიშანია', p: 75 },
]

export interface JoyDef { e: string; t: string }
export const JOYS: JoyDef[] = [
  { e: '🐦', t: 'ჩიტი ფანჯარაზე' }, { e: '☀️', t: 'მზის სხივი' }, { e: '🌳', t: 'პარკი' }, { e: '🐈', t: 'ეზოს კატა' },
  { e: '🎶', t: 'ქუჩის მუსიკოსი' }, { e: '📞', t: 'დედასთან ზარი' }, { e: '🍂', t: 'ფოთოლცვენა' }, { e: '🌅', t: 'მზის ჩასვლა' },
  { e: '🐕', t: 'მეზობლის ძაღლი' }, { e: '❄️', t: 'პირველი თოვლი' }, { e: '✨', t: 'საახალწლო განათება' },
]
/** joys that only make sense in December */
export const DECEMBER_JOYS = new Set(['❄️', '✨'])

export const FATIGUE = [
  { e: '🤒', t: 'გავცივდი: აფთიაქი', p: 35 },
  { e: '🤕', t: 'თავი ამტკივდა: ტაქსით შინ', p: 35 },
  { e: '🛌', t: 'ძალა გამომელია: ვიტამინები', p: 35 },
]

export const SURPRISES = [
  { e: '👟', t: 'ფეხსაცმლის შეკეთება' }, { e: '🔌', t: 'დამტენი დაიწვა' }, { e: '💊', t: 'წამლები' },
  { e: '🎒', t: 'ჩანთის ელვა გაფუჭდა' }, { e: '🧥', t: 'ქურთუკის ქიმწმენდა' },
]
