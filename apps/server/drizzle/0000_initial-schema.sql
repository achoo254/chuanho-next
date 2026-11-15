CREATE SEQUENCE "public"."journal_server_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"released_reset" boolean NOT NULL,
	"released_apology" boolean NOT NULL,
	"released_deed" boolean NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint DEFAULT nextval('journal_server_seq') NOT NULL,
	CONSTRAINT "journal_entries_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"doc" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiet_hour_days" (
	"day" text PRIMARY KEY NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiet_hour_people" (
	"day" text NOT NULL,
	"user_id" uuid NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "quiet_hour_people_day_user_id_pk" PRIMARY KEY("day","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_sub_unique" UNIQUE("sub")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiet_hour_people" ADD CONSTRAINT "quiet_hour_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entries_user_seq_idx" ON "journal_entries" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "quiet_hour_people_user_id_idx" ON "quiet_hour_people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");