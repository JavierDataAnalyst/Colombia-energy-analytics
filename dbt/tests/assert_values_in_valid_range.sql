-- Validity: physical and market ranges. Thresholds are documented in docs/data_dictionary.md.
select 'demand' as check_, date_day, hour_of_day, demand_kwh as value
from {{ ref('fct_system_hourly') }} where demand_kwh <= 0 or demand_kwh > 20e6
union all
select 'spot_price', date_day, hour_of_day, spot_price_cop_kwh
from {{ ref('fct_system_hourly') }} where spot_price_cop_kwh < 0 or spot_price_cop_kwh > 10000
union all
select 'reservoir_share', date_day, null, reservoir_useful_volume_share
from {{ ref('fct_hydrology_daily') }} where reservoir_useful_volume_share < 0 or reservoir_useful_volume_share > 1.1
