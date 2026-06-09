"""Refresh the public GitHub Pages analyst snapshot without Tushare."""

from __future__ import annotations

import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import akshare as ak
import requests


ROOT = Path(__file__).resolve().parents[1]
UNIVERSE_FILE = ROOT / "web" / "data" / "universe.json"
DOCS_DATA = ROOT / "docs" / "data"
ANALYST_FILE = DOCS_DATA / "analyst.json"
META_FILE = DOCS_DATA / "meta.json"
REPORT_URL = "https://reportapi.eastmoney.com/report/list"
BULLISH_RATINGS = {"买入", "推荐", "强烈推荐", "增持"}
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://data.eastmoney.com/",
}


def clear_dead_proxy() -> None:
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "GIT_HTTP_PROXY", "GIT_HTTPS_PROXY"):
        value = os.environ.get(key, "")
        if "127.0.0.1:9" in value:
            os.environ.pop(key, None)


def atomic_json(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result == result else None


def retry(call, attempts: int = 3):
    error: Exception | None = None
    for attempt in range(attempts):
        try:
            return call()
        except Exception as exc:
            error = exc
            if attempt + 1 < attempts:
                time.sleep(0.8 * (attempt + 1))
    assert error is not None
    raise error


def market_prefix(symbol: str) -> str:
    return "sh" if symbol.startswith("6") else "sz"


def fetch_quote(symbol: str) -> tuple[float | None, str | None]:
    response = requests.get(
        f"https://qt.gtimg.cn/q={market_prefix(symbol)}{symbol}",
        headers={"User-Agent": HEADERS["User-Agent"], "Referer": "https://gu.qq.com/"},
        timeout=15,
    )
    response.raise_for_status()
    text = response.content.decode("gbk", errors="ignore")
    payload = text.split('"', 2)[1].split("~")
    price = number(payload[3]) if len(payload) > 3 else None
    stamp = payload[30] if len(payload) > 30 else ""
    market_date = f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}" if len(stamp) >= 8 else None
    return price, market_date


def fetch_forecast(symbol: str) -> tuple[float | None, int | None]:
    frame = ak.stock_profit_forecast_ths(symbol=symbol, indicator="预测年报每股收益")
    if frame is None or frame.empty:
        return None, None
    current_year = date.today().year
    work = frame.copy()
    work["年度"] = work["年度"].apply(number)
    work["均值"] = work["均值"].apply(number)
    work = work[work["年度"].fillna(0).astype(int) >= current_year].sort_values("年度")
    if work.empty:
        return None, None
    row = work.iloc[0]
    count = number(row.get("预测机构数"))
    return number(row.get("均值")), int(count) if count is not None else None


def fetch_research(symbol: str) -> dict[str, Any]:
    end = date.today()
    start = end - timedelta(days=180)
    params = {
        "industryCode": "*",
        "pageSize": "5000",
        "industry": "*",
        "rating": "*",
        "ratingChange": "*",
        "beginTime": start.isoformat(),
        "endTime": end.isoformat(),
        "pageNo": "1",
        "fields": "",
        "qType": "0",
        "orgCode": "",
        "code": symbol,
        "rcode": "",
        "p": "1",
        "pageNum": "1",
        "pageNumber": "1",
    }
    response = requests.get(REPORT_URL, params=params, headers=HEADERS, timeout=20)
    response.raise_for_status()
    rows = response.json().get("data") or []
    ratings = [str(row.get("emRatingName") or "") for row in rows]
    rated = [rating for rating in ratings if rating]
    targets: list[float] = []
    for row in rows:
        eps = number(row.get("predictThisYearEps"))
        pe = number(row.get("predictThisYearPe"))
        if eps is not None and eps > 0 and pe is not None and pe > 0:
            targets.append(eps * pe)
    return {
        "buy_count": sum(rating in BULLISH_RATINGS for rating in rated) if rated else None,
        "total_count": len(rated) if rated else None,
        "buy_ratio": round(sum(rating in BULLISH_RATINGS for rating in rated) / len(rated), 3)
        if rated
        else None,
        "implied_target": round(statistics.median(targets), 3) if targets else None,
    }


def refresh_one(entry: dict[str, Any], previous: dict[str, Any], now: str) -> dict[str, Any]:
    symbol = entry["symbol"]
    result = dict(previous)
    result["symbol"] = symbol
    errors: list[str] = []

    try:
        price, market_date = retry(lambda: fetch_quote(symbol))
        if price is not None:
            result["current_price"] = round(price, 3)
            result["quote_market_date"] = market_date
            result["quote_updated_at"] = now
    except Exception as exc:
        errors.append(f"quote: {exc}")

    try:
        eps, institution_count = retry(lambda: fetch_forecast(symbol))
        if eps is not None:
            result["consensus_eps_next"] = round(eps, 4)
        if institution_count is not None:
            result["forecast_institution_count"] = institution_count
        result["forecast_updated_at"] = now
    except Exception as exc:
        errors.append(f"forecast: {exc}")

    try:
        research = retry(lambda: fetch_research(symbol))
        for key, value in research.items():
            if value is not None:
                result[key] = value
        result["research_updated_at"] = now
    except Exception as exc:
        errors.append(f"research: {exc}")

    price = number(result.get("current_price"))
    target = number(result.get("implied_target"))
    result["upside_pct"] = (
        round((target / price - 1) * 100, 2)
        if price is not None and price > 0 and target is not None and target > 0
        else None
    )
    result["source"] = "腾讯行情 + 同花顺盈利预测 + 东方财富近180日研报"
    if errors:
        result["refresh_warning"] = "; ".join(errors)
    else:
        result.pop("refresh_warning", None)
    return result


def main() -> None:
    clear_dead_proxy()
    universe = json.loads(UNIVERSE_FILE.read_text(encoding="utf-8"))
    old_snapshot = json.loads(ANALYST_FILE.read_text(encoding="utf-8"))
    previous = {item["symbol"]: item for item in old_snapshot.get("items", [])}
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    entries = universe["entries"]
    items: list[dict[str, Any] | None] = [None] * len(entries)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(refresh_one, entry, previous.get(entry["symbol"], {}), now): index
            for index, entry in enumerate(entries)
        }
        for done, future in enumerate(as_completed(futures), start=1):
            index = futures[future]
            symbol = entries[index]["symbol"]
            try:
                items[index] = future.result()
                print(f"{done}/{len(entries)} {symbol} ok", flush=True)
            except Exception as exc:
                fallback = dict(previous.get(symbol, {"symbol": symbol}))
                fallback["refresh_warning"] = str(exc)
                items[index] = fallback
                print(f"{done}/{len(entries)} {symbol} failed: {exc}", flush=True)
            time.sleep(0.05)

    final_items = [item for item in items if item is not None]
    atomic_json(ANALYST_FILE, {"generated_at": now, "items": final_items})
    atomic_json(DOCS_DATA / "universe.json", universe)

    meta = json.loads(META_FILE.read_text(encoding="utf-8"))
    meta["generated_at"] = now
    external = meta.setdefault("external_data_status", {})
    external["analyst"] = {
        "snapshot_generated_at": now,
        "items": len(final_items),
        "quote_items": sum(item.get("current_price") is not None for item in final_items),
        "target_items": sum(item.get("implied_target") is not None for item in final_items),
        "rating_items": sum(item.get("total_count") is not None for item in final_items),
        "source": "腾讯行情；同花顺盈利预测；东方财富近180日研报",
    }
    atomic_json(META_FILE, meta)


if __name__ == "__main__":
    main()
