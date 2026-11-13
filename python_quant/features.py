"""Independent per-stock technical indicator engineering and audit."""

import math
from typing import Dict, List, Any


def compute_sma(values: List[float], window: int) -> List[float | None]:
    out: List[float | None] = [None] * len(values)
    running = 0.0
    for i, val in enumerate(values):
        running += val
        if i >= window:
            running -= values[i - window]
        if i >= window - 1:
            out[i] = running / window
    return out


def compute_ema(values: List[float], span: int) -> List[float]:
    if not values:
        return []
    k = 2.0 / (span + 1.0)
    out = [values[0]]
    for val in values[1:]:
        out.append(val * k + out[-1] * (1.0 - k))
    return out


def compute_wilder_rsi(closes: List[float], period: int = 14) -> List[float | None]:
    out: List[float | None] = [None] * len(closes)
    if len(closes) <= period:
        return out
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        delta = closes[i] - closes[i - 1]
        if delta > 0:
            gains += delta
        else:
            losses -= delta
    avg_gain = gains / period
    avg_loss = losses / period
    out[period] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    for i in range(period + 1, len(closes)):
        delta = closes[i] - closes[i - 1]
        g = delta if delta > 0 else 0.0
        l = -delta if delta < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + g) / period
        avg_loss = (avg_loss * (period - 1) + l) / period
        out[i] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    return out


def compute_atr(rows: List[Dict[str, Any]], period: int = 14) -> List[float | None]:
    if len(rows) < period + 1:
        return [None] * len(rows)
    trs: List[float] = [float(rows[0]["high"]) - float(rows[0]["low"])]
    for i in range(1, len(rows)):
        h = float(rows[i]["high"])
        l = float(rows[i]["low"])
        pc = float(rows[i - 1]["close"])
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    return compute_sma(trs, period)


def verify_latest_indicators(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Recompute key technical indicators on sorted rows and compare with dataset values."""
    closes = [float(r["close"]) for r in rows]
    sma20 = compute_sma(closes, 20)[-1]
    ema12 = compute_ema(closes, 12)[-1]
    rsi14 = compute_wilder_rsi(closes, 14)[-1]
    atr14 = compute_atr(rows, 14)[-1]
    latest = rows[-1]
    return {
        "latest_date": latest["date"],
        "csv_sma20": round(float(latest["sma_20"]), 4),
        "recomputed_sma20": round(sma20, 4) if sma20 is not None else None,
        "csv_ema12": round(float(latest["ema_12"]), 4),
        "recomputed_ema12": round(ema12, 4),
        "csv_rsi14": round(float(latest["rsi_14"]), 4),
        "recomputed_rsi14": round(rsi14, 4) if rsi14 is not None else None,
        "csv_atr14": round(float(latest["atr_14"]), 4),
        "recomputed_atr14": round(atr14, 4) if atr14 is not None else None,
        "bollinger_width_pct": round(
            ((float(latest["bb_upper"]) - float(latest["bb_lower"])) / max(1e-6, float(latest["sma_20"]))) * 100,
            4,
        ),
        "std_close_20": round(
            math.sqrt(
                sum((c - (sum(closes[-20:]) / 20.0)) ** 2 for c in closes[-20:]) / 20.0
            )
            if len(closes) >= 20
            else 0.0,
            4,
        ),
    }
