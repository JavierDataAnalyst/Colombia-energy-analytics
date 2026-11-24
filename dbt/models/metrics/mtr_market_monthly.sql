-- Layer 3 · Certified metric. Monthly market and hydrology.
-- inflows_vs_historical: inflows as a share of their historical mean (below 1 = drier than usual).
-- reservoir_share_end_of_month: useful reservoir volume on the last day with data in the month.
with market as (
    select
        d.year_month,
        sum(f.demand_kwh) / 1e6                                      as demand_gwh,
        sum(f.spot_price_cop_kwh * f.demand_kwh) / sum(f.demand_kwh) as spot_price_weighted_cop_kwh,
        max(f.spot_price_cop_kwh)                                    as spot_price_max_cop_kwh,
        count(distinct f.date_day)                                   as days_with_data
    from {{ ref('fct_system_hourly') }} f
    join {{ ref('dim_date') }} d using (date_day)
    group by d.year_month
),
hydro as (
    select
        strftime(date_day, '%Y-%m')                                  as year_month,
        sum(inflows_kwh) / sum(inflows_historical_mean_kwh)          as inflows_vs_historical,
        arg_max(reservoir_useful_volume_share, date_day)             as reservoir_share_end_of_month,
        min(reservoir_useful_volume_share)                           as reservoir_share_min
    from {{ ref('fct_hydrology_daily') }}
    group by 1
)
select m.*, h.inflows_vs_historical, h.reservoir_share_end_of_month, h.reservoir_share_min
from market m
left join hydro h using (year_month)
order by year_month
