-- Layer 2 · Calendar, one row per day covered by the hourly data.
with bounds as (
    select min(date_day) as d0, max(date_day) as d1 from {{ ref('stg_xm__hourly') }}
)
select
    cast(d.day as date)                   as date_day,
    year(d.day)                           as year,
    month(d.day)                          as month,
    strftime(d.day, '%Y-%m')              as year_month,
    quarter(d.day)                        as quarter,
    isodow(d.day)                         as iso_weekday,
    isodow(d.day) >= 6                    as is_weekend
from bounds, generate_series(d0, d1, interval 1 day) as d(day)
