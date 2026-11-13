CREATE TABLE "purchase_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_sku" text NOT NULL,
	"vendor_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"vendor_sku" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_links" ADD CONSTRAINT "purchase_links_item_sku_items_sku_fk" FOREIGN KEY ("item_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_links" ADD CONSTRAINT "purchase_links_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_links_item_url_uidx" ON "purchase_links" USING btree ("item_sku","url");--> statement-breakpoint
CREATE INDEX "purchase_links_vendor_idx" ON "purchase_links" USING btree ("vendor_id");--> statement-breakpoint
-- Every URL a quote already carries is a place the part can be bought.
INSERT INTO "purchase_links" ("item_sku", "vendor_id", "url")
SELECT DISTINCT ON ("item_sku", "url") "item_sku", "vendor_id", "url"
FROM "quotes"
WHERE "url" IS NOT NULL AND "url" <> ''
ORDER BY "item_sku", "url", "created_at" DESC
ON CONFLICT DO NOTHING;
