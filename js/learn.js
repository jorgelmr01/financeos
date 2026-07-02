/* FinanceOS — Learn: interactive modules + Wealth Builder sandbox */
"use strict";

/* ============================== interactive widgets ==============================
   Small live calculators embedded in teach steps. Each renders sliders and
   recomputes its outputs on input (wired via the global 'input' listener). */

const WIDGETS = {
  compound: {
    html() { return this._wrap("compound", '<label>Monthly amount you invest <output data-o="m"></output></label><input type="range" data-k="m" min="50" max="1000" step="25" value="300">', '<div class="lw-out"><span>Stuffed in a drawer for 10 yrs <strong data-o="flat"></strong></span><span>Invested at 9% for 10 yrs <strong class="pos" data-o="inv"></strong></span><span class="lw-note" data-o="diff"></span></div>'); },
    update(el) {
      const m = +el.querySelector('[data-k="m"]').value;
      let v = 0; for (let i = 0; i < 10; i++) v = (v + m * 12) * 1.09;
      const flat = m * 120;
      this._set(el, { m: "$" + m, flat: "$" + Math.round(flat).toLocaleString(), inv: "$" + Math.round(v).toLocaleString(), diff: "Compounding added $" + Math.round(v - flat).toLocaleString() + " you never had to earn." });
    },
  },
  efund: {
    html() { return this._wrap("efund", '<label>Months of expenses saved <output data-o="m"></output></label><input type="range" data-k="m" min="0" max="12" step="1" value="1">', '<div class="lw-out"><div class="lw-bar"><div class="lw-fill" data-o-bar="b"></div></div><span class="lw-note" data-o="label"></span></div>'); },
    update(el) {
      const m = +el.querySelector('[data-k="m"]').value;
      const label = m < 1 ? "One surprise bill away from 40% APR debt." :
        m < 3 ? "Covers small bumps — a job loss still blows through it." :
        m <= 6 ? "Solid armor: job loss, medical, car — covered without debt." :
        "Very safe — but past ~6 months, extra cash starts losing to inflation. Invest the surplus.";
      el.querySelector('[data-o-bar="b"]').style.width = Math.min(100, m / 12 * 100) + "%";
      el.querySelector('[data-o-bar="b"]').style.background = m < 3 ? "var(--rose)" : m <= 6 ? "var(--mint)" : "var(--gold)";
      this._set(el, { m: m + " mo", label: label });
    },
  },
  raise: {
    html() { return this._wrap("raise", '<label>Share of every raise you save <output data-o="p"></output></label><input type="range" data-k="p" min="0" max="100" step="10" value="0">', '<div class="lw-out"><span>Extra wealth after 10 years of 5% yearly raises <strong class="pos" data-o="w"></strong></span><span class="lw-note">Starting salary $24,000/yr — lifestyle never shrinks, it only grows slower.</span></div>'); },
    update(el) {
      const p = +el.querySelector('[data-k="p"]').value / 100;
      let sal = 24000, pot = 0;
      for (let y = 1; y <= 10; y++) { sal *= 1.05; pot = pot * 1.09 + (sal - 24000) * p; }
      this._set(el, { p: Math.round(p * 100) + "%", w: "$" + Math.round(pot).toLocaleString() });
    },
  },
  minpay: {
    html() { return this._wrap("minpay", '<label>Monthly payment on a $1,000 balance at 40% APR <output data-o="p"></output></label><input type="range" data-k="p" min="35" max="500" step="5" value="45">', '<div class="lw-out"><span>Time to pay off <strong data-o="t"></strong></span><span>Total you pay <strong class="neg" data-o="tot"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const p = +el.querySelector('[data-k="p"]').value;
      let bal = 1000, months = 0, paid = 0;
      const r = 0.40 / 12;
      while (bal > 0 && months < 360) {
        const interest = bal * r;
        if (p <= interest) { months = -1; break; }
        bal += interest - p; paid += p; months++;
      }
      if (bal < 0) paid += bal;
      this._set(el, {
        p: "$" + p,
        t: months < 0 ? "never" : months > 24 ? Math.round(months / 12 * 10) / 10 + " years" : months + " months",
        tot: months < 0 ? "∞ — payment doesn't even cover interest" : "$" + Math.round(paid).toLocaleString(),
        note: months < 0 ? "Below ~$34/mo the balance grows forever." : p <= 50 ? "Minimum payments are designed to maximize what you pay." : p >= 300 ? "Aggressive payments starve the interest — this is the way." : "Every extra peso goes straight to principal.",
      });
    },
  },
  util: {
    html() { return this._wrap("util", '<label>Running balance on a $3,000-limit card <output data-o="b"></output></label><input type="range" data-k="b" min="0" max="3000" step="100" value="2400">', '<div class="lw-out"><div class="lw-bar"><div class="lw-fill" data-o-bar="f"></div></div><span class="lw-note" data-o="label"></span></div>'); },
    update(el) {
      const b = +el.querySelector('[data-k="b"]').value;
      const u = b / 3000;
      const fill = el.querySelector('[data-o-bar="f"]');
      fill.style.width = (u * 100).toFixed(0) + "%";
      fill.style.background = u >= 0.7 ? "var(--rose)" : u >= 0.3 ? "var(--gold)" : "var(--mint)";
      this._set(el, { b: "$" + b.toLocaleString(), label: Math.round(u * 100) + "% utilization — " + (u >= 0.7 ? "lenders read this as distress; expect score damage." : u >= 0.3 ? "above the recommended zone; pay down before the cut date." : "healthy. This is what good credit looks like.") });
    },
  },
  cutdue: {
    html() { return this._wrap("cutdue", '<label>Day of month you buy (statement cuts the 14th) <output data-o="d"></output></label><input type="range" data-k="d" min="1" max="30" step="1" value="13">', '<div class="lw-out"><span>Interest-free days before payment is due <strong data-o="f"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const d = +el.querySelector('[data-k="d"]').value;
      const float = d <= 14 ? 34 - d : 64 - d;
      this._set(el, { d: "day " + d, f: float + " days", note: d === 15 ? "Maximum float — the day right after the cut." : d <= 14 ? "This lands on the statement about to close — short float." : "Decent float; one day earlier (the 15th) is the sweet spot." });
    },
  },
  horizon: {
    html() { return this._wrap("horizon", '<label>Years you stay invested in a broad index <output data-o="y"></output></label><input type="range" data-k="y" min="1" max="30" step="1" value="1">', '<div class="lw-out"><span>Historical odds of losing money <strong data-o="odds"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const y = +el.querySelector('[data-k="y"]').value;
      const odds = Math.max(0.1, 26 * Math.exp(-0.18 * (y - 1)));
      this._set(el, { y: y + " yr", odds: odds < 1 ? "<1%" : Math.round(odds) + "%", note: y < 3 ? "Short horizons are coin flips — that's why house-money doesn't belong here." : y < 10 ? "Risk falls fast as years pass. Time diversifies." : "Over long horizons, the diversified market has essentially always paid patience." });
    },
  },
  bestdays: {
    html() { return this._wrap("bestdays", '<label>Best market days you miss over 20 years <output data-o="n"></output></label><input type="range" data-k="n" min="0" max="40" step="5" value="0">', '<div class="lw-out"><span>$10,000 grows to <strong data-o="v"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const n = +el.querySelector('[data-k="n"]').value;
      const mult = Math.max(0.9, 6 * Math.exp(-0.07 * n));
      this._set(el, { n: n + " days", v: "$" + Math.round(10000 * mult).toLocaleString(), note: n === 0 ? "Fully invested, through every scary headline." : n <= 10 ? "The best days cluster right after crashes — sellers miss them." : "Most of two decades of growth, gone. This is the cost of jumping in and out." });
    },
  },
  divers: {
    html() { return this._wrap("divers", '<label>Number of positions you hold <output data-o="n"></output></label><input type="range" data-k="n" min="1" max="30" step="1" value="1">', '<div class="lw-out"><span>If one company implodes (−80%), your portfolio takes <strong class="neg" data-o="hit"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const n = +el.querySelector('[data-k="n"]').value;
      const hit = 80 / n;
      this._set(el, { n: n + (n === 1 ? " position" : " positions"), hit: "−" + (hit >= 10 ? Math.round(hit) : hit.toFixed(1)) + "%", note: n === 1 ? "All eggs, one basket. One bad earnings call can erase years." : n < 10 ? "Better — single failures sting but don't sink you." : "One blow-up barely registers. An index fund holds hundreds." });
    },
  },
  rule72: {
    html() { return this._wrap("rule72", '<label>Inflation rate <output data-o="r"></output></label><input type="range" data-k="r" min="1" max="15" step="0.5" value="4">', '<div class="lw-out"><span>Prices double (cash halves) every <strong data-o="y"></strong></span><span>$10,000 idle for 18 yrs buys what <strong class="neg" data-o="v"></strong> buys today</span></div>'); },
    update(el) {
      const r = +el.querySelector('[data-k="r"]').value;
      this._set(el, { r: r + "%", y: (72 / r).toFixed(1) + " years", v: "$" + Math.round(10000 / Math.pow(1 + r / 100, 18)).toLocaleString() });
    },
  },
  real: {
    html() { return this._wrap("real", '<label>Your account\'s APY <output data-o="a"></output></label><input type="range" data-k="a" min="0" max="15" step="0.5" value="7"><label>Inflation <output data-o="i"></output></label><input type="range" data-k="i" min="0" max="12" step="0.5" value="4">', '<div class="lw-out"><span>Real return (actual purchasing power gained) <strong data-o="rr"></strong></span><span class="lw-note" data-o="note"></span></div>'); },
    update(el) {
      const a = +el.querySelector('[data-k="a"]').value, i = +el.querySelector('[data-k="i"]').value;
      const rr = ((1 + a / 100) / (1 + i / 100) - 1) * 100;
      const out = el.querySelector('[data-o="rr"]');
      out.textContent = (rr >= 0 ? "+" : "") + rr.toFixed(1) + "%";
      out.className = rr >= 0 ? "pos" : "neg";
      this._set(el, { a: a + "%", i: i + "%", note: rr < 0 ? "The bank pays you while inflation robs you — a losing account dressed as a winning one." : rr < 2 ? "Barely ahead. Big-bank 0.1% accounts live deep in negative territory." : "Genuinely growing. Always judge rates against inflation, never alone." });
    },
  },
};
/* shared helpers for widgets */
WIDGETS.compound._wrap = WIDGETS.efund._wrap = WIDGETS.raise._wrap = WIDGETS.minpay._wrap =
WIDGETS.util._wrap = WIDGETS.cutdue._wrap = WIDGETS.horizon._wrap = WIDGETS.bestdays._wrap =
WIDGETS.divers._wrap = WIDGETS.rule72._wrap = WIDGETS.real._wrap = function (id, controls, outputs) {
  return '<div class="lw" data-lw="' + id + '">' + controls + outputs + "</div>";
};
WIDGETS.compound._set = WIDGETS.efund._set = WIDGETS.raise._set = WIDGETS.minpay._set =
WIDGETS.util._set = WIDGETS.cutdue._set = WIDGETS.horizon._set = WIDGETS.bestdays._set =
WIDGETS.divers._set = WIDGETS.rule72._set = WIDGETS.real._set = function (el, map) {
  Object.keys(map).forEach(k => { const o = el.querySelector('[data-o="' + k + '"]'); if (o) o.innerHTML = map[k]; });
};

/* ============================== module data ==============================
   Step kinds: teach (concept + live widget), decide (choices with points/impact),
   quiz (one right answer). Scores normalize to /100. */

const SCENARIOS = [
  {
    id: "paycheck", icon: "⛁", title: "The First Paycheck",
    tagline: "Where your money goes before you notice",
    intro: "Your first real job pays $1,800 a month. The habits you set in the next four steps quietly compound for a decade.",
    steps: [
      { kind: "teach", title: "Pay yourself first", widget: "compound",
        body: "Savings that wait until month-end average close to zero — spending expands to fill whatever space it's given. The fix is mechanical, not moral: move money out <em>the moment it arrives</em>. Drag the slider and watch what an automatic transfer becomes." },
      { kind: "decide", situation: "Payday. $1,800 hits your account. What's your very first move?",
        choices: [
          { text: "Transfer 20% to savings automatically, before touching the rest", points: 25, impact: 52000,
            feedback: "Pay yourself first. When saving happens before spending, it's never 'whatever's left' — and $360/mo invested at ~9% becomes roughly $70,000 in 10 years." },
          { text: "Pay bills, live my life, save whatever's left at month-end", points: 10, impact: 9000,
            feedback: "Backwards budgeting. 'Whatever's left' averages close to zero. Flip the order and the saving takes care of itself." },
          { text: "First paychecks are for celebrating — saving starts next month", points: 0, impact: 0,
            feedback: "'Next month' is how lifestyles grow to eat every peso of income. Compounding rewards only the early." },
        ] },
      { kind: "teach", title: "Your financial airbag", widget: "efund",
        body: "Before chasing returns, you need armor: an <strong>emergency fund</strong>. Its job isn't growth — it's keeping life's surprises from becoming 40% APR credit-card debt. Slide to see how much protection each month of saved expenses buys." },
      { kind: "decide", situation: "So how big should the emergency fund be before you relax?",
        choices: [
          { text: "3–6 months of expenses", points: 25, impact: 30000,
            feedback: "Exactly. 3–6 months covers job loss, medical surprises and car disasters — the events that otherwise become high-interest debt." },
          { text: "One month is plenty", points: 10, impact: 8000,
            feedback: "One month softens small bumps, but a job loss blows straight through it — and then the credit card takes over." },
          { text: "My credit card IS my emergency fund", points: 0, impact: -25000,
            feedback: "An emergency paid at 40% APR becomes a bigger emergency. A $5,000 surprise on minimum payments can cost over $10,000." },
        ] },
      { kind: "quiz", question: "Quick check: where should that emergency fund live?",
        options: ["A high-yield savings account", "Index funds, so it grows", "Checking — it's right there"], answer: 0,
        explain: "Liquid, safe, and earning real interest. Index funds can be down 25% exactly when your car dies; checking pays ~0% while inflation eats it. In FinanceOS, set the APY on the account and the interest engine projects it." },
      { kind: "teach", title: "The raise that disappears", widget: "raise",
        body: "Most people earn dramatically more at 35 than at 25 — and own barely more. The culprit is <strong>lifestyle inflation</strong>: every raise instantly absorbed by a nicer apartment, car, everything. You already lived fine yesterday. Drag the slider: what happens if you bank part of every raise instead?" },
      { kind: "decide", situation: "One year in, you get a 20% raise. What changes?",
        choices: [
          { text: "Lifestyle stays put — the entire raise goes to savings and investments", points: 25, impact: 65000,
            feedback: "Beating lifestyle inflation is a superpower — banking raises is the fastest wealth accelerator that exists." },
          { text: "Half the raise upgrades my life, half gets saved", points: 15, impact: 32000,
            feedback: "A solid compromise — enjoying progress is healthy. Just make the saved half automatic before the lifestyle half finds it." },
          { text: "Finally! Better apartment, better car — I earned this", points: 0, impact: 0,
            feedback: "100% lifestyle inflation: income up, wealth unchanged. This is how people triple their salary and still live paycheck to paycheck." },
        ] },
      { kind: "quiz", question: "Automating transfers on payday works mainly because…",
        options: ["It removes willpower from the equation entirely", "Banks pay higher interest on automatic transfers", "It avoids transfer fees"], answer: 0,
        explain: "Discipline is unreliable; systems aren't. The transfer happens before you wake up tempted — the single highest-leverage money habit there is." },
    ],
    takeaways: [
      "Pay yourself first — automate savings before any spending happens.",
      "Build 3–6 months of expenses in a high-yield savings account.",
      "Emergency money and growth money have different jobs — don't mix them.",
      "Bank your raises: avoiding lifestyle inflation outbuilds any stock pick.",
    ],
  },
  {
    id: "cards", icon: "▭", title: "The Credit Card Trap",
    tagline: "A tool that's either free or ferociously expensive",
    intro: "Your first credit card arrives: $3,000 limit, 40% APR. Used well it's free float and a credit score. Used badly, it's the most expensive money you'll ever touch.",
    steps: [
      { kind: "teach", title: "The minimum payment machine", widget: "minpay",
        body: "Carry a balance and interest compounds <em>against</em> you at rates no investment can match. The 'minimum payment' is calibrated to keep you paying as long as legally possible. Drag the payment slider on a $1,000 balance and watch the trap open and close." },
      { kind: "decide", situation: "You want a $1,000 TV. You have $400 in cash. The card is right there…",
        choices: [
          { text: "Wait two months and save up the difference", points: 25, impact: 15000,
            feedback: "Same TV, zero interest. The habit matters more than the $1,000 — people who can wait two months retire wealthier." },
          { text: "Buy it now, pay it off over 3 months", points: 12, impact: 2000,
            feedback: "Contained damage — a few months of interest. But notice the pattern forming: wants arriving before the money does." },
          { text: "Buy it now, pay the minimum each month", points: 0, impact: -18000,
            feedback: "You just saw the widget: at 40% APR, minimums stretch a $1,000 TV into ~$1,900 over five years." },
        ] },
      { kind: "decide", situation: "Statement arrives: balance $900, minimum payment $45. What do you pay?",
        choices: [
          { text: "The full $900 before the due date", points: 25, impact: 20000,
            feedback: "Paid in full inside the grace period = the bank lent you money for free. The only way to play where you win and they don't." },
          { text: "Half now, half next month", points: 10, impact: -3000,
            feedback: "Better than minimums — but interest starts the moment any balance carries over, charged on the average daily balance." },
          { text: "The minimum — that's what it's for, right?", points: 0, impact: -22000,
            feedback: "At 40% APR, $45 barely covers the interest. The balance hardly moves while the bank collects." },
        ] },
      { kind: "teach", title: "Utilization: the silent score-maker", widget: "util",
        body: "Your credit score watches one ratio obsessively: <strong>balance ÷ limit</strong>. High utilization reads as distress even if you pay on time — and your score decides every future loan rate you'll ever get. Slide your balance around and watch the zones (FinanceOS colors your real cards the same way)." },
      { kind: "quiz", question: "For a healthy score, keep utilization under…",
        options: ["30% of the limit", "50% of the limit", "It doesn't matter if you pay on time"], answer: 0,
        explain: "Under 30% — and lower is better. Utilization is one of the biggest score factors, and the score later prices your mortgage and car loan. Expensive in slow motion." },
      { kind: "teach", title: "The calendar game", widget: "cutdue",
        body: "Two dates rule every card: the <strong>cut</strong> (statement closes) and the <strong>due date</strong> (pay deadline). Buy right <em>after</em> the cut and you ride the longest interest-free float the card can give. Slide your purchase day and watch the free days move." },
      { kind: "decide", situation: "Your card's cut date is the 14th. You're buying a $600 flight. When?",
        choices: [
          { text: "The 15th — right after the statement cuts", points: 25, impact: 5000,
            feedback: "Sharp — the longest interest-free window, up to ~49 days. FinanceOS counts down both dates per card." },
          { text: "The 13th — right before the cut", points: 5, impact: 0,
            feedback: "It lands on the statement that's about to close, so payment is due in days. Same flight, shortest float." },
          { text: "Whenever — dates are the bank's problem", points: 0, impact: -2000,
            feedback: "The cut/due rhythm IS the game. Ignore it and you randomly give up float — or miss due dates entirely." },
        ] },
      { kind: "decide", situation: "A store offers the new phone at 12 months, no interest (MSI). You have the cash to buy it outright.",
        choices: [
          { text: "Take the MSI, keep my cash earning interest, autopay every installment", points: 25, impact: 4000,
            feedback: "Free financing used with discipline: your money keeps compounding while the store waits. The catch — one missed installment usually triggers brutal retroactive interest, so automate it." },
          { text: "Just pay cash — simpler is safer", points: 15, impact: 1000,
            feedback: "Perfectly fine. You give up a small float gain in exchange for zero risk of missed-installment penalties. Discipline you don't need is discipline that can't fail." },
          { text: "Take the MSI on a phone I couldn't actually afford in cash", points: 0, impact: -8000,
            feedback: "MSI's dark side: it makes unaffordable things feel affordable. If you couldn't buy it outright, the installments are claiming income you haven't earned yet." },
        ] },
      { kind: "quiz", question: "A minimum payment on a high-APR card mostly covers…",
        options: ["Interest — the balance barely moves", "Principal — the debt shrinks steadily", "Annual fees"], answer: 0,
        explain: "You saw it in the widget: at 40% APR on $1,000, about $33 of a $45 minimum is pure interest. Minimums protect your credit score, not your wealth." },
    ],
    takeaways: [
      "Always pay the full statement balance — the grace period makes credit free.",
      "Minimum payments are a product designed against you.",
      "Keep utilization under 30% — your future loan rates depend on it.",
      "Know your cut and due dates; buy right after the cut for maximum float.",
      "MSI is a tool for people who could pay cash — and a trap for those who can't.",
    ],
  },
  {
    id: "market", icon: "◮", title: "Market Rollercoaster",
    tagline: "Why time beats timing, every time",
    intro: "You invested $10,000 in a diversified index fund. The market is about to test your nerves — which is where most returns are actually won or lost.",
    steps: [
      { kind: "teach", title: "Risk is a function of time", widget: "horizon",
        body: "A diversified index is terrifying over months and astonishingly reliable over decades. The same asset! Drag the years slider and watch the odds of loss collapse — this single chart is why <em>horizon</em> matters more than <em>timing</em>." },
      { kind: "decide", situation: "Three red months: the market drops 25%. Your $10,000 shows $7,500. What now?",
        choices: [
          { text: "Hold — and keep my automatic monthly buys running", points: 25, impact: 48000,
            feedback: "Crashes are when shares go on sale. The rebound days cluster right after the falls — only the invested catch them." },
          { text: "Pause contributions until things look clearer", points: 10, impact: 12000,
            feedback: "'Clarity' only ever arrives after prices have recovered. Waiting for it means systematically buying high." },
          { text: "Sell everything before it gets worse", points: 0, impact: -35000,
            feedback: "Selling converts a temporary dip into a permanent loss. Panic-sellers in 2008 and 2020 who 'waited for safety' missed historic rebounds." },
        ] },
      { kind: "teach", title: "The cost of jumping in and out", widget: "bestdays",
        body: "Market timing has a brutal math problem: the best days are violently concentrated — and they hide right next to the worst ones, usually just after a crash. Slide to see what missing a handful of days does to 20 years of growth." },
      { kind: "quiz", question: "Missing just the 10 best market days over 20 years roughly…",
        options: ["Halves your final return", "Costs you a few percent", "Makes no difference long-term"], answer: 0,
        explain: "And those days overwhelmingly land right after big drops — exactly when scared money is sitting on the sidelines. Staying invested is the strategy." },
      { kind: "teach", title: "Don't bet the portfolio on one story", widget: "divers",
        body: "Every concentrated fortune you've heard of is a survivor — the wiped-out ones don't give interviews. Slide the number of positions and watch what a single −80% implosion does to you. This is all diversification is: making any one disaster boring." },
      { kind: "decide", situation: "Your friend's favorite stock doubled last year. He says index funds are for cowards. You…",
        choices: [
          { text: "Keep the index core; allow up to 5–10% as 'fun money' picks", points: 25, impact: 20000,
            feedback: "Core-and-satellite: the boring 90% compounds reliably while the fun 10% scratches the itch without being able to sink you." },
          { text: "Never touch individual stocks, ever", points: 15, impact: 14000,
            feedback: "Perfectly rational — pure indexing beats most professionals. A tiny fun allocation is mostly psychology insurance." },
          { text: "Go big — his last pick doubled!", points: 0, impact: -30000,
            feedback: "You just saw the widget: one position means one bad earnings call erases years. Hot streaks make headlines; the silent majority of hot picks implode." },
        ] },
      { kind: "decide", situation: "You're saving for a house down payment you'll need in about a year. Invest it in stocks?",
        choices: [
          { text: "No — money needed within 1–2 years belongs in savings", points: 25, impact: 15000,
            feedback: "Match the horizon: you saw the odds — one year is a coin flip you can't afford with the house on the line." },
          { text: "Half stocks, half savings", points: 10, impact: 3000,
            feedback: "Half the mismatch is still a mismatch — a bad year forces you to sell low or postpone the house." },
          { text: "Yes — stocks return more than savings accounts", points: 0, impact: -20000,
            feedback: "True on average, brutal on deadlines. The market 'averages' 9% while regularly dropping 30% in a single bad year." },
        ] },
      { kind: "quiz", question: "Money you'll need in 18 months belongs in…",
        options: ["High-yield savings — boring and guaranteed", "A diversified index fund", "Whatever's been going up lately"], answer: 0,
        explain: "Stocks are for 5+ year money. Short-term goals want certainty, not expected value — sequence risk doesn't care about averages." },
      { kind: "decide", situation: "How often should you check and adjust your portfolio?",
        choices: [
          { text: "Automate buys, glance quarterly, rebalance yearly", points: 25, impact: 18000,
            feedback: "Investing is the rare game where less activity earns more. Automation removes emotion — the most expensive ingredient in any portfolio." },
          { text: "Never look at it again", points: 12, impact: 8000,
            feedback: "Close! Benign neglect beats overtrading, but a yearly check keeps your mix on target — your FinanceOS portfolio needs ~5 minutes a quarter." },
          { text: "Daily — and act on every move", points: 0, impact: -15000,
            feedback: "Checking daily turns noise into anxiety and anxiety into trades. The most active retail traders earn the worst returns." },
        ] },
    ],
    takeaways: [
      "Time in the market beats timing the market — stay invested through crashes.",
      "The best days cluster right after the worst ones; sellers miss them.",
      "Diversify: index core, at most 5–10% in individual picks.",
      "Match money to horizon: stocks for 5+ years, savings for soon.",
      "Automate and ignore the noise — activity is the enemy of returns.",
    ],
  },
  {
    id: "inflation", icon: "❋", title: "The Silent Thief",
    tagline: "Inflation eats cash that isn't working",
    intro: "Your grandmother proudly kept $10,000 'safe' under the mattress since 2004. It's still $10,000 — and that's exactly the problem.",
    steps: [
      { kind: "teach", title: "The Rule of 72", widget: "rule72",
        body: "Inflation compounds exactly like interest — just against you. The shortcut: <strong>72 ÷ inflation rate = years for prices to double</strong> (and your idle cash to halve). Drag the rate and watch grandma's mattress money evaporate in slow motion." },
      { kind: "quiz", question: "So at 4% inflation, what does that 2004 mattress-money actually buy ~18 years later?",
        options: ["About half of what it used to", "The same — $10,000 is $10,000", "Maybe 10% less"], answer: 0,
        explain: "72/4 = 18 years to halve. The number on the bills never changes; the groceries they buy do. Nominal vs real is the most expensive confusion in personal finance." },
      { kind: "teach", title: "Real vs nominal", widget: "real",
        body: "Banks advertise <em>nominal</em> rates; life charges <em>real</em> ones. Your true return is what's left after inflation takes its cut. Set both sliders and find out whether an account actually makes you richer — some 'savings' accounts are quietly losing machines." },
      { kind: "quiz", question: "Savings pay 7% APY while inflation runs 4%. Your REAL return is…",
        options: ["About 3%", "7% — that's what the bank pays", "Negative — inflation beats any account"], answer: 0,
        explain: "Real ≈ nominal − inflation. Only 3 of those 7 points made you genuinely richer — and a big-bank 0.1% account in the same world loses ~4% a year while calling itself savings." },
      { kind: "decide", situation: "For money you won't touch for 20 years, the best inflation defense is…",
        choices: [
          { text: "A broad stock index fund", points: 25, impact: 40000,
            feedback: "Businesses raise their prices with inflation — owning them means owning the price increases. Stocks have outpaced inflation over every 20-year span in modern history." },
          { text: "Cash — flexible and safe", points: 0, impact: -20000,
            feedback: "You just ran the widget: at 4%, twenty idle years cost ~56% of purchasing power. For long horizons, 'safe' cash is the riskiest asset." },
          { text: "Keep it in checking and just earn more at work", points: 5, impact: -8000,
            feedback: "Earning more is great offense, but it doesn't protect what you've already earned. Defense and offense are separate jobs." },
        ] },
      { kind: "decide", situation: "Inflation is 5% this year. Your boss proudly offers a 2% raise. You…",
        choices: [
          { text: "Negotiate, citing inflation: 2% nominal is a 3% real pay CUT", points: 25, impact: 25000,
            feedback: "Framing raises in real terms is both true and persuasive. Compounded over a career, recovering those 3 points is worth six figures." },
          { text: "Accept happily — a raise is a raise", points: 0, impact: -15000,
            feedback: "You just agreed to do the same job for 3% less purchasing power. Inflation makes 'a raise' and 'more money' different things." },
          { text: "Quit dramatically on the spot", points: 5, impact: -5000,
            feedback: "Right instinct about real pay, wrong execution — negotiate first, and job-hop with an offer in hand." },
        ] },
      { kind: "decide", situation: "Your medium-term fund (needed in ~3 years) sits in a checking account at 0%. Inflation is 4%.",
        choices: [
          { text: "Move it to high-yield savings / government bills at ~7%", points: 25, impact: 9000,
            feedback: "Same safety, same liquidity, +7 points of yield — this is the closest thing to free money in personal finance. In FinanceOS, set the APY and watch the interest engine count it." },
          { text: "Leave it — moving money is a hassle", points: 0, impact: -5000,
            feedback: "That 'hassle' costs ~11% of purchasing power over 3 years (0% earned, 4% inflation). Twenty minutes of paperwork, thousands of pesos." },
          { text: "Put it all in stocks to beat inflation properly", points: 5, impact: -3000,
            feedback: "Right enemy, wrong weapon — 3 years is too short for stock risk. High-yield savings beats inflation here without the coin flip." },
        ] },
      { kind: "quiz", question: "Which of these is hurt MOST by 20 years of inflation?",
        options: ["Cash in a drawer", "A broad index fund", "A salary renegotiated every year"], answer: 0,
        explain: "Idle cash takes the full hit — no yield, no repricing. Businesses reprice with inflation; renegotiated salaries chase it. The drawer just loses." },
    ],
    takeaways: [
      "Rule of 72: 72 ÷ inflation rate = years for prices to double.",
      "Real return = nominal − inflation. Judge everything in real terms.",
      "Long-term money must outgrow inflation — broad stock indexes historically do.",
      "Idle cash in checking is a slow leak — high-yield savings is near-free money.",
      "Negotiate salaries in real terms: a raise below inflation is a pay cut.",
    ],
  },
];

function scenarioMaxScore(sc) {
  return sc.steps.reduce((a, st) => a + (st.kind === "decide" ? 25 : st.kind === "quiz" ? 15 : 0), 0);
}

/* ============================== XP & levels ============================== */

const LEARN_LEVELS = [
  { xp: 0, name: "Rookie" }, { xp: 80, name: "Saver" }, { xp: 180, name: "Budgeter" },
  { xp: 300, name: "Investor" }, { xp: 440, name: "Strategist" }, { xp: 580, name: "Money Master" },
];

function sandboxXP(best) {
  if (best >= 400000) return 150;
  if (best >= 250000) return 100;
  if (best >= 100000) return 50;
  if (best > 0) return 20;
  return 0;
}

function learnXP() {
  const L = Store.state.learn || { scenarios: {}, sandbox: { best: 0 } };
  let xp = 0;
  SCENARIOS.forEach(s => { xp += (L.scenarios[s.id] && L.scenarios[s.id].best) || 0; });
  xp += sandboxXP(L.sandbox.best || 0);
  return xp;
}

function learnLevel(xp) {
  let cur = LEARN_LEVELS[0], next = null;
  for (let i = 0; i < LEARN_LEVELS.length; i++) {
    if (xp >= LEARN_LEVELS[i].xp) cur = LEARN_LEVELS[i];
    else { next = LEARN_LEVELS[i]; break; }
  }
  return { cur, next };
}

/* ============================== sandbox events ==============================
   A shuffled 20-year deck. Most years interrupt with a decision; choices have
   real consequences applied by resolve(). */

const SB_EVENTS = {
  emergency: {
    gen: () => ({ cost: 4000 + Math.round(Math.random() * 5000) }),
    title: p => "Emergency: " + ["the transmission dies", "a root canal won't wait", "your laptop + deposit disaster"][Math.floor(Math.random() * 3)] + " — " + Learn._f(p.cost),
    desc: () => "Life sent the bill. How do you cover it?",
    choices: p => [
      { id: "liquid", label: "Pay from cash & savings", hint: "what buffers are for" },
      { id: "sell", label: "Sell investments to cover it", hint: "locks in whatever the market's doing" },
      { id: "card", label: "Put it on the credit card", hint: "40% APR starts now" },
    ],
    resolve(choice, s, p) {
      if (choice === "liquid") {
        let rem = p.cost;
        const c = Math.min(s.cash, rem); s.cash -= c; rem -= c;
        const sv = Math.min(s.savings, rem); s.savings -= sv; rem -= sv;
        if (rem > 0) { s.debt += rem; s.everDebt = true; return { cls: "warn", text: "Buffers covered " + Learn._f(p.cost - rem) + "; the last " + Learn._f(rem) + " became 40% debt. Bigger cushion next time." }; }
        return { cls: "good", text: "Paid in full from your buffer — zero debt, zero sold investments. THIS is why the emergency fund exists." };
      }
      if (choice === "sell") {
        let rem = p.cost;
        const ix = Math.min(s.index, rem); s.index -= ix; rem -= ix;
        const h = Math.min(s.hot, rem); s.hot -= h; rem -= h;
        if (rem > 0) { const c = Math.min(s.cash + s.savings, rem); if (s.cash >= c) s.cash -= c; else { rem -= s.cash; s.cash = 0; s.savings -= rem; } }
        s.soldForEmergency = true;
        return { cls: "warn", text: "Sold " + Learn._f(p.cost) + " of investments — compounding interrupted, and if the market was down you just locked the loss." };
      }
      s.debt += p.cost; s.everDebt = true;
      return { cls: "danger", text: Learn._f(p.cost) + " on the card at 40% APR. This debt now compounds faster than anything you own." };
    },
  },
  crash: {
    gen: () => ({}),
    title: () => "MARKET CRASH",
    desc: s => "Index −35%, speculative −60%. Your portfolio is a sea of red and the news says it's over. What do you do?",
    choices: () => [
      { id: "hold", label: "Hold everything, change nothing", hint: "time in the market" },
      { id: "dip", label: "Buy the dip with half your cash", hint: "shares are on sale" },
      { id: "panic", label: "Sell it all — protect what's left", hint: "lock it in" },
    ],
    resolve(choice, s) {
      if (choice === "hold") { s.reboundBias = true; return { cls: "good", text: "You held. Historically the strongest days come right after crashes — you're positioned to catch them." }; }
      if (choice === "dip") {
        const mv = s.cash * 0.5; s.cash -= mv; s.index += mv; s.reboundBias = true; s.boughtDip = true;
        return { cls: "good", text: "Moved " + Learn._f(mv) + " into the index at crash prices. Brave — and historically, very well paid." };
      }
      s.cash += s.index + s.hot; s.index = 0; s.hot = 0; s.soldBottom = true;
      return { cls: "danger", text: "Sold at the bottom. The loss is now permanent, and the rebound — whenever it comes — happens without you." };
    },
  },
  bull: {
    gen: () => ({}),
    title: () => "Bull run!",
    desc: () => "Index +28%, speculative +70%. Everyone's a genius, your barber has stock tips. What do you do with your index gains?",
    choices: () => [
      { id: "ride", label: "Stay the course — rebalance, don't celebrate", hint: "discipline" },
      { id: "profit", label: "Move half the index to savings", hint: "de-risk" },
      { id: "yolo", label: "Move half the index into the hot stock", hint: "momentum!" },
    ],
    resolve(choice, s) {
      if (choice === "ride") return { cls: "good", text: "No victory lap, no changes. Bull markets reward the same behavior bear markets do: boring consistency." };
      if (choice === "profit") { const mv = s.index * 0.5; s.index -= mv; s.savings += mv; return { cls: "info", text: "Took " + Learn._f(mv) + " off the table into savings. Lower risk, lower ceiling — a fair trade if you sleep better." }; }
      const mv = s.index * 0.5; s.index -= mv; s.hot += mv;
      return { cls: "warn", text: "Chased the heat with " + Learn._f(mv) + ". Buying what already ran is how bulls turn into bagholders — we'll see." };
    },
  },
  tip: {
    gen: () => ({}),
    title: () => "A 'sure thing'",
    desc: () => "Your cousin is ALL-IN on a coin that 'can only go up'. He's up 40% this month and won't stop talking about it.",
    choices: () => [
      { id: "no", label: "Pass — my plan doesn't have a meme-coin slot", hint: "boring wins" },
      { id: "small", label: "Throw in 10% of your cash — fun money", hint: "contained" },
      { id: "fomo", label: "Go heavy: half your cash", hint: "he's UP 40%!" },
    ],
    resolve(choice, s) {
      if (choice === "no") return { cls: "good", text: "Passed. Most 'sure things' are survivorship bias with a group chat. Your plan doesn't need them." };
      const frac = choice === "small" ? 0.10 : 0.50;
      const stake = s.cash * frac; s.cash -= stake;
      if (Math.random() < 0.25) { const win = stake * 3; s.cash += stake + win; return { cls: "good", text: "It 4x'd! You made " + Learn._f(win) + ". Enjoy it — and know that this exact win is how gambling habits get funded." }; }
      s.tipLost = (s.tipLost || 0) + stake;
      return { cls: "danger", text: "It rugged. " + Learn._f(stake) + " gone. The 25% who win tell everyone; the 75% who lose go quiet." };
    },
  },
  job: {
    gen: () => ({}),
    title: () => "Job offer: +30% salary",
    desc: () => "A hot startup wants you — 30% more pay. It's exciting, well-funded… and startups fold. Your current job is stable.",
    choices: () => [
      { id: "stay", label: "Stay — steady raises, zero drama", hint: "safe" },
      { id: "jump", label: "Take the jump", hint: "risk: it could fold" },
    ],
    resolve(choice, s) {
      if (choice === "stay") return { cls: "info", text: "Stayed put. No wrong answer here — but income growth is the biggest wealth lever; keep an eye on your market value." };
      s.salary = Math.round(s.salary * 1.3); s.jobRisk = 2;
      return { cls: "warn", text: "Jumped! Salary now " + Learn._f(s.salary) + "/yr. Risk is real for the next couple of years — keep that emergency fund tight." };
    },
  },
  windfall: {
    gen: () => ({ amt: 2500 + Math.round(Math.random() * 3500) }),
    title: p => "Windfall: " + Learn._f(p.amt),
    desc: () => "Bonus season! Found money is where plans are made or broken — most windfalls evaporate within months.",
    choices: () => [
      { id: "invest", label: "Straight into this year's strategy", hint: "invisible money compounds" },
      { id: "split", label: "Half fun, half invested", hint: "balanced" },
      { id: "spend", label: "Treat yourself — all of it", hint: "you only live once" },
    ],
    resolve(choice, s, p) {
      if (choice === "invest") { s.index += p.amt; return { cls: "good", text: "All " + Learn._f(p.amt) + " invested before it could whisper 'vacation'. Windfalls you never see are windfalls you keep." }; }
      if (choice === "split") { s.index += p.amt / 2; s.happy = Math.min(100, s.happy + 8); return { cls: "info", text: "Half enjoyed, half invested. Sustainable — a plan you enjoy is a plan you keep." }; }
      s.happy = Math.min(100, s.happy + 15);
      return { cls: "warn", text: "Great month! Worth remembering: spent windfalls feel identical to no windfall by next quarter." };
    },
  },
  recession: {
    gen: () => ({}),
    title: () => "Recession year",
    desc: () => "The economy stalls: salaries frozen, headlines grim. Your move?",
    choices: () => [
      { id: "hustle", label: "Start a side hustle (+$4,000/yr, costs energy)", hint: "offense" },
      { id: "cut", label: "Cut lifestyle hard, save the difference", hint: "defense" },
      { id: "ride", label: "Ride it out, change nothing", hint: "steady" },
    ],
    resolve(choice, s) {
      s.raiseFreeze = 2;
      if (choice === "hustle") { s.sideHustle = 2; s.happy = Math.max(0, s.happy - 8); return { cls: "info", text: "Side hustle running: +$4,000/yr for two years. Income diversification is real resilience — watch the burnout." }; }
      if (choice === "cut") { s.cash += 2000; s.happy = Math.max(0, s.happy - 5); return { cls: "info", text: "Belt tightened: +$2,000 to cash. Recessions reward people whose lifestyles have slack in them." }; }
      return { cls: "info", text: "Held steady. Salaries freeze; your automatic savings didn't. That's the system doing its job." };
    },
  },
  vacation: {
    gen: () => ({}),
    title: () => "Friends are planning the trip of the year",
    desc: () => "Two weeks, " + Learn._f(2500) + " all-in. Your savings plan says no; your group chat says yes.",
    choices: () => [
      { id: "go", label: "Go — memories compound too", hint: "−$2,500, +joy" },
      { id: "budget", label: "Counter-propose a budget version", hint: "−$1,000, +some joy" },
      { id: "skip", label: "Skip it entirely", hint: "the plan is the plan" },
    ],
    resolve(choice, s) {
      if (choice === "go") {
        const cost = Math.min(2500, s.cash + s.savings);
        const c = Math.min(s.cash, cost); s.cash -= c; s.savings -= (cost - c);
        s.happy = Math.min(100, s.happy + 15);
        return { cls: "info", text: "Worth it — IF it's paid in cash, planned, and rare. Misery-maxing your 20s to retire angry isn't the goal." };
      }
      if (choice === "budget") {
        const cost = Math.min(1000, s.cash); s.cash -= cost;
        s.happy = Math.min(100, s.happy + 8);
        return { cls: "good", text: "The 80/20 of fun: most of the memories, less than half the cost. This skill alone funds a retirement." };
      }
      s.happy = Math.max(0, s.happy - 10);
      return { cls: "warn", text: "Saved " + Learn._f(2500) + " — and paid in burnout. Plans you hate get abandoned; budget joy on purpose." };
    },
  },
  scam: {
    gen: () => ({}),
    title: () => "'Guaranteed 25% MONTHLY returns'",
    desc: () => "A slick 'trader' DMs you: exclusive fund, guaranteed 25% a month, 'risk-free', testimonials everywhere. Just transfer to start.",
    choices: () => [
      { id: "no", label: "Block and report — math says fraud", hint: "25%/mo = 14x/yr" },
      { id: "small", label: "Test it with 10% of your cash", hint: "just to see" },
      { id: "big", label: "This is the way out — go heavy (30%)", hint: "trust the testimonials" },
    ],
    resolve(choice, s) {
      if (choice === "no") { return { cls: "good", text: "Blocked. 25% monthly is 14x a year — if it were real, they'd need no one's money. 'Guaranteed' + 'high return' = fraud, every time." }; }
      const frac = choice === "small" ? 0.10 : 0.30;
      const stake = s.cash * frac; s.cash -= stake; s.scamLost = (s.scamLost || 0) + stake;
      return { cls: "danger", text: "Three months of fake dashboards later, the 'fund' vanished with your " + Learn._f(stake) + ". Ponzis pay early exits with late entries — until they don't." };
    },
  },
};

/* allocation presets for the sandbox — savings/index/hot %, the rest is cash */
const SB_PRESETS = {
  safe:     { label: "🛡 Safe",        alloc: { savings: 40, index: 0, hot: 0 } },   // 60% cash
  balanced: { label: "⚖ Balanced",    alloc: { savings: 20, index: 60, hot: 0 } },  // 20% cash
  index:    { label: "📈 All-in index", alloc: { savings: 0, index: 100, hot: 0 } }, // 0% cash
  wild:     { label: "🎰 Go wild",      alloc: { savings: 0, index: 40, hot: 60 } }, // 0% cash
};

function buildDeck() {
  const deck = ["crash", "bull", "bull", "emergency", "emergency", "emergency", "tip", "job",
    "windfall", "windfall", "recession", "vacation", "vacation", "scam",
    null, null, null, null, null, null];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  return deck;
}

/* ============================== engine ============================== */

/* maps a lesson's feature_app to a page + deep-link label */
const FEATURE_NAV = {
  budget: ["budget", "Open Budget"],
  accounts: ["accounts", "Open Accounts"],
  goals: ["milestones", "Open Goals"],
  investments: ["portfolio", "Open Portfolio"],
  tax: ["earnings", "Open Income & taxes"],
  debt: ["cards", "Open Credit cards"],
  retirement: ["retirement", "Open Retirement"],
};

const Learn = {
  session: null,
  courseTrack: null,   // open curriculum track id, or null
  lessonId: null,      // open lesson id, or null

  handle(action, el) {
    const id = el ? el.dataset.id : null;
    switch (action) {
      case "learn-track": this.session = null; this.courseTrack = id; this.lessonId = null; break;
      case "learn-lesson": this.session = null; this.lessonId = id; break;
      case "learn-lesson-back": this.lessonId = null; break;
      case "learn-course-home": this.courseTrack = null; this.lessonId = null; break;
      case "learn-lesson-done": {
        const Ls = Store.state.learn; Ls.lessons = Ls.lessons || {}; Ls.lessons[id] = true; Store.save();
        if (typeof LESSONS === "undefined") break;
        const lsn = LESSONS.find(x => x.id === id);
        const arr = lsn ? LESSONS.filter(x => x.track === lsn.track) : [];
        const pos = arr.findIndex(x => x.id === id);
        this.lessonId = arr[pos + 1] ? arr[pos + 1].id : null;   // advance, or back to the track list
        break;
      }
      case "learn-start": this.courseTrack = null; this.lessonId = null; this.startScenario(id); break;
      case "learn-choice": this.choose(parseInt(id, 10)); break;
      case "learn-quiz": this.quizPick(parseInt(id, 10)); break;
      case "learn-next": this.next(); break;
      case "learn-exit": this.session = null; break;
      case "sb-start": this.courseTrack = null; this.lessonId = null; this.startSandbox(); break;
      // rate + preset update in place (no full re-render → no flicker)
      case "sb-rate":
        this.session.rate = parseInt(id, 10);
        document.querySelectorAll("[data-action='sb-rate']").forEach(b => b.classList.toggle("sel", parseInt(b.dataset.id, 10) === this.session.rate));
        return;
      case "sb-preset": { const p = SB_PRESETS[id]; if (p) { this.session.alloc = Object.assign({}, p.alloc); this.syncAlloc(); } return; }
      case "sb-advance": this.sandboxYear(); break;
      case "sb-event-choice": this.resolveEvent(id); break;
      case "sb-finish": this.session = null; break;
    }
    App.render();
  },

  /* push the current allocation into the live DOM without re-rendering the page */
  syncAlloc() {
    const a = this.session && this.session.alloc;
    if (!a) return;
    const placed = a.savings + a.index + a.hot, cash = 100 - placed;
    ["savings", "index", "hot"].forEach(k => {
      const sl = document.querySelector('.sb-alloc-input[data-bucket="' + k + '"]');
      if (sl && Number(sl.value) !== a[k]) sl.value = a[k];
      const p = document.querySelector('.sb-alloc-pct[data-pct="' + k + '"]');
      if (p) p.textContent = a[k] + "%";
    });
    const cp = document.querySelector('.sb-alloc-pct[data-pct="cash"]');
    if (cp) cp.textContent = cash + "%";
    const cf = document.querySelector('.sb-alloc-fill[data-fill="cash"]');
    if (cf) cf.style.width = cash + "%";
    const tot = document.querySelector("[data-alloc-total]");
    if (tot) tot.textContent = placed + "% invested · " + cash + "% cash";
  },

  /* live slider drag: clamp so savings+index+hot ≤ 100, then sync the DOM */
  updateAlloc(bucket, rawVal) {
    const a = this.session && this.session.alloc;
    if (!a || a[bucket] == null) return;
    const others = (a.savings + a.index + a.hot) - a[bucket];
    a[bucket] = Math.max(0, Math.min(100 - others, Math.round(Number(rawVal) || 0)));
    this.syncAlloc();
  },

  /* ---------- scenarios ---------- */
  startScenario(id) {
    const sc = SCENARIOS.find(s => s.id === id);
    if (!sc) return;
    this.session = { type: "scenario", id: id, step: 0, score: 0, impact: 0, chosen: null, quizPicked: null, done: false };
  },

  choose(idx) {
    const s = this.session;
    if (!s || s.chosen != null) return;
    const sc = SCENARIOS.find(x => x.id === s.id);
    const choice = sc.steps[s.step].choices[idx];
    s.chosen = idx;
    s.score += choice.points;
    s.impact += choice.impact;
  },

  quizPick(idx) {
    const s = this.session;
    if (!s || s.quizPicked != null) return;
    const sc = SCENARIOS.find(x => x.id === s.id);
    s.quizPicked = idx;
    if (idx === sc.steps[s.step].answer) s.score += 15;
  },

  next() {
    const s = this.session;
    const sc = SCENARIOS.find(x => x.id === s.id);
    if (s.step < sc.steps.length - 1) {
      s.step++;
      s.chosen = null;
      s.quizPicked = null;
    } else {
      s.done = true;
      s.final = Math.round(s.score / scenarioMaxScore(sc) * 100);
      const L = Store.state.learn;
      const rec = L.scenarios[s.id] || { best: 0, runs: 0 };
      rec.runs++;
      rec.best = Math.max(rec.best, s.final);
      L.scenarios[s.id] = rec;
      Store.save();
    }
  },

  /* ---------- sandbox ---------- */
  startSandbox() {
    this.session = {
      type: "sandbox", year: 0, age: 25, salary: 30000,
      cash: 5000, savings: 0, index: 0, hot: 0, debt: 0,
      rate: 20, alloc: { savings: 20, index: 60, hot: 10 }, happy: 70,
      deck: buildDeck(), pendingEvent: null,
      history: [5000], baseline: [5000], baseCash: 5000,
      log: [{ y: 0, cls: "info", text: "Age 25. $5,000 saved, $30,000/yr salary, 20 years ahead. Events WILL interrupt you — your reactions matter as much as your allocations." }],
      crashes: 0, everDebt: false, over: false,
      reboundBias: false, jobRisk: 0, raiseFreeze: 0, sideHustle: 0,
      soldBottom: false, boughtDip: false, scamLost: 0, tipLost: 0, soldForEmergency: false,
    };
  },

  _gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; },

  sandboxYear() {
    const s = this.session;
    if (!s || s.over || s.pendingEvent) return;
    s.year++; s.age++;
    const logs = [];
    const eventId = s.deck[s.year - 1];

    // job risk from a startup jump
    if (s.jobRisk > 0) {
      if (Math.random() < 0.2) {
        s.salary = Math.round(s.salary * 0.7); s.jobRisk = 0;
        logs.push({ cls: "danger", text: "The startup folded. Months of searching later you're re-hired at " + this._f(s.salary) + "/yr. High risk, real downside." });
      } else {
        s.jobRisk--;
        if (s.jobRisk === 0) logs.push({ cls: "good", text: "The startup found its footing — the +30% jump paid off for good." });
      }
    }

    // contribution (debt first)
    let contrib = s.salary * s.rate / 100 + (s.sideHustle > 0 ? 4000 : 0);
    if (s.sideHustle > 0) s.sideHustle--;
    if (s.debt > 0) {
      const pay = Math.min(s.debt, contrib);
      s.debt -= pay; contrib -= pay;
      logs.push({ cls: "warn", text: "Paid " + this._f(pay) + " toward 40% APR debt before anything else — expensive debt always goes first." });
    }

    // market returns (crash/bull override; rebound bias after held crashes)
    let indexRet = 0.09 + 0.15 * this._gauss();
    let hotRet = 0.11 + 0.45 * this._gauss();
    if (eventId === "crash") { indexRet = -0.35; hotRet = -0.60; s.crashes++; }
    else if (eventId === "bull") { indexRet = 0.28; hotRet = 0.70; }
    else if (s.reboundBias) { indexRet += 0.15; s.reboundBias = false; logs.push({ cls: "good", text: "Post-crash rebound: the index surged " + Math.round(indexRet * 100) + "% — the patient got paid." }); }

    s.savings *= 1.07;
    s.index *= 1 + indexRet;
    s.hot *= 1 + hotRet;
    if (s.debt > 0) { const dInt = s.debt * 0.40; s.debt += dInt; logs.push({ cls: "danger", text: "Debt grew " + this._f(dInt) + " at 40% APR — it compounds against you." }); }

    // allocate new savings by the chosen split — whatever isn't invested stays cash
    if (contrib > 0) {
      const a = s.alloc;
      const sv = contrib * (Number(a.savings) || 0) / 100;
      const ix = contrib * (Number(a.index) || 0) / 100;
      const ht = contrib * (Number(a.hot) || 0) / 100;
      const csh = Math.max(0, contrib - sv - ix - ht);
      s.savings += sv; s.index += ix; s.hot += ht; s.cash += csh;
      const parts = [];
      const pc = v => Math.round(v / contrib * 100);
      if (csh > 0.5) parts.push(pc(csh) + "% cash");
      if (sv > 0.5) parts.push(pc(sv) + "% savings");
      if (ix > 0.5) parts.push(pc(ix) + "% index");
      if (ht > 0.5) parts.push(pc(ht) + "% hot stock");
      logs.push({ cls: "info", text: "Saved " + this._f(contrib) + " → " + parts.join(", ") + "." });
    }

    // happiness drift from savings intensity
    s.happy = Math.max(0, Math.min(100, s.happy + (s.rate >= 35 ? -3 : s.rate <= 10 ? 2 : 0)));

    // salary growth + baseline saver
    if (s.raiseFreeze > 0) { s.raiseFreeze--; logs.push({ cls: "warn", text: "Salary frozen this year (recession)." }); }
    else s.salary = Math.round(s.salary * 1.04);
    s.baseCash += s.salary * s.rate / 100;
    s.baseline.push(Math.round(s.baseCash));

    if (eventId !== "crash" && eventId !== "bull") {
      logs.push({ cls: "info", text: "Markets: index " + (indexRet >= 0 ? "+" : "") + Math.round(indexRet * 100) + "%, savings +7%." });
    }

    const nw = Math.round(s.cash + s.savings + s.index + s.hot - s.debt);
    s.history.push(nw);
    logs.forEach(l => s.log.unshift({ y: s.year, cls: l.cls, text: l.text }));
    s.log = s.log.slice(0, 50);

    // fire the year's event (player must respond before advancing)
    if (eventId) {
      const ev = SB_EVENTS[eventId];
      const params = ev.gen();
      s.pendingEvent = { id: eventId, params: params, title: ev.title(params), desc: ev.desc(s) };
      s.log.unshift({ y: s.year, cls: eventId === "crash" ? "danger" : "warn", text: "⚑ " + s.pendingEvent.title });
    } else if (s.year >= 20) {
      this._endRun();
    }
  },

  resolveEvent(choiceId) {
    const s = this.session;
    if (!s || !s.pendingEvent) return;
    const ev = SB_EVENTS[s.pendingEvent.id];
    const result = ev.resolve(choiceId, s, s.pendingEvent.params);
    s.log.unshift({ y: s.year, cls: result.cls, text: result.text });
    s.pendingEvent = null;
    // refresh net worth after the decision's effects
    s.history[s.history.length - 1] = Math.round(s.cash + s.savings + s.index + s.hot - s.debt);
    if (s.year >= 20) this._endRun();
  },

  _endRun() {
    const s = this.session;
    s.over = true;
    const nw = s.history[s.history.length - 1];
    const L = Store.state.learn;
    L.sandbox.runs = (L.sandbox.runs || 0) + 1;
    L.sandbox.best = Math.max(L.sandbox.best || 0, nw);
    Store.save();
  },

  _f(n) { return fmtMoneyIn(Math.round(n), "USD", { compact: true }); },

  /* ============================== rendering ============================== */

  render() {
    if (this.session && this.session.type === "scenario") return this.renderScenario();
    if (this.session && this.session.type === "sandbox") return this.renderSandbox();
    if (this.lessonId) return this.renderLesson();
    if (this.courseTrack) return this.renderTrack();
    return this.renderHome();
  },

  /* ---------- curriculum (60 lessons) ----------
     lessons.js is ~380KB of content, so it loads lazily the first time the
     Learn page needs it instead of slowing down every app start. */
  _lessonsLoading: false,
  ensureLessons() {
    if (typeof LESSONS !== "undefined") return true;
    if (!this._lessonsLoading) {
      this._lessonsLoading = true;
      const s = document.createElement("script");
      s.src = "js/lessons.js";
      s.onload = () => { this._lessonsLoading = false; if (App.page === "learn") App.render(); };
      s.onerror = () => {
        this._lessonsLoading = false;
        if (typeof UI !== "undefined") UI.toast("Couldn't load the course — check your connection", "error");
      };
      document.head.appendChild(s);
    }
    return false;
  },
  _courseLoading() {
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Course · 60 lessons</div></div>' +
      '<div class="adv-loading">Loading the course…</div></div>';
  },

  _coursePanel() {
    if (!this.ensureLessons()) return this._courseLoading();
    const done = (Store.state.learn && Store.state.learn.lessons) || {};
    const tracks = (typeof LESSON_TRACKS !== "undefined" ? LESSON_TRACKS : []).map(tr => {
      const items = LESSONS.filter(x => x.track === tr.id);
      const n = items.filter(x => done[x.id]).length;
      const pct = items.length ? Math.round(n / items.length * 100) : 0;
      return '<button class="course-track" data-action="learn-track" data-id="' + tr.id + '">' +
        '<span class="course-ic">' + tr.icon + "</span>" +
        '<span class="course-tx"><strong>' + esc(tr.title) + "</strong><span>" + esc(tr.blurb) + "</span>" +
          '<span class="course-prog"><span class="course-bar"><span style="width:' + pct + '%"></span></span>' + n + "/" + items.length + "</span></span>" +
        '<span class="lsn-row-go">›</span></button>';
    }).join("");
    const total = LESSONS.length, totDone = LESSONS.filter(x => done[x.id]).length;
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Course · ' + total + " lessons</div>" +
      '<span class="panel-sub">' + totDone + " done · 3–5 min each</span></div>" +
      '<p class="method-note" style="margin-bottom:14px">Short, practical lessons in Spanish, made for Mexico — from budgeting to investing and taxes. Each ends with one action to do right here in the app.</p>' +
      '<div class="course-tracks">' + tracks + "</div></div>";
  },

  renderTrack() {
    if (!this.ensureLessons()) return this._courseLoading();
    const tr = (typeof LESSON_TRACKS !== "undefined" ? LESSON_TRACKS : []).find(t => t.id === this.courseTrack);
    if (!tr) { this.courseTrack = null; return this.renderHome(); }
    const done = (Store.state.learn && Store.state.learn.lessons) || {};
    const items = LESSONS.filter(x => x.track === this.courseTrack);
    const rows = items.map(x => {
      const d = !!done[x.id];
      return '<button class="lsn-row' + (d ? " done" : "") + '" data-action="learn-lesson" data-id="' + x.id + '">' +
        '<span class="lsn-num">' + (d ? "✓" : x.n) + "</span>" +
        '<span class="lsn-row-tx"><strong>' + esc(x.title) + "</strong><span>" + x.mins + " min" +
          (x.tags.length ? " · " + esc(x.tags.slice(0, 3).join(", ")) : "") + "</span></span>" +
        '<span class="lsn-row-go">›</span></button>';
    }).join("");
    const cnt = items.filter(x => done[x.id]).length;
    return '<div class="panel section">' +
      '<div class="learn-play-head" style="margin-bottom:14px"><button class="btn small ghost" data-action="learn-course-home">← All tracks</button>' +
        '<span class="micro-label">' + cnt + " / " + items.length + " done</span></div>" +
      '<div class="course-track-head"><span class="course-ic big">' + tr.icon + "</span>" +
        "<div><h2>" + esc(tr.title) + "</h2><p>" + esc(tr.blurb) + "</p></div></div>" +
      '<div class="lsn-list">' + rows + "</div></div>";
  },

  renderLesson() {
    if (!this.ensureLessons()) return this._courseLoading();
    const lsn = LESSONS.find(x => x.id === this.lessonId);
    if (!lsn) { this.lessonId = null; return this.render(); }
    const tr = (typeof LESSON_TRACKS !== "undefined" ? LESSON_TRACKS : []).find(t => t.id === lsn.track) || { title: "Course" };
    const done = !!(Store.state.learn && Store.state.learn.lessons && Store.state.learn.lessons[lsn.id]);
    const arr = LESSONS.filter(x => x.track === lsn.track);
    const pos = arr.findIndex(x => x.id === lsn.id);
    const prev = arr[pos - 1], next = arr[pos + 1];
    const feat = FEATURE_NAV[lsn.feature];
    const featBtn = feat ? '<button class="btn small" data-action="nav" data-page="' + feat[0] + '">' + feat[1] + " →</button>" : "";
    const navBtn = (lk, label, before) => lk
      ? '<button class="btn small ghost" data-action="learn-lesson" data-id="' + lk.id + '">' + (before ? "← " : "") + label + (before ? "" : " →") + "</button>"
      : "<span></span>";
    return '<div class="panel section lsn-reader">' +
      '<div class="learn-play-head" style="margin-bottom:10px"><button class="btn small ghost" data-action="learn-lesson-back">← ' + esc(tr.title) + "</button>" +
        '<span class="micro-label">Lesson ' + lsn.n + " / " + arr.length + " · " + lsn.mins + " min</span></div>" +
      '<h1 class="lsn-title">' + esc(lsn.title) + "</h1>" +
      '<div class="lsn-prose">' + lsn.html + "</div>" +
      (featBtn ? '<div class="lsn-feature">' + featBtn + "</div>" : "") +
      '<div class="lsn-foot">' + navBtn(prev, "Prev", true) +
        '<button class="btn ' + (done ? "" : "primary") + '" data-action="learn-lesson-done" data-id="' + lsn.id + '">' + (done ? "✓ Completed" : "Mark complete") + "</button>" +
        navBtn(next, "Next", false) + "</div></div>";
  },

  renderHome() {
    const L = Store.state.learn;
    const xp = learnXP();
    const lvl = learnLevel(xp);
    const pctToNext = lvl.next ? Math.min(100, (xp - lvl.cur.xp) / (lvl.next.xp - lvl.cur.xp) * 100) : 100;

    const header =
      '<div class="panel section learn-header">' +
        '<div class="learn-level-row">' +
          '<div><span class="micro-label">Your level</span><div class="learn-level">' + lvl.cur.name + "</div></div>" +
          '<div class="learn-xp"><span class="micro-label">' + xp + " XP" + (lvl.next ? " · " + (lvl.next.xp - xp) + " to " + lvl.next.name : " · max level") + "</span>" +
          '<div class="pct-track" style="margin-top:8px"><div class="pct-fill" style="width:' + pctToNext.toFixed(0) + '%"></div></div></div>' +
        "</div>" +
        '<p class="method-note" style="margin-top:14px">Interactive modules: live calculators to play with, decisions to make, and quick checks — then a sandbox where 20 years of consequences happen in minutes.</p>' +
      "</div>";

    const cards = SCENARIOS.map(sc => {
      const rec = L.scenarios[sc.id];
      const best = rec ? rec.best : null;
      const stars = best == null ? "" : (best >= 90 ? "★★★" : best >= 60 ? "★★☆" : "★☆☆");
      const nTeach = sc.steps.filter(x => x.kind === "teach").length;
      const nPlay = sc.steps.length - nTeach;
      return '<div class="learn-card">' +
        '<div class="learn-card-icon">' + sc.icon + "</div>" +
        '<h3>' + sc.title + "</h3>" +
        '<p>' + sc.tagline + "</p>" +
        '<div class="learn-meta">' + nTeach + " interactive lessons · " + nPlay + " challenges</div>" +
        '<div class="learn-card-foot">' +
          (best != null
            ? '<span class="learn-stars" title="Best score">' + stars + ' <em>' + best + "/100</em></span>"
            : '<span class="learn-stars new">~5 min</span>') +
          '<button class="btn small ' + (best != null ? "ghost" : "primary") + '" data-action="learn-start" data-id="' + sc.id + '">' + (best != null ? "Replay" : "Start") + "</button>" +
        "</div></div>";
    }).join("");

    const sb = L.sandbox;
    const sandbox =
      '<div class="panel section sandbox-banner">' +
        '<div class="sb-banner-text">' +
          '<span class="micro-label">Sandbox game</span>' +
          '<h3>Wealth Builder — 20 Years</h3>' +
          "<p>Start at 25 with $5,000 and a $30,000 salary. Crashes, scams, job offers and emergencies will interrupt you — every one demands a decision with real consequences. Balance the fortune against the burnout meter, beat the mattress saver, chase the S-grade. Every run is a different life.</p>" +
          (sb.best ? '<div class="learn-stars">Best run: <em>' + fmtMoneyIn(sb.best, "USD", { compact: true }) + "</em> · " + (sb.runs || 0) + " run" + (sb.runs === 1 ? "" : "s") + "</div>" : "") +
        "</div>" +
        '<button class="btn primary" data-action="sb-start">' + (sb.runs ? "Play again" : "▶ Start the game") + "</button>" +
      "</div>";

    return header + this._coursePanel() + '<div class="learn-grid section">' + cards + "</div>" + sandbox;
  },

  renderScenario() {
    const s = this.session;
    const sc = SCENARIOS.find(x => x.id === s.id);

    if (s.done) {
      const stars = s.final >= 90 ? "★★★" : s.final >= 60 ? "★★☆" : "★☆☆";
      const verdict = s.final >= 90 ? "Flawless — future-you is rich and grateful."
        : s.final >= 60 ? "Solid instincts — a couple of expensive habits to unlearn."
        : "Costly run — but cheaper to learn here than in real life. Replay it!";
      return '<div class="panel section learn-result">' +
        '<div class="learn-card-icon big">' + sc.icon + "</div>" +
        '<div class="learn-stars result">' + stars + "</div>" +
        '<h2>' + s.final + "/100</h2>" +
        '<p class="lr-verdict">' + verdict + "</p>" +
        '<div class="lr-impact ' + (s.impact >= 0 ? "pos" : "neg") + '">Estimated 10-year impact of your choices: <strong>' + (s.impact >= 0 ? "+" : "−") + fmtMoneyIn(Math.abs(s.impact), "USD", { compact: true }) + "</strong></div>" +
        '<div class="lr-takeaways"><span class="micro-label">Keep these</span><ul>' +
          sc.takeaways.map(t => "<li>" + t + "</li>").join("") + "</ul></div>" +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn" data-action="learn-start" data-id="' + sc.id + '">↻ Replay</button>' +
          '<button class="btn primary" data-action="learn-exit">Back to Learn</button>' +
        "</div></div>";
    }

    const step = sc.steps[s.step];
    const dots = sc.steps.map((st, i) =>
      '<span class="l-dot' + (i < s.step ? " past" : i === s.step ? " now" : "") + (st.kind === "teach" ? " teach" : "") + '"></span>').join("");

    const head =
      '<div class="learn-play-head">' +
        '<button class="btn small ghost" data-action="learn-exit">← Exit</button>' +
        '<div class="l-dots">' + dots + "</div>" +
        '<div class="learn-score-chip">' + s.score + ' pts · <span class="' + (s.impact >= 0 ? "pos" : "neg") + '">' + (s.impact >= 0 ? "+" : "−") + fmtMoneyIn(Math.abs(s.impact), "USD", { compact: true }) + " / 10 yr</span></div>" +
      "</div>";

    let body = "";
    if (step.kind === "teach") {
      body =
        '<div class="learn-situation"><span class="learn-card-icon">' + sc.icon + "</span>" +
        (s.step === 0 ? '<p class="learn-intro">' + sc.intro + "</p>" : "") +
        '<span class="micro-label" style="color:var(--gold)">Interactive lesson</span>' +
        "<h3>" + step.title + "</h3>" +
        '<p class="learn-body">' + step.body + "</p></div>" +
        WIDGETS[step.widget].html() +
        '<div style="margin-top:18px"><button class="btn primary" data-action="learn-next">Got it — continue →</button></div>';
    } else if (step.kind === "decide") {
      const choices = step.choices.map((c, i) => {
        const picked = s.chosen === i;
        const revealed = s.chosen != null;
        let cls = "learn-choice";
        if (revealed) {
          if (picked) cls += c.points >= 20 ? " good" : c.points >= 10 ? " mid" : " bad";
          else cls += " dim";
        }
        return '<button class="' + cls + '" data-action="learn-choice" data-id="' + i + '"' + (revealed ? " disabled" : "") + ">" +
          '<span class="lc-letter">' + "ABC"[i] + "</span>" + c.text +
          (revealed && picked ? '<span class="lc-pts">+' + c.points + " pts</span>" : "") +
        "</button>";
      }).join("");
      const feedback = s.chosen != null
        ? '<div class="learn-feedback ' + (step.choices[s.chosen].points >= 20 ? "good" : step.choices[s.chosen].points >= 10 ? "mid" : "bad") + '">' +
            "<p>" + step.choices[s.chosen].feedback + "</p>" +
            '<button class="btn primary" data-action="learn-next">' + (s.step === sc.steps.length - 1 ? "See results →" : "Next →") + "</button>" +
          "</div>"
        : "";
      body =
        '<div class="learn-situation"><span class="learn-card-icon">' + sc.icon + "</span>" +
        '<span class="micro-label">Your call</span>' +
        "<h3>" + step.situation + "</h3></div>" +
        '<div class="learn-choices">' + choices + "</div>" + feedback;
    } else { // quiz
      const opts = step.options.map((o, i) => {
        const revealed = s.quizPicked != null;
        let cls = "learn-choice";
        if (revealed) {
          if (i === step.answer) cls += " good";
          else if (i === s.quizPicked) cls += " bad";
          else cls += " dim";
        }
        return '<button class="' + cls + '" data-action="learn-quiz" data-id="' + i + '"' + (revealed ? " disabled" : "") + ">" +
          '<span class="lc-letter">' + "ABC"[i] + "</span>" + o +
          (revealed && i === step.answer ? '<span class="lc-pts">' + (s.quizPicked === step.answer ? "+15 pts" : "correct") + "</span>" : "") +
        "</button>";
      }).join("");
      const feedback = s.quizPicked != null
        ? '<div class="learn-feedback ' + (s.quizPicked === step.answer ? "good" : "bad") + '">' +
            "<p>" + (s.quizPicked === step.answer ? "Correct. " : "Not quite. ") + step.explain + "</p>" +
            '<button class="btn primary" data-action="learn-next">' + (s.step === sc.steps.length - 1 ? "See results →" : "Next →") + "</button>" +
          "</div>"
        : "";
      body =
        '<div class="learn-situation"><span class="learn-card-icon">' + sc.icon + "</span>" +
        '<span class="micro-label" style="color:var(--sky)">Quick check</span>' +
        "<h3>" + step.question + "</h3></div>" +
        '<div class="learn-choices">' + opts + "</div>" + feedback;
    }

    return '<div class="panel section learn-play">' + head + body + "</div>";
  },

  renderSandbox() {
    const s = this.session;
    const nw = Math.round(s.cash + s.savings + s.index + s.hot - s.debt);

    if (s.over) {
      const base = s.baseline[s.baseline.length - 1];
      const diff = nw - base;
      const realNW = Math.round(nw / Math.pow(1.04, 20));
      const grades = ["D", "C", "B", "A", "S"];
      let gi = nw >= 450000 ? 4 : nw >= 300000 ? 3 : nw >= 200000 ? 2 : nw >= 100000 ? 1 : 0;
      const burned = s.happy < 35;
      if (burned && gi > 0) gi--;
      const lessons = [];
      if (diff > 0) lessons.push("You beat the all-cash mattress saver by <strong>" + this._f(diff) + "</strong> — that gap is compounding at work.");
      else lessons.push("The mattress saver beat you this run — heavy speculation or harsh luck? Boring, diversified strategies win most timelines.");
      lessons.push("In today's purchasing power your fortune is <strong>" + this._f(realNW) + "</strong> — inflation took the rest. Nominal numbers always flatter.");
      if (s.soldBottom) lessons.push("You sold during a crash. The rebound happened without you — the single most expensive click in investing.");
      if (s.boughtDip) lessons.push("You bought a crash. That's the hardest, best-paid move in the game — and in real life.");
      if (s.everDebt) lessons.push("An emergency outran your buffer and became 40% APR debt. Cushions earn nothing — until they save everything.");
      else lessons.push("You never touched expensive debt — your liquid buffer quietly did its job.");
      if (s.scamLost > 0) lessons.push("The 'guaranteed' fund cost you " + this._f(s.scamLost) + ". Guaranteed + high return = fraud, every single time.");
      if (s.tipLost > 0) lessons.push("Meme bets cost " + this._f(s.tipLost) + " net. Fun money is fine — sized so it can't matter.");
      if (burned) lessons.push("Life satisfaction ended at " + s.happy + "/100 — the grade paid for it. Wealth you're too burned out to enjoy isn't the win condition.");
      else if (s.happy >= 60) lessons.push("You finished wealthy AND with a life (" + s.happy + "/100 satisfaction). That's the actual goal.");
      return '<div class="panel section learn-result">' +
        '<div class="sb-grade">' + grades[gi] + "</div>" +
        "<h2>" + this._f(nw) + "</h2>" +
        '<p class="lr-verdict">Net worth at 45 · ' + this._f(realNW) + " in today's money · satisfaction " + s.happy + "/100</p>" +
        this._sbChart(s) +
        '<div class="lr-takeaways"><span class="micro-label">This run taught you</span><ul>' +
          lessons.map(l => "<li>" + l + "</li>").join("") + "</ul></div>" +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn" data-action="sb-start">↻ Live another life</button>' +
          '<button class="btn primary" data-action="sb-finish">Back to Learn</button>' +
        "</div></div>";
    }

    /* event interrupt takes over the control panel */
    let controlsInner;
    if (s.pendingEvent) {
      const ev = SB_EVENTS[s.pendingEvent.id];
      controlsInner =
        '<div class="sb-event ' + (s.pendingEvent.id === "crash" ? "danger" : "") + '">' +
          '<span class="micro-label">Year ' + s.year + " — event</span>" +
          "<h3>" + s.pendingEvent.title + "</h3>" +
          "<p>" + s.pendingEvent.desc + "</p>" +
          '<div class="sb-event-choices">' +
          ev.choices(s.pendingEvent.params).map(c =>
            '<button class="learn-choice" data-action="sb-event-choice" data-id="' + c.id + '">' +
              '<span class="lc-label">' + c.label + "</span>" +
              '<span class="lc-pts">' + c.hint + "</span></button>").join("") +
          "</div></div>";
    } else {
      const rates = [10, 20, 35].map(r =>
        '<button class="sb-opt' + (s.rate === r ? " sel" : "") + '" data-action="sb-rate" data-id="' + r + '">' + r + "%</button>").join("");
      const a = s.alloc;
      const placed = Math.min(100, a.savings + a.index + a.hot);
      const cashPct = 100 - placed;
      const presets = Object.keys(SB_PRESETS).map(k =>
        '<button class="sb-opt" data-action="sb-preset" data-id="' + k + '">' + SB_PRESETS[k].label + "</button>").join("");
      const row = (key, name, sub, val, cls) =>
        '<div class="sb-alloc-row">' +
          '<div class="sb-alloc-name"><strong>' + name + "</strong><span>" + sub + "</span></div>" +
          '<div class="sb-alloc-ctl"><span class="sb-alloc-pct" data-pct="' + key + '">' + val + "%</span></div>" +
          '<input class="sb-alloc-input" data-bucket="' + key + '" type="range" min="0" max="100" step="1" value="' + val + '" aria-label="' + name + ' allocation">' +
        "</div>";
      controlsInner =
        '<span class="micro-label sb-label">Savings rate <em class="sb-hint">(higher builds wealth, drains the joy meter)</em></span>' +
        '<div class="sb-opts">' + rates + "</div>" +
        '<div class="sb-alloc-head"><span class="micro-label">Where this year’s savings go</span>' +
          '<span class="sb-alloc-total" data-alloc-total>' + placed + "% invested · " + cashPct + "% cash</span></div>" +
        '<div class="sb-opts sb-quick">' + presets + "</div>" +
        '<div class="sb-alloc">' +
          row("savings", "🏦 Savings", "+7%/yr steady", a.savings, "savings") +
          row("index", "📈 Index fund", "~+9%/yr bumpy", a.index, "index") +
          row("hot", "🎰 Hot stock", "−55% to +90%", a.hot, "hot") +
          '<div class="sb-alloc-row cashrow"><div class="sb-alloc-name"><strong>🛏 Cash buffer</strong>' +
            "<span>whatever you don’t invest</span></div>" +
            '<div class="sb-alloc-ctl"><span class="sb-alloc-pct" data-pct="cash">' + cashPct + "%</span></div>" +
            '<div class="sb-alloc-bar"><div class="sb-alloc-fill cash" data-fill="cash" style="width:' + cashPct + '%"></div></div></div>' +
        "</div>" +
        '<button class="btn primary sb-advance" data-action="sb-advance">▶ Live year ' + (s.year + 1) + "</button>";
    }

    const happyColor = s.happy >= 60 ? "var(--mint)" : s.happy >= 35 ? "var(--gold)" : "var(--rose)";
    const logHtml = s.log.slice(0, 14).map(l =>
      '<div class="sb-log-row ' + l.cls + '"><span class="sb-log-y">Y' + l.y + "</span>" + l.text + "</div>").join("");

    return '<div class="section sb-layout">' +
      '<div class="panel sb-controls">' +
        '<div class="learn-play-head" style="margin-bottom:14px">' +
          '<button class="btn small ghost" data-action="learn-exit">← Exit</button>' +
          '<span class="micro-label">Year ' + s.year + " / 20 · Age " + s.age + "</span>" +
        "</div>" +
        '<div class="sb-stats">' +
          '<div><span class="micro-label">Net worth</span><div class="sb-nw">' + this._f(nw) + "</div></div>" +
          '<div><span class="micro-label">Salary</span><div class="sb-stat">' + this._f(s.salary) + "/yr</div></div>" +
        "</div>" +
        '<div class="sb-happy"><span class="micro-label">Life satisfaction</span>' +
          '<div class="lw-bar"><div class="lw-fill" style="width:' + s.happy + '%;background:' + happyColor + '"></div></div>' +
          '<span class="sb-hint">' + s.happy + "/100 — ends below 35 and the grade drops</span></div>" +
        '<div class="sb-holdings">' +
          '<span>Cash <em>' + this._f(s.cash) + "</em></span>" +
          '<span>Savings <em>' + this._f(s.savings) + "</em></span>" +
          '<span>Index <em>' + this._f(s.index) + "</em></span>" +
          '<span>Hot stock <em>' + this._f(s.hot) + "</em></span>" +
          (s.debt > 0 ? '<span class="neg">Debt <em>−' + this._f(s.debt) + "</em></span>" : "") +
        "</div>" +
        controlsInner +
      "</div>" +
      '<div class="panel sb-board">' +
        this._sbChart(s) +
        '<div class="sb-log">' + logHtml + "</div>" +
      "</div>" +
    "</div>";
  },

  _sbChart(s) {
    const W = 1000, H = 200, PAD = 10;
    const all = s.history.concat(s.baseline);
    const max = Math.max.apply(null, all.concat([10000]));
    const min = Math.min(0, Math.min.apply(null, all));
    const span = max - min || 1;
    const px = (arr) => arr.map((v, i) => [
      PAD + i * (W - 2 * PAD) / Math.max(1, 20),
      H - PAD - (v - min) / span * (H - 2 * PAD),
    ].map(n => n.toFixed(1)).join(",")).join(" ");
    const isLight = Store.state.settings.theme === "light";
    const you = isLight ? "#177a42" : "#8fe3a6";
    const baseC = isLight ? "rgba(28,38,30,0.35)" : "rgba(233,239,228,0.3)";
    return '<svg class="nw-chart" style="height:170px" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
      '<polyline points="' + px(s.baseline) + '" fill="none" stroke="' + baseC + '" stroke-width="2" stroke-dasharray="5 5"/>' +
      '<polyline points="' + px(s.history) + '" fill="none" stroke="' + you + '" stroke-width="2.5" stroke-linejoin="round"/>' +
    "</svg>" +
    '<div class="nw-chart-scale"><span>— you · ' + this._f(s.history[s.history.length - 1]) + '</span><span>- - mattress saver · ' + this._f(s.baseline[s.baseline.length - 1]) + "</span></div>";
  },
};
