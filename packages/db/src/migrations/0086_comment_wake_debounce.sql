ALTER TABLE "agent_wakeup_requests" ADD COLUMN IF NOT EXISTS "fire_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_wakeup_requests_pending_debounce_fire_idx" ON "agent_wakeup_requests" ("status","fire_at");
