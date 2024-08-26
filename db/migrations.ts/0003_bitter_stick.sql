ALTER TABLE "queries" DROP CONSTRAINT "queries_doctorsId_doctors_id_fk";
--> statement-breakpoint
ALTER TABLE "queries" ADD COLUMN "doctorId" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "queries" ADD CONSTRAINT "queries_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "queries" DROP COLUMN IF EXISTS "doctorsId";