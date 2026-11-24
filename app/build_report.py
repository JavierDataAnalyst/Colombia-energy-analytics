"""Layer 4 · Product. Reads ONLY the certified metrics (schema `metrics`) and builds the charts and
the key figures used in the README. Every number here can be traced to one metrics model.

Usage:  python -m app.build_report
"""

import json
from pathlib import Path

import duckdb
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "warehouse.duckdb"
OUT = ROOT / "docs" / "img"

GREY, BLUE, RED, LIGHT = "#5a6370", "#2563eb", "#9b2c2c", "#e1e4e8"
TECH_COLORS = {"HIDRAULICA": "#2563eb", "TERMICA": "#9b2c2c", "SOLAR": "#d4a017", "EOLICA": "#2f9e8f",
               "COGENERADOR": "#7c8aa0", "UNCLASSIFIED": "#c7ccd3"}


TECH_LABELS = {"HIDRAULICA": "Hydro", "TERMICA": "Thermal", "SOLAR": "Solar", "EOLICA": "Wind",
               "COGENERADOR": "Cogeneration", "UNCLASSIFIED": "Unclassified"}


def first(con, sql):
    """First row of a query, or None. (Works with DuckDB 1.x and 2.x.)"""
    rows = con.sql(sql).fetchall()
    return rows[0] if rows else None


def style(ax, title, subtitle=None):
    ax.set_title(title, loc="left", fontsize=13, fontweight="bold", color="#16191d", pad=22 if subtitle else 10)
    if subtitle:
        ax.text(0, 1.02, subtitle, transform=ax.transAxes, fontsize=9.5, color=GREY)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color(LIGHT)
    ax.spines["bottom"].set_color(LIGHT)
    ax.tick_params(colors=GREY, labelsize=9)
    ax.grid(axis="y", color=LIGHT, linewidth=0.8)
    ax.set_axisbelow(True)


# Only complete months enter monthly charts and figures (the current month is still loading).
COMPLETE = ("(select * from metrics.mtr_market_monthly "
            "where days_with_data = day(last_day(strptime(year_month || '-01', '%Y-%m-%d'))))")

# Inflow bands used in the README. Dry = inflows below 70 % of their historical mean.
BAND_SQL = ("case when inflows_vs_historical < 0.7 then 'Dry (<70 % of normal)' "
            "when inflows_vs_historical < 1 then 'Below normal (70–100 %)' else 'Wet (≥100 %)' end")


def chart_hydro_vs_price(con):
    df = con.sql(f"select * from {COMPLETE} order by year_month").df()
    colors = [RED if v < 0.7 else ("#c7ccd3" if v < 1 else BLUE) for v in df["inflows_vs_historical"]]
    fig, ax = plt.subplots(figsize=(10, 4.6))
    ax.bar(df["year_month"], df["inflows_vs_historical"] * 100, color=colors, alpha=0.35,
           label="Hydro inflows, % of historical mean (red = dry, blue = wet)")
    ax.axhline(100, color=GREY, linewidth=0.8, linestyle="--")
    ax.set_ylabel("Inflows (% of historical mean)", color=GREY, fontsize=9)
    ax.set_ylim(0, 240)  # head room so the legend never covers a bar
    ax2 = ax.twinx()
    ax2.plot(df["year_month"], df["spot_price_weighted_cop_kwh"], color="#16191d", linewidth=2.2, marker="o",
             markersize=3, label="Spot price, demand-weighted (COP/kWh)")
    ax2.set_ylabel("Spot price (COP/kWh)", fontsize=9)
    ax2.spines["top"].set_visible(False)
    ax2.tick_params(colors=GREY, labelsize=9)
    style(ax, "The spot price follows the rain", "Monthly, national system, complete months. Source: XM public API.")
    ticks = list(range(0, len(df), 3))
    ax.set_xticks(ticks, [df["year_month"][i] for i in ticks], rotation=45, ha="right")
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper right", frameon=False, fontsize=8.5)
    fig.tight_layout()
    fig.savefig(OUT / "hydro_vs_price.png", dpi=150)
    plt.close(fig)


