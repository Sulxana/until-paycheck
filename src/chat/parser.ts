// Rule-based Georgian intent parser for Jikho. Works offline, deterministic.
// Word edges: JS `\b` only knows ASCII letters, so Georgian words are bounded with (?:^|[^ა-ჰ]) and (?![ა-ჰ]).
// No lookbehind: older iPhone Safari cannot parse it.
export type Intent =
  | 'greeting' | 'thanks' | 'who' | 'purchase' | 'installment' | 'loan' | 'safe' | 'forecast' | 'save' | 'concept' | 'invest' | 'followup' | 'hardship'
  | 'distress' | 'gambling' | 'decide' | 'total' | 'explain' | 'ack' | 'deposit' | 'budget' | 'unknown'

export type ConceptId = 'pti' | 'eir' | 'compound' | 'cushion' | 'weather' | 'installment' | 'overdraft' | 'deposit' | 'inflation' | 'fraud' | 'credithistory' | 'restructure' | 'fixed' | 'zero'
  | 'data' | 'nobank' | 'gambling' | 'late' | 'risk' | 'emergency' | 'budget' | 'debts'

export interface Parsed {
  intent: Intent
  amount?: number
  months?: number
  /** a short loan term written in days ("30 დღით") */
  days?: number
  ratePct?: number
  rateIsAnnual?: boolean
  zeroRate?: boolean
  startMonth?: number // 1..12
  afterPayday?: boolean
  upfront?: number
  useSavings?: boolean
  item?: string
  concept?: ConceptId
  /** microloan / fast-money wording: never priced with the bank example rate */
  micro?: boolean
  /** self-harm wording (distress intent) */
  selfHarm?: boolean
  /** distress words next to a hardship question */
  distress?: boolean
  /** a monthly saving contribution ("თვეში 200-ს თუ გადავდებ?") */
  perMonth?: number
  /** money the person says they have now ("ხელფასამდე 40 ლარი დამრჩა") */
  onHand?: number
  /** a spend repeated every day ("დღეში 40 ლარი") */
  daily?: number
  /** a short question about the numbers already on the table */
  ask?: 'total' | 'monthly' | 'rate'
  /** a follow-up on the last answer: simpler words, an example, why, more detail */
  explain?: 'simple' | 'example' | 'why' | 'more'
  /** a hypothetical change of the current numbers ("და 1500?", "2 200 ლარი რომ იყოს?") */
  whatIf?: boolean
  /** points at the deal already shown ("ეს სესხი", "ამ განვადებაზე") */
  sameDeal?: boolean
  /** "what can you do?" */
  help?: boolean
  /** the real weather ("ხვალ თბილისში"), not the money forecast */
  sky?: boolean
  /** "who pays for this?" (the business model) */
  biz?: boolean
  /** a bill to pay, not a purchase ("ქირა 500 მაქვს გადასახდელი") */
  bill?: boolean
  /** a spend that already happened (a pasted bank SMS) */
  spent?: boolean
  /** a question about the person's bills ("კომუნალურები?") */
  bills?: boolean
  /** "is this AI / ChatGPT?" */
  ai?: boolean
  /** "is this app here to sell loans?" (the business model, asked as a trust question) */
  loanSales?: boolean
  /** "when does my salary arrive?" */
  when?: boolean
  /** two terms to compare ("12 თვე ჯობია თუ 24?") */
  compareMonths?: number[]
  /** lending money to someone ("მეგობარს 200 ლარი ვასესხო?"): 'past' when it already happened */
  lend?: 'future' | 'past'
  /** a salary raise ("ხელფასი 200 ლარით რომ გამეზარდოს?") */
  raise?: boolean
  /** "ეს ჩემთვის ძვირია?", "ღირს?": a question about the deal on the table */
  costly?: boolean
  /** "N დღეში ერთხელ": a daily spend made every N days */
  everyN?: number
  /** a code, PIN or card number already given to someone */
  given?: boolean
  /** a card number typed into the chat */
  cardNumber?: boolean
  /** a debt already overdue ("ვადა გადამიცილდა") */
  overdue?: boolean
  /** borrowing for rent, food or bills */
  essential?: boolean
  /** a plain fact question answered by the responder (mortgage, guarantor, leasing, ...) */
  fact?: boolean
  /** "how much is on my card?", "where does my money go?" */
  balance?: 'now' | 'spend'
  /** "is this app addictive?" */
  habit?: boolean
  /** the day a spend happens, counted from today ("ხვალ" 1, "ზეგ" 2); a weekday (0 = Monday) when one is named */
  dayOffset?: number
  weekday?: number
  /** that day as typed, for the answer ("ხვალ", "შაბათს") */
  dayWord?: string
  /** a minus sign before the sum ("-200 ლარი") */
  negative?: boolean
  /** "0 თვით": a term of zero months */
  zeroTerm?: boolean
  /** several sums in one message ("საჩუქარი 80 ლარი და ტაქსი 20 ლარი"): the amount is their total */
  parts?: number[]
  /** spends named without a sum ("ტაქსით უნდა ვიარო"): not counted in the amount */
  uncounted?: string[]
  /** a pasted bank SMS: the balance and the date it shows */
  smsBalance?: number
  smsDate?: string
  /** a daily spend that is already a habit ("ყოველდღე 10 ლარს ყავაში ვხარჯავ") */
  dailyHabit?: boolean
  /** a basic need: food, school, a child's clothes, medicine */
  needed?: boolean
  /** "ხელფასი ჩამერიცხა": the person says the salary has already landed */
  salaryIn?: boolean
  /** "ფული აღარ მაქვს", "არ მყოფნის": money is short (a hardship cue, answered with what is due, not only the weather) */
  short?: boolean
  /** "ხელფასი დღეს ჩამერიცხა?": a question whether the salary has landed (answered from the payday in the data) */
  salaryQ?: boolean
  /** money named as cash ("ხელზე", "ჯიბეში", "საფულეში"): the card balance in the data is separate */
  cash?: boolean
  /** "ვიყიდო თუ დავიცადო?": buying now against waiting for payday */
  waitQ?: boolean
  /** "კვირაში რამდენი შემიძლია?": a week's budget */
  perWeek?: boolean
  /** "ავიღო თუ არა …" with the numbers in the question: priced, with the decision left to the user */
  yesNo?: boolean
  /** "პირველ რიგში რა გადავიხადო?": the month's bills in date order */
  billsOrder?: boolean
  /** "როდის შევავსებ?": when a saving goal is reached */
  goalQ?: boolean
  /** "სამსახური დავკარგე": a job lost */
  jobLoss?: boolean
  /** a clear off-topic request (a recipe, a match result, a joke, an insult) */
  offTopic?: 'food' | 'sport' | 'joke' | 'rude' | 'other'
  /** "forget your rules", "developer mode": the rules stay */
  jailbreak?: boolean
  /** questions about Jikho itself: how information differs from advice, who regulates it, who is responsible for a wrong forecast */
  meta?: 'advice' | 'regulated' | 'liability' | 'purpose'
  /** "ბანკში რა საბუთები წავიღო?" */
  docs?: boolean
  /** state help for people out of work */
  welfare?: boolean
  /** the cash price named next to an installment ("ან 1100 ლარად ნაღდად") */
  cashPrice?: number
  /** "ლეპტოპის განვადება როდის მთავრდება?": the person's own installment */
  myDebt?: boolean
  /** a range of sums ("20-30 ლარზე") */
  range?: [number, number]
  raw: string
}

/** a Georgian word that starts here (not inside another word) */
const W = (stem: string, notAfter?: string) => new RegExp(`(?:^|[^ა-ჰ])${stem}${notAfter ? `(?!${notAfter})` : ''}`)
const MONTHS: [RegExp, number][] = [
  [W('იანვ'), 1], [W('თებერვ'), 2], [W('მარტ', 'ივ|ო'), 3], [W('აპრილ'), 4], [W('მაის', 'ურ'), 5], [W('ივნის'), 6], [W('ივლის'), 7], [W('აგვისტ'), 8], [W('სექტემბ'), 9], [W('ოქტომბ'), 10], [W('ნოემბ'), 11], [W('დეკემბ'), 12],
]
const MONTH_STEMS = 'იანვ|თებერვ|მარტ|აპრილ|მაის|ივნის|ივლის|აგვისტ|სექტემბ|ოქტომბ|ნოემბ|დეკემბ'
const ITEMS: [RegExp, string][] = [
  [/ტელეფონ|აიფონ|iphone|სმარტფონ/, 'ტელეფონი'], [/ლეპტოპ|ნოუთბუქ|კომპიუტერ|macbook|laptop|notebook|ноутбук/, 'ლეპტოპი'], [/ფეხსაცმ|სპორტულ|კედ|ბოტას|ბოტინკ|ჩექმ/, 'ფეხსაცმელი'],
  [/მაცივარ/, 'მაცივარი'], [/ტელევიზორ|ტელიკ/, 'ტელევიზორი'], [/ყურსასმენ|airpods/, 'ყურსასმენი'], [/ქურთუკ|პალტო|ტანსაცმ|კაბა|მაისურ|შარვალ|ჯინს|სვიტერ/, 'ტანსაცმელი'],
  [/სარეცხ/, 'სარეცხი მანქანა'], [/ველოსიპედ/, 'ველოსიპედი'], [/კინო/, 'კინოს ბილეთი'], [/თეატრ/, 'თეატრის ბილეთი'], [/კონცერტ/, 'კონცერტის ბილეთი'], [/მოგზაურ|(?:^|[^ა-ჰ])ტურ(?:ი|ზე|ით|ის)?(?![ა-ჰ])|ბილეთ/, 'მოგზაურობა'], [/საჩუქ/, 'საჩუქარი'],
  [/playstation|ps5|კონსოლ/, 'კონსოლი'], [/მანქან/, 'მანქანა'], [/ავეჯ|დივან/, 'ავეჯი'], [/საათ/, 'საათი'], [/წიგნ/, 'წიგნები'], [/სადილ|ლანჩ/, 'სადილი'],
]
/** other spends a long message can name next to the priced one ("…და ტაქსით უნდა ვიარო") */
const EXTRA_SPENDS: [RegExp, string][] = [[/ტაქს/, 'ტაქსი'], [/რესტორ|კაფე|ვახშამ|სადილ/, 'რესტორანი'], [/საჩუქ/, 'საჩუქარი'], [/საწვავ|ბენზინ/, 'საწვავი']]
/** weekdays in the dative ("შაბათს"); 0 = Monday. "კვირას" is Sunday only without "მომავალ/ამ/ყოველ" before it */
const WEEKDAYS: [RegExp, number, string][] = [
  [W('ორშაბათ'), 0, 'ორშაბათს'], [W('სამშაბათ'), 1, 'სამშაბათს'], [W('ოთხშაბათ'), 2, 'ოთხშაბათს'], [W('ხუთშაბათ'), 3, 'ხუთშაბათს'],
  [W('პარასკევ'), 4, 'პარასკევს'], [W('შაბათ'), 5, 'შაბათს'], [/(?:^|[^ა-ჰ])კვირას(?![ა-ჰ])/, 6, 'კვირას'],
]
/** basic needs: in support mode they are never framed as a purchase to think over */
const NEEDED = /(?:^|[^ა-ჰ])(?:პურ|რძე|რძის|საკვებ|საჭმელ|პროდუქტ|სკოლ|ბავშვ|შვილ|წამალ|მედიკამენტ|აფთიაქ|ექიმ|კვერცხ|საბავშვო)/

