-- Layer 2 · Grain: one row per date for the national hydro system.
select
    date_day,
    max(case when metric_id = 'PorcVoluUtilDiar' then value end) as reservoir_useful_volume_share,
    max(case when metric_id = 'AporEner'         then value end) as inflows_kwh,
    max(case when metric_id = 'AporEnerMediHist' then value end) as inflows_historical_mean_kwh
from {{ ref('stg_xm__daily') }}
group by date_day
