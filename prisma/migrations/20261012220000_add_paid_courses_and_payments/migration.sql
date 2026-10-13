-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CourseType" AS ENUM ('RECORDED', 'LIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LiveStatus" AS ENUM ('SCHEDULED', 'LIVE_NOW', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "discountedPrice" DECIMAL(10,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "courseType" "CourseType" NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "scheduleDaysText" TEXT;

-- AlterTable Lesson
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "isFreePreview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "liveMeetingUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "liveStatus" "LiveStatus";
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "recordingVideoUrl" TEXT;

-- CreateTable Payment
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX IF NOT EXISTS "Payment_courseId_idx" ON "Payment"("courseId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
