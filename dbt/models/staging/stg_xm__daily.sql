-- Layer 1 · Typed copy of the daily hydrology metrics. One row per metric × date (latest load).
with landed as (
    select * from {{ flat('porcvoluutildiar_sistema') }}
    union all by name select * from {{ flat('aporener_sistema') }}
    union all by name select * from {{ flat('aporenermedihist_sistema') }}
)

select
    metric_id,
    entity,
    cast(date as date)            as date_day,
    try_cast(value_raw as double) as value,
    value_raw,
    loaded_at,
    source_file
from landed
{{ latest_load('metric_id, entity, date') }}
