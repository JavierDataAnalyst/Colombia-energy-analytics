-- Layer 2 · Grain: one row per date × hour for the national system.
select
    date_day,
    hour_of_day,
    max(case when metric_id = 'DemaCome'     then value end) as demand_kwh,
    max(case when metric_id = 'PrecBolsNaci' then value end) as spot_price_cop_kwh,
    max(case when metric_id = 'Gene'         then value end) as generation_kwh
from {{ ref('stg_xm__hourly') }}
where entity = 'Sistema'
group by date_day, hour_of_day