// ---- safety and trust: checked before any number is priced ----
const SELF_HARM = new RegExp([
  /თავს? (?:მოვიკლავ|ვიკლავ|მოვიკლა|მოვიშორებ|რამეს (?:დავუშავებ|ვუზამ|გავუკეთებ))|თავი (?:უნდა )?მოვიკლა|თავის მოკვლ|მოვიკლა თავი|მოვიკლა(?![ა-ჰ])/,
  /(?:სიცოცხლე|ცხოვრება) (?:აღარ|არ) მინდა|ცხოვრება აღარ|სიცოცხლე აღარ|აღარ მინდა (?:ცხოვრებ|სიცოცხლ|ყოფნა|არსებობ|ვიცოცხლ)|არ მინდა (?:ცხოვრება|სიცოცხლე)(?![ა-ჰ])|არ მინდა ვიცოცხლ|აღარ ვიცოცხლებ|ცოცხალი აღარ/,
  /სიკვდილი? მინდა|სიკვდილი (?:ჯობია|მირჩევნია)|ჩემი სიკვდილ|მოვკვდე|მოკვდომა|სუიციდ|აზრი (?:აღარ|არ) აქვს (?:ცხოვრებ|სიცოცხლ|არსებობ)|(?:^|[^ა-ჰ])გავქრე(?![ა-ჰ])/,
  /ყველაფერი?ს? (?:დავასრულებ|დავამთავრებ|დავასრულო|დავამთავრო)(?! (?:ხვალ|დღეს|სამსახურ|საქმ))/,
  /kill myself|suicid|want to die|end (?:my life|it all)|не хочу жить|покончить|суицид|умереть/,
].map(r => r.source).join('|'))
const GAMBLING = /თვითშეზღუდ|შეზღუდვის სია|თამაში? (?:როგორ )?(?:შევიზღუდო|ავიკრძალო|შევწყვიტო)|(?:შევიზღუდო|ავიკრძალო|დავიბლოკო|დავბლოკო|შევწყვიტო)\S*\s+(?:თამაშ|ფსონ|კაზინო|ბეთ|სლოტ)|თამაშის (?:შეზღუდვ|აკრძალვ)|კაზინო|ბეთზე|ბეთში|ბეთით|ბეთი(?![ა-ჰ])|სლოტ|ფსონ|აზარტ|ტოტალიზატორ|ტოტოზე|სტავკ|ლოტო|ლატარი\S* ბილეთ|რულეტ|პოკერ|წავაგე|წაგებულ|(?:^|[^a-z0-9])\d?x?bet(?:ting)?(?![a-z])|gambl|casino|казино|проигр|букмекер|ადჯარაბეთ|კრისტალბეთ|ევროპაბეთ|ცენტრბეთ|ლიდერბეთ/
/** "ვითამაშო" is gambling only without a game or a sport next to it */
const PLAY = /ვითამაშო/
const NOT_GAMBLING_PLAY = /playstation|ps5|ps4|xbox|კონსოლ|ფეხბურთ|კალათბურთ|ჩოგბურთ|ჭადრაკ|კომპიუტერულ|თამაში? (?:ვიყიდ|მინდა)/
export const FRAUD_LINK = /ლინკ|ბმულ|https?:|www\.|[a-z0-9-]\.(info|com|ge|net|xyz|top|online)(\/|\s|$)|ამანათ/
// "მოვიგე" (I won), not "მოვიგებ" (will I gain, as in "ანაბრით რამდენს მოვიგებ?")
export const FRAUD_PRIZE = /პრიზ|მოვიგე(?!ბ)|ლატარი|გათამაშებ/
export const FRAUD_PIN = /პინ ?კოდ|პინკოდ|(?:^|[^a-z])(pin|cvv|cvc)(?![a-z])|ბარათ\S* ვათხოვ/
export const FRAUD_PROMISE = /გარანტირებულ\S* (მოგებ|შემოსავ|სარგებ|პროცენტ)|(მოგებ|შემოსავალ|სარგებელ)\S* (\S+ )?გარანტ|(?:დღეში|კვირაში|თვეში) \d+(?:[.,]\d+)? ?%\S*\s*(?:მოგებ|შემოსავ|სარგებ|მოგცემ)|\d+(?:[.,]\d+)? ?%-?ს? მოგცემ/
/** a friend's or relative's hacked account, or a fake authority, asking for money */
export const FRAUD_ASK = /მასესხეო?(?![ა-ჰ])|გადა?მირიცხეო?(?![ა-ჰ])|ნომერი შე?ცვალა|პოლიციიდან|პროკურატურიდან|ტელეგრამ|telegram/
/** a code, PIN or card number already given away */
export const FRAUD_GIVEN = /(?:კოდ|პინ|pin|cvv|ბარათ|მონაცემ|პაროლ)\S*.*(?:ვუთხარი|ვთქვი|გავეცი|მივეცი|გავუგზავნე|ვუკარნახე)(?![ა-ჰ])|(?:ვუთხარი|ვთქვი|გავეცი|მივეცი|გავუგზავნე|ვუკარნახე)\S*.*(?:კოდ|პინ|ბარათ|მონაცემ|პაროლ)/
const CARD_NUMBER = /\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,7}/
/** asking Jikho to move money: it cannot */
const TRANSFER = /(?:^|[^ა-ჰ])(?:გადარიცხე|გადაიტანე|ჩარიცხე|გადაურიცხე|გადამირიცხე ქვევრ)(?![ა-ჰ])|transfer (?:money|\d)/
/** a seller, photographer or page on social media asking for money up front */
export const FRAUD_PREPAY = /(?:ინსტაგრამ|ფეისბუქ|სოციალურ|ონლაინ|გამყიდველ|ფოტოგრაფ|ტიკტოკ|instagram|facebook|tiktok)\S*.*(?:წინასწარ|ავანს)\S*.*(?:ითხოვ|მთხოვ|მეუბნებ|მწერ|გადამირიცხ|გადავურიცხ)|(?:წინასწარ|ავანს)\S*.*(?:ითხოვ|მთხოვ)\S*.*(?:ინსტაგრამ|ფეისბუქ|სოციალურ|გამყიდველ|ფოტოგრაფ)/
const FRAUD = new RegExp([/ბარათი? (?:დაიბლოკა|დაბლოკილია|გაიყინა)|ანგარიში (?:დაიბლოკა|დაბლოკილია)|დარეკეთ (?:ამ|შემდეგ|მითითებულ) ნომერზე|ამ ნომერზე დარეკ|თაღლით|კოდი მთხოვ|კოდს მთხოვ|კოდი მოითხოვ|sms.*კოდ|ყალბ|ფიშინგ|სიმ ბარათ|მოტყუ|ბარათის (ნომერ|მონაცემ|დეტალ|რეკვიზიტ)|მონაცემები მთხოვ|პაროლ\S* მთხოვ/, FRAUD_LINK, FRAUD_PRIZE, FRAUD_PIN, FRAUD_PROMISE, FRAUD_ASK, FRAUD_GIVEN, FRAUD_PREPAY].map(r => r.source).join('|'))
const LATE = /დროზე ვერ|ვადაში ვერ|დაგვიანებ|დამიგვიანდ|დავაგვიანე|დავაგვიანო|ვადა გადამ|გადავაცილე|პირგასამტეხლ|(?:^|[^ა-ჰ])ჯარიმ/
/** a debt already overdue: a "what now" question, not a "what if" one */
export const OVERDUE = /გადამიცილდა|ვადაგადაცილება მაქვს|ვადაგადაცილებული (?:მაქვს|ვარ)|ვადა გადამივიდა/
export const REFINANCE = /(ძველი?ს?|ვალის|სესხის|არსებული|სხვა) (სესხ\S* |ვალ\S* )?(დასაფარ|დავფარო|დავხურო)|სესხით სესხ|ვალით ვალ|რეფინანს|(?:ვალებ|სესხებ|განვადებ|ოვერდრაფტ|კრედიტ|დავალიანებ)\S* (?:დასაფარ|გადასახდ)|(?:ახალი|კიდევ ერთი) სესხ\S*.*(?:დავფარ|დასაფარ)/
/** borrowing for rent, food or bills */
const ESSENTIAL_WORD = '(?:^|[^ა-ჰ])(?:ქირ(?:ა|ის|ას|ისთვის)|კომუნალ|გადასახად|საკვებ|საჭმ|პურ(?:ი|ის))'
export const ESSENTIAL = new RegExp(`${ESSENTIAL_WORD}\\S*(?:\\s+(?:გადასახდელად|დასაფარად|საყიდლად)|თვის)\\S*.*(?:სესხ|ვისესხ|კრედიტ|მიკრო)|(?:სესხ|ვისესხ|კრედიტ)\\S*.*${ESSENTIAL_WORD}\\S*\\s*(?:გადასახდელად|დასაფარად|საყიდლად)|სესხის გარეშე ვერ (?:გავძლებ|ვიცხოვრებ|გავალ)`)
export const DEFER = /გადავადებ|(?:^|[^ა-ჰ])შეღავათ|ვადის გაგრძელ|შეთანხმებ|შეთავაზებ/
export const COLLECTORS = /მირეკავ|მევალე|კოლექტორ|დამემუქრ|მემუქრებ|დამაპატიმრ|ციხეში ჩაგსვამ/
export const ENFORCE = /აღსრულებ|ყადაღ/
export const COURT = /სასამართლ|მიჩივლ|სარჩელ/
export const OD_STUCK = /ოვერდრაფტ\S*.*ვერ (?:გამოვდივარ|ვიხურავ|ვფარავ)/
/** neutral debt questions (which debt first, snowball or avalanche, what refinancing is): a concept, not the hardship template */
export const DEBT_ORDER = /თოვლის გუნდ|ზვავის მეთოდ|snowball|avalanche|რომელი (?:ვალი |სესხი )?(?:დავფარო|გადავიხადო|დავხურო)|(?:ჯერ|პირველ(?:ად|ი)?) რომელი (?:ვალ|სესხ|დავფარ)|რეფინანს\S* (?:რა|რას)(?![ა-ჰ])|რა არის რეფინანს/
/** "can't pay" wording that keeps a debt question in hardship */
const CANT_PAY = /ვე(?:რ|ღარ) ?(?:ვიხდი|ვფარავ|ვაბრუნებ)|ვერ ვახერხებ|არ მყოფნის|ვერ გამოვდივარ|მახრჩობ|ვიხრჩობ/
const HARDSHIP = new RegExp([/გაჭირვებ|ვე(რ|ღარ) ?(ვიხდი|ვფარავ|დავფარე|ვაბრუნებ|გადავიხად|გადავიხდი|დავფარავ)|ვერ ვახერხებ\S* (გადახდ|დაფარ)|გადახდას ვე(რ|ღარ)|ვალ(ებ)?ი (მაქვს|დამიგროვდა|მახრჩობ|გამიჩნდა)|ვალებ(ში|მა)|ვალში ვარ|ვიხრჩობ|მახრჩობ|ვადაგადაცილ/,
  /არაფერს (?:ვე?რ )?ვიხდი|ვალებს (?:არ|ვერ)|ვერ გამოვდივარ|დამიყადაღ/, COLLECTORS, ENFORCE, COURT, /გადავადებ|(?:^|[^ა-ჰ])შეღავათ|ვადის გაგრძელ/, REFINANCE, ESSENTIAL, OVERDUE].map(r => r.source).join('|'))
