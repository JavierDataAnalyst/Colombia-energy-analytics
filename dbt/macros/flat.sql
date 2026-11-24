{# Read every landed snapshot of one XM metric (layer 1 files written by etl/ingest.py). #}
{% macro flat(metric_key) -%}
read_parquet('{{ var("data_dir") }}/flat/{{ metric_key }}/*.parquet', union_by_name = true)
{%- endmacro %}

{# Keep only the latest load of each natural key: snapshots are never overwritten, so we pick here. #}
{% macro latest_load(partition_by) -%}
qualify row_number() over (partition by {{ partition_by }} order by loaded_at desc) = 1
{%- endmacro %}
