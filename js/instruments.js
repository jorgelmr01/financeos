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
  "VOO": { er: 0.03, name: "Vanguard S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "IVV": { er: 0.03, name: "iShares Core S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "SPY": { er: 0.09, name: "SPDR S&P 500", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "VTI": { er: 0.03, name: "Vanguard Total US Market", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "ITOT": { er: 0.03, name: "iShares Core Total US", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 100 } },
  "QQQ": { er: 0.2, name: "Invesco QQQ (Nasdaq 100)", assetClass: "Equity", sectors: NASDAQ_SECTORS, regions: { "United States": 100 } },
  "QQQM": { er: 0.15, name: "Invesco Nasdaq 100", assetClass: "Equity", sectors: NASDAQ_SECTORS, regions: { "United States": 100 } },
  "VUG": { er: 0.04, name: "Vanguard Growth", assetClass: "Equity", sectors: { "Technology": 45, "Consumer Discretionary": 18, "Communication": 12, "Industrials": 8, "Health Care": 8, "Financials": 6, "Consumer Staples": 3 }, regions: { "United States": 100 } },
  "VTV": { er: 0.04, name: "Vanguard Value", assetClass: "Equity", sectors: { "Financials": 22, "Health Care": 18, "Industrials": 13, "Consumer Staples": 11, "Energy": 9, "Technology": 9, "Utilities": 7, "Consumer Discretionary": 5, "Materials": 4, "Communication": 2 }, regions: { "United States": 100 } },
  // ---- international / global equity ETFs ----
  "VXUS": { er: 0.07, name: "Vanguard Total International", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "Developed ex-US": 75, "Emerging Markets": 25 } },
  "VEA": { er: 0.05, name: "Vanguard Developed Markets", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "Developed ex-US": 100 } },
  "VWO": { er: 0.08, name: "Vanguard Emerging Markets", assetClass: "Equity", sectors: { "Technology": 24, "Financials": 22, "Consumer Discretionary": 14, "Communication": 10, "Materials": 8, "Energy": 6, "Industrials": 6, "Consumer Staples": 6, "Health Care": 4 }, regions: { "Emerging Markets": 100 } },
  "VT": { er: 0.07, name: "Vanguard Total World", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 60, "Developed ex-US": 28, "Emerging Markets": 12 } },
  "ACWI": { er: 0.32, name: "iShares MSCI ACWI", assetClass: "Equity", sectors: SP500_SECTORS, regions: { "United States": 62, "Developed ex-US": 26, "Emerging Markets": 12 } },
  // ---- Mexico ----
  "NAFTRAC": { er: 0.14, name: "iShares NAFTRAC (IPC)", assetClass: "Equity", sectors: { "Consumer Staples": 24, "Financials": 20, "Materials": 16, "Communication": 14, "Industrials": 12, "Consumer Discretionary": 8, "Real Estate": 6 }, regions: { "Mexico": 100 } },
  "MEXTRAC": { name: "Mexico equity", assetClass: "Equity", sectors: { "Consumer Staples": 24, "Financials": 20, "Materials": 16, "Communication": 14, "Industrials": 12, "Consumer Discretionary": 8, "Real Estate": 6 }, regions: { "Mexico": 100 } },
  // ---- bonds / income ----
  "BND": { er: 0.03, name: "Vanguard Total Bond", assetClass: "Bonds", regions: { "United States": 100 } },
  "AGG": { er: 0.03, name: "iShares Core US Bond", assetClass: "Bonds", regions: { "United States": 100 } },
  "BNDX": { er: 0.07, name: "Vanguard Intl Bond", assetClass: "Bonds", regions: { "Developed ex-US": 100 } },
  "TLT": { er: 0.15, name: "iShares 20+ Yr Treasury", assetClass: "Bonds", regions: { "United States": 100 } },
  "CETETRC": { name: "CETES tracker", assetClass: "Bonds", regions: { "Mexico": 100 } },
  // ---- real estate / commodities / crypto ----
  "VNQ": { er: 0.13, name: "Vanguard Real Estate", assetClass: "Real Estate", regions: { "United States": 100 } },
  "GLD": { er: 0.4, name: "SPDR Gold", assetClass: "Commodities", regions: { "Global": 100 } },
  "IAU": { er: 0.25, name: "iShares Gold", assetClass: "Commodities", regions: { "Global": 100 } },
  "BITO": { er: 0.95, name: "ProShares Bitcoin", assetClass: "Crypto", regions: { "Global": 100 } },
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
  "KOF": { name: "Coca-Cola FEMSA", assetClass: "Equity", sector: "Consumer Staples", region: "Mexico" },
  "TLEVISA": { name: "Grupo Televisa", assetClass: "Equity", sector: "Communication", region: "Mexico" },
  "ELEKTRA": { name: "Grupo Elektra", assetClass: "Equity", sector: "Consumer Discretionary", region: "Mexico" },
  "ALSEA": { name: "Alsea", assetClass: "Equity", sector: "Consumer Discretionary", region: "Mexico" },
  "GAP": { name: "Grupo Aeroportuario del Pacífico", assetClass: "Equity", sector: "Industrials", region: "Mexico" },
  "ASUR": { name: "Grupo Aeroportuario del Sureste", assetClass: "Equity", sector: "Industrials", region: "Mexico" },
  "OMA": { name: "Grupo Aeroportuario Centro Norte", assetClass: "Equity", sector: "Industrials", region: "Mexico" },
  "PINFRA": { name: "Pinfra", assetClass: "Equity", sector: "Industrials", region: "Mexico" },
  "ORBIA": { name: "Orbia", assetClass: "Equity", sector: "Materials", region: "Mexico" },
  "PEÑOLES": { name: "Industrias Peñoles", assetClass: "Equity", sector: "Materials", region: "Mexico" },
  "KIMBER": { name: "Kimberly-Clark de México", assetClass: "Equity", sector: "Consumer Staples", region: "Mexico" },
  "LIVEPOL": { name: "Liverpool", assetClass: "Equity", sector: "Consumer Discretionary", region: "Mexico" },
  "GCARSO": { name: "Grupo Carso", assetClass: "Equity", sector: "Industrials", region: "Mexico" },
  "BBAJIO": { name: "Banco del Bajío", assetClass: "Equity", sector: "Financials", region: "Mexico" },
  "GENTERA": { name: "Gentera", assetClass: "Equity", sector: "Financials", region: "Mexico" },
  "Q": { name: "Quálitas", assetClass: "Equity", sector: "Financials", region: "Mexico" },
  // FIBRAs (Mexican REITs) — real estate, Mexico
  "FUNO": { name: "Fibra Uno", assetClass: "Real Estate", region: "Mexico" },
  "FIBRAPL": { name: "Fibra Prologis", assetClass: "Real Estate", region: "Mexico" },
  "FIBRAMQ": { name: "Fibra Macquarie", assetClass: "Real Estate", region: "Mexico" },
  "FUNO11": { name: "Fibra Uno", assetClass: "Real Estate", region: "Mexico" },
  "FMTY": { name: "Fibra Mty", assetClass: "Real Estate", region: "Mexico" },
  "TERRA": { name: "Terrafina", assetClass: "Real Estate", region: "Mexico" },
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

