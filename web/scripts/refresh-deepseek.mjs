import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const ROOT = path.resolve("..");
const DOCS = path.join(ROOT, "docs", "data");
const CACHE_FILE = path.join(".cache", "deepseek-refresh.json");
fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
const cache = fs.existsSync(CACHE_FILE)
  ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
  : {};

const universe = JSON.parse(fs.readFileSync(path.join("data", "universe.json"), "utf8"));
const analyst = JSON.parse(fs.readFileSync(path.join(DOCS, "analyst.json"), "utf8"));
const analystBySymbol = new Map(analyst.items.map((item) => [item.symbol, item]));
const now = new Date().toISOString();

const SYSTEM_PROMPT = `你是专注中国A股“硅基生命消费链”的量化策略研究员。
研究对象是AI算力体为保存、计算、互连、供电散热、封装成体和制造扩张所消费的供应链。
综合评估：基本面估值40%、主题景气30%、价格动量30%。
输出严格JSON：{"signals":[{"symbol":"6位代码","action":"buy|hold|sell","confidence":0到1,"size":0到1,"rationale":"中文，不超过60字"}]}
必须为输入中的每只股票返回一条信号，不输出其他文字。`;

function sha(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function saveCache() {
  writeJsonAtomic(CACHE_FILE, cache);
}

function writeJsonAtomic(filename, value) {
  const temp = `${filename}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filename);
}

async function fetchJson(url, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://finance.sina.com.cn/",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
    }
  }
  throw lastError;
}

function sinaSymbol(symbol) {
  return `${symbol.startsWith("6") ? "sh" : "sz"}${symbol}`;
}

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return out;
}

async function loadSeries(entry, index) {
  const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${sinaSymbol(entry.symbol)}&scale=240&ma=no&datalen=500`;
  try {
    const rows = await fetchJson(url);
    const klines = rows.map((row) => ({
      date: row.day,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    })).filter((row) => Number.isFinite(row.close));
    console.log(`bars ${index + 1}/${universe.entries.length} ${entry.symbol} ${klines.length}`);
    return { entry, klines };
  } catch (error) {
    console.warn(`bars ${entry.symbol} failed: ${error.message}`);
    return { entry, klines: [] };
  }
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("DeepSeek response did not contain JSON");
  }
}

