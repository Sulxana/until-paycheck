"""Engine v0 -- deterministic, seeded reproduction of every number in Nino's worked example.
Run: python -I -X utf8 engine_v0.py
Outputs: printed report + engine_v0_report.json next to this file.
Conventions (stated once, used everywhere):
  * LANDING = own-funds balance on payday morning, before the salary arrives. Because no income arrives
    inside the cycle, the landing is also the minimum balance of the cycle, so the weather, the purchase
    check and the band all use ONE statistic and cannot contradict each other.
  * Multi-cycle simulation carries the balance forward cycle by cycle (no 'independent monthly surplus').
  * Every figure beyond the first payday is an extrapolation: it assumes Nino's last 6 months repeat,
    with her own last winter's uplift added (Dec-Feb).
"""
import json, math, os, random, statistics as st

SEED = 20261102
random.seed(SEED)
N_PATHS = 1000
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------- Nino (persona) ----------------
NET_SALARY = 1800            # GEL, 10th of each month, TBC
TODAY = "Mon 2 Nov 2026"
PAYDAY = "Tue 10 Nov 2026"
DAYS_TO_PAYDAY = 8           # 2 Nov evening -> 10 Nov morning: spend days 3..10 Nov morning = 8 days
BAL_TBC, BAL_BOG = 318, 147
SPENDABLE = BAL_TBC + BAL_BOG            # 465
CREDO_DEPOSIT = 450                      # shown separately, never spendable by default
CUSHION_DAYS = 3

# fixed monthly streams: (name, amount, day of month, laptop flag). Laptop: 95 GEL at BOG, 5 payments left (15 Nov .. 15 Mar)
FIXED = [
    ("ქირა", 600, 1), ("სპორტდარბაზი", 60, 1), ("მაგთი", 35, 3), ("თელასი", 52, 5), ("Spotify", 12, 6),
    ("თბილისი ენერჯი", 55, 7), ("სილქნეტი", 35, 12), ("ლეპტოპის განვადება (BOG)", 95, 15), ("GWP", 12, 20),
]
FIXED_TOTAL = sum(a for _, a, _ in FIXED)                       # 956
LAPTOP = 95
LAPTOP_PAYMENTS_LEFT = 5                                         # 15 Nov, 15 Dec, 15 Jan, 15 Feb, 15 Mar 2027
DUE_BEFORE_PAYDAY = [("მაგთი", 35, "3 ნოე"), ("თელასი", 52, "5 ნოე"), ("Spotify", 12, "6 ნოე"), ("თბილისი ენერჯი", 55, "7 ნოე")]
DUE_TOTAL = sum(a for _, a, _ in DUE_BEFORE_PAYDAY)             # 154
# uncertain bills (seasonal utilities): uniform ranges observed in Nino's history
BILL_RANGES = {"თელასი": (46, 60), "თბილისი ენერჯი": (45, 70)}

# ---------------- daily variable spend model (fitted to Nino's last 180 days, synthetic) ----------------
# base spend per day: lognormal with weekday/weekend means; plus occasional one-off (pharmacy, gift, taxi)
WEEKDAY_MEAN, WEEKEND_MEAN = 18.0, 25.0
SIGMA = 0.6
ONEOFF_P, ONEOFF_MEDIAN, ONEOFF_SIGMA = 0.06, 60.0, 0.5

def lognormal_mean(mean, sigma):
    mu = math.log(mean) - sigma * sigma / 2
    return random.lognormvariate(mu, sigma)

def day_spend(is_weekend):
    s = lognormal_mean(WEEKEND_MEAN if is_weekend else WEEKDAY_MEAN, SIGMA)
    if random.random() < ONEOFF_P:
        s += random.lognormvariate(math.log(ONEOFF_MEDIAN), ONEOFF_SIGMA)
    return s

