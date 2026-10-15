-- AlterTable Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "durationWeeks" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "scheduleDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateMinScore" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateMinAttendance" INTEGER NOT NULL DEFAULT 80;

-- AlterTable Lesson
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "dayNumber" INTEGER;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "isMandatory" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable Certificate
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" SERIAL NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "finalGrade" DECIMAL(5,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "qrCodeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable CourseReview
CREATE TABLE IF NOT EXISTS "CourseReview" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Certificate
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_serialNumber_key" ON "Certificate"("serialNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_studentId_courseId_key" ON "Certificate"("studentId", "courseId");
CREATE INDEX IF NOT EXISTS "Certificate_serialNumber_idx" ON "Certificate"("serialNumber");
CREATE INDEX IF NOT EXISTS "Certificate_studentId_idx" ON "Certificate"("studentId");
CREATE INDEX IF NOT EXISTS "Certificate_courseId_idx" ON "Certificate"("courseId");

-- CreateIndex CourseReview
CREATE UNIQUE INDEX IF NOT EXISTS "CourseReview_studentId_courseId_key" ON "CourseReview"("studentId", "courseId");
CREATE INDEX IF NOT EXISTS "CourseReview_courseId_idx" ON "CourseReview"("courseId");
CREATE INDEX IF NOT EXISTS "CourseReview_studentId_idx" ON "CourseReview"("studentId");

-- AddForeignKey Certificate
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_studentId_fkey') THEN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_courseId_fkey') THEN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey CourseReview
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseReview_studentId_fkey') THEN
    ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseReview_courseId_fkey') THEN
    ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