const DISTRESS = /აღარ შემიძლია|ვეღარ ვუძლებ|არ ვიცი,? რა ვქნა|მრცხვენია|სირცხვილი|მეშინია|სასოწარკვეთ|დეპრესი|ვტირი|სხვა გზა არ მაქვს|გამოსავალი არ მაქვს|გამოსავალს ვერ ვხედავ|ვიხრჩობ|მახრჩობ/
const DATA = /მონაცემ|ტრანზაქცი|ამონაწერ|დაკავშირებულ|ანგარიშ\S* (ხედავ|ხედავთ|ხედავს)|ხედავ ჩემს|ანგარიშთან|კონფიდენც|რა იცი ჩემზე|რა იცით ჩემზე|საიდან იღებ|ბანკის აპ|სხვა აპ|(?:რიცხვები|ციფრები|მონაცემები) (?:რეალურ|ნამდვილ|გამოგონილ)|(?:რეალურია|ნამდვილია) თუ (?:გამოგონილ|სინთეზურ)|გამოგონილია|სინთეზურ|(?:^|[^a-z])(data|privacy|connected)(?![a-z])/
const BANK_NAMES = 'თიბისი|tbc|საქართველოს ბანკ|bog|ლიბერთი|liberty|ტერაბანკ|ბაზისბანკ|პროკრედიტ|კრედო|ქრედო|credo'
const NOBANK = new RegExp([
  /რომელი? ბანკ|რომელი კომპანი|რომელი? მიკრო|საუკეთესო (ბანკ|სესხ|კრედიტ|განვადებ|ანაბ|დეპოზ|მიკრო|მფო|კომპანი|ლომბარდ)|ყველაზე (იაფ|კარგ|დაბალ|სანდო)\S* (სესხ|კრედიტ|განვადებ|ბანკ|პროცენტ|განაკვეთ|მიკრო|მფო|კომპანი|ლომბარდ|ორგანიზაცი)|დამისახელე\S*.*(?:ბანკ|მიკრო|მფო|კომპანი|ლომბარდ)|(?:ბანკ|მიკრო|მფო|ლომბარდ)\S*.*დამისახელე|სად (ავიღო|ვისესხო|ვიშოვო)|ვისთან (ავიღო|ვისესხო|გავაფორმო)|ვინ მომცემს|ბანკი მირჩიე/,
  // a named bank: comparing it or "should I borrow there?"; a microlender only when compared
  new RegExp(`(${BANK_NAMES})\\S*.*(ჯობ|სჯობ|უკეთეს|იაფ|სანდო|კარგია|ენდო|\\sთუ\\s|vs|ავიღო|ვისესხო|გავხსნა|გავაფორმო)`),
  /(მიკროსაფინანს|მფო|მიკრო ?სესხ)\S*.*(ჯობ|სჯობ|უკეთეს|იაფ|სანდო|კარგია|ენდო|\sთუ\s|vs)/,
  // "bank or microlender?" as a category question
  /ბანკ\S*(?:\s+\S+)?\s+(?:თუ|ან)\s+მიკრო|მიკრო\S*(?:\s+\S+)?\s+(?:თუ|ან)\s+ბანკ/,
  /which bank|what bank|best bank|какой банк/,
].map(r => r.source).join('|'))
const INVEST = /ინვესტ|(?:^|[^ა-ჰ])აქციებ|აქციონერ|კომპანიის აქცი|(?:^|[^ა-ჰ])ჩავდო(?![ა-ჰ])|კრიპტო|ბიტკოინ|ეთერიუმ|ფორექს|ბირჟ|(საინვესტიციო|ინდექს\S*|ინვესტიციურ|საპაიო) ?ფონდ|ობლიგაც|ფასიან\S* ქაღალდ|ოქრო\S* (?:ვიყიდ|ჩავდ|შევინახ|ვინახავ|დავაბანდ)|(?:^|[^ა-ჰ])ოქრო(?:ში|ს (?:ყიდვ|შეძენ|ზოდ|ფას))|(?:ლარის|დოლარის|ევროს|ვალუტის) კურს|(?:^|[^ა-ჰ])(?:დოლარი|დოლარს|დოლარები|ევრო|ევროს|ვალუტა|ვალუტას) (?:ვიყიდო|ვიყიდი|შევინახო|გადავცვალო)|(?:ვიყიდო|შევინახო|გადავცვალო) (?:დოლარი|დოლარს|დოლარები|ევრო|ევროს|ვალუტა|ვალუტას)(?![ა-ჰ])|კურსი (?:გაიზრდ|დაეცემ|მოიმატ|აიწევ|დაიწევ)|(?:^|[^a-z])(stocks?|crypto|bitcoin|invest\w*|etf|forex)(?![a-z])/
const DECIDE = /(ავიღო|ვიყიდო|გავაფორმო|წავიდე|ჩავდო|დავხარჯო|გავხსნა|ავიღებ|მოვაწერო|ვისესხო) თუ არა|(?:ავიღო|ვიყიდო|გავაფორმო) თუ (?:დავზოგო|დავაგროვო|დავიცადო)|კი თუ არა|კი ან არა|ღირს თუ არა|(?:^|[^ა-ჰ])მირჩიე|რას მირჩევ|შენ რას იზამდი|შენ რომ იყო|რომელი? (?:ვადა |ვარიანტი )?ავირჩიო|რომელი (?:ჯობია|სჯობს|ჯობს|სჯობია|უკეთესია|აჯობებს)|როგორ მოვემზადო|როგორ მოვიქცე|რას ფიქრობ|რა აზრის ხარ|შენი აზრი(?![ა-ჰ])|ჩემს ადგილას|რას იზამდი|კარგი იდეაა|ცუდი იდეაა|(?:^|[^ა-ჰ])გირჩევ|რჩევას (?:მაძლევ|იძლევი|მომცემ)|რეკომენდაცი|სესხი აიღე(?![ა-ჰ])|უბრალოდ თქვი|yes or no|should i (take|buy|get)|you should|just say/
/** "ეს ჩემთვის ძვირია?", "ბევრია?", "ღირს?" */
const COSTLY = /ძვირ(?:ია|ი ხომ|ი არ)|ბევრია|ღირს[?!.\s]*$|იაფია|გამომივა|გამიძლებს|შესაძლებელია|რეალურია|მოვახერხებ|შევძლებ (?:გადახდას|დაფარვას)|ავწვდები/
/** "is this AI / ChatGPT?" */
const AI = /ხელოვნურ\S* ინტელექტ|(?:^|[^a-z])(?:ai|gpt|chatgpt|llm)(?![a-z])|ჩატ ?ჯიპიტ|ჯიპიტი|რობოტი ხარ|ბოტი ხარ|ნეირონ/
/** "is this app here to sell the bank's loans?" */
const LOAN_SALES = /(?:სესხ|კრედიტ)\S* (?:გასაყიდ|გაყიდვ|რეკლამ|შეთავაზებ\S* ხომ)|ბანკ\S* (?:გიხდი|გაფინანსებ|გიკვეთ)|ბანკისთვის მუშაობ|ბანკის აგენტ/
const BIZ = /^\s*(?:ეს |ის |აპი |ჯიხო )?(?:უფასოა|ფასიანია)[?!.\s]*$|ბიზნეს ?მოდელ|ფულს როგორ (აკეთებ|შოულობ|გამოიმუშავ)|როგორ (გამოიმუშავებ|შოულობთ|ირჩენთ თავს)|ვინ იხდის (ამაში|აპში|ჯიხოში)|(აპი|ჯიხო|ეს აპლიკაცია)\S* (უფასოა|ფასიანია)|რა ღირს (აპი|ჯიხო)|რატომაა? (?:ეს )?(?:აპი|ჯიხო|აპლიკაცია) უფასო|რატომაა? უფასო (?:ეს )?(?:აპი|ჯიხო|აპლიკაცია)|(?:აპი|ჯიხო|აპლიკაცია) რატომაა? უფასო|ვინ გაფინანსებთ|ვინ გაფინანსებს|ვინ გიხდით/
/** plain facts the responder answers without a price */
const FACT = /იპოთეკ|ლომბარდ|თავდებ|უზრუნველყოფ|გირაო|საკრედიტო ლიმიტ|საშეღავათო|ქეშბექ|cashback|ლიზინგ|საკრედიტო ბარათ|დებეტურ|სადებეტო|დაზღვევ/
/** "how much is on my card?": the balance in the person's data, never a live bank read */
const BALANCE = /ჩემი ნაშთ|ნაშთი (?:რამდენია|მაჩვენე|ახლა)|ახლა რა ნაშთ|რა ნაშთი მაქვს|^\s*(?:ნაშთი|ბალანსი|ფული|ჩემი ფული|ფული რამდენი მაქვს|money|balance)[?!.\s]*$|რამდენი (?:ფული )?მაქვს (?:ბარათზე|ანგარიშზე)|(?:ბარათზე|ანგარიშზე) რამდენი|რამდენს ვხარჯავ|რაზე ვხარჯავ|სად მიდის (?:ჩემი )?ფული|ფული რაზე მიდის|რაზე მიდის (?:ჩემი )?ფული|რაზე მეხარჯება|ყველაზე მეტს რაზე|ყველაზე დიდი ხარჯი|ჩემი ხარჯები მაჩვენე/
/** "is this app addictive?" */
const HABIT = /დამოკიდებულ|addict|ზედმეტად ვიყენებ|ძალიან ბევრ დროს/
/** a salary raise */
const RAISE = /მომიმატ|მომემატ|მოემატ|გამეზარდ|გამიზარდ|გაიზრდ|გაიზარდ|მოიმატ|მომატებ/
// ---- questions about Jikho itself, attempts to change its rules, and clear off-topic requests ----
const META_ADVICE = /ინფორმაცი\S*\s+(?:და|თუ|ან)\s+რჩევ|რჩევ\S*\s+(?:და|თუ|ან)\s+ინფორმაცი|(?:განასხვავ|ასხვავ|არჩევ)\S*\s.*რჩევ|რჩევა რით განსხვავ/
const META_REG = /ეროვნულ\S* ბანკ\S* (?:გაკონტროლ|გარეგულირ|გამოწმებ|აკონტროლ|ზედამხედველ)|(?:ვინ|რომელი უწყება) (?:გაკონტროლ|გარეგულირ|აკონტროლებს)|ლიცენზი\S* (?:გაქვთ|გაქვს|აქვს)|რეგულირდებ|ზედამხედველობ\S* ქვეშ/
const META_PURPOSE = /რატომ უნდა გამოვიყენო|რაში მჭირდება (?:ჯიხო|ეს აპი|შენ)|რით მეხმარები|რაში გამომადგები|რატომ (?:ჯიხო|შენ) და არა|რა სარგებელი მაქვს შენგან/
const META_LIAB = /შენი ბრალი|თქვენი ბრალი|ვისი ბრალი|ბრალი იქნება|პასუხისმგებლობ|ვინ (?:აგებს|აიღებს|იღებს) პასუხ|შეცდომა რომ (?:დაუშვა|დაუშვათ|მოგივიდეს)|ზარალს ვინ|ვინ ამინაზღაურ/
const JAILBREAK = /developer mode|jailbreak|ignore (?:all |the |your )?(?:previous |prior )?(?:instructions|rules)|system prompt|(?:^|\s)system\s*:|(?:^|[^a-z])dan(?![a-z])|შეზღუდვების გარეშე|წესები დაივიწყე|დაივიწყე (?:წესები|ინსტრუქცი|ყველაფერი)/
const OFF_FOOD = /რეცეპტ|ხაჭაპურ|კერძ\S* (?:როგორ|მომზად)|როგორ მოვამზადო|recipe/
const OFF_SPORT = /(?:^|[^ა-ჰ])(?:მოიგო|წააგო)(?![ა-ჰ])|ფეხბურთ|კალათბურთ|მატჩ|ჩემპიონატ|football/
const OFF_JOKE = /ანეკდოტ|ხუმრობ|გამაცინე|სასაცილო|(?:^|[^a-z])joke/
const OFF_RUDE = /სულელ|იდიოტ|ტუტუც|დებილ|ბრიყვ|stupid|idiot/
const OFF_OTHER = /ლექსი? (?:მითხარი|დამიწერე)|(?:მითხარი|დამიწერე|მომიყევი)\s+(?:ლექს|სიმღერ|ზღაპარ|ამბავ)|სიმღერ\S* (?:მითხარი|დამიწერე)|პოლიტიკ|არჩევნ|რომელი საათია/
/** "ბანკში რა საბუთები წავიღო?" */
const DOCS = /რა (?:საბუთ|დოკუმენტ)|რა (?:უნდა )?წავიღო|რა მჭირდება (?:ბანკში|სესხისთვის|გადავადებისთვის)/
/** state help when out of work */
const WELFARE = /უმუშევრობის (?:დახმარ|შემწეობ)|საარსებო შემწეობ|სოციალური (?:დახმარ|შემწეობ)/
export const JOB_LOSS = /სამსახური დავკარგე|სამსახურიდან (?:გამათავისუფლ|გამაგდ|წამოვედი|დამითხოვ)|უმუშევ(?:არი|რად) დავრჩი|სამსახური აღარ მაქვს|გამათავისუფლეს|დამითხოვეს|სამუშაო დავკარგე/
/** "პირველ რიგში რა გადავიხადო?": the month's bills in date order */
const BILLS_ORDER = /(?:პირველ რიგში|ჯერ|პირველად|თავიდან)\s+რა\s+(?:გადავიხადო|დავფარო)|რა\s+(?:გადავიხადო|დავფარო)\s+(?:პირველ რიგში|ჯერ|პირველად)|რომელი გადასახად\S*\s+(?:გადავიხადო|დავფარო)|რას (?:გადავიხდი|ვიხდი) პირველ/
/** "როდის შევავსებ?": when a saving goal is reached */
const GOAL_Q = /როდის (?:შევავსებ|დავაგროვებ|შევაგროვებ|ავავსებ|მოვაგროვებ|შეივსება|დაგროვდება|ავივსება)|(?:ქვევრ|მიზან)\S* (?:როდის|რამდენ ხანში)/
/** "ვიყიდო თუ დავიცადო?" */
const WAIT_Q = /თუ (?:დავიცადო|მოვიცადო|დაველოდო|მოვიცდი|დავიცდი)|ახლა თუ (?:მერე|მოგვიანებით|ხელფასის)|ახლავე თუ|დღეს თუ (?:ხელფასის|მერე)/
/** "ავიღო თუ არა …" with the numbers in the question */
const YES_NO = /(?:ავიღო|ვიყიდო|გავაფორმო|ვისესხო|მოვაწერო|ავიღებ) თუ არა|კი თუ არა|კი ან არა|ღირს თუ არა|yes or no/
/** "რა ვქნა?" alone, with any short lead-in ("აბა", "მაშ", "კარგი,") */
export const WHAT_DO = /^\s*(?:(?:ახლა|მერე|და|აბა|მაშ|მაშინ|ჰოდა|ხოდა|კარგი|ჰო|ხო|კი|მაგრამ|ანუ|ესე იგი|ჰოდა რა|მერე რა)[,\s]+)*რა (?:ვქნა|ვაკეთო|გავაკეთო|მექნა|ვიღონო)[\s?!.…]*$|^\s*(?:აბა |მაშ |ახლა |და )?რა (?:გზა|გამოსავალი|ვარიანტი|ვარიანტები) მაქვს[\s?!.…]*$/

// "ანაბრის", "ანაბრით": the genitive and instrumental drop the second ა
const DEPOSIT = /ანაბარ|ანაბრ|დეპოზიტ|შემნახველ/

// questions about the numbers already on the table ("ჯამში რამდენს გადავიხდი?")
const ASK_TOTAL = /ჯამში|ჯამური|(?:^|[^ა-ჰ])ჯამი(?![ა-ჰ])|სულ (რამდენ|რა |ერთად)|რამდენი? დამიჯდება|რა დამიჯდება|რამდენს (გადავიხდი|დავაბრუნებ|ვიხდი)|რამდენი უნდა დავაბრუნო|ზედმეტ\S* (რამდენ|რას)|რამდენს ზედმეტს|რამდენი გამოვა სულ/
const ASK_MONTHLY = /თვეში რამდენი? (გამოვა|იქნება|მომიწევს|უნდა|გადავიხადო|გადავიხდი|გამოდის)|თვიური (შენატანი|გადასახადი|გადასახდელი) რამდენ|რამდენი გამოვა თვეში|თვეში რა (გამოვა|იქნება)/
const ASK_RATE = /(პროცენტ|განაკვეთ)\S*\s+(რამდენ|რაა|რა არის)|რა (პროცენტ|განაკვეთ)|რამდენი? პროცენტ/