# calendar for 3 Nov .. 10 Nov morning (8 spend days: Tue 3, Wed 4, Thu 5, Fri 6, Sat 7, Sun 8, Mon 9, Tue 10 morning counts as no spend)
# We count 8 days of spending: 3,4,5,6 (weekdays), 7,8 (weekend), 9 (weekday), and the evening of 2 Nov (today) as one weekday.
DAYS_TO_PAYDAY_PATTERN = [False, False, False, False, False, True, True, False]   # 2(eve),3,4,5,6 wk; 7,8 we; 9 wk

def q(xs, p):
    xs = sorted(xs); k = (len(xs) - 1) * p; f = math.floor(k); c = math.ceil(k)
    return xs[f] if f == c else xs[f] + (xs[c] - xs[f]) * (k - f)

def simulate_until_payday(extra_purchase=0.0):
    landings, spends = [], []
    for _ in range(N_PATHS):
        spend = sum(day_spend(w) for w in DAYS_TO_PAYDAY_PATTERN)
        bills = 35 + 12 + random.uniform(*BILL_RANGES["თელასი"]) + random.uniform(*BILL_RANGES["თბილისი ენერჯი"])
        landings.append(SPENDABLE - bills - spend - extra_purchase)
        spends.append(spend)
    return landings, spends

def weather(p_below):
    if p_below < 0.10: return "☀ მზიანი"
    if p_below < 0.30: return "🌥 ღრუბლიანი"
    if p_below < 0.60: return "🌧 წვიმიანი"
    return "⛈ ქარიშხალი"

# ---------------- monthly cycle simulation (carry-forward) ----------------
# cycle k ends on the 10th of month m. Seasonal uplift from Nino's own last winter (synthetic): applied to the cycle that ENDS on the date.
UPLIFT = {"2026-12": 40, "2027-01": 170, "2027-02": 80, "2027-03": 30, "2027-12": 40, "2028-01": 170, "2028-02": 80, "2028-03": 30}
MONTH_NAMES_KA = {1: "იან", 2: "თებ", 3: "მარ", 4: "აპრ", 5: "მაი", 6: "ივნ", 7: "ივლ", 8: "აგვ", 9: "სექ", 10: "ოქტ", 11: "ნოე", 12: "დეკ"}

def month_add(y, m, k):
    m2 = m - 1 + k
    return y + m2 // 12, m2 % 12 + 1

def days_in_cycle(y, m):
    # cycle ending on the 10th of (y, m): approx 30 days; weekday pattern approximated as 22 weekdays + 8 weekend days
    return [False] * 22 + [True] * 8

def simulate_cycles(start_landings, n_cycles, payment_schedule, pledge=0, first_cycle=(2026, 12)):
    """payment_schedule: function(cycle_index, (y,m)) -> installment payment for the new item in that cycle.
    Laptop payments: 95 in cycles ending 2026-12 .. 2027-04 (payments on 15 Nov..15 Mar fall in cycles ending 10 Dec..10 Apr)."""
    results = []  # per cycle: dict(label, p10, p50, p90, p_below)
    paths = list(start_landings)
    y, m = first_cycle
    for k in range(n_cycles):
        key = f"{y}-{m:02d}"
        uplift = UPLIFT.get(key, 0)
        # laptop: payments 15 Nov 2026 .. 15 Mar 2027 -> cycles ending Dec 2026 .. Apr 2027
        laptop = LAPTOP if (y, m) <= (2027, 4) else 0
        fixed_wo_laptop = FIXED_TOTAL - LAPTOP
        pay = payment_schedule(k, (y, m))
        new_paths = []
        for bal in paths:
            spend = sum(day_spend(w) for w in days_in_cycle(y, m)) + uplift
            bills = fixed_wo_laptop - 52 - 55 + random.uniform(*BILL_RANGES["თელასი"]) + random.uniform(*BILL_RANGES["თბილისი ენერჯი"])
            new_paths.append(bal + NET_SALARY - bills - laptop - spend - pay - pledge)
        paths = new_paths
        results.append({
            "cycle_end": key, "label": f"10 {MONTH_NAMES_KA[m]} {y}", "uplift": uplift, "laptop": laptop, "payment": round(pay, 1),
            "p10": round(q(paths, .10)), "p50": round(q(paths, .50)), "p90": round(q(paths, .90)),
            "p_below_cushion": round(sum(1 for b in paths if b < CUSHION) / len(paths), 2),
        })
        y, m = month_add(y, m, 1)
    return results

