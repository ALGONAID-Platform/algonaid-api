-- CreateEnum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LessonOrderMode') THEN
        CREATE TYPE "LessonOrderMode" AS ENUM ('BY_DATE', 'BY_ORDER');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lessonOrderMode" "LessonOrderMode" NOT NULL DEFAULT 'BY_DATE';