def chart_generation_mix(con):
    df = con.sql("select * from metrics.mtr_generation_mix_monthly").df()
    pivot = df.pivot_table(index="year_month", columns="technology", values="share_of_month", aggfunc="sum").fillna(0)
    order = [t for t in ["HIDRAULICA", "TERMICA", "SOLAR", "EOLICA", "COGENERADOR"] if t in pivot] + \
            [t for t in pivot.columns if t not in TECH_COLORS or t == "UNCLASSIFIED"]
    order = list(dict.fromkeys(order))
    fig, ax = plt.subplots(figsize=(10, 4.6))
    ax.stackplot(range(len(pivot)), [pivot[t] * 100 for t in order], labels=[TECH_LABELS.get(t, t.title()) for t in order],
                 colors=[TECH_COLORS.get(t, "#c7ccd3") for t in order], alpha=0.9)
    style(ax, "Thermal plants fill the gap in dry months", "Share of monthly generation by technology (%).")
    ticks = list(range(0, len(pivot), 3))
    ax.set_xticks(ticks, [pivot.index[i] for i in ticks], rotation=45, ha="right")
    ax.set_ylim(0, 100)
    ax.legend(loc="lower left", frameon=False, fontsize=8.5, ncol=len(order))
    fig.tight_layout()
    fig.savefig(OUT / "generation_mix.png", dpi=150)
    plt.close(fig)


def chart_hourly_profile(con):
    year = first(con, "select max(year) from metrics.mtr_hourly_profile")[0]
    df = con.sql(f"select * from metrics.mtr_hourly_profile where year = {year}").df()
    fig, ax = plt.subplots(figsize=(10, 4.2))
    for weekend, color, label in [(False, BLUE, "Weekdays"), (True, GREY, "Weekends")]:
        d = df[df["is_weekend"] == weekend]
        ax.plot(d["hour_of_day"], d["avg_demand_mwh"], color=color, linewidth=2.2, label=label)
    style(ax, f"Demand peaks in the evening ({year})", "Average hourly demand (MWh). Hour 19 = 18:00–19:00.")
    ax.set_xticks(range(1, 25))
    ax.legend(frameon=False, fontsize=9)
    fig.tight_layout()
    fig.savefig(OUT / "hourly_profile.png", dpi=150)
    plt.close(fig)


def key_figures(con) -> dict:
    """Figures quoted in the README. Monthly figures use complete months of the certified metrics."""
    m = COMPLETE
    q = lambda sql: first(con, sql)  # noqa: E731
    first_month, last_month = q(f"select min(year_month), max(year_month) from {m}")
    peak = q(f"select year_month, round(spot_price_weighted_cop_kwh) from {m} order by spot_price_weighted_cop_kwh desc limit 1")
    low = q(f"select year_month, round(reservoir_share_end_of_month * 100, 1) from {m} order by reservoir_share_end_of_month limit 1")
    corr = q(f"""select round(corr(reservoir_share_end_of_month, spot_price_weighted_cop_kwh), 2),
                        round(corr(inflows_vs_historical, spot_price_weighted_cop_kwh), 2) from {m}""")
    corr_thermal = q(f"""select round(corr(mm.spot_price_weighted_cop_kwh, t.share_of_month), 2)
                         from {m} mm join metrics.mtr_generation_mix_monthly t using (year_month)
                         where t.technology = 'TERMICA'""")
    bands = con.sql(f"""select {BAND_SQL} as band, count(*) as months, round(median(spot_price_weighted_cop_kwh)) as median_price
                        from {m} group by 1 order by median_price desc""").fetchall()
    thermal = q(f"""select t.year_month, round(t.share_of_month * 100, 1) from metrics.mtr_generation_mix_monthly t
                    join {m} mm using (year_month) where t.technology = 'TERMICA' order by t.share_of_month desc limit 1""")
    demand = con.sql("""select d.year, round(sum(m.demand_gwh)) from metrics.mtr_market_daily m
                        join core.dim_date d using (date_day) group by 1 order by 1""").fetchall()
    # Data-quality disclosure (not a business metric): plants logged as exceptions in layer 2.
    exceptions = q("select count(*), round(coalesce(sum(generation_gwh), 0), 1) from core.exc_resources_without_attributes")
    return {
        "period_complete_months": {"from": first_month, "to": last_month},
        "peak_spot_price_month": {"month": peak[0], "cop_kwh": peak[1]},
        "lowest_reservoir_month": {"month": low[0], "pct": low[1]},
        "corr_price_vs_reservoir_level": corr[0],
        "corr_price_vs_inflows": corr[1],
        "corr_price_vs_thermal_share": corr_thermal[0],
        "median_price_by_inflow_band": [{"band": b, "months": n, "median_cop_kwh": p} for b, n, p in bands],
        "peak_thermal_share_month": {"month": thermal[0], "pct": thermal[1]} if thermal else None,
        "annual_demand_gwh": {str(y): v for y, v in demand},
        "plants_without_attributes": {"count": exceptions[0], "gwh": exceptions[1]},
    }