// short follow-ups on the last answer: every word must be one of these
const EXPLAIN_CORE = /რა (?:შეიცვლება|მოხდება|იცვლება|გამოვა|იქნება)|რატომ|რისთვის|(?:^|[^ა-ჰ])(მერე|შემდეგ)(?![ა-ჰ])|მარტივ|გამიმარტივე|ახსენი|ამიხსენი|ამიხსნი|განმიმარტე|მაგალით|ვერ გავიგე|ვერ მივხვდი|არ მესმის|ვერ ვხვდები|გაუგებარ|რას ნიშნავ|რა იგულისხმე|რას გულისხმობ|დეტალურად|დაწვრილებით|(?:^|[^ა-ჰ])ანუ(?![ა-ჰ])|მაინტერესებდეს/
const EXPLAIN_FILL = /^(რატომ|რისთვის|მერე|შემდეგ|მარტივ\S*|გამიმარტივე|უფრო|ცოტა|ახსენი|ამიხსენი|ამიხსნი|ამიხსენით|განმიმარტე|განმიმარტეთ|მაგალით\S*|ერთი|ვერ|არ|გავიგე|მივხვდი|მესმის|ვხვდები|გაუგებარ\S*|რას|რა|ნიშნავს|ნიშნავ|იგულისხმე|გულისხმობ|დეტალურად|დაწვრილებით|ანუ|ეს|ეგ|ამას|მაგას|იმას|და|კარგი|მითხარი|მაჩვენე|მომიყევი|კიდევ|ერთხელ|თავიდან|ჩემთვის|ჩემზე|მე|შენ|ხო|ჰო|უნდა|მაინტერესებდეს|მნიშვნელოვანია|მჭირდება|აქ|რომ|ისე|გთხოვ|გთხოვთ|პლიზ|please|იქნება|მოხდება|ხდება|გამოვა|გამოდის|მომეცი|მომიყვანე|დამიწერე|უკეთ|უკეთესად|კარგად|დეტალები|მეტი|ესეიგი|მაშინ|მერე|შეიცვლება|იცვლება)$/
const ACK_WORD = /^(ok|okay|ოკ|ოქ|ოკეი|ჰმ|ჰმმ|ჰმმმ|ემ|აჰ|ოჰ|არა|კარგი|კაი|კარგით|გასაგებია|გასაგები|გავიგე|ნათელია|აჰა|კი|ჰო|ხო|დიახ|სწორია|მესმის|ძალიან|მაგარია|სუპერ|super|cool|nice|მადლობა|მადლობთ|მადლობ|გმადლობ|გმადლობთ|madloba|მერსი|დიდი|ყოჩაღ|მშვენიერია|მშვენიერი|ბატონო)$/

// concept regexes run on the text before numbers are stripped (so "0%-იანი ... უფასოა?" still reads as a question)
const CONCEPTS: [RegExp, ConceptId][] = [
  // "პტი" as a word (not inside "რეცეპტი")
  [/\bpti\b|(?:^|[^ა-ჰ])პტი(?:ს|ში|ზე)?(?![ა-ჰ])|ლიმიტში (?:ჩავჯდები|ჩავეტევი|ვჯდები|ვეტევი)|(?:ჩავჯდები|ჩავეტევი) ლიმიტში|შემოსავლის.*თანაფარდ|ვალი.*შემოსავალ.*%|(ხელფას|შემოსავ)\S*\s.*(რამდენი პროცენტ|რა პროცენტ|რა წილ|რა ნაწილ|რამდენი %).*(სესხ|ვალ|განვადებ)|(სესხ|ვალ|განვადებ)\S*\s.*(ხელფას|შემოსავ)\S*\s.*(რამდენი პროცენტ|რა პროცენტ|რა წილ|რა ნაწილ)/, 'pti'],
  [/ეფექტურ|eir|წლიური განაკვეთ|ნომინალურ|რეკლამ\S*\s.*(%|პროცენტ|განაკვეთ)|რეალური (განაკვეთ|პროცენტ)|(?:საპროცენტო )?განაკვეთი? (?:რა არის|რას ნიშნავს|საერთოდ)|რა არის (?:საპროცენტო )?განაკვეთ/, 'eir'],
  [/რთული პროცენტ|კომპაუნდ|compound|მარტივ.*პროცენტ|პროცენტ\S*\s+პროცენტ/, 'compound'],
  [/ზღვარ|ბალიშ|cushion/, 'cushion'],
  [/ამინდ.*რას ნიშნავ|ამინდი რა|როგორ ვ?ითვლ|საიდან იცი|სიზუსტ|რამდენად ზუსტ|ზუსტია|სანდოა|რამდენად სანდო|სანდო ხარ|ცდები|შეცდები|შეიძლება შეცდ|დაგიჯერ|accura|how do you (?:calculate|count|compute|forecast|predict)|(?:ნიშნავ|რა არის|რას)\S*\s.*(?:ღრუბ|მზიან|წვიმ|ქარიშხ)|^\s*(?:და |ხოლო )?(?:ქარიშხალი|ქარიშხლიანი|წვიმა|წვიმიანი|ღრუბლიანი|მზიანი|მზე)\s*[?!.…]*\s*$|(?:^|[^a-z])forecast(?![a-z])|(ღრუბ|მზე|მზიან|წვიმ|ქარიშხ|ხატულ|იკონ)\S*\s.*(ნიშნავ|რა არის|რას)/, 'weather'],
  [/(?:^|[^\d.,])0\s?%.*(რატომ|მართლა|უფასო|დამალ|ფარულ)|უფასო განვადებ|განვადებ\S* (მართლა )?უფასო|ნულოვან|0 პროცენტიან\S*.*(რატომ|მართლა|უფასო)|(?:^|[^\d.,])0\s?%\S*\s+განვადებ\S*\s+(?:რა|რას)(?![ა-ჰ])|რა არის 0\s?%|უპროცენტო განვადებ/, 'zero'],
  [/ახლა იყიდე|მერე გადაიხადე|bnpl|buy now|(განვადება|სესხი) რა(?![ა-ჰ])|რა არის (განვადებ|სესხი(?![ა-ჰ]))|განვადება და სესხ.*განსხვავ|(განვადებ|рассрочк)\S*.*(ჯობ|სჯობ|განსხვავ).*(სესხ|кредит)|(სესხ|кредит)\S*.*(ჯობ|სჯობ|განსხვავ).*(განვადებ|рассрочк)/, 'installment'],
  [/ოვერდრაფტ/, 'overdraft'],
  [/გადაუდებელ|სარეზერვო|გაუთვალისწინებ|მოულოდნელ\S* ხარჯ|შავი დღ|სამსახურ\S* (რომ )?დავკარგ|სამსახური დავკარგე|უმუშევარ|ხელფასის გარეშე|ხელფასი რომ (არ|აღარ)|შემოსავლის გარეშე|გამათავისუფლ/, 'emergency'],
  [DEPOSIT, 'deposit'],
  [/ინფლაცი/, 'inflation'],
  [/დივერსიფიკ|(?:^|[^ა-ჰ])რისკ|გაუფასურ|(დოლარ|ვალუტ|ევრო)\S*\s.*(სესხ|კრედიტ|ვიყიდ|ბინ)|(სესხ|კრედიტ)\S*\s.*(დოლარ|ვალუტ|ევრო)/, 'risk'],
  [/საკრედიტო ისტორ|კრედიტ ?ისტორ|კრედიტინფო|creditinfo/, 'credithistory'],
  [/რესტრუქტ|ვადაგადაცილ|დავალიანებ|თოვლის გუნდ|ზვავის მეთოდ|snowball|avalanche/, 'restructure'],
  [/როგორ (?:შევამცირო|შევკვეცო|დავწიო) (?:ხარჯ|ხარჯები)|ხარჯ\S* (?:როგორ )?(?:შევამცირო|შემცირებ|შევკვეცო)|50\s?\/\s?30\s?\/\s?20|50-30-20|ბიუჯეტ\S* (როგორ|შევადგინ|შედგენ|დავგეგმ|დაგეგმ)|ბიუჯეტის (წეს|შედგენ|დაგეგმ)|როგორ (შევადგინო|დავგეგმო) ბიუჯეტ/, 'budget'],
  [/ფიქსირებულ|ცვლად.*ხარჯ/, 'fixed'],
  // the legal cap on the rate, asked in any words (after the deposit, PTI and other entries, so their own questions stay theirs)
  [/\d\s?%\S*.*(?:კანონიერ|ლეგალ|დაშვებ)|(?:^|[^\d])50\s?%\S*.*(?:კანონ|დაშვებ|ლეგალ|ზღვარ|მაქსიმ)|(?:კანონ|ლეგალ)\S*.*(?:პროცენტ|განაკვეთ)|(?:პროცენტ|განაკვეთ)\S*.*(?:კანონიერ|ლეგალ|კანონით)/, 'eir'],
]

function toNumber(s: string): number {
  return Number(s.replace(/\s/g, '').replace(',', '.'))
}

const NUM = '(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d+(?:[.,]\\d+)?)'
const CUR = '(?:ლარ\\S*|₾|ლ(?![ა-ჰ])|gel|lari)'
const AMOUNT_CUR = new RegExp(NUM + '\\s*-?\\s*(ლარ|₾|ლ(?![ა-ჰ])|gel|lari)')
const AMOUNT_ANY = new RegExp(NUM + '\\s*-?\\s*(იან)?')
const GREET = /^\s*(გამარჯობ\S*|სალამ\S*|gamarjob\S*|salam\S*|hi|hello|ჰეი|მოგესალმ\S*|დილა მშვიდობ\S*|საღამო მშვიდობ\S*)/

// ---- money words: a spend repeated every day, money on hand, a monthly saving ----
const DAILY = new RegExp(`(?:დღეში|დღიურად|ყოველდღე\\S*)\\s*(?:დაახლოებით |მინიმუმ |სულ |თითქმის )?${NUM}|${NUM}\\s*-?\\s*${CUR}\\s*(?:-?ს\\s*)?(?:დღეში|დღიურად|ყოველდღე)`)
const ON_HAND_AFTER = new RegExp(`${NUM}\\s*-?\\s*${CUR}?\\s*(?:-?ი\\s+)?(?:მხოლოდ\\s+|სულ\\s+)?(?:მაქვს|მაქ(?![ა-ჰ])|დამრჩა|დამრჩება|მრჩება|მიდევს|გამაჩნია|მიწერია|მიჩანს)(?!\\s*(?:გადასახდ|გადასახად|ვალ|სესხ|დავალიან|დასაბრუნ|დასაფარ))`)
const ON_HAND_BEFORE = new RegExp(`(?:დამრჩა|დამრჩება|მრჩება|მაქვს|ჯიბეში|ხელზე|ანგარიშზე|ბარათზე|საფულეში)\\s+(?:მხოლოდ |სულ |კიდევ |ჯერ |დაახლოებით )?${NUM}\\s*-?\\s*(?:ლარ|₾|ლ(?![ა-ჰ]))`)
const SAVE_VERB = /გადავდ|გადადებ|გადადება|გადავინახ|ვდებდე|(?:^|[^ა-ჰ])ვდებ(?![ა-ჰ])|დავდებ|შევინახ|დავზოგ|ვზოგავ|ვაგროვ|დავაგროვ|შევაგროვ|ჩავრიცხ|დაზოგვ|ვინახავ/
const PER_MONTH_A = new RegExp(`(?:თვეში|ყოველთვე|ყოველ თვე|თვიურად)\\s*(?:დაახლოებით |მინიმუმ |სულ )?${NUM}`)
const PER_MONTH_B = new RegExp(`${NUM}\\s*-?\\s*${CUR}?\\s*(?:-?ს\\s*|-?ის\\s*)?(?:თვეში|ყოველთვე|თვიურად)`)
const PER_MONTH_C = new RegExp(`${NUM}\\s*-?\\s*${CUR}?\\s*(?:-?ს\\s*)?(?:თუ |რომ )?(?:გადავდ|ვდებდე|დავდებ|დავზოგ|შევინახ|ვზოგავ|გადავინახ)`)

/** a down payment said in other words ("თავიდან შევიტან", "დასაწყისში გადავიხდი") */
const UP_WHEN = '(?:თავიდან|დასაწყისში|პირველად|ავანსად)'
const UP_VERB = '(?:შევიტან|გადავიხდ|გადავიხად|ჩავრიცხ|დავდებ|შევდებ)\\S*'

// ---- number words: ასი … ათასი, ორასი, ათას ხუთასი, ორი ათასი ----
const UNITS = ['ერთ', 'ორ', 'სამ', 'ოთხ', 'ხუთ', 'ექვს', 'შვიდ', 'რვა', 'ცხრა']
const TEENS = ['ათ', 'თერთმეტ', 'თორმეტ', 'ცამეტ', 'თოთხმეტ', 'თხუთმეტ', 'თექვსმეტ', 'ჩვიდმეტ', 'თვრამეტ', 'ცხრამეტ']
const SMALL = [...UNITS, ...TEENS]
const smallValue = (w: string) => (UNITS.indexOf(w) >= 0 ? UNITS.indexOf(w) + 1 : 10 + TEENS.indexOf(w))
const NW_END = '(?:ი|ს|ის|ით|ამდე|მდე|იან\\S*|ზე)?'
const RE_TH = new RegExp(`^ათას${NW_END}$`)
const RE_HUN = new RegExp(`^(${UNITS.slice(1).join('|')})?ას${NW_END}$`)
const RE_TEN = new RegExp(`^(ოც|ორმოც|სამოც|ოთხმოც)(?:და(${SMALL.join('|')}))?${NW_END}$`)
const RE_SMALL = new RegExp(`^(${SMALL.join('|')})${NW_END}$`)
const TENS: Record<string, number> = { 'ოც': 20, 'ორმოც': 40, 'სამოც': 60, 'ოთხმოც': 80 }

function numberWord(w: string): { v: number; th?: boolean } | undefined {
  if (RE_TH.test(w)) return { v: 1000, th: true }
  let m = w.match(RE_HUN)
  if (m) return { v: (m[1] ? smallValue(m[1]) : 1) * 100 }
  m = w.match(RE_TEN)
  if (m) return { v: TENS[m[1]] + (m[2] ? smallValue(m[2]) : 0) }
  m = w.match(RE_SMALL)
  if (m) return { v: smallValue(m[1]) }
  return undefined
}

