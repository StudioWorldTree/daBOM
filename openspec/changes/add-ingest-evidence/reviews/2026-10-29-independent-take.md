1. Pin evidence writes to the existing ingest transaction handle; a failure anywhere must roll back items, BOM lines, sources, and enrichment history together.
2. Pin provenance to the resolved SKU, including matched items and repeated occurrences of one SKU in the tree.
3. Preserve matched-row protection: only null manufacturer, MPN, or source may be filled; incoming notes must not silently overwrite existing notes.
4. Record enrichment for values actually persisted, distinguishing a new item or null-fill from a supplied value that matching ignored.
5. Define which document supports each persisted field; a list of documents alone must not imply unsupported field-level attribution.
6. Preserve legacy source behavior: node.source overrides request source for that node, while children still receive the request source rather than inheriting a parent override.
7. Define retry behavior for evidence as explicitly as BOM-line idempotency, including repeated identical documents and repeated SKU occurrences.
8. Reject invalid evidence atomically, keep quotes untouched, and expose the new request contract through Zod and the well-known OpenAPI document.
9. Refuse to assume add-evidence is implemented; identify the transaction-compatible source/enrichment contract this change needs before activation.
10. Tradeoff: automatic evidence reduces client bookkeeping, but attribution must remain conservative when several sources or ignored matched fields make the supporting document uncertain.
