-- AlterTable: Add imageUrl to Lesson
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
