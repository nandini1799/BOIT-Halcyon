CREATE TYPE "public"."decision" AS ENUM('approved', 'rejected', 'pending');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('answered', 'unanswerable', 'blocked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."risk_band" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."segment" AS ENUM('retail', 'sme', 'corporate', 'private_banking');--> statement-breakpoint
CREATE TYPE "public"."tx_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" integer PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"opened_on" timestamp with time zone NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"segment" "segment" NOT NULL,
	"branch_id" integer NOT NULL,
	"risk_band" "risk_band" NOT NULL,
	"onboarded_on" timestamp with time zone NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_applications" (
	"id" integer PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"branch_id" integer NOT NULL,
	"segment" "segment" NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decision" "decision" NOT NULL,
	"rejection_reason" text,
	"channel" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"question" text NOT NULL,
	"outcome" "outcome" NOT NULL,
	"template_id" text,
	"sql_text" text,
	"checks" jsonb,
	"tables_touched" text[],
	"row_count" integer,
	"elapsed_ms" integer NOT NULL,
	"trace_id" text NOT NULL,
	"answer" jsonb
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"direction" "tx_direction" NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_applications" ADD CONSTRAINT "onboarding_applications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_applications" ADD CONSTRAINT "onboarding_applications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_segment_idx" ON "customers" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "customers_branch_idx" ON "customers" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "applications_submitted_idx" ON "onboarding_applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "applications_branch_idx" ON "onboarding_applications" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "applications_segment_idx" ON "onboarding_applications" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "applications_decision_idx" ON "onboarding_applications" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "query_log_asked_idx" ON "query_log" USING btree ("asked_at");--> statement-breakpoint
CREATE INDEX "transactions_occurred_idx" ON "transactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "transactions_customer_idx" ON "transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "transactions_branch_idx" ON "transactions" USING btree ("branch_id");