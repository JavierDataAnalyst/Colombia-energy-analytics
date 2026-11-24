"""Offline tests for layer 1 (ingestion). They use trimmed real XM responses; no network calls."""

import json
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from etl import ingest
from etl.metrics import METRICS, RESOURCES

FIX = Path(__file__).parent / "fixtures"
BY_KEY = {m.key: m for m in METRICS}


def load(name):
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def test_month_windows_respect_calendar_and_xm_limit():
    windows = list(ingest.month_windows(date(2024, 1, 15), date(2024, 3, 10)))
    assert windows == [
        (date(2024, 1, 15), date(2024, 1, 31)),
        (date(2024, 2, 1), date(2024, 2, 29)),
        (date(2024, 3, 1), date(2024, 3, 10)),
    ]
    assert all((b - a).days < 31 for a, b in windows)


def test_flatten_hourly_keeps_original_strings():
    df = ingest.flatten(load("demacome_sistema"), BY_KEY["demacome_sistema"])
    assert len(df) == 48  # 2 days × 24 hours
    first = df.iloc[0]
    assert first["date"] == "2026-11-01" and first["hour"] == 1
    assert first["value_raw"] == "8948150.47000"  # untouched, not parsed


def test_flatten_daily_and_lists():
    daily = ingest.flatten(load("porcvoluutildiar_sistema"), BY_KEY["porcvoluutildiar_sistema"])
    assert list(daily["value_raw"]) == ["0.77590", "0.77870", "0.77837"]
    plants = ingest.flatten(load("listadorecursos_sistema"), RESOURCES)
    assert {"Code", "Type", "EnerSource"} <= set(plants.columns)


def test_completeness_accepts_full_window():
    df = ingest.flatten(load("demacome_sistema"), BY_KEY["demacome_sistema"])
    ingest.check_complete(df, BY_KEY["demacome_sistema"], date(2026, 11, 1), date(2026, 11, 2))


def test_completeness_rejects_missing_day():
    df = ingest.flatten(load("demacome_sistema"), BY_KEY["demacome_sistema"])
    with pytest.raises(ingest.IncompleteLoad, match="missing days"):
        ingest.check_complete(df, BY_KEY["demacome_sistema"], date(2026, 11, 1), date(2026, 11, 3))


def test_completeness_rejects_missing_hour():
    df = ingest.flatten(load("demacome_sistema"), BY_KEY["demacome_sistema"])
    df.loc[5, "value_raw"] = None
    with pytest.raises(ingest.IncompleteLoad, match="24 hours"):
        ingest.check_complete(df, BY_KEY["demacome_sistema"], date(2026, 11, 1), date(2026, 11, 2))


def test_completeness_rejects_empty_response():
    with pytest.raises(ingest.IncompleteLoad, match="empty"):
        ingest.check_complete(pd.DataFrame(), BY_KEY["demacome_sistema"], date(2026, 11, 1), date(2026, 11, 1))


def test_write_load_never_overwrites(tmp_path, monkeypatch):
    monkeypatch.setattr(ingest, "LANDING", tmp_path / "landing")
    monkeypatch.setattr(ingest, "FLAT", tmp_path / "flat")
    metric = BY_KEY["demacome_sistema"]
    payload = load("demacome_sistema")
    df = ingest.flatten(payload, metric)

    ingest.write_load(metric, "2026-11", payload, df, "20261124T000000Z")
    ingest.write_load(metric, "2026-11", payload, df, "20261125T000000Z")

    raw = sorted(p.name for p in (tmp_path / "landing" / metric.key).iterdir())
    assert raw == ["2026-11__20261124T000000Z.json.gz", "2026-11__20261125T000000Z.json.gz"]
    flat = pd.read_parquet(next((tmp_path / "flat" / metric.key).glob("*20261124*.parquet")))
    assert set(flat["loaded_at"]) == {"20261124T000000Z"}
    assert not list((tmp_path / "landing").rglob("*.tmp"))
