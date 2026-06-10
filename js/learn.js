/* FinanceOS — Learn: interactive scenarios + Wealth Builder sandbox */
"use strict";

/* ============================== scenario data ============================== */

const SCENARIOS = [
  {
    id: "paycheck", icon: "⛁", title: "The First Paycheck",
    tagline: "Where your money goes before you notice",
    intro: "You just landed your first real job — $1,800 a month lands in your checking account. Every choice here quietly compounds for the next decade.",
    steps: [
      {
        situation: "Payday. $1,800 hits your account. What's your very first move?",
        choices: [
          { text: "Transfer 20% to savings automatically, before touching the rest", points: 25, impact: 52000,
            feedback: "Pay yourself first. When saving happens before spending, it's never 'whatever's left' — and $360/mo invested at ~9% becomes roughly $70,000 in 10 years." },
          { text: "Pay bills, live my life, save whatever's left at month-end", points: 10, impact: 9000,
            feedback: "Backwards budgeting. Spending expands to fill the space — 'whatever's left' averages close to zero. Flip the order and the saving takes care of itself." },
          { text: "First paychecks are for celebrating — saving starts next month", points: 0, impact: 0,
            feedback: "'Next month' is how lifestyles grow to eat every peso of income. There will always be a reason to start later — and compounding rewards only the early." },
        ],
      },
      {
        situation: "You're building an emergency fund. How big should it be before you relax?",
        choices: [
          { text: "3–6 months of expenses", points: 25, impact: 30000,
            feedback: "Exactly. 3–6 months covers job loss, medical surprises and car disasters — the events that otherwise become high-interest debt." },
          { text: "One month is plenty", points: 10, impact: 8000,
            feedback: "One month softens small bumps, but a job loss or medical bill blows straight through it — and then the credit card takes over at 40%+ APR." },
          { text: "My credit card IS my emergency fund", points: 0, impact: -25000,
            feedback: "An emergency paid at 40% APR becomes a bigger emergency. A $5,000 surprise on minimum payments can cost over $10,000 before it's gone." },
        ],
      },
      {
        situation: "Where should that emergency fund live?",
        choices: [
          { text: "A high-yield savings account", points: 25, impact: 12000,
            feedback: "Liquid, safe, and earning real interest. In FinanceOS, set the APY on the account and watch the interest engine project it for you." },
          { text: "My checking account — it's right there", points: 10, impact: 2000,
            feedback: "Safe but silently shrinking: checking pays ~0% while inflation runs 4-5%. The same money in high-yield savings earns thousands over a decade." },
          { text: "Index funds — make it grow!", points: 5, impact: -4000,
            feedback: "Growth money and emergency money have opposite jobs. Markets can be down 25% exactly when your car dies — never invest cash you might need within a year or two." },
        ],
      },
      {
        situation: "One year in, you get a 20% raise. What changes?",
        choices: [
          { text: "Lifestyle stays put — the entire raise goes to savings and investments", points: 25, impact: 65000,
            feedback: "Beating lifestyle inflation is a superpower. You already lived fine on the old salary — banking raises is the fastest wealth accelerator that exists." },
          { text: "Half the raise upgrades my life, half gets saved", points: 15, impact: 32000,
            feedback: "A solid compromise — enjoying progress is healthy. Just make the saved half automatic before the lifestyle half finds it." },
          { text: "Finally! Better apartment, better car — I earned this", points: 0, impact: 0,
            feedback: "100% lifestyle inflation: income up, wealth unchanged. This is how people earn triple their first salary and still live paycheck to paycheck." },
        ],
      },
    ],
    takeaways: [
      "Pay yourself first — automate savings before any spending happens.",
      "Build 3–6 months of expenses in a high-yield savings account.",
      "Emergency money and growth money have different jobs — don't mix them.",
      "Bank your raises: avoiding lifestyle inflation builds wealth faster than any stock pick.",
    ],
  },
  {
    id: "cards", icon: "▭", title: "The Credit Card Trap",
    tagline: "A tool that's either free or ferociously expensive",
    intro: "Your first credit card arrives: $3,000 limit, 40% APR. Used well it's free convenience and a credit score. Used badly, it's the most expensive money you'll ever borrow.",
    steps: [
      {
        situation: "You want a $1,000 TV. You have $400 in cash. The card is right there…",
        choices: [
          { text: "Wait two months and save up the difference", points: 25, impact: 15000,
            feedback: "Delayed gratification wins: same TV, zero interest. The habit matters more than the $1,000 — people who can wait two months retire wealthier." },
          { text: "Buy it now, pay it off over 3 months", points: 12, impact: 2000,
            feedback: "Contained damage — a few months of interest. Survivable, but notice the pattern forming: wants arriving before the money does." },
          { text: "Buy it now, pay the minimum each month", points: 0, impact: -18000,
            feedback: "The trap itself. At 40% APR, minimum payments stretch a $1,000 TV into ~$1,900 over five years. Minimums are designed to maximize what you pay." },
        ],
      },
      {
        situation: "Statement arrives: balance $900, minimum payment $45. What do you pay?",
        choices: [
          { text: "The full $900 before the due date", points: 25, impact: 20000,
            feedback: "Paid in full inside the grace period = the bank lent you money for free. This is the only way to use a card where you win and they don't." },
          { text: "Half now, half next month", points: 10, impact: -3000,
            feedback: "Better than minimums — but interest starts the moment a balance carries over, charged on the average daily balance, not just the leftover." },
          { text: "The minimum — that's what it's for, right?", points: 0, impact: -22000,
            feedback: "At 40% APR, $45 barely covers the interest. The balance hardly moves while the bank collects. Minimums protect your credit score, not your wealth." },
        ],
      },
      {
        situation: "Your limit is $3,000. For a healthy credit score, your running balance should stay under…",
        choices: [
          { text: "30% — about $900", points: 25, impact: 12000,
            feedback: "Utilization below 30% (lower is better) is one of the biggest score factors. FinanceOS colors your utilization bar gold past 30% and red past 70% for exactly this reason." },
          { text: "90% — limits exist to be used", points: 0, impact: -10000,
            feedback: "High utilization reads as financial distress and tanks your score — which later means worse rates on car loans and mortgages. Expensive in slow motion." },
          { text: "0% — I just never use the card", points: 10, impact: 1000,
            feedback: "Zero risk, but also zero credit history — and history unlocks the good rates later. Use it for small recurring buys and auto-pay in full." },
        ],
      },
      {
        situation: "Your card's cut date is the 14th. You're buying a $600 flight. When?",
        choices: [
          { text: "The 15th — right after the statement cuts", points: 25, impact: 5000,
            feedback: "Sharp. Buying just after the cut gives you the longest interest-free float — up to ~45 days before payment is due. FinanceOS counts down both dates per card." },
          { text: "The 13th — right before the cut", points: 5, impact: 0,
            feedback: "It lands on the statement that's about to close, so payment is due in days. Same flight, shortest possible float." },
          { text: "Whenever — dates are the bank's problem", points: 0, impact: -2000,
            feedback: "The cut/due rhythm IS the game. Ignore it and you randomly give up float, or worse, miss due dates — late fees plus score damage." },
        ],
      },
    ],
    takeaways: [
      "Always pay the full statement balance — the grace period makes credit free.",
      "Minimum payments are a product designed against you. At 40% APR they nearly double prices.",
      "Keep utilization under 30% of the limit — your future loan rates depend on it.",
      "Know your cut and due dates; buy right after the cut for maximum interest-free days.",
    ],
  },
  {
    id: "market", icon: "◮", title: "Market Rollercoaster",
    tagline: "Why time beats timing, every time",
    intro: "You invested $10,000 in a diversified index fund. Now the market is about to test your nerves — which is where most returns are actually won or lost.",
    steps: [
      {
        situation: "Three red months: the market drops 25%. Your $10,000 shows $7,500. What now?",
        choices: [
          { text: "Hold — and keep my automatic monthly buys running", points: 25, impact: 48000,
            feedback: "Crashes are when shares go on sale. Missing just the 10 best market days — which cluster right after crashes — roughly halves a 20-year return." },
          { text: "Pause contributions until things look clearer", points: 10, impact: 12000,
            feedback: "'Clarity' only ever arrives after prices have recovered. Waiting for it means systematically buying high and skipping the discounts." },
          { text: "Sell everything before it gets worse", points: 0, impact: -35000,
            feedback: "Selling converts a temporary dip into a permanent loss. Investors who panic-sold in 2008 or 2020 and 'waited for safety' missed historic rebounds." },
        ],
      },
      {
        situation: "Your friend's favorite stock doubled last year. He says index funds are for cowards. You…",
        choices: [
          { text: "Keep the index core; allow up to 5–10% as 'fun money' picks", points: 25, impact: 20000,
            feedback: "Core-and-satellite: the boring 90% compounds reliably while the fun 10% scratches the itch without being able to sink you." },
          { text: "Never touch individual stocks, ever", points: 15, impact: 14000,
            feedback: "Perfectly rational — pure indexing beats most professionals. A tiny fun allocation is mostly psychology insurance so you never bet the core." },
          { text: "Go big — his last pick doubled!", points: 0, impact: -30000,
            feedback: "Concentration cuts both ways: NVDA-style doubles make headlines, the silent majority of hot picks underperform or implode. One bad bet can erase years of compounding." },
        ],
      },
      {
        situation: "You're saving for a house down payment you'll need in about a year. Invest it in stocks?",
        choices: [
          { text: "No — money needed within 1–2 years belongs in savings", points: 25, impact: 15000,
            feedback: "Match the horizon: stocks are for 5+ year money. A 20% dip the month you need the down payment isn't a risk — over one year, it's a coin flip you can't afford." },
          { text: "Half stocks, half savings", points: 10, impact: 3000,
            feedback: "Half the mismatch is still a mismatch — a bad year forces you to sell low or postpone the house. Short-term goals want boring, guaranteed money." },
          { text: "Yes — stocks return more than savings accounts", points: 0, impact: -20000,
            feedback: "True on average, brutal on deadlines. Averages hide sequences: the market 'averages' 9% while regularly dropping 30% in a single bad year." },
        ],
      },
      {
        situation: "How often should you check and adjust your portfolio?",
        choices: [
          { text: "Automate buys, glance quarterly, rebalance yearly", points: 25, impact: 18000,
            feedback: "Investing is the rare game where less activity earns more. Automation removes emotion — the most expensive ingredient in any portfolio." },
          { text: "Never look at it again", points: 12, impact: 8000,
            feedback: "Close! Benign neglect beats overtrading, but a yearly check keeps your mix on target and updates prices — your FinanceOS portfolio needs ~5 minutes a quarter." },
          { text: "Daily — and act on every move", points: 0, impact: -15000,
            feedback: "Checking daily turns noise into anxiety and anxiety into trades. Studies are blunt: the most active retail traders earn the worst returns." },
        ],
      },
    ],
    takeaways: [
      "Time in the market beats timing the market — stay invested through crashes.",
      "Diversify: index core, with at most 5–10% in individual picks.",
      "Match money to horizon: stocks for 5+ years, savings for soon.",
      "Automate and ignore the noise — activity is the enemy of returns.",
    ],
  },
  {
    id: "inflation", icon: "❋", title: "The Silent Thief",
    tagline: "Inflation eats cash that isn't working",
    intro: "Your grandmother proudly kept $10,000 'safe' under the mattress since 2004. It's still $10,000 — and that's exactly the problem.",
    steps: [
      {
        situation: "At 4% average inflation, what does that 2004 mattress-money buy ~18 years later?",
        choices: [
          { text: "About half of what it used to", points: 25, impact: 10000,
            feedback: "The Rule of 72: divide 72 by the inflation rate → 72/4 = ~18 years for prices to double, which halves what static cash buys. 'Safe' cash quietly lost $5,000 of power." },
          { text: "Slightly less — maybe 10% less", points: 10, impact: 2000,
            feedback: "Inflation feels small yearly but compounds just like interest — 4% for 18 years isn't 10% damage, it's ~50%. Compounding works against idle cash too." },
          { text: "The same — $10,000 is $10,000", points: 0, impact: -10000,
            feedback: "The number is the same; the groceries aren't. Nominal vs real is the most expensive confusion in personal finance." },
        ],
      },
      {
        situation: "Your savings account pays 7% APY while inflation runs 4%. Your REAL return is…",
        choices: [
          { text: "About 3%", points: 25, impact: 8000,
            feedback: "Real return ≈ nominal − inflation. That 3% is your actual gain in purchasing power — always judge accounts, raises and returns in real terms." },
          { text: "7% — that's what the bank pays", points: 0, impact: -5000,
            feedback: "That's the nominal rate. If prices rise 4%, only 3 of those 7 points made you genuinely richer. Banks advertise nominal; life charges real." },
          { text: "Negative — inflation beats any savings account", points: 5, impact: -2000,
            feedback: "Too pessimistic here (7% > 4%), but you've spotted the right danger: whenever APY < inflation, 'saving' is slow-motion losing — common with big-bank 0.1% accounts." },
        ],
      },
      {
        situation: "For money you won't touch for 20 years, the best inflation defense is…",
        choices: [
          { text: "A broad stock index fund", points: 25, impact: 40000,
            feedback: "Businesses raise their prices with inflation — owning them means owning the price increases. Stocks have outpaced inflation over every 20-year span in modern history." },
          { text: "Cash — flexible and safe", points: 0, impact: -20000,
            feedback: "Over 20 years at 4% inflation, cash loses ~56% of its power — the mattress story all over again. For long horizons, 'safe' cash is the riskiest asset." },
          { text: "Keep it in checking and just earn more at work", points: 5, impact: -8000,
            feedback: "Earning more is great offense, but it doesn't protect what you've already earned. Defense and offense are separate jobs." },
        ],
      },
      {
        situation: "Inflation is 5% this year. Your boss proudly offers a 2% raise. You…",
        choices: [
          { text: "Negotiate, citing inflation: 2% nominal is a 3% real pay CUT", points: 25, impact: 25000,
            feedback: "Framing raises in real terms is both true and persuasive. Compounded over a career, recovering those 3 points is worth six figures." },
          { text: "Accept happily — a raise is a raise", points: 0, impact: -15000,
            feedback: "You just agreed to do the same job for 3% less purchasing power. Inflation makes 'a raise' and 'more money' different things." },
          { text: "Quit dramatically on the spot", points: 5, impact: -5000,
            feedback: "Right instinct about real pay, wrong execution — negotiate first, and job-hop with an offer in hand, not on principle alone." },
        ],
      },
    ],
    takeaways: [
      "Rule of 72: 72 ÷ inflation rate = years for prices to double.",
      "Real return = nominal return − inflation. Judge everything in real terms.",
      "Long-term money must outgrow inflation — broad stock indexes historically do.",
      "Negotiate salaries in real terms: a raise below inflation is a pay cut.",
    ],
  },
];

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

