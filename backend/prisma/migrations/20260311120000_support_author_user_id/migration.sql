-- Add author_user_id (Supabase user id) for push notifications when admin updates ticket
ALTER TABLE "support_tickets" ADD COLUMN "author_user_id" UUID;

CREATE INDEX "support_tickets_authorUserId_idx" ON "support_tickets"("author_user_id");
