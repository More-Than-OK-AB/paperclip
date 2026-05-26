CREATE TABLE IF NOT EXISTS "company_quota_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"weekly_cap_percent" real DEFAULT 100 NOT NULL,
	"freeze_exempt_roles" jsonb DEFAULT '["ceo","mtoka","platform-engineer"]'::jsonb NOT NULL,
	"mtoka_auto_freeze_enabled" boolean DEFAULT false NOT NULL,
	"mtoka_auto_freeze_soft_threshold_actual_pct" real,
	"mtoka_auto_freeze_soft_threshold_projected_eow_pct" real,
	"mtoka_auto_freeze_hard_threshold_actual_pct" real,
	"mtoka_auto_freeze_scoped_roles" jsonb,
	"auto_lift_at_actual_pct" real,
	"auto_lift_at_projected_eow_pct" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_agent_id" uuid,
	"updated_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_usage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by_agent_id" uuid NOT NULL,
	"sonnet_weekly_actual_pct" real NOT NULL,
	"sonnet_projected_eow_pct" real,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"declared_by_agent_id" uuid,
	"declared_by_user_id" text,
	"reason" text NOT NULL,
	"scope" text DEFAULT 'roles' NOT NULL,
	"scoped_roles" jsonb,
	"scoped_agent_ids" jsonb,
	"exempt_roles" jsonb,
	"auto_lift_conditions" jsonb,
	"scheduled_lift_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"lifted_by_agent_id" uuid,
	"lifted_by_user_id" text,
	"lift_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_freeze_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freeze_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by_agent_id" uuid,
	"changed_by_user_id" text,
	"previous_scoped_roles" jsonb,
	"new_scoped_roles" jsonb,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD COLUMN IF NOT EXISTS "freeze_gated_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_quota_policies_company_id_companies_id_fk') THEN
		ALTER TABLE "company_quota_policies" ADD CONSTRAINT "company_quota_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_quota_policies_updated_by_agent_id_agents_id_fk') THEN
		ALTER TABLE "company_quota_policies" ADD CONSTRAINT "company_quota_policies_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_usage_reports_company_id_companies_id_fk') THEN
		ALTER TABLE "company_usage_reports" ADD CONSTRAINT "company_usage_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_usage_reports_reported_by_agent_id_agents_id_fk') THEN
		ALTER TABLE "company_usage_reports" ADD CONSTRAINT "company_usage_reports_reported_by_agent_id_agents_id_fk" FOREIGN KEY ("reported_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_freezes_company_id_companies_id_fk') THEN
		ALTER TABLE "company_freezes" ADD CONSTRAINT "company_freezes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_freezes_declared_by_agent_id_agents_id_fk') THEN
		ALTER TABLE "company_freezes" ADD CONSTRAINT "company_freezes_declared_by_agent_id_agents_id_fk" FOREIGN KEY ("declared_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_freezes_lifted_by_agent_id_agents_id_fk') THEN
		ALTER TABLE "company_freezes" ADD CONSTRAINT "company_freezes_lifted_by_agent_id_agents_id_fk" FOREIGN KEY ("lifted_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_freeze_events_freeze_id_company_freezes_id_fk') THEN
		ALTER TABLE "company_freeze_events" ADD CONSTRAINT "company_freeze_events_freeze_id_company_freezes_id_fk" FOREIGN KEY ("freeze_id") REFERENCES "public"."company_freezes"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_freeze_events_changed_by_agent_id_agents_id_fk') THEN
		ALTER TABLE "company_freeze_events" ADD CONSTRAINT "company_freeze_events_changed_by_agent_id_agents_id_fk" FOREIGN KEY ("changed_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_wakeup_requests_freeze_gated_by_company_freezes_id_fk') THEN
		ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_freeze_gated_by_company_freezes_id_fk" FOREIGN KEY ("freeze_gated_by") REFERENCES "public"."company_freezes"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_quota_policies_company_unique_idx" ON "company_quota_policies" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_usage_reports_company_reported_at_idx" ON "company_usage_reports" USING btree ("company_id","reported_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_freezes_company_active_idx" ON "company_freezes" USING btree ("company_id") WHERE "lifted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_freezes_company_declared_at_idx" ON "company_freezes" USING btree ("company_id","declared_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_freeze_events_freeze_changed_at_idx" ON "company_freeze_events" USING btree ("freeze_id","changed_at");
