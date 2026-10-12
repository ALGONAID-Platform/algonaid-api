-- AlterTable: Make commentId optional in Mention table
ALTER TABLE "Mention" ALTER COLUMN "commentId" DROP NOT NULL;

-- AlterTable: Add postCommentId and postId columns to Mention table
ALTER TABLE "Mention" ADD COLUMN "postCommentId" INTEGER;
ALTER TABLE "Mention" ADD COLUMN "postId" INTEGER;

-- CreateIndex: Add index on postCommentId
CREATE INDEX "Mention_postCommentId_idx" ON "Mention"("postCommentId");

-- CreateIndex: Add index on postId
CREATE INDEX "Mention_postId_idx" ON "Mention"("postId");

-- AddForeignKey: Link Mention to PostComment
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_postCommentId_fkey" FOREIGN KEY ("postCommentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link Mention to Post
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
