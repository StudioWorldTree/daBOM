CREATE TABLE "enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_sku" text NOT NULL,
	"source_id" uuid,
	"field" text,
	"value" text NOT NULL,
	"body" text,
	"method" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_sources" (
	"item_sku" text NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "item_sources_item_sku_source_id_pk" PRIMARY KEY("item_sku","source_id")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"locator" text NOT NULL,
	"title" text,
	CONSTRAINT "sources_locator_unique" UNIQUE("locator")
);
--> statement-breakpoint
CREATE TABLE "thought_sources" (
	"thought_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "thought_sources_thought_id_source_id_pk" PRIMARY KEY("thought_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "thoughts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_sku" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_item_sku_items_sku_fk" FOREIGN KEY ("item_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_item_sku_items_sku_fk" FOREIGN KEY ("item_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thought_sources" ADD CONSTRAINT "thought_sources_thought_id_thoughts_id_fk" FOREIGN KEY ("thought_id") REFERENCES "public"."thoughts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thought_sources" ADD CONSTRAINT "thought_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thoughts" ADD CONSTRAINT "thoughts_item_sku_items_sku_fk" FOREIGN KEY ("item_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrichments_item_history_idx" ON "enrichments" USING btree ("item_sku","created_at","id");--> statement-breakpoint
CREATE INDEX "enrichments_source_idx" ON "enrichments" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "item_sources_source_idx" ON "item_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "thought_sources_source_idx" ON "thought_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "thoughts_item_history_idx" ON "thoughts" USING btree ("item_sku","created_at","id");--> statement-breakpoint
-- Legacy text is deliberately not subjected to new-request locator validation.
INSERT INTO sources (kind, locator)
SELECT DISTINCT 'notebook', regexp_replace(source, '^[[:space:]]+|[[:space:]]+$', '', 'g')
FROM items
WHERE source IS NOT NULL
  AND regexp_replace(source, '^[[:space:]]+|[[:space:]]+$', '', 'g') <> ''
ON CONFLICT (locator) DO NOTHING;
--> statement-breakpoint
INSERT INTO item_sources (item_sku, source_id)
SELECT items.sku, sources.id FROM items
JOIN sources ON sources.locator = regexp_replace(items.source, '^[[:space:]]+|[[:space:]]+$', '', 'g')
ON CONFLICT DO NOTHING;
