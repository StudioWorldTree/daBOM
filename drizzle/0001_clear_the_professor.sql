ALTER TABLE "items" ADD COLUMN "floor" text DEFAULT 'buy' NOT NULL;--> statement-breakpoint
CREATE INDEX "items_floor_idx" ON "items" USING btree ("floor");--> statement-breakpoint
-- Backfill: anything that already has children was built here, not bought.
-- Without this every seeded kit explodes to nothing the moment `floor` lands.
UPDATE "items" SET "floor" = 'assemble'
WHERE "sku" IN (SELECT DISTINCT "parent_sku" FROM "bom_lines");
