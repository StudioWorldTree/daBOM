# Learnings

- 2026-09-09 `DEFAULT 'buy'` on `items.floor` would explode every seeded kit to nothing; migration and seed must set `assemble` for any SKU that is a parent in `bom_lines` (`add-compose-schema`).
