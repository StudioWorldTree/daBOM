# Tasks

- [ ] Every `seedItems` row sets `floor` (`buy` | `assemble` only)
- [ ] `SeedItem` type requires `floor` (no optional, no default)
- [ ] Buy leaves named: `t4000-som`, preferred carrier `rogue-t5`, PYXIS
      bodies, `rv1126b-turret` / `rv1126b-core`, `poe-switch-at`; resin
      shells `resin-shell-front` / `resin-shell-rear` are `buy` (keep quote)
- [ ] Assemble: kits (`kit-prod`, `kit-lab`, `kit-cine`, `kit-hybrid-plant`)
      and assemblies (`asm-thor-sandwich`, `asm-lab-shell`, `asm-sat-mule`,
      `asm-sat-product`)
- [ ] Seed backfill in `seed.ts` stays; catalog test proves it is inert on
      the shipped seed. Upsert `set` list includes `floor`.
- [ ] Tests: catalog import of `seedItems`/`seedBoms` (fails today);
      GET `/items/t4000-som/bom` is empty; GET `/items/kit-prod/bom`
      still explodes to buy leaves
      Reader-added (advise, fable-5.1-arch-review):

- [x] Required `floor` on `SeedItem` so an untagged row fails typecheck
- [x] Catalog-level test over `seedItems`/`seedBoms`, not only the DB
- [x] No `foundry` in the seed; resin shells named `buy`
