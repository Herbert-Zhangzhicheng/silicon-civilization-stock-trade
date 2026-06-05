// Static renderer for snapshots in ./data/*.json.
// No build step, no framework — just fetch + DOM.

const $ = (sel) => document.querySelector(sel);
const fmt = {
  num: (v, digits = 2) => (v == null || Number.isNaN(v) ? "无" : v.toFixed(digits)),
  pct: (v, digits = 1) => (v == null || Number.isNaN(v) ? "无" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`),
  int: (v) => (v == null ? "无" : v.toLocaleString()),
  money: (v) => (v == null ? "无" : `¥${Math.round(v).toLocaleString()}`),
};

const CONSUMPTION_DOMAINS = [
  {
    id: "compute",
    short: "算",
    name: "推理与训练",
    thesis: "把电能和数据转化为智能行为，是硅基生命的肌肉与大脑。",
    demand: "GPU、AI 芯片、服务器、云与集群调度",
    themes: ["算力/AI芯片", "AI服务器", "云/AI基建"],
  },
  {
    id: "memory",
    short: "存",
    name: "记忆与权重",
    thesis: "保存模型权重、上下文和训练样本，让智能体能持续进化。",
    demand: "HBM、DRAM、NAND、存储控制与模组",
    themes: ["存储/HBM"],
  },
  {
    id: "optics",
    short: "光",
    name: "集群互连",
    thesis: "让算力节点彼此看见，决定大模型训练和推理集群的带宽上限。",
    demand: "光模块、光器件、高速互连",
    themes: ["光模块"],
  },
  {
    id: "power",
    short: "电",
    name: "能量与散热",
    thesis: "把电力稳定送入机柜，并把热量带走，维持硅基生命体征。",
    demand: "电力、功率半导体、液冷、IDC",
    themes: ["电力", "功率半导体", "液冷", "IDC"],
  },
  {
    id: "package",
    short: "封",
    name: "封装与制造",
    thesis: "把芯片、材料、晶圆和板级系统封成可规模交付的身体。",
    demand: "半导体设备、材料、晶圆代工、AI-PCB",
    themes: ["半导体设备", "半导体材料", "晶圆代工", "AI-PCB"],
  },
];

const DOMAIN_BY_THEME = new Map(
  CONSUMPTION_DOMAINS.flatMap((domain) =>
    domain.themes.map((theme) => [theme, domain]),
  ),
);

function getConsumptionDomain(theme) {
  return DOMAIN_BY_THEME.get(theme) ?? CONSUMPTION_DOMAINS[0];
}

async function loadJson(name) {
  const r = await fetch(`./data/${name}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  return r.json();
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// ---------- KPI summary ----------
function renderKpis({ universe, analyst, signals, backtest, meta }) {
  const grid = $("#kpi-grid");
  grid.innerHTML = "";
  const themes = new Set(universe.entries.map((e) => e.theme));
  const total = universe.entries.length;
  const globalCount = universe.entries.filter((e) => e.global_supply).length;
  const globalPct = total ? Math.round((globalCount / total) * 100) : 0;
  const upsideCount = analyst.items.filter((a) => (a.upside_pct ?? 0) > 0).length;
  const buys = (signals?.signals ?? []).filter((s) => s.action === "buy").length;
  const sells = (signals?.signals ?? []).filter((s) => s.action === "sell").length;
  const stamp = new Date(meta.generated_at);
  const stampStr = stamp.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const cards = [
    ["股票池", `${universe.entries.length}`, `${themes.size} 个子主题`],
    ["全球供应链", `${globalCount}`, `${globalPct}% 覆盖`],
    ["消费领域", `${CONSUMPTION_DOMAINS.length}`, "存 / 算 / 光 / 电 / 封"],
    ["上行空间 > 0", `${upsideCount}`, `按分析师目标价`],
  ];
  for (const [label, value, sub] of cards) {
    grid.appendChild(el("div", { class: "metric" }, [
      el("span", { class: "label" }, label),
      el("strong", {}, value),
      el("span", {}, sub),
    ]));
  }
  $("#meta-line").textContent = `数据生成时间：${stampStr} · 股票池更新：${universe.updated_at} (${universe.updated_by})`;
}

function renderDomains({ universe }) {
  const grid = $("#domain-grid");
  grid.innerHTML = "";
  const counts = new Map(CONSUMPTION_DOMAINS.map((domain) => [domain.id, 0]));
  for (const entry of universe.entries) {
    const domain = getConsumptionDomain(entry.theme);
    counts.set(domain.id, (counts.get(domain.id) ?? 0) + 1);
  }
  for (const domain of CONSUMPTION_DOMAINS) {
    grid.appendChild(el("div", { class: `domain-card domain-${domain.id}` }, [
      el("div", { class: "domain-symbol" }, domain.short),
      el("div", { class: "domain-copy" }, [
        el("div", { class: "domain-title" }, [
          el("strong", {}, domain.name),
          el("span", {}, `${counts.get(domain.id) ?? 0} 只`),
        ]),
        el("p", {}, domain.thesis),
        el("div", { class: "domain-demand" }, domain.demand),
      ]),
    ]));
  }
}

// ---------- Universe table ----------
function renderUniverse({ universe, analyst }) {
  const analystBySym = new Map(analyst.items.map((a) => [a.symbol, a]));
  const themes = [...new Set(universe.entries.map((e) => e.theme))].sort();
  const themeSelect = $("#theme");
  for (const t of themes) themeSelect.appendChild(el("option", { value: t }, t));
  const domainSelect = $("#domain");
  for (const d of CONSUMPTION_DOMAINS) {
    domainSelect.appendChild(el("option", { value: d.id }, `${d.short} · ${d.name}`));
  }

  const state = { query: "", domain: "all", theme: "all", onlyGlobal: false, onlyUpside: false };
  $("#search").addEventListener("input", (e) => { state.query = e.target.value.trim().toLowerCase(); render(); });
  $("#domain").addEventListener("change", (e) => { state.domain = e.target.value; render(); });
  $("#theme").addEventListener("change", (e) => { state.theme = e.target.value; render(); });
  $("#onlyGlobal").addEventListener("change", (e) => { state.onlyGlobal = e.target.checked; render(); });
  $("#onlyUpside").addEventListener("change", (e) => { state.onlyUpside = e.target.checked; render(); });

  function render() {
    const grid = $("#universe-grid");
    grid.innerHTML = "";
    let shown = 0;
    const grouped = new Map();
    for (const e of universe.entries) {
      const a = analystBySym.get(e.symbol);
      const domain = getConsumptionDomain(e.theme);
      if (state.domain !== "all" && domain.id !== state.domain) continue;
      if (state.theme !== "all" && e.theme !== state.theme) continue;
      if (state.onlyGlobal && !e.global_supply) continue;
      if (state.onlyUpside && !(a?.upside_pct > 0)) continue;
      if (state.query) {
        const hay = `${e.symbol} ${e.name} ${e.theme} ${domain.short} ${domain.name} ${e.note ?? ""}`.toLowerCase();
        if (!hay.includes(state.query)) continue;
      }
      shown++;
      if (!grouped.has(e.theme)) grouped.set(e.theme, []);
      grouped.get(e.theme).push({ e, a });
    }
    for (const [theme, items] of grouped) {
      const tbody = el("tbody");
      for (const { e, a } of items) {
        const u = a?.upside_pct;
        const uClass = u == null ? "muted" : u > 0 ? "pos" : "neg";
        const domain = getConsumptionDomain(e.theme);
        tbody.appendChild(el("tr", {}, [
          el("td", { class: "mono" }, e.symbol),
          el("td", {}, [
            el("div", { class: "stock-name" }, e.name),
            e.note ? el("div", { class: "stock-note" }, e.note) : null,
          ]),
          el("td", {}, el("span", { class: `domain-pill domain-${domain.id}` }, domain.short)),
          el("td", {}, el("span", { class: e.global_supply ? "pill good" : "pill" }, e.global_supply ? "是" : "否")),
          el("td", { class: "num" }, fmt.num(a?.current_price)),
          el("td", { class: "num" }, fmt.num(a?.implied_target)),
          el("td", { class: `num ${uClass}` }, u == null ? "无" : fmt.pct(u, 0)),
          el("td", { class: "num muted" }, a?.buy_count != null && a?.total_count ? `${a.buy_count}/${a.total_count}` : "无"),
        ]));
      }
      const panel = el("div", { class: "theme-panel" }, [
        el("div", { class: "theme-title" }, [
          el("div", {}, [
            el("strong", {}, theme),
            el("small", {}, `${getConsumptionDomain(theme).short} · ${getConsumptionDomain(theme).name}`),
          ]),
          el("span", {}, `${items.length} 只`),
        ]),
        el("div", { class: "table-wrap" }, el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", {}, "代码"), el("th", {}, "名称"), el("th", {}, "消费"), el("th", {}, "全球链"),
            el("th", { class: "num" }, "现价"), el("th", { class: "num" }, "目标价"),
            el("th", { class: "num" }, "上行"), el("th", { class: "num" }, "买入评级"),
          ])),
          tbody,
        ])),
      ]);
      grid.appendChild(panel);
    }
    $("#status").textContent = `显示 ${shown}/${universe.entries.length}`;
  }
  render();
}

