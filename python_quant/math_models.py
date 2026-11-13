"""Mathematical, statistical, VaR/CVaR, correlation, and GARCH(1,1) volatility models."""

import math
from typing import Dict, List, Tuple, Any

from .config import RISK_FREE_ANNUAL_RATE, TRADING_DAYS_PER_YEAR


def compute_rolling_annual_volatility(returns: List[float], window: int = 20) -> float:
    """Compute sample rolling return volatility annualized by sqrt(252) (distinct from GARCH)."""
    tail = returns[-min(len(returns), window):]
    n = len(tail)
    if n < 2:
        return 0.0
    mean = sum(tail) / n
    var = sum((r - mean) ** 2 for r in tail) / (n - 1)
    return math.sqrt(var) * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0


def compute_historical_var_cvar(
    returns: List[float],
    confidence_level: float = 0.95,
    holding_days: int = 1,
) -> Dict[str, float]:
    """Empirical Historical Value at Risk (VaR) and Conditional VaR / Expected Shortfall."""
    if len(returns) < 20:
        return {"var_pct": 0.0, "cvar_pct": 0.0}
    sorted_ret = sorted(returns)
    idx = max(0, int((1.0 - confidence_level) * len(sorted_ret)) - 1)
    scale = math.sqrt(max(1, holding_days))
    daily_var = max(0.0, -sorted_ret[idx])
    tail = sorted_ret[: idx + 1]
    daily_cvar = max(0.0, -sum(tail) / len(tail))
    return {
        "var_pct": round(daily_var * scale * 100.0, 4),
        "cvar_pct": round(daily_cvar * scale * 100.0, 4),
    }


def compute_risk_adjusted_metrics(
    returns: List[float],
    closes: List[float],
) -> Dict[str, float]:
    """Annualized volatility, max drawdown, Sharpe ratio, and Sortino ratio."""
    n = len(returns)
    if n < 2:
        return {
            "annual_return_pct": 0.0,
            "annual_volatility_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
        }
    mean_ret = sum(returns) / n
    var_ret = sum((r - mean_ret) ** 2 for r in returns) / (n - 1)
    std_ret = math.sqrt(var_ret)
    daily_rf = RISK_FREE_ANNUAL_RATE / TRADING_DAYS_PER_YEAR
    excess = mean_ret - daily_rf
    sharpe = (excess / std_ret) * math.sqrt(TRADING_DAYS_PER_YEAR) if std_ret > 1e-9 else 0.0

    downside_sq = sum(min(0.0, r - daily_rf) ** 2 for r in returns) / n
    downside_dev = math.sqrt(downside_sq)
    sortino = (excess / downside_dev) * math.sqrt(TRADING_DAYS_PER_YEAR) if downside_dev > 1e-9 else 0.0

    peak = closes[0]
    max_dd = 0.0
    for c in closes:
        if c > peak:
            peak = c
        dd = ((peak - c) / peak) * 100.0 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd

    return {
        "annual_return_pct": round(mean_ret * TRADING_DAYS_PER_YEAR * 100.0, 3),
        "annual_volatility_pct": round(std_ret * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0, 3),
        "max_drawdown_pct": round(max_dd, 3),
        "sharpe_ratio": round(sharpe, 4),
        "sortino_ratio": round(sortino, 4),
    }


def pearson_correlation(xs: List[float], ys: List[float]) -> float:
    n = min(len(xs), len(ys))
    if n < 5:
        return 0.0
    mx = sum(xs[:n]) / n
    my = sum(ys[:n]) / n
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    dx = sum((xs[i] - mx) ** 2 for i in range(n))
    dy = sum((ys[i] - my) ** 2 for i in range(n))
    denom = math.sqrt(dx * dy)
    return max(-1.0, min(1.0, num / denom)) if denom > 1e-12 else 0.0


def fit_garch11_mle(returns: List[float]) -> Dict[str, Any]:
    """Variance-targeted Gaussian MLE GARCH(1,1) conditional volatility forecast (non-directional)."""
    n = len(returns)
    if n < 60:
        return {"fitted": False, "reason": "Requires at least 60 return observations."}
    mean_r = sum(returns) / n
    eps = [r - mean_r for r in returns]
    sample_var = max(1e-7, sum(e * e for e in eps) / max(1, n - 1))

    best_a, best_b, best_ll = 0.08, 0.85, -1e18

    def loglik(alpha: float, beta: float) -> float:
        if alpha < 0.005 or beta < 0.05 or alpha + beta >= 0.992:
            return -1e18
        omega = sample_var * (1.0 - alpha - beta)
        if omega <= 0:
            return -1e18
        h = sample_var
        ll = 0.0
        for t in range(1, n):
            h = omega + alpha * eps[t - 1] * eps[t - 1] + beta * h
            if h <= 1e-12:
                return -1e18
            ll += -0.5 * (math.log(2.0 * math.pi) + math.log(h) + (eps[t] * eps[t]) / h)
        return ll

    a = 0.02
    while a <= 0.30:
        b = 0.50
        while b <= 0.95:
            if a + b < 0.985:
                ll = loglik(a, b)
                if ll > best_ll:
                    best_ll, best_a, best_b = ll, a, b
            b += 0.03
        a += 0.02

    omega = sample_var * (1.0 - best_a - best_b)
    h = sample_var
    for t in range(1, n):
        h = omega + best_a * eps[t - 1] * eps[t - 1] + best_b * h
    next_var = omega + best_a * eps[-1] * eps[-1] + best_b * h

    return {
        "fitted": True,
        "omega": omega,
        "alpha": round(best_a, 4),
        "beta": round(best_b, 4),
        "persistence": round(best_a + best_b, 4),
        "long_run_annual_vol_pct": round(math.sqrt(sample_var * TRADING_DAYS_PER_YEAR) * 100.0, 2),
        "next_day_annual_vol_pct": round(math.sqrt(next_var * TRADING_DAYS_PER_YEAR) * 100.0, 2),
    }
