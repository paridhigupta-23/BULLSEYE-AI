"""Unit tests for python_quant quantitative pipeline (zero-leakage, math, signals, backtest)."""

import unittest

from python_quant.backtester import run_backtest
from python_quant.config import EXCLUDED_LEAKAGE_COLUMNS, ML_FEATURE_COLUMNS
from python_quant.data_loader import load_feature_rows_for_symbol
from python_quant.math_models import compute_historical_var_cvar, fit_garch11_mle
from python_quant.preprocessing import build_feature_matrix, chronological_split, validate_no_leakage
from python_quant.run_pipeline import execute_pipeline
from python_quant.signals import generate_explainable_decision


class TestPythonQuantPipeline(unittest.TestCase):
    def test_no_leakage_columns_in_features(self) -> None:
        self.assertTrue(validate_no_leakage(ML_FEATURE_COLUMNS))
        for leak in EXCLUDED_LEAKAGE_COLUMNS:
            self.assertNotIn(leak, ML_FEATURE_COLUMNS)
        with self.assertRaises(ValueError):
            validate_no_leakage([*ML_FEATURE_COLUMNS, "target_direction"])

    def test_chronological_split_and_feature_matrix(self) -> None:
        rows, audit = load_feature_rows_for_symbol("RELIANCE")
        self.assertGreater(len(rows), 500)
        self.assertEqual(audit["symbol"], "RELIANCE")
        tr, te = chronological_split(rows, 0.8)
        self.assertLess(tr[-1]["date"], te[0]["date"])
        X, y = build_feature_matrix(tr)
        self.assertEqual(len(X), len(tr))
        self.assertEqual(len(X[0]), 13)
        self.assertEqual(len(y), len(tr))

    def test_var_garch_signals_and_backtest(self) -> None:
        rows, _ = load_feature_rows_for_symbol("TCS")
        rets = [float(r["daily_return"]) for r in rows]
        var_res = compute_historical_var_cvar(rets, 0.95, 1)
        self.assertGreaterEqual(var_res["cvar_pct"], var_res["var_pct"])
        garch = fit_garch11_mle(rets)
        self.assertTrue(garch["fitted"])
        self.assertLess(garch["persistence"], 1.0)

        dec = generate_explainable_decision(rows[-1], 0.82, "ml_model", 0.75)
        self.assertEqual(dec["final_decision"], "BUY")

        bt = run_backtest(rows[-120:], [0.6] * 120, strategy="sma_crossover")
        self.assertEqual(bt["trading_days"], 120)
        self.assertGreater(bt["final_equity"], 0)

    def test_end_to_end_pipeline(self) -> None:
        report = execute_pipeline("RELIANCE", "logistic_regression", 0.8, save_artifact=False)
        self.assertEqual(report["symbol"], "RELIANCE")
        self.assertIn("accuracy", report["evaluation"])
        self.assertEqual(len(report["walk_forward"]), 4)


if __name__ == "__main__":
    unittest.main()
