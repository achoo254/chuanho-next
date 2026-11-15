CREATE TABLE "library_listens" (
	"track_id" text NOT NULL,
	"day" text NOT NULL,
	"client_hash" text NOT NULL,
	CONSTRAINT "library_listens_track_id_day_client_hash_pk" PRIMARY KEY("track_id","day","client_hash")
);
--> statement-breakpoint
CREATE TABLE "library_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"file" text NOT NULL,
	"duration" double precision NOT NULL,
	"tags" jsonb NOT NULL,
	"bpm" double precision,
	"playable_beatmap" boolean,
	"added_at" timestamp with time zone NOT NULL,
	"listens" integer DEFAULT 0 NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_reason" text
);
--> statement-breakpoint
ALTER TABLE "library_listens" ADD CONSTRAINT "library_listens_track_id_library_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."library_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_listens_day_idx" ON "library_listens" USING btree ("day");