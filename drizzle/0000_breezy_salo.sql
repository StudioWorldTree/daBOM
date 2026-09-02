CREATE TABLE "bom_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_sku" text NOT NULL,
	"child_sku" text NOT NULL,
	"qty" integer NOT NULL,
	"unit" text DEFAULT 'ea' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"notes" text,
	"optional" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"sku" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"manufacturer" text,
	"mpn" text,
	"notes" text,
	"source" text,
	"mass_g" integer,
	"width_mm" integer,
	"height_mm" integer,
	"depth_mm" integer,
	"watts_typical" integer,
	"watts_max" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_sku" text NOT NULL,
	"vendor_id" text NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"url" text,
	"checked_at" date,
	"in_stock" boolean,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"email" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_parent_sku_items_sku_fk" FOREIGN KEY ("parent_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_child_sku_items_sku_fk" FOREIGN KEY ("child_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_item_sku_items_sku_fk" FOREIGN KEY ("item_sku") REFERENCES "public"."items"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bom_parent_child_role_uidx" ON "bom_lines" USING btree ("parent_sku","child_sku","role");--> statement-breakpoint
CREATE INDEX "bom_parent_idx" ON "bom_lines" USING btree ("parent_sku");--> statement-breakpoint
CREATE INDEX "bom_child_idx" ON "bom_lines" USING btree ("child_sku");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_item_idx" ON "quotes" USING btree ("item_sku");--> statement-breakpoint
CREATE INDEX "quotes_vendor_idx" ON "quotes" USING btree ("vendor_id");