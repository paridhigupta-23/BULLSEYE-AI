"""Out-of-sample classification metrics and chronological walk-forward validation."""

from typing import Dict, List, Any

from .ml_models import predict_positive_probs, train_model
from .preprocessing import (
    apply_zscore_scaler,
    build_feature_matrix,
    fit_zscore_scaler,
)


def compute_classification_metrics(
    y_true: List[int],
    probs: List[float],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    tn = fp = fn = tp = 0
    for yt, pr in zip(y_true, probs):
        pred = 1 if pr >= threshold else 0
        if yt == 1 and pred == 1:
            tp += 1
        elif yt == 0 and pred == 1:
            fp += 1
        elif yt == 1 and pred == 0:
            fn += 1
        else:
            tn += 1

    total = max(1, len(y_true))
    acc = (tp + tn) / total
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2.0 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
    return {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "support_positive": tp + fn,
        "support_negative": tn + fp,
    }


def walk_forward_validate(
    rows: List[Dict[str, Any]],
    model_type: str = "logistic_regression",
    initial_train_pct: float = 0.55,
    num_windows: int = 4,
) -> List[Dict[str, Any]]:
    """Expanding-window chronological walk-forward cross-validation without leakage."""
    n = len(rows)
    if n < 160:
        return []
    init_end = int(n * initial_train_pct)
    fold_size = max(20, (n - init_end) // max(1, num_windows))
    results: List[Dict[str, Any]] = []

    for w in range(num_windows):
        test_start = init_end + w * fold_size
        test_end = n if w == num_windows - 1 else min(n, test_start + fold_size)
        if test_end - test_start < 15:
            break
        train_slice = rows[:test_start]
        test_slice = rows[test_start:test_end]
        X_tr_raw, y_tr = build_feature_matrix(train_slice)
        X_te_raw, y_te = build_feature_matrix(test_slice)

        # Standardize strictly using train fold only
        means, stds = fit_zscore_scaler(X_tr_raw)
        X_tr = apply_zscore_scaler(X_tr_raw, means, stds)
        X_te = apply_zscore_scaler(X_te_raw, means, stds)

        clf, _ = train_model(X_tr, y_tr, model_type=model_type)
        probs = predict_positive_probs(clf, X_te)
        metrics = compute_classification_metrics(y_te, probs, 0.5)
        results.append(
            {
                "window": w + 1,
                "train_range": f"{train_slice[0]['date']} -> {train_slice[-1]['date']}",
                "test_range": f"{test_slice[0]['date']} -> {test_slice[-1]['date']}",
                "train_size": len(train_slice),
                "test_size": len(test_slice),
                **metrics,
            }
        )
    return results
