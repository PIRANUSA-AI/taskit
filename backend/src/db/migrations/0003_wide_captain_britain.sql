ALTER TABLE "action_items" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "task_share_token" text;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_assignee_idx" ON "action_items" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_task_share_token_idx" ON "users" USING btree ("task_share_token");