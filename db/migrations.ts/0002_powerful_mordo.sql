ALTER TABLE "assistants" ALTER COLUMN "amount" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "assistants" ALTER COLUMN "amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "queries" ALTER COLUMN "price" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "queries" ALTER COLUMN "price" SET DEFAULT 0;