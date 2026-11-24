-- Layer 3 · Certified metric. Average demand and spot price by hour of day, weekdays vs weekends, per year.
select
    d.year,
    d.is_weekend,
    f.hour_of_day,
    avg(f.demand_kwh) / 1e3          as avg_demand_mwh,
    avg(f.spot_price_cop_kwh)        as avg_spot_price_cop_kwh
from {{ ref('fct_system_hourly') }} f
join {{ ref('dim_date') }} d using (date_day)
group by d.year, d.is_weekend, f.hour_of_day
order by d.year, d.is_weekend, f.hour_of_day
