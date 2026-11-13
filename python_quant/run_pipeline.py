"""End-to-end CLI entrypoint for BULLSEYE AI Python quantitative pipeline."""

import argparse
import json
from typing import Any, Dict

from .backtester import run_backtest
from .config import ARTIFACTS_DIR, EXCLUDED_LEAKAGE_COLUMNS, ML_FEATURE_COLUMNS
from .data_loader import audit_raw_combined_dataset, load_feature_rows_for_symbol
from .dl_lstm import check_dl_availability
from .evaluation import compute_classification_metrics, walk_forward_validate
from .features import verify_latest_indicators
from .math_models import (
    compute_historical_var_cvar,
    compute_risk_adjusted_metrics,
    compute_rolling_annual_volatility,
    fit_garch11_mle,
)
from .ml_models import predict_positive_probs, train_model
from .preprocessing import (
    apply_zscore_scaler,
    build_feature_matrix,
    chronological_split,
    fit_zscore_scaler,
)
from .signals import generate_explainable_decision


def execute_pipeline(
    symbol: str = "RELIANCE",
    model_type: str = "logistic_regression",
    split_ratio: float = 0.8,
    save_artifact: bool = False,
) -> Dict[str, Any]:
    rows, feat_audit = load_feature_rows_for_symbol(symbol)
    raw_audit = audit_raw_combined_dataset()
    train_rows, test_rows = chronological_split(rows, train_ratio=split_ratio)

    X_train_raw, y_train = build_feature_matrix(train_rows, ML_FEATURE_COLUMNS)
    X_test_raw, y_test = build_feature_matrix(test_rows, ML_FEATURE_COLUMNS)
    means, stds = fit_zscore_scaler(X_train_raw)
    X_train = apply_zscore_scaler(X_train_raw, means, stds)
    X_test = apply_zscore_scaler(X_test_raw, means, stds)

    clf, model_meta = train_model(X_train, y_train, model_type=model_type)
    test_probs = predict_positive_probs(clf, X_test)
    evaluation = compute_classification_metrics(y_test, test_probs, threshold=0.5)

    wf = walk_forward_validate(rows, model_type=model_type, initial_train_pct=0.55, num_windows=4)
    returns = [float(r["daily_return"]) for r in rows]
    closes = [float(r["close"]) for r in rows]

    latest_prob = test_probs[-1] if test_probs else 0.5
    decision = generate_explainable_decision(rows[-1], latest_prob, strategy="combined_ml_tech", threshold=0.55)
    bt = run_backtest(test_rows, test_probs, strategy="ml_model", buy_threshold=0.55)
    dl_ok, dl_msg = check_dl_availability()

    feat_imp = sorted(
        [
            {"feature": col, "importance": round(float(val), 6)}
            for col, val in zip(ML_FEATURE_COLUMNS, model_meta["importances"])
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    result: Dict[str, Any] = {
        "symbol": symbol.upper(),
        "raw_audit": raw_audit,
        "feature_audit": feat_audit,
        "excluded_leakage_columns": EXCLUDED_LEAKAGE_COLUMNS,
        "train_range": {"start": train_rows[0]["date"], "end": train_rows[-1]["date"], "rows": len(train_rows)},
        "test_range": {"start": test_rows[0]["date"], "end": test_rows[-1]["date"], "rows": len(test_rows)},
        "model": {"type": model_type, "engine": model_meta["engine"], "label": model_meta["model_label"]},
        "deep_learning_status": {"available": dl_ok, "message": dl_msg},
        "evaluation": evaluation,
        "top_features": feat_imp[:6],
        "walk_forward": wf,
        "indicator_verification": verify_latest_indicators(rows),
        "risk_summary": {
            "rolling_vol_20d_ann_pct": round(compute_rolling_annual_volatility(returns, 20), 2),
            "var_cvar_95_1d": compute_historical_var_cvar(returns, 0.95, 1),
            **compute_risk_adjusted_metrics(returns, closes),
            "garch11": fit_garch11_mle(returns),
        },
        "latest_signal": decision,
        "out_of_sample_backtest": bt,
    }

    if save_artifact:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        out_path = ARTIFACTS_DIR / f"{symbol.upper()}_{model_type}_report.json"
        out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        result["saved_artifact"] = str(out_path)

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="BULLSEYE AI Modular Python Quant Pipeline")
    parser.add_argument("--symbol", default="RELIANCE", help="NIFTY 50 stock symbol")
    parser.add_argument(
        "--model",
        default="logistic_regression",
        choices=["logistic_regression", "random_forest"],
        help="ML classifier type",
    )
    parser.add_argument("--split", type=float, default=0.8, help="Chronological train split fraction")
    parser.add_argument("--save", action="store_true", help="Write JSON output to python_quant/artifacts/")
    parser.add_argument("--json", action="store_true", help="Print compact JSON output")
    args = parser.parse_args()

    res = execute_pipeline(
        symbol=args.symbol,
        model_type=args.model,
        split_ratio=args.split,
        save_artifact=args.save,
    )
    if args.json:
        print(json.dumps(res))
    else:
        print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
