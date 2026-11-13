"""Chronological train/test partitioning and zero-leakage standardization."""

import math
from typing import Dict, List, Sequence, Tuple, Any

from .config import EXCLUDED_LEAKAGE_COLUMNS, ML_FEATURE_COLUMNS, TARGET_COLUMN


def validate_no_leakage(feature_columns: Sequence[str] = ML_FEATURE_COLUMNS) -> bool:
    """Assert target leakage columns are strictly absent from feature inputs."""
    for leak in EXCLUDED_LEAKAGE_COLUMNS:
        if leak in feature_columns:
            raise ValueError(f"Leakage violation detected: {leak} present in model features.")
    return True


def build_feature_matrix(
    rows: List[Dict[str, Any]],
    feature_columns: Sequence[str] = ML_FEATURE_COLUMNS,
) -> Tuple[List[List[float]], List[int]]:
    """Convert feature dicts to X (13 technical inputs) and binary target y."""
    validate_no_leakage(feature_columns)
    X: List[List[float]] = []
    y: List[int] = []
    for r in rows:
        X.append([float(r[col]) for col in feature_columns])
        y.append(1 if float(r[TARGET_COLUMN]) >= 0.5 else 0)
    return X, y


def chronological_split(
    rows: List[Dict[str, Any]],
    train_ratio: float = 0.8,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Chronologically partition rows without shuffling time-series order."""
    if len(rows) < 60:
        raise ValueError(f"Need at least 60 rows for chronological split (got {len(rows)}).")
    ratio = min(0.9, max(0.5, float(train_ratio)))
    split_idx = int(len(rows) * ratio)
    train_rows = rows[:split_idx]
    test_rows = rows[split_idx:]
    if train_rows[-1]["date"] >= test_rows[0]["date"]:
        raise ValueError("Chronological boundary invariant violated.")
    return train_rows, test_rows


def fit_zscore_scaler(X_train: List[List[float]]) -> Tuple[List[float], List[float]]:
    """Compute column-wise mean and population std strictly from X_train."""
    n = len(X_train)
    p = len(X_train[0]) if n > 0 else 0
    means = [0.0] * p
    stds = [1.0] * p
    if n == 0 or p == 0:
        return means, stds

    for row in X_train:
        for j in range(p):
            means[j] += row[j]
    for j in range(p):
        means[j] /= n

    vars_ = [0.0] * p
    for row in X_train:
        for j in range(p):
            diff = row[j] - means[j]
            vars_[j] += diff * diff
    for j in range(p):
        sd = math.sqrt(vars_[j] / max(1, n))
        stds[j] = sd if sd > 1e-9 else 1.0
    return means, stds


def apply_zscore_scaler(
    X: List[List[float]],
    means: List[float],
    stds: List[float],
) -> List[List[float]]:
    """Standardize feature matrix using training-only (mean, std) statistics."""
    return [[(row[j] - means[j]) / stds[j] for j in range(len(means))] for row in X]