/* ---- Finnhub free-tier enrichment helpers ----
   With an (optional, free) Finnhub key the app auto-classifies single stocks
   from /stock/profile2 (its `finnhubIndustry` + ISO `country`). Finnhub uses its
   own ~130 industry labels, so map them to our GICS-style sectors by keyword;
   fall back to the closest bucket. Pure string → string. */
function finnhubSectorToGICS(industry) {
  const s = String(industry || "").toLowerCase();
  if (!s) return null;
  const has = (...ks) => ks.some(k => s.indexOf(k) >= 0);
  if (has("semiconduct", "software", "technology", "hardware", "electronic", "it services", "internet")) return "Technology";
  if (has("bank", "insurance", "financial", "capital markets", "asset manage", "credit")) return "Financials";
  if (has("pharma", "biotech", "health", "medical", "life sciences", "drug")) return "Health Care";
  if (has("retail", "apparel", "automobil", "auto ", "leisure", "hotel", "restaurant", "consumer discretionary", "e-commerce", "homebuild", "luxury")) return "Consumer Discretionary";
  if (has("media", "telecom", "communication", "entertainment", "publishing", "advertis")) return "Communication";
  if (has("food", "beverage", "tobacco", "household", "personal product", "consumer staples", "grocery")) return "Consumer Staples";
  if (has("oil", "gas", "energy", "coal", "petroleum")) return "Energy";
  if (has("utilit", "electric", "water", "power")) return "Utilities";
  if (has("chemical", "metal", "mining", "material", "steel", "paper", "forest")) return "Materials";
  if (has("real estate", "reit", "property")) return "Real Estate";
  if (has("aerospace", "defense", "machinery", "industrial", "transport", "logistic", "airline", "construction", "engineering", "manufactur")) return "Industrials";
  return null;
}

