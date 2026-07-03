CREATE TABLE "action_items" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"owner" text NOT NULL,
	"task" text NOT NULL,
	"due_date" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "speaker_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_job_idx" ON "action_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "action_items_owner_idx" ON "action_items" USING btree ("owner");