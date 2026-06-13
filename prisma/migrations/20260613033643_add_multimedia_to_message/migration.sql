-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "multimediaPublicId" TEXT,
ADD COLUMN     "multimediaUrl" TEXT,
ALTER COLUMN "text" DROP NOT NULL;
