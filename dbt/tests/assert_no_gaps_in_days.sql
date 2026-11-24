-- Completeness: no calendar day between the first and last day is missing from the system facts.
select d.date_day
from {{ ref('dim_date') }} d
left join (select distinct date_day from {{ ref('fct_system_hourly') }}) f using (date_day)
where f.date_day is null
