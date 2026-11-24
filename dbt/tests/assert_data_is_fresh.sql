-- Timeliness: the latest day should be at most 7 days old (XM publishes with a lag of a few days).
{{ config(severity = 'warn') }}
select max(date_day) as latest_day
from {{ ref('fct_system_hourly') }}
having max(date_day) < current_date - 7
