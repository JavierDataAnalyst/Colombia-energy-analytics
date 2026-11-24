"""Catalog of the XM metrics this project ingests.

Codes verified against XM's metric catalog (POST /lists {"MetricId": "ListadoMetricas"}) on 2026-11-24.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Metric:
    metric_id: str
    entity: str
    endpoint: str  # hourly | daily | lists
    unit: str
    description: str

    @property
    def key(self) -> str:
        return f"{self.metric_id}_{self.entity}".lower()


METRICS = [
    Metric("DemaCome", "Sistema", "hourly", "kWh", "Commercial demand, national system"),
    Metric("PrecBolsNaci", "Sistema", "hourly", "COP/kWh", "National spot (exchange) price"),
    Metric("Gene", "Sistema", "hourly", "kWh", "Actual generation, national system"),
    Metric("Gene", "Recurso", "hourly", "kWh", "Actual generation by plant (resource)"),
    Metric("PorcVoluUtilDiar", "Sistema", "daily", "fraction", "Useful reservoir volume as a share of useful capacity"),
    Metric("AporEner", "Sistema", "daily", "kWh", "Hydro inflows, in energy"),
    Metric("AporEnerMediHist", "Sistema", "daily", "kWh", "Historical mean of hydro inflows, in energy"),
]

RESOURCES = Metric("ListadoRecursos", "Sistema", "lists", "", "Plants with technology and energy source")
