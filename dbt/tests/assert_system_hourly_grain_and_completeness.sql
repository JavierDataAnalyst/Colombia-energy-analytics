-- Completeness + uniqueness: every day has exactly 24 distinct hours, each with demand, price and generation.
select date_day, count(*) as rows_, count(distinct hour_of_day) as hours,
       count(demand_kwh) as with_demand, count(spot_price_cop_kwh) as with_price, count(generation_kwh) as with_generation
from {{ ref('fct_system_hourly') }}
group by date_day
having count(*) <> 24 or count(distinct hour_of_day) <> 24
    or count(demand_kwh) <> 24 or count(spot_price_cop_kwh) <> 24 or count(generation_kwh) <> 24
