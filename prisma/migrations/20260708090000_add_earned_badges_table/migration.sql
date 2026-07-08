-- AlterTable: Add earnedBadges relation to Student (no column change needed, handled by EarnedBadge table)

-- CreateTable: EarnedBadge — stores permanently awarded badges
CREATE TABLE "EarnedBadge" (
    "id"        SERIAL NOT NULL,
    "key"       TEXT NOT NULL,
    "tier"      TEXT NOT NULL DEFAULT 'STANDARD',
    "earnedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" INTEGER NOT NULL,

    CONSTRAINT "EarnedBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Each student can earn each badge only once
CREATE UNIQUE INDEX "EarnedBadge_studentId_key_key" ON "EarnedBadge"("studentId", "key");

-- AddForeignKey
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
