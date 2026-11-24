"""Layer 1 (sources): land XM responses untouched, with load timestamp and controls.

Rules (from the project's data standard):
- The raw response is saved exactly as received (gzipped JSON) and never overwritten.
- A load is all-or-nothing: files are written only after the completeness checks pass.
- Closed months are loaded once; the current month gets a new snapshot on every run.
- Every load appends one control row to data/landing/_manifest.csv (rows, dates, total).

Usage:  python -m etl.ingest --start 2023-01-01 [--end 2026-11-23] [--only demacome_sistema]
"""

import argparse
import csv
import gzip
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from etl import xm_client
from etl.metrics import METRICS, RESOURCES, Metric

ROOT = Path(__file__).resolve().parent.parent
LANDING = ROOT / "data" / "landing"
FLAT = ROOT / "data" / "flat"
MANIFEST = LANDING / "_manifest.csv"


class IncompleteLoad(Exception):
    pass


# ---------------------------------------------------------------- helpers

def month_windows(start: date, end: date):
    """Calendar-month windows (at most 31 days, XM's limit for hourly/daily)."""
    cur = start
    while cur <= end:
        nxt = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)
        yield cur, min(nxt - timedelta(days=1), end)
        cur = nxt


def flatten(payload: dict, metric: Metric) -> pd.DataFrame:
    """Turn an XM response into long rows. Values stay as the original strings."""
    rows = []
    for item in payload["Items"]:
        day = item["Date"]
        if metric.endpoint == "hourly":
            for ent in item.get("HourlyEntities", []):
                vals = ent["Values"]
                for h in range(1, 25):
                    rows.append({"date": day, "code": vals.get("code"), "hour": h, "value_raw": vals.get(f"Hour{h:02d}")})
        elif metric.endpoint == "daily":
            for ent in item.get("DailyEntities", []):
                rows.append({"date": day, "code": ent.get("Id"), "hour": None, "value_raw": ent.get("Value")})
        else:  # lists
            for ent in item.get("ListEntities", []):
                rows.append({"date": day, **ent["Values"]})
    return pd.DataFrame(rows)


def check_complete(df: pd.DataFrame, metric: Metric, start: date, end: date) -> None:
    """Completeness control: every day in the window is present (and 24 hours for system metrics)."""
    if df.empty:
        raise IncompleteLoad(f"{metric.key} {start}..{end}: empty response")
    expected = {(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)}
    missing = sorted(expected - set(df["date"]))
    if missing:
        raise IncompleteLoad(f"{metric.key} {start}..{end}: {len(missing)} missing days, first {missing[0]}")
    if metric.endpoint == "hourly" and metric.entity == "Sistema":
        per_day = df.dropna(subset=["value_raw"]).groupby("date")["hour"].nunique()
        bad = per_day[per_day != 24]
        if not bad.empty:
            raise IncompleteLoad(f"{metric.key}: {len(bad)} days without 24 hours, first {bad.index[0]}")


def already_loaded(metric: Metric, period: str) -> bool:
    return any((LANDING / metric.key).glob(f"{period}__*.json.gz"))


def write_load(metric: Metric, period: str, payload: dict, df: pd.DataFrame, loaded_at: str) -> None:
    """Write raw + flat files. Temp names first, then rename: all or nothing."""
    stem = f"{period}__{loaded_at}"
    raw_dir, flat_dir = LANDING / metric.key, FLAT / metric.key
    raw_dir.mkdir(parents=True, exist_ok=True)
    flat_dir.mkdir(parents=True, exist_ok=True)
    raw_tmp, flat_tmp = raw_dir / f"{stem}.json.gz.tmp", flat_dir / f"{stem}.parquet.tmp"

    with gzip.open(raw_tmp, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    out = df.assign(metric_id=metric.metric_id, entity=metric.entity, loaded_at=loaded_at, source_file=f"{metric.key}/{stem}.json.gz")
    out.astype("string").to_parquet(flat_tmp, index=False)

    raw_tmp.rename(raw_dir / f"{stem}.json.gz")
    flat_tmp.rename(flat_dir / f"{stem}.parquet")


def log_manifest(metric: Metric, period: str, loaded_at: str, df: pd.DataFrame, status: str, note: str = "") -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    new = not MANIFEST.exists()
    total = pd.to_numeric(df.get("value_raw"), errors="coerce").sum() if "value_raw" in df else ""
    with MANIFEST.open("a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        if new:
            w.writerow(["metric", "period", "loaded_at", "rows", "days", "value_total", "status", "note"])
        w.writerow([metric.key, period, loaded_at, len(df), df["date"].nunique() if "date" in df else 0, total, status, note])


# ---------------------------------------------------------------- loads

def load_metric(metric: Metric, start: date, end: date, today: date) -> list[str]:
    errors = []
    for w_start, w_end in month_windows(start, end):
        period = w_start.strftime("%Y-%m")
        closed = w_end < today.replace(day=1)
        if closed and already_loaded(metric, period):
            continue
        loaded_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        body = {"MetricId": metric.metric_id, "StartDate": w_start.isoformat(), "EndDate": w_end.isoformat(), "Entity": metric.entity}
        try:
            payload = xm_client.post(metric.endpoint, body)
            df = flatten(payload, metric)
            check_complete(df, metric, w_start, w_end)
        except (xm_client.XMError, IncompleteLoad) as exc:
            errors.append(str(exc))
            log_manifest(metric, period, loaded_at, pd.DataFrame(), "rejected", str(exc)[:200])
            print(f"  x {metric.key} {period}: {exc}")
            continue
        write_load(metric, period, payload, df, loaded_at)
        log_manifest(metric, period, loaded_at, df, "loaded")
        print(f"  ok {metric.key} {period}: {len(df):,} rows")
    return errors


def load_resources(today: date) -> None:
    loaded_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    body = {"MetricId": RESOURCES.metric_id, "StartDate": today.isoformat(), "EndDate": today.isoformat(), "Entity": RESOURCES.entity}
    payload = xm_client.post("lists", body)
    df = flatten(payload, RESOURCES)
    if df.empty or "Code" not in df:
        raise IncompleteLoad("resource list is empty")
    write_load(RESOURCES, today.isoformat(), payload, df, loaded_at)
    log_manifest(RESOURCES, today.isoformat(), loaded_at, df, "loaded")
    print(f"  ok resources: {len(df):,} plants")


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2023-01-01")
    p.add_argument("--end", default=None, help="Defaults to 3 days ago (XM publishes with a lag)")
    p.add_argument("--only", default=None, help="Load a single metric key, e.g. demacome_sistema")
    a = p.parse_args(argv)

    today = date.today()
    start = date.fromisoformat(a.start)
    end = date.fromisoformat(a.end) if a.end else today - timedelta(days=3)

    errors = []
    for m in METRICS:
        if a.only and m.key != a.only:
            continue
        print(f"{m.key}: {start} -> {end}")
        errors += load_metric(m, start, end, today)
    if not a.only:
        load_resources(today)

    if errors:
        print(f"\n{len(errors)} window(s) rejected; see data/landing/_manifest.csv")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
