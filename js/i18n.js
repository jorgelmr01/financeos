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
      this._regex = new RegExp(">(" + keys.join("|") + ")<", "g");
    }
    const dict = this.dict;
    return html.replace(this._regex, (m, p) => ">" + (dict[p] || p) + "<");
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
  },
};

/* tiny global helper so call sites stay short */
function tr(s) { return I18N.t(s); }