async function scoreChunk(snapshots, asOf, mode) {
  const payload = {
    as_of: asOf,
    mode,
    symbols: snapshots.map((snapshot) => ({
      symbol: snapshot.symbol,
      name: snapshot.name,
      theme: snapshot.theme,
      closes_tail30: snapshot.closes.slice(-30).map((value) => Number(value.toFixed(3))),
      pe_ttm: snapshot.fundamental?.pe_ttm ?? null,
      pb: snapshot.fundamental?.pb ?? null,
      market_cap_yi: snapshot.fundamental?.market_cap ?? null,
    })),
  };
  const model = mode === "backtest"
    ? process.env.DEEPSEEK_MODEL_BACKTEST
    : process.env.DEEPSEEK_MODEL;
  const key = sha({ model, system: SYSTEM_PROMPT, payload });
  if (cache[key]) return cache[key].signals;

  let body;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
      body = await response.json();
      break;
    } catch (error) {
      lastError = error;
      console.warn(`DeepSeek retry ${attempt}/4 (${asOf}, ${snapshots[0]?.symbol}..): ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (!body) throw lastError;
  const parsed = extractJson(body.choices?.[0]?.message?.content ?? "");
  const bySymbol = new Map((parsed.signals ?? []).map((signal) => [String(signal.symbol), signal]));
  const signals = snapshots.map((snapshot) => {
    const signal = bySymbol.get(snapshot.symbol);
    return {
      symbol: snapshot.symbol,
      action: ["buy", "hold", "sell"].includes(signal?.action) ? signal.action : "hold",
      confidence: Math.max(0, Math.min(1, Number(signal?.confidence ?? 0.5))),
      size: Math.max(0, Math.min(1, Number(signal?.size ?? 0))),
      rationale: String(signal?.rationale ?? "模型未返回有效判断，暂观望").slice(0, 80),
    };
  });
  cache[key] = {
    model,
    as_of: asOf,
    mode,
    cached_at: new Date().toISOString(),
    usage: body.usage ?? null,
    signals,
  };
  saveCache();
  return signals;
}

async function scoreSnapshots(snapshots, asOf, mode) {
  const signals = [];
  const chunkSize = 40;
  for (let index = 0; index < snapshots.length; index += chunkSize) {
    const chunk = snapshots.slice(index, index + chunkSize);
    signals.push(...await scoreChunk(chunk, asOf, mode));
  }
  return signals;
}

function fundamentalsFor(entry) {
  const row = analystBySymbol.get(entry.symbol) ?? {};
  const signalSnapshot = JSON.parse(fs.readFileSync(path.join(DOCS, "signals.json"), "utf8"));
  const prior = new Map(signalSnapshot.fundamentals.map((item) => [item.symbol, item])).get(entry.symbol) ?? {};
  return {
    pe_ttm: prior.pe_ttm ?? null,
    pb: prior.pb ?? null,
    market_cap: prior.market_cap ?? null,
  };
}

function snapshotsAt(series, date) {
  return series.map(({ entry, klines }) => ({
    symbol: entry.symbol,
    name: entry.name,
    theme: entry.theme,
    closes: klines.filter((row) => row.date <= date).map((row) => row.close),
    fundamental: fundamentalsFor(entry),
  }));
}

function tradingDates(series, startDate, endDate) {
  const counts = new Map();
  for (const item of series) {
    for (const row of item.klines) {
      if (row.date >= startDate && row.date <= endDate) {
        counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.ceil(series.length * 0.9);
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([date]) => date)
    .sort();
}

function priceMaps(series) {
  return series.map(({ klines }) => {
    const map = new Map();
    let last = null;
    for (const row of klines) {
      last = row.close;
      map.set(row.date, row.close);
    }
    return { map, fallback: last };
  });
}

function closeOn(item, date) {
  let value = null;
  for (const row of item.klines) {
    if (row.date > date) break;
    value = row.close;
  }
  return value;
}

async function runBacktest(series) {
  const endDate = series.flatMap((item) => item.klines.map((row) => row.date)).sort().at(-1);
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const startDate = start.toISOString().slice(0, 10);
  const config = {
    startCash: 1_000_000,
    rebalanceEveryNDays: 5,
    startDate,
    endDate,
    feeBps: 10,
    maxPositions: 10,
  };
  const dates = tradingDates(series, startDate, endDate);
  if (dates.length < 50) throw new Error(`Not enough trading dates: ${dates.length}`);
  const rebalanceDates = dates.filter((_, index) => index % config.rebalanceEveryNDays === 0);
  const signalsByDate = {};
  for (let i = 0; i < rebalanceDates.length; i++) {
    const date = rebalanceDates[i];
    console.log(`DeepSeek backtest ${i + 1}/${rebalanceDates.length} ${date}`);
    signalsByDate[date] = await scoreSnapshots(snapshotsAt(series, date), date, "backtest");
  }

  let cash = config.startCash;
  const shares = Object.fromEntries(series.map(({ entry }) => [entry.symbol, 0]));
  const equityCurve = [];
  const trades = [];
  const fee = config.feeBps / 10_000;

  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const prices = Object.fromEntries(series.map((item) => [item.entry.symbol, closeOn(item, date)]));
    if (index % config.rebalanceEveryNDays === 0) {
      const signals = signalsByDate[date] ?? [];
      for (const signal of signals) {
        if (signal.action !== "sell" || shares[signal.symbol] <= 0 || !prices[signal.symbol]) continue;
        const held = shares[signal.symbol];
        cash += held * prices[signal.symbol] * (1 - fee);
        trades.push({ date, symbol: signal.symbol, side: "sell", shares: held, price: prices[signal.symbol] });
        shares[signal.symbol] = 0;
      }
      const rankedBuys = signals
        .filter((signal) => signal.action === "buy" && signal.size > 0 && prices[signal.symbol])
        .sort((a, b) => b.confidence * b.size - a.confidence * a.size);
      const heldSymbols = new Set(
        series
          .map((item) => item.entry.symbol)
          .filter((symbol) => shares[symbol] > 0),
      );
      let availableSlots = Math.max(0, config.maxPositions - heldSymbols.size);
      const buys = rankedBuys.filter((signal) => {
        if (heldSymbols.has(signal.symbol)) return true;
        if (availableSlots <= 0) return false;
        availableSlots--;
        return true;
      });
      const totalWeight = buys.reduce((sum, signal) => sum + signal.confidence * signal.size, 0) || 1;
      const budget = cash;
      for (const signal of buys) {
        const allocation = budget * (signal.confidence * signal.size / totalWeight);
        const price = prices[signal.symbol];
        const quantity = Math.floor(allocation / (price * (1 + fee)) / 100) * 100;
        if (quantity <= 0) continue;
        const cost = quantity * price * (1 + fee);
        if (cost > cash) continue;
        cash -= cost;
        shares[signal.symbol] += quantity;
        trades.push({ date, symbol: signal.symbol, side: "buy", shares: quantity, price });
      }
    }
    let equity = cash;
    const positions = {};
    for (const item of series) {
      const symbol = item.entry.symbol;
      if (shares[symbol] <= 0 || !prices[symbol]) continue;
      equity += shares[symbol] * prices[symbol];
      positions[symbol] = { shares: shares[symbol], price: prices[symbol] };
    }
    equityCurve.push({ date, equity, cash, positions });
  }

  const equities = equityCurve.map((row) => row.equity);
  const first = equities[0];
  const last = equities.at(-1);
  const totalReturnPct = (last / first - 1) * 100;
  const years = equityCurve.length / 252;
  const cagrPct = (Math.pow(last / first, 1 / Math.max(years, 1 / 252)) - 1) * 100;
  let peak = first;
  let maxDrawdown = 0;
  for (const equity of equities) {
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
  }
  const returns = equities.slice(1).map((equity, i) => equity / equities[i] - 1);
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(returns.length, 1);
  const std = Math.sqrt(variance);
  return {
    generated_at: now,
    config,
    stats: {
      totalReturnPct,
      cagrPct,
      maxDrawdownPct: maxDrawdown * 100,
      sharpe: std > 0 ? mean / std * Math.sqrt(252) : 0,
      trades: trades.length,
    },
    equityCurve: equityCurve.map(({ date, equity, cash }) => ({ date, equity, cash })),
    trades,
    signalsByDate,
    source: "新浪前复权日线 + DeepSeek JSON缓存",
  };
}

const series = (await mapPool(universe.entries, 8, loadSeries))
  .filter((item) => item.klines.length >= 250);
console.log(`usable series ${series.length}/${universe.entries.length}`);
if (series.length < 60) throw new Error("Too few usable price series");

const latestDate = series.flatMap((item) => item.klines.map((row) => row.date)).sort().at(-1);
console.log(`DeepSeek live signals ${latestDate}`);
const liveSignals = await scoreSnapshots(snapshotsAt(series, latestDate), latestDate, "live");
const priorSignals = JSON.parse(fs.readFileSync(path.join(DOCS, "signals.json"), "utf8"));
const usableSymbols = new Set(series.map((item) => item.entry.symbol));
const signalsSnapshot = {
  generated_at: now,
  fundamentals: priorSignals.fundamentals.filter((row) => usableSymbols.has(row.symbol)),
  signals: liveSignals,
  refresh_status: "DeepSeek signals refreshed from latest Sina daily bars; responses cached in web/.cache/deepseek-refresh.json",
  model: process.env.DEEPSEEK_MODEL,
  market_data_date: latestDate,
};
writeJsonAtomic(path.join(DOCS, "signals.json"), signalsSnapshot);

const backtest = await runBacktest(series);
writeJsonAtomic(path.join(DOCS, "backtest.json"), backtest);

const meta = JSON.parse(fs.readFileSync(path.join(DOCS, "meta.json"), "utf8"));
meta.generated_at = now;
meta.external_data_status = {
  ...(meta.external_data_status ?? {}),
  refresh_status: "现价来自腾讯行情，盈利预测来自同花顺，评级/目标价来自东方财富研报；DeepSeek 信号和一年期回测已刷新并缓存。",
  signals: {
    snapshot_generated_at: now,
    signals: liveSignals.length,
    model: process.env.DEEPSEEK_MODEL,
    market_data_date: latestDate,
    cache_file: "web/.cache/deepseek-refresh.json",
  },
  backtest: {
    snapshot_generated_at: now,
    model: process.env.DEEPSEEK_MODEL_BACKTEST,
    window: `${backtest.config.startDate}..${backtest.config.endDate}`,
    equity_points: backtest.equityCurve.length,
    trades: backtest.trades.length,
    rebalance_every_n_days: backtest.config.rebalanceEveryNDays,
    max_positions: backtest.config.maxPositions,
  },
};
writeJsonAtomic(path.join(DOCS, "meta.json"), meta);

console.log(JSON.stringify({
  generated_at: now,
  series: series.length,
  live_signals: liveSignals.length,
  live_actions: Object.groupBy(liveSignals, (signal) => signal.action),
  backtest: backtest.stats,
  cache_entries: Object.keys(cache).length,
}, null, 2));
