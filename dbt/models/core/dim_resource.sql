-- Layer 2 · Plants. Codes that appear in generation but not in XM's current list are kept as exceptions
-- (see exc_resources_without_attributes) so no generation is silently dropped.
with known as (
    select resource_code, resource_name, technology, energy_source, dispatch_type, state, false as is_exception
    from {{ ref('stg_xm__resources') }}
),
unknown as (
    select distinct g.code as resource_code, null as resource_name, 'UNCLASSIFIED' as technology,
           null as energy_source, null as dispatch_type, null as state, true as is_exception
    from {{ ref('stg_xm__hourly') }} g
    where g.entity = 'Recurso'
      and g.code not in (select resource_code from known)
)
select * from known
union all
select * from unknown
