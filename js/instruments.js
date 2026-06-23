/* ===================================================================
   FinanceOS — instrument classification & portfolio analytics (pure)
   ===================================================================
   The advanced portfolio view needs to know, for every position, its asset
   class, industry (sector) and geography — and for an ETF, how that single
   ticker spreads across many sectors/regions (the "look-through"). There is no
   reliable free, key-less API for this, so we ship a curated dataset of the
   instruments people actually hold (broad ETFs + large caps + Mexican names)
   and let the user override or fill in anything we don't know. Everything here
   is pure and local — no network. */

/* GICS-style sectors and the regions we bucket into. Kept as plain strings so
   they flow straight into labels and the override <select>s. */
const SECTORS = ["Technology", "Financials", "Health Care", "Consumer Discretionary",
  "Communication", "Industrials", "Consumer Staples", "Energy", "Utilities",
  "Materials", "Real Estate"];
const REGIONS = ["United States", "Developed ex-US", "Emerging Markets", "Mexico", "Global"];
const ASSET_CLASSES = ["Equity", "Bonds", "Real Estate", "Commodities", "Cash", "Crypto"];

/* A broad S&P-500-like sector mix, reused by US large-cap blend ETFs. */
const SP500_SECTORS = { "Technology": 31, "Financials": 13, "Health Care": 11,
  "Consumer Discretionary": 10, "Communication": 9, "Industrials": 8,
  "Consumer Staples": 6, "Energy": 4, "Utilities": 2.5, "Materials": 2, "Real Estate": 2.5 };
const NASDAQ_SECTORS = { "Technology": 50, "Communication": 15, "Consumer Discretionary": 13,
  "Health Care": 6, "Consumer Staples": 4, "Industrials": 5, "Utilities": 1, "Financials": 6 };

/* symbol → classification. `sectors`/`regions` are weight maps (any positive
   scale; normalized at use). Single stocks use a single `sector`/`region`. */
