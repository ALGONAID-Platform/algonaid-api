-- AlterTable: Make lessonId optional in Exam table
ALTER TABLE "Exam" ALTER COLUMN "lessonId" DROP NOT NULL;

-- AlterTable: Add courseId column to Exam table
ALTER TABLE "Exam" ADD COLUMN "courseId" INTEGER;

-- CreateIndex: Unique constraint on courseId
CREATE UNIQUE INDEX "Exam_courseId_key" ON "Exam"("courseId");

-- AddForeignKey: Link Exam to Course
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
