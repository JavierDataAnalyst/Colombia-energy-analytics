-- Layer 3 · Certified metric. Daily market summary.
-- spot_price_weighted: hourly spot price weighted by hourly commercial demand (what the market actually paid on average).
select
    f.date_day,
    d.year_month,
    sum(f.demand_kwh) / 1e6                                         as demand_gwh,
    sum(f.generation_kwh) / 1e6                                     as generation_gwh,
    sum(f.spot_price_cop_kwh * f.demand_kwh) / sum(f.demand_kwh)    as spot_price_weighted_cop_kwh,
    avg(f.spot_price_cop_kwh)                                       as spot_price_simple_avg_cop_kwh,
    max(f.spot_price_cop_kwh)                                       as spot_price_max_cop_kwh,
    min(f.spot_price_cop_kwh)                                       as spot_price_min_cop_kwh
from {{ ref('fct_system_hourly') }} f
join {{ ref('dim_date') }} d using (date_day)
group by f.date_day, d.year_month
