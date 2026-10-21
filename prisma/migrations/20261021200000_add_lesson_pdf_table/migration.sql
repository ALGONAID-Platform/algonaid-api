-- CreateTable
CREATE TABLE IF NOT EXISTS "LessonPdf" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lessonId" INTEGER NOT NULL,

    CONSTRAINT "LessonPdf_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'LessonPdf_lessonId_fkey'
    ) THEN
        ALTER TABLE "LessonPdf" ADD CONSTRAINT "LessonPdf_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

