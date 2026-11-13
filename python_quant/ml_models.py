"""ML classifiers (scikit-learn when installed, pure Python stdlib fallback otherwise)."""

import math
from typing import Any, Dict, List, Tuple

try:
    from sklearn.ensemble import RandomForestClassifier as _SkRandomForest  # type: ignore
    from sklearn.linear_model import LogisticRegression as _SkLogReg  # type: ignore

    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def _sigmoid(z: float) -> float:
    if z > 35.0:
        return 1.0 - 1e-15
    if z < -35.0:
        return 1e-15
    return 1.0 / (1.0 + math.exp(-z))


class _StdlibLogisticRegression:
    """L2-regularized momentum logistic regression in pure Python stdlib."""

    def __init__(self, l2: float = 0.05, lr: float = 0.12, epochs: int = 240):
        self.l2 = l2
        self.lr = lr
        self.epochs = epochs
        self.weights: List[float] = []
        self.bias: float = 0.0

    def fit(self, X: List[List[float]], y: List[int]) -> "_StdlibLogisticRegression":
        n = len(X)
        p = len(X[0]) if n > 0 else 0
        self.weights = [0.0] * p
        self.bias = 0.0
        vw = [0.0] * p
        vb = 0.0
        beta = 0.85
        inv_n = 1.0 / max(1, n)

        for _ in range(self.epochs):
            gw = [0.0] * p
            gb = 0.0
            for i in range(n):
                row = X[i]
                z = self.bias + sum(self.weights[j] * row[j] for j in range(p))
                err = _sigmoid(z) - y[i]
                gb += err
                for j in range(p):
                    gw[j] += err * row[j]
            vb = beta * vb + self.lr * gb * inv_n
            self.bias -= vb
            for j in range(p):
                g = gw[j] * inv_n + self.l2 * self.weights[j] * inv_n
                vw[j] = beta * vw[j] + self.lr * g
                self.weights[j] -= vw[j]
        return self

    def predict_proba_positive(self, X: List[List[float]]) -> List[float]:
        out: List[float] = []
        for row in X:
            z = self.bias + sum(self.weights[j] * row[j] for j in range(len(self.weights)))
            out.append(_sigmoid(z))
        return out


class _StdlibDecisionStumpEnsemble:
    """Deterministic boosted decision stumps for constrained stdlib environments."""

    def __init__(self, num_stumps: int = 18):
        self.num_stumps = num_stumps
        self.base_log_odds: float = 0.0
        self.stumps: List[Dict[str, Any]] = []
        self.feature_importances: List[float] = []

    def fit(self, X: List[List[float]], y: List[int]) -> "_StdlibDecisionStumpEnsemble":
        n = len(X)
        p = len(X[0]) if n > 0 else 0
        pos_rate = min(0.95, max(0.05, sum(y) / max(1, n)))
        self.base_log_odds = math.log(pos_rate / (1.0 - pos_rate))
        preds = [self.base_log_odds] * n
        self.stumps = []
        self.feature_importances = [0.0] * p
        lr = 0.12

        for _ in range(self.num_stumps):
            residuals = [y[i] - _sigmoid(preds[i]) for i in range(n)]
            total_mean = sum(residuals) / n
            total_sse = sum((r - total_mean) ** 2 for r in residuals)
            best_gain, best_f, best_th, best_l, best_r = 0.0, 0, 0.0, 0.0, 0.0

            for f in range(p):
                vals = sorted(row[f] for row in X)
                for s in range(1, 9):
                    th = vals[int((s * n) / 9)]
                    l_vals = [residuals[i] for i in range(n) if X[i][f] <= th]
                    r_vals = [residuals[i] for i in range(n) if X[i][f] > th]
                    if len(l_vals) < 8 or len(r_vals) < 8:
                        continue
                    lm = sum(l_vals) / len(l_vals)
                    rm = sum(r_vals) / len(r_vals)
                    sse = sum((v - lm) ** 2 for v in l_vals) + sum((v - rm) ** 2 for v in r_vals)
                    gain = total_sse - sse
                    if gain > best_gain:
                        best_gain, best_f, best_th, best_l, best_r = gain, f, th, lm, rm

            if best_gain <= 1e-6:
                break
            self.feature_importances[best_f] += best_gain
            self.stumps.append({"f": best_f, "th": best_th, "l": best_l, "r": best_r})
            for i in range(n):
                delta = best_l if X[i][best_f] <= best_th else best_r
                preds[i] += lr * delta
        return self

    def predict_proba_positive(self, X: List[List[float]]) -> List[float]:
        out: List[float] = []
        for row in X:
            lo = self.base_log_odds
            for st in self.stumps:
                lo += 0.12 * (st["l"] if row[st["f"]] <= st["th"] else st["r"])
            out.append(_sigmoid(lo))
        return out


def train_model(
    X_train: List[List[float]],
    y_train: List[int],
    model_type: str = "logistic_regression",
) -> Tuple[Any, Dict[str, Any]]:
    """Train requested model using scikit-learn if available, else verified Python stdlib."""
    if HAS_SKLEARN:
        if model_type == "random_forest":
            clf = _SkRandomForest(n_estimators=50, max_depth=5, random_state=42)
            clf.fit(X_train, y_train)
            return clf, {
                "engine": "scikit-learn",
                "model_label": "RandomForestClassifier (scikit-learn)",
                "importances": [float(v) for v in clf.feature_importances_],
            }
        clf = _SkLogReg(C=1.0, max_iter=500, random_state=42)
        clf.fit(X_train, y_train)
        return clf, {
            "engine": "scikit-learn",
            "model_label": "LogisticRegression (scikit-learn)",
            "importances": [abs(float(v)) for v in clf.coef_[0]],
        }

    if model_type == "random_forest":
        clf = _StdlibDecisionStumpEnsemble(num_stumps=18).fit(X_train, y_train)
        return clf, {
            "engine": "python_stdlib",
            "model_label": "Decision Stump Ensemble (Python stdlib fallback; install scikit-learn for RandomForest)",
            "importances": clf.feature_importances,
        }

    clf = _StdlibLogisticRegression().fit(X_train, y_train)
    return clf, {
        "engine": "python_stdlib",
        "model_label": "Logistic Regression L2 GD (Python stdlib)",
        "importances": [abs(w) for w in clf.weights],
    }


def predict_positive_probs(model: Any, X: List[List[float]]) -> List[float]:
    if HAS_SKLEARN and hasattr(model, "predict_proba"):
        return [float(row[1]) for row in model.predict_proba(X)]
    return model.predict_proba_positive(X)
