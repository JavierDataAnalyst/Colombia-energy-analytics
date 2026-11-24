/* Colombia Energy Analytics · project page. All data comes from data/*.json (certified metrics, layer 3). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } },
  };

  // ---------- theme ----------
  const saved = store.get("cea-theme");
  if (saved) root.dataset.theme = saved;
  const isDark = () => (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  const themeBtn = $("#theme");
  const paintIcon = () => { themeBtn.textContent = isDark() ? "☀️" : "🌙"; };
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    store.set("cea-theme", root.dataset.theme);
    paintIcon();
    renderAll();
  });
  paintIcon();

  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const TECH = [
    ["HIDRAULICA", "Hydro", "--wet"], ["TERMICA", "Thermal", "--dry"], ["SOLAR", "Solar", null],
    ["EOLICA", "Wind", null], ["COGENERADOR", "Cogeneration", null], ["UNCLASSIFIED", "Unclassified", "--neutral"],
  ];
  const EXTRA = { SOLAR: "#d4a017", EOLICA: "#2f9e8f", COGENERADOR: "#7c8aa0" };

  let data = null;
  let signal = "inflows";
  const charts = {};

  function baseOptions(extra = {}) {
    const grid = css("--border"), tick = css("--muted");
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: tick, boxWidth: 12, font: { family: "Inter" } } },
                 tooltip: { backgroundColor: isDark() ? "#1d222b" : "#16191d" } },
      scales: {
        x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkipPadding: 14 } },
        y: { grid: { color: grid }, ticks: { color: tick } },
      },
    }, extra);
  }

  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }

  // ---------- 01 · signal vs price ----------
  function renderSignal() {
    const m = data.monthly;
    const labels = m.map((r) => r.year_month);
    const isInflows = signal === "inflows";
    const values = m.map((r) => (isInflows ? r.inflows_pct : r.reservoir_pct));
    const colors = m.map((r) => isInflows
      ? (r.inflows_pct < 70 ? css("--dry") : r.inflows_pct < 100 ? css("--neutral") : css("--wet"))
      : css("--neutral"));
    const k = data.key;
    const corr = isInflows ? k.corr_price_vs_inflows : k.corr_price_vs_reservoir_level;
    $("#corr-label").innerHTML = `correlation with price: <b>${fmt(corr, 2)}</b>`;
    $("#signal-note").textContent = isInflows
      ? "Bars: hydro inflows as % of their historical mean (red = dry, below 70 %; blue = wet, 100 % or more). Dry months line up with the price peaks."
      : "Bars: useful reservoir volume at month end. The lowest level (March 2024) did not bring the highest price: reservoir level alone is a weak signal.";

    draw("c-signal", {
      data: {
        labels,
        datasets: [
          { type: "line", label: "Spot price (COP/kWh)", data: m.map((r) => r.price), yAxisID: "y1",
            borderColor: css("--text"), backgroundColor: css("--text"), pointRadius: 2, borderWidth: 2, tension: 0.25, order: 0 },
          { type: "bar", label: isInflows ? "Inflows (% of historical mean)" : "Reservoir level (%)", data: values, yAxisID: "y",
            backgroundColor: colors.map((c) => c + "80"), borderRadius: 3, order: 1 },
        ],
      },
      options: baseOptions({
        scales: {
          x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 14 } },
          y: { position: "left", grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => v + " %" },
               suggestedMax: isInflows ? 200 : 100 },
          y1: { position: "right", grid: { display: false }, ticks: { color: css("--muted") }, title: { display: true, text: "COP/kWh", color: css("--muted") } },
        },
      }),
    });
  }

  function renderBands() {
    const b = data.key.median_price_by_inflow_band.slice().reverse(); // wet → dry
    const color = (band) => band.startsWith("Dry") ? css("--dry") : band.startsWith("Wet") ? css("--wet") : css("--neutral");
    draw("c-bands", {
      type: "bar",
      data: { labels: b.map((x) => `${x.band.split(" (")[0]} (${x.months} mo.)`),
              datasets: [{ label: "Median spot price (COP/kWh)", data: b.map((x) => x.median_cop_kwh),
                           backgroundColor: b.map((x) => color(x.band)), borderRadius: 6 }] },
      options: baseOptions({ plugins: { legend: { display: false } }, interaction: { mode: "nearest", intersect: true } }),
    });
  }

  // ---------- 02 · mix ----------
  function renderMix() {
    const months = [...new Set(data.mix.map((r) => r.year_month))];
    const byKey = {};
    data.mix.forEach((r) => { byKey[r.year_month + "|" + r.technology] = r.share; });
    const present = TECH.filter(([code]) => data.mix.some((r) => r.technology === code));
    draw("c-mix", {
      type: "line",
      data: {
        labels: months,
        datasets: present.map(([code, label, v], i) => {
          const c = v ? css(v) : EXTRA[code];
          return { label, data: months.map((m) => byKey[m + "|" + code] || 0), fill: i === 0 ? "origin" : "-1", borderColor: c,
                   backgroundColor: c + "b3", pointRadius: 0, borderWidth: 1, tension: 0.2 };
        }),
      },
      options: baseOptions({
        scales: {
          x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 14 } },
          y: { stacked: true, min: 0, max: 100, grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => v + " %" } },
        },
        plugins: { legend: { labels: { color: css("--muted"), boxWidth: 12 } },
                   tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y, 1)} %` } } },
      }),
    });
    const t = data.key.peak_thermal_share_month;
    $("#mix-note").textContent = `Thermal generation peaked at ${fmt(t.pct, 1)} % in ${t.month}, during the El Niño dry period, ` +
      `and moves with the spot price (correlation ${fmt(data.key.corr_price_vs_thermal_share, 2)}).`;
  }

  // ---------- 03 · hourly ----------
  function renderHourly() {
    const year = Number($("#year").value);
    const rows = data.hourly.filter((r) => r.year === year);
    const line = (weekend, color, label) => {
      const d = rows.filter((r) => r.is_weekend === weekend).sort((a, b) => a.hour_of_day - b.hour_of_day);
      return { label, data: d.map((r) => r.demand_mwh), borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 2.5, tension: 0.3 };
    };
    draw("c-hourly", {
      type: "line",
      data: { labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`),
              datasets: [line(false, css("--accent"), "Weekdays"), line(true, css("--muted"), "Weekends")] },
      options: baseOptions({
        scales: {
          x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkipPadding: 10 } },
          y: { grid: { color: css("--border") }, ticks: { color: css("--muted"), callback: (v) => fmt(v) + " MWh" } },
        },
      }),
    });
  }

  // ---------- 05 · quality ----------
  function renderQuality() {
    const q = data.quality;
    const list = $("#tests");
    list.replaceChildren();
    if (!q) { list.textContent = "No test results available."; return; }
    const passed = q.tests.filter((t) => t.status === "pass").length;
    $("#quality-sub").textContent = `${passed} of ${q.tests.length} tests passed in the latest run (${q.run_at.slice(0, 10)}).`;
    const order = ["Accuracy", "Completeness", "Validity", "Consistency", "Uniqueness", "Timeliness", "Structure"];
    q.tests.slice().sort((a, b) => order.indexOf(a.control) - order.indexOf(b.control)).forEach((t) => {
      const li = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = "badge" + (t.status === "pass" ? "" : " fail");
      badge.textContent = t.status === "pass" ? "PASS" : t.status.toUpperCase();
      const control = document.createElement("span");
      control.className = "control";
      control.textContent = t.control;
      const text = document.createElement("span");
      text.textContent = t.description;
      li.append(badge, control, text);
      list.append(li);
    });
  }

  function renderKpis() {
    const k = data.key;
    const bands = k.median_price_by_inflow_band;
    const dry = bands.find((b) => b.band.startsWith("Dry")), wet = bands.find((b) => b.band.startsWith("Wet"));
    const ratio = dry.median_cop_kwh / wet.median_cop_kwh;
    const set = (key, v) => { document.querySelector(`[data-k="${key}"]`).textContent = v; };
    set("corr_inflows", fmt(k.corr_price_vs_inflows, 2));
    set("corr_reservoir", fmt(k.corr_price_vs_reservoir_level, 2));
    set("ratio", `${fmt(ratio, 1)}×`);
    $("#memo-finding").textContent =
      `Across ${k.period_complete_months.from} to ${k.period_complete_months.to}, the median price was ${fmt(dry.median_cop_kwh)} COP/kWh ` +
      `in dry months and ${fmt(wet.median_cop_kwh)} in wet months. The peak, ${fmt(k.peak_spot_price_month.cop_kwh)} COP/kWh in ` +
      `${k.peak_spot_price_month.month}, came while reservoirs were still more than half full.`;
  }

  function renderAll() {
    if (!data || !window.Chart) return;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    renderSignal(); renderBands(); renderMix(); renderHourly();
  }

  // ---------- controls ----------
  document.querySelectorAll("[data-signal]").forEach((b) => b.addEventListener("click", () => {
    signal = b.dataset.signal;
    document.querySelectorAll("[data-signal]").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderSignal();
  }));
  $("#year").addEventListener("change", renderHourly);

  // ---------- load ----------
  const get = (f) => fetch("data/" + f).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all(["monthly.json", "mix.json", "hourly.json", "key_figures.json", "quality.json"].map(get))
    .then(([monthly, mix, hourly, key, quality]) => {
      if (!monthly || !key) { document.querySelector(".hero .lead").textContent += " (Data could not be loaded.)"; return; }
      data = { monthly, mix, hourly, key, quality };
      const years = [...new Set(hourly.map((r) => r.year))].sort();
      const sel = $("#year");
      years.forEach((y) => { const o = document.createElement("option"); o.value = y; o.textContent = y; sel.append(o); });
      sel.value = years.includes(new Date().getFullYear() - 1) ? new Date().getFullYear() - 1 : years[years.length - 1];
      renderKpis();
      renderQuality();
      renderAll();
    });
})();
