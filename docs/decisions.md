# Decision log

| Date | Decision | Why | Alternatives considered |
|---|---|---|---|
| 2026-11-24 | Use XM's public API (`servapibi.xm.com.co`) as the only source | Official market operator data, no key needed, documented metric catalog | SiMEM (newer platform; host was unreachable during setup), scraping reports |
| 2026-11-24 | Verify metric codes against the live catalog (`ListadoMetricas`) instead of documentation | The public README lists names but not codes | Hard-coding codes from examples |
| 2026-11-24 | DuckDB + dbt, files on disk | Free, reproducible on any laptop and in GitHub Actions; the same SQL ports to Athena/Redshift later | AWS (S3 + Athena) from day one: adds cost and setup before there is a product |
| 2026-11-24 | Land raw responses untouched and keep every snapshot; pick the latest in staging | Auditable and reproducible; a revised month never erases the original | Upserts that overwrite history |
| 2026-11-24 | Reject a whole monthly window if any day or hour is missing | A partial month silently biases averages | Loading what arrives and filling gaps later |
| 2026-11-24 | Weight the spot price by demand | Reflects what the market actually paid; simple average kept for comparison | Simple hourly average only |
| 2026-11-24 | Keep plants without attributes as `UNCLASSIFIED` exceptions | No generation is dropped; the gap is visible and reviewable | Inner join that silently drops them |
| 2026-11-24 | Data starts on 2023-01-01 | Covers the 2023–2024 El Niño dry period and the recovery after it | Longer history (more load time, same story) |
| 2026-11-24 | Public data only, no confidentiality marks on exports | All inputs are published by XM | — |
| 2026-11-24 | Lead with inflows, not reservoir level, in the main chart | The data showed price tracks inflows (corr. −0.68) much more than reservoir level (−0.18); the first draft assumed the opposite | Keeping the reservoir chart because it was the expected story |
