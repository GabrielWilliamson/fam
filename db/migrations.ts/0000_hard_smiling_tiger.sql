DO $$ BEGIN
 CREATE TYPE "public"."currency" AS ENUM('dol', 'cor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."flow" AS ENUM('income', 'expense', 'conciliation', 'add');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."specialties" AS ENUM('PEDIATRIA', 'GENERAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."userRoles" AS ENUM('ADMIN', 'ASSISTANT', 'DOCTOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"dolars" integer DEFAULT 0 NOT NULL,
	"cordobas" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bankAccounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" "currency" NOT NULL,
	"color" text NOT NULL,
	"doctorId" uuid NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"doctorId" uuid NOT NULL,
	"patientId" uuid NOT NULL,
	"status" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"credential" text,
	"socials" json,
	"assistantId" uuid,
	"rate" double precision DEFAULT 0 NOT NULL,
	"specialtie" "specialties" DEFAULT 'GENERAL' NOT NULL,
	"infecto" text[],
	"hereditary" text[],
	"total" double precision DEFAULT 0 NOT NULL,
	"dolars" integer DEFAULT 0 NOT NULL,
	"cordobas" double precision DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_credential_unique" UNIQUE("credential")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tradeName" text NOT NULL,
	"genericName" text,
	"status" boolean DEFAULT true,
	"presentations" text[],
	"doctorId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"querieId" uuid NOT NULL,
	"vitals" json,
	"antropometrics" json,
	"aspects" text,
	"skin" text,
	"hea" json,
	"tor" json,
	"abd" text,
	"anus" text,
	"genitu" text,
	"neuro" text,
	"exInf" text,
	"exSup" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" text PRIMARY KEY NOT NULL,
	"patientId" uuid NOT NULL,
	"infecto" text[],
	"hereditary" text[],
	"apnp" json,
	"app" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctorId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"total" double precision NOT NULL,
	"cordobas" double precision NOT NULL,
	"dollars" double precision NOT NULL,
	"description" text NOT NULL,
	"flow" "flow" NOT NULL,
	"bankAccountId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"dni" text,
	"sex" text NOT NULL,
	"image" text,
	"address" json NOT NULL,
	"phone" text,
	"doctorId" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"QuerieId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prescriptionsDetails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescriptionId" uuid NOT NULL,
	"indications" text NOT NULL,
	"drugId" uuid NOT NULL,
	"presentations" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idFile" text NOT NULL,
	"resources" json[],
	"interrogation" text,
	"reason" text,
	"history" text,
	"observations" text,
	"diag" text,
	"status" text,
	"dateId" uuid,
	"price" double precision DEFAULT 0,
	"emergency" boolean DEFAULT false,
	"flowId" uuid,
	"doctorId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"dni" text,
	"relation" text NOT NULL,
	"nationality" text NOT NULL,
	"civilStatus" text NOT NULL,
	"phone" text,
	"patientId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerifiedAt" timestamp,
	"emailVerifToken" text,
	"image" text,
	"password" text NOT NULL,
	"role" "userRoles" NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistants" ADD CONSTRAINT "assistants_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bankAccounts" ADD CONSTRAINT "bankAccounts_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dates" ADD CONSTRAINT "dates_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dates" ADD CONSTRAINT "dates_patientId_patients_id_fk" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doctors" ADD CONSTRAINT "doctors_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drugs" ADD CONSTRAINT "drugs_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exams" ADD CONSTRAINT "exams_querieId_queries_id_fk" FOREIGN KEY ("querieId") REFERENCES "public"."queries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_patientId_patients_id_fk" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flows" ADD CONSTRAINT "flows_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flows" ADD CONSTRAINT "flows_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flows" ADD CONSTRAINT "flows_bankAccountId_bankAccounts_id_fk" FOREIGN KEY ("bankAccountId") REFERENCES "public"."bankAccounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patients" ADD CONSTRAINT "patients_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_QuerieId_queries_id_fk" FOREIGN KEY ("QuerieId") REFERENCES "public"."queries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescriptionsDetails" ADD CONSTRAINT "prescriptionsDetails_prescriptionId_prescriptions_id_fk" FOREIGN KEY ("prescriptionId") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prescriptionsDetails" ADD CONSTRAINT "prescriptionsDetails_drugId_drugs_id_fk" FOREIGN KEY ("drugId") REFERENCES "public"."drugs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "queries" ADD CONSTRAINT "queries_idFile_files_id_fk" FOREIGN KEY ("idFile") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "queries" ADD CONSTRAINT "queries_dateId_dates_id_fk" FOREIGN KEY ("dateId") REFERENCES "public"."dates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "queries" ADD CONSTRAINT "queries_flowId_flows_id_fk" FOREIGN KEY ("flowId") REFERENCES "public"."flows"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "queries" ADD CONSTRAINT "queries_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relatives" ADD CONSTRAINT "relatives_patientId_patients_id_fk" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
