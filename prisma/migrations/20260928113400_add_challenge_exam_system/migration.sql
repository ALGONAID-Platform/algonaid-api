-- Create ExamType enum
CREATE TYPE "ExamType" AS ENUM ('LESSON_QUIZ', 'COURSE_QUIZ', 'CHALLENGE');

-- Create RankingCriteria enum
CREATE TYPE "RankingCriteria" AS ENUM ('SCORE', 'SPEED', 'BOTH');

-- Alter Exam table: add new columns
ALTER TABLE "Exam"
  ADD COLUMN "imageUrl"        TEXT,
  ADD COLUMN "timeLimit"       INTEGER,
  ADD COLUMN "examType"        "ExamType"        NOT NULL DEFAULT 'LESSON_QUIZ',
  ADD COLUMN "rankingCriteria" "RankingCriteria" NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "startTime"       TIMESTAMP(3),
  ADD COLUMN "endTime"         TIMESTAMP(3);

-- Fix maxAttempts default to 1
ALTER TABLE "Exam" ALTER COLUMN "maxAttempts" SET DEFAULT 1;

-- Alter ExamAttempt table: add timeTaken and isRanked
ALTER TABLE "ExamAttempt"
  ADD COLUMN "timeTaken" INTEGER,
  ADD COLUMN "isRanked"  BOOLEAN NOT NULL DEFAULT false;
