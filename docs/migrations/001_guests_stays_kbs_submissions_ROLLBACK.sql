-- Rollback: 001_guests_stays_kbs_submissions.sql ile oluşturulan tabloları kaldırır.
-- Dikkat: Önce KbsSubmission, sonra Stay, sonra Guest, sonra HotelStaff (FK sırası).

DROP TABLE IF EXISTS "KbsSubmission";
DROP TABLE IF EXISTS "Stay";
DROP TABLE IF EXISTS "Guest";
DROP TABLE IF EXISTS "HotelStaff";
