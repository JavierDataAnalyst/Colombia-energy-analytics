-- Layer 2 · Exceptions log: plants with generation but no attributes in XM's list.
-- Reason is recorded; approver stays empty until someone reviews and signs off.
select
    d.resource_code,
    sum(g.value) / 1e6                         as generation_gwh,
    min(g.date_day)                            as first_seen,
    max(g.date_day)                            as last_seen,
    'Not present in the latest ListadoRecursos snapshot' as reason,
    cast(null as varchar)                      as approved_by
from {{ ref('dim_resource') }} d
join {{ ref('stg_xm__hourly') }} g on g.entity = 'Recurso' and g.code = d.resource_code
where d.is_exception
group by d.resource_code
