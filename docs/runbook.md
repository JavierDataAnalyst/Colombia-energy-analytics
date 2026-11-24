# Runbook

## Run it locally

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt

python -m etl.ingest --start 2023-01-01                    # layer 1: land XM data (first run takes a while)
dbt build --project-dir dbt --profiles-dir dbt             # layers 2–3: build models and run every test
python -m app.build_report                                 # layer 4: charts and key figures
python -m pytest                                           # offline tests of the ingestion code
```

## Where things are

| Path | Content | In git? |
|---|---|---|
| `data/landing/<metric>/<YYYY-MM>__<loaded_at>.json.gz` | Raw XM responses, exactly as received | No (reproducible) |
| `data/flat/<metric>/…parquet` | Same responses as rows, values still as strings | No |
| `data/landing/_manifest.csv` | One control row per load: rows, days, total, status | No |
| `data/warehouse.duckdb` | Built model (staging, core, metrics) | No |
| `docs/img/`, `docs/key_figures.json` | Published charts and figures | Yes |

## When something fails

| Symptom | Likely cause | What to do |
|---|---|---|
| `ingest` prints `x … missing days` or `24 hours` | XM has not published the full window yet | Nothing is written. Re-run later; check `_manifest.csv` (`rejected` rows). |
| `ingest` fails with `HTTP 5xx` or timeouts | XM API congestion | Retries are automatic (3). Re-run later. |
| `assert_generation_reconciles_with_system` fails | XM's plant-level and system publications disagree for those days | Inspect the listed days; do not publish charts until it is explained. Record the decision in `docs/decisions.md`. |
| `relationships` test on `dim_resource` fails | A new plant is not in XM's plant list | It should land in `exc_resources_without_attributes`; review and fill `approved_by`. |
| `assert_data_is_fresh` warns | The weekly refresh did not run | Run the *Refresh data* workflow manually. |

## Restating history

Closed months are loaded once and never overwritten. If XM revises a closed month, delete nothing: load the
month again with a new `loaded_at` (move the old files to an `_archive/` folder first so the loader re-fetches),
let staging pick the latest load, and note the change in `docs/decisions.md`.
