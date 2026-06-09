# docs/ — static GitHub Pages site

Static snapshot of the Next.js webapp's latest results, suitable for serving
from the `/docs` folder on GitHub Pages.

## Contents

- `index.html`, `styles.css`, `app.js` — hand-written single-page UI. No build
  step, no framework.
- `data/*.json` — public research snapshots:
  - `universe.json` — copy of `web/data/universe.json`
  - `analyst.json` — Tencent quotes, THS forecasts, and Eastmoney research
    aggregates per symbol (price, target, upside, buy ratings)
  - `signals.json` — DeepSeek per-symbol action/confidence/size + fundamentals
  - `backtest.json` — 1-year backtest equity curve, trades, stats
  - `meta.json` — timestamp

## Refresh

```bash
# Public-data refresh (no Tushare token required)
cd pyserver && uv run python refresh_public_data.py
cd ../web && node scripts/refresh-deepseek.mjs
```

Skip the slow pieces while iterating on UI:

```bash
SNAPSHOT_SKIP_SIGNALS=1 SNAPSHOT_SKIP_BACKTEST=1 npx tsx scripts/snapshot.ts
```

Override the backtest window:

```bash
SNAPSHOT_BACKTEST_START=2024-01-01 SNAPSHOT_BACKTEST_END=2025-12-31 \
  npx tsx scripts/snapshot.ts
```

## Preview locally

```bash
python3 -m http.server 8765 --directory docs
open http://localhost:8765/
```

## Publish

In **Settings → Pages**, set source to **Deploy from a branch**, branch `main`,
folder `/docs`. The next push to `main` publishes the site.
