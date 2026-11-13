"""Chronological next-session open execution backtester with brokerage & slippage."""

import math
from typing import Dict, List, Any

from .config import (
    DEFAULT_BROKERAGE_PCT,
    DEFAULT_SLIPPAGE_PCT,
    RISK_FREE_ANNUAL_RATE,
    TRADING_DAYS_PER_YEAR,
)


def run_backtest(
    rows: List[Dict[str, Any]],
    buy_probs: List[float],
    strategy: str = "combined_ml_tech",
    initial_capital: float = 1_000_000.0,
    brokerage_pct: float = DEFAULT_BROKERAGE_PCT,
    slippage_pct: float = DEFAULT_SLIPPAGE_PCT,
    buy_threshold: float = 0.55,
) -> Dict[str, Any]:
    """Execute signals generated at close t-1 strictly on bar t open (no look-ahead)."""
    if len(rows) < 30 or len(rows) != len(buy_probs):
        raise ValueError("Backtest requires at least 30 rows with matching probabilities.")

    cost_rate = (brokerage_pct + slippage_pct) / 100.0
    cash = float(initial_capital)
    shares = 0
    entry_price = 0.0
    entry_cost = 0.0
    total_costs = 0.0
    trades: List[Dict[str, Any]] = []

    peak = initial_capital
    max_dd = 0.0
    prev_eq = initial_capital
    daily_rets: List[float] = []
    bm_shares = initial_capital / float(rows[0]["close"])

    for t in range(len(rows)):
        bar = rows[t]
        if t > 0:
            prev = rows[t - 1]
            prob = buy_probs[t - 1]
            if strategy == "sma_crossover":
                desire_long = float(prev["sma_20"]) > float(prev["sma_50"])
            elif strategy == "ml_model":
                desire_long = prob >= buy_threshold
            elif strategy == "combined_ml_tech":
                desire_long = (
                    prob >= buy_threshold
                    and float(prev["sma_20"]) > float(prev["sma_50"])
                    and float(prev["macd"]) > float(prev["macd_signal"])
                    and float(prev["rsi_14"]) < 72.0
                )
            else:
                desire_long = float(prev["rsi_14"]) < 42.0 or (
                    float(prev["rsi_14"]) < 65.0 and float(prev["macd"]) > float(prev["macd_signal"])
                )

            exec_px = float(bar["open"]) if float(bar["open"]) > 0 else float(bar["close"])
            if desire_long and shares == 0:
                affordable = int(cash // (exec_px * (1.0 + cost_rate)))
                if affordable > 0:
                    val = affordable * exec_px
                    tx_cost = val * cost_rate
                    cash -= val + tx_cost
                    shares = affordable
                    entry_price = exec_px
                    entry_cost = tx_cost
                    total_costs += tx_cost
            elif not desire_long and shares > 0:
                val = shares * exec_px
                tx_cost = val * cost_rate
                cash += val - tx_cost
                total_costs += tx_cost
                net_pnl = (exec_px - entry_price) * shares - (entry_cost + tx_cost)
                trades.append({"net_pnl": net_pnl})
                shares = 0

        eq = cash + shares * float(bar["close"])
        if eq > peak:
            peak = eq
        dd = ((peak - eq) / peak) * 100.0 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
        if t > 0 and prev_eq > 0:
            daily_rets.append((eq - prev_eq) / prev_eq)
        prev_eq = eq

    last_close = float(rows[-1]["close"])
    if shares > 0:
        val = shares * last_close
        tx_cost = val * cost_rate
        cash += val - tx_cost
        total_costs += tx_cost
        net_pnl = (last_close - entry_price) * shares - (entry_cost + tx_cost)
        trades.append({"net_pnl": net_pnl})

    final_eq = cash
    net_profit = final_eq - initial_capital
    tot_ret = (net_profit / initial_capital) * 100.0
    bm_ret = ((bm_shares * last_close - initial_capital) / initial_capital) * 100.0
    wins = sum(1 for tr in trades if tr["net_pnl"] > 0)
    win_rate = (wins / len(trades)) * 100.0 if trades else 0.0

    daily_rf = RISK_FREE_ANNUAL_RATE / TRADING_DAYS_PER_YEAR
    mean_ex = sum(r - daily_rf for r in daily_rets) / max(1, len(daily_rets))
    std_ex = math.sqrt(
        sum((r - daily_rf - mean_ex) ** 2 for r in daily_rets) / max(1, len(daily_rets) - 1)
    )
    sharpe = (mean_ex / std_ex) * math.sqrt(TRADING_DAYS_PER_YEAR) if std_ex > 1e-9 else 0.0

    return {
        "start_date": rows[0]["date"],
        "end_date": rows[-1]["date"],
        "trading_days": len(rows),
        "strategy": strategy,
        "initial_capital": round(initial_capital, 2),
        "final_equity": round(final_eq, 2),
        "net_profit": round(net_profit, 2),
        "total_return_pct": round(tot_ret, 2),
        "benchmark_return_pct": round(bm_ret, 2),
        "number_of_trades": len(trades),
        "win_rate_pct": round(win_rate, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 3),
        "total_transaction_costs": round(total_costs, 2),
    }
