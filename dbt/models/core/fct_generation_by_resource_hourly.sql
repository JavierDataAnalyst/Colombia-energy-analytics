-- Layer 2 · Grain: one row per date × hour × plant.
select
    date_day,
    hour_of_day,
    code  as resource_code,
    value as generation_kwh
from {{ ref('stg_xm__hourly') }}
where entity = 'Recurso' and metric_id = 'Gene'
