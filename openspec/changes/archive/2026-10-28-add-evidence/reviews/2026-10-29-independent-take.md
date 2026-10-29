1. Pin evidence to stable SKU identity while allowing several sources and several authored observations for one item.
2. Pin the distinction between an external document, a captured observation of it, and our interpretation; a URL alone cannot preserve changing content.
3. Pin history semantics explicitly: adding a later source or thought must preserve earlier material, and corrections need an intelligible policy.
4. Pin enough provenance to return to the source and distinguish document time, capture time, and note creation time where those exist.
5. Refuse to turn evidence into a second price history: quotes retain their URL, method, checked-at date, and append-only monetary fields.
6. Pin Hono/Zod/OpenAPI creation and retrieval contracts, including missing-item errors and validation of source references.
7. Pin ownership and deletion before adding foreign keys: item deletion currently removes quotes first, so evidence must not cause partial history loss on a failed delete.
8. Pin compatibility for existing source/notes values and ingest matching; new evidence must not silently overwrite seeded item metadata or write quotes.
9. Pin retry and duplicate semantics so callers know whether repeated submissions represent another observation or the same attachment.
10. Accept the tradeoff of a small evidence model over a document-management system if it preserves readable history and source traceability without requiring fetching or parsing on the server.