/* ============================== engine ============================== */

const Learn = {
  session: null, // {type:'scenario',...} | {type:'sandbox',...}

  /* ---------- routing ---------- */
  handle(action, el) {
    const id = el ? el.dataset.id : null;
    switch (action) {
      case "learn-start": this.startScenario(id); break;
      case "learn-choice": this.choose(parseInt(id, 10)); break;
      case "learn-next": this.next(); break;
      case "learn-exit": this.session = null; break;
      case "sb-start": this.startSandbox(); break;
      case "sb-rate": this.session.rate = parseInt(id, 10); break;
      case "sb-strategy": this.session.strategy = id; break;
      case "sb-advance": this.sandboxYear(); break;
      case "sb-finish": this.finishSandbox(); break;
    }
    App.render();
  },

  /* ---------- scenarios ---------- */
  startScenario(id) {
    const sc = SCENARIOS.find(s => s.id === id);
    if (!sc) return;
    this.session = { type: "scenario", id: id, step: 0, score: 0, impact: 0, chosen: null, done: false };
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

  next() {
    const s = this.session;
    const sc = SCENARIOS.find(x => x.id === s.id);
    if (s.step < sc.steps.length - 1) {
      s.step++;
      s.chosen = null;
    } else {
      s.done = true;
      const L = Store.state.learn;
      const rec = L.scenarios[s.id] || { best: 0, runs: 0 };
      rec.runs++;
      rec.best = Math.max(rec.best, s.score);
      L.scenarios[s.id] = rec;
      Store.save();
    }
  },

  /* ---------- sandbox: Wealth Builder ---------- */
  startSandbox() {
    this.session = {
      type: "sandbox", year: 0, age: 25, salary: 30000,
      cash: 5000, savings: 0, index: 0, hot: 0, debt: 0,
      rate: 20, strategy: "index",
      history: [5000], baseline: [5000], baseCash: 5000,
      log: [{ y: 0, cls: "info", text: "Age 25. $5,000 saved, $30,000/yr salary. 20 years on the clock — build your fortune." }],
      crashes: 0, everDebt: false, over: false,
    };
  },

  _gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; },

  sandboxYear() {
    const s = this.session;
    if (!s || s.over) return;
    s.year++; s.age++;
    const logs = [];

    // contribution
    let contrib = s.salary * s.rate / 100;
    if (s.debt > 0) {
      const pay = Math.min(s.debt, contrib);
      s.debt -= pay; contrib -= pay;
      logs.push({ cls: "warn", text: "Paid " + this._f(pay) + " toward your 40% APR debt first — always kill expensive debt before investing." });
    }

    // event roll
    const roll = Math.random();
    let indexRet = 0.09 + 0.15 * this._gauss();
    let hotRet = 0.11 + 0.45 * this._gauss();
    let event = null;
    if (roll < 0.08) {
      event = "crash"; indexRet = -0.30 - Math.random() * 0.1; hotRet = -0.55 - Math.random() * 0.15; s.crashes++;
      logs.push({ cls: "danger", text: "MARKET CRASH — index " + Math.round(indexRet * 100) + "%, speculative " + Math.round(hotRet * 100) + "%. Breathe. Sellers lock the loss; stayers ride the rebound." });
    } else if (roll < 0.16) {
      event = "bull"; indexRet = 0.26 + Math.random() * 0.08; hotRet = 0.6 + Math.random() * 0.3;
      logs.push({ cls: "good", text: "Bull run! Index +" + Math.round(indexRet * 100) + "%, speculative +" + Math.round(hotRet * 100) + "%. Notice it came unannounced — that's why you stay invested." });
    } else if (roll < 0.34) {
      const cost = 3000 + Math.round(Math.random() * 6000);
      event = "emergency";
      let remaining = cost;
      const fromCash = Math.min(s.cash, remaining); s.cash -= fromCash; remaining -= fromCash;
      if (remaining > 0) { const fromSav = Math.min(s.savings, remaining); s.savings -= fromSav; remaining -= fromSav; }
      if (remaining > 0) { const fromIdx = Math.min(s.index, remaining); s.index -= fromIdx; remaining -= fromIdx; if (fromIdx > 0) logs.push({ cls: "warn", text: "Had to sell " + this._f(fromIdx) + " of investments to cover it — this is why emergency funds exist." }); }
      if (remaining > 0) { s.debt += remaining; s.everDebt = true; logs.push({ cls: "danger", text: this._f(remaining) + " went on the credit card at 40% APR. Ouch." }); }
      logs.unshift({ cls: "warn", text: "EMERGENCY — surprise expense of " + this._f(cost) + " (car / medical / life)." });
    } else if (roll < 0.39) {
      const gift = 1500 + Math.round(Math.random() * 2500);
      s.cash += gift; event = "windfall";
      logs.push({ cls: "good", text: "Windfall! " + this._f(gift) + " bonus landed in cash." });
    }

    // returns
    const savInt = s.savings * 0.07;
    const idxGain = s.index * indexRet;
    const hotGain = s.hot * hotRet;
    s.savings += savInt; s.index += idxGain; s.hot += hotGain;
    if (s.debt > 0) { const dInt = s.debt * 0.40; s.debt += dInt; logs.push({ cls: "danger", text: "Debt grew " + this._f(dInt) + " at 40% APR — it compounds against you." }); }

    // allocate contribution
    if (contrib > 0) {
      const where = { mattress: "cash under the mattress", hysa: "high-yield savings", index: "the index fund", hot: "the hot stock", split: "savings + index (50/50)" }[s.strategy];
      if (s.strategy === "mattress") s.cash += contrib;
      else if (s.strategy === "hysa") s.savings += contrib;
      else if (s.strategy === "index") s.index += contrib;
      else if (s.strategy === "hot") s.hot += contrib;
      else { s.savings += contrib / 2; s.index += contrib / 2; }
      logs.push({ cls: "info", text: "Saved " + this._f(contrib) + " (" + s.rate + "% of salary) into " + where + "." });
    }

    // salary raise + baseline
    s.salary = Math.round(s.salary * 1.04);
    s.baseCash += s.salary * s.rate / 100;
    s.baseline.push(Math.round(s.baseCash));

    const nw = Math.round(s.cash + s.savings + s.index + s.hot - s.debt);
    s.history.push(nw);
    if (event === null && idxGain !== 0) {
      logs.push({ cls: "info", text: "Markets: index " + (indexRet >= 0 ? "+" : "") + Math.round(indexRet * 100) + "%, savings +7%." });
    }
    logs.forEach(l => s.log.unshift({ y: s.year, cls: l.cls, text: l.text }));
    s.log = s.log.slice(0, 40);

    if (s.year >= 20) {
      s.over = true;
      const L = Store.state.learn;
      L.sandbox.runs = (L.sandbox.runs || 0) + 1;
      L.sandbox.best = Math.max(L.sandbox.best || 0, nw);
      Store.save();
    }
  },

  finishSandbox() { this.session = null; },

  _f(n) { return fmtMoneyIn(Math.round(n), "USD", { compact: true }); },

  /* ============================== rendering ============================== */

  render() {
    if (this.session && this.session.type === "scenario") return this.renderScenario();
    if (this.session && this.session.type === "sandbox") return this.renderSandbox();
    return this.renderHome();
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
        '<p class="method-note" style="margin-top:14px">Money skills are learnable — and the earlier they click, the harder they compound. Play the scenarios, then test everything in the sandbox.</p>' +
      "</div>";

    const cards = SCENARIOS.map(sc => {
      const rec = L.scenarios[sc.id];
      const best = rec ? rec.best : null;
      const stars = best == null ? "" : (best >= 90 ? "★★★" : best >= 60 ? "★★☆" : "★☆☆");
      return '<div class="learn-card">' +
        '<div class="learn-card-icon">' + sc.icon + "</div>" +
        '<h3>' + sc.title + "</h3>" +
        '<p>' + sc.tagline + "</p>" +
        '<div class="learn-card-foot">' +
          (best != null
            ? '<span class="learn-stars" title="Best score">' + stars + ' <em>' + best + "/100</em></span>"
            : '<span class="learn-stars new">~3 min</span>') +
          '<button class="btn small ' + (best != null ? "ghost" : "primary") + '" data-action="learn-start" data-id="' + sc.id + '">' + (best != null ? "Replay" : "Play") + "</button>" +
        "</div></div>";
    }).join("");

    const sb = L.sandbox;
    const sandbox =
      '<div class="panel section sandbox-banner">' +
        '<div class="sb-banner-text">' +
          '<span class="micro-label">Sandbox game</span>' +
          '<h3>Wealth Builder — 20 Years</h3>' +
          "<p>Start at 25 with $5,000 and a $30,000 salary. Choose how much to save and where it goes, survive crashes and emergencies, and see what compounding does in 20 simulated years. Every run is different.</p>" +
          (sb.best ? '<div class="learn-stars">Best run: <em>' + fmtMoneyIn(sb.best, "USD", { compact: true }) + "</em> · " + (sb.runs || 0) + " run" + (sb.runs === 1 ? "" : "s") + "</div>" : "") +
        "</div>" +
        '<button class="btn primary" data-action="sb-start">' + (sb.runs ? "Play again" : "▶ Start the game") + "</button>" +
      "</div>";

    return header + '<div class="learn-grid section">' + cards + "</div>" + sandbox;
  },

  renderScenario() {
    const s = this.session;
    const sc = SCENARIOS.find(x => x.id === s.id);

    if (s.done) {
      const stars = s.score >= 90 ? "★★★" : s.score >= 60 ? "★★☆" : "★☆☆";
      const verdict = s.score >= 90 ? "Flawless — future-you is rich and grateful."
        : s.score >= 60 ? "Solid instincts — a couple of expensive habits to unlearn."
        : "Costly run — but cheaper to learn here than in real life. Replay it!";
      return '<div class="panel section learn-result">' +
        '<div class="learn-card-icon big">' + sc.icon + "</div>" +
        '<div class="learn-stars result">' + stars + "</div>" +
        '<h2>' + s.score + "/100</h2>" +
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
    const dots = sc.steps.map((_, i) =>
      '<span class="l-dot' + (i < s.step ? " past" : i === s.step ? " now" : "") + '"></span>').join("");

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

    return '<div class="panel section learn-play">' +
      '<div class="learn-play-head">' +
        '<button class="btn small ghost" data-action="learn-exit">← Exit</button>' +
        '<div class="l-dots">' + dots + "</div>" +
        '<div class="learn-score-chip">' + s.score + ' pts · <span class="' + (s.impact >= 0 ? "pos" : "neg") + '">' + (s.impact >= 0 ? "+" : "−") + fmtMoneyIn(Math.abs(s.impact), "USD", { compact: true }) + " / 10 yr</span></div>" +
      "</div>" +
      '<div class="learn-situation"><span class="learn-card-icon">' + sc.icon + "</span>" +
        (s.step === 0 ? '<p class="learn-intro">' + sc.intro + "</p>" : "") +
        "<h3>" + step.situation + "</h3></div>" +
      '<div class="learn-choices">' + choices + "</div>" +
      feedback +
    "</div>";
  },

  renderSandbox() {
    const s = this.session;
    const nw = Math.round(s.cash + s.savings + s.index + s.hot - s.debt);
    const base = s.baseline[s.baseline.length - 1];

    if (s.over) {
      const diff = nw - base;
      const grade = nw >= 450000 ? "S" : nw >= 300000 ? "A" : nw >= 200000 ? "B" : nw >= 100000 ? "C" : "D";
      const lessons = [];
      if (diff > 0) lessons.push("Your strategy beat the all-cash mattress saver by <strong>" + this._f(diff) + "</strong> — that gap is compounding at work.");
      else lessons.push("The mattress saver beat you this run — bad luck or heavy speculation? Diversified, boring strategies win most timelines.");
      if (s.crashes > 0) lessons.push("You survived " + s.crashes + " crash" + (s.crashes > 1 ? "es" : "") + ". Crashes are guaranteed over 20 years — plans that ignore them aren't plans.");
      if (s.everDebt) lessons.push("An emergency hit while your cash buffer was thin and became 40% APR debt. A small emergency fund earns nothing — until it saves everything.");
      else lessons.push("You never touched expensive debt — your liquid buffer quietly did its job.");
      return '<div class="panel section learn-result">' +
        '<div class="sb-grade">' + grade + "</div>" +
        "<h2>" + this._f(nw) + "</h2>" +
        '<p class="lr-verdict">Net worth at age 45 · started with $5,000</p>' +
        this._sbChart(s) +
        '<div class="lr-takeaways"><span class="micro-label">This run taught you</span><ul>' +
          lessons.map(l => "<li>" + l + "</li>").join("") + "</ul></div>" +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn" data-action="sb-start">↻ Run it again</button>' +
          '<button class="btn primary" data-action="sb-finish">Back to Learn</button>' +
        "</div></div>";
    }

    const rates = [10, 20, 35].map(r =>
      '<button class="sb-opt' + (s.rate === r ? " sel" : "") + '" data-action="sb-rate" data-id="' + r + '">' + r + "%</button>").join("");
    const strategies = [
      ["mattress", "🛏 Mattress", "0% — but always there"],
      ["hysa", "🏦 High-yield savings", "+7%/yr, steady"],
      ["index", "📈 Index fund", "~+9%/yr, bumpy"],
      ["hot", "🎰 Hot stock", "wild: −55% to +90%"],
      ["split", "⚖ Split 50/50", "savings + index"],
    ].map(x =>
      '<button class="sb-opt strat' + (s.strategy === x[0] ? " sel" : "") + '" data-action="sb-strategy" data-id="' + x[0] + '">' +
      "<strong>" + x[1] + "</strong><span>" + x[2] + "</span></button>").join("");

    const logHtml = s.log.slice(0, 12).map(l =>
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
        '<div class="sb-holdings">' +
          '<span>Cash <em>' + this._f(s.cash) + "</em></span>" +
          '<span>Savings <em>' + this._f(s.savings) + "</em></span>" +
          '<span>Index <em>' + this._f(s.index) + "</em></span>" +
          '<span>Hot stock <em>' + this._f(s.hot) + "</em></span>" +
          (s.debt > 0 ? '<span class="neg">Debt <em>−' + this._f(s.debt) + "</em></span>" : "") +
        "</div>" +
        '<span class="micro-label" style="display:block;margin:16px 0 6px">Savings rate</span>' +
        '<div class="sb-opts">' + rates + "</div>" +
        '<span class="micro-label" style="display:block;margin:16px 0 6px">New savings go to…</span>' +
        '<div class="sb-opts strat-grid">' + strategies + "</div>" +
        '<button class="btn primary sb-advance" data-action="sb-advance">▶ Live year ' + (s.year + 1) + "</button>" +
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
