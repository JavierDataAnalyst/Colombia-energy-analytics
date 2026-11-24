-- Reconciliation (accuracy): plant-level generation must add up to the system total each day,
-- within 0.5 %. If XM's two publications disagree, we want to know before using either.
with plants as (
    select date_day, sum(generation_kwh) as by_plants from {{ ref('fct_generation_by_resource_hourly') }} group by 1
),
system as (
    select date_day, sum(generation_kwh) as system_total from {{ ref('fct_system_hourly') }} group by 1
)
select date_day, by_plants, system_total, abs(by_plants - system_total) / system_total as gap
from plants join system using (date_day)
where abs(by_plants - system_total) / system_total > 0.005