// ---------- Signals ----------
function renderSignals({ universe, signals }) {
  const tbody = $("#signals-table tbody");
  tbody.innerHTML = "";
  if (!signals) {
    tbody.appendChild(el("tr", {}, el("td", { colspan: 8, class: "muted" }, "无信号快照")));
    return;
  }
  const sigBySym = new Map((signals.signals ?? []).map((s) => [s.symbol, s]));
  const fundBySym = new Map((signals.fundamentals ?? []).map((f) => [f.symbol, f]));
  let buys = 0, sells = 0;
  // Sort: buys by confidence desc, then sells, then holds.
  const order = { buy: 0, hold: 2, sell: 1 };
  const rows = universe.entries
    .map((e) => ({ e, s: sigBySym.get(e.symbol), f: fundBySym.get(e.symbol) }))
    .sort((a, b) => {
      const oa = order[a.s?.action ?? "hold"], ob = order[b.s?.action ?? "hold"];
      if (oa !== ob) return oa - ob;
      return (b.s?.confidence ?? 0) - (a.s?.confidence ?? 0);
    });
  for (const { e, s, f } of rows) {
    if (s?.action === "buy") buys++;
    else if (s?.action === "sell") sells++;
    tbody.appendChild(el("tr", {}, [
      el("td", { class: "mono" }, e.symbol),
      el("td", {}, e.name),
      el("td", { class: "muted" }, e.theme),
      el("td", {}, el("span", { class: `badge ${s?.action ?? ""}` }, s?.action ?? "n/a")),
      el("td", { class: "num" }, s ? `${(s.confidence * 100).toFixed(0)}%` : "—"),
      el("td", { class: "num" }, s ? `${(s.size * 100).toFixed(0)}%` : "—"),
      el("td", { class: "num" }, fmt.num(f?.pe_ttm, 1)),
      el("td", { class: "muted signal-reason" }, s?.rationale ?? "—"),
    ]));
  }
  $("#signals-summary").textContent = `${buys} 买入 · ${sells} 卖出`;
}

