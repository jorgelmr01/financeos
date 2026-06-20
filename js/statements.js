/* FinanceOS — Statement import (Beta)
   ----------------------------------------------------------------------------
   Reads a credit-card / bank statement PDF and turns it into reviewable
   expense rows. Everything runs in the browser: the PDF is parsed locally with
   a self-hosted copy of PDF.js (js never leaves the page, bytes never leave the
   device). No upload, no network call, no telemetry. Private by construction.

   Supported layouts (tuned on real statements): American Express MX, Klar,
   Openbank MX, plus a generic date+amount fallback for anything else. Scanned
   statements with no text layer (e.g. some Santander PDFs) can't be read and
   are reported as such so the user can fall back to the spreadsheet template. */
"use strict";

const Statements = {
  _workerReady: false,
  lastParse: null,

  /* PDF.js is vendored under /vendor and served from our own origin. */
  _ensureWorker() {
    if (this._workerReady) return true;
    if (typeof pdfjsLib === "undefined") return false;
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
      this._workerReady = true;
    } catch (e) { /* set lazily below */ }
    return true;
  },

  available() { return typeof pdfjsLib !== "undefined"; },

  /* group positioned glyphs into visual lines (top→bottom, left→right) */
  _linesFromItems(items) {
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines = [];
    let cur = null, cy = null;
    items.forEach(it => {
      if (cy === null || Math.abs(it.y - cy) > 3) { if (cur) lines.push(cur); cur = []; cy = it.y; }
      cur.push(it);
    });
    if (cur) lines.push(cur);
    return lines.map(l =>
      l.sort((a, b) => a.x - b.x).map(i => i.s).join(" ").replace(/\s+/g, " ").trim()
    ).filter(Boolean);
  },

  /* Open a PDF and pull its embedded text layer, grouped into lines per page.
     Keeps the doc handle so scanned pages can be rendered + OCR'd afterward.
     Returns { doc, pages:[{lines, chars}], text, charCount, numPages }. */
  async extract(file) {
    if (!this._ensureWorker()) throw new Error("PDF engine unavailable");
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true,
    }).promise;
    const numPages = doc.numPages;
    const pages = [];
    let charCount = 0;
    for (let p = 1; p <= numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items = [];
      let chars = 0;
      tc.items.forEach(it => {
        const s = (it.str || "");
        if (!s.trim()) return;
        chars += s.length;
        items.push({ x: it.transform[4], y: it.transform[5], s });
      });
      charCount += chars;
      pages.push({ lines: this._linesFromItems(items), chars });
      page.cleanup && page.cleanup();
    }
    const text = pages.map(pg => pg.lines.join("\n")).join("\n");
    return { doc, pages, text, charCount, numPages };
  },

  /* ---------- on-device OCR for scanned (image-only) statements ----------
     Tesseract.js is vendored under /vendor and loaded lazily — only when a
     statement has no text layer. Like everything here, it runs entirely in the
     browser; the rendered pages and recognized text never leave the device. */
  TESS_DIR: "vendor/tesseract/",
  _tess: null,

  ocrAvailable() {
    // needs WebAssembly + an OffscreenCanvas/canvas to render pages into
    return typeof WebAssembly !== "undefined" && typeof document !== "undefined";
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  },

  async _ensureTesseract() {
    if (this._tess) return this._tess;
    if (typeof Tesseract === "undefined") await this._loadScript(this.TESS_DIR + "tesseract.min.js");
    const worker = await Tesseract.createWorker("spa", 1, {
      workerPath: this.TESS_DIR + "worker.min.js",
      corePath: this.TESS_DIR + "tesseract-core-simd-lstm.wasm.js",
      langPath: this.TESS_DIR,
      gzip: true,
    });
    await worker.setParameters({ tessedit_pageseg_mode: "6" }); // assume a uniform block of text
    this._tess = worker;
    return worker;
  },

  /* render one PDF page to a canvas at a resolution good enough for OCR.
     The canvas is filled white first so scanned pages are always opaque. */
  async _renderPage(page, scale) {
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: viewport, background: "#ffffff" }).promise;
    return canvas;
  },

  /* recognize a page at a given scale → array of cleaned text lines */
  async _ocrAt(worker, page, scale) {
    const canvas = await this._renderPage(page, scale);
    const { data } = await worker.recognize(canvas);
    canvas.width = canvas.height = 0;          // free memory promptly
    return (data.text || "").split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  },

  // a line that carries both a date and a money amount = a real table row
  _ROW_HINT: /\d{1,2}[-\/][A-Za-z0-9]{2,4}[-\/]\d{2,4}.*\d[.,]\d{2}/,
  _MONEY_HINT: /\$\s*\d/,

  /* OCR the pages that lack a usable text layer. onProgress(done,total).
     If a page clearly has money rows but layout analysis fragmented them,
     retry once at a different scale and keep whichever read more rows —
     this self-heals the occasional bad page-segmentation pass. */
  async ocrPages(doc, pageNums, onProgress) {
    const worker = await this._ensureTesseract();
    const out = {};
    for (let i = 0; i < pageNums.length; i++) {
      const n = pageNums[i];
      if (onProgress) onProgress(i, pageNums.length);
      const page = await doc.getPage(n);
      const baseW = page.getViewport({ scale: 1 }).width || 612;
      const scale1 = Math.max(2.4, Math.min(3.2, 1850 / baseW));
      let lines = await this._ocrAt(worker, page, scale1);
      const rowCount = (ls) => ls.filter(l => this._ROW_HINT.test(l)).length;
      const moneyCount = (ls) => ls.filter(l => this._MONEY_HINT.test(l)).length;
      if (moneyCount(lines) >= 3 && rowCount(lines) === 0) {
        const alt = await this._ocrAt(worker, page, Math.min(3.6, scale1 * 1.18));
        if (rowCount(alt) > rowCount(lines)) lines = alt;
      }
      out[n] = lines;
      page.cleanup && page.cleanup();
    }
    if (onProgress) onProgress(pageNums.length, pageNums.length);
    return out;
  },

  /* ---------- bank detection ---------- */
  detectBank(text) {
    const t = text.toLowerCase();
    if (/american express|americanexpress/.test(t)) return "amex";
    if (/\bklar\b/.test(t)) return "klar";
    if (/openbank/.test(t)) return "openbank";
    if (/santander/.test(t)) return "santander";
    return "generic";
  },

  BANK_LABEL: { amex: "American Express", klar: "Klar", openbank: "Openbank", santander: "Santander", generic: "Statement" },

  /* ---------- helpers ---------- */
  _MONTHS: {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  },
  _monthIdx(name) {
    const k = String(name || "").toLowerCase().replace(/\.$/, "").replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úùü]/g, "u");
    return this._MONTHS[k] || null;
  },
  _iso(y, m, d) {
    const pad = n => String(n).padStart(2, "0");
    return y + "-" + pad(m) + "-" + pad(d);
  },
  _amt(raw) {
    // keep digits, dot, comma, minus; comma is a thousands sep in these locales
    const neg = /-/.test(raw);
    const cleaned = String(raw).replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    let n = parseFloat(cleaned);
    if (isNaN(n)) return null;
    return neg ? -n : n;
  },

  /* Clean up a merchant string: drop masked card numbers some banks append
     (e.g. "Uber XXXXXXXXXXXX9906") and tidy trailing separators. */
  _tidyDesc(s) {
    return String(s || "")
      .replace(/[X*]{3,}\s?\d{2,6}\b/gi, " ")    // masked card / account tails
      .replace(/[\s,;:.\-|]+$/, "")              // trailing separators
      .replace(/^[\s,;:.\-|]+/, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  /* ---------- category guessing from merchant text ---------- */
  _MERCHANTS: [
    [/uber\s*eats|rappi|didi\s*food|sin\s*delantal/, "Dining"],
    [/uber|didi|cabify|taxi|metro|metrobus|parking|estacionamiento|gas(olin)?a|pemex|shell|peaje|cap?ufe|televia|telepeaje|viapass|pase\b|fideicomiso funo estaci/, "Transport"],
    [/aeromexico|volaris|viva\s*aero|airbnb|booking|expedia|despegar|hotel|hilton|marriott|delta air|american air/, "Travel"],
    [/costco|walmart|soriana|chedraui|heb|h-e-b|wm\s*express|wm\s*super|la\s*comer|superama|oxxo|7-?eleven|merc(ado)?\s*super/, "Groceries"],
    [/amazon|mercado\s*libre|merc?pago|merpago|liverpool|palacio|coppel|aliexpress|shein|best\s*buy|sears|office\s*depot|apple\s*store|timberland|zara|nike|adidas|h&m/, "Shopping"],
    [/apple\.com\/bill|spotify|netflix|hbo|disney|max\b|youtube|claro\s*video|paramount|prime\s*video|audible|icloud|google\s*one|chatgpt|openai|claude/, "Subscriptions"],
    [/total\s*play|totalplay|telmex|izzi|megacable|cfe|telcel|at&t|att\b|movistar|agua|sacmex|naturgy|gas\s*natural/, "Utilities"],
    [/starbucks|carls?\s*jr|mcdonald|burger|kfc|dominos|pizza|vips|toks|sanborns|bostons|rest(aurant)?\b|cafe|caf[eé]|bar\b|cantina|sushi|tacos/, "Dining"],
    [/farmacia|pharmacy|hospital|doctor|dental|dentista|clinic|laboratorio|chedraui\s*salud|similares/, "Health"],
    [/uber\s*one|gym|smartfit|sportium|gimnasio|spa|barber|salon|peluqueria|estetica/, "Personal Care"],
    [/universidad|university|colegio|school|tuition|udemy|coursera|platzi|mba|stanford|gsb/, "Education"],
    [/seguro|insurance|gnp|axa|metlife|qualitas/, "Insurance"],
    [/cinepolis|cinemex|cinema|spotify|steam|playstation|xbox|nintendo|ticketmaster|concert|boletos|app\s*tickets/, "Entertainment"],
  ],
  guessCategory(desc) {
    const d = String(desc || "").toLowerCase();
    for (const [re, cat] of this._MERCHANTS) { if (re.test(d)) return cat; }
    const c = canonicalCategory(d);            // reuse alias engine
    return EXPENSE_CATEGORIES.some(x => x.name === c) ? c : "Other";
  },

  /* ---------- transaction classification ---------- */
  // \bpago\b so "MercadoPago" (a merchant) is NOT mistaken for a card payment
  _PAYMENT_RE: /\bpago\b|gracias por su pago|thank you for your payment|\babono\b(?!\s*a\s*meses)|domiciliaci/i,
  _REFUND_RE: /reembolso|devoluci|bonificaci|refund|cr[eé]dito\b|ajuste a favor/i,
  _SKIP_RE: /saldo (al corte|anterior|del periodo)|balance forward|saldo total|monto a diferir|meses en autom[aá]tico|pago m[ií]nimo|^(iva|intereses?|ordinarios?|moratorios?|comisiones?|capital)$/i,
  classify(desc, signedAmount, hasCR) {
    if (this._SKIP_RE.test(desc)) return "balance";
    if (hasCR || this._PAYMENT_RE.test(desc)) return "payment";
    if (this._REFUND_RE.test(desc) || signedAmount < 0) return "refund";
    return "charge";
  },

  /* ---------- per-bank parsers ----------
     Each returns an array of raw rows: {date, description, amount, type}. */

  parseKlar(text) {
    const rows = [];
    const lines = text.split("\n");
    let inTx = false;
    const re = /^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d{4})\s+(.+?)\s+\$?\s*(-?[\d,]+\.\d{2})$/;
    for (const ln of lines) {
      if (/^Transacciones\b/i.test(ln)) { inTx = true; continue; }
      if (!inTx) continue;
      if (/^Total de transacciones|^Costos\b|^Cr[eé]ditos parcializados/i.test(ln)) break;
      const m = ln.match(re);
      if (!m) continue;
      const mo = this._monthIdx(m[2]); if (!mo) continue;
      const amt = this._amt(m[5]);
      if (amt == null) continue;
      const desc = m[4].replace(/\s*\|\s*/g, " · ").trim();
      rows.push({ date: this._iso(+m[3], mo, +m[1]), description: desc, amount: amt, type: this.classify(desc, amt, false) });
    }
    return rows;
  },

  parseAmex(text) {
    const rows = [];
    const lines = text.split("\n");
    // statement period → resolve the year for "<day> de <Month>" rows
    const per = text.match(/Del\s+(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+al\s+(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(\d{4})/i);
    let endY = per ? +per[5] : new Date().getFullYear();
    let startM = per ? this._monthIdx(per[2]) : null;
    let endM = per ? this._monthIdx(per[4]) : null;
    const startY = (startM && endM && startM > endM) ? endY - 1 : endY;
    const yearFor = (mo) => {
      if (!startM || !endM) return endY;
      // pick the year that puts the month inside the billing window
      if (mo === startM) return startY;
      if (mo === endM) return endY;
      if (startM <= endM) return (mo >= startM && mo <= endM) ? endY : endY;
      return (mo >= startM) ? startY : endY;        // window spans year-end
    };
    const re = /^(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*(CR)?$/i;
    for (const ln of lines) {
      if (/^RFC|^\/REF|n[uú]mero de cuenta/i.test(ln)) continue;     // metadata lines
      const m = ln.match(re);
      if (!m) continue;
      const mo = this._monthIdx(m[2]); if (!mo) continue;
      let desc = m[3].trim();
      if (desc.length < 2) continue;
      const amt = this._amt(m[4]);
      if (amt == null) continue;
      const hasCR = !!m[5];
      rows.push({ date: this._iso(yearFor(mo), mo, +m[1]), description: desc, amount: amt, type: this.classify(desc, amt, hasCR) });
    }
    return rows;
  },

  parseOpenbank(text) {
    const rows = [];
    const lines = text.split("\n");
    // regular purchases: "<op DD-MM-YYYY> <charge DD-MM-YYYY> <desc...> $ <amount>"
    // exclude the months-without-interest schedule (single date + several $ + a payment counter).
    const re = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2})-(\d{2})-(\d{4})\s+(.+?)[\s-]*\$\s*(-?[\d,]+\.\d{2})$/;
    for (const ln of lines) {
      const m = ln.match(re);
      if (!m) continue;
      if (/n[uú]m\.?\s*de pago|tasa de inter|\d+\s*%/.test(ln)) continue;
      const desc = m[7].replace(/,\s*tipo de cambio.*$/i, "").replace(/,\s*por\s*-\s*$/i, "").replace(/\s*-\s*$/, "").trim();
      const amt = this._amt(m[8]);
      if (amt == null || !desc) continue;
      rows.push({ date: this._iso(+m[3], +m[2], +m[1]), description: desc, amount: amt, type: this.classify(desc, amt, false) });
    }
    return rows;
  },

  /* Santander statements are scanned images, so this runs on OCR output.
     Rows look like: "14-Ene-2026 | 15-Ene-2026 | MERPAGO PERIFERICO MAG2105031V3 $ 135.00"
     A trailing "[-]" or a "PAGO/TRANSFERENCIA" description marks an abono (credit). */
  parseSantander(text) {
    const rows = [];
    const lines = text.split("\n");
    // strict: require the $ + 2-decimal amount so OCR digit slips don't import as a wild number
    const re = /(\d{1,2})-([A-Za-zÁÉÍÓÚáéíóú]{3,4})-(\d{4})(.*?)([-+]|\[\s*-\s*\])?\s*\$\s*([\d][\d,]*\.\d{2})\s*[\]|)]*$/;
    for (const ln of lines) {
      const m = ln.match(re);
      if (!m) continue;
      const mo = this._monthIdx(m[2]); if (!mo) continue;
      let mid = m[4] || "";
      // drop the "fecha de cargo" second date and table pipes
      mid = mid.replace(/\d{1,2}\s*-\s*[A-Za-z?]{3,4}\s*-\s*\d{2,4}/g, " ").replace(/\|/g, " ");
      // drop trailing merchant reference codes (e.g. "MAG 2105031VW3", "RAD161031RK1")
      let desc = mid.replace(/\b[A-Z]{2,4}\s?\d[0-9A-Za-z]{5,}\b/gi, " ")
        .replace(/\[\s*-?\s*\]/g, " ")
        .replace(/^[\s?|.+-]+/, "")              // OCR noise bleeding in from the date column
        .replace(/\s+/g, " ").trim();
      if (desc.length < 2) continue;
      const amt = this._amt(m[6]);
      if (amt == null) continue;
      const isAbono = /\[\s*-\s*\]/.test(m[0]) || (m[5] === "-");
      const type = isAbono ? "payment" : this.classify(desc, amt, false);
      rows.push({ date: this._iso(+m[3], mo, +m[1]), description: desc, amount: amt, type: type });
    }
    return rows;
  },

  /* generic: any line with a recognizable date and a trailing amount */
  parseGeneric(text) {
    const rows = [];
    const lines = text.split("\n");
    const reISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    const reDMY = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
    const reAmt = /(-?\$?\s*[\d,]+\.\d{2})\s*(CR)?$/;
    for (const ln of lines) {
      const am = ln.match(reAmt);
      if (!am) continue;
      let date = null, mISO, mDMY;
      if ((mISO = ln.match(reISO))) date = this._iso(+mISO[1], +mISO[2], +mISO[3]);
      else if ((mDMY = ln.match(reDMY))) {
        let y = +mDMY[3]; if (y < 100) y += 2000;
        const a = +mDMY[1], b = +mDMY[2];
        date = a > 12 ? this._iso(y, b, a) : this._iso(y, a, b);
      }
      if (!date) continue;
      const amt = this._amt(am[1]);
      if (amt == null) continue;
      let desc = ln.replace(reAmt, "").replace(reISO, "").replace(reDMY, "").replace(/\s+/g, " ").trim();
      if (desc.length < 2) continue;
      rows.push({ date, description: desc.slice(0, 80), amount: amt, type: this.classify(desc, amt, !!am[2]) });
    }
    return rows;
  },

  /* ---------- top-level: parse a File into reviewable rows ----------
     onProgress({phase, page, pages}) is called during the (slow) OCR pass. */
  async parse(file, onProgress) {
    const ex = await this.extract(file);
    const warnings = [];
    let text = ex.text;
    let viaOCR = false;

    // A scanned statement has little/no text layer. If OCR is available, read
    // the image pages on-device; otherwise tell the user to use the template.
    const minChars = 40 * Math.max(1, ex.numPages / 6);
    if (ex.charCount < minChars) {
      if (!this.ocrAvailable()) {
        try { ex.doc.destroy(); } catch (e) {}
        const bank0 = this.detectBank(text);
        return {
          bank: bank0, bankLabel: this.BANK_LABEL[bank0], currency: "MXN", rows: [], scanned: true,
          warnings: ["This statement is a scan (an image with no text layer) and this device can't run on-device OCR. Use the spreadsheet template instead, or open it on a newer browser."],
        };
      }
      try {
        // OCR the pages that have no usable text layer (cap to keep it bounded)
        const need = [];
        for (let p = 1; p <= ex.numPages && need.length < 20; p++) {
          if (!ex.pages[p - 1] || ex.pages[p - 1].chars < 20) need.push(p);
        }
        const ocr = await this.ocrPages(ex.doc, need, (done, total) => {
          if (onProgress) onProgress({ phase: "ocr", page: done, pages: total });
        });
        // rebuild text, preferring the text layer where it exists
        const merged = [];
        for (let p = 1; p <= ex.numPages; p++) {
          const tl = ex.pages[p - 1];
          merged.push(((tl && tl.chars >= 20 ? tl.lines : ocr[p]) || []).join("\n"));
        }
        text = merged.join("\n");
        viaOCR = true;
      } catch (err) {
        try { ex.doc.destroy(); } catch (e) {}
        const bank0 = this.detectBank(text);
        return {
          bank: bank0, bankLabel: this.BANK_LABEL[bank0], currency: "MXN", rows: [], scanned: true,
          warnings: ["This statement is a scan and on-device OCR couldn't run here (" + (err && err.message ? err.message : "unknown error") + "). Try the spreadsheet template instead."],
        };
      }
    }
    try { ex.doc.destroy(); } catch (e) {}

    const bank = this.detectBank(text);

    let raw;
    if (bank === "amex") raw = this.parseAmex(text);
    else if (bank === "klar") raw = this.parseKlar(text);
    else if (bank === "openbank") raw = this.parseOpenbank(text);
    else if (bank === "santander") raw = this.parseSantander(text);
    else raw = [];
    // always try the generic pass too; merge anything new the bank parser missed
    if (bank === "generic" || !raw.length) raw = raw.concat(this.parseGeneric(text));

    if (viaOCR) warnings.push("Read from a scan with on-device OCR — double-check the amounts before importing.");

    // de-dupe rows within the statement (same date+desc+amount)
    const seen = {};
    // the supported sample banks are all Mexican; unknown layouts use the
    // user's display currency so amounts land in the right denomination.
    const currency = (bank === "amex" || bank === "klar" || bank === "openbank" || bank === "santander")
      ? "MXN" : displayCurrency();
    const rows = [];
    raw.forEach(r => {
      if (r.type === "balance") return;                       // never a real expense
      r.description = this._tidyDesc(r.description);
      const key = r.date + "|" + r.description.toLowerCase() + "|" + r.amount.toFixed(2);
      if (seen[key]) return; seen[key] = 1;
      const isCharge = r.type === "charge";
      const isRefund = r.type === "refund";
      // expense amount: positive for spend, negative for refunds; payments excluded by default
      let amount = Math.abs(r.amount);
      if (isRefund) amount = -amount;
      rows.push({
        date: r.date,
        description: r.description.slice(0, 80),
        amount: Math.round(amount * 100) / 100,
        currency,
        category: isCharge || isRefund ? this.guessCategory(r.description) : "Other",
        type: r.type,                                         // charge | payment | refund
        include: isCharge || isRefund,                        // payments off by default
      });
    });

    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!rows.length) warnings.push((viaOCR ? "OCR ran but no transactions could be matched. " : "No transactions could be read from this PDF. ") + "It may use an unusual layout — try the spreadsheet template instead.");
    this.lastParse = { bank, bankLabel: this.BANK_LABEL[bank], currency, rows, warnings, scanned: false, viaOCR: viaOCR };
    return this.lastParse;
  },

  /* Add the reviewed rows as expenses, dedup-aware (same rules as CSV import). */
  commit(rows) {
    const have = {};
    (Store.state.expenses || []).forEach(e => { have[e.sig] = (have[e.sig] || 0) + 1; });
    const seen = {};
    let added = 0, skipped = 0;
    rows.forEach(r => {
      const amount = Math.round((Number(r.amount) || 0) * 100) / 100;
      if (!r.date || !amount) return;
      const e = {
        date: r.date,
        description: String(r.description || "").trim().slice(0, 80),
        category: canonicalCategory(r.category),
        amount,
        currency: r.currency || "MXN",
        source: "statement",
      };
      e.sig = expenseSig(e);
      seen[e.sig] = (seen[e.sig] || 0) + 1;
      if (seen[e.sig] <= (have[e.sig] || 0)) { skipped++; return; }
      Store.add("expenses", e);
      added++;
    });
    return { added, skipped };
  },
};
