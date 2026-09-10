ALTER TABLE "quotes" ADD COLUMN "method" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "quotes_item_vendor_idx" ON "quotes" USING btree ("item_sku","vendor_id");--> statement-breakpoint
-- Backfill, mirroring seed.ts: every row already in the table came from the
-- catalog. A priced row is where a number came from, so it is `seed`; a
-- priceless row (the CTI "quote with the carrier" placeholders) is a human
-- note, so it is `manual`. Nothing here fabricates a checked_at.
UPDATE "quotes" SET "method" = 'seed' WHERE "price_cents" IS NOT NULL;