/* a few small ISO-3166 alpha-2 → region buckets; everything else → Developed/EM
   by a short list, defaulting to Developed ex-US. */
const _EMERGING = { MX: 1, BR: 1, AR: 1, CL: 1, CO: 1, PE: 1, CN: 1, IN: 1, ID: 1, TH: 1, MY: 1, PH: 1, VN: 1, ZA: 1, TR: 1, RU: 1, EG: 1, SA: 1, AE: 1, QA: 1, PL: 1, HU: 1, GR: 1, TW: 1 };
function countryToRegion(code) {
  const cc = String(code || "").toUpperCase();
  if (!cc) return null;
  if (cc === "US") return "United States";
  if (cc === "MX") return "Mexico";
  if (_EMERGING[cc]) return "Emerging Markets";
  return "Developed ex-US";
}

/* Resolve one holding to { assetClass, sectors{w}, regions{w}, source } where
   the weight maps sum to 1. Order of truth: the user's per-holding overrides
   (h.cls) → the curated dataset (ETF look-through lives here) → Finnhub auto-
   classification (h.autoCls, single sector/region for stocks) → a sane default
   by type. Non-equity classes with no sector data bucket into their own asset
   class so the sector view still adds up to 100%. */
function classifyHolding(h) {
  const sym = String((h && h.symbol) || "").toUpperCase();
  const info = INSTRUMENTS[sym] || null;
  const ov = (h && h.cls) || {};
  const auto = (h && h.autoCls) || {};
  const assetClass = ov.assetClass || (info && info.assetClass) || auto.assetClass || "Equity";

  let sectors = null, secSource = null;
  if (ov.sector) { sectors = { [ov.sector]: 1 }; secSource = "you"; }
  else if (info && info.sectors) { sectors = _normWeights(info.sectors); secSource = "dataset"; }
  else if (info && info.sector) { sectors = { [info.sector]: 1 }; secSource = "dataset"; }
  else if (auto.sector) { sectors = { [auto.sector]: 1 }; secSource = "finnhub"; }
  if (!sectors) sectors = assetClass === "Equity" ? { "Unclassified": 1 } : { [assetClass]: 1 };

  let regions = null;
  if (ov.region) regions = { [ov.region]: 1 };
  else if (info && info.regions) regions = _normWeights(info.regions);
  else if (info && info.region) regions = { [info.region]: 1 };
  else if (auto.region) regions = { [auto.region]: 1 };
  if (!regions) regions = { "Unclassified": 1 };

  return {
    assetClass: assetClass, sectors: sectors, regions: regions, source: secSource,
    name: (info && info.name) || (h && h.name) || sym,
    known: !!info || !!ov.assetClass || !!ov.sector || !!ov.region || !!auto.sector || !!auto.region,
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

/* Projected dividend income from the holdings as they stand (shares × dividend
   per share, in the display currency). Yield is income ÷ market value; yield on
   cost is income ÷ what you paid — the number that quietly grows as a position
   appreciates. Pure-ish: reads Store + conv at call time. */
function dividendSummary() {
  const hs = (Store.state.holdings || []);
  let annual = 0, mv = 0, cost = 0;
  const rows = [];
  hs.forEach(h => {
    const shares = Number(h.shares) || 0, dps = Number(h.divPerShare) || 0;
    const inc = conv(shares * dps, h.currency);
    const m = conv(shares * (Number(h.currentPrice) || 0), h.currency);
    const c = conv(shares * (Number(h.costBasis) || 0), h.currency);
    mv += m; cost += c;
    if (inc > 0) { annual += inc; rows.push({ symbol: h.symbol, name: h.name || h.symbol, annual: inc, yield: m > 0 ? inc / m * 100 : 0, yieldOnCost: c > 0 ? inc / c * 100 : 0, mv: m }); }
  });
  rows.sort((a, b) => b.annual - a.annual);
  return {
    annual: annual, monthly: annual / 12,
    portfolioYield: mv > 0 ? annual / mv * 100 : 0,
    yieldOnCost: cost > 0 ? annual / cost * 100 : 0,
    rows: rows, payers: rows.length, positions: hs.length, marketValue: mv,
  };
}

/* Drawdown analysis from a value (or close) series: the "underwater" curve
   (value ÷ running peak − 1, always ≤ 0), the worst peak-to-trough fall, and
   how far below the all-time high you sit right now. This is the risk that
   volatility hides — the gut-punch of watching the pile shrink. Pure. */
function drawdownInfo(series) {
  const s = series || [];
  const val = p => (p.v != null ? p.v : p.c);
  if (s.length < 2) return null;
  let peak = val(s[0]), peakT = s[0].t, maxDD = 0, troughT = s[0].t, ddPeakT = s[0].t;
  const under = [];
  for (let i = 0; i < s.length; i++) {
    const v = val(s[i]);
    if (v > peak) { peak = v; peakT = s[i].t; }
    const dd = peak > 0 ? v / peak - 1 : 0;
    under.push({ t: s[i].t, dd: dd });
    if (dd < maxDD) { maxDD = dd; troughT = s[i].t; ddPeakT = peakT; }
  }
  const last = val(s[s.length - 1]);
  const currentDD = peak > 0 ? last / peak - 1 : 0;
  return {
    series: under, maxDD: maxDD, maxDDPeakT: ddPeakT, maxDDTroughT: troughT,
    currentDD: currentDD, recovered: currentDD >= -0.001,
    fellFrom: peak,
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

/* ---------- money-weighted return (XIRR) ----------
   The IRR of dated cashflows — the return YOUR pesos actually earned, which
   time-weighted charts can't tell you. flows: [{t: ms, v}] with v<0 invested,
   v>0 received. Newton's method with a bisection fallback; null if it can't
   bracket a root (e.g. all flows the same sign). */
function xirr(flows) {
  const f = (flows || []).filter(x => x && isFinite(x.v) && x.v !== 0 && x.t != null).sort((a, b) => a.t - b.t);
  if (f.length < 2) return null;
  const hasNeg = f.some(x => x.v < 0), hasPos = f.some(x => x.v > 0);
  if (!hasNeg || !hasPos) return null;
  const t0 = f[0].t, YR = 365.25 * 86400000;
  const npv = r => f.reduce((a, x) => a + x.v / Math.pow(1 + r, (x.t - t0) / YR), 0);
  // bracket a sign change, then bisect (robust against Newton divergence)
  let lo = -0.9999, hi = 10;
  let flo = npv(lo), fhi = npv(hi);
  if (flo * fhi > 0) {
    hi = 100; fhi = npv(hi);
    if (flo * fhi > 0) return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/* dated cashflows for the CURRENT holdings: each purchase out, today's market
   value back in. Honest about limits: dividends and sold positions are not in
   the flows, and holdings without a purchase date are excluded (counted). */
function portfolioXirrFlows(now) {
  const t = now || todayMid().getTime();
  const flows = [];
  let excluded = 0, value = 0;
  (Store.state.holdings || []).forEach(h => {
    const d = parseISO(h.purchaseDate);
    const cost = conv((Number(h.shares) || 0) * (Number(h.costBasis) || 0), h.currency);
    const mv = conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
    if (!d || !(cost > 0)) { excluded++; return; }
    flows.push({ t: d.getTime(), v: -cost });
    value += mv;
  });
  if (value > 0) flows.push({ t: t, v: value });
  return { flows: flows, excluded: excluded, value: value };
}

/* Sharpe & Sortino from a value series: annualized geometric return over the
   risk-free rate, per unit of (downside) volatility. rf in % annual. */
function riskAdjusted(points, ppy, rfPct) {
  const rets = seriesReturns(points);
  if (rets.length < 8) return null;
  const n = points.length;
  const first = points[0].c != null ? points[0].c : points[0].v;
  const last = points[n - 1].c != null ? points[n - 1].c : points[n - 1].v;
  if (!(first > 0) || !(last > 0)) return null;
  const annRet = Math.pow(last / first, ppy / (n - 1)) - 1;
  const rf = (Number(rfPct) || 0) / 100;
  const vol = annualizedVol(rets, ppy);
  const rfPer = Math.pow(1 + rf, 1 / ppy) - 1;
  const downs = rets.filter(r => r < rfPer).map(r => r - rfPer);
  const ddev = downs.length ? Math.sqrt(downs.reduce((a, x) => a + x * x, 0) / rets.length) * Math.sqrt(ppy) : 0;
  return {
    annRet: annRet, vol: vol,
    sharpe: vol > 0 ? (annRet - rf) / vol : null,
    sortino: ddev > 0 ? (annRet - rf) / ddev : null,
  };
}

/* ---------- rebalancing vs a target allocation ----------
   targets: { assetClass: pct }. Compares against the live look-through
   exposure and says how many pesos each class is over/under — informational,
   never "buy X". Unlisted classes target 0. */
function rebalancePlan(targets) {
  const e = portfolioExposure();
  if (!(e.total > 0)) return null;
  const tgt = targets || {};
  const classes = {};
  e.byAssetClass.forEach(c => { classes[c.name] = { cur: c.pct, value: c.value }; });
  Object.keys(tgt).forEach(k => { if (!classes[k]) classes[k] = { cur: 0, value: 0 }; });
  const sumT = Object.keys(tgt).reduce((a, k) => a + (Number(tgt[k]) || 0), 0);
  const rows = Object.keys(classes).map(k => {
    const target = Number(tgt[k]) || 0;
    const drift = classes[k].cur - target;
    return { name: k, current: classes[k].cur, target: target, drift: drift,
      move: Math.round(-drift / 100 * e.total * 100) / 100 };   // + = add, − = trim
  }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  const maxDrift = rows.length ? Math.abs(rows[0].drift) : 0;
  return { rows: rows, total: e.total, targetSum: sumT, maxDrift: maxDrift,
    balanced: maxDrift <= 5 };                                  // the classic 5% band
}

/* ---------- currency exposure & stress testing ----------
   Everything on the balance sheet bucketed by its ORIGINAL currency (converted
   to display for comparability): the raw material for a devaluation stress. */
function currencyExposure() {
  const s = Store.state, by = {};
  const add = (ccy, v) => { const k = ccy || displayCurrency(); by[k] = (by[k] || 0) + v; };
  (s.accounts || []).forEach(a => add(a.currency, conv(Number(a.balance) || 0, a.currency)));
  (s.holdings || []).forEach(h => add(h.currency, conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency)));
  (s.assets || []).forEach(a => add(a.currency, conv(Number(a.value) || 0, a.currency)));
  (s.cards || []).forEach(c => add(c.currency, -conv(Number(c.balance) || 0, c.currency)));
  (s.liabilities || []).forEach(l => add(l.currency, -conv(Number(l.balance) || 0, l.currency)));
  const total = Object.keys(by).reduce((a, k) => a + by[k], 0);
  return { byCurrency: by, total: total };
}

/* What a shock does to the whole balance sheet. Scenarios are multiplicative
   on the exposed slice, in display-currency terms:
   - equityShock: % move applied to Equity-classified market value
   - mxnMove: % the MXN loses vs every other currency (0.2 = 20% devaluation);
     in MXN display, foreign assets gain; in USD display, MXN assets shrink. */
function stressTest(opts) {
  opts = opts || {};
  const t = computeTotals();
  const nw = t.netWorth;
  // equity slice via look-through
  let equity = 0;
  (Store.state.holdings || []).forEach(h => {
    const mv = conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
    if (classifyHolding(h).assetClass === "Equity") equity += mv;
  });
  const fx = currencyExposure();
  const disp = displayCurrency();
  const mxnMove = opts.mxnMove != null ? opts.mxnMove : 0.2;
  const eqShock = opts.equityShock != null ? opts.equityShock : -0.35;
  const propShock = opts.propertyShock != null ? opts.propertyShock : -0.15;

  const equityHit = equity * eqShock;
  // devaluation: non-MXN positions re-价 in display terms
  let fxHit = 0;
  Object.keys(fx.byCurrency).forEach(ccy => {
    const v = fx.byCurrency[ccy];
    if (disp === "MXN") { if (ccy !== "MXN") fxHit += v * (1 / (1 - mxnMove) - 1); }
    else { if (ccy === "MXN") fxHit += v * (-mxnMove); }
  });
  let property = 0;
  (Store.state.assets || []).forEach(a => { if (a.kind === "property") property += conv(Number(a.value) || 0, a.currency); });
  const propHit = property * propShock;

  const scen = (label, hit) => ({ label: label, impact: Math.round(hit * 100) / 100, after: Math.round((nw + hit) * 100) / 100, pct: nw !== 0 ? hit / Math.abs(nw) * 100 : 0 });
  const nonMxn = Object.keys(fx.byCurrency).reduce((a, k) => a + (k !== "MXN" ? fx.byCurrency[k] : 0), 0);
  return {
    netWorth: nw, equity: equity, property: property,
    nonMxnShare: fx.total !== 0 ? nonMxn / Math.abs(fx.total) * 100 : 0,
    scenarios: [
      scen("Equities " + Math.round(eqShock * 100) + "%", equityHit),
      scen("MXN devalues " + Math.round(mxnMove * 100) + "%", fxHit),
      scen("Property " + Math.round(propShock * 100) + "%", propHit),
      scen("All at once", equityHit + fxHit + propHit),
    ],
  };
}

/* ---------- portfolio doctor: rule-based improvement ideas ----------
   Diagnoses the portfolio's weak attributes (concentration, geography, asset
   mix, overlap, cost, idle cash) and names concrete instruments from the
   curated dataset that would improve each one. Educational observations from
   published rules of thumb — NOT personalized advice; the user decides. */
function weightedExpenseRatio() {
  let mv = 0, weighted = 0, known = 0;
  (Store.state.holdings || []).forEach(h => {
    const v = conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
    mv += v;
    const info = INSTRUMENTS[String(h.symbol || "").toUpperCase()];
    if (info && info.er != null) { weighted += v * info.er; known += v; }
    else if (h.kind !== "etf") { known += v; }        // single stocks cost ~0 to hold
  });
  if (!(mv > 0)) return null;
  return { pct: weighted / mv, coveragePct: known / mv * 100, annualCost: weighted / 100, marketValue: mv };
}

function portfolioAdvice() {
  const s = Store.state;
  const holdings = s.holdings || [];
  const t = computeTotals();
  const out = [];
  if (!holdings.length) return out;
  const e = portfolioExposure();
  const mv = e.total || 1;
  const pick = (syms) => syms.filter(x => INSTRUMENTS[x]).map(x => ({ symbol: x, name: INSTRUMENTS[x].name, er: INSTRUMENTS[x].er }));
  const w = h => conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency) / mv * 100;

  // 1. single-position concentration (skip broad funds — that's their job)
  holdings.forEach(h => {
    const weight = w(h);
    const info = INSTRUMENTS[String(h.symbol || "").toUpperCase()];
    // broad = a multi-sector equity fund, or any diversified non-equity fund
    // (a total-bond fund at 25% is an allocation choice, not concentration)
    const isBroad = info && ((info.sectors && Object.keys(info.sectors).length > 4) || (info.assetClass && info.assetClass !== "Equity"));
    if (weight > 20 && !isBroad) {
      out.push({ sev: "high", key: "concentration",
        title: esc(h.symbol) + " is " + weight.toFixed(0) + "% of your portfolio",
        body: "A single " + (h.kind === "etf" ? "narrow fund" : "company") + " above ~20% means its bad year is YOUR bad year. Consider trimming toward a broad index core, or directing new money elsewhere until it dilutes.",
        candidates: pick(["VTI", "VOO", "VT"]) });
    }
  });

  // 2. sector concentration via look-through
  if (e.topSector && e.topSector.pct > 40 && e.topSector.name !== "Unclassified") {
    out.push({ sev: "high", key: "sector",
      title: e.topSector.name + " is " + e.topSector.pct.toFixed(0) + "% of the book",
      body: "One sector driving almost half the portfolio is a factor bet, not diversification. A value or total-market fund pulls the mix back toward the whole economy.",
      candidates: pick(["VTV", "VTI", "VT"]) });
  }

  // 3. geography
  const usPct = (e.byRegion.find(r => r.name === "United States") || {}).pct || 0;
  const mxPct = (e.byRegion.find(r => r.name === "Mexico") || {}).pct || 0;
  const intl = (e.byRegion.find(r => r.name === "Developed ex-US") || {}).pct || 0;
  if (usPct > 85) {
    out.push({ sev: "medium", key: "geo-us",
      title: Math.round(usPct) + "% United States",
      body: "Home-market concentration cuts both ways — the US has led for a decade, but a global sleeve smooths the decades when it doesn't. 10–30% international is the common institutional range.",
      candidates: pick(["VXUS", "VEA", "VT"]) });
  } else if (mxPct > 85) {
    out.push({ sev: "medium", key: "geo-mx",
      title: Math.round(mxPct) + "% Mexico",
      body: "Your income, property and portfolio all riding the same economy is triple exposure to one country. A US or global index fund adds a currency hedge too (see the stress test).",
      candidates: pick(["VOO", "VT", "ACWI"]) });
  }

  // 4. asset mix
  const eqPct = (e.byAssetClass.find(c => c.name === "Equity") || {}).pct || 0;
  const hasBonds = e.byAssetClass.some(c => c.name === "Bonds" && c.pct > 2);
  if (eqPct > 95 && !hasBonds) {
    out.push({ sev: "medium", key: "no-bonds",
      title: "100% equities, no fixed income",
      body: "Fine while young and accumulating — but a bond/CETES sleeve is what you rebalance FROM in a crash. Even 10% dry powder changes behavior. In Mexico, CETES via cetesdirecto is the zero-commission starting point.",
      candidates: pick(["BND", "CETETRC", "AGG"]) });
  }

  // 5. overlap: multiple funds tracking the same large-cap US market
  const heldSyms = holdings.map(h => String(h.symbol || "").toUpperCase());
  const spLike = heldSyms.filter(x => ["VOO", "IVV", "SPY", "VTI", "ITOT"].indexOf(x) >= 0);
  const qLike = heldSyms.filter(x => ["QQQ", "QQQM"].indexOf(x) >= 0);
  if (spLike.length && qLike.length) {
    out.push({ sev: "idea", key: "overlap",
      title: spLike[0] + " + " + qLike[0] + " overlap heavily",
      body: "The Nasdaq 100 is ~40% of the S&P 500 by weight — holding both is mostly a leveraged bet on the same mega-cap tech names, not diversification. Intentional tilt? Fine. Accidental? Consolidate.",
      candidates: [] });
  }
  if (spLike.length > 1) {
    out.push({ sev: "idea", key: "dup",
      title: spLike.join(" + ") + " track the same index",
      body: "Two S&P 500 funds is one fund with extra statements. Keep the cheaper one and point new money there.",
      candidates: pick(spLike.slice().sort((a, b) => (INSTRUMENTS[a].er || 9) - (INSTRUMENTS[b].er || 9)).slice(0, 1)) });
  }

  // 6. cost drag
  const wer = weightedExpenseRatio();
  if (wer && wer.pct > 0.25) {
    const expensive = holdings
      .map(h => ({ h: h, info: INSTRUMENTS[String(h.symbol || "").toUpperCase()] }))
      .filter(x => x.info && x.info.er > 0.25)
      .map(x => x.h.symbol);
    out.push({ sev: "medium", key: "cost",
      title: "Weighted expense ratio " + wer.pct.toFixed(2) + "%",
      body: "Fees compound against you exactly like returns compound for you" + (expensive.length ? " — " + expensive.join(", ") + " carry the bulk of it" : "") + ". Broad index funds under 0.10% deliver the same market.",
      candidates: pick(["VTI", "VOO", "BND"]) });
  }

  // 7. idle brokerage cash
  if (t.investCash > 0 && t.marketValue > 0 && t.investCash / (t.marketValue + t.investCash) > 0.10) {
    out.push({ sev: "idea", key: "cash-drag",
      title: fmtMoney(t.investCash, { compact: true }) + " sitting idle in brokerage cash",
      body: "Over 10% of the account uninvested is a silent drag — inflation taxes it daily. If it's not your emergency fund, put it on a schedule (monthly buys) or park it in CETES while it waits.",
      candidates: pick(["CETETRC", "VTI"]) });
  }

  // 8. everything classified? nudge, since every rule above depends on it
  if (e.unclassifiedPct > 15) {
    out.push({ sev: "idea", key: "unclassified",
      title: Math.round(e.unclassifiedPct) + "% of the book is unclassified",
      body: "The ideas above only see what's classified. Set the asset class, sector and region on those positions (or add a free Finnhub key) and this checkup gets sharper.",
      candidates: [] });
  }

  const rank = { high: 0, medium: 1, idea: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