const INSTRUMENTS = {
  // ---- US broad-market equity ETFs ----
  "VOO": { name: "Vanguard S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "IVV": { name: "iShares Core S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "SPY": { name: "SPDR S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "VTI": { name: "Vanguard Total US Market", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "ITOT": { name: "iShares Core Total US", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "QQQ": { name: "Invesco QQQ (Nasdaq 100)", assetClass: "Equity", sectors: NASDAQ_SECTORS, regions: { "United States": 100 } },
  "QQQM": { name: "Invesco Nasdaq 100", assetClass: "Equity", sectors: NASDAQ_SECTORS, regions: { "United States": 100 } },
  "VUG": { name: "Vanguard Growth", assetClass: "Equity", sectors: { "Technology": 45, "Consumer Discretionary": 18, "Communication": 12, "Industrials": 8, "Health Care": 8, "Financials": 6, "Consumer Staples": 3 }, regions: { "United States": 100 } },
  "VTV": { name: "Vanguard Value", assetClass: "Equity", sectors: { "Financials": 22, "Health Care": 18, "Industrials": 13, "Consumer Staples": 11, "Energy": 9, "Technology": 9, "Utilities": 7, "Consumer Discretionary": 5, "Materials": 4, "Communication": 2 }, regions: { "United States": 100 } },
  // ---- international / global equity ETFs ----
  "VXUS": { name: "Vanguard Total International", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "Developed ex-US": 75, "Emerging Markets": 25 } },
  "VEA": { name: "Vanguard Developed Markets", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "Developed ex-US": 100 } },
  "VWO": { name: "Vanguard Emerging Markets", assetClass: "Equity", sectors: { "Technology": 24, "Financials": 22, "Consumer Discretionary": 14, "Communication": 10, "Materials": 8, "Energy": 6, "Industrials": 6, "Consumer Staples": 6, "Health Care": 4 }, regions: { "Emerging Markets": 100 } },
  "VT": { name: "Vanguard Total World", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 60, "Developed ex-US": 28, "Emerging Markets": 12 } },
  "ACWI": { name: "iShares MSCI ACWI", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 62, "Developed ex-US": 26, "Emerging Markets": 12 } },
  // ---- Mexico ----
  "NAFTRAC": { name: "iShares NAFTRAC (IPC)", assetClass: "Equity", sectors: { "Consumer Staples": 24, "Financials": 20, "Materials": 16, "Communication": 14, "Industrials": 12, "Consumer Discretionary": 8, "Real Estate": 6 }, regions: { "Mexico": 100 } },
  "MEXTRAC": { name: "Mexico equity", assetClass: "Equity", sectors: { "Consumer Staples": 24, "Financials": 20, "Materials": 16, "Communication": 14, "Industrials": 12, "Consumer Discretionary": 8, "Real Estate": 6 }, regions: { "Mexico": 100 } },
  // ---- bonds / income ----
  "BND": { name: "Vanguard Total Bond", assetClass: "Bonds", regions: { "United States": 100 } },
  "AGG": { name: "iShares Core US Bond", assetClass: "Bonds", regions: { "United States": 100 } },
  "BNDX": { name: "Vanguard Intl Bond", assetClass: "Bonds", regions: { "Developed ex-US": 100 } },
  "TLT": { name: "iShares 20+ Yr Treasury", assetClass: "Bonds", regions: { "United States": 100 } },
  "CETETRC": { name: "CETES tracker", assetClass: "Bonds", regions: { "Mexico": 100 } },
  // ---- real estate / commodities / crypto ----
  "VNQ": { name: "Vanguard Real Estate", assetClass: "Real Estate", regions: { "United States": 100 } },
  "GLD": { name: "SPDR Gold", assetClass: "Commodities", regions: { "Global": 100 } },
  "IAU": { name: "iShares Gold", assetClass: "Commodities", regions: { "Global": 100 } },
  "BITO": { name: "ProShares Bitcoin", assetClass: "Crypto", regions: { "Global": 100 } },
  "BTC": { name: "Bitcoin", assetClass: "Crypto", regions: { "Global": 100 } },
  "ETH": { name: "Ethereum", assetClass: "Crypto", regions: { "Global": 100 } },
  // ---- US large-cap single stocks ----
  "AAPL": { name: "Apple", assetClass: "Equity", sector: "Technology", region: "United States" },
  "MSFT": { name: "Microsoft", assetClass: "Equity", sector: "Technology", region: "United States" },
  "NVDA": { name: "NVIDIA", assetClass: "Equity", sector: "Technology", region: "United States" },
  "AVGO": { name: "Broadcom", assetClass: "Equity", sector: "Technology", region: "United States" },
  "ORCL": { name: "Oracle", assetClass: "Equity", sector: "Technology", region: "United States" },
  "CRM": { name: "Salesforce", assetClass: "Equity", sector: "Technology", region: "United States" },
  "AMD": { name: "AMD", assetClass: "Equity", sector: "Technology", region: "United States" },
  "GOOGL": { name: "Alphabet", assetClass: "Equity", sector: "Communication", region: "United States" },
  "GOOG": { name: "Alphabet", assetClass: "Equity", sector: "Communication", region: "United States" },
  "META": { name: "Meta Platforms", assetClass: "Equity", sector: "Communication", region: "United States" },
  "NFLX": { name: "Netflix", assetClass: "Equity", sector: "Communication", region: "United States" },
  "DIS": { name: "Disney", assetClass: "Equity", sector: "Communication", region: "United States" },
  "AMZN": { name: "Amazon", assetClass: "Equity", sector: "Consumer Discretionary", region: "United States" },
  "TSLA": { name: "Tesla", assetClass: "Equity", sector: "Consumer Discretionary", region: "United States" },
  "HD": { name: "Home Depot", assetClass: "Equity", sector: "Consumer Discretionary", region: "United States" },
  "NKE": { name: "Nike", assetClass: "Equity", sector: "Consumer Discretionary", region: "United States" },
  "MCD": { name: "McDonald's", assetClass: "Equity", sector: "Consumer Discretionary", region: "United States" },
  "JPM": { name: "JPMorgan Chase", assetClass: "Equity", sector: "Financials", region: "United States" },
  "BAC": { name: "Bank of America", assetClass: "Equity", sector: "Financials", region: "United States" },
  "V": { name: "Visa", assetClass: "Equity", sector: "Financials", region: "United States" },
  "MA": { name: "Mastercard", assetClass: "Equity", sector: "Financials", region: "United States" },
  "BRK.B": { name: "Berkshire Hathaway", assetClass: "Equity", sector: "Financials", region: "United States" },
  "UNH": { name: "UnitedHealth", assetClass: "Equity", sector: "Health Care", region: "United States" },
  "JNJ": { name: "Johnson & Johnson", assetClass: "Equity", sector: "Health Care", region: "United States" },
  "LLY": { name: "Eli Lilly", assetClass: "Equity", sector: "Health Care", region: "United States" },
  "PFE": { name: "Pfizer", assetClass: "Equity", sector: "Health Care", region: "United States" },
  "ABBV": { name: "AbbVie", assetClass: "Equity", sector: "Health Care", region: "United States" },
  "XOM": { name: "Exxon Mobil", assetClass: "Equity", sector: "Energy", region: "United States" },
  "CVX": { name: "Chevron", assetClass: "Equity", sector: "Energy", region: "United States" },
  "PG": { name: "Procter & Gamble", assetClass: "Equity", sector: "Consumer Staples", region: "United States" },
  "KO": { name: "Coca-Cola", assetClass: "Equity", sector: "Consumer Staples", region: "United States" },
  "PEP": { name: "PepsiCo", assetClass: "Equity", sector: "Consumer Staples", region: "United States" },
  "WMT": { name: "Walmart", assetClass: "Equity", sector: "Consumer Staples", region: "United States" },
  "COST": { name: "Costco", assetClass: "Equity", sector: "Consumer Staples", region: "United States" },
  "CAT": { name: "Caterpillar", assetClass: "Equity", sector: "Industrials", region: "United States" },
  "BA": { name: "Boeing", assetClass: "Equity", sector: "Industrials", region: "United States" },
  "GE": { name: "GE Aerospace", assetClass: "Equity", sector: "Industrials", region: "United States" },
  "LIN": { name: "Linde", assetClass: "Equity", sector: "Materials", region: "United States" },
  "NEE": { name: "NextEra Energy", assetClass: "Equity", sector: "Utilities", region: "United States" },
  // ---- Mexican single names (BMV) ----
  "WALMEX": { name: "Walmart de México", assetClass: "Equity", sector: "Consumer Staples", region: "Mexico" },
  "GFNORTE": { name: "Banorte", assetClass: "Equity", sector: "Financials", region: "Mexico" },
  "AMXL": { name: "América Móvil", assetClass: "Equity", sector: "Communication", region: "Mexico" },
  "FEMSA": { name: "FEMSA", assetClass: "Equity", sector: "Consumer Staples", region: "Mexico" },
  "GMEXICO": { name: "Grupo México", assetClass: "Equity", sector: "Materials", region: "Mexico" },
  "CEMEX": { name: "Cemex", assetClass: "Equity", sector: "Materials", region: "Mexico" },
  "BIMBO": { name: "Grupo Bimbo", assetClass: "Equity", sector: "Consumer Staples", region: "Mexico" },
};