def annuity(P, r, n):
    if r == 0: return P / n
    return P * r * (1 + r) ** n / ((1 + r) ** n - 1)

# ---------------- run ----------------
base_land, base_spend = simulate_until_payday()
MEDIAN_DAILY = round(st.median([s / 8 for s in base_spend]), 1)
AVG_DAILY = round(sum(base_spend) / len(base_spend) / 8, 1)
CUSHION = round(CUSHION_DAYS * AVG_DAILY / 5) * 5   # 3 days of typical spend, rounded to 5 GEL -> 70
p_below = sum(1 for b in base_land if b < CUSHION) / N_PATHS
land_p10, land_p50, land_p90 = round(q(base_land, .1)), round(q(base_land, .5)), round(q(base_land, .9))
spend_p10, spend_p50, spend_p90 = round(q(base_spend, .1)), round(q(base_spend, .5)), round(q(base_spend, .9))
runway_days = round(land_p50 / AVG_DAILY)
safe_today = round(max(0.0, (land_p50 - CUSHION) / DAYS_TO_PAYDAY))

# purchase check 100 GEL today
buy_land, _ = simulate_until_payday(extra_purchase=100)
buy_p10, buy_p50, buy_p90 = round(q(buy_land, .1)), round(q(buy_land, .5)), round(q(buy_land, .9))
buy_p_below = sum(1 for b in buy_land if b < CUSHION) / N_PATHS

# same 100 GEL purchase right after payday: next landing ≈ landing + 1800 - 956 - monthly variable - 100
MONTHLY_VAR_MEDIAN = round(st.median([sum(day_spend(w) for w in [False] * 22 + [True] * 8) for _ in range(N_PATHS)]))
after_payday_p50 = land_p50 + NET_SALARY - FIXED_TOTAL - MONTHLY_VAR_MEDIAN - 100
median_surplus = NET_SALARY - FIXED_TOTAL - MONTHLY_VAR_MEDIAN

# installment: phone 1,200 GEL, three tenors ordered by term
PRICE = 1200
RATE = 0.015
tenors = [("4 თვე, 0% (განვადება მაღაზიაში)", 4, 0.0), ("12 თვე, 1.5%/თვე", 12, RATE), ("24 თვე, 1.5%/თვე", 24, RATE)]
EIR = round(((1 + RATE) ** 12 - 1) * 100, 1)
tenor_rows = []
for label, n, r in tenors:
    pay = annuity(PRICE, r, n)
    total = pay * n
    sched = (lambda n=n, pay=pay: (lambda k, ym: pay if k < n else 0.0))()
    cyc = simulate_cycles(base_land, 12, sched)
    short = [c for c in cyc if c["p50"] < CUSHION]
    tenor_rows.append({
        "tenor": label, "months": n, "monthly_payment": round(pay, 1), "total_paid": round(total), "cost_of_credit": round(total - PRICE),
        "eir_pct": 0.0 if r == 0 else EIR,
        "pti_today_pct": round((LAPTOP + pay) / NET_SALARY * 100, 1),
        "pti_after_laptop_pct": round(pay / NET_SALARY * 100, 1),
        "median_surplus_after_payment": round(median_surplus - pay),
        "cycles_short_at_median": [c["label"] for c in short][:12], "n_short_of_12": len(short),
        "cycles": cyc,
    })

