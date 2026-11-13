CREATE TABLE "projects" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "project" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_project_projects_slug_fk" FOREIGN KEY ("project") REFERENCES "public"."projects"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_project_idx" ON "items" USING btree ("project");