/* normalize a weight map to fractions summing to 1 */
function _normWeights(map) {
  const out = {};
  let sum = 0;
  Object.keys(map || {}).forEach(k => { const v = Number(map[k]) || 0; if (v > 0) { out[k] = v; sum += v; } });
  if (sum <= 0) return null;
  Object.keys(out).forEach(k => { out[k] = out[k] / sum; });
  return out;
}

/* Resolve one holding to { assetClass, sectors{w}, regions{w}, source } where
   the weight maps sum to 1. Order of truth: the user's per-holding overrides
   (h.cls) → the curated dataset → a sane default by type. Non-equity classes
   that have no sector data bucket into their own asset class so the sector view
   still adds up to 100%. */
function classifyHolding(h) {
  const sym = String((h && h.symbol) || "").toUpperCase();
  const info = INSTRUMENTS[sym] || null;
  const ov = (h && h.cls) || {};
  const assetClass = ov.assetClass || (info && info.assetClass) || "Equity";

  let sectors = null;
  if (ov.sector) sectors = { [ov.sector]: 1 };
  else if (info && info.sectors) sectors = _normWeights(info.sectors);
  else if (info && info.sector) sectors = { [info.sector]: 1 };
  if (!sectors) sectors = assetClass === "Equity" ? { "Unclassified": 1 } : { [assetClass]: 1 };

  let regions = null;
  if (ov.region) regions = { [ov.region]: 1 };
  else if (info && info.regions) regions = _normWeights(info.regions);
  else if (info && info.region) regions = { [info.region]: 1 };
  if (!regions) regions = { "Unclassified": 1 };

  return {
    assetClass: assetClass, sectors: sectors, regions: regions,
    name: (info && info.name) || (h && h.name) || sym,
    known: !!info || !!ov.assetClass || !!ov.sector || !!ov.region,
  };
}