# baseline (no phone) and what-ifs
baseline = simulate_cycles(base_land, 12, lambda k, ym: 0.0)
pledge_24 = simulate_cycles(base_land, 12, lambda k, ym: annuity(PRICE, RATE, 24), pledge=100)
pledge_base = simulate_cycles(base_land, 12, lambda k, ym: 0.0, pledge=100)
# what-if: start the 12-month plan in April 2027 (first payment in the cycle ending 10 May 2027, laptop finished 15 Mar)
pay12 = annuity(PRICE, RATE, 12)
whatif_april = simulate_cycles(base_land, 18, lambda k, ym: pay12 if (ym >= (2027, 5) and ym <= (2028, 4)) else 0.0)
whatif_april_rows = [c for c in whatif_april if c["cycle_end"] >= "2027-05"]
# what-if: pay 300 from Credo deposit up front, 900 over 12 months
pay900 = annuity(900, RATE, 12)
whatif_300 = simulate_cycles(base_land, 12, lambda k, ym: pay900)

# PTI cap line
PTI_CAP_PCT, PTI_CAP_GEL = 25, round(NET_SALARY * 0.25)

# lesson numbers
fixed_share = round(FIXED_TOTAL / NET_SALARY * 100)
compound = round(1000 * 1.1 ** 20); simple = 1000 + 1000 * 0.10 * 20
power_d = lambda n_per: round((1.96 + 0.84) * math.sqrt(2 / n_per), 2)

