# Tasks

- [ ] Every `seedItems` row sets `floor` (`buy` | `assemble` | `foundry`)
- [ ] Buy leaves named: `t4000-som`, preferred carrier `rogue-t5`, PYXIS
      bodies, `rv1126b-turret` / `rv1126b-core`, `poe-switch-at`
- [ ] Assemble: kits (`kit-prod`, `kit-lab`, `kit-cine`, `kit-hybrid-plant`)
      and sandwiches (`asm-thor-sandwich`, `asm-lab-shell`, `asm-sat-mule`,
      `asm-sat-product`)
- [ ] Seed backfill in `seed.ts` remains a safety net, not the only tag
- [ ] Tests: GET `/items/t4000-som/bom` is empty; GET `/items/kit-prod/bom`
      still explodes to buy leaves; those SKUs return `floor`
