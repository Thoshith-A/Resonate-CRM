-- AlterTable: cache the AI Channel Router preview per segment so the campaign
-- builder can render it instantly instead of re-running the router each visit.
ALTER TABLE "Segment" ADD COLUMN "routePreview" JSONB;
