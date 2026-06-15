-- CreateEnum
CREATE TYPE "ChannelStrategy" AS ENUM ('SINGLE', 'AI_ROUTED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "channelStrategy" "ChannelStrategy" NOT NULL DEFAULT 'SINGLE';

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "routingReason" TEXT;
