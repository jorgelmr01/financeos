/* FinanceOS — Spanish interface layer
   ----------------------------------------------------------------------------
   The lessons are in Spanish and the market is Mexico, so the interface can be
   too. Strategy: the codebase stays English-source, and a phrase dictionary is
   applied at the few points where text reaches the screen — full-element text
   at render time (panel titles, labels, buttons, table headers), plus the
   shared helpers (modal titles, form labels, toasts). A phrase that isn't in
   the dictionary simply stays in English, so coverage grows without ever
   breaking a page. Language: Settings → auto (browser) / Español / English. */
"use strict";

const I18N = {
  _regex: null,

  lang() {
    const set = (typeof Store !== "undefined" && Store.state && Store.state.settings.lang) || "auto";
    if (set === "es" || set === "en") return set;
    return (typeof navigator !== "undefined" && /^es/i.test(navigator.language || "")) ? "es" : "en";
  },

  active() { return this.lang() === "es"; },

  /* exact-phrase translation (used by helpers for modal titles, labels, toasts) */
  t(s) {
    if (!this.active()) return s;
    return this.dict[s] || s;
  },

  /* translate every dictionary phrase that appears as a full element text
     (">Phrase<") or attribute-free label inside an HTML string. One pass with
     a single alternation regex, built lazily and cached. */
  translateHtml(html) {
    if (!this.active() || !html) return html;
    if (!this._regex) {
      const keys = Object.keys(this.dict)
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      // the optional trailing space covers panel titles that end in a hint
      // button (_hint prepends one): ">Stress test <button…" still translates
      this._regex = new RegExp(">(" + keys.join("|") + ")( ?)<", "g");
    }
    const dict = this.dict;
    return html.replace(this._regex, (m, p, sp) => ">" + (dict[p] || p) + sp + "<");
  },

  /* the static sidebar is plain HTML — translate its labels in place.
     Each element remembers its English source in data-en so toggling back works. */
  applyChrome() {
    if (typeof document === "undefined") return;
    const swap = (el, getText, setText) => {
      let src = el.getAttribute("data-en");
      if (src == null) { src = getText().trim(); el.setAttribute("data-en", src); }
      setText(this.active() ? (this.dict[src] || src) : src);
    };
    document.querySelectorAll(".nav-item").forEach(btn => {
      const nodes = Array.prototype.filter.call(btn.childNodes, n => n.nodeType === 3 && n.textContent.trim());
      const node = nodes[nodes.length - 1];
      if (node) swap(btn, () => node.textContent, v => { node.textContent = " " + v; });
    });
    document.querySelectorAll(".nav-section, .networth-chip .chip-label").forEach(el =>
      swap(el, () => el.textContent, v => { el.textContent = v; }));
  },

  refresh() { this._regex = null; this.applyChrome(); },

  /* ---------- dictionary: English source → es-MX ---------- */
  dict: {
    // sidebar & chrome
    "Today": "Hoy", "Accounts": "Cuentas", "Credit Cards": "Tarjetas",
    "Portfolio": "Inversiones", "Income": "Ingresos", "Budget": "Presupuesto",
    "Retirement": "Retiro", "Milestones": "Logros", "Learn": "Aprende", "Guide": "Guía",
    "Money": "Dinero", "Grow": "Crece", "Net Worth": "Patrimonio",
    "Net worth": "Patrimonio neto",
    // common buttons & actions
    "Save": "Guardar", "Cancel": "Cancelar", "Delete": "Eliminar", "Edit": "Editar",
    "Close": "Cerrar", "Confirm": "Confirmar", "Sell": "Vender", "Use": "Usar",
    "OK": "OK", "Do it →": "Hazlo →", "dismiss": "descartar", "See more": "Ver más",
    "Select all": "Seleccionar todo", "Only purchases": "Solo compras", "None": "Ninguna",
    "Import selected": "Importar seleccionadas", "Choose PDF…": "Elegir PDF…",
    "Save budgets": "Guardar presupuestos", "Save changes": "Guardar cambios",
    "Add position": "Agregar posición", "Add expense": "Agregar gasto",
    "Record sale": "Registrar venta", "Load sample data": "Cargar datos de ejemplo",
    "Add an account": "Agregar una cuenta", "+ Add account": "+ Agregar cuenta",
    "+ Add card": "+ Agregar tarjeta", "+ Add position": "+ Agregar posición",
    "+ Add income stream": "+ Agregar ingreso", "+ Add expense": "+ Agregar gasto",
    "+ Add goal": "+ Agregar meta", "+ Add stream": "+ Agregar ingreso",
    "+ Log expense": "+ Registrar gasto", "↻ Update prices": "↻ Actualizar precios",
    "↺ Use my net worth": "↺ Usar mi patrimonio", "⤓ Calendar": "⤓ Calendario",
    "↓ Template": "↓ Plantilla", "↑ Upload": "↑ Subir", "↓ Download template": "↓ Descargar plantilla",
    "↑ Upload sheet": "↑ Subir hoja", "Set budgets": "Definir presupuestos",
    "Budget →": "Presupuesto →", "View all →": "Ver todo →", "Manage →": "Administrar →",
    "Learn the basics →": "Aprende lo básico →", "Check my budget →": "Revisar mi presupuesto →",
    "+ Add your first card": "+ Agrega tu primera tarjeta",
    "+ Add your first position": "+ Agrega tu primera posición",
    // overview
    "Good morning": "Buenos días", "Good afternoon": "Buenas tardes", "Good evening": "Buenas noches",
    "Financial health": "Salud financiera", "FINANCIAL HEALTH": "SALUD FINANCIERA",
    "Healthy": "Saludable", "Liquid cash": "Efectivo líquido", "Portfolio value": "Valor del portafolio",
    "Credit available": "Crédito disponible", "Monthly income (net)": "Ingreso mensual (neto)",
    "Will you make it to payday?": "¿Llegas a la quincena?",
    "Savings rate": "Tasa de ahorro", "Net worth over time": "Patrimonio en el tiempo",
    "Incoming — next 14 days": "Por llegar — próximos 14 días", "Portfolio snapshot": "Resumen del portafolio",
    "Set up your command center": "Configura tu centro de mando",
    "Add your income": "Agrega tu ingreso", "Log or import expenses": "Registra o importa gastos",
    "Add a credit card": "Agrega una tarjeta de crédito",
    "Welcome to your command center": "Bienvenido a tu centro de mando",
    // budget
    "Spending health": "Salud del gasto", "By category": "Por categoría",
    "Insights & advice": "Hallazgos y consejos", "Recurring expenses": "Gastos recurrentes",
    "Irregular income planner": "Planeador de ingreso variable",
    "Needs vs wants": "Necesidades vs gustos", "This month": "Este mes", "Trends": "Tendencias",
    "Monthly budgets": "Presupuestos mensuales", "Spending": "Gasto", "Spending score": "Score de gasto",
    "expenses": "gastos", "Runway": "Colchón",
    // cards
    "Total owed": "Deuda total", "Total limit": "Límite total", "Available credit": "Crédito disponible",
    "Overall utilization": "Utilización global", "Debt payoff plan": "Plan para salir de deudas",
    "Credit score builder": "Constructor de score crediticio",
    "Statement cut": "Corte", "Payment due": "Fecha de pago",
    "Debt-free in": "Libre de deuda en", "Total interest": "Interés total",
    // portfolio
    "Market value": "Valor de mercado", "Total invested": "Total invertido", "Total return": "Rendimiento total",
    "Best / Worst": "Mejor / Peor", "Allocation": "Distribución", "Positions": "Posiciones",
    "Exposure breakdown": "Desglose de exposición", "Portfolio performance": "Desempeño del portafolio",
    "Dividend income": "Ingreso por dividendos", "Risk & volatility": "Riesgo y volatilidad",
    "Realized gains": "Ganancias realizadas", "Overview": "Resumen", "Advanced": "Avanzado",
    "By asset class": "Por clase de activo", "By industry": "Por industria", "By geography": "Por geografía",
    "New to investing? Start here": "¿Nuevo en inversiones? Empieza aquí",
    "Already investing?": "¿Ya inviertes?",
    "Annual income": "Ingreso anual", "Portfolio yield": "Yield del portafolio",
    "Yield on cost": "Yield sobre costo", "Paying positions": "Posiciones que pagan",
    "Position": "Posición", "Shares": "Títulos", "Weight": "Peso", "Price": "Precio",
    "Return": "Rendimiento", "Value": "Valor", "Date": "Fecha", "Gain": "Ganancia",
    "Update price": "Actualizar precio",
    // income
    "Income streams": "Fuentes de ingreso", "Next 30 days": "Próximos 30 días",
    "Interest engine": "Motor de intereses", "Dividend engine": "Motor de dividendos",
    "Income projection": "Proyección de ingresos", "Where your income comes from": "De dónde viene tu ingreso",
    "Stream": "Fuente", "Deposits into": "Deposita en", "Next payment": "Próximo pago",
    // retirement
    "Strategy": "Estrategia", "Basic": "Básico",
    "Nest egg at retirement": "Patrimonio al retirarte", "Monthly income": "Ingreso mensual",
    "Money lasts (base case)": "El dinero dura (caso base)", "Success rate": "Tasa de éxito",
    "Your money over a lifetime": "Tu dinero a lo largo de la vida",
    "Your buckets at retirement": "Tus cubetas al retirarte",
    "Explore your withdrawal rate": "Explora tu tasa de retiro",
    "Compare risk profiles": "Compara perfiles de riesgo", "FIRE number": "Número FIRE",
    "What this means": "Qué significa esto", "Withdrawal rate": "Tasa de retiro",
    "Equities return": "Retorno de acciones", "Bonds return": "Retorno de bonos",
    "Cash return": "Retorno de efectivo", "Inflation": "Inflación", "Years to grow": "Años de crecimiento",
    "Cash buffer": "Colchón en efectivo", "Bond buffer": "Colchón en bonos",
    "Equities while saving": "Acciones mientras ahorras",
    "Aggressive": "Agresivo", "Balanced": "Balanceado", "Conservative": "Conservador",
    "Profile": "Perfil", "Worst case": "Peor caso", "Median left": "Mediana restante", "Success": "Éxito",
    // milestones & goals
    "Savings goals": "Metas de ahorro", "Achievements": "Logros",
    "How this is estimated": "Cómo se estima esto",
    // statements / import
    "Review transactions": "Revisa las transacciones", "Import from statement": "Importar de estado de cuenta",
    "Couldn't read that statement": "No se pudo leer ese estado de cuenta",
    "payment": "pago", "refund": "reembolso", "selected": "seleccionadas",
    // misc labels
    "Description": "Descripción", "Category": "Categoría", "Amount": "Monto", "Currency": "Moneda",
    "Add your own category": "Agrega tu propia categoría", "Budget currency": "Moneda del presupuesto",
    "Language": "Idioma", "Settings": "Configuración",
    // stat micro-labels & common subs
    "Cash flow": "Flujo", "Debt load": "Deuda", "Safety net": "Red de seguridad", "Growth": "Crecimiento",
    "Assets": "Activos", "Card debt": "Deuda de tarjetas", "Unrealized P/L": "P/G no realizada",
    "Cash": "Efectivo", "Savings": "Ahorro", "Bonds": "Bonos", "Equities": "Acciones",
    "Brokerage cash": "Efectivo en casa de bolsa", "Investments": "Inversiones",
    "Needs": "Necesidades", "Wants": "Gustos", "Housing": "Vivienda", "Utilities": "Servicios",
    "Groceries": "Súper", "Transport": "Transporte", "Health": "Salud", "Insurance": "Seguros",
    "Debt": "Deuda", "Education": "Educación", "Kids": "Hijos", "Fees": "Comisiones",
    "Dining": "Restaurantes", "Shopping": "Compras", "Entertainment": "Entretenimiento",
    "Travel": "Viajes", "Subscriptions": "Suscripciones", "Personal Care": "Cuidado personal",
    "Gifts & Donations": "Regalos y donativos", "Other": "Otros",
    "after tax · incl. interest & dividends": "neto de impuestos · incl. intereses y dividendos",
    "of net income": "del ingreso neto", "first year": "primer año",
    "aim for under 30%": "mantente bajo 30%", "accounts": "cuentas", "account": "cuenta",
    "Auto (browser)": "Automático (navegador)",
    // balance sheet & advanced wealth
    "Balance sheet": "Balance patrimonial", "Net worth statement": "Estado patrimonial",
    "Other assets": "Otros activos", "Loans & mortgages": "Créditos e hipotecas",
    "Stress test": "Prueba de estrés", "Rebalancing": "Rebalanceo",
    "Total assets": "Activos totales", "Total liabilities": "Pasivos totales",
    "Cash & savings": "Efectivo y ahorro", "Investments (market value)": "Inversiones (valor de mercado)",
    "Property & other assets": "Inmuebles y otros activos", "Credit cards": "Tarjetas de crédito",
    "Scenario": "Escenario", "Impact": "Impacto", "+ Asset": "+ Activo", "+ Liability": "+ Pasivo",
    "Asset class": "Clase de activo", "Current": "Actual", "Target": "Objetivo", "Drift": "Desviación",
    "To rebalance": "Para rebalancear", "Save targets": "Guardar objetivos",
    "Portfolio checkup": "Chequeo del portafolio", "Fix first": "Arregla primero",
    "Worth doing": "Vale la pena", "Idea": "Idea",
    "Instruments that address this": "Instrumentos que lo atienden",
    "Contributions": "Aportaciones", "+ Deposit": "+ Depósito", "− Withdrawal": "− Retiro",
    "Record deposit": "Registrar depósito", "Record withdrawal": "Registrar retiro",
    "Add deposit": "Agregar depósito", "Add withdrawal": "Agregar retiro",
    "Net invested": "Neto invertido", "Account value": "Valor de la cuenta",
    "True profit": "Ganancia real", "Account XIRR": "XIRR de la cuenta",
    "Wealth projection": "Proyección patrimonial", "+ Life event": "+ Evento de vida",
    "New life event": "Nuevo evento de vida", "Edit life event": "Editar evento de vida",
    "Add event": "Agregar evento", "Horizon": "Horizonte",
    "Return on investments": "Retorno de inversiones", "Property appreciation": "Plusvalía inmobiliaria",
    "Baseline salary growth": "Crecimiento salarial base", "From today": "Desde hoy",
    "Debt-free": "Libre de deuda", "Year": "Año", "Raise %": "Aumento %", "Type": "Tipo",
    "Lifetime wealth plan": "Plan patrimonial de vida", "Your life": "Tu vida",
    "Your age today": "Tu edad hoy", "Model to age": "Modelar hasta los", "Retire at": "Retiro a los",
    "Pension replaces": "Pensión cubre", "Equity share of investments": "Proporción en acciones",
    "Property carry cost": "Costo de mantener inmuebles", "Estate settlement costs": "Costos de sucesión",
    "Peak wealth": "Riqueza máxima", "Estate to heirs": "Herencia a herederos",
    "Down payment %": "Enganche %", "Loan rate % (APR)": "Tasa del crédito % (APR)",
    "Term (years)": "Plazo (años)", "Assumptions": "Supuestos",
    "Projection": "Proyección", "Model assumptions": "Supuestos del modelo",
    "Life events": "Eventos de vida", "Your life, year by year": "Tu vida, año por año",
    "Year-by-year detail": "Detalle año por año",
    "Start": "Inicio", "Saved": "Ahorro", "Financial": "Financiero",
    "Property": "Inmuebles", "Events": "Eventos", "Tax": "Impuesto",
    "Purchase (house, car…)": "Compra (casa, coche…)",
    "One-time expense / purchase (house, car, trip…)": "Gasto único / compra (casa, coche, viaje…)",
    "Add a one-time expense or event in": "Agregar un gasto único o evento en",
    "New salary (exact amount)": "Nuevo sueldo (monto exacto)",
    "Salary raise (%)": "Aumento de sueldo (%)",
    "New spending level": "Nuevo nivel de gasto",
    "Windfall (bonus, sale, inheritance)": "Ingreso extraordinario (bono, venta, herencia)",
    "Monthly amount": "Monto mensual",
    "New monthly net salary": "Nuevo sueldo neto mensual",
    "New monthly spending": "Nuevo gasto mensual",
    "Then grows per year": "Después crece anual",
    "Salary changes by this % from that year on": "El sueldo cambia este % a partir de ese año",
    "Optional — leave empty to keep the baseline salary growth from the sliders": "Opcional — déjalo vacío para conservar el crecimiento salarial base de los controles",
    "Your net take-home becomes exactly this, from that year on": "Tu ingreso neto mensual se vuelve exactamente esto a partir de ese año",
    "Your TOTAL spending becomes this, from that year on (then grows with inflation)": "Tu gasto TOTAL se vuelve esto a partir de ese año (después crece con la inflación)",
    "Nothing to project yet": "Nada que proyectar todavía",
    "Go to accounts": "Ir a cuentas",
    "New salary": "Nuevo sueldo", "New spending": "Nuevo gasto",
    // country presets & first-run
    "Country": "País", "Choose…": "Elegir…",
    "Where are you?": "¿Dónde estás?",
    "Sets your currency, language and typical tax rates in one tap.": "Configura tu moneda, idioma e impuestos típicos con un toque.",
    "Country settings applied": "Configuración de país aplicada",
    "review and Save": "revisa y Guarda",
    "United States": "Estados Unidos", "Canada": "Canadá",
    "United Kingdom": "Reino Unido", "Deutschland": "Alemania",
    "Tax on interest %": "Impuesto sobre intereses %",
    // finish-line runway & month totals
    "Runway to your finish line": "¿Te alcanzará hasta tu meta?",
    "Set a date — graduation, a sabbatical, any finish line — and FinanceOS projects whether your spending pace gets you there, and the most you can spend per month to make it.": "Elige una fecha — graduación, un año sabático, cualquier meta — y FinanceOS proyecta si tu ritmo de gasto te lleva hasta ahí, y lo máximo que puedes gastar al mes para lograrlo.",
    "Set your finish line →": "Define tu meta →",
    "Runway": "Alcance", "your finish line": "tu meta",
    "Adjust plan": "Ajustar plan",
    "One number is enough to start: log what you spent last month and FinanceOS builds your pace from there — no transaction-by-transaction logging needed.": "Un solo número basta para empezar: registra lo que gastaste el mes pasado y FinanceOS calcula tu ritmo desde ahí — sin registrar cada transacción.",
    "+ Log month total": "+ Registrar total del mes",
    "Running short — money runs out": "Vas corto — el dinero se acaba en",
    ", before ": ", antes de ",
    "On track —": "Vas bien —", "left at": "restantes al",
    "runs out": "se acaba", "at finish": "al final",
    "months": "meses", "today": "hoy",
    "Monthly pace": "Ritmo mensual", "your override": "tu ajuste",
    "Max spend / mo": "Gasto máx. / mes", "to finish with": "para terminar con",
    "Liquid today": "Líquido hoy", "checking + savings": "cheques + ahorros",
    "Log month total": "Registrar total del mes",
    "Month": "Mes", "Which month this total covers": "A qué mes corresponde este total",
    "Total spent": "Total gastado",
    "Everything you spent that month — one number, no breakdown needed": "Todo lo que gastaste ese mes — un solo número, sin desglose",
    "Currency": "Moneda", "Note (optional)": "Nota (opcional)",
    "Save": "Guardar", "Enter a month and a total": "Ingresa un mes y un total",
    "Month logged": "Mes registrado",
    "Runway plan": "Plan de alcance", "Finish line": "Meta",
    "What are you making your money last until?": "¿Hasta cuándo debe durarte el dinero?",
    "Target date": "Fecha meta",
    "The date your money needs to reach — e.g. graduation day": "La fecha que tu dinero debe alcanzar — p. ej. el día de graduación",
    "Safety buffer": "Colchón de seguridad",
    "Cushion to keep at the finish line, in": "Colchón a conservar al llegar a la meta, en",
    "Monthly spending (optional)": "Gasto mensual (opcional)",
    "Leave blank to use your measured pace": "Déjalo en blanco para usar tu ritmo medido",
    "Set it to model a what-if.": "Defínelo para simular un escenario.",
    "Save plan": "Guardar plan", "Plan saved": "Plan guardado",
    "{n} logged months": "{n} meses registrados",
    "{n}-month average": "promedio de {n} meses",
    "no data yet": "sin datos aún",
    // one-time hits in the runway
    "One-time hits in this window": "Eventos únicos en este periodo",
    "Counted in January of their year — the money has to be there early.": "Se cuentan en enero de su año — el dinero debe estar disponible desde temprano.",
    "Edit in Projection →": "Editar en Proyección →",
    "Windfall": "Ingreso extraordinario",
    "One-time expense": "Gasto único",
  },
};

/* tiny global helper so call sites stay short */
function tr(s) { return I18N.t(s); }
