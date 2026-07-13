ALTER TABLE "jobs" ADD COLUMN "share_token_mom" text;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_share_token_mom_idx" ON "jobs" USING btree ("share_token_mom");