report = {
    "seed": SEED, "n_paths": N_PATHS, "today": TODAY, "payday": PAYDAY, "days_to_payday": DAYS_TO_PAYDAY,
    "balances": {"TBC": BAL_TBC, "BOG": BAL_BOG, "spendable": SPENDABLE, "credo_deposit_separate": CREDO_DEPOSIT},
    "fixed_streams": FIXED, "fixed_total": FIXED_TOTAL, "fixed_share_of_salary_pct": fixed_share,
    "due_before_payday": DUE_BEFORE_PAYDAY, "due_total": DUE_TOTAL,
    "daily_spend": {"avg_per_day": AVG_DAILY, "median_per_day": MEDIAN_DAILY, "spend_8_days_p10_p50_p90": [spend_p10, spend_p50, spend_p90], "monthly_variable_median": MONTHLY_VAR_MEDIAN},
    "cushion": {"days": CUSHION_DAYS, "gel": CUSHION, "rule": "3 x typical daily spend, rounded to 5 GEL; user-adjustable 2-7 days"},
    "landing_forecast": {"p10": land_p10, "p50": land_p50, "p90": land_p90, "p_below_cushion": round(p_below, 2), "weather": weather(p_below), "in_10_similar_months_below": round(p_below * 10), "runway_days": runway_days, "safe_to_spend_today": safe_today},
    "purchase_check_100": {"p10": buy_p10, "p50": buy_p50, "p90": buy_p90, "p_below_cushion": round(buy_p_below, 2), "weather": weather(buy_p_below), "in_10_similar_months_below": round(buy_p_below * 10), "days_of_spend_left": round(buy_p50 / AVG_DAILY, 1), "same_purchase_after_payday_landing_p50": round(after_payday_p50)},
    "median_monthly_surplus_no_pledge": median_surplus,
    "installment": {"price": PRICE, "rate_per_month": RATE, "eir_pct_at_1_5": EIR, "pti_cap_pct": PTI_CAP_PCT, "pti_cap_gel_from_2027_02_01": PTI_CAP_GEL, "pti_today_pct": round(LAPTOP / NET_SALARY * 100, 1), "tenors_ordered_by_term": tenor_rows},
    "baseline_no_phone": baseline,
    "whatif_start_april_12m": {"monthly_payment": round(pay12, 1), "cost_of_credit": round(pay12 * 12 - PRICE), "rows": whatif_april_rows, "n_short_at_median": sum(1 for c in whatif_april_rows if c["p50"] < CUSHION)},
    "whatif_300_from_deposit_12m": {"principal": 900, "monthly_payment": round(pay900, 1), "total": round(pay900 * 12), "cost_of_credit": round(pay900 * 12 - 900), "rows": whatif_300, "n_short_at_median": sum(1 for c in whatif_300 if c["p50"] < CUSHION), "foregone_deposit_interest_per_year_at_10pct": 30},
    "with_pledge_100": {"baseline_short": [c["label"] for c in pledge_base if c["p50"] < CUSHION], "tenor_24_short": [c["label"] for c in pledge_24 if c["p50"] < CUSHION]},
    "lesson_numbers": {"fixed_share_pct": fixed_share, "compound_1000_10pct_20y": compound, "simple_1000_10pct_20y": simple, "gap": compound - simple},
    "power": {"n150_d": power_d(75), "n300_d": power_d(150)},
}
json.dump(report, open(os.path.join(HERE, "engine_v0_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def fmt_cycles(rows):
    return " | ".join(f"{c['label']}: p50 {c['p50']} (p10 {c['p10']}) P<{CUSHION}={c['p_below_cushion']:.2f}" for c in rows)

print(f"TODAY {TODAY}; PAYDAY {PAYDAY}; {DAYS_TO_PAYDAY} days")
print(f"Spendable {SPENDABLE} (TBC {BAL_TBC} + BOG {BAL_BOG}); Credo deposit {CREDO_DEPOSIT} separate")
print(f"Fixed {FIXED_TOTAL} = {fixed_share}% of salary; due before payday {DUE_TOTAL}")
print(f"Daily spend avg {AVG_DAILY}, median {MEDIAN_DAILY}; 8-day spend p10/p50/p90 {spend_p10}/{spend_p50}/{spend_p90}; monthly variable median {MONTHLY_VAR_MEDIAN}")
print(f"Cushion {CUSHION} GEL ({CUSHION_DAYS} days)")
print(f"LANDING p10/p50/p90 {land_p10}/{land_p50}/{land_p90}; P(<cushion)={p_below:.2f} -> {weather(p_below)}; runway {runway_days} d; safe today {safe_today}")
print(f"BUY 100 today: p10/p50/p90 {buy_p10}/{buy_p50}/{buy_p90}; P(<cushion)={buy_p_below:.2f} -> {weather(buy_p_below)}; same purchase after payday -> landing ~{round(after_payday_p50)}")
print(f"Median monthly surplus (no pledge) {median_surplus}")
print(f"PTI today {LAPTOP/NET_SALARY*100:.1f}%; cap 25% = {PTI_CAP_GEL} GEL from 1 Feb 2027; EIR at 1.5%/m = {EIR}%")
for t in tenor_rows:
    print(f"\n{t['tenor']}: {t['monthly_payment']}/m, total {t['total_paid']}, cost {t['cost_of_credit']}, EIR {t['eir_pct']}%, PTI {t['pti_today_pct']}% (after laptop {t['pti_after_laptop_pct']}%), surplus after pay {t['median_surplus_after_payment']}; short at median in {t['n_short_of_12']} of 12: {t['cycles_short_at_median']}")
    print("   " + fmt_cycles(t["cycles"]))
print("\nBASELINE no phone: " + fmt_cycles(baseline))
print(f"\nWHAT-IF start Apr 2027, 12m {round(pay12,1)}/m cost {round(pay12*12-PRICE)}: short {report['whatif_start_april_12m']['n_short_at_median']} of 12")
print("   " + fmt_cycles(whatif_april_rows))
print(f"\nWHAT-IF 300 from deposit, 900 over 12m: {round(pay900,1)}/m, total {round(pay900*12)}, cost {round(pay900*12-900)}; short {report['whatif_300_from_deposit_12m']['n_short_at_median']} of 12")
print("   " + fmt_cycles(whatif_300))
print(f"\nWITH 100 GEL PLEDGE kept: baseline short {report['with_pledge_100']['baseline_short']}; 24m short {report['with_pledge_100']['tenor_24_short']}")
print(f"\nLesson: fixed share {fixed_share}%; compound 1000@10%x20y = {compound} vs simple {simple}, gap {compound-simple}")
print(f"Power: n=150 (75/arm) detects d>={power_d(75)}; n=300 detects d>={power_d(150)} (alpha .05, power .8)")