/* Portfolio exposure with ETF look-through. Spreads each position's market
   value (in the display currency) across sectors, regions and asset classes by
   its classification weights, then returns sorted [{name,value,pct}] lists plus
   a concentration score (Herfindahl on sectors) and the unclassified share. */
function portfolioExposure() {
  const holdings = (Store.state.holdings || []);
  const sec = {}, reg = {}, ac = {};
  let total = 0;
  holdings.forEach(h => {
    const mv = conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
    if (!(mv > 0)) return;
    total += mv;
    const c = classifyHolding(h);
    ac[c.assetClass] = (ac[c.assetClass] || 0) + mv;
    Object.keys(c.sectors).forEach(k => { sec[k] = (sec[k] || 0) + mv * c.sectors[k]; });
    Object.keys(c.regions).forEach(k => { reg[k] = (reg[k] || 0) + mv * c.regions[k]; });
  });
  const toList = (obj) => Object.keys(obj).map(k => ({ name: k, value: obj[k], pct: total > 0 ? obj[k] / total * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
  const sectors = toList(sec);
  // Herfindahl-Hirschman index on sector shares (0..1): higher = more concentrated
  const hhi = sectors.reduce((a, s) => a + Math.pow(s.pct / 100, 2), 0);
  const uncl = (sec["Unclassified"] || 0) + (reg["Unclassified"] || 0) / 2;
  return {
    total: total,
    byAssetClass: toList(ac), bySector: sectors, byRegion: toList(reg),
    hhi: hhi, concentration: hhi >= 0.25 ? "high" : hhi >= 0.15 ? "moderate" : "diversified",
    topSector: sectors[0] || null,
    unclassifiedPct: total > 0 ? (sec["Unclassified"] || 0) / total * 100 : 0,
  };
}

/* ---------- risk math (pure; operate on close-price series) ----------
   A "series" here is an array of { t, c } points (t = ms, c = close). */

/* simple period returns c[i]/c[i-1] − 1, skipping non-positive closes */
function seriesReturns(points) {
  const out = [];
  for (let i = 1; i < (points || []).length; i++) {
    const a = points[i - 1] && points[i - 1].c, b = points[i] && points[i].c;
    if (a > 0 && b > 0) out.push(b / a - 1);
  }
  return out;
}

function _mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function _stdev(a) {
  if (a.length < 2) return 0;
  const m = _mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

/* annualized volatility from a return series, given periods/year (≈252 daily,
   52 weekly, 12 monthly) */
function annualizedVol(returns, ppy) {
  return _stdev(returns) * Math.sqrt(Math.max(1, ppy || 252));
}

/* Align two close-price series on shared timestamps, then return their paired
   period returns — so beta/correlation compare like-for-like dates. */
function alignReturns(aPts, bPts) {
  const bm = {};
  (bPts || []).forEach(p => { if (p && p.c > 0) bm[p.t] = p.c; });
  const ac = [], bc = [];
  (aPts || []).forEach(p => { if (p && p.c > 0 && bm[p.t] > 0) { ac.push(p.c); bc.push(bm[p.t]); } });
  const ar = [], br = [];
  for (let i = 1; i < ac.length; i++) { ar.push(ac[i] / ac[i - 1] - 1); br.push(bc[i] / bc[i - 1] - 1); }
  return { a: ar, b: br };
}

/* beta = cov(asset, market) / var(market); ~1 moves with the market, >1 swings
   harder, <1 is steadier. Returns null when there isn't enough overlap. */
function betaOf(assetPts, marketPts) {
  const { a, b } = alignReturns(assetPts, marketPts);
  if (a.length < 8) return null;
  const ma = _mean(a), mb = _mean(b);
  let cov = 0, varb = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); varb += (b[i] - mb) * (b[i] - mb); }
  return varb > 0 ? cov / varb : null;
}

/* correlation coefficient of two aligned series (−1..1), or null */
function correlationOf(assetPts, marketPts) {
  const { a, b } = alignReturns(assetPts, marketPts);
  if (a.length < 8) return null;
  const sa = _stdev(a), sb = _stdev(b);
  if (sa <= 0 || sb <= 0) return null;
  const ma = _mean(a), mb = _mean(b);
  let cov = 0;
  for (let i = 0; i < a.length; i++) cov += (a[i] - ma) * (b[i] - mb);
  cov /= (a.length - 1);
  return cov / (sa * sb);
}

/* Build a weighted portfolio value series from several holdings' price series,
   each valued at CURRENT shares × historical local close × (current) FX factor.
   Calendars rarely line up across listings, so we forward-fill each holding onto
   the union timeline (its last known close as of each date). Returns [{t,v}].
   items: [{ shares, fx, points:[{t,c}] }] — pure, testable. */
function weightedValueSeries(items) {
  const list = (items || []).filter(it => it && it.points && it.points.length);
  if (!list.length) return [];
  const tset = {};
  list.forEach(it => it.points.forEach(p => { if (p && p.c > 0) tset[p.t] = true; }));
  const times = Object.keys(tset).map(Number).sort((a, b) => a - b);
  if (times.length < 2) return [];
  // pre-sort each holding's points and walk a pointer per holding (forward-fill)
  const cursors = list.map(it => ({
    shares: Number(it.shares) || 0, fx: it.fx != null ? Number(it.fx) : 1,
    pts: it.points.slice().filter(p => p && p.c > 0).sort((a, b) => a.t - b.t),
    i: 0, last: null,
  }));
  const out = [];
  times.forEach(t => {
    let v = 0;
    cursors.forEach(c => {
      while (c.i < c.pts.length && c.pts[c.i].t <= t) { c.last = c.pts[c.i].c; c.i++; }
      if (c.last == null && c.pts.length) c.last = c.pts[0].c;   // before first close → use first
      if (c.last != null) v += c.shares * c.last * c.fx;
    });
    out.push({ t: t, v: v });
  });
  return out;
}

/* return of a {t,v} (or {t,c}) series over the last `days`, measured from the
   first point on/after the lookback date to the final point. null if too short. */
function seriesReturnOver(series, days) {
  const s = series || [];
  if (s.length < 2) return null;
  const val = p => (p.v != null ? p.v : p.c);
  const lastT = s[s.length - 1].t, cutoff = lastT - days * 86400000;
  if (s[0].t > cutoff) return null;                  // series doesn't reach back that far
  let base = null;
  for (let i = 0; i < s.length; i++) { if (s[i].t >= cutoff) { base = val(s[i]); break; } }
  const end = val(s[s.length - 1]);
  return base > 0 ? end / base - 1 : null;
}

/* periods/year implied by a series' median spacing (for annualizing vol) */
function periodsPerYear(points) {
  const p = points || [];
  if (p.length < 3) return 252;
  const gaps = [];
  for (let i = 1; i < p.length; i++) gaps.push(p[i].t - p[i - 1].t);
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)] / 86400000;   // days
  if (med <= 2.5) return 252;
  if (med <= 10) return 52;
  return 12;
}
