# Tasks

- [ ] `skills/ingest-hardware/SKILL.md` with trigger, HTTP-only rule, tree shape
- [ ] PDF path: `pdf2md` then the same markdown → tree path
- [ ] Skill POSTs `/api/v1/ingest` (base from env or localhost:5173); never drizzle
- [ ] Markdown: `###` + `PN` row becomes an item; other headings ignored; root from `#`/`##` or argument
- [ ] Tests: given a Thor shopping excerpt, the skill’s tree POSTs and reuses `t4000-som`; a mocked drizzle import is not in the skill
