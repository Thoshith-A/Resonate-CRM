import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { reseedDatabase } from "../apps/crm/src/server/admin/reseed";

// Load apps/crm/.env only when DATABASE_URL isn't already provided by the
// shell (so a Neon URL passed in for deploy seeding wins).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(resolve("apps/crm/.env"));
  } catch {
    // No .env file — rely on the ambient environment.
  }
}

const prisma = new PrismaClient();

// The generation logic lives in apps/crm/src/server/admin/reseed.ts so the
// admin reset endpoint and this CLI seed share ONE deterministic source.
async function main(): Promise<void> {
  const result = await reseedDatabase(prisma, (message) => console.log(message));
  console.log("Seed complete.");
  console.log(`  customers: ${result.customers}`);
  console.log(`  orders:    ${result.orders}`);
  console.log(`  "high spenders gone quiet" (>₹5,000 & 90d+ silent): ${result.lapsedHighSpenders}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