// ---------- Backtest ----------
function renderBacktest(bt) {
  if (!bt) return;
  const { config, stats, equityCurve, trades } = bt;
  $("#backtest-window").textContent =
    `${config.startDate} → ${config.endDate} · 起始资金 ¥${config.startCash.toLocaleString()}` +
    ` · 每 ${config.rebalanceEveryNDays} 日调仓 · 最多 ${config.maxPositions} 持仓 · 手续费 ${config.feeBps}bps`;

  const kpi = $("#backtest-kpi");
  kpi.innerHTML = "";
  const cards = [
    ["总收益", fmt.pct(stats.totalReturnPct, 1), stats.totalReturnPct >= 0 ? "pos" : "neg", "全程"],
    ["年化(CAGR)", fmt.pct(stats.cagrPct, 1), stats.cagrPct >= 0 ? "pos" : "neg", "复合年化"],
    ["最大回撤", fmt.pct(stats.maxDrawdownPct, 1), "neg", "峰谷"],
    ["夏普", stats.sharpe == null ? "无" : stats.sharpe.toFixed(2), "", `${stats.trades} 笔交易`],
  ];
  for (const [label, value, cls, sub] of cards) {
    kpi.appendChild(el("div", { class: "metric" }, [
      el("span", { class: "label" }, label),
      el("strong", { class: cls }, value),
      el("span", {}, sub),
    ]));
  }

  drawEquityChart(equityCurve, config.startCash);

  const tbody = $("#trades-table tbody");
  tbody.innerHTML = "";
  // Most recent first.
  const recent = trades.slice().reverse();
  for (const t of recent) {
    tbody.appendChild(el("tr", {}, [
      el("td", { class: "mono" }, t.date),
      el("td", {}, el("span", { class: `badge ${t.side}` }, t.side)),
      el("td", { class: "mono" }, t.symbol),
      el("td", { class: "num" }, fmt.int(t.shares)),
      el("td", { class: "num" }, fmt.num(t.price)),
    ]));
  }
  $("#trades-count").textContent = `共 ${trades.length} 笔（最新在上）`;
}

