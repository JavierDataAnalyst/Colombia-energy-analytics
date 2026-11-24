/* Colombia Energy Analytics · project page.
   Every number comes from data/*.json, exported from the certified metrics layer (dbt, layer 3). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } },
  };
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? "–" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

  // ---------------------------------------------------------------- theme & view
  const savedTheme = store.get("cea-theme");
  if (savedTheme) root.dataset.theme = savedTheme;
  const isDark = () => (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  const paintThemeIcon = () => { $("#theme").textContent = isDark() ? "☀️" : "🌙"; };
  $("#theme").addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    store.set("cea-theme", root.dataset.theme);
    paintThemeIcon();
    renderCharts();
  });
  paintThemeIcon();

  function setView(view) {
    document.body.dataset.view = view;
    $$(".view-switch button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === view));
    store.set("cea-view", view);
    if (state.data) { renderStats(); renderMatrix(); }
  }
  $$(".view-switch button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---------------------------------------------------------------- statistics
  function pearson(xs, ys) {
    const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x != null && y != null);
    const n = pts.length;
    if (n < 3) return { r: NaN, n, slope: NaN, intercept: NaN };
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
    const slope = sxy / sxx;
    return { r: sxy / Math.sqrt(sxx * syy), n, slope, intercept: my - slope * mx };
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const band = (inflows) => (inflows < 70 ? "dry" : inflows < 100 ? "below" : "wet");

  // ---------------------------------------------------------------- state
  const state = { data: null, signal: "inflows", period: "all", metric: "demand_mwh" };
  const charts = {};
  const SIGNALS = {
    inflows: { key: "inflows_pct", label: "Hydro inflows (% of historical mean)",
      note: "Bars: hydro inflows as % of their historical mean (orange = dry, below 70 %; violet = wet, 100 % or more). Dry stretches line up with the price peaks." },
    reservoir: { key: "reservoir_pct", label: "Reservoir level at month end (%)",
      note: "Bars: useful reservoir volume at month end. The lowest level (March 2024) did not bring the highest price: reservoir level alone is a weak signal." },
    thermal: { key: "thermal_pct", label: "Thermal share of generation (%)",
      note: "Bars: share of generation from thermal plants. When water is scarce, thermal plants run more and the price follows them." },
  };

  function filtered() {
    const m = state.data.monthly;
    return state.period === "all" ? m : m.filter((r) => r.year_month.startsWith(state.period));
  }

  // ---------------------------------------------------------------- chart helpers
  function base(extra) {
    const tick = css("--muted"), grid = css("--border");
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: tick, boxWidth: 12, usePointStyle: true } },
        tooltip: { backgroundColor: isDark() ? "#221c35" : "#17132a", padding: 10, cornerRadius: 8 },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkipPadding: 14 } },
        y: { grid: { color: grid }, ticks: { color: tick } },
      },
    }, extra || {});
  }
  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }
  const bandColor = (inflows) => ({ dry: css("--dry"), below: css("--neutral"), wet: css("--wet") })[band(inflows)];

  // ---------------------------------------------------------------- 01 · signal vs price
  function renderSignal() {
    const rows = filtered(), sig = SIGNALS[state.signal];
    const colors = rows.map((r) => (state.signal === "inflows" ? bandColor(r.inflows_pct)
      : state.signal === "thermal" ? css("--dry") : css("--wet")));
    $("#signal-note").textContent = sig.note;
    draw("c-signal", {
      data: {
        labels: rows.map((r) => r.year_month),
        datasets: [
          { type: "line", label: "Spot price (COP/kWh)", data: rows.map((r) => r.price), yAxisID: "y1", order: 0,
            borderColor: css("--text"), backgroundColor: css("--text"), pointRadius: 2.5, pointHoverRadius: 5, borderWidth: 2.2, tension: 0.25 },
          { type: "bar", label: sig.label, data: rows.map((r) => r[sig.key]), yAxisID: "y", order: 1,
            backgroundColor: colors.map((c) => alpha(c, 0.55)), hoverBackgroundColor: colors, borderRadius: 4 },
        ],
      },
      options: base({
        scales: {
          x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 14 } },
          y: { position: "left", min: 0, suggestedMax: state.signal === "inflows" ? 200 : 100, grid: { color: css("--border") },
               ticks: { color: css("--muted"), callback: (v) => v + " %" } },
          y1: { position: "right", grid: { display: false }, ticks: { color: css("--muted") },
                title: { display: true, text: "COP/kWh", color: css("--muted") } },
        },
      }),
    });
  }

  function renderStats() {
    const rows = filtered(), sig = SIGNALS[state.signal];
    const s = pearson(rows.map((r) => r[sig.key]), rows.map((r) => r.price));
    const strength = Math.abs(s.r) >= 0.6 ? "strong" : Math.abs(s.r) >= 0.3 ? "moderate" : "weak";
    const dir = s.r < 0 ? "when it goes down, the price tends to go up" : "they tend to move together";
    $("#stat-main").innerHTML = `Relationship with the price: <b>${strength}</b> (${dir}).`;
    $("#stat-tech").textContent = `Pearson r = ${fmt(s.r, 2)} · R² = ${fmt(s.r * s.r, 2)} · slope = ${fmt(s.slope, 1)} COP/kWh per pp · n = ${s.n}`;
  }

  // ---------------------------------------------------------------- 02 · scatter, bands, matrix
  function renderScatter() {
    const rows = filtered(), sig = SIGNALS[state.signal];
    const pts = rows.filter((r) => r[sig.key] != null).map((r) => ({ x: r[sig.key], y: r.price, m: r.year_month, b: r.inflows_pct }));
    const s = pearson(pts.map((p) => p.x), pts.map((p) => p.y));
    const xs = pts.map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    draw("c-scatter", {
      type: "scatter",
      data: { datasets: [
        { label: "Month (colour = hydrology)", data: pts, pointRadius: 5.5, pointHoverRadius: 8,
          backgroundColor: pts.map((p) => alpha(bandColor(p.b), 0.8)), borderColor: pts.map((p) => bandColor(p.b)) },
        { type: "line", label: `Linear fit (r = ${fmt(s.r, 2)})`, data: [{ x: x0, y: s.intercept + s.slope * x0 }, { x: x1, y: s.intercept + s.slope * x1 }],
          borderColor: css("--brand"), borderDash: [6, 5], borderWidth: 2, pointRadius: 0 },
      ] },
      options: base({
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { labels: { color: css("--muted"), boxWidth: 12, usePointStyle: true } },
          tooltip: { backgroundColor: isDark() ? "#221c35" : "#17132a",
            callbacks: { label: (c) => (c.raw.m ? `${c.raw.m}: ${fmt(c.raw.x, 1)} % → ${fmt(c.raw.y)} COP/kWh` : c.dataset.label) } },
        },
        scales: {
          x: { type: "linear", grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => v + " %" },
               title: { display: true, text: sig.label, color: css("--muted") } },
          y: { min: 0, grid: { color: css("--border") }, ticks: { color: css("--muted") },
               title: { display: true, text: "Spot price (COP/kWh)", color: css("--muted") } },
        },
      }),
    });
  }

  function renderBands() {
    const rows = filtered();
    const groups = [["wet", "Wet (≥100 %)"], ["below", "Below normal"], ["dry", "Dry (<70 %)"]]
      .map(([k, label]) => { const g = rows.filter((r) => band(r.inflows_pct) === k); return { k, label, n: g.length, med: g.length ? median(g.map((r) => r.price)) : null }; })
      .filter((g) => g.n);
    draw("c-bands", {
      type: "bar",
      data: { labels: groups.map((g) => `${g.label} · ${g.n} mo.`),
              datasets: [{ label: "Median spot price", data: groups.map((g) => g.med), borderRadius: 8,
                           backgroundColor: groups.map((g) => ({ dry: css("--dry"), below: css("--neutral"), wet: css("--wet") })[g.k]) }] },
      options: base({
        indexAxis: "y", interaction: { mode: "nearest", intersect: true },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${fmt(c.parsed.x)} COP/kWh` } } },
        scales: { x: { grid: { color: css("--border") }, ticks: { color: css("--muted") } },
                  y: { grid: { display: false }, ticks: { color: css("--muted") } } },
      }),
    });
  }

  function renderMatrix() {
    if (document.body.dataset.view !== "tech") return;
    const rows = filtered();
    const vars = [["price", "Price"], ["inflows_pct", "Inflows"], ["reservoir_pct", "Reservoir"], ["thermal_pct", "Thermal"]];
    const t = $("#matrix");
    t.replaceChildren();
    const head = document.createElement("tr");
    head.append(document.createElement("th"));
    vars.forEach(([, l]) => { const th = document.createElement("th"); th.textContent = l; head.append(th); });
    t.append(head);
    vars.forEach(([ka, la]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th"); th.textContent = la; tr.append(th);
      vars.forEach(([kb]) => {
        const r = pearson(rows.map((x) => x[ka]), rows.map((x) => x[kb])).r;
        const td = document.createElement("td");
        td.textContent = fmt(r, 2);
        td.style.background = alpha(r < 0 ? css("--dry") : css("--wet"), Math.min(Math.abs(r) || 0, 1) * 0.45);
        tr.append(td);
      });
      t.append(tr);
    });
    $("#matrix-n").textContent = rows.length;
  }

  // ---------------------------------------------------------------- 03 · mix
  const TECH = [["HIDRAULICA", "Hydro", "--wet"], ["TERMICA", "Thermal", "--dry"], ["SOLAR", "Solar", "#d4a017"],
                ["EOLICA", "Wind", "#2f9e8f"], ["COGENERADOR", "Cogeneration", "#8a83a3"], ["UNCLASSIFIED", "Unclassified", "--neutral"]];
  function renderMix() {
    const months = [...new Set(state.data.mix.map((r) => r.year_month))];
    const by = {};
    state.data.mix.forEach((r) => { by[r.year_month + "|" + r.technology] = r.share; });
    const present = TECH.filter(([code]) => state.data.mix.some((r) => r.technology === code));
    draw("c-mix", {
      type: "line",
      data: { labels: months, datasets: present.map(([code, label, c], i) => {
        const color = c.startsWith("--") ? css(c) : c;
        return { label, data: months.map((m) => by[m + "|" + code] || 0), fill: i === 0 ? "origin" : "-1",
                 borderColor: color, backgroundColor: alpha(color, 0.7), pointRadius: 0, borderWidth: 1, tension: 0.2 };
      }) },
      options: base({
        plugins: { legend: { labels: { color: css("--muted"), boxWidth: 12, usePointStyle: true } },
                   tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y, 1)} %` } } },
        scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 14 } },
                  y: { stacked: true, min: 0, max: 100, grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => v + " %" } } },
      }),
    });
    const t = state.data.key.peak_thermal_share_month;
    $("#mix-note").textContent = `Thermal generation peaked at ${fmt(t.pct, 1)} % in ${t.month}, during the El Niño dry period, and moves with the spot price (r = ${fmt(state.data.key.corr_price_vs_thermal_share, 2)}).`;
  }

  // ---------------------------------------------------------------- 04 · hourly
  function renderHourly() {
    const year = Number($("#year").value), metric = state.metric;
    const rows = state.data.hourly.filter((r) => r.year === year);
    const line = (weekend, color, label) => {
      const d = rows.filter((r) => r.is_weekend === weekend).sort((a, b) => a.hour_of_day - b.hour_of_day);
      return { label, data: d.map((r) => r[metric]), borderColor: color, backgroundColor: alpha(color, 0.12), fill: true,
               pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5, tension: 0.35 };
    };
    const unit = metric === "price" ? " COP/kWh" : " MWh";
    draw("c-hourly", {
      type: "line",
      data: { labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`),
              datasets: [line(false, css("--brand"), "Weekdays"), line(true, css("--orange"), "Weekends")] },
      options: base({ scales: {
        x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 10 } },
        y: { grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => fmt(v) + unit } } } }),
    });
    const wd = rows.filter((r) => !r.is_weekend);
    const peak = wd.length ? wd.reduce((a, b) => (b[metric] > a[metric] ? b : a)) : null;
    $("#hourly-note").textContent = peak ? `On weekdays in ${year}, the ${metric === "price" ? "price" : "demand"} peaks between ` +
      `${String(peak.hour_of_day - 1).padStart(2, "0")}:00 and ${String(peak.hour_of_day).padStart(2, "0")}:00 (${fmt(peak[metric])}${unit}).` : "";
  }

  // ---------------------------------------------------------------- 05 · pipeline & SQL
  function showLayer(li) {
    const tech = state.data.technical;
    const files = { sources: ["etl/ingest.py", "etl/xm_client.py", "etl/metrics.py", "data/landing/_manifest.csv"],
                    core: [...(tech?.layers.staging || []), ...(tech?.layers.core || [])],
                    metrics: tech?.layers.metrics || [],
                    product: ["app/build_report.py", "docs/index.html", "docs/data/*.json"] }[li.dataset.layer];
    const box = $("#layer-detail");
    const same = li.getAttribute("aria-current") === "true";
    $$("#layers li").forEach((x) => x.setAttribute("aria-current", "false"));
    if (same) { box.hidden = true; return; }
    li.setAttribute("aria-current", "true");
    box.replaceChildren();
    const h = document.createElement("h4"); h.textContent = li.querySelector(".tag").textContent + " — files and models";
    const ul = document.createElement("ul");
    files.forEach((m) => { const x = document.createElement("li"); x.textContent = m; ul.append(x); });
    box.append(h, ul);
    box.hidden = false;
  }
  $$("#layers li").forEach((li) => {
    li.addEventListener("click", () => state.data && showLayer(li));
    li.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && state.data) { e.preventDefault(); showLayer(li); } });
  });

  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function highlightSql(sql) {
    return escapeHtml(sql).replace(/(--[^\n]*)|\b(select|from|join|using|where|group by|order by|over|partition by|with|as|and|or|case|when|then|else|end|left|on|desc|limit|union all)\b|\b(sum|avg|max|min|count|arg_max|strftime|round)\b/gi,
      (m, c, k, f) => (c ? `<span class="c">${c}</span>` : k ? `<span class="k">${k}</span>` : `<span class="f">${f}</span>`));
  }
  function renderSql() {
    const sql = state.data.technical?.metrics_sql || {};
    const pick = $("#sql-pick");
    if (!pick.options.length) Object.keys(sql).forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = k; pick.append(o); });
    if (sql.mtr_market_monthly && !pick.dataset.init) { pick.value = "mtr_market_monthly"; pick.dataset.init = "1"; }
    $("#sql").innerHTML = highlightSql(sql[pick.value] || "");
  }
  $("#sql-pick").addEventListener("change", renderSql);
  $("#copy-sql").addEventListener("click", (e) => {
    const text = state.data?.technical?.metrics_sql?.[$("#sql-pick").value] || "";
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { e.target.textContent = "Copied ✓"; setTimeout(() => (e.target.textContent = "Copy"), 1500); });
  });

  // ---------------------------------------------------------------- 06 · quality
  function renderQuality() {
    const q = state.data.quality, list = $("#tests");
    list.replaceChildren();
    if (!q) { list.textContent = "No test results available."; return; }
    const passed = q.tests.filter((t) => t.status === "pass").length;
    $("#ring").style.setProperty("--p", (passed / q.tests.length) * 100);
    $("#ring-text").textContent = `${passed}/${q.tests.length}`;
    $("#quality-sub").textContent = `${passed} of ${q.tests.length} tests passed in the latest run (${q.run_at.slice(0, 10)}).`;
    $("#updated").textContent = `Data refreshed ${q.run_at.slice(0, 10)}.`;
    const order = ["Accuracy", "Completeness", "Validity", "Consistency", "Uniqueness", "Timeliness", "Structure"];
    q.tests.slice().sort((a, b) => order.indexOf(a.control) - order.indexOf(b.control)).forEach((t) => {
      const li = document.createElement("li");
      const b = document.createElement("span"); b.className = "badge" + (t.status === "pass" ? "" : " fail");
      b.textContent = t.status === "pass" ? "PASS" : String(t.status).toUpperCase();
      const c = document.createElement("span"); c.className = "control"; c.textContent = t.control;
      const d = document.createElement("span"); d.textContent = t.description;
      li.append(b, c, d); list.append(li);
    });
  }

  // ---------------------------------------------------------------- KPIs (count-up)
  function countUp(el, to, decimals, suffix) {
    el.textContent = fmt(to, decimals) + suffix; // final value first: correct even if animation never runs
    if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e, decimals) + suffix; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function renderKpis() {
    const k = state.data.key, b = k.median_price_by_inflow_band;
    const dry = b.find((x) => x.band.startsWith("Dry")), wet = b.find((x) => x.band.startsWith("Wet"));
    const ratio = dry.median_cop_kwh / wet.median_cop_kwh;
    countUp($('[data-count="corr_inflows"]'), k.corr_price_vs_inflows, 2, "");
    countUp($('[data-count="corr_reservoir"]'), k.corr_price_vs_reservoir_level, 2, "");
    countUp($('[data-count="ratio"]'), ratio, 1, "×");
    countUp($('[data-count="records"]'), 11.1, 1, " M");
    $$('[data-fill="ratio_text"]').forEach((e) => { e.textContent = fmt(ratio, 0) + "×"; });
    $$('[data-fill="n_months"]').forEach((e) => { e.textContent = state.data.monthly.length; });
  }

  // ---------------------------------------------------------------- controls
  $$("#signal button").forEach((b) => b.addEventListener("click", () => {
    state.signal = b.dataset.signal;
    $$("#signal button").forEach((x) => x.setAttribute("aria-selected", x === b));
    if (state.data) { renderSignal(); renderStats(); renderScatter(); }
  }));
  $$("#hour-metric button").forEach((b) => b.addEventListener("click", () => {
    state.metric = b.dataset.metric;
    $$("#hour-metric button").forEach((x) => x.setAttribute("aria-selected", x === b));
    if (state.data) renderHourly();
  }));
  $("#year").addEventListener("change", () => state.data && renderHourly());

  function buildPeriods() {
    const years = [...new Set(state.data.monthly.map((r) => r.year_month.slice(0, 4)))];
    const box = $("#period");
    ["all", ...years].forEach((p) => {
      const b = document.createElement("button");
      b.textContent = p === "all" ? "All years" : p;
      b.setAttribute("aria-pressed", p === state.period);
      b.addEventListener("click", () => {
        state.period = p;
        $$("#period button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        renderSignal(); renderStats(); renderScatter(); renderBands(); renderMatrix();
      });
      box.append(b);
    });
  }

  function renderCharts() {
    if (!state.data || !window.Chart) return;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    renderSignal(); renderScatter(); renderBands(); renderMix(); renderHourly();
  }

  // ---------------------------------------------------------------- load
  setView(store.get("cea-view") || "exec");
  const get = (f) => fetch("data/" + f).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all(["monthly.json", "mix.json", "hourly.json", "key_figures.json", "quality.json", "technical.json"].map(get))
    .then(([monthly, mix, hourly, key, quality, technical]) => {
      if (!monthly || !key || !mix || !hourly) { $(".lead").textContent += " (Data could not be loaded.)"; return; }
      const thermal = {};
      mix.filter((r) => r.technology === "TERMICA").forEach((r) => { thermal[r.year_month] = r.share; });
      monthly.forEach((r) => { r.thermal_pct = thermal[r.year_month] ?? null; });
      state.data = { monthly, mix, hourly, key, quality, technical };

      const years = [...new Set(hourly.map((r) => r.year))].sort();
      const full = years.filter((y) => y < new Date().getFullYear());
      years.forEach((y) => { const o = document.createElement("option"); o.value = y; o.textContent = y; $("#year").append(o); });
      $("#year").value = full.length ? full[full.length - 1] : years[years.length - 1];

      buildPeriods(); renderKpis(); renderQuality(); renderSql(); renderCharts(); renderStats(); renderMatrix();
    });
})();