/** "ათას ხუთასი" → "1500". Small numbers ("ორი") change only before a money or time word, so "ორი შვილი" stays words. */
export function wordsToDigits(s: string): string {
  const parts = s.split(/(\s+)/)
  const words: { i: number; core: string; tail: string; n?: { v: number; th?: boolean } }[] = []
  parts.forEach((t, i) => {
    if (!t || /^\s+$/.test(t)) return
    const m = t.match(/^(.*?)([?!.,;:)»"“”]*)$/)!
    words.push({ i, core: m[1], tail: m[2], n: numberWord(m[1]) })
  })
  for (let a = 0; a < words.length; a++) {
    if (!words[a].n) continue
    let b = a
    while (b + 1 < words.length && words[b + 1].n && !words[b].tail) b++
    const run = words.slice(a, b + 1)
    let total = 0, cur = 0, th = false
    for (const w of run) {
      if (w.n!.th) { cur = (cur || 1) * 1000; total += cur; cur = 0; th = true } else cur += w.n!.v
    }
    total += cur
    const prev = words[a - 1], next = words[b + 1]
    const digitBefore = !!prev && /\d$/.test(prev.core) && !prev.tail
    const unitAfter = !!next && /^(ლარ|₾|gel|lari|თვ|წლ|წელ|დღ|კვირ)/.test(next.core)
    if (!digitBefore && (total >= 100 || th || unitAfter)) {
      parts[run[0].i] = String(total) + run[run.length - 1].tail
      for (const w of run.slice(1)) parts[w.i] = ''
    }
    a = b
  }
  return parts.join('')
}

// Georgian typed in Latin letters ("xelfasamde meyofa?"), and a few Russian words: mapped word by word, only when the text has no Georgian letters
const LATIN: Record<string, string> = {
  xelfasamde: 'ხელფასამდე', khelfasamde: 'ხელფასამდე', xelpasamde: 'ხელფასამდე', xelfasi: 'ხელფასი', khelfasi: 'ხელფასი', xelfasis: 'ხელფასის',
  meyofa: 'მეყოფა', meyopa: 'მეყოფა', meqofa: 'მეყოფა', mekofa: 'მეყოფა',
  shemidzlia: 'შემიძლია', shemizlia: 'შემიძლია', shemidzlian: 'შემიძლია',
  davxarjo: 'დავხარჯო', davkharjo: 'დავხარჯო', daxarjva: 'დახარჯვა', dakharjva: 'დახარჯვა', daxarjvis: 'დახარჯვის',
  dges: 'დღეს', dghes: 'დღეს', ramdeni: 'რამდენი', ramdenis: 'რამდენის', ramdens: 'რამდენს',
  ra: 'რა', aris: 'არის', ras: 'რას', nishnavs: 'ნიშნავს', rogor: 'როგორ', rato: 'რატომ', ratom: 'რატომ',
  overdrafti: 'ოვერდრაფტი', overdraft: 'ოვერდრაფტი', inflacia: 'ინფლაცია', anabari: 'ანაბარი', depoziti: 'დეპოზიტი',
  davzogo: 'დავზოგო', puli: 'ფული', fuli: 'ფული', viyido: 'ვიყიდო', viqido: 'ვიყიდო', sesxi: 'სესხი', seskhi: 'სესხი',
  ganvadeba: 'განვადება', ganvadebit: 'განვადებით', telefoni: 'ტელეფონი', laris: 'ლარის', lari: 'ლარი', tvit: 'თვით',
  // a wider everyday vocabulary, so a whole Latin-letter question reads as Georgian
  xval: 'ხვალ', khval: 'ხვალ', zeg: 'ზეგ', mere: 'მერე', shemdeg: 'შემდეგ', tvis: 'თვის', tveshi: 'თვეში', tve: 'თვე', bolomde: 'ბოლომდე', bolos: 'ბოლოს',
  damrcheba: 'დამრჩება', darcheba: 'დარჩება', damrchenia: 'დამრჩენია', kargi: 'კარგი', ki: 'კი', ara: 'არა', xo: 'ხო', ho: 'ჰო', ar: 'არ', ver: 'ვერ',
  maqvs: 'მაქვს', makvs: 'მაქვს', minda: 'მინდა', vali: 'ვალი', valebi: 'ვალები', vixdi: 'ვიხდი', tu: 'თუ', rom: 'რომ', da: 'და', magram: 'მაგრამ',
  xelfasia: 'ხელფასია', xelfasze: 'ხელფასზე', lariani: 'ლარიანი', sesxis: 'სესხის', seskhis: 'სესხის', ganvadebaze: 'განვადებაზე', ramdenia: 'რამდენია',
  kurtuki: 'ქურთუკი', fexsacmeli: 'ფეხსაცმელი', laptopi: 'ლეპტოპი', gavige: 'გავიგე', martivad: 'მარტივად', magalitad: 'მაგალითად', magalitit: 'მაგალითით',
  gadavixdi: 'გადავიხდი', gadavixado: 'გადავიხადო', jamshi: 'ჯამში', meti: 'მეტი', naklebi: 'ნაკლები', sesxs: 'სესხს', ganvadebas: 'განვადებას',
  'переплачу': 'ჯამში ზედმეტს გადავიხდი', 'переплата': 'ჯამში ზედმეტი', 'кредит': 'სესხი', 'рассрочка': 'განვადება', 'лари': 'ლარი', 'месяцев': 'თვე', 'год': 'წელი',
  vin: 'ვინ', xar: 'ხარ', khar: 'ხარ', efeqturi: 'ეფექტური', efektiuri: 'ეფექტური', efektauri: 'ეფექტური', ganakveti: 'განაკვეთი', dge: 'დღე', darcha: 'დარჩა', qira: 'ქირა', kira: 'ქირა',
  vqna: 'ვქნა', vkna: 'ვქნა', mikrosesxi: 'მიკროსესხი', dagrcheba: 'დაგრჩება', gadavdo: 'გადავდო', anabarze: 'ანაბარზე', zgvari: 'ზღვარი', zghvari: 'ზღვარი',
  'сколько': 'რამდენი', 'могу': 'შემიძლია', 'потратить': 'დავხარჯო', 'сегодня': 'დღეს', 'я': '', 'мне': '', 'до': '', 'зарплаты': 'ხელფასამდე', 'хватит': 'მეყოფა',
}
/** common English questions, phrase by phrase (the rest of the words are left as they are) */
const EN: [RegExp, string][] = [
  [/how much can i (?:spend|use)(?: today)?/g, 'დღეს რამდენი შემიძლია'], [/will (?:my money|i|it) (?:last|have enough|be enough)(?: until| till| to| before)? payday/g, 'ხელფასამდე მეყოფა'],
  [/(?:until|till|before) (?:my )?payday/g, 'ხელფასამდე'], [/effective (?:annual )?(?:interest )?rate/g, 'ეფექტური განაკვეთი'], [/compound interest/g, 'რთული პროცენტი'],
  [/what (?:is|are)|what's|explain/g, 'რა არის'], [/how much will i pay(?: in total)?|total cost|how much (?:will it|does it) cost/g, 'ჯამში რამდენს გადავიხდი'],
  [/monthly payment|per month|a month/g, 'თვეში რამდენი გამოვა'], [/credit history/g, 'საკრედიტო ისტორია'], [/inflation/g, 'ინფლაცია'], [/overdraft/g, 'ოვერდრაფტი'],
  [/instal?lments?/g, 'განვადება'], [/(?:a )?loan/g, 'სესხი'], [/(?:a )?deposit|savings account/g, 'ანაბარი'], [/(\d+)[\s-]*months?/g, '$1 თვით'], [/(\d+)[\s-]*years?/g, '$1 წლით'],
  [/should i buy|can i afford|can i buy|should i get/g, 'ვიყიდო'], [/how long (?:will it take|to save)|how many months/g, 'რამდენ ხანში დავაგროვებ'],
  [/who are you/g, 'ვინ ხარ'], [/thank(?:s| you)/g, 'მადლობა'], [/(?:is (?:this|it) (?:a )?)?(?:scam|fraud)/g, 'თაღლითობაა'], [/gambling|betting/g, 'აზარტული თამაში'],
  [/when (?:is|do i get) (?:my )?(?:salary|payday|paid)/g, 'ხელფასი როდის მომდის'], [/i can'?t pay|cannot pay/g, 'ვერ ვიხდი'], [/(?:my )?debts?/g, 'ვალი'],
]
function latinToGeorgian(s: string): string {
  if (/[ა-ჰ]/.test(s) || !/[a-zа-я]{2,}/.test(s)) return s
  let hit = false
  let t = s
  for (const [re, ka] of EN) t = t.replace(re, (...m: string[]) => { hit = true; return ` ${ka.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? '')} ` })
  t = t.replace(/[a-zа-яё]+/g, w => (Object.prototype.hasOwnProperty.call(LATIN, w) ? ((hit = true), LATIN[w]) : w))
  return hit ? t.replace(/\s{2,}/g, ' ') : s
}

export function parse(input: string): Parsed {
  const raw = input.trim()
  let s = ' ' + latinToGeorgian(raw.toLowerCase().replace(/ /g, ' ')) + ' '
  /** the lower-cased text before any number is stripped */
  const s0 = s
  const out: Parsed = { intent: 'unknown', raw }
  // "-200 ლარი": a minus written right before a number (not "მე-10", not a range "30 - 40")
  if (/(?:^\s*|[^\d\s]\s+)[-−]\d/.test(raw)) out.negative = true
  const SALARY_IN = /(?:ხელფასი?|სტიპენდია?)\s+(?:უკვე\s+|დღეს\s+|ხომ\s+)?(?:ჩამერიცხა|ჩამირიცხეს|მომივიდა|ავიღე|შემოვიდა|ჩამოვიდა|ჩაირიცხა|ჩამოირიცხა|მოვიდა|დამერიცხა|დაირიცხა)(?![ა-ჰ])|(?:ჩამერიცხა|შემოვიდა|ჩაირიცხა|მომივიდა|მოვიდა|დამერიცხა)\s+(?:უკვე\s+|დღეს\s+)?(?:ხელფასი?|სტიპენდია?)(?![ა-ჰ])/
  if (SALARY_IN.test(s0)) {
    out.salaryIn = true
    // nothing else asked: "ხელფასი დღეს ჩამერიცხა?" is a question about payday itself
    const rest = s0.replace(SALARY_IN, ' ').split(/[^ა-ჰa-z]+/).filter(w => w && !/^(?:დღეს|უკვე|ხომ|თუ|არა|ჯერ|კი|მაინტერესებს|გთხოვ|ჯიხო|ხო|ჰო|ჩემი|ჩემს|გუშინ|ნეტა|როდის|საინტერესოა)$/.test(w))
    if (!rest.length) out.salaryQ = true
  }
  // the day of the spend: "ხვალ ხელფასია" and "ხელფასის დღეს" name payday, not the day of the spend
  const sd = s0.replace(/ხვალ\s+ხელფას\S*|ზეგ\s+ხელფას\S*|ხელფას\S*\s+(?:კი\s+)?(?:ხვალ|ზეგ)(?![ა-ჰ])|ხელფასის\s+დღე\S*/g, ' ')
  if (/(?:^|[^ა-ჰ])დღეს(?![ა-ჰ])/.test(sd)) out.dayOffset = 0
  else if (/(?:^|[^ა-ჰ])ხვალ(?:ინდელ\S*)?(?![ა-ჰ])/.test(sd)) { out.dayOffset = 1; out.dayWord = 'ხვალ' }
  else if (/(?:^|[^ა-ჰ])ზეგ(?![ა-ჰ])/.test(sd)) { out.dayOffset = 2; out.dayWord = 'ზეგ' }
  else if (/(?:მომავალ|შემდეგ)\s+კვირ/.test(sd)) { out.dayOffset = 7; out.dayWord = 'მომავალ კვირას' }
  else {
    const wd = WEEKDAYS.find(([re, n]) => re.test(sd) && !(n === 6 && /(?:მომავალ|შემდეგ|ამ|ყოველ|ერთ|ორ)\s+კვირას/.test(sd)))
    if (wd) { out.weekday = wd[1]; out.dayWord = wd[2] }
  }

  // ---- numbers ----
  s = wordsToDigits(s)
  // thousands written with a dot or comma ("1.200", "1,200"); exactly three digits per group, so "1,5" and "2.40" stay decimals
  s = s.replace(/(^|[^\d.,])([1-9]\d{0,2}(?:[.,]\d{3})+)(?![\d]|[.,]\d)/g, (_, a: string, b: string) => a + b.replace(/[.,]/g, ''))
  // ...and with a space ("1 200"), so later patterns see one number
  s = s.replace(/(^|[^\d.,])([1-9]\d{0,2}(?:[  ]\d{3})+)(?!\d)/g, (_, a: string, b: string) => a + b.replace(/[  ]/g, ''))
  // ratios and fractions are not money ("50/30/20")
  s = s.replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+/g, ' ')
  // dates, ordinals, years and clock times are not money ("მე-10 რიცხვში", "10 ნოემბერს", "2027 წლიდან", "10 საათზე")
  s = s.replace(/(^|[^ა-ჰ])მე(?:-\s?)?\d+(?:-?ე(?![ა-ჰ])|-?ში)?/g, '$1 ')
  s = s.replace(/(^|[^\d.,])\d{1,2}\s*-?\s*ში\s+(მერიცხ|ჩამერიცხ|ირიცხ|შემოდის|მოდის|ხელფას)/g, '$1 $2')
  s = s.replace(/(ხელფას\S*\s+)\d{1,2}\s*-?\s*(ში|ს)(?![ა-ჰ])/g, '$1 ')
  s = s.replace(/(^|[^\d.,])\d{1,2}\s*-?\s*(?:ში\s+)?რიცხვ/g, '$1 ')
  s = s.replace(new RegExp(`(^|[^\\d.,])\\d{1,2}\\s*-?\\s*(?:ს\\s+)?(${MONTH_STEMS})`, 'g'), '$1 $2')
  s = s.replace(/(^|[^\d.,])(?:19|20)\d{2}\s*-?\s*(?:წელს|წლიდან|წლამდე|წლის|წელი|წ\.)/g, '$1 ')
  s = s.replace(/(^|[^\d.,])\d{1,2}(?::\d{2}\s*|\s*საათ\S*)/g, '$1 ')
  // percentages: the first one is the rate, every one is removed
  const pm = s.match(/(\d+(?:[.,]\d+)?)\s*(%|პროცენტ)/)
  if (pm) {
    out.ratePct = toNumber(pm[1])
    out.rateIsAnnual = /წლიურ|წელიწად|წელში|წლის/.test(s) || (!/თვეში|თვიურ|ყოველთვ/.test(s) && out.ratePct > 4)
    if (out.ratePct === 0) out.zeroRate = true
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*(%|პროცენტ)/g, ' ')
  }
  if (/უპროცენტო|პროცენტის გარეშე|ნულ პროცენტ|0%/.test(s)) out.zeroRate = true
  // a spend repeated every day ("დღეში 40 ლარი")
  const dl = s.match(DAILY)
  // "30 დღეში 345 ლარი" is a span, not a daily spend
  if (dl && !(dl[1] !== undefined && /\d\s*-?\s*$/.test(s.slice(0, dl.index)))) { out.daily = toNumber(dl[1] ?? dl[2]); s = s.replace(dl[0], ' ') }
  // "ყოველდღე 10 ლარს ყავაში ვხარჯავ": a habit already in the person's spending, not a new spend ("რომ დავხარჯო?")
  if (out.daily !== undefined && /ვხარჯავ|ვიხდი|ვყიდულობ|მეხარჯება|ვსვამ|ვჭამ|მიჯდება|მიდის|ვაძლევ/.test(s0) && !/(?:^|[^ა-ჰ])(?:რომ|თუ)(?![ა-ჰ])/.test(s0)) out.dailyHabit = true
  // "2 დღეში ერთხელ": a spend made every N days
  const en = s.match(/(\d+)\s*-?\s*დღეში ერთხელ/)
  if (en) out.everyN = Number(en[1])
  else if (/ორ დღეში ერთხელ/.test(s)) out.everyN = 2
  else if (/კვირაში ერთხელ/.test(s)) out.everyN = 7
  // a short term in days (microloans); any other "N დღე" is a time span, not money
  const dm = s.match(/(\d+)\s*-?\s*(დღით|დღიან|დღის ვადით)/)
  if (dm) { out.days = Number(dm[1]); s = s.replace(dm[0], ' ') }
  s = s.replace(/(^|[^\d.,])\d+\s*-?\s*დღ\S*/g, '$1 ')
  // weeks, minutes and seconds are time, not money ("სტიპენდიამდე 2 კვირაა")
  s = s.replace(/(^|[^\d.,])\d+\s*-?\s*(?:კვირ|წუთ|წამ)\S*/g, '$1 ')
  // a range of sums ("20-30 ლარზე"): kept for answers that use both ends
  const rg = s.match(/(?:^|[^\d.,])(\d+)\s*[-–]\s*(\d+)\s*(?:ლარ|₾)/)
  if (rg && Number(rg[1]) < Number(rg[2])) out.range = [Number(rg[1]), Number(rg[2])]
  // two terms to compare ("12 თვე ჯობია თუ 24?", "12 თვით თუ 24 თვით?")
  const cm = s.match(/(\d+)\s*-?\s*(?:თვე|თვიან|თვით|თვეზე)\S*\s*(?:(?:ჯობია|სჯობს|ჯობს|სჯობია|უკეთესია|აჯობებს)\s*)?(?:თუ|ან)\s*(\d+)(?=\s*-?\s*(?:თვ|[?!.,]|$))\s*-?\s*(?:თვ\S*)?/)
  if (cm && Number(cm[1]) <= 120 && Number(cm[2]) <= 120 && cm[1] !== cm[2]) { out.compareMonths = [Number(cm[1]), Number(cm[2])]; s = s.replace(cm[0], ' ') }
  // months / years ("1,5 წლით" is 18 months)
  const mm = s.match(/(\d+)\s*-?\s*(თვ|თთ|month|мес|tve|tvi)/)
  // "0 თვით" is not a term: the responder asks instead of quietly picking one
  if (mm) { if (Number(mm[1]) === 0) out.zeroTerm = true; else out.months = Number(mm[1]); s = s.replace(mm[0], ' ') }
  const ym = s.match(/(\d+(?:[.,]\d)?)\s*-?\s*(წლით|წელი|წლიან|წელიწად|წელში|წლის|year|год|лет|weli|wlit)/)
  if (!out.months && ym) { out.months = Math.round(toNumber(ym[1]) * 12); s = s.replace(ym[0], ' ') }
  if (!out.months && /წელიწადნახევ|ერთნახევარ წ/.test(s)) out.months = 18
  if (!out.months && /ნახევარი? (?:წლ|წელ)/.test(s)) out.months = 6
  if (!out.months && /ერთი წლ|წლიანი|ერთ წელ/.test(s)) out.months = 12
  if (!out.months && /ორი წლ|ორ წელ/.test(s)) out.months = 24
  // upfront ("300 ₾ დანაზოგიდან წინასწარ", "200 ლარი წინასწარ რომ შევიტანო?", "წინასწარ 500 ლარს შევიტან")
  const up = s.match(/(\d[\d\s]*)\s*(?:ლარ[ა-ჰ]*|₾|ლ(?![ა-ჰ]))?\s*(?:დანაზოგიდან|წინასწარ|პირველად შენატან|პირველ შენატან)/)
    ?? s.match(/(?:წინასწარ|პირველად შენატან\S*|პირველ შენატან\S*)\s+(\d[\d\s]*?)\s*(?:ლარ[ა-ჰ]*|₾|ლ(?![ა-ჰ]))/)
    // "400 ლარი თუ შევიტანე თავიდან", "თავიდან 400-ს გადავიხდი", "პირველადი შენატანი 400", "400 ლარი ავანსად"
    ?? s.match(new RegExp(`(\\d+)\\s*(?:ლარ\\S*|₾|ლ(?![ა-ჰ]))?\\s*(?:-?ს\\s*)?(?:(?:თუ|რომ)\\s+)?(?:${UP_WHEN}\\s+${UP_VERB}|${UP_VERB}\\s+${UP_WHEN}|ავანსად|ავანსის სახით)`))
    ?? s.match(new RegExp(`${UP_WHEN}\\s+(\\d+)\\s*(?:ლარ\\S*|₾|ლ(?![ა-ჰ]))?\\s*(?:-?ს\\s*)?(?:(?:თუ|რომ)\\s+)?${UP_VERB}`))
    ?? s.match(/(?:პირველადი|საწყისი|თავდაპირველი) (?:შენატან|გადასახად)\S*\s+(?:\S+\s+)?(\d+)/)
    ?? s.match(/(\d+)\s*(?:ლარ\S*|₾)?\s*(?:-?ს?\s*)?(?:პირველადი|საწყისი|თავდაპირველი) (?:შენატან|გადასახად)/)
    ?? s.match(/ავანს\S*\s+(\d+)/)
  if (up) { out.upfront = toNumber(up[1]); s = s.replace(up[0], ' ') }
  if (/დანაზოგით|დანაზოგიდან|ანაბრიდან|ნაღდად ვიყიდ|შევაგროვებ/.test(s)) out.useSavings = true
  // "1200 ლარის ტელეფონი 0%-ით 12 თვით ან 1100 ლარად ნაღდად": the cash price next to the installment
  const cp = s.match(/(\d+(?:[.,]\d+)?)\s*(?:ლარ\S*|₾)?\s*(?:-?ად\s*)?ნაღდ/) ?? s.match(/ნაღდ\S*\s+(?:ფასი\s+)?(\d+(?:[.,]\d+)?)/)
  if (cp && /განვადებ|თვით|თვე|%|ან /.test(s)) { out.cashPrice = toNumber(cp[1]); s = s.replace(cp[0], ' ') }
  // a monthly saving contribution ("თვეში 200-ს თუ გადავდებ?")
  if (SAVE_VERB.test(s)) {
    const pmo = s.match(PER_MONTH_A) ?? s.match(PER_MONTH_B) ?? (/თვეში|ყოველთვე|თვიურად/.test(s) ? s.match(PER_MONTH_C) : null)
    if (pmo) { out.perMonth = toNumber(pmo[1]); s = s.replace(pmo[0], ' ') }
  }
  // money on hand ("40 ლარი დამრჩა", "ჯიბეში 20 ლარი მაქვს"); not a bill or a debt ("ვალი მაქვს 500 ლარი")
  const oh = s.match(ON_HAND_AFTER) ?? s.match(ON_HAND_BEFORE)
  if (oh && !/(ვალ|სესხ|გადასახდ|ქირა|განვადებ)\S*\s*$/.test(s.slice(Math.max(0, (oh.index ?? 0) - 16), oh.index))) {
    out.onHand = toNumber(oh[1]); s = s.replace(oh[0], ' ')
    // cash in hand: the card balance in the person's data is separate from it
    if (/ხელზე|ჯიბეში|საფულეში|ნაღდ/.test(s0) && !/ბარათზე|ანგარიშზე/.test(s0)) out.cash = true
  }
  // counts are not money ("3 ვალი", "2 შვილი")
  s = s.replace(/(^|[^\d.,])\d{1,2}\s*-?\s*(?:ი\s+)?(ვალ|სესხ|ბარათ|შვილ|ბავშვ|წევრ|ადამიან|კაც|ცალ|ნივთ|ვარიანტ|ბანკ|ანგარიშ|განვადებ)/g, '$1 $2')
  // amount: number with thousand words, else a number with a currency word, else the first remaining number
  const th = s.match(/(\d+(?:[.,]\d+)?)\s*(ათას|k\b)/)
  if (th) { out.amount = toNumber(th[1]) * 1000; s = s.replace(th[0], ' ') }
  const disc = s.match(/ფასდაკლებ\S*\s+(\d+(?:[.,]\d+)?)/)
  if (disc && out.amount === undefined) { out.amount = toNumber(disc[1]); s = s.replace(disc[0], ' ') }
  // an old and a new price ("300 ლარიანი პალტო ფასდაკლებით 210 ლარი ღირს"): the price to pay is the new one
  if (out.amount === undefined && /ფასდაკლებ|ნაცვლად|(?:^|[^ა-ჰ])ახლა\s+\d|(?:^|[^ა-ჰ])იყო\s+\d/.test(s)) {
    const re = new RegExp(AMOUNT_CUR.source, 'g')
    const all: RegExpExecArray[] = []
    for (let m = re.exec(s); m; m = re.exec(s)) all.push(m)
    if (all.length >= 2) {
      const after = all.find(m => /(?:ფასდაკლებით|ახლა|ფასად)\s*$/.test(s.slice(Math.max(0, m.index - 14), m.index)))
      out.amount = toNumber((after ?? all[all.length - 1])[1])
    }
  }
  if (out.amount === undefined) {
    const am = s.match(AMOUNT_CUR) ?? s.match(AMOUNT_ANY)
    if (am) out.amount = toNumber(am[1])
    // several sums with a money word each ("საჩუქარი 80 ლარი, ტაქსი 20 ლარი"): a purchase counts them all;
    // alternatives ("80 თუ 120 ლარი?") and the salary or balance are not added up
    const re = new RegExp(AMOUNT_CUR.source, 'g')
    const all: RegExpExecArray[] = []
    for (let m = re.exec(s); m; m = re.exec(s)) all.push(m)
    if (all.length >= 2 && all.length <= 5) {
      const between = all.slice(1).map((m, i) => s.slice(all[i].index + all[i][0].length, m.index))
      const near = all.map(m => s.slice(Math.max(0, m.index - 18), m.index))
      // the same sum named again ("…80 ლარის, … ეს 80 ლარი რომ დავხარჯო") is one spend, not two
      const vals = all.map(m => toNumber(m[1])).filter((v, i, a) => a.indexOf(v) === i)
      if (vals.length >= 2 && !between.some(b => /(?:^|[^ა-ჰ])(?:თუ|ან|ნაცვლად|ვიდრე)(?![ა-ჰ])/.test(b)) && !near.some(b => /ხელფას|შემოსავ|ნაშთ|სტიპენდ|მაქვს|დამრჩა|ღირდა|იყო/.test(b))) out.parts = vals
    }
  }
  // a pasted bank SMS: its own balance and date (shown next to the demo data, never read from a bank)
  const smsB = s0.match(/ნაშთი?\s*:?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:gel|ლარ|₾)/)
  if (smsB) out.smsBalance = toNumber(smsB[1])
  const smsD = s0.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})[./](?:20)?\d{2}(?!\d)/)
  if (smsD) out.smsDate = `${Number(smsD[1])}.${smsD[2].padStart(2, '0')}`
  // month names
  for (const [re, n] of MONTHS) if (re.test(s)) { out.startMonth = n; break }
  if (/ხელფასის შემდეგ|ხელფასის მერე|ხელფასზე/.test(s) && !/(?:ჩემს|ჩემი|ამ|ჩემ) ხელფასზე|ხელფასზე (?:ბევრ|ძვირ|დიდ|მეტ)/.test(s) && !COSTLY.test(s0)) out.afterPayday = true
  for (const [re, name] of ITEMS) if (re.test(s)) { out.item = name; break }
  out.micro = /მიკრო|სწრაფი ფულ|სწრაფი სესხ|ონლაინ სესხ|ლომბარდ/.test(s0)
  // a bill to pay; a long message about buying an item only mentions bills already paid ("ქირა გადავიხადე, … საჩუქარი მინდა")
  out.bill = /გადასახდელ|გადასახადი|უნდა გადავიხადო|(?:^|[^ა-ჰ])ქირა|კომუნალ/.test(s0) && !(out.item && s0.length > 80)
  // a spend that already happened: a pasted bank SMS, or "დღეს უკვე 30 ლარი დავხარჯე"
  out.spent = /ჩამოიჭრა|ჩამოგეჭრა|ჩამოგეჭრათ|გადახდა შესრულდა|ხელმისაწვდომი ნაშთი|(?:^|[^ა-ჰ])(?:დავხარჯე|გადავიხადე|ვიყიდე|დამეხარჯა)(?![ა-ჰ])/.test(s0) && !/ხომ არ|რომ |თუ /.test(s0)
  // lending to someone is money going out, not a loan taken ("ვასესხო" lend, "ვისესხო" borrow)
  if (/ვასესხ|სესხად (?:მივცე|მივეცი|ვაძლევ|მივცემ)|(?:მთხოვა|მთხოვს|მთხოვენ)\S*\s.*სესხად|სესხად\s+(?:მთხოვა|მთხოვს)/.test(s0) && !/მასესხ/.test(s0)) out.lend = /ვასესხე(?![ა-ჰ])|მივეცი/.test(s0) ? 'past' : 'future'
  out.raise = (/ხელფას|შემოსავ|სტიპენდი/.test(s0) && RAISE.test(s0) && !/ხარჯ|(?:^|[^ა-ჰ])ფას(?:ებ|ი )|ქირა|ინფლაც|ანაბ|დეპოზ|სესხ/.test(s0))
    || /ფრილანს|დამატებით (?:ვშოულობ|ვიღებ|ვაკეთებ|ვმუშაობ)|ვშოულობ|გამოვიმუშავებ|გამოვიმუშავე|დამატებითი შემოსავალ|გვერდით ვმუშაობ/.test(s0)
  if (out.amount === undefined && COSTLY.test(s0)) out.costly = true

  // ---- intents ----
  const has = (re: RegExp) => re.test(s)
  const has0 = (re: RegExp) => re.test(s0)
  // a greeting only when nothing else is asked; otherwise drop it and answer the question
  if (has(GREET)) {
    const rest = s.replace(GREET, '').replace(/ჯიხო\S*|jixo\S*|[\s,.!?;:\-—–]/g, '')
    if (rest.length < 3) { out.intent = 'greeting'; return out }
    s = s.replace(GREET, ' ')
  }
  // read on the words as typed (minus a greeting), before "500 ლარი მაქვს და …" loses its first words
  out.whatIf = /^\s*(და|ან|ხოლო|მაშინ|კარგი,?\s*(და|ხოლო|ან)(?![ა-ჰ]))(?![ა-ჰ])|რომ (იყოს|ღირდეს)(?![ა-ჰ])|თუ (იქნება|იყოს|გამოვიდა|დაჯდება)(?![ა-ჰ])/.test(s0.replace(GREET, ' ').replace(/^[\s,]*ჯიხო\S*/, ' '))
  out.sameDeal = has(/(?:^|[^ა-ჰ])(ეს|ამ|იგივე|ამავე|ეგ|მაგ)\s*(სესხ|განვადებ|კრედიტ)/)
  const askTotal = has0(ASK_TOTAL), askMonthly = has0(ASK_MONTHLY), askRate = has0(ASK_RATE)
  if (askTotal) out.ask = 'total'
  else if (askMonthly) out.ask = 'monthly'
  else if (askRate && out.ratePct === undefined) out.ask = 'rate'
  const noNumbers = out.amount === undefined && out.months === undefined && out.ratePct === undefined && !out.zeroRate && out.onHand === undefined && out.daily === undefined && out.perMonth === undefined

  // safety first: these never get a price or a purchase check, whatever amount is in the text
  if (has0(SELF_HARM)) { out.intent = 'distress'; out.selfHarm = true; return out }
  if (has0(GAMBLING) || (has0(PLAY) && !has0(NOT_GAMBLING_PLAY))) { out.intent = 'gambling'; out.concept = 'gambling'; return out }
  if (CARD_NUMBER.test(raw)) { out.intent = 'concept'; out.concept = 'fraud'; out.cardNumber = true; return out }
  if (has0(FRAUD)) { out.intent = 'concept'; out.concept = 'fraud'; out.given = has0(FRAUD_GIVEN); return out }
  // which debt first, snowball or avalanche, what refinancing is: a neutral concept (with no hardship wording next to it)
  if (has0(DEBT_ORDER) && !has0(CANT_PAY) && !has0(DISTRESS) && !has0(OVERDUE) && !has0(LATE)) { out.intent = 'concept'; out.concept = 'debts'; return out }
  // "ხელფასი ჩამერიცხა, პირველ რიგში რა გადავიხადო?": the month's bills in date order
  if (has0(BILLS_ORDER) && !has0(CANT_PAY) && !has0(DISTRESS)) { out.intent = 'budget'; out.bills = true; out.billsOrder = true; return out }
  // already overdue and asking what now: the way forward, not only the penalty
  if (has0(OVERDUE)) { out.intent = 'hardship'; out.concept = 'restructure'; out.overdue = true; out.distress = has0(DISTRESS); return out }
  // "დროზე ვერ ვიხდი არაფერს": a person who cannot pay anything is in hardship, not asking about a late fee
  if (has0(LATE) && has0(/არაფერს|ვერაფერს|ვერც ერთს|ვალებ|ყველაფერ/)) { out.intent = 'hardship'; out.concept = 'restructure'; out.distress = has0(DISTRESS); return out }
  // "რამდენ ხანს რჩება იქ დაგვიანება?": how long a late payment stays in the credit history
  if (has0(LATE) && has0(/რამდენ ხანს|რამდენი ხანი|როდემდე|ინახება|იშლება|წაიშლება|ისტორიაში/)) { out.intent = 'concept'; out.concept = 'credithistory'; return out }
  if (has0(LATE) && !has0(/ვადაზე ადრე|ვადამდე (დაფარ|დავფარ)|წინსწრებ|საკრედიტო ისტორ|კრედიტ ?ისტორ|კრედიტინფო/)) { out.intent = 'concept'; out.concept = 'late'; return out }
  // "ბანკს რა ვუთხრა?", "როგორ ვთხოვო ბანკს?": how to ask the lender (the steps)
  if (has0(/(?:ბანკ|გამსესხებ|კრედიტორ|მესაკუთრ|მეპატრონ)\S*\s.*(?:რა (?:უნდა )?ვუთხრა|როგორ (?:ვთხოვო|ვითხოვო|მივმართო|ვესაუბრო|დაველაპარაკო))|(?:რა (?:უნდა )?ვუთხრა|როგორ (?:ვთხოვო|ვითხოვო|მივმართო|ვესაუბრო|დაველაპარაკო))\S*\s.*(?:ბანკ|გამსესხებ|კრედიტორ|მესაკუთრ|მეპატრონ)|^\s*(?:მესაკუთრეს|მეპატრონეს|ბანკს) რა (?:უნდა )?ვუთხრა/) && out.amount === undefined) { out.intent = 'hardship'; out.concept = 'restructure'; out.distress = has0(DISTRESS); return out }
  if (has0(HARDSHIP)) { out.intent = 'hardship'; out.concept = 'restructure'; out.distress = has0(DISTRESS); out.essential = has0(ESSENTIAL) && !has0(REFINANCE); return out }
  if (has0(DISTRESS) && out.amount === undefined && !has(/ვიყიდ|განვადებ/)) { out.intent = 'distress'; return out }
  // questions about Jikho itself: information or advice, who regulates it, who answers for a wrong forecast
  if (has0(META_ADVICE)) { out.intent = 'who'; out.meta = 'advice'; return out }
  if (has0(META_REG) && out.amount === undefined) { out.intent = 'who'; out.meta = 'regulated'; return out }
  if (has0(META_LIAB) && out.amount === undefined) { out.intent = 'who'; out.meta = 'liability'; return out }
  if (has0(META_PURPOSE) && out.amount === undefined) { out.intent = 'who'; out.meta = 'purpose'; return out }
  // state help when out of work, and a job just lost: before the emergency-fund definition
  if (has0(WELFARE) && out.amount === undefined) { out.intent = 'unknown'; out.welfare = true; return out }
  if (has0(JOB_LOSS)) { out.intent = 'concept'; out.concept = 'emergency'; out.jobLoss = true; return out }
  // trust: data source, AI, who pays, bank choice
  if (has0(TRANSFER)) { out.intent = 'concept'; out.concept = 'data'; return out }
  if ((has0(DATA) || has0(/ანგარიშიდან (?:იღებ|კითხულობ)|ინფორმაციას (?:იღებ|საიდან)|იღებ ინფორმაციას/)) && out.amount === undefined) { out.intent = 'concept'; out.concept = 'data'; return out }
  if (has0(HABIT) && out.amount === undefined) { out.intent = 'who'; out.habit = true; return out }
  if (has0(BALANCE) && out.amount === undefined && out.onHand === undefined) { out.intent = 'unknown'; out.balance = has0(/ხარჯავ|მიდის|ხარჯები/) ? 'spend' : 'now'; return out }
  if (has0(AI)) { out.intent = 'who'; out.ai = true; return out }
  if (has0(LOAN_SALES)) { out.intent = 'who'; out.biz = true; out.loanSales = true; return out }
  if (has0(NOBANK)) { out.intent = 'concept'; out.concept = 'nobank'; return out }
  if (has(/მადლობ|გმადლობ|მერსი|thanks|დიდი მადლ/) && out.amount === undefined) { out.intent = 'thanks'; return out }
  if (has(/ვინ ხარ(?![ა-ჰ])|რა გქვია|ვინ არის ჯიხო|(?:^|[^ა-ჰ])რა ხარ(?![ა-ჰ])/)) { out.intent = 'who'; return out }
  if (has0(BIZ)) { out.intent = 'who'; out.biz = true; return out }
  if (has(/^\s*(ჰელფ|help|დახმარება|დამეხმარე)[\s?!.]*$|რა შეგიძლია|რისი გაკეთება შეგიძლია|რას აკეთებ|როგორ გამოგიყენო|რაში დამეხმარები/)) { out.intent = 'who'; out.help = true; return out }
  if (has0(INVEST)) { out.intent = 'invest'; return out }
  // "developer mode", "forget the rules": the rules stay the same
  if (has0(JAILBREAK)) { out.intent = 'who'; out.jailbreak = true; return out }
  // a clear off-topic request: said honestly, not "I did not understand"
  if (out.amount === undefined) {
    const off = has0(OFF_RUDE) ? 'rude' : has0(OFF_FOOD) ? 'food' : has0(OFF_SPORT) ? 'sport' : has0(OFF_JOKE) ? 'joke' : has0(OFF_OTHER) ? 'other' : undefined
    if (off) { out.intent = 'unknown'; out.offTopic = off; return out }
  }
  // "ბანკში რა საბუთები წავიღო?": what lenders usually ask for
  if (has0(DOCS) && out.amount === undefined) { out.intent = 'unknown'; out.docs = true; return out }
  // lending to a friend, a salary raise: money going out or coming in, never a loan price
  if (out.lend) { out.intent = out.amount !== undefined ? 'purchase' : 'unknown'; return out }
  if (out.raise) { out.intent = 'unknown'; return out }
  // mortgage, guarantor, leasing, credit cards: plain facts, never a loan prompt
  if (has0(FACT) && out.amount === undefined && !has0(DEPOSIT)) { out.intent = 'unknown'; out.fact = true; return out }
  // "ბანკმა 2000 ლარის საკრედიტო ლიმიტი შემომთავაზა": a credit line is not a term loan (the sum stays for the answer)
  if (has0(/საკრედიტო ლიმიტ|საკრედიტო ბარათ|ლიმიტი შემომთავაზ/) && !has0(/თვით|თვე|წლით|%/)) { out.intent = 'unknown'; out.fact = true; return out }
  // yes/no, or "12 თვე ჯობია თუ 24?": the decision stays with the user
  if (out.compareMonths || (out.amount === undefined && (has0(DECIDE) || has0(WHAT_DO)))) { out.intent = 'decide'; return out }
  // "ავიღო თუ არა 2 000 ლარიანი სესხი…?": priced as asked, the decision left to the user
  if (out.amount !== undefined && has0(YES_NO)) out.yesNo = true
  if (out.amount === undefined && has0(/ფული (აღარ|არ) მაქვს|(ფული )?(აღარ |არ |ვერ )მყოფნის|ფული არ მეყოფა|ცუდად ვარ ფინანსურად|ფინანსურად (?:ძალიან )?(?:ცუდად|მძიმედ|გაჭირვებით|ვერ ვარ)|ფინანსური (?:პრობლემ|სირთულ|გაჭირვ)|ფულის (?:პრობლემ|სირთულ)|(?:ძლივს|ვერ) ვართმევ თავს|ხელმოკლედ ვარ/)) { out.intent = 'forecast'; out.short = true; return out }
  // "ხელფასი დღეს ჩამერიცხა?": answered from the payday in the data
  if (out.salaryQ && out.amount === undefined && out.perMonth === undefined && out.onHand === undefined) { out.intent = 'forecast'; out.when = true; return out }
  // a bare "ვიყიდო?", "ავიღო?": the decision on what is on the table
  if (out.amount === undefined && has0(/^\s*(?:აბა |მაშ |ხოდა |და )?(?:ვიყიდო|ავიღო|გავაფორმო|დავხარჯო|წავიდე|ვისესხო|ჩავდო)\s*[?!.…]*\s*$/)) { out.intent = 'decide'; return out }
  // "თუ დაველოდები?", "მოვიცადო?": the same spend after payday
  if (out.amount === undefined && has0(/^\s*(?:და |ან |თუ |რომ |ხოლო )*(?:დაველოდ|მოვიცად|დავიცად|მოვიცდ|დავიცდ|დაველოდები)\S*\s*[?!.…]*\s*$/)) { out.intent = 'followup'; out.afterPayday = true; return out }
  // "ქირა?", "ინტერნეტი?": when that bill is due
  if (out.amount === undefined && has0(/^\s*(?:და |ხოლო |ან )?(?:ქირა|ქირის|ინტერნეტი|ინტერნეტის|მობილური|კომუნალური|კომუნალურები|დენი|დენის|გაზი|გაზის|წყალი|წყლის|სპორტდარბაზი|გამოწერები|სესხის შენატანი|განვადების შენატანი)\s*(?:როდისაა|როდის)?\s*[?!.…]*\s*$/)) { out.intent = 'budget'; out.bills = true; return out }
  // "ok", "გასაგებია", "რატომ?", "მარტივად ამიხსენი": short replies about the last answer
  if (noNumbers) {
    const words = s0.split(/[^ა-ჰa-z]+/).filter(Boolean)
    if (!words.length && /^[\s?!.…,;:]*$/.test(raw)) { out.intent = 'who'; out.help = true; return out }
    if (!words.length && /\S/.test(raw) && !/[a-zA-Zა-ჰᲐ-ᲿЀ-ӿ\d]/.test(raw)) { out.intent = 'ack'; return out }
    if (words.length && words.every(w => ACK_WORD.test(w))) { out.intent = 'ack'; return out }
    if (words.some(w => /^(დახმარება|help|ჰელფ)$/.test(w)) && words.every(w => ACK_WORD.test(w) || /^(დახმარება|help|ჰელფ)$/.test(w))) { out.intent = 'who'; out.help = true; return out }
    if (EXPLAIN_CORE.test(s0) && words.every(w => EXPLAIN_FILL.test(w))) {
      out.intent = 'explain'
      out.explain = /მაგალით/.test(s0) ? 'example' : /რატომ|რისთვის|მაინტერესებდეს|მნიშვნელოვან/.test(s0) ? 'why' : /მარტივ|გამიმარტივე|ვერ გავიგე|ვერ მივხვდი|არ მესმის|ვერ ვხვდები|გაუგებარ/.test(s0) ? 'simple' : 'more'
      return out
    }
  }
  // payslip, pension, early repayment, impulse spending: plain facts (the responder's default branch), never a price
  if (has0(/საშემოსავლო|დარიცხულ|დარიცხვამდე|ბინძურ\S* ხელფას|საპენსიო|(?:^|[^ა-ჰ])პენსი|ვადაზე ადრე|ვადამდე (დაფარ|დავფარ)|წინსწრებ/) && !has0(DEPOSIT)) { out.intent = 'unknown'; return out }
  if (out.amount === undefined && has0(/ზედმეტს (ვყიდულობ|ვხარჯავ)|ემოციურ\S* (შოპინგ|ხარჯ|ყიდვ)|იმპულს/)) { out.intent = 'unknown'; return out }
  // "ბანკი რომ გაკოტრდეს, ფული დამეკარგება?", "სარგებელზე გადასახადი არის?": the deposit facts
  if (has0(/გაკოტრ/) && has0(/ფულ|ანაბ|ანაბრ|ბანკ|დეპოზ/) || has0(/სარგებ/) && has0(/გადასახად|იბეგრ|საშემოსავლო|ჭრიან|აკავებ/)) { out.intent = 'concept'; out.concept = 'deposit'; return out }
  // "450 ლარის ანაბარი მაქვს, დაზღვეულია?", "სარგებელზე საშემოსავლოს მიჭრიან?": insurance or tax, answered as a fact (the sum kept)
  if (has0(DEPOSIT) && has0(/დაზღვ|გაკოტრ|დაიკარგ|იბეგრ|ბეგრ|საშემოსავლო|ჭრიან|იჭრება|აკავებ|გადასახად/)) {
    out.intent = 'concept'; out.concept = 'deposit'
    if (out.amount === undefined) out.amount = out.onHand
    return out
  }
  // a deposit with numbers is a growth question, not a purchase
  if (has0(DEPOSIT) && (out.amount !== undefined || out.onHand !== undefined || out.ratePct !== undefined || out.perMonth !== undefined)) {
    out.intent = 'deposit'
    if (out.amount === undefined) out.amount = out.onHand
    return out
  }

  // "ლეპტოპის განვადება როდის მთავრდება?": the person's own installment, from the data
  if (out.amount === undefined && has0(/(?:განვადებ|სესხ)\S*\s.*(?:როდის (?:მთავრდება|სრულდება|დამთავრდება|დაიფარება)|რამდენი (?:დარჩა|დამრჩა|შენატანი დარჩა))|(?:როდის (?:მთავრდება|სრულდება|დამთავრდება)|რამდენი დამრჩა)\S*\s.*(?:განვადებ|სესხ)/)) { out.intent = 'budget'; out.myDebt = true; return out }
  // "კურსის თანხას როდის შევავსებ?": when a saving goal is reached
  if (has0(GOAL_Q) && out.amount === undefined) { out.intent = 'save'; out.goalQ = true; return out }
  const askWhat = has0(/რა არის|რას ნიშნავ|ახსენი|რატომ|როგორ მუშაობ|განმარტ|რა განსხვავ|რას ჰქვია/)
  for (const [re, id] of CONCEPTS) {
    if (re.test(s0) && (askWhat || out.amount === undefined)) {
      if (id === 'installment' && out.amount !== undefined) continue
      out.intent = 'concept'; out.concept = id; return out
    }
  }
  // "რატომ მიჭირს ზოგ თვეში?": a short why-question with no topic of its own is about the last answer
  if (noNumbers && /^\s*(?:და |მაშინ |მაგრამ )?რატომ(?![ა-ჰ])/.test(s0) && s0.split(/[^ა-ჰa-z]+/).filter(Boolean).length <= 7 && !has0(/სესხ|განვადებ|ანაბ|ბანკ|ჯიხო|აპ/)) { out.intent = 'explain'; out.explain = 'why'; return out }
  // "ჯამში რამდენს გადავიხდი?" with no new numbers: answered from the card already on the table
  if (out.ask && out.amount === undefined && out.months === undefined && out.ratePct === undefined && !out.zeroRate) { out.intent = 'total'; return out }
  // saving: a monthly sum, or "without a loan"
  const saving = has(/დავზოგო|დავზოგავ|შევაგროვო|შევაგროვებ|დავაგროვო|დავაგროვებ|დაზოგვ|დაგროვებ|რამდენ ხანში|როდის შევძლებ|როდის ვიყიდი|რამდენი ხანი (?:დამჭირდება|მჭირდება|უნდა)|რა დრო დამჭირდება|რამდენ თვეში|რამდენი თვე (?:დამჭირდება|მჭირდება)/)
  if (out.perMonth !== undefined || (saving && has(/სესხის გარეშე|უსესხოდ|განვადების გარეშე/)) || (has(/გადავდო|გადავდებ|დავზოგო|დავზოგავ|შევინახო/) && (out.amount !== undefined || has(/თვეში|ყოველთვე|თვიურად|ხელფასიდან/)))) { out.intent = 'save'; return out }
  // a "what is ..." question with no numbers is not a loan request: it gets no amount prompt
  const definition = askWhat && out.amount === undefined && out.months === undefined && out.ratePct === undefined && !has(/მინდა|ავიღო|ვიყიდ|ვისესხ/)
  if (!definition && has(/განვადებ|ნაწილ-ნაწილ|pay later|ნაწილებად|თვეობრივ|ყოველთვიურად გადავიხდ|ნისი|рассрочк/)) { out.intent = 'installment'; return out }
  if (!definition && has(/სესხ|კრედიტ|მიკრო|სწრაფი ფულ|кредит|займ/)) { out.intent = 'loan'; return out }
  if (saving) { out.intent = 'save'; return out }
  // "კომუნალურები?", "რა გადასახადები მაქვს?": the person's bills
  if (out.amount === undefined && noNumbers && has0(/კომუნალურ|გადასახადებ|გადასახდელ|რა მაქვს გადასახდელი|ჩემი ხარჯები|გადასახად\S*\s+როდის|როდის\S*\s+(?:მაქვს\s+)?(?:გადასახდ|ჩამომეჭრ|იჭრება)|(?:ქირ|ინტერნეტ|მობილურ)\S*\s.*როდის/)) { out.intent = 'budget'; out.bills = true; return out }
  // money on hand or a daily spend, with nothing to buy: a budget question
  if ((out.onHand !== undefined || out.daily !== undefined) && out.amount === undefined) { out.intent = 'budget'; return out }
  if (has(/დღეს რამდენ|რამდენი შემიძლია|რამდენის დახარჯვა|რა ბიუჯეტ|რამდენი დავხარჯო|დღეს რა შემიძლ|დღიური ბიუჯეტ|რას (?:დავხარჯავ|დავხარჯო)|რისი დახარჯვა|თავისუფალი (?:თანხა|ფული)|თავისუფლად რამდენ|რამდენი შემიძლია ვხარჯო/)) {
    out.intent = 'safe'
    if (has0(/კვირაში|კვირაზე|კვირის განმავლობაში/) && !has0(/ერთხელ/)) out.perWeek = true
    return out
  }
  const when = has0(/სტიპენდი|როდის (?:მე|ჩამე|შემო)რიცხ|ხელფას\S* როდის|როდის (?:მოდის|მომდის|ჩამოდის|მერიცხება|ჩამერიცხება|მივიღებ|ავიღებ) (?:ხელფას|სტიპენდ)|ხელფასამდე რამდენი დღე/)
  if ((when || has(/ხელფასამდე|რამდენი დამრჩება|გავძლებ|მეყოფა|ამინდ|პროგნოზ|როგორ ვარ|რა მდგომარეობ|ფინანსებ\S*.*როგორ|როგორ\S*.*ფინანსებ|ფინანსურად როგორ|მოკლედ როგორა|საერთო სურათ/)) && out.amount === undefined) {
    out.intent = 'forecast'
    out.when = when
    out.sky = has0(/ამინდ/) && has0(/თბილის|ქუთაის|ბათუმ|ქალაქ|გარეთ|გრადუს|ტემპერატურ|თოვ|ქოლგ|ხვალ|ზეგ/) && !has0(/ხელფას|ფულ|ბიუჯეტ/)
    return out
  }
  if (out.amount !== undefined && has(/ვიყიდ|ყიდვ|შევიძინ|დავხარჯ|ღირს|ავიღ|გადავიხად|მინდა|ვისესხ|ვაჩუქ|წავიდე|ვჭამ|რესტორ|ღირებულ/) ) return buy()
  if (out.amount !== undefined && out.item) return buy()
  // follow-ups: only modifiers
  if (out.months !== undefined || out.startMonth !== undefined || out.ratePct !== undefined || out.zeroRate || out.useSavings || out.upfront !== undefined || out.afterPayday || (out.amount !== undefined && (out.whatIf || has(/^\s*თუ(?![ა-ჰ])/))) || has(/^\s*(და|ან|ხოლო)\s*თუ(?![ა-ჰ])/)) {
    out.intent = 'followup'; return out
  }
  if (out.amount !== undefined) return buy()
  return out

  /** a purchase: several named sums are added up; a spend named without a sum is listed as not counted */
  function buy(): Parsed {
    out.intent = 'purchase'
    if (out.parts && !out.months && out.ratePct === undefined && !out.zeroRate && !out.spent) { out.amount = out.parts.reduce((a, b) => a + b, 0); out.item = undefined }
    else out.parts = undefined
    if (out.item && !out.parts && s0.length > 60) {
      const un = EXTRA_SPENDS.filter(([re, n]) => n !== out.item && re.test(s0)).map(x => x[1])
      if (un.length) out.uncounted = un
    }
    out.needed = NEEDED.test(s0)
    if (WAIT_Q.test(s0)) out.waitQ = true
    return out
  }
}