function drawEquityChart(curve, baseline) {
  const canvas = $("#equity-chart");
  if (!curve || curve.length === 0) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function draw() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 56, r: 12, t: 12, b: 26 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const values = curve.map((b) => b.equity);
    const min = Math.min(baseline, ...values);
    const max = Math.max(baseline, ...values);
    const range = max - min || 1;
    const denom = curve.length > 1 ? curve.length - 1 : 1;
    const xAt = (i) => pad.l + (i / denom) * innerW;
    const yAt = (v) => pad.t + innerH - ((v - min) / range) * innerH;

    // grid + y axis labels
    ctx.font = "11px ui-sans-serif, -apple-system, sans-serif";
    ctx.fillStyle = "#9ca39a";
    ctx.strokeStyle = "#30343b";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = min + (range * i) / 4;
      const y = yAt(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`¥${Math.round(v / 1000)}k`, pad.l - 6, y);
    }

    // baseline line
    ctx.strokeStyle = "rgba(242,184,75,0.6)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, yAt(baseline));
    ctx.lineTo(W - pad.r, yAt(baseline));
    ctx.stroke();
    ctx.setLineDash([]);

    // equity line + fill
    const last = curve[curve.length - 1].equity;
    const color = last >= baseline ? "#63d471" : "#ff6b6b";
    ctx.fillStyle = last >= baseline ? "rgba(99,212,113,0.15)" : "rgba(255,107,107,0.15)";
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(curve[0].equity));
    for (let i = 1; i < curve.length; i++) ctx.lineTo(xAt(i), yAt(curve[i].equity));
    ctx.lineTo(xAt(curve.length - 1), pad.t + innerH);
    ctx.lineTo(xAt(0), pad.t + innerH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(curve[0].equity));
    for (let i = 1; i < curve.length; i++) ctx.lineTo(xAt(i), yAt(curve[i].equity));
    ctx.stroke();

    // x labels: first, middle, last
    ctx.fillStyle = "#9ca39a";
    ctx.textBaseline = "top";
    const ticks = [0, Math.floor(curve.length / 2), curve.length - 1];
    for (const i of ticks) {
      ctx.textAlign = i === 0 ? "left" : i === curve.length - 1 ? "right" : "center";
      ctx.fillText(curve[i].date, xAt(i), H - pad.b + 6);
    }
  }
  draw();
  // Redraw on resize (debounced).
  let raf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
}

// ---------- Boot ----------
(async () => {
  try {
    const [universe, analyst, meta] = await Promise.all([
      loadJson("universe.json"),
      loadJson("analyst.json"),
      loadJson("meta.json"),
    ]);
    const [signals, backtest] = await Promise.all([
      loadJson("signals.json").catch(() => null),
      loadJson("backtest.json").catch(() => null),
    ]);
    renderKpis({ universe, analyst, signals, backtest, meta });
    renderDomains({ universe });
    renderUniverse({ universe, analyst });
    renderSignals({ universe, signals });
    renderBacktest(backtest);
  } catch (e) {
    document.body.innerHTML =
      `<div class="container"><h1>加载失败</h1><p>${e.message}</p>` +
      `<p>请先在 <code>web/</code> 下运行 <code>npx tsx scripts/snapshot.ts</code> 生成 <code>docs/data/</code>。</p></div>`;
  }
})();
