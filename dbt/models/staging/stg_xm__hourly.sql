-- Layer 1 · Typed copy of the hourly XM metrics. One row per metric × entity × code × date × hour (latest load).
with landed as (
    select * from {{ flat('demacome_sistema') }}
    union all by name select * from {{ flat('precbolsnaci_sistema') }}
    union all by name select * from {{ flat('gene_sistema') }}
    union all by name select * from {{ flat('gene_recurso') }}
)

select
    metric_id,
    entity,
    code,
    cast(date as date)            as date_day,
    cast(hour as integer)         as hour_of_day,
    try_cast(value_raw as double) as value,
    value_raw,
    loaded_at,
    source_file
from landed
{{ latest_load('metric_id, entity, code, date, hour') }}
