"""Explainable BUY / SELL / HOLD trading decision generator."""

from typing import Dict, Any


def technical_signal(row: Dict[str, Any], strategy: str = "rsi_macd") -> str:
    close = float(row["close"])
    sma20 = float(row["sma_20"])
    sma50 = float(row["sma_50"])
    rsi = float(row["rsi_14"])
    macd = float(row["macd"])
    sig = float(row["macd_signal"])

    if strategy == "sma_crossover":
        if close > sma20 and sma20 > sma50:
            return "BUY"
        if close < sma20 and sma20 < sma50:
            return "SELL"
        return "HOLD"

    if macd > sig and ((50.0 <= rsi < 72.0) or rsi < 34.0):
        return "BUY"
    if macd < sig and ((28.0 < rsi <= 48.0) or rsi > 74.0):
        return "SELL"
    return "HOLD"


def generate_explainable_decision(
    row: Dict[str, Any],
    buy_probability: float,
    strategy: str = "combined_ml_tech",
    threshold: float = 0.55,
) -> Dict[str, Any]:
    """Generate deterministic trading decision distinguishing ML vs Technical vs Final."""
    th = min(0.95, max(0.50, float(threshold)))
    ml_sig = "BUY" if buy_probability >= th else ("SELL" if (1.0 - buy_probability) >= th else "HOLD")
    tech_sig = technical_signal(row, "sma_crossover" if strategy == "sma_crossover" else "rsi_macd")

    if strategy == "sma_crossover" or strategy == "rsi_macd":
        final_sig = tech_sig
    elif strategy == "ml_model":
        final_sig = ml_sig
    else:
        # Strict consensus gate: avoids arbitrary blending weights
        final_sig = ml_sig if ml_sig == tech_sig and ml_sig in ("BUY", "SELL") else "HOLD"

    close = float(row["close"])
    atr14 = float(row["atr_14"])
    stop_loss = round(max(0.01, close - 1.5 * atr14), 2)
    return {
        "date": row["date"],
        "symbol": row["symbol"],
        "historical_close": round(close, 2),
        "strategy": strategy,
        "ml_signal": ml_sig,
        "buy_probability": round(buy_probability, 4),
        "technical_signal": tech_sig,
        "final_decision": final_sig,
        "atr_stop_loss": stop_loss,
        "rsi_14": round(float(row["rsi_14"]), 2),
        "sma_20": round(float(row["sma_20"]), 2),
        "sma_50": round(float(row["sma_50"]), 2),
    }
