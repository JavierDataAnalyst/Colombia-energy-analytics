# Data dictionary

One card per certified metric (layer 3). Every metric is defined once, in one dbt model, and every chart or
figure in the README reads from these models only.

| Field | Meaning |
|---|---|
| **Owner** | Who answers for the definition |
| **Custodian** | Who keeps the pipeline running |
| **Source & cut-off** | Where the data comes from and how fresh it is |

Owner and custodian for all metrics: **Javier Daza** (single-person project; in a team the checker must be a different person).
Source for all metrics: **XM public API** (`https://servapibi.xm.com.co`), loaded weekly; XM publishes with a lag of a few days,
so the pipeline stops at *today − 3 days*.

---

## Spot price, demand-weighted (`spot_price_weighted_cop_kwh`)

- **Definition (words):** average price the market actually paid in the period: each hour's national spot price weighted by that hour's commercial demand.
- **Definition (SQL):** `sum(spot_price_cop_kwh * demand_kwh) / sum(demand_kwh)` over `fct_system_hourly`.
- **Models:** `mtr_market_daily`, `mtr_market_monthly`.
- **Unit:** COP/kWh.
- **Why weighted:** a simple average gives an expensive 3 a.m. hour the same weight as a busy 7 p.m. hour. The simple average is also kept (`spot_price_simple_avg_cop_kwh`) to make the difference visible.
- **Reference:** XM metrics `PrecBolsNaci` (Sistema) and `DemaCome` (Sistema).

## Demand (`demand_gwh`)

- **Definition:** commercial electricity demand of the national system, summed over the period.
- **SQL:** `sum(demand_kwh) / 1e6`.
- **Models:** `mtr_market_daily`, `mtr_market_monthly`. **Unit:** GWh. **Reference:** XM `DemaCome` (Sistema).

## Reservoir level, end of month (`reservoir_share_end_of_month`)

- **Definition:** useful reservoir volume as a share of useful capacity, on the last day of the month with data.
- **SQL:** `arg_max(reservoir_useful_volume_share, date_day)` per month over `fct_hydrology_daily`.
- **Model:** `mtr_market_monthly`. **Unit:** fraction (0–1). **Reference:** XM `PorcVoluUtilDiar` (Sistema).

## Inflows vs. historical mean (`inflows_vs_historical`)

- **Definition:** hydro inflows of the month divided by their historical mean. Below 1 means a drier month than usual.
- **SQL:** `sum(inflows_kwh) / sum(inflows_historical_mean_kwh)`.
- **Model:** `mtr_market_monthly`. **Reference:** XM `AporEner` and `AporEnerMediHist` (Sistema).

## Generation share by technology (`share_of_month`)

- **Definition:** generation of each technology (hydro, thermal, solar, wind, cogeneration) as a share of the month's plant-level total.
- **SQL:** `generation_gwh / sum(generation_gwh) over (partition by year_month)`, with technology from `dim_resource`.
- **Model:** `mtr_generation_mix_monthly`. **Reference:** XM `Gene` (Recurso) and `ListadoRecursos`.
- **Caveat:** plants missing from XM's current plant list are reported as `UNCLASSIFIED` and logged in `exc_resources_without_attributes`.

## Hourly profile (`avg_demand_mwh`, `avg_spot_price_cop_kwh`)

- **Definition:** average demand and price for each hour of the day, weekdays vs. weekends, per year.
- **Model:** `mtr_hourly_profile`.

---

## Data tests (each one can fail)

| Control | Test | What makes it fail |
|---|---|---|
| Completeness | `assert_system_hourly_grain_and_completeness` | A day without 24 hours, or an hour without demand, price or generation |
| Completeness | `assert_no_gaps_in_days` | A missing calendar day between the first and last day |
| Uniqueness | `unique` on `dim_date`, `dim_resource`, `fct_hydrology_daily`, `mtr_market_monthly` | Duplicate keys |
| Validity | `assert_values_in_valid_range` | Demand ≤ 0 or > 20 GWh in an hour; spot price < 0 or > 10,000 COP/kWh; reservoir share < 0 or > 110 % |
| Consistency | `relationships` from generation to `dim_resource` | A plant code with no dimension row |
| Accuracy | `assert_generation_reconciles_with_system` | Plant-level generation differs from the system total by more than 0.5 % on any day |
| Timeliness | `assert_data_is_fresh` (warning) | Latest day older than 7 days |

At ingestion (layer 1), a window is rejected — and nothing is written — if any day is missing or a system metric lacks one of its 24 hours.
