# Design — add-floor-seed

Steer 2026-09-09. Send-back 2026-09-09 (Fable): acceptance could not
fail against today's backfill. Closed as below.

## Data, not a kind rule

Every `seedItems` row **requires** `floor: 'buy' | 'assemble'`.
`foundry` is reserved; no seed row uses it. Orthogonal to `kind`.

Assemble is the eight parents in `seedBoms`: `asm-lab-shell`,
`asm-thor-sandwich`, `asm-sat-mule`, `asm-sat-product`, `kit-lab`,
`kit-prod`, `kit-cine`, `kit-hybrid-plant`. Everyone else is `buy`,
including in-house resin shells (`resin-shell-front`,
`resin-shell-rear`) so their quotes still roll up.

## Proof the crib is not silent

A catalog-level test imports `seedItems` and `seedBoms` (not the DB):

- every `seedBoms` parent has `floor === 'assemble'` on the catalog row
- every non-parent has `floor === 'buy'`
- no row is `foundry`

That test fails today (no `floor` key) and passes after. DB-level
GET tests stay as a second door.

## Safety net

`seed.ts` backfill remains. After this change it is inert on the
shipped seed (the catalog test is the proof). Add `floor` to the
upsert `set` list so a future upsert path cannot drop it.

No new migration. No children under T4000 / Rogue-T5 / PYXIS /
RV1126B turret/core / PoE switch.
