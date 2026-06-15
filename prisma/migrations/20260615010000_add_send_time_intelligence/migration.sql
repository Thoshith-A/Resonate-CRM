-- CreateEnum
CREATE TYPE "SendStrategy" AS ENUM ('INSTANT', 'SMART_WINDOWS');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "scheduledSendAt" TIMESTAMP(3),
ADD COLUMN     "sendStrategy" "SendStrategy" NOT NULL DEFAULT 'INSTANT';

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "actualSentAt" TIMESTAMP(3),
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "sendWindow" TEXT,
ADD COLUMN     "windowConfidence" TEXT;
