-- Layer 1 · Latest snapshot of XM's plant list (technology, energy source, dispatch type).
select
    "Code"          as resource_code,
    "Name"          as resource_name,
    "Type"          as technology,
    "EnerSource"    as energy_source,
    "Disp"          as dispatch_type,
    "RecType"       as resource_type,
    "State"         as state,
    try_cast("OperStartdate" as date) as operation_start,
    loaded_at
from {{ flat('listadorecursos_sistema') }}
where loaded_at = (select max(loaded_at) from {{ flat('listadorecursos_sistema') }})
{{ latest_load('"Code"') }}