# ---------------------------------------------------------------- site data (docs/data/*.json)

QUALITY_LABELS = {
    "assert_system_hourly_grain_and_completeness": ("Completeness", "24 hours per day with demand, price and generation"),
    "assert_no_gaps_in_days": ("Completeness", "No missing calendar days"),
    "assert_values_in_valid_range": ("Validity", "Demand, price and reservoir level within valid ranges"),
    "assert_generation_reconciles_with_system": ("Accuracy", "Plant-level generation reconciles with the system total (±0.5 %)"),
    "assert_data_is_fresh": ("Timeliness", "Latest data no older than 7 days"),
}


def describe_generic_test(name):
    """Readable label for dbt's generic tests (unique, not_null, relationships, accepted_values)."""
    models = ["fct_generation_by_resource_hourly", "fct_hydrology_daily", "mtr_market_monthly", "dim_resource", "dim_date"]
    model = next((m for m in models if m in name), "model")
    column = name.split(model, 1)[-1].strip("_").split("__")[0] if model in name else ""
    if name.startswith("unique_"):
        return "Uniqueness", f"{column} is unique in {model}"
    if name.startswith("not_null_"):
        return "Completeness", f"{column} is never empty in {model}"
    if name.startswith("relationships_"):
        return "Consistency", f"Every {column} in {model} exists in its dimension"
    if name.startswith("accepted_values_"):
        return "Validity", f"{column} only takes allowed values in {model}"
    return "Structure", name.replace("_", " ")


def export_site_data(con, figures):
    """Small JSON files for the project page. Read only from the certified metrics."""
    data_dir = ROOT / "docs" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    def dump(name, obj):
        (data_dir / name).write_text(json.dumps(obj, ensure_ascii=False, default=str, separators=(",", ":")), encoding="utf-8")

    monthly = con.sql(f"""select year_month,
            round(demand_gwh, 1) as demand_gwh,
            round(spot_price_weighted_cop_kwh, 1) as price,
            round(inflows_vs_historical * 100, 1) as inflows_pct,
            round(reservoir_share_end_of_month * 100, 1) as reservoir_pct
        from {COMPLETE} order by year_month""").df()
    mix = con.sql("""select year_month, technology, round(share_of_month * 100, 2) as share
        from metrics.mtr_generation_mix_monthly order by year_month""").df()
    hourly = con.sql("""select year, is_weekend, hour_of_day, round(avg_demand_mwh) as demand_mwh,
        round(avg_spot_price_cop_kwh, 1) as price from metrics.mtr_hourly_profile order by 1, 2, 3""").df()
    dump("monthly.json", monthly.to_dict(orient="records"))
    dump("mix.json", mix.to_dict(orient="records"))
    dump("hourly.json", hourly.to_dict(orient="records"))
    dump("key_figures.json", figures)

    # Data-quality panel: latest dbt test run, if available.
    results_file = ROOT / "dbt" / "target" / "run_results.json"
    if results_file.exists():
        run = json.loads(results_file.read_text(encoding="utf-8"))
        tests = []
        for r in run["results"]:
            if not r["unique_id"].startswith("test."):
                continue
            name = r["unique_id"].split(".")[2]
            control, text = QUALITY_LABELS.get(name) or describe_generic_test(name)
            tests.append({"name": name, "control": control, "description": text, "status": r["status"]})
        dump("quality.json", {"run_at": run["metadata"]["generated_at"], "tests": tests})


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB), read_only=True)
    chart_hydro_vs_price(con)
    chart_generation_mix(con)
    chart_hourly_profile(con)
    figures = key_figures(con)
    export_site_data(con, figures)
    (ROOT / "docs" / "key_figures.json").write_text(json.dumps(figures, indent=2, default=str), encoding="utf-8")
    print(json.dumps(figures, indent=2, default=str))


if __name__ == "__main__":
    main()
