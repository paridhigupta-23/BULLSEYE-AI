"""Dataset loading and integrity validation for historical NIFTY 50 CSVs."""

import csv
from pathlib import Path
from typing import Dict, List, Tuple, Any

from .config import COMBINED_CSV, FEATURES_CSV, ML_FEATURE_COLUMNS


def _norm_date(raw: str) -> str:
    txt = (raw or "").strip()
    if len(txt) >= 10 and txt[4] == "-" and txt[7] == "-":
        return txt[:10]
    return txt


def load_feature_rows_for_symbol(
    symbol: str,
    features_path: Path = FEATURES_CSV,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Load and validate chronologically sorted feature rows for one NSE ticker."""
    sym = symbol.strip().upper()
    if not features_path.exists():
        raise FileNotFoundError(f"Features dataset not found: {features_path}")

    rows: List[Dict[str, Any]] = []
    seen_dates = set()
    duplicates = 0
    missing_numeric = 0
    total_dataset_rows = 0
    unique_stocks = set()

    with features_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            total_dataset_rows += 1
            row_sym = (raw.get("symbol") or "").strip().upper()
            if row_sym:
                unique_stocks.add(row_sym)
            if row_sym != sym:
                continue

            date_iso = _norm_date(raw.get("timestamp") or raw.get("date") or "")
            if not date_iso or date_iso in seen_dates:
                duplicates += 1
                continue
            seen_dates.add(date_iso)

            parsed: Dict[str, Any] = {"date": date_iso, "symbol": sym}
            valid = True
            numeric_fields = [
                "open",
                "high",
                "low",
                "close",
                "volume",
                "oi",
                *ML_FEATURE_COLUMNS,
                "next_day_return",
                "target_direction",
            ]
            for col in numeric_fields:
                try:
                    val = float(raw[col])
                except (KeyError, TypeError, ValueError):
                    missing_numeric += 1
                    valid = False
                    break
                parsed[col] = val

            if valid and parsed["close"] > 0 and parsed["high"] >= parsed["low"]:
                rows.append(parsed)

    rows.sort(key=lambda r: r["date"])
    audit = {
        "symbol": sym,
        "dataset_file": features_path.name,
        "total_csv_rows": total_dataset_rows,
        "unique_stocks_in_csv": len(unique_stocks),
        "symbol_feature_rows": len(rows),
        "duplicates_dropped": duplicates,
        "missing_numeric_rows": missing_numeric,
        "date_range": {
            "start": rows[0]["date"] if rows else None,
            "end": rows[-1]["date"] if rows else None,
        },
    }
    return rows, audit


def audit_raw_combined_dataset(combined_path: Path = COMBINED_CSV) -> Dict[str, Any]:
    """Verify row count and unique symbols in raw OHLCV combined CSV."""
    if not combined_path.exists():
        raise FileNotFoundError(f"Combined OHLCV CSV not found: {combined_path}")
    row_count = 0
    symbols = set()
    min_date = "9999-12-31"
    max_date = "0000-01-01"

    with combined_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            row_count += 1
            sym = (raw.get("symbol") or "").strip().upper()
            if sym:
                symbols.add(sym)
            d = _norm_date(raw.get("timestamp") or raw.get("date") or "")
            if d:
                if d < min_date:
                    min_date = d
                if d > max_date:
                    max_date = d

    return {
        "combined_file": combined_path.name,
        "raw_rows": row_count,
        "unique_stocks": len(symbols),
        "date_range": {"start": min_date, "end": max_date},
    }
