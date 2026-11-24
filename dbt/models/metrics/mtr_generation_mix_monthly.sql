-- Layer 3 · Certified metric. Generation by technology and its share of the month's total.
with by_tech as (
    select
        d.year_month,
        r.technology,
        sum(g.generation_kwh) / 1e6 as generation_gwh
    from {{ ref('fct_generation_by_resource_hourly') }} g
    join {{ ref('dim_resource') }} r using (resource_code)
    join {{ ref('dim_date') }} d using (date_day)
    group by d.year_month, r.technology
)
select
    year_month,
    technology,
    generation_gwh,
    generation_gwh / sum(generation_gwh) over (partition by year_month) as share_of_month
from by_tech
order by year_month, generation_gwh desc
